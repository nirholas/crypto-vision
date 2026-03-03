import { type Address } from "viem";
import { eq, and, desc, lt, sql } from "drizzle-orm";
import { getDb, dustTokens, subscriptions } from "../../db/index.js";
import { cacheGet, cacheSet } from "../../utils/redis.js";
import { getSubscriptionService } from "./index.js";
import {
  type AutoSweepSubscription,
  MIN_SWEEP_INTERVAL_HOURS,
  SUPPORTED_AUTO_SWEEP_CHAINS,
} from "./types.js";
import { addSubscriptionSweepJob } from "../../queue/index.js";

// ============================================================================
// Constants
// ============================================================================

// Rate limit key prefix for subscriptions
const RATE_LIMIT_KEY_PREFIX = "subscription:ratelimit:";

// Cache key for user dust values
const DUST_VALUE_CACHE_PREFIX = "subscription:dustvalue:";

// Cache TTL for dust value (5 minutes)
const DUST_VALUE_CACHE_TTL = 300;

// ============================================================================
// Subscription Monitor
// ============================================================================

export class SubscriptionMonitor {
  private readonly db;
  private readonly subscriptionService;

  constructor() {
    this.db = getDb();
    this.subscriptionService = getSubscriptionService();
  }

  /**
   * Main monitoring loop - checks all active subscriptions
   * Called by the cron worker every 15 minutes
   */
  async checkAllSubscriptions(): Promise<{
    checked: number;
    triggered: number;
    expired: number;
    errors: string[];
  }> {
    const stats = {
      checked: 0,
      triggered: 0,
      expired: 0,
      errors: [] as string[],
    };

    try {
      // First, expire any stale subscriptions
      stats.expired = await this.subscriptionService.expireStaleSubscriptions();

      // Get all active subscriptions
      const activeSubscriptions = await this.subscriptionService.getActiveSubscriptions();
      stats.checked = activeSubscriptions.length;

      console.log(`[SubscriptionMonitor] Checking ${activeSubscriptions.length} active subscriptions`);

      // Process subscriptions in batches to avoid overwhelming the system
      const batchSize = 10;
      for (let i = 0; i < activeSubscriptions.length; i += batchSize) {
        const batch = activeSubscriptions.slice(i, i + batchSize);
        
        const results = await Promise.allSettled(
          batch.map(sub => this.checkSubscription(sub))
        );

        for (let j = 0; j < results.length; j++) {
          const result = results[j];
          const subscription = batch[j];

          if (result.status === "fulfilled" && result.value) {
            stats.triggered++;
          } else if (result.status === "rejected") {
            stats.errors.push(`Subscription ${subscription.id}: ${result.reason}`);
            console.error(
              `[SubscriptionMonitor] Error checking subscription ${subscription.id}:`,
              result.reason
            );
          }
        }
      }

      console.log(
        `[SubscriptionMonitor] Complete - Checked: ${stats.checked}, Triggered: ${stats.triggered}, Expired: ${stats.expired}`
      );

      return stats;
    } catch (error) {
      console.error("[SubscriptionMonitor] Fatal error:", error);
      stats.errors.push(`Fatal error: ${error}`);
      return stats;
    }
  }

  /**
   * Check a single subscription and trigger sweep if conditions are met
   */
  async checkSubscription(subscription: AutoSweepSubscription): Promise<boolean> {
    // Check rate limit (max 1 sweep per 6 hours)
    const canSweep = await this.checkRateLimit(subscription.id);
    if (!canSweep) {
      console.log(
        `[SubscriptionMonitor] Subscription ${subscription.id} rate limited`
      );
      return false;
    }

    // Check spend permission validity
    const permissionValid = await this.checkSpendPermission(subscription);
    if (!permissionValid) {
      console.log(
        `[SubscriptionMonitor] Subscription ${subscription.id} spend permission invalid/expired`
      );
      return false;
    }

    // Check trigger conditions
    let shouldTrigger = false;

    if (subscription.triggerType === "threshold") {
      shouldTrigger = await this.checkThresholdTrigger(subscription);
    } else if (subscription.triggerType === "schedule") {
      shouldTrigger = await this.checkScheduleTrigger(subscription);
    }

    if (shouldTrigger) {
      return await this.triggerSweep(subscription);
    }

    return false;
  }

