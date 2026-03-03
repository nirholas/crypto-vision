/**
 * Crypto Vision — Cache Layer
 *
 * Two-tier caching:
 *  1. In-memory LRU (instant, per-instance)
 *  2. Redis (shared across instances, GCP Memorystore in prod)
 *
 * Every upstream call goes through cache.wrap() so we never
 * hammer free-tier APIs and stay well within rate limits.
 */

import { logger } from "./logger.js";

// ─── In-Memory LRU ──────────────────────────────────────────

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

class MemoryCache {
  private store = new Map<string, CacheEntry<unknown>>();
  private maxSize: number;

  constructor(maxSize = 5000) {
    this.maxSize = maxSize;
  }

  get<T>(key: string): T | null {
    const entry = this.store.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  set<T>(key: string, value: T, ttlSeconds: number): void {
    // Evict oldest entries if at capacity
    if (this.store.size >= this.maxSize) {
      const firstKey = this.store.keys().next().value;
      if (firstKey) this.store.delete(firstKey);
    }
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  get size(): number {
    return this.store.size;
  }
}

// ─── Redis (optional — graceful fallback to memory-only) ─────

let redis: import("ioredis").default | null = null;

async function getRedis() {
  if (redis) return redis;
  const url = process.env.REDIS_URL;
  if (!url) return null;

  try {
    const { default: Redis } = await import("ioredis");
    redis = new Redis(url, {
      maxRetriesPerRequest: 2,
      connectTimeout: 3000,
      lazyConnect: true,
    });
    await redis.connect();
    logger.info("Redis connected");
    return redis;
  } catch (err) {
    logger.warn({ err }, "Redis unavailable — memory-only caching");
    return null;
  }
}

// ─── Unified Cache Interface ─────────────────────────────────

const mem = new MemoryCache();

export const cache = {
  /**
   * Get a value, trying memory first, then Redis.
   */
  async get<T>(key: string): Promise<T | null> {
    // L1: memory
    const memHit = mem.get<T>(key);
    if (memHit !== null) return memHit;

    // L2: redis
    const r = await getRedis();
    if (r) {
      try {
        const raw = await r.get(`cv:${key}`);
        if (raw) {
          const parsed = JSON.parse(raw) as T;
          mem.set(key, parsed, 30); // backfill L1 with short TTL
          return parsed;
        }
      } catch {
        // Redis read failure — not critical
      }
    }
    return null;
  },

  /**
   * Set a value in both memory and Redis.
   */
  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    mem.set(key, value, ttlSeconds);
    const r = await getRedis();
    if (r) {
      try {
        await r.set(`cv:${key}`, JSON.stringify(value), "EX", ttlSeconds);
      } catch {
        // Redis write failure — not critical
      }
    }
  },

  /**
   * Cache-aside wrapper. Returns cached value or calls `fn` and caches result.
   */
  async wrap<T>(
    key: string,
    ttlSeconds: number,
    fn: () => Promise<T>
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) return cached;

    const fresh = await fn();
    await this.set(key, fresh, ttlSeconds);
    return fresh;
  },

  /** Invalidate a key. */
  async del(key: string): Promise<void> {
    mem.delete(key);
    const r = await getRedis();
    if (r) {
      try {
        await r.del(`cv:${key}`);
      } catch {
        // noop
      }
    }
  },

  /** Memory cache stats for /health. */
  stats() {
    return { memoryEntries: mem.size, redisConnected: redis !== null };
  },
};
