/**
 * Crypto Vision — CoinGlass Data Source (Derivatives)
 *
 * Free tier: 100 req/day with COINGLASS_API_KEY.
 * No-key mode returns limited data.
 *
 * Provides: funding rates, open interest, liquidations,
 *           long/short ratios, derivatives overview.
 */

import { fetchJSON } from "../lib/fetcher.js";
import { cache } from "../lib/cache.js";
import { ingestDerivativesSnapshots } from "../lib/bq-ingest.js";

const API = "https://open-api-v3.coinglass.com/api";

function headers(): Record<string, string> {
  const key = process.env.COINGLASS_API_KEY;
  return key ? { "CG-API-KEY": key, accept: "application/json" } : { accept: "application/json" };
}

function glass<T>(path: string, ttl: number): Promise<T> {
  return cache.wrap(`glass:${path}`, ttl, () =>
    fetchJSON<T>(`${API}${path}`, { headers: headers() }),
  );
}

// ─── Funding Rates ───────────────────────────────────────────

export async function getFundingRates(symbol?: string): Promise<{
  code: string;
  data: Array<{
    symbol: string;
    uMarginList: Array<{
      exchangeName: string;
      rate: number;
      nextFundingTime: number;
    }>;
  }>;
}> {
  const q = symbol ? `?symbol=${symbol}` : "";
  const data = await glass<{
    code: string;
    data: Array<{
      symbol: string;
      uMarginList: Array<{ exchangeName: string; rate: number; nextFundingTime: number }>;
    }>;
  }>(`/futures/funding-rate${q}`, 300);
  const rows = data.data?.flatMap(d =>
    d.uMarginList?.map(e => ({ symbol: d.symbol, exchange: e.exchangeName, fundingRate: e.rate })) ?? [],
  ) ?? [];
  if (rows.length) ingestDerivativesSnapshots(rows, "coinglass");
  return data;
}

// ─── Open Interest ───────────────────────────────────────────

export async function getOpenInterest(symbol?: string): Promise<{
  code: string;
  data: Array<{
    symbol: string;
    openInterest: number;
    openInterestAmount: number;
    h1Change: number;
    h4Change: number;
    h24Change: number;
  }>;
}> {
  const q = symbol ? `?symbol=${symbol}` : "";
  const data = await glass<{
    code: string;
    data: Array<{ symbol: string; openInterest: number; openInterestAmount: number; h1Change: number; h4Change: number; h24Change: number }>;
  }>(`/futures/open-interest${q}`, 300);
  const rows = data.data?.map(d => ({ symbol: d.symbol, openInterest: d.openInterest })) ?? [];
  if (rows.length) ingestDerivativesSnapshots(rows, "coinglass");
  return data;
}

// ─── Liquidations ────────────────────────────────────────────

export async function getLiquidations(symbol?: string): Promise<{
  code: string;
  data: Array<{
    symbol: string;
    longLiquidationUsd: number;
    shortLiquidationUsd: number;
    h1LongLiquidationUsd: number;
    h1ShortLiquidationUsd: number;
    h4LongLiquidationUsd: number;
    h4ShortLiquidationUsd: number;
    h12LongLiquidationUsd: number;
    h12ShortLiquidationUsd: number;
    h24LongLiquidationUsd: number;
    h24ShortLiquidationUsd: number;
  }>;
}> {
  const q = symbol ? `?symbol=${symbol}` : "";
  const data = await glass<{
    code: string;
    data: Array<{
      symbol: string;
      longLiquidationUsd: number;
      shortLiquidationUsd: number;
      h1LongLiquidationUsd: number;
      h1ShortLiquidationUsd: number;
      h4LongLiquidationUsd: number;
      h4ShortLiquidationUsd: number;
      h12LongLiquidationUsd: number;
      h12ShortLiquidationUsd: number;
      h24LongLiquidationUsd: number;
      h24ShortLiquidationUsd: number;
    }>;
  }>(`/futures/liquidation/detail${q}`, 120);
  const rows = data.data?.map(d => ({
    symbol: d.symbol,
    liquidations: d.h24LongLiquidationUsd + d.h24ShortLiquidationUsd,
  })) ?? [];
  if (rows.length) ingestDerivativesSnapshots(rows, "coinglass");
  return data;
}

// ─── Long/Short Ratio ────────────────────────────────────────

export function getLongShortRatio(
  symbol: string,
  interval = "h1",
): Promise<{
  code: string;
  data: Array<{
    longRate: number;
    shortRate: number;
    longVolUsd: number;
    shortVolUsd: number;
    createTime: number;
  }>;
}> {
  return glass(
    `/futures/global-long-short-account-ratio/history?symbol=${symbol}&interval=${interval}`,
    300,
  );
}

// ─── Aggregated OI by Exchange ───────────────────────────────

export function getOIByExchange(symbol: string): Promise<{
  code: string;
  data: Array<{
    exchangeName: string;
    openInterest: number;
    openInterestAmount: number;
    volUsd: number;
    h24Change: number;
  }>;
}> {
  return glass(`/futures/open-interest/exchange-list?symbol=${symbol}`, 300);
}
