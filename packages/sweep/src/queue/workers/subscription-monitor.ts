import { Worker, type Job } from "bullmq";
import {
  QUEUE_NAMES,
  type SubscriptionMonitorJobData,
  type SubscriptionSweepJobData,
  addSweepExecuteJob,
} from "../index.js";
import { getSubscriptionMonitor } from "../../services/subscriptions/monitor.js";
import { getSubscriptionService } from "../../services/subscriptions/index.js";
import { getDb, sweeps } from "../../db/index.js";
import { randomUUID } from "crypto";

// ============================================================================
// Types
// ============================================================================

export interface SubscriptionMonitorWorkerResult {
  success: boolean;
  checked: number;
  triggered: number;
  expired: number;
  errors: string[];
  duration: number;
}

export interface SubscriptionSweepWorkerResult {
  success: boolean;
  subscriptionId: string;
  sweepId?: string;
  txHashes: Record<string, string>;
  error?: string;
}

// ============================================================================
// Redis Connection
// ============================================================================

function getRedisUrl(): string {
  return process.env.REDIS_URL || "redis://localhost:6379";
}

// ============================================================================
// Subscription Monitor Worker
// ============================================================================

/**
 * Create the subscription monitor worker
 * Runs every 15 minutes via cron job to check all active subscriptions
 */
export function createSubscriptionMonitorWorker(): Worker<
  SubscriptionMonitorJobData,
  SubscriptionMonitorWorkerResult
> {
  const connection = { url: getRedisUrl() };

  const worker = new Worker<SubscriptionMonitorJobData, SubscriptionMonitorWorkerResult>(
    QUEUE_NAMES.SUBSCRIPTION_MONITOR,
    async (job: Job<SubscriptionMonitorJobData>) => {
      const startTime = Date.now();
      console.log(`[SubscriptionMonitorWorker] Starting job ${job.id}`);

      try {
        const monitor = getSubscriptionMonitor();
        const stats = await monitor.checkAllSubscriptions();

        const duration = Date.now() - startTime;

        console.log(
          `[SubscriptionMonitorWorker] Completed in ${duration}ms - ` +
          `Checked: ${stats.checked}, Triggered: ${stats.triggered}, ` +
          `Expired: ${stats.expired}, Errors: ${stats.errors.length}`
        );

        return {
          success: stats.errors.length === 0,
          checked: stats.checked,
          triggered: stats.triggered,
          expired: stats.expired,
          errors: stats.errors,
          duration,
        };
      } catch (error) {
        console.error("[SubscriptionMonitorWorker] Fatal error:", error);
        throw error;
      }
    },
    {
      connection,
      concurrency: 1, // Only one monitor job at a time
      limiter: {
        max: 1,
        duration: 60000, // Max 1 job per minute (safety limit)
      },
    }
  );

  // Event handlers
  worker.on("completed", (job, result) => {
    console.log(
      `[SubscriptionMonitorWorker] Job ${job.id} completed:`,
      `checked=${result.checked}, triggered=${result.triggered}`
    );
  });

  worker.on("failed", (job, err) => {
    console.error(
      `[SubscriptionMonitorWorker] Job ${job?.id} failed:`,
      err.message
    );
  });

  return worker;
}

// ============================================================================
// Subscription Sweep Worker
// ============================================================================

/**
 * Create the subscription sweep worker
 * Executes auto-sweeps triggered by the monitor
 */
export function createSubscriptionSweepWorker(): Worker<
  SubscriptionSweepJobData,
  SubscriptionSweepWorkerResult
> {
  const connection = { url: getRedisUrl() };

  const worker = new Worker<SubscriptionSweepJobData, SubscriptionSweepWorkerResult>(
    QUEUE_NAMES.SUBSCRIPTION_SWEEP,
    async (job: Job<SubscriptionSweepJobData>) => {
      const {
        subscriptionId,
        userId,
        walletAddress,
        tokens,
        destinationChain,
        destinationAsset,
        destinationProtocol,
        spendPermissionSignature,
        triggeredBy,
        estimatedDustValueUsd,
        estimatedCostUsd,
      } = job.data;

      console.log(
        `[SubscriptionSweepWorker] Executing sweep for subscription ${subscriptionId} ` +
        `(${tokens.length} tokens, $${estimatedDustValueUsd.toFixed(2)} value)`
      );

      const db = getDb();
      const subscriptionService = getSubscriptionService();

      try {
        await job.updateProgress(10);

        // Create a sweep record
        const sweepId = randomUUID();
        
        await db.insert(sweeps).values({
          id: sweepId,
          userId,
          status: "pending",
          chains: [...new Set(tokens.map(t => t.chain))],
          tokens: tokens.map(t => ({
            address: t.address,
            chain: t.chain,
            symbol: t.symbol,
            amount: t.amount,
            usdValue: t.valueUsd,
          })),
          outputChain: destinationChain.toString(),
          defiProtocol: destinationProtocol,
          totalInputValueUsd: estimatedDustValueUsd.toString(),
        });

        await job.updateProgress(30);

        // Record the subscription sweep
        await subscriptionService.recordSweep(subscriptionId, sweepId, {
          triggeredBy,
          dustValueUsd: estimatedDustValueUsd,
          sweepCostUsd: estimatedCostUsd,
          tokensSwept: tokens.length,
          chains: [...new Set(tokens.map(t => parseInt(t.chain) || 1))] as number[],
        });

        await job.updateProgress(50);

        // Queue the actual sweep execution
        // The sweep worker will handle the actual token transfers
        await addSweepExecuteJob({
          userId,
          sweepId,
          quoteId: `subscription-${subscriptionId}-${Date.now()}`,
          walletAddress,
          signature: spendPermissionSignature,
          tokens: tokens.map(t => ({
            address: t.address,
            chain: t.chain,
            amount: t.amount,
          })),
          outputToken: destinationAsset,
          outputChain: destinationChain.toString(),
        });

        await job.updateProgress(100);

        console.log(
          `[SubscriptionSweepWorker] Queued sweep execution for subscription ${subscriptionId}`
        );

        return {
          success: true,
          subscriptionId,
          sweepId,
          txHashes: {},
        };
      } catch (error) {
        console.error(
          `[SubscriptionSweepWorker] Failed sweep for subscription ${subscriptionId}:`,
          error
        );

        // Update subscription sweep status to failed
        // This would require tracking the subscription sweep ID
        
        throw error;
      }
    },
    {
      connection,
      concurrency: 5, // Process up to 5 subscription sweeps in parallel
    }
  );

  // Event handlers
  worker.on("completed", (job, result) => {
    console.log(
      `[SubscriptionSweepWorker] Job ${job.id} completed for subscription ${result.subscriptionId}`
    );
  });

  worker.on("failed", (job, err) => {
    console.error(
      `[SubscriptionSweepWorker] Job ${job?.id} failed:`,
      err.message
    );
  });

  return worker;
}

// ============================================================================
// Worker Factory
// ============================================================================

/**
 * Create all subscription-related workers
 */
export function createSubscriptionWorkers(): {
  monitorWorker: Worker<SubscriptionMonitorJobData, SubscriptionMonitorWorkerResult>;
  sweepWorker: Worker<SubscriptionSweepJobData, SubscriptionSweepWorkerResult>;
} {
  return {
    monitorWorker: createSubscriptionMonitorWorker(),
    sweepWorker: createSubscriptionSweepWorker(),
  };
}
