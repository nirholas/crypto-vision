/**
 * Integration tests for Analytics routes.
 *
 * Mocks source adapters (coingecko, defillama, l2beat, tokenterminal,
 * cryptocompare) and cache so no real HTTP calls are made.
 * Uses Hono's app.request() test helper.
 */

import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Mock sources BEFORE importing routes ────────────────────

vi.mock("../../lib/cache.js", () => ({
  cache: {
    wrap: vi.fn(
      (_key: string, _ttl: number, fn: () => Promise<unknown>) => fn(),
    ),
  },
}));

vi.mock("../../sources/coingecko.js", () => ({
  getCoins: vi.fn(),
  getMarketChart: vi.fn(),
  getGlobal: vi.fn(),
  getCategories: vi.fn(),
}));

vi.mock("../../sources/alternative.js", () => ({
  getFearGreedIndex: vi.fn(),
}));

vi.mock("../../sources/cryptocompare.js", () => ({
  getPrice: vi.fn(),
}));

vi.mock("../../sources/l2beat.js", () => ({
  getScalingSummary: vi.fn(),
}));

vi.mock("../../sources/defillama.js", () => ({
  getChainsTVL: vi.fn(),
  getFeesRevenue: vi.fn(),
  getRevenue: vi.fn(),
}));

vi.mock("../../sources/tokenterminal.js", () => ({
  getProjects: vi.fn(),
  getProjectMetrics: vi.fn(),
  getProtocolFees: vi.fn(),
  getProtocolRevenue: vi.fn(),
  getActiveUsers: vi.fn(),
  getMarketMetric: vi.fn(),
}));

