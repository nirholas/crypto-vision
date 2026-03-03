-- ============================================================================
-- Crypto Vision BigQuery Tables
-- All tables are partitioned by DATE(ingested_at) for cost-efficient queries
-- and clustered by the most commonly filtered columns.
-- ============================================================================

-- 1. Market snapshots (CoinGecko /coins/markets)
CREATE TABLE IF NOT EXISTS crypto_vision.market_snapshots (
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

-- 2. OHLC candles (CoinGecko /coins/{id}/ohlc)
CREATE TABLE IF NOT EXISTS crypto_vision.ohlc_candles (
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

-- 3. DeFi protocol snapshots (DeFiLlama)
CREATE TABLE IF NOT EXISTS crypto_vision.defi_protocols (
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

-- 4. Yield pools (DeFiLlama /pools)
CREATE TABLE IF NOT EXISTS crypto_vision.yield_pools (
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

-- 5. News articles (RSS feeds + enrichment)
CREATE TABLE IF NOT EXISTS crypto_vision.news_articles (
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

-- 6. Fear & Greed Index (Alternative.me)
CREATE TABLE IF NOT EXISTS crypto_vision.fear_greed (
  value INT64,
  classification STRING,
  timestamp_unix INT64,
  ingested_at TIMESTAMP NOT NULL
)
PARTITION BY DATE(ingested_at);

-- 7. DEX pairs (DexScreener + GeckoTerminal)
CREATE TABLE IF NOT EXISTS crypto_vision.dex_pairs (
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

-- 8. Chain TVL (DeFiLlama)
CREATE TABLE IF NOT EXISTS crypto_vision.chain_tvl (
  chain_name STRING NOT NULL,
  tvl_usd FLOAT64,
  protocols_count INT64,
  ingested_at TIMESTAMP NOT NULL
)
PARTITION BY DATE(ingested_at)
CLUSTER BY chain_name;

-- 9. Exchange snapshots (CoinGecko + Binance + Bybit + OKX)
CREATE TABLE IF NOT EXISTS crypto_vision.exchange_snapshots (
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

-- 10. Bitcoin network stats (mempool.space)
CREATE TABLE IF NOT EXISTS crypto_vision.bitcoin_network (
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
CREATE TABLE IF NOT EXISTS crypto_vision.gas_prices (
  chain STRING NOT NULL,
  fast_gwei FLOAT64,
  standard_gwei FLOAT64,
  slow_gwei FLOAT64,
  base_fee_gwei FLOAT64,
  ingested_at TIMESTAMP NOT NULL
)
PARTITION BY DATE(ingested_at)
CLUSTER BY chain;

-- 12. Stablecoin supply (DeFiLlama)
CREATE TABLE IF NOT EXISTS crypto_vision.stablecoin_supply (
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

-- 13. Funding rounds (DeFiLlama)
CREATE TABLE IF NOT EXISTS crypto_vision.funding_rounds (
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

-- 14. Derivatives/perps (CoinGlass, Hyperliquid, dYdX, Deribit)
CREATE TABLE IF NOT EXISTS crypto_vision.derivatives_snapshots (
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

-- 15. Governance proposals (Snapshot)
CREATE TABLE IF NOT EXISTS crypto_vision.governance_proposals (
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
CREATE TABLE IF NOT EXISTS crypto_vision.whale_movements (
  tx_hash STRING NOT NULL,
  chain STRING,
  from_address STRING,
  to_address STRING,
  token_symbol STRING,
  amount FLOAT64,
  usd_value FLOAT64,
  block_number INT64,
  timestamp_unix INT64,
  movement_type STRING,
  ingested_at TIMESTAMP NOT NULL
)
PARTITION BY DATE(ingested_at)
CLUSTER BY chain, token_symbol;

-- 17. Agent interactions (for improving agents)
CREATE TABLE IF NOT EXISTS crypto_vision.agent_interactions (
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

-- 18. Anomaly events (real-time anomaly detection engine)
CREATE TABLE IF NOT EXISTS crypto_vision.anomaly_events (
  event_id STRING NOT NULL,
  type STRING NOT NULL,
  severity STRING NOT NULL,
  asset STRING NOT NULL,
  metric STRING NOT NULL,
  current_value FLOAT64,
  expected_low FLOAT64,
  expected_high FLOAT64,
  deviation FLOAT64,
  message STRING,
  context JSON,
  detector STRING DEFAULT 'statistical-mzs',
  detected_at TIMESTAMP NOT NULL,
  ingested_at TIMESTAMP NOT NULL
)
PARTITION BY DATE(detected_at)
CLUSTER BY type, severity, asset;
