/**
 * Integration tests for market routes.
 *
 * Mocks all source adapters (coingecko, alternative) so no real HTTP calls are made.
 * Uses Hono's `app.request()` test helper.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";

// ─── Mock sources BEFORE importing routes ────────────────────

vi.mock("../../sources/coingecko.js", () => ({
  getCoins: vi.fn(),
  getCoinDetail: vi.fn(),
  getPrice: vi.fn(),
  getTrending: vi.fn(),
  getGlobal: vi.fn(),
  searchCoins: vi.fn(),
  getMarketChart: vi.fn(),
  getOHLC: vi.fn(),
  getExchanges: vi.fn(),
  getCategories: vi.fn(),
}));

vi.mock("../../sources/alternative.js", () => ({
  getFearGreedIndex: vi.fn(),
  dexSearch: vi.fn(),
}));

import * as cg from "../../sources/coingecko.js";
import * as alt from "../../sources/alternative.js";
import { marketRoutes } from "../market.js";

// ─── Set up app ──────────────────────────────────────────────

const app = new Hono().route("/api", marketRoutes);

beforeEach(() => {
  vi.clearAllMocks();
});

// ═══════════════════════════════════════════════════════════════
// GET /api/coins
// ═══════════════════════════════════════════════════════════════

describe("GET /api/coins", () => {
  it("returns mapped coin data on success", async () => {
    vi.mocked(cg.getCoins).mockResolvedValue([
      {
        id: "bitcoin",
        symbol: "btc",
        name: "Bitcoin",
        image: "https://img.com/btc.png",
        current_price: 60000,
        market_cap: 1.2e12,
        market_cap_rank: 1,
        total_volume: 30e9,
        price_change_percentage_24h: 2.5,
        price_change_percentage_7d_in_currency: 5.1,
        price_change_percentage_30d_in_currency: 10.2,
        circulating_supply: 19e6,
        total_supply: 21e6,
        max_supply: 21e6,
        ath: 69000,
        ath_change_percentage: -13,
      },
    ]);

    const res = await app.request("/api/coins?page=1&per_page=10");
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.data).toHaveLength(1);
    expect(json.data[0]).toMatchObject({
      id: "bitcoin",
      symbol: "btc",
      price: 60000,
      marketCap: 1.2e12,
      rank: 1,
    });
    expect(json).toHaveProperty("page", 1);
    expect(json).toHaveProperty("perPage", 10);
    expect(json).toHaveProperty("timestamp");
  });

  it("propagates source errors as 500", async () => {
    vi.mocked(cg.getCoins).mockRejectedValue(new Error("CoinGecko down"));

    const res = await app.request("/api/coins");
    expect(res.status).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/coin/:id
// ═══════════════════════════════════════════════════════════════

describe("GET /api/coin/:id", () => {
  it("returns coin detail on success", async () => {
    vi.mocked(cg.getCoinDetail).mockResolvedValue({
      id: "ethereum",
      symbol: "eth",
      name: "Ethereum",
      description: { en: "Smart contract platform" },
      categories: ["Smart Contract Platform"],
      platforms: { "": "" },
      links: {
        homepage: ["https://ethereum.org", ""],
        blockchain_site: ["https://etherscan.io", ""],
        repos_url: { github: ["https://github.com/ethereum/go-ethereum", ""] },
      },
      market_data: {
        current_price: { usd: 3500 },
        market_cap: { usd: 420e9 },
        total_volume: { usd: 15e9 },
        price_change_percentage_24h: 1.2,
        price_change_percentage_7d: 4.5,
        price_change_percentage_30d: 12.0,
        circulating_supply: 120e6,
        total_supply: null,
        max_supply: null,
      },
    });

    const res = await app.request("/api/coin/ethereum");
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.data.id).toBe("ethereum");
    expect(json.data.description).toBe("Smart contract platform");
    expect(json.data.marketData.price).toEqual({ usd: 3500 });
    expect(json.data.links.homepage).toEqual(["https://ethereum.org"]);
  });

  it("propagates source errors as 500", async () => {
    vi.mocked(cg.getCoinDetail).mockRejectedValue(new Error("not found"));

    const res = await app.request("/api/coin/fakecoin");
    expect(res.status).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/price
// ═══════════════════════════════════════════════════════════════

describe("GET /api/price", () => {
  it("returns price data for valid ids", async () => {
    vi.mocked(cg.getPrice).mockResolvedValue({
      bitcoin: { usd: 60000, usd_24h_change: 2.5 },
    });

    const res = await app.request("/api/price?ids=bitcoin&vs_currencies=usd");
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.data.bitcoin.usd).toBe(60000);
  });

  it("returns 400 when ids param is missing", async () => {
    const res = await app.request("/api/price");
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.error).toMatch(/ids/i);
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/trending
// ═══════════════════════════════════════════════════════════════

describe("GET /api/trending", () => {
  it("returns trending coins", async () => {
    vi.mocked(cg.getTrending).mockResolvedValue({
      coins: [
        {
          item: {
            id: "pepe",
            coin_id: 999,
            name: "Pepe",
            symbol: "PEPE",
            market_cap_rank: 50,
            thumb: "https://img.com/pepe.png",
            price_btc: 0.00000001,
            score: 0,
          },
        },
      ],
    });

    const res = await app.request("/api/trending");
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.data[0]).toMatchObject({ id: "pepe", name: "Pepe" });
  });

  it("propagates source errors as 500", async () => {
    vi.mocked(cg.getTrending).mockRejectedValue(new Error("timeout"));

    const res = await app.request("/api/trending");
    expect(res.status).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/global
// ═══════════════════════════════════════════════════════════════

describe("GET /api/global", () => {
  it("returns global market data", async () => {
    vi.mocked(cg.getGlobal).mockResolvedValue({
      data: {
        active_cryptocurrencies: 10000,
        markets: 800,
        total_market_cap: { usd: 2.5e12 },
        total_volume: { usd: 100e9 },
        market_cap_percentage: { btc: 52.1, eth: 17.3 },
        market_cap_change_percentage_24h_usd: 1.5,
      },
    });

    const res = await app.request("/api/global");
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.data.totalMarketCap).toBe(2.5e12);
    expect(json.data.btcDominance).toBe(52.1);
  });

  it("propagates source errors as 500", async () => {
    vi.mocked(cg.getGlobal).mockRejectedValue(new Error("fail"));

    const res = await app.request("/api/global");
    expect(res.status).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/search
// ═══════════════════════════════════════════════════════════════

describe("GET /api/search", () => {
  it("returns search results", async () => {
    vi.mocked(cg.searchCoins).mockResolvedValue({
      coins: [{ id: "bitcoin", name: "Bitcoin", symbol: "btc", market_cap_rank: 1 }],
    });

    const res = await app.request("/api/search?q=bitcoin");
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.data[0].id).toBe("bitcoin");
  });

  it("returns 400 when q param is missing", async () => {
    const res = await app.request("/api/search");
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.error).toMatch(/q/i);
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/chart/:id
// ═══════════════════════════════════════════════════════════════

describe("GET /api/chart/:id", () => {
  it("returns chart data", async () => {
    vi.mocked(cg.getMarketChart).mockResolvedValue({
      prices: [[1700000000000, 60000]],
      market_caps: [[1700000000000, 1.2e12]],
      total_volumes: [[1700000000000, 30e9]],
    });

    const res = await app.request("/api/chart/bitcoin?days=30");
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.data.prices).toHaveLength(1);
    expect(json.data.volumes).toHaveLength(1);
  });

  it("propagates source errors as 500", async () => {
    vi.mocked(cg.getMarketChart).mockRejectedValue(new Error("timeout"));

    const res = await app.request("/api/chart/bitcoin");
    expect(res.status).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/ohlc/:id
// ═══════════════════════════════════════════════════════════════

describe("GET /api/ohlc/:id", () => {
  it("returns OHLC candles", async () => {
    vi.mocked(cg.getOHLC).mockResolvedValue([
      [1700000000000, 59000, 61000, 58500, 60500],
    ]);

    const res = await app.request("/api/ohlc/bitcoin?days=7");
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.data[0]).toMatchObject({
      open: 59000,
      high: 61000,
      low: 58500,
      close: 60500,
    });
  });

  it("propagates source errors as 500", async () => {
    vi.mocked(cg.getOHLC).mockRejectedValue(new Error("timeout"));

    const res = await app.request("/api/ohlc/bitcoin");
    expect(res.status).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/exchanges
// ═══════════════════════════════════════════════════════════════

describe("GET /api/exchanges", () => {
  it("returns exchange list", async () => {
    vi.mocked(cg.getExchanges).mockResolvedValue([
      {
        id: "binance",
        name: "Binance",
        year_established: 2017,
        country: "Cayman Islands",
        trade_volume_24h_btc: 500000,
        trust_score: 10,
        trust_score_rank: 1,
      },
    ]);

    const res = await app.request("/api/exchanges");
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.data[0]).toMatchObject({ id: "binance", name: "Binance" });
  });

  it("propagates source errors as 500", async () => {
    vi.mocked(cg.getExchanges).mockRejectedValue(new Error("fail"));

    const res = await app.request("/api/exchanges");
    expect(res.status).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/categories
// ═══════════════════════════════════════════════════════════════

describe("GET /api/categories", () => {
  it("returns categories", async () => {
    vi.mocked(cg.getCategories).mockResolvedValue([
      {
        id: "defi",
        name: "Decentralized Finance",
        market_cap: 100e9,
        market_cap_change_24h: 3.2,
        top_3_coins: ["https://img/btc.png"],
        volume_24h: 5e9,
      },
    ]);

    const res = await app.request("/api/categories");
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.data[0].name).toBe("Decentralized Finance");
  });

  it("propagates source errors as 500", async () => {
    vi.mocked(cg.getCategories).mockRejectedValue(new Error("fail"));

    const res = await app.request("/api/categories");
    expect(res.status).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/fear-greed
// ═══════════════════════════════════════════════════════════════

describe("GET /api/fear-greed", () => {
  it("returns fear & greed data", async () => {
    vi.mocked(alt.getFearGreedIndex).mockResolvedValue({
      name: "Fear and Greed Index",
      data: [
        { value: "75", value_classification: "Greed", timestamp: "1700000000" },
      ],
    });

    const res = await app.request("/api/fear-greed?limit=1");
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.data[0]).toMatchObject({ value: 75, classification: "Greed" });
  });

  it("propagates source errors as 500", async () => {
    vi.mocked(alt.getFearGreedIndex).mockRejectedValue(new Error("fail"));

    const res = await app.request("/api/fear-greed");
    expect(res.status).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/dex/search
// ═══════════════════════════════════════════════════════════════

describe("GET /api/dex/search", () => {
  it("returns dex search results", async () => {
    vi.mocked(alt.dexSearch).mockResolvedValue({
      pairs: [
        {
          chainId: "ethereum",
          dexId: "uniswap",
          pairAddress: "0x123",
          baseToken: { address: "0xabc", name: "Pepe", symbol: "PEPE" },
          quoteToken: { address: "0xdef", name: "WETH", symbol: "WETH" },
          priceNative: "0.0001",
          priceUsd: "0.15",
          txns: { h24: { buys: 500, sells: 400 } },
          volume: { h24: 1e6 },
          liquidity: { usd: 5e6 },
          fdv: 1e9,
          pairCreatedAt: 1700000000000,
        },
      ],
    });

    const res = await app.request("/api/dex/search?q=pepe");
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.data[0]).toMatchObject({ chain: "ethereum", dex: "uniswap" });
  });

  it("returns 400 when q param is missing", async () => {
    const res = await app.request("/api/dex/search");
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.error).toMatch(/q/i);
  });
});
