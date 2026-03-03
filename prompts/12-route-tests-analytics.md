# Prompt 12: Analytics Route Integration Tests

## Agent Identity & Rules

```
You are building comprehensive integration tests for the Analytics routes in Crypto Vision.
- Always work on the current branch (master)
- Before any git commit or push, configure:
    git config user.name "nirholas"
    git config user.email "nirholas@users.noreply.github.com"
- Always use background terminals (isBackground: true) — always kill them after use
- We have unlimited Claude credits — build the best possible version
- No mocks of the module under test — only mock external source adapters
- Every test must test REAL behavior, not implementation details
- No fake data in implementation code — test files may mock source adapters
- No TODO stubs — every function must do real work
- TypeScript strict mode — no `any` types, no `@ts-ignore`
```

## Objective

Create a full integration test suite for `src/routes/analytics.ts` (432 lines, 10 endpoints) using vitest + Hono's `app.request()` test helper. Mock only the source adapters (`coingecko`, `defillama`, `l2beat`, `tokenterminal`, `cryptocompare`) and the cache layer so no real HTTP calls are made. Test every endpoint with happy-path AND error cases.

The analytics route provides advanced analytics:
- **Correlation** — Cross-asset Pearson correlation matrix
- **Volatility** — Annualized volatility rankings
- **L2 Comparison** — Layer 2 projects with TVL from L2Beat + DeFiLlama
- **Revenue** — Protocol revenue/fee rankings from DeFiLlama + TokenTerminal
- **Token Terminal endpoints** — Projects, project metrics, fees, active users, market metrics

## Context

### Current Test Infrastructure
- Test runner: vitest v3.2.4
- Config: `vitest.config.ts` — includes `src/routes/__tests__/**/*.test.ts`
- Pattern: `vi.mock("../../sources/{name}.js")` before imports
- Mount: `const app = new Hono().route("/api/analytics", analyticsRoutes)`
- Error system: Routes use try/catch → 500 with `{ error }` or let Hono handle uncaught

### Existing Test Examples (READ THESE FOR PATTERNS)
- `src/routes/__tests__/market.test.ts` — 458 lines, 24 tests (best reference)
- `src/routes/__tests__/bitcoin.test.ts` — Bitcoin route tests
- `src/routes/__tests__/defi.test.ts` — DeFi route tests with DeFiLlama mocking

### The Route File: `src/routes/analytics.ts` (432 lines)
```
Imports:
  import { cache } from "../lib/cache.js";
  import * as cg from "../sources/coingecko.js";
  import * as cc from "../sources/cryptocompare.js";
  import * as l2beat from "../sources/l2beat.js";
  import * as llama from "../sources/defillama.js";
  import * as tt from "../sources/tokenterminal.js";

Endpoints:
  GET /correlation   — Cross-asset correlation matrix (uses cg.getMarketChart)
  GET /volatility    — Volatility rankings (uses cg.getCoins + cg.getMarketChart)
  GET /l2            — L2 comparison (uses l2beat.getScalingSummary + llama.getChainsTVL)
  GET /revenue       — Revenue rankings (uses llama.getFeesRevenue + llama.getRevenue + tt.getProtocolRevenue)
  GET /tt/projects   — TokenTerminal projects (uses tt.getProjects)
  GET /tt/project/:id — Project metrics (uses tt.getProjectMetrics)
  GET /tt/fees       — Protocol fee rankings (uses tt.getProtocolFees)
  GET /tt/active-users — DAU rankings (uses tt.getActiveUsers)
  GET /tt/market/:metric — Market time series (uses tt.getMarketMetric)
```

### Helper Functions in analytics.ts
```typescript
/** Pearson correlation coefficient between two number arrays */
function pearson(a: number[], b: number[]): number { ... }

/** Annualized volatility from daily returns */
function annualizedVol(prices: number[]): number { ... }
```

## Deliverables

### File: `src/routes/__tests__/analytics.test.ts`

