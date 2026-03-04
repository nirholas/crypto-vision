/**
 * Crypto Vision — Reusable Database Query Helpers
 *
 * Typed query functions for all core schema tables.
 * Import `getDb` from the connection module; these helpers
 * accept the db instance to remain testable and composable.
 *
 * @copyright 2024-2026 nirholas. All rights reserved.
 */

import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { createHash, randomBytes } from "node:crypto";
import { logger } from "@/lib/logger.js";
import type { Db } from "./index.js";
import {
  apiKeys,
  marketSnapshots,
  defiSnapshots,
  newsArticles,
  anomalyEvents,
  searchQueries,
  agentExecutions,
  portfolios,
  portfolioHoldings,
  portfolioTransactions,
  watchlists,
  priceAlerts,
  exportJobs,
  type NewMarketSnapshot,
  type NewDefiSnapshot,
  type NewNewsArticle,
  type NewAnomalyEvent,
  type NewSearchQuery,
  type NewAgentExecution,
  type NewPortfolioHolding,
  type NewPortfolioTransaction,
  type ApiKey,
  type MarketSnapshot,
  type AnomalyEvent,
  type Portfolio,
  type PortfolioHolding,
  type AgentExecution,
  type ExportJob,
} from "./schema.js";

// ─── Helpers ────────────────────────────────────────────────

function hashKey(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

function generateRawKey(): string {
  return `cv_${randomBytes(32).toString("hex")}`;
}

// ─── API Keys ───────────────────────────────────────────────

export interface CreateApiKeyResult {
  rawKey: string;
  record: ApiKey;
}

/**
 * Create a new API key. Returns the raw key (only shown once) and the DB record.
 */
export async function createApiKey(
  db: Db,
  name: string,
  tier: "free" | "pro" | "enterprise" = "free",
): Promise<CreateApiKeyResult> {
  const rawKey = generateRawKey();
  const keyHash = hashKey(rawKey);
  const keyPrefix = rawKey.slice(0, 11); // "cv_" + first 8 hex chars

  const rateLimits: Record<string, number> = {
    free: 100,
    pro: 2000,
    enterprise: 10_000,
  };

  const [record] = await db
    .insert(apiKeys)
    .values({
      name,
      keyHash,
      keyPrefix,
      tier,
      rateLimit: rateLimits[tier] ?? 100,
    })
    .returning();

  logger.info({ keyPrefix, tier }, "API key created");
  return { rawKey, record };
}

/**
 * Validate an API key by its raw value. Returns the key record if valid, null otherwise.
 */
export async function validateApiKey(
  db: Db,
  rawKey: string,
): Promise<ApiKey | null> {
  const keyHash = hashKey(rawKey);
  const [key] = await db
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.keyHash, keyHash), eq(apiKeys.isActive, true)))
    .limit(1);

  if (!key) return null;

  // Check expiration
  if (key.expiresAt && key.expiresAt < new Date()) {
    return null;
  }

  return key;
}

/**
 * Increment the request count and update last-used timestamp.
 */
export async function incrementKeyUsage(db: Db, id: string): Promise<void> {
  await db
    .update(apiKeys)
    .set({
      requestCount: sql`${apiKeys.requestCount} + 1`,
      lastUsedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(apiKeys.id, id));
}

/**
 * Revoke (deactivate) an API key.
 */
export async function revokeApiKey(db: Db, id: string): Promise<void> {
  await db
    .update(apiKeys)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(apiKeys.id, id));
  logger.info({ id }, "API key revoked");
}

// ─── Market Data ────────────────────────────────────────────

/**
 * Batch insert market snapshots. Uses a single INSERT for efficiency.
 */
export async function insertMarketSnapshots(
  db: Db,
  data: NewMarketSnapshot[],
): Promise<void> {
  if (data.length === 0) return;
  await db.insert(marketSnapshots).values(data);
}

/**
 * Get the latest snapshot for a coin.
 */
export async function getLatestSnapshot(
  db: Db,
  coinId: string,
): Promise<MarketSnapshot | null> {
  const [row] = await db
    .select()
    .from(marketSnapshots)
    .where(eq(marketSnapshots.coinId, coinId))
    .orderBy(desc(marketSnapshots.snapshotAt))
    .limit(1);
  return row ?? null;
}

/**
 * Get snapshots for a coin within a time range.
 */
export async function getSnapshots(
  db: Db,
  coinId: string,
  from: Date,
  to: Date,
): Promise<MarketSnapshot[]> {
  return db
    .select()
    .from(marketSnapshots)
    .where(
      and(
        eq(marketSnapshots.coinId, coinId),
        gte(marketSnapshots.snapshotAt, from),
        lte(marketSnapshots.snapshotAt, to),
      ),
    )
    .orderBy(marketSnapshots.snapshotAt);
}

