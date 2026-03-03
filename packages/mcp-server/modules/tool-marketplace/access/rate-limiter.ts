/**
 * Rate Limiter
 * @description Sliding window rate limiting for API keys, users, and tools
 * @author nirholas
 * @license Apache-2.0
 */

import type {
  RateLimit,
  RateLimitStatus,
  RateLimitHeaders,
  RatePeriod,
  AccessStorageAdapter,
} from "./types.js"
import { defaultStorage } from "./storage.js"
import { periodToMs, periodToSeconds } from "./tiers.js"
import Logger from "@/utils/logger.js"

/**
 * Rate limit scope
 */
export type RateLimitScope = "key" | "user" | "tool" | "global"

/**
 * Rate limit check options
 */
export interface RateLimitCheckOptions {
  /** Key ID for key-level limiting */
  keyId?: string
  /** User address for user-level limiting */
  userId?: string
  /** Tool ID for tool-level limiting */
  toolId?: string
  /** IP address for IP-based limiting */
  ipAddress?: string
  /** Number of requests to consume (default: 1) */
  cost?: number
}

/**
 * Sliding window rate limiter using the sliding log algorithm
 */
export class RateLimiter {
  private storage: AccessStorageAdapter

  constructor(storage: AccessStorageAdapter = defaultStorage) {
    this.storage = storage
  }

  /**
   * Generate a rate limit key
   */
  private generateKey(
    scope: RateLimitScope,
    identifier: string,
    period: RatePeriod
  ): string {
    // Calculate the current window
    const periodMs = periodToMs(period)
    const windowStart = Math.floor(Date.now() / periodMs) * periodMs
    return `ratelimit:${scope}:${identifier}:${period}:${windowStart}`
  }

  /**
   * Check rate limit for a given scope
   */
  async checkLimit(
    rateLimit: RateLimit,
    scope: RateLimitScope,
    identifier: string,
    cost: number = 1
  ): Promise<RateLimitStatus> {
    const key = this.generateKey(scope, identifier, rateLimit.period)
    const periodSeconds = periodToSeconds(rateLimit.period)
    const periodMs = periodToMs(rateLimit.period)

    // Get current count
    const currentCount = await this.storage.getRateCount(key)

    // Calculate remaining
    const remaining = Math.max(0, rateLimit.requests - currentCount)

    // Calculate reset time
    const windowStart = Math.floor(Date.now() / periodMs) * periodMs
    const resetAt = windowStart + periodMs
    const resetIn = Math.ceil((resetAt - Date.now()) / 1000)

    // Check if limited
    const limited = currentCount >= rateLimit.requests

    return {
      limited,
      remaining,
      limit: rateLimit.requests,
      resetIn,
      resetAt,
    }
  }

  /**
   * Consume rate limit (increment counter)
   */
  async consumeLimit(
    rateLimit: RateLimit,
    scope: RateLimitScope,
    identifier: string,
    cost: number = 1
  ): Promise<RateLimitStatus> {
    const key = this.generateKey(scope, identifier, rateLimit.period)
    const periodSeconds = periodToSeconds(rateLimit.period)
    const periodMs = periodToMs(rateLimit.period)

    // Increment counter
    const newCount = await this.storage.incrementRateCount(key, periodSeconds)

    // Calculate remaining (after consumption)
    const remaining = Math.max(0, rateLimit.requests - newCount)

    // Calculate reset time
    const windowStart = Math.floor(Date.now() / periodMs) * periodMs
    const resetAt = windowStart + periodMs
    const resetIn = Math.ceil((resetAt - Date.now()) / 1000)

    // Check if limited (we already consumed, so check against limit)
    const limited = newCount > rateLimit.requests

    return {
      limited,
      remaining,
      limit: rateLimit.requests,
      resetIn,
      resetAt,
    }
  }

  /**
   * Check and consume rate limit in one operation
   */
  async checkAndConsume(
    rateLimit: RateLimit,
    scope: RateLimitScope,
    identifier: string,
    cost: number = 1
  ): Promise<RateLimitStatus> {
    // First check without consuming
    const status = await this.checkLimit(rateLimit, scope, identifier, cost)

    if (status.limited) {
      // Already at limit, don't consume
      return status
    }

    // Consume and return updated status
    return this.consumeLimit(rateLimit, scope, identifier, cost)
  }

  /**
   * Multi-level rate limit check
   * Checks key, user, and tool limits in order
   */
  async checkMultipleLimits(
    options: RateLimitCheckOptions,
    keyRateLimit?: RateLimit,
    userRateLimit?: RateLimit,
    toolRateLimit?: RateLimit
  ): Promise<{
    allowed: boolean
    status: {
      key?: RateLimitStatus
      user?: RateLimitStatus
      tool?: RateLimitStatus
    }
    limitedBy?: RateLimitScope
  }> {
    const cost = options.cost || 1
    const status: {
      key?: RateLimitStatus
      user?: RateLimitStatus
      tool?: RateLimitStatus
    } = {}

    // Check key-level limit
    if (options.keyId && keyRateLimit) {
      status.key = await this.checkLimit(keyRateLimit, "key", options.keyId, cost)
      if (status.key.limited) {
        return { allowed: false, status, limitedBy: "key" }
      }
    }

    // Check user-level limit
    if (options.userId && userRateLimit) {
      status.user = await this.checkLimit(userRateLimit, "user", options.userId, cost)
      if (status.user.limited) {
        return { allowed: false, status, limitedBy: "user" }
      }
    }

    // Check tool-level limit
    if (options.toolId && toolRateLimit) {
      status.tool = await this.checkLimit(toolRateLimit, "tool", options.toolId, cost)
      if (status.tool.limited) {
        return { allowed: false, status, limitedBy: "tool" }
      }
    }

    // All checks passed, now consume
    if (options.keyId && keyRateLimit) {
      status.key = await this.consumeLimit(keyRateLimit, "key", options.keyId, cost)
    }
    if (options.userId && userRateLimit) {
      status.user = await this.consumeLimit(userRateLimit, "user", options.userId, cost)
    }
    if (options.toolId && toolRateLimit) {
      status.tool = await this.consumeLimit(toolRateLimit, "tool", options.toolId, cost)
    }

    return { allowed: true, status }
  }

