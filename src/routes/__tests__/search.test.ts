/**
 * Integration tests for semantic search routes.
 *
 * Mocks the search engine, RAG pipeline, and analytics so
 * no real API calls are made. Tests HTTP layer: validation,
 * response format, status codes, and query parameter handling.
 */

import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Mock dependencies BEFORE route import ───────────────────

vi.mock("../../lib/search.js", () => ({
  smartSearch: vi.fn(),
}));

vi.mock("../../lib/rag.js", () => ({
  ragQuery: vi.fn(),
}));

vi.mock("../../lib/queue.js", () => ({
  aiQueue: {
    execute: vi.fn((fn: () => Promise<unknown>) => fn()),
  },
}));

vi.mock("../../lib/cache.js", () => ({
  cache: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("../../lib/search-analytics.js", () => ({
  logSearch: vi.fn(),
  logSearchClick: vi.fn(),
}));

vi.mock("../../lib/logger.js", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { cache } from "../../lib/cache.js";
import { ragQuery } from "../../lib/rag.js";
import { logSearch } from "../../lib/search-analytics.js";
import { smartSearch } from "../../lib/search.js";
import { searchRoutes } from "../search.js";

// ─── App Setup ───────────────────────────────────────────────

const app = new Hono().route("/api/search", searchRoutes);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(cache.get).mockResolvedValue(null);
});

// ─── Test Data ───────────────────────────────────────────────

function mockSmartSearchResult(overrides = {}) {
  return {
    query: "bitcoin",
    intent: "price_lookup" as const,
    results: [
      {
        id: "coin:bitcoin",
        type: "coin" as const,
        title: "Bitcoin (BTC)",
        description: "Market cap rank: #1",
        relevanceScore: 0.999,
        data: { coinId: "bitcoin", symbol: "btc" },
      },
    ],
    suggestions: ["bitcoin price chart", "bitcoin 7d performance"],
    totalResults: 1,
    searchTimeMs: 42,
    ...overrides,
  };
}

function mockRagResult(overrides = {}) {
  return {
    answer: "Bitcoin is a decentralized cryptocurrency created in 2009.",
    sources: [
      { id: "src-1", content: "Bitcoin whitepaper...", score: 0.9, category: "concept" },
    ],
    model: "gemini-pro",
    ragUsed: true,
    retrievalCount: 3,
    contextLength: 2000,
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════
// GET /api/search/smart
// ═══════════════════════════════════════════════════════════════

describe("GET /api/search/smart", () => {
  it("returns search results with metadata", async () => {
    vi.mocked(smartSearch).mockResolvedValue(mockSmartSearchResult());

    const res = await app.request("/api/search/smart?q=bitcoin");
    expect(res.status).toBe(200);

    const json = (await res.json()) as Record<string, any>;
    expect(json.data).toHaveLength(1);
    expect(json.data[0].id).toBe("coin:bitcoin");
    expect(json.data[0].type).toBe("coin");
    expect(json.meta.query).toBe("bitcoin");
    expect(json.meta.intent).toBe("price_lookup");
    expect(json.meta.totalResults).toBe(1);
    expect(json.meta.searchTimeMs).toBe(42);
    expect(json.meta.suggestions).toHaveLength(2);
    expect(json.timestamp).toBeDefined();
  });

  it("rejects queries shorter than 2 characters", async () => {
    const res = await app.request("/api/search/smart?q=a");
    expect(res.status).toBe(400);

    const json = (await res.json()) as Record<string, any>;
    expect(json.error).toContain("at least 2");
    expect(smartSearch).not.toHaveBeenCalled();
  });

  it("rejects missing query parameter", async () => {
    const res = await app.request("/api/search/smart");
    expect(res.status).toBe(400);
  });

  it("passes types filter to smartSearch", async () => {
    vi.mocked(smartSearch).mockResolvedValue(mockSmartSearchResult());

    await app.request("/api/search/smart?q=bitcoin&types=coin,protocol");

    expect(smartSearch).toHaveBeenCalledWith("bitcoin", expect.objectContaining({
      types: ["coin", "protocol"],
    }));
  });

  it("caps limit at 100", async () => {
    vi.mocked(smartSearch).mockResolvedValue(mockSmartSearchResult());

    await app.request("/api/search/smart?q=bitcoin&limit=999");

    expect(smartSearch).toHaveBeenCalledWith("bitcoin", expect.objectContaining({
      limit: 100,
    }));
  });

  it("defaults limit to 20", async () => {
    vi.mocked(smartSearch).mockResolvedValue(mockSmartSearchResult());

    await app.request("/api/search/smart?q=bitcoin");

    expect(smartSearch).toHaveBeenCalledWith("bitcoin", expect.objectContaining({
      limit: 20,
    }));
  });

  it("logs search analytics (fire-and-forget)", async () => {
    vi.mocked(smartSearch).mockResolvedValue(mockSmartSearchResult());

    await app.request("/api/search/smart?q=bitcoin");

    expect(logSearch).toHaveBeenCalledWith("bitcoin", "price_lookup", 1, 42);
  });

  it("trims whitespace from query", async () => {
    vi.mocked(smartSearch).mockResolvedValue(mockSmartSearchResult());

    await app.request("/api/search/smart?q=%20bitcoin%20");

    expect(smartSearch).toHaveBeenCalledWith("bitcoin", expect.any(Object));
  });

  it("passes timeRange and chain filters", async () => {
    vi.mocked(smartSearch).mockResolvedValue(mockSmartSearchResult());

    await app.request("/api/search/smart?q=bitcoin&timeRange=7d&chain=Ethereum");

    expect(smartSearch).toHaveBeenCalledWith("bitcoin", expect.objectContaining({
      timeRange: "7d",
      chain: "Ethereum",
    }));
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/search/nlq
// ═══════════════════════════════════════════════════════════════

describe("GET /api/search/nlq", () => {
  it("returns AI answer with sources and search results", async () => {
    vi.mocked(smartSearch).mockResolvedValue(mockSmartSearchResult());
    vi.mocked(ragQuery).mockResolvedValue(mockRagResult());

    const res = await app.request("/api/search/nlq?q=what%20is%20bitcoin");
    expect(res.status).toBe(200);

    const json = (await res.json()) as Record<string, any>;
    expect(json.data.answer).toContain("Bitcoin");
    expect(json.data.sources).toHaveLength(1);
    expect(json.data.searchResults).toHaveLength(1);
    expect(json.data.intent).toBe("price_lookup");
    expect(json.model).toBe("gemini-pro");
    expect(json.ragUsed).toBe(true);
    expect(json.suggestions).toHaveLength(2);
    expect(json.timestamp).toBeDefined();
  });

  it("rejects queries shorter than 5 characters", async () => {
    const res = await app.request("/api/search/nlq?q=hi");
    expect(res.status).toBe(400);

    const json = (await res.json()) as Record<string, any>;
    expect(json.error).toContain("at least 5");
  });

  it("rejects missing query parameter", async () => {
    const res = await app.request("/api/search/nlq");
    expect(res.status).toBe(400);
  });

  it("calls RAG with correct parameters", async () => {
    vi.mocked(smartSearch).mockResolvedValue(mockSmartSearchResult());
    vi.mocked(ragQuery).mockResolvedValue(mockRagResult());

    await app.request("/api/search/nlq?q=what%20is%20bitcoin");

    expect(ragQuery).toHaveBeenCalledWith("what is bitcoin", {
      topK: 5,
      maxContextLength: 6000,
      temperature: 0.3,
    });
  });

  it("limits search results to 5 in NLQ response", async () => {
    vi.mocked(smartSearch).mockResolvedValue(mockSmartSearchResult({
      results: Array.from({ length: 10 }, (_, i) => ({
        id: `coin:${i}`,
        type: "coin",
        title: `Coin ${i}`,
        description: "",
        relevanceScore: 1 - i / 10,
        data: {},
      })),
      totalResults: 10,
    }));
    vi.mocked(ragQuery).mockResolvedValue(mockRagResult());

    const res = await app.request("/api/search/nlq?q=what%20is%20bitcoin");
    const json = (await res.json()) as Record<string, any>;

    expect(json.data.searchResults).toHaveLength(5);
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/search/suggest
// ═══════════════════════════════════════════════════════════════

describe("GET /api/search/suggest", () => {
  it("returns autocomplete suggestions", async () => {
    vi.mocked(smartSearch).mockResolvedValue(mockSmartSearchResult({
      results: [
        {
          id: "coin:bitcoin",
          type: "coin",
          title: "Bitcoin (BTC)",
          description: "",
          relevanceScore: 0.999,
          data: { symbol: "btc" },
        },
      ],
    }));

    const res = await app.request("/api/search/suggest?q=bit");
    expect(res.status).toBe(200);

    const json = (await res.json()) as Record<string, any>;
    expect(json.data).toBeInstanceOf(Array);
    expect(json.data.length).toBeGreaterThan(0);

    // Should have coin match
    const coinSuggestion = json.data.find((s: { type: string }) => s.type === "coin");
    expect(coinSuggestion).toBeDefined();
    expect(coinSuggestion.text).toContain("Bitcoin");

    // Should have text completions
    const textSuggestions = json.data.filter((s: { type: string }) => s.type === "suggestion");
    expect(textSuggestions.length).toBeGreaterThan(0);
  });

  it("returns empty array for empty query", async () => {
    const res = await app.request("/api/search/suggest?q=");
    expect(res.status).toBe(200);

    const json = (await res.json()) as Record<string, any>;
    expect(json.data).toEqual([]);
  });

  it("returns empty array for missing query", async () => {
    const res = await app.request("/api/search/suggest");
    expect(res.status).toBe(200);

    const json = (await res.json()) as Record<string, any>;
    expect(json.data).toEqual([]);
  });

  it("returns cached suggestions on cache hit", async () => {
    const cachedSuggestions = [
      { text: "Bitcoin (BTC)", type: "coin", id: "coin:bitcoin" },
    ];
    vi.mocked(cache.get).mockResolvedValue(JSON.stringify(cachedSuggestions));

    const res = await app.request("/api/search/suggest?q=bit");
    const json = (await res.json()) as Record<string, any>;

    expect(json.data).toEqual(cachedSuggestions);
    expect(smartSearch).not.toHaveBeenCalled();
  });

  it("caches suggestions for 5 minutes", async () => {
    vi.mocked(smartSearch).mockResolvedValue(mockSmartSearchResult());

    await app.request("/api/search/suggest?q=bit");

    expect(cache.set).toHaveBeenCalledWith(
      expect.stringContaining("suggest:"),
      expect.any(String),
      300,
    );
  });

  it("searches only coins for suggestions", async () => {
    vi.mocked(smartSearch).mockResolvedValue(mockSmartSearchResult());

    await app.request("/api/search/suggest?q=bitcoin");

    expect(smartSearch).toHaveBeenCalledWith("bitcoin", expect.objectContaining({
      types: ["coin"],
      limit: 5,
    }));
  });
});
