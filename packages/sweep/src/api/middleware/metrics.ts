import { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';
import type { Context, MiddlewareHandler } from 'hono';

// Create a custom registry
export const metricsRegistry = new Registry();

// Collect default Node.js metrics (CPU, memory, event loop, etc.)
collectDefaultMetrics({ register: metricsRegistry });

// ============================================
// HTTP Metrics
// ============================================

// Request counter by route, method, and status
export const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status'],
  registers: [metricsRegistry],
});

// Request duration histogram
export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [metricsRegistry],
});

// Active connections gauge
export const httpActiveConnections = new Gauge({
  name: 'http_active_connections',
  help: 'Number of active HTTP connections',
  registers: [metricsRegistry],
});

// Request size histogram
export const httpRequestSize = new Histogram({
  name: 'http_request_size_bytes',
  help: 'HTTP request size in bytes',
  labelNames: ['method', 'route'],
  buckets: [100, 1000, 10000, 100000, 1000000],
  registers: [metricsRegistry],
});

// Response size histogram
export const httpResponseSize = new Histogram({
  name: 'http_response_size_bytes',
  help: 'HTTP response size in bytes',
  labelNames: ['method', 'route', 'status'],
  buckets: [100, 1000, 10000, 100000, 1000000],
  registers: [metricsRegistry],
});

// ============================================
// DeFi Protocol Metrics
// ============================================

// Protocol health gauge (1 = healthy, 0 = unhealthy)
export const defiProtocolHealth = new Gauge({
  name: 'defi_protocol_health',
  help: 'Health status of DeFi protocols (1 = healthy, 0 = unhealthy)',
  labelNames: ['protocol'],
  registers: [metricsRegistry],
});

// Swap volume in USD
export const defiSwapVolume = new Counter({
  name: 'defi_swap_volume_usd',
  help: 'Total swap volume in USD',
  labelNames: ['chain', 'protocol'],
  registers: [metricsRegistry],
});

// Swap count
export const defiSwapCount = new Counter({
  name: 'defi_swap_count_total',
  help: 'Total number of swaps',
  labelNames: ['chain', 'protocol', 'status'],
  registers: [metricsRegistry],
});

// DeFi API latency
export const defiApiLatency = new Histogram({
  name: 'defi_api_latency_seconds',
  help: 'DeFi API latency in seconds',
  labelNames: ['protocol', 'operation'],
  buckets: [0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30],
  registers: [metricsRegistry],
});

// DeFi API request counter
export const defiApiRequests = new Counter({
  name: 'defi_api_request_total',
  help: 'Total number of DeFi API requests',
  labelNames: ['protocol', 'operation'],
  registers: [metricsRegistry],
});

// DeFi API error counter
export const defiApiErrors = new Counter({
  name: 'defi_api_error_total',
  help: 'Total number of DeFi API errors',
  labelNames: ['protocol', 'operation', 'error_type'],
  registers: [metricsRegistry],
});

// ============================================
// RPC Metrics
// ============================================

// RPC latency by chain
export const rpcLatency = new Histogram({
  name: 'rpc_latency_seconds',
  help: 'RPC call latency in seconds',
  labelNames: ['chain', 'method'],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [metricsRegistry],
});

// RPC error counter
export const rpcErrors = new Counter({
  name: 'rpc_error_total',
  help: 'Total number of RPC errors',
  labelNames: ['chain', 'method', 'error_type'],
  registers: [metricsRegistry],
});

// ============================================
// Queue Metrics (BullMQ)
// ============================================

// Queue size gauge
export const bullmqQueueSize = new Gauge({
  name: 'bullmq_queue_waiting',
  help: 'Number of waiting jobs in queue',
  labelNames: ['queue'],
  registers: [metricsRegistry],
});

// Active jobs gauge
export const bullmqActiveJobs = new Gauge({
  name: 'bullmq_queue_active',
  help: 'Number of active jobs in queue',
  labelNames: ['queue'],
  registers: [metricsRegistry],
});

// Delayed jobs gauge
export const bullmqDelayedJobs = new Gauge({
  name: 'bullmq_queue_delayed',
  help: 'Number of delayed jobs in queue',
  labelNames: ['queue'],
  registers: [metricsRegistry],
});

// Completed jobs counter
export const bullmqCompletedJobs = new Counter({
  name: 'bullmq_queue_completed_total',
  help: 'Total number of completed jobs',
  labelNames: ['queue', 'chain'],
  registers: [metricsRegistry],
});

// Failed jobs counter
export const bullmqFailedJobs = new Counter({
  name: 'bullmq_queue_failed_total',
  help: 'Total number of failed jobs',
  labelNames: ['queue', 'chain', 'error_type'],
  registers: [metricsRegistry],
});

