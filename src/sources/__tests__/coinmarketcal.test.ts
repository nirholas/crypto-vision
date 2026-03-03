/**
 * Tests for src/sources/coinmarketcal.ts
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../lib/fetcher.js", () => ({ fetchJSON: vi.fn() }));
vi.mock("../../lib/cache.js", () => ({
    cache: { wrap: vi.fn((_k: string, _t: number, fn: () => unknown) => fn()) },
}));

import { fetchJSON } from "../../lib/fetcher.js";
import {
    getCoinEvents,
    getCoinsWithEvents,
    getEventCategories,
    getEventsByCategory,
    getUpcomingEvents,
} from "../coinmarketcal.js";

const mockFetch = fetchJSON as ReturnType<typeof vi.fn>;

describe("coinmarketcal source adapter", () => {
    beforeEach(() => {
        mockFetch.mockReset();
    });

    describe("getUpcomingEvents", () => {
        it("calls correct URL", async () => {
            const data = { body: [{ title: { en: "Mainnet Launch" }, coins: [{ id: "1", name: "TEST", symbol: "TST" }], date_event: "2026-05-01", categories: [{ id: 1, name: "Mainnet" }], source: "https://example.com", proof: null, is_hot: true, vote_count: 100, positive_vote_count: 90, percentage: 90, created_date: "2026-03-01" }] };
            mockFetch.mockResolvedValueOnce(data);
            const result = await getUpcomingEvents(1);
            expect(mockFetch).toHaveBeenCalledWith(
                "https://developers.coinmarketcal.com/v1/events?page=1&max=50&sortBy=hot_events",
            );
            expect(result.body).toHaveLength(1);
        });

        it("throws on error", async () => {
            mockFetch.mockRejectedValueOnce(new Error("fail"));
            await expect(getUpcomingEvents()).rejects.toThrow();
        });
    });

    describe("getCoinEvents", () => {
        it("fetches events for a specific coin", async () => {
            mockFetch.mockResolvedValueOnce({ body: [] });
            const result = await getCoinEvents("BTC");
            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining("coins=BTC"),
            );
            expect(result.body).toHaveLength(0);
        });
    });

    describe("getEventCategories", () => {
        it("fetches categories", async () => {
            const data = { body: [{ id: 1, name: "Mainnet Launch" }, { id: 2, name: "Airdrop" }] };
            mockFetch.mockResolvedValueOnce(data);
            const result = await getEventCategories();
            expect(mockFetch).toHaveBeenCalledWith("https://developers.coinmarketcal.com/v1/categories");
            expect(result.body).toHaveLength(2);
        });
    });

    describe("getEventsByCategory", () => {
        it("fetches events by category", async () => {
            mockFetch.mockResolvedValueOnce({ body: [{ title: { en: "Burn" }, coins: [], date_event: "2026-06-01", categories: [{ id: 3, name: "Burn" }], source: "", proof: null, is_hot: false, vote_count: 10, positive_vote_count: 8, percentage: 80, created_date: "2026-04-01" }] });
            const result = await getEventsByCategory(3);
            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining("categories=3"),
            );
            expect(result.body).toHaveLength(1);
        });
    });

    describe("getCoinsWithEvents", () => {
        it("fetches coins with upcoming events", async () => {
            mockFetch.mockResolvedValueOnce({ body: [{ id: "btc", name: "Bitcoin", symbol: "BTC" }] });
            const result = await getCoinsWithEvents();
            expect(mockFetch).toHaveBeenCalledWith("https://developers.coinmarketcal.com/v1/coins");
            expect(result.body[0].symbol).toBe("BTC");
        });

        it("throws on error", async () => {
            mockFetch.mockRejectedValueOnce(new Error("fail"));
            await expect(getCoinsWithEvents()).rejects.toThrow();
        });
    });
});
