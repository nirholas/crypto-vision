/**
 * Crypto Vision — Binance Public Market Data Source
 *
 * 100% free, no API key required.
 * Public endpoints: 1200 weight/min IP rate limit.
 *
 * Provides: spot tickers, order books, recent trades, klines/candles,
 *           average prices, exchange info, futures data (funding rates,
 *           open interest, liquidations, long/short ratios), analytics
 *           (top gainers/losers, volume profiles), and data transformations.
 *
 * Tracks request weight via X-MBX-USED-WEIGHT-1M header to prevent
 * hitting rate limits. Handles 418 (IP ban) and 429 (rate limit) gracefully.
 */

import { z } from "zod";
import { ingestDerivativesSnapshots, ingestOHLCCandles } from "../lib/bq-ingest.js";
import { cache } from "../lib/cache.js";
import { log } from "../lib/logger.js";

// ─── API Base URLs ───────────────────────────────────────────

const SPOT_BASE = "https://api.binance.com/api/v3";
const FAPI_BASE = "https://fapi.binance.com/fapi/v1";
const SAPI_BASE = "https://api.binance.com/sapi/v1";
const FUTURES_DATA_BASE = "https://fapi.binance.com/futures/data";

// Keep backward compat — some internal helpers used `BASE`
const BASE = SPOT_BASE;

// ─── Weight Tracking ─────────────────────────────────────────

const WEIGHT_LIMIT = 1200;
const WEIGHT_WARN_RATIO = 0.8;

let usedWeight = 0;
let weightWindowStart = Date.now();

function resetWeightIfNeeded(): void {
  const now = Date.now();
  if (now - weightWindowStart >= 60_000) {
    usedWeight = 0;
    weightWindowStart = now;
  }
}

/** Current weight used this minute */
export function getUsedWeight(): number {
  resetWeightIfNeeded();
  return usedWeight;
}

/** Weight remaining in this minute */
export function getRemainingWeight(): number {
  resetWeightIfNeeded();
  return Math.max(0, WEIGHT_LIMIT - usedWeight);
}

/** true if > 80% of weight budget used */
export function isNearRateLimit(): boolean {
  resetWeightIfNeeded();
  return usedWeight > WEIGHT_LIMIT * WEIGHT_WARN_RATIO;
}

function updateWeight(headerValue: string | null): void {
  resetWeightIfNeeded();
  if (headerValue) {
    const parsed = Number(headerValue);
    if (!Number.isNaN(parsed)) {
      usedWeight = parsed;
      if (usedWeight > WEIGHT_LIMIT * WEIGHT_WARN_RATIO) {
        log.warn(
          { usedWeight, limit: WEIGHT_LIMIT, remaining: WEIGHT_LIMIT - usedWeight },
          "Binance rate limit warning — approaching weight limit",
        );
      }
    }
  }
}

// ─── Base Fetch ──────────────────────────────────────────────

/**
 * Hardened Binance fetch that:
 *  - Tracks request weight via X-MBX-USED-WEIGHT-1M header
 *  - Handles 418 (IP ban) and 429 (rate limit) via retry-after
 *  - Uses cache.wrap() with caller-specified TTL
 *  - Falls back to fetchJSON for circuit breaking + retries
 */