// ─── DeFi Snapshots ─────────────────────────────────────────

/**
 * Batch insert DeFi snapshots.
 */
export async function insertDefiSnapshots(
  db: Db,
  data: NewDefiSnapshot[],
): Promise<void> {
  if (data.length === 0) return;
  await db.insert(defiSnapshots).values(data);
}

// ─── News Articles ──────────────────────────────────────────

/**
 * Upsert a news article (skip if URL already exists).
 */
export async function upsertNewsArticle(
  db: Db,
  article: NewNewsArticle,
): Promise<void> {
  await db
    .insert(newsArticles)
    .values(article)
    .onConflictDoNothing({ target: newsArticles.url });
}

// ─── Anomalies ──────────────────────────────────────────────

/**
 * Insert a detected anomaly event.
 */
export async function insertAnomaly(
  db: Db,
  event: NewAnomalyEvent,
): Promise<void> {
  await db.insert(anomalyEvents).values(event);
}

export interface AnomalyFilters {
  coinId?: string;
  type?: AnomalyEvent["type"];
  severity?: AnomalyEvent["severity"];
  from?: Date;
  to?: Date;
  limit?: number;
}

/**
 * Query anomaly events with optional filters.
 */
export async function getAnomalies(
  db: Db,
  filters: AnomalyFilters = {},
): Promise<AnomalyEvent[]> {
  const conditions = [];
  if (filters.coinId) conditions.push(eq(anomalyEvents.coinId, filters.coinId));
  if (filters.type) conditions.push(eq(anomalyEvents.type, filters.type));
  if (filters.severity) conditions.push(eq(anomalyEvents.severity, filters.severity));
  if (filters.from) conditions.push(gte(anomalyEvents.detectedAt, filters.from));
  if (filters.to) conditions.push(lte(anomalyEvents.detectedAt, filters.to));

  return db
    .select()
    .from(anomalyEvents)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(anomalyEvents.detectedAt))
    .limit(filters.limit ?? 100);
}

// ─── Search Queries ─────────────────────────────────────────

/**
 * Log a search query for analytics.
 */
export async function logSearchQuery(
  db: Db,
  data: NewSearchQuery,
): Promise<void> {
  await db.insert(searchQueries).values(data);
}

// ─── Agent Executions ───────────────────────────────────────

/**
 * Start tracking an agent execution. Returns the created record.
 */
export async function startAgentExecution(
  db: Db,
  data: Omit<NewAgentExecution, "status">,
): Promise<AgentExecution> {
  const [record] = await db
    .insert(agentExecutions)
    .values({ ...data, status: "running" })
    .returning();
  return record;
}

/**
 * Complete an agent execution with result data.
 */
export async function completeAgentExecution(
  db: Db,
  id: string,
  result: {
    status: "completed" | "failed" | "timeout";
    result?: unknown;
    error?: string;
    tokensUsed?: number;
    toolCalls?: number;
    durationMs?: number;
  },
): Promise<void> {
  await db
    .update(agentExecutions)
    .set({
      status: result.status,
      result: result.result as Record<string, unknown> | undefined,
      error: result.error,
      tokensUsed: result.tokensUsed,
      toolCalls: result.toolCalls,
      durationMs: result.durationMs,
      completedAt: new Date(),
    })
    .where(eq(agentExecutions.id, id));
}

// ─── Portfolios ─────────────────────────────────────────────

/**
 * Create a new portfolio for a user.
 */
export async function createPortfolio(
  db: Db,
  userId: string,
  name: string,
  description?: string,
): Promise<Portfolio> {
  const [record] = await db
    .insert(portfolios)
    .values({ userId, name, description })
    .returning();
  return record;
}

/**
 * Add or update a holding in a portfolio.
 * If the coin already exists in the portfolio, the amount is added.
 */
