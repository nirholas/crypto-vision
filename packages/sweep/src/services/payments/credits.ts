/**
 * Prepaid Credits Service
 *
 * Manages prepaid API credits for users.
 * Users can deposit USDC to get API credits that are deducted per request.
 */

import { eq, sql, and, desc } from "drizzle-orm";
import { getDb, apiCredits, apiCreditTransactions } from "../../db/index.js";
import { getRedis } from "../../utils/redis.js";
import { checkUsdcTransfer, getUsdcBalance } from "./index.js";
import type { Address } from "viem";

// Credit constants
const CREDIT_CACHE_PREFIX = "credits:";
const CREDIT_CACHE_TTL = 60; // 1 minute cache

// Minimum deposit (in cents) - $1.00
const MIN_DEPOSIT_CENTS = 100;

// Maximum credit balance (in cents) - $10,000
const MAX_CREDIT_BALANCE_CENTS = 1000000;

// Credit expiry (90 days in milliseconds)
const CREDIT_EXPIRY_MS = 90 * 24 * 60 * 60 * 1000;

// Transaction types
export type CreditTransactionType =
  | "deposit"
  | "deduction"
  | "refund"
  | "expiry"
  | "adjustment";

// Credit transaction
export interface CreditTransaction {
  id: string;
  walletAddress: string;
  type: CreditTransactionType;
  amountCents: number;
  balanceAfter: number;
  endpoint?: string;
  txHash?: string;
  description?: string;
  createdAt: Date;
}

// Credit balance response
export interface CreditBalance {
  walletAddress: string;
  balanceCents: number;
  balanceUsd: string;
  expiresAt: Date | null;
  lastUpdated: Date;
}

/**
 * Get credit balance for a wallet
 */
export async function getCredits(walletAddress: string): Promise<CreditBalance> {
  const normalizedAddress = walletAddress.toLowerCase();

  // Check cache first
  const redis = getRedis();
  const cacheKey = `${CREDIT_CACHE_PREFIX}${normalizedAddress}`;
  const cached = await redis.get(cacheKey);

  if (cached) {
    return JSON.parse(cached) as CreditBalance;
  }

  // Query database
  const db = getDb();
  const result = await db
    .select()
    .from(apiCredits)
    .where(eq(apiCredits.walletAddress, normalizedAddress))
    .limit(1);

  let balance: CreditBalance;

  if (result.length === 0) {
    // No credits found, return zero balance
    balance = {
      walletAddress: normalizedAddress,
      balanceCents: 0,
      balanceUsd: "0.00",
      expiresAt: null,
      lastUpdated: new Date(),
    };
  } else {
    const record = result[0];
    balance = {
      walletAddress: normalizedAddress,
      balanceCents: parseInt(record.balanceCents || "0"),
      balanceUsd: (parseInt(record.balanceCents || "0") / 100).toFixed(2),
      expiresAt: record.expiresAt,
      lastUpdated: record.updatedAt || new Date(),
    };
  }

  // Cache the result
  await redis.setex(cacheKey, CREDIT_CACHE_TTL, JSON.stringify(balance));

  return balance;
}

/**
 * Check if wallet has sufficient credits
 */
export async function checkCredits(walletAddress: string): Promise<number> {
  const balance = await getCredits(walletAddress);
  return balance.balanceCents;
}

/**
 * Deduct credits from wallet
 */
