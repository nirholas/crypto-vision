/**
 * Crypto Vision — Cloud Scheduler Job Definitions
 *
 * Comprehensive set of 50+ scheduler jobs covering every data source.
 * Used by both the Terraform module and the infra/setup.sh script.
 *
 * Each job hits a Cloud Run endpoint at the specified schedule,
 * warming the cache and triggering BQ ingestion as a side effect.
 */

export interface SchedulerJob {
  /** Unique job name (must be DNS-compatible) */
  name: string;
  /** Cron schedule expression (UTC) */
  schedule: string;
  /** API endpoint to hit */
  endpoint: string;
  /** Human-readable description */
  desc: string;
}

export const SCHEDULER_JOBS: SchedulerJob[] = [
  // ── Market Data (high frequency) ──────────────────────────

  { name: "ingest-coins", schedule: "*/2 * * * *", endpoint: "/api/coins", desc: "Market snapshots (top 250)" },
  { name: "ingest-prices-btc-eth", schedule: "*/1 * * * *", endpoint: "/api/price?ids=bitcoin,ethereum,solana,bnb", desc: "Key prices" },
  { name: "ingest-trending", schedule: "*/5 * * * *", endpoint: "/api/trending", desc: "Trending coins" },
  { name: "ingest-global", schedule: "*/5 * * * *", endpoint: "/api/global", desc: "Global market stats" },
  { name: "ingest-fear-greed", schedule: "*/15 * * * *", endpoint: "/api/fear-greed", desc: "Fear & Greed Index" },
  { name: "ingest-search-trending", schedule: "*/10 * * * *", endpoint: "/api/search/trending", desc: "Search trending terms" },

  // ── DeFi (standard frequency) ─────────────────────────────

  { name: "ingest-defi-protocols", schedule: "*/10 * * * *", endpoint: "/api/defi/protocols", desc: "DeFi protocol TVL" },
  { name: "ingest-defi-chains", schedule: "*/10 * * * *", endpoint: "/api/defi/chains", desc: "Chain TVL rankings" },
  { name: "ingest-defi-yields", schedule: "*/10 * * * *", endpoint: "/api/defi/yields", desc: "Yield pool APYs" },
  { name: "ingest-defi-stablecoins", schedule: "*/15 * * * *", endpoint: "/api/defi/stablecoins", desc: "Stablecoin supply" },
  { name: "ingest-defi-dex-volumes", schedule: "*/15 * * * *", endpoint: "/api/defi/dex-volumes", desc: "DEX trading volumes" },
  { name: "ingest-defi-fees", schedule: "*/15 * * * *", endpoint: "/api/defi/fees", desc: "Protocol fees & revenue" },
  { name: "ingest-defi-bridges", schedule: "*/30 * * * *", endpoint: "/api/defi/bridges", desc: "Bridge volumes" },
  { name: "ingest-defi-raises", schedule: "0 */2 * * *", endpoint: "/api/defi/raises", desc: "Funding rounds" },
  { name: "ingest-defi-hacks", schedule: "0 */4 * * *", endpoint: "/api/defi/hacks", desc: "DeFi hack history" },
  { name: "ingest-defi-liquidations", schedule: "*/15 * * * *", endpoint: "/api/defi/liquidations", desc: "Active liquidations" },
  { name: "ingest-defi-options", schedule: "*/30 * * * *", endpoint: "/api/defi/options", desc: "Options volume" },
  { name: "ingest-defi-treasuries", schedule: "0 */6 * * *", endpoint: "/api/defi/treasuries", desc: "DAO treasuries" },

  // ── News ──────────────────────────────────────────────────

  { name: "ingest-news", schedule: "*/5 * * * *", endpoint: "/api/news", desc: "Latest crypto news" },
  { name: "ingest-news-bitcoin", schedule: "*/5 * * * *", endpoint: "/api/news/bitcoin", desc: "Bitcoin-specific news" },
  { name: "ingest-news-defi", schedule: "*/10 * * * *", endpoint: "/api/news/defi", desc: "DeFi news" },
  { name: "ingest-news-breaking", schedule: "*/5 * * * *", endpoint: "/api/news/breaking", desc: "Breaking crypto news" },
  { name: "ingest-news-sentiment", schedule: "*/15 * * * *", endpoint: "/api/news/sentiment", desc: "News sentiment analysis" },

  // ── DEX & Trading ─────────────────────────────────────────

  { name: "ingest-dex-trending", schedule: "*/5 * * * *", endpoint: "/api/dex/trending", desc: "Trending DEX pairs" },
  { name: "ingest-dex-new-pools", schedule: "*/5 * * * *", endpoint: "/api/dex/new", desc: "Newly created pools" },
  { name: "ingest-dex-top-eth", schedule: "*/10 * * * *", endpoint: "/api/dex/top/eth", desc: "Top Ethereum pools" },
  { name: "ingest-dex-top-sol", schedule: "*/10 * * * *", endpoint: "/api/dex/top/solana", desc: "Top Solana pools" },
  { name: "ingest-dex-top-bsc", schedule: "*/10 * * * *", endpoint: "/api/dex/top/bsc", desc: "Top BSC pools" },

  // ── On-chain ──────────────────────────────────────────────

  { name: "ingest-gas", schedule: "*/5 * * * *", endpoint: "/api/onchain/gas", desc: "Multi-chain gas prices" },
  { name: "ingest-btc-fees", schedule: "*/5 * * * *", endpoint: "/api/onchain/bitcoin/fees", desc: "Bitcoin fee estimates" },
  { name: "ingest-btc-stats", schedule: "*/15 * * * *", endpoint: "/api/onchain/bitcoin/stats", desc: "Bitcoin network stats" },
  { name: "ingest-btc-mempool", schedule: "*/10 * * * *", endpoint: "/api/onchain/bitcoin/mempool", desc: "Mempool stats" },
  { name: "ingest-btc-lightning", schedule: "*/30 * * * *", endpoint: "/api/onchain/bitcoin/lightning", desc: "Lightning Network" },
  { name: "ingest-btc-difficulty", schedule: "0 */2 * * *", endpoint: "/api/onchain/bitcoin/difficulty", desc: "Difficulty adjustment" },

  // ── Derivatives ───────────────────────────────────────────

  { name: "ingest-funding-rates", schedule: "*/10 * * * *", endpoint: "/api/derivatives/funding", desc: "Perp funding rates" },
  { name: "ingest-open-interest", schedule: "*/10 * * * *", endpoint: "/api/derivatives/oi", desc: "Open interest" },
  { name: "ingest-liquidations", schedule: "*/10 * * * *", endpoint: "/api/derivatives/liquidations", desc: "Liquidation data" },
  { name: "ingest-perps-hl", schedule: "*/10 * * * *", endpoint: "/api/perps/hyperliquid", desc: "Hyperliquid perps" },
  { name: "ingest-options-btc", schedule: "*/15 * * * *", endpoint: "/api/options/BTC", desc: "BTC options" },
  { name: "ingest-options-eth", schedule: "*/15 * * * *", endpoint: "/api/options/ETH", desc: "ETH options" },

  // ── Exchanges ─────────────────────────────────────────────

  { name: "ingest-exchanges", schedule: "*/30 * * * *", endpoint: "/api/exchanges", desc: "Exchange rankings" },
  { name: "ingest-categories", schedule: "*/30 * * * *", endpoint: "/api/categories", desc: "Coin categories" },

  // ── Layer 2 & Infrastructure ──────────────────────────────

  { name: "ingest-l2-summary", schedule: "*/30 * * * *", endpoint: "/api/l2", desc: "L2 scaling summary" },
  { name: "ingest-l2-activity", schedule: "*/30 * * * *", endpoint: "/api/l2/activity", desc: "L2 activity data" },

  // ── Governance ────────────────────────────────────────────

  { name: "ingest-governance", schedule: "0 */1 * * *", endpoint: "/api/governance", desc: "Governance proposals" },
  { name: "ingest-governance-spaces", schedule: "0 */2 * * *", endpoint: "/api/governance/spaces", desc: "DAO spaces" },

  // ── DePIN ─────────────────────────────────────────────────

  { name: "ingest-depin", schedule: "0 */1 * * *", endpoint: "/api/depin", desc: "DePIN projects" },
  { name: "ingest-depin-metrics", schedule: "0 */2 * * *", endpoint: "/api/depin/metrics", desc: "DePIN aggregate metrics" },

  // ── Macro ─────────────────────────────────────────────────

  { name: "ingest-macro", schedule: "0 */2 * * *", endpoint: "/api/macro", desc: "Macro economic data" },
  { name: "ingest-macro-indices", schedule: "0 */1 * * *", endpoint: "/api/macro/indices", desc: "Stock market indices" },
  { name: "ingest-macro-commodities", schedule: "0 */2 * * *", endpoint: "/api/macro/commodities", desc: "Commodity prices" },

  // ── Solana Ecosystem ──────────────────────────────────────

  { name: "ingest-solana-tokens", schedule: "*/15 * * * *", endpoint: "/api/solana/tokens", desc: "Solana token data" },

  // ── AI Cache Warming ──────────────────────────────────────

  { name: "warm-ai-digest", schedule: "0 */4 * * *", endpoint: "/api/ai/digest", desc: "AI market digest" },
  { name: "warm-ai-signals", schedule: "0 */2 * * *", endpoint: "/api/ai/signals", desc: "AI trading signals" },
  { name: "warm-ai-sentiment-btc", schedule: "*/30 * * * *", endpoint: "/api/ai/sentiment/bitcoin", desc: "BTC AI sentiment" },
  { name: "warm-ai-sentiment-eth", schedule: "*/30 * * * *", endpoint: "/api/ai/sentiment/ethereum", desc: "ETH AI sentiment" },
  { name: "warm-ai-sentiment-sol", schedule: "*/30 * * * *", endpoint: "/api/ai/sentiment/solana", desc: "SOL AI sentiment" },
];

/**
 * Get jobs filtered by minimum poll frequency.
 */
export function getJobsByMaxFrequency(maxMinutes: number): SchedulerJob[] {
  return SCHEDULER_JOBS.filter((job) => {
    const match = job.schedule.match(/^\*\/(\d+)/);
    if (match) return parseInt(match[1], 10) <= maxMinutes;
    return true; // Include hourly+ jobs
  });
}

/**
 * Get Terraform-compatible variable format.
 */
export function toTerraformVarFormat(): Array<{ name: string; schedule: string; path: string; desc: string }> {
  return SCHEDULER_JOBS.map((j) => ({
    name: j.name,
    schedule: j.schedule,
    path: j.endpoint,
    desc: j.desc,
  }));
}
