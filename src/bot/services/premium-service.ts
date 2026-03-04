/**
 * Crypto Vision — Premium & Advertising Service
 *
 * Manages group premium subscriptions, advertisements, and payment tracking.
 *
 * @copyright 2024-2026 nirholas. All rights reserved.
 */

import { eq, and, sql, lte, gte } from "drizzle-orm";
import { getDb } from "../db/index.js";
import {
  premiumSubscriptions,
  advertisements,
  groups,
  type PremiumSubscription,
  type Advertisement,
} from "../db/schema.js";
import { logger } from "@/lib/logger";

const log = logger.child({ module: "crypto-vision:premium" });

/** Pricing in ETH */
export const PRICING = {
  premium_lifetime: 0.2,
  button_24h: 0.1,
  button_72h: 0.35,
  button_1w: 0.7,
  broadcast: 0.7,
} as const;

/** Ad durations in milliseconds */
const AD_DURATIONS: Record<string, number> = {
  button_24h: 24 * 60 * 60 * 1000,
  button_72h: 72 * 60 * 60 * 1000,
  button_1w: 7 * 24 * 60 * 60 * 1000,
  broadcast: 0, // one-time
};

// ─── Premium Subscriptions ──────────────────────────────────

/**
 * Activate premium for a group (lifetime).
 */
export async function activatePremium(
  groupId: string,
  purchasedByUserId: string,
  amountPaid: number,
  txHash?: string,
): Promise<PremiumSubscription> {
  const db = getDb();

  const [sub] = await db
    .insert(premiumSubscriptions)
    .values({
      groupId,
      purchasedByUserId,
      status: "active",
      amountPaid: amountPaid.toString(),
      txHash: txHash ?? null,
      isLifetime: true,
    })
    .returning();

  // Mark group as premium
  await db
    .update(groups)
    .set({
      isPremium: true,
      maxCallsPerUser: 40,
      updatedAt: new Date(),
    })
    .where(eq(groups.id, groupId));

  log.info({ groupId, purchasedByUserId, amountPaid }, "Premium activated");
  return sub;
}

/**
 * Check premium status for a group.
 */
export async function getPremiumStatus(
  groupId: string,
): Promise<{
  isPremium: boolean;
  isLifetime: boolean;
  expiresAt: Date | null;
  purchasedBy: string | null;
}> {
  const db = getDb();

  const sub = await db.query.premiumSubscriptions.findFirst({
    where: and(
      eq(premiumSubscriptions.groupId, groupId),
      eq(premiumSubscriptions.status, "active"),
    ),
  });

  if (!sub) {
    return { isPremium: false, isLifetime: false, expiresAt: null, purchasedBy: null };
  }

  return {
    isPremium: true,
    isLifetime: sub.isLifetime,
    expiresAt: sub.expiresAt,
    purchasedBy: sub.purchasedByUserId,
  };
}

// ─── Advertisements ─────────────────────────────────────────

/**
 * Create a new advertisement.
 */
export async function createAdvertisement(input: {
  advertiserTelegramId: string;
  adType: "button_24h" | "button_72h" | "button_1w" | "broadcast";
  message?: string;
  buttonText?: string;
  buttonUrl?: string;
  amountPaid: number;
  txHash?: string;
}): Promise<Advertisement> {
  const db = getDb();

  const duration = AD_DURATIONS[input.adType] || 0;
  const startsAt = new Date();
  const expiresAt = duration > 0 ? new Date(Date.now() + duration) : null;

  const [ad] = await db
    .insert(advertisements)
    .values({
      advertiserTelegramId: input.advertiserTelegramId,
      adType: input.adType,
      status: "active",
      message: input.message ?? null,
      buttonText: input.buttonText ?? null,
      buttonUrl: input.buttonUrl ?? null,
      amountPaid: input.amountPaid.toString(),
      txHash: input.txHash ?? null,
      startsAt,
      expiresAt,
    })
    .returning();

  log.info(
    { adId: ad.id, adType: input.adType, expiresAt },
    "Advertisement created",
  );

  return ad;
}

/**
 * Get currently active button ads (non-expired).
 */
export async function getActiveButtonAds(): Promise<Advertisement[]> {
  const db = getDb();
  return db.query.advertisements.findMany({
    where: and(
      eq(advertisements.status, "active"),
      sql`${advertisements.adType} != 'broadcast'`,
      sql`(${advertisements.expiresAt} IS NULL OR ${advertisements.expiresAt} > now())`,
    ),
  });
}

/**
 * Record an ad impression.
 */
export async function recordAdImpression(adId: string): Promise<void> {
  const db = getDb();
  await db
    .update(advertisements)
    .set({
      impressions: sql`${advertisements.impressions} + 1`,
    })
    .where(eq(advertisements.id, adId));
}

/**
 * Record an ad click.
 */
export async function recordAdClick(adId: string): Promise<void> {
  const db = getDb();
  await db
    .update(advertisements)
    .set({
      clicks: sql`${advertisements.clicks} + 1`,
    })
    .where(eq(advertisements.id, adId));
}

/**
 * Expire ads that have passed their expiration time.
 */
export async function expireOldAds(): Promise<number> {
  const db = getDb();
  const result = await db
    .update(advertisements)
    .set({ status: "expired" })
    .where(
      and(
        eq(advertisements.status, "active"),
        sql`${advertisements.expiresAt} IS NOT NULL AND ${advertisements.expiresAt} <= now()`,
      ),
    )
    .returning({ id: advertisements.id });

  if (result.length > 0) {
    log.info({ count: result.length }, "Expired old advertisements");
  }

  return result.length;
}

/**
 * Get ad stats.
 */
export async function getAdStats(adId: string): Promise<{
  impressions: number;
  clicks: number;
  ctr: number;
} | null> {
  const db = getDb();
  const ad = await db.query.advertisements.findFirst({
    where: eq(advertisements.id, adId),
  });

  if (!ad) return null;

  return {
    impressions: ad.impressions,
    clicks: ad.clicks,
    ctr: ad.impressions > 0 ? (ad.clicks / ad.impressions) * 100 : 0,
  };
}
