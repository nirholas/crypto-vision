import { type Context, type Next } from "hono";
import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { getRedis } from "../../utils/redis.js";

// Rate limit configuration
export interface RateLimitConfig {
  /** Maximum requests allowed in the window */
  limit: number;
  /** Window duration in seconds */
  window: number;
  /** Key prefix for Redis */
  prefix?: string;
  /** Custom key generator function */
  keyGenerator?: (c: Context) => string;
  /** Skip rate limiting for certain conditions */
  skip?: (c: Context) => boolean;
  /** Custom message when rate limited */
  message?: string;
}

// Default configuration: 100 requests per minute
const DEFAULT_CONFIG: RateLimitConfig = {
  limit: 100,
  window: 60,
  prefix: "ratelimit",
};

/**
 * Get the identifier for rate limiting
 * Priority: authenticated user > wallet address > IP address
 */
function getDefaultKey(c: Context): string {
  // Use authenticated user ID if available
  const userId = c.get("userId");
  if (userId) {
    return `user:${userId}`;
  }

  // Use wallet address from header or param
  const walletAddress =
    c.get("walletAddress") ||
    c.req.header("x-wallet-address") ||
    c.req.param("address");
  if (walletAddress) {
    return `wallet:${walletAddress.toLowerCase()}`;
  }

  // Fall back to IP address
  const forwarded = c.req.header("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0].trim() : "unknown";
  return `ip:${ip}`;
}

/**
 * Rate limit information included in response headers
 */
export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number;
}

/**
 * Create a rate limiting middleware using Redis sliding window algorithm
 */
export function rateLimit(config: Partial<RateLimitConfig> = {}) {
  const { limit, window, prefix, keyGenerator, skip, message } = {
    ...DEFAULT_CONFIG,
    ...config,
  };

  return createMiddleware(async (c: Context, next: Next) => {
    // Check if rate limiting should be skipped
    if (skip && skip(c)) {
      await next();
      return;
    }

    const redis = getRedis();
    const key = keyGenerator ? keyGenerator(c) : getDefaultKey(c);
    const redisKey = `${prefix}:${key}`;
    const now = Date.now();
    const windowStart = now - window * 1000;

    try {
      // Use Redis pipeline for atomic operations
      const pipeline = redis.pipeline();

      // Remove old entries outside the window
      pipeline.zremrangebyscore(redisKey, 0, windowStart);

      // Count requests in current window
      pipeline.zcard(redisKey);

      // Add current request with timestamp as score
      pipeline.zadd(redisKey, now, `${now}:${Math.random()}`);

      // Set key expiry
      pipeline.expire(redisKey, window);

      const results = await pipeline.exec();

      // Get count from zcard result (index 1)
      const count = (results?.[1]?.[1] as number) || 0;

      // Calculate remaining requests
      const remaining = Math.max(0, limit - count - 1);

      // Calculate reset time
      const oldestEntry = await redis.zrange(redisKey, 0, 0, "WITHSCORES");
      const resetTime = oldestEntry.length >= 2
        ? Math.ceil((parseInt(oldestEntry[1]) + window * 1000) / 1000)
        : Math.ceil((now + window * 1000) / 1000);

      // Set rate limit headers
      c.header("X-RateLimit-Limit", limit.toString());
      c.header("X-RateLimit-Remaining", remaining.toString());
      c.header("X-RateLimit-Reset", resetTime.toString());

      // Check if rate limited
      if (count >= limit) {
        c.header("Retry-After", window.toString());

        throw new HTTPException(429, {
          message:
            message ||
            `Rate limit exceeded. Please wait ${window} seconds before trying again.`,
        });
      }

      await next();
    } catch (error) {
      if (error instanceof HTTPException) {
        throw error;
      }

      // Log Redis errors but don't block requests
      console.error("[RateLimit] Redis error:", error);
      await next();
    }
  });
}

/**
 * Create a stricter rate limit for expensive operations (like sweeps)
 */
export const strictRateLimit = rateLimit({
  limit: 10,
  window: 60,
  prefix: "ratelimit:strict",
  message: "Too many requests. Please slow down.",
});

/**
 * Create a very strict rate limit for auth endpoints
 */
export const authRateLimit = rateLimit({
  limit: 5,
  window: 60,
  prefix: "ratelimit:auth",
  keyGenerator: (c) => {
    const forwarded = c.req.header("x-forwarded-for");
    const ip = forwarded ? forwarded.split(",")[0].trim() : "unknown";
    return `ip:${ip}`;
  },
  message: "Too many authentication attempts. Please wait before trying again.",
});

/**
 * Create a rate limit per wallet address
 */
export const walletRateLimit = (limit = 100, window = 60) =>
  rateLimit({
    limit,
    window,
    prefix: "ratelimit:wallet",
    keyGenerator: (c) => {
      const address =
        c.get("walletAddress") ||
        c.req.header("x-wallet-address") ||
        c.req.param("address");
      if (!address) {
        const forwarded = c.req.header("x-forwarded-for");
        const ip = forwarded ? forwarded.split(",")[0].trim() : "unknown";
        return `ip:${ip}`;
      }
      return address.toLowerCase();
    },
  });

/**
 * Default rate limit middleware (100 req/min per wallet)
 */
export const defaultRateLimit = walletRateLimit(100, 60);
