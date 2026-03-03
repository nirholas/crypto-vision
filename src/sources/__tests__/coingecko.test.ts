/**
 * Tests for src/sources/coingecko.ts
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../lib/fetcher.js", () => ({ fetchJSON: vi.fn() }));
vi.mock("../../lib/cache.js", () => ({
    cache: { wrap: vi.fn((_k: string, _t: number, fn: () => unknown) => fn()) },
}));
vi.mock("../../lib/bq-ingest.js", () => ({
    ingestMarketSnapshots: vi.fn(),
    ingestOHLCCandles: vi.fn(),
    ingestExchangeSnapshots: vi.fn(),
}));

import { fetchJSON } from "../../lib/fetcher.js";
import {
    getCategories,
    getCoinDetail,
    getCoins,
    getExchanges,
    getGlobal,
    getMarketChart,
    getOHLC,
    getPrice,
    getTrending,
    searchCoins,
} from "../coingecko.js";

const mockFetch = fetchJSON as ReturnType<typeof vi.fn>;

describe("coingecko source adapter", () => {
    beforeEach(() => {
        mockFetch.mockReset();
    });

    describe("getCoins", () => {
        it("calls markets endpoint with params", async () => {
            const data = [{ id: "bitcoin", symbol: "btc", name: "Bitcoin", current_price: 40000, market_cap: 8e11, market_cap_rank: 1, total_volume: 2e10, price_change_percentage_24h: 1.5, circulating_supply: 19e6, total_supply: 21e6, max_supply: 21e6, ath: 69000, ath_change_percentage: -42, image: "" }];
            mockFetch.mockResolvedValueOnce(data);
            const result = await getCoins({ page: 1, perPage: 10 });
            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining("/coins/markets"),
                expect.any(Object),
            );
            expect(result).toHaveLength(1);
            expect(result[0].id).toBe("bitcoin");
        });

        it("throws on error", async () => {
            mockFetch.mockRejectedValueOnce(new Error("rate limited"));
            await expect(getCoins()).rejects.toThrow("rate limited");
        });
    });

    describe("getCoinDetail", () => {
        it("fetches coin detail by id", async () => {
            const data = { id: "bitcoin", symbol: "btc", name: "Bitcoin", description: { en: "Decentralized currency" }, links: { homepage: ["https://bitcoin.org"], blockchain_site: [], repos_url: { github: [] } }, market_data: { current_price: { usd: 40000 }, market_cap: { usd: 8e11 }, total_volume: { usd: 2e10 }, price_change_percentage_24h: 1.5, price_change_percentage_7d: 3, price_change_percentage_30d: 10, circulating_supply: 19e6, total_supply: 21e6, max_supply: 21e6, ath: { usd: 69000 }, ath_date: { usd: "2021-11-10" }, ath_change_percentage: { usd: -42 }, atl: { usd: 67 }, atl_date: { usd: "2013-07-06" } }, categories: ["Cryptocurrency"], platforms: {} };
            mockFetch.mockResolvedValueOnce(data);
            const result = await getCoinDetail("bitcoin");
            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining("/coins/bitcoin?"),
                expect.any(Object),
            );
            expect(result.id).toBe("bitcoin");
        });
    });

    describe("getPrice", () => {
        it("fetches simple price", async () => {
            const data = { bitcoin: { usd: 40000, usd_24h_change: 1.5 } };
            mockFetch.mockResolvedValueOnce(data);
            const result = await getPrice("bitcoin");
            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining("/simple/price"),
                expect.any(Object),
            );
            expect(result.bitcoin.usd).toBe(40000);
        });
    });

    describe("getTrending", () => {
        it("fetches trending coins", async () => {
            const data = { coins: [{ item: { id: "pepe", coin_id: 1, name: "Pepe", symbol: "PEPE", market_cap_rank: 50, thumb: "", price_btc: 0.000001, score: 0 } }] };
            mockFetch.mockResolvedValueOnce(data);
            const result = await getTrending();
            expect(result.coins).toHaveLength(1);
            expect(result.coins[0].item.name).toBe("Pepe");
        });
    });

    describe("getGlobal", () => {
        it("fetches global market data", async () => {
            const data = { data: { active_cryptocurrencies: 10000, markets: 800, total_market_cap: { usd: 2.5e12 }, total_volume: { usd: 1e11 }, market_cap_percentage: { btc: 52 }, market_cap_change_percentage_24h_usd: 1.5 } };
            mockFetch.mockResolvedValueOnce(data);
            const result = await getGlobal();
            expect(result.data.total_market_cap.usd).toBe(2.5e12);
        });

        it("throws on error", async () => {
            mockFetch.mockRejectedValueOnce(new Error("fail"));
            await expect(getGlobal()).rejects.toThrow();
        });
    });

    describe("searchCoins", () => {
        it("searches for coins by query", async () => {
            const data = { coins: [{ id: "bitcoin", name: "Bitcoin", symbol: "btc", market_cap_rank: 1 }] };
            mockFetch.mockResolvedValueOnce(data);
            const result = await searchCoins("bitcoin");
            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining("/search?query=bitcoin"),
                expect.any(Object),
            );
            expect(result.coins[0].id).toBe("bitcoin");
        });
    });

    describe("getMarketChart", () => {
        it("fetches market chart data", async () => {
            const data = { prices: [[1700000000, 40000]], market_caps: [[1700000000, 8e11]], total_volumes: [[1700000000, 2e10]] };
            mockFetch.mockResolvedValueOnce(data);
            const result = await getMarketChart("bitcoin", 7);
            expect(result.prices).toHaveLength(1);
        });
    });

    describe("getOHLC", () => {
        it("fetches OHLC candles", async () => {
            const data: [number, number, number, number, number][] = [[1700000000, 40000, 41000, 39000, 40500]];
            mockFetch.mockResolvedValueOnce(data);
            const result = await getOHLC("bitcoin", 7);
            expect(result).toHaveLength(1);
            expect(result[0][1]).toBe(40000); // open
        });
    });

    describe("getExchanges", () => {
        it("fetches exchange list", async () => {
            const data = [{ id: "binance", name: "Binance", year_established: 2017, country: "Cayman Islands", trade_volume_24h_btc: 500000, trust_score: 10, trust_score_rank: 1 }];
            mockFetch.mockResolvedValueOnce(data);
            const result = await getExchanges();
            expect(result[0].name).toBe("Binance");
        });
    });

    describe("getCategories", () => {
        it("fetches coin categories", async () => {
            const data = [{ id: "defi", name: "DeFi", market_cap: 1e11, market_cap_change_24h: 2, top_3_coins: ["btc"], volume_24h: 5e9 }];
            mockFetch.mockResolvedValueOnce(data);
            const result = await getCategories();
            expect(result[0].name).toBe("DeFi");
        });
    });
});
