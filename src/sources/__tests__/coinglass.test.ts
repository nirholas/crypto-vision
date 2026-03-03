/**
 * Tests for src/sources/coinglass.ts
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../lib/fetcher.js", () => ({ fetchJSON: vi.fn() }));
vi.mock("../../lib/cache.js", () => ({
    cache: { wrap: vi.fn((_k: string, _t: number, fn: () => unknown) => fn()) },
}));
vi.mock("../../lib/bq-ingest.js", () => ({
    ingestDerivativesSnapshots: vi.fn(),
}));

import { fetchJSON } from "../../lib/fetcher.js";
import {
    getFundingRates,
    getLiquidations,
    getLongShortRatio,
    getOIByExchange,
    getOpenInterest,
} from "../coinglass.js";

const mockFetch = fetchJSON as ReturnType<typeof vi.fn>;

describe("coinglass source adapter", () => {
    beforeEach(() => {
        mockFetch.mockReset();
    });

    describe("getFundingRates", () => {
        it("calls correct URL and returns funding rates", async () => {
            const data = { code: "0", data: [{ symbol: "BTC", uMarginList: [{ exchangeName: "Binance", rate: 0.0001, nextFundingTime: 1700000000 }] }] };
            mockFetch.mockResolvedValueOnce(data);
            const result = await getFundingRates("BTC");
            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining("/futures/funding-rate?symbol=BTC"),
                expect.any(Object),
            );
            expect(result.data[0].symbol).toBe("BTC");
        });

        it("handles empty data gracefully", async () => {
            mockFetch.mockResolvedValueOnce({ code: "0", data: [] });
            const result = await getFundingRates();
            expect(result.data).toHaveLength(0);
        });

        it("throws on error", async () => {
            mockFetch.mockRejectedValueOnce(new Error("API error"));
            await expect(getFundingRates()).rejects.toThrow("API error");
        });
    });

    describe("getOpenInterest", () => {
        it("fetches open interest data", async () => {
            const data = { code: "0", data: [{ symbol: "BTC", openInterest: 5e9, openInterestAmount: 125000, h1Change: 0.5, h4Change: 1.2, h24Change: -0.3 }] };
            mockFetch.mockResolvedValueOnce(data);
            const result = await getOpenInterest("BTC");
            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining("/futures/open-interest?symbol=BTC"),
                expect.any(Object),
            );
            expect(result.data[0].openInterest).toBe(5e9);
        });

        it("throws on error", async () => {
            mockFetch.mockRejectedValueOnce(new Error("timeout"));
            await expect(getOpenInterest()).rejects.toThrow();
        });
    });

    describe("getLiquidations", () => {
        it("fetches liquidation data", async () => {
            const data = { code: "0", data: [{ symbol: "ETH", longLiquidationUsd: 1e6, shortLiquidationUsd: 5e5, h1LongLiquidationUsd: 1e5, h1ShortLiquidationUsd: 5e4, h4LongLiquidationUsd: 3e5, h4ShortLiquidationUsd: 1.5e5, h12LongLiquidationUsd: 5e5, h12ShortLiquidationUsd: 2.5e5, h24LongLiquidationUsd: 8e5, h24ShortLiquidationUsd: 4e5 }] };
            mockFetch.mockResolvedValueOnce(data);
            const result = await getLiquidations("ETH");
            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining("/futures/liquidation/detail?symbol=ETH"),
                expect.any(Object),
            );
            expect(result.data[0].symbol).toBe("ETH");
        });
    });

    describe("getLongShortRatio", () => {
        it("fetches long/short ratio history", async () => {
            const data = { code: "0", data: [{ longRate: 0.55, shortRate: 0.45, longVolUsd: 1e9, shortVolUsd: 8e8, createTime: 1700000000 }] };
            mockFetch.mockResolvedValueOnce(data);
            const result = await getLongShortRatio("BTC", "h1");
            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining("symbol=BTC&interval=h1"),
                expect.any(Object),
            );
            expect(result.data[0].longRate).toBe(0.55);
        });
    });

    describe("getOIByExchange", () => {
        it("fetches OI breakdown by exchange", async () => {
            const data = { code: "0", data: [{ exchangeName: "Binance", openInterest: 2e9, openInterestAmount: 50000, volUsd: 5e9, h24Change: 1.5 }] };
            mockFetch.mockResolvedValueOnce(data);
            const result = await getOIByExchange("BTC");
            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining("symbol=BTC"),
                expect.any(Object),
            );
            expect(result.data[0].exchangeName).toBe("Binance");
        });

        it("throws on error", async () => {
            mockFetch.mockRejectedValueOnce(new Error("fail"));
            await expect(getOIByExchange("BTC")).rejects.toThrow();
        });
    });
});
