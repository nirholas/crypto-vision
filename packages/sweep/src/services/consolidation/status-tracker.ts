/**
 * Cross-Chain Consolidation Status Tracker
 * Tracks multi-chain operation status in Redis with events
 */

import { cacheGet, cacheSet, getRedis } from "../../utils/redis.js";
import type { SupportedChain } from "../../config/chains.js";
import type { BridgeStatus, BridgeProvider } from "../bridge/types.js";
import {
  ConsolidationStatus,
  ChainOperationStatus,
  type ConsolidationStatusDetail,
  type ChainOperationStatusDetail,
  type ConsolidationEvent,
  type ConsolidationPlan,
} from "./types.js";

/**
 * Redis key prefixes
 */
const CACHE_PREFIX = "consolidation";
const STATUS_PREFIX = `${CACHE_PREFIX}:status`;
const PLAN_PREFIX = `${CACHE_PREFIX}:plan`;
const EVENTS_PREFIX = `${CACHE_PREFIX}:events`;
const USER_PREFIX = `${CACHE_PREFIX}:user`;

/**
 * Default TTLs
 */
const STATUS_TTL = 7 * 24 * 3600; // 7 days
const PLAN_TTL = 30 * 60; // 30 minutes (plans expire)
const EVENTS_TTL = 24 * 3600; // 24 hours
const USER_HISTORY_TTL = 90 * 24 * 3600; // 90 days

/**
 * Consolidation Status Tracker
 */
export class ConsolidationStatusTracker {
  /**
   * Initialize a new consolidation status
   */
  async initializeStatus(
    plan: ConsolidationPlan
  ): Promise<ConsolidationStatusDetail> {
    const status: ConsolidationStatusDetail = {
      id: plan.id,
      userId: plan.userId,
      status: ConsolidationStatus.PENDING,
      chainOperations: plan.chainPlans.map((cp) => ({
        chain: cp.chain,
        status: ChainOperationStatus.PENDING,
        inputValueUsd: cp.swapInputValueUsd,
      })),
      completedChains: 0,
      totalChains: plan.chainPlans.length,
      progressPercent: 0,
      totalInputValueUsd: plan.totalInputValueUsd,
      totalOutputValueUsd: 0,
      actualFeesUsd: 0,
      destinationChain: plan.destinationChain,
      destinationToken: plan.destinationToken,
      createdAt: Date.now(),
      errors: [],
    };

    await this.saveStatus(status);
    await this.addToUserHistory(plan.userId, plan.id);

    // Emit initialization event
    await this.emitEvent({
      type: "consolidation_started",
      consolidationId: plan.id,
      userId: plan.userId,
      timestamp: Date.now(),
    });

    return status;
  }

  /**
   * Get consolidation status
   */
  async getStatus(
    consolidationId: string
  ): Promise<ConsolidationStatusDetail | null> {
    const key = `${STATUS_PREFIX}:${consolidationId}`;
    return cacheGet<ConsolidationStatusDetail>(key);
  }

  /**
   * Save consolidation status
   */
  private async saveStatus(status: ConsolidationStatusDetail): Promise<void> {
    const key = `${STATUS_PREFIX}:${status.id}`;
    await cacheSet(key, status, STATUS_TTL);
  }

  /**
   * Update consolidation status
   */
  async updateStatus(
    consolidationId: string,
    updates: Partial<ConsolidationStatusDetail>
  ): Promise<ConsolidationStatusDetail | null> {
    const current = await this.getStatus(consolidationId);
    if (!current) {
      return null;
    }

    const updated: ConsolidationStatusDetail = {
      ...current,
      ...updates,
    };

    // Recalculate progress
    updated.progressPercent = this.calculateProgress(updated);

    await this.saveStatus(updated);
    return updated;
  }

