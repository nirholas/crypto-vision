/**
 * Crypto Vision — Messari Data Source
 *
 * Free tier: 20 req/min (no key), enhanced with MESSARI_API_KEY.
 *
 * Provides: asset profiles, comprehensive metrics, market data,
 *           ROI calculations, on-chain data, developer activity.
 */

import { fetchJSON } from "../lib/fetcher.js";
import { cache } from "../lib/cache.js";

const API = "https://data.messari.io/api";

function headers(): Record<string, string> {
  const key = process.env.MESSARI_API_KEY;
  return key ? { "x-messari-api-key": key } : {};
}

function ms<T>(path: string, ttl: number): Promise<T> {
  return cache.wrap(`messari:${path}`, ttl, () =>
    fetchJSON<T>(`${API}${path}`, { headers: headers() }),
  );
}

// ─── Asset List ──────────────────────────────────────────────

export function getAssets(
  limit = 50,
  page = 1,
  fields?: string,
): Promise<{
  data: Array<{
    id: string;
    symbol: string;
    name: string;
    slug: string;
    metrics: {
      market_data: {
        price_usd: number;
        volume_last_24_hours: number;
        percent_change_usd_last_24_hours: number;
        ohlcv_last_24_hour: { open: number; high: number; low: number; close: number };
      };
      marketcap: { current_marketcap_usd: number; rank: number };
      supply: { circulating: number; y_2050: number };
      roi_data: {
        percent_change_last_1_week: number;
        percent_change_last_1_month: number;
        percent_change_last_3_months: number;
        percent_change_last_1_year: number;
      };
    };
  }>;
}> {
  const p = new URLSearchParams({ limit: String(limit), page: String(page) });
  if (fields) p.set("fields", fields);
  return ms(`/v2/assets?${p}`, 120);
}

// ─── Asset Profile ───────────────────────────────────────────

export function getAssetProfile(slug: string): Promise<{
  data: {
    id: string;
    symbol: string;
    name: string;
    slug: string;
    profile: {
      general: {
        overview: { tagline: string; project_details: string; official_links: Array<{ name: string; link: string }> };
        background: { background_details: string; issuing_organizations: Array<{ name: string; slug: string }> };
      };
      technology: { overview: { technology_details: string } };
      economics: { token: { token_type: string; token_usage: string } };
    };
  };
}> {
  return ms(`/v2/assets/${slug}/profile`, 1800);
}

// ─── Asset Metrics ───────────────────────────────────────────

export function getAssetMetrics(slug: string): Promise<{
  data: {
    id: string;
    symbol: string;
    name: string;
    market_data: {
      price_usd: number;
      volume_last_24_hours: number;
      percent_change_usd_last_24_hours: number;
      ohlcv_last_24_hour: { open: number; high: number; low: number; close: number };
    };
    marketcap: { current_marketcap_usd: number; rank: number };
    supply: { circulating: number; y_2050: number };
    blockchain_stats_24_hours: {
      transaction_volume: number;
      adjusted_transaction_volume: number;
      count_of_active_addresses: number;
      count_of_tx: number;
      count_of_payments: number;
      new_issuance: number;
      median_tx_value: number;
      median_tx_fee: number;
    };
    developer_activity: {
      stars: number;
      watchers: number;
      commits_last_3_months: number;
      commits_last_1_year: number;
      lines_added_last_3_months: number;
      lines_deleted_last_3_months: number;
    };
    roi_data: {
      percent_change_last_1_week: number;
      percent_change_last_1_month: number;
      percent_change_last_3_months: number;
      percent_change_last_1_year: number;
    };
    all_time_high: { price: number; at: string; percent_down: number };
    risk_metrics: {
      sharpe_ratios: { last_30_days: number; last_90_days: number; last_1_year: number };
      volatility_stats: { volatility_last_30_days: number; volatility_last_90_days: number; volatility_last_1_year: number };
    };
  };
}> {
  return ms(`/v1/assets/${slug}/metrics`, 120);
}

// ─── Asset Market Data ───────────────────────────────────────

export function getAssetMarketData(slug: string): Promise<{
  data: {
    market_data: {
      price_usd: number;
      volume_last_24_hours: number;
      real_volume_last_24_hours: number;
      percent_change_usd_last_1_hour: number;
      percent_change_usd_last_24_hours: number;
      ohlcv_last_1_hour: { open: number; high: number; low: number; close: number; volume: number };
      ohlcv_last_24_hour: { open: number; high: number; low: number; close: number; volume: number };
    };
  };
}> {
  return ms(`/v1/assets/${slug}/metrics/market-data`, 60);
}

// ─── Search ──────────────────────────────────────────────────

export function searchAssets(query: string): Promise<{
  data: Array<{ id: string; symbol: string; name: string; slug: string }>;
}> {
  // The Messari v2 assets endpoint acts as search when providing a query
  return ms(`/v2/assets?limit=20&search=${encodeURIComponent(query)}`, 60);
}

// ─── Markets (Exchange pairs for an asset) ───────────────────

export function getAssetMarkets(slug: string): Promise<{
  data: Array<{
    exchange_id: string;
    exchange_name: string;
    pair: string;
    last_trade_at: string;
    price: number;
    volume_last_24_hours: number;
  }>;
}> {
  return ms(`/v1/assets/${slug}/metrics/market-data/markets`, 300);
}
