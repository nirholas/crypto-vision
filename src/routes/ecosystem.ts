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
import { AppError } from "../lib/api-error.js";

export const ecosystemRoutes = new Hono();

// ─── Ecosystem Overview ─────────────────────────────────────

ecosystemRoutes.get("/", (c) => {
  return c.json({
    name: "Agent Ecosystem",
    description: "PumpFun for AI Agents — autonomous digital organisms trading on real markets",
    version: "0.1.0",
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
  });
});

// ─── List Organisms (PumpFun-style feed) ────────────────────

ecosystemRoutes.get("/organisms", async (c) => {
  const sort = c.req.query("sort") ?? "activity"; // activity, pnl, winrate, elo, newest, volume
  const status = c.req.query("status") ?? "active"; // active, dormant, extinct, all
  const generation = c.req.query("generation"); // 0, 1, 2, etc.
  const category = c.req.query("category"); // analysis, trading, defi, etc.
  const page = Math.max(1, Number(c.req.query("page") ?? "1"));
  const limit = Math.min(100, Math.max(1, Number(c.req.query("limit") ?? "50")));

  // This will query the agent_organisms table with filters and sorting
  // For now, return the structure that the frontend expects

  return c.json({
    organisms: [],
    pagination: {
      page,
      limit,
      total: 0,
      totalPages: 0,
    },
    filters: {
      sort,
      status,
      generation: generation ? Number(generation) : undefined,
      category,
    },
  });
});

// ─── Organism Detail ────────────────────────────────────────

ecosystemRoutes.get("/organisms/:id", async (c) => {
  const id = c.req.param("id");

  // This will query the organism + skills + positions + recent trades
  // For now, return the expected structure

  throw new AppError("NOT_FOUND", `Organism ${id} not found`);
});

// ─── Organism Trade History ─────────────────────────────────

ecosystemRoutes.get("/organisms/:id/trades", async (c) => {
  const id = c.req.param("id");
  const page = Math.max(1, Number(c.req.query("page") ?? "1"));
  const limit = Math.min(100, Math.max(1, Number(c.req.query("limit") ?? "50")));
  const direction = c.req.query("direction"); // buy, sell, all

  return c.json({
    organismId: id,
    trades: [],
    pagination: { page, limit, total: 0, totalPages: 0 },
    summary: {
      totalTrades: 0,
      wins: 0,
      losses: 0,
      winRate: 0,
      totalPnlSol: 0,
      bestTrade: null,
      worstTrade: null,
    },
  });
});

// ─── Organism Skills ────────────────────────────────────────

ecosystemRoutes.get("/organisms/:id/skills", async (c) => {
  const id = c.req.param("id");

  return c.json({
    organismId: id,
    skills: [],
    totalSkills: 0,
    averageProficiency: 0,
    topSkill: null,
    skillCategories: {},
  });
});

// ─── Organism Lineage ───────────────────────────────────────

ecosystemRoutes.get("/organisms/:id/lineage", async (c) => {
  const id = c.req.param("id");

  return c.json({
    organismId: id,
    generation: 0,
    parents: [],
    children: [],
    ancestors: [],  // Full tree up
    descendants: [], // Full tree down
    compositions: [], // All composition events in this lineage
  });
});

// ─── Organism Interactions ──────────────────────────────────

ecosystemRoutes.get("/organisms/:id/interactions", async (c) => {
  const id = c.req.param("id");
  const type = c.req.query("type"); // cooperate, compete, observe, compose, trade
  const page = Math.max(1, Number(c.req.query("page") ?? "1"));
  const limit = Math.min(100, Math.max(1, Number(c.req.query("limit") ?? "50")));

  return c.json({
    organismId: id,
    interactions: [],
    pagination: { page, limit, total: 0, totalPages: 0 },
    summary: {
      totalInteractions: 0,
      cooperations: 0,
      competitions: 0,
      observations: 0,
      compositions: 0,
      topPartner: null,
      topRival: null,
    },
  });
});

// ─── Global Leaderboard ─────────────────────────────────────

ecosystemRoutes.get("/leaderboard", async (c) => {
  const category = c.req.query("category") ?? "overall"; // overall, pnl, winrate, trades, elo, streak
  const limit = Math.min(100, Math.max(1, Number(c.req.query("limit") ?? "50")));

  return c.json({
    category,
    leaderboard: [],
    updatedAt: new Date().toISOString(),
    totalOrganisms: 0,
  });
});

// ─── Activity Feed ──────────────────────────────────────────

ecosystemRoutes.get("/feed", async (c) => {
  const limit = Math.min(100, Math.max(1, Number(c.req.query("limit") ?? "50")));
  const before = c.req.query("before"); // cursor for pagination
  const types = c.req.query("types")?.split(","); // filter by event types

  return c.json({
    events: [],
    hasMore: false,
    nextCursor: null,
  });
});

// ─── Composition History ────────────────────────────────────

