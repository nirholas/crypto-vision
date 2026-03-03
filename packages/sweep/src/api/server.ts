import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { serve } from "@hono/node-server";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { getRedis } from "../utils/redis.js";
import { cacheGet, cacheSet } from "../utils/redis.js";

import { scanAllChains, getWalletTokenBalancesAlchemy } from "../services/wallet.service.js";
import { filterDustTokens } from "../services/validation.service.js";
import { getValidatedPrice } from "../services/price.service.js";
import type { SupportedChain } from "../config/chains.js";
import defiRoutes from "./routes/defi.js";
import bridgeRoutes from "./routes/bridge.js";
import { consolidateRoutes } from "./routes/consolidate.js";
import paymentsRoutes from "./routes/payments.js";
import { metricsMiddleware, metricsHandler } from "./middleware/metrics.js";
import {
  x402Middleware,
  isX402Configured,
  getX402ReceiverAddress,
  quotePaymentMiddleware,
  sweepPaymentMiddleware,
  defiDepositMiddleware,
  defiPositionsMiddleware,
  consolidateExecuteMiddleware,
} from "./middleware/x402.js";
import { getEndpointPrice } from "../services/payments/pricing.js";
import { addSweepExecuteJob, addConsolidationJob } from "../queue/index.js";
import { getConsolidationEngine } from "../services/consolidation/index.js";
import { randomUUID } from "crypto";

const app = new Hono();

// ============================================================
// Middleware
// ============================================================
app.use("*", logger());
app.use("*", cors());
app.use("*", metricsMiddleware());

// Simple Redis-based rate limiting
const rateLimitMiddleware = async (c: Parameters<Parameters<typeof app.use>[1]>[0], next: Parameters<Parameters<typeof app.use>[1]>[1]) => {
  const clientIp =
    c.req.header("x-forwarded-for")?.split(",")[0] ||
    c.req.header("x-real-ip") ||
    "unknown";
  
  const redis = getRedis();
  const key = `rate_limit:${clientIp}`;
  const windowMs = 60 * 1000; // 1 minute
  const limit = 100; // 100 requests per minute
  
  try {
    const current = await redis.incr(key);
    if (current === 1) {
      await redis.expire(key, Math.ceil(windowMs / 1000));
    }
    
    if (current > limit) {
      return c.json({ error: "Too many requests", code: "RATE_LIMITED" }, 429);
    }
  } catch {
    // On Redis error, allow request through
  }
  
  await next();
};
app.use("*", rateLimitMiddleware);

// Get x402 receiver address if configured
const x402Receiver = isX402Configured() ? getX402ReceiverAddress() : null;

// ============================================================
// Health check endpoints (always free)
// ============================================================
app.get("/health", (c) => c.json({ status: "ok", timestamp: Date.now() }));
app.get("/health/live", (c) => c.json({ status: "ok", live: true }));
app.get("/health/ready", (c) => c.json({ status: "ok", ready: true }));

// Metrics endpoint (Prometheus format)
app.get("/metrics", metricsHandler);

// ============================================================
// Payments Routes (mostly free)
// ============================================================
app.route("/api/payments", paymentsRoutes);

// ============================================================
// Wallet Endpoints
// ============================================================

const walletParamsSchema = z.object({
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid wallet address"),
});

const chainQuerySchema = z.object({
  chain: z.enum(["ethereum", "base", "arbitrum", "polygon", "bsc", "linea", "optimism"]).optional(),
});

// GET /api/wallet/:address/balances (free)
// Get all token balances for a wallet
app.get(
  "/api/wallet/:address/balances",
  zValidator("param", walletParamsSchema),
  zValidator("query", chainQuerySchema),
  async (c) => {
    const { address } = c.req.valid("param");
    const { chain } = c.req.valid("query");

    try {
      if (chain) {
        // Single chain
        const balances = await getWalletTokenBalancesAlchemy(
          address as `0x${string}`,
          chain as Exclude<SupportedChain, "solana">
        );
        return c.json({ chain, balances, count: balances.length });
      } else {
        // All chains
        const allBalances = await scanAllChains(address as `0x${string}`);
        const totalTokens = Object.values(allBalances).reduce(
          (sum, arr) => sum + arr.length,
          0
        );
        return c.json({ balances: allBalances, totalTokens });
      }
    } catch (error) {
      console.error("Error fetching balances:", error);
      return c.json({ error: "Failed to fetch balances" }, 500);
    }
  }
);

