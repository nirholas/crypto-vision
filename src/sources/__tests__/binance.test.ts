/**
 * Tests for src/sources/binance.ts
 *
 * Binance uses raw fetch via a private binanceFetch wrapper (not fetchJSON).
 * We mock global fetch and cache.wrap to intercept calls.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../lib/fetcher.js", () => ({ fetchJSON: vi.fn() }));
vi.mock("../../lib/cache.js", () => ({
    cache: { wrap: vi.fn((_k: string, _t: number, fn: () => unknown) => fn()) },
}));
vi.mock("../../lib/logger.js", () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
    log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import {
    binanceSymbolToStandard,
    calculateAnnualizedFunding,
    calculateVWAP,
    formatKlinesToOHLCV,
    get24hStats,
    getAvgPrice,
    getExchangeInfo,
    getFundingRates,
    getOpenInterest,
    getRemainingWeight,
    getTicker24h,
    getUsedWeight,
    isNearRateLimit,
    standardToBinanceSymbol
} from "../binance.js";

function mockFetchResponse(data: unknown, headers: Record<string, string> = {}) {
    return vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => data,
        text: async () => JSON.stringify(data),
        headers: new Headers(headers),
    } as Response);
}

describe("binance source adapter", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    // ─── Pure helpers ────────────────────────────────────────

    describe("binanceSymbolToStandard", () => {
        it("splits BTCUSDT into base/quote", () => {
            const { base, quote } = binanceSymbolToStandard("BTCUSDT");
            expect(base).toBe("BTC");
            expect(quote).toBe("USDT");
        });
    });

    describe("standardToBinanceSymbol", () => {
        it("combines base and quote", () => {
            expect(standardToBinanceSymbol("ETH", "USDT")).toBe("ETHUSDT");
        });
    });

    describe("calculateAnnualizedFunding", () => {
        it("annualizes 8h funding rate", () => {
            const result = calculateAnnualizedFunding(0.01);
            // 0.01 * 3 * 365 = 10.95 or 0.01 * 1095
            expect(result).toBeCloseTo(0.01 * 3 * 365, 2);
        });
    });

    describe("calculateVWAP", () => {
        it("computes volume-weighted average price", () => {
            const trades = [
                { a: 1, p: "100", q: "10", f: 1, l: 1, T: 1000, m: false, M: true },
                { a: 2, p: "200", q: "10", f: 2, l: 2, T: 1001, m: false, M: true },
            ];
            const vwap = calculateVWAP(trades);
            // (100*10 + 200*10) / (10 + 10) = 150
            expect(vwap).toBeCloseTo(150);
        });

        it("returns 0 for empty trades", () => {
            expect(calculateVWAP([])).toBe(0);
        });
    });

    describe("formatKlinesToOHLCV", () => {
        it("converts Binance kline tuples to OHLCV objects", () => {
            const klines: [number, string, string, string, string, string, number, string, number, string, string, string][] = [
                [1700000000000, "40000", "41000", "39000", "40500", "100", 1700003600000, "4000000", 500, "60", "2400000", "0"],
            ];
            const result = formatKlinesToOHLCV(klines);
            expect(result).toHaveLength(1);
            expect(result[0]).toMatchObject({
                open: 40000,
                high: 41000,
                low: 39000,
                close: 40500,
                volume: 100,
            });
        });
    });

    // ─── Weight tracking ─────────────────────────────────────

    describe("weight tracking", () => {
        it("getUsedWeight returns a number", () => {
            expect(typeof getUsedWeight()).toBe("number");
        });
        it("getRemainingWeight returns a number", () => {
            expect(typeof getRemainingWeight()).toBe("number");
        });
        it("isNearRateLimit returns boolean", () => {
            expect(typeof isNearRateLimit()).toBe("boolean");
        });
    });

    // ─── API Functions (mock global fetch) ───────────────────

    describe("getTicker24h", () => {
        it("fetches 24h ticker for a symbol", async () => {
            const data = { symbol: "BTCUSDT", lastPrice: "40000", priceChangePercent: "2.5", priceChange: "1000", weightedAvgPrice: "39500", prevClosePrice: "39000", lastQty: "0.1", bidPrice: "39999", askPrice: "40001", openPrice: "39000", highPrice: "41000", lowPrice: "38500", volume: "5000", quoteVolume: "200000000", openTime: 1700000000000, closeTime: 1700086400000, count: 100000 };
            mockFetchResponse(data, { "X-MBX-USED-WEIGHT-1M": "5" });
            const result = await getTicker24h("BTCUSDT");
            expect(result).toMatchObject({ symbol: "BTCUSDT" });
        });

        it("throws on HTTP error", async () => {
            vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
                ok: false,
                status: 500,
                text: async () => "Internal Server Error",
                headers: new Headers(),
            } as Response);
            await expect(getTicker24h("BTCUSDT")).rejects.toThrow();
        });
    });

    describe("getExchangeInfo", () => {
        it("fetches exchange info", async () => {
            const data = { timezone: "UTC", serverTime: 1700000000000, rateLimits: [], exchangeFilters: [], symbols: [] };
            mockFetchResponse(data);
            const result = await getExchangeInfo();
            expect(result).toMatchObject({ timezone: "UTC" });
        });
    });

    describe("getAvgPrice", () => {
        it("fetches average price for symbol", async () => {
            const data = { mins: 5, price: "40000.50", closeTime: 1700000000000 };
            mockFetchResponse(data);
            const result = await getAvgPrice("BTCUSDT");
            expect(result.price).toBe("40000.50");
        });
    });

    describe("get24hStats", () => {
        it("fetches all 24h stats", async () => {
            const data = [
                { symbol: "BTCUSDT", lastPrice: "40000", priceChangePercent: "2.5", priceChange: "1000", weightedAvgPrice: "39500", prevClosePrice: "39000", lastQty: "0.1", bidPrice: "39999", askPrice: "40001", openPrice: "39000", highPrice: "41000", lowPrice: "38500", volume: "5000", quoteVolume: "200000000", openTime: 1700000000000, closeTime: 1700086400000, count: 100000 },
            ];
            mockFetchResponse(data);
            const result = await get24hStats();
            expect(Array.isArray(result)).toBe(true);
        });
    });

    describe("getFundingRates", () => {
        it("fetches funding rates", async () => {
            const data = [{ symbol: "BTCUSDT", fundingRate: "0.0001", fundingTime: 1700000000000, markPrice: "40000" }];
            mockFetchResponse(data);
            const result = await getFundingRates("BTCUSDT");
            expect(result[0].symbol).toBe("BTCUSDT");
        });
    });

    describe("getOpenInterest", () => {
        it("fetches open interest for symbol", async () => {
            const data = { symbol: "BTCUSDT", openInterest: "50000", time: 1700000000000 };
            mockFetchResponse(data);
            const result = await getOpenInterest("BTCUSDT");
            expect(result.symbol).toBe("BTCUSDT");
        });
    });
});
