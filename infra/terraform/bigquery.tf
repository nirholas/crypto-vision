# ─────────────────────────────────────────────────────────────
# BigQuery — Data Warehouse
#
# Provisions the crypto_vision dataset and all 17 tables,
# plus scheduled queries for daily materialized aggregates.
# ─────────────────────────────────────────────────────────────

# ── Dataset ─────────────────────────────────────────────────

resource "google_bigquery_dataset" "crypto_vision" {
  dataset_id    = "crypto_vision"
  friendly_name = "Crypto Vision Data Warehouse"
  description   = "Production crypto data warehouse — market snapshots, DeFi, derivatives, news, on-chain, and agent analytics."
  location      = var.region

  default_table_expiration_ms = null # Never expire — data is permanent
  delete_contents_on_destroy  = false

  labels = {
    env  = "production"
    team = "data"
  }

  access {
    role          = "OWNER"
    special_group = "projectOwners"
  }

  access {
    role          = "WRITER"
    user_by_email = google_service_account.cloud_run.email
  }

  access {
    role          = "READER"
    special_group = "projectReaders"
  }
}

# ── IAM Bindings ───────────────────────────────────────────

# Cloud Run SA can insert data into BigQuery
resource "google_project_iam_member" "cloud_run_bq_editor" {
  project = var.project_id
  role    = "roles/bigquery.dataEditor"
  member  = "serviceAccount:${google_service_account.cloud_run.email}"
}

# Cloud Run SA can run BigQuery jobs
resource "google_project_iam_member" "cloud_run_bq_job_user" {
  project = var.project_id
  role    = "roles/bigquery.jobUser"
  member  = "serviceAccount:${google_service_account.cloud_run.email}"
}

# Scheduler SA can run BigQuery scheduled queries
resource "google_project_iam_member" "scheduler_bq_job_user" {
  project = var.project_id
  role    = "roles/bigquery.jobUser"
  member  = "serviceAccount:${google_service_account.scheduler.email}"
}

# ── Table: market_snapshots ────────────────────────────────

resource "google_bigquery_table" "market_snapshots" {
  dataset_id          = google_bigquery_dataset.crypto_vision.dataset_id
  table_id            = "market_snapshots"
  deletion_protection = true
  description         = "CoinGecko coin market snapshots — price, market cap, volume, supply"

  time_partitioning {
    type  = "DAY"
    field = "ingested_at"
  }

  clustering = ["coin_id", "symbol"]

  schema = jsonencode([
    { name = "snapshot_id",          type = "STRING",    mode = "REQUIRED" },
    { name = "coin_id",             type = "STRING",    mode = "REQUIRED" },
    { name = "symbol",              type = "STRING",    mode = "REQUIRED" },
    { name = "name",                type = "STRING",    mode = "REQUIRED" },
    { name = "current_price_usd",   type = "FLOAT64",   mode = "NULLABLE" },
    { name = "market_cap",          type = "FLOAT64",   mode = "NULLABLE" },
    { name = "market_cap_rank",     type = "INT64",     mode = "NULLABLE" },
    { name = "total_volume",        type = "FLOAT64",   mode = "NULLABLE" },
    { name = "price_change_pct_1h", type = "FLOAT64",   mode = "NULLABLE" },
    { name = "price_change_pct_24h",type = "FLOAT64",   mode = "NULLABLE" },
    { name = "price_change_pct_7d", type = "FLOAT64",   mode = "NULLABLE" },
    { name = "price_change_pct_30d",type = "FLOAT64",   mode = "NULLABLE" },
    { name = "circulating_supply",  type = "FLOAT64",   mode = "NULLABLE" },
    { name = "total_supply",        type = "FLOAT64",   mode = "NULLABLE" },
    { name = "max_supply",          type = "FLOAT64",   mode = "NULLABLE" },
    { name = "ath",                 type = "FLOAT64",   mode = "NULLABLE" },
    { name = "ath_change_pct",      type = "FLOAT64",   mode = "NULLABLE" },
    { name = "ingested_at",         type = "TIMESTAMP", mode = "REQUIRED" },
    { name = "source",              type = "STRING",    mode = "NULLABLE" },
  ])
}

