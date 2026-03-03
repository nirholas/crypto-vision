/**
 * Crypto Vision — Multi-Source Fallback & Graceful Degradation
 *
 * Provides:
 *  - tryMultipleSources(): cascading fallback through ordered source functions
 *  - Circuit breaker integration: skip sources whose upstream host is circuit-broken
 *  - Stale-cache fallback: return stale cached data when ALL sources fail
 *  - Global degraded-mode tracking for /health endpoint
 *
 * Usage:
 *   const result = await tryMultipleSources("coins", [
 *     { name: "coingecko", host: "api.coingecko.com", fn: () => fetchFromCG() },
 *     { name: "coincap",   host: "api.coincap.io",    fn: () => fetchFromCC() },
 *     { name: "coinlore",  host: "api.coinlore.net",  fn: () => fetchFromCL() },
 *   ]);
 */

import { logger } from "./logger.js";
import { isCircuitOpen } from "./fetcher.js";
import { cache } from "./cache.js";

// ─── Types ───────────────────────────────────────────────────

/** A single data source definition for the fallback chain. */
export interface FallbackSource<T> {
  /** Human-readable identifier (e.g. "coingecko", "coincap") */
  name: string;
  /** Upstream hostname used to check circuit breaker state */
  host: string;
  /** Async function that fetches and normalises data from this source */
  fn: () => Promise<T>;
}

/** Result wrapper returned by tryMultipleSources. */
export interface FallbackResult<T> {
  data: T;
  /** Which source actually provided the data */
  source: string;
  /** True if the data came from stale cache (all live sources failed) */
  stale: boolean;
  /** Sources that were attempted and failed */
  failedSources: string[];
  /** Sources that were skipped due to open circuit breaker */
  skippedSources: string[];
  /** ISO timestamp */
  timestamp: string;
}

// ─── Degraded Mode Tracking ──────────────────────────────────

/** Map of route keys that are currently serving stale/degraded data. */
const degradedRoutes = new Map<string, { since: number; reason: string }>();

/**
 * Returns current degraded-route info for the /health endpoint.
 * Keys are route identifiers; values describe when degradation began and why.
 */
export function getDegradedRoutes(): Record<string, { since: string; reason: string }> {
  const out: Record<string, { since: string; reason: string }> = {};
  for (const [key, info] of degradedRoutes) {
    out[key] = {
      since: new Date(info.since).toISOString(),
      reason: info.reason,
    };
  }
  return out;
}

/** Number of routes currently in degraded mode (convenience for /health). */
export function degradedRouteCount(): number {
  return degradedRoutes.size;
}

// ─── Core: tryMultipleSources ────────────────────────────────

/**
 * Attempt to fetch data from an ordered list of sources.
 *
 * 1. For each source, check its circuit breaker — if open, skip it.
 * 2. Call the source function — on success, cache the result and return.
 * 3. On failure, log and move to the next source.
 * 4. If ALL sources fail, attempt to return stale cached data.
 * 5. If no stale cache exists, throw the last error.
 *
 * @param cacheKey  Unique key used for stale-cache storage (e.g. "coins", "global")
 * @param sources   Ordered array of fallback sources (primary first)
 * @param staleTTL  How long stale cache entries survive (seconds, default: 600 = 10 min)
 */
export async function tryMultipleSources<T>(
  cacheKey: string,
  sources: FallbackSource<T>[],
  staleTTL = 600,
): Promise<FallbackResult<T>> {
  const failedSources: string[] = [];
  const skippedSources: string[] = [];
  let lastError: Error | null = null;

  for (const source of sources) {
    // Circuit breaker check — skip sources whose upstream host is open
    if (isCircuitOpen(source.host)) {
      skippedSources.push(source.name);
      logger.debug({ source: source.name, host: source.host }, "Fallback: skipping source (circuit open)");
      continue;
    }

    try {
      const data = await source.fn();

      // Success — cache the fresh data for stale fallback and clear degraded state
      await cache.set(`fallback:${cacheKey}`, data, staleTTL);
      degradedRoutes.delete(cacheKey);

      logger.info(
        { source: source.name, cacheKey, failedSources, skippedSources },
        "Fallback: source succeeded",
      );

      return {
        data,
        source: source.name,
        stale: false,
        failedSources,
        skippedSources,
        timestamp: new Date().toISOString(),
      };
    } catch (err) {
      lastError = err as Error;
      failedSources.push(source.name);
      logger.warn(
        { source: source.name, cacheKey, error: (err as Error).message },
        "Fallback: source failed",
      );
    }
  }

  // All sources failed — try stale cache
  const staleData = await cache.get<T>(`fallback:${cacheKey}`);
  if (staleData !== null) {
    degradedRoutes.set(cacheKey, {
      since: Date.now(),
      reason: `All ${sources.length} sources failed; serving stale cache`,
    });

    logger.warn(
      { cacheKey, failedSources, skippedSources },
      "Fallback: all sources failed — serving stale cached data",
    );

    return {
      data: staleData,
      source: "stale-cache",
      stale: true,
      failedSources,
      skippedSources,
      timestamp: new Date().toISOString(),
    };
  }

  // No stale cache either — mark degraded and throw
  degradedRoutes.set(cacheKey, {
    since: Date.now(),
    reason: `All ${sources.length} sources failed; no stale cache available`,
  });

  logger.error(
    { cacheKey, failedSources, skippedSources, error: lastError?.message },
    "Fallback: all sources failed and no stale cache — returning error",
  );

  throw lastError ?? new Error(`All sources failed for ${cacheKey}`);
}