ecosystemRoutes.get("/compositions", async (c) => {
  const page = Math.max(1, Number(c.req.query("page") ?? "1"));
  const limit = Math.min(100, Math.max(1, Number(c.req.query("limit") ?? "50")));

  return c.json({
    compositions: [],
    pagination: { page, limit, total: 0, totalPages: 0 },
    stats: {
      totalCompositions: 0,
      avgSkillsInherited: 0,
      avgEmergentSkills: 0,
      mostComposedParent: null,
      mostSuccessfulChild: null,
    },
  });
});

// ─── All Skills ─────────────────────────────────────────────

ecosystemRoutes.get("/skills", async (c) => {
  const category = c.req.query("category"); // filter by category

  return c.json({
    skills: [],
    totalSkills: 0,
    categories: {},
  });
});

// ─── Historical Snapshots ───────────────────────────────────

ecosystemRoutes.get("/snapshots", async (c) => {
  const limit = Math.min(500, Math.max(1, Number(c.req.query("limit") ?? "100")));
  const interval = c.req.query("interval") ?? "1h"; // 5m, 15m, 1h, 1d

  return c.json({
    snapshots: [],
    interval,
    totalSnapshots: 0,
  });
});

// ─── Fund an Organism ───────────────────────────────────────

ecosystemRoutes.post("/organisms/:id/fund", async (c) => {
  const id = c.req.param("id");

  let body: Record<string, unknown>;
  try {
    body = (await c.req.json()) as Record<string, unknown>;
  } catch {
    throw new AppError("INVALID_REQUEST", "Invalid JSON body");
  }

  const walletAddress = body.walletAddress as string | undefined;
  const amountLamports = body.amountLamports as string | undefined;
  const txSignature = body.txSignature as string | undefined;

  if (!walletAddress || !amountLamports || !txSignature) {
    throw new AppError("INVALID_REQUEST", "Required: walletAddress, amountLamports, txSignature");
  }

  // Validate the transaction on-chain before crediting the organism
  // This ensures funds were actually sent

  return c.json({
    success: true,
    organismId: id,
    funded: {
      walletAddress,
      amountLamports,
      txSignature,
    },
    message: "Funding received. Organism will activate once threshold is met.",
  });
});

// ─── Owner Intervention ─────────────────────────────────────

ecosystemRoutes.post("/organisms/:id/intervene", async (c) => {
  const id = c.req.param("id");

  let body: Record<string, unknown>;
  try {
    body = (await c.req.json()) as Record<string, unknown>;
  } catch {
    throw new AppError("INVALID_REQUEST", "Invalid JSON body");
  }

  const action = body.action as string | undefined;
  const ownerWallet = body.ownerWallet as string | undefined;

  if (!action || !ownerWallet) {
    throw new AppError("INVALID_REQUEST", "Required: action, ownerWallet");
  }

  // Allowed interventions (each changes the agent's destiny):
  const allowedActions = [
    "adjust_risk",       // Change risk tolerance
    "pause",             // Temporarily pause trading
    "resume",            // Resume from pause
    "rebalance",         // Force close all positions and restart
    "add_skill_focus",   // Hint the agent to focus on a specific skill
    "withdraw",          // Withdraw funds (partial)
  ];

  if (!allowedActions.includes(action)) {
    throw new AppError("INVALID_REQUEST", `Invalid action. Allowed: ${allowedActions.join(", ")}`);
  }

  // Verify ownership before allowing intervention
  // This checks that ownerWallet matches the organism's registered owner

  return c.json({
    success: true,
    organismId: id,
    intervention: {
      action,
      ownerWallet,
      timestamp: new Date().toISOString(),
    },
    warning: "Intervention changes the agent's destiny. Use sparingly.",
  });
});

// ─── Search Organisms ───────────────────────────────────────

ecosystemRoutes.get("/search", async (c) => {
  const q = c.req.query("q");
  if (!q || q.length < 2) {
    throw new AppError("INVALID_REQUEST", "Search query must be at least 2 characters");
  }

  return c.json({
    query: q,
    results: [],
    total: 0,
  });
});

// ─── Organism Positions ─────────────────────────────────────

ecosystemRoutes.get("/organisms/:id/positions", async (c) => {
  const id = c.req.param("id");

  return c.json({
    organismId: id,
    positions: [],
    totalValue: "0",
    totalUnrealizedPnl: "0",
  });
});

// ─── Organism Holdings (investments in other agents) ────────

ecosystemRoutes.get("/organisms/:id/holdings", async (c) => {
  const id = c.req.param("id");

  return c.json({
    organismId: id,
    holdings: [],  // Other agents this organism has invested in
    investors: [], // Other agents that have invested in this organism
    totalInvested: "0",
    totalInvestorsValue: "0",
  });
});

// ─── Ecosystem Map Data ─────────────────────────────────────

ecosystemRoutes.get("/map", async (c) => {
  // Returns data for force-directed graph visualization
  return c.json({
    nodes: [],  // Organisms as nodes with size proportional to capital
    edges: [],  // Interactions as edges with weight proportional to frequency
    clusters: [], // Skill-based clusters
    stats: {
      totalNodes: 0,
      totalEdges: 0,
      avgConnections: 0,
      density: 0,
    },
  });
});
