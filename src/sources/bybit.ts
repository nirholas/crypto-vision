/**
 * Crypto Vision — ByBit Data Source (v5 Unified API)
 *
 * 100% free public endpoints, no API key.
 * https://api.bybit.com/v5
 *
 * Provides: spot & derivatives tickers, orderbook, klines, funding rates,
 *           open interest, recent trades, insurance fund, risk limits,
 *           long/short ratio, historical volatility, mark/index price klines,
 *           instruments info, and analytics (top movers, basis, OI aggregation).
 *
 * Rate limit: 120 req/min for public endpoints.
 */

import { z } from "zod";
import { fetchJSON } from "../lib/fetcher.js";
import { cache } from "../lib/cache.js";
import { ingestDerivativesSnapshots, ingestOHLCCandles } from "../lib/bq-ingest.js";

const BASE = "https://api.bybit.com/v5";

// ─── ByBit v5 Response Wrapper ───────────────────────────────

const BybitResponseSchema = z.object({
  retCode: z.number(),
  retMsg: z.string(),
  time: z.number().optional(),
});

/**
 * Unified ByBit v5 fetch wrapper.
 * Constructs URL from path + params, unwraps the result
 * envelope, and throws on non-zero retCode.
 */
async function bybitFetch<T>(
  path: string,
  params?: Record<string, string | number>,
  ttl?: number,
): Promise<T> {
  const searchParams = new URLSearchParams();
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== "") {
        searchParams.set(k, String(v));
      }
    }
  }
  const qs = searchParams.toString();
  const url = `${BASE}${path}${qs ? `?${qs}` : ""}`;
  const cacheKey = `bybit:${path}:${qs}`;

  const fetcher = async () => {
    const raw = await fetchJSON<Record<string, unknown>>(url);
    const envelope = BybitResponseSchema.safeParse(raw);
    if (!envelope.success) {
      throw new Error(`ByBit: unexpected response shape from ${path}`);
    }
    if (envelope.data.retCode !== 0) {
      throw new Error(
        `ByBit API error [${envelope.data.retCode}]: ${envelope.data.retMsg}`,
      );
    }
    return (raw as { result: T }).result;
  };

  if (ttl !== undefined && ttl > 0) {
    return cache.wrap(cacheKey, ttl, fetcher);
  }
  return fetcher();
}

// ─── Category Type ───────────────────────────────────────────

export type BybitCategory = "linear" | "inverse" | "option" | "spot";

// ─── Zod Schemas ─────────────────────────────────────────────

export const BybitTickerSchema = z.object({
  symbol: z.string(),
  lastPrice: z.string(),
  highPrice24h: z.string(),
  lowPrice24h: z.string(),
  turnover24h: z.string(),
  volume24h: z.string(),
  bid1Price: z.string(),
  ask1Price: z.string(),
  prevPrice24h: z.string(),
  price24hPcnt: z.string(),
  markPrice: z.string().optional().default(""),
  indexPrice: z.string().optional().default(""),
  openInterestValue: z.string().optional().default(""),
  fundingRate: z.string().optional().default(""),
  nextFundingTime: z.string().optional().default(""),
});
export type BybitTicker = z.infer<typeof BybitTickerSchema>;

export const BybitKlineSchema = z.object({
  startTime: z.string(),
  openPrice: z.string(),
  highPrice: z.string(),
  lowPrice: z.string(),
  closePrice: z.string(),
  volume: z.string(),
  turnover: z.string(),
});
export type BybitKline = z.infer<typeof BybitKlineSchema>;

export const BybitOrderBookSchema = z.object({
  s: z.string(),
  b: z.array(z.tuple([z.string(), z.string()])),
  a: z.array(z.tuple([z.string(), z.string()])),
  ts: z.number(),
  u: z.number(),
});
export type BybitOrderBook = z.infer<typeof BybitOrderBookSchema>;

export const BybitTradeSchema = z.object({
  execId: z.string(),
  symbol: z.string(),
  price: z.string(),
  size: z.string(),
  side: z.string(),
  time: z.string(),
  isBlockTrade: z.boolean(),
});
export type BybitTrade = z.infer<typeof BybitTradeSchema>;

