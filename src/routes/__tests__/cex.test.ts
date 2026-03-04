/**
 * Integration tests for CEX (Centralized Exchange) routes.
 *
 * Mocks the Binance source adapter so no real HTTP calls are made.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";

// ─── Mock sources BEFORE importing routes ────────────────────

vi.mock("../../sources/binance.js", () => ({
    getTicker24h: vi.fn(),
    getTickerPrice: vi.fn(),
    getOrderBook: vi.fn(),
    getRecentTrades: vi.fn(),
    getKlines: vi.fn(),
    getExchangeInfo: vi.fn(),
    getBookTicker: vi.fn(),
    getMiniTicker: vi.fn(),
    getAvgPrice: vi.fn(),
}));

import * as binance from "../../sources/binance.js";
import { cexRoutes } from "../cex.js";

const app = new Hono().route("/api/cex", cexRoutes);

beforeEach(() => {
    vi.clearAllMocks();
});

// ═══════════════════════════════════════════════════════════════
// GET /api/cex/tickers
// ═══════════════════════════════════════════════════════════════

describe("GET /api/cex/tickers", () => {
    it("returns all tickers sorted by volume", async () => {
        vi.mocked(binance.getTicker24h).mockResolvedValue([
            {
                symbol: "BTCUSDT",
                lastPrice: "60000",
                priceChange: "500",
                priceChangePercent: "0.84",
                highPrice: "61000",
                lowPrice: "59000",
                volume: "1000",
                quoteVolume: "60000000",
                count: 50000,
            },
            {
                symbol: "ETHUSDT",
                lastPrice: "3600",
                priceChange: "50",
                priceChangePercent: "1.4",
                highPrice: "3700",
                lowPrice: "3500",
                volume: "5000",
                quoteVolume: "18000000",
                count: 30000,
            },
        ] as any);

        const res = await app.request("/api/cex/tickers?limit=10");
        expect(res.status).toBe(200);

        const json = (await res.json()) as Record<string, any>;
        expect(json.data).toHaveLength(2);
        // Sorted by quoteVolume desc
        expect(json.data[0].symbol).toBe("BTCUSDT");
        expect(json.data[0].price).toBe(60000);
    });

    it("filters by quote asset", async () => {
        vi.mocked(binance.getTicker24h).mockResolvedValue([
            { symbol: "BTCUSDT", lastPrice: "60000", priceChange: "500", priceChangePercent: "0.84", highPrice: "61000", lowPrice: "59000", volume: "1000", quoteVolume: "60000000", count: 50000 },
            { symbol: "ETHBTC", lastPrice: "0.06", priceChange: "0.001", priceChangePercent: "1.6", highPrice: "0.062", lowPrice: "0.059", volume: "100", quoteVolume: "6", count: 1000 },
        ] as any);

        const res = await app.request("/api/cex/tickers?quote=USDT");
        expect(res.status).toBe(200);

        const json = (await res.json()) as Record<string, any>;
        expect(json.data).toHaveLength(1);
        expect(json.data[0].symbol).toBe("BTCUSDT");
    });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/cex/ticker/:symbol
// ═══════════════════════════════════════════════════════════════

describe("GET /api/cex/ticker/:symbol", () => {
    it("returns a single ticker", async () => {
        vi.mocked(binance.getTicker24h).mockResolvedValue({
            symbol: "BTCUSDT",
            lastPrice: "60000",
            priceChange: "500",
            priceChangePercent: "0.84",
            weightedAvgPrice: "59500",
            highPrice: "61000",
            lowPrice: "59000",
            openPrice: "59500",
            volume: "1000",
            quoteVolume: "60000000",
            count: 50000,
            bidPrice: "59999",
            askPrice: "60001",
        } as any);

        const res = await app.request("/api/cex/ticker/btcusdt");
        expect(res.status).toBe(200);

        const json = (await res.json()) as Record<string, any>;
        expect(json.data.symbol).toBe("BTCUSDT");
        expect(json.data.price).toBe(60000);
        expect(json.data.bid).toBe(59999);
    });

    it("returns 404 for invalid symbol", async () => {
        vi.mocked(binance.getTicker24h).mockRejectedValue(new Error("Invalid symbol"));

        const res = await app.request("/api/cex/ticker/INVALID");
        expect(res.status).toBe(404);

        const json = (await res.json()) as Record<string, any>;
        expect(json.error).toContain("INVALID");
    });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/cex/price/:symbol
// ═══════════════════════════════════════════════════════════════

describe("GET /api/cex/price/:symbol", () => {
    it("returns price for a symbol", async () => {
        vi.mocked(binance.getTickerPrice).mockResolvedValue({
            symbol: "BTCUSDT",
            price: "60000.00",
        } as any);

        const res = await app.request("/api/cex/price/btcusdt");
        expect(res.status).toBe(200);

        const json = (await res.json()) as Record<string, any>;
        expect(json.data.symbol).toBe("BTCUSDT");
        expect(json.data.price).toBe(60000);
    });

    it("returns 404 when symbol not found", async () => {
        vi.mocked(binance.getTickerPrice).mockRejectedValue(new Error("Not found"));

        const res = await app.request("/api/cex/price/FAKE");
        expect(res.status).toBe(404);
    });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/cex/prices
// ═══════════════════════════════════════════════════════════════

describe("GET /api/cex/prices", () => {
    it("returns all prices", async () => {
        vi.mocked(binance.getTickerPrice).mockResolvedValue([
            { symbol: "BTCUSDT", price: "60000" },
            { symbol: "ETHUSDT", price: "3600" },
        ] as any);

        const res = await app.request("/api/cex/prices");
        expect(res.status).toBe(200);

        const json = (await res.json()) as Record<string, any>;
        expect(json.data).toHaveLength(2);
        expect(json.data[0].price).toBe(60000);
    });

    it("filters by quote", async () => {
        vi.mocked(binance.getTickerPrice).mockResolvedValue([
            { symbol: "BTCUSDT", price: "60000" },
            { symbol: "ETHBTC", price: "0.06" },
        ] as any);

        const res = await app.request("/api/cex/prices?quote=USDT");
        expect(res.status).toBe(200);

        const json = (await res.json()) as Record<string, any>;
        expect(json.data).toHaveLength(1);
        expect(json.data[0].symbol).toBe("BTCUSDT");
    });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/cex/orderbook/:symbol
// ═══════════════════════════════════════════════════════════════

describe("GET /api/cex/orderbook/:symbol", () => {
    it("returns order book", async () => {
        vi.mocked(binance.getOrderBook).mockResolvedValue({
            lastUpdateId: 123456,
            bids: [["60000", "1.5"]],
            asks: [["60001", "2.0"]],
        } as any);

        const res = await app.request("/api/cex/orderbook/BTCUSDT?limit=5");
        expect(res.status).toBe(200);

        const json = (await res.json()) as Record<string, any>;
        expect(json.data.bids).toHaveLength(1);
        expect(json.data.bids[0].price).toBe(60000);
        expect(json.data.asks[0].price).toBe(60001);
    });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/cex/trades/:symbol
// ═══════════════════════════════════════════════════════════════

describe("GET /api/cex/trades/:symbol", () => {
    it("returns recent trades", async () => {
        vi.mocked(binance.getRecentTrades).mockResolvedValue([
            {
                id: 1,
                price: "60000",
                qty: "0.5",
                quoteQty: "30000",
                time: 1700000000000,
                isBuyerMaker: false,
            },
        ] as any);

        const res = await app.request("/api/cex/trades/BTCUSDT?limit=10");
        expect(res.status).toBe(200);

        const json = (await res.json()) as Record<string, any>;
        expect(json.data).toHaveLength(1);
        expect(json.data[0].side).toBe("buy");
    });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/cex/klines/:symbol
// ═══════════════════════════════════════════════════════════════

describe("GET /api/cex/klines/:symbol", () => {
    it("returns kline/candlestick data", async () => {
        vi.mocked(binance.getKlines).mockResolvedValue([
            [1700000000000, "59000", "61000", "58500", "60000", "100", 1700003600000, "5900000", 500],
        ] as any);

        const res = await app.request("/api/cex/klines/BTCUSDT?interval=1h&limit=10");
        expect(res.status).toBe(200);

        const json = (await res.json()) as Record<string, any>;
        expect(json.data).toHaveLength(1);
        expect(json.data[0].open).toBe(59000);
        expect(json.data[0].close).toBe(60000);
        expect(json.interval).toBe("1h");
    });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/cex/pairs
// ═══════════════════════════════════════════════════════════════

describe("GET /api/cex/pairs", () => {
    it("returns trading pairs", async () => {
        vi.mocked(binance.getExchangeInfo).mockResolvedValue({
            symbols: [
                { symbol: "BTCUSDT", baseAsset: "BTC", quoteAsset: "USDT", status: "TRADING" },
                { symbol: "ETHUSDT", baseAsset: "ETH", quoteAsset: "USDT", status: "TRADING" },
                { symbol: "OLDUSDT", baseAsset: "OLD", quoteAsset: "USDT", status: "BREAK" },
            ],
        } as any);

        const res = await app.request("/api/cex/pairs");
        expect(res.status).toBe(200);

        const json = (await res.json()) as Record<string, any>;
        // Only TRADING status
        expect(json.data).toHaveLength(2);
        expect(json.data[0].base).toBe("BTC");
    });

    it("filters by quote asset", async () => {
        vi.mocked(binance.getExchangeInfo).mockResolvedValue({
            symbols: [
                { symbol: "BTCUSDT", baseAsset: "BTC", quoteAsset: "USDT", status: "TRADING" },
                { symbol: "ETHBTC", baseAsset: "ETH", quoteAsset: "BTC", status: "TRADING" },
            ],
        } as any);

        const res = await app.request("/api/cex/pairs?quote=BTC");
        expect(res.status).toBe(200);

        const json = (await res.json()) as Record<string, any>;
        expect(json.data).toHaveLength(1);
        expect(json.data[0].symbol).toBe("ETHBTC");
    });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/cex/book-ticker
// ═══════════════════════════════════════════════════════════════

describe("GET /api/cex/book-ticker", () => {
    it("returns single book ticker with symbol", async () => {
        vi.mocked(binance.getBookTicker).mockResolvedValue({
            symbol: "BTCUSDT",
            bidPrice: "59999",
            bidQty: "1.5",
            askPrice: "60001",
            askQty: "2.0",
        } as any);

        const res = await app.request("/api/cex/book-ticker?symbol=BTCUSDT");
        expect(res.status).toBe(200);

        const json = (await res.json()) as Record<string, any>;
        expect(json.data.symbol).toBe("BTCUSDT");
        expect(json.data.spread).toBe(2);
    });

    it("returns all book tickers without symbol", async () => {
        vi.mocked(binance.getBookTicker).mockResolvedValue([
            { symbol: "BTCUSDT", bidPrice: "59999", bidQty: "1", askPrice: "60001", askQty: "1" },
            { symbol: "ETHUSDT", bidPrice: "3599", bidQty: "5", askPrice: "3601", askQty: "5" },
        ] as any);

        const res = await app.request("/api/cex/book-ticker");
        expect(res.status).toBe(200);

        const json = (await res.json()) as Record<string, any>;
        expect(json.data).toHaveLength(2);
    });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/cex/mini-ticker
// ═══════════════════════════════════════════════════════════════

describe("GET /api/cex/mini-ticker", () => {
    it("returns mini tickers", async () => {
        vi.mocked(binance.getMiniTicker).mockResolvedValue([
            {
                symbol: "BTCUSDT",
                lastPrice: "60000",
                openPrice: "59500",
                highPrice: "61000",
                lowPrice: "59000",
                volume: "1000",
                quoteVolume: "60000000",
            },
        ] as any);

        const res = await app.request("/api/cex/mini-ticker");
        expect(res.status).toBe(200);

        const json = (await res.json()) as Record<string, any>;
        expect(json.data).toHaveLength(1);
        expect(json.data[0].lastPrice).toBe(60000);
        expect(json.source).toBe("binance");
    });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/cex/avg-price/:symbol
// ═══════════════════════════════════════════════════════════════

describe("GET /api/cex/avg-price/:symbol", () => {
    it("returns weighted average price", async () => {
        vi.mocked(binance.getAvgPrice).mockResolvedValue({
            mins: 5,
            price: "60000.50",
        } as any);

        const res = await app.request("/api/cex/avg-price/btcusdt");
        expect(res.status).toBe(200);

        const json = (await res.json()) as Record<string, any>;
        expect(json.data.symbol).toBe("BTCUSDT");
        expect(json.data.price).toBe(60000.5);
        expect(json.data.windowMinutes).toBe(5);
    });
});
