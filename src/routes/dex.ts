/**
 * Crypto Vision — DEX / Pool Routes
 *
 * On-chain DEX analytics via GeckoTerminal (free, no key).
 *
 * GET /api/dex/trending-pools      — Trending DEX pools across all chains
 * GET /api/dex/trending-pools/:net — Trending pools on a specific network
 * GET /api/dex/new-pools           — Newly created pools
 * GET /api/dex/new-pools/:net      — New pools on a specific network
 * GET /api/dex/top-pools/:net      — Top pools by volume on a network
 * GET /api/dex/pool/:net/:addr     — Pool OHLCV candle data
 * GET /api/dex/token/:net/:addr    — Token info + pools
 * GET /api/dex/networks            — Supported DEX networks
 * GET /api/dex/pool-search         — Search pools
 */

import { Hono } from "hono";
import * as gt from "../sources/geckoterminal.js";
import {
  ChainSlugSchema,
  HexAddressSchema,
  TimeframeSchema,
  SearchQuerySchema,
  LimitSchema,
  validateParam,
  validateQuery,
} from "../lib/validation.js";

export const dexRoutes = new Hono();

// ─── GET /api/dex/networks ───────────────────────────────────

dexRoutes.get("/networks", async (c) => {
  const { data } = await gt.getNetworks();

  return c.json({
    data: data.map((n) => ({
      id: n.id,
      name: n.attributes.name,
      coingeckoId: n.attributes.coingecko_asset_platform_id,
    })),
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/dex/trending-pools ─────────────────────────────

dexRoutes.get("/trending-pools", async (c) => {
  const { data } = await gt.getTrendingPools();

  return c.json({
    data: data.map((p) => ({
      id: p.id,
      name: p.attributes.name,
      address: p.attributes.address,
      priceUsd: p.attributes.base_token_price_usd,
      fdvUsd: p.attributes.fdv_usd,
      reserveUsd: p.attributes.reserve_in_usd,
      volume24h: p.attributes.volume_usd.h24,
      priceChange24h: p.attributes.price_change_percentage.h24,
      txns24h: p.attributes.transactions.h24,
    })),
    timestamp: new Date().toISOString(),
  });
});

dexRoutes.get("/trending-pools/:network", async (c) => {
  const netResult = validateParam(c, "network", ChainSlugSchema);
  if (!netResult.success) return netResult.error;
  const network = netResult.data;
  const { data } = await gt.getTrendingPools(network);

  return c.json({
    data: data.map((p) => ({
      id: p.id,
      name: p.attributes.name,
      network,
      address: p.attributes.address,
      priceUsd: p.attributes.base_token_price_usd,
      fdvUsd: p.attributes.fdv_usd,
      reserveUsd: p.attributes.reserve_in_usd,
      volume24h: p.attributes.volume_usd.h24,
      priceChange24h: p.attributes.price_change_percentage.h24,
      txns24h: p.attributes.transactions.h24,
    })),
    network: c.req.param("network"),
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/dex/new-pools ──────────────────────────────────

dexRoutes.get("/new-pools", async (c) => {
  const { data } = await gt.getNewPools();

  return c.json({
    data: data.map((p) => ({
      id: p.id,
      name: p.attributes.name,
      address: p.attributes.address,
      priceUsd: p.attributes.base_token_price_usd,
      volume24h: p.attributes.volume_usd.h24,
      reserveUsd: p.attributes.reserve_in_usd,
      createdAt: p.attributes.pool_created_at,
    })),
    timestamp: new Date().toISOString(),
  });
});

dexRoutes.get("/new-pools/:network", async (c) => {
  const netResult = validateParam(c, "network", ChainSlugSchema);
  if (!netResult.success) return netResult.error;
  const network = netResult.data;
  const { data } = await gt.getNewPools(network);

  return c.json({
    data: data.map((p) => ({
      id: p.id,
      name: p.attributes.name,
      address: p.attributes.address,
      priceUsd: p.attributes.base_token_price_usd,
      volume24h: p.attributes.volume_usd.h24,
      reserveUsd: p.attributes.reserve_in_usd,
      createdAt: p.attributes.pool_created_at,
    })),
    network: c.req.param("network"),
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/dex/top-pools/:network ─────────────────────────

dexRoutes.get("/top-pools/:network", async (c) => {
  const netResult = validateParam(c, "network", ChainSlugSchema);
  if (!netResult.success) return netResult.error;
  const network = netResult.data;
  const { data } = await gt.getTopPools(network);

  return c.json({
    data: data.map((p) => ({
      id: p.id,
      name: p.attributes.name,
      network,
      address: p.attributes.address,
      priceUsd: p.attributes.base_token_price_usd,
      volume24h: p.attributes.volume_usd.h24,
      reserveUsd: p.attributes.reserve_in_usd,
      priceChange24h: p.attributes.price_change_percentage.h24,
    })),
    network: c.req.param("network"),
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/dex/pool/:network/:address ─────────────────────

dexRoutes.get("/pool/:network/:address", async (c) => {
  const netResult = validateParam(c, "network", ChainSlugSchema);
  if (!netResult.success) return netResult.error;
  const network = netResult.data;
  const addrResult = validateParam(c, "address", HexAddressSchema);
  if (!addrResult.success) return addrResult.error;
  const address = addrResult.data;
  const tfResult = validateQuery(c, "timeframe", TimeframeSchema.default("hour"));
  if (!tfResult.success) return tfResult.error;
  const tf = tfResult.data;
  const limit = Math.min(Number(c.req.query("limit") || 100), 1000);

  const { data } = await gt.getPoolOHLCV(network, address, tf, 1, limit);

  return c.json({
    data: (data.attributes.ohlcv_list || []).map(
      ([ts, o, h, l, cl, vol]) => ({
        timestamp: ts,
        open: o,
        high: h,
        low: l,
        close: cl,
        volume: vol,
      }),
    ),
    network,
    pool: address,
    timeframe: tf,
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/dex/token/:network/:address ────────────────────

dexRoutes.get("/token/:network/:address", async (c) => {
  const netResult = validateParam(c, "network", ChainSlugSchema);
  if (!netResult.success) return netResult.error;
  const network = netResult.data;
  const addrResult = validateParam(c, "address", HexAddressSchema);
  if (!addrResult.success) return addrResult.error;
  const address = addrResult.data;

  const [tokenRes, poolsRes] = await Promise.all([
    gt.getTokenInfo(network, address).catch(() => null),
    gt.getTokenPools(network, address).catch(() => ({ data: [] })),
  ]);

  return c.json({
    data: {
      token: tokenRes
        ? {
            name: tokenRes.data.attributes.name,
            symbol: tokenRes.data.attributes.symbol,
            address: tokenRes.data.attributes.address,
            priceUsd: tokenRes.data.attributes.price_usd,
            fdvUsd: tokenRes.data.attributes.fdv_usd,
            volume24h: tokenRes.data.attributes.volume_usd.h24,
            marketCapUsd: tokenRes.data.attributes.market_cap_usd,
            totalSupply: tokenRes.data.attributes.total_supply,
            coingeckoId: tokenRes.data.attributes.coingecko_coin_id,
          }
        : null,
      pools: poolsRes.data.slice(0, 20).map((p) => ({
        id: p.id,
        name: p.attributes.name,
        volume24h: p.attributes.volume_usd.h24,
        reserveUsd: p.attributes.reserve_in_usd,
      })),
    },
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/dex/pool-search ────────────────────────────────

dexRoutes.get("/pool-search", async (c) => {
  const qResult = validateQuery(c, "q", SearchQuerySchema);
  if (!qResult.success) return qResult.error;
  const q = qResult.data;

  const { data } = await gt.searchPools(q);

  return c.json({
    data: data.map((p) => ({
      id: p.id,
      name: p.attributes.name,
      address: p.attributes.address,
      fdvUsd: p.attributes.fdv_usd,
      reserveUsd: p.attributes.reserve_in_usd,
      volume24h: p.attributes.volume_usd.h24,
      priceChange24h: p.attributes.price_change_percentage.h24,
    })),
    timestamp: new Date().toISOString(),
  });
});
