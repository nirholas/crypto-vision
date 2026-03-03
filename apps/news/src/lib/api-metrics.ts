/**
 * API Metrics Collection and Reporting
 * 
 * Tracks all API usage metrics including:
 * - Request counts by endpoint
 * - Response times (avg, p95, p99)
 * - Rate limit blocks with IP tracking
 * - Error tracking by code
 * 
 * Uses Vercel KV for distributed storage.
 */

import { kv } from '@vercel/kv';

// =============================================================================
// TYPES
// =============================================================================

export interface RequestMetric {
  timestamp: number;
  endpoint: string;
  method: string;
  statusCode: number;
  responseTime: number; // ms
  ip?: string;
  userAgent?: string;
  apiKeyPrefix?: string;
  isX402?: boolean;
  errorCode?: string;
}

export interface EndpointStats {
  endpoint: string;
  totalRequests: number;
  successCount: number;
  errorCount: number;
  avgResponseTime: number;
  responseTimes: number[]; // For percentile calculation
  lastRequest?: number;
}

export interface RateLimitBlock {
  ip: string;
  timestamp: number;
  endpoint?: string;
  keyPrefix?: string;
}

export interface AggregatedMetrics {
  period: {
    start: number;
    end: number;
    duration: string;
  };
  requests: {
    total: number;
    byStatus: Record<string, number>;
    byEndpoint: Record<string, number>;
    byMethod: Record<string, number>;
  };
  performance: {
    avgResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
    minResponseTime: number;
    maxResponseTime: number;
  };
  rateLimits: {
    totalBlocked: number;
    topBlockedIps: Array<{ ip: string; count: number }>;
  };
  errors: {
    total: number;
    byCode: Record<string, number>;
  };
  apiKeys: {
    activeKeysUsed: number;
    requestsByTier: Record<string, number>;
  };
}

// =============================================================================
// KV KEY PREFIXES
// =============================================================================

const KEYS = {
  // Hourly buckets for time-series data
  hourlyRequests: (hour: string) => `metrics:requests:hourly:${hour}`,
  hourlyTimes: (hour: string) => `metrics:times:hourly:${hour}`,
  
  // Endpoint aggregates
  endpoint: (ep: string) => `metrics:endpoint:${ep.replace(/\//g, ':')}`,
  
  // Rate limit tracking
  rateLimitBlocks: 'metrics:rate_limit_blocks',
  blockedIps: (hour: string) => `metrics:blocked_ips:${hour}`,
  
  // Error tracking
  errors: 'metrics:errors',
  errorsByHour: (hour: string) => `metrics:errors:hourly:${hour}`,
  
  // Response times for percentile calculation
  responseTimes: (hour: string) => `metrics:response_times:${hour}`,
  
  // Request counts
  requestCounts: 'metrics:requests',
  requestsByEndpoint: 'metrics:requests:by_endpoint',
  requestsByMethod: 'metrics:requests:by_method',
  
  // API key usage
  keyUsage: 'metrics:key_usage',
  tierUsage: 'metrics:tier_usage',
};

// =============================================================================
// METRIC COLLECTION
// =============================================================================

/**
 * Record an API request metric
 */
export async function recordRequest(metric: RequestMetric): Promise<void> {
  const hour = getHourBucket(metric.timestamp);
  
  try {
    // Use pipeline for atomic operations
    const pipeline = kv.pipeline();
    
    // 1. Increment total request count
    pipeline.hincrby(KEYS.requestCounts, String(metric.statusCode), 1);
    
    // 2. Track by endpoint
    pipeline.hincrby(KEYS.requestsByEndpoint, metric.endpoint, 1);
    
    // 3. Track by method
    pipeline.hincrby(KEYS.requestsByMethod, metric.method, 1);
    
    // 4. Store response time for percentile calculation
    pipeline.rpush(KEYS.responseTimes(hour), metric.responseTime);
    pipeline.expire(KEYS.responseTimes(hour), 7 * 24 * 60 * 60); // 7 days TTL
    
    // 5. Track hourly request counts
    pipeline.hincrby(KEYS.hourlyRequests(hour), metric.endpoint, 1);
    pipeline.expire(KEYS.hourlyRequests(hour), 7 * 24 * 60 * 60);
    
    // 6. Track errors
    if (metric.statusCode >= 400 && metric.errorCode) {
      pipeline.hincrby(KEYS.errors, metric.errorCode, 1);
      pipeline.hincrby(KEYS.errorsByHour(hour), metric.errorCode, 1);
      pipeline.expire(KEYS.errorsByHour(hour), 7 * 24 * 60 * 60);
    }
    
    // 7. Track API key usage
    if (metric.apiKeyPrefix) {
      pipeline.sadd(KEYS.keyUsage, metric.apiKeyPrefix);
    }
    
    await pipeline.exec();
    
    // Update endpoint aggregate (separate call for complex update)
    await updateEndpointStats(metric);
    
  } catch (error) {
    console.error('[api-metrics] Failed to record request:', error);
    // Don't throw - metrics shouldn't break request flow
  }
}

