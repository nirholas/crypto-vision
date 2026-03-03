/**
 * Crypto Vision — DeFi Routes
 *
 * GET /api/defi/protocols      — Top DeFi protocols by TVL
 * GET /api/defi/protocol/:slug — Protocol detail + TVL history
 * GET /api/defi/chains         — Chain TVL rankings
 * GET /api/defi/chain/:name    — Chain TVL history
 * GET /api/defi/yields         — Top yield opportunities
 * GET /api/defi/stablecoins    — Stablecoin market data
 * GET /api/defi/dex-volumes    — DEX volume rankings
 * GET /api/defi/fees           — Protocol fees & revenue
 * GET /api/defi/bridges        — Cross-chain bridges
 * GET /api/defi/raises         — Recent funding rounds
 */

import { Hono } from "hono";
import * as llama from "../sources/defillama.js";

export const defiRoutes = new Hono();

// ─── GET /api/defi/protocols ─────────────────────────────────

defiRoutes.get("/protocols", async (c) => {
  const limit = Math.min(Number(c.req.query("limit") || 100), 500);
  const chain = c.req.query("chain");
  const category = c.req.query("category");

  let protocols = await llama.getProtocols();

  if (chain) {
    protocols = protocols.filter((p) =>
      p.chains.some((ch) => ch.toLowerCase() === chain.toLowerCase())
    );
  }
  if (category) {
    protocols = protocols.filter(
      (p) => p.category?.toLowerCase() === category.toLowerCase()
    );
  }

  // Sort by TVL descending
  protocols.sort((a, b) => (b.tvl || 0) - (a.tvl || 0));

  return c.json({
    data: protocols.slice(0, limit).map((p) => ({
      name: p.name,
      slug: p.slug,
      symbol: p.symbol,
      tvl: p.tvl,
      change1h: p.change_1h,
      change1d: p.change_1d,
      change7d: p.change_7d,
      category: p.category,
      chains: p.chains,
      logo: p.logo,
      mcap: p.mcap ?? null,
    })),
    count: Math.min(protocols.length, limit),
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/defi/protocol/:slug ────────────────────────────

defiRoutes.get("/protocol/:slug", async (c) => {
  const data = await llama.getProtocolDetail(c.req.param("slug"));

  return c.json({
    data: {
      name: data.name,
      symbol: data.symbol,
      category: data.category,
      chains: data.chains,
      chainTvls: data.currentChainTvls,
      tvlHistory: data.tvl.slice(-90), // last 90 data points
    },
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/defi/chains ────────────────────────────────────

defiRoutes.get("/chains", async (c) => {
  const chains = await llama.getChainsTVL();

  return c.json({
    data: chains
      .filter((ch) => ch.tvl > 0)
      .sort((a, b) => b.tvl - a.tvl)
      .map((ch) => ({
        name: ch.name,
        tvl: ch.tvl,
        tokenSymbol: ch.tokenSymbol,
        chainId: ch.chainId,
        geckoId: ch.gecko_id,
      })),
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/defi/chain/:name ───────────────────────────────

defiRoutes.get("/chain/:name", async (c) => {
  const data = await llama.getChainTVLHistory(c.req.param("name"));

  return c.json({
    data: data.slice(-365), // last year
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/defi/yields ────────────────────────────────────

defiRoutes.get("/yields", async (c) => {
  const limit = Math.min(Number(c.req.query("limit") || 100), 500);
  const chain = c.req.query("chain");
  const project = c.req.query("project");
  const stableOnly = c.req.query("stablecoin") === "true";
  const minTvl = Number(c.req.query("min_tvl") || 0);
  const minApy = Number(c.req.query("min_apy") || 0);

  const { data } = await llama.getYieldPools();

  let pools = data
    .filter((p) => p.tvlUsd >= minTvl)
    .filter((p) => p.apy >= minApy);

  if (chain) pools = pools.filter((p) => p.chain.toLowerCase() === chain.toLowerCase());
  if (project) pools = pools.filter((p) => p.project.toLowerCase() === project.toLowerCase());
  if (stableOnly) pools = pools.filter((p) => p.stablecoin);

  pools.sort((a, b) => b.apy - a.apy);

  return c.json({
    data: pools.slice(0, limit).map((p) => ({
      pool: p.pool,
      project: p.project,
      chain: p.chain,
      symbol: p.symbol,
      tvl: p.tvlUsd,
      apy: p.apy,
      apyBase: p.apyBase,
      apyReward: p.apyReward,
      stablecoin: p.stablecoin,
      ilRisk: p.ilRisk,
    })),
    count: Math.min(pools.length, limit),
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/defi/stablecoins ───────────────────────────────

defiRoutes.get("/stablecoins", async (c) => {
  const { peggedAssets } = await llama.getStablecoins();

  return c.json({
    data: peggedAssets
      .map((s) => {
        const totalCirculating = Object.values(s.circulating).reduce(
          (sum, ch) => sum + (ch.peggedUSD || 0),
          0
        );
        return {
          name: s.name,
          symbol: s.symbol,
          geckoId: s.gecko_id,
          pegType: s.pegType,
          circulating: totalCirculating,
          chains: s.chains,
        };
      })
      .sort((a, b) => b.circulating - a.circulating),
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/defi/dex-volumes ───────────────────────────────

defiRoutes.get("/dex-volumes", async (c) => {
  const data = await llama.getDexVolumes();

  return c.json({
    data: {
      totalChart: data.totalDataChart,
      protocols: (data.protocols || [])
        .sort((a, b) => (b.total24h || 0) - (a.total24h || 0))
        .slice(0, 50)
        .map((p) => ({
          name: p.name,
          volume24h: p.total24h,
          volume7d: p.total7d,
          volume30d: p.total30d,
          change1d: p.change_1d,
        })),
    },
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/defi/fees ──────────────────────────────────────

defiRoutes.get("/fees", async (c) => {
  const data = await llama.getFeesRevenue();

  return c.json({
    data: (data.protocols || [])
      .sort((a, b) => (b.total24h || 0) - (a.total24h || 0))
      .slice(0, 50)
      .map((p) => ({
        name: p.name,
        fees24h: p.total24h,
        fees7d: p.total7d,
        fees30d: p.total30d,
        category: p.category,
      })),
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/defi/bridges ───────────────────────────────────

defiRoutes.get("/bridges", async (c) => {
  const { bridges } = await llama.getBridges();

  return c.json({
    data: (bridges || [])
      .sort((a, b) => (b.volumePrevDay || 0) - (a.volumePrevDay || 0))
      .map((b) => ({
        name: b.displayName || b.name,
        volumePrevDay: b.volumePrevDay,
        chains: b.chains,
      })),
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/defi/raises ────────────────────────────────────

defiRoutes.get("/raises", async (c) => {
  const limit = Math.min(Number(c.req.query("limit") || 50), 200);
  const { raises } = await llama.getRaises();

  return c.json({
    data: (raises || [])
      .sort((a, b) => (b.date || 0) - (a.date || 0))
      .slice(0, limit)
      .map((r) => ({
        name: r.name,
        amount: r.amount,
        round: r.round,
        date: r.date ? new Date(r.date * 1000).toISOString() : null,
        category: r.category,
        leadInvestors: r.leadInvestors,
      })),
    timestamp: new Date().toISOString(),
  });
});
