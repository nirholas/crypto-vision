/**
 * Crypto Vision — On-Chain Data Routes
 *
 * GET /api/onchain/gas           — Multi-chain gas prices
 * GET /api/onchain/bitcoin/fees  — Bitcoin fee estimates
 * GET /api/onchain/bitcoin/stats — Bitcoin network stats
 * GET /api/onchain/token/:addr   — Token info by address (DexScreener)
 * GET /api/onchain/prices        — Multi-chain token prices (DeFiLlama)
 */

import { Hono } from "hono";
import * as alt from "../sources/alternative.js";
import * as llama from "../sources/defillama.js";

export const onchainRoutes = new Hono();

// ─── GET /api/onchain/gas ────────────────────────────────────

onchainRoutes.get("/gas", async (c) => {
  // Aggregate gas from multiple sources
  const btcFees = await alt.getBitcoinFees();

  return c.json({
    data: {
      bitcoin: {
        fastest: btcFees.fastestFee,
        halfHour: btcFees.halfHourFee,
        hour: btcFees.hourFee,
        economy: btcFees.economyFee,
        minimum: btcFees.minimumFee,
        unit: "sat/vB",
      },
      // TODO: Add EVM gas from on-chain RPCs when GCP infra is ready
    },
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/onchain/bitcoin/fees ───────────────────────────

onchainRoutes.get("/bitcoin/fees", async (c) => {
  const data = await alt.getBitcoinFees();

  return c.json({
    data: {
      ...data,
      unit: "sat/vB",
    },
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/onchain/bitcoin/stats ──────────────────────────

onchainRoutes.get("/bitcoin/stats", async (c) => {
  const hashrate = await alt.getBitcoinHashrate();

  return c.json({
    data: hashrate,
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/onchain/token/:address ─────────────────────────

onchainRoutes.get("/token/:address", async (c) => {
  const { pairs } = await alt.dexTokenPairs(c.req.param("address"));

  if (!pairs || pairs.length === 0) {
    return c.json({ error: "Token not found", data: null }, 404);
  }

  return c.json({
    data: {
      token: pairs[0].baseToken,
      pairs: pairs.slice(0, 20).map((p) => ({
        chain: p.chainId,
        dex: p.dexId,
        pair: p.pairAddress,
        quoteToken: p.quoteToken,
        priceUsd: p.priceUsd,
        volume24h: p.volume?.h24,
        liquidity: p.liquidity?.usd,
        fdv: p.fdv,
        txns24h: p.txns?.h24,
        createdAt: p.pairCreatedAt,
      })),
    },
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/onchain/prices ─────────────────────────────────

onchainRoutes.get("/prices", async (c) => {
  const coins = c.req.query("coins"); // format: "ethereum:0x...,bsc:0x..."
  if (!coins) {
    return c.json({
      error: "coins parameter required (format: chain:address,chain:address)",
    }, 400);
  }

  const data = await llama.getTokenPrices(coins.split(","));

  return c.json({
    data: data.coins,
    timestamp: new Date().toISOString(),
  });
});
