/**
 * Crypto Vision — News Routes (native RSS aggregation)
 *
 * Uses sources/crypto-news.ts for local RSS feed aggregation
 * instead of proxying to an external API.
 *
 * GET /api/news             — Latest news
 * GET /api/news/search      — Search news
 * GET /api/news/bitcoin     — Bitcoin news
 * GET /api/news/ethereum    — Ethereum news
 * GET /api/news/defi        — DeFi news
 * GET /api/news/nft         — NFT news
 * GET /api/news/regulation  — Regulation news
 * GET /api/news/altcoins    — Altcoin news
 * GET /api/news/layer2      — Layer 2 news
 * GET /api/news/mining      — Mining news
 * GET /api/news/stablecoins — Stablecoin news
 * GET /api/news/exchange    — Exchange news
 * GET /api/news/breaking    — Breaking news (last 2h)
 * GET /api/news/trending    — Trending topics
 * GET /api/news/sources     — Available sources
 * GET /api/news/category/:cat — Dynamic category news
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

// ─── GET /api/news/ethereum ──────────────────────────────────

newsRoutes.get("/ethereum", async (c) => {
  try {
    const limit = Math.min(Number(c.req.query("limit") || 20), 50);
    const data = await getNews({ limit, category: "ethereum" });
    return c.json(data);
  } catch (err: any) {
    log.error({ err: err.message }, "Failed to fetch ethereum news");
    return ApiError.internal(c, "Failed to fetch ethereum news", err.message);
  }
});

// ─── GET /api/news/nft ───────────────────────────────────────

newsRoutes.get("/nft", async (c) => {
  try {
    const limit = Math.min(Number(c.req.query("limit") || 20), 50);
    const data = await getNews({ limit, category: "nft" });
    return c.json(data);
  } catch (err: any) {
    log.error({ err: err.message }, "Failed to fetch nft news");
    return ApiError.internal(c, "Failed to fetch nft news", err.message);
  }
});

// ─── GET /api/news/regulation ────────────────────────────────

newsRoutes.get("/regulation", async (c) => {
  try {
    const limit = Math.min(Number(c.req.query("limit") || 20), 50);
    const data = await getNews({ limit, category: "regulation" });
    return c.json(data);
  } catch (err: any) {
    log.error({ err: err.message }, "Failed to fetch regulation news");
    return ApiError.internal(c, "Failed to fetch regulation news", err.message);
  }
});

// ─── GET /api/news/altcoins ──────────────────────────────────

newsRoutes.get("/altcoins", async (c) => {
  try {
    const limit = Math.min(Number(c.req.query("limit") || 20), 50);
    const data = await getNews({ limit, category: "altcoin" });
    return c.json(data);
  } catch (err: any) {
    log.error({ err: err.message }, "Failed to fetch altcoin news");
    return ApiError.internal(c, "Failed to fetch altcoin news", err.message);
  }
});

// ─── GET /api/news/layer2 ────────────────────────────────────

newsRoutes.get("/layer2", async (c) => {
  try {
    const limit = Math.min(Number(c.req.query("limit") || 20), 50);
    const data = await getNews({ limit, category: "layer2" });
    return c.json(data);
  } catch (err: any) {
    log.error({ err: err.message }, "Failed to fetch layer2 news");
    return ApiError.internal(c, "Failed to fetch layer2 news", err.message);
  }
});

// ─── GET /api/news/mining ────────────────────────────────────

newsRoutes.get("/mining", async (c) => {
  try {
    const limit = Math.min(Number(c.req.query("limit") || 20), 50);
    const data = await getNews({ limit, category: "mining" });
    return c.json(data);
  } catch (err: any) {
    log.error({ err: err.message }, "Failed to fetch mining news");
    return ApiError.internal(c, "Failed to fetch mining news", err.message);
  }
});

// ─── GET /api/news/stablecoins ───────────────────────────────

newsRoutes.get("/stablecoins", async (c) => {
  try {
    const limit = Math.min(Number(c.req.query("limit") || 20), 50);
    const data = await getNews({ limit, category: "stablecoin" });
    return c.json(data);
  } catch (err: any) {
    log.error({ err: err.message }, "Failed to fetch stablecoin news");
    return ApiError.internal(c, "Failed to fetch stablecoin news", err.message);
  }
});

// ─── GET /api/news/exchange ──────────────────────────────────

newsRoutes.get("/exchange", async (c) => {
  try {
    const limit = Math.min(Number(c.req.query("limit") || 20), 50);
    const data = await getNews({ limit, category: "exchange" });
    return c.json(data);
  } catch (err: any) {
    log.error({ err: err.message }, "Failed to fetch exchange news");
    return ApiError.internal(c, "Failed to fetch exchange news", err.message);
  }
});

// ─── GET /api/news/category/:cat ─────────────────────────────

newsRoutes.get("/category/:cat", async (c) => {
  const category = c.req.param("cat");
  try {
    const limit = Math.min(Number(c.req.query("limit") || 20), 50);
    const data = await getNews({ limit, category });
    return c.json(data);
  } catch (err: any) {
    log.error({ err: err.message, category }, "Failed to fetch category news");
    return ApiError.internal(c, `Failed to fetch ${category} news`, err.message);
  }
});
