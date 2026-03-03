/**
 * Crypto Vision — Rate Limiter Middleware
 *
 * Sliding-window rate limiter with two backends:
 *  1. Redis (shared across all instances — production default)
 *  2. In-memory fallback (single-instance, dev/CI)
 *
 * Redis uses a Lua script for atomic increment + TTL so
 * multiple pods never race on the same counter.
 */

import type { Context, Next } from "hono";
import { logger } from "./logger.js";
import { TIER_LIMITS, type ApiTier } from "./auth.js";

// ─── In-Memory Backend ───────────────────────────────────────

interface WindowEntry { count: number; resetAt: number; }
const windows = new Map<string, WindowEntry>();
const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of windows) {
    if (now > entry.resetAt) windows.delete(key);
  }
}, 60_000);
cleanupTimer.unref();

async function incrementMemory(key: string, windowSeconds: number) {
  const now = Date.now();
  let entry = windows.get(key);
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + windowSeconds * 1000 };
    windows.set(key, entry);
  }
  entry.count++;
  return { count: entry.count, resetAt: entry.resetAt };
}

// ─── Redis Backend ───────────────────────────────────────────

const REDIS_INCR_LUA = `
local key = KEYS[1]
local window = tonumber(ARGV[1])
local count = redis.call('INCR', key)
if count == 1 then redis.call('PEXPIRE', key, window) end
local ttl = redis.call('PTTL', key)
return {count, ttl}
`;

let redis: import("ioredis").default | null = null;
let redisOk = false;

async function initRedisRL() {
  if (redis) return redis;
  const url = process.env.REDIS_URL;
  if (!url) return null;
  try {
    const { default: Redis } = await import("ioredis");
    redis = new Redis(url, { maxRetriesPerRequest: 1, connectTimeout: 2000, lazyConnect: true, enableReadyCheck: true });
    await redis.connect();
    redisOk = true;
    logger.info("Rate-limiter: Redis connected");
    redis.on("error", () => { redisOk = false; });
    redis.on("ready", () => { redisOk = true; });
    return redis;
  } catch {
    logger.warn("Rate-limiter: Redis unavailable — using in-memory");
    return null;
  }
}
void initRedisRL();

async function incrementRedis(key: string, windowMs: number) {
  if (!redis || !redisOk) return null;
  try {
    const [count, ttl] = (await redis.eval(REDIS_INCR_LUA, 1, key, windowMs)) as [number, number];
    return { count, resetAt: Date.now() + Math.max(ttl, 0) };
  } catch { return null; }
}

// ─── Config ──────────────────────────────────────────────────

export interface RateLimitConfig {
  limit: number;
  windowSeconds: number;
  prefix?: string;
}

const DEFAULT_CONFIG: RateLimitConfig = { limit: 200, windowSeconds: 60, prefix: "rl" };

// ─── Middleware ───────────────────────────────────────────────

export function rateLimit(config: Partial<RateLimitConfig> = {}) {
  const { limit: defaultLimit, windowSeconds: defaultWindow, prefix } = { ...DEFAULT_CONFIG, ...config };

  return async (c: Context, next: Next) => {
    // Dynamic limits: prefer tier-based config from apiKeyAuth middleware
    const tier = c.get("apiTier") as ApiTier | undefined;
    const tierCfg = tier ? TIER_LIMITS[tier] : undefined;

    const limit = tierCfg?.rateLimit ?? defaultLimit;
    const windowSeconds = tierCfg?.windowSeconds ?? defaultWindow;
    const windowMs = windowSeconds * 1000;

    const ip = c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || c.req.header("x-real-ip") || "unknown";
    const apiKey = (c.get("apiKey") as string | undefined) || "anonymous";
    // Keyed users are rate-limited per key; anonymous users per IP
    const identity = apiKey !== "anonymous" ? `key:${apiKey}` : `ip:${ip}`;
    const key = `${prefix}:${identity}`;

    let result = await incrementRedis(key, windowMs);
    if (!result) result = await incrementMemory(key, windowSeconds);

    const { count, resetAt } = result;
    const remaining = Math.max(0, limit - count);

    c.header("X-RateLimit-Limit", String(limit));
    c.header("X-RateLimit-Remaining", String(remaining));
    c.header("X-RateLimit-Reset", String(Math.ceil(resetAt / 1000)));
    if (tier) c.header("X-RateLimit-Tier", tier);

    if (count > limit) {
      const retryAfter = Math.ceil((resetAt - Date.now()) / 1000);
      c.header("Retry-After", String(retryAfter));
      return c.json({ error: "RATE_LIMIT_EXCEEDED", message: `Too many requests. Limit: ${limit} per ${windowSeconds}s (tier: ${tier || "default"})`, retryAfter }, 429);
    }

    await next();
  };
}
