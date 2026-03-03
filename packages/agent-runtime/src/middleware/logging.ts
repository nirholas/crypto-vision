/**
 * Structured Logging Middleware
 *
 * JSON-formatted request/response logging with context.
 */

import type { Context, Next } from 'hono';

export interface LoggingConfig {
  /** Log level: debug, info, warn, error */
  level?: 'debug' | 'info' | 'warn' | 'error';
  /** Include request body in logs */
  logBody?: boolean;
  /** Include response body in logs */
  logResponse?: boolean;
  /** Custom logger function */
  logger?: (entry: LogEntry) => void;
}

export interface LogEntry {
  timestamp: string;
  level: string;
  method: string;
  path: string;
  status: number;
  duration: number;
  agentId?: number;
  payer?: string;
  requestId?: string;
  userAgent?: string;
  error?: string;
  body?: unknown;
  response?: unknown;
}

const LOG_LEVELS: Record<string, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/**
 * Create structured logging middleware.
 */
export function createLoggingMiddleware(config: LoggingConfig = {}) {
  const level = config.level ?? 'info';
  const levelNum = LOG_LEVELS[level] ?? 1;
  const logFn = config.logger ?? defaultLogger;

  return async (c: Context, next: Next) => {
    const start = Date.now();
    const requestId =
      c.req.header('x-request-id') ?? crypto.randomUUID();

    c.header('X-Request-Id', requestId);

    let body: unknown;
    if (config.logBody && c.req.method !== 'GET') {
      try {
        body = await c.req.json();
      } catch {
        // Not JSON body
      }
    }

    try {
      await next();
    } catch (error) {
      const duration = Date.now() - start;
      const entry: LogEntry = {
        timestamp: new Date().toISOString(),
        level: 'error',
        method: c.req.method,
        path: c.req.path,
        status: 500,
        duration,
        requestId,
        userAgent: c.req.header('user-agent'),
        error: error instanceof Error ? error.message : String(error),
        body,
      };

      if (LOG_LEVELS.error >= levelNum) logFn(entry);
      throw error;
    }

    const duration = Date.now() - start;
    const status = c.res.status;

    // Extract agent context
    const auth = c.get('authenticatedAgent') as { agentId?: number } | undefined;
    const payment = c.get('x402Payment') as { payer?: string } | undefined;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info',
      method: c.req.method,
      path: c.req.path,
      status,
      duration,
      agentId: auth?.agentId,
      payer: payment?.payer,
      requestId,
      userAgent: c.req.header('user-agent'),
      body,
    };

    if (LOG_LEVELS[entry.level] >= levelNum) {
      logFn(entry);
    }
  };
}

/**
 * Default JSON logger to stdout.
 */
function defaultLogger(entry: LogEntry): void {
  const color = entry.status >= 500 ? '\x1b[31m' : entry.status >= 400 ? '\x1b[33m' : '\x1b[32m';
  const reset = '\x1b[0m';
  const symbol = entry.status >= 500 ? 'X' : entry.status >= 400 ? '!' : '✓';

  console.log(
    `${color}${symbol}${reset} ${entry.method} ${entry.path} ${color}${entry.status}${reset} ${entry.duration}ms` +
      (entry.agentId ? ` agent:${entry.agentId}` : '') +
      (entry.payer ? ` payer:${entry.payer.slice(0, 10)}...` : '') +
      (entry.error ? ` error:${entry.error}` : '')
  );
}

/**
 * Create a logger instance for use outside middleware.
 */
export function createLogger(name: string) {
  return {
    debug: (message: string, data?: Record<string, unknown>) =>
      console.log(JSON.stringify({ timestamp: new Date().toISOString(), level: 'debug', name, message, ...data })),
    info: (message: string, data?: Record<string, unknown>) =>
      console.log(JSON.stringify({ timestamp: new Date().toISOString(), level: 'info', name, message, ...data })),
    warn: (message: string, data?: Record<string, unknown>) =>
      console.warn(JSON.stringify({ timestamp: new Date().toISOString(), level: 'warn', name, message, ...data })),
    error: (message: string, data?: Record<string, unknown>) =>
      console.error(JSON.stringify({ timestamp: new Date().toISOString(), level: 'error', name, message, ...data })),
  };
}
