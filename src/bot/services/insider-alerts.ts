/**
 * Crypto Vision — Insider Alerts Engine
 *
 * Uses the Wilson Score interval to identify high-probability callers
 * and generates real-time alerts for subscribers.
 *
 * The Wilson Score is a statistical method that accounts for both
 * win rate AND sample size, preventing users with few calls but
 * high win rates from dominating rankings.
 *
 * @copyright 2024-2026 nirholas. All rights reserved.
 */

import { eq, and, sql, gte, desc } from "drizzle-orm";
import { getDb } from "../db/index.js";
import {
  calls,
  users,
  insiderAlerts,
  insiderAlertSubscriptions,
  type Call,
  type InsiderAlert,
} from "../db/schema.js";
import { logger } from "@/lib/logger";

const log = logger.child({ module: "crypto-vision:insider-alerts" });

/**
 * Calculate the Wilson Score lower bound.
 *
 * This gives a conservative estimate of a caller's true win rate,
 * accounting for sample size. A caller with 10/10 wins scores lower
 * than one with 90/100 wins, because the latter has more evidence.
 *
 * @param wins Number of winning calls
 * @param total Total number of calls
 * @param confidence Z-score for confidence interval (1.96 = 95%)
 */
export function wilsonScore(wins: number, total: number, confidence = 1.96): number {
  if (total === 0) return 0;

  const p = wins / total;
  const z = confidence;
  const z2 = z * z;

  const numerator = p + z2 / (2 * total) - z * Math.sqrt((p * (1 - p) + z2 / (4 * total)) / total);
  const denominator = 1 + z2 / total;

  return Math.max(0, numerator / denominator);
}

/**
 * Get top callers by Wilson Score — these are the callers whose wins
 * are statistically significant.
 */
export async function getTopCallersByWilsonScore(
  minCalls = 10,
  limit = 50,
): Promise<
  Array<{
    userId: string;
    username: string | null;
    totalCalls: number;
    totalWins: number;
    winRate: number;
    avgGain: number;
    wilsonScore: number;
  }>
> {
  const db = getDb();

  const results = await db
    .select({
      userId: calls.userId,
      username: users.username,
      totalCalls: sql<number>`count(*)`.as("total_calls"),
      totalWins: sql<number>`count(*) filter (where ${calls.isWin} = true)`.as("total_wins"),
      avgGain: sql<number>`avg(${calls.peakMultiplier})`.as("avg_gain"),
    })
    .from(calls)
    .innerJoin(users, eq(calls.userId, users.id))
    .where(eq(calls.isArchived, false))
    .groupBy(calls.userId, users.username)
    .having(sql`count(*) >= ${minCalls}`);

  // Calculate Wilson Score for each caller
  const scored = results.map((r) => ({
    userId: r.userId,
    username: r.username,
    totalCalls: r.totalCalls,
    totalWins: r.totalWins,
    winRate: r.totalCalls > 0 ? (r.totalWins / r.totalCalls) * 100 : 0,
    avgGain: r.avgGain ?? 1,
    wilsonScore: wilsonScore(r.totalWins, r.totalCalls),
  }));

  // Sort by Wilson Score descending
  scored.sort((a, b) => b.wilsonScore - a.wilsonScore);

  return scored.slice(0, limit);
}

/**
 * Evaluate a new call to determine if it should trigger an insider alert.
 * Returns the alert if created, null otherwise.
 */