vi.mock("../../lib/logger.js", () => ({
  log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

// ─── Import AFTER mocks ─────────────────────────────────────

import * as cg from "../../sources/coingecko.js";
import * as llama from "../../sources/defillama.js";
import * as l2beat from "../../sources/l2beat.js";
import * as tt from "../../sources/tokenterminal.js";
import { analyticsRoutes } from "../analytics.js";

// ─── Set up app ──────────────────────────────────────────────

const app = new Hono().route("/api/analytics", analyticsRoutes);

beforeEach(() => {
  vi.clearAllMocks();
});

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

/**
 * Generate synthetic price history for market chart mocking.
 * Produces [timestamp, price] tuples over `count` daily intervals.
 */
const makePrices = (
  base: number,
  count: number,
  seed: number,
): [number, number][] =>
  Array.from({ length: count }, (_, i) => [
    1709000000000 + i * 86400000,
    base + Math.sin(i * seed) * base * 0.05,
  ]);

/**
 * Generate daily price series with configurable volatility factor.
 * Higher volatilityFactor → larger price swings.
 */
const makeDailyPrices = (
  base: number,
  days: number,
  volatilityFactor: number,
): [number, number][] =>
  Array.from({ length: days }, (_, i) => [
    1709000000000 + i * 86400000,
    base * (1 + Math.sin(i * 0.2) * volatilityFactor),
  ]);

// ═══════════════════════════════════════════════════════════════
// GET /api/analytics/correlation
// ═══════════════════════════════════════════════════════════════

describe("GET /api/analytics/correlation", () => {
  it("returns a correlation matrix for default coin set", async () => {
    const coins = ["bitcoin", "ethereum", "solana", "cardano", "avalanche-2"];
    const bases = [67500, 3400, 145, 0.45, 35];
    const seeds = [0.3, 0.5, 0.7, 0.11, 0.13];

    for (let idx = 0; idx < coins.length; idx++) {
      vi.mocked(cg.getMarketChart).mockResolvedValueOnce({
        prices: makePrices(bases[idx], 90, seeds[idx]),
        market_caps: [],
        total_volumes: [],
      });
    }

    const res = await app.request("/api/analytics/correlation");
    expect(res.status).toBe(200);

    const json = (await res.json()) as Record<string, any>;
    expect(json).toHaveProperty("data");
    expect(json).toHaveProperty("timestamp");
    expect(json.data).toHaveProperty("matrix");
    expect(json.data).toHaveProperty("assets");
    expect(json.data).toHaveProperty("days", 90);

    // 5 default coins
    expect(json.data.assets).toHaveLength(5);

    // Diagonal should be 1
    for (const asset of json.data.assets) {
      expect(json.data.matrix[asset][asset]).toBe(1);
    }

    // All values between -1 and 1
    for (const a of json.data.assets) {
      for (const b of json.data.assets) {
        expect(json.data.matrix[a][b]).toBeGreaterThanOrEqual(-1);
        expect(json.data.matrix[a][b]).toBeLessThanOrEqual(1);
      }
    }

    // Matrix should be symmetric
    for (const a of json.data.assets) {
      for (const b of json.data.assets) {
        expect(json.data.matrix[a][b]).toBe(json.data.matrix[b][a]);
      }
    }
  });

  it("accepts custom ids and days parameters", async () => {
    vi.mocked(cg.getMarketChart).mockResolvedValueOnce({
      prices: makePrices(67500, 30, 0.3),
      market_caps: [],
      total_volumes: [],
    });
    vi.mocked(cg.getMarketChart).mockResolvedValueOnce({
      prices: makePrices(3400, 30, 0.5),
      market_caps: [],
      total_volumes: [],
    });

    const res = await app.request(
      "/api/analytics/correlation?ids=bitcoin,ethereum&days=30",
    );
    expect(res.status).toBe(200);

    const json = (await res.json()) as Record<string, any>;
    expect(json.data.days).toBe(30);
    expect(json.data.assets).toContain("bitcoin");
    expect(json.data.assets).toContain("ethereum");
    expect(json.data.assets).toHaveLength(2);
    expect(cg.getMarketChart).toHaveBeenCalledTimes(2);
    expect(cg.getMarketChart).toHaveBeenCalledWith("bitcoin", 30, "daily");
    expect(cg.getMarketChart).toHaveBeenCalledWith("ethereum", 30, "daily");
  });

  it("handles partial failures gracefully (some coins fail)", async () => {
    vi.mocked(cg.getMarketChart)
      .mockResolvedValueOnce({
        prices: makePrices(67500, 90, 0.3),
        market_caps: [],
        total_volumes: [],
      })
      .mockRejectedValueOnce(new Error("CoinGecko rate limit"))
      .mockResolvedValueOnce({
        prices: makePrices(145, 90, 0.7),
        market_caps: [],
        total_volumes: [],
      })
      .mockRejectedValueOnce(new Error("timeout"))
      .mockRejectedValueOnce(new Error("timeout"));

    const res = await app.request("/api/analytics/correlation");
    expect(res.status).toBe(200);

    const json = (await res.json()) as Record<string, any>;
    // Only bitcoin and solana succeeded
    expect(json.data.assets).toHaveLength(2);
    expect(json.data.assets).toContain("bitcoin");
    expect(json.data.assets).toContain("solana");
  });

  it("returns 200 with empty matrix when all sources fail", async () => {
    vi.mocked(cg.getMarketChart).mockRejectedValue(
      new Error("CoinGecko down"),
    );

    const res = await app.request("/api/analytics/correlation");
    // Promise.allSettled never throws — all rejected means empty matrix
    expect(res.status).toBe(200);

    const json = (await res.json()) as Record<string, any>;
    expect(json.data.assets).toHaveLength(0);
    expect(json.data.matrix).toEqual({});
  });

  it("caps days to 365 maximum", async () => {
    vi.mocked(cg.getMarketChart).mockResolvedValue({
      prices: makePrices(67500, 365, 0.3),
      market_caps: [],
      total_volumes: [],
    });

    const res = await app.request(
      "/api/analytics/correlation?ids=bitcoin&days=999",
    );
    expect(res.status).toBe(200);

    const json = (await res.json()) as Record<string, any>;
    expect(json.data.days).toBe(365);
    expect(cg.getMarketChart).toHaveBeenCalledWith("bitcoin", 365, "daily");
  });

  it("caps ids to 10 maximum", async () => {
    const ids = Array.from(
      { length: 15 },
      (_, i) => `coin-${i}`,
    ).join(",");

    vi.mocked(cg.getMarketChart).mockResolvedValue({
      prices: makePrices(100, 90, 0.3),
      market_caps: [],
      total_volumes: [],
    });

    await app.request(`/api/analytics/correlation?ids=${ids}`);
    // Only first 10 should be fetched
    expect(cg.getMarketChart).toHaveBeenCalledTimes(10);
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/analytics/volatility
// ═══════════════════════════════════════════════════════════════

describe("GET /api/analytics/volatility", () => {
  const mockCoins = [
    {
      id: "bitcoin",
      symbol: "btc",
      name: "Bitcoin",
      market_cap: 1_920_000_000_000,
      price_change_percentage_24h: 2.3,
      current_price: 97250,
      image: "",
      market_cap_rank: 1,
      total_volume: 38_500_000_000,
      circulating_supply: 19_800_000,
      total_supply: 21_000_000,
      max_supply: 21_000_000,
      ath: 108000,
      ath_change_percentage: -10,
    },
    {
      id: "ethereum",
      symbol: "eth",
      name: "Ethereum",
      market_cap: 410_000_000_000,
      price_change_percentage_24h: -1.2,
      current_price: 3420,
      image: "",
      market_cap_rank: 2,
      total_volume: 18_000_000_000,
      circulating_supply: 120_000_000,
      total_supply: null,
      max_supply: null,
      ath: 4878,
      ath_change_percentage: -30,
    },
    {
      id: "solana",
      symbol: "sol",
      name: "Solana",
      market_cap: 72_000_000_000,
      price_change_percentage_24h: 5.8,
      current_price: 162,
      image: "",
      market_cap_rank: 5,
      total_volume: 4_200_000_000,
      circulating_supply: 440_000_000,
      total_supply: 580_000_000,
      max_supply: null,
      ath: 260,
      ath_change_percentage: -38,
    },
  ];

  it("returns volatility rankings for top coins", async () => {
    vi.mocked(cg.getCoins).mockResolvedValue(mockCoins as never);

    vi.mocked(cg.getMarketChart)
      .mockResolvedValueOnce({
        prices: makeDailyPrices(97250, 30, 0.03),
        market_caps: [],
        total_volumes: [],
      })
      .mockResolvedValueOnce({
        prices: makeDailyPrices(3420, 30, 0.05),
        market_caps: [],
        total_volumes: [],
      })
      .mockResolvedValueOnce({
        prices: makeDailyPrices(162, 30, 0.08),
        market_caps: [],
        total_volumes: [],
      });

    const res = await app.request("/api/analytics/volatility");
    expect(res.status).toBe(200);

    const json = (await res.json()) as Record<string, any>;
    expect(json).toHaveProperty("data");
    expect(json).toHaveProperty("count");
    expect(json).toHaveProperty("timestamp");
    expect(json.data).toHaveProperty("period", "30d");
    expect(json.data).toHaveProperty("rankings");
    expect(Array.isArray(json.data.rankings)).toBe(true);
    expect(json.data.rankings).toHaveLength(3);

    // Rankings should be sorted by volatility descending
    for (let i = 1; i < json.data.rankings.length; i++) {
      expect(json.data.rankings[i - 1].volatility).toBeGreaterThanOrEqual(
        json.data.rankings[i].volatility,
      );
    }

    // Each ranking entry should have correct shape
    for (const r of json.data.rankings) {
      expect(r).toHaveProperty("id");
      expect(r).toHaveProperty("symbol");
      expect(r).toHaveProperty("name");
      expect(r).toHaveProperty("volatility");
      expect(r).toHaveProperty("priceChange24h");
      expect(r).toHaveProperty("marketCap");
      expect(typeof r.volatility).toBe("number");
      expect(r.volatility).toBeGreaterThanOrEqual(0);
    }

    // Solana (8% vol factor) should rank highest; bitcoin (3%) lowest
    expect(json.data.rankings[0].id).toBe("solana");
    expect(json.data.rankings[2].id).toBe("bitcoin");

    // count reflects actual number of ranked coins
    expect(json.count).toBe(3);
  });

  it("accepts custom limit and days parameters", async () => {
    vi.mocked(cg.getCoins).mockResolvedValue(mockCoins.slice(0, 2) as never);
    vi.mocked(cg.getMarketChart)
      .mockResolvedValueOnce({
        prices: makeDailyPrices(97250, 60, 0.03),
        market_caps: [],
        total_volumes: [],
      })
      .mockResolvedValueOnce({
        prices: makeDailyPrices(3420, 60, 0.05),
        market_caps: [],
        total_volumes: [],
      });

    const res = await app.request("/api/analytics/volatility?limit=2&days=60");
    expect(res.status).toBe(200);

    const json = (await res.json()) as Record<string, any>;
    expect(json.data.period).toBe("60d");
    expect(json.data.rankings.length).toBeLessThanOrEqual(2);

    // Verify limit was passed to getCoins
    expect(cg.getCoins).toHaveBeenCalledWith({
      perPage: 2,
      sparkline: false,
    });
  });

  it("returns 500 when getCoins fails", async () => {
    vi.mocked(cg.getCoins).mockRejectedValue(new Error("CoinGecko down"));

    const res = await app.request("/api/analytics/volatility");
    expect(res.status).toBe(500);
  });

  it("skips coins with insufficient price data", async () => {
    vi.mocked(cg.getCoins).mockResolvedValue(mockCoins as never);
    vi.mocked(cg.getMarketChart)
      .mockResolvedValueOnce({
        prices: makeDailyPrices(97250, 30, 0.03),
        market_caps: [],
        total_volumes: [],
      })
      .mockResolvedValueOnce({
        // Only 1 price point — too few for volatility (needs > 5)
        prices: [[1709000000000, 3420]],
        market_caps: [],
        total_volumes: [],
      })
      .mockRejectedValueOnce(new Error("timeout"));

    const res = await app.request("/api/analytics/volatility");
    expect(res.status).toBe(200);

    const json = (await res.json()) as Record<string, any>;
    // Only bitcoin should have enough data
    expect(json.data.rankings).toHaveLength(1);
    expect(json.data.rankings[0].id).toBe("bitcoin");
    expect(json.count).toBe(1);
  });

  it("caps limit to 100 and days to 365", async () => {
    vi.mocked(cg.getCoins).mockResolvedValue([] as never);

    const res = await app.request(
      "/api/analytics/volatility?limit=500&days=999",
    );
    expect(res.status).toBe(200);

    expect(cg.getCoins).toHaveBeenCalledWith({
      perPage: 100,
      sparkline: false,
    });

    const json = (await res.json()) as Record<string, any>;
    expect(json.data.period).toBe("365d");
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/analytics/l2
// ═══════════════════════════════════════════════════════════════

describe("GET /api/analytics/l2", () => {
  const mockL2Summary = {
    projects: {
      arbitrum: {
        name: "Arbitrum One",
        slug: "arbitrum",
        category: "Optimistic Rollup",
        provider: "Arbitrum",
        purposes: ["Universal"],
        stage: { stage: "Stage 1" },
        tvl: { displayValue: "$18.2B", value: 18_200_000_000, change: 3.2 },
      },
      optimism: {
        name: "OP Mainnet",
        slug: "optimism",
        category: "Optimistic Rollup",
        provider: "OP Labs",
        purposes: ["Universal"],
        stage: { stage: "Stage 1" },
        tvl: { displayValue: "$7.8B", value: 7_800_000_000, change: -1.5 },
      },
      base: {
        name: "Base",
        slug: "base",
        category: "Optimistic Rollup",
        provider: "OP Labs",
        purposes: ["Universal"],
        stage: { stage: "Stage 0" },
        tvl: { displayValue: "$11.5B", value: 11_500_000_000, change: 8.4 },
      },
      "zksync-era": {
        name: "zkSync Era",
        slug: "zksync-era",
        category: "ZK Rollup",
        provider: "zkSync",
        purposes: ["Universal"],
        stage: { stage: "Stage 0" },
        tvl: { displayValue: "$1.2B", value: 1_200_000_000, change: -2.8 },
      },
      starknet: {
        name: "Starknet",
        slug: "starknet",
        category: "ZK Rollup",
        provider: "StarkWare",
        purposes: ["Universal"],
        stage: { stage: "Stage 0" },
        tvl: { displayValue: "$850M", value: 850_000_000, change: 1.1 },
      },
    },
  };

  const mockChainsTvl = [
    {
      gecko_id: "ethereum",
      name: "Ethereum",
      tvl: 62_000_000_000,
      tokenSymbol: "ETH",
      cmcId: "1027",
      chainId: 1,
    },
    {
      gecko_id: "arbitrum",
      name: "Arbitrum",
      tvl: 4_200_000_000,
      tokenSymbol: "ARB",
      cmcId: null,
      chainId: 42161,
    },
    {
      gecko_id: null,
      name: "OP Mainnet",
      tvl: 1_800_000_000,
      tokenSymbol: "OP",
      cmcId: null,
      chainId: 10,
    },
    {
      gecko_id: null,
      name: "Base",
      tvl: 3_100_000_000,
      tokenSymbol: "ETH",
      cmcId: null,
      chainId: 8453,
    },
    {
      gecko_id: null,
      name: "zkSync Era",
      tvl: 300_000_000,
      tokenSymbol: "ETH",
      cmcId: null,
      chainId: 324,
    },
    {
      gecko_id: null,
      name: "Starknet",
      tvl: 180_000_000,
      tokenSymbol: "STRK",
      cmcId: null,
      chainId: 0,
    },
  ];

  it("returns L2 comparison data sorted by TVL (default)", async () => {
    vi.mocked(l2beat.getScalingSummary).mockResolvedValue(
      mockL2Summary as never,
    );
    vi.mocked(llama.getChainsTVL).mockResolvedValue(mockChainsTvl as never);

    const res = await app.request("/api/analytics/l2");
    expect(res.status).toBe(200);

    const json = (await res.json()) as Record<string, any>;
    expect(json).toHaveProperty("data");
    expect(json).toHaveProperty("count");
    expect(json).toHaveProperty("timestamp");
    expect(Array.isArray(json.data)).toBe(true);
    expect(json.data).toHaveLength(5);
    expect(json.count).toBe(5);

    // Default sort by TVL descending (tvlL2Beat first, fallback tvlDeFiLlama)
    for (let i = 1; i < json.data.length; i++) {
      const prev =
        json.data[i - 1].tvlL2Beat ?? json.data[i - 1].tvlDeFiLlama ?? 0;
      const curr =
        json.data[i].tvlL2Beat ?? json.data[i].tvlDeFiLlama ?? 0;
      expect(prev).toBeGreaterThanOrEqual(curr);
    }

    // Arbitrum should be first (highest TVL = $18.2B)
    expect(json.data[0].id).toBe("arbitrum");
    expect(json.data[0].name).toBe("Arbitrum One");
    expect(json.data[0].category).toBe("Optimistic Rollup");
    expect(json.data[0].stage).toBe("Stage 1");
    expect(json.data[0].tvlL2Beat).toBe(18_200_000_000);

    // Cross-referenced DeFiLlama TVL (matched by lowercase name)
    // "OP Mainnet" matches "op mainnet" in DeFiLlama
    const optimism = json.data.find(
      (p: Record<string, unknown>) => p.id === "optimism",
    );
    expect(optimism).toBeDefined();
    expect(optimism.tvlL2Beat).toBe(7_800_000_000);
    expect(optimism.tvlDeFiLlama).toBe(1_800_000_000);

    // "Base" matches "Base" in DeFiLlama
    const base = json.data.find(
      (p: Record<string, unknown>) => p.id === "base",
    );
    expect(base).toBeDefined();
    expect(base.tvlDeFiLlama).toBe(3_100_000_000);
  });

  it("sorts by name when sort=name", async () => {
    vi.mocked(l2beat.getScalingSummary).mockResolvedValue(
      mockL2Summary as never,
    );
    vi.mocked(llama.getChainsTVL).mockResolvedValue(mockChainsTvl as never);

    const res = await app.request("/api/analytics/l2?sort=name");
    expect(res.status).toBe(200);

    const json = (await res.json()) as Record<string, any>;
    for (let i = 1; i < json.data.length; i++) {
      expect(
        json.data[i - 1].name.localeCompare(json.data[i].name),
      ).toBeLessThanOrEqual(0);
    }
  });

  it("respects limit parameter", async () => {
    vi.mocked(l2beat.getScalingSummary).mockResolvedValue(
      mockL2Summary as never,
    );
    vi.mocked(llama.getChainsTVL).mockResolvedValue(mockChainsTvl as never);

    const res = await app.request("/api/analytics/l2?limit=2");
    expect(res.status).toBe(200);

    const json = (await res.json()) as Record<string, any>;
    expect(json.data).toHaveLength(2);
    expect(json.count).toBe(2);
  });

  it("returns 500 when L2Beat fails", async () => {
    vi.mocked(l2beat.getScalingSummary).mockRejectedValue(
      new Error("L2Beat down"),
    );
    vi.mocked(llama.getChainsTVL).mockResolvedValue(mockChainsTvl as never);

    const res = await app.request("/api/analytics/l2");
    expect(res.status).toBe(500);
  });

  it("returns 500 when DeFiLlama chains fail", async () => {
    vi.mocked(l2beat.getScalingSummary).mockResolvedValue(
      mockL2Summary as never,
    );
    vi.mocked(llama.getChainsTVL).mockRejectedValue(
      new Error("DeFiLlama down"),
    );

    const res = await app.request("/api/analytics/l2");
    // Promise.all — if either rejects, the whole thing fails
    expect(res.status).toBe(500);
  });

  it("has correct project structure including purposes and provider", async () => {
    vi.mocked(l2beat.getScalingSummary).mockResolvedValue(
      mockL2Summary as never,
    );
    vi.mocked(llama.getChainsTVL).mockResolvedValue(mockChainsTvl as never);

    const res = await app.request("/api/analytics/l2");
    expect(res.status).toBe(200);

    const json = (await res.json()) as Record<string, any>;
    const arb = json.data.find(
      (p: Record<string, unknown>) => p.id === "arbitrum",
    );
    expect(arb).toMatchObject({
      id: "arbitrum",
      name: "Arbitrum One",
      slug: "arbitrum",
      category: "Optimistic Rollup",
      provider: "Arbitrum",
      stage: "Stage 1",
      purposes: ["Universal"],
      tvlL2Beat: 18_200_000_000,
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/analytics/revenue
// ═══════════════════════════════════════════════════════════════

describe("GET /api/analytics/revenue", () => {
  const mockFeesProtocols = [
    {
      name: "Lido",
      total24h: 2_850_000,
      total7d: 19_500_000,
      total30d: 78_000_000,
      category: "Liquid Staking",
    },
    {
      name: "Uniswap",
      total24h: 3_200_000,
      total7d: 22_000_000,
      total30d: 85_000_000,
      category: "DEX",
    },
    {
      name: "AAVE",
      total24h: 1_500_000,
      total7d: 10_200_000,
      total30d: 42_000_000,
      category: "Lending",
    },
    {
      name: "Ethereum",
      total24h: 8_500_000,
      total7d: 58_000_000,
      total30d: 240_000_000,
      category: "Blockchain",
    },
  ];

  const mockFeesRevenue = { protocols: mockFeesProtocols };

  const mockRevenue = {
    protocols: [
      {
        name: "Lido",
        total24h: 285_000,
        total7d: 1_950_000,
        total30d: 7_800_000,
        category: "Liquid Staking",
      },
      {
        name: "Uniswap",
        total24h: 320_000,
        total7d: 2_200_000,
        total30d: 8_500_000,
        category: "DEX",
      },
      {
        name: "AAVE",
        total24h: 150_000,
        total7d: 1_020_000,
        total30d: 4_200_000,
        category: "Lending",
      },
      {
        name: "Ethereum",
        total24h: 850_000,
        total7d: 5_800_000,
        total30d: 24_000_000,
        category: "Blockchain",
      },
    ],
  };

  it("returns revenue data sorted by fees24h by default", async () => {
    vi.mocked(llama.getFeesRevenue).mockResolvedValue(
      mockFeesRevenue as never,
    );
    vi.mocked(llama.getRevenue).mockResolvedValue(mockRevenue as never);
    vi.mocked(tt.getProtocolRevenue).mockRejectedValue(new Error("no key"));

    const res = await app.request("/api/analytics/revenue");
    expect(res.status).toBe(200);

    const json = (await res.json()) as Record<string, any>;
    expect(json).toHaveProperty("data");
    expect(json).toHaveProperty("count");
    expect(json).toHaveProperty("period", "24h");
    expect(json).toHaveProperty("timestamp");
    expect(Array.isArray(json.data)).toBe(true);
    expect(json.data).toHaveLength(4);

    // Should be sorted by fees24h descending
    for (let i = 1; i < json.data.length; i++) {
      expect(json.data[i - 1].fees24h).toBeGreaterThanOrEqual(
        json.data[i].fees24h,
      );
    }

    // Ethereum should be #1 by 24h fees ($8.5M)
    expect(json.data[0].name).toBe("Ethereum");
    expect(json.data[0].fees24h).toBe(8_500_000);
  });

  it("sorts by fees7d when period=7d", async () => {
    vi.mocked(llama.getFeesRevenue).mockResolvedValue(
      mockFeesRevenue as never,
    );
    vi.mocked(llama.getRevenue).mockResolvedValue(mockRevenue as never);
    vi.mocked(tt.getProtocolRevenue).mockRejectedValue(new Error("no key"));

    const res = await app.request("/api/analytics/revenue?period=7d");
    expect(res.status).toBe(200);

    const json = (await res.json()) as Record<string, any>;
    expect(json.period).toBe("7d");
    for (let i = 1; i < json.data.length; i++) {
      expect(json.data[i - 1].fees7d).toBeGreaterThanOrEqual(
        json.data[i].fees7d,
      );
    }
  });

  it("sorts by fees30d when period=30d", async () => {
    vi.mocked(llama.getFeesRevenue).mockResolvedValue(
      mockFeesRevenue as never,
    );
    vi.mocked(llama.getRevenue).mockResolvedValue(mockRevenue as never);
    vi.mocked(tt.getProtocolRevenue).mockRejectedValue(new Error("no key"));

    const res = await app.request("/api/analytics/revenue?period=30d");
    expect(res.status).toBe(200);

    const json = (await res.json()) as Record<string, any>;
    expect(json.period).toBe("30d");
    for (let i = 1; i < json.data.length; i++) {
      expect(json.data[i - 1].fees30d).toBeGreaterThanOrEqual(
        json.data[i].fees30d,
      );
    }
  });

  it("merges DeFiLlama revenue data into fee entries", async () => {
    vi.mocked(llama.getFeesRevenue).mockResolvedValue(
      mockFeesRevenue as never,
    );
    vi.mocked(llama.getRevenue).mockResolvedValue(mockRevenue as never);
    vi.mocked(tt.getProtocolRevenue).mockRejectedValue(new Error("no key"));

    const res = await app.request("/api/analytics/revenue");
    expect(res.status).toBe(200);

    const json = (await res.json()) as Record<string, any>;
    const lido = json.data.find(
      (e: Record<string, unknown>) => e.name === "Lido",
    );
    expect(lido).toBeDefined();
    expect(lido.fees24h).toBe(2_850_000);
    expect(lido.revenue24h).toBe(285_000);
    expect(lido.revenue7d).toBe(1_950_000);
    expect(lido.revenue30d).toBe(7_800_000);
    expect(lido.category).toBe("Liquid Staking");
    expect(lido.source).toBe("defillama");
  });

  it("still works when fees endpoint fails (returns empty)", async () => {
    vi.mocked(llama.getFeesRevenue).mockRejectedValue(
      new Error("DeFiLlama down"),
    );
    vi.mocked(llama.getRevenue).mockResolvedValue(mockRevenue as never);
    vi.mocked(tt.getProtocolRevenue).mockRejectedValue(new Error("no key"));

    const res = await app.request("/api/analytics/revenue");
    expect(res.status).toBe(200);

    const json = (await res.json()) as Record<string, any>;
    // No entries because fees generate the entry list
    expect(json.data).toHaveLength(0);
    expect(json.count).toBe(0);
  });

  it("enriches with Token Terminal data when DeFiLlama revenue is missing", async () => {
    vi.mocked(llama.getFeesRevenue).mockResolvedValue(
      mockFeesRevenue as never,
    );
    vi.mocked(llama.getRevenue).mockResolvedValue({
      protocols: [],
    } as never);
    vi.mocked(tt.getProtocolRevenue).mockResolvedValue({
      data: [
        {
          project_id: "lido",
          project_name: "Lido",
          symbol: "LDO",
          category: "Liquid Staking",
          revenue_24h: 290_000,
          revenue_7d: 2_000_000,
          revenue_30d: 8_000_000,
        },
        {
          project_id: "uniswap",
          project_name: "Uniswap",
          symbol: "UNI",
          category: "DEX",
          revenue_24h: 330_000,
          revenue_7d: 2_300_000,
          revenue_30d: 8_800_000,
        },
      ],
    } as never);

    const res = await app.request("/api/analytics/revenue");
    expect(res.status).toBe(200);

    const json = (await res.json()) as Record<string, any>;
    const lido = json.data.find(
      (e: Record<string, unknown>) => e.name === "Lido",
    );
    expect(lido).toBeDefined();
    // DeFiLlama revenue was null → TT data fills it in
    expect(lido.revenue24h).toBe(290_000);
    expect(lido.revenue7d).toBe(2_000_000);

    const uni = json.data.find(
      (e: Record<string, unknown>) => e.name === "Uniswap",
    );
    expect(uni).toBeDefined();
    expect(uni.revenue24h).toBe(330_000);
  });

  it("does not overwrite DeFiLlama revenue with Token Terminal data", async () => {
    vi.mocked(llama.getFeesRevenue).mockResolvedValue(
      mockFeesRevenue as never,
    );
    vi.mocked(llama.getRevenue).mockResolvedValue(mockRevenue as never);
    vi.mocked(tt.getProtocolRevenue).mockResolvedValue({
      data: [
        {
          project_id: "lido",
          project_name: "Lido",
          symbol: "LDO",
          category: "Liquid Staking",
          revenue_24h: 999_999, // Different from DeFiLlama's 285_000
          revenue_7d: 999_999,
          revenue_30d: 999_999,
        },
      ],
    } as never);

    const res = await app.request("/api/analytics/revenue");
    expect(res.status).toBe(200);

    const json = (await res.json()) as Record<string, any>;
    const lido = json.data.find(
      (e: Record<string, unknown>) => e.name === "Lido",
    );
    // DeFiLlama revenue takes precedence (uses ?? operator)
    expect(lido.revenue24h).toBe(285_000);
  });

  it("respects limit parameter", async () => {
    vi.mocked(llama.getFeesRevenue).mockResolvedValue(
      mockFeesRevenue as never,
    );
    vi.mocked(llama.getRevenue).mockResolvedValue(mockRevenue as never);
    vi.mocked(tt.getProtocolRevenue).mockRejectedValue(new Error("no key"));

    const res = await app.request("/api/analytics/revenue?limit=2");
    expect(res.status).toBe(200);

    const json = (await res.json()) as Record<string, any>;
    expect(json.data).toHaveLength(2);
    expect(json.count).toBe(2);
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/analytics/tt/projects
// ═══════════════════════════════════════════════════════════════

describe("GET /api/analytics/tt/projects", () => {
  const mockProjects = [
    {
      project_id: "aave",
      name: "Aave",
      symbol: "AAVE",
      category: "Lending",
      market_cap: 2_500_000_000,
      revenue_30d: 12_000_000,
      fees_30d: 45_000_000,
      tvl: 12_500_000_000,
    },
    {
      project_id: "uniswap",
      name: "Uniswap",
      symbol: "UNI",
      category: "DEX",
      market_cap: 8_000_000_000,
      revenue_30d: 8_500_000,
      fees_30d: 85_000_000,
      tvl: 5_200_000_000,
    },
    {
      project_id: "lido",
      name: "Lido",
      symbol: "LDO",
      category: "Liquid Staking",
      market_cap: 2_800_000_000,
      revenue_30d: 7_800_000,
      fees_30d: 78_000_000,
      tvl: 35_000_000_000,
    },
    {
      project_id: "maker",
      name: "MakerDAO",
      symbol: "MKR",
      category: "Lending",
      market_cap: 3_200_000_000,
      revenue_30d: 15_000_000,
      fees_30d: 15_000_000,
      tvl: 8_000_000_000,
    },
    {
      project_id: "ethereum",
      name: "Ethereum",
      symbol: "ETH",
      category: "Blockchain",
      market_cap: 410_000_000_000,
      revenue_30d: 24_000_000,
      fees_30d: 240_000_000,
      tvl: null,
    },
  ];

  it("returns Token Terminal project list", async () => {
    vi.mocked(tt.getProjects).mockResolvedValue({
      data: mockProjects,
    } as never);

    const res = await app.request("/api/analytics/tt/projects");
    expect(res.status).toBe(200);

    const json = (await res.json()) as Record<string, any>;
    expect(json).toHaveProperty("data");
    expect(json).toHaveProperty("count", 5);
    expect(json).toHaveProperty("source", "tokenterminal");
    expect(json).toHaveProperty("timestamp");

    // Route maps projects to { id, name, symbol, category }
    expect(json.data[0]).toMatchObject({
      id: "aave",
      name: "Aave",
      symbol: "AAVE",
      category: "Lending",
    });

    // Should not expose raw TT fields that aren't mapped
    expect(json.data[0]).not.toHaveProperty("project_id");
    expect(json.data[0]).not.toHaveProperty("market_cap");
    expect(json.data[0]).not.toHaveProperty("tvl");
  });

  it("returns empty when no projects available", async () => {
    vi.mocked(tt.getProjects).mockResolvedValue({ data: [] } as never);

    const res = await app.request("/api/analytics/tt/projects");
    expect(res.status).toBe(200);

    const json = (await res.json()) as Record<string, any>;
    expect(json.data).toEqual([]);
    expect(json.count).toBe(0);
    expect(json.source).toBe("tokenterminal");
  });

  it("returns 500 when Token Terminal fails", async () => {
    vi.mocked(tt.getProjects).mockRejectedValue(new Error("TT API down"));

    const res = await app.request("/api/analytics/tt/projects");
    expect(res.status).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/analytics/tt/project/:id
// ═══════════════════════════════════════════════════════════════

describe("GET /api/analytics/tt/project/:id", () => {
  it("returns metrics for a specific project", async () => {
    const mockTimeseries = [
      { timestamp: "2025-01-01T00:00:00Z", value: 12_000_000 },
      { timestamp: "2025-01-02T00:00:00Z", value: 12_300_000 },
      { timestamp: "2025-01-03T00:00:00Z", value: 11_800_000 },
      { timestamp: "2025-01-04T00:00:00Z", value: 12_500_000 },
    ];

    vi.mocked(tt.getProjectMetrics).mockResolvedValue({
      data: mockTimeseries,
    } as never);

    const res = await app.request("/api/analytics/tt/project/aave");
    expect(res.status).toBe(200);

    const json = (await res.json()) as Record<string, any>;
    expect(json).toHaveProperty("data");
    expect(json).toHaveProperty("projectId", "aave");
    expect(json).toHaveProperty("source", "tokenterminal");
    expect(json).toHaveProperty("timestamp");

    // data is the timeseries array from getProjectMetrics
    expect(Array.isArray(json.data)).toBe(true);
    expect(json.data).toHaveLength(4);
    expect(json.data[0]).toHaveProperty("timestamp", "2025-01-01T00:00:00Z");
    expect(json.data[0]).toHaveProperty("value", 12_000_000);
  });

  it("passes the project id from the URL param", async () => {
    vi.mocked(tt.getProjectMetrics).mockResolvedValue({
      data: [],
    } as never);

    const res = await app.request("/api/analytics/tt/project/compound");
    expect(res.status).toBe(200);

    expect(tt.getProjectMetrics).toHaveBeenCalledWith("compound");

    const json = (await res.json()) as Record<string, any>;
    expect(json.projectId).toBe("compound");
  });

  it("returns 500 when project not found", async () => {
    vi.mocked(tt.getProjectMetrics).mockRejectedValue(new Error("not found"));

    const res = await app.request("/api/analytics/tt/project/nonexistent");
    expect(res.status).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/analytics/tt/fees
// ═══════════════════════════════════════════════════════════════

describe("GET /api/analytics/tt/fees", () => {
  const mockFees = {
    data: [
      {
        project_id: "ethereum",
        project_name: "Ethereum",
        symbol: "ETH",
        category: "Blockchain",
        fees_24h: 8_500_000,
        fees_7d: 58_000_000,
        fees_30d: 240_000_000,
      },
      {
        project_id: "uniswap",
        project_name: "Uniswap",
        symbol: "UNI",
        category: "DEX",
        fees_24h: 3_200_000,
        fees_7d: 22_000_000,
        fees_30d: 85_000_000,
      },
      {
        project_id: "lido",
        project_name: "Lido",
        symbol: "LDO",
        category: "Liquid Staking",
        fees_24h: 2_850_000,
        fees_7d: 19_500_000,
        fees_30d: 78_000_000,
      },
      {
        project_id: "aave",
        project_name: "Aave",
        symbol: "AAVE",
        category: "Lending",
        fees_24h: 1_500_000,
        fees_7d: 10_200_000,
        fees_30d: 42_000_000,
      },
      {
        project_id: "maker",
        project_name: "MakerDAO",
        symbol: "MKR",
        category: "Lending",
        fees_24h: 500_000,
        fees_7d: 3_400_000,
        fees_30d: 15_000_000,
      },
      {
        project_id: "opensea",
        project_name: "OpenSea",
        symbol: "",
        category: "NFT Marketplace",
        fees_24h: 450_000,
        fees_7d: 3_100_000,
        fees_30d: 12_000_000,
      },
    ],
  };

  it("returns protocol fee rankings", async () => {
    vi.mocked(tt.getProtocolFees).mockResolvedValue(mockFees as never);

    const res = await app.request("/api/analytics/tt/fees");
    expect(res.status).toBe(200);

    const json = (await res.json()) as Record<string, any>;
    expect(json).toHaveProperty("data");
    expect(json).toHaveProperty("count");
    expect(json).toHaveProperty("source", "tokenterminal");
    expect(json).toHaveProperty("timestamp");
    expect(json.data).toHaveLength(6);
    expect(json.count).toBe(6);
  });

  it("respects limit parameter", async () => {
    vi.mocked(tt.getProtocolFees).mockResolvedValue(mockFees as never);

    const res = await app.request("/api/analytics/tt/fees?limit=3");
    expect(res.status).toBe(200);

    const json = (await res.json()) as Record<string, any>;
    expect(json.data).toHaveLength(3);
    expect(json.count).toBe(3);
  });

  it("returns 500 when Token Terminal fails", async () => {
    vi.mocked(tt.getProtocolFees).mockRejectedValue(
      new Error("TT API key invalid"),
    );

    const res = await app.request("/api/analytics/tt/fees");
    expect(res.status).toBe(500);
  });

  it("handles empty data gracefully", async () => {
    vi.mocked(tt.getProtocolFees).mockResolvedValue({ data: [] } as never);

    const res = await app.request("/api/analytics/tt/fees");
    expect(res.status).toBe(200);

    const json = (await res.json()) as Record<string, any>;
    expect(json.data).toEqual([]);
    expect(json.count).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/analytics/tt/active-users
// ═══════════════════════════════════════════════════════════════

describe("GET /api/analytics/tt/active-users", () => {
  const mockActiveUsers = {
    data: [
      {
        project_id: "uniswap",
        project_name: "Uniswap",
        symbol: "UNI",
        category: "DEX",
        active_users_30d: 2_500_000,
      },
      {
        project_id: "opensea",
        project_name: "OpenSea",
        symbol: "",
        category: "NFT Marketplace",
        active_users_30d: 1_800_000,
      },
      {
        project_id: "aave",
        project_name: "Aave",
        symbol: "AAVE",
        category: "Lending",
        active_users_30d: 450_000,
      },
      {
        project_id: "lido",
        project_name: "Lido",
        symbol: "LDO",
        category: "Liquid Staking",
        active_users_30d: 120_000,
      },
    ],
  };

  it("returns active user rankings", async () => {
    vi.mocked(tt.getActiveUsers).mockResolvedValue(mockActiveUsers as never);

    const res = await app.request("/api/analytics/tt/active-users");
    expect(res.status).toBe(200);

    const json = (await res.json()) as Record<string, any>;
    expect(json).toHaveProperty("data");
    expect(json).toHaveProperty("count", 4);
    expect(json).toHaveProperty("source", "tokenterminal");
    expect(json).toHaveProperty("timestamp");
    expect(json.data[0].project_id).toBe("uniswap");
    expect(json.data[0].active_users_30d).toBe(2_500_000);
  });

  it("limits results correctly", async () => {
    const largeDataset = Array.from({ length: 50 }, (_, i) => ({
      project_id: `project-${i}`,
      project_name: `Project ${i}`,
      symbol: `P${i}`,
      category: "DeFi",
      active_users_30d: 1_000_000 - i * 10_000,
    }));

    vi.mocked(tt.getActiveUsers).mockResolvedValue({
      data: largeDataset,
    } as never);

    const res = await app.request("/api/analytics/tt/active-users?limit=10");
    expect(res.status).toBe(200);

    const json = (await res.json()) as Record<string, any>;
    expect(json.data).toHaveLength(10);
    expect(json.count).toBe(10);
  });

  it("returns 500 when source fails", async () => {
    vi.mocked(tt.getActiveUsers).mockRejectedValue(new Error("timeout"));

    const res = await app.request("/api/analytics/tt/active-users");
    expect(res.status).toBe(500);
  });

  it("handles empty data gracefully", async () => {
    vi.mocked(tt.getActiveUsers).mockResolvedValue({ data: [] } as never);

    const res = await app.request("/api/analytics/tt/active-users");
    expect(res.status).toBe(200);

    const json = (await res.json()) as Record<string, any>;
    expect(json.data).toEqual([]);
    expect(json.count).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/analytics/tt/market/:metric
// ═══════════════════════════════════════════════════════════════

describe("GET /api/analytics/tt/market/:metric", () => {
  it("returns market-level time series for revenue metric", async () => {
    vi.mocked(tt.getMarketMetric).mockResolvedValue({
      metric_id: "revenue",
      data: [
        { timestamp: "2025-01-01T00:00:00Z", value: 45_000_000 },
        { timestamp: "2025-01-02T00:00:00Z", value: 47_000_000 },
        { timestamp: "2025-01-03T00:00:00Z", value: 42_000_000 },
        { timestamp: "2025-01-04T00:00:00Z", value: 48_000_000 },
        { timestamp: "2025-01-05T00:00:00Z", value: 50_000_000 },
      ],
    } as never);

    const res = await app.request("/api/analytics/tt/market/revenue");
    expect(res.status).toBe(200);

    const json = (await res.json()) as Record<string, any>;
    expect(json).toHaveProperty("data");
    expect(json).toHaveProperty("metric", "revenue");
    expect(json).toHaveProperty("days", 30);
    expect(json).toHaveProperty("source", "tokenterminal");
    expect(json).toHaveProperty("timestamp");
    expect(json.data).toHaveProperty("metricId", "revenue");
    expect(json.data).toHaveProperty("values");
    expect(Array.isArray(json.data.values)).toBe(true);
    expect(json.data.values).toHaveLength(5);
    expect(json.data.values[0]).toHaveProperty(
      "timestamp",
      "2025-01-01T00:00:00Z",
    );
    expect(json.data.values[0]).toHaveProperty("value", 45_000_000);

    // Verify the call was made with correct params
    expect(tt.getMarketMetric).toHaveBeenCalledWith("revenue", 30);
  });

  it("accepts custom days parameter", async () => {
    vi.mocked(tt.getMarketMetric).mockResolvedValue({
      metric_id: "fees",
      data: Array.from({ length: 7 }, (_, i) => ({
        timestamp: `2025-01-0${i + 1}T00:00:00Z`,
        value: 10_000_000 + i * 500_000,
      })),
    } as never);

    const res = await app.request("/api/analytics/tt/market/fees?days=7");
    expect(res.status).toBe(200);

    const json = (await res.json()) as Record<string, any>;
    expect(json.days).toBe(7);
    expect(json.metric).toBe("fees");
    expect(json.data.metricId).toBe("fees");
    expect(json.data.values).toHaveLength(7);

    expect(tt.getMarketMetric).toHaveBeenCalledWith("fees", 7);
  });

  it("caps days to 365 maximum", async () => {
    vi.mocked(tt.getMarketMetric).mockResolvedValue({
      metric_id: "tvl",
      data: [],
    } as never);

    const res = await app.request("/api/analytics/tt/market/tvl?days=999");
    expect(res.status).toBe(200);

    expect(tt.getMarketMetric).toHaveBeenCalledWith("tvl", 365);
    const json = (await res.json()) as Record<string, any>;
    expect(json.days).toBe(365);
  });

  it("returns 500 when metric request fails", async () => {
    vi.mocked(tt.getMarketMetric).mockRejectedValue(
      new Error("invalid metric"),
    );

    const res = await app.request("/api/analytics/tt/market/invalid");
    expect(res.status).toBe(500);
  });

  it("handles empty data array", async () => {
    vi.mocked(tt.getMarketMetric).mockResolvedValue({
      metric_id: "active_users",
      data: [],
    } as never);

    const res = await app.request("/api/analytics/tt/market/active_users");
    expect(res.status).toBe(200);

    const json = (await res.json()) as Record<string, any>;
    expect(json.data.metricId).toBe("active_users");
    expect(json.data.values).toEqual([]);
  });
});