# ── Table: ohlc_candles ───────────────────────────────────

resource "google_bigquery_table" "ohlc_candles" {
  dataset_id          = google_bigquery_dataset.crypto_vision.dataset_id
  table_id            = "ohlc_candles"
  deletion_protection = true
  description         = "OHLCV candle data from CoinGecko and other sources"

  time_partitioning {
    type  = "DAY"
    field = "ingested_at"
  }

  clustering = ["coin_id", "timestamp_ms"]

  schema = jsonencode([
    { name = "coin_id",      type = "STRING",    mode = "REQUIRED" },
    { name = "timestamp_ms", type = "INT64",     mode = "REQUIRED" },
    { name = "open",         type = "FLOAT64",   mode = "NULLABLE" },
    { name = "high",         type = "FLOAT64",   mode = "NULLABLE" },
    { name = "low",          type = "FLOAT64",   mode = "NULLABLE" },
    { name = "close",        type = "FLOAT64",   mode = "NULLABLE" },
    { name = "volume",       type = "FLOAT64",   mode = "NULLABLE" },
    { name = "ingested_at",  type = "TIMESTAMP", mode = "REQUIRED" },
    { name = "source",       type = "STRING",    mode = "NULLABLE" },
  ])
}

# ── Table: defi_protocols ─────────────────────────────────

resource "google_bigquery_table" "defi_protocols" {
  dataset_id          = google_bigquery_dataset.crypto_vision.dataset_id
  table_id            = "defi_protocols"
  deletion_protection = true
  description         = "DeFiLlama protocol TVL snapshots with fees and revenue"

  time_partitioning {
    type  = "DAY"
    field = "ingested_at"
  }

  clustering = ["protocol_slug", "chain"]

  schema = jsonencode([
    { name = "protocol_slug", type = "STRING",    mode = "REQUIRED" },
    { name = "name",          type = "STRING",    mode = "REQUIRED" },
    { name = "category",      type = "STRING",    mode = "NULLABLE" },
    { name = "chain",         type = "STRING",    mode = "NULLABLE" },
    { name = "tvl_usd",       type = "FLOAT64",   mode = "NULLABLE" },
    { name = "change_1h",     type = "FLOAT64",   mode = "NULLABLE" },
    { name = "change_1d",     type = "FLOAT64",   mode = "NULLABLE" },
    { name = "change_7d",     type = "FLOAT64",   mode = "NULLABLE" },
    { name = "mcap_tvl_ratio",type = "FLOAT64",   mode = "NULLABLE" },
    { name = "fees_24h",      type = "FLOAT64",   mode = "NULLABLE" },
    { name = "revenue_24h",   type = "FLOAT64",   mode = "NULLABLE" },
    { name = "ingested_at",   type = "TIMESTAMP", mode = "REQUIRED" },
    { name = "source",        type = "STRING",    mode = "NULLABLE" },
  ])
}

# ── Table: yield_pools ────────────────────────────────────

