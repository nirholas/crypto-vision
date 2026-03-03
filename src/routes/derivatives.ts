/**
 * Crypto Vision — Derivatives Routes
 *
 * Futures/derivatives data via CoinGlass (free tier, 100 req/day).
 *
 * GET /api/derivatives/funding          — Funding rates across exchanges
 * GET /api/derivatives/funding/:symbol  — Funding rate for a symbol
 * GET /api/derivatives/oi               — Open interest overview
 * GET /api/derivatives/oi/:symbol       — OI breakdown by exchange
 * GET /api/derivatives/liquidations     — Liquidation data
 * GET /api/derivatives/long-short/:sym  — Long/short ratio history
 */

import { Hono } from "hono";
import { processDerivatives } from "../lib/anomaly-processors.js";
import * as glass from "../sources/coinglass.js";

export const derivativesRoutes = new Hono();

// ─── GET /api/derivatives/funding ────────────────────────────

derivativesRoutes.get("/funding", async (c) => {
  const result = await glass.getFundingRates();

  // Feed anomaly detection with funding rate data
  for (const item of (result.data || [])) {
    const avgRate = (item.uMarginList || []).reduce((sum: number, ex: { rate: number }) => sum + ex.rate, 0)
      / Math.max((item.uMarginList || []).length, 1);
    processDerivatives(item.symbol, avgRate, 0);
  }

  return c.json({
    data: (result.data || []).map((item) => ({
      symbol: item.symbol,
      exchanges: (item.uMarginList || []).map((ex) => ({
        exchange: ex.exchangeName,
        rate: ex.rate,
        nextFundingTime: ex.nextFundingTime
          ? new Date(ex.nextFundingTime).toISOString()
          : null,
      })),
    })),
    timestamp: new Date().toISOString(),
  });
});

derivativesRoutes.get("/funding/:symbol", async (c) => {
  const symbol = c.req.param("symbol").toUpperCase();
  const result = await glass.getFundingRates(symbol);

  const match = (result.data || []).find((d) => d.symbol === symbol);
  if (!match) return c.json({ error: `Symbol ${symbol} not found` }, 404);

  return c.json({
    data: {
      symbol,
      exchanges: (match.uMarginList || []).map((ex) => ({
        exchange: ex.exchangeName,
        rate: ex.rate,
        nextFundingTime: ex.nextFundingTime
          ? new Date(ex.nextFundingTime).toISOString()
          : null,
      })),
    },
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/derivatives/oi ─────────────────────────────────

derivativesRoutes.get("/oi", async (c) => {
  const limit = Math.min(Number(c.req.query("limit") || 50), 200);
  const result = await glass.getOpenInterest();

  // Feed anomaly detection with OI + funding rate data
  for (const item of (result.data || [])) {
    if (item.openInterest != null) {
      processDerivatives(item.symbol, 0, item.openInterest);
    }
  }

  return c.json({
    data: (result.data || [])
      .sort((a, b) => (b.openInterest || 0) - (a.openInterest || 0))
      .slice(0, limit)
      .map((item) => ({
        symbol: item.symbol,
        openInterest: item.openInterest,
        openInterestAmount: item.openInterestAmount,
        change1h: item.h1Change,
        change4h: item.h4Change,
        change24h: item.h24Change,
      })),
    timestamp: new Date().toISOString(),
  });
});

derivativesRoutes.get("/oi/:symbol", async (c) => {
  const symbol = c.req.param("symbol").toUpperCase();
  const result = await glass.getOIByExchange(symbol);

  return c.json({
    data: (result.data || [])
      .sort((a, b) => (b.openInterest || 0) - (a.openInterest || 0))
      .map((ex) => ({
        exchange: ex.exchangeName,
        openInterest: ex.openInterest,
        openInterestAmount: ex.openInterestAmount,
        volume: ex.volUsd,
        change24h: ex.h24Change,
      })),
    symbol,
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/derivatives/liquidations ───────────────────────

derivativesRoutes.get("/liquidations", async (c) => {
  const limit = Math.min(Number(c.req.query("limit") || 50), 200);
  const result = await glass.getLiquidations();

  return c.json({
    data: (result.data || [])
      .sort(
        (a, b) =>
          (b.h24LongLiquidationUsd + b.h24ShortLiquidationUsd || 0) -
          (a.h24LongLiquidationUsd + a.h24ShortLiquidationUsd || 0),
      )
      .slice(0, limit)
      .map((item) => ({
        symbol: item.symbol,
        long24h: item.h24LongLiquidationUsd,
        short24h: item.h24ShortLiquidationUsd,
        total24h: (item.h24LongLiquidationUsd || 0) + (item.h24ShortLiquidationUsd || 0),
        long1h: item.h1LongLiquidationUsd,
        short1h: item.h1ShortLiquidationUsd,
        long4h: item.h4LongLiquidationUsd,
        short4h: item.h4ShortLiquidationUsd,
        long12h: item.h12LongLiquidationUsd,
        short12h: item.h12ShortLiquidationUsd,
      })),
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/derivatives/long-short/:symbol ─────────────────

derivativesRoutes.get("/long-short/:symbol", async (c) => {
  const symbol = c.req.param("symbol").toUpperCase();
  const interval = c.req.query("interval") || "h1";
  const result = await glass.getLongShortRatio(symbol, interval);

  return c.json({
    data: (result.data || []).map((d) => ({
      longRate: d.longRate,
      shortRate: d.shortRate,
      longVolUsd: d.longVolUsd,
      shortVolUsd: d.shortVolUsd,
      timestamp: new Date(d.createTime).toISOString(),
    })),
    symbol,
    interval,
    timestamp: new Date().toISOString(),
  });
});
