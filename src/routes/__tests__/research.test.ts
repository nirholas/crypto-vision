/**
 * Integration tests for research routes.
 *
 * Mocks Messari and CryptoCompare source adapters so no real HTTP calls are made.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";

// ─── Mock sources BEFORE importing routes ────────────────────

vi.mock("../../sources/messari.js", () => ({
    getAssets: vi.fn(),
    getAssetMetrics: vi.fn(),
    getAssetProfile: vi.fn(),
    getAssetMarkets: vi.fn(),
    getAssetMarketData: vi.fn(),
    searchAssets: vi.fn(),
}));

vi.mock("../../sources/cryptocompare.js", () => ({
    getPrice: vi.fn(),
    getPriceFull: vi.fn(),
    getHistoDay: vi.fn(),
    getHistoHour: vi.fn(),
    getTopByMarketCap: vi.fn(),
    getTopByVolume: vi.fn(),
    getTradingSignals: vi.fn(),
    getSocialStats: vi.fn(),
    getTopExchanges: vi.fn(),
    getNews: vi.fn(),
    getNewsCategories: vi.fn(),
    getBlockchainAvailable: vi.fn(),
}));

import * as messari from "../../sources/messari.js";
import * as cc from "../../sources/cryptocompare.js";
import { researchRoutes } from "../research.js";

const app = new Hono().route("/api/research", researchRoutes);

beforeEach(() => {
    vi.clearAllMocks();
});

// ═══════════════════════════════════════════════════════════════
// GET /api/research/assets
// ═══════════════════════════════════════════════════════════════

describe("GET /api/research/assets", () => {
    it("returns mapped asset data", async () => {
        vi.mocked(messari.getAssets).mockResolvedValue({
            data: [
                {
                    id: "abc-123",
                    symbol: "BTC",
                    name: "Bitcoin",
                    slug: "bitcoin",
                    metrics: {
                        market_data: {
                            price_usd: 60000,
                            volume_last_24_hours: 30e9,
                            percent_change_usd_last_24_hours: 2.5,
                        },
                        marketcap: { current_marketcap_usd: 1.2e12, rank: 1 },
                        supply: { circulating: 19e6 },
                        roi_data: {
                            percent_change_last_1_week: 5,
                            percent_change_last_1_month: 10,
                            percent_change_last_3_months: 20,
                            percent_change_last_1_year: 100,
                        },
                    },
                },
            ],
        } as any);

        const res = await app.request("/api/research/assets?limit=10&page=1");
        expect(res.status).toBe(200);

        const json = (await res.json()) as Record<string, any>;
        expect(json.data).toHaveLength(1);
        expect(json.data[0]).toMatchObject({
            id: "abc-123",
            symbol: "BTC",
            name: "Bitcoin",
            slug: "bitcoin",
            price: 60000,
        });
        expect(json.page).toBe(1);
        expect(json.limit).toBe(10);
    });

    it("defaults to limit=50 and page=1", async () => {
        vi.mocked(messari.getAssets).mockResolvedValue({ data: [] } as any);

        const res = await app.request("/api/research/assets");
        expect(res.status).toBe(200);
        expect(messari.getAssets).toHaveBeenCalledWith(50, 1);
    });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/research/asset/:slug
// ═══════════════════════════════════════════════════════════════

describe("GET /api/research/asset/:slug", () => {
    it("returns detailed asset data", async () => {
        vi.mocked(messari.getAssetMetrics).mockResolvedValue({
            data: {
                id: "abc",
                symbol: "BTC",
                name: "Bitcoin",
                market_data: {
                    price_usd: 60000,
                    volume_last_24_hours: 30e9,
                    percent_change_usd_last_24_hours: 2.5,
                    ohlcv_last_24_hour: {},
                },
                marketcap: { current_marketcap_usd: 1.2e12, rank: 1 },
                supply: {},
                all_time_high: {},
                roi_data: {},
                risk_metrics: {},
                blockchain_stats_24_hours: {},
                developer_activity: {},
            },
        } as any);
        vi.mocked(messari.getAssetProfile).mockResolvedValue({
            data: {
                profile: {
                    general: {
                        overview: {
                            tagline: "Digital gold",
                            project_details: "BTC desc",
                            official_links: [],
                        },
                    },
                    economics: { token: { token_type: "Cryptocurrency" } },
                },
            },
        } as any);

        const res = await app.request("/api/research/asset/bitcoin");
        expect(res.status).toBe(200);

        const json = (await res.json()) as Record<string, any>;
        expect(json.data.symbol).toBe("BTC");
        expect(json.data.market.price).toBe(60000);
        expect(json.data.profile.tagline).toBe("Digital gold");
    });

    it("returns 404 when asset not found", async () => {
        vi.mocked(messari.getAssetMetrics).mockResolvedValue({ data: null } as any);
        vi.mocked(messari.getAssetProfile).mockResolvedValue({ data: null } as any);

        const res = await app.request("/api/research/asset/nonexistent");
        expect(res.status).toBe(404);

        const json = (await res.json()) as Record<string, any>;
        expect(json.error).toContain("nonexistent");
    });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/research/asset/:slug/markets
// ═══════════════════════════════════════════════════════════════

describe("GET /api/research/asset/:slug/markets", () => {
    it("returns market data for an asset", async () => {
        vi.mocked(messari.getAssetMarkets).mockResolvedValue({
            data: [
                {
                    exchange_name: "Binance",
                    pair: "BTC/USDT",
                    price: 60000,
                    volume_last_24_hours: 5e9,
                    last_trade_at: "2026-01-01T00:00:00Z",
                },
            ],
        } as any);

        const res = await app.request("/api/research/asset/bitcoin/markets");
        expect(res.status).toBe(200);

        const json = (await res.json()) as Record<string, any>;
        expect(json.data).toHaveLength(1);
        expect(json.data[0].exchange).toBe("Binance");
        expect(json.asset).toBe("bitcoin");
    });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/research/signals/:symbol
// ═══════════════════════════════════════════════════════════════

describe("GET /api/research/signals/:symbol", () => {
    it("returns trading signals", async () => {
        vi.mocked(cc.getTradingSignals).mockResolvedValue({
            Data: {
                inOutVar: { sentiment: "bullish" },
                largetxsVar: { large_tx: 100 },
                addressesNetGrowth: { growth: 500 },
                concentrationVar: { concentration: 0.8 },
            },
        } as any);

        const res = await app.request("/api/research/signals/BTC");
        expect(res.status).toBe(200);

        const json = (await res.json()) as Record<string, any>;
        expect(json.data.symbol).toBe("BTC");
        expect(json.data.inOutVar).toBeDefined();
    });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/research/social/:coinId
// ═══════════════════════════════════════════════════════════════

describe("GET /api/research/social/:coinId", () => {
    it("returns social metrics", async () => {
        vi.mocked(cc.getSocialStats).mockResolvedValue({
            Data: {
                General: { Name: "Bitcoin", Points: 100 },
                Twitter: { followers: 10000 },
                Reddit: { subscribers: 5000 },
                CodeRepository: { List: [] },
            },
        } as any);

        const res = await app.request("/api/research/social/1182");
        expect(res.status).toBe(200);

        const json = (await res.json()) as Record<string, any>;
        expect(json.data.name).toBe("Bitcoin");
        expect(json.data.points).toBe(100);
    });

    it("returns 400 for non-numeric coinId", async () => {
        const res = await app.request("/api/research/social/abc");
        expect(res.status).toBe(400);

        const json = (await res.json()) as Record<string, any>;
        expect(json.error).toContain("number");
    });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/research/compare
// ═══════════════════════════════════════════════════════════════

describe("GET /api/research/compare", () => {
    it("compares multiple assets", async () => {
        vi.mocked(messari.getAssetMetrics).mockResolvedValue({
            data: {
                symbol: "BTC",
                name: "Bitcoin",
                market_data: {
                    price_usd: 60000,
                    volume_last_24_hours: 30e9,
                    percent_change_usd_last_24_hours: 2,
                },
                marketcap: { current_marketcap_usd: 1.2e12, rank: 1 },
                roi_data: {
                    percent_change_last_1_week: 5,
                    percent_change_last_1_month: 10,
                    percent_change_last_1_year: 100,
                },
                risk_metrics: {
                    volatility_stats: { volatility_last_30_days: 0.05 },
                    sharpe_ratios: { last_30_days: 1.2 },
                },
                developer_activity: { commits_last_3_months: 200 },
                blockchain_stats_24_hours: { count_of_active_addresses: 1000 },
            },
        } as any);

        const res = await app.request("/api/research/compare?slugs=bitcoin,ethereum");
        expect(res.status).toBe(200);

        const json = (await res.json()) as Record<string, any>;
        expect(json.data.length).toBeGreaterThanOrEqual(1);
    });

    it("returns 400 when slugs parameter is missing", async () => {
        const res = await app.request("/api/research/compare");
        expect(res.status).toBe(400);

        const json = (await res.json()) as Record<string, any>;
        expect(json.error).toContain("slugs");
    });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/research/top-volume
// ═══════════════════════════════════════════════════════════════

describe("GET /api/research/top-volume", () => {
    it("returns top coins by volume", async () => {
        vi.mocked(cc.getTopByVolume).mockResolvedValue({
            Data: [
                {
                    CoinInfo: { Name: "BTC", FullName: "Bitcoin" },
                    RAW: { USD: { PRICE: 60000, VOLUME24HOUR: 30e9, CHANGEPCT24HOUR: 2 } },
                },
            ],
        } as any);

        const res = await app.request("/api/research/top-volume?limit=10");
        expect(res.status).toBe(200);

        const json = (await res.json()) as Record<string, any>;
        expect(json.data).toHaveLength(1);
        expect(json.data[0].symbol).toBe("BTC");
    });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/research/news
// ═══════════════════════════════════════════════════════════════

describe("GET /api/research/news", () => {
    it("returns news articles", async () => {
        vi.mocked(cc.getNews).mockResolvedValue({
            Data: [
                {
                    id: "1",
                    title: "BTC Rally",
                    url: "https://example.com/btc",
                    body: "Bitcoin surged today...",
                    source: "CoinDesk",
                    published_on: 1700000000,
                    categories: "BTC",
                    tags: "bitcoin",
                    imageurl: "https://img.com/btc.png",
                },
            ],
        } as any);

        const res = await app.request("/api/research/news");
        expect(res.status).toBe(200);

        const json = (await res.json()) as Record<string, any>;
        expect(json.data).toHaveLength(1);
        expect(json.data[0].title).toBe("BTC Rally");
        expect(json.data[0].source).toBe("CoinDesk");
    });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/research/search
// ═══════════════════════════════════════════════════════════════

describe("GET /api/research/search", () => {
    it("returns search results", async () => {
        vi.mocked(messari.searchAssets).mockResolvedValue({
            data: [
                { id: "1", symbol: "BTC", name: "Bitcoin", slug: "bitcoin" },
            ],
        } as any);

        const res = await app.request("/api/research/search?q=bitcoin");
        expect(res.status).toBe(200);

        const json = (await res.json()) as Record<string, any>;
        expect(json.data).toHaveLength(1);
        expect(json.query).toBe("bitcoin");
    });

    it("returns 400 when q parameter is missing", async () => {
        const res = await app.request("/api/research/search");
        expect(res.status).toBe(400);

        const json = (await res.json()) as Record<string, any>;
        expect(json.error).toContain("q");
    });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/research/price
// ═══════════════════════════════════════════════════════════════

describe("GET /api/research/price", () => {
    it("returns multi-symbol prices", async () => {
        vi.mocked(cc.getPrice).mockResolvedValue({ BTC: { USD: 60000 } } as any);

        const res = await app.request("/api/research/price?fsyms=BTC&tsyms=USD");
        expect(res.status).toBe(200);

        const json = (await res.json()) as Record<string, any>;
        expect(json.data.BTC.USD).toBe(60000);
        expect(json.source).toBe("cryptocompare");
    });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/research/price-full
// ═══════════════════════════════════════════════════════════════

describe("GET /api/research/price-full", () => {
    it("returns detailed price data", async () => {
        vi.mocked(cc.getPriceFull).mockResolvedValue({
            RAW: {
                BTC: {
                    USD: {
                        PRICE: 60000,
                        VOLUME24HOUR: 30e9,
                        MKTCAP: 1.2e12,
                        CHANGEPCT24HOUR: 2,
                        HIGH24HOUR: 61000,
                        LOW24HOUR: 59000,
                        SUPPLY: 19e6,
                        TOTALVOLUME24HTO: 32e9,
                    },
                },
            },
        } as any);

        const res = await app.request("/api/research/price-full?fsyms=BTC&tsyms=USD");
        expect(res.status).toBe(200);

        const json = (await res.json()) as Record<string, any>;
        expect(json.data.BTC.USD.price).toBe(60000);
    });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/research/histoday/:symbol
// ═══════════════════════════════════════════════════════════════

describe("GET /api/research/histoday/:symbol", () => {
    it("returns daily OHLCV data", async () => {
        vi.mocked(cc.getHistoDay).mockResolvedValue({
            Data: {
                Data: [
                    { time: 1700000000, open: 59000, high: 61000, low: 58000, close: 60000, volumefrom: 100, volumeto: 6e9 },
                ],
            },
        } as any);

        const res = await app.request("/api/research/histoday/BTC?limit=30");
        expect(res.status).toBe(200);

        const json = (await res.json()) as Record<string, any>;
        expect(json.data).toHaveLength(1);
        expect(json.symbol).toBe("BTC");
        expect(json.source).toBe("cryptocompare");
    });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/research/top-mcap
// ═══════════════════════════════════════════════════════════════

describe("GET /api/research/top-mcap", () => {
    it("returns top coins by market cap", async () => {
        vi.mocked(cc.getTopByMarketCap).mockResolvedValue({
            Data: [
                {
                    CoinInfo: { Id: "1", Name: "BTC", FullName: "Bitcoin", ImageUrl: "/btc.png", Algorithm: "SHA-256" },
                    RAW: { USD: { PRICE: 60000, MKTCAP: 1.2e12, VOLUME24HOUR: 30e9, CHANGEPCT24HOUR: 2, SUPPLY: 19e6 } },
                },
            ],
        } as any);

        const res = await app.request("/api/research/top-mcap?limit=10");
        expect(res.status).toBe(200);

        const json = (await res.json()) as Record<string, any>;
        expect(json.data).toHaveLength(1);
        expect(json.data[0].name).toBe("BTC");
    });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/research/exchanges/:symbol
// ═══════════════════════════════════════════════════════════════

describe("GET /api/research/exchanges/:symbol", () => {
    it("returns top exchanges for symbol", async () => {
        vi.mocked(cc.getTopExchanges).mockResolvedValue({
            Data: {
                Exchanges: [
                    { exchange: "Binance", fromSymbol: "BTC", toSymbol: "USD", volume24h: 5e9, volume24hTo: 5e9 },
                ],
            },
        } as any);

        const res = await app.request("/api/research/exchanges/BTC");
        expect(res.status).toBe(200);

        const json = (await res.json()) as Record<string, any>;
        expect(json.data).toHaveLength(1);
        expect(json.data[0].exchange).toBe("Binance");
        expect(json.symbol).toBe("BTC");
    });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/research/news/categories
// ═══════════════════════════════════════════════════════════════

describe("GET /api/research/news/categories", () => {
    it("returns news categories", async () => {
        vi.mocked(cc.getNewsCategories).mockResolvedValue({
            Data: [
                { categoryName: "Bitcoin", wordsAssociatedWithCategory: "btc|bitcoin|satoshi" },
            ],
        } as any);

        const res = await app.request("/api/research/news/categories");
        expect(res.status).toBe(200);

        const json = (await res.json()) as Record<string, any>;
        expect(json.data).toHaveLength(1);
        expect(json.data[0].name).toBe("Bitcoin");
    });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/research/blockchains
// ═══════════════════════════════════════════════════════════════

describe("GET /api/research/blockchains", () => {
    it("returns available blockchain data", async () => {
        vi.mocked(cc.getBlockchainAvailable).mockResolvedValue({
            Data: {
                BTC: { id: 1, data_available_from_ts: 1230940800 },
            },
        } as any);

        const res = await app.request("/api/research/blockchains");
        expect(res.status).toBe(200);

        const json = (await res.json()) as Record<string, any>;
        expect(json.data).toHaveLength(1);
        expect(json.data[0].symbol).toBe("BTC");
    });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/research/asset/:slug/market
// ═══════════════════════════════════════════════════════════════

describe("GET /api/research/asset/:slug/market", () => {
    it("returns real-time market data", async () => {
        vi.mocked(messari.getAssetMarketData).mockResolvedValue({
            data: {
                market_data: {
                    price_usd: 60000,
                    volume_last_24_hours: 30e9,
                    real_volume_last_24_hours: 25e9,
                    percent_change_usd_last_1_hour: 0.1,
                    percent_change_usd_last_24_hours: 2.5,
                    ohlcv_last_1_hour: {},
                    ohlcv_last_24_hour: {},
                },
            },
        } as any);

        const res = await app.request("/api/research/asset/bitcoin/market");
        expect(res.status).toBe(200);

        const json = (await res.json()) as Record<string, any>;
        expect(json.data.price).toBe(60000);
        expect(json.source).toBe("messari");
    });
});
