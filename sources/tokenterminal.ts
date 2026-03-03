/**
 * Crypto Vision — Token Terminal Data Source
 *
 * Token Terminal Open API — free tier available (limited endpoints).
 * Set TOKEN_TERMINAL_API_KEY for higher limits.
 *
 * Provides: protocol revenue, earnings, fees, P/S and P/E ratios,
 *           active users, TVL, and treasury data.
 *
 * @see https://docs.tokenterminal.com
 */

import { fetchJSON } from "../lib/fetcher.js";
import { cache } from "../lib/cache.js";

const API = "https://api.tokenterminal.com/v2";

function headers(): Record<string, string> {
  const key = process.env.TOKEN_TERMINAL_API_KEY;
  return key ? { Authorization: `Bearer ${key}` } : {};
}

function tt<T>(path: string, ttl: number): Promise<T> {
  return cache.wrap(`tt:${path}`, ttl, () =>
    fetchJSON<T>(`${API}${path}`, { headers: headers() }),
  );
}

// ─── Types ───────────────────────────────────────────────────

export interface ProtocolMetrics {
  project_id: string;
  project_name: string;
  symbol: string;
  category: string;
  revenue_24h?: number;
  revenue_7d?: number;
  revenue_30d?: number;
  revenue_annualized?: number;
  fees_24h?: number;
  fees_7d?: number;
  fees_30d?: number;
  fees_annualized?: number;
  earnings_24h?: number;
  earnings_7d?: number;
  earnings_30d?: number;
  tvl?: number;
  market_cap?: number;
  ps_ratio?: number;
  pe_ratio?: number;
  token_price?: number;
  active_users_24h?: number;
  active_users_7d?: number;
  active_users_30d?: number;
}

export interface MarketMetrics {
  metric_id: string;
  data: Array<{
    timestamp: string;
    value: number;
  }>;
}

// ─── Projects List ───────────────────────────────────────────

export function getProjects(): Promise<{
  data: Array<{
    project_id: string;
    project_name: string;
    symbol: string;
    category: string;
    chains: string[];
    logo: string;
  }>;
}> {
  return tt("/projects", 1800);
}

// ─── Project Metrics ─────────────────────────────────────────

export function getProjectMetrics(projectId: string): Promise<{
  data: ProtocolMetrics;
}> {
  return tt(`/projects/${projectId}/metrics`, 300);
}

// ─── Top by Revenue (aggregated overview) ────────────────────

export function getProtocolRevenue(): Promise<{
  data: ProtocolMetrics[];
}> {
  return tt("/projects?metric=revenue", 300);
}

// ─── Top by Fees ─────────────────────────────────────────────

export function getProtocolFees(): Promise<{
  data: ProtocolMetrics[];
}> {
  return tt("/projects?metric=fees", 300);
}

// ─── Top by Active Users ─────────────────────────────────────

export function getActiveUsers(): Promise<{
  data: ProtocolMetrics[];
}> {
  return tt("/projects?metric=active_users", 600);
}

// ─── Market-Level Metrics (total crypto fees, revenue, etc.) ─

export function getMarketMetric(
  metricId: string,
  days = 30,
): Promise<MarketMetrics> {
  return tt(`/market-metrics/${metricId}?days=${days}`, 600);
}
