/**
 * Crypto Vision — Hyperliquid Data Source
 *
 * 100% free, no API key. POST-based JSON API.
 * https://api.hyperliquid.xyz
 *
 * Provides: perp market meta, mid prices, funding rates, open interest,
 *           recent trades, user state (public read).
 */

import { fetchJSON } from "../lib/fetcher.js";
import { cache } from "../lib/cache.js";

const BASE = "https://api.hyperliquid.xyz";

async function hlPost<T>(type: string, extra: Record<string, unknown> = {}): Promise<T> {
  return fetchJSON<T>(`${BASE}/info`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: { type, ...extra },
  });
}

// ─── Markets ─────────────────────────────────────────────────

export interface HLAssetCtx {
  funding: string;
  openInterest: string;
  prevDayPx: string;
  dayNtlVlm: string;
  premium: string;
  oraclePx: string;
  markPx: string;
  midPx: string;
  impactPxs: [string, string];
}

export interface HLMeta {
  universe: Array<{
    name: string;
    szDecimals: number;
    maxLeverage: number;
    onlyIsolated: boolean;
  }>;
}

export interface HLMetaAndAssetCtxs {
  meta: HLMeta;
  assetCtxs: HLAssetCtx[];
}

export function getMetaAndAssetCtxs(): Promise<[HLMeta, HLAssetCtx[]]> {
  return cache.wrap("hl:meta", 15, () =>
    hlPost<[HLMeta, HLAssetCtx[]]>("metaAndAssetCtxs")
  );
}

// ─── All Mid Prices ──────────────────────────────────────────

export function getAllMids(): Promise<Record<string, string>> {
  return cache.wrap("hl:mids", 10, () =>
    hlPost<Record<string, string>>("allMids")
  );
}

// ─── Funding History ─────────────────────────────────────────

export interface HLFundingHistory {
  coin: string;
  fundingRate: string;
  premium: string;
  time: number;
}

export function getFundingHistory(coin: string, startTime?: number): Promise<HLFundingHistory[]> {
  const start = startTime || Date.now() - 7 * 86400_000;
  return cache.wrap(`hl:fh:${coin}:${start}`, 60, () =>
    hlPost<HLFundingHistory[]>("fundingHistory", { coin, startTime: start })
  );
}

// ─── Recent Trades ───────────────────────────────────────────

export interface HLTrade {
  coin: string;
  side: string;
  px: string;
  sz: string;
  hash: string;
  time: number;
  tid: number;
}

export function getRecentTrades(coin: string): Promise<HLTrade[]> {
  return cache.wrap(`hl:trades:${coin}`, 10, () =>
    hlPost<HLTrade[]>("recentTrades", { coin })
  );
}

// ─── User State (public read) ────────────────────────────────

export interface HLUserState {
  marginSummary: {
    accountValue: string;
    totalNtlPos: string;
    totalRawUsd: string;
    totalMarginUsed: string;
  };
  assetPositions: Array<{
    position: {
      coin: string;
      szi: string;
      entryPx: string;
      positionValue: string;
      unrealizedPnl: string;
      leverage: { type: string; value: number };
    };
  }>;
}

export function getUserState(user: string): Promise<HLUserState> {
  return cache.wrap(`hl:user:${user}`, 30, () =>
    hlPost<HLUserState>("clearinghouseState", { user })
  );
}

// ─── L1 Stats ────────────────────────────────────────────────

export function getL1Stats(): Promise<any> {
  return cache.wrap("hl:l1", 60, () =>
    hlPost<any>("l2Book", { coin: "BTC" })
  );
}

// ─── Open Orders ─────────────────────────────────────────────

export function getOpenOrders(user: string): Promise<any[]> {
  return cache.wrap(`hl:orders:${user}`, 15, () =>
    hlPost<any[]>("openOrders", { user })
  );
}
