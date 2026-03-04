/**
 * Integration tests for Exchanges routes.
 *
 * Mocks CoinCap, Bybit, Deribit, and OKX source adapters.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";

// ─── Mock sources BEFORE importing routes ────────────────────

vi.mock("../../sources/coincap.js", () => ({
  getExchanges: vi.fn(),
  getExchange: vi.fn(),
  getMarkets: vi.fn(),
  getRates: vi.fn(),
  getRate: vi.fn(),
  getCandles: vi.fn(),
}));

vi.mock("../../sources/bybit.js", () => ({
  getInsurance: vi.fn(),
  getRiskLimit: vi.fn(),
  getTickers: vi.fn(),
}));

vi.mock("../../sources/deribit.js", () => ({
  getIndexPrice: vi.fn(),
  getFundingRate: vi.fn(),
}));

vi.mock("../../sources/okx.js", () => ({
  getSpotTickers: vi.fn(),
  getTicker: vi.fn(),
  getInstruments: vi.fn(),
  getFundingRate: vi.fn(),
  getMarkPrice: vi.fn(),
}));

import * as coincap from "../../sources/coincap.js";
import * as bybit from "../../sources/bybit.js";
import * as deribit from "../../sources/deribit.js";
import * as okx from "../../sources/okx.js";
import { exchangesRoutes } from "../exchanges.js";

const app = new Hono().route("/api/exchanges", exchangesRoutes);

beforeEach(() => {
  vi.clearAllMocks();
});

// ═══════════════════════════════════════════════════════════════
// GET /api/exchanges/list
// ═══════════════════════════════════════════════════════════════

describe("GET /api/exchanges/list", () => {
  it("returns exchange list with count", async () => {
    vi.mocked(coincap.getExchanges).mockResolvedValue({
      data: [
        { exchangeId: "binance", name: "Binance", rank: "1", volume: "5000000000" },
        { exchangeId: "coinbase", name: "Coinbase", rank: "2", volume: "2000000000" },
      ],
    } as any);

    const res = await app.request("/api/exchanges/list");
    expect(res.status).toBe(200);

    const json = (await res.json()) as Record<string, any>;
    expect(json.count).toBe(2);
    expect(json.data).toHaveLength(2);
    expect(json.data[0].exchangeId).toBe("binance");
  });

  it("propagates source errors as 500", async () => {
    vi.mocked(coincap.getExchanges).mockRejectedValue(new Error("CoinCap down"));

    const res = await app.request("/api/exchanges/list");
    expect(res.status).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/exchanges/rates
// ═══════════════════════════════════════════════════════════════

describe("GET /api/exchanges/rates", () => {
  it("returns conversion rates with count", async () => {
    vi.mocked(coincap.getRates).mockResolvedValue({
      data: [
        { id: "bitcoin", symbol: "BTC", rateUsd: "60000.00" },
        { id: "ethereum", symbol: "ETH", rateUsd: "3500.00" },
      ],
    } as any);

    const res = await app.request("/api/exchanges/rates");
    expect(res.status).toBe(200);

    const json = (await res.json()) as Record<string, any>;
    expect(json.count).toBe(2);
    expect(json.data[0].id).toBe("bitcoin");
  });

  it("propagates source errors as 500", async () => {
    vi.mocked(coincap.getRates).mockRejectedValue(new Error("fail"));

    const res = await app.request("/api/exchanges/rates");
    expect(res.status).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/exchanges/rates/:id
// ═══════════════════════════════════════════════════════════════

describe("GET /api/exchanges/rates/:id", () => {
  it("returns a single rate", async () => {
    vi.mocked(coincap.getRate).mockResolvedValue({
      data: { id: "bitcoin", symbol: "BTC", rateUsd: "60000" },
    } as any);

    const res = await app.request("/api/exchanges/rates/bitcoin");
    expect(res.status).toBe(200);

    const json = (await res.json()) as Record<string, any>;
    expect(json.data.id).toBe("bitcoin");
    expect(coincap.getRate).toHaveBeenCalledWith("bitcoin");
  });

  it("propagates source errors as 500", async () => {
    vi.mocked(coincap.getRate).mockRejectedValue(new Error("not found"));

    const res = await app.request("/api/exchanges/rates/invalid");
    expect(res.status).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/exchanges/bybit/insurance
// ═══════════════════════════════════════════════════════════════

describe("GET /api/exchanges/bybit/insurance", () => {
  it("returns Bybit insurance fund data", async () => {
    vi.mocked(bybit.getInsurance).mockResolvedValue({
      result: { list: [{ coin: "BTC", balance: "15000", value: "900000000" }] },
    } as any);

    const res = await app.request("/api/exchanges/bybit/insurance?coin=BTC");
    expect(res.status).toBe(200);

    const json = (await res.json()) as Record<string, any>;
    expect(json.result.list[0].coin).toBe("BTC");
    expect(bybit.getInsurance).toHaveBeenCalledWith("BTC");
  });

  it("defaults to BTC when no coin specified", async () => {
    vi.mocked(bybit.getInsurance).mockResolvedValue({ result: { list: [] } } as any);

    await app.request("/api/exchanges/bybit/insurance");
    expect(bybit.getInsurance).toHaveBeenCalledWith("BTC");
  });

  it("propagates source errors as 500", async () => {
    vi.mocked(bybit.getInsurance).mockRejectedValue(new Error("Bybit API error"));

    const res = await app.request("/api/exchanges/bybit/insurance");
    expect(res.status).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/exchanges/bybit/risk-limit
// ═══════════════════════════════════════════════════════════════

describe("GET /api/exchanges/bybit/risk-limit", () => {
  it("returns risk limit data", async () => {
    vi.mocked(bybit.getRiskLimit).mockResolvedValue({
      result: { list: [{ symbol: "BTCUSDT", riskLimitValue: "2000000" }] },
    } as any);

    const res = await app.request("/api/exchanges/bybit/risk-limit?symbol=BTCUSDT&category=linear");
    expect(res.status).toBe(200);

    expect(bybit.getRiskLimit).toHaveBeenCalledWith("linear", "BTCUSDT");
  });

  it("uses defaults when no params specified", async () => {
    vi.mocked(bybit.getRiskLimit).mockResolvedValue({ result: { list: [] } } as any);

    await app.request("/api/exchanges/bybit/risk-limit");
    expect(bybit.getRiskLimit).toHaveBeenCalledWith("linear", "BTCUSDT");
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/exchanges/deribit/index
// ═══════════════════════════════════════════════════════════════

describe("GET /api/exchanges/deribit/index", () => {
  it("returns Deribit index price", async () => {
    vi.mocked(deribit.getIndexPrice).mockResolvedValue({
      index_name: "btc_usd",
      estimated_delivery_price: 60000,
      index_price: 60000,
    } as any);

    const res = await app.request("/api/exchanges/deribit/index?currency=BTC");
    expect(res.status).toBe(200);

    const json = (await res.json()) as Record<string, any>;
    expect(json.index_price).toBe(60000);
    expect(deribit.getIndexPrice).toHaveBeenCalledWith("BTC");
  });

  it("defaults to BTC when no currency specified", async () => {
    vi.mocked(deribit.getIndexPrice).mockResolvedValue({} as any);

    await app.request("/api/exchanges/deribit/index");
    expect(deribit.getIndexPrice).toHaveBeenCalledWith("BTC");
  });

  it("propagates source errors as 500", async () => {
    vi.mocked(deribit.getIndexPrice).mockRejectedValue(new Error("Deribit down"));

    const res = await app.request("/api/exchanges/deribit/index");
    expect(res.status).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/exchanges/coincap/candles
// ═══════════════════════════════════════════════════════════════

describe("GET /api/exchanges/coincap/candles", () => {
  it("returns candle data with metadata", async () => {
    vi.mocked(coincap.getCandles).mockResolvedValue({
      data: [
        { open: 60000, high: 61000, low: 59000, close: 60500, volume: 1000, period: 1709500800000 },
      ],
    } as any);

    const res = await app.request(
      "/api/exchanges/coincap/candles?exchange=binance&base=bitcoin&quote=tether&interval=h1",
    );
    expect(res.status).toBe(200);

    const json = (await res.json()) as Record<string, any>;
    expect(json.exchange).toBe("binance");
    expect(json.base).toBe("bitcoin");
    expect(json.quote).toBe("tether");
    expect(json.interval).toBe("h1");
    expect(coincap.getCandles).toHaveBeenCalledWith("binance", "bitcoin", "tether", "h1");
  });

  it("uses default params when none provided", async () => {
    vi.mocked(coincap.getCandles).mockResolvedValue({ data: [] } as any);

    await app.request("/api/exchanges/coincap/candles");
    expect(coincap.getCandles).toHaveBeenCalledWith("binance", "bitcoin", "tether", "h1");
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/exchanges/okx/spot
// ═══════════════════════════════════════════════════════════════

describe("GET /api/exchanges/okx/spot", () => {
  it("returns OKX spot tickers (max 200)", async () => {
    const tickers = Array.from({ length: 300 }, (_, i) => ({
      instId: `ASSET${i}-USDT`,
      last: `${1000 + i}`,
    }));
    vi.mocked(okx.getSpotTickers).mockResolvedValue(tickers as any);

    const res = await app.request("/api/exchanges/okx/spot");
    expect(res.status).toBe(200);

    const json = (await res.json()) as Record<string, any>;
    expect(json.count).toBe(300);
    expect(json.data).toHaveLength(200);
  });

  it("propagates source errors as 500", async () => {
    vi.mocked(okx.getSpotTickers).mockRejectedValue(new Error("OKX down"));

    const res = await app.request("/api/exchanges/okx/spot");
    expect(res.status).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/exchanges/okx/ticker/:instId
// ═══════════════════════════════════════════════════════════════

describe("GET /api/exchanges/okx/ticker/:instId", () => {
  it("returns ticker for a specific instrument", async () => {
    vi.mocked(okx.getTicker).mockResolvedValue({
      instId: "BTC-USDT",
      last: "60000",
      vol24h: "5000",
    } as any);

    const res = await app.request("/api/exchanges/okx/ticker/BTC-USDT");
    expect(res.status).toBe(200);

    const json = (await res.json()) as Record<string, any>;
    expect(json.instId).toBe("BTC-USDT");
    expect(okx.getTicker).toHaveBeenCalledWith("BTC-USDT");
  });

  it("propagates source errors as 500", async () => {
    vi.mocked(okx.getTicker).mockRejectedValue(new Error("fail"));

    const res = await app.request("/api/exchanges/okx/ticker/INVALID");
    expect(res.status).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/exchanges/okx/instruments
// ═══════════════════════════════════════════════════════════════

describe("GET /api/exchanges/okx/instruments", () => {
  it("returns instruments with count", async () => {
    vi.mocked(okx.getInstruments).mockResolvedValue([
      { instId: "BTC-USDT", instType: "SPOT" },
      { instId: "ETH-USDT", instType: "SPOT" },
    ] as any);

    const res = await app.request("/api/exchanges/okx/instruments?type=SPOT");
    expect(res.status).toBe(200);

    const json = (await res.json()) as Record<string, any>;
    expect(json.count).toBe(2);
    expect(okx.getInstruments).toHaveBeenCalledWith("SPOT");
  });

  it("defaults to SPOT type", async () => {
    vi.mocked(okx.getInstruments).mockResolvedValue([] as any);

    await app.request("/api/exchanges/okx/instruments");
    expect(okx.getInstruments).toHaveBeenCalledWith("SPOT");
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/exchanges/okx/funding/:instId
// ═══════════════════════════════════════════════════════════════

describe("GET /api/exchanges/okx/funding/:instId", () => {
  it("returns funding rate for instrument", async () => {
    vi.mocked(okx.getFundingRate).mockResolvedValue({
      instId: "BTC-USDT-SWAP",
      fundingRate: "0.0001",
      nextFundingRate: "0.00012",
    } as any);

    const res = await app.request("/api/exchanges/okx/funding/BTC-USDT-SWAP");
    expect(res.status).toBe(200);

    const json = (await res.json()) as Record<string, any>;
    expect(json.fundingRate).toBe("0.0001");
    expect(okx.getFundingRate).toHaveBeenCalledWith("BTC-USDT-SWAP");
  });

  it("propagates source errors as 500", async () => {
    vi.mocked(okx.getFundingRate).mockRejectedValue(new Error("fail"));

    const res = await app.request("/api/exchanges/okx/funding/INVALID");
    expect(res.status).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/exchanges/okx/mark-price
// ═══════════════════════════════════════════════════════════════

describe("GET /api/exchanges/okx/mark-price", () => {
  it("returns mark prices with count", async () => {
    vi.mocked(okx.getMarkPrice).mockResolvedValue([
      { instId: "BTC-USDT-SWAP", markPx: "60000" },
    ] as any);

    const res = await app.request("/api/exchanges/okx/mark-price?type=SWAP");
    expect(res.status).toBe(200);

    const json = (await res.json()) as Record<string, any>;
    expect(json.count).toBe(1);
    expect(okx.getMarkPrice).toHaveBeenCalledWith("SWAP", undefined);
  });

  it("passes instId when provided", async () => {
    vi.mocked(okx.getMarkPrice).mockResolvedValue([] as any);

    await app.request("/api/exchanges/okx/mark-price?type=SWAP&instId=BTC-USDT-SWAP");
    expect(okx.getMarkPrice).toHaveBeenCalledWith("SWAP", "BTC-USDT-SWAP");
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/exchanges/bybit/spot
// ═══════════════════════════════════════════════════════════════

describe("GET /api/exchanges/bybit/spot", () => {
  it("returns Bybit spot tickers (max 200)", async () => {
    const tickers = Array.from({ length: 250 }, (_, i) => ({
      symbol: `SYM${i}USDT`,
      lastPrice: `${1000 + i}`,
    }));
    vi.mocked(bybit.getTickers).mockResolvedValue(tickers as any);

    const res = await app.request("/api/exchanges/bybit/spot");
    expect(res.status).toBe(200);

    const json = (await res.json()) as Record<string, any>;
    expect(json.count).toBe(250);
    expect(json.data).toHaveLength(200);
    expect(bybit.getTickers).toHaveBeenCalledWith("spot");
  });

  it("propagates source errors as 500", async () => {
    vi.mocked(bybit.getTickers).mockRejectedValue(new Error("Bybit down"));

    const res = await app.request("/api/exchanges/bybit/spot");
    expect(res.status).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/exchanges/deribit/funding/:instrument
// ═══════════════════════════════════════════════════════════════

describe("GET /api/exchanges/deribit/funding/:instrument", () => {
  it("returns funding rate for instrument", async () => {
    vi.mocked(deribit.getFundingRate).mockResolvedValue({
      interest_8h: 0.0001,
      current_funding: 0.00012,
    } as any);

    const res = await app.request("/api/exchanges/deribit/funding/BTC-PERPETUAL");
    expect(res.status).toBe(200);

    const json = (await res.json()) as Record<string, any>;
    expect(json.current_funding).toBe(0.00012);
    expect(deribit.getFundingRate).toHaveBeenCalledWith("BTC-PERPETUAL");
  });

  it("propagates source errors as 500", async () => {
    vi.mocked(deribit.getFundingRate).mockRejectedValue(new Error("fail"));

    const res = await app.request("/api/exchanges/deribit/funding/INVALID");
    expect(res.status).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/exchanges/:id/markets
// ═══════════════════════════════════════════════════════════════

describe("GET /api/exchanges/:id/markets", () => {
  it("returns markets for an exchange", async () => {
    vi.mocked(coincap.getMarkets).mockResolvedValue({
      data: [
        { exchangeId: "binance", baseId: "bitcoin", quoteId: "tether", priceUsd: "60000" },
      ],
    } as any);

    const res = await app.request("/api/exchanges/binance/markets");
    expect(res.status).toBe(200);

    const json = (await res.json()) as Record<string, any>;
    expect(json.exchange).toBe("binance");
    expect(json.count).toBe(1);
    expect(json.data[0].baseId).toBe("bitcoin");
    expect(coincap.getMarkets).toHaveBeenCalledWith("binance");
  });

  it("propagates source errors as 500", async () => {
    vi.mocked(coincap.getMarkets).mockRejectedValue(new Error("not found"));

    const res = await app.request("/api/exchanges/invalid/markets");
    expect(res.status).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/exchanges/:id — Single exchange detail
// ═══════════════════════════════════════════════════════════════

describe("GET /api/exchanges/:id", () => {
  it("returns single exchange detail", async () => {
    vi.mocked(coincap.getExchange).mockResolvedValue({
      data: { exchangeId: "binance", name: "Binance", rank: "1" },
    } as any);

    const res = await app.request("/api/exchanges/binance");
    expect(res.status).toBe(200);

    const json = (await res.json()) as Record<string, any>;
    expect(json.data.exchangeId).toBe("binance");
  });

  it("propagates source errors as 500", async () => {
    vi.mocked(coincap.getExchange).mockRejectedValue(new Error("not found"));

    const res = await app.request("/api/exchanges/invalid");
    expect(res.status).toBe(500);
  });
});
