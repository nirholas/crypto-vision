/**
 * Integration tests for Macro / TradFi routes.
 *
 * Mocks the Yahoo Finance macro source adapter so no real HTTP calls are made.
 */

import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Mock sources BEFORE importing routes ────────────────────

vi.mock("../../sources/macro.js", () => ({
  getMacroOverview: vi.fn(),
  getStockIndices: vi.fn(),
  getCommodities: vi.fn(),
  getBondYields: vi.fn(),
  getVolatility: vi.fn(),
  getDXY: vi.fn(),
  getCryptoBenchmarks: vi.fn(),
  getQuote: vi.fn(),
}));

import * as macro from "../../sources/macro.js";
import { macroRoutes } from "../macro.js";

const app = new Hono().route("/api/macro", macroRoutes);

beforeEach(() => {
  vi.clearAllMocks();
});

// ═══════════════════════════════════════════════════════════════
// GET /api/macro/overview
// ═══════════════════════════════════════════════════════════════

describe("GET /api/macro/overview", () => {
  it("returns full macro overview", async () => {
    vi.mocked(macro.getMacroOverview).mockResolvedValue({
      indices: [{ symbol: "^SPX", name: "S&P 500", price: 5200, change: 0.5 }],
      commodities: [{ symbol: "GC=F", name: "Gold", price: 2100 }],
      bonds: [{ symbol: "^TNX", name: "10Y Treasury", price: 4.3 }],
      vix: { symbol: "^VIX", name: "VIX", price: 15 },
      dxy: { symbol: "DX-Y.NYB", name: "US Dollar Index", price: 104 },
      crypto: [{ symbol: "BTC-USD", name: "Bitcoin", price: 60000 }],
      timestamp: "2026-03-03T00:00:00Z",
    } as any);

    const res = await app.request("/api/macro/overview");
    expect(res.status).toBe(200);

    const json = (await res.json()) as Record<string, any>;
    expect(json.indices).toBeDefined();
    expect(json.commodities).toBeDefined();
    expect(json.bonds).toBeDefined();
    expect(json.vix).toBeDefined();
    expect(json.dxy).toBeDefined();
    expect(json.crypto).toBeDefined();
  });

  it("propagates source errors as 500", async () => {
    vi.mocked(macro.getMacroOverview).mockRejectedValue(new Error("Yahoo Finance down"));

    const res = await app.request("/api/macro/overview");
    expect(res.status).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/macro/indices
// ═══════════════════════════════════════════════════════════════

describe("GET /api/macro/indices", () => {
  it("returns stock market indices", async () => {
    vi.mocked(macro.getStockIndices).mockResolvedValue([
      { symbol: "^SPX", name: "S&P 500", price: 5200, change: 0.5 },
      { symbol: "^DJI", name: "Dow Jones", price: 39000, change: -0.2 },
    ] as any);

    const res = await app.request("/api/macro/indices");
    expect(res.status).toBe(200);

    const json = (await res.json()) as Record<string, any>;
    expect(json.data).toHaveLength(2);
    expect(json.data[0].symbol).toBe("^SPX");
    expect(json).toHaveProperty("timestamp");
  });

  it("propagates source errors as 500", async () => {
    vi.mocked(macro.getStockIndices).mockRejectedValue(new Error("fail"));

    const res = await app.request("/api/macro/indices");
    expect(res.status).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/macro/commodities
// ═══════════════════════════════════════════════════════════════

describe("GET /api/macro/commodities", () => {
  it("returns commodity prices", async () => {
    vi.mocked(macro.getCommodities).mockResolvedValue([
      { symbol: "GC=F", name: "Gold", price: 2100 },
      { symbol: "SI=F", name: "Silver", price: 24 },
      { symbol: "CL=F", name: "Crude Oil", price: 78 },
    ] as any);

    const res = await app.request("/api/macro/commodities");
    expect(res.status).toBe(200);

    const json = (await res.json()) as Record<string, any>;
    expect(json.data).toHaveLength(3);
    expect(json.data[0].name).toBe("Gold");
    expect(json).toHaveProperty("timestamp");
  });

  it("propagates source errors as 500", async () => {
    vi.mocked(macro.getCommodities).mockRejectedValue(new Error("fail"));

    const res = await app.request("/api/macro/commodities");
    expect(res.status).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/macro/bonds
// ═══════════════════════════════════════════════════════════════

describe("GET /api/macro/bonds", () => {
  it("returns treasury yields", async () => {
    vi.mocked(macro.getBondYields).mockResolvedValue([
      { symbol: "^TNX", name: "10Y Treasury Yield", price: 4.3 },
      { symbol: "^TYX", name: "30Y Treasury Yield", price: 4.5 },
    ] as any);

    const res = await app.request("/api/macro/bonds");
    expect(res.status).toBe(200);

    const json = (await res.json()) as Record<string, any>;
    expect(json.data).toHaveLength(2);
    expect(json).toHaveProperty("timestamp");
  });

  it("propagates source errors as 500", async () => {
    vi.mocked(macro.getBondYields).mockRejectedValue(new Error("fail"));

    const res = await app.request("/api/macro/bonds");
    expect(res.status).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/macro/vix
// ═══════════════════════════════════════════════════════════════

describe("GET /api/macro/vix", () => {
  it("returns VIX volatility data", async () => {
    vi.mocked(macro.getVolatility).mockResolvedValue({
      symbol: "^VIX",
      name: "CBOE Volatility Index",
      price: 15.5,
      change: -0.3,
    } as any);

    const res = await app.request("/api/macro/vix");
    expect(res.status).toBe(200);

    const json = (await res.json()) as Record<string, any>;
    expect(json.symbol).toBe("^VIX");
    expect(json.price).toBe(15.5);
  });

  it("handles null response", async () => {
    vi.mocked(macro.getVolatility).mockResolvedValue(null as any);

    const res = await app.request("/api/macro/vix");
    expect(res.status).toBe(200);

    const json = (await res.json()) as Record<string, any>;
    expect(json).toBeNull();
  });

  it("propagates source errors as 500", async () => {
    vi.mocked(macro.getVolatility).mockRejectedValue(new Error("fail"));

    const res = await app.request("/api/macro/vix");
    expect(res.status).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/macro/dxy
// ═══════════════════════════════════════════════════════════════

describe("GET /api/macro/dxy", () => {
  it("returns US Dollar index", async () => {
    vi.mocked(macro.getDXY).mockResolvedValue({
      symbol: "DX-Y.NYB",
      name: "US Dollar Index",
      price: 104.2,
      change: 0.15,
    } as any);

    const res = await app.request("/api/macro/dxy");
    expect(res.status).toBe(200);

    const json = (await res.json()) as Record<string, any>;
    expect(json.price).toBe(104.2);
  });

  it("handles null response", async () => {
    vi.mocked(macro.getDXY).mockResolvedValue(null as any);

    const res = await app.request("/api/macro/dxy");
    expect(res.status).toBe(200);
  });

  it("propagates source errors as 500", async () => {
    vi.mocked(macro.getDXY).mockRejectedValue(new Error("fail"));

    const res = await app.request("/api/macro/dxy");
    expect(res.status).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/macro/crypto
// ═══════════════════════════════════════════════════════════════

describe("GET /api/macro/crypto", () => {
  it("returns crypto benchmark prices", async () => {
    vi.mocked(macro.getCryptoBenchmarks).mockResolvedValue([
      { symbol: "BTC-USD", name: "Bitcoin USD", price: 60000 },
      { symbol: "ETH-USD", name: "Ethereum USD", price: 3500 },
    ] as any);

    const res = await app.request("/api/macro/crypto");
    expect(res.status).toBe(200);

    const json = (await res.json()) as Record<string, any>;
    expect(json.data).toHaveLength(2);
    expect(json.data[0].symbol).toBe("BTC-USD");
    expect(json).toHaveProperty("timestamp");
  });

  it("propagates source errors as 500", async () => {
    vi.mocked(macro.getCryptoBenchmarks).mockRejectedValue(new Error("fail"));

    const res = await app.request("/api/macro/crypto");
    expect(res.status).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/macro/quote/:symbol
// ═══════════════════════════════════════════════════════════════

describe("GET /api/macro/quote/:symbol", () => {
  it("returns raw Yahoo Finance quote", async () => {
    vi.mocked(macro.getQuote).mockResolvedValue({
      symbol: "AAPL",
      name: "Apple Inc.",
      price: 180.50,
      change: 1.2,
      changePercent: 0.67,
    } as any);

    const res = await app.request("/api/macro/quote/AAPL");
    expect(res.status).toBe(200);

    const json = (await res.json()) as Record<string, any>;
    expect(json.symbol).toBe("AAPL");
    expect(json.price).toBe(180.5);
    expect(macro.getQuote).toHaveBeenCalledWith("AAPL");
  });

  it("handles null (not found) response", async () => {
    vi.mocked(macro.getQuote).mockResolvedValue(null as any);

    const res = await app.request("/api/macro/quote/INVALID");
    expect(res.status).toBe(200);

    const json = (await res.json()) as Record<string, any>;
    expect(json).toBeNull();
  });

  it("propagates source errors as 500", async () => {
    vi.mocked(macro.getQuote).mockRejectedValue(new Error("fail"));

    const res = await app.request("/api/macro/quote/AAPL");
    expect(res.status).toBe(500);
  });
});
