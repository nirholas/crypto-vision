/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// Rate limiting and exponential backoff retry logic

import { getLogger } from './logger.js';

const logger = getLogger();

export interface RetryOptions {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffFactor: number;
  jitter: boolean;
}

export interface RetryContext {
  attempt: number;
  totalAttempts: number;
  lastError?: Error;
  totalDelay: number;
}

export class RetryableError extends Error {
  constructor(
    message: string,
    public readonly retryAfter?: number
  ) {
    super(message);
    this.name = 'RetryableError';
  }
}

export class RetryExhaustedError extends Error {
  constructor(
    message: string,
    public readonly attempts: number,
    public readonly lastError?: Error
  ) {
    super(message);
    this.name = 'RetryExhaustedError';
  }
}

export class RetryManager {
  private readonly defaultOptions: RetryOptions = {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    backoffFactor: 2,
    jitter: true,
  };

  constructor(private options: Partial<RetryOptions> = {}) {
    this.options = { ...this.defaultOptions, ...options };
  }

  /**
   * Execute function with retry logic
   */
  async executeWithRetry<T>(
    operation: (context: RetryContext) => Promise<T>,
    operationName?: string
  ): Promise<T> {
    const opts = { ...this.defaultOptions, ...this.options };
    let lastError: Error | undefined;
    let totalDelay = 0;

    for (let attempt = 1; attempt <= opts.maxRetries + 1; attempt++) {
      const context: RetryContext = {
        attempt,
        totalAttempts: opts.maxRetries + 1,
        lastError,
        totalDelay,
      };

      try {
        logger.debug('Executing operation with retry', {
          operation: operationName,
          attempt,
          maxAttempts: opts.maxRetries + 1,
        });

        return await operation(context);
      } catch (error) {
        lastError = error as Error;

        // Don't retry on final attempt
        if (attempt > opts.maxRetries) {
          logger.error('Retry attempts exhausted', lastError, {
            operation: operationName,
            totalAttempts: attempt,
            totalDelay,
          });

          throw new RetryExhaustedError(
            `Operation failed after ${attempt} attempts: ${lastError.message}`,
            attempt,
            lastError
          );
        }

        // Check if error is retryable
        if (!this.isRetryableError(error)) {
          logger.info('Non-retryable error encountered', {
            operation: operationName,
            error: lastError.message,
            attempt,
          });

          throw lastError;
        }

        // Calculate delay for next attempt
        const delay = this.calculateDelay(attempt - 1, opts, error);
        totalDelay += delay;

        logger.warn('Operation failed, retrying', {
          operation: operationName,
          attempt,
          error: lastError.message,
          retryAfter: delay,
          totalDelay,
        });

        // Wait before retrying
        await this.sleep(delay);
      }
    }

    // This should never be reached due to the loop logic above
    throw new RetryExhaustedError(
      'Unexpected retry logic error',
      opts.maxRetries + 1,
      lastError
    );
  }

  /**
   * Calculate delay for next retry attempt
   */
  private calculateDelay(
    attemptNumber: number,
    options: RetryOptions,
    error?: unknown
  ): number {
    let delay: number;

    // Check if error specifies retry-after delay
    if (error instanceof RetryableError && error.retryAfter) {
      delay = error.retryAfter;
    } else {
      // Exponential backoff calculation
      delay =
        options.baseDelay * Math.pow(options.backoffFactor, attemptNumber);
    }

    // Apply maximum delay limit
    delay = Math.min(delay, options.maxDelay);

    // Add jitter to avoid thundering herd problem
    if (options.jitter) {
      const jitterAmount = delay * 0.1; // 10% jitter
      const randomJitter = (Math.random() * 2 - 1) * jitterAmount;
      delay += randomJitter;
    }

    return Math.max(0, Math.round(delay));
  }

  /**
   * Check if an error should trigger a retry
   */
  private isRetryableError(error: unknown): boolean {
    if (error instanceof RetryableError) {
      return true;
    }

    if (error && typeof error === 'object') {
      const errorObj = error as any;

      // Check status codes for HTTP errors
      if ('statusCode' in errorObj) {
        const retryableStatusCodes = [408, 429, 502, 503, 504];
        return retryableStatusCodes.includes(errorObj.statusCode);
      }

      // Check error codes
      if ('code' in errorObj) {
        const retryableCodes = [
          'ECONNRESET',
          'ECONNABORTED',
          'ETIMEDOUT',
          'ENOTFOUND',
          'EAI_AGAIN',
        ];
        return retryableCodes.includes(errorObj.code);
      }
    }

    if (error instanceof Error) {
      const retryableMessages = [
        'timeout',
        'socket hang up',
        'connect timeout',
        'request timeout',
        'network error',
      ];

      return retryableMessages.some(msg =>
        error.message.toLowerCase().includes(msg)
      );
    }

    return false;
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Create retry-specific error for rate limiting
   */
  static createRateLimitError(retryAfterMs?: number): RetryableError {
    return new RetryableError('Rate limit exceeded', retryAfterMs);
  }

  /**
   * Create retry-specific error for service unavailable
   */
  static createServiceUnavailableError(retryAfterMs?: number): RetryableError {
    return new RetryableError('Service temporarily unavailable', retryAfterMs);
  }
}

// Rate limiter for controlling request frequency
export class RateLimiter {
  private requests: number[] = [];

  constructor(
    private maxRequests: number,
    private timeWindowMs: number
  ) {}

  /**
   * Check if request is allowed under rate limit
   */
  isAllowed(): boolean {
    const now = Date.now();
    const cutoff = now - this.timeWindowMs;

    // Remove old requests outside the time window
    this.requests = this.requests.filter(time => time > cutoff);

    // Check if under limit
    if (this.requests.length < this.maxRequests) {
      this.requests.push(now);
      return true;
    }

    return false;
  }

  /**
   * Get time until next request is allowed
   */
  getRetryAfter(): number {
    if (this.requests.length === 0) {
      return 0;
    }

    const oldestRequest = Math.min(...this.requests);
    const retryAfter = oldestRequest + this.timeWindowMs - Date.now();

    return Math.max(0, retryAfter);
  }

  /**
   * Reset rate limiter
   */
  reset(): void {
    this.requests = [];
  }

  /**
   * Get current usage statistics
   */
  getStats(): {
    currentRequests: number;
    maxRequests: number;
    timeWindowMs: number;
    nextResetMs: number;
  } {
    const now = Date.now();
    const cutoff = now - this.timeWindowMs;
    const activeRequests = this.requests.filter(time => time > cutoff);

    return {
      currentRequests: activeRequests.length,
      maxRequests: this.maxRequests,
      timeWindowMs: this.timeWindowMs,
      nextResetMs:
        activeRequests.length > 0
          ? Math.min(...activeRequests) + this.timeWindowMs - now
          : 0,
    };
  }
}

// Factory functions
export function createRetryManager(
  options?: Partial<RetryOptions>
): RetryManager {
  return new RetryManager(options);
}

export function createRateLimiter(
  maxRequests: number,
  timeWindowMs: number
): RateLimiter {
  return new RateLimiter(maxRequests, timeWindowMs);
}

export default RetryManager;