/**
 * Record a rate limit block
 */
export async function recordRateLimitBlock(block: RateLimitBlock): Promise<void> {
  const hour = getHourBucket(block.timestamp);
  
  try {
    const pipeline = kv.pipeline();
    
    // Increment total blocks
    pipeline.incr(KEYS.rateLimitBlocks);
    
    // Track blocked IP with count
    pipeline.hincrby(KEYS.blockedIps(hour), block.ip, 1);
    pipeline.expire(KEYS.blockedIps(hour), 7 * 24 * 60 * 60);
    
    await pipeline.exec();
  } catch (error) {
    console.error('[api-metrics] Failed to record rate limit block:', error);
  }
}

/**
 * Update endpoint-level statistics
 */
async function updateEndpointStats(metric: RequestMetric): Promise<void> {
  const key = KEYS.endpoint(metric.endpoint);
  
  try {
    // Get current stats
    const current = await kv.get<EndpointStats>(key) || {
      endpoint: metric.endpoint,
      totalRequests: 0,
      successCount: 0,
      errorCount: 0,
      avgResponseTime: 0,
      responseTimes: [],
    };
    
    // Update stats
    current.totalRequests++;
    if (metric.statusCode < 400) {
      current.successCount++;
    } else {
      current.errorCount++;
    }
    
    // Rolling average response time
    current.avgResponseTime = 
      (current.avgResponseTime * (current.totalRequests - 1) + metric.responseTime) / 
      current.totalRequests;
    
    // Keep last 1000 response times for percentiles
    current.responseTimes.push(metric.responseTime);
    if (current.responseTimes.length > 1000) {
      current.responseTimes = current.responseTimes.slice(-1000);
    }
    
    current.lastRequest = metric.timestamp;
    
    await kv.set(key, current);
  } catch (error) {
    console.error('[api-metrics] Failed to update endpoint stats:', error);
  }
}

// =============================================================================
// METRIC RETRIEVAL
// =============================================================================

/**
 * Get aggregated metrics for a time period
 */
export async function getMetrics(periodMs: number): Promise<AggregatedMetrics> {
  const now = Date.now();
  const startTime = now - periodMs;
  
  try {
    // Fetch all metrics from KV
    const [
      requestCountsRaw,
      requestsByEndpointRaw,
      requestsByMethodRaw,
      errorCountsRaw,
      rateLimitBlocksRaw,
    ] = await Promise.all([
      kv.hgetall<Record<string, number>>(KEYS.requestCounts),
      kv.hgetall<Record<string, number>>(KEYS.requestsByEndpoint),
      kv.hgetall<Record<string, number>>(KEYS.requestsByMethod),
      kv.hgetall<Record<string, number>>(KEYS.errors),
      kv.get<number>(KEYS.rateLimitBlocks),
    ]);
    
    // Handle null values
    const requestCounts = requestCountsRaw ?? {};
    const requestsByEndpoint = requestsByEndpointRaw ?? {};
    const requestsByMethod = requestsByMethodRaw ?? {};
    const errorCounts = errorCountsRaw ?? {};
    const rateLimitBlocks = rateLimitBlocksRaw ?? 0;
    
    // Get response times for percentile calculation
    const responseTimes = await getResponseTimesForPeriod(startTime, now);
    const { avg, p95, p99, min, max } = calculatePercentiles(responseTimes);
    
    // Get blocked IPs with counts
    const topBlockedIps = await getTopBlockedIps(startTime, now);
    
    // Get API key usage
    const activeKeysRaw = await kv.smembers(KEYS.keyUsage);
    const tierUsageRaw = await kv.hgetall<Record<string, number>>(KEYS.tierUsage);
    const activeKeys = activeKeysRaw ?? [];
    const tierUsage = tierUsageRaw ?? {};
    
    // Calculate totals
    const totalRequests = Object.values(requestCounts).reduce((a, b) => a + (b || 0), 0);
    const totalErrors = Object.values(errorCounts).reduce((a, b) => a + (b || 0), 0);
    
    return {
      period: {
        start: startTime,
        end: now,
        duration: formatDuration(periodMs),
      },
      requests: {
        total: totalRequests,
        byStatus: requestCounts,
        byEndpoint: requestsByEndpoint,
        byMethod: requestsByMethod,
      },
      performance: {
        avgResponseTime: avg,
        p95ResponseTime: p95,
        p99ResponseTime: p99,
        minResponseTime: min,
        maxResponseTime: max,
      },
      rateLimits: {
        totalBlocked: rateLimitBlocks,
        topBlockedIps,
      },
      errors: {
        total: totalErrors,
        byCode: errorCounts,
      },
      apiKeys: {
        activeKeysUsed: activeKeys.length,
        requestsByTier: tierUsage,
      },
    };
  } catch (error) {
    console.error('[api-metrics] Failed to get metrics:', error);
    throw error;
  }
}

