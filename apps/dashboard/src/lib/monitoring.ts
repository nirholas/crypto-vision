/**
 * Structured Logging & Metrics System
 * 
 * Provides consistent logging format, request tracing,
 * and metrics collection for API monitoring.
 * 
 * Features:
 * - Structured JSON logging
 * - Request ID tracing
 * - Performance metrics
 * - Error tracking
 * - Rate limit monitoring
 * 
 * @module monitoring
 */

// =============================================================================
// LOG LEVELS
// =============================================================================

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  fatal: 50,
};

const MIN_LOG_LEVEL = LOG_LEVELS[
  (process.env.LOG_LEVEL as LogLevel) || (process.env.NODE_ENV === 'production' ? 'info' : 'debug')
];

// =============================================================================
// TYPES
// =============================================================================

export interface LogContext {
  requestId?: string;
  endpoint?: string;
  method?: string;
  userId?: string;
  apiKey?: string;
  duration?: number;
  statusCode?: number;
  error?: Error | string;
  metadata?: Record<string, unknown>;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  service: string;
  version: string;
  environment: string;
  requestId?: string;
  endpoint?: string;
  method?: string;
  userId?: string;
  duration?: number;
  statusCode?: number;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  metadata?: Record<string, unknown>;
}

export interface MetricEntry {
  name: string;
  value: number;
  unit: string;
  tags: Record<string, string>;
  timestamp: string;
}

// =============================================================================
// CONFIGURATION
// =============================================================================

const SERVICE_NAME = 'crypto-data-api';
const SERVICE_VERSION = '2.0.0';
const ENVIRONMENT = process.env.NODE_ENV || 'development';

// =============================================================================
// REQUEST ID GENERATION
// =============================================================================

let requestCounter = 0;

export function generateRequestId(): string {
  const timestamp = Date.now().toString(36);
  const counter = (++requestCounter % 0xFFFF).toString(16).padStart(4, '0');
  const random = Math.random().toString(36).substring(2, 6);
  return `${timestamp}-${counter}-${random}`;
}

// =============================================================================
// LOGGER CLASS
// =============================================================================

class Logger {
  private context: LogContext = {};

  /**
   * Create a child logger with additional context
   */
  child(context: LogContext): Logger {
    const child = new Logger();
    child.context = { ...this.context, ...context };
    return child;
  }

  /**
   * Set context for this logger instance
   */
  setContext(context: LogContext): void {
    this.context = { ...this.context, ...context };
  }

  debug(message: string, metadata?: Record<string, unknown>): void {
    this.log('debug', message, metadata);
  }

  info(message: string, metadata?: Record<string, unknown>): void {
    this.log('info', message, metadata);
  }

  warn(message: string, metadata?: Record<string, unknown>): void {
    this.log('warn', message, metadata);
  }

  error(message: string, error?: Error | string, metadata?: Record<string, unknown>): void {
    this.log('error', message, { ...metadata, error });
  }

  fatal(message: string, error?: Error | string, metadata?: Record<string, unknown>): void {
    this.log('fatal', message, { ...metadata, error });
  }

  private log(level: LogLevel, message: string, extra?: Record<string, unknown>): void {
    if (LOG_LEVELS[level] < MIN_LOG_LEVEL) return;

    const errorData = extra?.error 
      ? this.formatError(extra.error as Error | string)
      : undefined;

    // Exclude error from context spread
    const { error: _ctxError, ...contextWithoutError } = this.context;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      service: SERVICE_NAME,
      version: SERVICE_VERSION,
      environment: ENVIRONMENT,
      ...contextWithoutError,
      error: errorData,
      metadata: extra?.error ? undefined : extra,
    };

    // Clean undefined values
    const cleaned = JSON.parse(JSON.stringify(entry));

    // Output as JSON in production, pretty print in development
    if (ENVIRONMENT === 'production') {
      console.log(JSON.stringify(cleaned));
    } else {
      const color = this.getColor(level);
      console.log(
        `${color}[${level.toUpperCase()}]\x1b[0m`,
        `[${entry.requestId || '-'}]`,
        message,
        extra ? JSON.stringify(extra, null, 2) : ''
      );
    }
  }

  private formatError(error: Error | string): { name: string; message: string; stack?: string } {
    if (typeof error === 'string') {
      return { name: 'Error', message: error };
    }
    return {
      name: error.name,
      message: error.message,
      stack: ENVIRONMENT === 'development' ? error.stack : undefined,
    };
  }

  private getColor(level: LogLevel): string {
    switch (level) {
      case 'debug': return '\x1b[36m'; // Cyan
      case 'info': return '\x1b[32m';  // Green
      case 'warn': return '\x1b[33m';  // Yellow
      case 'error': return '\x1b[31m'; // Red
      case 'fatal': return '\x1b[35m'; // Magenta
      default: return '\x1b[0m';
    }
  }
}

// Default logger instance
export const logger = new Logger();

// =============================================================================
// METRICS COLLECTOR
// =============================================================================

interface MetricData {
  count: number;
  sum: number;
  min: number;
  max: number;
  values: number[];
}

