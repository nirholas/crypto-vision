/**
 * Bridge Worker
 * BullMQ worker for executing and tracking bridge transactions
 */

import { Worker, type Job } from "bullmq";
import { cacheGet, cacheSet } from "../../utils/redis.js";
import { createPublicClient, createWalletClient, http, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { CHAIN_CONFIG, type SupportedChain } from "../../config/chains.js";
import {
  QUEUE_NAMES,
  type BridgeExecuteJobData,
  type BridgeTrackJobData,
  addBridgeTrackJob,
} from "../index.js";
import {
  type BridgeProvider,
  BridgeStatus,
  BRIDGE_CONFIG,
  type BridgeQuote,
  type BridgeReceipt,
  type BridgeHistoryEntry,
} from "../../services/bridge/types.js";
import { createBridgeAggregator } from "../../services/bridge/index.js";
import { createSweepRouter } from "../../services/bridge/router.js";

/**
 * Bridge execution result
 */
export interface BridgeExecuteResult {
  success: boolean;
  planId: string;
  executedBridges: {
    sourceChain: string;
    destinationChain: string;
    txHash: string;
    provider: BridgeProvider;
    amount: string;
    status: BridgeStatus;
  }[];
  failedBridges: {
    sourceChain: string;
    error: string;
  }[];
  error?: string;
}

/**
 * Bridge tracking result
 */
export interface BridgeTrackResult {
  planId: string;
  bridgeId: string;
  status: BridgeStatus;
  sourceTxHash: string;
  destinationTxHash?: string;
  outputAmount?: string;
  completedAt?: number;
  error?: string;
}

/**
 * Notification types for bridge events
 */
export interface BridgeNotification {
  type: "bridge_started" | "bridge_completed" | "bridge_failed" | "bridge_refunded";
  userId: string;
  planId: string;
  bridgeId: string;
  sourceChain: string;
  destinationChain: string;
  provider: BridgeProvider;
  amount: string;
  sourceTxHash: string;
  destinationTxHash?: string;
  error?: string;
  timestamp: number;
}

/**
 * Get Redis connection URL
 */
function getRedisUrl(): string {
  return process.env.REDIS_URL || "redis://localhost:6379";
}

/**
 * ERC-20 approve ABI
 */
const ERC20_APPROVE_ABI = parseAbi([
  "function approve(address spender, uint256 amount) returns (bool)",
]);

/**
 * Get public client for a chain
 */
function getBridgePublicClient(chain: string) {
  const chainKey = chain as Exclude<SupportedChain, "solana">;
  const config = CHAIN_CONFIG[chainKey];
  if (!config) throw new Error(`Unsupported chain: ${chain}`);

  const rpcUrl = process.env[config.rpcEnvKey] || undefined;
  return createPublicClient({
    chain: config.chain,
    transport: http(rpcUrl),
  });
}

/**
 * Get wallet client for a chain
 */
function getBridgeWalletClient(chain: string) {
  const chainKey = chain as Exclude<SupportedChain, "solana">;
  const config = CHAIN_CONFIG[chainKey];
  if (!config) throw new Error(`Unsupported chain: ${chain}`);

  const privateKey = process.env.SWEEP_EXECUTOR_KEY || process.env.FACILITATOR_PRIVATE_KEY;
  if (!privateKey) throw new Error("SWEEP_EXECUTOR_KEY not configured");

  const account = privateKeyToAccount(privateKey as `0x${string}`);
  const rpcUrl = process.env[config.rpcEnvKey] || undefined;

  return createWalletClient({
    account,
    chain: config.chain,
    transport: http(rpcUrl),
  });
}

/**
 * Send a notification for bridge events
 * In production, this would integrate with a notification service
 */
async function sendBridgeNotification(notification: BridgeNotification): Promise<void> {
  // Store notification in Redis for retrieval
  const notificationKey = `bridge:notification:${notification.userId}:${Date.now()}`;
  await cacheSet(notificationKey, notification, 86400 * 7); // 7 days
  
  // Add to user's notification list
  const userNotificationsKey = `bridge:notifications:${notification.userId}`;
  const existingNotifications = await cacheGet<string[]>(userNotificationsKey) || [];
  existingNotifications.unshift(notificationKey);
  
  // Keep only last 100 notifications
  const trimmedNotifications = existingNotifications.slice(0, 100);
  await cacheSet(userNotificationsKey, trimmedNotifications, 86400 * 30); // 30 days
  
  console.log(`[BridgeNotification] ${notification.type} for ${notification.bridgeId}`);
  
  // Push notification via webhook if user has registered one
  const webhookUrl = await cacheGet<string>(`bridge:webhook:${notification.userId}`);
  if (webhookUrl) {
    try {
      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(notification),
        signal: AbortSignal.timeout(5000), // 5s timeout
      });
      console.log(`[BridgeNotification] Webhook sent to ${webhookUrl}`);
    } catch (error) {
      console.warn(`[BridgeNotification] Webhook delivery failed:`, error);
    }
  }
  
  // Email notification for important events (completed, failed, refunded)
  if (notification.type !== "bridge_started") {
    const emailConfig = await cacheGet<{ email: string; enabled: boolean }>(
      `bridge:email:${notification.userId}`
    );
    if (emailConfig?.enabled && emailConfig.email) {
      try {
        const emailApiUrl = process.env.EMAIL_SERVICE_URL;
        if (emailApiUrl) {
          await fetch(`${emailApiUrl}/send`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              to: emailConfig.email,
              subject: `Bridge ${notification.type.replace("bridge_", "")}: ${notification.sourceChain} → ${notification.destinationChain}`,
              template: "bridge-notification",
              data: notification,
            }),
            signal: AbortSignal.timeout(5000),
          });
          console.log(`[BridgeNotification] Email sent to ${emailConfig.email}`);
        }
      } catch (error) {
        console.warn(`[BridgeNotification] Email delivery failed:`, error);
      }
    }
  }

  // Push notification via Firebase Cloud Messaging if configured
  const fcmToken = await cacheGet<string>(`bridge:fcm:${notification.userId}`);
  if (fcmToken && process.env.FCM_SERVER_KEY) {
    try {
      await fetch("https://fcm.googleapis.com/fcm/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `key=${process.env.FCM_SERVER_KEY}`,
        },
        body: JSON.stringify({
          to: fcmToken,
          notification: {
            title: `Bridge ${notification.type.replace("bridge_", "")}`,
            body: `${notification.sourceChain} → ${notification.destinationChain}: ${notification.amount}`,
          },
          data: notification,
        }),
        signal: AbortSignal.timeout(5000),
      });
      console.log(`[BridgeNotification] Push notification sent`);
    } catch (error) {
      console.warn(`[BridgeNotification] Push notification failed:`, error);
    }
  }
}

