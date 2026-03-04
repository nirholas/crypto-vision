/**
 * Integration tests for /api/defi/* routes
 *
 * All DeFiLlama calls are mocked — no live API traffic.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock the source module BEFORE importing the routes ──────

vi.mock("@/sources/defillama.js", () => ({
  getProtocols: vi.fn(),
  getProtocolDetail: vi.fn(),
  getChainsTVL: vi.fn(),
  getChainTVLHistory: vi.fn(),
  getYieldPools: vi.fn(),
  getStablecoins: vi.fn(),
  getDexVolumes: vi.fn(),
  getFeesRevenue: vi.fn(),
  getBridges: vi.fn(),
  getRaises: vi.fn(),
}));

import { Hono } from "hono";
import { defiRoutes } from "@/routes/defi.js";
import * as llama from "@/sources/defillama.js";

const app = new Hono();
app.route("/", defiRoutes);

// ─── Fixtures ────────────────────────────────────────────────

const MOCK_PROTOCOL = {
  id: "1",
  name: "Aave",
  slug: "aave",
  symbol: "AAVE",
  tvl: 10_000_000_000,
  chainTvls: { Ethereum: 8_000_000_000 },
  change_1h: 0.1,
  change_1d: -0.5,
  change_7d: 3.2,
  category: "Lending",
  chains: ["Ethereum", "Polygon", "Avalanche"],
  logo: "https://defillama.com/aave.png",
  url: "https://aave.com",
  description: "Lending protocol",
  mcap: 2_000_000_000,
};

const MOCK_CHAINS = [
  { gecko_id: "ethereum", tvl: 50_000_000_000, tokenSymbol: "ETH", cmcId: "1027", name: "Ethereum", chainId: 1 },
  { gecko_id: "binance-smart-chain", tvl: 5_000_000_000, tokenSymbol: "BNB", cmcId: "1839", name: "BSC", chainId: 56 },
  { gecko_id: null, tvl: 0, tokenSymbol: "", cmcId: null, name: "Dead", chainId: null },
];

const MOCK_YIELDS = {
  data: [
    {
      pool: "pool-1",
      project: "aave",
      chain: "Ethereum",
      symbol: "USDC",
      tvlUsd: 500_000_000,
      apyBase: 3.5,
      apyReward: 1.2,
      apy: 4.7,
      stablecoin: true,
      ilRisk: "no",
      exposure: "single",
      poolMeta: null,
    },
    {
      pool: "pool-2",
      project: "uniswap",
      chain: "Ethereum",
      symbol: "ETH-USDC",
      tvlUsd: 200_000_000,
      apyBase: 8.0,
      apyReward: 0,
      apy: 8.0,
      stablecoin: false,
      ilRisk: "yes",
      exposure: "multi",
      poolMeta: null,
    },
  ],
};

const MOCK_BRIDGES = {
  bridges: [
    { id: 1, name: "portal", displayName: "Portal", volumePrevDay: 50_000_000, chains: ["Ethereum", "Solana"] },
    { id: 2, name: "across", displayName: "Across", volumePrevDay: 30_000_000, chains: ["Ethereum", "Arbitrum"] },
  ],
};

const MOCK_RAISES = {
  raises: [
    { name: "Project A", amount: 10_000_000, round: "Series A", date: 1700000000, category: "DeFi", leadInvestors: ["a16z"] },
    { name: "Project B", amount: 5_000_000, round: "Seed", date: 1699000000, category: "Infrastructure", leadInvestors: ["Paradigm"] },
  ],
};

beforeEach(() => {
  vi.mocked(llama.getProtocols).mockReset();
  vi.mocked(llama.getProtocolDetail).mockReset();
  vi.mocked(llama.getChainsTVL).mockReset();
  vi.mocked(llama.getYieldPools).mockReset();
  vi.mocked(llama.getStablecoins).mockReset();
  vi.mocked(llama.getDexVolumes).mockReset();
  vi.mocked(llama.getFeesRevenue).mockReset();
  vi.mocked(llama.getBridges).mockReset();
  vi.mocked(llama.getRaises).mockReset();
});

// ─── GET /protocols ──────────────────────────────────────────

describe("GET /protocols", () => {
  it("returns transformed protocol data sorted by TVL", async () => {
    vi.mocked(llama.getProtocols).mockResolvedValue([MOCK_PROTOCOL]);

    const res = await app.request("/protocols");
    expect(res.status).toBe(200);

    const body = (await res.json()) as Record<string, any>;
    expect(body.data).toHaveLength(1);
    expect(body.data[0]).toMatchObject({
      name: "Aave",
      slug: "aave",
      tvl: 10_000_000_000,
      category: "Lending",
    });
    expect(body).toHaveProperty("count", 1);
    expect(body).toHaveProperty("timestamp");
  });

  it("filters by chain query param", async () => {
    vi.mocked(llama.getProtocols).mockResolvedValue([
      { ...MOCK_PROTOCOL, chains: ["Ethereum"] },
      { ...MOCK_PROTOCOL, name: "Other", slug: "other", chains: ["Solana"], tvl: 500 },
    ]);

    const res = await app.request("/protocols?chain=ethereum");
    const body = (await res.json()) as Record<string, any>;
    expect(body.data).toHaveLength(1);
    expect(body.data[0].name).toBe("Aave");
  });

  it("respects limit param", async () => {
    const protocols = Array.from({ length: 10 }, (_, i) => ({
      ...MOCK_PROTOCOL,
      name: `Protocol ${i}`,
      slug: `protocol-${i}`,
      tvl: 1000 - i,
    }));
    vi.mocked(llama.getProtocols).mockResolvedValue(protocols);

    const res = await app.request("/protocols?limit=3");
    const body = (await res.json()) as Record<string, any>;
    expect(body.data).toHaveLength(3);
    expect(body.count).toBe(3);
  });
});

// ─── GET /protocol/:slug ─────────────────────────────────────

describe("GET /protocol/:slug", () => {
  it("returns protocol detail", async () => {
    vi.mocked(llama.getProtocolDetail).mockResolvedValue({
      id: "1",
      name: "Aave",
      symbol: "AAVE",
      tvl: [{ date: 1700000000, totalLiquidityUSD: 10_000_000_000 }],
      currentChainTvls: { Ethereum: 8_000_000_000 },
      chains: ["Ethereum"],
      category: "Lending",
    });

    const res = await app.request("/protocol/aave");
    expect(res.status).toBe(200);

    const body = (await res.json()) as Record<string, any>;
    expect(body.data.name).toBe("Aave");
    expect(body.data.chainTvls).toEqual({ Ethereum: 8_000_000_000 });
  });
});

// ─── GET /chains ─────────────────────────────────────────────

describe("GET /chains", () => {
  it("returns chains sorted by TVL, excluding zero-TVL", async () => {
    vi.mocked(llama.getChainsTVL).mockResolvedValue(MOCK_CHAINS);

    const res = await app.request("/chains");
    expect(res.status).toBe(200);

    const body = (await res.json()) as Record<string, any>;
    // Should exclude the chain with tvl: 0
    expect(body.data).toHaveLength(2);
    expect(body.data[0].name).toBe("Ethereum");
    expect(body.data[1].name).toBe("BSC");
  });
});

// ─── GET /yields ─────────────────────────────────────────────

describe("GET /yields", () => {
  it("returns yield pools sorted by APY", async () => {
    vi.mocked(llama.getYieldPools).mockResolvedValue(MOCK_YIELDS);

    const res = await app.request("/yields");
    expect(res.status).toBe(200);

    const body = (await res.json()) as Record<string, any>;
    expect(body.data).toHaveLength(2);
    // Should be sorted by APY desc
    expect(body.data[0].apy).toBeGreaterThanOrEqual(body.data[1].apy);
  });

  it("filters by chain", async () => {
    vi.mocked(llama.getYieldPools).mockResolvedValue({
      data: [
        ...MOCK_YIELDS.data,
        { ...MOCK_YIELDS.data[0], chain: "Solana", pool: "pool-sol" },
      ],
    });

    const res = await app.request("/yields?chain=solana");
    const body = (await res.json()) as Record<string, any>;
    expect(body.data.every((p: any) => p.chain.toLowerCase() === "solana")).toBe(true);
  });

  it("filters stablecoins only", async () => {
    vi.mocked(llama.getYieldPools).mockResolvedValue(MOCK_YIELDS);

    const res = await app.request("/yields?stablecoin=true");
    const body = (await res.json()) as Record<string, any>;
    expect(body.data.every((p: any) => p.stablecoin === true)).toBe(true);
  });
});

// ─── GET /bridges ────────────────────────────────────────────

describe("GET /bridges", () => {
  it("returns bridges sorted by volume", async () => {
    vi.mocked(llama.getBridges).mockResolvedValue(MOCK_BRIDGES);

    const res = await app.request("/bridges");
    expect(res.status).toBe(200);

    const body = (await res.json()) as Record<string, any>;
    expect(body.data).toHaveLength(2);
    expect(body.data[0].name).toBe("Portal");
    expect(body.data[0].volumePrevDay).toBe(50_000_000);
  });
});

// ─── GET /raises ─────────────────────────────────────────────

describe("GET /raises", () => {
  it("returns recent raises sorted by date descending", async () => {
    vi.mocked(llama.getRaises).mockResolvedValue(MOCK_RAISES);

    const res = await app.request("/raises");
    expect(res.status).toBe(200);

    const body = (await res.json()) as Record<string, any>;
    expect(body.data).toHaveLength(2);
    expect(body.data[0].name).toBe("Project A");
    expect(body.data[0].amount).toBe(10_000_000);
  });
});
