/**
 * Crypto Vision — dYdX v4 Data Source
 *
 * 100% free public indexer, no API key.
 * https://indexer.dydx.trade/v4
 *
 * Provides: perpetual markets, candles, orderbook, trades,
 *           funding rates, sparklines.
 */

import { fetchJSON } from "../lib/fetcher.js";
import { cache } from "../lib/cache.js";
import { ingestDerivativesSnapshots, ingestOHLCCandles } from "../lib/bq-ingest.js";

const BASE = "https://indexer.dydx.trade/v4";

// ─── Markets ─────────────────────────────────────────────────

export interface DydxMarket {
  ticker: string;
  status: string;
  baseAsset: string;
  quoteAsset: string;
  oraclePrice: string;
  priceChange24H: string;
  volume24H: string;
  trades24H: number;
  nextFundingRate: string;
  initialMarginFraction: string;
  maintenanceMarginFraction: string;
  openInterest: string;
  atomicResolution: number;
  stepBaseQuantums: number;
  subticksPerTick: number;
}

export async function getMarkets(): Promise<{ markets: Record<string, DydxMarket> }> {
  const data = await cache.wrap("dydx:markets", 15, () =>
    fetchJSON<{ markets: Record<string, DydxMarket> }>(`${BASE}/perpetualMarkets`)
  );
  const markets = Object.values(data.markets);
  ingestDerivativesSnapshots(
    markets.map(m => ({
      symbol: m.ticker,
      openInterest: m.openInterest,
      fundingRate: m.nextFundingRate,
      volume24h: m.volume24H,
      exchange: "dydx",
    })),
    "dydx",
  );
  return data;
}

export async function getMarket(ticker: string): Promise<DydxMarket | null> {
  const data = await getMarkets();
  return data.markets[ticker] || null;
}

// ─── Candles ─────────────────────────────────────────────────

export interface DydxCandle {
  startedAt: string;
  ticker: string;
  resolution: string;
  low: string;
  high: string;
  open: string;
  close: string;
  baseTokenVolume: string;
  usdVolume: string;
  trades: number;
}

export async function getCandles(
  ticker: string,
  resolution = "1HOUR",
  limit = 100,
): Promise<{ candles: DydxCandle[] }> {
  const data = await cache.wrap(`dydx:candles:${ticker}:${resolution}:${limit}`, 30, () =>
    fetchJSON<{ candles: DydxCandle[] }>(`${BASE}/candles/perpetualMarkets/${ticker}?resolution=${resolution}&limit=${limit}`)
  );
  ingestOHLCCandles(
    ticker,
    data.candles.map(c => [new Date(c.startedAt).getTime(), Number(c.open), Number(c.high), Number(c.low), Number(c.close)] as [number, number, number, number, number]),
    "dydx",
  );
  return data;
}

// ─── Orderbook ───────────────────────────────────────────────

export interface DydxOrderbook {
  bids: Array<{ price: string; size: string }>;
  asks: Array<{ price: string; size: string }>;
}

export function getOrderbook(ticker: string): Promise<DydxOrderbook> {
  return cache.wrap(`dydx:ob:${ticker}`, 5, () =>
    fetchJSON(`${BASE}/orderbooks/perpetualMarket/${ticker}`)
  );
}

// ─── Trades ──────────────────────────────────────────────────

export interface DydxTrade {
  id: string;
  side: string;
  size: string;
  price: string;
  type: string;
  createdAt: string;
  createdAtHeight: string;
}

export function getTrades(
  ticker: string,
  limit = 50,
): Promise<{ trades: DydxTrade[] }> {
  return cache.wrap(`dydx:trades:${ticker}:${limit}`, 10, () =>
    fetchJSON(`${BASE}/trades/perpetualMarket/${ticker}?limit=${limit}`)
  );
}

// ─── Funding Rates ───────────────────────────────────────────

export interface DydxFundingRate {
  ticker: string;
  rate: string;
  price: string;
  effectiveAt: string;
  effectiveAtHeight: string;
}

export async function getFundingRates(
  ticker: string,
  limit = 50,
): Promise<{ historicalFunding: DydxFundingRate[] }> {
  const data = await cache.wrap(`dydx:funding:${ticker}:${limit}`, 60, () =>
    fetchJSON<{ historicalFunding: DydxFundingRate[] }>(`${BASE}/historicalFunding/${ticker}?limit=${limit}`)
  );
  if (data.historicalFunding.length > 0) {
    const latest = data.historicalFunding[0];
    ingestDerivativesSnapshots(
      [{ symbol: latest.ticker, fundingRate: latest.rate, exchange: "dydx" }],
      "dydx",
    );
  }
  return data;
}

// ─── Sparklines ──────────────────────────────────────────────

export function getSparklines(period = "ONE_DAY"): Promise<Record<string, string[]>> {
  return cache.wrap(`dydx:sparklines:${period}`, 60, () =>
    fetchJSON(`${BASE}/sparklines?timePeriod=${period}`)
  );
}
