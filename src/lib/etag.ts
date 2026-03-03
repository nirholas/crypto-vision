/**
 * Crypto Vision — ETag & Conditional Request Middleware
 *
 * Generates weak ETags from SHA-256 hashes of response bodies,
 * handles If-None-Match → 304 Not Modified, and sets route-specific
 * Cache-Control headers for optimal edge / CDN caching.
 *
 * Cache-Control profiles:
 *   Market data:      max-age=30,   stale-while-revalidate=60
 *   DeFi protocols:   max-age=300,  stale-while-revalidate=600
 *   News:             max-age=60,   stale-while-revalidate=120
 *   Static data:      max-age=3600
 *   AI responses:     no-cache (every request is unique)
 *
 * @copyright 2024-2026 nirholas. All rights reserved.
 */

import { createHash } from "node:crypto";
import type { Context, MiddlewareHandler, Next } from "hono";

// ─── Cache Profile Definitions ───────────────────────────────

interface CacheProfile {
  readonly pattern: RegExp;
  readonly maxAge: number;
  readonly swr: number;
}

/**
 * Route-specific cache profiles, ordered by specificity.
 * First match wins, so more specific patterns must come first.
 */
const CACHE_PROFILES: readonly CacheProfile[] = [
  // AI / agent chat — no-cache (unique per request)
  { pattern: /^\/api\/ai\//, maxAge: 0, swr: 0 },
  { pattern: /^\/api\/agents\/[^/]+\/chat/, maxAge: 0, swr: 0 },

  // Static / rarely changing data — long cache
  { pattern: /^\/api\/categories/, maxAge: 3600, swr: 0 },
  { pattern: /^\/api\/exchanges\/list/, maxAge: 3600, swr: 0 },
  { pattern: /^\/api\/dex\/networks/, maxAge: 3600, swr: 0 },
  { pattern: /^\/api\/security\/chains/, maxAge: 3600, swr: 0 },
  { pattern: /^\/api\/oracles\/chainlink\/all/, maxAge: 3600, swr: 0 },
  { pattern: /^\/api\/solana\/tokens$/, maxAge: 3600, swr: 0 },
  { pattern: /^\/api\/depin\/categories/, maxAge: 3600, swr: 0 },
  { pattern: /^\/api\/news-feed\/sources/, maxAge: 3600, swr: 0 },
  { pattern: /^\/api\/news-feed\/categories/, maxAge: 3600, swr: 0 },
  { pattern: /^\/api\/news\/sources/, maxAge: 3600, swr: 0 },
  { pattern: /^\/api\/calendar\/categories/, maxAge: 3600, swr: 0 },
  { pattern: /^\/api\/governance\/spaces$/, maxAge: 3600, swr: 0 },

  // DeFi protocols — medium cache
  { pattern: /^\/api\/defi\//, maxAge: 300, swr: 600 },
  { pattern: /^\/api\/staking\//, maxAge: 300, swr: 600 },
  { pattern: /^\/api\/unlocks\//, maxAge: 300, swr: 600 },

  // News — moderate cache
  { pattern: /^\/api\/news/, maxAge: 60, swr: 120 },
  { pattern: /^\/api\/news-feed\//, maxAge: 60, swr: 120 },
  { pattern: /^\/api\/social\//, maxAge: 60, swr: 120 },

  // Market data — short cache
  { pattern: /^\/api\/coins/, maxAge: 30, swr: 60 },
  { pattern: /^\/api\/coin\//, maxAge: 30, swr: 60 },
  { pattern: /^\/api\/price/, maxAge: 30, swr: 60 },
  { pattern: /^\/api\/trending/, maxAge: 30, swr: 60 },
  { pattern: /^\/api\/global/, maxAge: 30, swr: 60 },
  { pattern: /^\/api\/chart\//, maxAge: 30, swr: 60 },
  { pattern: /^\/api\/ohlc\//, maxAge: 30, swr: 60 },
  { pattern: /^\/api\/gainers/, maxAge: 30, swr: 60 },
  { pattern: /^\/api\/losers/, maxAge: 30, swr: 60 },
  { pattern: /^\/api\/high-volume/, maxAge: 30, swr: 60 },
  { pattern: /^\/api\/ath-distance/, maxAge: 30, swr: 60 },
  { pattern: /^\/api\/compare/, maxAge: 30, swr: 60 },
  { pattern: /^\/api\/dominance/, maxAge: 30, swr: 60 },
  { pattern: /^\/api\/market-overview/, maxAge: 30, swr: 60 },
  { pattern: /^\/api\/fear-greed/, maxAge: 30, swr: 60 },
  { pattern: /^\/api\/cex\//, maxAge: 30, swr: 60 },
  { pattern: /^\/api\/derivatives\//, maxAge: 30, swr: 60 },
  { pattern: /^\/api\/perps\//, maxAge: 30, swr: 60 },
  { pattern: /^\/api\/gas/, maxAge: 30, swr: 60 },
  { pattern: /^\/api\/bitcoin\//, maxAge: 30, swr: 60 },
  { pattern: /^\/api\/dex\//, maxAge: 30, swr: 60 },
  { pattern: /^\/api\/macro\//, maxAge: 30, swr: 60 },
  { pattern: /^\/api\/etf\//, maxAge: 30, swr: 60 },
  { pattern: /^\/api\/solana\//, maxAge: 30, swr: 60 },
  { pattern: /^\/api\/aggregate\//, maxAge: 30, swr: 60 },
  { pattern: /^\/api\/anomalies\//, maxAge: 30, swr: 60 },
] as const;

/** Maximum response body size (bytes) for ETag computation. Above this, skip hashing. */
const MAX_ETAG_BODY_SIZE = 2 * 1024 * 1024; // 2 MB

// ─── Helper Functions ────────────────────────────────────────

/**
 * Resolve the cache profile for a given request path.
 * Falls back to a moderate default (60s max-age, 120s SWR).
 */
export function getCacheProfile(path: string): { maxAge: number; swr: number } {
  for (const profile of CACHE_PROFILES) {
    if (profile.pattern.test(path)) {
      return { maxAge: profile.maxAge, swr: profile.swr };
    }
  }
  // Sensible default — moderate freshness
  return { maxAge: 60, swr: 120 };
}

/**
 * Build the Cache-Control header value for a given profile.
 */
export function buildCacheControl(maxAge: number, swr: number): string {
  if (maxAge === 0) {
    return "no-cache, no-store, must-revalidate";
  }
  let cc = `public, max-age=${maxAge}, s-maxage=${maxAge}`;
  if (swr > 0) {
    cc += `, stale-while-revalidate=${swr}`;
  }
  return cc;
}

/**
 * Compute a weak ETag from a response body string.
 * Uses SHA-256 truncated to 16 hex chars for compactness.
 */
export function computeEtag(body: string): string {
  const hash = createHash("sha256").update(body).digest("hex").slice(0, 16);
  return `W/"${hash}"`;
}

/**
 * Check whether an If-None-Match header matches the given ETag.
 * Supports both exact match and wildcard (*).
 * Handles comma-separated lists of ETags per HTTP spec.
 */
export function etagMatches(ifNoneMatch: string, etag: string): boolean {
  if (ifNoneMatch === "*") return true;

  // Parse comma-separated ETag list
  const tags = ifNoneMatch.split(",").map((t) => t.trim());
  return tags.includes(etag);
}

// ─── ETag Middleware ─────────────────────────────────────────

/**
 * Hono middleware that:
 *  1. Generates a weak ETag from the SHA-256 hash of the response body
 *  2. Handles If-None-Match → 304 Not Modified when ETags match
 *  3. Sets route-specific Cache-Control headers
 *  4. Sets Vary headers for CDN compression awareness
 *
 * Only applies to successful (2xx) GET requests with JSON bodies.
 * POST, PUT, DELETE, and error responses pass through unchanged.
 */
export const etagMiddleware: MiddlewareHandler = async (c: Context, next: Next) => {
  await next();

  // Only process successful GET responses
  if (c.req.method !== "GET" || c.res.status >= 400) return;

  const contentType = c.res.headers.get("Content-Type");
  if (!contentType?.includes("application/json")) return;

  // Read body for ETag computation
  const body = await c.res.text();

  // Preserve original headers for the rebuilt response
  const headers = new Headers(c.res.headers);
  const status = c.res.status;

  // Set Cache-Control if not already set by route handler
  if (!headers.get("Cache-Control")) {
    const profile = getCacheProfile(c.req.path);
    headers.set("Cache-Control", buildCacheControl(profile.maxAge, profile.swr));
  }

  // CDN compression awareness: tell caches the response varies by encoding
  const existingVary = headers.get("Vary");
  const varyParts = new Set(
    existingVary ? existingVary.split(",").map((v) => v.trim()) : [],
  );
  varyParts.add("Accept-Encoding");
  varyParts.add("If-None-Match");
  headers.set("Vary", [...varyParts].join(", "));

  // Compute ETag for bodies under the size limit
  if (body.length <= MAX_ETAG_BODY_SIZE) {
    const etag = computeEtag(body);
    headers.set("ETag", etag);

    // Conditional request: check If-None-Match
    const ifNoneMatch = c.req.header("If-None-Match");
    if (ifNoneMatch && etagMatches(ifNoneMatch, etag)) {
      // 304 — preserve cache headers but strip body
      const notModifiedHeaders = new Headers();
      notModifiedHeaders.set("ETag", etag);
      const cc = headers.get("Cache-Control");
      if (cc) notModifiedHeaders.set("Cache-Control", cc);
      const vary = headers.get("Vary");
      if (vary) notModifiedHeaders.set("Vary", vary);

      c.res = new Response(null, { status: 304, headers: notModifiedHeaders });
      return;
    }
  }

  // Rebuild response with updated headers
  c.res = new Response(body, { status, headers });
};
