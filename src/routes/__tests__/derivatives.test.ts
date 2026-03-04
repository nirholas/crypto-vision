/**
 * Integration tests for Derivatives routes.
 *
 * Mocks the CoinGlass source adapter so no real HTTP calls are made.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";

// ─── Mock sources BEFORE importing routes ────────────────────

vi.mock("../../sources/coinglass.js", () => ({
  getFundingRates: vi.fn(),
  getOpenInterest: vi.fn(),
  getOIByExchange: vi.fn(),
  getLiquidations: vi.fn(),
  getLongShortRatio: vi.fn(),
}));

import * as glass from "../../sources/coinglass.js";
import { derivativesRoutes } from "../derivatives.js";

const app = new Hono().route("/api/derivatives", derivativesRoutes);

beforeEach(() => {
  vi.clearAllMocks();
});

// ═══════════════════════════════════════════════════════════════
// GET /api/derivatives/funding
// ═══════════════════════════════════════════════════════════════

describe("GET /api/derivatives/funding", () => {
  it("returns mapped funding rates", async () => {
    vi.mocked(glass.getFundingRates).mockResolvedValue({
      data: [
        {
          symbol: "BTC",
          uMarginList: [
            { exchangeName: "Binance", rate: 0.0001, nextFundingTime: 1709500800000 },
            { exchangeName: "OKX", rate: 0.00015, nextFundingTime: null },
          ],
        },
      ],
    } as any);

    const res = await app.request("/api/derivatives/funding");
    expect(res.status).toBe(200);

    const json = (await res.json()) as Record<string, any>;
    expect(json.data).toHaveLength(1);
    expect(json.data[0].symbol).toBe("BTC");
    expect(json.data[0].exchanges).toHaveLength(2);
    expect(json.data[0].exchanges[0]).toMatchObject({
      exchange: "Binance",
      rate: 0.0001,
    });
    expect(json.data[0].exchanges[1].nextFundingTime).toBeNull();
    expect(json).toHaveProperty("timestamp");
  });

  it("propagates source errors as 500", async () => {
    vi.mocked(glass.getFundingRates).mockRejectedValue(new Error("CoinGlass down"));

    const res = await app.request("/api/derivatives/funding");
    expect(res.status).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/derivatives/funding/:symbol
// ═══════════════════════════════════════════════════════════════

describe("GET /api/derivatives/funding/:symbol", () => {
  it("returns funding rates for a specific symbol", async () => {
    vi.mocked(glass.getFundingRates).mockResolvedValue({
      data: [
        {
          symbol: "ETH",
          uMarginList: [
            { exchangeName: "Binance", rate: 0.0002, nextFundingTime: 1709500800000 },
          ],
        },
      ],
    } as any);

    const res = await app.request("/api/derivatives/funding/eth");
    expect(res.status).toBe(200);

    const json = (await res.json()) as Record<string, any>;
    expect(json.data.symbol).toBe("ETH");
    expect(json.data.exchanges).toHaveLength(1);
    expect(json.data.exchanges[0].exchange).toBe("Binance");
    // Verify symbol is uppercased
    expect(glass.getFundingRates).toHaveBeenCalledWith("ETH");
  });

  it("returns 404 when symbol not found", async () => {
    vi.mocked(glass.getFundingRates).mockResolvedValue({
      data: [{ symbol: "BTC", uMarginList: [] }],
    } as any);

    const res = await app.request("/api/derivatives/funding/NONEXISTENT");
    expect(res.status).toBe(404);

    const json = (await res.json()) as Record<string, any>;
    expect(json.error).toContain("not found");
  });

  it("propagates source errors as 500", async () => {
    vi.mocked(glass.getFundingRates).mockRejectedValue(new Error("API error"));

    const res = await app.request("/api/derivatives/funding/btc");
    expect(res.status).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/derivatives/oi
// ═══════════════════════════════════════════════════════════════

describe("GET /api/derivatives/oi", () => {
  it("returns sorted open interest data", async () => {
    vi.mocked(glass.getOpenInterest).mockResolvedValue({
      data: [
        { symbol: "ETH", openInterest: 5e9, openInterestAmount: 1.5e6, h1Change: 0.5, h4Change: 1.2, h24Change: 3.0 },
        { symbol: "BTC", openInterest: 15e9, openInterestAmount: 250000, h1Change: 0.2, h4Change: 0.8, h24Change: 2.0 },
      ],
    } as any);

    const res = await app.request("/api/derivatives/oi");
    expect(res.status).toBe(200);

    const json = (await res.json()) as Record<string, any>;
    expect(json.data).toHaveLength(2);
    // BTC first (higher OI)
    expect(json.data[0].symbol).toBe("BTC");
    expect(json.data[0].openInterest).toBe(15e9);
    expect(json.data[1].symbol).toBe("ETH");
    expect(json).toHaveProperty("timestamp");
  });

  it("respects limit query parameter", async () => {
    const data = Array.from({ length: 10 }, (_, i) => ({
      symbol: `SYM${i}`,
      openInterest: (10 - i) * 1e9,
      openInterestAmount: 100000,
      h1Change: 0,
      h4Change: 0,
      h24Change: 0,
    }));
    vi.mocked(glass.getOpenInterest).mockResolvedValue({ data } as any);

    const res = await app.request("/api/derivatives/oi?limit=3");
    expect(res.status).toBe(200);

    const json = (await res.json()) as Record<string, any>;
    expect(json.data).toHaveLength(3);
  });

  it("propagates source errors as 500", async () => {
    vi.mocked(glass.getOpenInterest).mockRejectedValue(new Error("timeout"));

    const res = await app.request("/api/derivatives/oi");
    expect(res.status).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/derivatives/oi/:symbol
// ═══════════════════════════════════════════════════════════════

describe("GET /api/derivatives/oi/:symbol", () => {
  it("returns OI breakdown by exchange", async () => {
    vi.mocked(glass.getOIByExchange).mockResolvedValue({
      data: [
        { exchangeName: "Binance", openInterest: 8e9, openInterestAmount: 130000, volUsd: 2e9, h24Change: 1.5 },
        { exchangeName: "OKX", openInterest: 3e9, openInterestAmount: 50000, volUsd: 1e9, h24Change: -0.5 },
      ],
    } as any);

    const res = await app.request("/api/derivatives/oi/btc");
    expect(res.status).toBe(200);

    const json = (await res.json()) as Record<string, any>;
    expect(json.symbol).toBe("BTC");
    expect(json.data).toHaveLength(2);
    // Sorted by OI
    expect(json.data[0].exchange).toBe("Binance");
    expect(json.data[0].openInterest).toBe(8e9);
    expect(json.data[1].exchange).toBe("OKX");
  });

  it("propagates source errors as 500", async () => {
    vi.mocked(glass.getOIByExchange).mockRejectedValue(new Error("API error"));

    const res = await app.request("/api/derivatives/oi/eth");
    expect(res.status).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/derivatives/liquidations
// ═══════════════════════════════════════════════════════════════

describe("GET /api/derivatives/liquidations", () => {
  it("returns sorted liquidation data", async () => {
    vi.mocked(glass.getLiquidations).mockResolvedValue({
      data: [
        {
          symbol: "ETH",
          h24LongLiquidationUsd: 10e6, h24ShortLiquidationUsd: 5e6,
          h1LongLiquidationUsd: 1e6, h1ShortLiquidationUsd: 0.5e6,
          h4LongLiquidationUsd: 3e6, h4ShortLiquidationUsd: 2e6,
          h12LongLiquidationUsd: 7e6, h12ShortLiquidationUsd: 3e6,
        },
        {
          symbol: "BTC",
          h24LongLiquidationUsd: 50e6, h24ShortLiquidationUsd: 30e6,
          h1LongLiquidationUsd: 5e6, h1ShortLiquidationUsd: 3e6,
          h4LongLiquidationUsd: 15e6, h4ShortLiquidationUsd: 10e6,
          h12LongLiquidationUsd: 35e6, h12ShortLiquidationUsd: 20e6,
        },
      ],
    } as any);

    const res = await app.request("/api/derivatives/liquidations");
    expect(res.status).toBe(200);

    const json = (await res.json()) as Record<string, any>;
    expect(json.data).toHaveLength(2);
    // BTC first (higher total liquidations)
    expect(json.data[0].symbol).toBe("BTC");
    expect(json.data[0].total24h).toBe(80e6);
    expect(json.data[0].long24h).toBe(50e6);
    expect(json.data[0].short24h).toBe(30e6);
    expect(json.data[1].symbol).toBe("ETH");
    expect(json).toHaveProperty("timestamp");
  });

  it("respects limit query parameter", async () => {
    const data = Array.from({ length: 10 }, (_, i) => ({
      symbol: `SYM${i}`,
      h24LongLiquidationUsd: (10 - i) * 1e6,
      h24ShortLiquidationUsd: (10 - i) * 0.5e6,
      h1LongLiquidationUsd: 0, h1ShortLiquidationUsd: 0,
      h4LongLiquidationUsd: 0, h4ShortLiquidationUsd: 0,
      h12LongLiquidationUsd: 0, h12ShortLiquidationUsd: 0,
    }));
    vi.mocked(glass.getLiquidations).mockResolvedValue({ data } as any);

    const res = await app.request("/api/derivatives/liquidations?limit=2");
    expect(res.status).toBe(200);

    const json = (await res.json()) as Record<string, any>;
    expect(json.data).toHaveLength(2);
  });

  it("propagates source errors as 500", async () => {
    vi.mocked(glass.getLiquidations).mockRejectedValue(new Error("fail"));

    const res = await app.request("/api/derivatives/liquidations");
    expect(res.status).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/derivatives/long-short/:symbol
// ═══════════════════════════════════════════════════════════════

describe("GET /api/derivatives/long-short/:symbol", () => {
  it("returns long/short ratio history", async () => {
    vi.mocked(glass.getLongShortRatio).mockResolvedValue({
      data: [
        { longRate: 55.5, shortRate: 44.5, longVolUsd: 1e9, shortVolUsd: 0.8e9, createTime: 1709500800000 },
        { longRate: 52.0, shortRate: 48.0, longVolUsd: 0.9e9, shortVolUsd: 0.85e9, createTime: 1709504400000 },
      ],
    } as any);

    const res = await app.request("/api/derivatives/long-short/btc");
    expect(res.status).toBe(200);

    const json = (await res.json()) as Record<string, any>;
    expect(json.symbol).toBe("BTC");
    expect(json.interval).toBe("h1"); // default interval
    expect(json.data).toHaveLength(2);
    expect(json.data[0].longRate).toBe(55.5);
    expect(json.data[0].shortRate).toBe(44.5);
    expect(json.data[0]).toHaveProperty("timestamp");
    expect(json).toHaveProperty("timestamp");
  });

  it("passes interval query parameter to source", async () => {
    vi.mocked(glass.getLongShortRatio).mockResolvedValue({ data: [] } as any);

    const res = await app.request("/api/derivatives/long-short/eth?interval=h4");
    expect(res.status).toBe(200);

    expect(glass.getLongShortRatio).toHaveBeenCalledWith("ETH", "h4");
    const json = (await res.json()) as Record<string, any>;
    expect(json.interval).toBe("h4");
  });

  it("propagates source errors as 500", async () => {
    vi.mocked(glass.getLongShortRatio).mockRejectedValue(new Error("API error"));

    const res = await app.request("/api/derivatives/long-short/btc");
    expect(res.status).toBe(500);
  });
});
