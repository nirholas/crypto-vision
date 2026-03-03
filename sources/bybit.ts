/**
 * Crypto Vision — Bybit Data Source
 *
 * 100% free, no API key. Public market endpoints.
 * https://api.bybit.com/v5
 *
 * Provides: spot & perp tickers, orderbook, klines, funding rates,
 *           open interest, recent trades.
 */

import { fetchJSON } from "../lib/fetcher.js";
import { cache } from "../lib/cache.js";

const BASE = "https://api.bybit.com/v5";

interface BybitResponse<T> {
  retCode: number;
  retMsg: string;
  result: T;
}

// ─── Tickers ─────────────────────────────────────────────────

export interface BybitTicker {
  symbol: string;
  lastPrice: string;
  indexPrice: string;
  markPrice: string;
  prevPrice24h: string;
  price24hPcnt: string;
  highPrice24h: string;
  lowPrice24h: string;
  turnover24h: string;
  volume24h: string;
  fundingRate: string;
  nextFundingTime: string;
  openInterest: string;
  openInterestValue: string;
  bid1Price: string;
  ask1Price: string;
}

export async function getLinearTickers(symbol?: string): Promise<BybitTicker[]> {
  const qs = symbol ? `&symbol=${symbol.toUpperCase()}USDT` : "";
  return cache.wrap(`bybit:linear:${symbol || "all"}`, 15, async () => {
    const res = await fetchJSON<BybitResponse<{ list: BybitTicker[] }>>(
      `${BASE}/market/tickers?category=linear${qs}`,
    );
    return res.result.list;
  });
}

export async function getSpotTickers(symbol?: string): Promise<BybitTicker[]> {
  const qs = symbol ? `&symbol=${symbol.toUpperCase()}USDT` : "";
  return cache.wrap(`bybit:spot:${symbol || "all"}`, 15, async () => {
    const res = await fetchJSON<BybitResponse<{ list: BybitTicker[] }>>(
      `${BASE}/market/tickers?category=spot${qs}`,
    );
    return res.result.list;
  });
}

// ─── Orderbook ───────────────────────────────────────────────

export interface BybitOrderbook {
  s: string;
  b: [string, string][];
  a: [string, string][];
  ts: number;
  u: number;
}

export async function getOrderbook(
  symbol: string,
  category = "linear",
  limit = 25,
): Promise<BybitOrderbook> {
  return cache.wrap(`bybit:ob:${category}:${symbol}:${limit}`, 5, async () => {
    const res = await fetchJSON<BybitResponse<BybitOrderbook>>(
      `${BASE}/market/orderbook?category=${category}&symbol=${symbol.toUpperCase()}&limit=${limit}`,
    );
    return res.result;
  });
}

// ─── Klines ──────────────────────────────────────────────────

export interface BybitKline {
  startTime: string;
  openPrice: string;
  highPrice: string;
  lowPrice: string;
  closePrice: string;
  volume: string;
  turnover: string;
}

export async function getKlines(
  symbol: string,
  interval = "60",
  limit = 100,
  category = "linear",
): Promise<BybitKline[]> {
  return cache.wrap(`bybit:kl:${category}:${symbol}:${interval}:${limit}`, 30, async () => {
    const res = await fetchJSON<BybitResponse<{ list: string[][] }>>(
      `${BASE}/market/kline?category=${category}&symbol=${symbol.toUpperCase()}&interval=${interval}&limit=${limit}`,
    );
    return res.result.list.map((k) => ({
      startTime: k[0],
      openPrice: k[1],
      highPrice: k[2],
      lowPrice: k[3],
      closePrice: k[4],
      volume: k[5],
      turnover: k[6],
    }));
  });
}

// ─── Funding Rate ────────────────────────────────────────────

export interface BybitFundingRate {
  symbol: string;
  fundingRate: string;
  fundingRateTimestamp: string;
}

export async function getFundingHistory(
  symbol: string,
  limit = 20,
): Promise<BybitFundingRate[]> {
  return cache.wrap(`bybit:fh:${symbol}:${limit}`, 60, async () => {
    const res = await fetchJSON<BybitResponse<{ list: BybitFundingRate[] }>>(
      `${BASE}/market/funding/history?category=linear&symbol=${symbol.toUpperCase()}&limit=${limit}`,
    );
    return res.result.list;
  });
}

// ─── Open Interest ───────────────────────────────────────────

export interface BybitOpenInterest {
  symbol: string;
  openInterest: string;
  timestamp: string;
}

export async function getOpenInterest(
  symbol: string,
  intervalTime = "5min",
  limit = 50,
): Promise<BybitOpenInterest[]> {
  return cache.wrap(`bybit:oi:${symbol}:${intervalTime}:${limit}`, 30, async () => {
    const res = await fetchJSON<BybitResponse<{ list: BybitOpenInterest[] }>>(
      `${BASE}/market/open-interest?category=linear&symbol=${symbol.toUpperCase()}&intervalTime=${intervalTime}&limit=${limit}`,
    );
    return res.result.list;
  });
}

// ─── Recent Trades ───────────────────────────────────────────

export interface BybitTrade {
  execId: string;
  symbol: string;
  price: string;
  size: string;
  side: string;
  time: string;
  isBlockTrade: boolean;
}

export async function getRecentTrades(
  symbol: string,
  category = "linear",
  limit = 50,
): Promise<BybitTrade[]> {
  return cache.wrap(`bybit:trades:${category}:${symbol}:${limit}`, 10, async () => {
    const res = await fetchJSON<BybitResponse<{ list: BybitTrade[] }>>(
      `${BASE}/market/recent-trade?category=${category}&symbol=${symbol.toUpperCase()}&limit=${limit}`,
    );
    return res.result.list;
  });
}

// ─── Insurance Fund ──────────────────────────────────────────

export async function getInsuranceFund(coin = "USDT"): Promise<any> {
  return cache.wrap(`bybit:insurance:${coin}`, 300, async () => {
    const res = await fetchJSON<BybitResponse<any>>(
      `${BASE}/market/insurance?coin=${coin}`,
    );
    return res.result;
  });
}

// ─── Risk Limit ──────────────────────────────────────────────

export async function getRiskLimit(symbol: string): Promise<any> {
  return cache.wrap(`bybit:risk:${symbol}`, 300, async () => {
    const res = await fetchJSON<BybitResponse<any>>(
      `${BASE}/market/risk-limit?category=linear&symbol=${symbol.toUpperCase()}`,
    );
    return res.result;
  });
}
