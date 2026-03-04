/**
 * Crypto Vision — Leaderboard Service
 *
 * Computes calls leaderboard and performance leaderboard for groups
 * with configurable timeframes.
 *
 * @copyright 2024-2026 nirholas. All rights reserved.
 */

import { eq, and, sql, desc, gte } from "drizzle-orm";
import { getDb } from "../db/index.js";
import { calls, users, groupMembers } from "../db/schema.js";
import { type TimeframeFilter, getTimeframeBoundary } from "./call-service.js";
import { logger } from "@/lib/logger";

const log = logger.child({ module: "crypto-vision:leaderboard" });

export interface CallsLeaderboardEntry {
  rank: number;
  callId: string;
  userId: string;
  username: string | null;
  firstName: string | null;
  tokenSymbol: string | null;
  tokenAddress: string;
  chain: string;
  callType: string;
  peakMultiplier: number;
  performancePoints: number;
  marketCapAtCall: string | null;
  athAfterCall: string | null;
  calledAt: Date;
}

export interface PerformanceLeaderboardEntry {
  rank: number;
  userId: string;
  username: string | null;
  firstName: string | null;
  totalCalls: number;
  totalWins: number;
  winRate: number;
  avgMultiplier: number;
  totalPoints: number;
  rankTier: string;
}

/**
 * Get calls leaderboard — highest performing calls in a timeframe.
 */
export async function getCallsLeaderboard(
  groupId: string,
  timeframe: TimeframeFilter = "7d",
  limit = 10,
): Promise<CallsLeaderboardEntry[]> {
  const db = getDb();
  const boundary = getTimeframeBoundary(timeframe);

  const conditions = [
    eq(calls.groupId, groupId),
    eq(calls.isArchived, false),
  ];
  if (boundary) {
    conditions.push(gte(calls.calledAt, boundary));
  }

  const results = await db
    .select({
      callId: calls.id,
      userId: calls.userId,
      username: users.username,
      firstName: users.firstName,
      tokenSymbol: calls.tokenSymbol,
      tokenAddress: calls.tokenAddress,
      chain: calls.chain,
      callType: calls.callType,
      peakMultiplier: calls.peakMultiplier,
      performancePoints: calls.performancePoints,
      marketCapAtCall: calls.marketCapAtCall,
      athAfterCall: calls.athAfterCall,
      calledAt: calls.calledAt,
    })
    .from(calls)
    .innerJoin(users, eq(calls.userId, users.id))
    .where(and(...conditions))
    .orderBy(desc(calls.peakMultiplier))
    .limit(limit);

  return results.map((r, i) => ({
    rank: i + 1,
    callId: r.callId,
    userId: r.userId,
    username: r.username,
    firstName: r.firstName,
    tokenSymbol: r.tokenSymbol,
    tokenAddress: r.tokenAddress,
    chain: r.chain,
    callType: r.callType,
    peakMultiplier: r.peakMultiplier ?? 1,
    performancePoints: r.performancePoints,
    marketCapAtCall: r.marketCapAtCall,
    athAfterCall: r.athAfterCall,
    calledAt: r.calledAt,
  }));
}

/**
 * Get performance leaderboard — users ranked by total performance points.
 */
export async function getPerformanceLeaderboard(
  groupId: string,
  timeframe: TimeframeFilter = "7d",
  limit = 10,
): Promise<PerformanceLeaderboardEntry[]> {
  const db = getDb();
  const boundary = getTimeframeBoundary(timeframe);

  const conditions = [
    eq(calls.groupId, groupId),
    eq(calls.isArchived, false),
  ];
  if (boundary) {
    conditions.push(gte(calls.calledAt, boundary));
  }

  const results = await db
    .select({
      userId: calls.userId,
      username: users.username,
      firstName: users.firstName,
      rankTier: users.rankTier,
      totalCalls: sql<number>`count(*)`.as("total_calls"),
      totalWins: sql<number>`count(*) filter (where ${calls.isWin} = true)`.as(
        "total_wins",
      ),
      avgMultiplier: sql<number>`avg(${calls.peakMultiplier})`.as(
        "avg_multiplier",
      ),
      totalPoints: sql<number>`sum(${calls.performancePoints})`.as(
        "total_points",
      ),
    })
    .from(calls)
    .innerJoin(users, eq(calls.userId, users.id))
    .where(and(...conditions))
    .groupBy(calls.userId, users.username, users.firstName, users.rankTier)
    .orderBy(desc(sql`sum(${calls.performancePoints})`))
    .limit(limit);

  return results.map((r, i) => ({
    rank: i + 1,
    userId: r.userId,
    username: r.username,
    firstName: r.firstName,
    totalCalls: r.totalCalls,
    totalWins: r.totalWins,
    winRate: r.totalCalls > 0 ? (r.totalWins / r.totalCalls) * 100 : 0,
    avgMultiplier: r.avgMultiplier ?? 1,
    totalPoints: r.totalPoints ?? 0,
    rankTier: r.rankTier,
  }));
}

/**
 * Get "losers" leaderboard — users with lowest performance points.
 */
