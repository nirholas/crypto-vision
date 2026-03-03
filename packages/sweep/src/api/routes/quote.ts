import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import { optionalAuthMiddleware } from "../middleware/auth.js";
import { walletRateLimit } from "../middleware/ratelimit.js";
import { getDb, sweepQuotes } from "../../db/index.js";
import { cacheSet, cacheGet } from "../../utils/redis.js";
import { filterDustTokens } from "../../services/validation.service.js";
import { getValidatedPrice } from "../../services/price.service.js";
import { getWalletTokenBalancesAlchemy } from "../../services/wallet.service.js";
import type { SupportedChain } from "../../config/chains.js";
import { randomUUID } from "crypto";

const quote = new Hono();

// Apply rate limiting
quote.use("*", walletRateLimit(50, 60)); // 50 quotes per minute

// Request validation schemas
const quoteRequestSchema = z.object({
  wallet: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid wallet address"),
  chains: z.array(z.string()).min(1, "At least one chain required"),
  tokens: z
    .array(
      z.object({
        address: z.string(),
        chain: z.string(),
        amount: z.string().optional(),
      })
    )
    .optional(),
  destination: z.object({
    chain: z.string(),
    token: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid token address"),
    protocol: z.string().optional(), // e.g., "aave", "yearn"
    vault: z.string().optional(),
  }),
  slippageBps: z.number().min(1).max(1000).default(100), // 1% default
  gasToken: z.string().optional(), // Token to pay gas with
});

// Quote response type
interface QuoteResponse {
  quoteId: string;
  wallet: string;
  tokens: {
    address: string;
    chain: string;
    symbol: string;
    amount: string;
    usdValue: number;
    canSweep: boolean;
    reason?: string;
  }[];
  destination: {
    chain: string;
    token: string;
    symbol: string;
    protocol?: string;
    vault?: string;
  };
  summary: {
    totalInputValueUsd: number;
    estimatedOutputAmount: string;
    estimatedOutputValueUsd: number;
    estimatedGasUsd: number;
    netValueUsd: number;
    savingsVsManual: number;
  };
  route: {
    aggregator: string;
    steps: {
      type: "swap" | "bridge" | "deposit";
      chain: string;
      protocol: string;
      tokenIn: string;
      tokenOut: string;
      amountIn: string;
      amountOut: string;
    }[];
  };
  expiresAt: number;
  createdAt: number;
}

/**
 * POST /api/quote
 * Get a quote for sweeping dust tokens
 */