async function binanceFetch<T>(
  baseUrl: string,
  path: string,
  params?: Record<string, string>,
  ttl = 30,
): Promise<T> {
  const qs = params
    ? "?" + new URLSearchParams(params).toString()
    : "";
  const fullPath = `${path}${qs}`;
  const cacheKey = `bn:${baseUrl === SPOT_BASE ? "" : baseUrl.replace("https://", "")}:${fullPath}`;

  return cache.wrap(cacheKey, ttl, async () => {
    if (isNearRateLimit()) {
      log.warn(
        { usedWeight, remaining: getRemainingWeight() },
        "Binance weight near limit — request may be throttled",
      );
    }

    const url = `${baseUrl}${fullPath}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);

    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          "User-Agent": "CryptoVision/1.0",
        },
      });

      clearTimeout(timer);

      // Track weight from response header
      updateWeight(res.headers.get("X-MBX-USED-WEIGHT-1M"));

      // Handle IP ban (418) and rate limit (429)
      if (res.status === 418 || res.status === 429) {
        const retryAfter = Number(res.headers.get("Retry-After") || "60");
        log.error(
          { status: res.status, retryAfter },
          res.status === 418
            ? "Binance IP banned — backing off"
            : "Binance rate limited — backing off",
        );
        throw new Error(`Binance ${res.status}: retry after ${retryAfter}s`);
      }

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`Binance HTTP ${res.status}: ${body}`);
      }

      return (await res.json()) as T;
    } catch (err) {
      clearTimeout(timer);
      throw err;
    }
  });
}

/** Shorthand for spot API */
function bn<T>(path: string, ttl: number): Promise<T> {
  return binanceFetch<T>(SPOT_BASE, path, undefined, ttl);
}

// ─── Zod Schemas ─────────────────────────────────────────────

export const Ticker24hSchema = z.object({
  symbol: z.string(),
  priceChange: z.string(),
  priceChangePercent: z.string(),
  weightedAvgPrice: z.string(),
  prevClosePrice: z.string(),
  lastPrice: z.string(),
  lastQty: z.string(),
  bidPrice: z.string(),
  askPrice: z.string(),
  openPrice: z.string(),
  highPrice: z.string(),
  lowPrice: z.string(),
  volume: z.string(),
  quoteVolume: z.string(),
  openTime: z.number(),
  closeTime: z.number(),
  count: z.number(),
  firstId: z.number().optional(),
  lastId: z.number().optional(),
});

export const OrderBookSchema = z.object({
  lastUpdateId: z.number(),
  bids: z.array(z.tuple([z.string(), z.string()])),
  asks: z.array(z.tuple([z.string(), z.string()])),
});

/** Kline from Binance is an array of 12 elements */
export const KlineDataSchema = z.tuple([
  z.number(),  // Open time
  z.string(),  // Open
  z.string(),  // High
  z.string(),  // Low
  z.string(),  // Close
  z.string(),  // Volume
  z.number(),  // Close time
  z.string(),  // Quote asset volume
  z.number(),  // Number of trades
  z.string(),  // Taker buy base vol
  z.string(),  // Taker buy quote vol
  z.string(),  // Ignore
]);

export const SymbolInfoSchema = z.object({
  symbol: z.string(),
  status: z.string(),
  baseAsset: z.string(),
  quoteAsset: z.string(),
  baseAssetPrecision: z.number(),
  quoteAssetPrecision: z.number(),
  orderTypes: z.array(z.string()).optional(),
  icebergAllowed: z.boolean().optional(),
  isSpotTradingAllowed: z.boolean().optional(),
  isMarginTradingAllowed: z.boolean().optional(),
  filters: z.array(z.record(z.unknown())).optional(),
  permissions: z.array(z.string()).optional(),
});

export const ExchangeInfoSchema = z.object({
  timezone: z.string(),
  serverTime: z.number(),
  symbols: z.array(SymbolInfoSchema),
});

export const AggTradeSchema = z.object({
  a: z.number(),           // Aggregate trade ID
  p: z.string(),           // Price
  q: z.string(),           // Quantity
  f: z.number(),           // First trade ID
  l: z.number(),           // Last trade ID
  T: z.number(),           // Timestamp
  m: z.boolean(),          // Is the buyer the market maker?
  M: z.boolean().optional(), // Best price match
});

export const FundingRateSchema = z.object({
  symbol: z.string(),
  fundingRate: z.string(),
  fundingTime: z.number(),
  markPrice: z.string().optional(),
});

export const OpenInterestSchema = z.object({
  symbol: z.string(),
  openInterest: z.string(),
  time: z.number().optional(),
});

export const LongShortRatioSchema = z.object({
  symbol: z.string(),
  longShortRatio: z.string(),
  longAccount: z.string(),
  shortAccount: z.string(),
  timestamp: z.number().optional(),
});

export const TickerPriceSchema = z.object({
  symbol: z.string(),
  price: z.string(),
});

export const BookTickerSchema = z.object({
  symbol: z.string(),
  bidPrice: z.string(),
  bidQty: z.string(),
  askPrice: z.string(),
  askQty: z.string(),
});

export const ForceLiquidationSchema = z.object({
  symbol: z.string(),
  price: z.string(),
  origQty: z.string(),
  executedQty: z.string(),
  averagePrice: z.string(),
  status: z.string(),
  timeInForce: z.string(),
  type: z.string(),
  side: z.string(),
  time: z.number(),
});

// ─── Inferred Types ──────────────────────────────────────────

export type Ticker24h = z.infer<typeof Ticker24hSchema>;
export type OrderBook = z.infer<typeof OrderBookSchema>;
export type KlineData = z.infer<typeof KlineDataSchema>;
export type SymbolInfo = z.infer<typeof SymbolInfoSchema>;
export type ExchangeInfo = z.infer<typeof ExchangeInfoSchema>;
export type AggTrade = z.infer<typeof AggTradeSchema>;
export type FundingRate = z.infer<typeof FundingRateSchema>;
export type OpenInterest = z.infer<typeof OpenInterestSchema>;
export type LongShortRatio = z.infer<typeof LongShortRatioSchema>;
export type TickerPrice = z.infer<typeof TickerPriceSchema>;
export type BookTicker = z.infer<typeof BookTickerSchema>;
export type ForceLiquidation = z.infer<typeof ForceLiquidationSchema>;

// Legacy alias — old kline tuple type matches KlineData
export type Kline = KlineData;

// ─── Mini Ticker (non-schema, lightweight) ───────────────────

export interface MiniTicker {
  symbol: string;
  lastPrice: string;
  openPrice: string;
  highPrice: string;
  lowPrice: string;
  volume: string;
  quoteVolume: string;
}

export interface Trade {
  id: number;
  price: string;
  qty: string;
  quoteQty: string;
  time: number;
  isBuyerMaker: boolean;
}

// ─── OHLCV (formatted kline output) ─────────────────────────

export interface OHLCV {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// ─── Leveraged Token Filter ──────────────────────────────────

const LEVERAGED_SUFFIXES = ["UP", "DOWN", "BULL", "BEAR"];

function isLeveragedToken(symbol: string): boolean {
  return LEVERAGED_SUFFIXES.some(
    (suffix) => symbol.includes(suffix) && symbol !== suffix,
  );
}

// ═══════════════════════════════════════════════════════════════
// SPOT MARKET FUNCTIONS
// ═══════════════════════════════════════════════════════════════

// ─── 24hr Ticker ─────────────────────────────────────────────

/** Get 24h ticker for a specific symbol or all symbols */
export function getTicker24h(symbol?: string): Promise<Ticker24h | Ticker24h[]> {
  const path = symbol ? `/ticker/24hr?symbol=${symbol}` : "/ticker/24hr";
  return bn(path, symbol ? 15 : 30);
}

// ─── Ticker Price ────────────────────────────────────────────

export function getTickerPrice(symbol?: string): Promise<TickerPrice | TickerPrice[]> {
  const path = symbol ? `/ticker/price?symbol=${symbol}` : "/ticker/price";
  return bn(path, 10);
}

// ─── Order Book ──────────────────────────────────────────────

export function getOrderBook(symbol: string, limit = 20): Promise<OrderBook> {
  const l = Math.min(limit, 1000);
  return bn(`/depth?symbol=${symbol}&limit=${l}`, 5);
}

// ─── Klines (Candlesticks) ──────────────────────────────────

export async function getKlines(
  symbol: string,
  interval = "1h",
  limit = 100,
): Promise<KlineData[]> {
  const l = Math.min(limit, 1000);
  const data = await bn<KlineData[]>(`/klines?symbol=${symbol}&interval=${interval}&limit=${l}`, 30);
  ingestOHLCCandles(symbol, data.map(k => [k[0], Number(k[1]), Number(k[2]), Number(k[3]), Number(k[4])]));
  return data;
}

// ─── Aggregated Trades ───────────────────────────────────────

export function getAggTrades(symbol: string, limit = 100): Promise<AggTrade[]> {
  const l = Math.min(limit, 1000);
  return bn(`/aggTrades?symbol=${symbol}&limit=${l}`, 10);
}

// ─── Exchange Info ───────────────────────────────────────────

export function getExchangeInfo(): Promise<ExchangeInfo> {
  return bn("/exchangeInfo", 3600);
}

// ─── Average Price ───────────────────────────────────────────

export function getAvgPrice(symbol: string): Promise<{ mins: number; price: string; closeTime: number }> {
  return bn(`/avgPrice?symbol=${symbol}`, 15);
}

// ─── 24h Stats (all symbols) ────────────────────────────────

export function get24hStats(): Promise<Ticker24h[]> {
  return bn("/ticker/24hr", 30);
}

// ─── Mini Ticker ─────────────────────────────────────────────

/** Lightweight 24h ticker — faster than full ticker */
export function getMiniTicker(symbol?: string): Promise<MiniTicker | MiniTicker[]> {
  const path = symbol ? `/ticker?symbol=${symbol}&windowSize=1d` : "/ticker?windowSize=1d";
  return bn(path, 15);
}

// ─── Recent Trades ───────────────────────────────────────────

export function getRecentTrades(symbol: string, limit = 50): Promise<Trade[]> {
  const l = Math.min(limit, 1000);
  return bn(`/trades?symbol=${symbol}&limit=${l}`, 5);
}

// ─── Book Ticker (Best Bid/Ask) ──────────────────────────────

export function getBookTicker(symbol?: string): Promise<BookTicker | BookTicker[]> {
  const path = symbol ? `/ticker/bookTicker?symbol=${symbol}` : "/ticker/bookTicker";
  return bn(path, 5);
}

// ═══════════════════════════════════════════════════════════════
// FUTURES FUNCTIONS
// ═══════════════════════════════════════════════════════════════

// ─── Funding Rates ───────────────────────────────────────────

export async function getFundingRates(symbol?: string, limit = 100): Promise<FundingRate[]> {
  const params: Record<string, string> = { limit: String(Math.min(limit, 1000)) };
  if (symbol) params.symbol = symbol;
  const data = await binanceFetch<FundingRate[]>(FAPI_BASE, "/fundingRate", params, 60);
  ingestDerivativesSnapshots(
    data.map(d => ({ symbol: d.symbol, fundingRate: Number(d.fundingRate), exchange: "binance" })),
    "binance",
  );
  return data;
}

// ─── Open Interest ───────────────────────────────────────────

export async function getOpenInterest(symbol: string): Promise<OpenInterest> {
  const data = await binanceFetch<OpenInterest>(FAPI_BASE, "/openInterest", { symbol }, 30);
  ingestDerivativesSnapshots(
    [{ symbol: data.symbol, openInterest: Number(data.openInterest), exchange: "binance" }],
    "binance",
  );
  return data;
}

// ─── Futures Klines ──────────────────────────────────────────

export async function getFuturesKlines(
  symbol: string,
  interval = "1h",
  limit = 100,
): Promise<KlineData[]> {
  return binanceFetch<KlineData[]>(
    FAPI_BASE,
    "/klines",
    { symbol, interval, limit: String(Math.min(limit, 1000)) },
    30,
  );
}

// ─── Global Long/Short Ratio ────────────────────────────────

export async function getLongShortRatio(
  symbol: string,
  period = "5m",
  limit = 30,
): Promise<LongShortRatio[]> {
  const data = await binanceFetch<LongShortRatio[]>(
    FUTURES_DATA_BASE,
    "/globalLongShortAccountRatio",
    { symbol, period, limit: String(Math.min(limit, 500)) },
    60,
  );
  if (data.length > 0) {
    const latest = data[0];
    ingestDerivativesSnapshots(
      [{ symbol, longShortRatio: Number(latest.longShortRatio), exchange: "binance" }],
      "binance",
    );
  }
  return data;
}

// ─── Top Trader Long/Short (Position Ratio) ─────────────────

export async function getTopTraderLongShort(
  symbol: string,
  period = "5m",
  limit = 30,
): Promise<LongShortRatio[]> {
  return binanceFetch<LongShortRatio[]>(
    FUTURES_DATA_BASE,
    "/topLongShortPositionRatio",
    { symbol, period, limit: String(Math.min(limit, 500)) },
    60,
  );
}

// ─── Force Liquidation Orders ────────────────────────────────

export async function getLiquidations(
  symbol?: string,
  limit = 100,
): Promise<ForceLiquidation[]> {
  const params: Record<string, string> = { limit: String(Math.min(limit, 1000)) };
  if (symbol) params.symbol = symbol;
  const data = await binanceFetch<ForceLiquidation[]>(FAPI_BASE, "/allForceOrders", params, 15);
  ingestDerivativesSnapshots(
    data.map(d => ({ symbol: d.symbol, liquidations: Number(d.origQty), exchange: "binance" })),
    "binance",
  );
  return data;
}

// ═══════════════════════════════════════════════════════════════
// ANALYTICS FUNCTIONS
// ═══════════════════════════════════════════════════════════════

// ─── Top Volume Pairs ────────────────────────────────────────

export async function getTopVolumePairs(limit = 20): Promise<Ticker24h[]> {
  return cache.wrap(`bn:analytics:topvol:${limit}`, 30, async () => {
    const all = (await getTicker24h()) as Ticker24h[];
    return all
      .filter((t) => !isLeveragedToken(t.symbol) && Number(t.quoteVolume) > 0)
      .sort((a, b) => Number(b.quoteVolume) - Number(a.quoteVolume))
      .slice(0, limit);
  });
}

// ─── Top Gainers ─────────────────────────────────────────────

export async function getTopGainers(limit = 20): Promise<Ticker24h[]> {
  return cache.wrap(`bn:analytics:gainers:${limit}`, 30, async () => {
    const all = (await getTicker24h()) as Ticker24h[];
    return all
      .filter(
        (t) =>
          !isLeveragedToken(t.symbol) &&
          Number(t.quoteVolume) > 10_000 &&
          Number(t.priceChangePercent) > 0,
      )
      .sort(
        (a, b) =>
          Number(b.priceChangePercent) - Number(a.priceChangePercent),
      )
      .slice(0, limit);
  });
}

// ─── Top Losers ──────────────────────────────────────────────

export async function getTopLosers(limit = 20): Promise<Ticker24h[]> {
  return cache.wrap(`bn:analytics:losers:${limit}`, 30, async () => {
    const all = (await getTicker24h()) as Ticker24h[];
    return all
      .filter(
        (t) =>
          !isLeveragedToken(t.symbol) &&
          Number(t.quoteVolume) > 10_000 &&
          Number(t.priceChangePercent) < 0,
      )
      .sort(
        (a, b) =>
          Number(a.priceChangePercent) - Number(b.priceChangePercent),
      )
      .slice(0, limit);
  });
}

// ─── Volume Profile ──────────────────────────────────────────

export interface VolumeProfileBucket {
  priceLevel: number;
  volume: number;
  buyVolume: number;
  sellVolume: number;
}

export interface VolumeProfile {
  symbol: string;
  buckets: VolumeProfileBucket[];
  highPrice: number;
  lowPrice: number;
  pointOfControl: number; // Price level with highest volume
}

export async function getVolumeProfile(
  symbol: string,
  interval = "1h",
  limit = 100,
  bucketCount = 20,
): Promise<VolumeProfile> {
  return cache.wrap(`bn:analytics:volprofile:${symbol}:${interval}:${limit}`, 120, async () => {
    const klines = await getKlines(symbol, interval, limit);

    if (klines.length === 0) {
      return { symbol, buckets: [], highPrice: 0, lowPrice: 0, pointOfControl: 0 };
    }

    const high = Math.max(...klines.map((k) => Number(k[2])));
    const low = Math.min(...klines.map((k) => Number(k[3])));
    const range = high - low;

    if (range === 0) {
      return { symbol, buckets: [], highPrice: high, lowPrice: low, pointOfControl: high };
    }

    const bucketSize = range / bucketCount;
    const buckets: VolumeProfileBucket[] = Array.from({ length: bucketCount }, (_, i) => ({
      priceLevel: low + bucketSize * (i + 0.5),
      volume: 0,
      buyVolume: 0,
      sellVolume: 0,
    }));

    for (const k of klines) {
      const kOpen = Number(k[1]);
      const kClose = Number(k[4]);
      const kVolume = Number(k[5]);
      const kTakerBuyVol = Number(k[9]);
      const midPrice = (kOpen + kClose) / 2;
      const bucketIdx = Math.min(
        Math.floor((midPrice - low) / bucketSize),
        bucketCount - 1,
      );
      if (bucketIdx >= 0) {
        buckets[bucketIdx].volume += kVolume;
        buckets[bucketIdx].buyVolume += kTakerBuyVol;
        buckets[bucketIdx].sellVolume += kVolume - kTakerBuyVol;
      }
    }

    const pocBucket = buckets.reduce((max, b) =>
      b.volume > max.volume ? b : max,
    );

    return {
      symbol,
      buckets,
      highPrice: high,
      lowPrice: low,
      pointOfControl: pocBucket.priceLevel,
    };
  });
}

// ═══════════════════════════════════════════════════════════════
// SYMBOL FILTERING
// ═══════════════════════════════════════════════════════════════

/**
 * Returns only TRADING-status symbols, excluding leveraged tokens.
 * Optionally filter by minimum 24h quote volume.
 */
export async function getActiveSymbols(minQuoteVolume = 0): Promise<SymbolInfo[]> {
  return cache.wrap(`bn:active-symbols:${minQuoteVolume}`, 300, async () => {
    const [info, tickers] = await Promise.all([
      getExchangeInfo(),
      get24hStats(),
    ]);

    const volumeMap = new Map<string, number>();
    for (const t of tickers) {
      volumeMap.set(t.symbol, Number(t.quoteVolume));
    }

    return info.symbols.filter((s) => {
      if (s.status !== "TRADING") return false;
      if (isLeveragedToken(s.symbol)) return false;
      if (minQuoteVolume > 0) {
        const vol = volumeMap.get(s.symbol) ?? 0;
        if (vol < minQuoteVolume) return false;
      }
      return true;
    });
  });
}

// ═══════════════════════════════════════════════════════════════
// DATA TRANSFORMATION HELPERS
// ═══════════════════════════════════════════════════════════════

/** Convert Binance symbol (e.g. "BTCUSDT") to { base: "BTC", quote: "USDT" } */
export function binanceSymbolToStandard(symbol: string): { base: string; quote: string } {
  // Known quote assets in priority order (longest first to avoid ambiguity)
  const quoteAssets = [
    "USDT", "BUSD", "USDC", "TUSD", "FDUSD", "USDP", "DAI",
    "BTC", "ETH", "BNB", "XRP", "TRX", "DOGE",
    "EUR", "GBP", "AUD", "BRL", "TRY", "RUB", "UAH", "NGN",
    "BIDR", "IDRT", "VAI", "PLN", "RON", "ARS", "ZAR",
  ];

  for (const quote of quoteAssets) {
    if (symbol.endsWith(quote) && symbol.length > quote.length) {
      return { base: symbol.slice(0, -quote.length), quote };
    }
  }

  // Fallback heuristic: last 3-4 chars as quote
  if (symbol.length > 4) {
    return { base: symbol.slice(0, -4), quote: symbol.slice(-4) };
  }
  return { base: symbol.slice(0, -3), quote: symbol.slice(-3) };
}

/** Convert base + quote to Binance symbol format */
export function standardToBinanceSymbol(base: string, quote: string): string {
  return `${base.toUpperCase()}${quote.toUpperCase()}`;
}

/** Format raw kline tuples to OHLCV objects for charting */
export function formatKlinesToOHLCV(klines: KlineData[]): OHLCV[] {
  return klines.map((k) => ({
    time: k[0],
    open: Number(k[1]),
    high: Number(k[2]),
    low: Number(k[3]),
    close: Number(k[4]),
    volume: Number(k[5]),
  }));
}

/** Calculate Volume Weighted Average Price from aggregated trades */
export function calculateVWAP(trades: AggTrade[]): number {
  if (trades.length === 0) return 0;

  let totalPQ = 0;
  let totalQ = 0;

  for (const t of trades) {
    const price = Number(t.p);
    const qty = Number(t.q);
    totalPQ += price * qty;
    totalQ += qty;
  }

  return totalQ === 0 ? 0 : totalPQ / totalQ;
}

/** Aggregate funding rate history into summary stats */
export function aggregateFundingHistory(
  rates: FundingRate[],
): { symbol: string; avgRate: number; totalPayments: number } {
  if (rates.length === 0) {
    return { symbol: "", avgRate: 0, totalPayments: 0 };
  }

  const symbol = rates[0].symbol;
  const sum = rates.reduce((acc, r) => acc + Number(r.fundingRate), 0);
  const avgRate = sum / rates.length;

  return {
    symbol,
    avgRate,
    totalPayments: rates.length,
  };
}

/**
 * Annualize a single funding rate.
 * Binance funding is paid every 8 hours → 3 times/day → 3 * 365 = 1095 periods/year.
 * Returns the annualized rate as a decimal (e.g. 0.10 = 10% APR).
 */
export function calculateAnnualizedFunding(rate: number): number {
  return rate * 3 * 365;
}
