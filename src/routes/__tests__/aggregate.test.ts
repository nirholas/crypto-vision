/**
 * Integration tests for aggregate / multi-source routes.
 *
 * Mocks CoinGecko, Alternative (CoinPaprika, CoinCap), and DeFiLlama sources.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";

// ─── Mock sources BEFORE importing routes ────────────────────

vi.mock("../../sources/coingecko.js", () => ({
    getCoins: vi.fn(),
    getPrice: vi.fn(),
    getGlobal: vi.fn(),
    getTrending: vi.fn(),
}));

vi.mock("../../sources/alternative.js", () => ({
    getFearGreedIndex: vi.fn(),
    getCoinPaprikaTickers: vi.fn(),
    getCoinPaprikaGlobal: vi.fn(),
    getCoinCapAssets: vi.fn(),
    getCoinCapHistory: vi.fn(),
    getCoinCapRates: vi.fn(),
}));

vi.mock("../../sources/defillama.js", () => ({
    getChainsTVL: vi.fn(),
    getProtocols: vi.fn(),
}));

import * as cg from "../../sources/coingecko.js";
import * as alt from "../../sources/alternative.js";
import * as llama from "../../sources/defillama.js";
import { aggregateRoutes } from "../aggregate.js";

const app = new Hono().route("/api/aggregate", aggregateRoutes);

beforeEach(() => {
    vi.clearAllMocks();
});

// ═══════════════════════════════════════════════════════════════
// GET /api/aggregate/prices/:ids
// ═══════════════════════════════════════════════════════════════

describe("GET /api/aggregate/prices/:ids", () => {
    it("aggregates prices from multiple sources", async () => {
        vi.mocked(cg.getPrice).mockResolvedValue({ bitcoin: { usd: 60000 } } as any);
        vi.mocked(alt.getCoinPaprikaTickers).mockResolvedValue([
            { symbol: "BTC", quotes: { USD: { price: 59800 } } },
        ] as any);
        vi.mocked(alt.getCoinCapAssets).mockResolvedValue({
            data: [{ symbol: "BTC", priceUsd: "60200" }],
        } as any);

        const res = await app.request("/api/aggregate/prices/BTC");
        expect(res.status).toBe(200);

        const json = (await res.json()) as Record<string, any>;
        expect(json.data.btc).toBeDefined();
        expect(json.data.btc.coingecko).toBe(60000);
        expect(json.data.btc.coinpaprika).toBe(59800);
        expect(json.data.btc.coincap).toBe(60200);
        expect(json.data.btc.average).toBeCloseTo(60000, -2);
    });

    it("handles partial source failures", async () => {
        vi.mocked(cg.getPrice).mockRejectedValue(new Error("CG down"));
        vi.mocked(alt.getCoinPaprikaTickers).mockResolvedValue([
            { symbol: "BTC", quotes: { USD: { price: 59800 } } },
        ] as any);
        vi.mocked(alt.getCoinCapAssets).mockRejectedValue(new Error("CC down"));

        const res = await app.request("/api/aggregate/prices/BTC");
        expect(res.status).toBe(200);

        const json = (await res.json()) as Record<string, any>;
        expect(json.data.btc.coinpaprika).toBe(59800);
        // Others undefined or missing — average from available
        expect(json.data.btc.average).toBe(59800);
    });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/aggregate/global
// ═══════════════════════════════════════════════════════════════

describe("GET /api/aggregate/global", () => {
    it("returns cross-source global stats", async () => {
        vi.mocked(cg.getGlobal).mockResolvedValue({
            data: {
                total_market_cap: { usd: 2.5e12 },
                total_volume: { usd: 100e9 },
                market_cap_percentage: { btc: 50 },
                market_cap_change_percentage_24h_usd: 1.5,
                active_cryptocurrencies: 10000,
            },
        } as any);
        vi.mocked(alt.getCoinPaprikaGlobal).mockResolvedValue({
            market_cap_usd: 2.4e12,
            volume_24h_usd: 98e9,
            bitcoin_dominance_percentage: 49,
            market_cap_change_24h: 1.2,
            cryptocurrencies_number: 9500,
        } as any);
        vi.mocked(alt.getFearGreedIndex).mockResolvedValue({
            data: [{ value: "65", value_classification: "Greed" }],
        } as any);

        const res = await app.request("/api/aggregate/global");
        expect(res.status).toBe(200);

        const json = (await res.json()) as Record<string, any>;
        expect(json.data.coingecko.totalMarketCap).toBe(2.5e12);
        expect(json.data.coinpaprika.totalMarketCap).toBe(2.4e12);
        expect(json.data.fearGreed.value).toBe(65);
        expect(json.data.fearGreed.classification).toBe("Greed");
    });

    it("handles all sources failing gracefully", async () => {
        vi.mocked(cg.getGlobal).mockRejectedValue(new Error("fail"));
        vi.mocked(alt.getCoinPaprikaGlobal).mockRejectedValue(new Error("fail"));
        vi.mocked(alt.getFearGreedIndex).mockRejectedValue(new Error("fail"));

        const res = await app.request("/api/aggregate/global");
        expect(res.status).toBe(200);

        const json = (await res.json()) as Record<string, any>;
        expect(json.data.coingecko).toBeNull();
        expect(json.data.coinpaprika).toBeNull();
        expect(json.data.fearGreed).toBeNull();
    });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/aggregate/tickers
// ═══════════════════════════════════════════════════════════════

describe("GET /api/aggregate/tickers", () => {
    it("returns CoinPaprika tickers", async () => {
        vi.mocked(alt.getCoinPaprikaTickers).mockResolvedValue([
            {
                id: "btc-bitcoin",
                name: "Bitcoin",
                symbol: "BTC",
                rank: 1,
                quotes: {
                    USD: {
                        price: 60000,
                        volume_24h: 30e9,
                        market_cap: 1.2e12,
                        percent_change_24h: 2.5,
                        percent_change_7d: 5.0,
                    },
                },
            },
        ] as any);

        const res = await app.request("/api/aggregate/tickers?limit=10");
        expect(res.status).toBe(200);

        const json = (await res.json()) as Record<string, any>;
        expect(json.data).toHaveLength(1);
        expect(json.data[0].price).toBe(60000);
        expect(json.source).toBe("coinpaprika");
    });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/aggregate/assets
// ═══════════════════════════════════════════════════════════════

describe("GET /api/aggregate/assets", () => {
    it("returns CoinCap assets", async () => {
        vi.mocked(alt.getCoinCapAssets).mockResolvedValue({
            data: [
                {
                    id: "bitcoin",
                    rank: "1",
                    symbol: "BTC",
                    name: "Bitcoin",
                    priceUsd: "60000.00",
                    marketCapUsd: "1200000000000",
                    volumeUsd24Hr: "30000000000",
                    changePercent24Hr: "2.5",
                    supply: "19000000",
                    maxSupply: "21000000",
                },
            ],
        } as any);

        const res = await app.request("/api/aggregate/assets?limit=10");
        expect(res.status).toBe(200);

        const json = (await res.json()) as Record<string, any>;
        expect(json.data).toHaveLength(1);
        expect(json.data[0].price).toBe(60000);
        expect(json.data[0].rank).toBe(1);
        expect(json.source).toBe("coincap");
    });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/aggregate/history/:id
// ═══════════════════════════════════════════════════════════════

describe("GET /api/aggregate/history/:id", () => {
    it("returns price history", async () => {
        vi.mocked(alt.getCoinCapHistory).mockResolvedValue({
            data: [
                { priceUsd: "60000.00", time: 1700000000000 },
                { priceUsd: "60500.00", time: 1700003600000 },
            ],
        } as any);

        const res = await app.request("/api/aggregate/history/bitcoin?interval=h1");
        expect(res.status).toBe(200);

        const json = (await res.json()) as Record<string, any>;
        expect(json.data).toHaveLength(2);
        expect(json.data[0].price).toBe(60000);
        expect(json.asset).toBe("bitcoin");
        expect(json.source).toBe("coincap");
    });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/aggregate/top-movers
// ═══════════════════════════════════════════════════════════════

describe("GET /api/aggregate/top-movers", () => {
    it("returns gainers and losers", async () => {
        vi.mocked(cg.getCoins).mockResolvedValue([
            { id: "gainer", symbol: "GAIN", name: "Gainer", current_price: 10, price_change_percentage_24h: 25, market_cap: 1e6, total_volume: 5e5, image: "" },
            { id: "stable", symbol: "STBL", name: "Stable", current_price: 100, price_change_percentage_24h: 0, market_cap: 1e9, total_volume: 1e8, image: "" },
            { id: "loser", symbol: "LOSE", name: "Loser", current_price: 5, price_change_percentage_24h: -20, market_cap: 5e5, total_volume: 2e5, image: "" },
        ] as any);

        const res = await app.request("/api/aggregate/top-movers?limit=1");
        expect(res.status).toBe(200);

        const json = (await res.json()) as Record<string, any>;
        expect(json.data.gainers).toHaveLength(1);
        expect(json.data.losers).toHaveLength(1);
        expect(json.data.gainers[0].id).toBe("gainer");
        expect(json.data.losers[0].id).toBe("loser");
    });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/aggregate/market-overview
// ═══════════════════════════════════════════════════════════════

describe("GET /api/aggregate/market-overview", () => {
    it("returns full market dashboard", async () => {
        vi.mocked(cg.getGlobal).mockResolvedValue({
            data: {
                total_market_cap: { usd: 2.5e12 },
                total_volume: { usd: 100e9 },
                market_cap_percentage: { btc: 50, eth: 18 },
                market_cap_change_percentage_24h_usd: 1.5,
                active_cryptocurrencies: 10000,
                markets: 800,
            },
        } as any);
        vi.mocked(alt.getFearGreedIndex).mockResolvedValue({
            data: [{ value: "72", value_classification: "Greed" }],
        } as any);
        vi.mocked(cg.getTrending).mockResolvedValue({
            coins: [
                { item: { id: "btc", name: "Bitcoin", symbol: "BTC", market_cap_rank: 1 } },
            ],
        } as any);
        vi.mocked(cg.getCoins).mockResolvedValue([
            { id: "bitcoin", symbol: "btc", name: "Bitcoin", current_price: 60000, price_change_percentage_24h: 2, market_cap: 1.2e12 },
        ] as any);
        vi.mocked(llama.getChainsTVL).mockResolvedValue([
            { name: "Ethereum", tvl: 50e9 },
            { name: "BSC", tvl: 5e9 },
        ] as any);
        vi.mocked(llama.getProtocols).mockResolvedValue([
            { tvl: 10e9 },
            { tvl: 5e9 },
        ] as any);

        const res = await app.request("/api/aggregate/market-overview");
        expect(res.status).toBe(200);

        const json = (await res.json()) as Record<string, any>;
        expect(json.data.global.totalMarketCap).toBe(2.5e12);
        expect(json.data.fearGreed.value).toBe(72);
        expect(json.data.trending).toHaveLength(1);
        expect(json.data.topCoins).toHaveLength(1);
        expect(json.data.topChainsByTvl).toHaveLength(2);
        expect(json.data.totalDefiTvl).toBe(15e9);
    });

    it("handles all sources failing", async () => {
        vi.mocked(cg.getGlobal).mockRejectedValue(new Error("fail"));
        vi.mocked(alt.getFearGreedIndex).mockRejectedValue(new Error("fail"));
        vi.mocked(cg.getTrending).mockRejectedValue(new Error("fail"));
        vi.mocked(cg.getCoins).mockRejectedValue(new Error("fail"));
        vi.mocked(llama.getChainsTVL).mockRejectedValue(new Error("fail"));
        vi.mocked(llama.getProtocols).mockRejectedValue(new Error("fail"));

        const res = await app.request("/api/aggregate/market-overview");
        expect(res.status).toBe(200);

        const json = (await res.json()) as Record<string, any>;
        expect(json.data.global).toBeNull();
        expect(json.data.fearGreed).toBeNull();
        expect(json.data.trending).toEqual([]);
        expect(json.data.topCoins).toEqual([]);
    });
});
