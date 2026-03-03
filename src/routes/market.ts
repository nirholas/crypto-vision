/**
 * Crypto Vision — Market Data Routes
 *
 * GET /api/coins              — Top coins by market cap
 * GET /api/coin/:id           — Coin detail
 * GET /api/price              — Simple price lookup
 * GET /api/trending           — Trending coins
 * GET /api/global             — Global market stats
 * GET /api/search             — Search coins
 * GET /api/chart/:id          — Price chart data
 * GET /api/ohlc/:id           — OHLC candles
 * GET /api/exchanges          — Exchange rankings
 * GET /api/categories         — Market categories
 * GET /api/fear-greed         — Fear & Greed Index
 * GET /api/dex/search         — DEX pair search
 * GET /api/dex/token/:address — DEX pairs by token address
 * GET /api/gainers            — Top 24h gainers
 * GET /api/losers             — Top 24h losers
 * GET /api/high-volume        — Highest volume coins
 * GET /api/ath-distance       — Coins ranked by distance from ATH
 * GET /api/compare            — Compare multiple coins side-by-side
 * GET /api/dominance          — Dominance chart (BTC, ETH, etc.)
 * GET /api/paprika/global     — CoinPaprika global market data
 * GET /api/paprika/tickers    — CoinPaprika tickers
 * GET /api/coincap/assets     — CoinCap asset rankings
 * GET /api/coincap/history/:id — CoinCap price history
 * GET /api/market-overview    — Combined multi-source market overview
 */

import { Hono } from "hono";
import * as cg from "../sources/coingecko.js";
import * as alt from "../sources/alternative.js";
import * as coinlore from "../sources/coinlore.js";
import { ApiError } from "../lib/api-error.js";

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
  if (!ids) return ApiError.missingParam(c, "ids");

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
  if (!q) return ApiError.missingParam(c, "q");

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
  if (!q) return ApiError.missingParam(c, "q");

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

// ─── GET /api/dex/token/:address ─────────────────────────────