export async function evaluateCallForInsiderAlert(
  call: Call,
): Promise<InsiderAlert | null> {
  const db = getDb();

  // Get caller stats
  const [callerStats] = await db
    .select({
      totalCalls: sql<number>`count(*)`,
      totalWins: sql<number>`count(*) filter (where ${calls.isWin} = true)`,
      avgGain: sql<number>`avg(${calls.peakMultiplier})`,
    })
    .from(calls)
    .where(and(eq(calls.userId, call.userId), eq(calls.isArchived, false)));

  if (!callerStats || callerStats.totalCalls < 10) return null;

  const score = wilsonScore(callerStats.totalWins, callerStats.totalCalls);
  const winRate =
    callerStats.totalCalls > 0
      ? (callerStats.totalWins / callerStats.totalCalls) * 100
      : 0;

  // Only alert if Wilson Score is above threshold (top ~20% callers)
  const WILSON_THRESHOLD = 0.4;
  if (score < WILSON_THRESHOLD) return null;

  // Create insider alert
  const [alert] = await db
    .insert(insiderAlerts)
    .values({
      callId: call.id,
      callerWilsonScore: score,
      callerWinRate: winRate,
      callerAvgGain: callerStats.avgGain ?? 1,
      callerTotalCalls: callerStats.totalCalls,
    })
    .returning();

  log.info(
    {
      callId: call.id,
      userId: call.userId,
      wilsonScore: score.toFixed(3),
      winRate: winRate.toFixed(1),
      token: call.tokenSymbol,
    },
    "Insider alert generated",
  );

  return alert;
}

/**
 * Get active insider alert subscribers, optionally filtered to match a call's properties.
 */
export async function getMatchingSubscribers(
  call: Call,
  alert: InsiderAlert,
): Promise<
  Array<{
    userId: string;
    telegramId: string;
  }>
> {
  const db = getDb();

  const subs = await db
    .select({
      userId: insiderAlertSubscriptions.userId,
      telegramId: users.telegramId,
      filterMinWinRate: insiderAlertSubscriptions.filterMinWinRate,
      filterMinAvgGain: insiderAlertSubscriptions.filterMinAvgGain,
      filterChains: insiderAlertSubscriptions.filterChains,
      filterCallers: insiderAlertSubscriptions.filterCallers,
      filterMinMarketCap: insiderAlertSubscriptions.filterMinMarketCap,
      filterMaxMarketCap: insiderAlertSubscriptions.filterMaxMarketCap,
    })
    .from(insiderAlertSubscriptions)
    .innerJoin(users, eq(insiderAlertSubscriptions.userId, users.id))
    .where(eq(insiderAlertSubscriptions.status, "active"));

  // Apply subscriber-specific filters
  return subs.filter((sub) => {
    // Win rate filter
    if (sub.filterMinWinRate && alert.callerWinRate < sub.filterMinWinRate) {
      return false;
    }

    // Avg gain filter
    if (sub.filterMinAvgGain && alert.callerAvgGain < sub.filterMinAvgGain) {
      return false;
    }

    // Chain filter
    if (sub.filterChains && sub.filterChains.length > 0) {
      if (!sub.filterChains.includes(call.chain)) return false;
    }

    // Caller filter (specific callers only)
    if (sub.filterCallers && sub.filterCallers.length > 0) {
      if (!sub.filterCallers.includes(call.userId)) return false;
    }

    // Market cap filter
    if (call.marketCapAtCall) {
      const mcap = parseFloat(call.marketCapAtCall);
      if (sub.filterMinMarketCap && mcap < parseFloat(sub.filterMinMarketCap)) {
        return false;
      }
      if (sub.filterMaxMarketCap && mcap > parseFloat(sub.filterMaxMarketCap)) {
        return false;
      }
    }

    return true;
  }).map((sub) => ({
    userId: sub.userId,
    telegramId: sub.telegramId,
  }));
}

/**
 * Update the notified count for an insider alert.
 */
export async function updateAlertNotifiedCount(
  alertId: string,
  count: number,
): Promise<void> {
  const db = getDb();
  await db
    .update(insiderAlerts)
    .set({ notifiedCount: count })
    .where(eq(insiderAlerts.id, alertId));
}

/**
 * Get recent insider alerts with call details.
 */
export async function getRecentInsiderAlerts(
  limit = 20,
): Promise<
  Array<{
    alert: InsiderAlert;
    call: Call;
    callerUsername: string | null;
  }>
> {
  const db = getDb();

  const results = await db
    .select({
      alert: insiderAlerts,
      call: calls,
      callerUsername: users.username,
    })
    .from(insiderAlerts)
    .innerJoin(calls, eq(insiderAlerts.callId, calls.id))
    .innerJoin(users, eq(calls.userId, users.id))
    .orderBy(desc(insiderAlerts.createdAt))
    .limit(limit);

  return results;
}
