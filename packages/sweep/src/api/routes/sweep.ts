import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { authMiddleware } from "../middleware/auth.js";
import { strictRateLimit } from "../middleware/ratelimit.js";
import {
  x402Middleware,
  isX402Configured,
  getX402ReceiverAddress,
} from "../middleware/x402.js";
import { getDb, sweeps, sweepQuotes } from "../../db/index.js";
import type { NewSweep } from "../../db/schema.js";
import { eq } from "drizzle-orm";
import { cacheGet, cacheSet } from "../../utils/redis.js";
import { addSweepExecuteJob } from "../../queue/index.js";
import { randomUUID } from "crypto";

const sweep = new Hono();

// Apply strict rate limiting
sweep.use("*", strictRateLimit);

// Request validation schemas
const sweepRequestSchema = z.object({
  wallet: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid wallet address"),
  quoteId: z.string().uuid("Invalid quote ID"),
  signature: z.string().min(1, "Signature required"),
  gasToken: z.string().optional(),
});

/**
 * POST /api/sweep
 * Execute a sweep based on a quote
 * Requires authentication and x402 payment
 */
sweep.post(
  "/",
  authMiddleware,
  // Apply x402 payment middleware if configured ($0.10 per sweep)
  async (c, next) => {
    if (isX402Configured()) {
      const middleware = x402Middleware({
        amountCents: 10,
        receiverAddress: getX402ReceiverAddress(),
        description: "Sweep sweep execution fee ($0.10)",
      });
      return middleware(c, next);
    }
    return next();
  },
  zValidator("json", sweepRequestSchema),
  async (c) => {
    const body = c.req.valid("json");
    const userId = c.get("userId");
    const walletAddress = c.get("walletAddress");

    // Verify wallet ownership
    if (body.wallet.toLowerCase() !== walletAddress.toLowerCase()) {
      return c.json(
        { error: "Not authorized to sweep this wallet" },
        403
      );
    }

    try {
      // Get the quote
      const quote = await cacheGet<any>(`quote:${body.quoteId}`);

      if (!quote) {
        // Try database
        const db = getDb();
        const dbQuote = await db.query.sweepQuotes.findFirst({
          where: eq(sweepQuotes.id, body.quoteId),
        });

        if (!dbQuote) {
          return c.json({ error: "Quote not found" }, 404);
        }

        if (dbQuote.expiresAt < new Date()) {
          return c.json({ error: "Quote expired" }, 410);
        }

        // Use database quote
        Object.assign(quote, dbQuote);
      } else if (quote.expiresAt < Date.now()) {
        return c.json({ error: "Quote expired" }, 410);
      }

      // Verify quote is for this wallet
      if (quote.wallet?.toLowerCase() !== body.wallet.toLowerCase() &&
          quote.walletAddress?.toLowerCase() !== body.wallet.toLowerCase()) {
        return c.json({ error: "Quote is for a different wallet" }, 400);
      }

      // Create sweep record
      const sweepId = randomUUID();
      const db = getDb();

      const tokensArray = (quote.tokens || []).filter((t: any) => t.canSweep !== false);
      const chainsSet = new Set<string>();
      tokensArray.forEach((t: any) => chainsSet.add(String(t.chain)));

      // Prepare tokens data with explicit typing
      const sweepTokens: {
        address: string;
        chain: string;
        symbol: string;
        amount: string;
        usdValue: number;
      }[] = tokensArray.map((t: any) => ({
        address: String(t.address),
        chain: String(t.chain),
        symbol: String(t.symbol),
        amount: String(t.amount),
        usdValue: Number(t.usdValue) || 0,
      }));

      const sweepData: NewSweep = {
        id: sweepId,
        userId,
        status: "pending",
        chains: Array.from(chainsSet),
        tokens: sweepTokens,
        quote: {
          quoteId: body.quoteId,
          outputToken: String(quote.destination?.token || quote.outputToken || ""),
          outputAmount: String(quote.summary?.estimatedOutputAmount || quote.outputAmount || "0"),
          estimatedGas: String(quote.summary?.estimatedGasUsd || quote.estimatedGasUsd || "0"),
          netValueUsd: Number(quote.summary?.netValueUsd || quote.netValueUsd || 0),
          aggregator: String(quote.route?.aggregator || quote.aggregator || "sweep"),
          expiresAt: Number(quote.expiresAt || 0),
        },
        outputToken: String(quote.destination?.token || quote.outputToken || ""),
        outputChain: String(quote.destination?.chain || ""),
        gasToken: body.gasToken,
        totalInputValueUsd: String(quote.summary?.totalInputValueUsd || 0),
        defiDestination: quote.destination?.vault,
        defiProtocol: quote.destination?.protocol,
      };

      await db.insert(sweeps).values(sweepData);

      // Queue the sweep execution
      const job = await addSweepExecuteJob({
        userId,
        sweepId,
        quoteId: body.quoteId,
        walletAddress: body.wallet,
        signature: body.signature,
        tokens: tokensArray.map((t: any) => ({
          address: String(t.address),
          chain: String(t.chain),
          amount: String(t.amount),
        })),
        outputToken: quote.destination?.token || quote.outputToken,
        outputChain: quote.destination?.chain,
        gasToken: body.gasToken,
      });

      // Cache sweep status for quick lookups
      await cacheSet(
        `sweep:status:${sweepId}`,
        {
          status: "pending",
          jobId: job.id,
          createdAt: Date.now(),
        },
        3600
      );

      return c.json({
        sweepId,
        status: "pending",
        jobId: job.id,
        message: "Sweep execution started",
        statusUrl: `/api/sweep/${sweepId}/status`,
        streamUrl: `/api/sweep/${sweepId}/stream`,
      });
    } catch (error) {
      console.error("Error executing sweep:", error);
      return c.json({ error: "Failed to execute sweep" }, 500);
    }
  }
);

/**
 * POST /api/sweep/preview
 * Preview a sweep without executing (no payment required)
 */
sweep.post(
  "/preview",
  authMiddleware,
  zValidator(
    "json",
    z.object({
      wallet: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
      quoteId: z.string().uuid(),
    })
  ),
  async (c) => {
    const { wallet, quoteId } = c.req.valid("json");
    const walletAddress = c.get("walletAddress");

    if (wallet.toLowerCase() !== walletAddress.toLowerCase()) {
      return c.json({ error: "Not authorized" }, 403);
    }

    try {
      const quote = await cacheGet<any>(`quote:${quoteId}`);

      if (!quote) {
        return c.json({ error: "Quote not found" }, 404);
      }

      if (quote.expiresAt < Date.now()) {
        return c.json({ error: "Quote expired" }, 410);
      }

      // Return preview information
      return c.json({
        preview: true,
        tokens: quote.tokens?.filter((t: any) => t.canSweep !== false) || [],
        destination: quote.destination,
        summary: quote.summary,
        route: quote.route,
        warnings: quote.tokens
          ?.filter((t: any) => !t.canSweep)
          .map((t: any) => ({
            token: t.address,
            reason: t.reason,
          })) || [],
        expiresAt: quote.expiresAt,
        estimatedTimeSeconds: 30 + (quote.route?.steps?.length || 1) * 15,
      });
    } catch (error) {
      console.error("Error previewing sweep:", error);
      return c.json({ error: "Failed to preview sweep" }, 500);
    }
  }
);

export { sweep };
