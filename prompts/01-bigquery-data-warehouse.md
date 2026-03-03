# Prompt 01: BigQuery Data Warehouse

## Agent Identity & Rules

```
You are building the Crypto Vision data warehouse on Google BigQuery.
- Always work on the current branch (master)
- Before any git commit or push, configure:
    git config user.name "nirholas"
    git config user.email "nirholas@users.noreply.github.com"
- Always use background terminals (isBackground: true)
- Always kill terminals after commands complete
- We have unlimited Claude credits — build the best possible version
- Every dollar spent must produce a permanent artifact (exported dataset, code, schema)
```

## Objective

Build a production-grade BigQuery data warehouse that continuously ingests data from all 26 sources in `src/sources/`, creating a TB-scale historical crypto dataset that can be exported and kept forever.

## Budget: $15-20k

BigQuery pricing:
- Storage: $0.02/GB/month (first 10GB free)
- Streaming inserts: $0.01/200MB
- Queries: $6.25/TB scanned (first 1TB/month free)
- BigQuery ML: $250/TB for model training

**Strategy:** Load aggressively (storage is nearly free), query carefully (use partitions + clustering).

## Deliverables

### 1. BigQuery Schema (`infra/bigquery/`)

Create the following tables, all partitioned by `ingested_at` DATE and clustered by the most-queried columns:

```sql
-- Dataset: crypto_vision

-- 1. Market snapshots (from CoinGecko /coins/markets)
CREATE TABLE crypto_vision.market_snapshots (
  snapshot_id STRING NOT NULL,
  coin_id STRING NOT NULL,
  symbol STRING NOT NULL,
  name STRING NOT NULL,
  current_price_usd FLOAT64,
  market_cap FLOAT64,
  market_cap_rank INT64,
  total_volume FLOAT64,
  price_change_pct_1h FLOAT64,
  price_change_pct_24h FLOAT64,
  price_change_pct_7d FLOAT64,
  price_change_pct_30d FLOAT64,
  circulating_supply FLOAT64,
  total_supply FLOAT64,
  max_supply FLOAT64,
  ath FLOAT64,
  ath_change_pct FLOAT64,
  ingested_at TIMESTAMP NOT NULL,
  source STRING DEFAULT 'coingecko'
)
PARTITION BY DATE(ingested_at)
CLUSTER BY coin_id, symbol;

-- 2. OHLC candles (from CoinGecko /coins/{id}/ohlc)
CREATE TABLE crypto_vision.ohlc_candles (
  coin_id STRING NOT NULL,
  timestamp_ms INT64 NOT NULL,
  open FLOAT64,
  high FLOAT64,
  low FLOAT64,
  close FLOAT64,
  volume FLOAT64,
  ingested_at TIMESTAMP NOT NULL,
  source STRING DEFAULT 'coingecko'
)
PARTITION BY DATE(ingested_at)
CLUSTER BY coin_id, timestamp_ms;

-- 3. DeFi protocol snapshots (from DeFiLlama)
CREATE TABLE crypto_vision.defi_protocols (
  protocol_slug STRING NOT NULL,
  name STRING NOT NULL,
  category STRING,
  chain STRING,
  tvl_usd FLOAT64,
  change_1h FLOAT64,
  change_1d FLOAT64,
  change_7d FLOAT64,
  mcap_tvl_ratio FLOAT64,
  fees_24h FLOAT64,
  revenue_24h FLOAT64,
  ingested_at TIMESTAMP NOT NULL,
  source STRING DEFAULT 'defillama'
)
PARTITION BY DATE(ingested_at)
CLUSTER BY protocol_slug, chain;

-- 4. Yield pools (from DeFiLlama /pools)
CREATE TABLE crypto_vision.yield_pools (
  pool_id STRING NOT NULL,
  chain STRING,
  project STRING,
  symbol STRING,
  tvl_usd FLOAT64,
  apy FLOAT64,
  apy_base FLOAT64,
  apy_reward FLOAT64,
  il_risk STRING,
  stablecoin BOOL,
  ingested_at TIMESTAMP NOT NULL
)
PARTITION BY DATE(ingested_at)
CLUSTER BY chain, project;

-- 5. News articles (from RSS feeds + enrichment)
CREATE TABLE crypto_vision.news_articles (
  article_id STRING NOT NULL,
  title STRING,
  description STRING,
  url STRING,
  source_name STRING,
  category STRING,
  published_at TIMESTAMP,
  sentiment_score FLOAT64,
  sentiment_label STRING,
  entities ARRAY<STRING>,
  topics ARRAY<STRING>,
  embedding ARRAY<FLOAT64>,
  ingested_at TIMESTAMP NOT NULL
)
PARTITION BY DATE(ingested_at)
CLUSTER BY source_name, category;

-- 6. Fear & Greed Index (from Alternative.me)
CREATE TABLE crypto_vision.fear_greed (
  value INT64,
  classification STRING,
  timestamp_unix INT64,
  ingested_at TIMESTAMP NOT NULL
)
PARTITION BY DATE(ingested_at);

-- 7. DEX pairs (from DexScreener + GeckoTerminal)
CREATE TABLE crypto_vision.dex_pairs (
  pair_address STRING NOT NULL,
  chain_id STRING,
  dex_id STRING,
  base_token_address STRING,
  base_token_symbol STRING,
  quote_token_address STRING,
  quote_token_symbol STRING,
  price_usd FLOAT64,
  volume_24h FLOAT64,
  liquidity_usd FLOAT64,
  price_change_5m FLOAT64,
  price_change_1h FLOAT64,
  price_change_24h FLOAT64,
  fdv FLOAT64,
  ingested_at TIMESTAMP NOT NULL,
  source STRING
)
PARTITION BY DATE(ingested_at)
CLUSTER BY chain_id, base_token_symbol;

-- 8. Chain TVL (from DeFiLlama)
CREATE TABLE crypto_vision.chain_tvl (
  chain_name STRING NOT NULL,
  tvl_usd FLOAT64,
  protocols_count INT64,
  ingested_at TIMESTAMP NOT NULL
)
PARTITION BY DATE(ingested_at)
CLUSTER BY chain_name;

-- 9. Exchange data (from CoinGecko + Binance + Bybit + OKX)
CREATE TABLE crypto_vision.exchange_snapshots (
  exchange_id STRING NOT NULL,
  name STRING,
  trust_score INT64,
  trade_volume_24h_btc FLOAT64,
  trade_volume_24h_usd FLOAT64,
  open_interest_usd FLOAT64,
  ingested_at TIMESTAMP NOT NULL,
  source STRING
)
PARTITION BY DATE(ingested_at)
CLUSTER BY exchange_id;

-- 10. Bitcoin network stats (from mempool.space)
CREATE TABLE crypto_vision.bitcoin_network (
  hashrate FLOAT64,
  difficulty FLOAT64,
  block_height INT64,
  fee_fast_sat_vb FLOAT64,
  fee_medium_sat_vb FLOAT64,
  fee_slow_sat_vb FLOAT64,
  mempool_size INT64,
  ingested_at TIMESTAMP NOT NULL
)
PARTITION BY DATE(ingested_at);

-- 11. Gas prices (multi-chain)
CREATE TABLE crypto_vision.gas_prices (
  chain STRING NOT NULL,
  fast_gwei FLOAT64,
  standard_gwei FLOAT64,
  slow_gwei FLOAT64,
  base_fee_gwei FLOAT64,
  ingested_at TIMESTAMP NOT NULL
)
PARTITION BY DATE(ingested_at)
CLUSTER BY chain;

-- 12. Stablecoin supply (from DeFiLlama)
CREATE TABLE crypto_vision.stablecoin_supply (
  stablecoin_id STRING NOT NULL,
  name STRING,
  symbol STRING,
  peg_type STRING,
  circulating FLOAT64,
  chain_circulating JSON,
  price FLOAT64,
  ingested_at TIMESTAMP NOT NULL
)
PARTITION BY DATE(ingested_at)
CLUSTER BY symbol;

-- 13. Funding rounds (from DeFiLlama)
CREATE TABLE crypto_vision.funding_rounds (
  round_id STRING,
  name STRING,
  category STRING,
  amount FLOAT64,
  round_type STRING,
  lead_investors ARRAY<STRING>,
  date STRING,
  ingested_at TIMESTAMP NOT NULL
)
PARTITION BY DATE(ingested_at);

-- 14. Derivatives/perps (from CoinGlass, Hyperliquid, dYdX, Deribit)
CREATE TABLE crypto_vision.derivatives_snapshots (
  symbol STRING NOT NULL,
  exchange STRING,
  open_interest_usd FLOAT64,
  funding_rate FLOAT64,
  volume_24h FLOAT64,
  long_short_ratio FLOAT64,
  liquidations_24h FLOAT64,
  ingested_at TIMESTAMP NOT NULL,
  source STRING
)
PARTITION BY DATE(ingested_at)
CLUSTER BY symbol, exchange;

-- 15. Governance proposals (from Snapshot)
CREATE TABLE crypto_vision.governance_proposals (
  proposal_id STRING NOT NULL,
  space_id STRING,
  title STRING,
  body STRING,
  state STRING,
  author STRING,
  votes_for FLOAT64,
  votes_against FLOAT64,
  quorum FLOAT64,
  start_ts INT64,
  end_ts INT64,
  ingested_at TIMESTAMP NOT NULL
)
PARTITION BY DATE(ingested_at)
CLUSTER BY space_id;

-- 16. Whale/smart money movements
CREATE TABLE crypto_vision.whale_movements (
  tx_hash STRING NOT NULL,
  chain STRING,
  from_address STRING,
  to_address STRING,
  token_symbol STRING,
  amount FLOAT64,
  usd_value FLOAT64,
  block_number INT64,
  timestamp_unix INT64,
  movement_type STRING,  -- 'exchange_inflow', 'exchange_outflow', 'whale_transfer'
  ingested_at TIMESTAMP NOT NULL
)
PARTITION BY DATE(ingested_at)
CLUSTER BY chain, token_symbol;

-- 17. Agent interactions (for improving agents)
CREATE TABLE crypto_vision.agent_interactions (
  interaction_id STRING NOT NULL,
  agent_id STRING NOT NULL,
  query STRING,
  response STRING,
  model_used STRING,
  tokens_used INT64,
  latency_ms INT64,
  user_feedback STRING,
  ingested_at TIMESTAMP NOT NULL
)
PARTITION BY DATE(ingested_at)
CLUSTER BY agent_id;
```

