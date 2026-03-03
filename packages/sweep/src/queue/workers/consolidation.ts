/**
 * Consolidation Worker
 * BullMQ worker for executing multi-chain consolidation operations
 */

import { Worker, type Job } from "bullmq";
import { cacheGet, cacheSet } from "../../utils/redis.js";
import {
  QUEUE_NAMES,
  addBridgeTrackJob,
  type BridgeTrackJobData,
} from "../index.js";
import {
  type BridgeProvider,
  BridgeStatus,
  BRIDGE_CONFIG,
  type BridgeQuote,
} from "../../services/bridge/types.js";
import { createBridgeAggregator } from "../../services/bridge/index.js";
import {
  getStatusTracker,
  type ConsolidationJobData,
  type ChainConsolidationPlan,
  ChainOperationStatus,
  ConsolidationStatus,
} from "../../services/consolidation/index.js";
import type { SupportedChain } from "../../config/chains.js";

/**
 * Consolidation execution result
 */
export interface ConsolidationExecuteResult {
  success: boolean;
  consolidationId: string;
  executedChains: {
    chain: SupportedChain;
    swapTxHash?: string;
    bridgeTxHash?: string;
    bridgeProvider?: BridgeProvider;
    outputAmount?: string;
    status: ChainOperationStatus;
  }[];
  failedChains: {
    chain: SupportedChain;
    stage: "swap" | "bridge";
    error: string;
  }[];
  partialSuccess: boolean;
  error?: string;
}

/**
 * Get Redis connection URL
 */
function getRedisUrl(): string {
  return process.env.REDIS_URL || "redis://localhost:6379";
}

/**
 * Simulate a swap execution (placeholder for actual implementation)
 * In production, this would call the SweepExecutor
 */
async function executeSwap(
  chain: SupportedChain,
  plan: ChainConsolidationPlan,
  userAddress: `0x${string}`,
  permitSignature?: string
): Promise<{
  success: boolean;
  txHash?: `0x${string}`;
  outputAmount?: bigint;
  error?: string;
}> {
  // Simulate swap execution
  // In production, this would:
  // 1. Build swap transaction using DEX aggregator
  // 2. Execute via smart wallet or AA
  // 3. Wait for confirmation
  
  console.log(
    `[ConsolidationWorker] Simulating swap on ${chain} for $${plan.swapInputValueUsd.toFixed(2)}`
  );
  
  // Simulate success with 95% probability
  const simulatedSuccess = Math.random() > 0.05;
  
  if (simulatedSuccess) {
    const mockTxHash = `0x${Buffer.from(
      `swap-${chain}-${Date.now()}`
    ).toString("hex").slice(0, 64).padEnd(64, "0")}` as `0x${string}`;
    
    return {
      success: true,
      txHash: mockTxHash,
      outputAmount: plan.swapOutputAmount,
    };
  }
  
  return {
    success: false,
    error: "Simulated swap failure",
  };
}

/**
 * Execute a bridge transaction (placeholder for actual implementation)
 */
async function executeBridge(
  chain: SupportedChain,
  plan: ChainConsolidationPlan,
  userAddress: `0x${string}`,
  aggregator: ReturnType<typeof createBridgeAggregator>
): Promise<{
  success: boolean;
  txHash?: `0x${string}`;
  provider?: BridgeProvider;
  error?: string;
}> {
  if (!plan.bridge) {
    return {
      success: false,
      error: "No bridge configured for this chain",
    };
  }
  
  console.log(
    `[ConsolidationWorker] Executing bridge from ${chain} via ${plan.bridge.provider}`
  );
  
  try {
    // Build the bridge transaction
    const tx = await aggregator.buildTransaction(plan.bridge.quote);
    
    // Simulate bridge execution
    // In production, this would:
    // 1. Execute the transaction via smart wallet
    // 2. Return the source transaction hash
    
    const mockTxHash = `0x${Buffer.from(
      `bridge-${chain}-${plan.bridge.provider}-${Date.now()}`
    ).toString("hex").slice(0, 64).padEnd(64, "0")}` as `0x${string}`;
    
    return {
      success: true,
      txHash: mockTxHash,
      provider: plan.bridge.provider,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Bridge execution failed",
    };
  }
}

/**
 * Create the consolidation execution worker
 */
export function createConsolidationWorker(): Worker<
  ConsolidationJobData,
  ConsolidationExecuteResult
