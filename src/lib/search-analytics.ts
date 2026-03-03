/**
 * Crypto Vision — Search Analytics
 *
 * Tracks search queries, intents, result counts, and click-through data
 * for relevance tuning, trending topic detection, and coverage gap analysis.
 *
 * Data flows to BigQuery's `search_analytics` table partitioned by date
 * and clustered by intent for efficient analytical queries.
 *
 * Key analytics use cases:
 *  - Top search terms (trending topic detection)
 *  - Zero-result queries (coverage gap identification)
 *  - Search-to-click rate (relevance scoring)
 *  - Intent distribution (feature prioritization)
 *  - Latency percentiles (performance monitoring)
 *
 * Fire-and-forget pattern — never blocks or throws on analytics failures.
 */

import { insertRows } from "./bigquery.js";
import { log } from "./logger.js";

// ─── Types ───────────────────────────────────────────────────

export interface SearchAnalyticsRow {
  query: string;
  intent: string;
  result_count: number;
  search_time_ms: number;
  clicked_result: string | null;
  result_types: string | null;
  searched_at: string;
}

// ─── Analytics Logging ───────────────────────────────────────

/**
 * Log a search event to BigQuery for analytics.
 * Fire-and-forget — never blocks the response or throws on failure.
 */
export function logSearch(
  query: string,
  intent: string,
  resultCount: number,
  searchTimeMs: number,
  clickedResult?: string,
  resultTypes?: string[],
): void {
  const row: SearchAnalyticsRow = {
    query: query.slice(0, 500), // Truncate to avoid BQ field size issues
    intent,
    result_count: resultCount,
    search_time_ms: Math.round(searchTimeMs),
    clicked_result: clickedResult || null,
    result_types: resultTypes ? resultTypes.join(",") : null,
    searched_at: new Date().toISOString(),
  };

  insertRows("search_analytics", [row]).catch((err) => {
    log.debug({ err }, "[search-analytics] Failed to log search event");
  });
}

/**
 * Log a search result click for relevance tuning.
 * Called when a user interacts with a search result.
 */
export function logSearchClick(
  query: string,
  intent: string,
  clickedResult: string,
): void {
  const row: SearchAnalyticsRow = {
    query: query.slice(0, 500),
    intent,
    result_count: 0, // Not relevant for click events
    search_time_ms: 0,
    clicked_result: clickedResult,
    result_types: null,
    searched_at: new Date().toISOString(),
  };

  insertRows("search_analytics", [row]).catch((err) => {
    log.debug({ err }, "[search-analytics] Failed to log click event");
  });
}