class MetricsCollector {
  private metrics: Map<string, MetricData> = new Map();
  private histogramWindow = 60 * 1000; // 1 minute
  private lastFlush = Date.now();

  /**
   * Record a counter metric
   */
  increment(name: string, value: number = 1, tags: Record<string, string> = {}): void {
    const key = this.buildKey(name, tags);
    const existing = this.metrics.get(key) || this.createMetricData();
    existing.count += value;
    this.metrics.set(key, existing);
  }

  /**
   * Record a gauge metric
   */
  gauge(name: string, value: number, tags: Record<string, string> = {}): void {
    const key = this.buildKey(name, tags);
    this.metrics.set(key, {
      count: 1,
      sum: value,
      min: value,
      max: value,
      values: [value],
    });
  }

  /**
   * Record a histogram metric (for latencies, etc.)
   */
  histogram(name: string, value: number, tags: Record<string, string> = {}): void {
    const key = this.buildKey(name, tags);
    const existing = this.metrics.get(key) || this.createMetricData();
    existing.count++;
    existing.sum += value;
    existing.min = Math.min(existing.min, value);
    existing.max = Math.max(existing.max, value);
    existing.values.push(value);
    
    // Keep only last 1000 values
    if (existing.values.length > 1000) {
      existing.values = existing.values.slice(-1000);
    }
    
    this.metrics.set(key, existing);
  }

  /**
   * Record request latency
   */
  recordLatency(endpoint: string, duration: number, statusCode: number): void {
    this.histogram('api.request.duration', duration, { endpoint, status: String(statusCode) });
    this.increment('api.request.count', 1, { endpoint, status: String(statusCode) });
  }

  /**
   * Record an error
   */
  recordError(endpoint: string, errorCode: string): void {
    this.increment('api.error.count', 1, { endpoint, code: errorCode });
  }

  /**
   * Record rate limit hit
   */
  recordRateLimit(endpoint: string): void {
    this.increment('api.ratelimit.hit', 1, { endpoint });
  }

  /**
   * Record cache hit/miss
   */
  recordCache(hit: boolean, source: string = 'default'): void {
    this.increment(`api.cache.${hit ? 'hit' : 'miss'}`, 1, { source });
  }

  /**
   * Get current metrics snapshot
   */
  getSnapshot(): Record<string, { avg: number; min: number; max: number; count: number; p95?: number }> {
    const snapshot: Record<string, any> = {};
    
    for (const [key, data] of this.metrics.entries()) {
      snapshot[key] = {
        count: data.count,
        avg: data.count > 0 ? Math.round(data.sum / data.count) : 0,
        min: data.min === Infinity ? 0 : data.min,
        max: data.max === -Infinity ? 0 : data.max,
        p95: this.calculatePercentile(data.values, 95),
      };
    }
    
    return snapshot;
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.metrics.clear();
    this.lastFlush = Date.now();
  }

  private buildKey(name: string, tags: Record<string, string>): string {
    const tagStr = Object.entries(tags)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join(',');
    return tagStr ? `${name}{${tagStr}}` : name;
  }

  private createMetricData(): MetricData {
    return {
      count: 0,
      sum: 0,
      min: Infinity,
      max: -Infinity,
      values: [],
    };
  }

  private calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }
}

// Default metrics collector
export const metrics = new MetricsCollector();

// =============================================================================
// REQUEST MIDDLEWARE HELPERS
// =============================================================================

export interface RequestContext {
  requestId: string;
  startTime: number;
  endpoint: string;
  method: string;
  logger: Logger;
}

/**
 * Create request context for tracking
 */
export function createRequestContext(endpoint: string, method: string = 'GET'): RequestContext {
  const requestId = generateRequestId();
  const requestLogger = logger.child({ requestId, endpoint, method });
  
  return {
    requestId,
    startTime: Date.now(),
    endpoint,
    method,
    logger: requestLogger,
  };
}

/**
 * Complete request and record metrics
 */
export function completeRequest(
  context: RequestContext, 
  statusCode: number, 
  error?: Error | string
): void {
  const duration = Date.now() - context.startTime;
  
  // Record metrics
  metrics.recordLatency(context.endpoint, duration, statusCode);
  
  if (error) {
    metrics.recordError(context.endpoint, typeof error === 'string' ? error : error.name);
  }
  
  // Log completion
  if (statusCode >= 500) {
    context.logger.error('Request failed', error, { statusCode, duration });
  } else if (statusCode >= 400) {
    context.logger.warn('Request error', { statusCode, duration });
  } else {
    context.logger.info('Request completed', { statusCode, duration });
  }
}

// =============================================================================
// HEALTH METRICS
// =============================================================================

export function getHealthMetrics(): {
  uptime: number;
  memory: { used: number; total: number; percentage: number };
  requests: Record<string, unknown>;
} {
  const memUsage = process.memoryUsage();
  
  return {
    uptime: Math.round(process.uptime()),
    memory: {
      used: Math.round(memUsage.heapUsed / 1024 / 1024),
      total: Math.round(memUsage.heapTotal / 1024 / 1024),
      percentage: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100),
    },
    requests: metrics.getSnapshot(),
  };
}
