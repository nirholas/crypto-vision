/**
 * Crypto Vision — Research & Metrics Routes
 *
 * Deep asset research via Messari (free tier) + CryptoCompare.
 *
 * GET /api/research/assets              — Asset rankings with metrics
 * GET /api/research/asset/:slug         — Deep asset profile & metrics
 * GET /api/research/asset/:slug/markets — Exchange/pair data for asset
 * GET /api/research/signals/:symbol     — Trading signals (IntoTheBlock)
 * GET /api/research/social/:coinId      — Social metrics (Twitter, Reddit, GitHub)
 * GET /api/research/compare             — Compare multiple assets (?slugs=bitcoin,ethereum)
 * GET /api/research/top-volume          — Top coins by 24h volume
 * GET /api/research/news                — CryptoCompare news feed
 */

import { Hono } from "hono";
import * as messari from "../sources/messari.js";
import * as cc from "../sources/cryptocompare.js";

export const researchRoutes = new Hono();

// ─── GET /api/research/assets ────────────────────────────────

researchRoutes.get("/assets", async (c) => {
  const limit = Math.min(Number(c.req.query("limit") || 50), 200);
  const page = Number(c.req.query("page") || 1);

  const { data } = await messari.getAssets(limit, page);

  return c.json({
    data: (data || []).map((a) => ({
      id: a.id,
      symbol: a.symbol,
      name: a.name,
      slug: a.slug,
      price: a.metrics?.market_data?.price_usd,
      volume24h: a.metrics?.market_data?.volume_last_24_hours,
      change24h: a.metrics?.market_data?.percent_change_usd_last_24_hours,
      marketCap: a.metrics?.marketcap?.current_marketcap_usd,
      rank: a.metrics?.marketcap?.rank,
      circulatingSupply: a.metrics?.supply?.circulating,
      roi7d: a.metrics?.roi_data?.percent_change_last_1_week,
      roi30d: a.metrics?.roi_data?.percent_change_last_1_month,
      roi3m: a.metrics?.roi_data?.percent_change_last_3_months,
      roi1y: a.metrics?.roi_data?.percent_change_last_1_year,
    })),
    page,
    limit,
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/research/asset/:slug ───────────────────────────

researchRoutes.get("/asset/:slug", async (c) => {
  const slug = c.req.param("slug");

  const [metrics, profile] = await Promise.all([
    messari.getAssetMetrics(slug).catch(() => null),
    messari.getAssetProfile(slug).catch(() => null),
  ]);

  if (!metrics?.data) {
    return c.json({ error: `Asset '${slug}' not found` }, 404);
  }

  const m = metrics.data;
  return c.json({
    data: {
      id: m.id,
      symbol: m.symbol,
      name: m.name,
      profile: profile?.data?.profile
        ? {
            tagline: profile.data.profile.general?.overview?.tagline,
            description: profile.data.profile.general?.overview?.project_details,
            tokenType: profile.data.profile.economics?.token?.token_type,
            links: profile.data.profile.general?.overview?.official_links,
          }
        : null,
      market: {
        price: m.market_data.price_usd,
        volume24h: m.market_data.volume_last_24_hours,
        change24h: m.market_data.percent_change_usd_last_24_hours,
        ohlcv24h: m.market_data.ohlcv_last_24_hour,
        marketCap: m.marketcap.current_marketcap_usd,
        rank: m.marketcap.rank,
      },
      supply: m.supply,
      allTimeHigh: m.all_time_high,
      roi: m.roi_data,
      risk: m.risk_metrics,
      onchain24h: m.blockchain_stats_24_hours,
      developerActivity: m.developer_activity,
    },
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/research/asset/:slug/markets ───────────────────

researchRoutes.get("/asset/:slug/markets", async (c) => {
  const slug = c.req.param("slug");
  const { data } = await messari.getAssetMarkets(slug);

  return c.json({
    data: (data || []).slice(0, 50).map((m) => ({
      exchange: m.exchange_name,
      pair: m.pair,
      price: m.price,
      volume24h: m.volume_last_24_hours,
      lastTradeAt: m.last_trade_at,
    })),
    asset: slug,
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/research/signals/:symbol ───────────────────────

researchRoutes.get("/signals/:symbol", async (c) => {
  const symbol = c.req.param("symbol").toUpperCase();
  const { Data } = await cc.getTradingSignals(symbol);

  return c.json({
    data: {
      symbol,
      inOutVar: Data.inOutVar,
      largeTransactions: Data.largetxsVar,
      addressNetGrowth: Data.addressesNetGrowth,
      concentration: Data.concentrationVar,
    },
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/research/social/:coinId ────────────────────────

researchRoutes.get("/social/:coinId", async (c) => {
  const coinId = Number(c.req.param("coinId"));
  if (!coinId) return c.json({ error: "coinId must be a number" }, 400);

  const { Data } = await cc.getSocialStats(coinId);

  return c.json({
    data: {
      name: Data.General.Name,
      points: Data.General.Points,
      twitter: Data.Twitter,
      reddit: Data.Reddit,
      codeRepositories: Data.CodeRepository?.List?.slice(0, 5).map((r) => ({
        stars: r.stars,
        forks: r.forks,
        lastPush: r.last_push
          ? new Date(r.last_push * 1000).toISOString()
          : null,
      })),
    },
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/research/compare ───────────────────────────────

researchRoutes.get("/compare", async (c) => {
  const slugs = c.req.query("slugs");
  if (!slugs) return c.json({ error: "slugs parameter required (comma-separated)" }, 400);

  const slugList = slugs.split(",").map((s) => s.trim()).slice(0, 10);

  const results = await Promise.allSettled(
    slugList.map((slug) => messari.getAssetMetrics(slug)),
  );

  const data = results
    .map((r, i) => {
      if (r.status !== "fulfilled" || !r.value?.data) return null;
      const m = r.value.data;
      return {
        slug: slugList[i],
        symbol: m.symbol,
        name: m.name,
        price: m.market_data.price_usd,
        marketCap: m.marketcap.current_marketcap_usd,
        rank: m.marketcap.rank,
        change24h: m.market_data.percent_change_usd_last_24_hours,
        volume24h: m.market_data.volume_last_24_hours,
        roi7d: m.roi_data.percent_change_last_1_week,
        roi30d: m.roi_data.percent_change_last_1_month,
        roi1y: m.roi_data.percent_change_last_1_year,
        volatility30d: m.risk_metrics.volatility_stats.volatility_last_30_days,
        sharpe30d: m.risk_metrics.sharpe_ratios.last_30_days,
        devCommits3m: m.developer_activity?.commits_last_3_months,
        activeAddresses24h: m.blockchain_stats_24_hours?.count_of_active_addresses,
      };
    })
    .filter(Boolean);

  return c.json({ data, timestamp: new Date().toISOString() });
});

// ─── GET /api/research/top-volume ────────────────────────────

researchRoutes.get("/top-volume", async (c) => {
  const limit = Math.min(Number(c.req.query("limit") || 50), 100);
  const { Data } = await cc.getTopByVolume("USD", limit);

  return c.json({
    data: (Data || []).map((item) => ({
      symbol: item.CoinInfo.Name,
      name: item.CoinInfo.FullName,
      price: item.RAW?.USD?.PRICE,
      volume24h: item.RAW?.USD?.VOLUME24HOUR,
      change24h: item.RAW?.USD?.CHANGEPCT24HOUR,
    })),
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/research/news ──────────────────────────────────

researchRoutes.get("/news", async (c) => {
  const categories = c.req.query("categories") || undefined;
  const { Data } = await cc.getNews(categories);

  return c.json({
    data: (Data || []).slice(0, 50).map((a) => ({
      id: a.id,
      title: a.title,
      url: a.url,
      body: a.body.slice(0, 300),
      source: a.source,
      publishedAt: new Date(a.published_on * 1000).toISOString(),
      categories: a.categories,
      tags: a.tags,
      imageUrl: a.imageurl,
    })),
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/research/exchanges/:symbol ─────────────────────

researchRoutes.get("/exchanges/:symbol", async (c) => {
  const symbol = c.req.param("symbol").toUpperCase();
  const limit = Math.min(Number(c.req.query("limit") || 20), 50);
  const { Data } = await cc.getTopExchanges(symbol, "USD", limit);

  return c.json({
    data: (Data?.Exchanges || []).map((ex) => ({
      exchange: ex.exchange,
      fromSymbol: ex.fromSymbol,
      toSymbol: ex.toSymbol,
      volume24h: ex.volume24h,
      volume24hTo: ex.volume24hTo,
    })),
    symbol,
    timestamp: new Date().toISOString(),
  });
});
