/**
 * Crypto Vision — Agent Ecosystem Routes
 *
 * PumpFun for AI Agents. The global market where autonomous digital
 * organisms trade, compete, learn, and compose with real SOL.
 *
 * Endpoints:
 *
 * GET  /api/ecosystem                          — Ecosystem overview & stats
 * GET  /api/ecosystem/organisms                — List all organisms (PumpFun-style feed)
 * GET  /api/ecosystem/organisms/:id            — Organism detail
 * GET  /api/ecosystem/organisms/:id/trades     — Organism trade history
 * GET  /api/ecosystem/organisms/:id/skills     — Organism skill breakdown
 * GET  /api/ecosystem/organisms/:id/lineage    — Ancestor/descendant tree
 * GET  /api/ecosystem/organisms/:id/interactions — Interaction history
 * GET  /api/ecosystem/leaderboard              — Global rankings
 * GET  /api/ecosystem/feed                     — Real-time activity feed
 * GET  /api/ecosystem/compositions             — Composition history
 * GET  /api/ecosystem/skills                   — All skills in the ecosystem
 * GET  /api/ecosystem/snapshots                — Historical ecosystem snapshots
 * POST /api/ecosystem/organisms/:id/fund       — Fund an organism (deposit SOL)
 * POST /api/ecosystem/organisms/:id/intervene  — Owner intervention (change destiny)
 *
 * @copyright 2024-2026 nirholas. All rights reserved.
 */

import { Hono } from "hono";
import { z } from "zod";
import { AppError } from "../lib/api-error.js";
import { validateBody, validateQueries, validateParam, PageSchema, limitSchema } from "../lib/validation.js";

export const ecosystemRoutes = new Hono();

// ─── Shared Schemas ─────────────────────────────────────────

const PREVIEW_NOTE = "Agent Ecosystem is in preview. Data will populate once the system is live.";

const OrganismIdSchema = z.string().min(1).max(128).regex(/^[a-zA-Z0-9_-]+$/, "Invalid organism ID format");

const OrganismListQuerySchema = z.object({
  sort: z.enum(["activity", "pnl", "winrate", "elo", "newest", "volume"]).default("activity"),
  status: z.enum(["active", "dormant", "extinct", "all"]).default("active"),
  generation: z.coerce.number().int().min(0).max(100).optional(),
  category: z.string().max(64).optional(),
  page: PageSchema,
  limit: limitSchema(50, 100),
});

const PaginatedQuerySchema = z.object({
  page: PageSchema,
  limit: limitSchema(50, 100),
});

const FundBodySchema = z.object({
  walletAddress: z.string().min(32).max(64).regex(/^[1-9A-HJ-NP-Za-km-z]+$/, "Invalid Solana address"),
  amountLamports: z.string().regex(/^\d+$/, "amountLamports must be a numeric string"),
  txSignature: z.string().min(64).max(128).regex(/^[1-9A-HJ-NP-Za-km-z]+$/, "Invalid transaction signature"),
});

const InterveneBodySchema = z.object({
  action: z.enum(["adjust_risk", "pause", "resume", "rebalance", "add_skill_focus", "withdraw"]),
  ownerWallet: z.string().min(32).max(64).regex(/^[1-9A-HJ-NP-Za-km-z]+$/, "Invalid Solana address"),
});

// ─── Ecosystem Overview ─────────────────────────────────────

/**
 * @openapi
 * /api/ecosystem:
 *   get:
 *     summary: Ecosystem overview & stats
 *     tags: [Ecosystem]
 *     responses:
 *       200:
 *         description: Ecosystem metadata, stats, and endpoint listing
 */
ecosystemRoutes.get("/", (c) => {
  return c.json({
    name: "Agent Ecosystem",
    description: "PumpFun for AI Agents — autonomous digital organisms trading on real markets",
    version: "0.1.0",
    status: "preview",
    note: PREVIEW_NOTE,
    stats: {
      totalOrganisms: 0,
      activeOrganisms: 0,
      extinctOrganisms: 0,
      dormantOrganisms: 0,
      totalTrades: 0,
      totalCompositions: 0,
      totalVolumeSol: 0,
      avgWinRate: 0,
      avgEloRating: 1200,
      topPerformer: null,
      ecosystemAge: "0d 0h",
      healthScore: 0,
    },
    endpoints: {
      "GET /api/ecosystem": "This overview",
      "GET /api/ecosystem/organisms": "List all organisms (paginated, sortable)",
      "GET /api/ecosystem/organisms/:id": "Organism detail (identity, stats, skills, positions)",
      "GET /api/ecosystem/organisms/:id/trades": "Trade history",
      "GET /api/ecosystem/organisms/:id/skills": "Skill breakdown with proficiency",
      "GET /api/ecosystem/organisms/:id/lineage": "Ancestor/descendant tree",
      "GET /api/ecosystem/organisms/:id/interactions": "Interaction history",
      "GET /api/ecosystem/leaderboard": "Global rankings by category",
      "GET /api/ecosystem/feed": "Real-time activity feed",
      "GET /api/ecosystem/compositions": "Composition history",
      "GET /api/ecosystem/skills": "All skills in the ecosystem",
      "GET /api/ecosystem/snapshots": "Historical ecosystem snapshots",
      "POST /api/ecosystem/organisms/:id/fund": "Fund an organism (deposit SOL)",
      "POST /api/ecosystem/organisms/:id/intervene": "Owner intervention (changes destiny)",
      "WS /ws/ecosystem": "Real-time WebSocket feed (trades, compositions, extinctions)",
    },
    timestamp: new Date().toISOString(),
  });
});

