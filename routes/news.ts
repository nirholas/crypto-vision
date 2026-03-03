/**
 * Crypto Vision — News Routes (native RSS aggregation)
 *
 * Uses sources/crypto-news.ts for local RSS feed aggregation
 * instead of proxying to an external API.
 *
 * GET /api/news             — Latest news
 * GET /api/news/search      — Search news
 * GET /api/news/bitcoin     — Bitcoin news
 * GET /api/news/defi        — DeFi news
 * GET /api/news/breaking    — Breaking news (last 2h)
 * GET /api/news/trending    — Trending topics
 * GET /api/news/sources     — Available sources
 */

import { Hono } from "hono";
import { ApiError } from "../lib/api-error.js";
import { log } from "../lib/logger.js";
import {
  getNews,
  searchNews,
  getBreakingNews,
  getTrending,
  getSources,
} from "../sources/crypto-news.js";

export const newsRoutes = new Hono();

// ─── GET /api/news ───────────────────────────────────────────

newsRoutes.get("/", async (c) => {
  try {
    const limit = Math.min(Number(c.req.query("limit") || 20), 100);
    const source = c.req.query("source") || undefined;
    const category = c.req.query("category") || undefined;
    const page = Number(c.req.query("page") || 1);

    const data = await getNews({ limit, source, category, page });
    return c.json(data);
  } catch (err: any) {
    log.error({ err: err.message }, "Failed to fetch news");
    return ApiError.internal(c, "Failed to fetch news", err.message);
  }
});

// ─── GET /api/news/search ────────────────────────────────────

newsRoutes.get("/search", async (c) => {
  const q = c.req.query("q");
  if (!q) return ApiError.missingParam(c, "q");

  try {
    const limit = Math.min(Number(c.req.query("limit") || 20), 100);
    const data = await searchNews(q, limit);
    return c.json(data);
  } catch (err: any) {
    log.error({ err: err.message }, "Failed to search news");
    return ApiError.internal(c, "Failed to search news", err.message);
  }
});

// ─── GET /api/news/bitcoin ───────────────────────────────────

newsRoutes.get("/bitcoin", async (c) => {
  try {
    const limit = Math.min(Number(c.req.query("limit") || 20), 50);
    const data = await getNews({ limit, category: "bitcoin" });
    return c.json(data);
  } catch (err: any) {
    log.error({ err: err.message }, "Failed to fetch bitcoin news");
    return ApiError.internal(c, "Failed to fetch bitcoin news", err.message);
  }
});

// ─── GET /api/news/defi ──────────────────────────────────────

newsRoutes.get("/defi", async (c) => {
  try {
    const limit = Math.min(Number(c.req.query("limit") || 20), 50);
    const data = await getNews({ limit, category: "defi" });
    return c.json(data);
  } catch (err: any) {
    log.error({ err: err.message }, "Failed to fetch defi news");
    return ApiError.internal(c, "Failed to fetch defi news", err.message);
  }
});

// ─── GET /api/news/breaking ──────────────────────────────────

newsRoutes.get("/breaking", async (c) => {
  try {
    const limit = Math.min(Number(c.req.query("limit") || 10), 50);
    const data = await getBreakingNews(limit);
    return c.json(data);
  } catch (err: any) {
    log.error({ err: err.message }, "Failed to fetch breaking news");
    return ApiError.internal(c, "Failed to fetch breaking news", err.message);
  }
});

// ─── GET /api/news/trending ──────────────────────────────────

newsRoutes.get("/trending", async (c) => {
  try {
    const limit = Math.min(Number(c.req.query("limit") || 10), 30);
    const data = await getTrending(limit);
    return c.json(data);
  } catch (err: any) {
    log.error({ err: err.message }, "Failed to fetch trending topics");
    return ApiError.internal(c, "Failed to fetch trending topics", err.message);
  }
});

// ─── GET /api/news/sources ───────────────────────────────────

newsRoutes.get("/sources", (c) => {
  const data = getSources();
  return c.json(data);
});
