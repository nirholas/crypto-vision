/**
 * Distributed Cache Layer
 * 
 * Provides a unified caching interface that:
 * - Uses Vercel KV / Upstash Redis when available (for production scale)
 * - Falls back to in-memory cache for development/single instance
 * - Supports cache stampede prevention
 * - Implements stale-while-revalidate pattern
 * 
 * @module distributed-cache
 */

import { db, isKVAvailable } from './database';

// =============================================================================
// TYPES
// =============================================================================

interface CacheOptions {
  /** TTL in seconds */
  ttl: number;
  /** Stale TTL - how long to serve stale data while revalidating */
  staleTtl?: number;
  /** Cache key prefix for namespacing */
  prefix?: string;
  /** Tags for cache invalidation */
  tags?: string[];
}

interface CacheEntry<T> {
  data: T;
  createdAt: number;
  expiresAt: number;
  staleAt?: number;
  tags?: string[];
}

interface CacheStats {
  hits: number;
  misses: number;
  staleHits: number;
  errors: number;
  backend: 'kv' | 'memory';
}

// =============================================================================
// IN-MEMORY FALLBACK
// =============================================================================

class MemoryStore {
  private cache = new Map<string, CacheEntry<unknown>>();
  private maxSize: number;
  private locks = new Map<string, Promise<unknown>>();

  constructor(maxSize = 2000) {
    this.maxSize = maxSize;
    // Cleanup every 30 seconds
    if (typeof setInterval !== 'undefined') {
      setInterval(() => this.cleanup(), 30000);
    }
  }

  async get<T>(key: string): Promise<CacheEntry<T> | null> {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;
    
    // Check if completely expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    
    return entry;
  }

  async set<T>(key: string, entry: CacheEntry<T>): Promise<void> {
    if (this.cache.size >= this.maxSize) {
      this.evictOldest();
    }
    this.cache.set(key, entry as CacheEntry<unknown>);
  }

  async delete(key: string): Promise<void> {
    this.cache.delete(key);
  }

  async deleteByPrefix(prefix: string): Promise<number> {
    let count = 0;
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
        count++;
      }
    }
    return count;
  }

  async deleteByTag(tag: string): Promise<number> {
    let count = 0;
    for (const [key, entry] of this.cache.entries()) {
      if (entry.tags?.includes(tag)) {
        this.cache.delete(key);
        count++;
      }
    }
    return count;
  }

  getLock(key: string): Promise<unknown> | undefined {
    return this.locks.get(key);
  }

  setLock(key: string, promise: Promise<unknown>): void {
    this.locks.set(key, promise);
    promise.finally(() => this.locks.delete(key));
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  private evictOldest(): void {
    let oldest: { key: string; createdAt: number } | null = null;
    for (const [key, entry] of this.cache.entries()) {
      if (!oldest || entry.createdAt < oldest.createdAt) {
        oldest = { key, createdAt: entry.createdAt };
      }
    }
    if (oldest) {
      this.cache.delete(oldest.key);
    }
  }

  stats(): { size: number; maxSize: number } {
    return { size: this.cache.size, maxSize: this.maxSize };
  }
}

// =============================================================================
// DISTRIBUTED CACHE CLASS
// =============================================================================

/**
 * Distributed cache with KV backend and memory fallback
 */
export class DistributedCache {
  private memory: MemoryStore;
  private stats: CacheStats;
  private prefix: string;

  constructor(prefix = 'cache') {
    this.memory = new MemoryStore();
    this.prefix = prefix;
    this.stats = {
      hits: 0,
      misses: 0,
      staleHits: 0,
      errors: 0,
      backend: isKVAvailable() ? 'kv' : 'memory',
    };
  }

  /**
   * Get a cached value with stale-while-revalidate support
   */
  async get<T>(key: string): Promise<{ data: T; isStale: boolean } | null> {
    const fullKey = `${this.prefix}:${key}`;
    const now = Date.now();

    try {
      // Try KV first if available
      if (isKVAvailable()) {
        const entry = await db.get<CacheEntry<T>>(fullKey);
        if (entry) {
          const isStale = entry.staleAt ? now > entry.staleAt : false;
          const isExpired = now > entry.expiresAt;

          if (!isExpired) {
            if (isStale) {
              this.stats.staleHits++;
            } else {
              this.stats.hits++;
            }
            return { data: entry.data, isStale };
          }
        }
      }

      // Fallback to memory
      const memEntry = await this.memory.get<T>(fullKey);
      if (memEntry) {
        const isStale = memEntry.staleAt ? now > memEntry.staleAt : false;
        if (isStale) {
          this.stats.staleHits++;
        } else {
          this.stats.hits++;
        }
        return { data: memEntry.data, isStale };
      }

      this.stats.misses++;
      return null;
    } catch (error) {
      this.stats.errors++;
      console.error('[DistributedCache] Get error:', error);
      
      // Try memory as last resort
      const memEntry = await this.memory.get<T>(fullKey);
      if (memEntry) {
        return { data: memEntry.data, isStale: true };
      }
      return null;
    }
  }

  /**
   * Set a cached value
   */
  async set<T>(key: string, data: T, options: CacheOptions): Promise<void> {
    const fullKey = `${this.prefix}:${key}`;
    const now = Date.now();

    const entry: CacheEntry<T> = {
      data,
      createdAt: now,
      expiresAt: now + options.ttl * 1000,
      staleAt: options.staleTtl ? now + options.staleTtl * 1000 : undefined,
      tags: options.tags,
    };

    try {
      // Write to KV if available
      if (isKVAvailable()) {
        await db.set(fullKey, entry, options.ttl);
      }

      // Always write to memory for fast reads
      await this.memory.set(fullKey, entry);
    } catch (error) {
      this.stats.errors++;
      console.error('[DistributedCache] Set error:', error);
      // Fallback to memory only
      await this.memory.set(fullKey, entry);
    }
  }

