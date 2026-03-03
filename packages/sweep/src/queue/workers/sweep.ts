import { Worker, type Job } from "bullmq";
import { cacheSet, cacheGet } from "../../utils/redis.js";
import { getDb, sweeps, dustTokens } from "../../db/index.js";
import { eq } from "drizzle-orm";
import { createPublicClient, createWalletClient, http, parseAbi, encodeFunctionData } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { CHAIN_CONFIG, type SupportedChain } from "../../config/chains.js";
import {
  QUEUE_NAMES,
  type SweepExecuteJobData,
  type SweepTrackJobData,
  addSweepTrackJob,
} from "../index.js";

export interface SweepWorkerResult {
  success: boolean;
  sweepId: string;
  txHashes: Record<string, string>;
  userOpHashes: Record<string, string>;
  error?: string;
}

export interface TrackWorkerResult {
  sweepId: string;
  status: "pending" | "confirmed" | "failed";
  confirmations: number;
  txHash: string;
}

/**
 * Get Redis connection URL for BullMQ workers
 */
function getRedisUrl(): string {
  return process.env.REDIS_URL || "redis://localhost:6379";
}

/**
 * ERC-20 ABI for token approvals and transfers
 */
const ERC20_ABI = parseAbi([
  "function approve(address spender, uint256 amount) returns (bool)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
]);

/**
 * Get public client for a chain
 */