quote.post(
  "/",
  zValidator("json", quoteRequestSchema),
  optionalAuthMiddleware,
  async (c) => {
    const body = c.req.valid("json");
    const userId = c.get("userId");

    try {
      const quoteId = randomUUID();
      const now = Date.now();
      const expiresAt = now + 5 * 60 * 1000; // 5 minutes

      // Get tokens to sweep
      const tokensToSweep: {
        address: string;
        chain: string;
        symbol: string;
        amount: string;
        usdValue: number;
        canSweep: boolean;
        reason?: string;
      }[] = [];

      if (body.tokens && body.tokens.length > 0) {
        // Use provided tokens
        for (const token of body.tokens) {
          const validation = await getValidatedPrice(token.address, token.chain);
          tokensToSweep.push({
            address: token.address,
            chain: token.chain,
            symbol: "UNKNOWN", // Would be fetched from token metadata
            amount: token.amount || "0",
            usdValue: validation.price,
            canSweep: validation.confidence !== "UNTRUSTED",
            reason:
              validation.confidence === "UNTRUSTED"
                ? "Unable to validate token price"
                : undefined,
          });
        }
      } else {
        // Scan wallet for dust tokens
        const balancesByChain: Record<string, any[]> = {};

        for (const chain of body.chains) {
          try {
            const balances = await getWalletTokenBalancesAlchemy(
              body.wallet as `0x${string}`,
              chain as Exclude<SupportedChain, "solana">
            );
            balancesByChain[chain] = balances;
          } catch (error) {
            console.error(`Error scanning ${chain}:`, error);
            balancesByChain[chain] = [];
          }
        }

        // Filter dust tokens
        for (const [chain, balances] of Object.entries(balancesByChain)) {
          const dustTokens = await filterDustTokens(balances);
          for (const dust of dustTokens) {
            tokensToSweep.push({
              address: dust.token.address,
              chain,
              symbol: dust.token.symbol,
              amount: dust.token.balance,
              usdValue: dust.usdValue,
              canSweep: dust.validation.canSweep,
              reason: dust.validation.reasons[0],
            });
          }
        }
      }

      // Filter to only sweepable tokens
      const sweepableTokens = tokensToSweep.filter((t) => t.canSweep);
      const totalInputValueUsd = sweepableTokens.reduce(
        (sum, t) => sum + t.usdValue,
        0
      );

      // Calculate estimated output and gas
      // In production, this would call DEX aggregators for real quotes
      const estimatedGasPerChain = 0.05; // $0.05 per chain average
      const uniqueChains = [...new Set(sweepableTokens.map((t) => t.chain))];
      const estimatedGasUsd = uniqueChains.length * estimatedGasPerChain;

      // Assume 0.5% total slippage/fees
      const estimatedOutputValueUsd = totalInputValueUsd * 0.995 - estimatedGasUsd;
      const estimatedOutputAmount = (
        estimatedOutputValueUsd * 1e6
      ).toFixed(0); // USDC with 6 decimals

      // Build route steps
      const routeSteps: QuoteResponse["route"]["steps"] = [];

      // Group tokens by chain
      const tokensByChain = sweepableTokens.reduce(
        (acc, token) => {
          if (!acc[token.chain]) acc[token.chain] = [];
          acc[token.chain].push(token);
          return acc;
        },
        {} as Record<string, typeof sweepableTokens>
      );

      // Add swap steps for each chain
      for (const [chain, tokens] of Object.entries(tokensByChain)) {
        for (const token of tokens) {
          routeSteps.push({
            type: "swap",
            chain,
            protocol: "1inch", // Would be determined by aggregator selection
            tokenIn: token.address,
            tokenOut:
              chain === body.destination.chain
                ? body.destination.token
                : "USDC", // Intermediate stable
            amountIn: token.amount,
            amountOut: ((token.usdValue * 0.995) * 1e6).toFixed(0),
          });
        }

        // Add bridge step if needed
        if (chain !== body.destination.chain) {
          routeSteps.push({
            type: "bridge",
            chain,
            protocol: "across",
            tokenIn: "USDC",
            tokenOut: "USDC",
            amountIn: tokens
              .reduce((sum, t) => sum + t.usdValue * 0.995 * 1e6, 0)
              .toFixed(0),
            amountOut: tokens
              .reduce((sum, t) => sum + t.usdValue * 0.99 * 1e6, 0)
              .toFixed(0),
          });
        }
      }

      // Add DeFi deposit step if protocol specified
      if (body.destination.protocol) {
        routeSteps.push({
          type: "deposit",
          chain: body.destination.chain,
          protocol: body.destination.protocol,
          tokenIn: body.destination.token,
          tokenOut: body.destination.vault || body.destination.token,
          amountIn: estimatedOutputAmount,
          amountOut: estimatedOutputAmount,
        });
      }

      const quoteResponse: QuoteResponse = {
        quoteId,
        wallet: body.wallet,
        tokens: tokensToSweep,
        destination: {
          chain: body.destination.chain,
          token: body.destination.token,
          symbol: "USDC", // Would be fetched from token metadata
          protocol: body.destination.protocol,
          vault: body.destination.vault,
        },
        summary: {
          totalInputValueUsd: parseFloat(totalInputValueUsd.toFixed(2)),
          estimatedOutputAmount,
          estimatedOutputValueUsd: parseFloat(estimatedOutputValueUsd.toFixed(2)),
          estimatedGasUsd: parseFloat(estimatedGasUsd.toFixed(2)),
          netValueUsd: parseFloat(estimatedOutputValueUsd.toFixed(2)),
          savingsVsManual: parseFloat(
            (uniqueChains.length * 0.5 - estimatedGasUsd).toFixed(2)
          ), // vs manual swaps
        },
        route: {
          aggregator: "sweep",
          steps: routeSteps,
        },
        expiresAt,
        createdAt: now,
      };

      // Cache the quote for later execution
      await cacheSet(`quote:${quoteId}`, quoteResponse, 300); // 5 minute cache

      // Store in database if authenticated
      if (userId) {
        const db = getDb();
        await db.insert(sweepQuotes).values({
          id: quoteId,
          userId,
          walletAddress: body.wallet,
          chains: body.chains,
          tokens: sweepableTokens.map((t) => ({
            address: t.address,
            chain: t.chain,
            symbol: t.symbol,
            amount: t.amount,
            usdValue: t.usdValue,
          })),
          destination: body.destination,
          outputToken: body.destination.token,
          outputAmount: estimatedOutputAmount,
          estimatedGasUsd: estimatedGasUsd.toString(),
          netValueUsd: estimatedOutputValueUsd.toString(),
          aggregator: "sweep",
          routeData: quoteResponse.route,
          expiresAt: new Date(expiresAt),
        });
      }

      return c.json(quoteResponse);
    } catch (error) {
      console.error("Error generating quote:", error);
      return c.json({ error: "Failed to generate sweep quote" }, 500);
    }
  }
);