```typescript
/**
 * Integration tests for Analytics routes.
 *
 * Mocks source adapters (coingecko, defillama, l2beat, tokenterminal,
 * cryptocompare) and cache so no real HTTP calls are made.
 * Uses Hono's app.request() test helper.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";

// ─── Mock sources BEFORE importing routes ────────────────────

vi.mock("../../lib/cache.js", () => ({
  cache: {
    wrap: vi.fn((_key: string, _ttl: number, fn: () => Promise<unknown>) => fn()),
  },
}));

vi.mock("../../sources/coingecko.js", () => ({
  getCoins: vi.fn(),
  getMarketChart: vi.fn(),
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
import * as l2beat from "../../sources/l2beat.js";
import * as llama from "../../sources/defillama.js";
import * as tt from "../../sources/tokenterminal.js";
import { analyticsRoutes } from "../analytics.js";

// ─── Set up app ──────────────────────────────────────────────

const app = new Hono().route("/api/analytics", analyticsRoutes);

beforeEach(() => {
  vi.clearAllMocks();
});

// ═══════════════════════════════════════════════════════════════
// GET /api/analytics/correlation
// ═══════════════════════════════════════════════════════════════

describe("GET /api/analytics/correlation", () => {
  const makePrices = (base: number, count: number, seed: number) =>
    Array.from({ length: count }, (_, i) => [
      1709000000000 + i * 86400000,
      base + Math.sin(i * seed) * base * 0.05,
    ]);

  it("returns a correlation matrix for default coin set", async () => {
    // Mock getMarketChart for 5 default coins
    const coins = ["bitcoin", "ethereum", "solana", "cardano", "avalanche-2"];
    for (let idx = 0; idx < coins.length; idx++) {
      vi.mocked(cg.getMarketChart).mockResolvedValueOnce({
        prices: makePrices(
          [67500, 3400, 145, 0.62, 38][idx],
          90,
          [0.3, 0.5, 0.7, 1.1, 0.9][idx]
        ),
        market_caps: [],
        total_volumes: [],
      });
    }

    const res = await app.request("/api/analytics/correlation");
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json).toHaveProperty("data");
    expect(json).toHaveProperty("timestamp");
    expect(json.data).toHaveProperty("matrix");
    expect(json.data).toHaveProperty("assets");
    expect(json.data).toHaveProperty("days", 90);

    // Diagonal should be 1
    for (const asset of json.data.assets) {
      expect(json.data.matrix[asset][asset]).toBe(1);
    }

    // Correlation values should be between -1 and 1
    for (const a of json.data.assets) {
      for (const b of json.data.assets) {
        expect(json.data.matrix[a][b]).toBeGreaterThanOrEqual(-1);
        expect(json.data.matrix[a][b]).toBeLessThanOrEqual(1);
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
      "/api/analytics/correlation?ids=bitcoin,ethereum&days=30"
    );
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.data.days).toBe(30);
    expect(json.data.assets).toContain("bitcoin");
    expect(json.data.assets).toContain("ethereum");
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

    const json = await res.json();
    // Only coins that succeeded should be in the matrix
    expect(json.data.assets.length).toBeLessThanOrEqual(5);
    expect(json.data.assets.length).toBeGreaterThanOrEqual(2);
  });

  it("returns 500 when all sources fail", async () => {
    vi.mocked(cg.getMarketChart).mockRejectedValue(
      new Error("CoinGecko down")
    );

    const res = await app.request("/api/analytics/correlation");
    // Even all-fail returns 200 with empty matrix (Promise.allSettled doesn't throw)
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.assets.length).toBe(0);
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
    },
  ];

  const makeDailyPrices = (base: number, days: number, volatilityFactor: number) =>
    Array.from({ length: days }, (_, i) => [
      1709000000000 + i * 86400000,
      base * (1 + Math.sin(i * 0.2) * volatilityFactor),
    ]);

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

    const json = await res.json();
    expect(json).toHaveProperty("data");
    expect(json).toHaveProperty("count");
    expect(json).toHaveProperty("timestamp");
    expect(json.data).toHaveProperty("period", "30d");
    expect(json.data).toHaveProperty("rankings");
    expect(Array.isArray(json.data.rankings)).toBe(true);

    // Rankings should be sorted by volatility descending
    for (let i = 1; i < json.data.rankings.length; i++) {
      expect(json.data.rankings[i - 1].volatility).toBeGreaterThanOrEqual(
        json.data.rankings[i].volatility
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

    const json = await res.json();
    expect(json.data.period).toBe("60d");
    expect(json.data.rankings.length).toBeLessThanOrEqual(2);
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
        prices: [[1709000000000, 3420]], // Only 1 price point — too few
        market_caps: [],
        total_volumes: [],
      })
      .mockRejectedValueOnce(new Error("timeout"));

    const res = await app.request("/api/analytics/volatility");
    expect(res.status).toBe(200);

    const json = await res.json();
    // Only bitcoin should have enough data
    expect(json.data.rankings.length).toBe(1);
    expect(json.data.rankings[0].id).toBe("bitcoin");
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
        stage: { stage: "Stage 1" },
        purposes: ["Universal"],
        tvl: { value: 18_200_000_000, displayValue: "$18.2B", change: 3.2 },
      },
      optimism: {
        name: "OP Mainnet",
        slug: "optimism",
        category: "Optimistic Rollup",
        provider: "OP Stack",
        stage: { stage: "Stage 1" },
        purposes: ["Universal"],
        tvl: { value: 7_800_000_000, displayValue: "$7.8B", change: -1.5 },
      },
      base: {
        name: "Base",
        slug: "base",
        category: "Optimistic Rollup",
        provider: "OP Stack",
        stage: { stage: "Stage 0" },
        purposes: ["Universal"],
        tvl: { value: 11_500_000_000, displayValue: "$11.5B", change: 8.4 },
      },
      "zksync-era": {
        name: "zkSync Era",
        slug: "zksync-era",
        category: "ZK Rollup",
        provider: "zkSync",
        stage: { stage: "Stage 0" },
        purposes: ["Universal"],
        tvl: { value: 1_200_000_000, displayValue: "$1.2B", change: -2.8 },
      },
      starknet: {
        name: "Starknet",
        slug: "starknet",
        category: "ZK Rollup",
        provider: "Starknet",
        stage: { stage: "Stage 0" },
        purposes: ["Universal"],
        tvl: { value: 850_000_000, displayValue: "$850M", change: 1.1 },
      },
    },
  };

  const mockChainsTvl = [
    { name: "Ethereum", tvl: 62_000_000_000, tokenSymbol: "ETH", chainId: 1 },
    { name: "Arbitrum", tvl: 4_200_000_000, tokenSymbol: "ARB", chainId: 42161 },
    { name: "OP Mainnet", tvl: 1_800_000_000, tokenSymbol: "OP", chainId: 10 },
    { name: "Base", tvl: 3_100_000_000, tokenSymbol: "ETH", chainId: 8453 },
    { name: "zkSync Era", tvl: 300_000_000, tokenSymbol: "ETH", chainId: 324 },
    { name: "Starknet", tvl: 180_000_000, tokenSymbol: "STRK", chainId: 0 },
  ];

  it("returns L2 comparison data sorted by TVL", async () => {
    vi.mocked(l2beat.getScalingSummary).mockResolvedValue(mockL2Summary as never);
    vi.mocked(llama.getChainsTVL).mockResolvedValue(mockChainsTvl as never);

    const res = await app.request("/api/analytics/l2");
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json).toHaveProperty("data");
    expect(json).toHaveProperty("count");
    expect(json).toHaveProperty("timestamp");
    expect(Array.isArray(json.data)).toBe(true);
    expect(json.data.length).toBeGreaterThan(0);

    // Default sort by TVL descending
    for (let i = 1; i < json.data.length; i++) {
      const prev = json.data[i - 1].tvlL2Beat ?? json.data[i - 1].tvlDeFiLlama ?? 0;
      const curr = json.data[i].tvlL2Beat ?? json.data[i].tvlDeFiLlama ?? 0;
      expect(prev).toBeGreaterThanOrEqual(curr);
    }

    // Verify structure
    const arb = json.data.find((p: Record<string, unknown>) => p.id === "arbitrum");
    expect(arb).toBeDefined();
    expect(arb.name).toBe("Arbitrum One");
    expect(arb.category).toBe("Optimistic Rollup");
    expect(arb.stage).toBe("Stage 1");
    expect(arb.tvlL2Beat).toBe(18_200_000_000);
  });

  it("sorts by name when sort=name", async () => {
    vi.mocked(l2beat.getScalingSummary).mockResolvedValue(mockL2Summary as never);
    vi.mocked(llama.getChainsTVL).mockResolvedValue(mockChainsTvl as never);

    const res = await app.request("/api/analytics/l2?sort=name");
    expect(res.status).toBe(200);

    const json = await res.json();
    for (let i = 1; i < json.data.length; i++) {
      expect(json.data[i - 1].name.localeCompare(json.data[i].name)).toBeLessThanOrEqual(0);
    }
  });

  it("respects limit parameter", async () => {
    vi.mocked(l2beat.getScalingSummary).mockResolvedValue(mockL2Summary as never);
    vi.mocked(llama.getChainsTVL).mockResolvedValue(mockChainsTvl as never);

    const res = await app.request("/api/analytics/l2?limit=2");
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.data.length).toBeLessThanOrEqual(2);
  });

  it("returns 500 when L2Beat fails", async () => {
    vi.mocked(l2beat.getScalingSummary).mockRejectedValue(new Error("L2Beat down"));
    vi.mocked(llama.getChainsTVL).mockResolvedValue(mockChainsTvl as never);

    const res = await app.request("/api/analytics/l2");
    expect(res.status).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/analytics/revenue
// ═══════════════════════════════════════════════════════════════

describe("GET /api/analytics/revenue", () => {
  const mockFeesRevenue = {
    protocols: [
      { name: "Lido", total24h: 2_850_000, total7d: 19_500_000, total30d: 78_000_000, category: "Liquid Staking" },
      { name: "Uniswap", total24h: 3_200_000, total7d: 22_000_000, total30d: 90_000_000, category: "DEX" },
      { name: "Aave", total24h: 1_100_000, total7d: 7_800_000, total30d: 32_000_000, category: "Lending" },
      { name: "MakerDAO", total24h: 850_000, total7d: 5_900_000, total30d: 24_000_000, category: "CDP" },
      { name: "Ethereum", total24h: 8_500_000, total7d: 58_000_000, total30d: 240_000_000, category: "Blockchain" },
    ],
  };

  const mockRevenue = {
    protocols: [
      { name: "Lido", total24h: 285_000, total7d: 1_950_000, total30d: 7_800_000 },
      { name: "Uniswap", total24h: 0, total7d: 0, total30d: 0 },
      { name: "Aave", total24h: 550_000, total7d: 3_900_000, total30d: 16_000_000 },
      { name: "MakerDAO", total24h: 850_000, total7d: 5_900_000, total30d: 24_000_000 },
      { name: "Ethereum", total24h: 850_000, total7d: 5_800_000, total30d: 24_000_000 },
    ],
  };

  it("returns revenue data sorted by fees24h by default", async () => {
    vi.mocked(llama.getFeesRevenue).mockResolvedValue(mockFeesRevenue as never);
    vi.mocked(llama.getRevenue).mockResolvedValue(mockRevenue as never);
    vi.mocked(tt.getProtocolRevenue).mockRejectedValue(new Error("no key"));

    const res = await app.request("/api/analytics/revenue");
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json).toHaveProperty("data");
    expect(json).toHaveProperty("count");
    expect(json).toHaveProperty("period", "24h");
    expect(json).toHaveProperty("timestamp");
    expect(Array.isArray(json.data)).toBe(true);

    // Should be sorted by fees24h descending
    for (let i = 1; i < json.data.length; i++) {
      expect(json.data[i - 1].fees24h).toBeGreaterThanOrEqual(json.data[i].fees24h);
    }

    // Ethereum should be #1 by 24h fees
    expect(json.data[0].name).toBe("Ethereum");
    expect(json.data[0].fees24h).toBe(8_500_000);
  });

  it("sorts by fees7d when period=7d", async () => {
    vi.mocked(llama.getFeesRevenue).mockResolvedValue(mockFeesRevenue as never);
    vi.mocked(llama.getRevenue).mockResolvedValue(mockRevenue as never);
    vi.mocked(tt.getProtocolRevenue).mockRejectedValue(new Error("no key"));

    const res = await app.request("/api/analytics/revenue?period=7d");
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.period).toBe("7d");
    for (let i = 1; i < json.data.length; i++) {
      expect(json.data[i - 1].fees7d).toBeGreaterThanOrEqual(json.data[i].fees7d);
    }
  });

  it("merges DeFiLlama revenue data into fee entries", async () => {
    vi.mocked(llama.getFeesRevenue).mockResolvedValue(mockFeesRevenue as never);
    vi.mocked(llama.getRevenue).mockResolvedValue(mockRevenue as never);
    vi.mocked(tt.getProtocolRevenue).mockRejectedValue(new Error("no key"));

    const res = await app.request("/api/analytics/revenue");
    expect(res.status).toBe(200);

    const json = await res.json();
    const lido = json.data.find((e: Record<string, unknown>) => e.name === "Lido");
    expect(lido).toBeDefined();
    expect(lido.fees24h).toBe(2_850_000);
    expect(lido.revenue24h).toBe(285_000);
  });

  it("still works when fees endpoint fails", async () => {
    vi.mocked(llama.getFeesRevenue).mockRejectedValue(new Error("DeFiLlama down"));
    vi.mocked(llama.getRevenue).mockResolvedValue(mockRevenue as never);
    vi.mocked(tt.getProtocolRevenue).mockRejectedValue(new Error("no key"));

    const res = await app.request("/api/analytics/revenue");
    expect(res.status).toBe(200);

    const json = await res.json();
    // Empty because fees data generates the entries list
    expect(json.data.length).toBe(0);
  });

  it("enriches with Token Terminal data when available", async () => {
    vi.mocked(llama.getFeesRevenue).mockResolvedValue(mockFeesRevenue as never);
    vi.mocked(llama.getRevenue).mockResolvedValue({ protocols: [] } as never);
    vi.mocked(tt.getProtocolRevenue).mockResolvedValue({
      data: [
        { project_name: "Lido", revenue_24h: 290_000, revenue_7d: 2_000_000, revenue_30d: 8_000_000 },
        { project_name: "Aave", revenue_24h: 560_000, revenue_7d: 4_000_000, revenue_30d: 16_500_000 },
      ],
    } as never);

    const res = await app.request("/api/analytics/revenue");
    expect(res.status).toBe(200);

    const json = await res.json();
    const lido = json.data.find((e: Record<string, unknown>) => e.name === "Lido");
    expect(lido.revenue24h).toBe(290_000); // enriched by TT
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/analytics/tt/projects
// ═══════════════════════════════════════════════════════════════

describe("GET /api/analytics/tt/projects", () => {
  it("returns Token Terminal project list", async () => {
    vi.mocked(tt.getProjects).mockResolvedValue({
      data: [
        { project_id: "aave", name: "Aave", symbol: "AAVE", category: "Lending" },
        { project_id: "uniswap", name: "Uniswap", symbol: "UNI", category: "DEX" },
        { project_id: "lido", name: "Lido", symbol: "LDO", category: "Liquid Staking" },
        { project_id: "compound", name: "Compound", symbol: "COMP", category: "Lending" },
        { project_id: "makerdao", name: "MakerDAO", symbol: "MKR", category: "CDP" },
      ],
    } as never);

    const res = await app.request("/api/analytics/tt/projects");
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json).toHaveProperty("data");
    expect(json).toHaveProperty("count", 5);
    expect(json).toHaveProperty("source", "tokenterminal");
    expect(json).toHaveProperty("timestamp");

    expect(json.data[0]).toMatchObject({
      id: "aave",
      name: "Aave",
      symbol: "AAVE",
      category: "Lending",
    });
  });

  it("returns empty when no projects available", async () => {
    vi.mocked(tt.getProjects).mockResolvedValue({ data: [] } as never);

    const res = await app.request("/api/analytics/tt/projects");
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.data).toEqual([]);
    expect(json.count).toBe(0);
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
    vi.mocked(tt.getProjectMetrics).mockResolvedValue({
      data: {
        project_id: "aave",
        name: "Aave",
        revenue: 156_000_000,
        revenue_30d: 13_000_000,
        fees: 312_000_000,
        tvl: 12_500_000_000,
        active_users: 45_000,
        market_cap: 3_200_000_000,
        token_price: 215.50,
        pe_ratio: 20.5,
        ps_ratio: 10.3,
      },
    } as never);

    const res = await app.request("/api/analytics/tt/project/aave");
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json).toHaveProperty("data");
    expect(json).toHaveProperty("projectId", "aave");
    expect(json).toHaveProperty("source", "tokenterminal");
    expect(json.data.project_id).toBe("aave");
    expect(json.data.tvl).toBe(12_500_000_000);
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
      { project_id: "ethereum", name: "Ethereum", fees_24h: 8_500_000, fees_7d: 58_000_000, fees_30d: 240_000_000 },
      { project_id: "uniswap", name: "Uniswap", fees_24h: 3_200_000, fees_7d: 22_000_000, fees_30d: 90_000_000 },
      { project_id: "lido", name: "Lido", fees_24h: 2_850_000, fees_7d: 19_500_000, fees_30d: 78_000_000 },
      { project_id: "aave", name: "Aave", fees_24h: 1_100_000, fees_7d: 7_800_000, fees_30d: 32_000_000 },
      { project_id: "tron", name: "Tron", fees_24h: 900_000, fees_7d: 6_300_000, fees_30d: 25_000_000 },
      { project_id: "opensea", name: "OpenSea", fees_24h: 450_000, fees_7d: 3_100_000, fees_30d: 12_000_000 },
    ],
  };

  it("returns protocol fee rankings", async () => {
    vi.mocked(tt.getProtocolFees).mockResolvedValue(mockFees as never);

    const res = await app.request("/api/analytics/tt/fees");
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json).toHaveProperty("data");
    expect(json).toHaveProperty("count");
    expect(json).toHaveProperty("source", "tokenterminal");
    expect(json.data.length).toBe(6);
  });

  it("respects limit parameter", async () => {
    vi.mocked(tt.getProtocolFees).mockResolvedValue(mockFees as never);

    const res = await app.request("/api/analytics/tt/fees?limit=3");
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.data.length).toBe(3);
    expect(json.count).toBe(3);
  });

  it("returns 500 when Token Terminal fails", async () => {
    vi.mocked(tt.getProtocolFees).mockRejectedValue(new Error("TT API key invalid"));

    const res = await app.request("/api/analytics/tt/fees");
    expect(res.status).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/analytics/tt/active-users
// ═══════════════════════════════════════════════════════════════

describe("GET /api/analytics/tt/active-users", () => {
  it("returns active user rankings", async () => {
    vi.mocked(tt.getActiveUsers).mockResolvedValue({
      data: [
        { project_id: "uniswap", name: "Uniswap", active_users_24h: 89_000, active_users_7d: 320_000 },
        { project_id: "opensea", name: "OpenSea", active_users_24h: 45_000, active_users_7d: 210_000 },
        { project_id: "aave", name: "Aave", active_users_24h: 12_000, active_users_7d: 56_000 },
        { project_id: "lido", name: "Lido", active_users_24h: 8_500, active_users_7d: 42_000 },
      ],
    } as never);

    const res = await app.request("/api/analytics/tt/active-users");
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json).toHaveProperty("data");
    expect(json).toHaveProperty("count", 4);
    expect(json).toHaveProperty("source", "tokenterminal");
    expect(json.data[0].project_id).toBe("uniswap");
  });

  it("limits results correctly", async () => {
    vi.mocked(tt.getActiveUsers).mockResolvedValue({
      data: Array.from({ length: 50 }, (_, i) => ({
        project_id: `project-${i}`,
        name: `Project ${i}`,
        active_users_24h: 10000 - i * 100,
      })),
    } as never);

    const res = await app.request("/api/analytics/tt/active-users?limit=10");
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.data.length).toBe(10);
    expect(json.count).toBe(10);
  });

  it("returns 500 when source fails", async () => {
    vi.mocked(tt.getActiveUsers).mockRejectedValue(new Error("timeout"));

    const res = await app.request("/api/analytics/tt/active-users");
    expect(res.status).toBe(500);
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
        { timestamp: "2026-02-01T00:00:00Z", value: 15_000_000 },
        { timestamp: "2026-02-02T00:00:00Z", value: 14_800_000 },
        { timestamp: "2026-02-03T00:00:00Z", value: 16_200_000 },
        { timestamp: "2026-02-04T00:00:00Z", value: 15_500_000 },
        { timestamp: "2026-02-05T00:00:00Z", value: 17_100_000 },
      ],
    } as never);

    const res = await app.request("/api/analytics/tt/market/revenue");
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json).toHaveProperty("data");
    expect(json).toHaveProperty("metric", "revenue");
    expect(json).toHaveProperty("days", 30);
    expect(json).toHaveProperty("source", "tokenterminal");
    expect(json.data).toHaveProperty("metricId", "revenue");
    expect(json.data).toHaveProperty("values");
    expect(Array.isArray(json.data.values)).toBe(true);
    expect(json.data.values[0]).toHaveProperty("timestamp");
    expect(json.data.values[0]).toHaveProperty("value");
  });

  it("accepts custom days parameter", async () => {
    vi.mocked(tt.getMarketMetric).mockResolvedValue({
      metric_id: "fees",
      data: Array.from({ length: 7 }, (_, i) => ({
        timestamp: `2026-02-0${i + 1}T00:00:00Z`,
        value: 8_000_000 + i * 500_000,
      })),
    } as never);

    const res = await app.request("/api/analytics/tt/market/fees?days=7");
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.days).toBe(7);
    expect(json.metric).toBe("fees");
  });

  it("returns 500 when metric request fails", async () => {
    vi.mocked(tt.getMarketMetric).mockRejectedValue(new Error("invalid metric"));

    const res = await app.request("/api/analytics/tt/market/invalid");
    expect(res.status).toBe(500);
  });
});
```

