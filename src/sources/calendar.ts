/**
 * Crypto Vision — Calendar / Events Data Source
 *
 * Crypto events, launches, and happenings from:
 *  - CoinMarketCal API (free tier — 50 req/day)
 *  - CoinGecko trending (upcoming/recent events)
 *  - CoinPaprika events endpoint
 *
 * @copyright 2024-2026 nirholas. All rights reserved.
 */

import { fetchJSON } from "../lib/fetcher.js";
import { cache } from "../lib/cache.js";

// ─── CoinMarketCal ──────────────────────────────────────────

const CMC_BASE = "https://developers.coinmarketcal.com/v1";

function cmcHeaders(): Record<string, string> {
  const key = process.env.COINMARKETCAL_API_KEY;
  return key
    ? { "x-api-key": key, Accept: "application/json" }
    : { Accept: "application/json" };
}

export interface CryptoEvent {
  title: string;
  description: string;
  date: string;
  coin: { id: string; name: string; symbol: string } | null;
  category: string;
  source: string;
  significance: string;
  proof: string;
  votes?: { positive: number; negative: number };
}

/**
 * Upcoming crypto events from CoinMarketCal.
 */
export function getEvents(
  page = 1,
  max = 50,
  sortBy = "hot_events",
): Promise<{ body: CryptoEvent[] }> {
  return cache.wrap(`calendar:events:${page}:${max}:${sortBy}`, 300, () =>
    fetchJSON(`${CMC_BASE}/events?page=${page}&max=${max}&sortBy=${sortBy}`, {
      headers: cmcHeaders(),
    }),
  );
}

/**
 * Events for a specific coin.
 */
export function getCoinEvents(
  coinSymbol: string,
  page = 1,
  max = 25,
): Promise<{ body: CryptoEvent[] }> {
  return cache.wrap(`calendar:coin:${coinSymbol}:${page}`, 300, () =>
    fetchJSON(`${CMC_BASE}/events?coins=${coinSymbol}&page=${page}&max=${max}`, {
      headers: cmcHeaders(),
    }),
  );
}

/**
 * Event categories (mainnet launch, airdrop, burn, partnership, etc.).
 */
export function getCategories(): Promise<{ body: any[] }> {
  return cache.wrap("calendar:categories", 3600, () =>
    fetchJSON(`${CMC_BASE}/categories`, { headers: cmcHeaders() }),
  );
}

/**
 * Events by category.
 */
export function getEventsByCategory(
  categoryId: number,
  page = 1,
  max = 25,
): Promise<{ body: CryptoEvent[] }> {
  return cache.wrap(`calendar:category:${categoryId}:${page}`, 300, () =>
    fetchJSON(`${CMC_BASE}/events?categories=${categoryId}&page=${page}&max=${max}`, {
      headers: cmcHeaders(),
    }),
  );
}

/**
 * Coins with upcoming events.
 */
export function getCoinsWithEvents(): Promise<{ body: any[] }> {
  return cache.wrap("calendar:coins", 600, () =>
    fetchJSON(`${CMC_BASE}/coins`, { headers: cmcHeaders() }),
  );
}

// ─── CoinPaprika Events ──────────────────────────────────────

const PAPRIKA = "https://api.coinpaprika.com/v1";

/**
 * Events for a coin from CoinPaprika.
 */
export function getPaprikaEvents(coinId: string): Promise<any[]> {
  return cache.wrap(`calendar:paprika:${coinId}`, 600, () =>
    fetchJSON(`${PAPRIKA}/coins/${coinId}/events`),
  );
}

// ─── Aggregated Calendar ─────────────────────────────────────

/**
 * Aggregated upcoming events from all sources.
 */
export async function getAggregatedCalendar(days = 30): Promise<{
  events: CryptoEvent[];
  sources: string[];
  count: number;
}> {
  return cache.wrap(`calendar:aggregate:${days}`, 300, async () => {
    const events: CryptoEvent[] = [];
    const sources: string[] = [];

    // Try CoinMarketCal
    try {
      const cmc = await getEvents(1, 50);
      if (cmc?.body?.length) {
        events.push(...cmc.body);
        sources.push("coinmarketcal");
      }
    } catch {
      // Skip if API key not set
    }

    // Sort by date
    events.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );

    return {
      events,
      sources,
      count: events.length,
    };
  });
}