export const BybitInstrumentInfoSchema = z.object({
  symbol: z.string(),
  contractType: z.string().optional().default(""),
  status: z.string(),
  baseCoin: z.string(),
  quoteCoin: z.string(),
  settleCoin: z.string().optional().default(""),
  lotSizeFilter: z.object({
    basePrecision: z.string().optional().default(""),
    quotePrecision: z.string().optional().default(""),
    minOrderQty: z.string().optional().default(""),
    maxOrderQty: z.string().optional().default(""),
    minOrderAmt: z.string().optional().default(""),
    maxOrderAmt: z.string().optional().default(""),
  }).passthrough().optional(),
  priceFilter: z.object({
    tickSize: z.string().optional().default(""),
    minPrice: z.string().optional().default(""),
    maxPrice: z.string().optional().default(""),
  }).passthrough().optional(),
  leverageFilter: z.object({
    minLeverage: z.string().optional().default(""),
    maxLeverage: z.string().optional().default(""),
    leverageStep: z.string().optional().default(""),
  }).passthrough().optional(),
  fundingInterval: z.number().optional(),
});
export type BybitInstrumentInfo = z.infer<typeof BybitInstrumentInfoSchema>;

export const BybitOpenInterestSchema = z.object({
  symbol: z.string(),
  openInterest: z.string(),
  timestamp: z.string(),
});
export type BybitOpenInterest = z.infer<typeof BybitOpenInterestSchema>;

export const BybitInsuranceSchema = z.object({
  coin: z.string(),
  balance: z.string(),
  value: z.string().optional().default(""),
});
export type BybitInsurance = z.infer<typeof BybitInsuranceSchema>;

export const BybitRiskLimitSchema = z.object({
  id: z.number(),
  symbol: z.string(),
  limit: z.string(),
  maintainMargin: z.string(),
  initialMargin: z.string(),
  maxLeverage: z.string(),
});
export type BybitRiskLimit = z.infer<typeof BybitRiskLimitSchema>;

export const BybitLongShortRatioSchema = z.object({
  buyRatio: z.string(),
  sellRatio: z.string(),
  timestamp: z.string(),
});
export type BybitLongShortRatio = z.infer<typeof BybitLongShortRatioSchema>;

export const BybitFundingRateSchema = z.object({
  symbol: z.string(),
  fundingRate: z.string(),
  fundingRateTimestamp: z.string(),
});
export type BybitFundingRate = z.infer<typeof BybitFundingRateSchema>;

export const BybitHistoricalVolatilitySchema = z.object({
  period: z.number().optional(),
  value: z.string(),
  time: z.string(),
});
export type BybitHistoricalVolatility = z.infer<typeof BybitHistoricalVolatilitySchema>;

// ─── Spot & Market Functions ─────────────────────────────────

/**
 * Get tickers for a given category (spot, linear, inverse, option).
 * Optionally filter by symbol.
 */
export async function getTickers(
  category: BybitCategory,
  symbol?: string,
): Promise<BybitTicker[]> {
  const params: Record<string, string> = { category };
  if (symbol) params.symbol = symbol.toUpperCase();

  const result = await bybitFetch<{ list: unknown[] }>(
    "/market/tickers",
    params,
    15,
  );
  const data = z.array(BybitTickerSchema).parse(result.list);
  if (category === "linear" || category === "inverse") {
    ingestDerivativesSnapshots(
      data.map(t => ({
        symbol: t.symbol,
        openInterest: t.openInterestValue,
        fundingRate: t.fundingRate,
        volume24h: t.turnover24h,
        exchange: "bybit",
      })),
      "bybit",
    );
  }
  return data;
}

/**
 * Get OHLCV kline data.
 * Interval: 1,3,5,15,30,60,120,240,360,720,D,M,W
 */
export async function getKlines(
  category: BybitCategory,
  symbol: string,
  interval: string,
  limit = 200,
): Promise<BybitKline[]> {
  const result = await bybitFetch<{ list: string[][] }>(
    "/market/kline",
    { category, symbol: symbol.toUpperCase(), interval, limit },
    30,
  );
  return result.list.map((k) =>
    BybitKlineSchema.parse({
      startTime: k[0],
      openPrice: k[1],
      highPrice: k[2],
      lowPrice: k[3],
      closePrice: k[4],
      volume: k[5],
      turnover: k[6],
    }),
  );
}

/**
 * Get order book depth.
 */
export async function getOrderBook(
  category: BybitCategory,
  symbol: string,
  limit = 25,
): Promise<BybitOrderBook> {
  const result = await bybitFetch<unknown>(
    "/market/orderbook",
    { category, symbol: symbol.toUpperCase(), limit },
    5,
  );
  return BybitOrderBookSchema.parse(result);
}