// GET /api/wallet/:address/dust
// Get sweepable dust tokens with validation
app.get(
  "/api/wallet/:address/dust",
  zValidator("param", walletParamsSchema),
  zValidator("query", chainQuerySchema),
  async (c) => {
    const { address } = c.req.valid("param");
    const { chain } = c.req.valid("query");

    try {
      let allBalances: Record<string, any[]>;

      if (chain) {
        const balances = await getWalletTokenBalancesAlchemy(
          address as `0x${string}`,
          chain as Exclude<SupportedChain, "solana">
        );
        allBalances = { [chain]: balances };
      } else {
        allBalances = await scanAllChains(address as `0x${string}`);
      }

      // Filter and validate dust tokens
      const dustByChain: Record<string, any[]> = {};
      let totalValueUsd = 0;
      let totalDustTokens = 0;

      for (const [chainName, balances] of Object.entries(allBalances)) {
        const dustTokens = await filterDustTokens(balances);
        dustByChain[chainName] = dustTokens;
        totalDustTokens += dustTokens.length;
        totalValueUsd += dustTokens.reduce((sum, d) => sum + d.usdValue, 0);
      }

      return c.json({
        dust: dustByChain,
        summary: {
          totalTokens: totalDustTokens,
          totalValueUsd: totalValueUsd.toFixed(2),
          chains: Object.keys(dustByChain).filter(
            (k) => dustByChain[k].length > 0
          ),
        },
      });
    } catch (error) {
      console.error("Error fetching dust:", error);
      return c.json({ error: "Failed to analyze dust tokens" }, 500);
    }
  }
);

// ============================================================
// Price Endpoints
// ============================================================

const priceQuerySchema = z.object({
  token: z.string(),
  chain: z.enum(["ethereum", "base", "arbitrum", "polygon", "bsc", "linea", "optimism"]),
});

// GET /api/price
// Get validated price for a token
app.get("/api/price", zValidator("query", priceQuerySchema), async (c) => {
  const { token, chain } = c.req.valid("query");

  try {
    const validatedPrice = await getValidatedPrice(token, chain);
    return c.json(validatedPrice);
  } catch (error) {
    console.error("Error fetching price:", error);
    return c.json({ error: "Failed to fetch price" }, 500);
  }
});

// ============================================================
// Sweep Endpoints (monetized via x402)
// ============================================================