/**
 * Update bridge history for a user
 */
async function updateBridgeHistory(
  userId: string,
  entry: BridgeHistoryEntry
): Promise<void> {
  const historyKey = `bridge:history:${userId.toLowerCase()}`;
  const existingHistory = await cacheGet<BridgeHistoryEntry[]>(historyKey) || [];
  
  // Check if entry already exists (update) or is new (add)
  const existingIndex = existingHistory.findIndex((e) => e.id === entry.id);
  
  if (existingIndex >= 0) {
    existingHistory[existingIndex] = entry;
  } else {
    existingHistory.unshift(entry);
  }
  
  // Keep last 500 entries
  const trimmedHistory = existingHistory.slice(0, 500);
  await cacheSet(historyKey, trimmedHistory, 86400 * 90); // 90 days
}

/**
 * Create the bridge execution worker
 */
export function createBridgeExecuteWorker(): Worker<
  BridgeExecuteJobData,
  BridgeExecuteResult
> {
  const connection = { url: getRedisUrl() };
  const aggregator = createBridgeAggregator();
  const router = createSweepRouter(aggregator);
  
  const worker = new Worker<BridgeExecuteJobData, BridgeExecuteResult>(
    QUEUE_NAMES.BRIDGE_EXECUTE,
    async (job: Job<BridgeExecuteJobData>) => {
      const { planId, userId, bridges, walletAddress, signature } = job.data;
      
      console.log(
        `[BridgeWorker] Executing bridge plan ${planId} with ${bridges.length} bridges`
      );
      
      const executedBridges: BridgeExecuteResult["executedBridges"] = [];
      const failedBridges: BridgeExecuteResult["failedBridges"] = [];
      
      try {
        // Update job progress
        await job.updateProgress(10);
        
        // Get the sweep plan from cache
        const plan = await router.getPlan(planId);
        if (!plan) {
          throw new Error("Sweep plan expired or not found");
        }
        
        // Validate plan hasn't expired
        if (plan.expiresAt < Date.now()) {
          throw new Error("Sweep plan has expired");
        }
        
        await job.updateProgress(20);
        
        // Execute bridges in priority order
        const sortedBridges = [...bridges].sort((a, b) => {
          const bridgeA = plan.bridges.find(
            (pb) => pb.sourceChain === a.sourceChain
          );
          const bridgeB = plan.bridges.find(
            (pb) => pb.sourceChain === b.sourceChain
          );
          return (bridgeB?.priority || 0) - (bridgeA?.priority || 0);
        });
        
        const progressPerBridge = 60 / sortedBridges.length;
        let currentProgress = 20;
        
        for (const bridgeRequest of sortedBridges) {
          const { sourceChain, quoteId } = bridgeRequest;
          
          console.log(`[BridgeWorker] Processing bridge from ${sourceChain}`);
          
          try {
            // Get quote from cache
            const quote = await cacheGet<BridgeQuote>(
              `bridge:quote:${quoteId}`
            );
            
            if (!quote) {
              // Try to get from plan
              const planBridge = plan.bridges.find(
                (b) => b.sourceChain === sourceChain
              );
              if (!planBridge) {
                throw new Error(`Bridge quote not found for ${sourceChain}`);
              }
              // Use quote from plan
              Object.assign(quote || {}, planBridge.quote);
            }
            
            if (!quote) {
              throw new Error(`Quote expired for ${sourceChain}`);
            }
            
            // Build the bridge transaction
            const tx = await aggregator.buildTransaction(quote);
            
            // Execute the bridge transaction on-chain
            const walletClient = getBridgeWalletClient(sourceChain);
            const publicClient = getBridgePublicClient(sourceChain);
            
            // Handle token approval if needed
            if (tx.approval) {
              console.log(`[BridgeWorker] Approving ${tx.approval.token} for ${tx.approval.spender}`);
              const approvalHash = await walletClient.writeContract({
                address: tx.approval.token,
                abi: ERC20_APPROVE_ABI,
                functionName: "approve",
                args: [tx.approval.spender, tx.approval.amount],
              });
              
              await publicClient.waitForTransactionReceipt({
                hash: approvalHash,
                confirmations: 1,
              });
            }
            
            // Submit the bridge transaction
            const txHash = await walletClient.sendTransaction({
              to: tx.to,
              data: tx.data,
              value: tx.value,
              gas: tx.gasLimit,
            });
            
            console.log(
              `[BridgeWorker] Bridge tx submitted: ${txHash} (${sourceChain} -> ${quote.destinationChain})`
            );
            
            // Add to executed list
            executedBridges.push({
              sourceChain,
              destinationChain: quote.destinationChain,
              txHash: txHash,
              provider: quote.provider,
              amount: quote.inputAmount.toString(),
              status: BridgeStatus.PENDING,
            });
            
            // Queue tracking job
            await addBridgeTrackJob({
              planId,
              bridgeId: `${planId}-${sourceChain}`,
              sourceTxHash: txHash,
              sourceChain,
              destinationChain: quote.destinationChain,
              provider: quote.provider,
            });
            
            // Update progress
            currentProgress += progressPerBridge;
            await job.updateProgress(Math.floor(currentProgress));
            
          } catch (error) {
            const errorMessage =
              error instanceof Error ? error.message : "Unknown error";
            console.error(
              `[BridgeWorker] Bridge from ${sourceChain} failed:`,
              errorMessage
            );
            
            failedBridges.push({
              sourceChain,
              error: errorMessage,
            });
            
            // Handle partial failure - continue with other bridges
            await router.handlePartialFailure(planId, sourceChain as any, errorMessage);
          }
        }
        
        await job.updateProgress(90);
        
        // Update plan progress
        await router.updatePlanProgress(
          planId,
          executedBridges.map((b) => ({
            sourceChain: b.sourceChain as any,
            txHash: b.txHash,
          }))
        );
        
        // Cache execution result
        await cacheSet(
          `bridge:execution:${planId}`,
          {
            planId,
            executedBridges,
            failedBridges,
            timestamp: Date.now(),
          },
          3600 // 1 hour
        );
        
        await job.updateProgress(100);
        
        return {
          success: failedBridges.length === 0,
          planId,
          executedBridges,
          failedBridges,
          error:
            failedBridges.length > 0
              ? `${failedBridges.length} bridges failed`
              : undefined,
        };
        
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        console.error(`[BridgeWorker] Plan execution failed:`, errorMessage);
        
        return {
          success: false,
          planId,
          executedBridges,
          failedBridges,
          error: errorMessage,
        };
      }
    },
    {
      connection,
      concurrency: 5, // Process up to 5 bridge plans concurrently
      limiter: {
        max: 10,
        duration: 1000, // Max 10 jobs per second
      },
    }
  );
  
  // Error handling
  worker.on("failed", (job, err) => {
    console.error(
      `[BridgeWorker] Job ${job?.id} failed:`,
      err.message
    );
  });
  
  worker.on("completed", (job, result) => {
    console.log(
      `[BridgeWorker] Job ${job.id} completed: ${result.executedBridges.length} bridges executed`
    );
  });
  
  return worker;
}

