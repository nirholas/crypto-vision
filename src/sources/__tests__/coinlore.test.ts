/**
 * Tests for src/sources/coinlore.ts
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../lib/fetcher.js", () => ({ fetchJSON: vi.fn() }));
vi.mock("../../lib/cache.js", () => ({
    cache: { wrap: vi.fn((_k: string, _t: number, fn: () => unknown) => fn()) },
}));

import { fetchJSON } from "../../lib/fetcher.js";
import {
    getCoinDetail,
    getCoinMarkets,
    getCoinSocialStats,
    getExchanges,
    getGlobal,
    getTickers,
} from "../coinlore.js";

const mockFetch = fetchJSON as ReturnType<typeof vi.fn>;

describe("coinlore source adapter", () => {
    beforeEach(() => {
        mockFetch.mockReset();
    });

    describe("getGlobal", () => {
        it("fetches global stats", async () => {
            const data = [{ coins_count: 10000, active_markets: 50000, total_mcap: 2.5e12, total_volume: 1e11, btc_d: "52", eth_d: "18", mcap_change: "1.5", volume_change: "2.1", avg_change_percent: "0.5" }];
            mockFetch.mockResolvedValueOnce(data);
            const result = await getGlobal();
            expect(mockFetch).toHaveBeenCalledWith("https://api.coinlore.net/api/global/");
            expect(result[0].coins_count).toBe(10000);
        });

        it("throws on error", async () => {
            mockFetch.mockRejectedValueOnce(new Error("fail"));
            await expect(getGlobal()).rejects.toThrow();
        });
    });

    describe("getTickers", () => {
        it("fetches top coin tickers", async () => {
            const data = { data: [{ id: "90", symbol: "BTC", name: "Bitcoin", nameid: "bitcoin", rank: 1, price_usd: "40000", percent_change_24h: "1.5", percent_change_1h: "0.1", percent_change_7d: "3", market_cap_usd: "800000000000", volume24: 2e10, volume24a: 2.1e10, csupply: "19000000", tsupply: "21000000", msupply: "21000000" }], info: { coins_num: 10000, time: 1700000000 } };
            mockFetch.mockResolvedValueOnce(data);
            const result = await getTickers(0, 10);
            expect(mockFetch).toHaveBeenCalledWith("https://api.coinlore.net/api/tickers/?start=0&limit=10");
            expect(result.data[0].symbol).toBe("BTC");
        });
    });

    describe("getCoinDetail", () => {
        it("fetches single coin detail by ID", async () => {
            const data = [{ id: "90", symbol: "BTC", name: "Bitcoin", nameid: "bitcoin", rank: 1, price_usd: "40000", percent_change_24h: "1.5", percent_change_1h: "0.1", percent_change_7d: "3", market_cap_usd: "800000000000", volume24: 2e10, volume24a: 2.1e10, csupply: "19000000", tsupply: "21000000", msupply: "21000000" }];
            mockFetch.mockResolvedValueOnce(data);
            const result = await getCoinDetail("90");
            expect(mockFetch).toHaveBeenCalledWith("https://api.coinlore.net/api/ticker/?id=90");
            expect(result[0].name).toBe("Bitcoin");
        });
    });

    describe("getExchanges", () => {
        it("fetches exchange list", async () => {
            const data = [{ id: "1", name: "Binance", name_id: "binance", volume_usd: 1e10, active_pairs: 500, url: "https://binance.com", country: "Cayman Islands" }];
            mockFetch.mockResolvedValueOnce(data);
            const result = await getExchanges();
            expect(mockFetch).toHaveBeenCalledWith("https://api.coinlore.net/api/exchanges/");
            expect(result[0].name).toBe("Binance");
        });
    });

    describe("getCoinMarkets", () => {
        it("fetches markets for a coin", async () => {
            const data = [{ name: "Binance", base: "BTC", quote: "USDT", price: 40000, price_usd: 40000, volume: 1e9, volume_usd: 1e9, time: 1700000000 }];
            mockFetch.mockResolvedValueOnce(data);
            const result = await getCoinMarkets("90");
            expect(mockFetch).toHaveBeenCalledWith("https://api.coinlore.net/api/coin/markets/?id=90");
            expect(result[0].name).toBe("Binance");
        });
    });

    describe("getCoinSocialStats", () => {
        it("fetches social stats for a coin", async () => {
            const data = { reddit: { avg_active_users: 5000, subscribers: 50000 }, twitter: { followers_count: 100000, status_count: 50000 } };
            mockFetch.mockResolvedValueOnce(data);
            const result = await getCoinSocialStats("90");
            expect(mockFetch).toHaveBeenCalledWith("https://api.coinlore.net/api/coin/social_stats/?id=90");
            expect(result.reddit.subscribers).toBe(50000);
        });

        it("throws on error", async () => {
            mockFetch.mockRejectedValueOnce(new Error("not found"));
            await expect(getCoinSocialStats("invalid")).rejects.toThrow();
        });
    });
});