/**
 * Get metrics for a specific endpoint
 */
export async function getEndpointMetrics(endpoint: string): Promise<EndpointStats | null> {
  const key = KEYS.endpoint(endpoint);
  return await kv.get<EndpointStats>(key);
}

/**
 * Get all endpoint metrics
 */
export async function getAllEndpointMetrics(): Promise<EndpointStats[]> {
  try {
    const keys = await kv.keys('metrics:endpoint:*');
    const metrics: EndpointStats[] = [];
    
    for (const key of keys) {
      const stats = await kv.get<EndpointStats>(key);
      if (stats) {
        metrics.push(stats);
      }
    }
    
    return metrics.sort((a, b) => b.totalRequests - a.totalRequests);
  } catch (error) {
    console.error('[api-metrics] Failed to get all endpoint metrics:', error);
    return [];
  }
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function getHourBucket(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.toISOString().slice(0, 13)}:00`; // YYYY-MM-DDTHH:00
}

async function getResponseTimesForPeriod(startTime: number, endTime: number): Promise<number[]> {
  const times: number[] = [];
  const startHour = new Date(startTime);
  const endHour = new Date(endTime);
  
  // Iterate through each hour in the period
  for (let hour = new Date(startHour); hour <= endHour; hour.setHours(hour.getHours() + 1)) {
    const hourKey = getHourBucket(hour.getTime());
    const hourTimes = await kv.lrange<number>(KEYS.responseTimes(hourKey), 0, -1);
    if (hourTimes) {
      times.push(...hourTimes);
    }
  }
  
  return times;
}

function calculatePercentiles(times: number[]): { avg: number; p95: number; p99: number; min: number; max: number } {
  if (times.length === 0) {
    return { avg: 0, p95: 0, p99: 0, min: 0, max: 0 };
  }
  
  const sorted = [...times].sort((a, b) => a - b);
  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  const p95Index = Math.floor(sorted.length * 0.95);
  const p99Index = Math.floor(sorted.length * 0.99);
  
  return {
    avg: Math.round(avg * 100) / 100,
    p95: sorted[p95Index] || 0,
    p99: sorted[p99Index] || 0,
    min: sorted[0] || 0,
    max: sorted[sorted.length - 1] || 0,
  };
}

async function getTopBlockedIps(startTime: number, endTime: number): Promise<Array<{ ip: string; count: number }>> {
  const ipCounts: Record<string, number> = {};
  const startHour = new Date(startTime);
  const endHour = new Date(endTime);
  
  // Aggregate blocked IPs across hours
  for (let hour = new Date(startHour); hour <= endHour; hour.setHours(hour.getHours() + 1)) {
    const hourKey = getHourBucket(hour.getTime());
    const hourBlocks = await kv.hgetall<Record<string, number>>(KEYS.blockedIps(hourKey));
    if (hourBlocks) {
      for (const [ip, count] of Object.entries(hourBlocks)) {
        ipCounts[ip] = (ipCounts[ip] || 0) + (count || 0);
      }
    }
  }
  
  // Sort by count and return top 10
  return Object.entries(ipCounts)
    .map(([ip, count]) => ({ ip, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}

function formatDuration(ms: number): string {
  if (ms < 60 * 60 * 1000) {
    return `${Math.round(ms / (60 * 1000))}m`;
  } else if (ms < 24 * 60 * 60 * 1000) {
    return `${Math.round(ms / (60 * 60 * 1000))}h`;
  } else {
    return `${Math.round(ms / (24 * 60 * 60 * 1000))}d`;
  }
}

// =============================================================================
// ADMIN UTILITIES
// =============================================================================

/**
 * Reset all metrics (admin only)
 */
export async function resetMetrics(): Promise<void> {
  const patterns = [
    'metrics:*',
  ];
  
  for (const pattern of patterns) {
    const keys = await kv.keys(pattern);
    for (const key of keys) {
      await kv.del(key);
    }
  }
  
  console.log('[api-metrics] All metrics reset');
}

/**
 * Record API key tier usage
 */
export async function recordTierUsage(tier: string): Promise<void> {
  await kv.hincrby(KEYS.tierUsage, tier, 1);
}

// =============================================================================
// API ROUTE WRAPPER
// =============================================================================

import { type NextRequest, NextResponse } from 'next/server';

type RouteHandler = (request: NextRequest, context?: unknown) => Promise<NextResponse>;

/**
 * Wrap an API route handler with automatic metrics collection
 * 
 * @example
 * ```typescript
 * import { withMetrics } from '@/lib/api-metrics';
 * 
 * export const GET = withMetrics('/api/news', async (request) => {
 *   // ... handle request
 *   return NextResponse.json({ data });
 * });
 * ```
 */
export function withMetrics(endpoint: string, handler: RouteHandler): RouteHandler {
  return async (request: NextRequest, context?: unknown): Promise<NextResponse> => {
    const startTime = Date.now();
    const method = request.method;
    
    // Extract client info
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
               request.headers.get('x-real-ip') || 
               'unknown';
    const userAgent = request.headers.get('user-agent') || undefined;
    const apiKey = request.headers.get('x-api-key') || 
                   request.headers.get('authorization')?.replace('Bearer ', '');
    const apiKeyPrefix = apiKey?.startsWith('cda_') ? apiKey.slice(0, 12) : undefined;
    const isX402 = !!(request.headers.get('x-payment') || request.headers.get('payment-signature'));
    
    let response: NextResponse;
    let errorCode: string | undefined;
    
    try {
      response = await handler(request, context);
    } catch (error) {
      // Handle errors and still record metrics
      errorCode = error instanceof Error ? error.name : 'UnknownError';
      response = NextResponse.json(
        { error: 'Internal Server Error' },
        { status: 500 }
      );
    }
    
    const responseTime = Date.now() - startTime;
    const statusCode = response.status;
    
    // Extract error code from response if it's an error
    if (statusCode >= 400 && !errorCode) {
      try {
        const body = await response.clone().json();
        errorCode = body.code || body.error || `HTTP_${statusCode}`;
      } catch {
        errorCode = `HTTP_${statusCode}`;
      }
    }
    
    // Record the metric asynchronously (don't block response)
    recordRequest({
      timestamp: startTime,
      endpoint,
      method,
      statusCode,
      responseTime,
      ip,
      userAgent,
      apiKeyPrefix,
      isX402,
      errorCode,
    }).catch((err) => {
      console.error('[api-metrics] Failed to record request:', err);
    });
    
    // Add performance headers
    response.headers.set('X-Response-Time', `${responseTime}ms`);
    
    return response;
  };
}

/**
 * Middleware-style metrics recording for use with existing handlers
 * Call this at the start and end of your handler
 */
export function createMetricsTimer(request: NextRequest, endpoint: string) {
  const startTime = Date.now();
  const method = request.method;
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
             request.headers.get('x-real-ip') || 
             'unknown';
  const userAgent = request.headers.get('user-agent') || undefined;
  const apiKey = request.headers.get('x-api-key') || 
                 request.headers.get('authorization')?.replace('Bearer ', '');
  const apiKeyPrefix = apiKey?.startsWith('cda_') ? apiKey.slice(0, 12) : undefined;
  const isX402 = !!(request.headers.get('x-payment') || request.headers.get('payment-signature'));
  
  return {
    /**
     * Call this when the request completes to record the metric
     */
    finish: (response: NextResponse, errorCode?: string) => {
      const responseTime = Date.now() - startTime;
      
      recordRequest({
        timestamp: startTime,
        endpoint,
        method,
        statusCode: response.status,
        responseTime,
        ip,
        userAgent,
        apiKeyPrefix,
        isX402,
        errorCode,
      }).catch((err) => {
        console.error('[api-metrics] Failed to record request:', err);
      });
      
      // Add performance header
      response.headers.set('X-Response-Time', `${responseTime}ms`);
      
      return response;
    },
    
    /**
     * Call this when rate limiting blocks the request
     */
    recordBlock: () => {
      recordRateLimitBlock({
        ip,
        timestamp: startTime,
        endpoint,
        keyPrefix: apiKeyPrefix,
      }).catch((err) => {
        console.error('[api-metrics] Failed to record rate limit block:', err);
      });
    },
  };
}
