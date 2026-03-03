/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// High-performance QR code cache with LRU eviction policy

import { getLogger } from './logger.js';
import type { QrCodeData } from '../types/index.js';

const logger = getLogger();

export interface QrCacheEntry {
  data: QrCodeData;
  timestamp: number;
  accessCount: number;
  lastAccessed: number;
}

export interface QrCacheOptions {
  maxEntries: number;
  ttlMs: number; // Time to live in milliseconds
  cleanupIntervalMs: number;
}

export class QrCache {
  private cache = new Map<string, QrCacheEntry>();
  private accessOrder: string[] = []; // For LRU tracking
  private cleanupTimer?: NodeJS.Timeout;
  private readonly options: QrCacheOptions;

  constructor(options: Partial<QrCacheOptions> = {}) {
    this.options = {
      maxEntries: options.maxEntries ?? 500, // Store up to 500 QRs
      ttlMs: options.ttlMs ?? 60 * 60 * 1000, // 1 hour TTL (payment expiry)
      cleanupIntervalMs: options.cleanupIntervalMs ?? 10 * 60 * 1000, // Cleanup every 10 minutes
    };

    this.startCleanupTimer();

    logger.info('QR cache initialized', {
      maxEntries: this.options.maxEntries,
      ttlMs: this.options.ttlMs,
      operation: 'qr_cache_init',
    });
  }

  /**
   * Generate cache key for QR code
   */
  private generateKey(
    identifier: string,
    qrType: string,
    size: number,
    style: string,
    branding: boolean
  ): string {
    return `${identifier}-${qrType}-${size}-${style}-${branding}`;
  }

  /**
   * Get QR from cache
   */
  get(
    identifier: string,
    qrType: string,
    size: number,
    style: string,
    branding: boolean
  ): QrCodeData | null {
    const key = this.generateKey(identifier, qrType, size, style, branding);
    const entry = this.cache.get(key);

    if (!entry) {
      logger.debug('QR cache miss', { key, operation: 'qr_cache_miss' });
      return null;
    }

    const now = Date.now();

    // Check if entry has expired
    if (now - entry.timestamp > this.options.ttlMs) {
      logger.debug('QR cache entry expired', {
        key,
        age: now - entry.timestamp,
        operation: 'qr_cache_expired',
      });
      this.cache.delete(key);
      this.removeFromAccessOrder(key);
      return null;
    }

    // Update access tracking
    entry.accessCount++;
    entry.lastAccessed = now;
    this.updateAccessOrder(key);

    logger.debug('QR cache hit', {
      key,
      accessCount: entry.accessCount,
      operation: 'qr_cache_hit',
    });

    return entry.data;
  }

  /**
   * Store QR in cache
   */
  set(
    identifier: string,
    qrType: string,
    size: number,
    style: string,
    branding: boolean,
    qrData: QrCodeData
  ): void {
    const key = this.generateKey(identifier, qrType, size, style, branding);
    const now = Date.now();

    // If cache is full, remove least recently used entry
    if (this.cache.size >= this.options.maxEntries && !this.cache.has(key)) {
      this.evictLRU();
    }

    const entry: QrCacheEntry = {
      data: qrData,
      timestamp: now,
      accessCount: 1,
      lastAccessed: now,
    };

    this.cache.set(key, entry);
    this.updateAccessOrder(key);

    logger.debug('QR cached', {
      key,
      cacheSize: this.cache.size,
      operation: 'qr_cache_set',
    });
  }

  /**
   * Update access order for LRU tracking
   */
  private updateAccessOrder(key: string): void {
    // Remove from current position
    this.removeFromAccessOrder(key);
    // Add to end (most recently used)
    this.accessOrder.push(key);
  }

  /**
   * Remove key from access order array
   */
  private removeFromAccessOrder(key: string): void {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
  }

