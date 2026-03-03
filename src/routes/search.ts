/**
 * Crypto Vision — Search API Routes
 *
 * Unified search endpoints that combine semantic search, AI-powered NLQ,
 * and autocomplete suggestions into a single coherent API surface.
 *
 * Routes:
 *  GET /api/search/smart    — Unified semantic search across all data
 *  GET /api/search/nlq      — Natural language query with AI-generated answer
 *  GET /api/search/suggest   — Fast autocomplete suggestions
 *
 * All routes leverage the unified search engine (src/lib/search.ts),
 * the RAG pipeline (src/lib/rag.ts), and the request queue for
 * bounded concurrency on AI calls.
 */

import { Hono } from "hono";

import { smartSearch, type SearchResult } from "../lib/search.js";
import { ragQuery } from "../lib/rag.js";
import { aiQueue } from "../lib/queue.js";
import { cache } from "../lib/cache.js";
import { logSearch } from "../lib/search-analytics.js";

export const searchRoutes = new Hono();

// ─── GET /smart — Unified Semantic Search ────────────────────

searchRoutes.get("/smart", async (c) => {
  const q = c.req.query("q")?.trim();
  if (!q || q.length < 2) {
    return c.json({ error: "Query must be at least 2 characters", code: "INVALID_QUERY" }, 400);
  }
  if (q.length > 500) {
    return c.json({ error: "Query must be 500 characters or fewer", code: "QUERY_TOO_LONG" }, 400);
  }

  const typesParam = c.req.query("types");
  const types = typesParam
    ? (typesParam.split(",").filter(Boolean) as SearchResult["type"][])
    : undefined;
  const limit = Math.min(Math.max(parseInt(c.req.query("limit") || "20", 10) || 20, 1), 100);
  const timeRange = c.req.query("timeRange") as "1h" | "24h" | "7d" | "30d" | "all" | undefined;
  const chain = c.req.query("chain") || undefined;
  const minRelevance = parseFloat(c.req.query("minRelevance") || "0.1") || 0.1;

  const result = await smartSearch(q, { types, limit, timeRange, chain, minRelevance });

  // Fire-and-forget analytics
  logSearch(q, result.intent, result.totalResults, result.searchTimeMs);

  return c.json({
    data: result.results,
    meta: {
      query: result.query,
      intent: result.intent,
      totalResults: result.totalResults,
      searchTimeMs: result.searchTimeMs,
      suggestions: result.suggestions,
    },
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /nlq — Natural Language Query with AI Answer ────────

searchRoutes.get("/nlq", async (c) => {
  const q = c.req.query("q")?.trim();
  if (!q || q.length < 5) {
    return c.json({ error: "Query must be at least 5 characters", code: "INVALID_QUERY" }, 400);
  }
  if (q.length > 1000) {
    return c.json({ error: "Query must be 1000 characters or fewer", code: "QUERY_TOO_LONG" }, 400);
  }

  // 1. Semantic search for context + suggestions
  const searchResult = await smartSearch(q, { limit: 10 });

  // 2. RAG-enhanced AI answer via the bounded concurrency queue
  const ragResult = await aiQueue.execute(() =>
    ragQuery(q, {
      topK: 5,
      maxContextLength: 6000,
      temperature: 0.3,
    }),
  );

  // Fire-and-forget analytics
  logSearch(q, searchResult.intent, searchResult.totalResults, searchResult.searchTimeMs);

  return c.json({
    data: {
      answer: ragResult.answer,
      sources: ragResult.sources,
      searchResults: searchResult.results.slice(0, 5),
      intent: searchResult.intent,
    },
    model: ragResult.model,
    ragUsed: ragResult.ragUsed,
    suggestions: searchResult.suggestions,
    searchTimeMs: searchResult.searchTimeMs,
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /suggest — Fast Autocomplete Suggestions ────────────

searchRoutes.get("/suggest", async (c) => {
  const q = c.req.query("q")?.trim();
  if (!q || q.length < 1) {
    return c.json({ data: [] });
  }

  // Truncate query for cache key sanity
  const normalizedQ = q.toLowerCase().slice(0, 30);
  const cacheKey = `suggest:${normalizedQ}`;

  // Check cache (5-minute TTL)
  const cached = await cache.get<string>(cacheKey);
  if (cached) {
    try {
      return c.json({ data: JSON.parse(cached) });
    } catch {
      // Invalid cache — regenerate
    }
  }

  // Quick coin name search (fast, no AI)
  const coins = await smartSearch(q, { types: ["coin"], limit: 5 });

  const suggestions = coins.results.map((r) => ({
    text: r.title,
    type: r.type,
    id: r.id,
  }));

  // Add common query completions
  const completions = [
    `${q} price`,
    `${q} news`,
    `${q} analysis`,
    `${q} yield`,
    `${q} TVL`,
  ]
    .filter((s) => s.length < 50 && s.length > q.length + 2)
    .slice(0, 3);

  const result = [
    ...suggestions,
    ...completions.map((text) => ({
      text,
      type: "suggestion" as const,
      id: `suggest:${text}`,
    })),
  ];

  await cache.set(cacheKey, JSON.stringify(result), 300).catch(() => {});
  return c.json({ data: result });
});
