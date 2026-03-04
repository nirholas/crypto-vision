/**
 * Crypto Vision — dApp API Routes
 *
 * REST endpoints for the Crypto Vision web dApp, exposing leaderboard data,
 * caller profiles, trending tokens, search, and contest data.
 *
 * Routes:
 *  GET /api/crypto-vision/leaderboard/:groupId   — Group leaderboard
 *  GET /api/crypto-vision/profile/:username       — Caller profile
 *  GET /api/crypto-vision/trending                — Trending tokens
 *  GET /api/crypto-vision/group/:groupId/stats    — Group statistics
 *  GET /api/crypto-vision/calls/:groupId          — Group calls feed
 *  GET /api/crypto-vision/caller/:userId/calls    — Caller's calls
 *  GET /api/crypto-vision/health                  — Bot health check
 */

import { Hono } from "hono";
import { getCallsLeaderboard, getPerformanceLeaderboard, getLosersLeaderboard, getGroupStats, getTrendingTokens } from "../bot/services/leaderboard-service.js";
import { getUserByUsername, calculateWinRate, calculateAvgGain, getTopCalls, refreshUserStats } from "../bot/services/user-service.js";
import { getRecentCalls, getUserCalls, getAlphaCalls, getGambleCalls } from "../bot/services/call-service.js";
import { getGroupById } from "../bot/services/group-service.js";
import { getBotInstance } from "../bot/index.js";
import type { TimeframeFilter } from "../bot/services/call-service.js";

export const cryptoVisionRoutes = new Hono();

// ─── GET /leaderboard/:groupId ──────────────────────────────

cryptoVisionRoutes.get("/leaderboard/:groupId", async (c) => {
  const groupId = c.req.param("groupId");
  const type = (c.req.query("type") ?? "calls") as "calls" | "performance" | "losers";
  const timeframe = (c.req.query("timeframe") ?? "all") as TimeframeFilter;

  const group = await getGroupById(groupId);
  if (!group) {
    return c.json({ error: "Group not found" }, 404);
  }

  let entries;
  switch (type) {
    case "calls":
      entries = await getCallsLeaderboard(groupId, timeframe);
      break;
    case "performance":
      entries = await getPerformanceLeaderboard(groupId, timeframe);
      break;
    case "losers":
      entries = await getLosersLeaderboard(groupId, timeframe);
      break;
    default:
      entries = await getCallsLeaderboard(groupId, timeframe);
  }

  return c.json({
    group: { id: group.id, title: group.title },
    type,
    timeframe,
    entries,
  });
});

// ─── GET /profile/:username ─────────────────────────────────

cryptoVisionRoutes.get("/profile/:username", async (c) => {
  const username = c.req.param("username").replace(/^@/, "");
  const user = await getUserByUsername(username);

  if (!user) {
    return c.json({ error: "User not found" }, 404);
  }

  const updatedUser = await refreshUserStats(user.id);
  const winRate = await calculateWinRate(user.id);
  const avgGain = await calculateAvgGain(user.id);
  const topCalls = await getTopCalls(user.id, 10);

  return c.json({
    username: updatedUser.username,
    rankTier: updatedUser.rankTier,
    winRate,
    avgGain,
    totalCalls: updatedUser.totalCalls,
    totalWins: updatedUser.totalWins,
    performancePoints: updatedUser.performancePoints,
    topCalls: topCalls.map((call) => ({
      tokenSymbol: call.tokenSymbol,
      tokenAddress: call.tokenAddress,
      chain: call.chain,
      peakMultiplier: call.peakMultiplier,
      calledAt: call.calledAt,
    })),
    joinedAt: updatedUser.createdAt,
  });
});

// ─── GET /trending ──────────────────────────────────────────

cryptoVisionRoutes.get("/trending", async (c) => {
  const timeframe = (c.req.query("timeframe") ?? "24h") as TimeframeFilter;
  const limit = Math.min(parseInt(c.req.query("limit") ?? "20", 10), 100);

  const trending = await getTrendingTokens(timeframe, limit);

  return c.json({
    timeframe,
    tokens: trending,
  });
});

// ─── GET /group/:groupId/stats ──────────────────────────────

cryptoVisionRoutes.get("/group/:groupId/stats", async (c) => {
  const groupId = c.req.param("groupId");
  const timeframe = (c.req.query("timeframe") ?? "all") as TimeframeFilter;

  const group = await getGroupById(groupId);
  if (!group) {
    return c.json({ error: "Group not found" }, 404);
  }

  const stats = await getGroupStats(groupId, timeframe);

  return c.json({
    group: { id: group.id, title: group.title },
    timeframe,
    stats,
  });
});

// ─── GET /calls/:groupId ───────────────────────────────────

cryptoVisionRoutes.get("/calls/:groupId", async (c) => {
  const groupId = c.req.param("groupId");
  const type = c.req.query("type") as "alpha" | "gamble" | undefined;
  const limit = Math.min(parseInt(c.req.query("limit") ?? "50", 10), 200);

  const group = await getGroupById(groupId);
  if (!group) {
    return c.json({ error: "Group not found" }, 404);
  }

  let calls;
  if (type === "alpha") {
    calls = await getAlphaCalls(groupId, limit);
  } else if (type === "gamble") {
    calls = await getGambleCalls(groupId, limit);
  } else {
    calls = await getRecentCalls(groupId, limit);
  }

  return c.json({
    group: { id: group.id, title: group.title },
    calls: calls.map((call) => ({
      id: call.id,
      tokenSymbol: call.tokenSymbol,
      tokenName: call.tokenName,
      tokenAddress: call.tokenAddress,
      chain: call.chain,
      callType: call.callType,
      priceAtCall: call.priceAtCall,
      marketCapAtCall: call.marketCapAtCall,
      currentMultiplier: call.currentMultiplier,
      peakMultiplier: call.peakMultiplier,
      performancePoints: call.performancePoints,
      isWin: call.isWin,
      calledAt: call.calledAt,
    })),
  });
});

// ─── GET /caller/:userId/calls ──────────────────────────────

cryptoVisionRoutes.get("/caller/:userId/calls", async (c) => {
  const userId = c.req.param("userId");
  const groupId = c.req.query("groupId");
  const limit = Math.min(parseInt(c.req.query("limit") ?? "50", 10), 200);

  if (!groupId) {
    return c.json({ error: "groupId query parameter is required" }, 400);
  }

  const calls = await getUserCalls(userId, groupId, limit);

  return c.json({
    userId,
    calls: calls.map((call) => ({
      id: call.id,
      tokenSymbol: call.tokenSymbol,
      tokenAddress: call.tokenAddress,
      chain: call.chain,
      callType: call.callType,
      peakMultiplier: call.peakMultiplier,
      performancePoints: call.performancePoints,
      isWin: call.isWin,
      calledAt: call.calledAt,
    })),
  });
});

// ─── GET /health ────────────────────────────────────────────

cryptoVisionRoutes.get("/health", async (c) => {
  const bot = getBotInstance();
  return c.json({
    status: bot ? "running" : "stopped",
    timestamp: new Date().toISOString(),
  });
});
