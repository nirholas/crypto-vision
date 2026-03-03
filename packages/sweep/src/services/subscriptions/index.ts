import { type Address, type Hex } from "viem";
import { randomUUID } from "crypto";
import { eq, and, desc, sql } from "drizzle-orm";
import { getDb, subscriptions, subscriptionSweeps, users } from "../../db/index.js";
import { cacheGet, cacheSet } from "../../utils/redis.js";
import {
  type AutoSweepSubscription,
  type SubscriptionSweep,
  type CreateSubscriptionRequest,
  type UpdateSubscriptionRequest,
  type SubscriptionListItem,
  type SubscriptionDetails,
  type SubscriptionStatus,
  type SpendPermission,
  MAX_SUBSCRIPTION_EXPIRY_DAYS,
  MIN_SWEEP_INTERVAL_HOURS,
  DEFAULT_MIN_SWEEP_VALUE_USD,
  DEFAULT_MAX_SWEEP_COST_PERCENT,
  SUPPORTED_AUTO_SWEEP_CHAINS,
} from "./types.js";
import {
  SpendPermissionsService,
  parseStoredSpendPermission,
  serializeSpendPermission,
} from "./spend-permissions.js";
import { createPublicClient, http } from "viem";
import { base } from "viem/chains";

// ============================================================================
// Subscription Service
// ============================================================================

export class SubscriptionService {
  private readonly db;

  constructor() {
    this.db = getDb();
  }

  /**
   * Create a new auto-sweep subscription
   */
  async createSubscription(
    userId: string,
    request: CreateSubscriptionRequest
  ): Promise<AutoSweepSubscription> {
    // Validate source chains
    const invalidChains = request.sourceChains.filter(
      (chain) => !SUPPORTED_AUTO_SWEEP_CHAINS[chain]
    );
    if (invalidChains.length > 0) {
      throw new Error(`Unsupported chains: ${invalidChains.join(", ")}`);
    }

    // Validate destination chain
    if (!SUPPORTED_AUTO_SWEEP_CHAINS[request.destinationChain]) {
      throw new Error(`Unsupported destination chain: ${request.destinationChain}`);
    }

    // Validate expiry (max 30 days)
    const expiryDate = new Date(request.spendPermissionExpiry);
    const maxExpiry = new Date();
    maxExpiry.setDate(maxExpiry.getDate() + MAX_SUBSCRIPTION_EXPIRY_DAYS);
    
    if (expiryDate > maxExpiry) {
      throw new Error(`Subscription expiry cannot exceed ${MAX_SUBSCRIPTION_EXPIRY_DAYS} days`);
    }

    if (expiryDate <= new Date()) {
      throw new Error("Subscription expiry must be in the future");
    }

    // Validate spend permission signature
    // This would verify the signature on the primary chain
    const isValidSignature = await this.validateSpendPermission(
      request.walletAddress as Address,
      request.spendPermissionSignature as Hex,
      request.destinationChain
    );

    if (!isValidSignature) {
      throw new Error("Invalid spend permission signature");
    }

    // Create subscription record
    const subscriptionId = randomUUID();
    const now = new Date();

    const subscription: AutoSweepSubscription = {
      id: subscriptionId,
      userId,
      walletAddress: request.walletAddress.toLowerCase(),
      sourceChains: request.sourceChains,
      destinationChain: request.destinationChain,
      destinationAsset: request.destinationAsset,
      destinationProtocol: request.destinationProtocol,
      destinationVault: request.destinationVault,
      triggerType: request.triggerType,
      thresholdUsd: request.thresholdUsd,
      schedulePattern: request.schedulePattern,
      minSweepValueUsd: request.minSweepValueUsd ?? DEFAULT_MIN_SWEEP_VALUE_USD,
      maxSweepCostPercent: request.maxSweepCostPercent ?? DEFAULT_MAX_SWEEP_COST_PERCENT,
      spendPermissionSignature: request.spendPermissionSignature,
      spendPermissionHash: "", // Will be computed
      spendPermissionExpiry: expiryDate,
      spendPermissionMaxAmount: request.spendPermissionMaxAmount,
      status: "active",
      createdAt: now,
      updatedAt: now,
      totalSweeps: 0,
      totalValueSwept: "0",
    };

    // Calculate next scheduled time for schedule-based subscriptions
    if (request.triggerType === "schedule" && request.schedulePattern) {
      subscription.nextScheduledAt = this.calculateNextScheduledTime(request.schedulePattern);
    }

    // Insert into database
    await this.db.insert(subscriptions).values({
      id: subscription.id,
      userId: subscription.userId,
      walletAddress: subscription.walletAddress,
      sourceChains: subscription.sourceChains,
      destinationChain: subscription.destinationChain,
      destinationAsset: subscription.destinationAsset,
      destinationProtocol: subscription.destinationProtocol,
      destinationVault: subscription.destinationVault,
      triggerType: subscription.triggerType,
      thresholdUsd: subscription.thresholdUsd?.toString(),
      schedulePattern: subscription.schedulePattern,
      minSweepValueUsd: subscription.minSweepValueUsd.toString(),
      maxSweepCostPercent: subscription.maxSweepCostPercent.toString(),
      spendPermissionSignature: subscription.spendPermissionSignature,
      spendPermissionHash: subscription.spendPermissionHash,
      spendPermissionExpiry: subscription.spendPermissionExpiry,
      spendPermissionMaxAmount: subscription.spendPermissionMaxAmount,
      status: subscription.status,
      nextScheduledAt: subscription.nextScheduledAt,
      totalSweeps: 0,
      totalValueSwept: "0",
    });

    // Audit log
    await this.logAuditEvent(subscriptionId, "created", {
      userId,
      walletAddress: request.walletAddress,
      triggerType: request.triggerType,
    });

    return subscription;
  }