resource "google_bigquery_table" "yield_pools" {
  dataset_id          = google_bigquery_dataset.crypto_vision.dataset_id
  table_id            = "yield_pools"
  deletion_protection = true
  description         = "DeFiLlama yield pool data — APY, TVL, risk classification"

  time_partitioning {
    type  = "DAY"
    field = "ingested_at"
  }

  clustering = ["chain", "project"]

  schema = jsonencode([
    { name = "pool_id",    type = "STRING",  mode = "REQUIRED" },
    { name = "chain",      type = "STRING",  mode = "NULLABLE" },
    { name = "project",    type = "STRING",  mode = "NULLABLE" },
    { name = "symbol",     type = "STRING",  mode = "NULLABLE" },
    { name = "tvl_usd",    type = "FLOAT64", mode = "NULLABLE" },
    { name = "apy",        type = "FLOAT64", mode = "NULLABLE" },
    { name = "apy_base",   type = "FLOAT64", mode = "NULLABLE" },
    { name = "apy_reward", type = "FLOAT64", mode = "NULLABLE" },
    { name = "il_risk",    type = "STRING",  mode = "NULLABLE" },
    { name = "stablecoin", type = "BOOLEAN", mode = "NULLABLE" },
    { name = "ingested_at",type = "TIMESTAMP", mode = "REQUIRED" },
  ])
}

# ── Table: news_articles ──────────────────────────────────

resource "google_bigquery_table" "news_articles" {
  dataset_id          = google_bigquery_dataset.crypto_vision.dataset_id
  table_id            = "news_articles"
  deletion_protection = true
  description         = "Crypto news articles from 130+ RSS feeds with sentiment and NLP enrichment"

  time_partitioning {
    type  = "DAY"
    field = "ingested_at"
  }

  clustering = ["source_name", "category"]

  schema = jsonencode([
    { name = "article_id",      type = "STRING",    mode = "REQUIRED" },
    { name = "title",           type = "STRING",    mode = "NULLABLE" },
    { name = "description",     type = "STRING",    mode = "NULLABLE" },
    { name = "url",             type = "STRING",    mode = "NULLABLE" },
    { name = "source_name",     type = "STRING",    mode = "NULLABLE" },
    { name = "category",        type = "STRING",    mode = "NULLABLE" },
    { name = "published_at",    type = "TIMESTAMP", mode = "NULLABLE" },
    { name = "sentiment_score", type = "FLOAT64",   mode = "NULLABLE" },
    { name = "sentiment_label", type = "STRING",    mode = "NULLABLE" },
    { name = "entities",        type = "STRING",    mode = "REPEATED" },
    { name = "topics",          type = "STRING",    mode = "REPEATED" },
    { name = "embedding",       type = "FLOAT64",   mode = "REPEATED" },
    { name = "ingested_at",     type = "TIMESTAMP", mode = "REQUIRED" },
  ])
}

# ── Table: fear_greed ─────────────────────────────────────

resource "google_bigquery_table" "fear_greed" {
  dataset_id          = google_bigquery_dataset.crypto_vision.dataset_id
  table_id            = "fear_greed"
  deletion_protection = true
  description         = "Alternative.me Fear & Greed Index historical snapshots"

  time_partitioning {
    type  = "DAY"
    field = "ingested_at"
  }

  schema = jsonencode([
    { name = "value",          type = "INT64",     mode = "NULLABLE" },
    { name = "classification", type = "STRING",    mode = "NULLABLE" },
    { name = "timestamp_unix", type = "INT64",     mode = "NULLABLE" },
    { name = "ingested_at",    type = "TIMESTAMP", mode = "REQUIRED" },
  ])
}

# ── Table: dex_pairs ──────────────────────────────────────

