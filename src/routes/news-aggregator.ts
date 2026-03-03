/**
 * Crypto Vision — News Aggregator Routes
 *
 * Aggregated crypto news from 130+ RSS feeds and 10+ JSON APIs.
 * Deduplication, trending scoring, category filtering.
 *
 * GET /api/news-feed/latest         — Latest aggregated news
 * GET /api/news-feed/search         — Search news articles
 * GET /api/news-feed/breaking       — Breaking news
 * GET /api/news-feed/trending       — Trending topics & articles
 * GET /api/news-feed/category/:cat  — News by category
 * GET /api/news-feed/homepage       — Homepage bundle (latest + breaking + trending)
 * GET /api/news-feed/sources        — Available news sources
 * GET /api/news-feed/categories     — Available categories
 */

import { Hono } from "hono";
import * as agg from "../sources/news-aggregator.js";

export const newsFeedRoutes = new Hono();

// ─── GET /latest ─────────────────────────────────────────────

newsFeedRoutes.get("/latest", async (c) => {
  const limit = Math.min(Number(c.req.query("limit") || "50"), 200);
  const source = c.req.query("source") || undefined;
  const category = c.req.query("category") || undefined;
  const page = Number(c.req.query("page") || "1");

  const data = await agg.getNews({ limit, source, category, page });

  return c.json(data);
});

// ─── GET /search ─────────────────────────────────────────────

newsFeedRoutes.get("/search", async (c) => {
  const q = c.req.query("q") || "";
  if (!q.trim()) return c.json({ error: "Query parameter 'q' is required" }, 400);

  const limit = Math.min(Number(c.req.query("limit") || "20"), 100);
  const data = await agg.searchNews(q, limit);

  return c.json(data);
});

// ─── GET /breaking ───────────────────────────────────────────

newsFeedRoutes.get("/breaking", async (c) => {
  const limit = Math.min(Number(c.req.query("limit") || "10"), 50);
  const data = await agg.getBreakingNews(limit);

  return c.json(data);
});

// ─── GET /trending ───────────────────────────────────────────

newsFeedRoutes.get("/trending", async (c) => {
  const limit = Math.min(Number(c.req.query("limit") || "10"), 50);
  const data = await agg.getTrending(limit);

  return c.json(data);
});

// ─── GET /category/:cat ─────────────────────────────────────

newsFeedRoutes.get("/category/:cat", async (c) => {
  const category = c.req.param("cat");
  const limit = Math.min(Number(c.req.query("limit") || "30"), 100);
  const data = await agg.getNewsByCategory(category, limit);

  return c.json(data);
});

// ─── GET /homepage ───────────────────────────────────────────

newsFeedRoutes.get("/homepage", async (c) => {
  const data = await agg.getHomepageNews({
    latestLimit: 20,
    breakingLimit: 5,
    trendingLimit: 10,
  });

  return c.json(data);
});

// ─── GET /sources ────────────────────────────────────────────

newsFeedRoutes.get("/sources", (c) => {
  const data = agg.getSources();

  return c.json(data);
});

// ─── GET /categories ─────────────────────────────────────────

newsFeedRoutes.get("/categories", (c) => {
  const data = agg.getCategories();

  return c.json(data);
});
