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
import { processPrice } from "../lib/anomaly-processors.js";
import { ApiError } from "../lib/api-error.js";
import { tryMultipleSources } from "../lib/fallback.js";
import { MarketAthDistanceQuerySchema, MarketChartQuerySchema, MarketCoincapAssetsQuerySchema, MarketCoincapHistoryQuerySchema, MarketCoinloreTickersQuerySchema, MarketCoinsQuerySchema, MarketCompareQuerySchema, MarketFearGreedQuerySchema, MarketGainersLosersQuerySchema, MarketHighVolumeQuerySchema, MarketMarketsQuerySchema, MarketOhlcQuerySchema, MarketPaprikaTickersQuerySchema, MarketPriceQuerySchema, MarketRatesQuerySchema, MarketSearchQuerySchema } from "../lib/route-schemas.js";
import { ChainSlugSchema, CoinIdSchema, HexAddressSchema, NumericIdSchema, validateParam, validateQueries } from "../lib/validation.js";
import * as alt from "../sources/alternative.js";
import * as cg from "../sources/coingecko.js";
import * as coinlore from "../sources/coinlore.js";

export const marketRoutes = new Hono();

// ─── Normalised coin shape for multi-source fallback ─────────

interface NormalisedCoin {
  id: string;
  symbol: string;
  name: string;
  image: string | null;
  price: number;
  marketCap: number;
  rank: number | null;
  volume24h: number;
  change24h: number | null;
  change7d: number | null;
  change30d: number | null;
  circulatingSupply: number | null;
  totalSupply: number | null;
  maxSupply: number | null;
  ath: number | null;
  athChange: number | null;
  sparkline7d?: number[];
}

// ─── GET /api/coins ──────────────────────────────────────────

marketRoutes.get("/coins", async (c) => {
  const q = validateQueries(c, MarketCoinsQuerySchema);
  if (!q.success) return q.error;
  const { page, per_page: perPage, order, ids, category } = q.data;
  const sparkline = q.data.sparkline === "true";

  const result = await tryMultipleSources<NormalisedCoin[]>(
    `coins:p${page}:pp${perPage}`,
    [
      {
        name: "coingecko",
        host: "api.coingecko.com",
        fn: async () => {
          const coins = await cg.getCoins({ page, perPage, order, sparkline, ids, category });
          return coins.map((coin) => ({
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
          }));
        },
      },
      {
        name: "coincap",
        host: "api.coincap.io",
        fn: async () => {
          const { data } = await alt.getCoinCapAssets(perPage);
          return data.map((a) => ({
            id: a.id,
            symbol: a.symbol,
            name: a.name,
            image: null,
            price: parseFloat(a.priceUsd),
            marketCap: parseFloat(a.marketCapUsd),
            rank: Number(a.rank),
            volume24h: parseFloat(a.volumeUsd24Hr),
            change24h: parseFloat(a.changePercent24Hr),
            change7d: null,
            change30d: null,
            circulatingSupply: parseFloat(a.supply),
            totalSupply: null,
            maxSupply: a.maxSupply ? parseFloat(a.maxSupply) : null,
            ath: null,
            athChange: null,
          }));
        },
      },
      {
        name: "coinlore",
        host: "api.coinlore.net",
        fn: async () => {
          const resp = await coinlore.getTickers((page - 1) * perPage, perPage);
          return resp.data.map((t) => ({
            id: t.nameid,
            symbol: t.symbol,
            name: t.name,
            image: null,
            price: parseFloat(t.price_usd),
            marketCap: parseFloat(t.market_cap_usd),
            rank: t.rank,
            volume24h: t.volume24,
            change24h: parseFloat(t.percent_change_24h),
            change7d: parseFloat(t.percent_change_7d),
            change30d: null,
            circulatingSupply: parseFloat(t.csupply),
            totalSupply: parseFloat(t.tsupply) || null,
            maxSupply: parseFloat(t.msupply) || null,
            ath: null,
            athChange: null,
          }));
        },
      },
    ],
  );

  // Feed anomaly detection engine with fresh market data
  for (const coin of result.data) {
    processPrice(coin.id, coin.price, coin.volume24h);
  }

  return c.json({
    data: result.data,
    source: result.source,
    stale: result.stale,
    failedSources: result.failedSources,
    skippedSources: result.skippedSources,
    page,
    perPage,
    timestamp: result.timestamp,
  });
});

// ─── GET /api/coin/:id ──────────────────────────────────────