/**
 * Get recent trades.
 */
export async function getRecentTrades(
  category: BybitCategory,
  symbol: string,
  limit = 60,
): Promise<BybitTrade[]> {
  const result = await bybitFetch<{ list: unknown[] }>(
    "/market/recent-trade",
    { category, symbol: symbol.toUpperCase(), limit },
    10,
  );
  return z.array(BybitTradeSchema).parse(result.list);
}

/**
 * Get instruments info for a category, optionally filtering by symbol.
 */
export async function getInstrumentsInfo(
  category: BybitCategory,
  symbol?: string,
): Promise<BybitInstrumentInfo[]> {
  const params: Record<string, string> = { category };
  if (symbol) params.symbol = symbol.toUpperCase();

  const result = await bybitFetch<{ list: unknown[] }>(
    "/market/instruments-info",
    params,
    600,
  );
  return z.array(BybitInstrumentInfoSchema).parse(result.list);
}

/**
 * Get mark price klines.
 */
export async function getMarkPriceKline(
  category: BybitCategory,
  symbol: string,
  interval: string,
  limit = 200,
): Promise<BybitKline[]> {
  const result = await bybitFetch<{ list: string[][] }>(
    "/market/mark-price-kline",
    { category, symbol: symbol.toUpperCase(), interval, limit },
    30,
  );
  return result.list.map((k) =>
    BybitKlineSchema.parse({
      startTime: k[0],
      openPrice: k[1],
      highPrice: k[2],
      lowPrice: k[3],
      closePrice: k[4],
      volume: "0",
      turnover: "0",
    }),
  );
}

/**
 * Get index price klines.
 */
export async function getIndexPriceKline(
  category: BybitCategory,
  symbol: string,
  interval: string,
  limit = 200,
): Promise<BybitKline[]> {
  const result = await bybitFetch<{ list: string[][] }>(
    "/market/index-price-kline",
    { category, symbol: symbol.toUpperCase(), interval, limit },
    30,
  );
  return result.list.map((k) =>
    BybitKlineSchema.parse({
      startTime: k[0],
      openPrice: k[1],
      highPrice: k[2],
      lowPrice: k[3],
      closePrice: k[4],
      volume: "0",
      turnover: "0",
    }),
  );
}

// ─── Derivatives Functions ───────────────────────────────────

/**
 * Get open interest for a derivative symbol.
 * intervalTime: 5min, 15min, 30min, 1h, 4h, 1d
 */
export async function getOpenInterest(
  category: BybitCategory,
  symbol: string,
  intervalTime: string,
  limit = 50,
): Promise<BybitOpenInterest[]> {
  const result = await bybitFetch<{ list: unknown[] }>(
    "/market/open-interest",
    { category, symbol: symbol.toUpperCase(), intervalTime, limit },
    30,
  );
  const data = z.array(BybitOpenInterestSchema).parse(result.list);
  ingestDerivativesSnapshots(
    data.map(d => ({ symbol: d.symbol, openInterest: d.openInterest, exchange: "bybit" })),
    "bybit",
  );
  return data;
}

/**
 * Get historical volatility (options only).
 * period: 7, 14, 21, 30, 60, 90, 180, 270
 */
export async function getHistoricalVolatility(
  category: BybitCategory,
  period?: number,
): Promise<BybitHistoricalVolatility[]> {
  const params: Record<string, string | number> = { category };
  if (period) params.period = period;

  const result = await bybitFetch<unknown[]>(
    "/market/historical-volatility",
    params,
    120,
  );
  return z.array(BybitHistoricalVolatilitySchema).parse(result);
}

/**
 * Get insurance fund balance.
 */
export async function getInsurance(
  coin?: string,
): Promise<BybitInsurance[]> {
  const params: Record<string, string> = {};
  if (coin) params.coin = coin.toUpperCase();

  const result = await bybitFetch<{ updatedTime: string; list: unknown[] }>(
    "/market/insurance",
    params,
    300,
  );
  return z.array(BybitInsuranceSchema).parse(result.list);
}

/**
 * Get risk limits for a derivative instrument.
 */
export async function getRiskLimit(
  category: BybitCategory,
  symbol?: string,
): Promise<BybitRiskLimit[]> {
  const params: Record<string, string> = { category };
  if (symbol) params.symbol = symbol.toUpperCase();

  const result = await bybitFetch<{ list: unknown[] }>(
    "/market/risk-limit",
    params,
    600,
  );
  return z.array(BybitRiskLimitSchema).parse(result.list);
}