resource "google_bigquery_table" "dex_pairs" {
  dataset_id          = google_bigquery_dataset.crypto_vision.dataset_id
  table_id            = "dex_pairs"
  deletion_protection = true
  description         = "DEX pair data from DexScreener and GeckoTerminal"

  time_partitioning {
    type  = "DAY"
    field = "ingested_at"
  }

  clustering = ["chain_id", "base_token_symbol"]

  schema = jsonencode([
    { name = "pair_address",        type = "STRING",    mode = "REQUIRED" },
    { name = "chain_id",            type = "STRING",    mode = "NULLABLE" },
    { name = "dex_id",              type = "STRING",    mode = "NULLABLE" },
    { name = "base_token_address",  type = "STRING",    mode = "NULLABLE" },
    { name = "base_token_symbol",   type = "STRING",    mode = "NULLABLE" },
    { name = "quote_token_address", type = "STRING",    mode = "NULLABLE" },
    { name = "quote_token_symbol",  type = "STRING",    mode = "NULLABLE" },
    { name = "price_usd",           type = "FLOAT64",   mode = "NULLABLE" },
    { name = "volume_24h",          type = "FLOAT64",   mode = "NULLABLE" },
    { name = "liquidity_usd",       type = "FLOAT64",   mode = "NULLABLE" },
    { name = "price_change_5m",     type = "FLOAT64",   mode = "NULLABLE" },
    { name = "price_change_1h",     type = "FLOAT64",   mode = "NULLABLE" },
    { name = "price_change_24h",    type = "FLOAT64",   mode = "NULLABLE" },
    { name = "fdv",                  type = "FLOAT64",   mode = "NULLABLE" },
    { name = "ingested_at",         type = "TIMESTAMP", mode = "REQUIRED" },
    { name = "source",              type = "STRING",    mode = "NULLABLE" },
  ])
}

# ── Table: chain_tvl ──────────────────────────────────────

resource "google_bigquery_table" "chain_tvl" {
  dataset_id          = google_bigquery_dataset.crypto_vision.dataset_id
  table_id            = "chain_tvl"
  deletion_protection = true
  description         = "DeFiLlama chain-level TVL snapshots"

  time_partitioning {
    type  = "DAY"
    field = "ingested_at"
  }

  clustering = ["chain_name"]

  schema = jsonencode([
    { name = "chain_name",      type = "STRING",    mode = "REQUIRED" },
    { name = "tvl_usd",         type = "FLOAT64",   mode = "NULLABLE" },
    { name = "protocols_count", type = "INT64",     mode = "NULLABLE" },
    { name = "ingested_at",     type = "TIMESTAMP", mode = "REQUIRED" },
  ])
}

# ── Table: exchange_snapshots ─────────────────────────────

resource "google_bigquery_table" "exchange_snapshots" {
  dataset_id          = google_bigquery_dataset.crypto_vision.dataset_id
  table_id            = "exchange_snapshots"
  deletion_protection = true
  description         = "Exchange volume and trust snapshots from CoinGecko, Binance, Bybit, OKX"

  time_partitioning {
    type  = "DAY"
    field = "ingested_at"
  }

  clustering = ["exchange_id"]

  schema = jsonencode([
    { name = "exchange_id",          type = "STRING",    mode = "REQUIRED" },
    { name = "name",                 type = "STRING",    mode = "NULLABLE" },
    { name = "trust_score",          type = "INT64",     mode = "NULLABLE" },
    { name = "trade_volume_24h_btc", type = "FLOAT64",   mode = "NULLABLE" },
    { name = "trade_volume_24h_usd", type = "FLOAT64",   mode = "NULLABLE" },
    { name = "open_interest_usd",    type = "FLOAT64",   mode = "NULLABLE" },
    { name = "ingested_at",          type = "TIMESTAMP", mode = "REQUIRED" },
    { name = "source",               type = "STRING",    mode = "NULLABLE" },
  ])
}

# ── Table: bitcoin_network ────────────────────────────────

resource "google_bigquery_table" "bitcoin_network" {
  dataset_id          = google_bigquery_dataset.crypto_vision.dataset_id
  table_id            = "bitcoin_network"
  deletion_protection = true
  description         = "Bitcoin network metrics — hashrate, difficulty, fees, mempool"

  time_partitioning {
    type  = "DAY"
    field = "ingested_at"
  }

  schema = jsonencode([
    { name = "hashrate",           type = "FLOAT64",   mode = "NULLABLE" },
    { name = "difficulty",         type = "FLOAT64",   mode = "NULLABLE" },
    { name = "block_height",       type = "INT64",     mode = "NULLABLE" },
    { name = "fee_fast_sat_vb",    type = "FLOAT64",   mode = "NULLABLE" },
    { name = "fee_medium_sat_vb",  type = "FLOAT64",   mode = "NULLABLE" },
    { name = "fee_slow_sat_vb",    type = "FLOAT64",   mode = "NULLABLE" },
    { name = "mempool_size",       type = "INT64",     mode = "NULLABLE" },
    { name = "ingested_at",        type = "TIMESTAMP", mode = "REQUIRED" },
  ])
}

