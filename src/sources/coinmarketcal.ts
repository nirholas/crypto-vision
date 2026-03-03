/**
 * Crypto Vision — CoinMarketCal Data Source
 *
 * Crypto events calendar — 100% free, no API key.
 *
 * Provides: upcoming crypto events, historical events,
 *           event categories, coin events.
 */

import { fetchJSON } from "../lib/fetcher.js";
import { cache } from "../lib/cache.js";

const BASE = "https://developers.coinmarketcal.com/v1";

function cmc<T>(path: string, ttl: number): Promise<T> {
  return cache.wrap(`cmc:${path}`, ttl, () =>
    fetchJSON<T>(`${BASE}${path}`)
  );
}

// ─── Events ──────────────────────────────────────────────────

export interface CalEvent {
  title: { en: string };
  coins: Array<{ id: string; name: string; symbol: string }>;
  date_event: string;
  categories: Array<{ id: number; name: string }>;
  source: string;
  proof: string | null;
  is_hot: boolean;
  vote_count: number;
  positive_vote_count: number;
  percentage: number;
  created_date: string;
}

export function getUpcomingEvents(page = 1): Promise<{ body: CalEvent[] }> {
  return cmc(`/events?page=${page}&max=50&sortBy=hot_events`, 600);
}

export function getCoinEvents(
  coins: string,
  page = 1,
): Promise<{ body: CalEvent[] }> {
  return cmc(`/events?coins=${encodeURIComponent(coins)}&page=${page}&max=50`, 600);
}

export function getEventCategories(): Promise<{ body: Array<{ id: number; name: string }> }> {
  return cmc("/categories", 86_400);
}

export function getEventsByCategory(
  categoryId: number,
  page = 1,
): Promise<{ body: CalEvent[] }> {
  return cmc(`/events?categories=${categoryId}&page=${page}&max=50`, 600);
}

export function getCoinsWithEvents(): Promise<{
  body: Array<{ id: string; name: string; symbol: string }>;
}> {
  return cmc("/coins", 3_600);
}