> {
  const connection = { url: getRedisUrl() };
  const aggregator = createBridgeAggregator();
  const statusTracker = getStatusTracker();
  
  const worker = new Worker<ConsolidationJobData, ConsolidationExecuteResult>(
    QUEUE_NAMES.CONSOLIDATION_EXECUTE,
    async (job: Job<ConsolidationJobData>) => {
      const {
        consolidationId,
        planId,
        userId,
        userAddress,
        chainPlans,
        destinationChain,
        destinationToken,
        permitSignatures,
      } = job.data;
      
      console.log(
        `[ConsolidationWorker] Executing consolidation ${consolidationId} with ${chainPlans.length} chains`
      );
      
      const executedChains: ConsolidationExecuteResult["executedChains"] = [];
      const failedChains: ConsolidationExecuteResult["failedChains"] = [];
      
      try {
        // Update job progress
        await job.updateProgress(5);
        
        // Update status to executing
        await statusTracker.updateStatus(consolidationId, {
          status: ConsolidationStatus.EXECUTING,
          startedAt: Date.now(),
        });
        
        // Sort chain plans by priority (lower = first)
        const sortedPlans = [...chainPlans].sort((a, b) => a.priority - b.priority);
        
        const progressPerChain = 90 / sortedPlans.length;
        let currentProgress = 5;
        
        // Execute each chain sequentially
        for (const plan of sortedPlans) {
          const { chain } = plan;
          const isSameChain = chain === destinationChain;
          
          console.log(
            `[ConsolidationWorker] Processing ${chain} (${isSameChain ? "same-chain" : "cross-chain"})`
          );
          
          try {
            // Step 1: Execute swap
            await statusTracker.markSwapStarted(consolidationId, chain);
            
            const permitSignature = permitSignatures?.[chain];
            const swapResult = await executeSwap(
              chain,
              plan,
              userAddress as `0x${string}`,
              permitSignature
            );
            
            if (!swapResult.success) {
              throw new Error(`Swap failed: ${swapResult.error}`);
            }
            
            // Mark swap completed
            await statusTracker.markSwapCompleted(
              consolidationId,
              chain,
              swapResult.txHash!,
              swapResult.outputAmount!,
              plan.swapOutputValueUsd
            );
            
            // Step 2: Execute bridge (if needed)
            if (!isSameChain && plan.bridge) {
              await statusTracker.markBridgeStarted(
                consolidationId,
                chain,
                plan.bridge.provider,
                swapResult.txHash!
              );
              
              const bridgeResult = await executeBridge(
                chain,
                plan,
                userAddress as `0x${string}`,
                aggregator
              );
              
              if (!bridgeResult.success) {
                throw new Error(`Bridge failed: ${bridgeResult.error}`);
              }
              
              // Queue bridge tracking job
              const bridgeId = `${consolidationId}-${chain}`;
              await addBridgeTrackJob({
                planId: consolidationId,
                bridgeId,
                sourceTxHash: bridgeResult.txHash!,
                sourceChain: chain,
                destinationChain,
                provider: bridgeResult.provider!,
              });
              
              executedChains.push({
                chain,
                swapTxHash: swapResult.txHash,
                bridgeTxHash: bridgeResult.txHash,
                bridgeProvider: bridgeResult.provider,
                outputAmount: swapResult.outputAmount?.toString(),
                status: ChainOperationStatus.BRIDGING,
              });
            } else {
              // Same-chain: mark as completed
              await statusTracker.markSameChainCompleted(
                consolidationId,
                chain,
                swapResult.txHash!,
                swapResult.outputAmount!,
                plan.swapOutputValueUsd
              );
              
              executedChains.push({
                chain,
                swapTxHash: swapResult.txHash,
                outputAmount: swapResult.outputAmount?.toString(),
                status: ChainOperationStatus.COMPLETED,
              });
            }
            
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Unknown error";
            console.error(
              `[ConsolidationWorker] Chain ${chain} failed:`,
              errorMessage
            );
            
            // Determine stage
            const stage = errorMessage.includes("Bridge") ? "bridge" : "swap";
            
            // Mark as failed
            await statusTracker.markChainFailed(
              consolidationId,
              chain,
              stage as "swap" | "bridge",
              errorMessage
            );
            
            failedChains.push({
              chain,
              stage: stage as "swap" | "bridge",
              error: errorMessage,
            });
            
            // Continue with other chains (partial success)
          }
          
          // Update progress
          currentProgress += progressPerChain;
          await job.updateProgress(Math.floor(currentProgress));
        }
        
        await job.updateProgress(95);
        
        // Determine final result
        const hasFailures = failedChains.length > 0;
        const hasSuccesses = executedChains.length > 0;
        const partialSuccess = hasFailures && hasSuccesses;
        
        // Cache execution result
        await cacheSet(
          `consolidation:execution:${consolidationId}`,
          {
            consolidationId,
            executedChains,
            failedChains,
            partialSuccess,
            timestamp: Date.now(),
          },
          86400 // 24 hours
        );
        
        await job.updateProgress(100);
        
        console.log(
          `[ConsolidationWorker] Consolidation ${consolidationId} completed: ${executedChains.length} succeeded, ${failedChains.length} failed`
        );
        
        return {
          success: failedChains.length === 0,
          consolidationId,
          executedChains,
          failedChains,
          partialSuccess,
          error: hasFailures
            ? `${failedChains.length} chain(s) failed: ${failedChains.map((f) => f.chain).join(", ")}`
            : undefined,
        };
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        console.error(
          `[ConsolidationWorker] Consolidation ${consolidationId} failed:`,
          errorMessage
        );
        
        // Mark entire consolidation as failed
        await statusTracker.markConsolidationFailed(consolidationId, errorMessage);
        
        return {
          success: false,
          consolidationId,
          executedChains,
          failedChains,
          partialSuccess: executedChains.length > 0,
          error: errorMessage,
        };
      }
    },
    {
      connection,
      concurrency: 3, // Process up to 3 consolidations concurrently
      limiter: {
        max: 5,
        duration: 1000, // Max 5 jobs per second
      },
    }
  );
  
  // Error handling
  worker.on("failed", (job, err) => {
    console.error(
      `[ConsolidationWorker] Job ${job?.id} failed:`,
      err.message
    );
  });
  
  worker.on("completed", (job, result) => {
    const status = result.success
      ? "completed"
      : result.partialSuccess
        ? "partial success"
        : "failed";
    console.log(
      `[ConsolidationWorker] Job ${job.id} ${status}: ${result.executedChains.length}/${result.executedChains.length + result.failedChains.length} chains`
    );
  });
  
  worker.on("progress", (job, progress) => {
    console.log(
      `[ConsolidationWorker] Job ${job.id} progress: ${progress}%`
    );
  });
  
  return worker;
}