## Implementation Steps

1. **Read `src/routes/analytics.ts`** (432 lines) — understand every endpoint, import, parameter, and error path
2. **Read `src/sources/coingecko.ts`** — understand `getCoins` and `getMarketChart` return shapes
3. **Read `src/sources/l2beat.ts`** — understand `getScalingSummary` return shape
4. **Read `src/sources/defillama.ts`** — understand `getChainsTVL`, `getFeesRevenue`, `getRevenue` return shapes
5. **Read `src/sources/tokenterminal.ts`** — understand all TT function return shapes
6. **Read `src/routes/__tests__/market.test.ts`** — this is the gold standard pattern to follow
7. **Create `src/routes/__tests__/analytics.test.ts`** with all mocks and tests
8. **Adapt mock values** to match what the real source functions actually return
9. **Run**: `npx vitest run src/routes/__tests__/analytics.test.ts`
10. **Fix any failures** — adjust mock shapes or assertions to match actual route behavior
11. **Run full suite**: `npx vitest run` to check for regressions
12. **Commit**:
    ```bash
    git config user.name "nirholas"
    git config user.email "nirholas@users.noreply.github.com"
    git add src/routes/__tests__/analytics.test.ts
    git commit -m "test(routes): add analytics route integration tests"
    ```
13. **Push**: `git push origin master`