  /**
   * Get subscription by ID
   */
  async getSubscription(subscriptionId: string): Promise<AutoSweepSubscription | null> {
    const result = await this.db.query.subscriptions.findFirst({
      where: eq(subscriptions.id, subscriptionId),
    });

    if (!result) return null;

    return this.mapDbToSubscription(result);
  }

  /**
   * Get subscription details with recent sweeps
   */
  async getSubscriptionDetails(
    subscriptionId: string,
    userId: string
  ): Promise<SubscriptionDetails | null> {
    const subscription = await this.db.query.subscriptions.findFirst({
      where: and(
        eq(subscriptions.id, subscriptionId),
        eq(subscriptions.userId, userId)
      ),
    });

    if (!subscription) return null;

    // Get recent sweeps
    const recentSweeps = await this.db.query.subscriptionSweeps.findMany({
      where: eq(subscriptionSweeps.subscriptionId, subscriptionId),
      orderBy: desc(subscriptionSweeps.createdAt),
      limit: 10,
    });

    return {
      id: subscription.id,
      walletAddress: subscription.walletAddress,
      sourceChains: subscription.sourceChains as number[],
      destinationChain: subscription.destinationChain,
      destinationAsset: subscription.destinationAsset,
      destinationProtocol: subscription.destinationProtocol ?? undefined,
      destinationVault: subscription.destinationVault ?? undefined,
      triggerType: subscription.triggerType as "threshold" | "schedule",
      thresholdUsd: subscription.thresholdUsd ? parseFloat(subscription.thresholdUsd) : undefined,
      schedulePattern: subscription.schedulePattern ?? undefined,
      minSweepValueUsd: parseFloat(subscription.minSweepValueUsd ?? "5"),
      maxSweepCostPercent: parseFloat(subscription.maxSweepCostPercent ?? "10"),
      spendPermissionExpiry: subscription.spendPermissionExpiry?.toISOString() ?? "",
      status: subscription.status as SubscriptionStatus,
      lastSweepAt: subscription.lastSweepAt?.toISOString(),
      nextScheduledAt: subscription.nextScheduledAt?.toISOString(),
      totalSweeps: subscription.totalSweeps ?? 0,
      totalValueSwept: subscription.totalValueSwept ?? "0",
      createdAt: subscription.createdAt?.toISOString() ?? "",
      updatedAt: subscription.updatedAt?.toISOString() ?? "",
      recentSweeps: recentSweeps.map((sweep) => ({
        id: sweep.id,
        triggeredBy: sweep.triggeredBy ?? "threshold",
        dustValueUsd: parseFloat(sweep.dustValueUsd ?? "0"),
        netValueUsd: parseFloat(sweep.netValueUsd ?? "0"),
        tokensSwept: sweep.tokensSwept ?? 0,
        status: sweep.status ?? "pending",
        createdAt: sweep.createdAt?.toISOString() ?? "",
      })),
    };
  }