// POST /api/sweep/quote ($0.05)
// Get a quote for sweeping dust tokens
if (x402Receiver) {
  app.post(
    "/api/sweep/quote",
    quotePaymentMiddleware(x402Receiver),
    async (c) => {
      try {
        const body = await c.req.json();
        const walletAddress = body.wallet as `0x${string}`;
        const chains = (body.chains || ["ethereum", "base", "arbitrum", "polygon", "bsc"]) as string[];

        // Scan for dust tokens across specified chains
        const dustByChain: Record<string, any[]> = {};
        let totalValueUsd = 0;

        for (const chain of chains) {
          try {
            const balances = await getWalletTokenBalancesAlchemy(
              walletAddress,
              chain as Exclude<SupportedChain, "solana">
            );
            const dustTokens = await filterDustTokens(balances);
            dustByChain[chain] = dustTokens;
            totalValueUsd += dustTokens.reduce((sum: number, d: any) => sum + d.usdValue, 0);
          } catch {
            dustByChain[chain] = [];
          }
        }

        // Get price for the endpoint itself
        const endpointPrice = getEndpointPrice("sweep_quote");

        return c.json({
          wallet: walletAddress,
          dust: dustByChain,
          totalValueUsd: totalValueUsd.toFixed(2),
          sweepableChains: Object.keys(dustByChain).filter(k => dustByChain[k].length > 0),
          estimatedGasUsd: Object.keys(dustByChain).filter(k => dustByChain[k].length > 0).length * 0.05,
          endpointCost: endpointPrice,
          expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
        });
      } catch (error) {
        console.error("Error generating sweep quote:", error);
        return c.json({ error: "Failed to generate sweep quote" }, 500);
      }
    }
  );
} else {
  app.post("/api/sweep/quote", async (c) => {
    try {
      const body = await c.req.json();
      const walletAddress = body.wallet as `0x${string}`;
      const chains = (body.chains || ["ethereum", "base", "arbitrum", "polygon", "bsc"]) as string[];

      const dustByChain: Record<string, any[]> = {};
      let totalValueUsd = 0;

      for (const chain of chains) {
        try {
          const balances = await getWalletTokenBalancesAlchemy(
            walletAddress,
            chain as Exclude<SupportedChain, "solana">
          );
          const dustTokens = await filterDustTokens(balances);
          dustByChain[chain] = dustTokens;
          totalValueUsd += dustTokens.reduce((sum: number, d: any) => sum + d.usdValue, 0);
        } catch {
          dustByChain[chain] = [];
        }
      }

      return c.json({
        wallet: walletAddress,
        dust: dustByChain,
        totalValueUsd: totalValueUsd.toFixed(2),
        sweepableChains: Object.keys(dustByChain).filter(k => dustByChain[k].length > 0),
        estimatedGasUsd: Object.keys(dustByChain).filter(k => dustByChain[k].length > 0).length * 0.05,
        expiresAt: Date.now() + 5 * 60 * 1000,
      });
    } catch (error) {
      console.error("Error generating sweep quote:", error);
      return c.json({ error: "Failed to generate sweep quote" }, 500);
    }
  });
}

// POST /api/sweep/execute ($0.10)
// Execute a sweep transaction
if (x402Receiver) {
  app.post(
    "/api/sweep/execute",
    sweepPaymentMiddleware(x402Receiver),
    async (c) => {
      try {
        const body = await c.req.json();
        const { wallet, quoteId, signature, gasToken } = body;

        if (!wallet || !quoteId || !signature) {
          return c.json({ error: "Missing required fields: wallet, quoteId, signature" }, 400);
        }

        // Get the quote from cache
        const quote = await cacheGet<any>(`quote:${quoteId}`);
        if (!quote) {
          return c.json({ error: "Quote not found or expired" }, 404);
        }

        if (quote.expiresAt < Date.now()) {
          return c.json({ error: "Quote expired" }, 410);
        }

        // Create sweep and queue execution
        const sweepId = randomUUID();
        const tokens = (quote.tokens || []).filter((t: any) => t.canSweep !== false);

        const job = await addSweepExecuteJob({
          userId: wallet,
          sweepId,
          quoteId,
          walletAddress: wallet,
          signature,
          tokens: tokens.map((t: any) => ({
            address: String(t.address),
            chain: String(t.chain),
            amount: String(t.amount),
          })),
          outputToken: quote.destination?.token,
          outputChain: quote.destination?.chain,
          gasToken,
        });

        await cacheSet(`sweep:status:${sweepId}`, {
          status: "pending",
          jobId: job.id,
          createdAt: Date.now(),
        }, 3600);

        return c.json({
          sweepId,
          status: "pending",
          jobId: job.id,
          message: "Sweep execution started",
          statusUrl: `/api/sweep/${sweepId}/status`,
        });
      } catch (error) {
        console.error("Error executing sweep:", error);
        return c.json({ error: "Failed to execute sweep" }, 500);
      }
    }
  );
} else {
  app.post("/api/sweep/execute", async (c) => {
    try {
      const body = await c.req.json();
      const { wallet, quoteId, signature, gasToken } = body;

      if (!wallet || !quoteId || !signature) {
        return c.json({ error: "Missing required fields: wallet, quoteId, signature" }, 400);
      }

      const quote = await cacheGet<any>(`quote:${quoteId}`);
      if (!quote) {
        return c.json({ error: "Quote not found or expired" }, 404);
      }

      if (quote.expiresAt < Date.now()) {
        return c.json({ error: "Quote expired" }, 410);
      }

      const sweepId = randomUUID();
      const tokens = (quote.tokens || []).filter((t: any) => t.canSweep !== false);

      const job = await addSweepExecuteJob({
        userId: wallet,
        sweepId,
        quoteId,
        walletAddress: wallet,
        signature,
        tokens: tokens.map((t: any) => ({
          address: String(t.address),
          chain: String(t.chain),
          amount: String(t.amount),
        })),
        outputToken: quote.destination?.token,
        outputChain: quote.destination?.chain,
        gasToken,
      });

      await cacheSet(`sweep:status:${sweepId}`, {
        status: "pending",
        jobId: job.id,
        createdAt: Date.now(),
      }, 3600);

      return c.json({
        sweepId,
        status: "pending",
        jobId: job.id,
        message: "Sweep execution started",
        statusUrl: `/api/sweep/${sweepId}/status`,
      });
    } catch (error) {
      console.error("Error executing sweep:", error);
      return c.json({ error: "Failed to execute sweep" }, 500);
    }
  });
}

