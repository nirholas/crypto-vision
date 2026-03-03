/**
 * Rate Limiting Middleware
 *
 * Rate limits based on reputation score — higher reputation gets more requests.
 */

import type { Context, Next } from 'hono';
import { ReputationManager } from '../protocols/erc8004/reputation.js';

export interface RateLimitConfig {
  /** Base requests per minute for unverified agents */
  baseRate: number;
  /** Multiplier per reputation point (e.g., 1.5 = 50% more per point) */
  reputationMultiplier: number;
  /** Max requests per minute (hard cap) */
  maxRate: number;
  /** Window size in milliseconds (default: 60000 = 1 minute) */
  windowMs?: number;
  /** Chain for reputation lookups */
  chain: string;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
  limit: number;
}

/**
 * Create rate limiting middleware with reputation-based scaling.
 */
export function createRateLimitMiddleware(config: RateLimitConfig) {
  const windowMs = config.windowMs ?? 60000;
  const entries = new Map<string, RateLimitEntry>();
  const reputationCache = new Map<string, { score: number; expiry: number }>();

  // Periodic cleanup
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of entries) {
      if (entry.resetAt < now) entries.delete(key);
    }
    for (const [key, cache] of reputationCache) {
      if (cache.expiry < now) reputationCache.delete(key);
    }
  }, windowMs);

  return async (c: Context, next: Next) => {
    // Get client identifier (agent address or IP)
    const clientId = getClientId(c);
    const now = Date.now();

    // Get or create rate limit entry
    let entry = entries.get(clientId);
    if (!entry || entry.resetAt < now) {
      const limit = await calculateLimit(clientId, c, config, reputationCache);
      entry = { count: 0, resetAt: now + windowMs, limit };
      entries.set(clientId, entry);
    }

    entry.count++;

    // Set rate limit headers
    c.header('X-RateLimit-Limit', String(entry.limit));
    c.header('X-RateLimit-Remaining', String(Math.max(0, entry.limit - entry.count)));
    c.header('X-RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)));

    if (entry.count > entry.limit) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      c.header('Retry-After', String(retryAfter));
      return c.json(
        {
          error: 'Rate limit exceeded',
          limit: entry.limit,
          retryAfter,
        },
        429
      );
    }

    return next();
  };
}

/**
 * Calculate the rate limit for a client based on reputation.
 */
async function calculateLimit(
  clientId: string,
  c: Context,
  config: RateLimitConfig,
  reputationCache: Map<string, { score: number; expiry: number }>
): Promise<number> {
  // Check if authenticated agent
  const auth = c.get('authenticatedAgent') as { agentId?: number } | undefined;
  if (!auth?.agentId) {
    return config.baseRate;
  }

  // Check reputation cache
  const cacheKey = `${config.chain}:${auth.agentId}`;
  const cached = reputationCache.get(cacheKey);
  if (cached && cached.expiry > Date.now()) {
    return Math.min(
      config.maxRate,
      Math.floor(config.baseRate * (1 + cached.score * config.reputationMultiplier))
    );
  }

  // Fetch reputation on-chain
  try {
    const repManager = new ReputationManager(config.chain);
    const score = await repManager.getAverageScore(auth.agentId);
    const normalizedScore = Math.max(0, score); // Only positive scores boost

    // Cache for 5 minutes
    reputationCache.set(cacheKey, {
      score: normalizedScore,
      expiry: Date.now() + 300000,
    });

    return Math.min(
      config.maxRate,
      Math.floor(config.baseRate * (1 + normalizedScore * config.reputationMultiplier))
    );
  } catch {
    return config.baseRate;
  }
}

/**
 * Extract client identifier from request.
 */
function getClientId(c: Context): string {
  // Prefer authenticated agent address
  const auth = c.get('authenticatedAgent') as { address?: string } | undefined;
  if (auth?.address) return auth.address;

  // Fall back to X-PAYMENT payer
  const payment = c.get('x402Payment') as { payer?: string } | undefined;
  if (payment?.payer) return payment.payer;

  // Fall back to IP
  return (
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ??
    c.req.header('x-real-ip') ??
    'unknown'
  );
}
