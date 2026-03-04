/**
 * Crypto Vision — Hardcore Mode Service
 *
 * Manages performance-based group enforcement rounds.
 * Members who don't meet win rate thresholds are automatically removed.
 *
 * @copyright 2024-2026 nirholas. All rights reserved.
 */

import { eq, and, sql, gte } from "drizzle-orm";
import { getDb } from "../db/index.js";
import {
  hardcoreSessions,
  groups,
  groupMembers,
  calls,
  users,
  type HardcoreSession,
  type Group,
} from "../db/schema.js";
import { logger } from "@/lib/logger";

const log = logger.child({ module: "crypto-vision:hardcore" });

/**
 * Start a new hardcore round for a group.
 */
export async function startHardcoreRound(group: Group): Promise<HardcoreSession> {
  const db = getDb();

  // Close any existing active session
  await db
    .update(hardcoreSessions)
    .set({ isActive: false })
    .where(
      and(
        eq(hardcoreSessions.groupId, group.id),
        eq(hardcoreSessions.isActive, true),
      ),
    );

  // Get next round number
  const [lastRound] = await db
    .select({ maxRound: sql<number>`coalesce(max(${hardcoreSessions.roundNumber}), 0)` })
    .from(hardcoreSessions)
    .where(eq(hardcoreSessions.groupId, group.id));

  const roundDays = group.hardcoreRoundDays ?? 7;
  const endsAt = new Date(Date.now() + roundDays * 24 * 60 * 60 * 1000);

  const [session] = await db
    .insert(hardcoreSessions)
    .values({
      groupId: group.id,
      roundNumber: (lastRound?.maxRound ?? 0) + 1,
      endsAt,
      isActive: true,
    })
    .returning();

  // Update group's hardcore round start
  await db
    .update(groups)
    .set({ hardcoreRoundStart: new Date(), updatedAt: new Date() })
    .where(eq(groups.id, group.id));

  log.info(
    { groupId: group.id, roundNumber: session.roundNumber, endsAt },
    "Hardcore round started",
  );

  return session;
}

/**
 * Get the active hardcore session for a group.
 */
export async function getActiveSession(
  groupId: string,
): Promise<HardcoreSession | undefined> {
  const db = getDb();
  return db.query.hardcoreSessions.findFirst({
    where: and(
      eq(hardcoreSessions.groupId, groupId),
      eq(hardcoreSessions.isActive, true),
    ),
  });
}

/**
 * Get hardcore stats for the current round — shows which members
 * are at risk of being removed.
 */
export async function getHardcoreStats(
  groupId: string,
): Promise<{
  session: HardcoreSession | null;
  group: Group | null;
  members: Array<{
    userId: string;
    username: string | null;
    callCount: number;
    winCount: number;
    winRate: number;
    isAtRisk: boolean;
    isEligible: boolean;
  }>;
}> {
  const db = getDb();

  const group = await db.query.groups.findFirst({
    where: eq(groups.id, groupId),
  });
  if (!group) return { session: null, group: null, members: [] };

  const session = await getActiveSession(groupId);
  if (!session) return { session: null, group, members: [] };

  const minWinRate = group.hardcoreMinWinRate ?? 55;
  const minCalls = group.hardcoreMinCalls ?? 5;

  // Get all members with their call stats during this round
  const memberStats = await db
    .select({
      userId: groupMembers.userId,
      username: users.username,
      callCount: sql<number>`count(${calls.id})`.as("call_count"),
      winCount: sql<number>`count(*) filter (where ${calls.isWin} = true)`.as("win_count"),
    })
    .from(groupMembers)
    .innerJoin(users, eq(groupMembers.userId, users.id))
    .leftJoin(
      calls,
      and(
        eq(calls.userId, groupMembers.userId),
        eq(calls.groupId, groupId),
        gte(calls.calledAt, session.startedAt),
        eq(calls.isArchived, false),
      ),
    )
    .where(eq(groupMembers.groupId, groupId))
    .groupBy(groupMembers.userId, users.username);

  const members = memberStats.map((m) => {
    const winRate = m.callCount > 0 ? (m.winCount / m.callCount) * 100 : 0;
    const isEligible = m.callCount >= minCalls;
    const isAtRisk = isEligible && winRate < minWinRate;

    return {
      userId: m.userId,
      username: m.username,
      callCount: m.callCount,
      winCount: m.winCount,
      winRate,
      isAtRisk,
      isEligible,
    };
  });

  return { session, group, members };
}

/**
 * End a hardcore round — evaluates all members and returns those
 * who should be removed.
 */
export async function endHardcoreRound(
  groupId: string,
): Promise<{
  removedUsers: Array<{ userId: string; username: string | null; winRate: number }>;
  survivedUsers: number;
}> {
  const db = getDb();

  const { session, group, members } = await getHardcoreStats(groupId);
  if (!session || !group) {
    return { removedUsers: [], survivedUsers: 0 };
  }

  const atRisk = members.filter((m) => m.isAtRisk);
  const survived = members.filter((m) => !m.isAtRisk);

  // Mark session as complete
  await db
    .update(hardcoreSessions)
    .set({
      isActive: false,
      removedUsers: atRisk.map((u) => u.userId),
    })
    .where(eq(hardcoreSessions.id, session.id));

  log.info(
    {
      groupId,
      roundNumber: session.roundNumber,
      removed: atRisk.length,
      survived: survived.length,
    },
    "Hardcore round ended",
  );

  return {
    removedUsers: atRisk.map((u) => ({
      userId: u.userId,
      username: u.username,
      winRate: u.winRate,
    })),
    survivedUsers: survived.length,
  };
}

/**
 * Check if any hardcore sessions have expired and need to be processed.
 */
export async function checkExpiredSessions(): Promise<string[]> {
  const db = getDb();

  const expired = await db.query.hardcoreSessions.findMany({
    where: and(
      eq(hardcoreSessions.isActive, true),
      sql`${hardcoreSessions.endsAt} <= now()`,
    ),
  });

  return expired.map((s) => s.groupId);
}
