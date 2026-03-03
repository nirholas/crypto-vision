import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { authMiddleware, optionalAuthMiddleware } from "../middleware/auth.js";
import { walletRateLimit } from "../middleware/ratelimit.js";
import {
  addWalletScanJob,
  QUEUE_NAMES,
} from "../../queue/index.js";
import { getDb } from "../../db/index.js";
import { eq } from "drizzle-orm";
import { scanAllChains, getWalletTokenBalancesAlchemy } from "../../services/wallet.service.js";
import { filterDustTokens } from "../../services/validation.service.js";
import type { SupportedChain } from "../../config/chains.js";

const wallet = new Hono();

// Validation schemas
const walletAddressSchema = z.object({
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid wallet address"),
});

const dustQuerySchema = z.object({
  chains: z
    .string()
    .optional()
    .transform((val) => (val ? val.split(",") : undefined)),
  threshold: z
    .string()
    .optional()
    .transform((val) => (val ? parseFloat(val) : 10)),
  async: z
    .string()
    .optional()
    .transform((val) => val === "true"),
});

// Apply rate limiting
wallet.use("*", walletRateLimit(100, 60));

/**
 * GET /api/wallet/:address/dust
 * Scan a wallet for dust tokens (small balance tokens)
 */
wallet.get(
  "/:address/dust",
  zValidator("param", walletAddressSchema),
  zValidator("query", dustQuerySchema),
  optionalAuthMiddleware,
  async (c) => {
    const { address } = c.req.valid("param");
    const { chains, threshold, async: asyncMode } = c.req.valid("query");
    const userId = c.get("userId");

    try {
      // If async mode, queue the scan and return immediately
      if (asyncMode) {
        const job = await addWalletScanJob({
          userId: userId || "",
          walletAddress: address,
          chains: chains || [
            "ethereum",
            "base",
            "arbitrum",
            "polygon",
            "optimism",
            "bsc",
            "linea",
          ],
          dustThreshold: threshold,
        });

        return c.json({
          status: "queued",
          jobId: job.id,
          message: "Wallet scan queued. Poll /api/wallet/:address/dust/status/:jobId for results.",
        });
      }

      // Synchronous scan
      let allBalances: Record<string, any[]>;

      if (chains && chains.length === 1) {
        const chain = chains[0] as Exclude<SupportedChain, "solana">;
        const balances = await getWalletTokenBalancesAlchemy(
          address as `0x${string}`,
          chain
        );
        allBalances = { [chain]: balances };
      } else if (chains && chains.length > 0) {
        // Scan specific chains
        const results = await Promise.all(
          chains.map(async (chain) => {
            try {
              const balances = await getWalletTokenBalancesAlchemy(
                address as `0x${string}`,
                chain as Exclude<SupportedChain, "solana">
              );
              return { chain, balances };
            } catch (error) {
              console.error(`Error scanning ${chain}:`, error);
              return { chain, balances: [] };
            }
          })
        );
        allBalances = Object.fromEntries(
          results.map((r) => [r.chain, r.balances])
        );
      } else {
        // Scan all chains
        allBalances = await scanAllChains(address as `0x${string}`);
      }

      // Filter and validate dust tokens
      const dustByChain: Record<string, any[]> = {};
      let totalValueUsd = 0;
      let totalDustTokens = 0;

      for (const [chainName, balances] of Object.entries(allBalances)) {
        const dustTokensList = await filterDustTokens(balances, threshold);
        if (dustTokensList.length > 0) {
          dustByChain[chainName] = dustTokensList;
          totalDustTokens += dustTokensList.length;
          totalValueUsd += dustTokensList.reduce(
            (sum, d) => sum + d.usdValue,
            0
          );
        }
      }

      return c.json({
        wallet: address,
        dust: dustByChain,
        summary: {
          totalTokens: totalDustTokens,
          totalValueUsd: parseFloat(totalValueUsd.toFixed(2)),
          chains: Object.keys(dustByChain),
          scannedAt: Date.now(),
        },
      });
    } catch (error) {
      console.error("Error scanning wallet for dust:", error);
      return c.json(
        { error: "Failed to scan wallet for dust tokens" },
        500
      );
    }
  }
);

/**
 * GET /api/wallet/:address/dust/status/:jobId
 * Check status of an async dust scan
 */
wallet.get(
  "/:address/dust/status/:jobId",
  zValidator("param", walletAddressSchema.extend({ jobId: z.string() })),
  async (c) => {
    const { address, jobId } = c.req.valid("param");

    try {
      const { getQueues } = await import("../../queue/index.js");
      const queues = getQueues();
      const job = await queues[QUEUE_NAMES.WALLET_SCAN].getJob(jobId);

      if (!job) {
        return c.json({ error: "Job not found" }, 404);
      }

      const state = await job.getState();
      const progress = job.progress;

      if (state === "completed") {
        const result = job.returnvalue;
        return c.json({
          status: "completed",
          wallet: address,
          result,
        });
      }

      if (state === "failed") {
        return c.json({
          status: "failed",
          error: job.failedReason,
        });
      }

      return c.json({
        status: state,
        progress,
      });
    } catch (error) {
      console.error("Error checking job status:", error);
      return c.json({ error: "Failed to check job status" }, 500);
    }
  }
);

/**
 * GET /api/wallet/:address/balances
 * Get all token balances for a wallet (not just dust)
 */
wallet.get(
  "/:address/balances",
  zValidator("param", walletAddressSchema),
  zValidator(
    "query",
    z.object({
      chain: z
        .enum([
          "ethereum",
          "base",
          "arbitrum",
          "polygon",
          "bsc",
          "linea",
          "optimism",
        ])
        .optional(),
    })
  ),
  async (c) => {
    const { address } = c.req.valid("param");
    const { chain } = c.req.valid("query");

    try {
      if (chain) {
        const balances = await getWalletTokenBalancesAlchemy(
          address as `0x${string}`,
          chain as Exclude<SupportedChain, "solana">
        );
        return c.json({
          wallet: address,
          chain,
          balances,
          count: balances.length,
        });
      }

      const allBalances = await scanAllChains(address as `0x${string}`);
      const totalTokens = Object.values(allBalances).reduce(
        (sum, arr) => sum + arr.length,
        0
      );

      return c.json({
        wallet: address,
        balances: allBalances,
        totalTokens,
      });
    } catch (error) {
      console.error("Error fetching balances:", error);
      return c.json({ error: "Failed to fetch balances" }, 500);
    }
  }
);

/**
 * GET /api/wallet/:address/history
 * Get sweep history for a wallet (requires auth)
 */
wallet.get(
  "/:address/history",
  zValidator("param", walletAddressSchema),
  authMiddleware,
  async (c) => {
    const { address } = c.req.valid("param");
    const userId = c.get("userId");
    const walletAddress = c.get("walletAddress");

    // Verify ownership
    if (address.toLowerCase() !== walletAddress.toLowerCase()) {
      return c.json({ error: "Not authorized to view this wallet" }, 403);
    }

    try {
      const db = getDb();

      // Get user's sweeps
      const { sweeps } = await import("../../db/schema.js");
      const userSweeps = await db.query.sweeps.findMany({
        where: eq(sweeps.userId, userId),
        orderBy: (sweeps, { desc }) => [desc(sweeps.createdAt)],
        limit: 50,
      });

      return c.json({
        wallet: address,
        sweeps: userSweeps,
        count: userSweeps.length,
      });
    } catch (error) {
      console.error("Error fetching sweep history:", error);
      return c.json({ error: "Failed to fetch sweep history" }, 500);
    }
  }
);

export { wallet };