export async function getLosersLeaderboard(
  groupId: string,
  timeframe: TimeframeFilter = "7d",
  limit = 10,
): Promise<PerformanceLeaderboardEntry[]> {
  const db = getDb();
  const boundary = getTimeframeBoundary(timeframe);

  const conditions = [
    eq(calls.groupId, groupId),
    eq(calls.isArchived, false),
  ];
  if (boundary) {
    conditions.push(gte(calls.calledAt, boundary));
  }

  const results = await db
    .select({
      userId: calls.userId,
      username: users.username,
      firstName: users.firstName,
      rankTier: users.rankTier,
      totalCalls: sql<number>`count(*)`.as("total_calls"),
      totalWins: sql<number>`count(*) filter (where ${calls.isWin} = true)`.as(
        "total_wins",
      ),
      avgMultiplier: sql<number>`avg(${calls.peakMultiplier})`.as(
        "avg_multiplier",
      ),
      totalPoints: sql<number>`sum(${calls.performancePoints})`.as(
        "total_points",
      ),
    })
    .from(calls)
    .innerJoin(users, eq(calls.userId, users.id))
    .where(and(...conditions))
    .groupBy(calls.userId, users.username, users.firstName, users.rankTier)
    .orderBy(sql`sum(${calls.performancePoints}) asc`)
    .limit(limit);

  return results.map((r, i) => ({
    rank: i + 1,
    userId: r.userId,
    username: r.username,
    firstName: r.firstName,
    totalCalls: r.totalCalls,
    totalWins: r.totalWins,
    winRate: r.totalCalls > 0 ? (r.totalWins / r.totalCalls) * 100 : 0,
    avgMultiplier: r.avgMultiplier ?? 1,
    totalPoints: r.totalPoints ?? 0,
    rankTier: r.rankTier,
  }));
}

/**
 * Get win rate for a specific user in a specific group.
 */
export async function getUserWinRateInGroup(
  userId: string,
  groupId: string,
): Promise<{ totalCalls: number; wins: number; winRate: number }> {
  const db = getDb();

  const [result] = await db
    .select({
      total: sql<number>`count(*)`,
      wins: sql<number>`count(*) filter (where ${calls.isWin} = true)`,
    })
    .from(calls)
    .where(
      and(
        eq(calls.userId, userId),
        eq(calls.groupId, groupId),
        eq(calls.isArchived, false),
      ),
    );

  const total = result?.total ?? 0;
  const wins = result?.wins ?? 0;
  return {
    totalCalls: total,
    wins,
    winRate: total > 0 ? (wins / total) * 100 : 0,
  };
}

/**
 * Get group-wide aggregate stats.
 */
export async function getGroupStats(
  groupId: string,
  timeframe: TimeframeFilter = "all",
): Promise<{
  totalCalls: number;
  totalWins: number;
  winRate: number;
  avgMultiplier: number;
  totalPoints: number;
  uniqueCallers: number;
}> {
  const db = getDb();
  const boundary = getTimeframeBoundary(timeframe);

  const conditions = [
    eq(calls.groupId, groupId),
    eq(calls.isArchived, false),
  ];
  if (boundary) conditions.push(gte(calls.calledAt, boundary));

  const [result] = await db
    .select({
      totalCalls: sql<number>`count(*)`,
      totalWins: sql<number>`count(*) filter (where ${calls.isWin} = true)`,
      avgMultiplier: sql<number>`coalesce(avg(${calls.peakMultiplier}), 1)`,
      totalPoints: sql<number>`coalesce(sum(${calls.performancePoints}), 0)`,
      uniqueCallers: sql<number>`count(distinct ${calls.userId})`,
    })
    .from(calls)
    .where(and(...conditions));

  const total = result?.totalCalls ?? 0;
  const wins = result?.totalWins ?? 0;
  return {
    totalCalls: total,
    totalWins: wins,
    winRate: total > 0 ? (wins / total) * 100 : 0,
    avgMultiplier: result?.avgMultiplier ?? 1,
    totalPoints: result?.totalPoints ?? 0,
    uniqueCallers: result?.uniqueCallers ?? 0,
  };
}

/**
 * Get trending tokens — tokens with most calls/votes in period.
 */
export async function getTrendingTokens(
  timeframe: TimeframeFilter = "24h",
  limit = 10,
): Promise<
  Array<{
    tokenAddress: string;
    tokenSymbol: string | null;
    tokenName: string | null;
    chain: string;
    callCount: number;
    avgMultiplier: number;
    bestMultiplier: number;
  }>
> {
  const db = getDb();
  const boundary = getTimeframeBoundary(timeframe);

  const conditions = [eq(calls.isArchived, false)];
  if (boundary) conditions.push(gte(calls.calledAt, boundary));

  return db
    .select({
      tokenAddress: calls.tokenAddress,
      tokenSymbol: sql<string | null>`max(${calls.tokenSymbol})`.as("token_symbol"),
      tokenName: sql<string | null>`max(${calls.tokenName})`.as("token_name"),
      chain: sql<string>`max(${calls.chain})`.as("chain"),
      callCount: sql<number>`count(*)`.as("call_count"),
      avgMultiplier: sql<number>`avg(${calls.peakMultiplier})`.as("avg_multiplier"),
      bestMultiplier: sql<number>`max(${calls.peakMultiplier})`.as("best_multiplier"),
    })
    .from(calls)
    .where(and(...conditions))
    .groupBy(calls.tokenAddress)
    .orderBy(desc(sql`count(*)`))
    .limit(limit);
}
