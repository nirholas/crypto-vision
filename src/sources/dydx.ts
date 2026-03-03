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

export function getMarkets(): Promise<{ markets: Record<string, DydxMarket> }> {
  return cache.wrap("dydx:markets", 15, () =>
    fetchJSON(`${BASE}/perpetualMarkets`)
  );
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

export function getCandles(
  ticker: string,
  resolution = "1HOUR",
  limit = 100,
): Promise<{ candles: DydxCandle[] }> {
  return cache.wrap(`dydx:candles:${ticker}:${resolution}:${limit}`, 30, () =>
    fetchJSON(`${BASE}/candles/perpetualMarkets/${ticker}?resolution=${resolution}&limit=${limit}`)
  );
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

export function getFundingRates(
  ticker: string,
  limit = 50,
): Promise<{ historicalFunding: DydxFundingRate[] }> {
  return cache.wrap(`dydx:funding:${ticker}:${limit}`, 60, () =>
    fetchJSON(`${BASE}/historicalFunding/${ticker}?limit=${limit}`)
  );
}

// ─── Sparklines ──────────────────────────────────────────────

export function getSparklines(period = "ONE_DAY"): Promise<Record<string, string[]>> {
  return cache.wrap(`dydx:sparklines:${period}`, 60, () =>
    fetchJSON(`${BASE}/sparklines?timePeriod=${period}`)
  );
}
