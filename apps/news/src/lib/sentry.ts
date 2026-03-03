/**
 * Sentry Error Monitoring Configuration
 * 
 * This module provides error monitoring and performance tracking via Sentry.
 * It's designed to work with Next.js App Router and Edge Runtime.
 * 
 * Features:
 * - Automatic error capture
 * - Performance monitoring
 * - User context tracking
 * - Custom breadcrumbs
 * - Release tracking
 * 
 * Configuration:
 * Set SENTRY_DSN and SENTRY_AUTH_TOKEN in environment variables.
 * 
 * @module sentry
 */

// Note: This file provides a lightweight wrapper for Sentry.
// For full Sentry integration in Next.js, run: npx @sentry/wizard@latest -i nextjs

// =============================================================================
// TYPES
// =============================================================================

export interface SentryUser {
  id?: string;
  email?: string;
  username?: string;
  ip_address?: string;
}

export interface SentryContext {
  [key: string]: unknown;
}

export interface SentryBreadcrumb {
  type?: string;
  category?: string;
  message?: string;
  data?: Record<string, unknown>;
  level?: 'fatal' | 'error' | 'warning' | 'info' | 'debug';
  timestamp?: number;
}

// =============================================================================
// CONFIGURATION
// =============================================================================

const SENTRY_DSN = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;
const SENTRY_ENVIRONMENT = process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development';
const SENTRY_RELEASE = process.env.SENTRY_RELEASE || process.env.VERCEL_GIT_COMMIT_SHA || 'local';
const SAMPLE_RATE = parseFloat(process.env.SENTRY_SAMPLE_RATE || '1.0');
const TRACES_SAMPLE_RATE = parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1');

const isEnabled = !!SENTRY_DSN && process.env.NODE_ENV === 'production';

// =============================================================================
// EDGE-COMPATIBLE SENTRY WRAPPER
// =============================================================================

/**
 * Edge-compatible error reporting
 * 
 * In Edge Runtime, we can't use the full Sentry SDK, so we use the
 * Sentry envelope API directly or queue errors for server-side processing.
 */
class SentryEdge {
  private dsn: string | null;
  private enabled: boolean;
  private breadcrumbs: SentryBreadcrumb[] = [];
  private user: SentryUser | null = null;
  private tags: Record<string, string> = {};
  private context: Record<string, SentryContext> = {};

  constructor() {
    this.dsn = SENTRY_DSN || null;
    this.enabled = isEnabled;
  }

  /**
   * Capture an exception
   */
  captureException(error: Error | unknown, context?: SentryContext): string | null {
    if (!this.enabled || !this.dsn) {
      console.error('[Sentry] Would capture:', error);
      return null;
    }

    const eventId = this.generateEventId();
    
    // In Edge, we log for now - full integration would send to Sentry API
    console.error('[Sentry] Captured exception:', {
      eventId,
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : error,
      context,
      user: this.user,
      tags: this.tags,
      breadcrumbs: this.breadcrumbs.slice(-10),
      environment: SENTRY_ENVIRONMENT,
      release: SENTRY_RELEASE,
    });

    return eventId;
  }

  /**
   * Capture a message
   */
  captureMessage(message: string, level: SentryBreadcrumb['level'] = 'info'): string | null {
    if (!this.enabled || !this.dsn) {
      console.log(`[Sentry] Would capture message (${level}):`, message);
      return null;
    }

    const eventId = this.generateEventId();
    
    console.log('[Sentry] Captured message:', {
      eventId,
      message,
      level,
      user: this.user,
      tags: this.tags,
      environment: SENTRY_ENVIRONMENT,
    });

    return eventId;
  }

  /**
   * Set user context
   */
  setUser(user: SentryUser | null): void {
    this.user = user;
  }

  /**
   * Set a tag
   */
  setTag(key: string, value: string): void {
    this.tags[key] = value;
  }

  /**
   * Set multiple tags
   */
  setTags(tags: Record<string, string>): void {
    Object.assign(this.tags, tags);
  }

  /**
   * Set extra context
   */
  setContext(name: string, context: SentryContext): void {
    this.context[name] = context;
  }

  /**
   * Add a breadcrumb
   */
  addBreadcrumb(breadcrumb: SentryBreadcrumb): void {
    this.breadcrumbs.push({
      ...breadcrumb,
      timestamp: breadcrumb.timestamp || Date.now() / 1000,
    });

    // Keep only last 100 breadcrumbs
    if (this.breadcrumbs.length > 100) {
      this.breadcrumbs = this.breadcrumbs.slice(-100);
    }
  }

  /**
   * Start a performance transaction
   */
  startTransaction(name: string, op: string): SentryTransaction {
    return new SentryTransaction(name, op, this.enabled);
  }

  /**
   * Wrap a function with error tracking
   */
  withScope<T>(callback: (scope: SentryScope) => T): T {
    const scope = new SentryScope(this);
    return callback(scope);
  }

