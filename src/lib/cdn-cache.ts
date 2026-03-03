/**
 * Crypto Vision — CDN Cache Middleware
 *
 * Sets Cache-Control headers on API responses to enable edge caching
 * at CDN / Cloud Run level. Short TTLs (30–120s) for market data;
 * stale-while-revalidate allows serving stale content during refresh.
 */

import type { Context, Next, MiddlewareHandler } from "hono";

/**
 * Default cache TTL in seconds for API responses.
 * Market data changes frequently, so we keep it short.
 */
const DEFAULT_MAX_AGE = 30;
const DEFAULT_SWR = 60; // stale-while-revalidate

/**
 * Middleware that adds Cache-Control headers to GET responses.
 * POST / mutation endpoints are not cached.
 */
export const cdnCacheHeaders: MiddlewareHandler = async (c: Context, next: Next) => {
  await next();

  // Only cache successful GET responses
  if (c.req.method !== "GET" || c.res.status >= 400) return;

  // Don't override if the route already set Cache-Control
  if (c.res.headers.get("Cache-Control")) return;

  c.res.headers.set(
    "Cache-Control",
    `public, max-age=${DEFAULT_MAX_AGE}, s-maxage=${DEFAULT_MAX_AGE}, stale-while-revalidate=${DEFAULT_SWR}`,
  );
};
