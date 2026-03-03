/**
 * Crypto Vision — Staking Routes
 *
 * ETH staking data from Beaconcha.in, Rated.network, and DeFi Llama.
 *
 * GET /api/staking/eth/validators        — ETH validator queue
 * GET /api/staking/eth/epoch             — Latest epoch info
 * GET /api/staking/eth/network           — ETH 2.0 network stats
 * GET /api/staking/eth/validator/:id     — Validator detail
 * GET /api/staking/eth/attestations/:id  — Validator attestation performance
 * GET /api/staking/eth/rated             — Rated.network validator overview
 * GET /api/staking/eth/operators         — Top staking operators
 * GET /api/staking/eth/metrics           — Network-level staking metrics
 * GET /api/staking/liquid                — Liquid staking protocols
 * GET /api/staking/yields                — Staking yields
 * GET /api/staking/overview              — Comprehensive staking dashboard
 *
 * @copyright 2024-2026 nirholas. All rights reserved.
 */

import { Hono } from "hono";
import * as staking from "../sources/staking.js";

export const stakingRoutes = new Hono();

// ─── Ethereum Beacon Chain ───────────────────────────────────

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

// ─── Liquid Staking ──────────────────────────────────────────

stakingRoutes.get("/liquid", async (c) => {
  const data = await staking.getLiquidStaking();
  return c.json({ count: Array.isArray(data) ? data.length : 0, data });
});

stakingRoutes.get("/yields", async (c) => {
  const data = await staking.getStakingYields();
  return c.json({ count: Array.isArray(data) ? data.length : 0, data });
});

// ─── Aggregate ───────────────────────────────────────────────

stakingRoutes.get("/overview", async (c) => {
  const data = await staking.getStakingOverview();
  return c.json(data);
});

// ─── Raw Liquid Staking Protocols ────────────────────────────

stakingRoutes.get("/protocols", async (c) => {
  const data = await staking.getLiquidStakingProtocols();
  const protocols = Array.isArray(data) ? data : [];
  const filtered = protocols
    .filter((p: any) => p.category === "Liquid Staking")
    .sort((a: any, b: any) => (b.tvl || 0) - (a.tvl || 0));
  return c.json({ count: filtered.length, data: filtered });
});
