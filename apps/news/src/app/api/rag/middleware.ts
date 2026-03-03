/**
 * RAG API Middleware
 * 
 * Shared utilities for RAG API routes:
 * - Rate limiting (in-memory, per-IP)
 * - Request logging
 * - Error handling
 * 
 * @module api/rag/middleware
 */

import { type NextRequest, NextResponse } from 'next/server';
import type { APIErrorResponse } from './schemas';

// ═══════════════════════════════════════════════════════════════
// RATE LIMITING
// ═══════════════════════════════════════════════════════════════

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

/**
 * In-memory rate limiter (per-IP, per-route)
 * Resets every `windowMs` milliseconds.
 */
class RateLimiter {
  private store: Map<string, RateLimitEntry> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Cleanup expired entries every 60s
    if (typeof setInterval !== 'undefined') {
      this.cleanupInterval = setInterval(() => this.cleanup(), 60_000);
    }
  }

  /**
   * Check if a request should be rate limited
   * @returns remaining requests, or -1 if limited
   */
  check(key: string, maxRequests: number, windowMs: number): { allowed: boolean; remaining: number; resetAt: number } {
    const now = Date.now();
    const entry = this.store.get(key);

    if (!entry || now >= entry.resetAt) {
      const resetAt = now + windowMs;
      this.store.set(key, { count: 1, resetAt });
      return { allowed: true, remaining: maxRequests - 1, resetAt };
    }

    entry.count++;
    if (entry.count > maxRequests) {
      return { allowed: false, remaining: 0, resetAt: entry.resetAt };
    }

    return { allowed: true, remaining: maxRequests - entry.count, resetAt: entry.resetAt };
  }

  private cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (now >= entry.resetAt) {
        this.store.delete(key);
      }
    }
  }
}

const rateLimiter = new RateLimiter();

/**
 * Rate limit configuration per route
 */
const RATE_LIMITS: Record<string, { maxRequests: number; windowMs: number }> = {
  'ask':      { maxRequests: 20,  windowMs: 60_000 },   // 20 req/min
  'search':   { maxRequests: 30,  windowMs: 60_000 },   // 30 req/min
  'stream':   { maxRequests: 10,  windowMs: 60_000 },   // 10 req/min
  'batch':    { maxRequests: 5,   windowMs: 60_000 },   // 5 req/min
  'feedback': { maxRequests: 30,  windowMs: 60_000 },   // 30 req/min
  'metrics':  { maxRequests: 60,  windowMs: 60_000 },   // 60 req/min
  'default':  { maxRequests: 30,  windowMs: 60_000 },   // 30 req/min
};

/**
 * Extract client IP from request
 */
function getClientIP(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    request.headers.get('cf-connecting-ip') ||
    'unknown'
  );
}

/**
 * Apply rate limiting to a request
 * Returns NextResponse with 429 if limited, or null if allowed
 */
export function applyRateLimit(
  request: NextRequest,
  route: string
): NextResponse | null {
  const ip = getClientIP(request);
  const config = RATE_LIMITS[route] || RATE_LIMITS['default'];
  const key = `${route}:${ip}`;

  const result = rateLimiter.check(key, config.maxRequests, config.windowMs);

  if (!result.allowed) {
    const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000);
    return NextResponse.json(
      {
        error: 'Too many requests',
        code: 'RATE_LIMITED',
        retryAfter,
      } satisfies APIErrorResponse & { retryAfter: number },
      {
        status: 429,
        headers: {
          'Retry-After': retryAfter.toString(),
          'X-RateLimit-Limit': config.maxRequests.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': new Date(result.resetAt).toISOString(),
        },
      }
    );
  }

  return null; // Allowed
}

/**
 * Add rate limit headers to a successful response
 */
export function withRateLimitHeaders(
  response: NextResponse,
  request: NextRequest,
  route: string
): NextResponse {
  const ip = getClientIP(request);
  const config = RATE_LIMITS[route] || RATE_LIMITS['default'];
  const key = `${route}:${ip}`;

  const result = rateLimiter.check(key, config.maxRequests, config.windowMs);

  response.headers.set('X-RateLimit-Limit', config.maxRequests.toString());
  response.headers.set('X-RateLimit-Remaining', Math.max(0, result.remaining).toString());
  response.headers.set('X-RateLimit-Reset', new Date(result.resetAt).toISOString());

  return response;
}

// ═══════════════════════════════════════════════════════════════
// ERROR HANDLING
// ═══════════════════════════════════════════════════════════════

/**
 * Standard error response handler
 */
export function handleAPIError(error: unknown, context: string): NextResponse {
  console.error(`RAG API error [${context}]:`, error);

  if (error instanceof Error) {
    // Known error types
    if (error.message.includes('Vector store is empty')) {
      return NextResponse.json(
        { error: 'Vector store is empty. Run ingestion first.', code: 'STORE_EMPTY', hint: 'npm run rag:ingest' },
        { status: 503 }
      );
    }

    if (error.message.includes('rate limit') || error.message.includes('429')) {
      return NextResponse.json(
        { error: 'Upstream rate limit exceeded. Try again shortly.', code: 'UPSTREAM_RATE_LIMIT' },
        { status: 502 }
      );
    }

    if (error.message.includes('timeout') || error.message.includes('ETIMEDOUT')) {
      return NextResponse.json(
        { error: 'Request timed out. Try a simpler query.', code: 'TIMEOUT' },
        { status: 504 }
      );
    }

    return NextResponse.json(
      { error: error.message, code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { error: 'Internal server error', code: 'UNKNOWN_ERROR' },
    { status: 500 }
  );
}

// ═══════════════════════════════════════════════════════════════
// REQUEST LOGGING
// ═══════════════════════════════════════════════════════════════

/**
 * Log API request details for observability
 */
export function logRequest(
  request: NextRequest,
  route: string,
  body?: Record<string, unknown>
): void {
  const ip = getClientIP(request);
  const ua = request.headers.get('user-agent')?.slice(0, 100) || 'unknown';

  console.log(
    `[RAG API] ${route.toUpperCase()} | IP: ${ip} | UA: ${ua}${
      body?.query ? ` | Query: "${String(body.query).slice(0, 80)}"` : ''
    }`
  );
}