# ── Table: gas_prices ─────────────────────────────────────

resource "google_bigquery_table" "gas_prices" {
  dataset_id          = google_bigquery_dataset.crypto_vision.dataset_id
  table_id            = "gas_prices"
  deletion_protection = true
  description         = "Multi-chain gas price snapshots"

  time_partitioning {
    type  = "DAY"
    field = "ingested_at"
  }

  clustering = ["chain"]

  schema = jsonencode([
    { name = "chain",         type = "STRING",    mode = "REQUIRED" },
    { name = "fast_gwei",     type = "FLOAT64",   mode = "NULLABLE" },
    { name = "standard_gwei", type = "FLOAT64",   mode = "NULLABLE" },
    { name = "slow_gwei",     type = "FLOAT64",   mode = "NULLABLE" },
    { name = "base_fee_gwei", type = "FLOAT64",   mode = "NULLABLE" },
    { name = "ingested_at",   type = "TIMESTAMP", mode = "REQUIRED" },
  ])
}

# ── Table: stablecoin_supply ──────────────────────────────

resource "google_bigquery_table" "stablecoin_supply" {
  dataset_id          = google_bigquery_dataset.crypto_vision.dataset_id
  table_id            = "stablecoin_supply"
  deletion_protection = true
  description         = "DeFiLlama stablecoin supply tracking across chains"

  time_partitioning {
    type  = "DAY"
    field = "ingested_at"
  }

  clustering = ["symbol"]

  schema = jsonencode([
    { name = "stablecoin_id",     type = "STRING",    mode = "REQUIRED" },
    { name = "name",              type = "STRING",    mode = "NULLABLE" },
    { name = "symbol",            type = "STRING",    mode = "NULLABLE" },
    { name = "peg_type",          type = "STRING",    mode = "NULLABLE" },
    { name = "circulating",       type = "FLOAT64",   mode = "NULLABLE" },
    { name = "chain_circulating", type = "JSON",      mode = "NULLABLE" },
    { name = "price",             type = "FLOAT64",   mode = "NULLABLE" },
    { name = "ingested_at",       type = "TIMESTAMP", mode = "REQUIRED" },
  ])
}

# ── Table: funding_rounds ─────────────────────────────────

resource "google_bigquery_table" "funding_rounds" {
  dataset_id          = google_bigquery_dataset.crypto_vision.dataset_id
  table_id            = "funding_rounds"
  deletion_protection = true
  description         = "DeFiLlama crypto/DeFi funding rounds and raises"

  time_partitioning {
    type  = "DAY"
    field = "ingested_at"
  }

  schema = jsonencode([
    { name = "round_id",       type = "STRING",  mode = "NULLABLE" },
    { name = "name",           type = "STRING",  mode = "NULLABLE" },
    { name = "category",       type = "STRING",  mode = "NULLABLE" },
    { name = "amount",         type = "FLOAT64", mode = "NULLABLE" },
    { name = "round_type",     type = "STRING",  mode = "NULLABLE" },
    { name = "lead_investors", type = "STRING",  mode = "REPEATED" },
    { name = "date",           type = "STRING",  mode = "NULLABLE" },
    { name = "ingested_at",    type = "TIMESTAMP", mode = "REQUIRED" },
  ])
}

# ── Table: derivatives_snapshots ──────────────────────────

