/**
 * Integration tests for DEX / Pool routes.
 *
 * Mocks the GeckoTerminal source adapter so no real HTTP calls are made.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";

// ─── Mock sources BEFORE importing routes ────────────────────

vi.mock("../../sources/geckoterminal.js", () => ({
  getNetworks: vi.fn(),
  getTrendingPools: vi.fn(),
  getNewPools: vi.fn(),
  getTopPools: vi.fn(),
  getPoolOHLCV: vi.fn(),
  getTokenInfo: vi.fn(),
  getTokenPools: vi.fn(),
  searchPools: vi.fn(),
}));

vi.mock("../../lib/validation.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/validation.js")>();
  return { ...actual };
});

import * as gt from "../../sources/geckoterminal.js";
import { dexRoutes } from "../dex.js";

const app = new Hono().route("/api/dex", dexRoutes);

beforeEach(() => {
  vi.clearAllMocks();
});

// ═══════════════════════════════════════════════════════════════
// GET /api/dex/networks
// ═══════════════════════════════════════════════════════════════

describe("GET /api/dex/networks", () => {
  it("returns mapped network data", async () => {
    vi.mocked(gt.getNetworks).mockResolvedValue({
      data: [
        {
          id: "eth",
          type: "network",
          attributes: {
            name: "Ethereum",
            coingecko_asset_platform_id: "ethereum",
          },
        },
        {
          id: "solana",
          type: "network",
          attributes: {
            name: "Solana",
            coingecko_asset_platform_id: "solana",
          },
        },
      ],
    } as any);

    const res = await app.request("/api/dex/networks");
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.data).toHaveLength(2);
    expect(json.data[0]).toMatchObject({ id: "eth", name: "Ethereum" });
    expect(json.data[1]).toMatchObject({ id: "solana", name: "Solana" });
    expect(json).toHaveProperty("timestamp");
  });

  it("propagates source errors as 500", async () => {
    vi.mocked(gt.getNetworks).mockRejectedValue(new Error("API down"));

    const res = await app.request("/api/dex/networks");
    expect(res.status).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/dex/trending-pools
// ═══════════════════════════════════════════════════════════════

describe("GET /api/dex/trending-pools", () => {
  const mockPool = {
    id: "eth_0xabc",
    attributes: {
      name: "WETH/USDC",
      address: "0xabc123",
      base_token_price_usd: "3500.50",
      fdv_usd: "420000000000",
      reserve_in_usd: "100000000",
      volume_usd: { h24: "50000000" },
      price_change_percentage: { h24: "2.5" },
      transactions: { h24: { buys: 500, sells: 300 } },
    },
  };

  it("returns trending pools across all chains", async () => {
    vi.mocked(gt.getTrendingPools).mockResolvedValue({ data: [mockPool] } as any);

    const res = await app.request("/api/dex/trending-pools");
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.data).toHaveLength(1);
    expect(json.data[0]).toMatchObject({
      id: "eth_0xabc",
      name: "WETH/USDC",
      address: "0xabc123",
    });
    expect(json).toHaveProperty("timestamp");
  });

  it("propagates source errors as 500", async () => {
    vi.mocked(gt.getTrendingPools).mockRejectedValue(new Error("timeout"));

    const res = await app.request("/api/dex/trending-pools");
    expect(res.status).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/dex/trending-pools/:network
// ═══════════════════════════════════════════════════════════════

describe("GET /api/dex/trending-pools/:network", () => {
  it("returns trending pools for a specific network", async () => {
    vi.mocked(gt.getTrendingPools).mockResolvedValue({
      data: [
        {
          id: "sol_pool1",
          attributes: {
            name: "SOL/USDC",
            address: "SoLPool1Addr",
            base_token_price_usd: "150",
            fdv_usd: "65000000000",
            reserve_in_usd: "50000000",
            volume_usd: { h24: "25000000" },
            price_change_percentage: { h24: "1.2" },
            transactions: { h24: { buys: 200, sells: 100 } },
          },
        },
      ],
    } as any);

    const res = await app.request("/api/dex/trending-pools/solana");
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.data).toHaveLength(1);
    expect(json.network).toBe("solana");
    expect(gt.getTrendingPools).toHaveBeenCalledWith("solana");
  });

  it("propagates source errors as 500", async () => {
    vi.mocked(gt.getTrendingPools).mockRejectedValue(new Error("API error"));

    const res = await app.request("/api/dex/trending-pools/eth");
    expect(res.status).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/dex/new-pools
// ═══════════════════════════════════════════════════════════════

describe("GET /api/dex/new-pools", () => {
  const mockNewPool = {
    id: "eth_new1",
    attributes: {
      name: "NEW/USDC",
      address: "0xnew123",
      base_token_price_usd: "0.05",
      volume_usd: { h24: "100000" },
      reserve_in_usd: "50000",
      pool_created_at: "2026-03-01T00:00:00Z",
    },
  };

  it("returns newly created pools", async () => {
    vi.mocked(gt.getNewPools).mockResolvedValue({ data: [mockNewPool] } as any);

    const res = await app.request("/api/dex/new-pools");
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.data).toHaveLength(1);
    expect(json.data[0]).toMatchObject({
      id: "eth_new1",
      name: "NEW/USDC",
      createdAt: "2026-03-01T00:00:00Z",
    });
  });

  it("propagates source errors as 500", async () => {
    vi.mocked(gt.getNewPools).mockRejectedValue(new Error("fail"));

    const res = await app.request("/api/dex/new-pools");
    expect(res.status).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/dex/new-pools/:network
// ═══════════════════════════════════════════════════════════════

describe("GET /api/dex/new-pools/:network", () => {
  it("returns new pools for a specific network", async () => {
    vi.mocked(gt.getNewPools).mockResolvedValue({
      data: [
        {
          id: "bsc_pool1",
          attributes: {
            name: "TOKEN/BNB",
            address: "0xbsc123",
            base_token_price_usd: "1.5",
            volume_usd: { h24: "200000" },
            reserve_in_usd: "80000",
            pool_created_at: "2026-03-02T00:00:00Z",
          },
        },
      ],
    } as any);

    const res = await app.request("/api/dex/new-pools/bsc");
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.data).toHaveLength(1);
    expect(json.network).toBe("bsc");
    expect(gt.getNewPools).toHaveBeenCalledWith("bsc");
  });

  it("propagates source errors as 500", async () => {
    vi.mocked(gt.getNewPools).mockRejectedValue(new Error("fail"));

    const res = await app.request("/api/dex/new-pools/eth");
    expect(res.status).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/dex/top-pools/:network
// ═══════════════════════════════════════════════════════════════

describe("GET /api/dex/top-pools/:network", () => {
  it("returns top pools for a network", async () => {
    vi.mocked(gt.getTopPools).mockResolvedValue({
      data: [
        {
          id: "eth_top1",
          attributes: {
            name: "WETH/USDT",
            address: "0xtop1",
            base_token_price_usd: "3500",
            volume_usd: { h24: "100000000" },
            reserve_in_usd: "500000000",
            price_change_percentage: { h24: "-0.5" },
          },
        },
      ],
    } as any);

    const res = await app.request("/api/dex/top-pools/eth");
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.data).toHaveLength(1);
    expect(json.data[0].name).toBe("WETH/USDT");
    expect(gt.getTopPools).toHaveBeenCalledWith("eth");
  });

  it("propagates source errors as 500", async () => {
    vi.mocked(gt.getTopPools).mockRejectedValue(new Error("fail"));

    const res = await app.request("/api/dex/top-pools/eth");
    expect(res.status).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/dex/pool/:network/:address
// ═══════════════════════════════════════════════════════════════

describe("GET /api/dex/pool/:network/:address", () => {
  it("returns OHLCV candle data", async () => {
    vi.mocked(gt.getPoolOHLCV).mockResolvedValue({
      data: {
        attributes: {
          ohlcv_list: [
            [1709251200, 3500, 3550, 3480, 3520, 1000000],
            [1709254800, 3520, 3600, 3510, 3580, 1200000],
          ],
        },
      },
    } as any);

    const res = await app.request("/api/dex/pool/eth/0xabcdef1234567890abcdef1234567890abcdef12");
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.data).toHaveLength(2);
    expect(json.data[0]).toMatchObject({
      timestamp: 1709251200,
      open: 3500,
      high: 3550,
      low: 3480,
      close: 3520,
      volume: 1000000,
    });
    expect(json.network).toBe("eth");
    expect(json.pool).toBe("0xabcdef1234567890abcdef1234567890abcdef12");
  });

  it("propagates source errors as 500", async () => {
    vi.mocked(gt.getPoolOHLCV).mockRejectedValue(new Error("fail"));

    const res = await app.request("/api/dex/pool/eth/0xabcdef1234567890abcdef1234567890abcdef12");
    expect(res.status).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/dex/token/:network/:address
// ═══════════════════════════════════════════════════════════════

describe("GET /api/dex/token/:network/:address", () => {
  it("returns token info with pools", async () => {
    vi.mocked(gt.getTokenInfo).mockResolvedValue({
      data: {
        attributes: {
          name: "Wrapped Ether",
          symbol: "WETH",
          address: "0xabcdef1234567890abcdef1234567890abcdef12",
          price_usd: "3500",
          fdv_usd: "420000000000",
          volume_usd: { h24: "50000000" },
          market_cap_usd: "400000000000",
          total_supply: "120000000",
          coingecko_coin_id: "weth",
        },
      },
    } as any);
    vi.mocked(gt.getTokenPools).mockResolvedValue({
      data: [
        {
          id: "pool1",
          attributes: {
            name: "WETH/USDC",
            volume_usd: { h24: "25000000" },
            reserve_in_usd: "100000000",
          },
        },
      ],
    } as any);

    const res = await app.request("/api/dex/token/eth/0xabcdef1234567890abcdef1234567890abcdef12");
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.data.token).toMatchObject({
      name: "Wrapped Ether",
      symbol: "WETH",
    });
    expect(json.data.pools).toHaveLength(1);
    expect(json.data.pools[0].name).toBe("WETH/USDC");
  });

  it("handles token info failure gracefully", async () => {
    vi.mocked(gt.getTokenInfo).mockRejectedValue(new Error("not found"));
    vi.mocked(gt.getTokenPools).mockResolvedValue({ data: [] } as any);

    const res = await app.request("/api/dex/token/eth/0xabcdef1234567890abcdef1234567890abcdef12");
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.data.token).toBeNull();
    expect(json.data.pools).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/dex/pool-search
// ═══════════════════════════════════════════════════════════════

describe("GET /api/dex/pool-search", () => {
  it("returns search results", async () => {
    vi.mocked(gt.searchPools).mockResolvedValue({
      data: [
        {
          id: "search_result_1",
          attributes: {
            name: "PEPE/WETH",
            address: "0xsearch1",
            fdv_usd: "1000000",
            reserve_in_usd: "500000",
            volume_usd: { h24: "300000" },
            price_change_percentage: { h24: "10.5" },
          },
        },
      ],
    } as any);

    const res = await app.request("/api/dex/pool-search?q=pepe");
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.data).toHaveLength(1);
    expect(json.data[0].name).toBe("PEPE/WETH");
  });

  it("returns 400 when query is missing", async () => {
    const res = await app.request("/api/dex/pool-search");
    expect(res.status).toBe(400);
  });
});
