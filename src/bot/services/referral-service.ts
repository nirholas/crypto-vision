/**
 * Crypto Vision — Referral Service
 *
 * Manages referral link generation, approval, tracking, and payouts.
 * Referrers earn 20% commission on all purchases made via their link.
 *
 * @copyright 2024-2026 nirholas. All rights reserved.
 */

import { eq, sql } from "drizzle-orm";
import { getDb } from "../db/index.js";
import {
  referrals,
  referralPurchases,
  type Referral,
} from "../db/schema.js";
import { randomBytes } from "node:crypto";
import { logger } from "@/lib/logger";

const log = logger.child({ module: "crypto-vision:referral" });

const COMMISSION_RATE = 0.2; // 20%

/**
 * Request a new referral link. Starts in "pending" status until approved.
 */
export async function requestReferral(
  userId: string,
  walletAddress: string,
): Promise<Referral> {
  const db = getDb();

  // Check if user already has a referral
  const existing = await db.query.referrals.findFirst({
    where: eq(referrals.userId, userId),
  });

  if (existing) {
    return existing;
  }

  const referralCode = randomBytes(8).toString("hex");

  const [created] = await db
    .insert(referrals)
    .values({
      userId,
      referralCode,
      walletAddress,
      status: "pending",
    })
    .returning();

  log.info({ userId, referralCode }, "Referral requested");
  return created;
}

/**
 * Approve a referral request.
 */
export async function approveReferral(referralId: string): Promise<Referral> {
  const db = getDb();
  const [updated] = await db
    .update(referrals)
    .set({ status: "approved" })
    .where(eq(referrals.id, referralId))
    .returning();
  log.info({ referralId }, "Referral approved");
  return updated;
}

/**
 * Reject a referral request.
 */
export async function rejectReferral(referralId: string): Promise<Referral> {
  const db = getDb();
  const [updated] = await db
    .update(referrals)
    .set({ status: "rejected" })
    .where(eq(referrals.id, referralId))
    .returning();
  return updated;
}

/**
 * Get a referral by code.
 */
export async function getReferralByCode(code: string): Promise<Referral | undefined> {
  const db = getDb();
  return db.query.referrals.findFirst({
    where: eq(referrals.referralCode, code),
  });
}

/**
 * Get a referral by user ID.
 */
export async function getReferralByUserId(userId: string): Promise<Referral | undefined> {
  const db = getDb();
  return db.query.referrals.findFirst({
    where: eq(referrals.userId, userId),
  });
}

/**
 * Record a purchase made via referral and calculate commission.
 */
export async function recordReferralPurchase(
  referralCode: string,
  buyerTelegramId: string,
  purchaseAmount: number,
  txHash?: string,
): Promise<{ commission: number } | null> {
  const db = getDb();

  const referral = await getReferralByCode(referralCode);
  if (!referral || referral.status !== "approved") return null;

  const commission = purchaseAmount * COMMISSION_RATE;

  await db.insert(referralPurchases).values({
    referralId: referral.id,
    buyerTelegramId,
    purchaseAmount: purchaseAmount.toString(),
    commissionAmount: commission.toString(),
    txHash: txHash ?? null,
  });

  // Update referral totals
  await db
    .update(referrals)
    .set({
      totalEarnings: sql`${referrals.totalEarnings}::numeric + ${commission}`,
      totalReferrals: sql`${referrals.totalReferrals} + 1`,
    })
    .where(eq(referrals.id, referral.id));

  log.info(
    { referralCode, buyerTelegramId, purchaseAmount, commission },
    "Referral purchase recorded",
  );

  return { commission };
}

/**
 * Get referral stats for a user.
 */
export async function getReferralStats(userId: string): Promise<{
  referralCode: string | null;
  status: string;
  totalReferrals: number;
  totalEarnings: number;
  walletAddress: string;
} | null> {
  const referral = await getReferralByUserId(userId);
  if (!referral) return null;

  return {
    referralCode: referral.referralCode,
    status: referral.status,
    totalReferrals: referral.totalReferrals,
    totalEarnings: parseFloat(referral.totalEarnings),
    walletAddress: referral.walletAddress,
  };
}
