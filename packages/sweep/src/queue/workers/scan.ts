import { Worker, type Job } from "bullmq";
import { getDb, dustTokens, users } from "../../db/index.js";
import { eq } from "drizzle-orm";
import {
  QUEUE_NAMES,
  type WalletScanJobData,
  addBulkPriceUpdateJobs,
} from "../index.js";
import { scanAllChains, getWalletTokenBalancesAlchemy } from "../../services/wallet.service.js";
import { filterDustTokens } from "../../services/validation.service.js";
import type { SupportedChain } from "../../config/chains.js";

export interface ScanWorkerResult {
  tokensFound: number;
  totalValueUsd: number;
  chains: string[];
  dustTokens: {
    chain: string;
    address: string;
    symbol: string;
    balance: string;
    valueUsd: number;
  }[];
}

/**
 * Create the wallet scan worker
 */
/**
 * Get Redis connection URL for BullMQ workers
 */
function getRedisUrl(): string {
  return process.env.REDIS_URL || "redis://localhost:6379";
}

export function createScanWorker(): Worker<WalletScanJobData, ScanWorkerResult> {
  const connection = { url: getRedisUrl() };

  const worker = new Worker<WalletScanJobData, ScanWorkerResult>(
    QUEUE_NAMES.WALLET_SCAN,
    async (job: Job<WalletScanJobData>) => {
      const { userId, walletAddress, chains, dustThreshold = 10 } = job.data;

      console.log(`[ScanWorker] Starting scan for wallet ${walletAddress} on chains: ${chains.join(", ")}`);

      try {
        // Update job progress
        await job.updateProgress(10);

        // Scan for balances
        let allBalances: Record<string, any[]>;

        if (chains.length === 1) {
          const chain = chains[0] as Exclude<SupportedChain, "solana">;
          const balances = await getWalletTokenBalancesAlchemy(
            walletAddress as `0x${string}`,
            chain
          );
          allBalances = { [chain]: balances };
        } else {
          allBalances = await scanAllChains(walletAddress as `0x${string}`);
          // Filter to only requested chains
          if (chains.length > 0) {
            allBalances = Object.fromEntries(
              Object.entries(allBalances).filter(([chain]) => chains.includes(chain))
            );
          }
        }

        await job.updateProgress(50);

        // Filter and validate dust tokens
        const dustByChain: Record<string, any[]> = {};
        let totalValueUsd = 0;
        let totalDustTokens = 0;
        const allDustTokens: ScanWorkerResult["dustTokens"] = [];

        for (const [chainName, balances] of Object.entries(allBalances)) {
          const dustTokensList = await filterDustTokens(balances, dustThreshold);
          dustByChain[chainName] = dustTokensList;
          totalDustTokens += dustTokensList.length;

          for (const dust of dustTokensList) {
            totalValueUsd += dust.usdValue;
            allDustTokens.push({
              chain: chainName,
              address: dust.token.address,
              symbol: dust.token.symbol,
              balance: dust.token.balance,
              valueUsd: dust.usdValue,
            });
          }
        }

        await job.updateProgress(70);

        // Store in database if we have a user ID
        if (userId) {
          const db = getDb();

          // Upsert dust tokens
          for (const dust of allDustTokens) {
            await db
              .insert(dustTokens)
              .values({
                userId,
                walletAddress,
                chain: dust.chain,
                tokenAddress: dust.address,
                symbol: dust.symbol,
                balance: dust.balance,
                valueUsd: dust.valueUsd.toString(),
                scannedAt: new Date(),
                swept: false,
              })
              .onConflictDoUpdate({
                target: [dustTokens.userId, dustTokens.chain, dustTokens.tokenAddress],
                set: {
                  balance: dust.balance,
                  valueUsd: dust.valueUsd.toString(),
                  scannedAt: new Date(),
                },
              });
          }

          // Update user last active
          await db
            .update(users)
            .set({ lastActive: new Date() })
            .where(eq(users.id, userId));
        }

        await job.updateProgress(85);

        // Queue price updates for discovered tokens
        const tokensToUpdate = allDustTokens.map((t) => ({
          address: t.address,
          chain: t.chain,
        }));
        if (tokensToUpdate.length > 0) {
          await addBulkPriceUpdateJobs(tokensToUpdate);
        }

        await job.updateProgress(100);

        const result: ScanWorkerResult = {
          tokensFound: totalDustTokens,
          totalValueUsd,
          chains: Object.keys(dustByChain).filter((k) => dustByChain[k].length > 0),
          dustTokens: allDustTokens,
        };

        console.log(
          `[ScanWorker] Completed scan for ${walletAddress}: ${totalDustTokens} tokens, $${totalValueUsd.toFixed(2)} total`
        );

        return result;
      } catch (error) {
        console.error(`[ScanWorker] Error scanning wallet ${walletAddress}:`, error);
        throw error;
      }
    },
    {
      connection,
      concurrency: 10, // Process 10 scans concurrently
      limiter: {
        max: 50,
        duration: 1000, // 50 per second max
      },
    }
  );

  // Event handlers
  worker.on("completed", (job) => {
    console.log(`[ScanWorker] Job ${job.id} completed`);
  });

  worker.on("failed", (job, error) => {
    console.error(`[ScanWorker] Job ${job?.id} failed:`, error);
  });

  worker.on("error", (error) => {
    console.error("[ScanWorker] Worker error:", error);
  });

  return worker;
}

// Export for standalone worker process
export default createScanWorker;
