# Database

> PostgreSQL schema (Drizzle ORM) and BigQuery data warehouse tables for Crypto Vision.

## Overview

Crypto Vision uses two database systems:

| System | Purpose | Required |
|---|---|---|
| **PostgreSQL 16** | Telegram bot data (users, groups, calls, subscriptions) | Required for bot features |
| **BigQuery** | Time-series data warehouse (market snapshots, DeFi, news) | Required for data pipeline |

Both are optional for the core API — the API works without either by fetching directly from upstream sources.

---

## PostgreSQL Schema

### Connection

```
DATABASE_URL=postgresql://cryptovision:cryptovision@localhost:5432/cryptovision
```

Schema is managed via **Drizzle ORM** (`drizzle.config.ts`). Migrations live in `src/bot/db/migrations/`.

### Enums

| Enum | Values | Used In |
|---|---|---|
| `call_type` | `alpha`, `gamble` | calls |
| `call_mode` | `auto`, `button` | groups |
| `display_mode` | `simple`, `advanced` | groups |
| `rank_tier` | `amateur`, `rookie`, `trader`, `expert`, `whale`, `oracle` | users |
| `channel_permission` | `owner`, `owner_admins`, `everyone` | call_channels |
| `ad_type` | `button_24h`, `button_72h`, `button_1w`, `broadcast` | advertisements |
| `ad_status` | `pending`, `active`, `expired`, `cancelled` | advertisements |
| `chain` | `ethereum`, `solana`, `base`, `bsc`, `arbitrum`, `polygon`, `avalanche`, `optimism` | calls |
| `referral_status` | `pending`, `approved`, `rejected` | referrals |
| `subscription_status` | `active`, `expired`, `cancelled` | premium_subscriptions |
| `language` | `en`, `zh`, `de`, `ru`, `vi`, `pl`, `pt`, `ar` | users, groups |

### Tables

#### `users`

User profiles for the Telegram bot.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK, auto-generated |
| `telegram_id` | varchar(50) | Unique, not null |
| `username` | varchar(100) | Nullable |
| `wallet_addresses` | jsonb | `[]` default |
| `total_calls` | integer | Default 0 |
| `total_wins` | integer | Default 0 |
| `performance_points` | numeric(12,2) | Default 0 |
| `rank_tier` | rank_tier enum | Default `amateur` |
| `language` | language enum | Default `en` |
| `is_premium` | boolean | Default `false` |
| `created_at` | timestamp | Auto |
| `updated_at` | timestamp | Auto |

**Indexes:** `telegram_id` (unique), `username`, `rank_tier`

#### `groups`

Telegram group configurations.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `telegram_id` | varchar(50) | Unique, not null |
| `title` | varchar(200) | |
| `owner_id` | uuid | FK → users.id |
| `call_mode` | call_mode enum | Default `auto` |
| `display_mode` | display_mode enum | Default `simple` |
| `language` | language enum | Default `en` |
| `hardcore_enabled` | boolean | Default `false` |
| `hardcore_min_multiplier` | numeric | |
| `hardcore_round_hours` | integer | |
| `premium_*` | various | Premium feature flags |
| `ad_message` | text | Nullable |
| `ad_link` | varchar(500) | Nullable |
| `created_at` | timestamp | Auto |

**Indexes:** `telegram_id` (unique), `owner_id`

#### `group_members`

Group membership with per-group stats.

| Column | Type | Notes |
|---|---|---|
| `group_id` | uuid | PK (composite), FK → groups.id |
| `user_id` | uuid | PK (composite), FK → users.id |
| `is_admin` | boolean | Default `false` |
| `is_owner` | boolean | Default `false` |
| `call_count` | integer | Default 0 |
| `win_count` | integer | Default 0 |
| `performance_points` | numeric(12,2) | Default 0 |
| `joined_at` | timestamp | Auto |

**Indexes:** `user_id`

#### `calls`

Token call records (the core trading signal data).

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `user_id` | uuid | FK → users.id |
| `group_id` | uuid | FK → groups.id |
| `token_address` | varchar(100) | Not null |
| `chain` | chain enum | Default `solana` |
| `call_type` | call_type enum | Default `alpha` |
| `market_cap_at_call` | numeric(20,2) | |
| `price_at_call` | numeric(20,10) | |
| `liquidity` | numeric(20,2) | |
| `volume_24h` | numeric(20,2) | |
| `holders` | integer | |
| `ath_multiplier` | numeric(10,2) | |
| `current_multiplier` | numeric(10,2) | |
| `peak_multiplier` | numeric(10,2) | |
| `performance_points` | numeric(12,2) | Default 0 |
| `is_win` | boolean | |
| `is_archived` | boolean | Default `false` |
| `called_at` | timestamp | Not null |
| `updated_at` | timestamp | Auto |