// POST /api/consolidate/execute ($0.25)
// Execute a multi-chain consolidation
if (x402Receiver) {
  app.post(
    "/api/consolidate/execute",
    consolidateExecuteMiddleware(x402Receiver),
    async (c) => {
      try {
        const body = await c.req.json();
        const { planId, userId, userAddress, signature } = body;

        if (!planId || !userAddress) {
          return c.json({ error: "Missing required fields: planId, userAddress" }, 400);
        }

        const engine = getConsolidationEngine();
        const result = await engine.execute({
          planId,
          userId: userId || userAddress,
          userAddress,
          signature,
        });

        return c.json(JSON.parse(
          JSON.stringify(result, (_, value) =>
            typeof value === "bigint" ? value.toString() : value
          )
        ));
      } catch (error) {
        console.error("Error executing consolidation:", error);
        return c.json({ error: "Failed to execute consolidation" }, 500);
      }
    }
  );
} else {
  app.post("/api/consolidate/execute", async (c) => {
    try {
      const body = await c.req.json();
      const { planId, userId, userAddress, signature } = body;

      if (!planId || !userAddress) {
        return c.json({ error: "Missing required fields: planId, userAddress" }, 400);
      }

      const engine = getConsolidationEngine();
      const result = await engine.execute({
        planId,
        userId: userId || userAddress,
        userAddress,
        signature,
      });

      return c.json(JSON.parse(
        JSON.stringify(result, (_, value) =>
          typeof value === "bigint" ? value.toString() : value
        )
      ));
    } catch (error) {
      console.error("Error executing consolidation:", error);
      return c.json({ error: "Failed to execute consolidation" }, 500);
    }
  });
}

// ============================================================
// DeFi Routes (some endpoints monetized)
// ============================================================

app.route("/api/defi", defiRoutes);

// ============================================================
// Bridge Routes
// ============================================================

app.route("/api/bridge", bridgeRoutes);

// ============================================================
// Consolidation Routes (Multi-Chain Sweep)
// ============================================================

app.route("/api/consolidate", consolidateRoutes);

// ============================================================
// Error Handling
// ============================================================

app.onError((err, c) => {
  console.error("Unhandled error:", err);
  return c.json({ error: "Internal server error" }, 500);
});

app.notFound((c) => {
  return c.json({ error: "Not found" }, 404);
});

export { app };

// Start server if run directly
const port = parseInt(process.env.PORT || "3000");
console.log(`🧹 Sweep API starting on port ${port}...`);
serve({ fetch: app.fetch, port });