/**
 * GET /api/quote/:quoteId
 * Get an existing quote by ID
 */
quote.get(
  "/:quoteId",
  zValidator("param", z.object({ quoteId: z.string().uuid() })),
  async (c) => {
    const { quoteId } = c.req.valid("param");

    try {
      // Try cache first
      const cached = await cacheGet<QuoteResponse>(`quote:${quoteId}`);
      if (cached) {
        // Check if expired
        if (cached.expiresAt < Date.now()) {
          return c.json({ error: "Quote expired" }, 410);
        }
        return c.json(cached);
      }

      // Try database
      const db = getDb();
      const dbQuote = await db.query.sweepQuotes.findFirst({
        where: eq(sweepQuotes.id, quoteId),
      });

      if (!dbQuote) {
        return c.json({ error: "Quote not found" }, 404);
      }

      if (dbQuote.expiresAt < new Date()) {
        return c.json({ error: "Quote expired" }, 410);
      }

      // Reconstruct quote response
      const quoteResponse: QuoteResponse = {
        quoteId: dbQuote.id,
        wallet: dbQuote.walletAddress,
        tokens: (dbQuote.tokens as any[]).map((t) => ({
          ...t,
          canSweep: true,
        })),
        destination: dbQuote.destination as any,
        summary: {
          totalInputValueUsd: (dbQuote.tokens as any[]).reduce(
            (sum, t) => sum + t.usdValue,
            0
          ),
          estimatedOutputAmount: dbQuote.outputAmount?.toString() || "0",
          estimatedOutputValueUsd: parseFloat(dbQuote.netValueUsd?.toString() || "0"),
          estimatedGasUsd: parseFloat(dbQuote.estimatedGasUsd?.toString() || "0"),
          netValueUsd: parseFloat(dbQuote.netValueUsd?.toString() || "0"),
          savingsVsManual: 0,
        },
        route: dbQuote.routeData as any,
        expiresAt: dbQuote.expiresAt.getTime(),
        createdAt: dbQuote.createdAt?.getTime() || Date.now(),
      };

      return c.json(quoteResponse);
    } catch (error) {
      console.error("Error fetching quote:", error);
      return c.json({ error: "Failed to fetch quote" }, 500);
    }
  }
);

export { quote };