**Indexes:** `user_id`, `group_id`, `token_address`, `called_at`, `chain`, `call_type`, `is_archived`, `peak_multiplier`

#### `call_channels`

Channels where call signals are forwarded.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `group_id` | uuid | FK → groups.id |
| `channel_telegram_id` | varchar(50) | |
| `permission` | channel_permission enum | Default `owner` |
| `is_verified` | boolean | Default `false` |

**Indexes:** Unique on `(group_id, channel_telegram_id)`

#### `referrals`

Referral program records.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `user_id` | uuid | FK → users.id |
| `referral_code` | varchar(20) | Unique |
| `wallet_address` | varchar(100) | |
| `status` | referral_status enum | Default `pending` |
| `total_earnings` | numeric(20,2) | Default 0 |
| `created_at` | timestamp | Auto |

**Indexes:** `referral_code` (unique), `user_id` (unique)

#### `referral_purchases`

Purchases made through referral links.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `referral_id` | uuid | FK → referrals.id |
| `buyer_telegram_id` | varchar(50) | |
| `purchase_amount` | numeric(20,2) | |
| `commission_amount` | numeric(20,2) | |
| `tx_hash` | varchar(100) | |
| `created_at` | timestamp | Auto |

**Indexes:** `referral_id`

#### `advertisements`

Group advertisement system.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `advertiser_telegram_id` | varchar(50) | |
| `group_id` | uuid | FK → groups.id |
| `ad_type` | ad_type enum | |
| `status` | ad_status enum | Default `pending` |
| `message` | text | |
| `button_text` | varchar(100) | |
| `button_url` | varchar(500) | |
| `impressions` | integer | Default 0 |
| `clicks` | integer | Default 0 |
| `amount_paid` | numeric(20,2) | |
| `starts_at` | timestamp | |
| `expires_at` | timestamp | |
| `created_at` | timestamp | Auto |

**Indexes:** `status`, `expires_at`

#### `premium_subscriptions`

Group premium subscription tracking.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `group_id` | uuid | FK → groups.id |
| `purchased_by_user_id` | uuid | FK → users.id |
| `status` | subscription_status enum | Default `active` |
| `amount_paid` | numeric(20,2) | |
| `is_lifetime` | boolean | Default `false` |
| `starts_at` | timestamp | |
| `expires_at` | timestamp | |
| `created_at` | timestamp | Auto |

**Indexes:** `group_id`, `status`

#### `insider_alert_subscriptions`

Users subscribed to insider alerts with filters.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `user_id` | uuid | FK → users.id |
| `status` | subscription_status enum | Default `active` |
| `filter_min_win_rate` | numeric | |
| `filter_avg_gain` | numeric | |
| `filter_chains` | jsonb | Chain filter array |
| `filter_market_cap` | jsonb | `{ min, max }` |
| `filter_callers` | jsonb | Specific caller IDs |
| `created_at` | timestamp | Auto |

**Indexes:** `user_id` (unique), `status`

#### `insider_alerts`

Generated alerts for high-confidence calls.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `call_id` | uuid | FK → calls.id |
| `caller_wilson_score` | numeric(8,4) | |
| `caller_stats` | jsonb | Win rate, total calls, etc. |
| `notified_count` | integer | Default 0 |
| `created_at` | timestamp | Auto |

**Indexes:** `call_id`, `created_at`

#### `hardcore_sessions`

Competitive "hardcore mode" sessions.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `group_id` | uuid | FK → groups.id |
| `round_number` | integer | |
| `started_at` | timestamp | |
| `ends_at` | timestamp | |
| `is_active` | boolean | Default `true` |
| `removed_users` | jsonb | Array of eliminated users |
| `created_at` | timestamp | Auto |

**Indexes:** `group_id`, `is_active`

#### `token_votes`

User votes on tokens.

| Column | Type | Notes |
|---|---|---|
| `id` | serial | PK |
| `user_id` | uuid | FK → users.id |
| `token_address` | varchar(100) | |
| `chain` | chain enum | Default `solana` |
| `created_at` | timestamp | Auto |

**Indexes:** `token_address`, `created_at`, unique on `(user_id, token_address)`

---

## BigQuery Data Warehouse

### Dataset

```
Project:  ${GCP_PROJECT_ID}
Dataset:  crypto_vision (configurable via BQ_DATASET)
Location: US
```

### Tables (18)

