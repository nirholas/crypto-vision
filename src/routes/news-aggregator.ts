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
import { ApiError, extractErrorMessage } from "../lib/api-error.js";
import { validateQueries } from "../lib/validation.js";
import {
  NewsAggLatestQuerySchema,
  NewsAggSearchQuerySchema,
  NewsAggBreakingQuerySchema,
  NewsAggTrendingQuerySchema,
  NewsAggCategoryQuerySchema,
} from "../lib/route-schemas.js";

export const newsFeedRoutes = new Hono();

// ─── GET /latest ─────────────────────────────────────────────

/**
 * @openapi
 * /api/news-feed/latest:
 *   get:
 *     summary: Latest aggregated news
 *     tags: [News Feed]
 *     parameters:
 *       - name: limit
 *         in: query
 *         schema: { type: integer, default: 50, maximum: 200 }
 *       - name: source
 *         in: query
 *         schema: { type: string }
 *       - name: category
 *         in: query
 *         schema: { type: string }
 *       - name: page
 *         in: query
 *         schema: { type: integer, default: 1 }
 *     responses:
 *       200:
 *         description: Paginated list of latest news articles
 */
newsFeedRoutes.get("/latest", async (c) => {
  const q = validateQueries(c, NewsAggLatestQuerySchema);
  if (!q.success) return q.error;
  const { limit, source, category, page } = q.data;

  try {
    const articles = await agg.getNews({ limit, source, category, page });
    return c.json({ data: articles, timestamp: new Date().toISOString() });
  } catch (err) {
    return ApiError.upstream(c, "news-aggregator", extractErrorMessage(err));
  }
});

// ─── GET /search ─────────────────────────────────────────────

/**
 * @openapi
 * /api/news-feed/search:
 *   get:
 *     summary: Search news articles
 *     tags: [News Feed]
 *     parameters:
 *       - name: q
 *         in: query
 *         required: true
 *         schema: { type: string }
 *       - name: limit
 *         in: query
 *         schema: { type: integer, default: 20, maximum: 100 }
 *     responses:
 *       200:
 *         description: Search results matching the query
 */
newsFeedRoutes.get("/search", async (c) => {
  const q = validateQueries(c, NewsAggSearchQuerySchema);
  if (!q.success) return q.error;
  const { q: query, limit } = q.data;

  try {
    const results = await agg.searchNews(query, limit);
    return c.json({ data: results, timestamp: new Date().toISOString() });
  } catch (err) {
    return ApiError.upstream(c, "news-aggregator", extractErrorMessage(err));
  }
});

// ─── GET /breaking ───────────────────────────────────────────

/**
 * @openapi
 * /api/news-feed/breaking:
 *   get:
 *     summary: Breaking news
 *     tags: [News Feed]
 *     parameters:
 *       - name: limit
 *         in: query
 *         schema: { type: integer, default: 10, maximum: 50 }
 *     responses:
 *       200:
 *         description: List of breaking news articles
 */
newsFeedRoutes.get("/breaking", async (c) => {
  const q = validateQueries(c, NewsAggBreakingQuerySchema);
  if (!q.success) return q.error;
  const { limit } = q.data;

  try {
    const articles = await agg.getBreakingNews(limit);
    return c.json({ data: articles, timestamp: new Date().toISOString() });
  } catch (err) {
    return ApiError.upstream(c, "news-aggregator", extractErrorMessage(err));
  }
});

// ─── GET /trending ───────────────────────────────────────────

/**
 * @openapi
 * /api/news-feed/trending:
 *   get:
 *     summary: Trending topics and articles
 *     tags: [News Feed]
 *     parameters:
 *       - name: limit
 *         in: query
 *         schema: { type: integer, default: 10, maximum: 50 }
 *     responses:
 *       200:
 *         description: Trending topics and articles
 */
newsFeedRoutes.get("/trending", async (c) => {
  const q = validateQueries(c, NewsAggTrendingQuerySchema);
  if (!q.success) return q.error;
  const { limit } = q.data;

  try {
    const articles = await agg.getTrending(limit);
    return c.json({ data: articles, timestamp: new Date().toISOString() });
  } catch (err) {
    return ApiError.upstream(c, "news-aggregator", extractErrorMessage(err));
  }
});

// ─── GET /category/:cat ─────────────────────────────────────

/**
 * @openapi
 * /api/news-feed/category/{cat}:
 *   get:
 *     summary: News filtered by category
 *     tags: [News Feed]
 *     parameters:
 *       - name: cat
 *         in: path
 *         required: true
 *         schema: { type: string }
 *       - name: limit
 *         in: query
 *         schema: { type: integer, default: 30, maximum: 100 }
 *     responses:
 *       200:
 *         description: News articles in the specified category
 */
newsFeedRoutes.get("/category/:cat", async (c) => {
  const category = c.req.param("cat");
  if (!category) return ApiError.missingParam(c, "cat");

  const q = validateQueries(c, NewsAggCategoryQuerySchema);
  if (!q.success) return q.error;
  const { limit } = q.data;

  try {
    const articles = await agg.getNewsByCategory(category, limit);
    return c.json({ data: articles, timestamp: new Date().toISOString() });
  } catch (err) {
    return ApiError.upstream(c, "news-aggregator", extractErrorMessage(err));
  }
});

// ─── GET /homepage ───────────────────────────────────────────

/**
 * @openapi
 * /api/news-feed/homepage:
 *   get:
 *     summary: Homepage news bundle (latest + breaking + trending)
 *     tags: [News Feed]
 *     responses:
 *       200:
 *         description: Bundled homepage news payload
 */
newsFeedRoutes.get("/homepage", async (c) => {
  try {
    const bundle = await agg.getHomepageNews({
      latestLimit: 20,
      breakingLimit: 5,
      trendingLimit: 10,
    });
    return c.json({ data: bundle, timestamp: new Date().toISOString() });
  } catch (err) {
    return ApiError.internal(c, "Failed to build homepage news bundle", extractErrorMessage(err));
  }
});

// ─── GET /sources ────────────────────────────────────────────

/**
 * @openapi
 * /api/news-feed/sources:
 *   get:
 *     summary: Available news sources
 *     tags: [News Feed]
 *     responses:
 *       200:
 *         description: List of configured news sources
 */
newsFeedRoutes.get("/sources", (c) => {
  try {
    const sources = agg.getSources();
    return c.json({ data: sources, timestamp: new Date().toISOString() });
  } catch (err) {
    return ApiError.internal(c, "Failed to retrieve news sources", extractErrorMessage(err));
  }
});

// ─── GET /categories ─────────────────────────────────────────

/**
 * @openapi
 * /api/news-feed/categories:
 *   get:
 *     summary: Available news categories
 *     tags: [News Feed]
 *     responses:
 *       200:
 *         description: List of available news categories
 */
newsFeedRoutes.get("/categories", (c) => {
  try {
    const categories = agg.getCategories();
    return c.json({ data: categories, timestamp: new Date().toISOString() });
  } catch (err) {
    return ApiError.internal(c, "Failed to retrieve news categories", extractErrorMessage(err));
  }
});
