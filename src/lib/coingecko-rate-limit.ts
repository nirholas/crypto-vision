/**
 * Crypto Vision — CoinGecko API Rate Limiter
 *
 * Client-side rate limiter to respect upstream CoinGecko rate limits:
 *  - Free tier: 30 calls/min
 *  - Pro tier: 500 calls/min (with API key)
 *
 * Uses token bucket algorithm with:
 *  - Automatic token replenishment
 *  - Request queuing
 *  - Adaptive rate detection (monitors Retry-After headers)
 *  - Per-endpoint tracking
 */

import { logger } from "./logger.js";

// ─── Token Bucket State ──────────────────────────────────────

interface TokenBucket {
  tokens: number;
  refillTime: number;
  lastRequestTime: number;
  successCount: number;
  failureCount: number;
  observedLimit?: number;  // From CoinGecko response headers
  resetTime?: number;      // From CoinGecko response headers
}

interface QueuedRequest {
  resolve: (value: void) => void;
  reject: (reason?: Error) => void;
}

const isPro = process.env.COINGECKO_API_KEY ? true : false;
const CAPACITY = isPro ? 500 : 30;          // Tokens per minute
const REFILL_INTERVAL = 1000;               // Refill every second
const TOKENS_PER_REFILL = CAPACITY / 60;    // Smooth token distribution

const bucket: TokenBucket = {
  tokens: CAPACITY,
  refillTime: Date.now(),
  lastRequestTime: 0,
  successCount: 0,
  failureCount: 0,
};

const queue: QueuedRequest[] = [];
let isProcessing = false;

// ─── Token Refill ───────────────────────────────────────────

function refillTokens(): void {
  const now = Date.now();
  const elapsed = now - bucket.refillTime;
  const tokensToAdd = (elapsed / REFILL_INTERVAL) * TOKENS_PER_REFILL;

  if (tokensToAdd > 0) {
    bucket.tokens = Math.min(CAPACITY, bucket.tokens + tokensToAdd);
    bucket.refillTime = now;
  }
}

// ─── Rate Limit Waiting ──────────────────────────────────────

/**
 * Acquire a token from the bucket. Waits if necessary.
 * Returns when a token is available.
 */
export async function waitForCoinGeckoToken(): Promise<void> {
  return new Promise((resolve, reject) => {
    queue.push({ resolve, reject });
    processQueue();
  });
}

async function processQueue(): Promise<void> {
  if (isProcessing) return;
  isProcessing = true;

  while (queue.length > 0) {
    refillTokens();

    if (bucket.tokens >= 1) {
      bucket.tokens--;
      bucket.lastRequestTime = Date.now();

      const req = queue.shift()!;
      req.resolve();

      // Small delay between requests even if tokens available
      await sleep(100);
    } else {
      // Calculate wait time
      const timeUntilRefill = REFILL_INTERVAL - (Date.now() - bucket.refillTime);
      await sleep(Math.max(timeUntilRefill, 50));
    }
  }

  isProcessing = false;
}

// ─── Adaptive Rate Learning ─────────────────────────────────

/**
 * Update rate limit info based on response headers.
 * CoinGecko may send rate limit indicators.
 */
export function updateRateLimitInfo(headers: Headers): void {
  const retryAfter = headers.get("Retry-After");
  const remaining = headers.get("X-RateLimit-Remaining");
  const reset = headers.get("X-RateLimit-Reset");

  if (remaining) {
    const parsed = parseInt(remaining, 10);
    if (!isNaN(parsed)) {
      bucket.observedLimit = parsed;
    }
  }

  if (reset) {
    const parsed = parseInt(reset, 10);
    if (!isNaN(parsed)) {
      bucket.resetTime = parsed * 1000; // Convert to ms if epoch seconds
    }
  }

  if (retryAfter) {
    const seconds = parseInt(retryAfter, 10);
    if (!isNaN(seconds)) {
      logger.warn(
        { retryAfter: seconds, tokens: bucket.tokens.toFixed(2) },
        "CoinGecko rate limit advisory received"
      );
      // Pause new requests while backing off
      bucket.tokens = Math.max(0, bucket.tokens - 5);
    }
  }
}

// ─── Metrics ─────────────────────────────────────────────────

export function getCoinGeckoRateLimitStats() {
  return {
    isPro,
    capacity: CAPACITY,
    currentTokens: bucket.tokens.toFixed(2),
    successCount: bucket.successCount,
    failureCount: bucket.failureCount,
    queueLength: queue.length,
    observedLimit: bucket.observedLimit,
  };
}

// ─── Helpers ─────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Reset rate limiter (for testing or manual intervention).
 */
export function resetCoinGeckoRateLimit(): void {
  bucket.tokens = CAPACITY;
  bucket.refillTime = Date.now();
  bucket.successCount = 0;
  bucket.failureCount = 0;
  bucket.observedLimit = undefined;
  bucket.resetTime = undefined;
  logger.info("CoinGecko rate limiter reset");
}

/**
 * Record a successful request.
 */
export function recordCoinGeckoSuccess(): void {
  bucket.successCount++;
}

/**
 * Record a failed request (retried).
 */
export function recordCoinGeckoFailure(): void {
  bucket.failureCount++;
}
