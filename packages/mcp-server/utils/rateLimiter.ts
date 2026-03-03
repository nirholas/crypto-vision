/**
 * Rate limiter using token bucket algorithm
 * 
 * @author nich
 * @website https://x.com/nichxbt
 * @github https://github.com/nirholas
 * @license Apache-2.0
 */

interface RateLimiterOptions {
  maxTokens: number;        // Maximum tokens in bucket
  refillRate: number;       // Tokens added per interval
  refillIntervalMs: number; // Interval in milliseconds
}

export class RateLimiter {
  private tokens: number;
  private maxTokens: number;
  private refillRate: number;
  private refillIntervalMs: number;
  private lastRefill: number;

  constructor(options: RateLimiterOptions) {
    this.maxTokens = options.maxTokens;
    this.tokens = options.maxTokens;
    this.refillRate = options.refillRate;
    this.refillIntervalMs = options.refillIntervalMs;
    this.lastRefill = Date.now();
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    const intervalsElapsed = Math.floor(elapsed / this.refillIntervalMs);
    
    if (intervalsElapsed > 0) {
      this.tokens = Math.min(
        this.maxTokens,
        this.tokens + (intervalsElapsed * this.refillRate)
      );
      this.lastRefill = now;
    }
  }

  /**
   * Try to acquire a token. Returns true if successful.
   */
  tryAcquire(tokens: number = 1): boolean {
    this.refill();
    
    if (this.tokens >= tokens) {
      this.tokens -= tokens;
      return true;
    }
    
    return false;
  }

  /**
   * Wait until a token is available
   */
  async acquire(tokens: number = 1): Promise<void> {
    while (!this.tryAcquire(tokens)) {
      // Calculate wait time until next token is available
      const waitTime = Math.ceil(
        (tokens - this.tokens) * this.refillIntervalMs / this.refillRate
      );
      await new Promise(resolve => setTimeout(resolve, Math.min(waitTime, 1000)));
    }
  }

  /**
   * Get current token count
   */
  getAvailableTokens(): number {
    this.refill();
    return this.tokens;
  }

  /**
   * Check if rate limit would allow request
   */
  canAcquire(tokens: number = 1): boolean {
    this.refill();
    return this.tokens >= tokens;
  }
}

// Pre-configured rate limiters for common APIs
export const defaultRateLimiter = new RateLimiter({
  maxTokens: 10,
  refillRate: 1,
  refillIntervalMs: 1000,
});

export const binanceRateLimiter = new RateLimiter({
  maxTokens: 20,
  refillRate: 2,
  refillIntervalMs: 1000,
});

export const coingeckoRateLimiter = new RateLimiter({
  maxTokens: 10,
  refillRate: 1,
  refillIntervalMs: 1000,
});

// Per-endpoint rate limiters stored by key
const rateLimiters = new Map<string, RateLimiter>();

/**
 * Get or create a rate limiter for a specific endpoint
 */
export function getRateLimiter(
  key: string,
  options?: RateLimiterOptions
): RateLimiter {
  if (!rateLimiters.has(key)) {
    rateLimiters.set(key, new RateLimiter(
      options ?? {
        maxTokens: 10,
        refillRate: 1,
        refillIntervalMs: 1000,
      }
    ));
  }
  return rateLimiters.get(key)!;
}

/**
 * Decorator-like function for rate limiting async functions
 */
export function withRateLimit<T extends unknown[], R>(
  limiter: RateLimiter,
  tokens: number = 1
) {
  return function (fn: (...args: T) => Promise<R>): (...args: T) => Promise<R> {
    return async (...args: T): Promise<R> => {
      await limiter.acquire(tokens);
      return fn(...args);
    };
  };
}

/**
 * Batch requests with rate limiting
 */
export async function batchWithRateLimit<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  limiter: RateLimiter,
  batchSize: number = 5
): Promise<R[]> {
  const results: R[] = [];
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    
    // Acquire tokens for the batch
    await limiter.acquire(batch.length);
    
    // Process batch in parallel
    const batchResults = await Promise.all(
      batch.map(item => processor(item).catch(err => {
        console.error(`Error processing item:`, err);
        return null as unknown as R;
      }))
    );
    
    results.push(...batchResults);
  }
  
  return results;
}