resource "google_bigquery_table" "derivatives_snapshots" {
  dataset_id          = google_bigquery_dataset.crypto_vision.dataset_id
  table_id            = "derivatives_snapshots"
  deletion_protection = true
  description         = "Derivatives/perps data from CoinGlass, Hyperliquid, dYdX, Deribit"

  time_partitioning {
    type  = "DAY"
    field = "ingested_at"
  }

  clustering = ["symbol", "exchange"]

  schema = jsonencode([
    { name = "symbol",            type = "STRING",    mode = "REQUIRED" },
    { name = "exchange",          type = "STRING",    mode = "NULLABLE" },
    { name = "open_interest_usd", type = "FLOAT64",   mode = "NULLABLE" },
    { name = "funding_rate",      type = "FLOAT64",   mode = "NULLABLE" },
    { name = "volume_24h",        type = "FLOAT64",   mode = "NULLABLE" },
    { name = "long_short_ratio",  type = "FLOAT64",   mode = "NULLABLE" },
    { name = "liquidations_24h",  type = "FLOAT64",   mode = "NULLABLE" },
    { name = "ingested_at",       type = "TIMESTAMP", mode = "REQUIRED" },
    { name = "source",            type = "STRING",    mode = "NULLABLE" },
  ])
}

# ── Table: governance_proposals ───────────────────────────

resource "google_bigquery_table" "governance_proposals" {
  dataset_id          = google_bigquery_dataset.crypto_vision.dataset_id
  table_id            = "governance_proposals"
  deletion_protection = true
  description         = "Snapshot.org governance proposals across major DAOs"

  time_partitioning {
    type  = "DAY"
    field = "ingested_at"
  }

  clustering = ["space_id"]

  schema = jsonencode([
    { name = "proposal_id",  type = "STRING",    mode = "REQUIRED" },
    { name = "space_id",     type = "STRING",    mode = "NULLABLE" },
    { name = "title",        type = "STRING",    mode = "NULLABLE" },
    { name = "body",         type = "STRING",    mode = "NULLABLE" },
    { name = "state",        type = "STRING",    mode = "NULLABLE" },
    { name = "author",       type = "STRING",    mode = "NULLABLE" },
    { name = "votes_for",    type = "FLOAT64",   mode = "NULLABLE" },
    { name = "votes_against",type = "FLOAT64",   mode = "NULLABLE" },
    { name = "quorum",       type = "FLOAT64",   mode = "NULLABLE" },
    { name = "start_ts",     type = "INT64",     mode = "NULLABLE" },
    { name = "end_ts",       type = "INT64",     mode = "NULLABLE" },
    { name = "ingested_at",  type = "TIMESTAMP", mode = "REQUIRED" },
  ])
}

# ── Table: whale_movements ────────────────────────────────

resource "google_bigquery_table" "whale_movements" {
  dataset_id          = google_bigquery_dataset.crypto_vision.dataset_id
  table_id            = "whale_movements"
  deletion_protection = true
  description         = "Whale and smart money on-chain movements"

  time_partitioning {
    type  = "DAY"
    field = "ingested_at"
  }

  clustering = ["chain", "token_symbol"]

  schema = jsonencode([
    { name = "tx_hash",        type = "STRING",    mode = "REQUIRED" },
    { name = "chain",          type = "STRING",    mode = "NULLABLE" },
    { name = "from_address",   type = "STRING",    mode = "NULLABLE" },
    { name = "to_address",     type = "STRING",    mode = "NULLABLE" },
    { name = "token_symbol",   type = "STRING",    mode = "NULLABLE" },
    { name = "amount",         type = "FLOAT64",   mode = "NULLABLE" },
    { name = "usd_value",      type = "FLOAT64",   mode = "NULLABLE" },
    { name = "block_number",   type = "INT64",     mode = "NULLABLE" },
    { name = "timestamp_unix", type = "INT64",     mode = "NULLABLE" },
    { name = "movement_type",  type = "STRING",    mode = "NULLABLE" },
    { name = "ingested_at",    type = "TIMESTAMP", mode = "REQUIRED" },
  ])
}