  /**
   * Check if threshold-based trigger conditions are met
   */
  async checkThresholdTrigger(subscription: AutoSweepSubscription): Promise<boolean> {
    if (!subscription.thresholdUsd) {
      return false;
    }

    // Get current dust value for the user's wallet
    const dustValue = await this.calculateDustValue(
      subscription.walletAddress as Address,
      subscription.sourceChains
    );

    console.log(
      `[SubscriptionMonitor] Subscription ${subscription.id}: dust value $${dustValue.toFixed(2)}, threshold $${subscription.thresholdUsd}`
    );

    // Check if dust exceeds threshold
    if (dustValue >= subscription.thresholdUsd) {
      // Also check minimum sweep value
      if (dustValue >= subscription.minSweepValueUsd) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if schedule-based trigger conditions are met
   */
  async checkScheduleTrigger(subscription: AutoSweepSubscription): Promise<boolean> {
    if (!subscription.nextScheduledAt) {
      return false;
    }

    const now = new Date();
    
    // Check if we've passed the scheduled time
    if (now >= subscription.nextScheduledAt) {
      // Verify there's enough dust to sweep
      const dustValue = await this.calculateDustValue(
        subscription.walletAddress as Address,
        subscription.sourceChains
      );

      console.log(
        `[SubscriptionMonitor] Scheduled subscription ${subscription.id}: dust value $${dustValue.toFixed(2)}, min $${subscription.minSweepValueUsd}`
      );

      return dustValue >= subscription.minSweepValueUsd;
    }

    return false;
  }

  /**
   * Calculate total dust value for a wallet across specified chains
   */
  async calculateDustValue(
    walletAddress: Address,
    chainIds: number[]
  ): Promise<number> {
    // Check cache first
    const cacheKey = `${DUST_VALUE_CACHE_PREFIX}${walletAddress}:${chainIds.sort().join(",")}`;
    const cached = await cacheGet<number>(cacheKey);
    if (cached !== null) {
      return cached;
    }

    // Query database for dust tokens
    const chainNames = chainIds
      .map(id => SUPPORTED_AUTO_SWEEP_CHAINS[id])
      .filter(Boolean);

    const dustTokensResult = await this.db.query.dustTokens.findMany({
      where: and(
        eq(dustTokens.walletAddress, walletAddress.toLowerCase()),
        eq(dustTokens.swept, false),
        sql`${dustTokens.chain} = ANY(${chainNames})`
      ),
    });

    // Sum up the USD values
    const totalValue = dustTokensResult.reduce((sum, token) => {
      return sum + parseFloat(token.valueUsd?.toString() ?? "0");
    }, 0);

    // Cache the result
    await cacheSet(cacheKey, totalValue, DUST_VALUE_CACHE_TTL);

    return totalValue;
  }

  /**
   * Check if the spend permission is still valid
   */
  async checkSpendPermission(subscription: AutoSweepSubscription): Promise<boolean> {
    // Check expiry
    if (subscription.spendPermissionExpiry <= new Date()) {
      return false;
    }

    // In production, we would also verify on-chain that:
    // 1. The permission hasn't been revoked
    // 2. There's remaining allowance
    // For now, we just check the expiry date

    return true;
  }

  /**
   * Check rate limit for a subscription
   */
  async checkRateLimit(subscriptionId: string): Promise<boolean> {
    const key = `${RATE_LIMIT_KEY_PREFIX}${subscriptionId}`;
    const lastSweep = await cacheGet<number>(key);

    if (lastSweep === null) {
      return true;
    }

    const minIntervalMs = MIN_SWEEP_INTERVAL_HOURS * 60 * 60 * 1000;
    const timeSinceLastSweep = Date.now() - lastSweep;

    return timeSinceLastSweep >= minIntervalMs;
  }

  /**
   * Set rate limit after triggering a sweep
   */
  async setRateLimit(subscriptionId: string): Promise<void> {
    const key = `${RATE_LIMIT_KEY_PREFIX}${subscriptionId}`;
    const ttlSeconds = MIN_SWEEP_INTERVAL_HOURS * 60 * 60;
    await cacheSet(key, Date.now(), ttlSeconds);
  }

  /**
   * Trigger a sweep for a subscription
   */
  async triggerSweep(subscription: AutoSweepSubscription): Promise<boolean> {
    try {
      console.log(`[SubscriptionMonitor] Triggering sweep for subscription ${subscription.id}`);

      // Set rate limit immediately to prevent double-triggers
      await this.setRateLimit(subscription.id);

      // Get dust tokens to sweep
      const chainNames = subscription.sourceChains
        .map(id => SUPPORTED_AUTO_SWEEP_CHAINS[id])
        .filter(Boolean);

      const tokensToSweep = await this.db.query.dustTokens.findMany({
        where: and(
          eq(dustTokens.walletAddress, subscription.walletAddress.toLowerCase()),
          eq(dustTokens.swept, false),
          sql`${dustTokens.chain} = ANY(${chainNames})`
        ),
      });

      if (tokensToSweep.length === 0) {
        console.log(`[SubscriptionMonitor] No tokens to sweep for subscription ${subscription.id}`);
        return false;
      }

      // Calculate total value and cost
      const totalDustValue = tokensToSweep.reduce((sum, token) => {
        return sum + parseFloat(token.valueUsd?.toString() ?? "0");
      }, 0);

      // Estimate sweep cost (simplified - would use actual gas estimation)
      const estimatedCostPercent = 5; // 5% estimated cost
      const estimatedCost = totalDustValue * (estimatedCostPercent / 100);

      // Check if cost is within limits
      if (estimatedCostPercent > subscription.maxSweepCostPercent) {
        console.log(
          `[SubscriptionMonitor] Sweep cost ${estimatedCostPercent}% exceeds max ${subscription.maxSweepCostPercent}% for subscription ${subscription.id}`
        );
        return false;
      }

      // Queue the sweep job
      await addSubscriptionSweepJob({
        subscriptionId: subscription.id,
        userId: subscription.userId,
        walletAddress: subscription.walletAddress,
        tokens: tokensToSweep.map(token => ({
          address: token.tokenAddress,
          chain: token.chain,
          amount: token.balance?.toString() ?? "0",
          symbol: token.symbol ?? "UNKNOWN",
          valueUsd: parseFloat(token.valueUsd?.toString() ?? "0"),
        })),
        destinationChain: subscription.destinationChain,
        destinationAsset: subscription.destinationAsset,
        destinationProtocol: subscription.destinationProtocol,
        destinationVault: subscription.destinationVault,
        spendPermissionSignature: subscription.spendPermissionSignature,
        triggeredBy: subscription.triggerType,
        estimatedDustValueUsd: totalDustValue,
        estimatedCostUsd: estimatedCost,
      });

      // Update next scheduled time if this is a scheduled subscription
      if (subscription.triggerType === "schedule" && subscription.schedulePattern) {
        await this.updateNextScheduledTime(subscription.id, subscription.schedulePattern);
      }

      console.log(
        `[SubscriptionMonitor] Queued sweep for subscription ${subscription.id}: ${tokensToSweep.length} tokens, $${totalDustValue.toFixed(2)} value`
      );

      return true;
    } catch (error) {
      console.error(
        `[SubscriptionMonitor] Failed to trigger sweep for subscription ${subscription.id}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Update the next scheduled time after a sweep
   */
  async updateNextScheduledTime(subscriptionId: string, pattern: string): Promise<void> {
    const nextTime = this.calculateNextScheduledTime(pattern);
    
    await this.db
      .update(subscriptions)
      .set({
        nextScheduledAt: nextTime,
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.id, subscriptionId));
  }

  /**
   * Calculate next scheduled time based on pattern
   */
  private calculateNextScheduledTime(pattern: string): Date {
    const now = new Date();
    
    switch (pattern.toLowerCase()) {
      case "daily":
      case "0 9 * * *":
        now.setUTCDate(now.getUTCDate() + 1);
        now.setUTCHours(9, 0, 0, 0);
        break;
      
      case "weekly":
      case "0 9 * * 0":
        const daysUntilSunday = (7 - now.getUTCDay()) % 7 || 7;
        now.setUTCDate(now.getUTCDate() + daysUntilSunday);
        now.setUTCHours(9, 0, 0, 0);
        break;
      
      case "biweekly":
        now.setUTCDate(now.getUTCDate() + 14);
        now.setUTCHours(9, 0, 0, 0);
        break;
      
      default:
        now.setTime(now.getTime() + 24 * 60 * 60 * 1000);
    }
    
    return now;
  }

  /**
   * Invalidate dust value cache for a wallet
   */
  async invalidateDustCache(walletAddress: string): Promise<void> {
    // In production, we'd use Redis SCAN to find and delete all matching keys
    // For now, this is a placeholder
    console.log(`[SubscriptionMonitor] Invalidating dust cache for ${walletAddress}`);
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

let subscriptionMonitor: SubscriptionMonitor | null = null;

export function getSubscriptionMonitor(): SubscriptionMonitor {
  if (!subscriptionMonitor) {
    subscriptionMonitor = new SubscriptionMonitor();
  }
  return subscriptionMonitor;
}