  /**
   * List all subscriptions for a user
   */
  async listSubscriptions(userId: string): Promise<SubscriptionListItem[]> {
    const results = await this.db.query.subscriptions.findMany({
      where: eq(subscriptions.userId, userId),
      orderBy: desc(subscriptions.createdAt),
    });

    return results.map((sub) => ({
      id: sub.id,
      walletAddress: sub.walletAddress,
      sourceChains: sub.sourceChains as number[],
      destinationChain: sub.destinationChain,
      destinationAsset: sub.destinationAsset,
      destinationProtocol: sub.destinationProtocol ?? undefined,
      triggerType: sub.triggerType as "threshold" | "schedule",
      thresholdUsd: sub.thresholdUsd ? parseFloat(sub.thresholdUsd) : undefined,
      schedulePattern: sub.schedulePattern ?? undefined,
      status: sub.status as SubscriptionStatus,
      lastSweepAt: sub.lastSweepAt?.toISOString(),
      nextScheduledAt: sub.nextScheduledAt?.toISOString(),
      totalSweeps: sub.totalSweeps ?? 0,
      createdAt: sub.createdAt?.toISOString() ?? "",
    }));
  }

  /**
   * Update a subscription
   */
  async updateSubscription(
    subscriptionId: string,
    userId: string,
    updates: UpdateSubscriptionRequest
  ): Promise<AutoSweepSubscription | null> {
    // Verify ownership
    const existing = await this.db.query.subscriptions.findFirst({
      where: and(
        eq(subscriptions.id, subscriptionId),
        eq(subscriptions.userId, userId)
      ),
    });

    if (!existing) return null;

    // Validate source chains if provided
    if (updates.sourceChains) {
      const invalidChains = updates.sourceChains.filter(
        (chain) => !SUPPORTED_AUTO_SWEEP_CHAINS[chain]
      );
      if (invalidChains.length > 0) {
        throw new Error(`Unsupported chains: ${invalidChains.join(", ")}`);
      }
    }

    // Build update object
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (updates.sourceChains !== undefined) {
      updateData.sourceChains = updates.sourceChains;
    }
    if (updates.destinationChain !== undefined) {
      updateData.destinationChain = updates.destinationChain;
    }
    if (updates.destinationAsset !== undefined) {
      updateData.destinationAsset = updates.destinationAsset;
    }
    if (updates.destinationProtocol !== undefined) {
      updateData.destinationProtocol = updates.destinationProtocol;
    }
    if (updates.destinationVault !== undefined) {
      updateData.destinationVault = updates.destinationVault;
    }
    if (updates.triggerType !== undefined) {
      updateData.triggerType = updates.triggerType;
    }
    if (updates.thresholdUsd !== undefined) {
      updateData.thresholdUsd = updates.thresholdUsd?.toString();
    }
    if (updates.schedulePattern !== undefined) {
      updateData.schedulePattern = updates.schedulePattern;
      if (updates.schedulePattern) {
        updateData.nextScheduledAt = this.calculateNextScheduledTime(updates.schedulePattern);
      }
    }
    if (updates.minSweepValueUsd !== undefined) {
      updateData.minSweepValueUsd = updates.minSweepValueUsd.toString();
    }
    if (updates.maxSweepCostPercent !== undefined) {
      updateData.maxSweepCostPercent = updates.maxSweepCostPercent.toString();
    }

    await this.db
      .update(subscriptions)
      .set(updateData)
      .where(eq(subscriptions.id, subscriptionId));

    // Audit log
    await this.logAuditEvent(subscriptionId, "updated", updates as unknown as Record<string, unknown>);

    return this.getSubscription(subscriptionId);
  }

  /**
   * Pause a subscription
   */
  async pauseSubscription(subscriptionId: string, userId: string): Promise<boolean> {
    const result = await this.db
      .update(subscriptions)
      .set({
        status: "paused",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(subscriptions.id, subscriptionId),
          eq(subscriptions.userId, userId),
          eq(subscriptions.status, "active")
        )
      );

    if (result.rowCount && result.rowCount > 0) {
      await this.logAuditEvent(subscriptionId, "paused", { userId });
      return true;
    }
    return false;
  }

  /**
   * Resume a subscription
   */
  async resumeSubscription(subscriptionId: string, userId: string): Promise<boolean> {
    // Check if spend permission is still valid
    const subscription = await this.getSubscription(subscriptionId);
    if (!subscription) return false;

    if (subscription.spendPermissionExpiry <= new Date()) {
      throw new Error("Spend permission has expired. Please create a new subscription.");
    }

    const result = await this.db
      .update(subscriptions)
      .set({
        status: "active",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(subscriptions.id, subscriptionId),
          eq(subscriptions.userId, userId),
          eq(subscriptions.status, "paused")
        )
      );

    if (result.rowCount && result.rowCount > 0) {
      await this.logAuditEvent(subscriptionId, "resumed", { userId });
      return true;
    }
    return false;
  }