marketRoutes.get("/dex/token/:address", async (c) => {
  const { pairs } = await alt.dexTokenPairs(c.req.param("address"));

  if (!pairs || pairs.length === 0) {
    return c.json({ error: "No pairs found for this token", data: [] }, 404);
  }

  return c.json({
    data: pairs.slice(0, 50).map((p) => ({
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

// ─── GET /api/gainers ────────────────────────────────────────

marketRoutes.get("/gainers", async (c) => {
  const limit = Math.min(Number(c.req.query("limit") || 20), 100);
  const coins = await cg.getCoins({ page: 1, perPage: 250, order: "market_cap_desc", sparkline: false });

  const gainers = coins
    .filter((coin) => coin.price_change_percentage_24h != null && coin.price_change_percentage_24h > 0)
    .sort((a, b) => (b.price_change_percentage_24h || 0) - (a.price_change_percentage_24h || 0))
    .slice(0, limit);

  return c.json({
    data: gainers.map((coin) => ({
      id: coin.id,
      symbol: coin.symbol,
      name: coin.name,
      image: coin.image,
      price: coin.current_price,
      change24h: coin.price_change_percentage_24h,
      marketCap: coin.market_cap,
      volume24h: coin.total_volume,
      rank: coin.market_cap_rank,
    })),
    count: gainers.length,
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/losers ─────────────────────────────────────────

marketRoutes.get("/losers", async (c) => {
  const limit = Math.min(Number(c.req.query("limit") || 20), 100);
  const coins = await cg.getCoins({ page: 1, perPage: 250, order: "market_cap_desc", sparkline: false });

  const losers = coins
    .filter((coin) => coin.price_change_percentage_24h != null && coin.price_change_percentage_24h < 0)
    .sort((a, b) => (a.price_change_percentage_24h || 0) - (b.price_change_percentage_24h || 0))
    .slice(0, limit);

  return c.json({
    data: losers.map((coin) => ({
      id: coin.id,
      symbol: coin.symbol,
      name: coin.name,
      image: coin.image,
      price: coin.current_price,
      change24h: coin.price_change_percentage_24h,
      marketCap: coin.market_cap,
      volume24h: coin.total_volume,
      rank: coin.market_cap_rank,
    })),
    count: losers.length,
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/high-volume ────────────────────────────────────

marketRoutes.get("/high-volume", async (c) => {
  const limit = Math.min(Number(c.req.query("limit") || 20), 100);
  const coins = await cg.getCoins({ page: 1, perPage: 250, order: "market_cap_desc", sparkline: false });

  const sorted = [...coins].sort((a, b) => (b.total_volume || 0) - (a.total_volume || 0)).slice(0, limit);

  return c.json({
    data: sorted.map((coin) => ({
      id: coin.id,
      symbol: coin.symbol,
      name: coin.name,
      price: coin.current_price,
      volume24h: coin.total_volume,
      marketCap: coin.market_cap,
      volumeToMcap: coin.market_cap ? (coin.total_volume / coin.market_cap) : null,
      change24h: coin.price_change_percentage_24h,
    })),
    count: sorted.length,
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/ath-distance ───────────────────────────────────

marketRoutes.get("/ath-distance", async (c) => {
  const limit = Math.min(Number(c.req.query("limit") || 50), 250);
  const coins = await cg.getCoins({ page: 1, perPage: limit, order: "market_cap_desc", sparkline: false });

  const sorted = [...coins]
    .filter((coin) => coin.ath_change_percentage != null)
    .sort((a, b) => (b.ath_change_percentage || 0) - (a.ath_change_percentage || 0));

  return c.json({
    data: sorted.map((coin) => ({
      id: coin.id,
      symbol: coin.symbol,
      name: coin.name,
      price: coin.current_price,
      ath: coin.ath,
      athChange: coin.ath_change_percentage,
      rank: coin.market_cap_rank,
    })),
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/compare ────────────────────────────────────────

marketRoutes.get("/compare", async (c) => {
  const ids = c.req.query("ids");
  if (!ids) return c.json({ error: "ids parameter required (comma-separated coin ids)" }, 400);

  const coinIds = ids.split(",").slice(0, 10);
  const details = await Promise.all(
    coinIds.map((id) => cg.getCoinDetail(id.trim()).catch(() => null))
  );

  return c.json({
    data: details
      .filter(Boolean)
      .map((d) => {
        const md = d!.market_data;
        return {
          id: d!.id,
          symbol: d!.symbol,
          name: d!.name,
          categories: d!.categories,
          marketData: {
            price: md.current_price.usd,
            marketCap: md.market_cap.usd,
            volume24h: md.total_volume.usd,
            change24h: md.price_change_percentage_24h,
            change7d: md.price_change_percentage_7d,
            change30d: md.price_change_percentage_30d,
            circulatingSupply: md.circulating_supply,
            totalSupply: md.total_supply,
            maxSupply: md.max_supply,
          },
        };
      }),
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/dominance ──────────────────────────────────────

marketRoutes.get("/dominance", async (c) => {
  const { data } = await cg.getGlobal();
  const totalCap = data.total_market_cap.usd;

  return c.json({
    data: Object.entries(data.market_cap_percentage)
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .map(([symbol, pct]) => ({
        symbol: symbol.toUpperCase(),
        dominance: pct,
        marketCap: totalCap * ((pct as number) / 100),
      })),
    totalMarketCap: totalCap,
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/paprika/global ─────────────────────────────────

marketRoutes.get("/paprika/global", async (c) => {
  const data = await alt.getCoinPaprikaGlobal();

  return c.json({
    data: {
      marketCapUsd: data.market_cap_usd,
      volume24hUsd: data.volume_24h_usd,
      btcDominance: data.bitcoin_dominance_percentage,
      totalCryptocurrencies: data.cryptocurrencies_number,
      marketCapChange24h: data.market_cap_change_24h,
    },
    source: "coinpaprika",
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/paprika/tickers ────────────────────────────────

marketRoutes.get("/paprika/tickers", async (c) => {
  const limit = Math.min(Number(c.req.query("limit") || 100), 250);
  const tickers = await alt.getCoinPaprikaTickers(limit);

  return c.json({
    data: tickers.map((t) => ({
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
    count: tickers.length,
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/coincap/assets ─────────────────────────────────

marketRoutes.get("/coincap/assets", async (c) => {
  const limit = Math.min(Number(c.req.query("limit") || 100), 250);
  const { data } = await alt.getCoinCapAssets(limit);

  return c.json({
    data: data.map((a) => ({
      id: a.id,
      rank: Number(a.rank),
      symbol: a.symbol,
      name: a.name,
      price: Number(a.priceUsd),
      marketCap: Number(a.marketCapUsd),
      volume24h: Number(a.volumeUsd24Hr),
      change24h: Number(a.changePercent24Hr),
      supply: Number(a.supply),
      maxSupply: a.maxSupply ? Number(a.maxSupply) : null,
    })),
    source: "coincap",
    count: data.length,
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/coincap/history/:id ────────────────────────────

marketRoutes.get("/coincap/history/:id", async (c) => {
  const id = c.req.param("id");
  const interval = (c.req.query("interval") as any) || "h1";
  const start = c.req.query("start") ? Number(c.req.query("start")) : undefined;
  const end = c.req.query("end") ? Number(c.req.query("end")) : undefined;

  const { data } = await alt.getCoinCapHistory(id, interval, start, end);

  return c.json({
    data: data.map((d) => ({
      price: Number(d.priceUsd),
      time: d.time,
      date: new Date(d.time).toISOString(),
    })),
    source: "coincap",
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/market-overview ────────────────────────────────

marketRoutes.get("/market-overview", async (c) => {
  const [cgGlobal, paprikaGlobal, fearGreed, trending, topCoins] = await Promise.all([
    cg.getGlobal().catch(() => null),
    alt.getCoinPaprikaGlobal().catch(() => null),
    alt.getFearGreedIndex(1).catch(() => ({ data: [] })),
    cg.getTrending().catch(() => ({ coins: [] })),
    cg.getCoins({ page: 1, perPage: 10, order: "market_cap_desc", sparkline: false }).catch(() => []),
  ]);

  const fg = fearGreed.data[0];

  return c.json({
    data: {
      global: cgGlobal
        ? {
            totalMarketCap: cgGlobal.data.total_market_cap.usd,
            totalVolume24h: cgGlobal.data.total_volume.usd,
            btcDominance: cgGlobal.data.market_cap_percentage.btc,
            ethDominance: cgGlobal.data.market_cap_percentage.eth,
            marketCapChange24h: cgGlobal.data.market_cap_change_percentage_24h_usd,
            activeCryptocurrencies: cgGlobal.data.active_cryptocurrencies,
          }
        : null,
      fearGreed: fg
        ? { value: Number(fg.value), classification: fg.value_classification }
        : null,
      trending: trending.coins.slice(0, 5).map((t) => ({
        id: t.item.id,
        name: t.item.name,
        symbol: t.item.symbol,
      })),
      topCoins: topCoins.slice(0, 10).map((coin) => ({
        id: coin.id,
        symbol: coin.symbol,
        name: coin.name,
        price: coin.current_price,
        change24h: coin.price_change_percentage_24h,
        marketCap: coin.market_cap,
      })),
      crossSourceValidation: paprikaGlobal
        ? {
            coinpaprikaMarketCap: paprikaGlobal.market_cap_usd,
            coinpaprikaVolume: paprikaGlobal.volume_24h_usd,
            coinpaprikaBtcDom: paprikaGlobal.bitcoin_dominance_percentage,
          }
        : null,
    },
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/coinlore/global ────────────────────────────────

marketRoutes.get("/coinlore/global", async (c) => {
  const data = await coinlore.getGlobal();
  const g = data[0];

  return c.json({
    data: {
      coinsCount: g.coins_count,
      activeMarkets: g.active_markets,
      totalMarketCap: g.total_mcap,
      totalVolume: g.total_volume,
      btcDominance: Number(g.btc_d),
      ethDominance: Number(g.eth_d),
      marketCapChange: Number(g.mcap_change),
      volumeChange: Number(g.volume_change),
      avgChangePercent: Number(g.avg_change_percent),
    },
    source: "coinlore",
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/coinlore/tickers ───────────────────────────────

marketRoutes.get("/coinlore/tickers", async (c) => {
  const start = Number(c.req.query("start") || 0);
  const limit = Math.min(Number(c.req.query("limit") || 100), 100);
  const { data: tickers } = await coinlore.getTickers(start, limit);

  return c.json({
    data: tickers.map((t) => ({
      id: t.id,
      symbol: t.symbol,
      name: t.name,
      rank: t.rank,
      price: Number(t.price_usd),
      change1h: Number(t.percent_change_1h),
      change24h: Number(t.percent_change_24h),
      change7d: Number(t.percent_change_7d),
      marketCap: Number(t.market_cap_usd),
      volume24h: t.volume24,
    })),
    source: "coinlore",
    count: tickers.length,
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/coinlore/coin/:id ──────────────────────────────

marketRoutes.get("/coinlore/coin/:id", async (c) => {
  const data = await coinlore.getCoinDetail(c.req.param("id"));
  if (!data || data.length === 0) {
    return c.json({ error: "Coin not found" }, 404);
  }
  const t = data[0];

  return c.json({
    data: {
      id: t.id,
      symbol: t.symbol,
      name: t.name,
      rank: t.rank,
      price: Number(t.price_usd),
      change1h: Number(t.percent_change_1h),
      change24h: Number(t.percent_change_24h),
      change7d: Number(t.percent_change_7d),
      marketCap: Number(t.market_cap_usd),
      volume24h: t.volume24,
      circulatingSupply: Number(t.csupply),
      totalSupply: Number(t.tsupply),
      maxSupply: t.msupply ? Number(t.msupply) : null,
    },
    source: "coinlore",
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/coinlore/exchanges ─────────────────────────────

marketRoutes.get("/coinlore/exchanges", async (c) => {
  const data = await coinlore.getExchanges();

  return c.json({
    data: (data || [])
      .sort((a, b) => (b.volume_usd || 0) - (a.volume_usd || 0))
      .slice(0, 100)
      .map((ex) => ({
        id: ex.id,
        name: ex.name,
        volumeUsd: ex.volume_usd,
        activePairs: ex.active_pairs,
        country: ex.country,
        url: ex.url,
      })),
    source: "coinlore",
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/coinlore/coin/:id/markets ──────────────────────

marketRoutes.get("/coinlore/coin/:id/markets", async (c) => {
  const data = await coinlore.getCoinMarkets(c.req.param("id"));

  return c.json({
    data: (data || []).map((m) => ({
      exchange: m.name,
      pair: `${m.base}/${m.quote}`,
      price: m.price_usd,
      volume: m.volume_usd,
    })),
    source: "coinlore",
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/coinlore/coin/:id/social ───────────────────────

marketRoutes.get("/coinlore/coin/:id/social", async (c) => {
  const data = await coinlore.getCoinSocialStats(c.req.param("id"));

  return c.json({
    data: {
      reddit: data.reddit,
      twitter: data.twitter,
    },
    source: "coinlore",
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/rates ──────────────────────────────────────────

marketRoutes.get("/rates", async (c) => {
  const type = c.req.query("type"); // "fiat" or "crypto"
  const { data } = await alt.getCoinCapRates();

  let rates = data || [];
  if (type) {
    rates = rates.filter((r) => r.type === type);
  }

  return c.json({
    data: rates.map((r) => ({
      id: r.id,
      symbol: r.symbol,
      rateUsd: Number(r.rateUsd),
      type: r.type,
    })),
    source: "coincap",
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/exchanges/coincap ──────────────────────────────

marketRoutes.get("/exchanges/coincap", async (c) => {
  const { data } = await alt.getCoinCapExchanges();

  return c.json({
    data: (data || []).map((ex) => ({
      id: ex.exchangeId,
      name: ex.name,
      rank: Number(ex.rank),
      volumeUsd: Number(ex.volumeUsd),
      tradingPairs: Number(ex.tradingPairs),
      percentTotalVolume: Number(ex.percentTotalVolume),
      url: ex.exchangeUrl,
    })),
    source: "coincap",
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/markets ────────────────────────────────────────
// CoinCap exchange markets (individual trading pairs)

marketRoutes.get("/markets", async (c) => {
  const limit = Math.min(Number(c.req.query("limit") || 50), 200);
  const { data } = await alt.getCoinCapMarkets(limit);

  return c.json({
    data: (data || []).map((m) => ({
      exchange: m.exchangeId,
      pair: `${m.baseSymbol}/${m.quoteSymbol}`,
      priceUsd: Number(m.priceUsd),
      volumeUsd24h: Number(m.volumeUsd24Hr),
      percentVolume: Number(m.percentExchangeVolume),
    })),
    source: "coincap",
    count: data?.length || 0,
    timestamp: new Date().toISOString(),
  });
});