  /**
   * Update a specific chain operation status
   */
  async updateChainStatus(
    consolidationId: string,
    chain: SupportedChain,
    updates: Partial<ChainOperationStatusDetail>
  ): Promise<ConsolidationStatusDetail | null> {
    const status = await this.getStatus(consolidationId);
    if (!status) {
      return null;
    }

    // Find and update the chain operation
    const chainIndex = status.chainOperations.findIndex(
      (co) => co.chain === chain
    );
    if (chainIndex === -1) {
      console.warn(
        `[StatusTracker] Chain ${chain} not found in consolidation ${consolidationId}`
      );
      return status;
    }

    status.chainOperations[chainIndex] = {
      ...status.chainOperations[chainIndex],
      ...updates,
    };

    // Update completed count
    status.completedChains = status.chainOperations.filter(
      (co) =>
        co.status === ChainOperationStatus.COMPLETED ||
        co.status === ChainOperationStatus.SKIPPED
    ).length;

    // Update overall status based on chain operations
    status.status = this.deriveOverallStatus(status);
    status.progressPercent = this.calculateProgress(status);

    // Update timing
    if (
      status.status === ConsolidationStatus.COMPLETED ||
      status.status === ConsolidationStatus.FAILED ||
      status.status === ConsolidationStatus.PARTIAL_SUCCESS
    ) {
      status.completedAt = Date.now();
    }

    await this.saveStatus(status);
    return status;
  }