export async function addHolding(
  db: Db,
  portfolioId: string,
  coinId: string,
  symbol: string,
  amount: number,
  priceUsd: number,
): Promise<PortfolioHolding> {
  const existing = await db
    .select()
    .from(portfolioHoldings)
    .where(
      and(
        eq(portfolioHoldings.portfolioId, portfolioId),
        eq(portfolioHoldings.coinId, coinId),
      ),
    )
    .limit(1);

  if (existing.length > 0) {
    const prev = existing[0];
    const newAmount = (prev.amount ?? 0) + amount;
    const totalCost =
      ((prev.avgCostUsd ?? 0) * (prev.amount ?? 0)) + (priceUsd * amount);
    const newAvgCost = newAmount > 0 ? totalCost / newAmount : 0;

    const [updated] = await db
      .update(portfolioHoldings)
      .set({
        amount: newAmount,
        avgCostUsd: newAvgCost,
        currentValueUsd: newAmount * priceUsd,
        updatedAt: new Date(),
      })
      .where(eq(portfolioHoldings.id, prev.id))
      .returning();
    return updated;
  }

  const [record] = await db
    .insert(portfolioHoldings)
    .values({
      portfolioId,
      coinId,
      symbol,
      amount,
      avgCostUsd: priceUsd,
      currentValueUsd: amount * priceUsd,
    })
    .returning();
  return record;
}

/**
 * Get a portfolio with all its holdings.
 */
export async function getPortfolioWithHoldings(
  db: Db,
  portfolioId: string,
): Promise<{ portfolio: Portfolio; holdings: PortfolioHolding[] } | null> {
  const [portfolio] = await db
    .select()
    .from(portfolios)
    .where(eq(portfolios.id, portfolioId))
    .limit(1);

  if (!portfolio) return null;

  const holdings = await db
    .select()
    .from(portfolioHoldings)
    .where(eq(portfolioHoldings.portfolioId, portfolioId))
    .orderBy(desc(portfolioHoldings.currentValueUsd));

  return { portfolio, holdings };
}

/**
 * Record a portfolio transaction and update the holding.
 */
export async function recordTransaction(
  db: Db,
  data: NewPortfolioTransaction,
): Promise<void> {
  await db.insert(portfolioTransactions).values(data);
}

// ─── Watchlists ─────────────────────────────────────────────

/**
 * Create a watchlist for a user.
 */
export async function createWatchlist(
  db: Db,
  userId: string,
  name: string,
  coinIds: string[] = [],
): Promise<typeof watchlists.$inferSelect> {
  const [record] = await db
    .insert(watchlists)
    .values({ userId, name, coinIds })
    .returning();
  return record;
}

/**
 * Add a coin to a watchlist.
 */
export async function addToWatchlist(
  db: Db,
  watchlistId: string,
  coinId: string,
): Promise<void> {
  const [wl] = await db
    .select()
    .from(watchlists)
    .where(eq(watchlists.id, watchlistId))
    .limit(1);

  if (!wl) return;

  const current = (wl.coinIds ?? []) as string[];
  if (current.includes(coinId)) return;

  await db
    .update(watchlists)
    .set({
      coinIds: [...current, coinId],
      updatedAt: new Date(),
    })
    .where(eq(watchlists.id, watchlistId));
}

// ─── Price Alerts ───────────────────────────────────────────

/**
 * Create a price alert.
 */
export async function createPriceAlert(
  db: Db,
  data: typeof priceAlerts.$inferInsert,
): Promise<typeof priceAlerts.$inferSelect> {
  const [record] = await db
    .insert(priceAlerts)
    .values(data)
    .returning();
  return record;
}

/**
 * Get active alerts for a coin (used by the price checker worker).
 */
export async function getActiveAlertsForCoin(
  db: Db,
  coinId: string,
): Promise<(typeof priceAlerts.$inferSelect)[]> {
  return db
    .select()
    .from(priceAlerts)
    .where(
      and(
        eq(priceAlerts.coinId, coinId),
        eq(priceAlerts.status, "active"),
      ),
    );
}

/**
 * Mark an alert as triggered.
 */
export async function triggerAlert(
  db: Db,
  alertId: string,
  triggeredPrice: number,
): Promise<void> {
  await db
    .update(priceAlerts)
    .set({
      status: "triggered",
      triggeredAt: new Date(),
      triggeredPrice,
    })
    .where(eq(priceAlerts.id, alertId));
}

// ─── Export Jobs ────────────────────────────────────────────

/**
 * Create a new export job.
 */
export async function createExportJob(
  db: Db,
  data: typeof exportJobs.$inferInsert,
): Promise<ExportJob> {
  const [record] = await db
    .insert(exportJobs)
    .values(data)
    .returning();
  return record;
}

/**
 * Update export job status.
 */
export async function updateExportJob(
  db: Db,
  id: string,
  update: Partial<Pick<ExportJob, "status" | "rowCount" | "fileSizeBytes" | "downloadUrl" | "error" | "completedAt" | "expiresAt">>,
): Promise<void> {
  await db
    .update(exportJobs)
    .set({
      ...update,
      ...(update.status === "processing" ? { startedAt: new Date() } : {}),
    })
    .where(eq(exportJobs.id, id));
}