marketRoutes.get("/coin/:id", async (c) => {
  const pv = validateParam(c, "id", CoinIdSchema);
  if (!pv.success) return pv.error;
  const detail = await cg.getCoinDetail(pv.data);

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
  const q = validateQueries(c, MarketPriceQuerySchema);
  if (!q.success) return q.error;
  const ids = q.data.ids;
  const vs = q.data.vs_currencies;
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

// ─── Normalised global stats for multi-source fallback ───────

interface NormalisedGlobal {
  activeCryptocurrencies: number | null;
  markets: number | null;
  totalMarketCap: number;
  totalVolume24h: number;
  btcDominance: number;
  ethDominance: number | null;
  marketCapChange24h: number | null;
}

// ─── GET /api/global ─────────────────────────────────────────

marketRoutes.get("/global", async (c) => {
  const result = await tryMultipleSources<NormalisedGlobal>("global", [
    {
      name: "coingecko",
      host: "api.coingecko.com",
      fn: async () => {
        const { data } = await cg.getGlobal();
        return {
          activeCryptocurrencies: data.active_cryptocurrencies,
          markets: data.markets,
          totalMarketCap: data.total_market_cap.usd,
          totalVolume24h: data.total_volume.usd,
          btcDominance: data.market_cap_percentage.btc,
          ethDominance: data.market_cap_percentage.eth,
          marketCapChange24h: data.market_cap_change_percentage_24h_usd,
        };
      },
    },
    {
      name: "coinpaprika",
      host: "api.coinpaprika.com",
      fn: async () => {
        const g = await alt.getCoinPaprikaGlobal();
        return {
          activeCryptocurrencies: g.cryptocurrencies_number,
          markets: null,
          totalMarketCap: g.market_cap_usd,
          totalVolume24h: g.volume_24h_usd,
          btcDominance: g.bitcoin_dominance_percentage,
          ethDominance: null,
          marketCapChange24h: g.market_cap_change_24h,
        };
      },
    },
    {
      name: "coinlore",
      host: "api.coinlore.net",
      fn: async () => {
        const arr = await coinlore.getGlobal();
        const g = arr[0];
        return {
          activeCryptocurrencies: g.coins_count,
          markets: g.active_markets,
          totalMarketCap: g.total_mcap,
          totalVolume24h: g.total_volume,
          btcDominance: parseFloat(g.btc_d),
          ethDominance: parseFloat(g.eth_d),
          marketCapChange24h: parseFloat(g.mcap_change),
        };
      },
    },
  ]);

  return c.json({
    data: result.data,
    source: result.source,
    stale: result.stale,
    failedSources: result.failedSources,
    skippedSources: result.skippedSources,
    timestamp: result.timestamp,
  });
});

// ─── GET /api/search ─────────────────────────────────────────

marketRoutes.get("/search", async (c) => {
  const qv = validateQueries(c, MarketSearchQuerySchema);
  if (!qv.success) return qv.error;
  const query = qv.data.q;

  const results = await cg.searchCoins(query);

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
  const pv = validateParam(c, "id", CoinIdSchema);
  if (!pv.success) return pv.error;
  const q = validateQueries(c, MarketChartQuerySchema);
  if (!q.success) return q.error;
  const days = String(q.data.days);
  const interval = q.data.interval;
  const data = await cg.getMarketChart(pv.data, days, interval || undefined);

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
  const pv = validateParam(c, "id", CoinIdSchema);
  if (!pv.success) return pv.error;
  const q = validateQueries(c, MarketOhlcQuerySchema);
  if (!q.success) return q.error;
  const days = q.data.days;
  const data = await cg.getOHLC(pv.data, days);

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

// ─── GET /api/categories ─────────────────────────────────────
// Note: Exchange endpoints live in routes/exchanges.ts (mounted at /api/exchanges)

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

// ─── Normalised fear & greed for multi-source fallback ───────

interface NormalisedFearGreed {
  value: number;
  classification: string;
  timestamp: string;
}

function classifyFearGreed(value: number): string {
  if (value <= 20) return "Extreme Fear";
  if (value <= 40) return "Fear";
  if (value <= 60) return "Neutral";
  if (value <= 80) return "Greed";
  return "Extreme Greed";
}

// ─── GET /api/fear-greed ─────────────────────────────────────

marketRoutes.get("/fear-greed", async (c) => {
  const q = validateQueries(c, MarketFearGreedQuerySchema);
  if (!q.success) return q.error;
  const limit = q.data.limit;

  const result = await tryMultipleSources<NormalisedFearGreed[]>("fear-greed", [
    {
      name: "alternative.me",
      host: "api.alternative.me",
      fn: async () => {
        const { data } = await alt.getFearGreedIndex(limit);
        return data.map((d) => ({
          value: Number(d.value),
          classification: d.value_classification,
          timestamp: new Date(Number(d.timestamp) * 1000).toISOString(),
        }));
      },
    },
    {
      name: "calculated-sentiment",
      host: "api.coingecko.com",
      fn: async () => {
        // Derive a synthetic fear/greed score from market data
        const { data } = await cg.getGlobal();
        const change = data.market_cap_change_percentage_24h_usd;
        // Map 24h market cap change to 0-100 fear/greed scale
        // -10% or worse → 0, +10% or better → 100
        const clamped = Math.max(-10, Math.min(10, change));
        const value = Math.round(((clamped + 10) / 20) * 100);
        return [{
          value,
          classification: classifyFearGreed(value),
          timestamp: new Date().toISOString(),
        }];
      },
    },
  ]);

  return c.json({
    data: result.data,
    source: result.source,
    stale: result.stale,
    failedSources: result.failedSources,
    skippedSources: result.skippedSources,
    timestamp: result.timestamp,
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

// Note: DEX search/token endpoints live in routes/dex.ts (mounted at /api/dex)

// ─── GET /api/gainers ────────────────────────────────────────

marketRoutes.get("/gainers", async (c) => {
  const q = validateQueries(c, MarketGainersLosersQuerySchema);
  if (!q.success) return q.error;
  const limit = q.data.limit;
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
  const q = validateQueries(c, MarketGainersLosersQuerySchema);
  if (!q.success) return q.error;
  const limit = q.data.limit;
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
  const q = validateQueries(c, MarketHighVolumeQuerySchema);
  if (!q.success) return q.error;
  const limit = q.data.limit;
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
  const q = validateQueries(c, MarketAthDistanceQuerySchema);
  if (!q.success) return q.error;
  const limit = q.data.limit;
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
  const q = validateQueries(c, MarketCompareQuerySchema);
  if (!q.success) return q.error;
  const ids = q.data.ids;

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
  const q = validateQueries(c, MarketPaprikaTickersQuerySchema);
  if (!q.success) return q.error;
  const limit = q.data.limit;
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
  const q = validateQueries(c, MarketCoincapAssetsQuerySchema);
  if (!q.success) return q.error;
  const limit = q.data.limit;
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
  const pv = validateParam(c, "id", CoinIdSchema);
  if (!pv.success) return pv.error;
  const q = validateQueries(c, MarketCoincapHistoryQuerySchema);
  if (!q.success) return q.error;
  const id = pv.data;
  const interval = q.data.interval;
  const start = q.data.start;
  const end = q.data.end;

  const { data } = await alt.getCoinCapHistory(id, interval as Parameters<typeof alt.getCoinCapHistory>[1], start, end);

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
  const q = validateQueries(c, MarketCoinloreTickersQuerySchema);
  if (!q.success) return q.error;
  const start = q.data.start;
  const limit = q.data.limit;
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
  const pv = validateParam(c, "id", NumericIdSchema);
  if (!pv.success) return pv.error;
  const data = await coinlore.getCoinDetail(pv.data);
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
  const pv = validateParam(c, "id", NumericIdSchema);
  if (!pv.success) return pv.error;
  const data = await coinlore.getCoinMarkets(pv.data);

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
  const pv = validateParam(c, "id", NumericIdSchema);
  if (!pv.success) return pv.error;
  const data = await coinlore.getCoinSocialStats(pv.data);

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
  const q = validateQueries(c, MarketRatesQuerySchema);
  if (!q.success) return q.error;
  const type = q.data.type;
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
  const q = validateQueries(c, MarketMarketsQuerySchema);
  if (!q.success) return q.error;
  const limit = q.data.limit;
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

// ─── GET /api/paprika/coin/:id ───────────────────────────────
// CoinPaprika coin profile (team, links, whitepaper, tags)

marketRoutes.get("/paprika/coin/:id", async (c) => {
  const id = c.req.param("id");
  const data = await alt.getCoinPaprikaDetail(id);

  return c.json({
    data: {
      id: data.id,
      name: data.name,
      symbol: data.symbol,
      rank: data.rank,
      type: data.type,
      description: data.description,
      openSource: data.open_source,
      startedAt: data.started_at,
      tags: data.tags.map((t: { id: string; name: string }) => ({ id: t.id, name: t.name })),
      team: data.team.map((m: { id: string; name: string; position: string }) => ({
        id: m.id,
        name: m.name,
        position: m.position,
      })),
      links: data.links,
      whitepaper: data.whitepaper,
      isActive: data.is_active,
    },
    source: "coinpaprika",
    timestamp: new Date().toISOString(),
  });
});

// Note: CoinCap exchange endpoints live in routes/exchanges.ts

// ─── GET /api/paprika/coin/:id/ohlcv ────────────────────────
// CoinPaprika 30-day OHLCV candles

marketRoutes.get("/paprika/coin/:id/ohlcv", async (c) => {
  const id = c.req.param("id");
  const data = await alt.getCoinPaprikaOHLCV(id);

  return c.json({
    data: (data || []).map((d: { time_open: string; time_close: string; open: number; high: number; low: number; close: number; volume: number; market_cap: number }) => ({
      timeOpen: d.time_open,
      timeClose: d.time_close,
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
      volume: d.volume,
      marketCap: d.market_cap,
    })),
    coinId: id,
    source: "coinpaprika",
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/paprika/exchanges ──────────────────────────────
// CoinPaprika exchange rankings

marketRoutes.get("/paprika/exchanges", async (c) => {
  const data = await alt.getCoinPaprikaExchanges();

  return c.json({
    data: (data || []).filter((e: { active: boolean }) => e.active).map((e: { id: string; name: string; quotes?: { USD?: { reported_volume_24h?: number; adjusted_volume_24h?: number } }; last_updated: string }) => ({
      id: e.id,
      name: e.name,
      reportedVolume24h: e.quotes?.USD?.reported_volume_24h,
      adjustedVolume24h: e.quotes?.USD?.adjusted_volume_24h,
      lastUpdated: e.last_updated,
    })),
    source: "coinpaprika",
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/paprika/coin/:id/events ────────────────────────
// CoinPaprika coin events (conferences, forks, etc.)

marketRoutes.get("/paprika/coin/:id/events", async (c) => {
  const id = c.req.param("id");
  const data = await alt.getCoinPaprikaEvents(id);

  return c.json({
    data: (data || []).map((ev: { id: string; date: string; name: string; description: string; is_conference: boolean; link: string }) => ({
      id: ev.id,
      date: ev.date,
      name: ev.name,
      description: ev.description,
      isConference: ev.is_conference,
      link: ev.link,
    })),
    coinId: id,
    source: "coinpaprika",
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/dex/pairs/:chain ───────────────────────────────
// DexScreener pairs on a given chain

marketRoutes.get("/dex/pairs/:chain", async (c) => {
  const pv = validateParam(c, "chain", ChainSlugSchema);
  if (!pv.success) return pv.error;
  const chain = pv.data;
  const data = await alt.dexPairsByChain(chain);

  return c.json({
    data: (data.pairs || []).slice(0, 50).map((p) => ({
      pairAddress: p.pairAddress,
      baseToken: p.baseToken,
      quoteToken: p.quoteToken,
      priceUsd: p.priceUsd,
      volume24h: p.volume?.h24,
      liquidity: p.liquidity?.usd,
      fdv: p.fdv,
      txns24h: p.txns?.h24,
    })),
    chain,
    source: "dexscreener",
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/dex/pair/:chain/:address ───────────────────────
// DexScreener single pair detail

marketRoutes.get("/dex/pair/:chain/:address", async (c) => {
  const pv1 = validateParam(c, "chain", ChainSlugSchema);
  if (!pv1.success) return pv1.error;
  const pv2 = validateParam(c, "address", HexAddressSchema);
  if (!pv2.success) return pv2.error;
  const chain = pv1.data;
  const address = pv2.data;
  const data = await alt.dexPairDetail(chain, address);

  return c.json({
    data: data.pair ? {
      pairAddress: data.pair.pairAddress,
      baseToken: data.pair.baseToken,
      quoteToken: data.pair.quoteToken,
      priceUsd: data.pair.priceUsd,
      priceNative: data.pair.priceNative,
      volume: data.pair.volume,
      txns: data.pair.txns,
      liquidity: data.pair.liquidity,
      fdv: data.pair.fdv,
      pairCreatedAt: data.pair.pairCreatedAt,
    } : null,
    chain,
    address,
    source: "dexscreener",
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/btc-exchange-rates ─────────────────────────────
// BTC exchange rates in 40+ currencies (blockchain.info)

marketRoutes.get("/btc-exchange-rates", async (c) => {
  const data = await alt.getBtcExchangeRates();

  return c.json({
    data: Object.entries(data).map(([currency, rate]) => {
      const r = rate as { symbol: string; last: number; buy: number; sell: number };
      return {
        currency,
        symbol: r.symbol,
        last: r.last,
        buy: r.buy,
        sell: r.sell,
      };
    }),
    source: "blockchain.info",
    timestamp: new Date().toISOString(),
  });
});