function getPublicClient(chain: string) {
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
 * Get wallet client for a chain (requires SWEEP_EXECUTOR_KEY)
 */
function getWalletClient(chain: string) {
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
 * Execute a token swap via DEX aggregator (1inch Fusion API)
 */
async function executeTokenSwap(
  chain: string,
  tokenAddress: string,
  amount: string,
  recipient: string,
): Promise<{ txHash: string; userOpHash?: string }> {
  const publicClient = getPublicClient(chain);
  const walletClient = getWalletClient(chain);
  const chainConfig = CHAIN_CONFIG[chain as Exclude<SupportedChain, "solana">];
  const destinationToken = chainConfig.stablecoin;

  // Step 1: Approve token spending if needed (skip for native tokens)
  const isNativeToken = tokenAddress.toLowerCase() === "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";

  if (!isNativeToken) {
    // Use 1inch router as spender (standard address across chains)
    const oneInchRouter = "0x1111111254EEB25477B68fb85Ed929f73A960582" as `0x${string}`;

    const currentAllowance = await publicClient.readContract({
      address: tokenAddress as `0x${string}`,
      abi: ERC20_ABI,
      functionName: "allowance",
      args: [walletClient.account!.address, oneInchRouter],
    });

    if (currentAllowance < BigInt(amount)) {
      const approvalHash = await walletClient.writeContract({
        address: tokenAddress as `0x${string}`,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [oneInchRouter, BigInt(amount)],
      });

      await publicClient.waitForTransactionReceipt({
        hash: approvalHash,
        confirmations: 1,
      });
    }
  }

  // Step 2: Execute swap via DEX aggregator
  // Try 1inch API for swap data, fall back to direct transfer to stablecoin
  try {
    const chainId = publicClient.chain?.id;
    const swapUrl = `https://api.1inch.dev/swap/v6.0/${chainId}/swap`;
    const params = new URLSearchParams({
      src: tokenAddress,
      dst: destinationToken,
      amount: amount,
      from: walletClient.account!.address,
      slippage: "1",
      disableEstimate: "true",
    });

    const oneInchApiKey = process.env.ONEINCH_API_KEY;
    const response = await fetch(`${swapUrl}?${params}`, {
      headers: oneInchApiKey ? { Authorization: `Bearer ${oneInchApiKey}` } : {},
    });

    if (response.ok) {
      const swapData = await response.json() as { tx: { to: string; data: string; value: string; gas: number } };
      const txHash = await walletClient.sendTransaction({
        to: swapData.tx.to as `0x${string}`,
        data: swapData.tx.data as `0x${string}`,
        value: BigInt(swapData.tx.value || "0"),
        gas: BigInt(swapData.tx.gas || 300000),
      });

      return { txHash };
    }
  } catch (error) {
    console.warn(`[SweepWorker] 1inch API failed for ${chain}, using direct transfer:`, error);
  }

  // Fallback: Direct transfer of token to recipient (for consolidation on same chain)
  if (isNativeToken) {
    const txHash = await walletClient.sendTransaction({
      to: recipient as `0x${string}`,
      value: BigInt(amount),
    });
    return { txHash };
  }

  const txHash = await walletClient.writeContract({
    address: tokenAddress as `0x${string}`,
    abi: ERC20_ABI,
    functionName: "transfer",
    args: [recipient as `0x${string}`, BigInt(amount)],
  });

  return { txHash };
}

/**
 * Create the sweep execution worker
 */
export function createSweepWorker(): Worker<SweepExecuteJobData, SweepWorkerResult> {
  const connection = { url: getRedisUrl() };

  const worker = new Worker<SweepExecuteJobData, SweepWorkerResult>(
    QUEUE_NAMES.SWEEP_EXECUTE,
    async (job: Job<SweepExecuteJobData>) => {
      const {
        sweepId,
        quoteId,
        walletAddress,
        tokens,
      } = job.data;

      console.log(`[SweepWorker] Executing sweep ${sweepId} for wallet ${walletAddress}`);

      const db = getDb();

      try {
        // Update status to executing
        await db
          .update(sweeps)
          .set({ status: "signing", updatedAt: new Date() })
          .where(eq(sweeps.id, sweepId));

        await job.updateProgress(10);

        // Get the quote from cache
        const quoteKey = `quote:${quoteId}`;
        const quote = await cacheGet<any>(quoteKey);
        if (!quote) {
          throw new Error("Quote expired or not found");
        }

        // Verify quote hasn't expired
        if (quote.expiresAt < Date.now()) {
          throw new Error("Quote has expired");
        }

        await job.updateProgress(20);

        // Group tokens by chain for multi-chain sweeps
        const tokensByChain = tokens.reduce(
          (acc, token) => {
            if (!acc[token.chain]) acc[token.chain] = [];
            acc[token.chain].push(token);
            return acc;
          },
          {} as Record<string, typeof tokens>
        );

        const txHashes: Record<string, string> = {};
        const userOpHashes: Record<string, string> = {};

        // Update status to submitted
        await db
          .update(sweeps)
          .set({ status: "submitted", updatedAt: new Date() })
          .where(eq(sweeps.id, sweepId));

        await job.updateProgress(40);

        // Execute sweep on each chain
        for (const [chain, chainTokens] of Object.entries(tokensByChain)) {
          console.log(
            `[SweepWorker] Processing ${chainTokens.length} tokens on ${chain}`
          );

          try {
            // Execute token swaps/transfers for each dust token on this chain
            for (const token of chainTokens) {
              const result = await executeTokenSwap(
                chain,
                token.address,
                token.amount,
                walletAddress,
              );

              txHashes[chain] = result.txHash;
              if (result.userOpHash) {
                userOpHashes[chain] = result.userOpHash;
              }
            }

            // Queue transaction tracking for this chain
            await addSweepTrackJob({
              sweepId,
              txHash: txHashes[chain],
              chain,
              userOpHash: userOpHashes[chain],
            });
          } catch (error) {
            console.error(`[SweepWorker] Error executing sweep on ${chain}:`, error);
            // Generate a marker hash so tracking can handle the failure
            const errorHash = `0x${"00".repeat(32)}` as string;
            txHashes[chain] = errorHash;

            await addSweepTrackJob({
              sweepId,
              txHash: errorHash,
              chain,
              userOpHash: undefined,
            });
          }
        }

        await job.updateProgress(80);

        // Update sweep record with tx hashes
        await db
          .update(sweeps)
          .set({
            txHashes,
            userOpHashes,
            updatedAt: new Date(),
          })
          .where(eq(sweeps.id, sweepId));

        // Mark dust tokens as swept
        for (const token of tokens) {
          await db
            .update(dustTokens)
            .set({
              swept: true,
              sweepId,
            })
            .where(
              eq(dustTokens.tokenAddress, token.address)
            );
        }

        await job.updateProgress(100);

        console.log(`[SweepWorker] Sweep ${sweepId} executed successfully`);

        return {
          success: true,
          sweepId,
          txHashes,
          userOpHashes,
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[SweepWorker] Error executing sweep ${sweepId}:`, error);

        // Update sweep status to failed
        await db
          .update(sweeps)
          .set({
            status: "failed",
            errorMessage,
            updatedAt: new Date(),
          })
          .where(eq(sweeps.id, sweepId));

        throw error;
      }
    },
    {
      connection,
      concurrency: 5, // Limited concurrency for sweep execution
      limiter: {
        max: 20,
        duration: 1000,
      },
    }
  );

  worker.on("completed", (job) => {
    console.log(`[SweepWorker] Job ${job.id} completed`);
  });

  worker.on("failed", (job, error) => {
    console.error(`[SweepWorker] Job ${job?.id} failed:`, error);
  });

  return worker;
}

/**
 * Create the sweep tracking worker
 */
export function createTrackWorker(): Worker<SweepTrackJobData, TrackWorkerResult> {
  const connection = { url: getRedisUrl() };

  const worker = new Worker<SweepTrackJobData, TrackWorkerResult>(
    QUEUE_NAMES.SWEEP_TRACK,
    async (job: Job<SweepTrackJobData>) => {
      const { sweepId, txHash, chain, userOpHash } = job.data;

      console.log(`[TrackWorker] Tracking tx ${txHash} for sweep ${sweepId}`);

      const db = getDb();

      try {
        // Check transaction receipt using viem public client
        let confirmations = 0;
        let isConfirmed = false;

        try {
          const publicClient = getPublicClient(chain);

          const receipt = await publicClient.getTransactionReceipt({
            hash: txHash as `0x${string}`,
          });

          if (receipt) {
            if (receipt.status === "reverted") {
              // Transaction reverted
              await db
                .update(sweeps)
                .set({
                  status: "failed",
                  errorMessage: "Transaction reverted on-chain",
                  updatedAt: new Date(),
                })
                .where(eq(sweeps.id, sweepId));

              return {
                sweepId,
                status: "failed" as const,
                confirmations: 0,
                txHash,
              };
            }

            // Get current block number for confirmation count
            const currentBlock = await publicClient.getBlockNumber();
            confirmations = Number(currentBlock - receipt.blockNumber);
            isConfirmed = confirmations >= 6;
          }
        } catch (error) {
          // Transaction not yet mined or RPC error — treat as pending
          console.log(`[TrackWorker] Tx ${txHash} not yet mined, attempt ${job.attemptsMade}`);
          confirmations = 0;
        }

        if (isConfirmed) {
          // Update sweep status to confirmed
          await db
            .update(sweeps)
            .set({
              status: "confirmed",
              completedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(sweeps.id, sweepId));

          console.log(`[TrackWorker] Sweep ${sweepId} confirmed with ${confirmations} confirmations`);

          // Cache status for WebSocket updates
          await cacheSet(
            `sweep:status:${sweepId}`,
            {
              status: "confirmed",
              txHash,
              confirmations,
              completedAt: Date.now(),
            },
            3600 // 1 hour cache
          );

          return {
            sweepId,
            status: "confirmed",
            confirmations,
            txHash,
          };
        }

        // Not yet confirmed, re-queue to check again
        if (attempts < 60) {
          // Max 60 attempts (5 minutes with 5s delay)
          await addSweepTrackJob(
            { sweepId, txHash, chain, userOpHash },
            { delay: 5000 }
          );
        } else {
          // Transaction didn't confirm in time
          await db
            .update(sweeps)
            .set({
              status: "failed",
              errorMessage: "Transaction confirmation timeout",
              updatedAt: new Date(),
            })
            .where(eq(sweeps.id, sweepId));

          return {
            sweepId,
            status: "failed",
            confirmations,
            txHash,
          };
        }

        // Update cache for WebSocket
        await cacheSet(
          `sweep:status:${sweepId}`,
          {
            status: "pending",
            txHash,
            confirmations,
          },
          300
        );

        return {
          sweepId,
          status: "pending",
          confirmations,
          txHash,
        };
      } catch (error) {
        console.error(`[TrackWorker] Error tracking tx ${txHash}:`, error);
        throw error;
      }
    },
    {
      connection,
      concurrency: 50,
    }
  );

  worker.on("completed", (job) => {
    console.log(`[TrackWorker] Job ${job.id} completed`);
  });

  worker.on("failed", (job, error) => {
    console.error(`[TrackWorker] Job ${job?.id} failed:`, error);
  });

  return worker;
}

// Export for standalone worker process
export { createSweepWorker as default };
