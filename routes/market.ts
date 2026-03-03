/**
 * Crypto Vision — Market Data Routes
 *
 * GET /api/coins          — Top coins by market cap
 * GET /api/coin/:id       — Coin detail
 * GET /api/price          — Simple price lookup
 * GET /api/trending       — Trending coins
 * GET /api/global         — Global market stats
 * GET /api/search         — Search coins
 * GET /api/chart/:id      — Price chart data
 * GET /api/ohlc/:id       — OHLC candles
 * GET /api/exchanges      — Exchange rankings
 * GET /api/categories     — Market categories
 * GET /api/fear-greed     — Fear & Greed Index
 */

import { Hono } from "hono";
import * as cg from "../sources/coingecko.js";
import * as alt from "../sources/alternative.js";

export const marketRoutes = new Hono();

// ─── GET /api/coins ──────────────────────────────────────────

marketRoutes.get("/coins", async (c) => {
  const page = Number(c.req.query("page") || 1);
  const perPage = Math.min(Number(c.req.query("per_page") || 100), 250);
  const order = c.req.query("order") || "market_cap_desc";
  const sparkline = c.req.query("sparkline") === "true";
  const ids = c.req.query("ids");
  const category = c.req.query("category");

  const coins = await cg.getCoins({ page, perPage, order, sparkline, ids, category });

  return c.json({
    data: coins.map((coin) => ({
      id: coin.id,
      symbol: coin.symbol,
      name: coin.name,
      image: coin.image,
      price: coin.current_price,
      marketCap: coin.market_cap,
      rank: coin.market_cap_rank,
      volume24h: coin.total_volume,
      change24h: coin.price_change_percentage_24h,
      change7d: coin.price_change_percentage_7d_in_currency ?? null,
      change30d: coin.price_change_percentage_30d_in_currency ?? null,
      circulatingSupply: coin.circulating_supply,
      totalSupply: coin.total_supply,
      maxSupply: coin.max_supply,
      ath: coin.ath,
      athChange: coin.ath_change_percentage,
      ...(sparkline && coin.sparkline_in_7d
        ? { sparkline7d: coin.sparkline_in_7d.price }
        : {}),
    })),
    page,
    perPage,
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/coin/:id ──────────────────────────────────────

marketRoutes.get("/coin/:id", async (c) => {
  const detail = await cg.getCoinDetail(c.req.param("id"));

  return c.json({
    data: {
      id: detail.id,
      symbol: detail.symbol,
      name: detail.name,
      description: detail.description.en,
      categories: detail.categories,
      platforms: detail.platforms,
      links: {
        homepage: detail.links.homepage.filter(Boolean),
        explorers: detail.links.blockchain_site.filter(Boolean),
        github: detail.links.repos_url.github.filter(Boolean),
      },
      marketData: {
        price: detail.market_data.current_price,
        marketCap: detail.market_data.market_cap,
        volume: detail.market_data.total_volume,
        change24h: detail.market_data.price_change_percentage_24h,
        change7d: detail.market_data.price_change_percentage_7d,
        change30d: detail.market_data.price_change_percentage_30d,
        circulatingSupply: detail.market_data.circulating_supply,
        totalSupply: detail.market_data.total_supply,
        maxSupply: detail.market_data.max_supply,
      },
    },
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/price ──────────────────────────────────────────

marketRoutes.get("/price", async (c) => {
  const ids = c.req.query("ids");
  if (!ids) return c.json({ error: "ids parameter required" }, 400);

  const vs = c.req.query("vs_currencies") || "usd";
  const data = await cg.getPrice(ids, vs);

  return c.json({ data, timestamp: new Date().toISOString() });
});

// ─── GET /api/trending ───────────────────────────────────────

marketRoutes.get("/trending", async (c) => {
  const { coins } = await cg.getTrending();

  return c.json({
    data: coins.map((t) => ({
      id: t.item.id,
      name: t.item.name,
      symbol: t.item.symbol,
      rank: t.item.market_cap_rank,
      priceBtc: t.item.price_btc,
      thumb: t.item.thumb,
      score: t.item.score,
    })),
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/global ─────────────────────────────────────────

marketRoutes.get("/global", async (c) => {
  const { data } = await cg.getGlobal();

  return c.json({
    data: {
      activeCryptocurrencies: data.active_cryptocurrencies,
      markets: data.markets,
      totalMarketCap: data.total_market_cap.usd,
      totalVolume24h: data.total_volume.usd,
      btcDominance: data.market_cap_percentage.btc,
      ethDominance: data.market_cap_percentage.eth,
      marketCapChange24h: data.market_cap_change_percentage_24h_usd,
    },
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/search ─────────────────────────────────────────

marketRoutes.get("/search", async (c) => {
  const q = c.req.query("q");
  if (!q) return c.json({ error: "q parameter required" }, 400);

  const results = await cg.searchCoins(q);

  return c.json({
    data: results.coins.map((coin) => ({
      id: coin.id,
      name: coin.name,
      symbol: coin.symbol,
      rank: coin.market_cap_rank,
    })),
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/chart/:id ──────────────────────────────────────

marketRoutes.get("/chart/:id", async (c) => {
  const days = c.req.query("days") || "7";
  const interval = c.req.query("interval");
  const data = await cg.getMarketChart(c.req.param("id"), days, interval || undefined);

  return c.json({
    data: {
      prices: data.prices,
      marketCaps: data.market_caps,
      volumes: data.total_volumes,
    },
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/ohlc/:id ──────────────────────────────────────

marketRoutes.get("/ohlc/:id", async (c) => {
  const days = Number(c.req.query("days") || 7);
  const data = await cg.getOHLC(c.req.param("id"), days);

  return c.json({
    data: data.map(([t, o, h, l, cl]) => ({
      timestamp: t,
      open: o,
      high: h,
      low: l,
      close: cl,
    })),
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/exchanges ──────────────────────────────────────

marketRoutes.get("/exchanges", async (c) => {
  const page = Number(c.req.query("page") || 1);
  const perPage = Math.min(Number(c.req.query("per_page") || 100), 250);
  const data = await cg.getExchanges(page, perPage);

  return c.json({
    data: data.map((ex) => ({
      id: ex.id,
      name: ex.name,
      yearEstablished: ex.year_established,
      country: ex.country,
      volume24hBtc: ex.trade_volume_24h_btc,
      trustScore: ex.trust_score,
      rank: ex.trust_score_rank,
    })),
    page,
    perPage,
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/categories ─────────────────────────────────────

marketRoutes.get("/categories", async (c) => {
  const data = await cg.getCategories();

  return c.json({
    data: data.map((cat) => ({
      id: cat.id,
      name: cat.name,
      marketCap: cat.market_cap,
      change24h: cat.market_cap_change_24h,
      volume24h: cat.volume_24h,
      topCoins: cat.top_3_coins,
    })),
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/fear-greed ─────────────────────────────────────

marketRoutes.get("/fear-greed", async (c) => {
  const limit = Math.min(Number(c.req.query("limit") || 1), 30);
  const { data } = await alt.getFearGreedIndex(limit);

  return c.json({
    data: data.map((d) => ({
      value: Number(d.value),
      classification: d.value_classification,
      timestamp: new Date(Number(d.timestamp) * 1000).toISOString(),
    })),
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/dex/search ─────────────────────────────────────

marketRoutes.get("/dex/search", async (c) => {
  const q = c.req.query("q");
  if (!q) return c.json({ error: "q parameter required" }, 400);

  const { pairs } = await alt.dexSearch(q);

  return c.json({
    data: (pairs || []).slice(0, 50).map((p) => ({
      chain: p.chainId,
      dex: p.dexId,
      pair: p.pairAddress,
      baseToken: p.baseToken,
      quoteToken: p.quoteToken,
      priceUsd: p.priceUsd,
      volume24h: p.volume?.h24,
      liquidity: p.liquidity?.usd,
      fdv: p.fdv,
      txns24h: p.txns?.h24,
      createdAt: p.pairCreatedAt,
    })),
    timestamp: new Date().toISOString(),
  });
});