# ── Table: agent_interactions ─────────────────────────────

resource "google_bigquery_table" "agent_interactions" {
  dataset_id          = google_bigquery_dataset.crypto_vision.dataset_id
  table_id            = "agent_interactions"
  deletion_protection = true
  description         = "Agent interaction logs for performance monitoring and improvement"

  time_partitioning {
    type  = "DAY"
    field = "ingested_at"
  }

  clustering = ["agent_id"]

  schema = jsonencode([
    { name = "interaction_id", type = "STRING",    mode = "REQUIRED" },
    { name = "agent_id",       type = "STRING",    mode = "REQUIRED" },
    { name = "query",          type = "STRING",    mode = "NULLABLE" },
    { name = "response",       type = "STRING",    mode = "NULLABLE" },
    { name = "model_used",     type = "STRING",    mode = "NULLABLE" },
    { name = "tokens_used",    type = "INT64",     mode = "NULLABLE" },
    { name = "latency_ms",     type = "INT64",     mode = "NULLABLE" },
    { name = "user_feedback",  type = "STRING",    mode = "NULLABLE" },
    { name = "ingested_at",    type = "TIMESTAMP", mode = "REQUIRED" },
  ])
}

# ── Scheduled Queries for Materialized Aggregates ─────────

resource "google_bigquery_data_transfer_config" "daily_market_summary" {
  display_name   = "Daily Market Summary"
  data_source_id = "scheduled_query"
  location       = var.region
  schedule       = "every day 00:05"

  params = {
    query = <<-SQL
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
      GROUP BY date, coin_id, symbol
    SQL
  }
}

resource "google_bigquery_data_transfer_config" "daily_defi_tvl" {
  display_name   = "Daily DeFi TVL"
  data_source_id = "scheduled_query"
  location       = var.region
  schedule       = "every day 00:10"

  params = {
    query = <<-SQL
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
      GROUP BY date, protocol_slug, name, chain
    SQL
  }
}

resource "google_bigquery_data_transfer_config" "daily_yield_summary" {
  display_name   = "Daily Yield Summary"
  data_source_id = "scheduled_query"
  location       = var.region
  schedule       = "every day 00:15"

  params = {
    query = <<-SQL
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
      GROUP BY date, chain, project, symbol, stablecoin
    SQL
  }
}

resource "google_bigquery_data_transfer_config" "daily_derivatives_summary" {
  display_name   = "Daily Derivatives Summary"
  data_source_id = "scheduled_query"
  location       = var.region
  schedule       = "every day 00:20"

  params = {
    query = <<-SQL
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
      GROUP BY date, symbol, exchange
    SQL
  }
}

resource "google_bigquery_data_transfer_config" "daily_agent_analytics" {
  display_name   = "Daily Agent Analytics"
  data_source_id = "scheduled_query"
  location       = var.region
  schedule       = "every day 00:25"

  params = {
    query = <<-SQL
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
      GROUP BY date, agent_id
    SQL
  }
}

# ── GCS Export Bucket ─────────────────────────────────────

resource "google_storage_bucket" "exports" {
  name          = "${var.project_id}-crypto-vision-exports"
  location      = var.region
  storage_class = "STANDARD"

  uniform_bucket_level_access = true

  lifecycle_rule {
    condition {
      age = 90
    }
    action {
      type          = "SetStorageClass"
      storage_class = "NEARLINE"
    }
  }

  lifecycle_rule {
    condition {
      age = 365
    }
    action {
      type          = "SetStorageClass"
      storage_class = "COLDLINE"
    }
  }

  labels = {
    env  = "production"
    team = "data"
  }
}

# Cloud Run SA can write exports to GCS
resource "google_storage_bucket_iam_member" "cloud_run_gcs_writer" {
  bucket = google_storage_bucket.exports.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.cloud_run.email}"
}