  /**
   * Generate rate limit headers for HTTP responses
   */
  generateHeaders(status: RateLimitStatus): RateLimitHeaders {
    const headers: RateLimitHeaders = {
      "X-RateLimit-Limit": status.limit.toString(),
      "X-RateLimit-Remaining": status.remaining.toString(),
      "X-RateLimit-Reset": status.resetAt.toString(),
    }

    if (status.limited) {
      headers["Retry-After"] = status.resetIn.toString()
    }

    return headers
  }

  /**
   * Get rate limit info without consuming
   */
  async getRateLimitInfo(
    rateLimit: RateLimit,
    scope: RateLimitScope,
    identifier: string
  ): Promise<RateLimitStatus> {
    return this.checkLimit(rateLimit, scope, identifier, 0)
  }

  /**
   * Reset rate limit for a specific scope and identifier
   */
  async resetLimit(
    scope: RateLimitScope,
    identifier: string,
    period: RatePeriod
  ): Promise<void> {
    const key = this.generateKey(scope, identifier, period)
    // In memory storage, we can't easily delete, so we'll just let it expire
    // In Redis, you'd use DEL key
    Logger.info(`Rate limit reset requested for ${scope}:${identifier}:${period}`)
  }

  /**
   * Get current usage across all periods
   */
  async getUsageSummary(
    scope: RateLimitScope,
    identifier: string,
    rateLimits: RateLimit[]
  ): Promise<Map<RatePeriod, RateLimitStatus>> {
    const summary = new Map<RatePeriod, RateLimitStatus>()

    for (const rateLimit of rateLimits) {
      const status = await this.checkLimit(rateLimit, scope, identifier, 0)
      summary.set(rateLimit.period, status)
    }

    return summary
  }
}

/**
 * Global rate limits configuration (optional additional limits)
 */
export const GLOBAL_RATE_LIMITS: {
  user: RateLimit
  tool: RateLimit
} = {
  // Per-user limit across all keys: 10,000/hour
  user: { requests: 10000, period: "hour" },
  // Per-tool global limit: 100,000/hour
  tool: { requests: 100000, period: "hour" },
}

/**
 * Default rate limiter instance
 */
export const rateLimiter = new RateLimiter()

/**
 * Token bucket rate limiter (alternative implementation)
 * More burst-friendly than sliding window
 */
export class TokenBucketRateLimiter {
  private storage: AccessStorageAdapter
  private buckets = new Map<string, { tokens: number; lastRefill: number }>()

  constructor(storage: AccessStorageAdapter = defaultStorage) {
    this.storage = storage
  }

  /**
   * Check and consume tokens from bucket
   */
  async consume(
    bucketId: string,
    rateLimit: RateLimit,
    cost: number = 1
  ): Promise<RateLimitStatus> {
    const bucket = this.buckets.get(bucketId) || {
      tokens: rateLimit.requests,
      lastRefill: Date.now(),
    }

    const now = Date.now()
    const periodMs = periodToMs(rateLimit.period)

    // Calculate tokens to add based on time elapsed
    const elapsed = now - bucket.lastRefill
    const tokensToAdd = Math.floor((elapsed / periodMs) * rateLimit.requests)

    // Refill bucket (cap at max)
    bucket.tokens = Math.min(rateLimit.requests, bucket.tokens + tokensToAdd)
    bucket.lastRefill = now

    // Check if we have enough tokens
    if (bucket.tokens < cost) {
      this.buckets.set(bucketId, bucket)

      // Calculate when we'll have enough tokens
      const tokensNeeded = cost - bucket.tokens
      const timeToRefill = Math.ceil((tokensNeeded / rateLimit.requests) * periodMs)

      return {
        limited: true,
        remaining: bucket.tokens,
        limit: rateLimit.requests,
        resetIn: Math.ceil(timeToRefill / 1000),
        resetAt: now + timeToRefill,
      }
    }

    // Consume tokens
    bucket.tokens -= cost
    this.buckets.set(bucketId, bucket)

    // Calculate next full refill time
    const tokensUntilFull = rateLimit.requests - bucket.tokens
    const timeToFull = Math.ceil((tokensUntilFull / rateLimit.requests) * periodMs)

    return {
      limited: false,
      remaining: bucket.tokens,
      limit: rateLimit.requests,
      resetIn: Math.ceil(timeToFull / 1000),
      resetAt: now + timeToFull,
    }
  }

  /**
   * Get current bucket state
   */
  getBucketState(bucketId: string): { tokens: number; lastRefill: number } | undefined {
    return this.buckets.get(bucketId)
  }
}

/**
 * Token bucket rate limiter instance
 */
export const tokenBucketLimiter = new TokenBucketRateLimiter()