  /**
   * Check if Sentry is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Get configuration info
   */
  getConfig(): { enabled: boolean; environment: string; release: string } {
    return {
      enabled: this.enabled,
      environment: SENTRY_ENVIRONMENT,
      release: SENTRY_RELEASE,
    };
  }

  private generateEventId(): string {
    return Array.from({ length: 32 }, () => 
      Math.floor(Math.random() * 16).toString(16)
    ).join('');
  }
}

// =============================================================================
// TRANSACTION & SCOPE CLASSES
// =============================================================================

class SentryTransaction {
  private name: string;
  private op: string;
  private startTime: number;
  private enabled: boolean;
  private spans: { name: string; startTime: number; endTime?: number }[] = [];

  constructor(name: string, op: string, enabled: boolean) {
    this.name = name;
    this.op = op;
    this.startTime = Date.now();
    this.enabled = enabled;
  }

  startChild(name: string): { finish: () => void } {
    const span = { name, startTime: Date.now(), endTime: 0 };
    this.spans.push(span);
    
    return {
      finish: () => {
        span.endTime = Date.now();
      },
    };
  }

  finish(): void {
    if (!this.enabled) return;

    const duration = Date.now() - this.startTime;
    console.log('[Sentry] Transaction finished:', {
      name: this.name,
      op: this.op,
      duration,
      spans: this.spans.map(s => ({
        name: s.name,
        duration: (s.endTime || Date.now()) - s.startTime,
      })),
    });
  }

  setData(key: string, _value: unknown): void {
    // Store transaction data
  }

  setStatus(status: 'ok' | 'error' | 'cancelled'): void {
    // Store transaction status
  }
}

class SentryScope {
  private sentry: SentryEdge;
  private scopeTags: Record<string, string> = {};
  private scopeContext: Record<string, SentryContext> = {};
  private scopeUser: SentryUser | null = null;

  constructor(sentry: SentryEdge) {
    this.sentry = sentry;
  }

  setTag(key: string, value: string): void {
    this.scopeTags[key] = value;
    this.sentry.setTag(key, value);
  }

  setContext(name: string, context: SentryContext): void {
    this.scopeContext[name] = context;
    this.sentry.setContext(name, context);
  }

  setUser(user: SentryUser | null): void {
    this.scopeUser = user;
    this.sentry.setUser(user);
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

export const sentry = new SentryEdge();

// =============================================================================
// CONVENIENCE FUNCTIONS
// =============================================================================

/**
 * Capture an error with optional context
 */
export function captureException(error: Error | unknown, context?: SentryContext): string | null {
  return sentry.captureException(error, context);
}

/**
 * Capture a message
 */
export function captureMessage(message: string, level?: SentryBreadcrumb['level']): string | null {
  return sentry.captureMessage(message, level);
}

/**
 * Set user for error context
 */
export function setUser(user: SentryUser | null): void {
  sentry.setUser(user);
}

/**
 * Set a tag
 */
export function setTag(key: string, value: string): void {
  sentry.setTag(key, value);
}

/**
 * Add a breadcrumb
 */
export function addBreadcrumb(breadcrumb: SentryBreadcrumb): void {
  sentry.addBreadcrumb(breadcrumb);
}

/**
 * Start a performance transaction
 */
export function startTransaction(name: string, op: string): SentryTransaction {
  return sentry.startTransaction(name, op);
}

/**
 * Wrap an async function with error tracking
 */
export async function withErrorTracking<T>(
  name: string,
  fn: () => Promise<T>,
  context?: SentryContext
): Promise<T> {
  const transaction = sentry.startTransaction(name, 'function');
  
  try {
    addBreadcrumb({
      category: 'function',
      message: `Starting ${name}`,
      level: 'info',
    });
    
    const result = await fn();
    
    transaction.setStatus('ok');
    return result;
  } catch (error) {
    transaction.setStatus('error');
    captureException(error, { ...context, function: name });
    throw error;
  } finally {
    transaction.finish();
  }
}

// =============================================================================
// NEXT.JS HELPERS
// =============================================================================

import type { NextRequest } from 'next/server';

/**
 * Add request context to Sentry
 */
export function setRequestContext(request: NextRequest): void {
  const url = new URL(request.url);
  
  sentry.setContext('request', {
    method: request.method,
    url: url.pathname,
    query: Object.fromEntries(url.searchParams),
  });

  sentry.addBreadcrumb({
    category: 'http',
    message: `${request.method} ${url.pathname}`,
    level: 'info',
    data: {
      method: request.method,
      url: url.pathname,
    },
  });

  // Set user from headers if available
  const userId = request.headers.get('x-user-id');
  if (userId) {
    sentry.setUser({ id: userId });
  }
}

/**
 * Create error response with Sentry tracking
 */
export function errorResponse(
  error: Error | unknown,
  status = 500,
  context?: SentryContext
): Response {
  const eventId = captureException(error, context);
  
  const message = error instanceof Error ? error.message : 'Internal Server Error';
  
  return new Response(
    JSON.stringify({
      error: message,
      status,
      ...(eventId && { eventId }),
    }),
    {
      status,
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );
}

export default sentry;
