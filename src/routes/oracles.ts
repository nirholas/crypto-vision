/**
 * Crypto Vision — Oracle Data Routes
 *
 * On-chain oracle price feeds from Chainlink, DIA, and Pyth Network.
 *
 * GET /api/oracles/chainlink/feeds      — Chainlink mainnet price feeds
 * GET /api/oracles/chainlink/all        — All Chainlink feed directories
 * GET /api/oracles/dia/quote/:symbol    — DIA oracle price quote
 * GET /api/oracles/dia/assets           — DIA asset list
 * GET /api/oracles/dia/supply/:symbol   — DIA circulating supply
 * GET /api/oracles/pyth/feeds           — Pyth Network feed IDs
 * POST /api/oracles/pyth/prices         — Pyth latest prices (POST ids[])
 *
 * @copyright 2024-2026 nirholas. All rights reserved.
 */

import { Hono } from "hono";
import * as oracles from "../sources/oracles.js";
import { PythPriceIdsSchema, validateBody } from "../lib/validation.js";

export const oracleRoutes = new Hono();

// ─── Chainlink ───────────────────────────────────────────────

oracleRoutes.get("/chainlink/feeds", async (c) => {
  const data = await oracles.getMainnetFeeds();
  return c.json({ count: Array.isArray(data) ? data.length : 0, data });
});

oracleRoutes.get("/chainlink/all", async (c) => {
  const data = await oracles.getAllNetworkFeeds();
  return c.json(data);
});

// ─── DIA ─────────────────────────────────────────────────────

oracleRoutes.get("/dia/quote/:symbol", async (c) => {
  const symbol = c.req.param("symbol");
  const data = await oracles.getDiaQuotation(symbol);
  return c.json(data);
});

oracleRoutes.get("/dia/assets", async (c) => {
  const data = await oracles.getDiaAssetList();
  return c.json(data);
});

oracleRoutes.get("/dia/supply/:symbol", async (c) => {
  const symbol = c.req.param("symbol");
  const data = await oracles.getDiaSupply(symbol);
  return c.json(data);
});

// ─── Pyth Network ────────────────────────────────────────────

oracleRoutes.get("/pyth/feeds", async (c) => {
  const data = await oracles.getPythPriceFeedIds();
  return c.json({ count: Array.isArray(data) ? data.length : 0, data });
});

oracleRoutes.post("/pyth/prices", async (c) => {
  const parsed = await validateBody(c, PythPriceIdsSchema);
  if (!parsed.success) return parsed.error;
  const { ids } = parsed.data;

  const data = await oracles.getPythPriceFeeds(ids);
  return c.json({ count: Array.isArray(data) ? data.length : 0, data });
});
