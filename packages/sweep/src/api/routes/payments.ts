/**
 * Payments API Routes
 *
 * Endpoints for API monetization via x402 protocol.
 */

import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { HTTPException } from "hono/http-exception";
import crypto from "crypto";

import {
  getAllPricing,
  getEndpointPrice,
  getPricingSummary,
  calculateDiscount,
} from "../../services/payments/pricing.js";
import {
  getCredits,
  addCredits,
  getCreditHistory,
  processDepositWebhook,
  getCreditsDepositAddress,
  refundCredits,
} from "../../services/payments/credits.js";
import {
  getReceipt,
  validateReceipt,
} from "../middleware/x402.js";
import { getDb, apiPayments, apiUsage, apiCredits } from "../../db/index.js";
import { eq, desc, and, gte, sql } from "drizzle-orm";

const paymentsRoutes = new Hono();

// ============================================================
// Schemas
// ============================================================

const walletAddressSchema = z.object({
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid wallet address"),
});

const depositBodySchema = z.object({
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid wallet address"),
  amountUsdc: z.string().min(1, "Amount required"),
  txHash: z.string().optional(),
});

const webhookBodySchema = z.object({
  type: z.enum(["deposit", "payment"]),
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid wallet address"),
  txHash: z.string(),
  amount: z.string(),
  signature: z.string().optional(),
});

const historyQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
  type: z.enum(["all", "payments", "credits", "usage"]).default("all"),
});

const refundBodySchema = z.object({
  receiptId: z.string().min(1, "Receipt ID required"),
  reason: z.string().min(1, "Reason required"),
});

// ============================================================
// Routes
// ============================================================

/**
 * GET /payments/pricing
 * Get current API pricing information
 */
paymentsRoutes.get("/pricing", async (c) => {
  const pricing = getAllPricing();
  const summary = getPricingSummary();

  return c.json({
    success: true,
    data: {
      ...pricing,
      summary,
      paymentMethods: {
        x402: {
          description: "Pay per request using x402 protocol",
          network: "Base (Chain ID 8453)",
          asset: "USDC",
          assetAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        },
        credits: {
          description: "Prepaid credits for API access",
          minDeposit: "$1.00",
          maxBalance: "$10,000.00",
          expiry: "90 days after last deposit",
        },
        freeTier: {
          description: "Limited free access",
          requestsPerDay: 10,
        },
      },
    },
  });
});

/**
 * GET /payments/pricing/:endpoint
 * Get price for a specific endpoint
 */
paymentsRoutes.get("/pricing/:method/:path{.+}", async (c) => {
  const method = c.req.param("method").toUpperCase();
  const path = "/" + c.req.param("path");

  const priceCents = getEndpointPrice(method, path);

  return c.json({
    success: true,
    data: {
      endpoint: `${method} ${path}`,
      priceCents,
      priceUsd: (priceCents / 100).toFixed(2),
      free: priceCents === 0,
    },
  });
});

/**
 * GET /payments/balance
 * Get credit balance for a wallet
 */
paymentsRoutes.get(
  "/balance",
  zValidator("query", walletAddressSchema),
  async (c) => {
    const { walletAddress } = c.req.valid("query");

    try {
      const balance = await getCredits(walletAddress);

      // Get monthly spend for discount calculation
      const db = getDb();
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const monthlySpend = await db
        .select({
          total: sql<string>`COALESCE(SUM(CAST(${apiPayments.amountUsdc} AS NUMERIC)), 0)`,
        })
        .from(apiPayments)
        .where(
          and(
            eq(apiPayments.payerAddress, walletAddress.toLowerCase()),
            gte(apiPayments.createdAt, thirtyDaysAgo)
          )
        );

      const monthlySpendCents = parseInt(monthlySpend[0]?.total || "0");
      const discount = calculateDiscount(monthlySpendCents);

      return c.json({
        success: true,
        data: {
          ...balance,
          monthlySpendCents,
          monthlySpendUsd: (monthlySpendCents / 100).toFixed(2),
          discountPercent: Math.round(discount * 100),
        },
      });
    } catch (error) {
      console.error("[Payments] Balance check error:", error);
      throw new HTTPException(500, { message: "Failed to get balance" });
    }
  }
);

/**
 * POST /payments/deposit
 * Initiate a USDC deposit for credits
 */
