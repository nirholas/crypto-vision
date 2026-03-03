/**
 * Crypto Vision — CoinLore Data Source
 *
 * 100% free, no API key, no rate limits.
 *
 * Provides: global stats, coin tickers, coin detail, exchanges.
 * Good fallback/supplement to CoinGecko.
 */

import { fetchJSON } from "../lib/fetcher.js";
import { cache } from "../lib/cache.js";

const BASE = "https://api.coinlore.net/api";

function cl<T>(path: string, ttl: number): Promise<T> {
  return cache.wrap(`cl:${path}`, ttl, () =>
    fetchJSON<T>(`${BASE}${path}`)
  );
}

// ─── Global Stats ────────────────────────────────────────────

export interface CoinloreGlobal {
  coins_count: number;
  active_markets: number;
  total_mcap: number;
  total_volume: number;
  btc_d: string;
  eth_d: string;
  mcap_change: string;
  volume_change: string;
  avg_change_percent: string;
}

export function getGlobal(): Promise<CoinloreGlobal[]> {
  return cl("/global/", 120);
}

// ─── Tickers (Top Coins) ────────────────────────────────────

export interface CoinloreTicker {
  id: string;
  symbol: string;
  name: string;
  nameid: string;
  rank: number;
  price_usd: string;
  percent_change_24h: string;
  percent_change_1h: string;
  percent_change_7d: string;
  market_cap_usd: string;
  volume24: number;
  volume24a: number;
  csupply: string;
  tsupply: string;
  msupply: string;
}

export interface CoinloreTickerResponse {
  data: CoinloreTicker[];
  info: {
    coins_num: number;
    time: number;
  };
}

export function getTickers(start = 0, limit = 100): Promise<CoinloreTickerResponse> {
  return cl(`/tickers/?start=${start}&limit=${Math.min(limit, 100)}`, 60);
}

// ─── Coin Detail ─────────────────────────────────────────────

export function getCoinDetail(id: string): Promise<CoinloreTicker[]> {
  return cl(`/ticker/?id=${id}`, 60);
}

// ─── Exchanges ───────────────────────────────────────────────

export interface CoinloreExchange {
  id: string;
  name: string;
  name_id: string;
  volume_usd: number;
  active_pairs: number;
  url: string;
  country: string;
}

export function getExchanges(): Promise<CoinloreExchange[]> {
  return cl("/exchanges/", 600);
}

// ─── Markets for a Coin ──────────────────────────────────────

export interface CoinloreMarket {
  name: string;
  base: string;
  quote: string;
  price: number;
  price_usd: number;
  volume: number;
  volume_usd: number;
  time: number;
}

export function getCoinMarkets(id: string): Promise<CoinloreMarket[]> {
  return cl(`/coin/markets/?id=${id}`, 120);
}

// ─── Social Stats ────────────────────────────────────────────

export function getCoinSocialStats(id: string): Promise<{
  reddit: { avg_active_users: number; subscribers: number };
  twitter: { followers_count: number; status_count: number };
}> {
  return cl(`/coin/social_stats/?id=${id}`, 600);
}
