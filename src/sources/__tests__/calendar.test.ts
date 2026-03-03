/**
 * Tests for src/sources/calendar.ts
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../lib/fetcher.js", () => ({ fetchJSON: vi.fn() }));
vi.mock("../../lib/cache.js", () => ({
    cache: { wrap: vi.fn((_k: string, _t: number, fn: () => unknown) => fn()) },
}));

import { fetchJSON } from "../../lib/fetcher.js";
import {
    getAggregatedCalendar,
    getCategories,
    getCoinEvents,
    getCoinsWithEvents,
    getEvents,
    getEventsByCategory,
    getPaprikaEvents,
} from "../calendar.js";

const mockFetch = fetchJSON as ReturnType<typeof vi.fn>;

describe("calendar source adapter", () => {
    beforeEach(() => {
        mockFetch.mockReset();
    });

    describe("getEvents", () => {
        it("calls correct URL and returns events", async () => {
            const data = { body: [{ title: "ETH Upgrade", date: "2026-04-01", coin: { id: "eth", name: "Ethereum", symbol: "ETH" }, category: "mainnet", source: "https://example.com", significance: "high", proof: "https://proof.com", description: "Ethereum upgrade" }] };
            mockFetch.mockResolvedValueOnce(data);
            const result = await getEvents(1, 50, "hot_events");
            expect(mockFetch).toHaveBeenCalledWith(
                "https://developers.coinmarketcal.com/v1/events?page=1&max=50&sortBy=hot_events",
                expect.objectContaining({ headers: expect.any(Object) }),
            );
            expect(result.body).toHaveLength(1);
            expect(result.body[0].title).toBe("ETH Upgrade");
        });

        it("throws on fetchJSON error", async () => {
            mockFetch.mockRejectedValueOnce(new Error("network"));
            await expect(getEvents()).rejects.toThrow("network");
        });
    });

    describe("getCoinEvents", () => {
        it("fetches events for a specific coin", async () => {
            const data = { body: [{ title: "BTC Halving", date: "2028-04-01", coin: { id: "btc", name: "Bitcoin", symbol: "BTC" }, category: "halving", source: "", significance: "high", proof: "", description: "" }] };
            mockFetch.mockResolvedValueOnce(data);
            const result = await getCoinEvents("BTC");
            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining("coins=BTC"),
                expect.any(Object),
            );
            expect(result.body[0].title).toBe("BTC Halving");
        });
    });

    describe("getCategories", () => {
        it("fetches event categories", async () => {
            const data = { body: [{ id: 1, name: "Mainnet Launch" }, { id: 2, name: "Airdrop" }] };
            mockFetch.mockResolvedValueOnce(data);
            const result = await getCategories();
            expect(mockFetch).toHaveBeenCalledWith(
                "https://developers.coinmarketcal.com/v1/categories",
                expect.any(Object),
            );
            expect(result.body).toHaveLength(2);
        });
    });

    describe("getEventsByCategory", () => {
        it("fetches events by category ID", async () => {
            const data = { body: [{ title: "Token Burn", date: "2026-05-01", coin: null, category: "burn", source: "", significance: "medium", proof: "", description: "" }] };
            mockFetch.mockResolvedValueOnce(data);
            const result = await getEventsByCategory(3);
            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining("categories=3"),
                expect.any(Object),
            );
            expect(result.body).toHaveLength(1);
        });
    });

    describe("getCoinsWithEvents", () => {
        it("fetches coins with upcoming events", async () => {
            const data = { body: [{ id: "btc", name: "Bitcoin", symbol: "BTC" }] };
            mockFetch.mockResolvedValueOnce(data);
            const result = await getCoinsWithEvents();
            expect(mockFetch).toHaveBeenCalledWith(
                "https://developers.coinmarketcal.com/v1/coins",
                expect.any(Object),
            );
            expect(result.body).toHaveLength(1);
        });
    });

    describe("getPaprikaEvents", () => {
        it("fetches CoinPaprika events for a coin", async () => {
            const data = [{ id: "1", name: "Event1", date: "2026-05-01" }];
            mockFetch.mockResolvedValueOnce(data);
            const result = await getPaprikaEvents("btc-bitcoin");
            expect(mockFetch).toHaveBeenCalledWith(
                "https://api.coinpaprika.com/v1/coins/btc-bitcoin/events",
            );
            expect(result).toHaveLength(1);
        });

        it("throws on error", async () => {
            mockFetch.mockRejectedValueOnce(new Error("not found"));
            await expect(getPaprikaEvents("invalid")).rejects.toThrow();
        });
    });

    describe("getAggregatedCalendar", () => {
        it("returns aggregated calendar", async () => {
            const data = { body: [{ title: "Event", date: "2026-04-01", coin: null, category: "other", source: "coinmarketcal", significance: "low", proof: "", description: "" }] };
            mockFetch.mockResolvedValueOnce(data);
            const result = await getAggregatedCalendar(30);
            expect(result).toHaveProperty("events");
            expect(result).toHaveProperty("sources");
            expect(result).toHaveProperty("count");
        });

        it("returns empty when API fails gracefully", async () => {
            mockFetch.mockRejectedValueOnce(new Error("API key missing"));
            const result = await getAggregatedCalendar();
            expect(result.events).toHaveLength(0);
            expect(result.count).toBe(0);
        });
    });
});
