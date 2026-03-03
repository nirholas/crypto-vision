/**
 * Solana Sweep Routes
 * Handle Solana-specific sweep requests including:
 * - SPL token dust swaps
 * - Vacant account cleanup
 * - Staking to Jito/Marinade
 */

import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { authMiddleware } from "../middleware/auth.js";
import { strictRateLimit } from "../middleware/ratelimit.js";
import { randomUUID } from "crypto";
import { cacheGet, cacheSet } from "../../utils/redis.js";
import { extendedSolanaScanner } from "../../services/wallet/chains/solana.js";
import { jupiterAggregator } from "../../services/dex/aggregators/jupiter.js";
import { accountCleanupService } from "../../services/solana/account-cleanup.js";
import { priorityFeesService } from "../../services/solana/priority-fees.js";
import { jitoProvider } from "../../services/defi/jito.js";
import { marinadeProvider } from "../../services/defi/marinade.js";

const solanaSweep = new Hono();

// Apply rate limiting
solanaSweep.use("*", strictRateLimit);

// ============================================================
// Validation Schemas
// ============================================================

const solanaAddressSchema = z.string().regex(
  /^[1-9A-HJ-NP-Za-km-z]{32,44}$/,
  "Invalid Solana address"
);

const solanaScanRequestSchema = z.object({
  wallet: solanaAddressSchema,
  includeVacantAccounts: z.boolean().optional().default(true),
});

const solanaQuoteRequestSchema = z.object({
  wallet: solanaAddressSchema,
  tokens: z.array(z.object({
    mint: solanaAddressSchema,
    amount: z.string(),
  })).optional(),
  includeVacantAccounts: z.boolean().optional().default(true),
  outputToken: z.enum(["SOL", "jitoSOL", "mSOL", "USDC"]).optional().default("SOL"),
  priorityLevel: z.enum(["low", "medium", "high", "turbo"]).optional().default("medium"),
});

const solanaSweepRequestSchema = z.object({
  wallet: solanaAddressSchema,
  quoteId: z.string().uuid(),
  signedTransactions: z.array(z.string()).optional(),
});

const solanaCleanupRequestSchema = z.object({
  wallet: solanaAddressSchema,
  accounts: z.array(solanaAddressSchema).optional(),
  priorityLevel: z.enum(["low", "medium", "high", "turbo"]).optional().default("medium"),
  useLegacy: z.boolean().optional().default(false),
});

// ============================================================
// Routes
// ============================================================

/**
 * POST /api/sweep/solana/scan
 * Scan a Solana wallet for dust tokens and vacant accounts
 */
solanaSweep.post(
  "/scan",
  authMiddleware,
  zValidator("json", solanaScanRequestSchema),
  async (c) => {
    const { wallet, includeVacantAccounts } = c.req.valid("json");

    try {
      // Use extended scanner for full data including vacant accounts
      const scanResult = await extendedSolanaScanner.scanExtended(wallet);
      const solPrice = await extendedSolanaScanner.getSolPrice();

      // Get tradeable status for dust tokens
      const dustTokens = scanResult.tokens.filter(t => t.isDust);
      const tradeablePromises = dustTokens.map(async (token) => {
        const tradeable = await jupiterAggregator.isTokenTradeable(token.address);
        return { ...token, tradeable };
      });
      const dustTokensWithTradeable = await Promise.all(tradeablePromises);

      // Calculate summary
      const totalDustValue = dustTokensWithTradeable.reduce((sum, t) => sum + t.valueUsd, 0);
      const tradeableDustValue = dustTokensWithTradeable
        .filter(t => t.tradeable)
        .reduce((sum, t) => sum + t.valueUsd, 0);

      const recoverableRentSol = Number(scanResult.totalRecoverableRent) / 1e9;
      const recoverableRentUsd = recoverableRentSol * solPrice;

      return c.json({
        wallet,
        chain: "solana",
        nativeBalance: scanResult.nativeBalance,
        nativeValueUsd: scanResult.nativeValueUsd,
        totalValueUsd: scanResult.totalValueUsd,
        dustTokens: dustTokensWithTradeable,
        dustTokenCount: dustTokensWithTradeable.length,
        tradeableDustTokenCount: dustTokensWithTradeable.filter(t => t.tradeable).length,
        totalDustValueUsd: totalDustValue,
        tradeableDustValueUsd: tradeableDustValue,
        vacantAccounts: includeVacantAccounts ? scanResult.vacantAccounts : [],
        vacantAccountCount: scanResult.vacantAccounts.length,
        recoverableRent: {
          lamports: scanResult.totalRecoverableRent.toString(),
          sol: recoverableRentSol,
          usd: recoverableRentUsd,
        },
        totalRecoverableValueUsd: tradeableDustValue + recoverableRentUsd,
        scannedAt: scanResult.scannedAt,
      });
    } catch (error) {
      console.error("Solana scan error:", error);
      return c.json({ error: "Failed to scan Solana wallet" }, 500);
    }
  }
);