export async function deductCredits(
  walletAddress: string,
  amountCents: number,
  endpoint?: string
): Promise<{ success: boolean; newBalance: number; error?: string }> {
  const normalizedAddress = walletAddress.toLowerCase();

  try {
    const db = getDb();

    // Get current balance with lock
    const result = await db
      .select()
      .from(apiCredits)
      .where(eq(apiCredits.walletAddress, normalizedAddress))
      .limit(1);

    if (result.length === 0) {
      return { success: false, newBalance: 0, error: "No credit balance found" };
    }

    const currentBalance = parseInt(result[0].balanceCents || "0");

    if (currentBalance < amountCents) {
      return {
        success: false,
        newBalance: currentBalance,
        error: "Insufficient credits",
      };
    }

    const newBalance = currentBalance - amountCents;

    // Update balance
    await db
      .update(apiCredits)
      .set({
        balanceCents: newBalance.toString(),
        updatedAt: new Date(),
      } as any)
      .where(eq(apiCredits.walletAddress, normalizedAddress));

    // Record transaction
    await db.insert(apiCreditTransactions).values({
      walletAddress: normalizedAddress,
      type: "deduction",
      amountCents: (-amountCents).toString(),
      balanceAfter: newBalance.toString(),
      endpoint,
      description: `API request: ${endpoint}`,
    } as any);

    // Invalidate cache
    const redis = getRedis();
    await redis.del(`${CREDIT_CACHE_PREFIX}${normalizedAddress}`);

    return { success: true, newBalance };
  } catch (error) {
    console.error("[Credits] Deduction error:", error);
    return {
      success: false,
      newBalance: 0,
      error: error instanceof Error ? error.message : "Deduction failed",
    };
  }
}

/**
 * Add credits to wallet (from USDC deposit)
 */
