/**
 * Crypto Vision — Call Service
 *
 * Core business logic for creating, tracking, and updating token calls.
 * Integrates with token data service for real-time market data.
 *
 * @copyright 2024-2026 nirholas. All rights reserved.
 */

import { eq, and, sql, desc, gte, lte } from "drizzle-orm";
import { getDb } from "../db/index.js";
import { calls, type Call, type NewCall } from "../db/schema.js";
import {
  getTokenData,
  calculateMultiplier,
  calculatePerformancePoints,
  isWinningCall,
} from "./token-data.js";
import { refreshUserStats } from "./user-service.js";
import { updateMemberCallStats } from "./group-service.js";
import { logger } from "@/lib/logger";

const log = logger.child({ module: "crypto-vision:call-service" });

export interface CreateCallInput {
  userId: string;
  groupId: string;
  tokenAddress: string;
  chain: string;
  callType: "alpha" | "gamble";
  mode: "auto" | "button";
  messageId?: number;
}

/**
 * Create a new call — fetches current token data and records the snapshot.
 */
export async function createCall(input: CreateCallInput): Promise<Call> {
  const db = getDb();

  // Fetch real-time token data
  const tokenData = await getTokenData(input.tokenAddress, input.chain);

  const newCall: NewCall = {
    userId: input.userId,
    groupId: input.groupId,
    tokenAddress: input.tokenAddress,
    tokenSymbol: tokenData?.symbol ?? null,
    tokenName: tokenData?.name ?? null,
    chain: input.chain as Call["chain"],
    callType: input.callType,
    mode: input.mode,
    marketCapAtCall: tokenData?.marketCap?.toString() ?? null,
    priceAtCall: tokenData?.price?.toString() ?? null,
    liquidityAtCall: tokenData?.liquidity?.toString() ?? null,
    volumeAtCall: tokenData?.volume24h?.toString() ?? null,
    holdersAtCall: tokenData?.holders ?? null,
    tokenAge: tokenData?.tokenAge ?? null,
    messageId: input.messageId ?? null,
    currentMultiplier: 1,
    peakMultiplier: 1,
    performancePoints: 0,
    isWin: false,
  };

  const [created] = await db.insert(calls).values(newCall).returning();

  log.info(
    {
      callId: created.id,
      userId: input.userId,
      groupId: input.groupId,
      token: tokenData?.symbol ?? input.tokenAddress,
      marketCap: tokenData?.marketCap,
      callType: input.callType,
    },
    "New call created",
  );

  return created;
}

/**
 * Update a call's performance metrics (called by the price tracker worker).
 */
export async function updateCallPerformance(
  callId: string,
  currentPrice: number,
): Promise<Call | null> {
  const db = getDb();

  const call = await db.query.calls.findFirst({
    where: eq(calls.id, callId),
  });

  if (!call || !call.priceAtCall) return null;

  const callPrice = parseFloat(call.priceAtCall);
  if (callPrice <= 0) return null;

  const multiplier = calculateMultiplier(callPrice, currentPrice);
  const newPeak = Math.max(call.peakMultiplier ?? 1, multiplier);
  const points = calculatePerformancePoints(newPeak);
  const win = isWinningCall(newPeak);

  const updates: Partial<Call> = {
    currentMultiplier: multiplier,
    updatedAt: new Date(),
  };

  // Only update peak/points/win if they improved
  if (newPeak > (call.peakMultiplier ?? 1)) {
    updates.peakMultiplier = newPeak;
    updates.performancePoints = points;
    updates.isWin = win;
    updates.athAfterCall = currentPrice.toString();
    updates.athTimestamp = new Date();
  }

  const [updated] = await db
    .update(calls)
    .set(updates)
    .where(eq(calls.id, callId))
    .returning();

  // If points or win status changed, update user and member stats
  if (newPeak > (call.peakMultiplier ?? 1)) {
    const oldPoints = call.performancePoints;
    const pointsDelta = points - oldPoints;

    if (pointsDelta !== 0 || win !== call.isWin) {
      await updateMemberCallStats(
        call.groupId,
        call.userId,
        win && !call.isWin, // only count as new win if it just became a win
        pointsDelta,
      );
      await refreshUserStats(call.userId);
    }
  }

  return updated;
}

/**
 * Get recent calls for a group (non-archived).
 */
export async function getRecentCalls(
  groupId: string,
  limit = 10,
): Promise<Call[]> {
  const db = getDb();
  return db.query.calls.findMany({
    where: and(eq(calls.groupId, groupId), eq(calls.isArchived, false)),
    orderBy: [desc(calls.calledAt)],
    limit,
  });
}

/**
 * Get calls for a specific user in a group.
 */
export async function getUserCalls(
  userId: string,
  groupId: string,
  limit = 20,
): Promise<Call[]> {
  const db = getDb();
  return db.query.calls.findMany({
    where: and(
      eq(calls.userId, userId),
      eq(calls.groupId, groupId),
      eq(calls.isArchived, false),
    ),
    orderBy: [desc(calls.calledAt)],
    limit,
  });
}

/**
 * Get alpha calls for a group.
 */
export async function getAlphaCalls(
  groupId: string,
  limit = 5,
): Promise<Call[]> {
  const db = getDb();
  return db.query.calls.findMany({
    where: and(
      eq(calls.groupId, groupId),
      eq(calls.callType, "alpha"),
      eq(calls.isArchived, false),
    ),
    orderBy: [desc(calls.calledAt)],
    limit,
  });
}

/**
 * Get gamble calls for a group.
 */
export async function getGambleCalls(
  groupId: string,
  limit = 10,
): Promise<Call[]> {
  const db = getDb();
  return db.query.calls.findMany({
    where: and(
      eq(calls.groupId, groupId),
      eq(calls.callType, "gamble"),
      eq(calls.isArchived, false),
    ),
    orderBy: [desc(calls.calledAt)],
    limit,
  });
}

/**
 * Get all active (non-archived) calls for price tracking.
 * Only returns calls from the last 30 days for performance.
 */
export async function getActiveCalls(): Promise<Call[]> {
  const db = getDb();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  return db.query.calls.findMany({
    where: and(
      eq(calls.isArchived, false),
      gte(calls.calledAt, thirtyDaysAgo),
    ),
  });
}

/**
 * Get call by ID.
 */
export async function getCallById(callId: string): Promise<Call | undefined> {
  const db = getDb();
  return db.query.calls.findFirst({ where: eq(calls.id, callId) });
}

/**
 * Get calls by token address (across all groups — for dApp search).
 */
export async function getCallsByToken(
  tokenAddress: string,
  limit = 50,
): Promise<Call[]> {
  const db = getDb();
  return db.query.calls.findMany({
    where: eq(calls.tokenAddress, tokenAddress),
    orderBy: [desc(calls.calledAt)],
    limit,
  });
}

export type TimeframeFilter = "24h" | "7d" | "30d" | "all";

/**
 * Convert timeframe to a date boundary.
 */
export function getTimeframeBoundary(timeframe: TimeframeFilter): Date | null {
  switch (timeframe) {
    case "24h":
      return new Date(Date.now() - 24 * 60 * 60 * 1000);
    case "7d":
      return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    case "30d":
      return new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    case "all":
      return null;
  }
}
