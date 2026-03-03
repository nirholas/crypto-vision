/**
 * Redis Cache Layer
 * Production-ready caching with Redis support
 * Falls back to existing memory cache if Redis unavailable
 * 
 * Supports both:
 * - Traditional Redis (REDIS_URL)
 * - Upstash REST API (UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN)
 */

import { newsCache, aiCache, translationCache, withCache as memoryWithCache } from './cache';

// =============================================================================
// UPSTASH REST CLIENT (for serverless/edge)
// =============================================================================

class UpstashClient {
  private url: string;
  private token: string;
  
  constructor(url: string, token: string) {
    this.url = url;
    this.token = token;
  }
  
  async execute<T>(command: string, ...args: (string | number)[]): Promise<T> {
    const response = await fetch(this.url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([command, ...args]),
    });
    
    if (!response.ok) {
      throw new Error(`Upstash error: ${response.statusText}`);
    }
    
    const data = await response.json();
    if (data.error) throw new Error(data.error);
    return data.result;
  }
  
  async pipeline<T>(commands: Array<[string, ...(string | number)[]]>): Promise<T[]> {
    const response = await fetch(`${this.url}/pipeline`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(commands),
    });
    
    if (!response.ok) {
      throw new Error(`Upstash pipeline error: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.map((r: any) => r.result);
  }
}

let upstashClient: UpstashClient | null = null;

function getUpstashClient(): UpstashClient | null {
  if (upstashClient) return upstashClient;
  
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  
  if (url && token) {
    upstashClient = new UpstashClient(url, token);
    return upstashClient;
  }
  
  return null;
}

// Redis client placeholder - initialized lazily
let redisClient: any = null;
let redisAvailable = false;
let initPromise: Promise<boolean> | null = null;

/**
 * Initialize Redis connection
 */
export async function initRedis(): Promise<boolean> {
  if (!process.env.REDIS_URL) {
    console.log('[Redis] REDIS_URL not set, using memory cache');
    return false;
  }

  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      // Dynamic import to avoid bundling in edge runtime
      // @ts-expect-error - dynamic import of optional redis package
      const { createClient } = await import('redis');

      redisClient = createClient({
        url: process.env.REDIS_URL,
        socket: {
          connectTimeout: 5000,
          reconnectStrategy: (retries: number) => {
            if (retries > 3) {
              console.error('[Redis] Max retries reached, falling back to memory');
              return new Error('Max retries');
            }
            return Math.min(retries * 200, 3000);
          },
        },
      });

      redisClient.on('error', (err: Error) => {
        console.error('[Redis] Error:', err.message);
        redisAvailable = false;
      });

      redisClient.on('connect', () => {
        console.log('[Redis] Connected');
        redisAvailable = true;
      });

      redisClient.on('disconnect', () => {
        console.log('[Redis] Disconnected');
        redisAvailable = false;
      });

      await redisClient.connect();
      redisAvailable = true;
      console.log('[Redis] Initialization successful');
      return true;
    } catch (error) {
      console.error('[Redis] Init failed:', error);
      redisAvailable = false;
      return false;
    }
  })();

  return initPromise;
}

/**
 * Get value from Redis or memory cache
 */
export async function redisGet<T>(key: string): Promise<T | null> {
  try {
    if (redisAvailable && redisClient?.isReady) {
      const value = await redisClient.get(key);
      if (value) {
        return JSON.parse(value) as T;
      }
    }
  } catch (error) {
    console.error('[Redis] Get error:', error);
  }

  // Fallback to memory cache
  return newsCache.get<T>(key);
}

/**
 * Set value in Redis and memory cache
 */
export async function redisSet<T>(
  key: string,
  value: T,
  ttlSeconds: number = 300
): Promise<boolean> {
  const serialized = JSON.stringify(value);

  // Always set in memory cache as backup
  newsCache.set(key, value, ttlSeconds);

  try {
    if (redisAvailable && redisClient?.isReady) {
      await redisClient.setEx(key, ttlSeconds, serialized);
      return true;
    }
  } catch (error) {
    console.error('[Redis] Set error:', error);
  }

  return true; // Memory cache succeeded
}

/**
 * Delete value from both caches
 */
export async function redisDel(key: string): Promise<boolean> {
  newsCache.delete(key);

  try {
    if (redisAvailable && redisClient?.isReady) {
      await redisClient.del(key);
    }
  } catch (error) {
    console.error('[Redis] Del error:', error);
  }

  return true;
}

/**
 * Delete keys matching pattern
 */
export async function redisDelPattern(pattern: string): Promise<number> {
  let count = 0;

  try {
    if (redisAvailable && redisClient?.isReady) {
      const keys = await redisClient.keys(pattern);
      if (keys.length > 0) {
        count = await redisClient.del(keys);
      }
    }
  } catch (error) {
    console.error('[Redis] Del pattern error:', error);
  }

  return count;
}

/**
 * Get Redis stats
 */
export async function getRedisStats(): Promise<{
  type: 'redis' | 'memory';
  connected: boolean;
  keys?: number;
  memoryUsage?: string;
  memoryCacheSize: number;
}> {
  const memoryCacheSize = newsCache.stats().size;

  if (redisAvailable && redisClient?.isReady) {
    try {
      const info = await redisClient.info('memory');
      const dbSize = await redisClient.dbSize();
      const memMatch = info.match(/used_memory_human:([^\r\n]+)/);

      return {
        type: 'redis',
        connected: true,
        keys: dbSize,
        memoryUsage: memMatch ? memMatch[1].trim() : undefined,
        memoryCacheSize,
      };
    } catch {
      // Fall through to memory stats
    }
  }

  return {
    type: 'memory',
    connected: true,
    memoryCacheSize,
  };
}

/**
 * Cache wrapper with Redis support
 */
export async function withRedisCache<T>(
  key: string,
  ttlSeconds: number,
  fetchFn: () => Promise<T>
): Promise<T> {
  // Try cache first
  const cached = await redisGet<T>(key);
  if (cached !== null) {
    return cached;
  }

  // Fetch fresh data
  const data = await fetchFn();

  // Cache result
  await redisSet(key, data, ttlSeconds);

  return data;
}

/**
 * Cache key builders
 */
export const redisKeys = {
  // News feeds
  newsFeed: (params?: { source?: string; category?: string; page?: number; limit?: number }) => {
    const parts = ['news'];
    if (params?.source) parts.push(`s:${params.source}`);
    if (params?.category) parts.push(`c:${params.category}`);
    if (params?.page) parts.push(`p:${params.page}`);
    if (params?.limit) parts.push(`l:${params.limit}`);
    return parts.join(':');
  },

  // Single article
  article: (id: string) => `article:${id}`,

  // Search results
  search: (query: string, page?: number) => {
    const normalized = query.toLowerCase().trim().replace(/\s+/g, '-').slice(0, 50);
    return page ? `search:${normalized}:p${page}` : `search:${normalized}`;
  },

  // Trending/breaking
  trending: () => 'news:trending',
  breaking: () => 'news:breaking',

  // Sources list
  sources: () => 'sources:all',

  // Market data
  marketPrice: (coinId: string) => `market:price:${coinId}`,
  marketHistory: (coinId: string, days: number) => `market:history:${coinId}:${days}d`,

  // User data (use with userId prefix)
  userAlerts: (userId: string) => `user:${userId}:alerts`,
  userPortfolio: (userId: string) => `user:${userId}:portfolio`,
  userBookmarks: (userId: string) => `user:${userId}:bookmarks`,

  // AI responses
  aiSummary: (articleId: string) => `ai:summary:${articleId}`,
  aiSentiment: (articleId: string) => `ai:sentiment:${articleId}`,
  aiTranslation: (articleId: string, lang: string) => `ai:translate:${articleId}:${lang}`,
};

/**
 * TTL presets (in seconds)
 */
export const redisTTL = {
  // News content
  NEWS_FEED: 300, // 5 minutes
  ARTICLE: 3600, // 1 hour
  SEARCH: 600, // 10 minutes
  TRENDING: 300, // 5 minutes
  BREAKING: 60, // 1 minute
  SOURCES: 3600, // 1 hour

  // Market data
  MARKET_PRICE: 30, // 30 seconds
  MARKET_HISTORY: 300, // 5 minutes

  // User data
  USER_ALERTS: 300, // 5 minutes
  USER_PORTFOLIO: 300, // 5 minutes
  USER_BOOKMARKS: 600, // 10 minutes

  // AI responses
  AI_SUMMARY: 86400, // 24 hours
  AI_SENTIMENT: 86400, // 24 hours
  AI_TRANSLATION: 86400, // 24 hours
};

// Auto-initialize in server environment
if (typeof window === 'undefined' && process.env.REDIS_URL) {
  initRedis().catch(console.error);
}

// =============================================================================
// RATE LIMITING
// =============================================================================

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetIn: number; // milliseconds
  limit: number;
}

// In-memory rate limit store for fallback
const memoryRateLimits = new Map<string, { count: number; resetAt: number }>();

/**
 * Sliding window rate limiter using Redis sorted sets
 */
export async function rateLimit(
  identifier: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult> {
  const upstash = getUpstashClient();
  const now = Date.now();
  const windowStart = now - windowMs;
  const key = `ratelimit:${identifier}`;
  
  // Try Upstash first (works in serverless/edge)
  if (upstash) {
    try {
      const results = await upstash.pipeline<number>([
        ['ZREMRANGEBYSCORE', key, 0, windowStart],
        ['ZCARD', key],
        ['ZADD', key, now, `${now}-${Math.random().toString(36).slice(2)}`],
        ['PEXPIRE', key, windowMs],
      ]);
      
      const count = results[1];
      const allowed = count < limit;
      const remaining = Math.max(0, limit - count - (allowed ? 1 : 0));
      
      return { allowed, remaining, resetIn: windowMs, limit };
    } catch (error) {
      console.error('[RateLimit] Upstash error:', error);
    }
  }
  
  // Try traditional Redis
  if (redisAvailable && redisClient?.isReady) {
    try {
      await redisClient.zRemRangeByScore(key, 0, windowStart);
      const count = await redisClient.zCard(key);
      await redisClient.zAdd(key, { score: now, value: `${now}-${Math.random()}` });
      await redisClient.pExpire(key, windowMs);
      
      const allowed = count < limit;
      const remaining = Math.max(0, limit - count - (allowed ? 1 : 0));
      
      return { allowed, remaining, resetIn: windowMs, limit };
    } catch (error) {
      console.error('[RateLimit] Redis error:', error);
    }
  }
  
  // Fallback to memory (per-instance, not distributed)
  const entry = memoryRateLimits.get(key);
  
  if (!entry || now > entry.resetAt) {
    memoryRateLimits.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, resetIn: windowMs, limit };
  }
  
  entry.count++;
  const allowed = entry.count <= limit;
  
  return {
    allowed,
    remaining: Math.max(0, limit - entry.count),
    resetIn: entry.resetAt - now,
    limit,
  };
}

/**
 * Rate limit tiers
 */
export const rateLimitTiers = {
  FREE: { requests: 100, windowMs: 24 * 60 * 60 * 1000 }, // 100/day
  PRO: { requests: 10000, windowMs: 24 * 60 * 60 * 1000 }, // 10k/day
  ENTERPRISE: { requests: 100000, windowMs: 24 * 60 * 60 * 1000 }, // 100k/day
  BURST: { requests: 60, windowMs: 60 * 1000 }, // 60/minute burst
};

/**
 * Check rate limit for an API key or IP
 */
export async function checkRateLimit(
  identifier: string,
  tier: 'FREE' | 'PRO' | 'ENTERPRISE' = 'FREE'
): Promise<RateLimitResult & { headers: Record<string, string> }> {
  const tierConfig = rateLimitTiers[tier];
  const result = await rateLimit(identifier, tierConfig.requests, tierConfig.windowMs);
  
  // Also check burst limit
  const burstResult = await rateLimit(`burst:${identifier}`, rateLimitTiers.BURST.requests, rateLimitTiers.BURST.windowMs);
  
  // Use the more restrictive result
  const finalResult = burstResult.allowed ? result : burstResult;
  
  return {
    ...finalResult,
    headers: {
      'X-RateLimit-Limit': String(finalResult.limit),
      'X-RateLimit-Remaining': String(finalResult.remaining),
      'X-RateLimit-Reset': String(Math.ceil((Date.now() + finalResult.resetIn) / 1000)),
      'Retry-After': finalResult.allowed ? '' : String(Math.ceil(finalResult.resetIn / 1000)),
    },
  };
}

// =============================================================================
// ANALYTICS
// =============================================================================

interface AnalyticsEvent {
  endpoint: string;
  method: string;
  statusCode: number;
  latencyMs: number;
  apiKey?: string;
  ip?: string;
  userAgent?: string;
  timestamp?: number;
}

/**
 * Track an API request for analytics
 */
export async function trackRequest(event: AnalyticsEvent): Promise<void> {
  const upstash = getUpstashClient();
  const timestamp = event.timestamp || Date.now();
  const dateKey = new Date(timestamp).toISOString().slice(0, 10); // YYYY-MM-DD
  const hourKey = new Date(timestamp).toISOString().slice(0, 13); // YYYY-MM-DDTHH
  
  const commands: Array<[string, ...(string | number)[]]> = [
    // Total requests counter
    ['INCR', `analytics:requests:total`],
    // Daily requests
    ['INCR', `analytics:requests:daily:${dateKey}`],
    // Hourly requests
    ['INCR', `analytics:requests:hourly:${hourKey}`],
    // Per-endpoint counter
    ['INCR', `analytics:endpoint:${event.endpoint}:${dateKey}`],
    // Status code counter
    ['INCR', `analytics:status:${event.statusCode}:${dateKey}`],
    // Latency sum for averaging
    ['INCRBY', `analytics:latency:sum:${dateKey}`, Math.round(event.latencyMs)],
    ['INCR', `analytics:latency:count:${dateKey}`],
    // Set expiry on daily keys (30 days)
    ['EXPIRE', `analytics:requests:daily:${dateKey}`, 30 * 24 * 60 * 60],
    ['EXPIRE', `analytics:endpoint:${event.endpoint}:${dateKey}`, 30 * 24 * 60 * 60],
    ['EXPIRE', `analytics:status:${event.statusCode}:${dateKey}`, 30 * 24 * 60 * 60],
    ['EXPIRE', `analytics:latency:sum:${dateKey}`, 30 * 24 * 60 * 60],
    ['EXPIRE', `analytics:latency:count:${dateKey}`, 30 * 24 * 60 * 60],
  ];
  
  // Track unique users (HyperLogLog)
  if (event.apiKey) {
    commands.push(['PFADD', `analytics:unique:apikeys:${dateKey}`, event.apiKey]);
    commands.push(['EXPIRE', `analytics:unique:apikeys:${dateKey}`, 30 * 24 * 60 * 60]);
  }
  if (event.ip) {
    commands.push(['PFADD', `analytics:unique:ips:${dateKey}`, event.ip]);
    commands.push(['EXPIRE', `analytics:unique:ips:${dateKey}`, 30 * 24 * 60 * 60]);
  }
  
  // Add to latency percentile tracking (sorted set)
  commands.push(['ZADD', `analytics:latency:dist:${dateKey}`, event.latencyMs, `${timestamp}-${Math.random()}`]);
  commands.push(['EXPIRE', `analytics:latency:dist:${dateKey}`, 30 * 24 * 60 * 60]);
  
  // Execute in Upstash
  if (upstash) {
    try {
      await upstash.pipeline(commands);
      return;
    } catch (error) {
      console.error('[Analytics] Upstash error:', error);
    }
  }
  
  // Try traditional Redis
  if (redisAvailable && redisClient?.isReady) {
    try {
      const pipeline = redisClient.multi();
      for (const [cmd, ...args] of commands) {
        (pipeline as any)[cmd.toLowerCase()](...args);
      }
      await pipeline.exec();
    } catch (error) {
      console.error('[Analytics] Redis error:', error);
    }
  }
  
  // No memory fallback for analytics - they're non-critical
}

/**
 * Get analytics summary
 */
export async function getAnalytics(dateKey?: string): Promise<{
  totalRequests: number;
  dailyRequests: number;
  uniqueApiKeys: number;
  uniqueIps: number;
  averageLatencyMs: number;
  statusBreakdown: Record<string, number>;
  topEndpoints: Array<{ endpoint: string; count: number }>;
}> {
  const date = dateKey || new Date().toISOString().slice(0, 10);
  const upstash = getUpstashClient();
  
  const defaultResult = {
    totalRequests: 0,
    dailyRequests: 0,
    uniqueApiKeys: 0,
    uniqueIps: 0,
    averageLatencyMs: 0,
    statusBreakdown: {},
    topEndpoints: [],
  };
  
  if (upstash) {
    try {
      const [total, daily, uniqueKeys, uniqueIps, latencySum, latencyCount] = await upstash.pipeline<number>([
        ['GET', 'analytics:requests:total'],
        ['GET', `analytics:requests:daily:${date}`],
        ['PFCOUNT', `analytics:unique:apikeys:${date}`],
        ['PFCOUNT', `analytics:unique:ips:${date}`],
        ['GET', `analytics:latency:sum:${date}`],
        ['GET', `analytics:latency:count:${date}`],
      ]);
      
      return {
        totalRequests: total || 0,
        dailyRequests: daily || 0,
        uniqueApiKeys: uniqueKeys || 0,
        uniqueIps: uniqueIps || 0,
        averageLatencyMs: latencyCount ? Math.round((latencySum || 0) / latencyCount) : 0,
        statusBreakdown: {}, // Would need additional queries
        topEndpoints: [], // Would need SCAN + GET operations
      };
    } catch (error) {
      console.error('[Analytics] Get error:', error);
    }
  }
  
  return defaultResult;
}

export default {
  get: redisGet,
  set: redisSet,
  del: redisDel,
  delPattern: redisDelPattern,
  stats: getRedisStats,
  withCache: withRedisCache,
  keys: redisKeys,
  ttl: redisTTL,
  init: initRedis,
  rateLimit,
  checkRateLimit,
  rateLimitTiers,
  trackRequest,
  getAnalytics,
};
