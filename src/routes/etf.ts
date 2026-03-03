/**
 * Crypto Vision — ETF Routes
 *
 * BTC & ETH spot ETF data (quotes, charts, premiums, flows).
 *
 * GET /api/etf/btc              — BTC spot ETF quotes (all issuers)
 * GET /api/etf/eth              — ETH spot ETF quotes (all issuers)
 * GET /api/etf/overview         — Combined BTC + ETH ETF dashboard
 * GET /api/etf/chart/:ticker    — Historical ETF price chart
 * GET /api/etf/premiums         — ETF premium/discount estimates
 * GET /api/etf/flows/btc        — BTC ETF flow data (CoinGlass)
 * GET /api/etf/flows/eth        — ETH ETF flow data (CoinGlass)
 * GET /api/etf/tickers          — All tracked ETF tickers
 *
 * @copyright 2024-2026 nirholas. All rights reserved.
 */

import { Hono } from "hono";
import * as etf from "../sources/etf.js";

export const etfRoutes = new Hono();

// ─── BTC ETFs ────────────────────────────────────────────────

etfRoutes.get("/btc", async (c) => {
  const data = await etf.getBTCETFs();
  return c.json({
    asset: "BTC",
    count: data.length,
    data,
    timestamp: new Date().toISOString(),
  });
});

// ─── ETH ETFs ────────────────────────────────────────────────

etfRoutes.get("/eth", async (c) => {
  const data = await etf.getETHETFs();
  return c.json({
    asset: "ETH",
    count: data.length,
    data,
    timestamp: new Date().toISOString(),
  });
});

// ─── Overview (combined dashboard) ───────────────────────────

etfRoutes.get("/overview", async (c) => {
  const data = await etf.getETFOverview();
  return c.json(data);
});

// ─── Historical Chart ────────────────────────────────────────

etfRoutes.get("/chart/:ticker", async (c) => {
  const ticker = c.req.param("ticker").toUpperCase();
  const range = c.req.query("range") || "1mo";
  const interval = c.req.query("interval") || "1d";

  // Validate ticker is in our registry
  const valid = etf.ALL_ETFS.find((e) => e.symbol === ticker);
  if (!valid) {
    return c.json({
      error: `Unknown ETF ticker: ${ticker}`,
      validTickers: etf.ALL_ETFS.map((e) => e.symbol),
    }, 400);
  }

  const data = await etf.getETFChart(ticker, range, interval);
  if (!data) {
    return c.json({ error: `No chart data for ${ticker}` }, 404);
  }
  return c.json(data);
});

// ─── Premium/Discount Estimates ──────────────────────────────

etfRoutes.get("/premiums", async (c) => {
  const data = await etf.getETFPremiums();
  return c.json(data);
});

// ─── ETF Flows ───────────────────────────────────────────────

etfRoutes.get("/flows/btc", async (c) => {
  const data = await etf.getETFFlows("BTC");
  return c.json(data);
});

etfRoutes.get("/flows/eth", async (c) => {
  const data = await etf.getETFFlows("ETH");
  return c.json(data);
});

// ─── Tickers ─────────────────────────────────────────────────

etfRoutes.get("/tickers", async (c) => {
  const tickers = etf.getTickers();
  return c.json({
    count: tickers.length,
    btcCount: tickers.filter((t) => t.asset === "BTC").length,
    ethCount: tickers.filter((t) => t.asset === "ETH").length,
    data: tickers,
  });
});
