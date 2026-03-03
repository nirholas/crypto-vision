/**
 * Crypto Vision — Aggregator / Multi-Source Routes
 *
 * Cross-source aggregated data using CoinPaprika, CoinCap, and others.
 * No API key required for any of these.
 *
 * GET /api/aggregate/prices/:ids       — Price from 3+ sources
 * GET /api/aggregate/global            — Global stats cross-checked
 * GET /api/aggregate/tickers           — CoinPaprika tickers
 * GET /api/aggregate/assets            — CoinCap assets
 * GET /api/aggregate/history/:id       — CoinCap price history
 * GET /api/aggregate/top-movers        — Biggest 24h gainers/losers
 * GET /api/aggregate/market-overview   — Full market dashboard
 */

import { Hono } from "hono";
import * as cg from "../sources/coingecko.js";
import * as alt from "../sources/alternative.js";
import * as llama from "../sources/defillama.js";

export const aggregateRoutes = new Hono();

// ─── GET /api/aggregate/prices/:ids ──────────────────────────

aggregateRoutes.get("/prices/:ids", async (c) => {
  const ids = c.req.param("ids");
  const symbols = ids.toUpperCase().split(",");

  const [cgPrice, paprikaTickers, coincapAssets] = await Promise.allSettled([
    cg.getPrice(ids.toLowerCase(), "usd"),
    alt.getCoinPaprikaTickers(250),
    alt.getCoinCapAssets(250),
  ]);

  const results: Record<string, { coingecko?: number; coinpaprika?: number; coincap?: number; average?: number }> = {};

  for (const sym of symbols) {
    const key = sym.toLowerCase();
    results[key] = {};

    // CoinGecko
    if (cgPrice.status === "fulfilled" && cgPrice.value[key]) {
      results[key].coingecko = cgPrice.value[key].usd;
    }

    // CoinPaprika
    if (paprikaTickers.status === "fulfilled") {
      const match = paprikaTickers.value.find(
        (t) => t.symbol.toUpperCase() === sym,
      );
      if (match) results[key].coinpaprika = match.quotes.USD.price;
    }

    // CoinCap
    if (coincapAssets.status === "fulfilled") {
      const match = coincapAssets.value.data.find(
        (a) => a.symbol.toUpperCase() === sym,
      );
      if (match) results[key].coincap = parseFloat(match.priceUsd);
    }

    // Average
    const prices = Object.values(results[key]).filter((v): v is number => typeof v === "number");
    if (prices.length > 0) {
      results[key].average = prices.reduce((a, b) => a + b, 0) / prices.length;
    }
  }

  return c.json({ data: results, timestamp: new Date().toISOString() });
});

// ─── GET /api/aggregate/global ───────────────────────────────