  /**
   * Mark swap started for a chain
   */
  async markSwapStarted(
    consolidationId: string,
    chain: SupportedChain,
    txHash?: `0x${string}`
  ): Promise<void> {
    const status = await this.updateChainStatus(consolidationId, chain, {
      status: ChainOperationStatus.SWAPPING,
      swapTxHash: txHash,
      startedAt: Date.now(),
    });

    if (status) {
      await this.emitEvent({
        type: "chain_swap_started",
        consolidationId,
        userId: status.userId,
        chain,
        txHash,
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Mark swap completed for a chain
   */
  async markSwapCompleted(
    consolidationId: string,
    chain: SupportedChain,
    txHash: `0x${string}`,
    outputAmount: bigint,
    outputValueUsd: number
  ): Promise<void> {
    const status = await this.updateChainStatus(consolidationId, chain, {
      status: ChainOperationStatus.SWAP_COMPLETE,
      swapTxHash: txHash,
      swapConfirmed: true,
      outputAmount,
      outputValueUsd,
    });

    if (status) {
      await this.emitEvent({
        type: "chain_swap_completed",
        consolidationId,
        userId: status.userId,
        chain,
        txHash,
        data: { outputAmount: outputAmount.toString(), outputValueUsd },
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Mark bridge started for a chain
   */
  async markBridgeStarted(
    consolidationId: string,
    chain: SupportedChain,
    provider: BridgeProvider,
    txHash: `0x${string}`
  ): Promise<void> {
    const status = await this.updateChainStatus(consolidationId, chain, {
      status: ChainOperationStatus.BRIDGING,
      bridgeTxHash: txHash,
      bridgeProvider: provider,
      bridgeStatus: "pending" as BridgeStatus,
    });

    if (status) {
      await this.emitEvent({
        type: "chain_bridge_started",
        consolidationId,
        userId: status.userId,
        chain,
        txHash,
        data: { provider },
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Mark bridge completed for a chain
   */
  async markBridgeCompleted(
    consolidationId: string,
    chain: SupportedChain,
    destTxHash: `0x${string}`,
    outputAmount: bigint,
    outputValueUsd: number
  ): Promise<void> {
    const status = await this.updateChainStatus(consolidationId, chain, {
      status: ChainOperationStatus.COMPLETED,
      bridgeStatus: "completed" as BridgeStatus,
      bridgeDestinationTxHash: destTxHash,
      outputAmount,
      outputValueUsd,
      completedAt: Date.now(),
    });

    if (status) {
      // Update total output
      const totalOutput = status.chainOperations.reduce(
        (sum, co) => sum + (co.outputValueUsd || 0),
        0
      );
      await this.updateStatus(consolidationId, {
        totalOutputValueUsd: totalOutput,
        actualFeesUsd: status.totalInputValueUsd - totalOutput,
      });

      await this.emitEvent({
        type: "chain_bridge_completed",
        consolidationId,
        userId: status.userId,
        chain,
        txHash: destTxHash,
        data: { outputAmount: outputAmount.toString(), outputValueUsd },
        timestamp: Date.now(),
      });

      // Check if all chains are complete
      const updatedStatus = await this.getStatus(consolidationId);
      if (
        updatedStatus &&
        updatedStatus.completedChains === updatedStatus.totalChains
      ) {
        await this.markConsolidationCompleted(consolidationId);
      }
    }
  }

  /**
   * Mark chain operation as failed
   */
  async markChainFailed(
    consolidationId: string,
    chain: SupportedChain,
    stage: "swap" | "bridge",
    error: string
  ): Promise<void> {
    const updates: Partial<ChainOperationStatusDetail> =
      stage === "swap"
        ? { status: ChainOperationStatus.FAILED, swapError: error, error }
        : { status: ChainOperationStatus.FAILED, bridgeError: error, error };

    const status = await this.updateChainStatus(
      consolidationId,
      chain,
      updates
    );

    if (status) {
      // Add to errors list
      status.errors.push({ chain, stage, error });
      await this.saveStatus(status);

      await this.emitEvent({
        type: "chain_failed",
        consolidationId,
        userId: status.userId,
        chain,
        error,
        data: { stage },
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Mark same-chain operation as completed (no bridge needed)
   */
  async markSameChainCompleted(
    consolidationId: string,
    chain: SupportedChain,
    txHash: `0x${string}`,
    outputAmount: bigint,
    outputValueUsd: number
  ): Promise<void> {
    await this.updateChainStatus(consolidationId, chain, {
      status: ChainOperationStatus.COMPLETED,
      swapTxHash: txHash,
      swapConfirmed: true,
      outputAmount,
      outputValueUsd,
      completedAt: Date.now(),
    });

    // Check if all chains are complete
    const status = await this.getStatus(consolidationId);
    if (status && status.completedChains === status.totalChains) {
      await this.markConsolidationCompleted(consolidationId);
    }
  }

  /**
   * Mark entire consolidation as completed
   */
  private async markConsolidationCompleted(
    consolidationId: string
  ): Promise<void> {
    const status = await this.getStatus(consolidationId);
    if (!status) return;

    // Check for any failures
    const hasFailures = status.chainOperations.some(
      (co) => co.status === ChainOperationStatus.FAILED
    );

    // Calculate final output
    const finalOutputAmount = status.chainOperations.reduce(
      (sum, co) => sum + (co.outputAmount || 0n),
      0n
    );

    await this.updateStatus(consolidationId, {
      status: hasFailures
        ? ConsolidationStatus.PARTIAL_SUCCESS
        : ConsolidationStatus.COMPLETED,
      finalOutputAmount,
      completedAt: Date.now(),
      progressPercent: 100,
    });

    await this.emitEvent({
      type: hasFailures ? "consolidation_failed" : "consolidation_completed",
      consolidationId,
      userId: status.userId,
      data: {
        finalOutputAmount: finalOutputAmount.toString(),
        totalOutputValueUsd: status.totalOutputValueUsd,
        hasFailures,
      },
      timestamp: Date.now(),
    });
  }

  /**
   * Mark consolidation as failed
   */
  async markConsolidationFailed(
    consolidationId: string,
    error: string
  ): Promise<void> {
    const status = await this.getStatus(consolidationId);
    if (!status) return;

    await this.updateStatus(consolidationId, {
      status: ConsolidationStatus.FAILED,
      completedAt: Date.now(),
    });

    await this.emitEvent({
      type: "consolidation_failed",
      consolidationId,
      userId: status.userId,
      error,
      timestamp: Date.now(),
    });
  }

  /**
   * Calculate overall progress percentage
   */
  private calculateProgress(status: ConsolidationStatusDetail): number {
    if (status.totalChains === 0) return 100;

    // Each chain has 2 stages: swap (50%) and bridge (50%)
    // Same-chain operations only have swap (100%)
    let totalProgress = 0;

    for (const op of status.chainOperations) {
      switch (op.status) {
        case ChainOperationStatus.PENDING:
          totalProgress += 0;
          break;
        case ChainOperationStatus.SWAPPING:
          totalProgress += 25;
          break;
        case ChainOperationStatus.SWAP_COMPLETE:
          totalProgress += 50;
          break;
        case ChainOperationStatus.BRIDGING:
          totalProgress += 75;
          break;
        case ChainOperationStatus.BRIDGE_COMPLETE:
        case ChainOperationStatus.COMPLETED:
        case ChainOperationStatus.SKIPPED:
          totalProgress += 100;
          break;
        case ChainOperationStatus.FAILED:
          totalProgress += 100; // Count as "done" for progress purposes
          break;
      }
    }

    return Math.floor(totalProgress / status.totalChains);
  }

  /**
   * Derive overall status from chain operations
   */
  private deriveOverallStatus(
    status: ConsolidationStatusDetail
  ): ConsolidationStatus {
    const operations = status.chainOperations;
    const hasActive = operations.some(
      (op) =>
        op.status === ChainOperationStatus.SWAPPING ||
        op.status === ChainOperationStatus.BRIDGING
    );
    const hasFailed = operations.some(
      (op) => op.status === ChainOperationStatus.FAILED
    );
    const allComplete = operations.every(
      (op) =>
        op.status === ChainOperationStatus.COMPLETED ||
        op.status === ChainOperationStatus.SKIPPED ||
        op.status === ChainOperationStatus.FAILED
    );
    const allPending = operations.every(
      (op) => op.status === ChainOperationStatus.PENDING
    );

    if (allPending) {
      return ConsolidationStatus.PENDING;
    }

    if (hasActive) {
      return ConsolidationStatus.EXECUTING;
    }

    if (allComplete) {
      if (hasFailed) {
        const successCount = operations.filter(
          (op) =>
            op.status === ChainOperationStatus.COMPLETED ||
            op.status === ChainOperationStatus.SKIPPED
        ).length;
        return successCount > 0
          ? ConsolidationStatus.PARTIAL_SUCCESS
          : ConsolidationStatus.FAILED;
      }
      return ConsolidationStatus.COMPLETED;
    }

    return ConsolidationStatus.EXECUTING;
  }

  /**
   * Emit a consolidation event
   */
  private async emitEvent(event: ConsolidationEvent): Promise<void> {
    // Store event in list
    const key = `${EVENTS_PREFIX}:${event.consolidationId}`;
    const redis = getRedis();
    await redis.lpush(key, JSON.stringify(event));
    await redis.ltrim(key, 0, 99); // Keep last 100 events
    await redis.expire(key, EVENTS_TTL);

    // Also publish for real-time subscribers
    const pubsubChannel = `${CACHE_PREFIX}:pubsub:${event.consolidationId}`;
    await redis.publish(pubsubChannel, JSON.stringify(event));

    console.log(
      `[StatusTracker] Event: ${event.type} for ${event.consolidationId}${event.chain ? ` (${event.chain})` : ""}`
    );
  }

  /**
   * Get events for a consolidation
   */
  async getEvents(
    consolidationId: string,
    limit: number = 50
  ): Promise<ConsolidationEvent[]> {
    const key = `${EVENTS_PREFIX}:${consolidationId}`;
    const redis = getRedis();
    const events = await redis.lrange(key, 0, limit - 1);
    return events.map((e) => JSON.parse(e) as ConsolidationEvent);
  }

  /**
   * Add consolidation to user's history
   */
  private async addToUserHistory(
    userId: string,
    consolidationId: string
  ): Promise<void> {
    const key = `${USER_PREFIX}:${userId.toLowerCase()}:history`;
    const redis = getRedis();
    await redis.lpush(key, consolidationId);
    await redis.ltrim(key, 0, 499); // Keep last 500
    await redis.expire(key, USER_HISTORY_TTL);
  }

  /**
   * Get user's consolidation history
   */
  async getUserHistory(
    userId: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<ConsolidationStatusDetail[]> {
    const key = `${USER_PREFIX}:${userId.toLowerCase()}:history`;
    const redis = getRedis();
    const ids = await redis.lrange(key, offset, offset + limit - 1);

    const statuses: ConsolidationStatusDetail[] = [];
    for (const id of ids) {
      const status = await this.getStatus(id);
      if (status) {
        statuses.push(status);
      }
    }

    return statuses;
  }

  /**
   * Store a consolidation plan
   */
  async storePlan(plan: ConsolidationPlan): Promise<void> {
    const key = `${PLAN_PREFIX}:${plan.id}`;
    await cacheSet(key, plan, PLAN_TTL);
  }

  /**
   * Get a consolidation plan
   */
  async getPlan(planId: string): Promise<ConsolidationPlan | null> {
    const key = `${PLAN_PREFIX}:${planId}`;
    return cacheGet<ConsolidationPlan>(key);
  }

  /**
   * Extend plan TTL (when execution starts)
   */
  async extendPlanTtl(planId: string, additionalSeconds: number): Promise<void> {
    const key = `${PLAN_PREFIX}:${planId}`;
    const redis = getRedis();
    await redis.expire(key, additionalSeconds);
  }
}

/**
 * Create a new status tracker instance
 */
export function createStatusTracker(): ConsolidationStatusTracker {
  return new ConsolidationStatusTracker();
}

// Export singleton for convenience
let _statusTracker: ConsolidationStatusTracker | null = null;

export function getStatusTracker(): ConsolidationStatusTracker {
  if (!_statusTracker) {
    _statusTracker = createStatusTracker();
  }
  return _statusTracker;
}