// Job duration histogram
export const bullmqJobDuration = new Histogram({
  name: 'bullmq_job_duration_seconds',
  help: 'Job processing duration in seconds',
  labelNames: ['queue', 'chain'],
  buckets: [0.1, 0.5, 1, 5, 10, 30, 60, 120, 300],
  registers: [metricsRegistry],
});

// ============================================
// Middleware
// ============================================

/**
 * Normalize route path for consistent metric labels
 * Replaces dynamic segments like UUIDs and addresses with placeholders
 */
function normalizeRoute(path: string): string {
  return path
    // Replace Ethereum addresses
    .replace(/0x[a-fA-F0-9]{40}/g, ':address')
    // Replace UUIDs
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':uuid')
    // Replace numeric IDs
    .replace(/\/\d+/g, '/:id')
    // Replace Solana addresses (base58)
    .replace(/[1-9A-HJ-NP-Za-km-z]{32,44}/g, ':address');
}

/**
 * Hono middleware for collecting HTTP metrics
 */
export function metricsMiddleware(): MiddlewareHandler {
  return async (c: Context, next: () => Promise<void>): Promise<void> => {
    // Skip metrics endpoint itself
    if (c.req.path === '/metrics') {
      await next();
      return;
    }

    const startTime = process.hrtime.bigint();
    
    // Track active connections
    httpActiveConnections.inc();

    // Track request size
    const requestSize = parseInt(c.req.header('content-length') || '0', 10);
    const route = normalizeRoute(c.req.path);
    
    if (requestSize > 0) {
      httpRequestSize.observe({ method: c.req.method, route }, requestSize);
    }

    try {
      await next();
    } finally {
      const endTime = process.hrtime.bigint();
      const durationSeconds = Number(endTime - startTime) / 1e9;
      const status = c.res.status.toString();

      // Record metrics
      httpRequestsTotal.inc({ method: c.req.method, route, status });
      httpRequestDuration.observe({ method: c.req.method, route, status }, durationSeconds);
      
      // Track response size
      const responseSize = parseInt(c.res.headers.get('content-length') || '0', 10);
      if (responseSize > 0) {
        httpResponseSize.observe({ method: c.req.method, route, status }, responseSize);
      }

      httpActiveConnections.dec();
    }
  };
}

/**
 * Hono handler for exposing metrics endpoint
 */
export async function metricsHandler(c: Context): Promise<Response> {
  try {
    const metrics = await metricsRegistry.metrics();
    return new Response(metrics, {
      headers: { 'Content-Type': metricsRegistry.contentType },
    });
  } catch (error) {
    return new Response(error instanceof Error ? error.message : 'Unknown error', {
      status: 500,
    });
  }
}

// ============================================
// Utility Functions
// ============================================

/**
 * Record DeFi API call metrics
 */
export function recordDefiApiCall(
  protocol: string,
  operation: string,
  durationMs: number,
  success: boolean,
  errorType?: string
): void {
  defiApiRequests.inc({ protocol, operation });
  defiApiLatency.observe({ protocol, operation }, durationMs / 1000);
  
  if (!success && errorType) {
    defiApiErrors.inc({ protocol, operation, error_type: errorType });
  }
}

/**
 * Record RPC call metrics
 */
export function recordRpcCall(
  chain: string,
  method: string,
  durationMs: number,
  success: boolean,
  errorType?: string
): void {
  rpcLatency.observe({ chain, method }, durationMs / 1000);
  
  if (!success && errorType) {
    rpcErrors.inc({ chain, method, error_type: errorType });
  }
}

/**
 * Update protocol health status
 */
export function setProtocolHealth(protocol: string, healthy: boolean): void {
  defiProtocolHealth.set({ protocol }, healthy ? 1 : 0);
}

/**
 * Record swap metrics
 */
export function recordSwap(
  chain: string,
  protocol: string,
  volumeUsd: number,
  success: boolean
): void {
  defiSwapCount.inc({ chain, protocol, status: success ? 'success' : 'failed' });
  
  if (success && volumeUsd > 0) {
    defiSwapVolume.inc({ chain, protocol }, volumeUsd);
  }
}

/**
 * Update queue metrics
 */
export function updateQueueMetrics(
  queue: string,
  waiting: number,
  active: number,
  delayed: number
): void {
  bullmqQueueSize.set({ queue }, waiting);
  bullmqActiveJobs.set({ queue }, active);
  bullmqDelayedJobs.set({ queue }, delayed);
}

/**
 * Record job completion
 */
export function recordJobCompletion(
  queue: string,
  chain: string,
  durationMs: number,
  success: boolean,
  errorType?: string
): void {
  bullmqJobDuration.observe({ queue, chain }, durationMs / 1000);
  
  if (success) {
    bullmqCompletedJobs.inc({ queue, chain });
  } else {
    bullmqFailedJobs.inc({ queue, chain, error_type: errorType || 'unknown' });
  }
}
