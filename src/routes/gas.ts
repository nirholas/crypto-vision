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
import { processGas } from "../lib/anomaly-processors.js";
import * as evm from "../sources/evm.js";

export const gasRoutes = new Hono();

// ─── GET /api/gas ────────────────────────────────────────────

gasRoutes.get("/", async (c) => {
  const estimates = await evm.getMultiChainGas();

  // Feed anomaly detection with gas data per chain
  for (const est of estimates) {
    if (est.gasPrice) processGas(est.chain, est.gasPrice);
  }

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

// ─── GET /api/gas/eth/supply ─────────────────────────────────
// Total ETH supply (Etherscan)

gasRoutes.get("/eth/supply", async (c) => {
  const data = await evm.getEthSupply();

  return c.json({
    data: {
      supplyWei: data.result,
      supplyEth: Number(data.result) / 1e18,
    },
    source: "etherscan",
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/gas/eth/price ──────────────────────────────────
// Current ETH price in USD + BTC (Etherscan)

gasRoutes.get("/eth/price", async (c) => {
  const data = await evm.getEthPrice();

  return c.json({
    data: {
      ethUsd: Number(data.result.ethusd),
      ethBtc: Number(data.result.ethbtc),
      ethUsdTimestamp: data.result.ethusd_timestamp
        ? new Date(Number(data.result.ethusd_timestamp) * 1000).toISOString()
        : null,
      ethBtcTimestamp: data.result.ethbtc_timestamp
        ? new Date(Number(data.result.ethbtc_timestamp) * 1000).toISOString()
        : null,
    },
    source: "etherscan",
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/gas/eth/token/:address/holders ─────────────────
// Top ERC-20 token holders (Etherscan)

gasRoutes.get("/eth/token/:address/holders", async (c) => {
  const address = c.req.param("address");
  const data = await evm.getERC20TopHolders(address);

  return c.json({
    data: (data.result || []).map((h: any) => ({
      address: h.TokenHolderAddress,
      quantity: h.TokenHolderQuantity,
      percentage: h.percentage,
    })),
    contractAddress: address,
    source: "etherscan",
    timestamp: new Date().toISOString(),
  });
});