aggregateRoutes.get("/global", async (c) => {
  const [cgGlobal, paprikaGlobal, fearGreed] = await Promise.allSettled([
    cg.getGlobal(),
    alt.getCoinPaprikaGlobal(),
    alt.getFearGreedIndex(1),
  ]);

  return c.json({
    data: {
      coingecko: cgGlobal.status === "fulfilled"
        ? {
            totalMarketCap: cgGlobal.value.data.total_market_cap.usd,
            totalVolume24h: cgGlobal.value.data.total_volume.usd,
            btcDominance: cgGlobal.value.data.market_cap_percentage.btc,
            change24h: cgGlobal.value.data.market_cap_change_percentage_24h_usd,
            activeCryptos: cgGlobal.value.data.active_cryptocurrencies,
          }
        : null,
      coinpaprika: paprikaGlobal.status === "fulfilled"
        ? {
            totalMarketCap: paprikaGlobal.value.market_cap_usd,
            totalVolume24h: paprikaGlobal.value.volume_24h_usd,
            btcDominance: paprikaGlobal.value.bitcoin_dominance_percentage,
            change24h: paprikaGlobal.value.market_cap_change_24h,
            cryptoCount: paprikaGlobal.value.cryptocurrencies_number,
          }
        : null,
      fearGreed: fearGreed.status === "fulfilled" && fearGreed.value.data[0]
        ? {
            value: Number(fearGreed.value.data[0].value),
            classification: fearGreed.value.data[0].value_classification,
          }
        : null,
    },
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/aggregate/tickers ──────────────────────────────

aggregateRoutes.get("/tickers", async (c) => {
  const limit = Math.min(Number(c.req.query("limit") || 100), 250);
  const data = await alt.getCoinPaprikaTickers(limit);

  return c.json({
    data: data.map((t) => ({
      id: t.id,
      name: t.name,
      symbol: t.symbol,
      rank: t.rank,
      price: t.quotes.USD.price,
      volume24h: t.quotes.USD.volume_24h,
      marketCap: t.quotes.USD.market_cap,
      change24h: t.quotes.USD.percent_change_24h,
      change7d: t.quotes.USD.percent_change_7d,
    })),
    source: "coinpaprika",
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/aggregate/assets ───────────────────────────────

aggregateRoutes.get("/assets", async (c) => {
  const limit = Math.min(Number(c.req.query("limit") || 100), 250);
  const { data } = await alt.getCoinCapAssets(limit);

  return c.json({
    data: data.map((a) => ({
      id: a.id,
      rank: Number(a.rank),
      symbol: a.symbol,
      name: a.name,
      price: parseFloat(a.priceUsd),
      marketCap: parseFloat(a.marketCapUsd),
      volume24h: parseFloat(a.volumeUsd24Hr),
      change24h: parseFloat(a.changePercent24Hr),
      supply: parseFloat(a.supply),
      maxSupply: a.maxSupply ? parseFloat(a.maxSupply) : null,
    })),
    source: "coincap",
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/aggregate/history/:id ──────────────────────────

aggregateRoutes.get("/history/:id", async (c) => {
  const id = c.req.param("id");
  const interval = (c.req.query("interval") as any) || "h1";
  const { data } = await alt.getCoinCapHistory(id, interval);

  return c.json({
    data: data.map((d) => ({
      price: parseFloat(d.priceUsd),
      time: d.time,
      datetime: new Date(d.time).toISOString(),
    })),
    asset: id,
    interval,
    source: "coincap",
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/aggregate/top-movers ───────────────────────────

aggregateRoutes.get("/top-movers", async (c) => {
  const limit = Math.min(Number(c.req.query("limit") || 10), 25);
  const coins = await cg.getCoins({ page: 1, perPage: 250, order: "market_cap_desc", sparkline: false });

  const withChange = coins.filter((c) => c.price_change_percentage_24h != null);
  const sorted = [...withChange].sort(
    (a, b) => (b.price_change_percentage_24h || 0) - (a.price_change_percentage_24h || 0),
  );

  const mapCoin = (coin: typeof coins[0]) => ({
    id: coin.id,
    symbol: coin.symbol,
    name: coin.name,
    price: coin.current_price,
    change24h: coin.price_change_percentage_24h,
    marketCap: coin.market_cap,
    volume24h: coin.total_volume,
    image: coin.image,
  });

  return c.json({
    data: {
      gainers: sorted.slice(0, limit).map(mapCoin),
      losers: sorted.slice(-limit).reverse().map(mapCoin),
    },
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/aggregate/market-overview ──────────────────────

aggregateRoutes.get("/market-overview", async (c) => {
  const [globalData, fearGreed, trending, topCoins, chainTvls, defiProtocols] =
    await Promise.allSettled([
      cg.getGlobal(),
      alt.getFearGreedIndex(1),
      cg.getTrending(),
      cg.getCoins({ page: 1, perPage: 10, order: "market_cap_desc", sparkline: false }),
      llama.getChainsTVL(),
      llama.getProtocols(),
    ]);

  return c.json({
    data: {
      global:
        globalData.status === "fulfilled"
          ? {
              totalMarketCap: globalData.value.data.total_market_cap.usd,
              totalVolume24h: globalData.value.data.total_volume.usd,
              btcDominance: globalData.value.data.market_cap_percentage.btc,
              ethDominance: globalData.value.data.market_cap_percentage.eth,
              change24h: globalData.value.data.market_cap_change_percentage_24h_usd,
              activeCryptos: globalData.value.data.active_cryptocurrencies,
              markets: globalData.value.data.markets,
            }
          : null,
      fearGreed:
        fearGreed.status === "fulfilled" && fearGreed.value.data[0]
          ? {
              value: Number(fearGreed.value.data[0].value),
              classification: fearGreed.value.data[0].value_classification,
            }
          : null,
      trending:
        trending.status === "fulfilled"
          ? trending.value.coins.slice(0, 7).map((t) => ({
              id: t.item.id,
              name: t.item.name,
              symbol: t.item.symbol,
              rank: t.item.market_cap_rank,
            }))
          : [],
      topCoins:
        topCoins.status === "fulfilled"
          ? topCoins.value.map((c) => ({
              id: c.id,
              symbol: c.symbol,
              name: c.name,
              price: c.current_price,
              change24h: c.price_change_percentage_24h,
              marketCap: c.market_cap,
            }))
          : [],
      topChainsByTvl:
        chainTvls.status === "fulfilled"
          ? chainTvls.value
              .sort((a, b) => b.tvl - a.tvl)
              .slice(0, 10)
              .map((ch) => ({ name: ch.name, tvl: ch.tvl }))
          : [],
      totalDefiTvl:
        defiProtocols.status === "fulfilled"
          ? defiProtocols.value.reduce((sum, p) => sum + (p.tvl || 0), 0)
          : null,
    },
    timestamp: new Date().toISOString(),
  });
});
