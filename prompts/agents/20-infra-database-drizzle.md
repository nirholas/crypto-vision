# Prompt 20 — Infrastructure: Database Schema, Migrations & Drizzle ORM

## Context

You are working on the database layer of crypto-vision. The project uses:

- **PostgreSQL 16** as the primary database
- **Drizzle ORM** v0.45 for schema management and queries
- `drizzle.config.ts` — Drizzle Kit config at project root
- `src/lib/db/` — Database connection and schema
- `src/bot/db/` — Bot-specific schema (Telegram bot)

The API server needs PostgreSQL for:
- API key storage and management
- User data (for premium features)
- Portfolio data (server-side sync)
- Cached market data snapshots
- Anomaly detection results
- Search analytics
- Agent execution logs

The Telegram bot needs tables for:
- Users, groups, channels
- Token calls and PnL tracking
- Premium subscriptions
- Referral system
- Leaderboard data

## Task

### 1. Complete the Core Schema (`src/lib/db/schema.ts`)

Define all tables using Drizzle ORM:

```typescript
import { pgTable, text, integer, timestamp, real, jsonb, boolean, serial, uuid, index, uniqueIndex } from 'drizzle-orm/pg-core';

// API Keys
export const apiKeys = pgTable('api_keys', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  keyHash: text('key_hash').notNull().unique(),
  keyPrefix: text('key_prefix').notNull(), // First 8 chars for identification
  tier: text('tier', { enum: ['free', 'pro', 'enterprise'] }).default('free').notNull(),
  rateLimit: integer('rate_limit').default(100).notNull(), // requests per minute
  requestCount: integer('request_count').default(0).notNull(),
  lastUsedAt: timestamp('last_used_at'),
  expiresAt: timestamp('expires_at'),
  isActive: boolean('is_active').default(true).notNull(),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  keyHashIdx: uniqueIndex('api_keys_key_hash_idx').on(table.keyHash),
  prefixIdx: index('api_keys_prefix_idx').on(table.keyPrefix),
}));

// Market Snapshots (cached from workers)
export const marketSnapshots = pgTable('market_snapshots', {
  id: serial('id').primaryKey(),
  coinId: text('coin_id').notNull(),
  symbol: text('symbol').notNull(),
  price: real('price').notNull(),
  marketCap: real('market_cap'),
  volume24h: real('volume_24h'),
  priceChange24h: real('price_change_24h'),
  priceChange7d: real('price_change_7d'),
  rank: integer('rank'),
  snapshotAt: timestamp('snapshot_at').defaultNow().notNull(),
}, (table) => ({
  coinIdIdx: index('market_snapshots_coin_id_idx').on(table.coinId),
  snapshotAtIdx: index('market_snapshots_snapshot_at_idx').on(table.snapshotAt),
}));

// Continue for ALL tables...
```

**Tables needed:**
- `api_keys` — API key management
- `market_snapshots` — Price history from workers
- `defi_snapshots` — DeFi TVL/yield snapshots
- `news_articles` — Indexed news articles
- `anomaly_events` — Detected anomalies
- `search_queries` — Search analytics
- `agent_executions` — AI agent execution logs
- `portfolios` — Server-side portfolio storage
- `portfolio_holdings` — Holdings within portfolios
- `portfolio_transactions` — Buy/sell transactions
- `watchlists` — User watchlists
- `price_alerts` — User price alerts
- `export_jobs` — Data export job tracking

### 2. Complete Bot Schema (`src/bot/db/schema.ts`)

Review and fix the existing bot schema:
- `users` — Telegram users
- `groups` — Telegram groups
- `channels` — Telegram channels
- `token_calls` — Token call tracking (PnL)
- `premium_subscriptions` — Premium features
- `referrals` — Referral tracking
- `leaderboard` — Leaderboard data
- `insider_alerts` — Insider trading alerts

### 3. Create Database Connection (`src/lib/db/index.ts`)

```typescript
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';

// DATABASE_URL from env
// Connection pool: min 2, max 10
// Idle timeout: 30s
// Statement timeout: 30s
// SSL: required in production

export const db = drizzle(client, { schema });
export type Database = typeof db;
```

### 4. Create Migration Scripts

**Generate migrations:**
```bash
npx drizzle-kit generate
```

**Run migrations:**
```bash
npx drizzle-kit migrate
```

Create a migration runner that works in production:
```typescript
// src/lib/db/migrate.ts
// Runs pending Drizzle migrations on startup
// Logs migration status
// Rolls back on failure
```

### 5. Fix drizzle.config.ts

```typescript
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: ['./src/lib/db/schema.ts', './src/bot/db/schema.ts'],
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

### 6. Create DB Query Helpers

```typescript
// src/lib/db/queries.ts
// Reusable query functions:
//
// API Keys:
//   createApiKey(name, tier) → key string + record
//   validateApiKey(keyHash) → ApiKey | null
//   incrementKeyUsage(id) → void
//   revokeApiKey(id) → void
//
// Market Data:
//   insertMarketSnapshot(data[]) → void (batch insert)
//   getLatestSnapshot(coinId) → MarketSnapshot | null
//   getSnapshots(coinId, from, to) → MarketSnapshot[]
//
// Portfolios:
//   createPortfolio(userId, name) → Portfolio
//   addHolding(portfolioId, coinId, amount, price) → Holding
//   getPortfolio(id) → Portfolio with holdings
//
// Anomalies:
//   insertAnomaly(event) → void
//   getAnomalies(filters) → AnomalyEvent[]
```

### 7. Seed Script

Create `scripts/seed-db.ts`:
```typescript
// Seed the database with initial data:
// - Default API key for development
// - Sample market snapshots (last 24h of BTC/ETH)
// - Sample anomaly events
```

## Verification

1. `npx drizzle-kit generate` generates migrations without errors
2. `npx drizzle-kit push` pushes schema to local PostgreSQL
3. Database connection works: test with `npx tsx -e "import { db } from './src/lib/db/index.js'; console.log('connected')"`
4. All table schemas are valid TypeScript
5. Query helpers return properly typed results
6. `npm run typecheck` passes