/**
 * Get funding rate history for linear/inverse perpetuals.
 */
export async function getFundingRateHistory(
  category: BybitCategory,
  symbol: string,
  limit = 200,
): Promise<BybitFundingRate[]> {
  const result = await bybitFetch<{ list: unknown[] }>(
    "/market/funding/history",
    { category, symbol: symbol.toUpperCase(), limit },
    60,
  );
  const data = z.array(BybitFundingRateSchema).parse(result.list);
  ingestDerivativesSnapshots(
    data.map(d => ({ symbol: d.symbol, fundingRate: d.fundingRate, exchange: "bybit" })),
    "bybit",
  );
  return data;
}

/**
 * Get long/short ratio (account ratio).
 * period: 5min, 15min, 30min, 1h, 4h, 1d
 */
export async function getLongShortRatio(
  category: BybitCategory,
  symbol: string,
  period: string,
  limit = 50,
): Promise<BybitLongShortRatio[]> {
  const result = await bybitFetch<{ list: unknown[] }>(
    "/market/account-ratio",
    { category, symbol: symbol.toUpperCase(), period, limit },
    60,
  );
  const data = z.array(BybitLongShortRatioSchema).parse(result.list);
  if (data.length > 0) {
    ingestDerivativesSnapshots(
      [{ symbol, longShortRatio: Number(data[0].buyRatio) / Math.max(Number(data[0].sellRatio), 0.0001), exchange: "bybit" }],
      "bybit",
    );
  }
  return data;
}

// ─── Analytics Functions ─────────────────────────────────────

/**
 * Get top price movers from ByBit linear perpetuals.
 * Returns the top gainers and losers by 24h price change percent.
 */
export async function getTopMoversBybit(
  limit = 10,
): Promise<{ gainers: BybitTicker[]; losers: BybitTicker[] }> {
  const tickers = await getTickers("linear");

  const sorted = [...tickers].sort(
    (a, b) => Number(b.price24hPcnt) - Number(a.price24hPcnt),
  );

  return {
    gainers: sorted.slice(0, limit),
    losers: sorted.slice(-limit).reverse(),
  };
}

/**
 * Get tickers with the highest absolute funding rates.
 * High funding rates indicate leveraged positioning.
 */
export function getHighestFundingRates(
  tickers: BybitTicker[],
  limit = 20,
): BybitTicker[] {
  return [...tickers]
    .filter((t) => t.fundingRate && t.fundingRate !== "" && t.fundingRate !== "0")
    .sort(
      (a, b) =>
        Math.abs(Number(b.fundingRate)) - Math.abs(Number(a.fundingRate)),
    )
    .slice(0, limit);
}

/**
 * Calculate the spot-futures basis (premium/discount) between a spot ticker
 * and a futures ticker for the same underlying.
 *
 * Returns:
 *  - basis: absolute price difference as a percentage
 *  - annualized: annualized basis assuming 365 days
 */
export function calculateSpotFuturesBasis(
  spotTicker: BybitTicker,
  futuresTicker: BybitTicker,
): { basis: number; annualized: number } {
  const spotPrice = Number(spotTicker.lastPrice);
  const futuresPrice = Number(futuresTicker.lastPrice);

  if (spotPrice === 0) {
    return { basis: 0, annualized: 0 };
  }

  const basis = ((futuresPrice - spotPrice) / spotPrice) * 100;

  // Annualize using perpetual funding cycle (8h) as proxy
  // 365 days * 3 funding periods per day = 1095 periods
  const annualized = basis * 1095;

  return {
    basis: Math.round(basis * 10000) / 10000,
    annualized: Math.round(annualized * 100) / 100,
  };
}

/**
 * Aggregate open interest across tickers.
 * Returns total OI value and the top symbols by OI.
 */
export function aggregateOI(
  tickers: BybitTicker[],
  limit = 20,
): { totalOI: number; topByOI: { symbol: string; oi: number }[] } {
  const withOI = tickers
    .filter((t) => t.openInterestValue && Number(t.openInterestValue) > 0)
    .map((t) => ({
      symbol: t.symbol,
      oi: Number(t.openInterestValue),
    }))
    .sort((a, b) => b.oi - a.oi);

  const totalOI = withOI.reduce((sum, item) => sum + item.oi, 0);

  return {
    totalOI: Math.round(totalOI * 100) / 100,
    topByOI: withOI.slice(0, limit),
  };
}
