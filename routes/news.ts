/**
 * Crypto Vision — News Routes (proxy to existing cryptocurrency.cv news API)
 *
 * These routes proxy to the existing free-crypto-news deployment
 * while this service is being built up. Eventually the news
 * aggregation will run natively here.
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
import { fetchJSON } from "../lib/fetcher.js";
import { cache } from "../lib/cache.js";

export const newsRoutes = new Hono();

/**
 * Upstream news API base.
 * Currently points to the existing free-crypto-news deployment.
 * Will be replaced with native aggregation.
 */
const NEWS_UPSTREAM = process.env.NEWS_API_URL || "https://cryptocurrency.cv";

async function proxyNews<T>(path: string, ttl: number): Promise<T> {
  return cache.wrap(`news:${path}`, ttl, () =>
    fetchJSON<T>(`${NEWS_UPSTREAM}${path}`)
  );
}

// ─── GET /api/news ───────────────────────────────────────────

newsRoutes.get("/", async (c) => {
  const limit = Math.min(Number(c.req.query("limit") || 20), 100);
  const source = c.req.query("source") || "";
  const category = c.req.query("category") || "";
  const page = c.req.query("page") || "1";

  const params = new URLSearchParams({ limit: String(limit), page });
  if (source) params.set("source", source);
  if (category) params.set("category", category);

  const data = await proxyNews(`/api/news?${params}`, 60);
  return c.json(data);
});

// ─── GET /api/news/search ────────────────────────────────────

newsRoutes.get("/search", async (c) => {
  const q = c.req.query("q");
  if (!q) return c.json({ error: "q parameter required" }, 400);

  const limit = Math.min(Number(c.req.query("limit") || 20), 100);
  const params = new URLSearchParams({
    q,
    limit: String(limit),
  });

  const data = await proxyNews(`/api/search?${params}`, 60);
  return c.json(data);
});

// ─── GET /api/news/bitcoin ───────────────────────────────────

newsRoutes.get("/bitcoin", async (c) => {
  const limit = Math.min(Number(c.req.query("limit") || 20), 50);
  const data = await proxyNews(`/api/bitcoin?limit=${limit}`, 60);
  return c.json(data);
});

// ─── GET /api/news/defi ──────────────────────────────────────

newsRoutes.get("/defi", async (c) => {
  const limit = Math.min(Number(c.req.query("limit") || 20), 50);
  const data = await proxyNews(`/api/defi?limit=${limit}`, 60);
  return c.json(data);
});

// ─── GET /api/news/breaking ──────────────────────────────────

newsRoutes.get("/breaking", async (c) => {
  const limit = Math.min(Number(c.req.query("limit") || 10), 50);
  const data = await proxyNews(`/api/breaking?limit=${limit}`, 30); // 30s cache for breaking
  return c.json(data);
});

// ─── GET /api/news/trending ──────────────────────────────────

newsRoutes.get("/trending", async (c) => {
  const limit = Math.min(Number(c.req.query("limit") || 10), 30);
  const data = await proxyNews(`/api/trending?limit=${limit}`, 120);
  return c.json(data);
});

// ─── GET /api/news/sources ───────────────────────────────────

newsRoutes.get("/sources", async (c) => {
  const data = await proxyNews("/api/sources", 3600); // 1hr cache
  return c.json(data);
});