export async function addCredits(
  walletAddress: string,
  amountCents: number,
  txHash?: string,
  description?: string
): Promise<{ success: boolean; newBalance: number; error?: string }> {
  const normalizedAddress = walletAddress.toLowerCase();

  try {
    if (amountCents < MIN_DEPOSIT_CENTS) {
      return {
        success: false,
        newBalance: 0,
        error: `Minimum deposit is $${(MIN_DEPOSIT_CENTS / 100).toFixed(2)}`,
      };
    }

    const db = getDb();

    // Get or create credit record
    const existing = await db
      .select()
      .from(apiCredits)
      .where(eq(apiCredits.walletAddress, normalizedAddress))
      .limit(1);

    let newBalance: number;
    const expiresAt = new Date(Date.now() + CREDIT_EXPIRY_MS);

    if (existing.length === 0) {
      // Create new credit record
      newBalance = amountCents;

      if (newBalance > MAX_CREDIT_BALANCE_CENTS) {
        return {
          success: false,
          newBalance: 0,
          error: `Maximum credit balance is $${(MAX_CREDIT_BALANCE_CENTS / 100).toFixed(2)}`,
        };
      }

      await db.insert(apiCredits).values({
        walletAddress: normalizedAddress,
        balanceCents: newBalance.toString(),
        expiresAt,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);
    } else {
      // Update existing record
      const currentBalance = parseInt(existing[0].balanceCents || "0");
      newBalance = currentBalance + amountCents;

      if (newBalance > MAX_CREDIT_BALANCE_CENTS) {
        return {
          success: false,
          newBalance: currentBalance,
          error: `Maximum credit balance is $${(MAX_CREDIT_BALANCE_CENTS / 100).toFixed(2)}`,
        };
      }

      await db
        .update(apiCredits)
        .set({
          balanceCents: newBalance.toString(),
          expiresAt,
          updatedAt: new Date(),
        } as any)
        .where(eq(apiCredits.walletAddress, normalizedAddress));
    }

    // Record transaction
    await db.insert(apiCreditTransactions).values({
      walletAddress: normalizedAddress,
      type: "deposit",
      amountCents: amountCents.toString(),
      balanceAfter: newBalance.toString(),
      txHash,
      description: description || "USDC deposit",
    } as any);

    // Invalidate cache
    const redis = getRedis();
    await redis.del(`${CREDIT_CACHE_PREFIX}${normalizedAddress}`);

    return { success: true, newBalance };
  } catch (error) {
    console.error("[Credits] Add credits error:", error);
    return {
      success: false,
      newBalance: 0,
      error: error instanceof Error ? error.message : "Failed to add credits",
    };
  }
}

/**
 * Refund credits to wallet
 */
export async function refundCredits(
  walletAddress: string,
  amountCents: number,
  reason?: string
): Promise<{ success: boolean; newBalance: number; error?: string }> {
  return addCredits(walletAddress, amountCents, undefined, `Refund: ${reason || "API request failed"}`);
}

/**
 * Get credit transaction history
 */
export async function getCreditHistory(
  walletAddress: string,
  limit = 50,
  offset = 0
): Promise<CreditTransaction[]> {
  const normalizedAddress = walletAddress.toLowerCase();

  try {
    const db = getDb();
    const results = await db
      .select()
      .from(apiCreditTransactions)
      .where(eq(apiCreditTransactions.walletAddress, normalizedAddress))
      .orderBy(desc(apiCreditTransactions.createdAt))
      .limit(limit)
      .offset(offset);

    return results.map((r) => ({
      id: r.id,
      walletAddress: r.walletAddress,
      type: r.type as CreditTransactionType,
      amountCents: parseInt(r.amountCents || "0"),
      balanceAfter: parseInt(r.balanceAfter || "0"),
      endpoint: r.endpoint || undefined,
      txHash: r.txHash || undefined,
      description: r.description || undefined,
      createdAt: r.createdAt || new Date(),
    }));
  } catch (error) {
    console.error("[Credits] History fetch error:", error);
    return [];
  }
}

/**
 * Verify USDC deposit and add credits
 *
 * Called by webhook when USDC is deposited to the credits deposit address
 */
export async function processDepositWebhook(
  walletAddress: string,
  txHash: string,
  amount: string
): Promise<{ success: boolean; creditsAdded?: number; error?: string }> {
  const normalizedAddress = walletAddress.toLowerCase();
  const redis = getRedis();

  try {
    // Check if this transaction was already processed
    const processedKey = `credits:tx:${txHash}`;
    const alreadyProcessed = await redis.get(processedKey);

    if (alreadyProcessed) {
      return { success: false, error: "Transaction already processed" };
    }

    // Convert USDC amount (6 decimals) to cents
    // 1 USDC = 100 cents, USDC has 6 decimals
    const usdcMicros = BigInt(amount);
    const cents = Number(usdcMicros / BigInt(10000)); // USDC micros to cents

    if (cents < MIN_DEPOSIT_CENTS) {
      return {
        success: false,
        error: `Deposit too small: $${(cents / 100).toFixed(2)}`,
      };
    }

    // Add credits
    const result = await addCredits(
      normalizedAddress,
      cents,
      txHash,
      `USDC deposit via webhook`
    );

    if (result.success) {
      // Mark transaction as processed (never expires)
      await redis.set(processedKey, "1");
    }

    return {
      success: result.success,
      creditsAdded: result.success ? cents : undefined,
      error: result.error,
    };
  } catch (error) {
    console.error("[Credits] Webhook processing error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Webhook processing failed",
    };
  }
}

/**
 * Get the deposit address for credits
 */
export function getCreditsDepositAddress(): string {
  const address = process.env.X402_RECEIVER_ADDRESS;
  if (!address) {
    throw new Error("X402_RECEIVER_ADDRESS not configured");
  }
  return address;
}

/**
 * Expire old credits (should be run periodically)
 */
export async function expireOldCredits(): Promise<{ expired: number }> {
  try {
    const db = getDb();
    const now = new Date();

    // Find expired credits
    const expired = await db
      .select()
      .from(apiCredits)
      .where(
        and(
          sql`${apiCredits.expiresAt} < ${now}`,
          sql`${apiCredits.balanceCents}::integer > 0`
        )
      );

    let expiredCount = 0;

    for (const record of expired) {
      const balance = parseInt(record.balanceCents || "0");

      // Record expiry transaction
      await db.insert(apiCreditTransactions).values({
        walletAddress: record.walletAddress,
        type: "expiry",
        amountCents: (-balance).toString(),
        balanceAfter: "0",
        description: "Credits expired after 90 days",
      } as any);

      // Zero out balance
      await db
        .update(apiCredits)
        .set({
          balanceCents: "0",
          updatedAt: new Date(),
        } as any)
        .where(eq(apiCredits.walletAddress, record.walletAddress));

      // Invalidate cache
      const redis = getRedis();
      await redis.del(`${CREDIT_CACHE_PREFIX}${record.walletAddress}`);

      expiredCount++;
    }

    return { expired: expiredCount };
  } catch (error) {
    console.error("[Credits] Expiry error:", error);
    return { expired: 0 };
  }
}