| Table | Description | Ingestion |
|---|---|---|
| `market_snapshots` | Coin prices, market caps, volumes (top 250) | Every 2 min |
| `ohlc_candles` | OHLC candles for top coins | Daily |
| `defi_protocols` | DeFi protocol TVL and metadata | Every 5 min |
| `yield_pools` | Yield pool APY, TVL, composition | Every 5 min |
| `news_articles` | Aggregated crypto news with metadata | Every 5 min |
| `fear_greed` | Fear & Greed Index values | Every 15 min |
| `dex_pairs` | DEX pair data (price, volume, liquidity) | Every 2 min |
| `chain_tvl` | Per-chain TVL time series | Every 10 min |
| `exchange_snapshots` | Exchange volume and trust scores | Hourly |
| `bitcoin_network` | Hashrate, difficulty, block data | Daily |
| `gas_prices` | Multi-chain gas prices | Every 2 min |
| `stablecoin_supply` | Stablecoin circulating supply | Every 10 min |
| `funding_rounds` | Crypto project funding events | Hourly |
| `derivatives_snapshots` | Futures/perps OI, funding, liquidations | Every 10 min |
| `governance_proposals` | DAO governance proposals + votes | Every 30 min |
| `whale_movements` | Large on-chain transfers | Every 5 min |
| `agent_interactions` | AI agent conversation logs | Real-time |
| `anomaly_events` | Detected market anomalies | Real-time |

### Materialized Views (10)

Pre-aggregated daily summaries for fast analytics:

| View | Source Table | Aggregation |
|---|---|---|
| `daily_market_summary` | market_snapshots | Avg price, volume, market cap per coin per day |
| `daily_defi_tvl` | defi_protocols | Total TVL per protocol per day |
| `daily_yield_summary` | yield_pools | Avg APY, TVL by pool per day |
| `daily_derivatives_summary` | derivatives_snapshots | Aggregate OI, funding per day |
| `daily_fear_greed` | fear_greed | Daily avg fear/greed value |
| `daily_chain_tvl` | chain_tvl | TVL per chain per day |
| `daily_gas_summary` | gas_prices | Avg/min/max gas per chain per day |
| `daily_stablecoin_supply` | stablecoin_supply | Total supply per stablecoin per day |
| `daily_dex_volume` | dex_pairs | Aggregate DEX volume per day |
| `daily_bitcoin_network` | bitcoin_network | Daily network stats |

### Query Examples

```sql
-- Top 10 coins by 24h volume change
SELECT coin_id, name, price_usd, volume_24h_usd,
       LAG(volume_24h_usd) OVER (PARTITION BY coin_id ORDER BY snapshot_at) as prev_volume
FROM `project.crypto_vision.market_snapshots`
WHERE snapshot_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 24 HOUR)
QUALIFY ROW_NUMBER() OVER (PARTITION BY coin_id ORDER BY snapshot_at DESC) = 1
ORDER BY volume_24h_usd DESC
LIMIT 10;

-- DeFi TVL growth by chain (last 30 days)
SELECT chain, MIN(tvl) as tvl_start, MAX(tvl) as tvl_end,
       SAFE_DIVIDE(MAX(tvl) - MIN(tvl), MIN(tvl)) * 100 as growth_pct
FROM `project.crypto_vision.daily_chain_tvl`
WHERE date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
GROUP BY chain
ORDER BY growth_pct DESC;

-- Fear & Greed trend
SELECT date, avg_value,
       CASE
         WHEN avg_value >= 75 THEN 'Extreme Greed'
         WHEN avg_value >= 55 THEN 'Greed'
         WHEN avg_value >= 45 THEN 'Neutral'
         WHEN avg_value >= 25 THEN 'Fear'
         ELSE 'Extreme Fear'
       END as classification
FROM `project.crypto_vision.daily_fear_greed`
ORDER BY date DESC
LIMIT 30;
```

---

## Migrations

### PostgreSQL

Drizzle Kit manages PostgreSQL migrations:

```bash
# Generate migration from schema changes
npx drizzle-kit generate

# Apply pending migrations
npx drizzle-kit migrate

# Push schema directly (dev only)
npx drizzle-kit push

# Open Drizzle Studio
npx drizzle-kit studio
```

Configuration in `drizzle.config.ts`:
```typescript
{
  schema: './src/bot/db/schema.ts',
  out: './src/bot/db/migrations',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL }
}
```

### BigQuery

BigQuery tables are created declaratively via Terraform (`infra/terraform/bigquery.tf`) or the setup script (`infra/setup.sh`). No migration system — schema changes are additive (new columns, new tables).

---

## Data Export & Import

Export BigQuery data to Parquet for portability:

```bash
# Full export to GCS
npm run export

# Dry run (no writes)
npm run export:dry-run

# Download exports locally
npm run export:download

# Import Parquet to PostgreSQL
npm run export:import-pg
```

Export format: Parquet with Snappy compression. Total size: 100–500 GB depending on data retention.

See [Self-Hosting](SELF_HOSTING.md) for BigQuery replacement options (PostgreSQL, DuckDB, ClickHouse).
