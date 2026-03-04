/**
 * Crypto Vision — CoinGecko Data Source
 *
 * Free tier: 30 calls/min, no key required.
 * Pro tier: 500 calls/min with COINGECKO_API_KEY.
 *
 * Provides: prices, market caps, coin details, trending, global stats,
 *           exchanges, categories, historical data.
 *
 * Rate limiting: Client-side token bucket ensures we respect upstream limits
 * and never trigger 429s. Requests are queued and rate-limited transparently.
 */

import { ingestExchangeSnapshots, ingestMarketSnapshots, ingestOHLCCandles } from "../lib/bq-ingest.js";
import { cache } from "../lib/cache.js";
import { fetchJSON } from "../lib/fetcher.js";
import { waitForCoinGeckoToken, updateRateLimitInfo } from "../lib/coingecko-rate-limit.js";

const BASE = process.env.COINGECKO_PRO === "true"
  ? "https://pro-api.coingecko.com/api/v3"
  : "https://api.coingecko.com/api/v3";

function headers(): Record<string, string> {
  const key = process.env.COINGECKO_API_KEY;
  return key ? { "x-cg-pro-api-key": key } : {};
}

function cg<T>(path: string, ttl: number): Promise<T> {
  return cache.wrap(`cg:${path}`, ttl, async () => {
    // Rate limit: wait for available token before making request
    await waitForCoinGeckoToken();

    const result = await fetchJSON<T>(`${BASE}${path}`, { headers: headers() });
    return result;
  });
}

// ─── Coins & Markets ─────────────────────────────────────────

export interface CoinMarket {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
  market_cap: number;
  market_cap_rank: number;
  total_volume: number;
  price_change_percentage_24h: number;
  price_change_percentage_7d_in_currency?: number;
  price_change_percentage_30d_in_currency?: number;
  circulating_supply: number;
  total_supply: number | null;
  max_supply: number | null;
  ath: number;
  ath_change_percentage: number;
  sparkline_in_7d?: { price: number[] };
}

export async function getCoins(params: {
  page?: number;
  perPage?: number;
  order?: string;
  sparkline?: boolean;
  ids?: string;
  category?: string;
  priceChangePct?: string;
} = {}): Promise<CoinMarket[]> {
  // Converted to async for BigQuery streaming
  const p = new URLSearchParams({
    vs_currency: "usd",
    order: params.order || "market_cap_desc",
    per_page: String(params.perPage || 100),
    page: String(params.page || 1),
    sparkline: String(params.sparkline ?? false),
    price_change_percentage: params.priceChangePct || "24h,7d,30d",
  });
  if (params.ids) p.set("ids", params.ids);
  if (params.category) p.set("category", params.category);

  const data = await cg<CoinMarket[]>(`/coins/markets?${p}`, 180); // 3 min cache (rate limiting)

  // Stream to BigQuery (fire-and-forget, non-blocking)
  ingestMarketSnapshots(data as unknown as Record<string, unknown>[]);

  return data;
}

// ─── Coin Detail ─────────────────────────────────────────────

export interface CoinDetail {
  id: string;
  symbol: string;
  name: string;
  description: { en: string };
  links: {
    homepage: string[];
    blockchain_site: string[];
    repos_url: { github: string[] };
  };
  market_data: {
    current_price: Record<string, number>;
    market_cap: Record<string, number>;
    total_volume: Record<string, number>;
    price_change_percentage_24h: number;
    price_change_percentage_7d: number;
    price_change_percentage_30d: number;
    circulating_supply: number;
    total_supply: number | null;
    max_supply: number | null;
    ath: Record<string, number>;
    ath_date: Record<string, string>;
    ath_change_percentage: Record<string, number>;
    atl: Record<string, number>;
    atl_date: Record<string, string>;
  };
  categories: string[];
  platforms: Record<string, string>;
}

