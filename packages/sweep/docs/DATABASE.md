# Database Schema Documentation

> **⚠️ CRITICAL: This database stores user data and transaction history. Handle with care.**

## Table of Contents

1. [Overview](#overview)
2. [Entity Relationship Diagram](#entity-relationship-diagram)
3. [Tables Reference](#tables-reference)
4. [Migrations](#migrations)
5. [Indexes](#indexes)
6. [Common Queries](#common-queries)

---

## Overview

Sweep uses **PostgreSQL 16** with **Drizzle ORM** for type-safe database operations.

### Technology Stack

| Component | Technology |
|-----------|------------|
| Database | PostgreSQL 16 |
| ORM | Drizzle ORM |
| Migrations | Drizzle Kit |
| Connection | postgres.js |

### Schema Location

- **Schema Definition**: `src/db/schema.ts`
- **Migrations**: `drizzle/migrations/`
- **Configuration**: `drizzle.config.ts`

---

## Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           SWEEP DATABASE SCHEMA                             │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌─────────────┐          ┌─────────────┐          ┌─────────────────┐         │
│  │   users     │          │   sweeps    │          │  sweep_quotes   │         │
│  ├─────────────┤          ├─────────────┤          ├─────────────────┤         │
│  │ id (PK)     │◄────────┤│ user_id (FK)│          │ id (PK)         │         │
│  │ wallet_addr │          │ id (PK)     │          │ user_id (FK)────┼──┐      │
│  │ smart_wallet│          │ status      │          │ wallet_address  │  │      │
│  │ nonce       │          │ chains      │          │ tokens          │  │      │
│  │ settings    │          │ tokens      │          │ destination     │  │      │
│  │ created_at  │          │ quote       │          │ expires_at      │  │      │
│  │ last_active │          │ tx_hashes   │          └─────────────────┘  │      │
│  └──────┬──────┘          │ output_*    │                               │      │
│         │                 │ defi_*      │                               │      │
│         │                 │ created_at  │                               │      │
│         │                 └──────┬──────┘                               │      │
│         │                        │                                      │      │
│         │                        ▼                                      │      │
│         │                 ┌─────────────┐                               │      │
│         │                 │ dust_tokens │                               │      │
│         │                 ├─────────────┤                               │      │
│         └────────────────►│ user_id (FK)│◄──────────────────────────────┘      │
│                           │ sweep_id(FK)│                                       │
│                           │ chain       │                                       │
│                           │ token_addr  │                                       │
│                           │ balance     │                                       │
│                           │ value_usd   │                                       │
│                           └─────────────┘                                       │
│                                                                                  │
│  ┌─────────────────┐      ┌─────────────────────┐      ┌─────────────┐         │
│  │  subscriptions  │      │ subscription_sweeps │      │   tokens    │         │
│  ├─────────────────┤      ├─────────────────────┤      ├─────────────┤         │
│  │ id (PK)         │◄────┤│ subscription_id (FK)│      │ id (PK)     │         │
│  │ user_id (FK)────┼──┐   │ sweep_id (FK)       │      │ address     │         │
│  │ wallet_address  │  │   │ triggered_by        │      │ chain       │         │
│  │ source_chains   │  │   │ dust_value_usd      │      │ symbol      │         │
│  │ destination_*   │  │   │ status              │      │ whitelisted │         │
│  │ trigger_type    │  │   │ created_at          │      │ blacklisted │         │
│  │ spend_perm_*    │  │   └─────────────────────┘      └─────────────┘         │
│  │ status          │  │                                                         │
│  └─────────────────┘  └───────────────────┐                                    │
│                                           │                                     │
│  ┌─────────────┐      ┌──────────────┐    │     ┌─────────────────────┐        │
│  │ price_cache │      │ api_payments │    │     │ api_credit_trans    │        │
│  ├─────────────┤      ├──────────────┤    │     ├─────────────────────┤        │
│  │ id (PK)     │      │ id (PK)      │    │     │ id (PK)             │        │
│  │ token_addr  │      │ receipt_id   │    │     │ wallet_address      │        │
│  │ chain       │      │ payer_addr   │    │     │ type                │        │
│  │ price_usd   │      │ amount_usdc  │    │     │ amount_cents        │        │
│  │ confidence  │      │ endpoint     │    │     │ balance_after       │        │
│  │ sources     │      │ status       │    │     │ created_at          │        │
│  │ updated_at  │      │ created_at   │    │     └─────────────────────┘        │
│  └─────────────┘      └──────────────┘    │                                    │
│                                           │     ┌─────────────┐                │
│  ┌─────────────┐      ┌──────────────┐    │     │ api_credits │                │
│  │  api_usage  │      │              │    │     ├─────────────┤                │
│  ├─────────────┤      │    users     │◄───┘     │ id (PK)     │                │
│  │ id (PK)     │      │              │          │ wallet_addr │                │
│  │ user_id     │      │              │          │ balance     │                │
│  │ endpoint    │      └──────────────┘          │ expires_at  │                │
│  │ price_cents │                                └─────────────┘                │
│  │ created_at  │                                                               │
│  └─────────────┘                                                               │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Tables Reference

### users

Stores wallet authentication and user preferences.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | No | Primary key |
| `wallet_address` | VARCHAR(66) | No | Ethereum address (unique) |
| `smart_wallet_address` | VARCHAR(66) | Yes | ERC-4337 smart wallet |
| `nonce` | VARCHAR(64) | Yes | SIWE authentication nonce |
| `created_at` | TIMESTAMPTZ | No | Account creation time |
| `last_active` | TIMESTAMPTZ | Yes | Last activity time |
| `settings` | JSONB | No | User preferences |

**Indexes:**
- `idx_users_wallet` on `wallet_address`
- `idx_users_smart_wallet` on `smart_wallet_address`

---

### tokens

Token whitelist/blacklist registry for security.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | No | Primary key |
| `address` | VARCHAR(66) | No | Token contract address |
| `chain` | VARCHAR(20) | No | Chain identifier |
| `symbol` | VARCHAR(30) | Yes | Token symbol |
| `token_name` | VARCHAR(100) | Yes | Full token name |
| `decimals` | NUMERIC | Yes | Token decimals |
| `is_whitelisted` | BOOLEAN | No | Approved for sweeping |
| `is_blacklisted` | BOOLEAN | No | Blocked (scam/honeypot) |
| `list_reason` | TEXT | Yes | Reason for listing |
| `logo_uri` | VARCHAR(500) | Yes | Token logo URL |
| `coingecko_id` | VARCHAR(100) | Yes | CoinGecko identifier |
| `created_at` | TIMESTAMPTZ | No | Record creation |
| `updated_at` | TIMESTAMPTZ | No | Last update |

**Indexes:**
- `idx_tokens_address_chain` UNIQUE on `(address, chain)`
- `idx_tokens_whitelist` on `is_whitelisted`
- `idx_tokens_blacklist` on `is_blacklisted`

---

### sweeps

Main transaction records for dust sweep operations.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | No | Primary key |
| `user_id` | UUID | Yes | Foreign key to users |
| `status` | VARCHAR(30) | No | pending, quoting, signing, submitted, confirmed, failed, cancelled |
| `chains` | JSONB | No | Array of source chains |
| `tokens` | JSONB | No | Array of token details |
| `quote` | JSONB | Yes | Quote snapshot |
| `tx_hashes` | JSONB | No | Transaction hashes by chain |
| `user_op_hashes` | JSONB | No | UserOperation hashes |
| `output_token` | VARCHAR(66) | Yes | Destination token address |
| `output_amount` | NUMERIC(78,0) | Yes | Output amount (wei) |
| `output_chain` | VARCHAR(20) | Yes | Destination chain |
| `gas_token` | VARCHAR(66) | Yes | Token used for gas |
| `gas_paid` | NUMERIC(78,0) | Yes | Gas amount paid |
| `total_input_value_usd` | DECIMAL(20,8) | Yes | Total input USD value |
| `total_output_value_usd` | DECIMAL(20,8) | Yes | Total output USD value |
| `fee_paid` | DECIMAL(20,8) | Yes | Protocol fee |
| `defi_destination` | VARCHAR(66) | Yes | DeFi vault address |
| `defi_protocol` | VARCHAR(50) | Yes | Protocol name (Aave, Yearn) |
| `error_message` | TEXT | Yes | Error details if failed |
| `created_at` | TIMESTAMPTZ | No | Sweep initiated |
| `updated_at` | TIMESTAMPTZ | No | Last status update |
| `completed_at` | TIMESTAMPTZ | Yes | Completion time |

**Indexes:**
- `idx_sweeps_user` on `user_id`
- `idx_sweeps_status` on `status`
- `idx_sweeps_created` on `created_at`

---

### sweep_quotes

Temporary storage for active quotes.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | No | Primary key (quote ID) |
| `user_id` | UUID | Yes | Foreign key to users |
| `wallet_address` | VARCHAR(66) | No | Wallet address |
| `chains` | JSONB | No | Source chains |
| `tokens` | JSONB | No | Tokens to sweep |
| `destination` | JSONB | Yes | Destination config |
| `output_token` | VARCHAR(66) | Yes | Output token |
| `output_amount` | NUMERIC(78,0) | Yes | Expected output |
| `estimated_gas_usd` | DECIMAL(20,8) | Yes | Gas estimate |
| `net_value_usd` | DECIMAL(20,8) | Yes | Net value after fees |
| `aggregator` | VARCHAR(50) | Yes | DEX aggregator used |
| `route_data` | JSONB | Yes | Route details |
| `expires_at` | TIMESTAMPTZ | No | Quote expiration |
| `created_at` | TIMESTAMPTZ | No | Quote creation |

**Indexes:**
- `idx_quotes_user` on `user_id`
- `idx_quotes_wallet` on `wallet_address`
- `idx_quotes_expires` on `expires_at`

---

### dust_tokens

Scanned wallet token balances.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | No | Primary key |
| `user_id` | UUID | Yes | Foreign key to users |
| `wallet_address` | VARCHAR(66) | No | Wallet address |
| `chain` | VARCHAR(20) | No | Chain identifier |
| `token_address` | VARCHAR(66) | No | Token contract |
| `symbol` | VARCHAR(30) | Yes | Token symbol |
| `token_name` | VARCHAR(100) | Yes | Token name |
| `decimals` | NUMERIC | Yes | Token decimals |
| `balance` | NUMERIC(78,0) | No | Raw balance (wei) |
| `value_usd` | DECIMAL(20,8) | Yes | USD value |
| `price_usd` | DECIMAL(30,18) | Yes | Token price |
| `scanned_at` | TIMESTAMPTZ | No | Last scan time |
| `swept` | BOOLEAN | No | Already swept |
| `sweep_id` | UUID | Yes | Related sweep |

**Indexes:**
- `idx_dust_unique` UNIQUE on `(user_id, chain, token_address)`
- `idx_dust_user` on `user_id`
- `idx_dust_wallet` on `wallet_address`

---

### price_cache

Cached token prices from multiple sources.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | No | Primary key |
| `token_address` | VARCHAR(66) | No | Token contract |
| `chain` | VARCHAR(20) | No | Chain identifier |
| `price_usd` | DECIMAL(30,18) | Yes | Current price |
| `confidence` | VARCHAR(20) | Yes | HIGH, MEDIUM, LOW, UNTRUSTED |
| `sources` | JSONB | Yes | Price source details |
| `liquidity_usd` | DECIMAL(20,8) | Yes | Available liquidity |
| `volume_24h` | DECIMAL(20,8) | Yes | 24h trading volume |
| `updated_at` | TIMESTAMPTZ | No | Last update |

**Indexes:**
- `idx_price_token_chain` UNIQUE on `(token_address, chain)`
- `idx_price_updated` on `updated_at`

---

### subscriptions

Auto-sweep subscription configurations.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | No | Primary key |
| `user_id` | UUID | No | Foreign key to users |
| `wallet_address` | VARCHAR(66) | No | Source wallet |
| `smart_wallet_address` | VARCHAR(66) | Yes | Smart wallet |
| `source_chains` | JSONB | No | Chains to monitor |
| `destination_chain` | NUMERIC | No | Target chain ID |
| `destination_asset` | VARCHAR(30) | No | Target asset |
| `destination_protocol` | VARCHAR(50) | Yes | DeFi protocol |
| `destination_vault` | VARCHAR(66) | Yes | Vault address |
| `trigger_type` | VARCHAR(20) | No | threshold or schedule |
| `threshold_usd` | DECIMAL(20,8) | Yes | USD threshold |
| `schedule_pattern` | VARCHAR(50) | Yes | Cron pattern |
| `min_sweep_value_usd` | DECIMAL(20,8) | No | Minimum sweep value |
| `max_sweep_cost_percent` | DECIMAL(5,2) | No | Max cost as % |
| `spend_permission_signature` | TEXT | No | Coinbase signature |
| `spend_permission_hash` | VARCHAR(66) | Yes | Permission hash |
| `spend_permission_expiry` | TIMESTAMPTZ | No | Permission expiry |
| `spend_permission_max_amount` | NUMERIC(78,0) | Yes | Max spend |
| `spend_permission_data` | JSONB | Yes | Full permission data |
| `status` | VARCHAR(20) | No | active, paused, cancelled, expired |
| `created_at` | TIMESTAMPTZ | No | Creation time |
| `updated_at` | TIMESTAMPTZ | No | Last update |
| `last_sweep_at` | TIMESTAMPTZ | Yes | Last sweep time |
| `next_scheduled_at` | TIMESTAMPTZ | Yes | Next scheduled sweep |
| `total_sweeps` | NUMERIC | No | Total sweep count |
| `total_value_swept` | DECIMAL(20,8) | No | Total USD swept |

**Indexes:**
- `idx_subscriptions_user` on `user_id`
- `idx_subscriptions_wallet` on `wallet_address`
- `idx_subscriptions_status` on `status`
- `idx_subscriptions_trigger_type` on `trigger_type`
- `idx_subscriptions_next_scheduled` on `next_scheduled_at`
- `idx_subscriptions_expiry` on `spend_permission_expiry`

---

### subscription_sweeps

History of auto-sweep executions.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | No | Primary key |
| `subscription_id` | UUID | No | Foreign key to subscriptions |
| `sweep_id` | UUID | Yes | Related sweep record |
| `triggered_by` | VARCHAR(20) | Yes | threshold, schedule, manual |
| `dust_value_usd` | DECIMAL(20,8) | Yes | Dust value |
| `sweep_cost_usd` | DECIMAL(20,8) | Yes | Execution cost |
| `net_value_usd` | DECIMAL(20,8) | Yes | Net value |
| `tokens_swept` | NUMERIC | Yes | Token count |
| `chains` | JSONB | No | Chains swept |
| `status` | VARCHAR(20) | No | pending, executing, completed, failed |
| `error_message` | TEXT | Yes | Error if failed |
| `created_at` | TIMESTAMPTZ | No | Start time |
| `completed_at` | TIMESTAMPTZ | Yes | Completion time |

**Indexes:**
- `idx_subscription_sweeps_subscription` on `subscription_id`
- `idx_subscription_sweeps_sweep` on `sweep_id`
- `idx_subscription_sweeps_status` on `status`
- `idx_subscription_sweeps_created` on `created_at`

---

### api_payments

x402 protocol payment records.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | No | Primary key |
| `receipt_id` | VARCHAR(100) | No | Unique receipt (indexed) |
| `payer_address` | VARCHAR(66) | No | Payer wallet |
| `payee_address` | VARCHAR(66) | No | Payee (our wallet) |
| `amount_usdc` | VARCHAR(78) | No | Payment amount |
| `network` | VARCHAR(50) | No | Payment network |
| `tx_hash` | VARCHAR(66) | Yes | Transaction hash |
| `endpoint` | VARCHAR(200) | No | API endpoint called |
| `method` | VARCHAR(10) | No | HTTP method |
| `payment_type` | VARCHAR(20) | No | x402, credits, free_tier |
| `status` | VARCHAR(20) | No | pending, completed, failed, refunded |
| `created_at` | TIMESTAMPTZ | No | Payment time |
| `updated_at` | TIMESTAMPTZ | No | Last update |

---

### api_credits

Prepaid API credit balances.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | No | Primary key |
| `wallet_address` | VARCHAR(66) | No | Wallet (unique) |
| `balance_cents` | VARCHAR(20) | No | Balance in cents |
| `expires_at` | TIMESTAMPTZ | Yes | Expiration date |
| `created_at` | TIMESTAMPTZ | No | Creation time |
| `updated_at` | TIMESTAMPTZ | No | Last update |

---

### api_credit_transactions

Credit transaction history.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | No | Primary key |
| `wallet_address` | VARCHAR(66) | No | Wallet address |
| `type` | VARCHAR(20) | No | deposit, deduction, refund, expiry, adjustment |
| `amount_cents` | VARCHAR(20) | No | Transaction amount |
| `balance_after` | VARCHAR(20) | No | Balance after transaction |
| `endpoint` | VARCHAR(200) | Yes | Related endpoint |
| `tx_hash` | VARCHAR(66) | Yes | Related tx hash |
| `description` | TEXT | Yes | Description |
| `created_at` | TIMESTAMPTZ | No | Transaction time |

---

### api_usage

API request logs for analytics.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | No | Primary key |
| `user_identifier` | VARCHAR(100) | No | User/wallet ID |
| `endpoint` | VARCHAR(200) | No | API endpoint |
| `method` | VARCHAR(10) | No | HTTP method |
| `price_cents` | NUMERIC | No | Request cost |
| `payment_type` | VARCHAR(20) | No | x402, credits, free_tier |
| `response_status` | NUMERIC | Yes | HTTP status code |
| `response_time_ms` | NUMERIC | Yes | Response time |
| `created_at` | TIMESTAMPTZ | No | Request time |

---

## Migrations

### Running Migrations

```bash
# Generate migration from schema changes
npm run db:generate

# Apply pending migrations
npm run db:migrate

# Push schema directly (development only)
npm run db:push
```

### Migration Files

Located in `drizzle/migrations/`:

```
drizzle/migrations/
├── 0000_initial.sql
├── 0001_add_subscriptions.sql
├── 0002_add_api_payments.sql
└── meta/
    ├── _journal.json
    └── 0000_snapshot.json
```

### Creating a Migration

1. Modify `src/db/schema.ts`
2. Run `npm run db:generate`
3. Review generated SQL in `drizzle/migrations/`
4. Run `npm run db:migrate`

---

## Common Queries

### Get User's Dust Tokens

```sql
SELECT 
  dt.chain,
  dt.token_address,
  dt.symbol,
  dt.balance,
  dt.value_usd
FROM dust_tokens dt
JOIN users u ON dt.user_id = u.id
WHERE u.wallet_address = '0x...'
  AND dt.swept = false
ORDER BY dt.value_usd DESC;
```

### Get Sweep History

```sql
SELECT 
  s.id,
  s.status,
  s.total_input_value_usd,
  s.total_output_value_usd,
  s.created_at,
  s.completed_at
FROM sweeps s
JOIN users u ON s.user_id = u.id
WHERE u.wallet_address = '0x...'
ORDER BY s.created_at DESC
LIMIT 20;
```

### Active Subscriptions

```sql
SELECT 
  sub.id,
  sub.trigger_type,
  sub.threshold_usd,
  sub.destination_chain,
  sub.destination_asset,
  sub.status,
  sub.last_sweep_at,
  sub.total_sweeps,
  sub.total_value_swept
FROM subscriptions sub
WHERE sub.status = 'active'
  AND sub.spend_permission_expiry > NOW();
```

### Price Cache Status

```sql
SELECT 
  chain,
  COUNT(*) as token_count,
  COUNT(*) FILTER (WHERE updated_at > NOW() - INTERVAL '5 minutes') as fresh_count,
  AVG(EXTRACT(EPOCH FROM (NOW() - updated_at))) as avg_age_seconds
FROM price_cache
GROUP BY chain;
```

---

## Related Documentation

- [DEVELOPMENT.md](./DEVELOPMENT.md) - Local development setup
- [API.md](./API.md) - API documentation
- [SECURITY.md](./SECURITY.md) - Security practices