  /**
   * Cancel a subscription
   */
  async cancelSubscription(subscriptionId: string, userId: string): Promise<boolean> {
    const result = await this.db
      .update(subscriptions)
      .set({
        status: "cancelled",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(subscriptions.id, subscriptionId),
          eq(subscriptions.userId, userId)
        )
      );

    if (result.rowCount && result.rowCount > 0) {
      await this.logAuditEvent(subscriptionId, "cancelled", { userId });
      return true;
    }
    return false;
  }

  /**
   * Record a sweep for a subscription
   */
  async recordSweep(
    subscriptionId: string,
    sweepId: string,
    data: {
      triggeredBy: "threshold" | "schedule" | "manual";
      dustValueUsd: number;
      sweepCostUsd: number;
      tokensSwept: number;
      chains: number[];
    }
  ): Promise<SubscriptionSweep> {
    const sweepRecord: SubscriptionSweep = {
      id: randomUUID(),
      subscriptionId,
      sweepId,
      triggeredBy: data.triggeredBy,
      dustValueUsd: data.dustValueUsd,
      sweepCostUsd: data.sweepCostUsd,
      netValueUsd: data.dustValueUsd - data.sweepCostUsd,
      tokensSwept: data.tokensSwept,
      chains: data.chains,
      status: "pending",
      createdAt: new Date(),
    };

    await this.db.insert(subscriptionSweeps).values({
      id: sweepRecord.id,
      subscriptionId: sweepRecord.subscriptionId,
      sweepId: sweepRecord.sweepId,
      triggeredBy: sweepRecord.triggeredBy,
      dustValueUsd: sweepRecord.dustValueUsd.toString(),
      sweepCostUsd: sweepRecord.sweepCostUsd.toString(),
      netValueUsd: sweepRecord.netValueUsd.toString(),
      tokensSwept: sweepRecord.tokensSwept,
      chains: sweepRecord.chains,
      status: sweepRecord.status,
    });

    // Update subscription stats
    await this.db
      .update(subscriptions)
      .set({
        lastSweepAt: new Date(),
        totalSweeps: sql`${subscriptions.totalSweeps} + 1`,
        totalValueSwept: sql`CAST(${subscriptions.totalValueSwept} AS NUMERIC) + ${data.dustValueUsd}`,
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.id, subscriptionId));

    // Audit log
    await this.logAuditEvent(subscriptionId, "sweep_executed", {
      sweepId,
      dustValueUsd: data.dustValueUsd,
      tokensSwept: data.tokensSwept,
    });

    return sweepRecord;
  }

  /**
   * Update sweep status
   */
  async updateSweepStatus(
    subscriptionSweepId: string,
    status: "executing" | "completed" | "failed",
    errorMessage?: string
  ): Promise<void> {
    const updateData: Record<string, unknown> = { status };
    
    if (status === "completed") {
      updateData.completedAt = new Date();
    }
    if (errorMessage) {
      updateData.errorMessage = errorMessage;
    }

    await this.db
      .update(subscriptionSweeps)
      .set(updateData)
      .where(eq(subscriptionSweeps.id, subscriptionSweepId));
  }

  /**
   * Check if enough time has passed since last sweep (rate limiting)
   */
  async canExecuteSweep(subscriptionId: string): Promise<boolean> {
    const subscription = await this.getSubscription(subscriptionId);
    if (!subscription) return false;

    if (!subscription.lastSweepAt) return true;

    const minIntervalMs = MIN_SWEEP_INTERVAL_HOURS * 60 * 60 * 1000;
    const timeSinceLastSweep = Date.now() - subscription.lastSweepAt.getTime();

    return timeSinceLastSweep >= minIntervalMs;
  }

  /**
   * Get all active subscriptions that need checking
   */
  async getActiveSubscriptions(): Promise<AutoSweepSubscription[]> {
    const results = await this.db.query.subscriptions.findMany({
      where: eq(subscriptions.status, "active"),
    });

    return results.map(this.mapDbToSubscription);
  }

  /**
   * Get subscriptions by trigger type
   */
  async getSubscriptionsByTrigger(
    triggerType: "threshold" | "schedule"
  ): Promise<AutoSweepSubscription[]> {
    const results = await this.db.query.subscriptions.findMany({
      where: and(
        eq(subscriptions.status, "active"),
        eq(subscriptions.triggerType, triggerType)
      ),
    });

    return results.map(this.mapDbToSubscription);
  }

