/**
 * Test Fixtures — Shared test data for integration and E2E tests.
 *
 * Real (or realistic) data structures matching the API's response shapes.
 * No mocks — these are reference values for assertion comparisons.
 */

// ─── Coin Fixtures ───────────────────────────────────────────

/** Well-known coin IDs that CoinGecko / upstream APIs always have. */
export const WELL_KNOWN_COINS = [
  "bitcoin",
  "ethereum",
  "tether",
  "binancecoin",
  "solana",
] as const;

/** A subset of coin IDs for quick iteration tests. */
export const TEST_COIN_IDS = ["bitcoin", "ethereum"] as const;

/** Expected shape of a coin in the /api/coins response. */
export interface CoinListItem {
  id: string;
  symbol: string;
  name: string;
  current_price?: number;
  market_cap?: number;
  market_cap_rank?: number;
  price_change_percentage_24h?: number;
}

// ─── Portfolio Fixtures ──────────────────────────────────────

/** Sample portfolio holdings for /api/portfolio endpoints. */
export const SAMPLE_PORTFOLIO = {
  holdings: [
    { coinId: "bitcoin", amount: 0.5 },
    { coinId: "ethereum", amount: 10 },
    { coinId: "solana", amount: 100 },
  ],
};

/** Larger portfolio for stress testing. */
export const LARGE_PORTFOLIO = {
  holdings: Array.from({ length: 50 }, (_, i) => ({
    coinId: WELL_KNOWN_COINS[i % WELL_KNOWN_COINS.length],
    amount: Math.random() * 100,
  })),
};

// ─── DeFi Fixtures ───────────────────────────────────────────

/** Well-known DeFi protocol slugs for DefiLlama. */
export const DEFI_PROTOCOLS = [
  "aave",
  "uniswap",
  "lido",
  "maker",
  "curve-dex",
] as const;

/** Chain names for DeFi chain queries. */
export const DEFI_CHAINS = [
  "ethereum",
  "bsc",
  "polygon",
  "arbitrum",
  "optimism",
] as const;

// ─── News Fixtures ───────────────────────────────────────────

/** Expected shape fields for a news article response. */
export const NEWS_REQUIRED_FIELDS = [
  "title",
  "url",
  "source",
] as const;

// ─── Search Fixtures ─────────────────────────────────────────

/** Common search queries for testing. */
export const SEARCH_QUERIES = [
  "bitcoin",
  "ethereum merge",
  "defi yield",
  "nft",
  "layer 2",
] as const;

// ─── Attack / Fuzz Payloads ──────────────────────────────────

/** SQL injection payloads. */
export const SQL_INJECTION_PAYLOADS = [
  "' OR 1=1 --",
  "'; DROP TABLE users; --",
  "1 UNION SELECT * FROM api_keys",
  "1; SELECT * FROM information_schema.tables",
] as const;

/** XSS payloads. */
export const XSS_PAYLOADS = [
  "<script>alert(1)</script>",
  '<img src=x onerror="alert(1)">',
  "javascript:alert(1)",
  '"><script>alert(document.cookie)</script>',
  "<svg onload=alert(1)>",
] as const;

/** Path traversal payloads. */
export const PATH_TRAVERSAL_PAYLOADS = [
  "../../../etc/passwd",
  "..\\..\\..\\windows\\system32\\config\\sam",
  "%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd",
  "....//....//....//etc/passwd",
] as const;

/** Null byte payloads. */
export const NULL_BYTE_PAYLOADS = [
  "%00",
  "\x00\x00\x00",
  "test%00.json",
] as const;

/** Oversized payloads for buffer overflow testing. */
export const OVERSIZED_PAYLOADS = {
  medium: "a".repeat(10_000),
  large: "a".repeat(100_000),
} as const;

// ─── Endpoints ───────────────────────────────────────────────

/** All GET API endpoints for comprehensive testing. */
export const API_GET_ENDPOINTS = [
  "/api/coins",
  "/api/trending",
  "/api/global",
  "/api/fear-greed",
  "/api/defi/protocols",
  "/api/defi/chains",
  "/api/defi/yields",
  "/api/news",
  "/api/news/sources",
  "/api/onchain/gas",
  "/api/onchain/bitcoin/stats",
  "/api/cex/tickers",
  "/api/cex/prices",
  "/api/dex/networks",
  "/api/dex/trending-pools",
  "/api/derivatives/funding",
  "/api/derivatives/oi",
  "/api/bitcoin/price",
  "/api/bitcoin/stats",
  "/api/gas",
  "/api/research/assets",
  "/api/l2/summary",
  "/api/security/chains",
  "/api/aggregate/tickers",
  "/api/aggregate/global",
  "/api/agents",
  "/api/analytics/volatility",
  "/api/perps/overview",
  "/api/perps/funding",
  "/api/governance/spaces",
  "/api/macro/overview",
  "/api/solana/tokens/popular",
  "/api/depin/projects",
  "/api/exchanges/list",
  "/api/nft/overview",
  "/api/whales/overview",
  "/api/staking/overview",
  "/api/calendar/events",
  "/api/oracles/chainlink/feeds",
  "/api/unlocks/upcoming",
  "/api/etf/overview",
  "/api/social/fear-greed",
  "/api/news-feed/sources",
  "/api/news-feed/categories",
  "/api/anomalies",
  "/api/anomalies/stats",
] as const;

/** Endpoints expected to be fast (cached / lightweight). */
export const FAST_ENDPOINTS = [
  "/health",
  "/",
  "/api",
] as const;

/** Endpoints that hit upstream APIs and may be slower. */
export const UPSTREAM_ENDPOINTS = [
  "/api/coins",
  "/api/trending",
  "/api/defi/protocols",
  "/api/news",
] as const;

// ─── WebSocket Topics ────────────────────────────────────────

/** Available WebSocket topics. */
export const WS_TOPICS = [
  "prices",
  "bitcoin",
  "trades",
  "alerts",
] as const;

/** WebSocket endpoint paths. */
export const WS_ENDPOINTS = {
  prices: "/ws/prices",
  bitcoin: "/ws/bitcoin",
  trades: "/ws/trades",
  alerts: "/ws/alerts",
  status: "/ws/status",
} as const;

// ─── HTTP Status Helpers ─────────────────────────────────────

/** Status codes we accept from upstream-dependent endpoints. */
export const ACCEPTABLE_STATUSES = [200, 400, 429, 502, 503, 504] as const;

/** Check if a status code is acceptable (our server responded correctly). */
export function isAcceptableStatus(status: number): boolean {
  return (ACCEPTABLE_STATUSES as readonly number[]).includes(status);
}

/** Status codes that indicate our server code crashed (unacceptable). */
export function isServerError(status: number): boolean {
  return status === 500;
}
