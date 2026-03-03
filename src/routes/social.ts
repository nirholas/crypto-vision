/**
 * Crypto Vision — Social Metrics Routes
 *
 * Social sentiment, community data, and developer metrics.
 *
 * GET /api/social/profile/:id          — Social profile for a coin
 * GET /api/social/profiles             — Batch social profiles (?ids=bitcoin,ethereum)
 * GET /api/social/fear-greed           — Fear & Greed Index
 * GET /api/social/fear-greed/history   — Fear & Greed history
 * GET /api/social/lunar/:symbol        — LunarCrush metrics for a coin
 * GET /api/social/lunar/top            — Top coins by social volume
 * GET /api/social/lunar/feed/:symbol   — LunarCrush social feed
 * GET /api/social/cc/:coinId           — CryptoCompare social stats
 * GET /api/social/cc/history/:coinId   — CryptoCompare social history
 * GET /api/social/dashboard            — Aggregate social dashboard
 *
 * @copyright 2024-2026 nirholas. All rights reserved.
 */

import { Hono } from "hono";
import * as social from "../sources/social.js";

export const socialRoutes = new Hono();

// ─── CoinGecko Social Profiles ──────────────────────────────

socialRoutes.get("/profile/:id", async (c) => {
  const id = c.req.param("id");
  const data = await social.getSocialProfile(id);
  return c.json(data);
});

socialRoutes.get("/profiles", async (c) => {
  const idsParam = c.req.query("ids") || "";
  if (!idsParam) return c.json({ error: "Missing ?ids= parameter (comma-separated coin IDs)" }, 400);
  const ids = idsParam.split(",").map((s) => s.trim()).filter(Boolean);
  if (ids.length > 20) return c.json({ error: "Maximum 20 coins per request" }, 400);
  const data = await social.getSocialProfiles(ids);
  return c.json({ count: data.length, data });
});

// ─── Fear & Greed ────────────────────────────────────────────

socialRoutes.get("/fear-greed", async (c) => {
  const days = Math.min(Number(c.req.query("days")) || 1, 365);
  const data = await social.getFearGreed(days);
  return c.json(data);
});

socialRoutes.get("/fear-greed/history", async (c) => {
  const limit = Math.min(Number(c.req.query("limit")) || 30, 365);
  const data = await social.getFearGreedHistory(limit);
  return c.json(data);
});

// ─── LunarCrush ──────────────────────────────────────────────

socialRoutes.get("/lunar/:symbol", async (c) => {
  const symbol = c.req.param("symbol").toUpperCase();
  const data = await social.getLunarMetrics(symbol);
  return c.json(data);
});

socialRoutes.get("/lunar/top", async (c) => {
  const sort = c.req.query("sort") || "galaxy_score";
  const limit = Math.min(Number(c.req.query("limit")) || 50, 100);
  const data = await social.getLunarTopCoins(sort, limit);
  return c.json(data);
});

socialRoutes.get("/lunar/feed/:symbol", async (c) => {
  const symbol = c.req.param("symbol").toUpperCase();
  const limit = Math.min(Number(c.req.query("limit")) || 20, 50);
  const data = await social.getLunarFeed(symbol, limit);
  return c.json(data);
});

// ─── CryptoCompare ───────────────────────────────────────────

socialRoutes.get("/cc/:coinId", async (c) => {
  const coinId = Number(c.req.param("coinId"));
  if (isNaN(coinId)) return c.json({ error: "coinId must be a number" }, 400);
  const data = await social.getCryptoCompareSocial(coinId);
  return c.json(data);
});

socialRoutes.get("/cc/history/:coinId", async (c) => {
  const coinId = Number(c.req.param("coinId"));
  if (isNaN(coinId)) return c.json({ error: "coinId must be a number" }, 400);
  const limit = Math.min(Number(c.req.query("limit")) || 30, 365);
  const data = await social.getCryptoCompareSocialHistory(coinId, 1, limit);
  return c.json(data);
});

// ─── Dashboard ───────────────────────────────────────────────

socialRoutes.get("/dashboard", async (c) => {
  const data = await social.getSocialDashboard();
  return c.json(data);
});