/**
 * Create a retry handler for failed consolidation operations
 */
export async function retryFailedChain(
  consolidationId: string,
  chain: SupportedChain
): Promise<{ success: boolean; error?: string }> {
  const statusTracker = getStatusTracker();
  const status = await statusTracker.getStatus(consolidationId);
  
  if (!status) {
    return { success: false, error: "Consolidation not found" };
  }
  
  const chainOp = status.chainOperations.find((co) => co.chain === chain);
  if (!chainOp) {
    return { success: false, error: `Chain ${chain} not found in consolidation` };
  }
  
  if (chainOp.status !== ChainOperationStatus.FAILED) {
    return { success: false, error: `Chain ${chain} is not in failed state` };
  }
  
  // Update retry count
  await statusTracker.updateChainStatus(consolidationId, chain, {
    status: ChainOperationStatus.PENDING,
    retryCount: (chainOp.retryCount || 0) + 1,
    error: undefined,
    swapError: undefined,
    bridgeError: undefined,
  });
  
  // Get job data and re-queue
  const jobData = await cacheGet<ConsolidationJobData>(
    `consolidation:job:${consolidationId}`
  );
  
  if (!jobData) {
    return { success: false, error: "Job data not found" };
  }
  
  // Filter to only retry the failed chain
  const retryJobData: ConsolidationJobData = {
    ...jobData,
    chainPlans: jobData.chainPlans.filter((cp) => cp.chain === chain),
  };
  
  // Add to queue
  const { addConsolidationJob } = await import("../index.js");
  await addConsolidationJob(retryJobData, { priority: 1 }); // Higher priority for retries
  
  return { success: true };
}

/**
 * Start the consolidation worker
 */
export function startConsolidationWorker(): Worker<
  ConsolidationJobData,
  ConsolidationExecuteResult
> {
  const worker = createConsolidationWorker();
  console.log("[ConsolidationWorker] Worker started");
  return worker;
}

/**
 * Stop the consolidation worker
 */
export async function stopConsolidationWorker(
  worker: Worker<ConsolidationJobData, ConsolidationExecuteResult>
): Promise<void> {
  await worker.close();
  console.log("[ConsolidationWorker] Worker stopped");
}
