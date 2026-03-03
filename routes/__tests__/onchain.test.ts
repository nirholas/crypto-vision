/**
 * Integration tests for on-chain routes.
 *
 * Mocks the alternative and defillama source adapters.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";

// ─── Mock sources ────────────────────────────────────────────

vi.mock("../../sources/alternative.js", () => ({
  getBitcoinFees: vi.fn(),
  getBitcoinHashrate: vi.fn(),
  dexTokenPairs: vi.fn(),
}));

vi.mock("../../sources/defillama.js", () => ({
  getTokenPrices: vi.fn(),
}));

import * as alt from "../../sources/alternative.js";
import * as llama from "../../sources/defillama.js";
import { onchainRoutes } from "../onchain.js";

const app = new Hono().route("/api/onchain", onchainRoutes);

beforeEach(() => {
  vi.clearAllMocks();
});

// ═══════════════════════════════════════════════════════════════
// GET /api/onchain/gas
// ═══════════════════════════════════════════════════════════════

describe("GET /api/onchain/gas", () => {
  it("returns bitcoin gas/fee data", async () => {
    vi.mocked(alt.getBitcoinFees).mockResolvedValue({
      fastestFee: 50,
      halfHourFee: 30,
      hourFee: 20,
      economyFee: 10,
      minimumFee: 5,
    });

    const res = await app.request("/api/onchain/gas");
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.data.bitcoin).toMatchObject({
      fastest: 50,
      halfHour: 30,
      hour: 20,
      economy: 10,
      minimum: 5,
      unit: "sat/vB",
    });
    expect(json).toHaveProperty("timestamp");
  });

  it("propagates source errors as 500", async () => {
    vi.mocked(alt.getBitcoinFees).mockRejectedValue(new Error("mempool down"));

    const res = await app.request("/api/onchain/gas");
    expect(res.status).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/onchain/bitcoin/fees
// ═══════════════════════════════════════════════════════════════

describe("GET /api/onchain/bitcoin/fees", () => {
  it("returns bitcoin fee estimates", async () => {
    vi.mocked(alt.getBitcoinFees).mockResolvedValue({
      fastestFee: 50,
      halfHourFee: 30,
      hourFee: 20,
      economyFee: 10,
      minimumFee: 5,
    });

    const res = await app.request("/api/onchain/bitcoin/fees");
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.data).toMatchObject({
      fastestFee: 50,
      halfHourFee: 30,
      unit: "sat/vB",
    });
  });

  it("propagates source errors as 500", async () => {
    vi.mocked(alt.getBitcoinFees).mockRejectedValue(new Error("timeout"));

    const res = await app.request("/api/onchain/bitcoin/fees");
    expect(res.status).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/onchain/bitcoin/stats
// ═══════════════════════════════════════════════════════════════

describe("GET /api/onchain/bitcoin/stats", () => {
  it("returns bitcoin network stats", async () => {
    vi.mocked(alt.getBitcoinHashrate).mockResolvedValue({
      currentHashrate: 5e20,
      currentDifficulty: 7e13,
    });

    const res = await app.request("/api/onchain/bitcoin/stats");
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.data.currentHashrate).toBe(5e20);
    expect(json.data.currentDifficulty).toBe(7e13);
  });

  it("propagates source errors as 500", async () => {
    vi.mocked(alt.getBitcoinHashrate).mockRejectedValue(new Error("fail"));

    const res = await app.request("/api/onchain/bitcoin/stats");
    expect(res.status).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/onchain/token/:address
// ═══════════════════════════════════════════════════════════════

describe("GET /api/onchain/token/:address", () => {
  it("returns token pairs data", async () => {
    vi.mocked(alt.dexTokenPairs).mockResolvedValue({
      pairs: [
        {
          chainId: "ethereum",
          dexId: "uniswap",
          pairAddress: "0xpair1",
          baseToken: { address: "0xtoken", name: "Pepe", symbol: "PEPE" },
          quoteToken: { address: "0xweth", name: "WETH", symbol: "WETH" },
          priceNative: "0.0001",
          priceUsd: "0.15",
          txns: { h24: { buys: 500, sells: 400 } },
          volume: { h24: 1e6 },
          liquidity: { usd: 5e6 },
          fdv: 1e9,
          pairCreatedAt: 1700000000000,
        },
      ],
    });

    const res = await app.request("/api/onchain/token/0xtoken");
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.data.token).toMatchObject({ name: "Pepe", symbol: "PEPE" });
    expect(json.data.pairs).toHaveLength(1);
    expect(json.data.pairs[0].chain).toBe("ethereum");
  });

  it("returns 404 when token has no pairs", async () => {
    vi.mocked(alt.dexTokenPairs).mockResolvedValue({ pairs: [] });

    const res = await app.request("/api/onchain/token/0xnonexistent");
    expect(res.status).toBe(404);

    const json = await res.json();
    expect(json.error).toMatch(/not found/i);
    expect(json.data).toBeNull();
  });

  it("returns 404 when pairs is null", async () => {
    vi.mocked(alt.dexTokenPairs).mockResolvedValue({ pairs: null } as any);

    const res = await app.request("/api/onchain/token/0xbad");
    expect(res.status).toBe(404);
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/onchain/prices
// ═══════════════════════════════════════════════════════════════

describe("GET /api/onchain/prices", () => {
  it("returns multi-chain token prices", async () => {
    vi.mocked(llama.getTokenPrices).mockResolvedValue({
      coins: {
        "ethereum:0xabc": { price: 1800, symbol: "WETH", timestamp: 1700000000 },
      },
    });

    const res = await app.request("/api/onchain/prices?coins=ethereum:0xabc");
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.data["ethereum:0xabc"]).toMatchObject({ price: 1800, symbol: "WETH" });
  });

  it("returns 400 when coins param is missing", async () => {
    const res = await app.request("/api/onchain/prices");
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.error).toMatch(/coins/i);
  });
});
