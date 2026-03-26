import type { MiddlewareHandler } from 'hono';

import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

/**
 * Simple in-memory rate limiter middleware.
 * Accepts optional overrides; falls back to env config.
 */
export function rateLimitMiddleware(max?: number, windowMs?: number): MiddlewareHandler {
  const store = new Map<string, RateLimitEntry>();
  const maxRequests = max ?? env.RATE_LIMIT_MAX;
  const windowMsVal = windowMs ?? env.RATE_LIMIT_WINDOW_MS;

  return async (c, next) => {
    const ip = c.req.header('x-forwarded-for') ?? c.req.header('x-real-ip') ?? 'unknown';
    const now = Date.now();

    const entry = store.get(ip);

    if (!entry || now > entry.resetAt) {
      store.set(ip, { count: 1, resetAt: now + windowMsVal });
    } else {
      entry.count++;
      if (entry.count > maxRequests) {
        logger.warn(`Rate limit exceeded for ${ip}`);
        return c.json({ error: 'Too many requests' }, 429);
      }
    }

    await next();
  };
}