/**
 * Create the bridge tracking worker
 */
export function createBridgeTrackWorker(): Worker<
  BridgeTrackJobData,
  BridgeTrackResult
> {
  const connection = { url: getRedisUrl() };
  const aggregator = createBridgeAggregator();
  
  const worker = new Worker<BridgeTrackJobData, BridgeTrackResult>(
    QUEUE_NAMES.BRIDGE_TRACK,
    async (job: Job<BridgeTrackJobData>) => {
      const {
        planId,
        bridgeId,
        sourceTxHash,
        sourceChain,
        destinationChain,
        provider,
      } = job.data;
      
      console.log(
        `[BridgeTrackWorker] Checking status for ${bridgeId}: ${sourceTxHash}`
      );
      
      try {
        // Get status from the bridge provider
        const receipt = await aggregator.getStatus(
          sourceTxHash as `0x${string}`,
          sourceChain as any,
          provider
        );
        
        console.log(
          `[BridgeTrackWorker] Status for ${bridgeId}: ${receipt.status}`
        );
        
        // Get user ID from cached plan data
        const planData = await cacheGet<{ userId: string }>(`bridge:execution:${planId}`);
        const userId = planData?.userId || "unknown";
        
        // Handle different statuses
        switch (receipt.status) {
          case BridgeStatus.COMPLETED:
            // Bridge completed successfully
            await cacheSet(
              `bridge:receipt:${bridgeId}`,
              receipt,
              86400 // 24 hours
            );
            
            // Update history
            await updateBridgeHistory(userId, {
              id: bridgeId,
              userId,
              provider,
              sourceChain: sourceChain as any,
              destinationChain: destinationChain as any,
              sourceToken: "", // Not available in receipt
              destinationToken: "", // Not available in receipt
              inputAmount: receipt.inputAmount.toString(),
              outputAmount: receipt.outputAmount?.toString(),
              feeUsd: 0, // Would need to calculate
              status: BridgeStatus.COMPLETED,
              sourceTxHash,
              destTxHash: receipt.destinationTxHash,
              createdAt: receipt.initiatedAt,
              completedAt: Date.now(),
            });
            
            // Send notification
            await sendBridgeNotification({
              type: "bridge_completed",
              userId,
              planId,
              bridgeId,
              sourceChain,
              destinationChain,
              provider,
              amount: receipt.inputAmount.toString(),
              sourceTxHash,
              destinationTxHash: receipt.destinationTxHash,
              timestamp: Date.now(),
            });
            
            return {
              planId,
              bridgeId,
              status: BridgeStatus.COMPLETED,
              sourceTxHash,
              destinationTxHash: receipt.destinationTxHash,
              outputAmount: receipt.outputAmount?.toString(),
              completedAt: Date.now(),
            };
            
          case BridgeStatus.FAILED:
          case BridgeStatus.REFUNDED:
            // Bridge failed or refunded
            const failedStatus = receipt.status;
            
            // Update history
            await updateBridgeHistory(userId, {
              id: bridgeId,
              userId,
              provider,
              sourceChain: sourceChain as any,
              destinationChain: destinationChain as any,
              sourceToken: "",
              destinationToken: "",
              inputAmount: receipt.inputAmount.toString(),
              feeUsd: 0,
              status: failedStatus,
              sourceTxHash,
              createdAt: receipt.initiatedAt,
              error: receipt.error,
            });
            
            // Send notification
            await sendBridgeNotification({
              type: failedStatus === BridgeStatus.REFUNDED ? "bridge_refunded" : "bridge_failed",
              userId,
              planId,
              bridgeId,
              sourceChain,
              destinationChain,
              provider,
              amount: receipt.inputAmount.toString(),
              sourceTxHash,
              error: receipt.error,
              timestamp: Date.now(),
            });
            
            return {
              planId,
              bridgeId,
              status: failedStatus,
              sourceTxHash,
              error: receipt.error || "Bridge failed",
            };
            
          default:
            // Still pending - requeue to check again
            const attemptCount = (job.attemptsMade || 0) + 1;
            
            if (attemptCount >= BRIDGE_CONFIG.MAX_STATUS_CHECKS) {
              // Too many attempts, mark as failed
              return {
                planId,
                bridgeId,
                status: BridgeStatus.FAILED,
                sourceTxHash,
                error: "Bridge tracking timed out",
              };
            }
            
            // Requeue with delay
            await addBridgeTrackJob(
              {
                planId,
                bridgeId,
                sourceTxHash,
                sourceChain,
                destinationChain,
                provider,
              },
              {
                delay: BRIDGE_CONFIG.STATUS_CHECK_INTERVAL_MS,
              }
            );
            
            return {
              planId,
              bridgeId,
              status: receipt.status,
              sourceTxHash,
            };
        }
        
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        console.error(
          `[BridgeTrackWorker] Error checking status for ${bridgeId}:`,
          errorMessage
        );
        
        // Retry on transient errors
        const attemptCount = (job.attemptsMade || 0) + 1;
        if (attemptCount < 10) {
          await addBridgeTrackJob(
            {
              planId,
              bridgeId,
              sourceTxHash,
              sourceChain,
              destinationChain,
              provider,
            },
            {
              delay: BRIDGE_CONFIG.STATUS_CHECK_INTERVAL_MS * 2, // Double delay on error
            }
          );
        }
        
        return {
          planId,
          bridgeId,
          status: BridgeStatus.PENDING,
          sourceTxHash,
          error: errorMessage,
        };
      }
    },
    {
      connection,
      concurrency: 20, // Can track many bridges concurrently
      limiter: {
        max: 50,
        duration: 1000, // Max 50 status checks per second
      },
    }
  );
  
  // Error handling
  worker.on("failed", (job, err) => {
    console.error(
      `[BridgeTrackWorker] Job ${job?.id} failed:`,
      err.message
    );
  });
  
  worker.on("completed", (job, result) => {
    if (result.status === BridgeStatus.COMPLETED) {
      console.log(
        `[BridgeTrackWorker] Bridge ${result.bridgeId} completed: ${result.destinationTxHash}`
      );
    }
  });
  
  return worker;
}

/**
 * Start all bridge workers
 */
export function startBridgeWorkers(): {
  executeWorker: Worker<BridgeExecuteJobData, BridgeExecuteResult>;
  trackWorker: Worker<BridgeTrackJobData, BridgeTrackResult>;
} {
  const executeWorker = createBridgeExecuteWorker();
  const trackWorker = createBridgeTrackWorker();
  
  console.log("[BridgeWorkers] Bridge workers started");
  
  return {
    executeWorker,
    trackWorker,
  };
}

/**
 * Stop all bridge workers
 */
export async function stopBridgeWorkers(workers: {
  executeWorker: Worker;
  trackWorker: Worker;
}): Promise<void> {
  await Promise.all([
    workers.executeWorker.close(),
    workers.trackWorker.close(),
  ]);
  
  console.log("[BridgeWorkers] Bridge workers stopped");
}
