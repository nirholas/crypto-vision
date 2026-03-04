/**
 * Crypto Vision — Group Service
 *
 * Manages group registration, settings, membership, and wipes.
 *
 * @copyright 2024-2026 nirholas. All rights reserved.
 */

import { eq, and, sql } from "drizzle-orm";
import { getDb } from "../db/index.js";
import {
  groups,
  groupMembers,
  calls,
  type Group,
  type NewGroup,
  type GroupMember,
} from "../db/schema.js";
import { logger } from "@/lib/logger";

const log = logger.child({ module: "crypto-vision:group-service" });

/**
 * Find or create a group by Telegram chat ID.
 */
export async function findOrCreateGroup(
  telegramId: string,
  title?: string,
  ownerId?: string,
): Promise<Group> {
  const db = getDb();

  const existing = await db.query.groups.findFirst({
    where: eq(groups.telegramId, telegramId),
  });

  if (existing) {
    // Update title if changed
    if (title && title !== existing.title) {
      const [updated] = await db
        .update(groups)
        .set({ title, updatedAt: new Date() })
        .where(eq(groups.telegramId, telegramId))
        .returning();
      return updated;
    }
    return existing;
  }

  const [created] = await db
    .insert(groups)
    .values({
      telegramId,
      title,
      ownerId,
    })
    .returning();

  log.info({ telegramId, title }, "New group registered");
  return created;
}

/**
 * Get a group by internal UUID.
 */
export async function getGroupById(id: string): Promise<Group | undefined> {
  const db = getDb();
  return db.query.groups.findFirst({ where: eq(groups.id, id) });
}

/**
 * Get a group by Telegram chat ID.
 */
export async function getGroupByTelegramId(telegramId: string): Promise<Group | undefined> {
  const db = getDb();
  return db.query.groups.findFirst({ where: eq(groups.telegramId, telegramId) });
}

/**
 * Update group settings.
 */
export async function updateGroupSettings(
  groupId: string,
  settings: Partial<{
    callMode: "auto" | "button";
    displayMode: "simple" | "advanced";
    language: string;
    hardcoreEnabled: boolean;
    hardcoreMinWinRate: number;
    hardcoreMinCalls: number;
    hardcoreRoundDays: number;
    minMarketCap: string;
    minLiquidity: string;
    maxCallsPerUser: number;
    adMessage: string;
    adLink: string;
  }>,
): Promise<Group> {
  const db = getDb();
  const [updated] = await db
    .update(groups)
    .set({ ...settings, updatedAt: new Date() } as Partial<Group>)
    .where(eq(groups.id, groupId))
    .returning();
  return updated;
}

/**
 * Add or update a member in a group.
 */
export async function upsertGroupMember(
  groupId: string,
  userId: string,
  isAdmin = false,
  isOwner = false,
): Promise<void> {
  const db = getDb();

  await db
    .insert(groupMembers)
    .values({ groupId, userId, isAdmin, isOwner })
    .onConflictDoUpdate({
      target: [groupMembers.groupId, groupMembers.userId],
      set: { isAdmin, isOwner },
    });
}

/**
 * Get a group member record.
 */
export async function getGroupMember(
  groupId: string,
  userId: string,
): Promise<GroupMember | undefined> {
  const db = getDb();
  return db.query.groupMembers.findFirst({
    where: and(
      eq(groupMembers.groupId, groupId),
      eq(groupMembers.userId, userId),
    ),
  });
}

/**
 * Get all members of a group.
 */
export async function getGroupMembers(groupId: string): Promise<GroupMember[]> {
  const db = getDb();
  return db.query.groupMembers.findMany({
    where: eq(groupMembers.groupId, groupId),
  });
}

/**
 * Remove a member from a group.
 */
export async function removeGroupMember(groupId: string, userId: string): Promise<void> {
  const db = getDb();
  await db
    .delete(groupMembers)
    .where(
      and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)),
    );
}

/**
 * Update member call stats after a new call is processed.
 */
export async function updateMemberCallStats(
  groupId: string,
  userId: string,
  isWin: boolean,
  points: number,
): Promise<void> {
  const db = getDb();
  await db
    .update(groupMembers)
    .set({
      callCount: sql`${groupMembers.callCount} + 1`,
      winCount: isWin
        ? sql`${groupMembers.winCount} + 1`
        : groupMembers.winCount,
      performancePoints: sql`${groupMembers.performancePoints} + ${points}`,
    })
    .where(
      and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)),
    );
}

/**
 * Wipe leaderboard — archives all non-archived calls and resets member stats.
 */
export async function wipeLeaderboard(groupId: string): Promise<number> {
  const db = getDb();

  // Archive all non-archived calls in this group
  const result = await db
    .update(calls)
    .set({ isArchived: true, updatedAt: new Date() })
    .where(and(eq(calls.groupId, groupId), eq(calls.isArchived, false)))
    .returning({ id: calls.id });

  // Reset member stats
  await db
    .update(groupMembers)
    .set({ callCount: 0, winCount: 0, performancePoints: 0 })
    .where(eq(groupMembers.groupId, groupId));

  const archivedCount = result.length;
  log.info({ groupId, archivedCount }, "Leaderboard wiped");
  return archivedCount;
}

/**
 * Reset all group settings to defaults.
 */
export async function resetGroupSettings(groupId: string): Promise<Group> {
  const db = getDb();
  const [updated] = await db
    .update(groups)
    .set({
      callMode: "button",
      displayMode: "simple",
      hardcoreEnabled: false,
      hardcoreMinWinRate: 55,
      hardcoreMinCalls: 5,
      hardcoreRoundDays: 7,
      hardcoreRoundStart: null,
      minMarketCap: null,
      minLiquidity: null,
      maxCallsPerUser: 20,
      adMessage: null,
      adLink: null,
      updatedAt: new Date(),
    })
    .where(eq(groups.id, groupId))
    .returning();
  return updated;
}

/**
 * Check if a group has premium status.
 */
export function isGroupPremium(group: Group): boolean {
  if (!group.isPremium) return false;
  if (group.premiumExpiresAt && group.premiumExpiresAt < new Date()) return false;
  return true;
}

/**
 * Get max calls per user per 24h for a group (premium = 40, free = 20).
 */
export function getMaxCallsForGroup(group: Group): number {
  return isGroupPremium(group) ? 40 : group.maxCallsPerUser;
}
