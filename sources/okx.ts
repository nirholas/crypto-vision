/**
 * Crypto Vision — OKX Data Source
 *
 * 100% free public endpoints, no API key.
 * https://www.okx.com/api/v5
 *
 * Provides: spot & swap tickers, orderbook, candles, funding rates,
 *           open interest, instruments list.
 */

import { fetchJSON } from "../lib/fetcher.js";
import { cache } from "../lib/cache.js";

const BASE = "https://www.okx.com/api/v5";

interface OKXResponse<T> {
  code: string;
  msg: string;
  data: T;
}

// ─── Tickers ─────────────────────────────────────────────────

export interface OKXTicker {
  instId: string;
  last: string;
  lastSz: string;
  askPx: string;
  askSz: string;
  bidPx: string;
  bidSz: string;
  open24h: string;
  high24h: string;
  low24h: string;
  vol24h: string;
  volCcy24h: string;
  ts: string;
  sodUtc0: string;
  sodUtc8: string;
}

export async function getSwapTickers(): Promise<OKXTicker[]> {
  return cache.wrap("okx:swap:tickers", 15, async () => {
    const res = await fetchJSON<OKXResponse<OKXTicker[]>>(
      `${BASE}/market/tickers?instType=SWAP`,
    );
    return res.data;
  });
}

export async function getSpotTickers(): Promise<OKXTicker[]> {
  return cache.wrap("okx:spot:tickers", 15, async () => {
    const res = await fetchJSON<OKXResponse<OKXTicker[]>>(
      `${BASE}/market/tickers?instType=SPOT`,
    );
    return res.data;
  });
}

export async function getTicker(instId: string): Promise<OKXTicker> {
  return cache.wrap(`okx:ticker:${instId}`, 10, async () => {
    const res = await fetchJSON<OKXResponse<OKXTicker[]>>(
      `${BASE}/market/ticker?instId=${instId}`,
    );
    return res.data[0];
  });
}

// ─── Orderbook ───────────────────────────────────────────────

export interface OKXOrderbook {
  asks: [string, string, string, string][];
  bids: [string, string, string, string][];
  ts: string;
}

export async function getOrderbook(instId: string, sz = "20"): Promise<OKXOrderbook> {
  return cache.wrap(`okx:ob:${instId}:${sz}`, 5, async () => {
    const res = await fetchJSON<OKXResponse<OKXOrderbook[]>>(
      `${BASE}/market/books?instId=${instId}&sz=${sz}`,
    );
    return res.data[0];
  });
}

// ─── Candles ─────────────────────────────────────────────────

export interface OKXCandle {
  ts: string;
  o: string;
  h: string;
  l: string;
  c: string;
  vol: string;
  volCcy: string;
  volCcyQuote: string;
  confirm: string;
}

export async function getCandles(
  instId: string,
  bar = "1H",
  limit = 100,
): Promise<OKXCandle[]> {
  return cache.wrap(`okx:candles:${instId}:${bar}:${limit}`, 30, async () => {
    const res = await fetchJSON<OKXResponse<string[][]>>(
      `${BASE}/market/candles?instId=${instId}&bar=${bar}&limit=${limit}`,
    );
    return res.data.map((c) => ({
      ts: c[0],
      o: c[1],
      h: c[2],
      l: c[3],
      c: c[4],
      vol: c[5],
      volCcy: c[6],
      volCcyQuote: c[7],
      confirm: c[8],
    }));
  });
}

// ─── Funding Rate ────────────────────────────────────────────

export interface OKXFundingRate {
  instId: string;
  fundingRate: string;
  nextFundingRate: string;
  fundingTime: string;
  nextFundingTime: string;
}

export async function getFundingRate(instId: string): Promise<OKXFundingRate> {
  return cache.wrap(`okx:fr:${instId}`, 30, async () => {
    const res = await fetchJSON<OKXResponse<OKXFundingRate[]>>(
      `${BASE}/public/funding-rate?instId=${instId}`,
    );
    return res.data[0];
  });
}

export async function getFundingHistory(instId: string, limit = 20): Promise<OKXFundingRate[]> {
  return cache.wrap(`okx:frh:${instId}:${limit}`, 60, async () => {
    const res = await fetchJSON<OKXResponse<OKXFundingRate[]>>(
      `${BASE}/public/funding-rate-history?instId=${instId}&limit=${limit}`,
    );
    return res.data;
  });
}

// ─── Open Interest ───────────────────────────────────────────

export interface OKXOpenInterest {
  instId: string;
  oi: string;
  oiCcy: string;
  ts: string;
}

export async function getOpenInterest(instType = "SWAP"): Promise<OKXOpenInterest[]> {
  return cache.wrap(`okx:oi:${instType}`, 30, async () => {
    const res = await fetchJSON<OKXResponse<OKXOpenInterest[]>>(
      `${BASE}/public/open-interest?instType=${instType}`,
    );
    return res.data;
  });
}

// ─── Instruments ─────────────────────────────────────────────

export interface OKXInstrument {
  instId: string;
  instType: string;
  uly: string;
  instFamily: string;
  baseCcy: string;
  quoteCcy: string;
  settleCcy: string;
  ctVal: string;
  ctMult: string;
  ctType: string;
  state: string;
  listTime: string;
  expTime: string;
  lever: string;
  tickSz: string;
  lotSz: string;
  minSz: string;
}

export async function getInstruments(instType = "SWAP"): Promise<OKXInstrument[]> {
  return cache.wrap(`okx:inst:${instType}`, 3600, async () => {
    const res = await fetchJSON<OKXResponse<OKXInstrument[]>>(
      `${BASE}/public/instruments?instType=${instType}`,
    );
    return res.data;
  });
}

// ─── Mark Price ──────────────────────────────────────────────

export async function getMarkPrice(instType = "SWAP", instId?: string): Promise<any[]> {
  const qs = instId ? `&instId=${instId}` : "";
  return cache.wrap(`okx:mark:${instType}:${instId || "all"}`, 10, async () => {
    const res = await fetchJSON<OKXResponse<any[]>>(
      `${BASE}/public/mark-price?instType=${instType}${qs}`,
    );
    return res.data;
  });
}
