# Prompt 22 — Security Hardening & Input Validation

## Context

You are hardening the security of crypto-vision, a TypeScript crypto data platform handling sensitive financial data. The stack:

- **API server**: Hono v4.7 on Node.js 22, 200+ endpoints, serves market data, portfolios, AI predictions
- **Auth**: API key-based authentication for premium tiers + admin auth
- **External APIs**: 37 data source adapters sending HTTP requests to third-party APIs
- **Database**: PostgreSQL 16 (Drizzle ORM), Redis 7
- **Existing security surface**: `src/sources/goplus.ts` (token security scanning via GoPlus API)
- **Dashboard**: Next.js 15 with admin routes
- **Pump Agent Swarm**: Handles Solana private keys, wallet rotation, financial transactions
- **Payments**: x402 payment protocol support

Key files:
- `src/routes/` — 39 route modules
- `src/lib/` — shared libraries (cache, rate-limit, ai, bigquery, etc.)
- `src/sources/goplus.ts` — GoPlus token security checker
- `apps/dashboard/src/lib/` — Frontend auth, API clients
- `packages/pump-agent-swarm/src/` — Private key handling, wallet management
- `SECURITY.md` — Security policy

## Task

### 1. Input Validation (`src/lib/validation.ts`)

Create a Zod-based validation layer for all API inputs:

```typescript
import { z } from 'zod';

// Shared validators
export const CoinIdSchema = z.string()
  .min(1).max(100)
  .regex(/^[a-z0-9-]+$/, 'Invalid coin ID format');

export const SymbolSchema = z.string()
  .min(1).max(10)
  .regex(/^[A-Z0-9]+$/, 'Invalid symbol format')
  .transform(s => s.toUpperCase());

export const AddressSchema = z.string()
  .regex(/^(0x[a-fA-F0-9]{40}|[1-9A-HJ-NP-Za-km-z]{32,44})$/, 'Invalid address');

export const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).max(1000).default(1),
  limit: z.coerce.number().int().min(1).max(250).default(50),
});

export const DateRangeSchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
}).refine(d => !d.from || !d.to || d.from <= d.to, 'from must be before to');

// Route-specific schemas for ALL 39 route modules...
```

Apply Zod validation to every route handler:
- Parse and validate ALL query params, path params, and request bodies
- Return 400 with structured error messages on validation failure
- Strip unknown fields from request bodies

### 2. Rate Limiting (`src/lib/rate-limit.ts`)

Implement proper rate limiting:

```typescript
// Sliding window rate limiter using Redis
// Tiers:
//   - anonymous: 30 req/min, 500 req/day
//   - free: 100 req/min, 5000 req/day
//   - pro: 500 req/min, 50000 req/day
//   - enterprise: 2000 req/min, unlimited
//
// Per-endpoint limits for expensive operations:
//   - /ai/*: 10 req/min (free), 50 req/min (pro)
//   - /export/*: 5 req/min
//   - /search/*: 30 req/min
//
// Rate limit headers: X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset
// 429 response with Retry-After header
```

### 3. Security Headers Middleware (`src/lib/middleware/security.ts`)

```typescript
// Apply to all responses:
// - Content-Security-Policy: strict CSP
// - X-Content-Type-Options: nosniff
// - X-Frame-Options: DENY
// - X-XSS-Protection: 0 (rely on CSP instead)
// - Strict-Transport-Security: max-age=31536000; includeSubDomains
// - Referrer-Policy: strict-origin-when-cross-origin
// - Permissions-Policy: camera=(), microphone=(), geolocation=()
// - Cache-Control: no-store for authenticated endpoints
```

### 4. API Key Security (`src/lib/auth.ts`)

Audit and harden API key handling:
- Hash keys with SHA-256 + salt before storage (never store plaintext)
- Constant-time comparison for key validation (`crypto.timingSafeEqual`)
- Key rotation support (generate new key, grace period, revoke old)
- IP allowlist per key (optional)
- Usage tracking and anomaly detection (spike in usage → alert)
- Key scoping (read-only, read-write, admin)

### 5. CORS Configuration (`src/lib/middleware/cors.ts`)

```typescript
// Strict CORS:
// - Production: Only allow specific origins (dashboard domain)
// - Development: Allow localhost:3000, localhost:8080
// - Credentials: true (for API key cookies)
// - Methods: GET, POST, PUT, DELETE, OPTIONS
// - Max-Age: 86400
// - No wildcard * origins when credentials enabled
```

### 6. Request Sanitization

For all text inputs across the API:
- Strip HTML tags to prevent stored XSS
- Sanitize SQL-like patterns (even though using Drizzle ORM parameterized queries)
- Limit string lengths (prevent payload bombing)
- Reject null bytes in strings
- Validate Content-Type headers match request body

### 7. Secret Management Audit

Scan and fix secret handling across the entire codebase:
- Ensure NO secrets in source code (use env vars only)
- Ensure NO secrets logged (redact in logger serializers)
- Ensure private keys in pump-agent-swarm are handled securely:
  - Never logged
  - Zeroed from memory after use
  - Files have 0600 permissions
  - Encrypted at rest if stored on disk
- Audit `.env.example` files — ensure they have placeholder values only
- Ensure `SECURITY.md` has accurate vulnerability reporting instructions

### 8. Dependency Audit

```bash
# Run npm audit and fix
npm audit --audit-level=high
# Check for known vulnerabilities in Solana dependencies
# Review all postinstall scripts (security risk vector)
# Pin critical dependencies to exact versions
```

### 9. GoPlus Integration Hardening (`src/sources/goplus.ts`)

Review and improve the GoPlus token security scanner:
- Cache security check results (tokens don't change security status rapidly)
- Add timeout handling (don't let GoPlus API stall the request)
- Parse and surface all GoPlus risk flags:
  - is_honeypot
  - is_open_source
  - has_proxy (upgradeable)
  - can_take_back_ownership
  - owner_change_balance
  - hidden_owner
  - selfdestruct
  - external_call
  - buy_tax / sell_tax
- Create a security score from 0-100 based on GoPlus results
- Surface this in the dashboard and API responses

### 10. Admin Route Protection

For `apps/dashboard/` admin routes:
- Server-side auth verification on every admin API call
- CSRF protection for state-changing operations
- Session timeout (15 minute idle, 24 hour max)
- Audit logging for all admin actions
- Two-step verification for destructive operations (delete, reset)

## Verification

1. Send malformed inputs to every route → all return 400 with structured errors
2. Rate limit kicks in at configured thresholds → returns 429 with `Retry-After`
3. Response headers include all security headers
4. `grep -r "console.log.*key\|console.log.*secret\|console.log.*password" src/` returns 0 results
5. `npm audit --audit-level=high` returns 0 vulnerabilities
6. `npm run typecheck` passes
7. All tests pass