## Verification

```bash
# Run just analytics tests
npx vitest run src/routes/__tests__/analytics.test.ts

# Expected: Test Files 1 passed (1), Tests 25+ passed
# All tests should pass with no real HTTP calls made

# Run full suite to verify no regressions
npx vitest run

# Expected: All existing tests still pass
```

## Key Patterns to Follow

### Cache Mocking
The analytics routes use `cache.wrap(key, ttl, fn)`. The mock bypasses caching by immediately calling the factory function:
```typescript
vi.mock("../../lib/cache.js", () => ({
  cache: {
    wrap: vi.fn((_key: string, _ttl: number, fn: () => Promise<unknown>) => fn()),
  },
}));
```

### Promise.allSettled Handling
Several endpoints use `Promise.allSettled`. Partial failures DON'T cause 500s — they return partial data. Test both all-success and partial-failure scenarios.

### Sorting Assertions
Revenue and L2 endpoints sort results. Verify sort order with loop assertions:
```typescript
for (let i = 1; i < json.data.length; i++) {
  expect(json.data[i - 1].someField).toBeGreaterThanOrEqual(json.data[i].someField);
}
```

### Token Terminal as Optional
The revenue endpoint treats Token Terminal as optional (wrapped in try/catch). When TT fails, it should still return DeFiLlama data successfully.

## Dependencies
- Must run AFTER Prompt 08 (testing-hardening) if changes to test infrastructure were made
- No new npm dependencies needed
