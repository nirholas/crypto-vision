/**
 * Crypto Vision — Staking Routes
 *
 * Comprehensive staking data from Beaconcha.in, Rated.network, and DeFi Llama.
 *
 * GET /api/staking/overview              — Comprehensive staking dashboard
 * GET /api/staking/yields                — Staking yields across networks
 * GET /api/staking/yield/:token          — Staking yield for specific token
 * GET /api/staking/validators/:chain     — Validator set for a chain
 * GET /api/staking/calculator            — Staking rewards calculator
 * GET /api/staking/liquid-staking        — Liquid staking protocol comparison
 * GET /api/staking/restaking             — Restaking (EigenLayer) metrics
 * GET /api/staking/history/:token        — Historical staking rate
 * GET /api/staking/eth/validators        — ETH validator queue
 * GET /api/staking/eth/epoch             — Latest epoch info
 * GET /api/staking/eth/network           — ETH 2.0 network stats
 * GET /api/staking/eth/validator/:id     — Validator detail
 * GET /api/staking/eth/attestations/:id  — Validator attestation performance
 * GET /api/staking/eth/rated             — Rated.network validator overview
 * GET /api/staking/eth/operators         — Top staking operators
 * GET /api/staking/eth/metrics           — Network-level staking metrics
 * GET /api/staking/liquid                — Liquid staking protocols (legacy)
 * GET /api/staking/protocols             — Raw liquid staking protocols (legacy)
 *
 * @copyright 2024-2026 nirholas. All rights reserved.
 */

import { Hono } from "hono";
import { z } from "zod";
import { AppError } from "../lib/api-error.js";
import * as staking from "../sources/staking.js";

export const stakingRoutes = new Hono();

// ─── GET /api/staking/overview ───────────────────────────────