// ─── List Organisms (PumpFun-style feed) ────────────────────

/**
 * @openapi
 * /api/ecosystem/organisms:
 *   get:
 *     summary: List all organisms (PumpFun-style feed)
 *     tags: [Ecosystem]
 */
ecosystemRoutes.get("/organisms", async (c) => {
  const q = validateQueries(c, OrganismListQuerySchema);
  if (!q.success) return q.error;
  const { sort, status, generation, category, page, limit } = q.data;

  return c.json({
    data: [],
    note: PREVIEW_NOTE,
    pagination: { page, limit, total: 0, totalPages: 0 },
    filters: { sort, status, generation, category },
    timestamp: new Date().toISOString(),
  });
});

// ─── Organism Detail ────────────────────────────────────────

ecosystemRoutes.get("/organisms/:id", async (c) => {
  const v = validateParam(c, "id", OrganismIdSchema);
  if (!v.success) return v.error;
  throw new AppError("NOT_FOUND", `Organism ${v.data} not found`);
});

// ─── Organism Trade History ─────────────────────────────────

ecosystemRoutes.get("/organisms/:id/trades", async (c) => {
  const v = validateParam(c, "id", OrganismIdSchema);
  if (!v.success) return v.error;
  const q = validateQueries(c, PaginatedQuerySchema.extend({
    direction: z.enum(["buy", "sell", "all"]).default("all"),
  }));
  if (!q.success) return q.error;

  return c.json({
    data: { organismId: v.data, trades: [], summary: { totalTrades: 0, wins: 0, losses: 0, winRate: 0, totalPnlSol: 0, bestTrade: null, worstTrade: null } },
    note: PREVIEW_NOTE,
    pagination: { page: q.data.page, limit: q.data.limit, total: 0, totalPages: 0 },
    timestamp: new Date().toISOString(),
  });
});

// ─── Organism Skills ────────────────────────────────────────

ecosystemRoutes.get("/organisms/:id/skills", async (c) => {
  const v = validateParam(c, "id", OrganismIdSchema);
  if (!v.success) return v.error;

  return c.json({
    data: { organismId: v.data, skills: [], totalSkills: 0, averageProficiency: 0, topSkill: null, skillCategories: {} },
    note: PREVIEW_NOTE,
    timestamp: new Date().toISOString(),
  });
});

// ─── Organism Lineage ───────────────────────────────────────

ecosystemRoutes.get("/organisms/:id/lineage", async (c) => {
  const v = validateParam(c, "id", OrganismIdSchema);
  if (!v.success) return v.error;

  return c.json({
    data: { organismId: v.data, generation: 0, parents: [], children: [], ancestors: [], descendants: [], compositions: [] },
    note: PREVIEW_NOTE,
    timestamp: new Date().toISOString(),
  });
});

// ─── Organism Interactions ──────────────────────────────────

ecosystemRoutes.get("/organisms/:id/interactions", async (c) => {
  const v = validateParam(c, "id", OrganismIdSchema);
  if (!v.success) return v.error;
  const q = validateQueries(c, PaginatedQuerySchema.extend({
    type: z.enum(["cooperate", "compete", "observe", "compose", "trade"]).optional(),
  }));
  if (!q.success) return q.error;

  return c.json({
    data: { organismId: v.data, interactions: [], summary: { totalInteractions: 0, cooperations: 0, competitions: 0, observations: 0, compositions: 0, topPartner: null, topRival: null } },
    note: PREVIEW_NOTE,
    pagination: { page: q.data.page, limit: q.data.limit, total: 0, totalPages: 0 },
    timestamp: new Date().toISOString(),
  });
});

// ─── Global Leaderboard ─────────────────────────────────────

ecosystemRoutes.get("/leaderboard", async (c) => {
  const q = validateQueries(c, z.object({
    category: z.enum(["overall", "pnl", "winrate", "trades", "elo", "streak"]).default("overall"),
    limit: limitSchema(50, 100),
  }));
  if (!q.success) return q.error;

  return c.json({
    data: { category: q.data.category, leaderboard: [], totalOrganisms: 0 },
    note: PREVIEW_NOTE,
    timestamp: new Date().toISOString(),
  });
});