/**
 * POST /api/sweep/solana/quote
 * Get a quote for sweeping Solana dust tokens
 */
solanaSweep.post(
  "/quote",
  authMiddleware,
  zValidator("json", solanaQuoteRequestSchema),
  async (c) => {
    const { wallet, tokens, includeVacantAccounts, outputToken, priorityLevel } = c.req.valid("json");

    try {
      // Scan wallet if tokens not provided
      let dustTokens: Array<{ mint: string; amount: string }>;
      let vacantAccountData;

      if (tokens && tokens.length > 0) {
        dustTokens = tokens as Array<{ mint: string; amount: string }>;
      } else {
        const scanResult = await extendedSolanaScanner.scanExtended(wallet);
        dustTokens = scanResult.tokens
          .filter(t => t.isDust)
          .map(t => ({ mint: t.address, amount: t.balance }));
        vacantAccountData = {
          accounts: scanResult.vacantAccounts,
          totalRent: scanResult.totalRecoverableRent,
        };
      }

      // Get SOL price
      const solPrice = await extendedSolanaScanner.getSolPrice();

      // Determine output mint
      const outputMintMap: Record<string, string> = {
        SOL: "So11111111111111111111111111111111111111112",
        jitoSOL: "J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn",
        mSOL: "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So",
        USDC: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      };
      const outputMint = outputMintMap[outputToken];

      // Get quotes for all tokens
      const quotes = await jupiterAggregator.getBatchQuotes(
        dustTokens,
        wallet,
        "So11111111111111111111111111111111111111112" // First swap to SOL
      );

      // Calculate totals
      const successfulQuotes = quotes.filter(q => q.quote !== null);
      const failedQuotes = quotes.filter(q => q.quote === null);

      const totalInputValueUsd = successfulQuotes.reduce(
        (sum, q) => sum + (q.quote?.metadata?.inputValueUsd || 0),
        0
      );

      const estimatedOutputSol = successfulQuotes.reduce((sum, q) => {
        if (!q.quote) return sum;
        return sum + Number(q.quote.outputAmount) / 1e9;
      }, 0);

      // Get priority fee estimate
      const priorityFees = await priorityFeesService.getPriorityFees();
      const priorityFee = priorityFees.levels[priorityLevel];

      // Calculate cleanup quote if applicable
      let cleanupQuote;
      if (includeVacantAccounts && vacantAccountData && vacantAccountData.accounts.length > 0) {
        cleanupQuote = await accountCleanupService.getCleanupQuote(
          vacantAccountData.accounts,
          solPrice
        );
      }

      // Calculate staking if output is jitoSOL or mSOL
      let stakingInfo;
      if (outputToken === "jitoSOL") {
        const jitoStats = await jitoProvider.getStats();
        stakingInfo = {
          protocol: "Jito",
          expectedApy: jitoStats.apy,
          token: "jitoSOL",
        };
      } else if (outputToken === "mSOL") {
        const marinadeStats = await marinadeProvider.getStats();
        stakingInfo = {
          protocol: "Marinade",
          expectedApy: marinadeStats.apy,
          token: "mSOL",
        };
      }

      // Calculate total recoverable
      const vacantAccountRentSol = vacantAccountData ? Number(vacantAccountData.totalRent) / 1e9 : 0;
      const totalEstimatedOutputSol = estimatedOutputSol + vacantAccountRentSol;
      const totalEstimatedOutputUsd = totalEstimatedOutputSol * solPrice;

      // Estimate gas costs
      const estimatedSwapTxs = Math.ceil(successfulQuotes.length / 2); // ~2 swaps per tx
      const estimatedCleanupTxs = cleanupQuote?.estimatedTransactions || 0;
      const totalTxs = estimatedSwapTxs + estimatedCleanupTxs + (stakingInfo ? 1 : 0);
      const estimatedGasSol = totalTxs * 0.0001; // ~0.0001 SOL per tx base
      const estimatedGasUsd = estimatedGasSol * solPrice;

      // Net value after gas
      const netValueSol = totalEstimatedOutputSol - estimatedGasSol;
      const netValueUsd = netValueSol * solPrice;

      // Generate quote ID
      const quoteId = randomUUID();
      const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes

      const quoteData = {
        quoteId,
        wallet,
        chain: "solana",
        inputTokens: successfulQuotes.map(q => ({
          mint: q.mint,
          quote: q.quote,
        })),
        failedTokens: failedQuotes.map(q => ({
          mint: q.mint,
          error: q.error,
        })),
        vacantAccounts: vacantAccountData?.accounts || [],
        outputToken,
        outputMint,
        summary: {
          totalInputTokens: dustTokens.length,
          successfulQuotes: successfulQuotes.length,
          failedQuotes: failedQuotes.length,
          totalInputValueUsd,
          estimatedOutputSol: totalEstimatedOutputSol,
          estimatedOutputUsd: totalEstimatedOutputUsd,
          estimatedGasSol,
          estimatedGasUsd,
          netValueSol,
          netValueUsd,
          vacantAccountsToClose: cleanupQuote?.totalAccounts || 0,
          rentToRecover: {
            sol: vacantAccountRentSol,
            usd: vacantAccountRentSol * solPrice,
          },
        },
        stakingInfo,
        priorityLevel,
        priorityFee,
        expiresAt,
        createdAt: Date.now(),
      };

      // Cache the quote
      await cacheSet(`quote:solana:${quoteId}`, quoteData, 300);

      return c.json(quoteData);
    } catch (error) {
      console.error("Solana quote error:", error);
      return c.json({ error: "Failed to get Solana sweep quote" }, 500);
    }
  }
);