export function getCoinDetail(id: string): Promise<CoinDetail> {
  return cg(
    `/coins/${id}?localization=false&tickers=false&community_data=false&developer_data=false`,
    600 // 10 min cache (stable data)
  );
}

// ─── Price (simple) ──────────────────────────────────────────

export function getPrice(
  ids: string,
  vsCurrencies = "usd",
  include24hChange = true
): Promise<Record<string, Record<string, number>>> {
  const p = new URLSearchParams({
    ids,
    vs_currencies: vsCurrencies,
    include_24hr_change: String(include24hChange),
  });
  return cg(`/simple/price?${p}`, 60); // 1 min cache (rate limiting + reasonable freshness)
}

// ─── Trending ────────────────────────────────────────────────

export interface TrendingCoin {
  item: {
    id: string;
    coin_id: number;
    name: string;
    symbol: string;
    market_cap_rank: number;
    thumb: string;
    price_btc: number;
    score: number;
  };
}

export function getTrending(): Promise<{ coins: TrendingCoin[] }> {
  return cg("/search/trending", 600); // 10 min cache (stable data)
}

// ─── Global Stats ────────────────────────────────────────────

export interface GlobalData {
  data: {
    active_cryptocurrencies: number;
    markets: number;
    total_market_cap: Record<string, number>;
    total_volume: Record<string, number>;
    market_cap_percentage: Record<string, number>;
    market_cap_change_percentage_24h_usd: number;
  };
}

export function getGlobal(): Promise<GlobalData> {
  return cg("/global", 600); // 10 min cache (stable market stats)
}

// ─── Search ──────────────────────────────────────────────────

export function searchCoins(query: string): Promise<{
  coins: Array<{ id: string; name: string; symbol: string; market_cap_rank: number }>;
}> {
  return cg(`/search?query=${encodeURIComponent(query)}`, 300); // 5 min cache
}

// ─── Market Chart (historical) ───────────────────────────────

export function getMarketChart(
  id: string,
  days: number | string = 7,
  interval?: string
): Promise<{
  prices: [number, number][];
  market_caps: [number, number][];
  total_volumes: [number, number][];
}> {
  const p = new URLSearchParams({
    vs_currency: "usd",
    days: String(days),
  });
  if (interval) p.set("interval", interval);
  return cg(`/coins/${id}/market_chart?${p}`, 1800); // 30 min cache (immutable historical data)
}

// ─── OHLC ────────────────────────────────────────────────────

export async function getOHLC(
  id: string,
  days: number = 7
): Promise<[number, number, number, number, number][]> {
  const data = await cg<[number, number, number, number, number][]>(`/coins/${id}/ohlc?vs_currency=usd&days=${days}`, 3600); // 1 hour cache (immutable historical data)

  // Stream to BigQuery (fire-and-forget)
  ingestOHLCCandles(id, data);

  return data;
}

// ─── Exchanges ───────────────────────────────────────────────

export async function getExchanges(
  page = 1,
  perPage = 100
): Promise<Array<{
  id: string;
  name: string;
  year_established: number | null;
  country: string | null;
  trade_volume_24h_btc: number;
  trust_score: number;
  trust_score_rank: number;
}>> {
  const data = await cg<Array<{
    id: string;
    name: string;
    year_established: number | null;
    country: string | null;
    trade_volume_24h_btc: number;
    trust_score: number;
    trust_score_rank: number;
  }>>(`/exchanges?per_page=${perPage}&page=${page}`, 1800); // 30 min cache (stable data)

  // Stream to BigQuery (fire-and-forget)
  ingestExchangeSnapshots(data as unknown as Record<string, unknown>[], "coingecko");

  return data;
}

// ─── Categories ──────────────────────────────────────────────

export function getCategories(): Promise<Array<{
  id: string;
  name: string;
  market_cap: number;
  market_cap_change_24h: number;
  top_3_coins: string[];
  volume_24h: number;
}>> {
  return cg("/coins/categories", 600); // 10 min cache
}