stakingRoutes.get("/overview", async (c) => {
  const data = await staking.getStakingOverview();
  return c.json({
    data,
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/staking/yields ─────────────────────────────────

stakingRoutes.get("/yields", async (c) => {
  const chain = c.req.query("chain");
  const minTvl = Number(c.req.query("minTvl") || "0");
  const limit = Math.min(Number(c.req.query("limit") || "100"), 200);

  let yields = await staking.getStakingYields();

  if (chain) {
    yields = yields.filter(
      (y) => y.chain.toLowerCase() === chain.toLowerCase(),
    );
  }
  if (minTvl > 0) {
    yields = yields.filter((y) => y.tvlUsd >= minTvl);
  }

  return c.json({
    data: yields.slice(0, limit),
    count: Math.min(yields.length, limit),
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/staking/yield/:token ───────────────────────────

stakingRoutes.get("/yield/:token", async (c) => {
  const token = c.req.param("token");
  const data = await staking.getStakingYield(token);

  if (!data || (data.apy === 0 && data.tvlUsd === 0)) {
    throw new AppError("NOT_FOUND", `No staking data found for token: ${token}`);
  }

  return c.json({
    data,
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/staking/validators/:chain ──────────────────────

stakingRoutes.get("/validators/:chain", async (c) => {
  const chain = c.req.param("chain");
  const data = await staking.getChainValidators(chain);
  return c.json({
    data,
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/staking/calculator ─────────────────────────────

const calculatorSchema = z.object({
  token: z.string().min(1).max(32),
  amount: z.coerce.number().positive("Amount must be positive"),
  period: z.coerce.number().int().min(1).max(3650).default(365),
});

stakingRoutes.get("/calculator", async (c) => {
  const parsed = calculatorSchema.safeParse(c.req.query());
  if (!parsed.success) {
    throw new AppError("VALIDATION_FAILED", "Invalid calculator parameters", {
      details: parsed.error.flatten().fieldErrors,
    });
  }

  const { token, amount, period } = parsed.data;
  const stakingInfo = await staking.getStakingYield(token);

  if (!stakingInfo || stakingInfo.apy === 0) {
    throw new AppError("NOT_FOUND", `No staking yield data found for token: ${token}`);
  }

  // APY-based calculations (APY already includes compounding)
  const dailyRate = stakingInfo.apy / 36500;
  const simpleRewards = amount * (stakingInfo.apy / 100) * (period / 365);
  const compoundedValue = amount * Math.pow(1 + dailyRate, period);
  const compoundedRewards = compoundedValue - amount;
  const dailyReward = amount * dailyRate;
  const monthlyReward = dailyReward * 30;
  const effectiveAPY = ((compoundedValue / amount) - 1) * (365 / period) * 100;

  return c.json({
    data: {
      token,
      amountStaked: amount,
      periodDays: period,
      apy: stakingInfo.apy,
      apr: stakingInfo.apr,
      simpleRewards: Math.round(simpleRewards * 1e8) / 1e8,
      compoundedRewards: Math.round(compoundedRewards * 1e8) / 1e8,
      compoundedValue: Math.round(compoundedValue * 1e8) / 1e8,
      dailyReward: Math.round(dailyReward * 1e8) / 1e8,
      monthlyReward: Math.round(monthlyReward * 1e8) / 1e8,
      yearlyReward: Math.round(simpleRewards * 1e8) / 1e8,
      effectiveAPY: Math.round(effectiveAPY * 100) / 100,
      unstakingPeriod: stakingInfo.unbondingDays,
      minimumStake: stakingInfo.minimumStake,
      validatorCommission: stakingInfo.avgValidatorCommission,
      chain: stakingInfo.chain,
      project: stakingInfo.project,
    },
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/staking/liquid-staking ─────────────────────────

stakingRoutes.get("/liquid-staking", async (c) => {
  const chain = c.req.query("chain") || "";
  const limit = Math.min(Number(c.req.query("limit") || "50"), 100);

  const protocols = chain
    ? await staking.getLiquidStakingByChain(chain)
    : await staking.getLiquidStaking();

  return c.json({
    data: protocols.slice(0, limit).map((p) => ({
      name: p.name,
      slug: p.slug,
      tvl: p.tvl,
      change24h: p.change1d,
      change7d: p.change7d,
      chains: p.chains,
      token: p.symbol,
      marketShare: Math.round(p.marketShare * 100) / 100,
    })),
    count: Math.min(protocols.length, limit),
    chain: chain || "all",
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/staking/restaking ──────────────────────────────

stakingRoutes.get("/restaking", async (c) => {
  const protocols = await staking.getRestakingProtocols();
  const totalTvl = protocols.reduce((sum, p) => sum + (p.tvl || 0), 0);

  return c.json({
    data: protocols.map((p) => ({
      name: p.name,
      slug: p.slug,
      symbol: p.symbol,
      tvl: p.tvl,
      change24h: p.change1d,
      change7d: p.change7d,
      chains: p.chains,
      category: p.category,
      marketShare: totalTvl > 0 ? Math.round(((p.tvl || 0) / totalTvl) * 10000) / 100 : 0,
    })),
    count: protocols.length,
    totalTvl,
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/staking/history/:token ─────────────────────────

stakingRoutes.get("/history/:token", async (c) => {
  const token = c.req.param("token");
  const data = await staking.getStakingHistory(token);

  return c.json({
    data,
    token,
    count: data.length,
    timestamp: new Date().toISOString(),
  });
});

// ─── Ethereum Beacon Chain (legacy / detailed ETH endpoints) ─

stakingRoutes.get("/eth/validators", async (c) => {
  const data = await staking.getValidatorQueue();
  return c.json(data);
});

stakingRoutes.get("/eth/epoch", async (c) => {
  const data = await staking.getLatestEpoch();
  return c.json(data);
});

stakingRoutes.get("/eth/network", async (c) => {
  const data = await staking.getETHNetworkStats();
  return c.json(data);
});

stakingRoutes.get("/eth/validator/:id", async (c) => {
  const id = c.req.param("id");
  const data = await staking.getValidator(id);
  return c.json(data);
});

stakingRoutes.get("/eth/attestations/:id", async (c) => {
  const id = c.req.param("id");
  const data = await staking.getValidatorAttestations(id);
  return c.json(data);
});

// ─── Rated.network ───────────────────────────────────────────

stakingRoutes.get("/eth/rated", async (c) => {
  const window = c.req.query("window") || "30d";
  const data = await staking.getRatedOverview(window);
  return c.json(data);
});

stakingRoutes.get("/eth/operators", async (c) => {
  const window = c.req.query("window") || "30d";
  const size = Math.min(Number(c.req.query("size")) || 50, 100);
  const data = await staking.getTopOperators(window, size);
  return c.json(data);
});

stakingRoutes.get("/eth/metrics", async (c) => {
  const data = await staking.getNetworkMetrics();
  return c.json(data);
});

// ─── Legacy Liquid Staking ───────────────────────────────────

stakingRoutes.get("/liquid", async (c) => {
  const data = await staking.getLiquidStaking();
  return c.json({ count: data.length, data });
});

// ─── Raw Liquid Staking Protocols ────────────────────────────

stakingRoutes.get("/protocols", async (c) => {
  const data = await staking.getLiquidStakingProtocols();
  const protocols = Array.isArray(data) ? data : [];
  const filtered = protocols
    .filter((p) => p.category === "Liquid Staking")
    .sort((a, b) => (b.tvl || 0) - (a.tvl || 0));
  return c.json({ count: filtered.length, data: filtered });
});