### 2. Terraform Module (`infra/terraform/bigquery.tf`)

Create Terraform that provisions:
- The `crypto_vision` dataset in `us-central1`
- All 17 tables above with schema definitions
- Appropriate IAM bindings (Cloud Run SA gets `bigquery.dataEditor`, scheduled jobs get `bigquery.jobUser`)
- Scheduled queries for materialized aggregate views
- Data transfer configs for any applicable sources

### 3. Ingestion Module (`src/lib/bigquery.ts`)

Create a BigQuery client module that:
- Uses `@google-cloud/bigquery` npm package
- Provides `insertRows(table, rows)` with automatic batching (max 500 rows per insert)
- Handles streaming insert errors with exponential backoff
- Falls back gracefully (logs warning, doesn't crash API) when BigQuery is unavailable
- Tracks insert metrics (rows/sec, errors, latency)

```typescript
// src/lib/bigquery.ts
import { BigQuery } from "@google-cloud/bigquery";

const DATASET = "crypto_vision";
const MAX_BATCH = 500;

let bq: BigQuery | null = null;

function getClient(): BigQuery | null {
  if (!process.env.GCP_PROJECT_ID) return null;
  if (!bq) bq = new BigQuery({ projectId: process.env.GCP_PROJECT_ID });
  return bq;
}

export async function insertRows(table: string, rows: Record<string, unknown>[]): Promise<void> {
  const client = getClient();
  if (!client || rows.length === 0) return;

  const enriched = rows.map(r => ({ ...r, ingested_at: new Date().toISOString() }));

  for (let i = 0; i < enriched.length; i += MAX_BATCH) {
    const batch = enriched.slice(i, i + MAX_BATCH);
    try {
      await client.dataset(DATASET).table(table).insert(batch);
    } catch (err: any) {
      // Log but don't crash — BigQuery is supplementary
      console.warn(`[bigquery] Insert error for ${table}:`, err.message);
    }
  }
}

export async function query<T = any>(sql: string, params?: Record<string, any>): Promise<T[]> {
  const client = getClient();
  if (!client) return [];
  const [rows] = await client.query({ query: sql, params, location: "us-central1" });
  return rows as T[];
}
```

### 4. Integration with Existing Sources

Modify each source in `src/sources/` to also stream data to BigQuery after every fetch. The pattern:

```typescript
// In src/sources/coingecko.ts — after fetching coins
import { insertRows } from "../lib/bigquery.js";

export async function getCoins(params = {}): Promise<CoinMarket[]> {
  const data = await cg<CoinMarket[]>(`/coins/markets?${p}`, 60);
  
  // Stream to BigQuery (fire-and-forget, non-blocking)
  insertRows("market_snapshots", data.map(c => ({
    snapshot_id: `${c.id}-${Date.now()}`,
    coin_id: c.id,
    symbol: c.symbol,
    name: c.name,
    current_price_usd: c.current_price,
    market_cap: c.market_cap,
    market_cap_rank: c.market_cap_rank,
    total_volume: c.total_volume,
    price_change_pct_24h: c.price_change_percentage_24h,
    circulating_supply: c.circulating_supply,
    total_supply: c.total_supply,
    max_supply: c.max_supply,
    ath: c.ath,
    ath_change_pct: c.ath_change_percentage,
  }))).catch(() => {}); // Never let BQ failures affect the API

  return data;
}
```

### 5. Materialized Views for Analytics

Create scheduled queries that run daily to produce aggregate tables:

```sql
-- Daily market summary (runs at 00:05 UTC)
CREATE OR REPLACE TABLE crypto_vision.daily_market_summary AS
SELECT
  DATE(ingested_at) AS date,
  coin_id,
  symbol,
  AVG(current_price_usd) AS avg_price,
  MIN(current_price_usd) AS low_price,
  MAX(current_price_usd) AS high_price,
  AVG(total_volume) AS avg_volume,
  AVG(market_cap) AS avg_market_cap,
  COUNT(*) AS snapshot_count
FROM crypto_vision.market_snapshots
GROUP BY date, coin_id, symbol;

-- DeFi TVL trends
CREATE OR REPLACE TABLE crypto_vision.daily_defi_tvl AS
SELECT
  DATE(ingested_at) AS date,
  protocol_slug,
  name,
  chain,
  AVG(tvl_usd) AS avg_tvl,
  MAX(tvl_usd) AS peak_tvl,
  AVG(fees_24h) AS avg_fees,
  AVG(revenue_24h) AS avg_revenue
FROM crypto_vision.defi_protocols
GROUP BY date, protocol_slug, name, chain;

-- Yield opportunity tracker
CREATE OR REPLACE TABLE crypto_vision.daily_yield_summary AS
SELECT
  DATE(ingested_at) AS date,
  chain,
  project,
  symbol,
  AVG(apy) AS avg_apy,
  MAX(apy) AS max_apy,
  AVG(tvl_usd) AS avg_tvl,
  stablecoin
FROM crypto_vision.yield_pools
GROUP BY date, chain, project, symbol, stablecoin;
```

### 6. Historical Backfill Script (`scripts/backfill-bigquery.ts`)

Create a script that backfills historical data from CoinGecko and DeFiLlama:
- CoinGecko: `/coins/{id}/market_chart/range` for top 500 coins, last 365 days
- DeFiLlama: `/protocol/{slug}` historical TVL for top 200 protocols
- Rate-limit aware: respect CoinGecko 30 req/min (or 500/min with Pro key)
- Progress tracking: log which coins/protocols are done
- Resumable: skip already-backfilled date ranges

### 7. Export Script (`scripts/export-bigquery.ts`)

Create a script that exports all BigQuery tables to Google Cloud Storage as Parquet:

```bash
bq extract --destination_format=PARQUET \
  crypto_vision.market_snapshots \
  gs://crypto-vision-exports/market_snapshots/*.parquet
```

This is the most critical script — it's how we keep the data after credits expire.

## Validation

After implementation, verify:
1. `terraform plan` shows all 17 tables
2. `npm run dev` starts without errors (BigQuery is optional)
3. Hitting `/api/coins` also inserts rows into `market_snapshots`
4. `scripts/backfill-bigquery.ts` successfully loads historical data
5. Materialized views produce correct aggregates
6. Export to Parquet works

## GCP APIs to Enable

```bash
gcloud services enable \
  bigquery.googleapis.com \
  bigquerystorage.googleapis.com \
  bigquerydatatransfer.googleapis.com \
  storage.googleapis.com
```

## npm Dependencies to Add

```bash
npm install @google-cloud/bigquery @google-cloud/storage
```
