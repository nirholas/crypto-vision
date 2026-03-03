import { Worker, type Job } from "bullmq";
import { cacheSet, cacheGet } from "../../utils/redis.js";
import { getDb, priceCache } from "../../db/index.js";
import { QUEUE_NAMES, type PriceUpdateJobData } from "../index.js";
import { getValidatedPrice } from "../../services/price.service.js";

export interface PriceWorkerResult {
  tokenAddress: string;
  chain: string;
  price: number;
  confidence: string;
  sources: number;
}

// Cache TTL in seconds
const PRICE_CACHE_TTL = 60; // 1 minute

/**
 * Get Redis connection URL for BullMQ workers
 */
function getRedisUrl(): string {
  return process.env.REDIS_URL || "redis://localhost:6379";
}

/**
 * Create the price update worker
 */
export function createPriceWorker(): Worker<PriceUpdateJobData, PriceWorkerResult> {
  const connection = { url: getRedisUrl() };

  const worker = new Worker<PriceUpdateJobData, PriceWorkerResult>(
    QUEUE_NAMES.PRICE_UPDATE,
    async (job: Job<PriceUpdateJobData>) => {
      const { tokenAddress, chain, force = false } = job.data;
      const cacheKey = `price:${chain}:${tokenAddress.toLowerCase()}`;

      console.log(`[PriceWorker] Updating price for ${tokenAddress} on ${chain}`);

      try {
        // Check cache unless forced
        if (!force) {
          const cached = await cacheGet<{
            price: number;
            confidence: string;
            sources?: { name: string }[];
          }>(cacheKey);
          if (cached) {
            console.log(`[PriceWorker] Cache hit for ${tokenAddress}`);
            return {
              tokenAddress,
              chain,
              price: cached.price,
              confidence: cached.confidence,
              sources: cached.sources?.length ?? 0,
            };
          }
        }

        // Fetch validated price from multiple sources
        const validatedPrice = await getValidatedPrice(tokenAddress, chain);

        // Cache in Redis
        await cacheSet(
          cacheKey,
          {
            price: validatedPrice.price,
            confidence: validatedPrice.confidence,
            sources: validatedPrice.sources,
            updatedAt: Date.now(),
          },
          PRICE_CACHE_TTL
        );

        // Store in database for historical tracking
        const db = getDb();
        await db
          .insert(priceCache)
          .values({
            tokenAddress: tokenAddress.toLowerCase(),
            chain,
            priceUsd: validatedPrice.price.toString(),
            confidence: validatedPrice.confidence,
            sources: validatedPrice.sources,
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: [priceCache.tokenAddress, priceCache.chain],
            set: {
              priceUsd: validatedPrice.price.toString(),
              confidence: validatedPrice.confidence,
              sources: validatedPrice.sources,
              updatedAt: new Date(),
            },
          });

        console.log(
          `[PriceWorker] Updated price for ${tokenAddress}: $${validatedPrice.price} (${validatedPrice.confidence})`
        );

        return {
          tokenAddress,
          chain,
          price: validatedPrice.price,
          confidence: validatedPrice.confidence,
          sources: validatedPrice.sources.length,
        };
      } catch (error) {
        console.error(`[PriceWorker] Error updating price for ${tokenAddress}:`, error);
        throw error;
      }
    },
    {
      connection,
      concurrency: 20, // High concurrency for price updates
      limiter: {
        max: 100,
        duration: 1000, // 100 per second max (to respect API limits)
      },
    }
  );

  // Event handlers
  worker.on("completed", (job) => {
    console.log(`[PriceWorker] Job ${job.id} completed`);
  });

  worker.on("failed", (job, error) => {
    console.error(`[PriceWorker] Job ${job?.id} failed:`, error);
  });

  worker.on("error", (error) => {
    console.error("[PriceWorker] Worker error:", error);
  });

  return worker;
}

// Export for standalone worker process
export default createPriceWorker;
