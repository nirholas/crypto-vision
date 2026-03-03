/**
 * Crypto Vision — Rate Limiter Middleware
 *
 * Sliding-window rate limiter using in-memory counters.
 * In production, swap to Redis-backed for cross-instance consistency.
 */

import type { Context, Next } from "hono";

interface WindowEntry {
  count: number;
  resetAt: number;
}

const windows = new Map<string, WindowEntry>();

// Cleanup stale entries every 60s
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of windows) {
    if (now > entry.resetAt) windows.delete(key);
  }
}, 60_000);

export interface RateLimitConfig {
  /** Requests per window */
  limit: number;
  /** Window size in seconds */
  windowSeconds: number;
}

const DEFAULT_CONFIG: RateLimitConfig = {
  limit: 100,
  windowSeconds: 60,
};

/**
 * Hono middleware — rate limit by IP.
 */
export function rateLimit(config: Partial<RateLimitConfig> = {}) {
  const { limit, windowSeconds } = { ...DEFAULT_CONFIG, ...config };

  return async (c: Context, next: Next) => {
    const ip =
      c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ||
      c.req.header("x-real-ip") ||
      "unknown";
    const key = `rl:${ip}`;
    const now = Date.now();

    let entry = windows.get(key);
    if (!entry || now > entry.resetAt) {
      entry = { count: 0, resetAt: now + windowSeconds * 1000 };
      windows.set(key, entry);
    }

    entry.count++;

    // Always set rate-limit headers
    c.header("X-RateLimit-Limit", String(limit));
    c.header("X-RateLimit-Remaining", String(Math.max(0, limit - entry.count)));
    c.header("X-RateLimit-Reset", String(Math.ceil(entry.resetAt / 1000)));

    if (entry.count > limit) {
      return c.json(
        {
          error: "rate_limit_exceeded",
          message: `Too many requests. Limit: ${limit} per ${windowSeconds}s`,
          retryAfter: Math.ceil((entry.resetAt - now) / 1000),
        },
        429
      );
    }

    await next();
  };
}
