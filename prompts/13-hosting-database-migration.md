# Prompt 13: MCP Hosting Platform — Database Migration (In-Memory → PostgreSQL)

## Agent Identity & Rules

```
You are migrating the MCP Hosting Platform from in-memory Maps to real PostgreSQL persistence via Drizzle ORM.
- Always work on the current branch
- Before any git commit or push, configure:
    git config user.name "nirholas"
    git config user.email "nirholas@users.noreply.github.com"
- Always use background terminals (isBackground: true)
- Always kill terminals after commands complete
- No mocks, no stubs, no placeholders — every function must do real work
- TypeScript strict mode — no `any` types, no `@ts-ignore`
- Follow existing Drizzle ORM patterns from `src/lib/db/schema.ts` and `src/bot/db/schema.ts`
```

## Objective

Replace ALL in-memory `Map<>` storage in `packages/mcp-server/hosting/` with real PostgreSQL tables via Drizzle ORM. Currently, the following files use in-memory Maps that lose all data on restart:

1. **`hosting/auth.ts`** — `users` Map and `usersByEmail` Map for user accounts
2. **`hosting/router.ts`** — `hostedServersDB` Map for server configs, `usageLogsDB` array for usage logs
3. **`hosting/revenue.ts`** — `paymentRecords` Map, `serverMetadata` Map, `userMetadata` Map

## Context

### Existing Database Patterns (READ THESE — follow the same conventions)

The project uses Drizzle ORM with PostgreSQL. Study these files for patterns:

- `src/lib/db/schema.ts` (499 lines) — Core API schema with pgEnum, pgTable, indexes, timestamps
- `src/bot/db/schema.ts` (471 lines) — Bot schema with relations, enums, composite indexes
- `drizzle.config.ts` — Drizzle configuration

Key conventions:
- UUIDs for primary keys via `uuid("id").defaultRandom().primaryKey()`
- `timestamp("created_at").defaultNow().notNull()` and `timestamp("updated_at").defaultNow().notNull()`
- Indexes on foreign keys and frequently queried columns
- pgEnum for constrained string columns
- `$inferSelect` / `$inferInsert` type exports

### Current Hosting Package Structure

```
packages/mcp-server/hosting/
├── auth.ts       — JWT auth with bcrypt, users stored in Map<string, StoredUser>
├── router.ts     — Express router, servers stored in Map<string, HostedMCPServer>
├── runtime.ts    — Server creation/routing (depends on DB for config loading)
├── revenue.ts    — Payment tracking, paymentRecords in Map<string, PaymentRecord>
├── stripe.ts     — Stripe subscription (already real — calls actual Stripe API)
└── types.ts      — TypeScript interfaces (HostedMCPServer, HostedMCPTool, etc.)
```

### What the Types Look Like

From `hosting/types.ts`:
```typescript
interface MCPHostingUser {
  id: string; email: string; username: string;
  tier: 'free' | 'pro' | 'business' | 'enterprise';
  createdAt: Date; stripeCustomerId?: string; stripeSubscriptionId?: string;
}

interface HostedMCPServer {
  id: string; userId: string; name: string; description: string;
  subdomain: string; customDomain?: string;
  status: 'active' | 'paused' | 'suspended';
  tools: HostedMCPTool[]; prompts: HostedMCPPrompt[]; resources: HostedMCPResource[];
  pricing: MCPPricingConfig;
  totalCalls: number; totalRevenue: number; callsThisMonth: number;
  createdAt: Date; updatedAt: Date;
}
```

From `hosting/revenue.ts`:
```typescript
interface PaymentRecord {
  id: string; serverId: string; toolId: string; toolName: string;
  txHash: string; amount: string; amountUSD: number;
  creatorAmount: number; platformAmount: number;
  chain: SupportedChainId; chainName: string;
  sender: string; recipient: string;
  status: "pending" | "confirmed" | "paid_out";
  createdAt: Date; confirmedAt?: Date; paidOutAt?: Date;
}
```

## Deliverables

### 1. Schema file: `packages/mcp-server/hosting/db/schema.ts`

Create a complete Drizzle schema with these tables:

```
hosting_users
  - id (uuid PK)
  - email (varchar unique, not null)
  - username (varchar unique, not null)
  - password_hash (text, not null)
  - tier (pgEnum: free/pro/business/enterprise, default 'free')
  - stripe_customer_id (varchar, nullable)
  - stripe_subscription_id (varchar, nullable)
  - created_at, updated_at (timestamps)
  - INDEX on email, stripe_customer_id

hosted_mcp_servers
  - id (uuid PK)
  - user_id (uuid FK → hosting_users, not null)
  - name (varchar, not null)
  - description (text)
  - subdomain (varchar unique, not null)
  - custom_domain (varchar, nullable)
  - status (pgEnum: active/paused/suspended, default 'active')
  - tools (jsonb, default '[]')
  - prompts (jsonb, default '[]')
  - resources (jsonb, default '[]')
  - pricing (jsonb, not null)
  - total_calls (integer, default 0)
  - total_revenue (real, default 0)
  - calls_this_month (integer, default 0)
  - created_at, updated_at
  - INDEX on user_id, subdomain, status

hosting_usage_logs
  - id (uuid PK)
  - server_id (uuid FK → hosted_mcp_servers)
  - user_id (uuid FK → hosting_users)
  - tool_name (varchar)
  - response_time (integer, ms)
  - success (boolean)
  - payment_amount (real, nullable)
  - payment_tx_hash (varchar, nullable)
  - error (text, nullable)
  - created_at

hosting_payment_records
  - id (uuid PK)
  - server_id (uuid FK → hosted_mcp_servers)
  - tool_id (varchar)
  - tool_name (varchar)
  - tx_hash (varchar, not null)
  - amount (varchar, not null)
  - amount_usd (real, not null)
  - creator_amount (real, not null)
  - platform_amount (real, not null)
  - chain (integer, not null)
  - chain_name (varchar)
  - sender (varchar, not null)
  - recipient (varchar, not null)
  - status (pgEnum: pending/confirmed/paid_out)
  - confirmed_at (timestamp, nullable)
  - paid_out_at (timestamp, nullable)
  - created_at
  - INDEX on server_id, status, tx_hash, created_at
```

### 2. Database client: `packages/mcp-server/hosting/db/client.ts`

Create a Drizzle database connection client following the same pattern as the main app. Use `DATABASE_URL` env var.

### 3. Update `hosting/auth.ts`

Replace in-memory Maps with real Drizzle queries:
- `signUp()` → `db.insert(hostingUsers).values(...).returning()`
- `signIn()` → `db.select().from(hostingUsers).where(eq(hostingUsers.email, ...))`
- `getUserById()` → `db.select().from(hostingUsers).where(eq(hostingUsers.id, ...))`
- `updateUserTier()` → `db.update(hostingUsers).set(...).where(...)`
- `updateUserStripeInfo()` → same pattern
- Remove the `users` Map, `usersByEmail` Map, and `generateUserId()` (use DB-generated UUID)
- Keep all existing function signatures — only change the internals

### 4. Update `hosting/router.ts`

Replace in-memory Maps:
- `getServerBySubdomain()` → `db.select().from(hostedMcpServers).where(eq(hostedMcpServers.subdomain, ...))`
- `incrementCallCount()` → `db.update(hostedMcpServers).set({ totalCalls: sql\`total_calls + 1\`, callsThisMonth: sql\`calls_this_month + 1\` })`
- `logUsage()` → `db.insert(hostingUsageLogs).values(...)`
- Remove `hostedServersDB` Map and `usageLogsDB` array

### 5. Update `hosting/revenue.ts`

Replace ALL in-memory Maps with Drizzle queries:
- `recordPayment()` → `db.insert(hostingPaymentRecords).values(...).returning()`
- `getServerRevenue()` → Aggregate query with `sum()` and `count()` grouped by tool
- `getUserRevenue()` → Join with `hostedMcpServers` table to get all user's servers, then aggregate
- `getPlatformRevenue()` → Full table aggregate
- `getPendingPayouts()` → Query with `status = 'confirmed'` grouped by user
- `processPayouts()` → **Leave the actual USDC transfer as-is for now** (that's a separate prompt), but DO update payment status in the DB
- `getTransactionHistory()` → Real paginated query with `offset`/`limit`
- Remove `paymentRecords` Map, `serverMetadata` Map, `userMetadata` Map
- Remove `registerServer()` and `registerUser()` — no longer needed (data lives in users/servers tables)

### 6. Update `hosting/types.ts`

- `isSubdomainAvailable()` → query the `hostedMcpServers` table for existing subdomain
- Remove the `// TODO: Check database for existing subdomains` comment

### 7. Update `hosting/runtime.ts`

- `getServerForSubdomain()` → call the updated `getServerBySubdomain()` from router.ts
- Remove the `// TODO: Load config from database` comment and the `return null`

## Constraints

- Do NOT change the Stripe integration (`stripe.ts`) — it already calls the real Stripe API
- Do NOT implement the actual USDC payout transfer in `processPayouts()` — that's a separate task
- DO keep all existing function signatures and return types identical — only change internals
- DO add proper error handling with try/catch on every DB operation
- DO add connection pooling configuration
- DO ensure migrations can be generated via `npx drizzle-kit generate`
- DO handle the case where the database is unavailable (graceful degradation with logging)
- Test the migration by running the Drizzle migration against a local PostgreSQL instance

## Verification

After implementation:
1. Run `npx drizzle-kit generate` to generate SQL migrations
2. Run `npx drizzle-kit push` against local PostgreSQL to verify schema
3. Verify all existing tests still pass
4. Grep for any remaining `Map<` in the hosting directory — there should be zero (except the session cache in router.ts which is intentionally in-memory)
5. Grep for any remaining `// TODO` — they should all be resolved
