/**
 * Tests for src/sources/bybit.ts
 *
 * ByBit uses fetchJSON via bybitFetch wrapper which unwraps
 * { retCode: 0, retMsg: "OK", result: T } envelopes.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../lib/fetcher.js", () => ({ fetchJSON: vi.fn() }));
vi.mock("../../lib/cache.js", () => ({
  cache: { wrap: vi.fn((_k: string, _t: number, fn: () => unknown) => fn()) },
}));

import { fetchJSON } from "../../lib/fetcher.js";
import {
  getTickers,
  getTicker,
  getKlines,
  getOrderBook,
  getRecentTrades,
  getFundingRate,
  getOpenInterest,
  getInstruments,
  getInsuranceFund,
  getRiskLimits,
  getLongShortRatio,
  getHistoricalVolatility,
} from "../bybit.js";

const mockFetch = fetchJSON as ReturnType<typeof vi.fn>;

/** Helper to wrap ByBit response envelope */
function bybitEnvelope<T>(result: T) {
  return { retCode: 0, retMsg: "OK", time: 1700000000000, result };
}

describe("bybit source adapter", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe("getTickers", () => {
    it("calls correct URL and unwraps result", async () => {
      const tickers = { list: [{ symbol: "BTCUSDT", lastPrice: "40000", highPrice24h: "41000", lowPrice24h: "39000", turnover24h: "1e9", volume24h: "25000", bid1Price: "39999", ask1Price: "40001", prevPrice24h: "39500", price24hPcnt: "0.0126" }], category: "linear" };
      mockFetch.mockResolvedValueOnce(bybitEnvelope(tickers));
      const result = await getTickers("linear");
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("https://api.bybit.com/v5/market/tickers?category=linear"),
      );
      expect(result.list).toHaveLength(1);
      expect(result.list[0].symbol).toBe("BTCUSDT");
    });

    it("throws on non-zero retCode", async () => {
      mockFetch.mockResolvedValueOnce({ retCode: 10001, retMsg: "params error", result: null });
      await expect(getTickers("linear")).rejects.toThrow();
    });

    it("throws on fetchJSON error", async () => {
      mockFetch.mockRejectedValueOnce(new Error("network"));
      await expect(getTickers("linear")).rejects.toThrow("network");
    });
  });

  describe("getTicker", () => {
    it("fetches single ticker", async () => {
      const data = { list: [{ symbol: "ETHUSDT", lastPrice: "2500", highPrice24h: "2600", lowPrice24h: "2400", turnover24h: "5e8", volume24h: "200000", bid1Price: "2499", ask1Price: "2501", prevPrice24h: "2450", price24hPcnt: "0.02" }], category: "linear" };
      mockFetch.mockResolvedValueOnce(bybitEnvelope(data));
      const result = await getTicker("linear", "ETHUSDT");
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("symbol=ETHUSDT"),
      );
      expect(result.list[0].symbol).toBe("ETHUSDT");
    });
  });

  describe("getKlines", () => {
    it("fetches klines", async () => {
      const data = { list: [["1700000000000", "40000", "41000", "39000", "40500", "100", "4000000"]], category: "linear", symbol: "BTCUSDT" };
      mockFetch.mockResolvedValueOnce(bybitEnvelope(data));
      const result = await getKlines("linear", "BTCUSDT", "60");
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("klines?category=linear&symbol=BTCUSDT&interval=60"),
      );
      expect(result.list).toHaveLength(1);
    });
  });

  describe("getOrderBook", () => {
    it("fetches orderbook", async () => {
      const data = { s: "BTCUSDT", b: [["39999", "1"]], a: [["40001", "1"]], ts: 1700000000000, u: 12345 };
      mockFetch.mockResolvedValueOnce(bybitEnvelope(data));
      const result = await getOrderBook("linear", "BTCUSDT");
      expect(result.b).toHaveLength(1);
      expect(result.a).toHaveLength(1);
    });
  });

  describe("getRecentTrades", () => {
    it("fetches recent trades", async () => {
      const data = { list: [{ execId: "1", symbol: "BTCUSDT", price: "40000", size: "0.1", side: "Buy", time: "1700000000000", isBlockTrade: false }], category: "linear" };
      mockFetch.mockResolvedValueOnce(bybitEnvelope(data));
      const result = await getRecentTrades("linear", "BTCUSDT");
      expect(result.list[0].symbol).toBe("BTCUSDT");
    });
  });

  describe("getFundingRate", () => {
    it("fetches funding rate history", async () => {
      const data = { list: [{ symbol: "BTCUSDT", fundingRate: "0.0001", fundingRateTimestamp: "1700000000000" }], category: "linear" };
      mockFetch.mockResolvedValueOnce(bybitEnvelope(data));
      const result = await getFundingRate("linear", "BTCUSDT");
      expect(result.list[0].fundingRate).toBe("0.0001");
    });
  });

  describe("getOpenInterest", () => {
    it("fetches open interest", async () => {
      const data = { list: [{ symbol: "BTCUSDT", openInterest: "50000", timestamp: "1700000000000" }], category: "linear", nextPageCursor: "" };
      mockFetch.mockResolvedValueOnce(bybitEnvelope(data));
      const result = await getOpenInterest("linear", "BTCUSDT", "5min");
      expect(result.list[0].openInterest).toBe("50000");
    });
  });

  describe("getInstruments", () => {
    it("fetches instruments info", async () => {
      const data = { list: [{ symbol: "BTCUSDT", contractType: "LinearPerpetual", status: "Trading", baseCoin: "BTC", quoteCoin: "USDT" }], category: "linear" };
      mockFetch.mockResolvedValueOnce(bybitEnvelope(data));
      const result = await getInstruments("linear");
      expect(result.list[0].baseCoin).toBe("BTC");
    });
  });

  describe("getInsuranceFund", () => {
    it("fetches insurance fund data", async () => {
      const data = { list: [{ coin: "USDT", balance: "5000000000", value: "5000000000" }] };
      mockFetch.mockResolvedValueOnce(bybitEnvelope(data));
      const result = await getInsuranceFund();
      expect(result.list[0].coin).toBe("USDT");
    });
  });

  describe("getRiskLimits", () => {
    it("fetches risk limits", async () => {
      const data = { list: [{ id: 1, symbol: "BTCUSDT", limit: "2000000", maintainMargin: "0.005", initialMargin: "0.01", maxLeverage: "100" }], category: "linear" };
      mockFetch.mockResolvedValueOnce(bybitEnvelope(data));
      const result = await getRiskLimits("linear", "BTCUSDT");
      expect(result.list[0].maxLeverage).toBe("100");
    });
  });

  describe("getLongShortRatio", () => {
    it("fetches long/short ratio", async () => {
      const data = { list: [{ buyRatio: "0.52", sellRatio: "0.48", timestamp: "1700000000000" }] };
      mockFetch.mockResolvedValueOnce(bybitEnvelope(data));
      const result = await getLongShortRatio("linear", "BTCUSDT");
      expect(result.list[0].buyRatio).toBe("0.52");
    });
  });

  describe("getHistoricalVolatility", () => {
    it("fetches historical volatility", async () => {
      const data = [{ period: 7, value: "0.45", time: "1700000000000" }];
      mockFetch.mockResolvedValueOnce(bybitEnvelope(data));
      const result = await getHistoricalVolatility();
      expect(result).toHaveLength(1);
    });
  });
});