/**
 * POST /api/sweep/solana/transactions
 * Get unsigned transactions for a Solana sweep
 */
solanaSweep.post(
  "/transactions",
  authMiddleware,
  zValidator("json", z.object({
    quoteId: z.string().uuid(),
    wallet: solanaAddressSchema,
  })),
  async (c) => {
    const { quoteId, wallet } = c.req.valid("json");

    try {
      // Get cached quote
      const quote = await cacheGet<any>(`quote:solana:${quoteId}`);

      if (!quote) {
        return c.json({ error: "Quote not found" }, 404);
      }

      if (quote.expiresAt < Date.now()) {
        return c.json({ error: "Quote expired" }, 410);
      }

      if (quote.wallet !== wallet) {
        return c.json({ error: "Quote is for a different wallet" }, 400);
      }

      const transactions: Array<{
        type: "swap" | "cleanup" | "stake";
        serializedTransaction: string;
        description: string;
      }> = [];

      // 1. Get swap transactions
      for (const tokenQuote of quote.inputTokens) {
        if (tokenQuote.quote?.calldata) {
          transactions.push({
            type: "swap",
            serializedTransaction: tokenQuote.quote.calldata,
            description: `Swap ${tokenQuote.quote.inputToken?.symbol || "token"} to SOL`,
          });
        }
      }

      // 2. Get cleanup transactions
      if (quote.vacantAccounts && quote.vacantAccounts.length > 0) {
        const cleanupTxs = await accountCleanupService.getSerializedTransaction(
          quote.vacantAccounts,
          wallet,
          quote.priorityFee?.microLamports || 10000,
          false // Use versioned transactions
        );

        for (const batch of cleanupTxs.batches) {
          transactions.push({
            type: "cleanup",
            serializedTransaction: batch.serializedTransaction,
            description: `Close ${batch.accountsToClose.length} vacant accounts`,
          });
        }
      }

      // 3. Get staking transaction (if applicable)
      if (quote.stakingInfo && quote.outputToken !== "SOL") {
        // Build staking transaction
        // Note: This would need the actual output amount from swaps
        // For now, return placeholder info
        transactions.push({
          type: "stake",
          serializedTransaction: "", // Would be built after swaps complete
          description: `Stake SOL to ${quote.stakingInfo.protocol}`,
        });
      }

      return c.json({
        quoteId,
        wallet,
        transactions,
        totalTransactions: transactions.length,
        expiresAt: quote.expiresAt,
      });
    } catch (error) {
      console.error("Error getting Solana transactions:", error);
      return c.json({ error: "Failed to get transactions" }, 500);
    }
  }
);