paymentsRoutes.post(
  "/deposit",
  zValidator("json", depositBodySchema),
  async (c) => {
    const { walletAddress, amountUsdc, txHash } = c.req.valid("json");

    try {
      // Convert USDC to cents (1 USDC = 100 cents, USDC has 6 decimals)
      const usdcMicros = BigInt(amountUsdc);
      const cents = Number(usdcMicros / BigInt(10000));

      if (cents < 100) {
        return c.json(
          {
            success: false,
            error: "Minimum deposit is $1.00",
          },
          400
        );
      }

      // If txHash provided, process immediately
      if (txHash) {
        const result = await addCredits(walletAddress, cents, txHash, "USDC deposit");

        if (!result.success) {
          return c.json(
            {
              success: false,
              error: result.error,
            },
            400
          );
        }

        return c.json({
          success: true,
          data: {
            creditsAdded: cents,
            newBalance: result.newBalance,
            newBalanceUsd: (result.newBalance / 100).toFixed(2),
          },
        });
      }

      // Otherwise, return deposit instructions
      const depositAddress = getCreditsDepositAddress();

      return c.json({
        success: true,
        data: {
          depositAddress,
          network: "Base (Chain ID 8453)",
          asset: "USDC",
          assetAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
          amountUsdc,
          instructions: [
            "Transfer USDC to the deposit address on Base network",
            "Include your wallet address in the transaction data (optional)",
            "Credits will be added automatically after confirmation",
            "Or call POST /payments/webhook with the transaction hash",
          ],
        },
      });
    } catch (error) {
      console.error("[Payments] Deposit error:", error);
      throw new HTTPException(500, { message: "Failed to process deposit" });
    }
  }
);

/**
 * GET /payments/history
 * Get payment and usage history for a wallet
 */
paymentsRoutes.get(
  "/history",
  zValidator("query", z.object({
    walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
    ...historyQuerySchema.shape,
  })),
  async (c) => {
    const { walletAddress, limit, offset, type } = c.req.valid("query");

    // Try to get wallet from header if not in query
    const wallet = walletAddress || c.req.header("x-wallet-address");

    if (!wallet) {
      return c.json(
        {
          success: false,
          error: "Wallet address required (query param or x-wallet-address header)",
        },
        400
      );
    }

    const normalizedWallet = wallet.toLowerCase();

    try {
      const db = getDb();
      const result: {
        payments?: unknown[];
        credits?: unknown[];
        usage?: unknown[];
      } = {};

      // Get payments
      if (type === "all" || type === "payments") {
        const payments = await db
          .select()
          .from(apiPayments)
          .where(eq(apiPayments.payerAddress, normalizedWallet))
          .orderBy(desc(apiPayments.createdAt))
          .limit(limit)
          .offset(offset);

        result.payments = payments.map((p) => ({
          id: p.id,
          receiptId: p.receiptId,
          amount: p.amountUsdc,
          amountUsd: (parseInt(p.amountUsdc) / 1000000).toFixed(2),
          endpoint: p.endpoint,
          method: p.method,
          status: p.status,
          txHash: p.txHash,
          createdAt: p.createdAt,
        }));
      }

      // Get credit transactions
      if (type === "all" || type === "credits") {
        const credits = await getCreditHistory(normalizedWallet, limit, offset);
        result.credits = credits;
      }

      // Get usage
      if (type === "all" || type === "usage") {
        const usage = await db
          .select()
          .from(apiUsage)
          .where(eq(apiUsage.userIdentifier, normalizedWallet))
          .orderBy(desc(apiUsage.createdAt))
          .limit(limit)
          .offset(offset);

        result.usage = usage.map((u) => ({
          id: u.id,
          endpoint: u.endpoint,
          method: u.method,
          priceCents: parseInt(u.priceCents?.toString() || "0"),
          priceUsd: (parseInt(u.priceCents?.toString() || "0") / 100).toFixed(2),
          paymentType: u.paymentType,
          responseStatus: u.responseStatus,
          responseTimeMs: u.responseTimeMs,
          createdAt: u.createdAt,
        }));
      }

      return c.json({
        success: true,
        data: result,
        pagination: {
          limit,
          offset,
        },
      });
    } catch (error) {
      console.error("[Payments] History error:", error);
      throw new HTTPException(500, { message: "Failed to get history" });
    }
  }
);

/**
 * POST /payments/webhook
 * Webhook for credit top-up notifications
 */
paymentsRoutes.post(
  "/webhook",
  zValidator("json", webhookBodySchema),
  async (c) => {
    const { type, walletAddress, txHash, amount, signature } = c.req.valid("json");

    // Verify webhook signature if configured
    const webhookSecret = process.env.PAYMENTS_WEBHOOK_SECRET;
    if (webhookSecret && signature) {
      const expectedSignature = crypto
        .createHmac("sha256", webhookSecret)
        .update(`${type}:${walletAddress}:${txHash}:${amount}`)
        .digest("hex");

      if (signature !== expectedSignature) {
        return c.json(
          {
            success: false,
            error: "Invalid webhook signature",
          },
          401
        );
      }
    }

    try {
      if (type === "deposit") {
        const result = await processDepositWebhook(walletAddress, txHash, amount);

        return c.json({
          success: result.success,
          data: result.success
            ? {
                creditsAdded: result.creditsAdded,
                creditsAddedUsd: ((result.creditsAdded || 0) / 100).toFixed(2),
              }
            : undefined,
          error: result.error,
        });
      }

      return c.json({
        success: false,
        error: `Unknown webhook type: ${type}`,
      }, 400);
    } catch (error) {
      console.error("[Payments] Webhook error:", error);
      throw new HTTPException(500, { message: "Webhook processing failed" });
    }
  }
);

/**
 * GET /payments/receipt/:receiptId
 * Get a payment receipt
 */
