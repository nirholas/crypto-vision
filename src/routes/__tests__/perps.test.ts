/**
 * Integration tests for perpetual / cross-exchange routes.
 *
 * Mocks all source adapters (bybit, okx, hyperliquid, dydx, deribit)
 * so no real HTTP calls are made.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";

// ─── Mock sources BEFORE importing routes ────────────────────

vi.mock("../../sources/bybit.js", () => ({
  getTickers: vi.fn(),
  getOrderBook: vi.fn(),
  getKlines: vi.fn(),
  getFundingRateHistory: vi.fn(),
  getOpenInterest: vi.fn(),
  getRecentTrades: vi.fn(),
}));

vi.mock("../../sources/okx.js", () => ({
  getSwapTickers: vi.fn(),
  getOrderbook: vi.fn(),
  getCandles: vi.fn(),
  getFundingHistory: vi.fn(),
  getOpenInterest: vi.fn(),
}));

vi.mock("../../sources/hyperliquid.js", () => ({
  getMetaAndAssetCtxs: vi.fn(),
  getFundingHistory: vi.fn(),
  getRecentTrades: vi.fn(),
  getUserState: vi.fn(),
  getOpenOrders: vi.fn(),
  getAllMids: vi.fn(),
  getL1Stats: vi.fn(),
}));

vi.mock("../../sources/dydx.js", () => ({
  getMarkets: vi.fn(),
  getMarket: vi.fn(),
  getCandles: vi.fn(),
  getOrderbook: vi.fn(),
  getTrades: vi.fn(),
  getFundingRates: vi.fn(),
  getSparklines: vi.fn(),
}));

vi.mock("../../sources/deribit.js", () => ({
  getInstruments: vi.fn(),
  getBookSummary: vi.fn(),
  getVolatilityIndex: vi.fn(),
  getHistoricalVolatility: vi.fn(),
  getOrderbook: vi.fn(),
  getCurrencies: vi.fn(),
}));

import * as bybit from "../../sources/bybit.js";
import * as okx from "../../sources/okx.js";
import * as hl from "../../sources/hyperliquid.js";
import * as dydx from "../../sources/dydx.js";
import * as deribit from "../../sources/deribit.js";
import { perpsRoutes } from "../perps.js";

// ─── Set up app ──────────────────────────────────────────────

const app = new Hono().route("/api/perps", perpsRoutes);

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Shared mock data ────────────────────────────────────────

const mockBybitTickers = [
  {
    symbol: "BTCUSDT",
    lastPrice: "60000",
    highPrice24h: "61000",
    lowPrice24h: "59000",
    volume24h: "5000",
    turnover24h: "300000000",
    fundingRate: "0.0001",
    openInterest: "1000",
    openInterestValue: "60000000",
  },
  {
    symbol: "ETHUSDT",
    lastPrice: "3500",
    highPrice24h: "3600",
    lowPrice24h: "3400",
    volume24h: "50000",
    turnover24h: "175000000",
    fundingRate: "0.0003",
    openInterest: "20000",
    openInterestValue: "70000000",
  },
];

const mockOkxSwaps = [
  {
    instId: "BTC-USDT-SWAP",
    last: "60050",
    askPx: "60060",
    bidPx: "60040",
    vol24h: "3000",
  },
];

const mockHlMeta: [{ universe: Array<{ name: string; szDecimals: number }> }, Array<{ funding: string; openInterest: string; markPx: string }>] = [
  { universe: [{ name: "BTC", szDecimals: 5 }, { name: "ETH", szDecimals: 4 }] },
  [
    { funding: "0.00015", openInterest: "500", markPx: "60000" },
    { funding: "0.00025", openInterest: "10000", markPx: "3500" },
  ],
];

const mockDydxMarkets = {
  markets: {
    "BTC-USD": {
      market: "BTC-USD",
      status: "ACTIVE",
      oraclePrice: "60000",
      indexPrice: "60000",
      openInterest: "800",
    },
    "ETH-USD": {
      market: "ETH-USD",
      status: "ACTIVE",
      oraclePrice: "3500",
      indexPrice: "3500",
      openInterest: "15000",
    },
  },
};

// ═══════════════════════════════════════════════════════════════
// GET /api/perps/overview
// ═══════════════════════════════════════════════════════════════

describe("GET /api/perps/overview", () => {
  it("returns multi-exchange overview data", async () => {
    vi.mocked(bybit.getTickers).mockResolvedValue(mockBybitTickers as any);
    vi.mocked(okx.getSwapTickers).mockResolvedValue(mockOkxSwaps as any);
    vi.mocked(hl.getMetaAndAssetCtxs).mockResolvedValue(mockHlMeta as any);
    vi.mocked(dydx.getMarkets).mockResolvedValue(mockDydxMarkets as any);

    const res = await app.request("/api/perps/overview");
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.bybit.count).toBe(2);
    expect(json.okx.count).toBe(1);
    expect(json.hyperliquid.count).toBe(2);
    expect(json.dydx.count).toBe(2);
    expect(json).toHaveProperty("timestamp");
  });

  it("handles partial failures gracefully", async () => {
    vi.mocked(bybit.getTickers).mockRejectedValue(new Error("timeout"));
    vi.mocked(okx.getSwapTickers).mockRejectedValue(new Error("timeout"));
    vi.mocked(hl.getMetaAndAssetCtxs).mockRejectedValue(new Error("timeout"));
    vi.mocked(dydx.getMarkets).mockRejectedValue(new Error("timeout"));

    const res = await app.request("/api/perps/overview");
    expect(res.status).toBe(200);

    const json = await res.json();
    // All catch blocks return empty defaults
    expect(json.bybit.count).toBe(0);
    expect(json.okx.count).toBe(0);
    expect(json.hyperliquid).toBeNull();
    expect(json.dydx.count).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/perps/funding
// ═══════════════════════════════════════════════════════════════

describe("GET /api/perps/funding", () => {
  it("returns cross-exchange funding rates sorted by absolute value", async () => {
    vi.mocked(bybit.getTickers).mockResolvedValue(mockBybitTickers as any);
    vi.mocked(okx.getSwapTickers).mockResolvedValue(mockOkxSwaps as any);
    vi.mocked(hl.getMetaAndAssetCtxs).mockResolvedValue(mockHlMeta as any);

    const res = await app.request("/api/perps/funding");
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.data.length).toBeGreaterThan(0);
    expect(json.data[0]).toHaveProperty("symbol");
    expect(json).toHaveProperty("timestamp");
  });

  it("handles all sources failing gracefully", async () => {
    vi.mocked(bybit.getTickers).mockRejectedValue(new Error("fail"));
    vi.mocked(okx.getSwapTickers).mockRejectedValue(new Error("fail"));
    vi.mocked(hl.getMetaAndAssetCtxs).mockRejectedValue(new Error("fail"));

    const res = await app.request("/api/perps/funding");
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.data).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/perps/funding/:symbol
// ═══════════════════════════════════════════════════════════════

describe("GET /api/perps/funding/:symbol", () => {
  it("returns funding history for a symbol across exchanges", async () => {
    vi.mocked(bybit.getFundingRateHistory).mockResolvedValue([{ symbol: "BTCUSDT", fundingRate: "0.0001", fundingRateTimestamp: "1700000000000" }] as any);
    vi.mocked(okx.getFundingHistory).mockResolvedValue([{ instId: "BTC-USDT-SWAP", fundingRate: "0.00012", fundingTime: "1700000000000" }] as any);
    vi.mocked(hl.getFundingHistory).mockResolvedValue([{ coin: "BTC", fundingRate: "0.00015", time: 1700000000000 }] as any);
    vi.mocked(dydx.getFundingRates).mockResolvedValue({ historicalFunding: [{ rate: "0.00008", effectiveAt: "2024-01-01T00:00:00Z" }] } as any);

    const res = await app.request("/api/perps/funding/btc");
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.symbol).toBe("BTC");
    expect(json.bybit).toHaveLength(1);
    expect(json.okx).toHaveLength(1);
    expect(json.hyperliquid).toHaveLength(1);
    expect(json.dydx).toHaveLength(1);
  });

  it("handles partial source failures gracefully", async () => {
    vi.mocked(bybit.getFundingRateHistory).mockRejectedValue(new Error("fail"));
    vi.mocked(okx.getFundingHistory).mockRejectedValue(new Error("fail"));
    vi.mocked(hl.getFundingHistory).mockRejectedValue(new Error("fail"));
    vi.mocked(dydx.getFundingRates).mockRejectedValue(new Error("fail"));

    const res = await app.request("/api/perps/funding/btc");
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.symbol).toBe("BTC");
    expect(json.bybit).toEqual([]);
    expect(json.okx).toEqual([]);
    expect(json.hyperliquid).toEqual([]);
    expect(json.dydx).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/perps/oi
// ═══════════════════════════════════════════════════════════════

describe("GET /api/perps/oi", () => {
  it("returns open interest overview", async () => {
    vi.mocked(bybit.getTickers).mockResolvedValue(mockBybitTickers as any);
    vi.mocked(okx.getOpenInterest).mockResolvedValue([
      { instId: "BTC-USDT-SWAP", oi: "800", oiCcy: "800" },
    ] as any);

    const res = await app.request("/api/perps/oi");
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.bybit.length).toBeGreaterThan(0);
    expect(json.bybit[0]).toHaveProperty("symbol");
    expect(json.bybit[0]).toHaveProperty("openInterestValue");
    expect(json).toHaveProperty("timestamp");
  });

  it("handles source failures gracefully", async () => {
    vi.mocked(bybit.getTickers).mockRejectedValue(new Error("fail"));
    vi.mocked(okx.getOpenInterest).mockRejectedValue(new Error("fail"));

    const res = await app.request("/api/perps/oi");
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.bybit).toEqual([]);
    expect(json.okx).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/perps/oi/:symbol
// ═══════════════════════════════════════════════════════════════

describe("GET /api/perps/oi/:symbol", () => {
  it("returns open interest for a specific symbol", async () => {
    vi.mocked(bybit.getOpenInterest).mockResolvedValue([{ openInterest: "1000", symbol: "BTCUSDT" }] as any);
    vi.mocked(okx.getOpenInterest).mockResolvedValue([
      { instId: "BTC-USDT-SWAP", oi: "800" },
    ] as any);
    vi.mocked(dydx.getMarket).mockResolvedValue({ market: "BTC-USD", openInterest: "700" } as any);

    const res = await app.request("/api/perps/oi/btc");
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.symbol).toBe("BTC");
    expect(json.bybit).toHaveLength(1);
    expect(json.dydx).toHaveProperty("openInterest");
  });

  it("handles all exchanges failing gracefully", async () => {
    vi.mocked(bybit.getOpenInterest).mockRejectedValue(new Error("fail"));
    vi.mocked(okx.getOpenInterest).mockRejectedValue(new Error("fail"));
    vi.mocked(dydx.getMarket).mockRejectedValue(new Error("fail"));

    const res = await app.request("/api/perps/oi/btc");
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.symbol).toBe("BTC");
    expect(json.bybit).toEqual([]);
    expect(json.dydx).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/perps/markets
// ═══════════════════════════════════════════════════════════════

describe("GET /api/perps/markets", () => {
  it("returns Hyperliquid markets", async () => {
    vi.mocked(hl.getMetaAndAssetCtxs).mockResolvedValue(mockHlMeta as any);

    const res = await app.request("/api/perps/markets");
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.exchange).toBe("hyperliquid");
    expect(json.count).toBe(2);
    expect(json.data).toHaveLength(2);
  });

  it("propagates source errors as 500", async () => {
    vi.mocked(hl.getMetaAndAssetCtxs).mockRejectedValue(new Error("fail"));

    const res = await app.request("/api/perps/markets");
    expect(res.status).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/perps/markets/dydx
// ═══════════════════════════════════════════════════════════════

describe("GET /api/perps/markets/dydx", () => {
  it("returns dYdX markets", async () => {
    vi.mocked(dydx.getMarkets).mockResolvedValue(mockDydxMarkets as any);

    const res = await app.request("/api/perps/markets/dydx");
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.exchange).toBe("dydx");
    expect(json.count).toBe(2);
  });

  it("propagates source errors as 500", async () => {
    vi.mocked(dydx.getMarkets).mockRejectedValue(new Error("fail"));

    const res = await app.request("/api/perps/markets/dydx");
    expect(res.status).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/perps/markets/bybit
// ═══════════════════════════════════════════════════════════════

describe("GET /api/perps/markets/bybit", () => {
  it("returns Bybit linear markets", async () => {
    vi.mocked(bybit.getTickers).mockResolvedValue(mockBybitTickers as any);

    const res = await app.request("/api/perps/markets/bybit");
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.exchange).toBe("bybit");
    expect(json.count).toBe(2);
  });

  it("propagates source errors as 500", async () => {
    vi.mocked(bybit.getTickers).mockRejectedValue(new Error("fail"));

    const res = await app.request("/api/perps/markets/bybit");
    expect(res.status).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/perps/markets/okx
// ═══════════════════════════════════════════════════════════════

describe("GET /api/perps/markets/okx", () => {
  it("returns OKX swap markets", async () => {
    vi.mocked(okx.getSwapTickers).mockResolvedValue(mockOkxSwaps as any);

    const res = await app.request("/api/perps/markets/okx");
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.exchange).toBe("okx");
    expect(json.count).toBe(1);
  });

  it("propagates source errors as 500", async () => {
    vi.mocked(okx.getSwapTickers).mockRejectedValue(new Error("fail"));

    const res = await app.request("/api/perps/markets/okx");
    expect(res.status).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/perps/orderbook/:exchange/:symbol
// ═══════════════════════════════════════════════════════════════

describe("GET /api/perps/orderbook/:exchange/:symbol", () => {
  const mockOrderbook = {
    bids: [["60000", "1.5"]],
    asks: [["60100", "2.0"]],
  };

  it("returns Bybit orderbook", async () => {
    vi.mocked(bybit.getOrderBook).mockResolvedValue(mockOrderbook as any);

    const res = await app.request("/api/perps/orderbook/bybit/BTC");
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.exchange).toBe("bybit");
    expect(json.symbol).toBe("BTC");
    expect(json.data).toHaveProperty("bids");
  });

  it("returns OKX orderbook", async () => {
    vi.mocked(okx.getOrderbook).mockResolvedValue(mockOrderbook as any);

    const res = await app.request("/api/perps/orderbook/okx/BTC");
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.exchange).toBe("okx");
  });

  it("returns dYdX orderbook", async () => {
    vi.mocked(dydx.getOrderbook).mockResolvedValue(mockOrderbook as any);

    const res = await app.request("/api/perps/orderbook/dydx/BTC");
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.exchange).toBe("dydx");
  });

  it("returns Deribit orderbook", async () => {
    vi.mocked(deribit.getOrderbook).mockResolvedValue(mockOrderbook as any);

    const res = await app.request("/api/perps/orderbook/deribit/BTC");
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.exchange).toBe("deribit");
  });

  it("returns 400 for unknown exchange", async () => {
    const res = await app.request("/api/perps/orderbook/unknown/BTC");
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.error).toMatch(/unknown exchange/i);
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/perps/trades/:exchange/:symbol
// ═══════════════════════════════════════════════════════════════

describe("GET /api/perps/trades/:exchange/:symbol", () => {
  it("returns Bybit recent trades", async () => {
    vi.mocked(bybit.getRecentTrades).mockResolvedValue([
      { symbol: "BTCUSDT", side: "Buy", price: "60000", size: "0.5", time: "1700000000000" },
    ] as any);

    const res = await app.request("/api/perps/trades/bybit/BTC");
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.exchange).toBe("bybit");
    expect(json.symbol).toBe("BTC");
    expect(json.data).toHaveLength(1);
  });

  it("returns dYdX trades", async () => {
    vi.mocked(dydx.getTrades).mockResolvedValue({ trades: [{ id: "1", price: "60000", size: "0.5", side: "BUY" }] } as any);

    const res = await app.request("/api/perps/trades/dydx/BTC");
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.exchange).toBe("dydx");
    expect(json.data).toHaveLength(1);
  });

  it("returns Hyperliquid trades", async () => {
    vi.mocked(hl.getRecentTrades).mockResolvedValue([
      { coin: "BTC", side: "A", px: "60000", sz: "0.5", time: 1700000000000 },
    ] as any);

    const res = await app.request("/api/perps/trades/hyperliquid/BTC");
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.exchange).toBe("hyperliquid");
  });

  it("returns 400 for unknown exchange", async () => {
    const res = await app.request("/api/perps/trades/unknown/BTC");
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.error).toMatch(/unknown exchange/i);
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/perps/klines/:exchange/:symbol
// ═══════════════════════════════════════════════════════════════

describe("GET /api/perps/klines/:exchange/:symbol", () => {
  it("returns Bybit klines", async () => {
    vi.mocked(bybit.getKlines).mockResolvedValue([
      { open: "59000", high: "61000", low: "58500", close: "60500", volume: "1000", startTime: "1700000000000" },
    ] as any);

    const res = await app.request("/api/perps/klines/bybit/BTC?interval=60&limit=100");
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.exchange).toBe("bybit");
    expect(json.data).toHaveLength(1);
  });

  it("returns OKX candles", async () => {
    vi.mocked(okx.getCandles).mockResolvedValue([
      ["1700000000000", "59000", "61000", "58500", "60500", "1000"],
    ] as any);

    const res = await app.request("/api/perps/klines/okx/BTC?interval=60");
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.exchange).toBe("okx");
  });

  it("returns dYdX candles", async () => {
    vi.mocked(dydx.getCandles).mockResolvedValue({
      candles: [{ startedAt: "2024-01-01T00:00:00Z", open: "59000", high: "61000", low: "58500", close: "60500" }],
    } as any);

    const res = await app.request("/api/perps/klines/dydx/BTC?interval=60&limit=50");
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.exchange).toBe("dydx");
    expect(json.data).toHaveLength(1);
  });

  it("returns 400 for unknown exchange", async () => {
    const res = await app.request("/api/perps/klines/unknown/BTC");
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.error).toMatch(/unknown exchange/i);
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/perps/options/:currency
// ═══════════════════════════════════════════════════════════════

describe("GET /api/perps/options/:currency", () => {
  it("returns options data for a currency", async () => {
    vi.mocked(deribit.getInstruments).mockResolvedValue([
      { instrument_name: "BTC-20240301-60000-C", kind: "option", strike: 60000 },
      { instrument_name: "BTC-20240301-60000-P", kind: "option", strike: 60000 },
    ] as any);
    vi.mocked(deribit.getBookSummary).mockResolvedValue([
      { instrument_name: "BTC-20240301-60000-C", volume: 100, open_interest: 500 },
    ] as any);
    vi.mocked(deribit.getVolatilityIndex).mockResolvedValue({ index_name: "BTC_DVOL", value: 55.2 } as any);

    const res = await app.request("/api/perps/options/btc");
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.currency).toBe("BTC");
    expect(json.totalInstruments).toBe(2);
    expect(json.bookSummary).toHaveLength(1);
    expect(json.volatilityIndex).toBeTruthy();
  });

  it("handles partial failures gracefully", async () => {
    vi.mocked(deribit.getInstruments).mockRejectedValue(new Error("fail"));
    vi.mocked(deribit.getBookSummary).mockRejectedValue(new Error("fail"));
    vi.mocked(deribit.getVolatilityIndex).mockRejectedValue(new Error("fail"));

    const res = await app.request("/api/perps/options/btc");
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.totalInstruments).toBe(0);
    expect(json.bookSummary).toEqual([]);
    expect(json.volatilityIndex).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/perps/volatility/:currency
// ═══════════════════════════════════════════════════════════════

describe("GET /api/perps/volatility/:currency", () => {
  it("returns volatility data for a currency", async () => {
    vi.mocked(deribit.getVolatilityIndex).mockResolvedValue({ index_name: "BTC_DVOL", value: 55.2 } as any);
    vi.mocked(deribit.getHistoricalVolatility).mockResolvedValue([
      [1700000000000, 52.1],
      [1700100000000, 53.4],
    ] as any);

    const res = await app.request("/api/perps/volatility/btc");
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.currency).toBe("BTC");
    expect(json.impliedVolatility).toBeTruthy();
    expect(json.historicalVolatility).toHaveLength(2);
  });

  it("propagates errors as 500", async () => {
    vi.mocked(deribit.getVolatilityIndex).mockRejectedValue(new Error("fail"));
    vi.mocked(deribit.getHistoricalVolatility).mockRejectedValue(new Error("fail"));

    const res = await app.request("/api/perps/volatility/btc");
    expect(res.status).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/perps/dydx/sparklines
// ═══════════════════════════════════════════════════════════════

describe("GET /api/perps/dydx/sparklines", () => {
  it("returns sparkline data", async () => {
    vi.mocked(dydx.getSparklines).mockResolvedValue({
      "BTC-USD": ["60000", "60100", "59900"],
      "ETH-USD": ["3500", "3510", "3490"],
    } as any);

    const res = await app.request("/api/perps/dydx/sparklines");
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.data["BTC-USD"]).toHaveLength(3);
    expect(json.period).toBe("ONE_DAY");
  });

  it("passes period query parameter", async () => {
    vi.mocked(dydx.getSparklines).mockResolvedValue({} as any);

    const res = await app.request("/api/perps/dydx/sparklines?period=SEVEN_DAYS");
    expect(res.status).toBe(200);

    expect(dydx.getSparklines).toHaveBeenCalledWith("SEVEN_DAYS");
  });

  it("propagates errors as 500", async () => {
    vi.mocked(dydx.getSparklines).mockRejectedValue(new Error("fail"));

    const res = await app.request("/api/perps/dydx/sparklines");
    expect(res.status).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/perps/hl/user/:address
// ═══════════════════════════════════════════════════════════════

describe("GET /api/perps/hl/user/:address", () => {
  it("returns user state and orders", async () => {
    vi.mocked(hl.getUserState).mockResolvedValue({
      marginSummary: { accountValue: "10000", totalMarginUsed: "5000" },
      assetPositions: [],
    } as any);
    vi.mocked(hl.getOpenOrders).mockResolvedValue([
      { oid: 1, coin: "BTC", side: "A", limitPx: "60000", sz: "0.1" },
    ] as any);

    const res = await app.request("/api/perps/hl/user/0x1234");
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.state).toHaveProperty("marginSummary");
    expect(json.orders).toHaveLength(1);
  });

  it("propagates errors as 500", async () => {
    vi.mocked(hl.getUserState).mockRejectedValue(new Error("fail"));
    vi.mocked(hl.getOpenOrders).mockRejectedValue(new Error("fail"));

    const res = await app.request("/api/perps/hl/user/0x1234");
    expect(res.status).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/perps/hl/mids
// ═══════════════════════════════════════════════════════════════

describe("GET /api/perps/hl/mids", () => {
  it("returns all mid prices", async () => {
    vi.mocked(hl.getAllMids).mockResolvedValue({ BTC: "60000", ETH: "3500" } as any);

    const res = await app.request("/api/perps/hl/mids");
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.data.BTC).toBe("60000");
    expect(json).toHaveProperty("timestamp");
  });

  it("propagates errors as 500", async () => {
    vi.mocked(hl.getAllMids).mockRejectedValue(new Error("fail"));

    const res = await app.request("/api/perps/hl/mids");
    expect(res.status).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/perps/hl/stats
// ═══════════════════════════════════════════════════════════════

describe("GET /api/perps/hl/stats", () => {
  it("returns L1 stats", async () => {
    vi.mocked(hl.getL1Stats).mockResolvedValue({ totalVolume: "1000000", totalUsers: 5000 } as any);

    const res = await app.request("/api/perps/hl/stats");
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.data).toHaveProperty("totalVolume");
    expect(json).toHaveProperty("timestamp");
  });

  it("propagates errors as 500", async () => {
    vi.mocked(hl.getL1Stats).mockRejectedValue(new Error("fail"));

    const res = await app.request("/api/perps/hl/stats");
    expect(res.status).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/perps/deribit/currencies
// ═══════════════════════════════════════════════════════════════

describe("GET /api/perps/deribit/currencies", () => {
  it("returns available currencies", async () => {
    vi.mocked(deribit.getCurrencies).mockResolvedValue([
      { currency: "BTC", coinId: "bitcoin" },
      { currency: "ETH", coinId: "ethereum" },
    ] as any);

    const res = await app.request("/api/perps/deribit/currencies");
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.data).toHaveLength(2);
    expect(json).toHaveProperty("timestamp");
  });

  it("propagates errors as 500", async () => {
    vi.mocked(deribit.getCurrencies).mockRejectedValue(new Error("fail"));

    const res = await app.request("/api/perps/deribit/currencies");
    expect(res.status).toBe(500);
  });
});
