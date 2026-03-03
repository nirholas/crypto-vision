/**
 * Integration tests for news routes.
 *
 * Mocks the crypto-news source adapter so no real RSS fetches are made.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";

// ─── Mock sources ────────────────────────────────────────────

vi.mock("../../sources/news-aggregator.js", () => ({
  getNews: vi.fn(),
  searchNews: vi.fn(),
  getBreakingNews: vi.fn(),
  getTrending: vi.fn(),
  getSources: vi.fn(),
  getCategories: vi.fn(),
  getHomepageNews: vi.fn(),
  getNewsByCategory: vi.fn(),
}));

// Suppress logger output during tests
vi.mock("../../lib/logger.js", () => ({
  log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

import { getNews, searchNews, getBreakingNews, getTrending, getSources } from "../../sources/news-aggregator.js";
import { newsRoutes } from "../news.js";

const app = new Hono().route("/api/news", newsRoutes);

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Helpers ─────────────────────────────────────────────────

const mockArticle = (overrides = {}) => ({
  id: "abc123",
  title: "Bitcoin hits new ATH",
  description: "Bitcoin reached a new all-time high today.",
  url: "https://example.com/article",
  source: "coindesk",
  sourceName: "CoinDesk",
  publishedAt: new Date().toISOString(),
  categories: ["bitcoin", "markets"],
  ...overrides,
});

const mockNewsResponse = (overrides = {}) => ({
  articles: [mockArticle()],
  totalCount: 1,
  sources: ["coindesk"],
  timestamp: new Date().toISOString(),
  ...overrides,
});

// ═══════════════════════════════════════════════════════════════
// GET /api/news
// ═══════════════════════════════════════════════════════════════

describe("GET /api/news", () => {
  it("returns news articles", async () => {
    vi.mocked(getNews).mockResolvedValue(mockNewsResponse());

    const res = await app.request("/api/news");
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.articles).toHaveLength(1);
    expect(json.articles[0].title).toBe("Bitcoin hits new ATH");
  });

  it("returns 500 when source throws", async () => {
    vi.mocked(getNews).mockRejectedValue(new Error("RSS timeout"));

    const res = await app.request("/api/news");
    expect(res.status).toBe(500);

    const json = await res.json();
    expect(json.error).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/news/search
// ═══════════════════════════════════════════════════════════════

describe("GET /api/news/search", () => {
  it("returns matching articles", async () => {
    vi.mocked(searchNews).mockResolvedValue(
      mockNewsResponse({ totalCount: 3 }),
    );

    const res = await app.request("/api/news/search?q=bitcoin");
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.articles).toHaveLength(1);
  });

  it("returns 400 when q param is missing", async () => {
    const res = await app.request("/api/news/search");
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.error).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/news/bitcoin
// ═══════════════════════════════════════════════════════════════

describe("GET /api/news/bitcoin", () => {
  it("returns bitcoin news", async () => {
    vi.mocked(getNews).mockResolvedValue(mockNewsResponse());

    const res = await app.request("/api/news/bitcoin");
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.articles).toHaveLength(1);
  });

  it("returns 500 when source throws", async () => {
    vi.mocked(getNews).mockRejectedValue(new Error("fail"));

    const res = await app.request("/api/news/bitcoin");
    expect(res.status).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/news/defi
// ═══════════════════════════════════════════════════════════════

describe("GET /api/news/defi", () => {
  it("returns defi news", async () => {
    vi.mocked(getNews).mockResolvedValue(mockNewsResponse());

    const res = await app.request("/api/news/defi");
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.articles).toHaveLength(1);
  });

  it("returns 500 when source throws", async () => {
    vi.mocked(getNews).mockRejectedValue(new Error("fail"));

    const res = await app.request("/api/news/defi");
    expect(res.status).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/news/breaking
// ═══════════════════════════════════════════════════════════════

describe("GET /api/news/breaking", () => {
  it("returns breaking news", async () => {
    vi.mocked(getBreakingNews).mockResolvedValue(mockNewsResponse());

    const res = await app.request("/api/news/breaking");
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.articles).toHaveLength(1);
  });

  it("returns 500 when source throws", async () => {
    vi.mocked(getBreakingNews).mockRejectedValue(new Error("fail"));

    const res = await app.request("/api/news/breaking");
    expect(res.status).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/news/trending
// ═══════════════════════════════════════════════════════════════

describe("GET /api/news/trending", () => {
  it("returns trending topics", async () => {
    vi.mocked(getTrending).mockResolvedValue({
      topics: [{ topic: "bitcoin", count: 42 }],
      timestamp: new Date().toISOString(),
    });

    const res = await app.request("/api/news/trending");
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.topics[0]).toMatchObject({ topic: "bitcoin", count: 42 });
  });

  it("returns 500 when source throws", async () => {
    vi.mocked(getTrending).mockRejectedValue(new Error("fail"));

    const res = await app.request("/api/news/trending");
    expect(res.status).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/news/sources
// ═══════════════════════════════════════════════════════════════

describe("GET /api/news/sources", () => {
  it("returns available sources", async () => {
    vi.mocked(getSources).mockReturnValue({
      sources: [
        { id: "coindesk", name: "CoinDesk", url: "https://coindesk.com", category: "general", icon: "📰" },
      ],
      count: 1,
    });

    const res = await app.request("/api/news/sources");
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.sources).toHaveLength(1);
    expect(json.sources[0].id).toBe("coindesk");
    expect(json.count).toBe(1);
  });

  it("returns empty list when no sources configured", async () => {
    vi.mocked(getSources).mockReturnValue({ sources: [], count: 0 });

    const res = await app.request("/api/news/sources");
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.sources).toHaveLength(0);
    expect(json.count).toBe(0);
  });
});
