/**
 * Integration tests for /api/coins, /api/coin/:id, /api/price, /api/trending, /api/global
 *
 * All CoinGecko calls are mocked — no live API traffic.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock the source modules BEFORE importing the routes ─────

vi.mock("@/sources/coingecko.js", () => ({
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

vi.mock("@/sources/alternative.js", () => ({
  getFearGreedIndex: vi.fn(),
}));

import { Hono } from "hono";
import { marketRoutes } from "@/routes/market.js";
import * as cg from "@/sources/coingecko.js";

const app = new Hono();
app.route("/", marketRoutes);

// ─── Fixtures ────────────────────────────────────────────────

const MOCK_COIN = {
  id: "bitcoin",
  symbol: "btc",
  name: "Bitcoin",
  image: "https://img.example.com/btc.png",
  current_price: 65000,
  market_cap: 1_200_000_000_000,
  market_cap_rank: 1,
  total_volume: 30_000_000_000,
  price_change_percentage_24h: 2.5,
  price_change_percentage_7d_in_currency: 5.1,
  price_change_percentage_30d_in_currency: 12.3,
  circulating_supply: 19_500_000,
  total_supply: 21_000_000,
  max_supply: 21_000_000,
  ath: 73000,
  ath_change_percentage: -11,
};

const MOCK_DETAIL = {
  id: "bitcoin",
  symbol: "btc",
  name: "Bitcoin",
  description: { en: "Bitcoin is a cryptocurrency." },
  categories: ["Cryptocurrency"],
  platforms: {},
  links: {
    homepage: ["https://bitcoin.org"],
    blockchain_site: ["https://blockchair.com/bitcoin"],
    repos_url: { github: ["https://github.com/bitcoin/bitcoin"] },
  },
  market_data: {
    current_price: { usd: 65000 },
    market_cap: { usd: 1_200_000_000_000 },
    total_volume: { usd: 30_000_000_000 },
    price_change_percentage_24h: 2.5,
    price_change_percentage_7d: 5.1,
    price_change_percentage_30d: 12.3,
    circulating_supply: 19_500_000,
    total_supply: 21_000_000,
    max_supply: 21_000_000,
  },
};

const MOCK_TRENDING = {
  coins: [
    {
      item: {
        id: "pepe",
        name: "Pepe",
        symbol: "pepe",
        market_cap_rank: 30,
        price_btc: 0.0000001,
        thumb: "https://img.example.com/pepe.png",
        score: 0,
      },
    },
  ],
};

const MOCK_GLOBAL = {
  data: {
    active_cryptocurrencies: 12000,
    markets: 800,
    total_market_cap: { usd: 2_500_000_000_000 },
    total_volume: { usd: 100_000_000_000 },
    market_cap_percentage: { btc: 52, eth: 17 },
    market_cap_change_percentage_24h_usd: 1.8,
  },
};

beforeEach(() => {
  vi.mocked(cg.getCoins).mockReset();
  vi.mocked(cg.getCoinDetail).mockReset();
  vi.mocked(cg.getPrice).mockReset();
  vi.mocked(cg.getTrending).mockReset();
  vi.mocked(cg.getGlobal).mockReset();
  vi.mocked(cg.searchCoins).mockReset();
});

// ─── GET /coins ──────────────────────────────────────────────

describe("GET /coins", () => {
  it("returns transformed coin data", async () => {
    vi.mocked(cg.getCoins).mockResolvedValue([MOCK_COIN]);

    const res = await app.request("/coins");
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0]).toMatchObject({
      id: "bitcoin",
      symbol: "btc",
      name: "Bitcoin",
      price: 65000,
      marketCap: 1_200_000_000_000,
      rank: 1,
      volume24h: 30_000_000_000,
      change24h: 2.5,
    });
    expect(body).toHaveProperty("page");
    expect(body).toHaveProperty("perPage");
    expect(body).toHaveProperty("timestamp");
  });

  it("passes pagination params to source", async () => {
    vi.mocked(cg.getCoins).mockResolvedValue([]);

    await app.request("/coins?page=2&per_page=50");
    expect(cg.getCoins).toHaveBeenCalledWith(
      expect.objectContaining({ page: 2, perPage: 50 })
    );
  });
});

// ─── GET /coin/:id ───────────────────────────────────────────

describe("GET /coin/:id", () => {
  it("returns detailed coin data", async () => {
    vi.mocked(cg.getCoinDetail).mockResolvedValue(MOCK_DETAIL as any);

    const res = await app.request("/coin/bitcoin");
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.data.id).toBe("bitcoin");
    expect(body.data.description).toBe("Bitcoin is a cryptocurrency.");
    expect(body.data.marketData.price).toEqual({ usd: 65000 });
    expect(body.data.links.github).toContain("https://github.com/bitcoin/bitcoin");
  });
});

// ─── GET /price ──────────────────────────────────────────────

describe("GET /price", () => {
  it("returns price data", async () => {
    vi.mocked(cg.getPrice).mockResolvedValue({
      bitcoin: { usd: 65000 },
      ethereum: { usd: 3500 },
    });

    const res = await app.request("/price?ids=bitcoin,ethereum");
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.data.bitcoin.usd).toBe(65000);
    expect(body.data.ethereum.usd).toBe(3500);
  });

  it("returns 400 when ids parameter is missing", async () => {
    const res = await app.request("/price");
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body).toHaveProperty("error");
  });
});

// ─── GET /trending ───────────────────────────────────────────

describe("GET /trending", () => {
  it("returns transformed trending data", async () => {
    vi.mocked(cg.getTrending).mockResolvedValue(MOCK_TRENDING);

    const res = await app.request("/trending");
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0]).toMatchObject({
      id: "pepe",
      name: "Pepe",
      symbol: "pepe",
    });
  });
});

// ─── GET /global ─────────────────────────────────────────────

describe("GET /global", () => {
  it("returns transformed global market data", async () => {
    vi.mocked(cg.getGlobal).mockResolvedValue(MOCK_GLOBAL as any);

    const res = await app.request("/global");
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.data).toMatchObject({
      activeCryptocurrencies: 12000,
      markets: 800,
      totalMarketCap: 2_500_000_000_000,
      totalVolume24h: 100_000_000_000,
      btcDominance: 52,
      ethDominance: 17,
      marketCapChange24h: 1.8,
    });
  });
});

// ─── GET /search ─────────────────────────────────────────────

describe("GET /search", () => {
  it("returns search results", async () => {
    vi.mocked(cg.searchCoins).mockResolvedValue({
      coins: [{ id: "bitcoin", name: "Bitcoin", symbol: "btc", market_cap_rank: 1 }],
    });

    const res = await app.request("/search?q=bitcoin");
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].id).toBe("bitcoin");
  });

  it("returns 400 when q parameter is missing", async () => {
    const res = await app.request("/search");
    expect(res.status).toBe(400);
  });
});
