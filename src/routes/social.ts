/**
 * Crypto Vision — Social Metrics Routes
 *
 * Social sentiment, community data, and developer metrics.
 *
 * === New Social Signal Endpoints ===
 * GET /api/social/stats/:symbol            — Aggregated social stats for a coin
 * GET /api/social/trending                 — Trending coins on social media
 * GET /api/social/volume/:symbol           — Social volume (mention count) over time
 * GET /api/social/sentiment/:symbol        — Social sentiment analysis
 * GET /api/social/influencers/:symbol      — Top social influencers for a coin
 * GET /api/social/reddit/:symbol           — Reddit activity metrics
 * GET /api/social/github/:symbol           — GitHub development activity
 * GET /api/social/correlation              — Social vs price correlation analysis
 *
 * === Existing Endpoints ===
 * GET /api/social/profile/:id              — Social profile for a coin
 * GET /api/social/profiles                 — Batch social profiles (?ids=bitcoin,ethereum)
 * GET /api/social/fear-greed               — Fear & Greed Index
 * GET /api/social/fear-greed/history       — Fear & Greed history
 * GET /api/social/lunar/:symbol            — LunarCrush metrics for a coin
 * GET /api/social/lunar/top                — Top coins by social volume
 * GET /api/social/lunar/feed/:symbol       — LunarCrush social feed
 * GET /api/social/cc/:coinId               — CryptoCompare social stats
 * GET /api/social/cc/history/:coinId       — CryptoCompare social history
 * GET /api/social/dashboard                — Aggregate social dashboard
 *
 * @copyright 2024-2026 nirholas. All rights reserved.
 */

import { Hono } from "hono";
import * as social from "../sources/social.js";
import * as cryptocompare from "../sources/cryptocompare.js";
import { ApiError } from "../lib/api-error.js";

export const socialRoutes = new Hono();

// ─── New Social Signal Endpoints ─────────────────────────────

socialRoutes.get("/stats/:symbol", async (c) => {
  const symbol = c.req.param("symbol").toUpperCase();
  const ccCoinId = await cryptocompare.resolveCoinId(symbol);

  const stats = await social.getAggregatedSocialStats(
    symbol,
    ccCoinId ?? undefined,
  );

  return c.json({
    data: stats,
    timestamp: new Date().toISOString(),
  });
});

socialRoutes.get("/trending", async (c) => {
  const limit = Math.min(Number(c.req.query("limit") || 20), 50);
  const coins = await social.getSocialTrending();

  return c.json({
    data: coins.slice(0, limit),
    count: Math.min(coins.length, limit),
    timestamp: new Date().toISOString(),
  });
});

socialRoutes.get("/volume/:symbol", async (c) => {
  const symbol = c.req.param("symbol").toUpperCase();
  const days = Math.min(Number(c.req.query("days") || 30), 90);

  const ccCoinId = await cryptocompare.resolveCoinId(symbol);
  if (!ccCoinId) {
    return ApiError.badRequest(c, `Unable to resolve CryptoCompare coin ID for symbol: ${symbol}`);
  }

  const volume = await social.getSocialVolume(ccCoinId, days);

  return c.json({
    data: {
      symbol,
      period: `${days}d`,
      dataPoints: volume,
      total: volume.length,
    },
    timestamp: new Date().toISOString(),
  });
});

socialRoutes.get("/sentiment/:symbol", async (c) => {
  const symbol = c.req.param("symbol").toUpperCase();
  const ccCoinId = await cryptocompare.resolveCoinId(symbol);

  const sentiment = await social.getSocialSentiment(
    symbol,
    ccCoinId ?? undefined,
  );

  return c.json({
    data: sentiment,
    timestamp: new Date().toISOString(),
  });
});

socialRoutes.get("/influencers/:symbol", async (c) => {
  const symbol = c.req.param("symbol").toUpperCase();
  const limit = Math.min(Number(c.req.query("limit") || 20), 50);

  const influencers = await social.getSocialInfluencers(symbol, limit);

  return c.json({
    data: {
      symbol,
      influencers,
      count: influencers.length,
    },
    timestamp: new Date().toISOString(),
  });
});

socialRoutes.get("/reddit/:symbol", async (c) => {
  const symbol = c.req.param("symbol").toUpperCase();
  const ccCoinId = await cryptocompare.resolveCoinId(symbol);

  const reddit = await social.getRedditActivity(
    symbol,
    ccCoinId ?? undefined,
  );

  return c.json({
    data: reddit,
    timestamp: new Date().toISOString(),
  });
});

socialRoutes.get("/github/:symbol", async (c) => {
  const symbol = c.req.param("symbol").toUpperCase();
  const ccCoinId = await cryptocompare.resolveCoinId(symbol);

  const github = await social.getGitHubActivity(
    symbol,
    ccCoinId ?? undefined,
  );

  return c.json({
    data: github,
    timestamp: new Date().toISOString(),
  });
});

socialRoutes.get("/correlation", async (c) => {
  const symbol = c.req.query("symbol");
  if (!symbol) return ApiError.missingParam(c, "symbol");

  const days = Math.min(Number(c.req.query("days") || 30), 90);
  const upperSymbol = symbol.toUpperCase();

  const ccCoinId = await cryptocompare.resolveCoinId(upperSymbol);
  if (!ccCoinId) {
    return ApiError.badRequest(c, `Unable to resolve CryptoCompare coin ID for symbol: ${upperSymbol}`);
  }

  const correlation = await social.computeSocialPriceCorrelation(
    upperSymbol,
    ccCoinId,
    days,
  );

  return c.json({
    data: correlation,
    timestamp: new Date().toISOString(),
  });
});

// ─── CoinGecko Social Profiles ──────────────────────────────

socialRoutes.get("/profile/:id", async (c) => {
  const id = c.req.param("id");
  const data = await social.getSocialProfile(id);
  return c.json(data);
});

socialRoutes.get("/profiles", async (c) => {
  const idsParam = c.req.query("ids") || "";
  if (!idsParam) return ApiError.missingParam(c, "ids");
  const ids = idsParam.split(",").map((s) => s.trim()).filter(Boolean);
  if (ids.length > 20) return ApiError.badRequest(c, "Maximum 20 coins per request");
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

socialRoutes.get("/lunar/:symbol", async (c) => {
  const symbol = c.req.param("symbol").toUpperCase();
  const data = await social.getLunarMetrics(symbol);
  return c.json(data);
});

// ─── CryptoCompare ───────────────────────────────────────────

socialRoutes.get("/cc/history/:coinId", async (c) => {
  const coinId = Number(c.req.param("coinId"));
  if (isNaN(coinId)) return ApiError.badRequest(c, "coinId must be a number");
  const limit = Math.min(Number(c.req.query("limit")) || 30, 365);
  const data = await social.getCryptoCompareSocialHistory(coinId, 1, limit);
  return c.json(data);
});

socialRoutes.get("/cc/:coinId", async (c) => {
  const coinId = Number(c.req.param("coinId"));
  if (isNaN(coinId)) return ApiError.badRequest(c, "coinId must be a number");
  const data = await social.getCryptoCompareSocial(coinId);
  return c.json(data);
});

// ─── Dashboard ───────────────────────────────────────────────

socialRoutes.get("/dashboard", async (c) => {
  const data = await social.getSocialDashboard();
  return c.json(data);
});