/**
 * POST /api/sweep/solana/cleanup
 * Get transactions to close vacant token accounts
 */
solanaSweep.post(
  "/cleanup",
  authMiddleware,
  zValidator("json", solanaCleanupRequestSchema),
  async (c) => {
    const { wallet, accounts, priorityLevel, useLegacy } = c.req.valid("json");

    try {
      let vacantAccounts;

      if (accounts && accounts.length > 0) {
        // Use provided accounts
        vacantAccounts = accounts.map(addr => ({
          address: addr,
          mint: "",
          owner: wallet,
          rentLamports: 2039280n, // Default rent
          isToken2022: false,
          programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
        }));
      } else {
        // Scan for vacant accounts
        const scanResult = await extendedSolanaScanner.scanExtended(wallet);
        vacantAccounts = scanResult.vacantAccounts;
      }

      if (vacantAccounts.length === 0) {
        return c.json({
          wallet,
          message: "No vacant accounts to close",
          totalAccounts: 0,
          transactions: [],
        });
      }

      // Get priority fee
      const priorityFees = await priorityFeesService.getPriorityFees();
      const priorityFee = priorityFees.levels[priorityLevel];

      // Build transactions
      const txResult = await accountCleanupService.getSerializedTransaction(
        vacantAccounts,
        wallet,
        priorityFee.microLamports,
        useLegacy
      );

      // Get SOL price for quote
      const solPrice = await extendedSolanaScanner.getSolPrice();
      const totalRentSol = Number(BigInt(txResult.totalRent)) / 1e9;

      return c.json({
        wallet,
        totalAccounts: vacantAccounts.length,
        totalRent: {
          lamports: txResult.totalRent,
          sol: totalRentSol,
          usd: totalRentSol * solPrice,
        },
        transactions: txResult.batches.map((batch, i) => ({
          index: i,
          serializedTransaction: batch.serializedTransaction,
          accountsToClose: batch.accountsToClose,
          estimatedRent: batch.estimatedRent,
        })),
        totalTransactions: txResult.totalTransactions,
        priorityLevel,
        priorityFee,
      });
    } catch (error) {
      console.error("Error building cleanup transactions:", error);
      return c.json({ error: "Failed to build cleanup transactions" }, 500);
    }
  }
);

/**
 * GET /api/sweep/solana/priority-fees
 * Get current Solana priority fee estimates
 */
solanaSweep.get("/priority-fees", async (c) => {
  try {
    const fees = await priorityFeesService.getPriorityFees();
    return c.json(fees);
  } catch (error) {
    console.error("Error fetching priority fees:", error);
    return c.json({ error: "Failed to fetch priority fees" }, 500);
  }
});

/**
 * GET /api/sweep/solana/staking-options
 * Get available staking options for swept SOL
 */
solanaSweep.get("/staking-options", async (c) => {
  try {
    const [jitoStats, marinadeStats] = await Promise.all([
      jitoProvider.getStats(),
      marinadeProvider.getStats(),
    ]);

    return c.json({
      options: [
        {
          protocol: "Jito",
          token: "jitoSOL",
          mint: "J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn",
          apy: jitoStats.apy,
          apyMev: jitoStats.apyMev,
          exchangeRate: jitoStats.exchangeRate,
          features: ["MEV rewards", "Instant liquid", "No lockup"],
        },
        {
          protocol: "Marinade",
          token: "mSOL",
          mint: "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So",
          apy: marinadeStats.apy,
          instantUnstakeFee: marinadeStats.instantUnstakeFee,
          features: ["Decentralized validators", "Instant or delayed unstake", "MNDE rewards"],
        },
      ],
    });
  } catch (error) {
    console.error("Error fetching staking options:", error);
    return c.json({ error: "Failed to fetch staking options" }, 500);
  }
});

export { solanaSweep };
