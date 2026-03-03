/**
 * Crypto Vision — Deribit Data Source
 *
 * 100% free public endpoints, no API key.
 * https://www.deribit.com/api/v2/public
 *
 * Provides: options chain, volatility index, index prices,
 *           instruments, funding rates, order books.
 */

import { fetchJSON } from "../lib/fetcher.js";
import { cache } from "../lib/cache.js";
import { ingestDerivativesSnapshots } from "../lib/bq-ingest.js";

const BASE = "https://www.deribit.com/api/v2/public";

interface DeribitResponse<T> {
  jsonrpc: string;
  result: T;
}

async function deribit<T>(path: string, params: Record<string, string | number | boolean> = {}): Promise<T> {
  const qs = Object.entries(params)
    .map(([k, v]) => `${k}=${v}`)
    .join("&");
  const url = `${BASE}/${path}${qs ? `?${qs}` : ""}`;
  const res = await fetchJSON<DeribitResponse<T>>(url);
  return res.result;
}

// ─── Index Prices ────────────────────────────────────────────

export interface DeribitIndex {
  indexPrice: number;
  estimatedDeliveryPrice: number;
}

export function getIndexPrice(currency: string): Promise<DeribitIndex> {
  return cache.wrap(`deribit:idx:${currency}`, 15, () =>
    deribit<DeribitIndex>("get_index_price", { index_name: `${currency.toLowerCase()}_usd` })
  );
}

// ─── Instruments ─────────────────────────────────────────────

export interface DeribitInstrument {
  instrument_name: string;
  kind: string;
  base_currency: string;
  quote_currency: string;
  strike: number;
  option_type: string;
  expiration_timestamp: number;
  creation_timestamp: number;
  tick_size: number;
  min_trade_amount: number;
  is_active: boolean;
  settlement_period: string;
}

export function getInstruments(
  currency: string,
  kind = "option",
  expired = false,
): Promise<DeribitInstrument[]> {
  return cache.wrap(`deribit:inst:${currency}:${kind}`, 300, () =>
    deribit<DeribitInstrument[]>("get_instruments", { currency: currency.toUpperCase(), kind, expired })
  );
}

// ─── Options Summary ─────────────────────────────────────────

export interface DeribitBookSummary {
  instrument_name: string;
  underlying_index: string;
  underlying_price: number;
  mark_price: number;
  mark_iv: number;
  bid_price: number;
  ask_price: number;
  open_interest: number;
  volume: number;
  volume_usd: number;
  interest_rate: number;
  creation_timestamp: number;
}

export async function getBookSummary(currency: string, kind = "option"): Promise<DeribitBookSummary[]> {
  const data = await cache.wrap(`deribit:booksummary:${currency}:${kind}`, 30, () =>
    deribit<DeribitBookSummary[]>("get_book_summary_by_currency", { currency: currency.toUpperCase(), kind })
  );
  if (kind === "future") {
    ingestDerivativesSnapshots(
      data.map(d => ({
        symbol: d.instrument_name,
        openInterest: d.open_interest,
        volume24h: d.volume_usd,
        exchange: "deribit",
      })),
      "deribit",
    );
  }
  return data;
}

// ─── Volatility Index ────────────────────────────────────────

export interface DeribitVolatility {
  data: [number, number][];
  continuation: number;
}

export function getVolatilityIndex(
  currency: string,
  resolution = 3600,
  count = 24,
): Promise<DeribitVolatility> {
  const end = Date.now();
  const start = end - count * resolution * 1000;
  return cache.wrap(`deribit:dvol:${currency}:${resolution}:${count}`, 60, () =>
    deribit<DeribitVolatility>("get_volatility_index_data", {
      currency: currency.toUpperCase(),
      resolution,
      start_timestamp: start,
      end_timestamp: end,
    })
  );
}

// ─── Funding Rate ────────────────────────────────────────────

export interface DeribitFundingRate {
  current_funding: number;
  funding_8h: number;
  index_price: number;
}

export async function getFundingRate(instrument: string): Promise<DeribitFundingRate> {
  const data = await cache.wrap(`deribit:fr:${instrument}`, 30, () =>
    deribit<DeribitFundingRate>("get_funding_rate_value", {
      instrument_name: instrument,
      start_timestamp: Date.now() - 3600_000,
      end_timestamp: Date.now(),
    })
  );
  ingestDerivativesSnapshots(
    [{ symbol: instrument, fundingRate: data.current_funding, exchange: "deribit" }],
    "deribit",
  );
  return data;
}

// ─── Order Book ──────────────────────────────────────────────

export interface DeribitOrderbook {
  instrument_name: string;
  bids: [number, number][];
  asks: [number, number][];
  best_bid_price: number;
  best_ask_price: number;
  mark_price: number;
  open_interest: number;
  last_price: number;
  underlying_price: number;
  underlying_index: string;
  state: string;
  timestamp: number;
}

export function getOrderbook(instrument: string, depth = 10): Promise<DeribitOrderbook> {
  return cache.wrap(`deribit:ob:${instrument}:${depth}`, 5, () =>
    deribit<DeribitOrderbook>("get_order_book", { instrument_name: instrument, depth })
  );
}

// ─── Historical Volatility ───────────────────────────────────

export function getHistoricalVolatility(currency: string): Promise<[number, number][]> {
  return cache.wrap(`deribit:hvol:${currency}`, 300, () =>
    deribit<[number, number][]>("get_historical_volatility", { currency: currency.toUpperCase() })
  );
}

// ─── Currencies ──────────────────────────────────────────────

export function getCurrencies(): Promise<any[]> {
  return cache.wrap("deribit:currencies", 3600, () =>
    deribit<any[]>("get_currencies")
  );
}
