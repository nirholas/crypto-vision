/**
 * Integration tests for DeFi routes.
 *
 * Mocks the DeFiLlama source adapter so no real HTTP calls are made.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";

// ─── Mock sources ────────────────────────────────────────────

vi.mock("../../sources/defillama.js", () => ({
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

import * as llama from "../../sources/defillama.js";
import { defiRoutes } from "../defi.js";

const app = new Hono().route("/api/defi", defiRoutes);

beforeEach(() => {
  vi.clearAllMocks();
});

// ═══════════════════════════════════════════════════════════════
// GET /api/defi/protocols
// ═══════════════════════════════════════════════════════════════

describe("GET /api/defi/protocols", () => {
  it("returns sorted protocols", async () => {
    vi.mocked(llama.getProtocols).mockResolvedValue([
      {
        id: "1", name: "Aave", slug: "aave", symbol: "AAVE", tvl: 10e9,
        chainTvls: {}, change_1h: 0.1, change_1d: 0.5, change_7d: 2.0,
        category: "Lending", chains: ["Ethereum"], logo: "aave.png",
        url: "", description: "", mcap: 5e9,
      },
      {
        id: "2", name: "Uniswap", slug: "uniswap", symbol: "UNI", tvl: 5e9,
        chainTvls: {}, change_1h: -0.2, change_1d: 0.3, change_7d: 1.0,
        category: "DEX", chains: ["Ethereum", "Arbitrum"], logo: "uni.png",
        url: "", description: "",
      },
    ] as any);

    const res = await app.request("/api/defi/protocols?limit=10");
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.data).toHaveLength(2);
    // Aave first (higher TVL)
    expect(json.data[0].name).toBe("Aave");
    expect(json.data[1].name).toBe("Uniswap");
    expect(json.count).toBe(2);
  });

  it("filters by chain", async () => {
    vi.mocked(llama.getProtocols).mockResolvedValue([
      {
        id: "1", name: "Aave", slug: "aave", symbol: "AAVE", tvl: 10e9,
        chainTvls: {}, change_1h: 0.1, change_1d: 0.5, change_7d: 2.0,
        category: "Lending", chains: ["Ethereum"], logo: "",
        url: "", description: "",
      },
      {
        id: "2", name: "GMX", slug: "gmx", symbol: "GMX", tvl: 1e9,
        chainTvls: {}, change_1h: 0, change_1d: 0, change_7d: 0,
        category: "DEX", chains: ["Arbitrum"], logo: "",
        url: "", description: "",
      },
    ] as any);

    const res = await app.request("/api/defi/protocols?chain=arbitrum");
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.data).toHaveLength(1);
    expect(json.data[0].name).toBe("GMX");
  });

  it("propagates source errors as 500", async () => {
    vi.mocked(llama.getProtocols).mockRejectedValue(new Error("down"));

    const res = await app.request("/api/defi/protocols");
    expect(res.status).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/defi/protocol/:slug
// ═══════════════════════════════════════════════════════════════

describe("GET /api/defi/protocol/:slug", () => {
  it("returns protocol detail", async () => {
    vi.mocked(llama.getProtocolDetail).mockResolvedValue({
      id: "1",
      name: "Aave",
      symbol: "AAVE",
      category: "Lending",
      chains: ["Ethereum", "Polygon"],
      currentChainTvls: { Ethereum: 8e9, Polygon: 2e9 },
      tvl: Array.from({ length: 100 }, (_, i) => ({
        date: 1700000000 + i * 86400,
        totalLiquidityUSD: 10e9 + i * 1e6,
      })),
    });

    const res = await app.request("/api/defi/protocol/aave");
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.data.name).toBe("Aave");
    // Returns last 90 data points
    expect(json.data.tvlHistory).toHaveLength(90);
  });

  it("propagates source errors as 500", async () => {
    vi.mocked(llama.getProtocolDetail).mockRejectedValue(new Error("not found"));

    const res = await app.request("/api/defi/protocol/nonexistent");
    expect(res.status).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/defi/chains
// ═══════════════════════════════════════════════════════════════

describe("GET /api/defi/chains", () => {
  it("returns sorted chain TVL data", async () => {
    vi.mocked(llama.getChainsTVL).mockResolvedValue([
      { name: "BSC", tvl: 5e9, tokenSymbol: "BNB", chainId: 56, gecko_id: "binancecoin", cmcId: null },
      { name: "Ethereum", tvl: 50e9, tokenSymbol: "ETH", chainId: 1, gecko_id: "ethereum", cmcId: null },
    ] as any);

    const res = await app.request("/api/defi/chains");
    expect(res.status).toBe(200);

    const json = await res.json();
    // Ethereum first (higher TVL)
    expect(json.data[0].name).toBe("Ethereum");
    expect(json.data[1].name).toBe("BSC");
  });

  it("propagates source errors as 500", async () => {
    vi.mocked(llama.getChainsTVL).mockRejectedValue(new Error("fail"));

    const res = await app.request("/api/defi/chains");
    expect(res.status).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/defi/chain/:name
// ═══════════════════════════════════════════════════════════════

describe("GET /api/defi/chain/:name", () => {
  it("returns chain TVL history (last 365 points)", async () => {
    const history = Array.from({ length: 400 }, (_, i) => ({
      date: 1700000000 + i * 86400,
      tvl: 50e9 + i * 1e6,
    }));
    vi.mocked(llama.getChainTVLHistory).mockResolvedValue(history);

    const res = await app.request("/api/defi/chain/ethereum");
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.data).toHaveLength(365);
  });

  it("propagates source errors as 500", async () => {
    vi.mocked(llama.getChainTVLHistory).mockRejectedValue(new Error("fail"));

    const res = await app.request("/api/defi/chain/invalid");
    expect(res.status).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/defi/yields
// ═══════════════════════════════════════════════════════════════

describe("GET /api/defi/yields", () => {
  it("returns filtered and sorted yield pools", async () => {
    vi.mocked(llama.getYieldPools).mockResolvedValue({
      data: [
        {
          pool: "pool-1", project: "aave", chain: "Ethereum", symbol: "USDC",
          tvlUsd: 100e6, apy: 5.2, apyBase: 3.0, apyReward: 2.2,
          stablecoin: true, ilRisk: "no", exposure: "single", poolMeta: null,
        },
        {
          pool: "pool-2", project: "uniswap", chain: "Ethereum", symbol: "ETH-USDC",
          tvlUsd: 50e6, apy: 15.5, apyBase: 10.0, apyReward: 5.5,
          stablecoin: false, ilRisk: "yes", exposure: "multi", poolMeta: null,
        },
      ],
    });

    const res = await app.request("/api/defi/yields?limit=10");
    expect(res.status).toBe(200);

    const json = await res.json();
    // Sorted by APY descending
    expect(json.data[0].apy).toBe(15.5);
    expect(json.data[1].apy).toBe(5.2);
  });

  it("propagates source errors as 500", async () => {
    vi.mocked(llama.getYieldPools).mockRejectedValue(new Error("fail"));

    const res = await app.request("/api/defi/yields");
    expect(res.status).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/defi/stablecoins
// ═══════════════════════════════════════════════════════════════

describe("GET /api/defi/stablecoins", () => {
  it("returns stablecoin data sorted by circulating", async () => {
    vi.mocked(llama.getStablecoins).mockResolvedValue({
      peggedAssets: [
        {
          id: "1", name: "USDT", symbol: "USDT", gecko_id: "tether",
          pegType: "peggedUSD",
          circulating: { ethereum: { peggedUSD: 40e9 }, tron: { peggedUSD: 30e9 } },
          chains: ["Ethereum", "Tron"],
        },
        {
          id: "2", name: "USDC", symbol: "USDC", gecko_id: "usd-coin",
          pegType: "peggedUSD",
          circulating: { ethereum: { peggedUSD: 25e9 } },
          chains: ["Ethereum"],
        },
      ],
    });

    const res = await app.request("/api/defi/stablecoins");
    expect(res.status).toBe(200);

    const json = await res.json();
    // USDT first (70B > 25B)
    expect(json.data[0].name).toBe("USDT");
    expect(json.data[0].circulating).toBe(70e9);
  });

  it("propagates source errors as 500", async () => {
    vi.mocked(llama.getStablecoins).mockRejectedValue(new Error("fail"));

    const res = await app.request("/api/defi/stablecoins");
    expect(res.status).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/defi/dex-volumes
// ═══════════════════════════════════════════════════════════════

describe("GET /api/defi/dex-volumes", () => {
  it("returns dex volume data", async () => {
    vi.mocked(llama.getDexVolumes).mockResolvedValue({
      totalDataChart: [[1700000000, 5e9]],
      protocols: [
        { name: "Uniswap", total24h: 2e9, total7d: 14e9, total30d: 60e9, change_1d: 5 },
      ],
    });

    const res = await app.request("/api/defi/dex-volumes");
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.data.protocols[0].name).toBe("Uniswap");
    expect(json.data.totalChart).toHaveLength(1);
  });

  it("propagates source errors as 500", async () => {
    vi.mocked(llama.getDexVolumes).mockRejectedValue(new Error("fail"));

    const res = await app.request("/api/defi/dex-volumes");
    expect(res.status).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/defi/fees
// ═══════════════════════════════════════════════════════════════

describe("GET /api/defi/fees", () => {
  it("returns fee data sorted by 24h fees", async () => {
    vi.mocked(llama.getFeesRevenue).mockResolvedValue({
      protocols: [
        { name: "Ethereum", total24h: 10e6, total7d: 70e6, total30d: 300e6, category: "Chain" },
        { name: "Uniswap", total24h: 5e6, total7d: 35e6, total30d: 150e6, category: "DEX" },
      ],
    });

    const res = await app.request("/api/defi/fees");
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.data[0].name).toBe("Ethereum");
  });

  it("propagates source errors as 500", async () => {
    vi.mocked(llama.getFeesRevenue).mockRejectedValue(new Error("fail"));

    const res = await app.request("/api/defi/fees");
    expect(res.status).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/defi/bridges
// ═══════════════════════════════════════════════════════════════

describe("GET /api/defi/bridges", () => {
  it("returns bridge data sorted by volume", async () => {
    vi.mocked(llama.getBridges).mockResolvedValue({
      bridges: [
        { id: 1, name: "portal", displayName: "Portal", volumePrevDay: 100e6, chains: ["Ethereum", "Solana"] },
        { id: 2, name: "stargate", displayName: "Stargate", volumePrevDay: 200e6, chains: ["Ethereum", "Arbitrum"] },
      ],
    });

    const res = await app.request("/api/defi/bridges");
    expect(res.status).toBe(200);

    const json = await res.json();
    // Stargate first (higher volume)
    expect(json.data[0].name).toBe("Stargate");
  });

  it("propagates source errors as 500", async () => {
    vi.mocked(llama.getBridges).mockRejectedValue(new Error("fail"));

    const res = await app.request("/api/defi/bridges");
    expect(res.status).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/defi/raises
// ═══════════════════════════════════════════════════════════════

describe("GET /api/defi/raises", () => {
  it("returns fundraising data sorted by date", async () => {
    vi.mocked(llama.getRaises).mockResolvedValue({
      raises: [
        { name: "Project A", amount: 10e6, round: "Series A", date: 1700000000, category: "DeFi", leadInvestors: ["a16z"] },
        { name: "Project B", amount: 5e6, round: "Seed", date: 1700100000, category: "NFT", leadInvestors: ["Paradigm"] },
      ],
    });

    const res = await app.request("/api/defi/raises?limit=10");
    expect(res.status).toBe(200);

    const json = await res.json();
    // Project B first (more recent)
    expect(json.data[0].name).toBe("Project B");
  });

  it("propagates source errors as 500", async () => {
    vi.mocked(llama.getRaises).mockRejectedValue(new Error("fail"));

    const res = await app.request("/api/defi/raises");
    expect(res.status).toBe(500);
  });
});