  /**
   * Evict least recently used entry
   */
  private evictLRU(): void {
    if (this.accessOrder.length === 0) return;

    const lruKey = this.accessOrder[0];
    if (lruKey) {
      this.cache.delete(lruKey);
      this.accessOrder.shift();

      logger.debug('QR cache LRU eviction', {
        evictedKey: lruKey,
        cacheSize: this.cache.size,
        operation: 'qr_cache_evict',
      });
    }
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    let expiredCount = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.options.ttlMs) {
        this.cache.delete(key);
        this.removeFromAccessOrder(key);
        expiredCount++;
      }
    }

    if (expiredCount > 0) {
      logger.debug('QR cache cleanup completed', {
        expiredCount,
        remainingEntries: this.cache.size,
        operation: 'qr_cache_cleanup',
      });
    }
  }

  /**
   * Start periodic cleanup timer
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.options.cleanupIntervalMs);
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    maxSize: number;
    hitRate: number;
    oldestEntryAge: number;
    memoryUsage: number;
  } {
    let totalAccesses = 0;
    let hits = 0;
    let oldestTimestamp = Date.now();
    let memoryUsage = 0;

    for (const entry of this.cache.values()) {
      totalAccesses += entry.accessCount;
      if (entry.accessCount > 1) {
        hits += entry.accessCount - 1; // First access is not a hit
      }
      if (entry.timestamp < oldestTimestamp) {
        oldestTimestamp = entry.timestamp;
      }
      // Rough memory calculation (base64 string + metadata)
      memoryUsage += entry.data.data.length + 200;
    }

    return {
      size: this.cache.size,
      maxSize: this.options.maxEntries,
      hitRate: totalAccesses > 0 ? hits / totalAccesses : 0,
      oldestEntryAge: Date.now() - oldestTimestamp,
      memoryUsage,
    };
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
    logger.info('QR cache cleared', { operation: 'qr_cache_clear' });
  }

  /**
   * Gracefully shutdown cache
   */
  shutdown(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
    this.clear();
    logger.info('QR cache shutdown', { operation: 'qr_cache_shutdown' });
  }

  /**
   * Check if cache contains a specific QR
   */
  has(
    identifier: string,
    qrType: string,
    size: number,
    style: string,
    branding: boolean
  ): boolean {
    const key = this.generateKey(identifier, qrType, size, style, branding);
    const entry = this.cache.get(key);

    if (!entry) return false;

    // Check if expired
    const now = Date.now();
    if (now - entry.timestamp > this.options.ttlMs) {
      this.cache.delete(key);
      this.removeFromAccessOrder(key);
      return false;
    }

    return true;
  }

  /**
   * Preload QR codes for common scenarios
   */
  async preload(
    commonScenarios: Array<{
      identifier: string;
      qrType: string;
      size: number;
      style: string;
      branding: boolean;
      qrData: QrCodeData;
    }>
  ): Promise<void> {
    for (const scenario of commonScenarios) {
      this.set(
        scenario.identifier,
        scenario.qrType,
        scenario.size,
        scenario.style,
        scenario.branding,
        scenario.qrData
      );
    }

    logger.info('QR cache preload completed', {
      preloadedCount: commonScenarios.length,
      operation: 'qr_cache_preload',
    });
  }
}

// Global QR cache instance
let globalQrCache: QrCache | null = null;

/**
 * Get or create global QR cache instance
 */
export function getQrCache(): QrCache {
  if (!globalQrCache) {
    globalQrCache = new QrCache();
  }
  return globalQrCache;
}

/**
 * Initialize QR cache with custom options
 */
export function initializeQrCache(
  options: Partial<QrCacheOptions> = {}
): QrCache {
  if (globalQrCache) {
    globalQrCache.shutdown();
  }
  globalQrCache = new QrCache(options);
  return globalQrCache;
}

/**
 * Shutdown global QR cache
 */
export function shutdownQrCache(): void {
  if (globalQrCache) {
    globalQrCache.shutdown();
    globalQrCache = null;
  }
}