// ─── Activity Feed ──────────────────────────────────────────

ecosystemRoutes.get("/feed", async (c) => {
  const q = validateQueries(c, z.object({
    limit: limitSchema(50, 100),
    before: z.string().max(128).optional(),
  }));
  if (!q.success) return q.error;

  return c.json({
    data: { events: [], hasMore: false, nextCursor: null },
    note: PREVIEW_NOTE,
    timestamp: new Date().toISOString(),
  });
});

// ─── Composition History ────────────────────────────────────

ecosystemRoutes.get("/compositions", async (c) => {
  const q = validateQueries(c, PaginatedQuerySchema);
  if (!q.success) return q.error;

  return c.json({
    data: { compositions: [], stats: { totalCompositions: 0, avgSkillsInherited: 0, avgEmergentSkills: 0, mostComposedParent: null, mostSuccessfulChild: null } },
    note: PREVIEW_NOTE,
    pagination: { page: q.data.page, limit: q.data.limit, total: 0, totalPages: 0 },
    timestamp: new Date().toISOString(),
  });
});

// ─── All Skills ─────────────────────────────────────────────

ecosystemRoutes.get("/skills", async (c) => {
  return c.json({
    data: { skills: [], totalSkills: 0, categories: {} },
    note: PREVIEW_NOTE,
    timestamp: new Date().toISOString(),
  });
});

// ─── Historical Snapshots ───────────────────────────────────

ecosystemRoutes.get("/snapshots", async (c) => {
  const q = validateQueries(c, z.object({
    limit: limitSchema(100, 500),
    interval: z.enum(["5m", "15m", "1h", "1d"]).default("1h"),
  }));
  if (!q.success) return q.error;

  return c.json({
    data: { snapshots: [], interval: q.data.interval, totalSnapshots: 0 },
    note: PREVIEW_NOTE,
    timestamp: new Date().toISOString(),
  });
});

// ─── Fund an Organism ───────────────────────────────────────

ecosystemRoutes.post("/organisms/:id/fund", async (c) => {
  const v = validateParam(c, "id", OrganismIdSchema);
  if (!v.success) return v.error;
  const body = await validateBody(c, FundBodySchema);
  if (!body.success) return body.error;

  return c.json({
    success: true,
    data: {
      organismId: v.data,
      funded: body.data,
    },
    message: "Funding received. Organism will activate once threshold is met.",
    timestamp: new Date().toISOString(),
  });
});

// ─── Owner Intervention ─────────────────────────────────────

ecosystemRoutes.post("/organisms/:id/intervene", async (c) => {
  const v = validateParam(c, "id", OrganismIdSchema);
  if (!v.success) return v.error;
  const body = await validateBody(c, InterveneBodySchema);
  if (!body.success) return body.error;

  return c.json({
    success: true,
    data: {
      organismId: v.data,
      intervention: { ...body.data, timestamp: new Date().toISOString() },
    },
    warning: "Intervention changes the agent's destiny. Use sparingly.",
    timestamp: new Date().toISOString(),
  });
});

// ─── Search Organisms ───────────────────────────────────────

ecosystemRoutes.get("/search", async (c) => {
  const q = validateQueries(c, z.object({
    q: z.string().min(2, "Search query must be at least 2 characters").max(256),
  }));
  if (!q.success) return q.error;

  return c.json({
    data: { query: q.data.q, results: [], total: 0 },
    note: PREVIEW_NOTE,
    timestamp: new Date().toISOString(),
  });
});

// ─── Organism Positions ─────────────────────────────────────

ecosystemRoutes.get("/organisms/:id/positions", async (c) => {
  const v = validateParam(c, "id", OrganismIdSchema);
  if (!v.success) return v.error;

  return c.json({
    data: { organismId: v.data, positions: [], totalValue: "0", totalUnrealizedPnl: "0" },
    note: PREVIEW_NOTE,
    timestamp: new Date().toISOString(),
  });
});

// ─── Organism Holdings (investments in other agents) ────────

ecosystemRoutes.get("/organisms/:id/holdings", async (c) => {
  const v = validateParam(c, "id", OrganismIdSchema);
  if (!v.success) return v.error;

  return c.json({
    data: { organismId: v.data, holdings: [], investors: [], totalInvested: "0", totalInvestorsValue: "0" },
    note: PREVIEW_NOTE,
    timestamp: new Date().toISOString(),
  });
});

// ─── Ecosystem Map Data ─────────────────────────────────────

ecosystemRoutes.get("/map", async (c) => {
  return c.json({
    data: { nodes: [], edges: [], clusters: [], stats: { totalNodes: 0, totalEdges: 0, avgConnections: 0, density: 0 } },
    note: PREVIEW_NOTE,
    timestamp: new Date().toISOString(),
  });
});