paymentsRoutes.get("/receipt/:receiptId", async (c) => {
  const receiptId = c.req.param("receiptId");

  try {
    const receipt = await getReceipt(receiptId);

    if (!receipt) {
      return c.json(
        {
          success: false,
          error: "Receipt not found",
        },
        404
      );
    }

    const isValid = await validateReceipt(receiptId);

    return c.json({
      success: true,
      data: {
        ...receipt,
        valid: isValid,
        amountUsd: (parseInt(receipt.amount) / 1000000).toFixed(2),
      },
    });
  } catch (error) {
    console.error("[Payments] Receipt error:", error);
    throw new HTTPException(500, { message: "Failed to get receipt" });
  }
});

/**
 * POST /payments/refund
 * Request a refund for a failed request
 */
paymentsRoutes.post(
  "/refund",
  zValidator("json", refundBodySchema),
  async (c) => {
    const { receiptId, reason } = c.req.valid("json");

    try {
      // Get the original payment
      const receipt = await getReceipt(receiptId);

      if (!receipt) {
        return c.json(
          {
            success: false,
            error: "Receipt not found",
          },
          404
        );
      }

      // Convert USDC to cents
      const usdcMicros = BigInt(receipt.amount);
      const cents = Number(usdcMicros / BigInt(10000));

      // Issue refund as credits
      const result = await refundCredits(receipt.payer, cents, reason);

      if (!result.success) {
        return c.json(
          {
            success: false,
            error: result.error,
          },
          400
        );
      }

      return c.json({
        success: true,
        data: {
          receiptId,
          refundedCents: cents,
          refundedUsd: (cents / 100).toFixed(2),
          newCreditBalance: result.newBalance,
          message: "Refund issued as API credits",
        },
      });
    } catch (error) {
      console.error("[Payments] Refund error:", error);
      throw new HTTPException(500, { message: "Failed to process refund" });
    }
  }
);

/**
 * GET /payments/stats
 * Get payment statistics (admin)
 */
paymentsRoutes.get("/stats", async (c) => {
  try {
    const db = getDb();
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Get daily stats
    const dailyPayments = await db
      .select({
        count: sql<number>`COUNT(*)`,
        total: sql<string>`COALESCE(SUM(CAST(${apiPayments.amountUsdc} AS NUMERIC)), 0)`,
      })
      .from(apiPayments)
      .where(gte(apiPayments.createdAt, oneDayAgo));

    const dailyUsage = await db
      .select({
        count: sql<number>`COUNT(*)`,
        x402: sql<number>`COUNT(*) FILTER (WHERE ${apiUsage.paymentType} = 'x402')`,
        credits: sql<number>`COUNT(*) FILTER (WHERE ${apiUsage.paymentType} = 'credits')`,
        freeTier: sql<number>`COUNT(*) FILTER (WHERE ${apiUsage.paymentType} = 'free_tier')`,
      })
      .from(apiUsage)
      .where(gte(apiUsage.createdAt, oneDayAgo));

    // Get monthly stats
    const monthlyPayments = await db
      .select({
        count: sql<number>`COUNT(*)`,
        total: sql<string>`COALESCE(SUM(CAST(${apiPayments.amountUsdc} AS NUMERIC)), 0)`,
      })
      .from(apiPayments)
      .where(gte(apiPayments.createdAt, thirtyDaysAgo));

    // Get total credits
    const totalCredits = await db
      .select({
        total: sql<string>`COALESCE(SUM(CAST(${apiCredits.balanceCents} AS NUMERIC)), 0)`,
        accounts: sql<number>`COUNT(*)`,
      })
      .from(apiCredits)
      .where(sql`CAST(${apiCredits.balanceCents} AS NUMERIC) > 0`);

    return c.json({
      success: true,
      data: {
        daily: {
          payments: {
            count: dailyPayments[0]?.count || 0,
            totalUsdc: (parseInt(dailyPayments[0]?.total || "0") / 1000000).toFixed(2),
          },
          usage: dailyUsage[0] || { count: 0, x402: 0, credits: 0, freeTier: 0 },
        },
        monthly: {
          payments: {
            count: monthlyPayments[0]?.count || 0,
            totalUsdc: (parseInt(monthlyPayments[0]?.total || "0") / 1000000).toFixed(2),
          },
        },
        credits: {
          totalOutstandingCents: parseInt(totalCredits[0]?.total || "0"),
          totalOutstandingUsd: (parseInt(totalCredits[0]?.total || "0") / 100).toFixed(2),
          activeAccounts: totalCredits[0]?.accounts || 0,
        },
      },
    });
  } catch (error) {
    console.error("[Payments] Stats error:", error);
    throw new HTTPException(500, { message: "Failed to get stats" });
  }
});

/**
 * GET /payments/deposit-address
 * Get the deposit address for credits
 */
paymentsRoutes.get("/deposit-address", async (c) => {
  try {
    const depositAddress = getCreditsDepositAddress();

    return c.json({
      success: true,
      data: {
        address: depositAddress,
        network: "Base",
        chainId: 8453,
        asset: "USDC",
        assetAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        assetDecimals: 6,
      },
    });
  } catch (error) {
    return c.json(
      {
        success: false,
        error: "Deposit address not configured",
      },
      500
    );
  }
});

export default paymentsRoutes;
