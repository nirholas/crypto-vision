/**
 * Tests for src/sources/coincap.ts
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../lib/fetcher.js", () => ({ fetchJSON: vi.fn() }));
vi.mock("../../lib/cache.js", () => ({
    cache: { wrap: vi.fn((_k: string, _t: number, fn: () => unknown) => fn()) },
}));

import { fetchJSON } from "../../lib/fetcher.js";
import {
    getCandles,
    getExchange,
    getExchanges,
    getMarkets,
    getRate,
    getRates,
} from "../coincap.js";

const mockFetch = fetchJSON as ReturnType<typeof vi.fn>;

describe("coincap source adapter", () => {
    beforeEach(() => {
        mockFetch.mockReset();
    });

    describe("getExchanges", () => {
        it("calls correct URL and returns exchanges", async () => {
            const data = { data: [{ exchangeId: "binance", name: "Binance", rank: "1", percentTotalVolume: "30", volumeUsd: "1e10", tradingPairs: "500", socket: true, exchangeUrl: "https://binance.com", updated: 1700000000 }] };
            mockFetch.mockResolvedValueOnce(data);
            const result = await getExchanges();
            expect(mockFetch).toHaveBeenCalledWith("https://api.coincap.io/v2/exchanges");
            expect(result.data).toHaveLength(1);
            expect(result.data[0].exchangeId).toBe("binance");
        });

        it("throws on error", async () => {
            mockFetch.mockRejectedValueOnce(new Error("timeout"));
            await expect(getExchanges()).rejects.toThrow("timeout");
        });
    });

    describe("getExchange", () => {
        it("fetches single exchange by ID", async () => {
            const data = { data: { exchangeId: "kraken", name: "Kraken", rank: "5", percentTotalVolume: "5", volumeUsd: "1e9", tradingPairs: "200", socket: false, exchangeUrl: "https://kraken.com", updated: 1700000000 } };
            mockFetch.mockResolvedValueOnce(data);
            const result = await getExchange("kraken");
            expect(mockFetch).toHaveBeenCalledWith("https://api.coincap.io/v2/exchanges/kraken");
            expect(result.data.name).toBe("Kraken");
        });
    });

    describe("getMarkets", () => {
        it("fetches markets with filters", async () => {
            const data = { data: [{ exchangeId: "binance", rank: "1", baseSymbol: "BTC", baseId: "bitcoin", quoteSymbol: "USDT", quoteId: "tether", priceQuote: "40000", priceUsd: "40000", volumeUsd24Hr: "1e9", percentExchangeVolume: "10", tradesCount24Hr: "10000", updated: 1700000000 }] };
            mockFetch.mockResolvedValueOnce(data);
            const result = await getMarkets("binance", "bitcoin", 50);
            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining("api.coincap.io/v2/markets"),
            );
            expect(result.data).toHaveLength(1);
        });

        it("fetches markets without filters", async () => {
            mockFetch.mockResolvedValueOnce({ data: [] });
            const result = await getMarkets();
            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining("limit=100"),
            );
            expect(result.data).toHaveLength(0);
        });
    });

    describe("getRates", () => {
        it("fetches all rates", async () => {
            const data = { data: [{ id: "bitcoin", symbol: "BTC", currencySymbol: "₿", type: "crypto", rateUsd: "40000" }] };
            mockFetch.mockResolvedValueOnce(data);
            const result = await getRates();
            expect(mockFetch).toHaveBeenCalledWith("https://api.coincap.io/v2/rates");
            expect(result.data[0].symbol).toBe("BTC");
        });
    });

    describe("getRate", () => {
        it("fetches single rate", async () => {
            const data = { data: { id: "bitcoin", symbol: "BTC", currencySymbol: "₿", type: "crypto", rateUsd: "40000" } };
            mockFetch.mockResolvedValueOnce(data);
            const result = await getRate("bitcoin");
            expect(mockFetch).toHaveBeenCalledWith("https://api.coincap.io/v2/rates/bitcoin");
            expect(result.data.rateUsd).toBe("40000");
        });

        it("throws on error", async () => {
            mockFetch.mockRejectedValueOnce(new Error("not found"));
            await expect(getRate("invalid")).rejects.toThrow();
        });
    });

    describe("getCandles", () => {
        it("fetches candle data", async () => {
            const data = { data: [{ open: "40000", high: "41000", low: "39000", close: "40500", volume: "100", period: 3600000 }] };
            mockFetch.mockResolvedValueOnce(data);
            const result = await getCandles("binance", "bitcoin", "tether", "h1");
            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining("candles?exchange=binance&baseId=bitcoin&quoteId=tether&interval=h1"),
            );
            expect(result.data).toHaveLength(1);
        });
    });
});
