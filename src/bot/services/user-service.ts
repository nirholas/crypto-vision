/**
 * Crypto Vision — User Service
 *
 * Manages user registration, lookup, rank calculation, and profile updates.
 *
 * @copyright 2024-2026 nirholas. All rights reserved.
 */

import { eq, sql } from "drizzle-orm";
import { getDb } from "../db/index.js";
import { users, groupMembers, calls, type User, type NewUser } from "../db/schema.js";
import { logger } from "@/lib/logger";

const log = logger.child({ module: "crypto-vision:user-service" });

/**
 * Find or create a user by Telegram ID. Upserts username/name on each interaction.
 */
export async function findOrCreateUser(
  telegramId: string,
  username?: string,
  firstName?: string,
  lastName?: string,
): Promise<User> {
  const db = getDb();

  const existing = await db.query.users.findFirst({
    where: eq(users.telegramId, telegramId),
  });

  if (existing) {
    // Update username/name if changed
    if (
      username !== existing.username ||
      firstName !== existing.firstName ||
      lastName !== existing.lastName
    ) {
      const [updated] = await db
        .update(users)
        .set({
          username: username ?? existing.username,
          firstName: firstName ?? existing.firstName,
          lastName: lastName ?? existing.lastName,
          updatedAt: new Date(),
        })
        .where(eq(users.telegramId, telegramId))
        .returning();
      return updated;
    }
    return existing;
  }

  const [created] = await db
    .insert(users)
    .values({
      telegramId,
      username,
      firstName,
      lastName,
    })
    .returning();

  log.info({ telegramId, username }, "New user registered");
  return created;
}

/**
 * Get a user by internal UUID.
 */
export async function getUserById(id: string): Promise<User | undefined> {
  const db = getDb();
  return db.query.users.findFirst({ where: eq(users.id, id) });
}

/**
 * Get a user by Telegram ID.
 */
export async function getUserByTelegramId(telegramId: string): Promise<User | undefined> {
  const db = getDb();
  return db.query.users.findFirst({ where: eq(users.telegramId, telegramId) });
}

/**
 * Get a user by @username.
 */
export async function getUserByUsername(username: string): Promise<User | undefined> {
  const db = getDb();
  const cleanUsername = username.replace(/^@/, "").toLowerCase();
  return db.query.users.findFirst({
    where: sql`lower(${users.username}) = ${cleanUsername}`,
  });
}

/**
 * Determine rank tier based on win rate percentage.
 */
export function calculateRankTier(
  winRate: number,
): "oracle" | "guru" | "contender" | "novice" | "amateur" {
  if (winRate > 70) return "oracle";
  if (winRate > 60) return "guru";
  if (winRate > 50) return "contender";
  if (winRate > 40) return "novice";
  return "amateur";
}

/**
 * Calculate win rate for a user (across all groups).
 */
export async function calculateWinRate(userId: string): Promise<number> {
  const db = getDb();
  const result = await db
    .select({
      total: sql<number>`count(*)`,
      wins: sql<number>`count(*) filter (where ${calls.isWin} = true)`,
    })
    .from(calls)
    .where(eq(calls.userId, userId));

  if (!result[0] || result[0].total === 0) return 0;
  return (result[0].wins / result[0].total) * 100;
}

/**
 * Calculate average gain (average peak multiplier) for a user.
 */
export async function calculateAvgGain(userId: string): Promise<number> {
  const db = getDb();
  const result = await db
    .select({
      avg: sql<number>`coalesce(avg(${calls.peakMultiplier}), 1)`,
    })
    .from(calls)
    .where(eq(calls.userId, userId));

  return result[0]?.avg ?? 1;
}

/**
 * Get a user's top N best calls (by peak multiplier).
 */
export async function getTopCalls(userId: string, limit = 3): Promise<Array<{
  tokenSymbol: string | null;
  tokenAddress: string;
  peakMultiplier: number | null;
  calledAt: Date;
  chain: string;
}>> {
  const db = getDb();
  return db
    .select({
      tokenSymbol: calls.tokenSymbol,
      tokenAddress: calls.tokenAddress,
      peakMultiplier: calls.peakMultiplier,
      calledAt: calls.calledAt,
      chain: calls.chain,
    })
    .from(calls)
    .where(eq(calls.userId, userId))
    .orderBy(sql`${calls.peakMultiplier} desc nulls last`)
    .limit(limit);
}

/**
 * Recalculate and update a user's rank tier and stats.
 */
export async function refreshUserStats(userId: string): Promise<User> {
  const db = getDb();

  const [stats] = await db
    .select({
      total: sql<number>`count(*)`,
      wins: sql<number>`count(*) filter (where ${calls.isWin} = true)`,
      points: sql<number>`coalesce(sum(${calls.performancePoints}), 0)`,
    })
    .from(calls)
    .where(eq(calls.userId, userId));

  const total = stats?.total ?? 0;
  const wins = stats?.wins ?? 0;
  const points = stats?.points ?? 0;
  const winRate = total > 0 ? (wins / total) * 100 : 0;
  const tier = calculateRankTier(winRate);

  const [updated] = await db
    .update(users)
    .set({
      totalCalls: total,
      totalWins: wins,
      performancePoints: points,
      rankTier: tier,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId))
    .returning();

  return updated;
}

/**
 * Update user profile (bio, photos, wallets).
 */
export async function updateUserProfile(
  userId: string,
  updates: {
    bio?: string;
    profilePhoto?: string;
    coverPhoto?: string;
    walletAddresses?: string[];
  },
): Promise<User> {
  const db = getDb();
  const [updated] = await db
    .update(users)
    .set({
      ...updates,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId))
    .returning();
  return updated;
}

/**
 * Block/unblock a user.
 */
export async function setUserBlocked(userId: string, blocked: boolean): Promise<void> {
  const db = getDb();
  await db
    .update(users)
    .set({ isBlocked: blocked, updatedAt: new Date() })
    .where(eq(users.id, userId));
}

/**
 * Block/unblock a user within a specific group.
 */
export async function setUserBlockedInGroup(
  groupId: string,
  userId: string,
  blocked: boolean,
): Promise<void> {
  const db = getDb();
  await db
    .update(groupMembers)
    .set({ isBlockedInGroup: blocked })
    .where(
      sql`${groupMembers.groupId} = ${groupId} AND ${groupMembers.userId} = ${userId}`,
    );
}

/**
 * Get user's call count in a group within the last 24 hours (for rate limiting).
 */
export async function getUserCallCount24h(userId: string, groupId: string): Promise<number> {
  const db = getDb();
  const [result] = await db
    .select({ count: sql<number>`count(*)` })
    .from(calls)
    .where(
      sql`${calls.userId} = ${userId} 
          AND ${calls.groupId} = ${groupId}
          AND ${calls.calledAt} > now() - interval '24 hours'
          AND ${calls.isArchived} = false`,
    );
  return result?.count ?? 0;
}
