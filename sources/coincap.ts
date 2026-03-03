/**
 * Crypto Vision — CoinCap Extended Data Source
 *
 * 100% free, no API key.
 * https://api.coincap.io/v2
 *
 * Extends the existing CoinCap usage with: exchanges, exchange detail,
 * markets, rates (fiat currencies), candlestick data.
 */

import { fetchJSON } from "../lib/fetcher.js";
import { cache } from "../lib/cache.js";

const BASE = "https://api.coincap.io/v2";

// ─── Exchanges ───────────────────────────────────────────────

export interface CoinCapExchange {
  exchangeId: string;
  name: string;
  rank: string;
  percentTotalVolume: string;
  volumeUsd: string;
  tradingPairs: string;
  socket: boolean;
  exchangeUrl: string;
  updated: number;
}

export function getExchanges(): Promise<{ data: CoinCapExchange[] }> {
  return cache.wrap("coincap:exchanges", 300, () =>
    fetchJSON(`${BASE}/exchanges`)
  );
}

export function getExchange(id: string): Promise<{ data: CoinCapExchange }> {
  return cache.wrap(`coincap:exchange:${id}`, 300, () =>
    fetchJSON(`${BASE}/exchanges/${id}`)
  );
}

// ─── Markets ─────────────────────────────────────────────────

export interface CoinCapMarket {
  exchangeId: string;
  rank: string;
  baseSymbol: string;
  baseId: string;
  quoteSymbol: string;
  quoteId: string;
  priceQuote: string;
  priceUsd: string;
  volumeUsd24Hr: string;
  percentExchangeVolume: string;
  tradesCount24Hr: string;
  updated: number;
}

export function getMarkets(
  exchangeId?: string,
  baseId?: string,
  limit = 100,
): Promise<{ data: CoinCapMarket[] }> {
  const params = new URLSearchParams();
  if (exchangeId) params.set("exchangeId", exchangeId);
  if (baseId) params.set("baseId", baseId);
  params.set("limit", String(limit));
  const key = `coincap:markets:${exchangeId || "all"}:${baseId || "all"}:${limit}`;
  return cache.wrap(key, 120, () =>
    fetchJSON(`${BASE}/markets?${params}`)
  );
}

// ─── Rates (Fiat + Crypto) ───────────────────────────────────

export interface CoinCapRate {
  id: string;
  symbol: string;
  currencySymbol: string;
  type: string;
  rateUsd: string;
}

export function getRates(): Promise<{ data: CoinCapRate[] }> {
  return cache.wrap("coincap:rates", 120, () =>
    fetchJSON(`${BASE}/rates`)
  );
}

export function getRate(id: string): Promise<{ data: CoinCapRate }> {
  return cache.wrap(`coincap:rate:${id}`, 120, () =>
    fetchJSON(`${BASE}/rates/${id}`)
  );
}

// ─── Candles ─────────────────────────────────────────────────

export interface CoinCapCandle {
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  period: number;
}

export function getCandles(
  exchangeId: string,
  baseId: string,
  quoteId: string,
  interval = "h1",
): Promise<{ data: CoinCapCandle[] }> {
  const start = Date.now() - 7 * 86400_000;
  const end = Date.now();
  return cache.wrap(`coincap:candles:${exchangeId}:${baseId}:${quoteId}:${interval}`, 120, () =>
    fetchJSON(
      `${BASE}/candles?exchange=${exchangeId}&baseId=${baseId}&quoteId=${quoteId}&interval=${interval}&start=${start}&end=${end}`,
    )
  );
}
