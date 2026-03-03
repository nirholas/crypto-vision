/**
 * Crypto Vision — Portfolio Analysis Routes
 *
 * Advanced portfolio analytics — valuation, risk, correlation, diversification.
 *
 * POST /api/portfolio/value             — Portfolio valuation (post holdings)
 * POST /api/portfolio/correlation       — Correlation matrix for assets
 * GET  /api/portfolio/volatility/:id    — Volatility & risk metrics for a coin
 * POST /api/portfolio/diversification   — Diversification score for a portfolio
 * POST /api/portfolio/risk              — Multi-asset risk analysis
 *
 * @copyright 2024-2026 nirholas. All rights reserved.
 */

import { Hono } from "hono";
import * as portfolio from "../sources/portfolio.js";

export const portfolioRoutes = new Hono();

// ─── Portfolio Valuation ─────────────────────────────────────

portfolioRoutes.post("/value", async (c) => {
  const body = await c.req.json<{
    holdings: Array<{ id: string; amount: number }>;
    vs_currency?: string;
  }>();

  if (!body.holdings || !Array.isArray(body.holdings) || body.holdings.length === 0) {
    return c.json({ error: "POST body must include 'holdings' array: [{ id: 'bitcoin', amount: 1.5 }]" }, 400);
  }
  if (body.holdings.length > 50) {
    return c.json({ error: "Maximum 50 holdings per request" }, 400);
  }

  const data = await portfolio.valuePortfolio(body.holdings, body.vs_currency || "usd");
  return c.json(data);
});

// ─── Correlation Matrix ──────────────────────────────────────

portfolioRoutes.post("/correlation", async (c) => {
  const body = await c.req.json<{ ids: string[]; days?: number; vs_currency?: string }>();

  if (!body.ids || !Array.isArray(body.ids) || body.ids.length < 2) {
    return c.json({ error: "POST body must include 'ids' array with at least 2 coin IDs" }, 400);
  }
  if (body.ids.length > 20) {
    return c.json({ error: "Maximum 20 assets per correlation request" }, 400);
  }

  const days = Math.min(body.days || 30, 365);
  const data = await portfolio.correlationMatrix(body.ids, days, body.vs_currency || "usd");
  return c.json(data);
});

// ─── Volatility & Risk ──────────────────────────────────────

portfolioRoutes.get("/volatility/:id", async (c) => {
  const id = c.req.param("id");
  const days = Math.min(Number(c.req.query("days")) || 90, 365);
  const vsCurrency = c.req.query("vs") || "usd";
  const data = await portfolio.volatilityMetrics(id, days, vsCurrency);
  return c.json(data);
});

// Multi-asset volatility
portfolioRoutes.post("/risk", async (c) => {
  const body = await c.req.json<{ ids: string[]; days?: number; vs_currency?: string }>();

  if (!body.ids || !Array.isArray(body.ids) || body.ids.length === 0) {
    return c.json({ error: "POST body must include 'ids' array of coin IDs" }, 400);
  }
  if (body.ids.length > 20) {
    return c.json({ error: "Maximum 20 assets per risk analysis" }, 400);
  }

  const days = Math.min(body.days || 90, 365);
  const vsCurrency = body.vs_currency || "usd";

  const results = await Promise.all(
    body.ids.map((id) => portfolio.volatilityMetrics(id, days, vsCurrency)),
  );

  // Sort by annualized volatility (highest risk first)
  results.sort((a, b) => b.annualizedVolatility - a.annualizedVolatility);

  return c.json({
    count: results.length,
    period: `${days}d`,
    data: results,
  });
});

// ─── Diversification Score ───────────────────────────────────

portfolioRoutes.post("/diversification", async (c) => {
  const body = await c.req.json<{
    holdings: Array<{ id: string; amount: number }>;
  }>();

  if (!body.holdings || !Array.isArray(body.holdings) || body.holdings.length === 0) {
    return c.json({ error: "POST body must include 'holdings' array" }, 400);
  }
  if (body.holdings.length > 50) {
    return c.json({ error: "Maximum 50 holdings" }, 400);
  }

  const data = await portfolio.diversificationScore(body.holdings);
  return c.json(data);
});
