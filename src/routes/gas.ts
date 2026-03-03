/**
 * Crypto Vision — Gas Tracker Routes
 *
 * Multi-chain gas prices via Owlracle (free) + Etherscan.
 *
 * GET /api/gas              — All-chain gas overview
 * GET /api/gas/:chain       — Gas for a specific chain
 * GET /api/gas/ethereum/oracle — Etherscan gas oracle (detailed)
 */

import { Hono } from "hono";
import * as evm from "../sources/evm.js";

export const gasRoutes = new Hono();

// ─── GET /api/gas ────────────────────────────────────────────

gasRoutes.get("/", async (c) => {
  const estimates = await evm.getMultiChainGas();

  return c.json({
    data: estimates,
    chains: estimates.map((e) => e.chain),
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/gas/:chain ─────────────────────────────────────

gasRoutes.get("/:chain", async (c) => {
  const chain = c.req.param("chain").toLowerCase();

  // Special route for Etherscan oracle
  if (chain === "ethereum" && c.req.query("source") === "etherscan") {
    try {
      const { result } = await evm.getEthGasOracle();
      return c.json({
        data: {
          chain: "ethereum",
          lastBlock: result.LastBlock,
          safeGasPrice: Number(result.SafeGasPrice),
          proposeGasPrice: Number(result.ProposeGasPrice),
          fastGasPrice: Number(result.FastGasPrice),
          suggestBaseFee: Number(result.suggestBaseFee),
          unit: "gwei",
          source: "etherscan",
        },
        timestamp: new Date().toISOString(),
      });
    } catch {
      // fall through to owlracle
    }
  }

  const data = await evm.getGasOracle(chain);

  return c.json({
    data: {
      chain,
      speeds: (data.speeds || []).map((s) => ({
        acceptance: s.acceptance,
        gasPrice: s.gasPrice,
        estimatedFee: s.estimatedFee,
      })),
      unit: "gwei",
    },
    timestamp: new Date().toISOString(),
  });
});
