-- ============================================================================
-- Materialized Aggregate Views
-- These scheduled queries run daily at 00:05 UTC to produce summary tables.
-- They replace the target table each run (CREATE OR REPLACE TABLE).
-- ============================================================================

-- Daily market summary — aggregate price/volume/market cap per coin per day
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

-- Daily DeFi TVL trends — per-protocol per-chain TVL aggregates
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

-- Daily yield opportunity tracker
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

-- Daily derivatives overview — OI, funding, liquidation aggregates
CREATE OR REPLACE TABLE crypto_vision.daily_derivatives_summary AS
SELECT
  DATE(ingested_at) AS date,
  symbol,
  exchange,
  AVG(open_interest_usd) AS avg_oi,
  MAX(open_interest_usd) AS peak_oi,
  AVG(funding_rate) AS avg_funding_rate,
  SUM(liquidations_24h) AS total_liquidations,
  AVG(long_short_ratio) AS avg_ls_ratio,
  AVG(volume_24h) AS avg_volume
FROM crypto_vision.derivatives_snapshots
GROUP BY date, symbol, exchange;

-- Daily Fear & Greed history
CREATE OR REPLACE TABLE crypto_vision.daily_fear_greed AS
SELECT
  DATE(ingested_at) AS date,
  AVG(value) AS avg_value,
  MAX(value) AS max_value,
  MIN(value) AS min_value,
  ANY_VALUE(classification) AS latest_classification,
  COUNT(*) AS sample_count
FROM crypto_vision.fear_greed
GROUP BY date;

-- Daily chain TVL rankings
CREATE OR REPLACE TABLE crypto_vision.daily_chain_tvl AS
SELECT
  DATE(ingested_at) AS date,
  chain_name,
  AVG(tvl_usd) AS avg_tvl,
  MAX(tvl_usd) AS peak_tvl,
  AVG(protocols_count) AS avg_protocols
FROM crypto_vision.chain_tvl
GROUP BY date, chain_name;

-- Daily gas price summary across chains
CREATE OR REPLACE TABLE crypto_vision.daily_gas_summary AS
SELECT
  DATE(ingested_at) AS date,
  chain,
  AVG(fast_gwei) AS avg_fast,
  MAX(fast_gwei) AS peak_fast,
  AVG(standard_gwei) AS avg_standard,
  AVG(slow_gwei) AS avg_slow,
  AVG(base_fee_gwei) AS avg_base_fee
FROM crypto_vision.gas_prices
GROUP BY date, chain;

-- Daily stablecoin supply tracker
CREATE OR REPLACE TABLE crypto_vision.daily_stablecoin_supply AS
SELECT
  DATE(ingested_at) AS date,
  symbol,
  name,
  AVG(circulating) AS avg_circulating,
  MAX(circulating) AS peak_circulating,
  AVG(price) AS avg_price,
  MIN(price) AS min_price,
  MAX(price) AS max_price
FROM crypto_vision.stablecoin_supply
GROUP BY date, symbol, name;

-- Daily DEX pair volume leaders
CREATE OR REPLACE TABLE crypto_vision.daily_dex_volume AS
SELECT
  DATE(ingested_at) AS date,
  chain_id,
  base_token_symbol,
  dex_id,
  AVG(price_usd) AS avg_price,
  SUM(volume_24h) AS total_volume,
  AVG(liquidity_usd) AS avg_liquidity,
  COUNT(*) AS snapshot_count
FROM crypto_vision.dex_pairs
GROUP BY date, chain_id, base_token_symbol, dex_id;

-- Daily Bitcoin network health
CREATE OR REPLACE TABLE crypto_vision.daily_bitcoin_network AS
SELECT
  DATE(ingested_at) AS date,
  AVG(hashrate) AS avg_hashrate,
  MAX(difficulty) AS difficulty,
  MAX(block_height) AS max_block_height,
  AVG(fee_fast_sat_vb) AS avg_fee_fast,
  AVG(fee_medium_sat_vb) AS avg_fee_medium,
  AVG(fee_slow_sat_vb) AS avg_fee_slow,
  AVG(mempool_size) AS avg_mempool_size
FROM crypto_vision.bitcoin_network
GROUP BY date;

-- Agent performance analytics
CREATE OR REPLACE TABLE crypto_vision.daily_agent_analytics AS
SELECT
  DATE(ingested_at) AS date,
  agent_id,
  COUNT(*) AS total_interactions,
  AVG(latency_ms) AS avg_latency_ms,
  APPROX_QUANTILES(latency_ms, 100)[OFFSET(95)] AS p95_latency_ms,
  SUM(tokens_used) AS total_tokens,
  COUNTIF(user_feedback = 'positive') AS positive_feedback,
  COUNTIF(user_feedback = 'negative') AS negative_feedback
FROM crypto_vision.agent_interactions
GROUP BY date, agent_id;
