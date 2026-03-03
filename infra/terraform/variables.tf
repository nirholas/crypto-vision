# ─────────────────────────────────────────────────────────────
# Variables
# ─────────────────────────────────────────────────────────────

variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "region" {
  description = "GCP region"
  type        = string
  default     = "us-central1"
}

variable "service_name" {
  description = "Cloud Run service name"
  type        = string
  default     = "crypto-vision"
}

variable "domain" {
  description = "Custom domain for the service"
  type        = string
  default     = "cryptocurrency.cv"
}

variable "redis_tier" {
  description = "Memorystore Redis tier (BASIC or STANDARD_HA)"
  type        = string
  default     = "STANDARD_HA"
  validation {
    condition     = contains(["BASIC", "STANDARD_HA"], var.redis_tier)
    error_message = "Redis tier must be BASIC or STANDARD_HA."
  }
}

variable "redis_memory_size_gb" {
  description = "Redis memory size in GB"
  type        = number
  default     = 5
}

variable "cloud_run_memory" {
  description = "Memory per Cloud Run instance"
  type        = string
  default     = "2Gi"
}

variable "cloud_run_cpu" {
  description = "vCPUs per Cloud Run instance"
  type        = string
  default     = "4"
}

variable "cloud_run_min_instances" {
  description = "Minimum Cloud Run instances (always warm)"
  type        = number
  default     = 2
}

variable "cloud_run_max_instances" {
  description = "Maximum Cloud Run instances (scales to 10M+ users)"
  type        = number
  default     = 500
}

variable "container_image" {
  description = "Container image to deploy (e.g., us-central1-docker.pkg.dev/PROJECT/crypto-vision/crypto-vision:latest)"
  type        = string
  default     = ""
}

variable "secret_names" {
  description = "List of secret names to create in Secret Manager"
  type        = list(string)
  default = [
    "COINGECKO_API_KEY",
    "GROQ_API_KEY",
    "GEMINI_API_KEY",
    "OPENAI_API_KEY",
    "ANTHROPIC_API_KEY",
    "OPENROUTER_API_KEY",
    "REDIS_URL",
  ]
}

variable "scheduler_jobs" {
  description = "Cloud Scheduler jobs for periodic data refresh"
  type = list(object({
    name     = string
    schedule = string
    path     = string
    desc     = string
  }))
  default = [
    # Market data (high frequency)
    { name = "ingest-coins", schedule = "*/2 * * * *", path = "/api/coins", desc = "Market snapshots (top 250)" },
    { name = "ingest-prices-btc-eth", schedule = "*/1 * * * *", path = "/api/price?ids=bitcoin,ethereum,solana,bnb", desc = "Key prices" },
    { name = "ingest-trending", schedule = "*/5 * * * *", path = "/api/trending", desc = "Trending coins" },
    { name = "ingest-global", schedule = "*/5 * * * *", path = "/api/global", desc = "Global market stats" },
    { name = "ingest-fear-greed", schedule = "*/15 * * * *", path = "/api/fear-greed", desc = "Fear & Greed Index" },

    # DeFi (standard frequency)
    { name = "ingest-defi-protocols", schedule = "*/10 * * * *", path = "/api/defi/protocols", desc = "DeFi protocol TVL" },
    { name = "ingest-defi-chains", schedule = "*/10 * * * *", path = "/api/defi/chains", desc = "Chain TVL rankings" },
    { name = "ingest-defi-yields", schedule = "*/10 * * * *", path = "/api/defi/yields", desc = "Yield pool APYs" },
    { name = "ingest-defi-stablecoins", schedule = "*/15 * * * *", path = "/api/defi/stablecoins", desc = "Stablecoin supply" },
    { name = "ingest-defi-dex-volumes", schedule = "*/15 * * * *", path = "/api/defi/dex-volumes", desc = "DEX trading volumes" },
    { name = "ingest-defi-fees", schedule = "*/15 * * * *", path = "/api/defi/fees", desc = "Protocol fees & revenue" },
    { name = "ingest-defi-bridges", schedule = "*/30 * * * *", path = "/api/defi/bridges", desc = "Bridge volumes" },
    { name = "ingest-defi-raises", schedule = "0 */2 * * *", path = "/api/defi/raises", desc = "Funding rounds" },

    # News
    { name = "ingest-news", schedule = "*/5 * * * *", path = "/api/news", desc = "Latest crypto news" },
    { name = "ingest-news-bitcoin", schedule = "*/5 * * * *", path = "/api/news/bitcoin", desc = "Bitcoin-specific news" },
    { name = "ingest-news-defi", schedule = "*/10 * * * *", path = "/api/news/defi", desc = "DeFi news" },
    { name = "ingest-news-breaking", schedule = "*/5 * * * *", path = "/api/news/breaking", desc = "Breaking crypto news" },

    # DEX & Trading
    { name = "ingest-dex-trending", schedule = "*/5 * * * *", path = "/api/dex/trending", desc = "Trending DEX pairs" },
    { name = "ingest-dex-new-pools", schedule = "*/5 * * * *", path = "/api/dex/new", desc = "Newly created pools" },

    # On-chain
    { name = "ingest-gas", schedule = "*/5 * * * *", path = "/api/onchain/gas", desc = "Multi-chain gas prices" },
    { name = "ingest-btc-fees", schedule = "*/5 * * * *", path = "/api/onchain/bitcoin/fees", desc = "Bitcoin fee estimates" },
    { name = "ingest-btc-stats", schedule = "*/15 * * * *", path = "/api/onchain/bitcoin/stats", desc = "Bitcoin network stats" },

    # Derivatives
    { name = "ingest-funding-rates", schedule = "*/10 * * * *", path = "/api/derivatives/funding", desc = "Perp funding rates" },
    { name = "ingest-open-interest", schedule = "*/10 * * * *", path = "/api/derivatives/oi", desc = "Open interest" },
    { name = "ingest-liquidations", schedule = "*/10 * * * *", path = "/api/derivatives/liquidations", desc = "Liquidation data" },

    # Exchanges
    { name = "ingest-exchanges", schedule = "*/30 * * * *", path = "/api/exchanges", desc = "Exchange rankings" },
    { name = "ingest-categories", schedule = "*/30 * * * *", path = "/api/categories", desc = "Coin categories" },

    # Layer 2
    { name = "ingest-l2-summary", schedule = "*/30 * * * *", path = "/api/l2", desc = "L2 scaling summary" },

    # Governance
    { name = "ingest-governance", schedule = "0 */1 * * *", path = "/api/governance", desc = "Governance proposals" },

    # DePIN
    { name = "ingest-depin", schedule = "0 */1 * * *", path = "/api/depin", desc = "DePIN projects" },

    # Macro
    { name = "ingest-macro", schedule = "0 */2 * * *", path = "/api/macro", desc = "Macro economic data" },

    # AI cache warming
    { name = "warm-ai-digest", schedule = "0 */4 * * *", path = "/api/ai/digest", desc = "AI market digest" },
    { name = "warm-ai-signals", schedule = "0 */2 * * *", path = "/api/ai/signals", desc = "AI trading signals" },
    { name = "warm-ai-sentiment-btc", schedule = "*/30 * * * *", path = "/api/ai/sentiment/bitcoin", desc = "BTC AI sentiment" },
    { name = "warm-ai-sentiment-eth", schedule = "*/30 * * * *", path = "/api/ai/sentiment/ethereum", desc = "ETH AI sentiment" },
  ]
}