  /**
   * Expire subscriptions with expired spend permissions
   */
  async expireStaleSubscriptions(): Promise<number> {
    const result = await this.db
      .update(subscriptions)
      .set({
        status: "expired",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(subscriptions.status, "active"),
          sql`${subscriptions.spendPermissionExpiry} < NOW()`
        )
      );

    return result.rowCount ?? 0;
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  private async validateSpendPermission(
    account: Address,
    signature: Hex,
    chainId: number
  ): Promise<boolean> {
    // In a production environment, this would verify the signature
    // against the SpendPermissionManager contract on-chain
    // For now, we do basic validation
    
    if (!signature || signature.length < 130) {
      return false;
    }

    // The full validation would use SpendPermissionsService
    // to verify the signature matches the account
    return true;
  }

  private calculateNextScheduledTime(pattern: string): Date {
    // Simple cron pattern parsing
    // Format: "0 9 * * *" = daily at 9am
    // For MVP, we support: "daily", "weekly", "biweekly"
    
    const now = new Date();
    
    switch (pattern.toLowerCase()) {
      case "daily":
      case "0 9 * * *":
        // Next day at 9am UTC
        now.setUTCDate(now.getUTCDate() + 1);
        now.setUTCHours(9, 0, 0, 0);
        break;
      
      case "weekly":
      case "0 9 * * 0":
        // Next Sunday at 9am UTC
        const daysUntilSunday = (7 - now.getUTCDay()) % 7 || 7;
        now.setUTCDate(now.getUTCDate() + daysUntilSunday);
        now.setUTCHours(9, 0, 0, 0);
        break;
      
      case "biweekly":
        // 14 days from now at 9am UTC
        now.setUTCDate(now.getUTCDate() + 14);
        now.setUTCHours(9, 0, 0, 0);
        break;
      
      default:
        // Default to 24 hours from now
        now.setTime(now.getTime() + 24 * 60 * 60 * 1000);
    }
    
    return now;
  }

  private mapDbToSubscription(row: any): AutoSweepSubscription {
    return {
      id: row.id,
      userId: row.userId,
      walletAddress: row.walletAddress,
      smartWalletAddress: row.smartWalletAddress,
      sourceChains: row.sourceChains as number[],
      destinationChain: row.destinationChain,
      destinationAsset: row.destinationAsset,
      destinationProtocol: row.destinationProtocol,
      destinationVault: row.destinationVault,
      triggerType: row.triggerType,
      thresholdUsd: row.thresholdUsd ? parseFloat(row.thresholdUsd) : undefined,
      schedulePattern: row.schedulePattern,
      minSweepValueUsd: parseFloat(row.minSweepValueUsd ?? "5"),
      maxSweepCostPercent: parseFloat(row.maxSweepCostPercent ?? "10"),
      spendPermissionSignature: row.spendPermissionSignature,
      spendPermissionHash: row.spendPermissionHash,
      spendPermissionExpiry: row.spendPermissionExpiry,
      spendPermissionMaxAmount: row.spendPermissionMaxAmount,
      status: row.status,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      lastSweepAt: row.lastSweepAt,
      nextScheduledAt: row.nextScheduledAt,
      totalSweeps: row.totalSweeps ?? 0,
      totalValueSwept: row.totalValueSwept ?? "0",
    };
  }

  private async logAuditEvent(
    subscriptionId: string,
    action: string,
    data: Record<string, unknown>
  ): Promise<void> {
    // Store audit log in Redis for quick access
    // In production, this would also go to a dedicated audit log table
    const auditKey = `audit:subscription:${subscriptionId}`;
    const existingLogs = await cacheGet<any[]>(auditKey) ?? [];
    
    existingLogs.push({
      timestamp: new Date().toISOString(),
      action,
      data,
    });

    // Keep last 100 events
    const trimmedLogs = existingLogs.slice(-100);
    
    await cacheSet(auditKey, trimmedLogs, 30 * 24 * 60 * 60); // 30 days TTL
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

let subscriptionService: SubscriptionService | null = null;

export function getSubscriptionService(): SubscriptionService {
  if (!subscriptionService) {
    subscriptionService = new SubscriptionService();
  }
  return subscriptionService;
}

// Re-export types
export * from "./types.js";
export * from "./spend-permissions.js";
