import { LRUCache } from 'lru-cache';
import type { Redis } from 'ioredis';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NonceStore {
  /**
   * Check if a nonce has been used. Returns true if it was already recorded.
   */
  has(network: string, authorizer: string, nonce: string): Promise<boolean>;

  /**
   * Record a nonce as used. TTL is when the payment authorization expires.
   * @param expiresAt Unix timestamp (seconds) from authorization.validBefore
   */
  set(network: string, authorizer: string, nonce: string, expiresAt: number): Promise<void>;
}

// ─── Composite key helper ─────────────────────────────────────────────────────

function nonceKey(network: string, authorizer: string, nonce: string): string {
  return `x402:nonce:${network}:${authorizer.toLowerCase()}:${nonce.toLowerCase()}`;
}

// ─── In-Memory LRU Store ──────────────────────────────────────────────────────

class MemoryNonceStore implements NonceStore {
  /**
   * LRU cache: key → expiry timestamp (seconds).
   * Max 100,000 entries — at ~200 bytes each, ~20MB RAM max.
   */
  private readonly cache = new LRUCache<string, number>({
    max: 100_000,
    // Item-level TTL: calculate from the stored expiry
    ttl: 0, // Will set TTL per item
    ttlAutopurge: true,
  });

  async has(network: string, authorizer: string, nonce: string): Promise<boolean> {
    const key = nonceKey(network, authorizer, nonce);
    const entry = this.cache.get(key);
    if (entry === undefined) return false;

    // Double-check expiry (LRU may not have evicted yet)
    if (Date.now() / 1000 > entry) {
      this.cache.delete(key);
      return false;
    }
    return true;
  }

  async set(network: string, authorizer: string, nonce: string, expiresAt: number): Promise<void> {
    const key = nonceKey(network, authorizer, nonce);
    const ttlMs = Math.max(0, (expiresAt - Date.now() / 1000) * 1000);
    this.cache.set(key, expiresAt, { ttl: ttlMs });
  }
}

// ─── Redis Nonce Store ────────────────────────────────────────────────────────

class RedisNonceStore implements NonceStore {
  constructor(private readonly redis: Redis) {}

  async has(network: string, authorizer: string, nonce: string): Promise<boolean> {
    const key = nonceKey(network, authorizer, nonce);
    const result = await this.redis.exists(key);
    return result === 1;
  }

  async set(network: string, authorizer: string, nonce: string, expiresAt: number): Promise<void> {
    const key = nonceKey(network, authorizer, nonce);
    const ttlSeconds = Math.max(1, Math.ceil(expiresAt - Date.now() / 1000));
    // SET with EX (expire) so it auto-cleans
    await this.redis.set(key, '1', 'EX', ttlSeconds);
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

let _store: NonceStore | null = null;

/**
 * Get the singleton nonce store.
 * If REDIS_URL is configured, uses Redis. Otherwise falls back to in-memory LRU.
 */
export async function getNonceStore(redisUrl?: string): Promise<NonceStore> {
  if (_store) return _store;

  if (redisUrl) {
    try {
      const { default: Redis } = await import('ioredis');
      const redis = new Redis(redisUrl, {
        lazyConnect: true,
        retryStrategy: (times) => Math.min(times * 100, 3000),
        maxRetriesPerRequest: 3,
        enableOfflineQueue: false,
      });
      await redis.connect();
      _store = new RedisNonceStore(redis);
      return _store;
    } catch {
      // Redis unavailable — fall through to memory store
      console.warn('[nonce-store] Redis connection failed, falling back to in-memory store');
    }
  }

  _store = new MemoryNonceStore();
  return _store;
}

/** For testing — reset the singleton */
export function resetNonceStore(): void {
  _store = null;
}
