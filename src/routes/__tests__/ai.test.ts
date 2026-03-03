/**
 * Integration tests for AI routes.
 *
 * Mocks all source adapters + AI/cache/queue so no real API calls are made.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";

// ─── Mock sources & libs ─────────────────────────────────────

vi.mock("../../sources/coingecko.js", () => ({
  getCoinDetail: vi.fn(),
  getTrending: vi.fn(),
  getGlobal: vi.fn(),
  getCoins: vi.fn(),
}));

vi.mock("../../sources/alternative.js", () => ({
  getFearGreedIndex: vi.fn(),
}));

vi.mock("../../sources/defillama.js", () => ({
  getYieldPools: vi.fn(),
}));

vi.mock("../../lib/cache.js", () => ({
  cache: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    wrap: vi.fn(),
  },
}));

vi.mock("../../lib/ai.js", () => ({
  aiComplete: vi.fn(),
}));

vi.mock("../../lib/queue.js", () => ({
  aiQueue: {
    execute: vi.fn((fn: () => any) => fn()),
  },
}));

vi.mock("../../lib/logger.js", () => ({
  log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

import * as cg from "../../sources/coingecko.js";
import * as alt from "../../sources/alternative.js";
import * as llama from "../../sources/defillama.js";
import { cache } from "../../lib/cache.js";
import { aiComplete } from "../../lib/ai.js";
import { aiRoutes } from "../ai.js";

const app = new Hono().route("/api/ai", aiRoutes);

beforeEach(() => {
  vi.clearAllMocks();
  // Default: cache miss
  vi.mocked(cache.get).mockResolvedValue(null);
});

// ─── Shared mock data ────────────────────────────────────────

const mockCoinDetail = {
  id: "bitcoin",
  symbol: "btc",
  name: "Bitcoin",
  description: { en: "Decentralized cryptocurrency" },
  categories: ["Cryptocurrency"],
  platforms: {},
  links: { homepage: ["https://bitcoin.org"], blockchain_site: [], repos_url: { github: [] } },
  market_data: {
    current_price: { usd: 60000 },
    market_cap: { usd: 1.2e12 },
    total_volume: { usd: 30e9 },
    price_change_percentage_24h: 2.5,
    price_change_percentage_7d: 5.1,
    price_change_percentage_30d: 10.2,
    circulating_supply: 19e6,
    total_supply: 21e6,
    max_supply: 21e6,
  },
};

const mockTrending = {
  coins: [
    {
      item: {
        id: "pepe", coin_id: 999, name: "Pepe", symbol: "PEPE",
        market_cap_rank: 50, thumb: "", price_btc: 0.00000001, score: 0,
      },
    },
  ],
};

const mockFearGreed = {
  name: "Fear and Greed Index",
  data: [{ value: "72", value_classification: "Greed", timestamp: "1700000000" }],
};

const mockGlobal = {
  data: {
    active_cryptocurrencies: 10000,
    markets: 800,
    total_market_cap: { usd: 2.5e12 },
    total_volume: { usd: 100e9 },
    market_cap_percentage: { btc: 52.1, eth: 17.3 },
    market_cap_change_percentage_24h_usd: 1.5,
  },
};

const mockCoins = [
  {
    id: "bitcoin", symbol: "btc", name: "Bitcoin", image: "btc.png",
    current_price: 60000, market_cap: 1.2e12, market_cap_rank: 1,
    total_volume: 30e9, price_change_percentage_24h: 2.5,
    circulating_supply: 19e6, total_supply: 21e6, max_supply: 21e6,
    ath: 69000, ath_change_percentage: -13,
  },
];

// ═══════════════════════════════════════════════════════════════
// GET /api/ai/sentiment/:coin
// ═══════════════════════════════════════════════════════════════

describe("GET /api/ai/sentiment/:coin", () => {
  it("returns AI sentiment analysis for a valid coin", async () => {
    vi.mocked(cg.getCoinDetail).mockResolvedValue(mockCoinDetail as any);
    vi.mocked(cg.getTrending).mockResolvedValue(mockTrending as any);
    vi.mocked(alt.getFearGreedIndex).mockResolvedValue(mockFearGreed);

    const sentimentJson = JSON.stringify({
      sentiment: "bullish",
      confidence: 75,
      summary: "Bitcoin is showing strong upward momentum.",
      keyFactors: ["Rising volume", "Positive momentum"],
      outlook: "Bullish in the short term",
    });

    vi.mocked(aiComplete).mockResolvedValue({
      text: sentimentJson,
      model: "test-model",
      tokensUsed: 150,
    });

    const res = await app.request("/api/ai/sentiment/bitcoin");
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.data.sentiment).toBe("bullish");
    expect(json.data.confidence).toBe(75);
    expect(json.model).toBe("test-model");
    expect(json).toHaveProperty("timestamp");
  });

  it("returns cached result when available", async () => {
    // Sources are still called before cache check, so mock them
    vi.mocked(cg.getCoinDetail).mockResolvedValue(mockCoinDetail as any);
    vi.mocked(cg.getTrending).mockResolvedValue(mockTrending as any);
    vi.mocked(alt.getFearGreedIndex).mockResolvedValue(mockFearGreed);

    const cached = JSON.stringify({
      sentiment: "neutral",
      confidence: 50,
      summary: "Cached analysis",
      keyFactors: [],
      outlook: "Flat",
    });
    vi.mocked(cache.get).mockResolvedValue(cached);

    const res = await app.request("/api/ai/sentiment/bitcoin");
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.cached).toBe(true);
    expect(json.data.sentiment).toBe("neutral");
    // AI should not be called
    expect(aiComplete).not.toHaveBeenCalled();
  });

  it("returns 404 when coin is not found", async () => {
    vi.mocked(cg.getCoinDetail).mockResolvedValue(null as any);
    vi.mocked(cg.getTrending).mockResolvedValue(mockTrending as any);
    vi.mocked(alt.getFearGreedIndex).mockResolvedValue(mockFearGreed);

    const res = await app.request("/api/ai/sentiment/fakecoin");
    expect(res.status).toBe(404);

    const json = await res.json();
    expect(json.error).toContain("not found");
    expect(json.code).toBe("NOT_FOUND");
  });

  it("returns 500 when AI fails", async () => {
    vi.mocked(cg.getCoinDetail).mockResolvedValue(mockCoinDetail as any);
    vi.mocked(cg.getTrending).mockResolvedValue(mockTrending as any);
    vi.mocked(alt.getFearGreedIndex).mockResolvedValue(mockFearGreed);
    vi.mocked(aiComplete).mockRejectedValue(new Error("LLM timeout"));

    const res = await app.request("/api/ai/sentiment/bitcoin");
    expect(res.status).toBe(500);

    const json = await res.json();
    expect(json.code).toBe("AI_SERVICE_ERROR");
  });

  it("returns 503 when queue is full", async () => {
    vi.mocked(cg.getCoinDetail).mockResolvedValue(mockCoinDetail as any);
    vi.mocked(cg.getTrending).mockResolvedValue(mockTrending as any);
    vi.mocked(alt.getFearGreedIndex).mockResolvedValue(mockFearGreed);

    // Import the queue mock to override execute
    const { aiQueue } = await import("../../lib/queue.js");
    const queueError = new Error("Queue full");
    queueError.name = "QueueFullError";
    vi.mocked(aiQueue.execute).mockRejectedValue(queueError);

    const res = await app.request("/api/ai/sentiment/bitcoin");
    expect(res.status).toBe(503);

    const json = await res.json();
    expect(json.code).toBe("SERVICE_UNAVAILABLE");
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/ai/digest
// ═══════════════════════════════════════════════════════════════

describe("GET /api/ai/digest", () => {
  it("returns AI market digest", async () => {
    vi.mocked(cg.getGlobal).mockResolvedValue(mockGlobal as any);
    vi.mocked(cg.getTrending).mockResolvedValue(mockTrending as any);
    vi.mocked(alt.getFearGreedIndex).mockResolvedValue(mockFearGreed);
    vi.mocked(cg.getCoins).mockResolvedValue(mockCoins as any);

    const digestJson = JSON.stringify({
      headline: "Markets rally as BTC crosses $60k",
      marketStatus: "risk_on",
      topMovers: [{ name: "Bitcoin", change: "+2.5%", note: "ATH approaching" }],
      keyInsights: ["BTC dominance rising", "DeFi TVL stable"],
      outlook: "Bullish outlook for the week",
    });

    vi.mocked(aiComplete).mockResolvedValue({
      text: digestJson,
      model: "test-model",
      tokensUsed: 500,
    });

    const res = await app.request("/api/ai/digest");
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.data.headline).toBeDefined();
    expect(json.model).toBe("test-model");
  });

  it("returns cached digest when available", async () => {
    const cached = JSON.stringify({
      headline: "Cached digest",
      marketStatus: "neutral",
      topMovers: [],
      keyInsights: [],
      outlook: "Wait and see",
    });
    vi.mocked(cache.get).mockResolvedValue(cached);

    const res = await app.request("/api/ai/digest");
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.cached).toBe(true);
    expect(json.data.headline).toBe("Cached digest");
  });

  it("returns 500 when AI fails", async () => {
    vi.mocked(cg.getGlobal).mockResolvedValue(mockGlobal as any);
    vi.mocked(cg.getTrending).mockResolvedValue(mockTrending as any);
    vi.mocked(alt.getFearGreedIndex).mockResolvedValue(mockFearGreed);
    vi.mocked(cg.getCoins).mockResolvedValue(mockCoins as any);
    vi.mocked(aiComplete).mockRejectedValue(new Error("LLM down"));

    const res = await app.request("/api/ai/digest");
    expect(res.status).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/ai/signals
// ═══════════════════════════════════════════════════════════════

describe("GET /api/ai/signals", () => {
  it("returns AI trading signals", async () => {
    vi.mocked(cg.getCoins).mockResolvedValue(mockCoins as any);
    vi.mocked(llama.getYieldPools).mockResolvedValue({
      data: [
        {
          pool: "pool-1", project: "aave", chain: "Ethereum", symbol: "USDC",
          tvlUsd: 100e6, apy: 5.2, apyBase: 3.0, apyReward: 2.2,
          stablecoin: true, ilRisk: "no", exposure: "single", poolMeta: null,
        },
      ],
    } as any);
    vi.mocked(alt.getFearGreedIndex).mockResolvedValue(mockFearGreed);

    const signalsJson = JSON.stringify({
      signals: [
        {
          type: "momentum",
          asset: "Bitcoin",
          action: "long_bias",
          confidence: 70,
          reasoning: "Strong upward momentum",
        },
      ],
      marketContext: "Risk-on environment",
      riskLevel: "medium",
    });

    vi.mocked(aiComplete).mockResolvedValue({
      text: signalsJson,
      model: "test-model",
      tokensUsed: 400,
    });

    const res = await app.request("/api/ai/signals");
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.data.signals).toHaveLength(1);
    expect(json.data.riskLevel).toBe("medium");
  });

  it("returns 500 when AI fails", async () => {
    vi.mocked(cg.getCoins).mockResolvedValue(mockCoins as any);
    vi.mocked(llama.getYieldPools).mockResolvedValue({ data: [] } as any);
    vi.mocked(alt.getFearGreedIndex).mockResolvedValue(mockFearGreed);
    vi.mocked(aiComplete).mockRejectedValue(new Error("LLM fail"));

    const res = await app.request("/api/ai/signals");
    expect(res.status).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════
// POST /api/ai/ask
// ═══════════════════════════════════════════════════════════════

describe("POST /api/ai/ask", () => {
  it("returns AI answer for a valid question", async () => {
    vi.mocked(cg.getGlobal).mockResolvedValue(mockGlobal as any);
    vi.mocked(alt.getFearGreedIndex).mockResolvedValue(mockFearGreed);

    vi.mocked(aiComplete).mockResolvedValue({
      text: "Bitcoin is currently trading at $60,000 with bullish momentum.",
      model: "test-model",
      tokensUsed: 200,
    });

    const res = await app.request("/api/ai/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: "What is the current BTC price?" }),
    });
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.data.answer).toContain("Bitcoin");
    expect(json.model).toBe("test-model");
  });

  it("returns 400 when question is missing", async () => {
    const res = await app.request("/api/ai/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.error).toContain("question");
    expect(json.code).toBe("VALIDATION_FAILED");
  });

  it("returns 500 when AI fails", async () => {
    vi.mocked(cg.getGlobal).mockResolvedValue(mockGlobal as any);
    vi.mocked(alt.getFearGreedIndex).mockResolvedValue(mockFearGreed);
    vi.mocked(aiComplete).mockRejectedValue(new Error("LLM timeout"));

    const res = await app.request("/api/ai/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: "Test question" }),
    });
    expect(res.status).toBe(500);
  });

  it("returns 503 when queue is full", async () => {
    vi.mocked(cg.getGlobal).mockResolvedValue(mockGlobal as any);
    vi.mocked(alt.getFearGreedIndex).mockResolvedValue(mockFearGreed);

    const { aiQueue } = await import("../../lib/queue.js");
    const queueError = new Error("Queue full");
    queueError.name = "QueueFullError";
    vi.mocked(aiQueue.execute).mockRejectedValue(queueError);

    const res = await app.request("/api/ai/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: "Test question" }),
    });
    expect(res.status).toBe(503);

    const json = await res.json();
    expect(json.code).toBe("SERVICE_UNAVAILABLE");
  });
});