  /**
   * Get or set with cache stampede prevention
   * 
   * Uses locking to prevent multiple simultaneous fetches for the same key
   */
  async getOrSet<T>(
    key: string,
    fetchFn: () => Promise<T>,
    options: CacheOptions
  ): Promise<T> {
    const fullKey = `${this.prefix}:${key}`;

    // Check cache first
    const cached = await this.get<T>(key);
    
    // Return fresh data immediately
    if (cached && !cached.isStale) {
      return cached.data;
    }

    // Check if another request is already fetching
    const existingLock = this.memory.getLock(fullKey);
    if (existingLock) {
      // Return stale data while waiting, or wait for lock
      if (cached) {
        return cached.data;
      }
      return existingLock as Promise<T>;
    }

    // Create lock and fetch
    const fetchPromise = (async () => {
      try {
        const data = await fetchFn();
        await this.set(key, data, options);
        return data;
      } catch (error) {
        // If fetch fails but we have stale data, return it
        if (cached) {
          console.warn('[DistributedCache] Fetch failed, returning stale data');
          return cached.data;
        }
        throw error;
      }
    })();

    this.memory.setLock(fullKey, fetchPromise);

    // Return stale data while revalidating
    if (cached) {
      fetchPromise.catch(() => {}); // Don't block on background revalidation
      return cached.data;
    }

    return fetchPromise;
  }

  /**
   * Delete a cached value
   */
  async delete(key: string): Promise<void> {
    const fullKey = `${this.prefix}:${key}`;
    
    try {
      if (isKVAvailable()) {
        await db.delete(fullKey);
      }
      await this.memory.delete(fullKey);
    } catch (error) {
      console.error('[DistributedCache] Delete error:', error);
    }
  }

  /**
   * Delete all values with a given prefix
   */
  async deleteByPrefix(keyPrefix: string): Promise<number> {
    const fullPrefix = `${this.prefix}:${keyPrefix}`;
    let count = 0;

    try {
      // Memory cleanup
      count = await this.memory.deleteByPrefix(fullPrefix);
      
      // KV cleanup would require scanning - not implemented for performance
      // In production, use Redis SCAN or Vercel KV patterns
    } catch (error) {
      console.error('[DistributedCache] DeleteByPrefix error:', error);
    }

    return count;
  }

  /**
   * Delete all values with a given tag
   */
  async deleteByTag(tag: string): Promise<number> {
    try {
      return await this.memory.deleteByTag(tag);
    } catch (error) {
      console.error('[DistributedCache] DeleteByTag error:', error);
      return 0;
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats & { memory: { size: number; maxSize: number } } {
    return {
      ...this.stats,
      memory: this.memory.stats(),
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      staleHits: 0,
      errors: 0,
      backend: isKVAvailable() ? 'kv' : 'memory',
    };
  }
}

// =============================================================================
// SINGLETON INSTANCES
// =============================================================================

/** News data cache - short TTL */
export const newsCache = new DistributedCache('news');

/** Market data cache - very short TTL */
export const marketCache = new DistributedCache('market');

/** AI response cache - medium TTL */
export const aiCache = new DistributedCache('ai');

/** Translation cache - long TTL */
export const translationCache = new DistributedCache('i18n');

/** General purpose cache */
export const globalCache = new DistributedCache('global');

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Create a cached version of an async function
 */
export function cached<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  options: {
    cache: DistributedCache;
    keyFn: (...args: TArgs) => string;
    ttl: number;
    staleTtl?: number;
    tags?: string[];
  }
): (...args: TArgs) => Promise<TResult> {
  return async (...args: TArgs): Promise<TResult> => {
    const key = options.keyFn(...args);
    return options.cache.getOrSet(
      key,
      () => fn(...args),
      {
        ttl: options.ttl,
        staleTtl: options.staleTtl,
        tags: options.tags,
      }
    );
  };
}

/**
 * Cache key generator for API requests
 */
export function apiCacheKey(
  endpoint: string,
  params: Record<string, unknown>
): string {
  const sortedParams = Object.keys(params)
    .sort()
    .filter(k => params[k] !== undefined && params[k] !== null && params[k] !== '')
    .map(k => `${k}=${String(params[k])}`)
    .join('&');
  
  return `${endpoint}${sortedParams ? `:${sortedParams}` : ''}`;
}

// =============================================================================
// CACHE TTL PRESETS
// =============================================================================

export const CACHE_TTL = {
  /** Real-time data: 15 seconds fresh, 60 seconds stale */
  REALTIME: { ttl: 60, staleTtl: 15 },
  /** Price data: 30 seconds fresh, 2 minutes stale */
  PRICES: { ttl: 120, staleTtl: 30 },
  /** News: 2 minutes fresh, 10 minutes stale */
  NEWS: { ttl: 600, staleTtl: 120 },
  /** AI responses: 5 minutes fresh, 30 minutes stale */
  AI: { ttl: 1800, staleTtl: 300 },
  /** Static data: 1 hour fresh, 24 hours stale */
  STATIC: { ttl: 86400, staleTtl: 3600 },
  /** Translations: 24 hours fresh, 7 days stale */
  TRANSLATIONS: { ttl: 604800, staleTtl: 86400 },
} as const;

export default DistributedCache;
