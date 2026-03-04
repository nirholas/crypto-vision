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
import { z } from "zod";
import { ApiError, extractErrorMessage } from "../lib/api-error.js";
import { processDerivatives } from "../lib/anomaly-processors.js";
import {
  DerivativesOiQuerySchema,
  DerivativesLiquidationsQuerySchema,
  DerivativesLongShortQuerySchema,
} from "../lib/route-schemas.js";
import { validateQueries, validateParam } from "../lib/validation.js";
import * as glass from "../sources/coinglass.js";

// ─── Shared Schemas ──────────────────────────────────────────

const SymbolParamSchema = z
  .string()
  .min(1)
  .max(20)
  .regex(/^[A-Za-z0-9]+$/, "Invalid symbol");

export const derivativesRoutes = new Hono();

// ─── GET /api/derivatives/funding ────────────────────────────

/**
 * @openapi
 * /api/derivatives/funding:
 *   get:
 *     summary: Funding rates across exchanges
 *     tags: [Derivatives]
 *     responses:
 *       200:
 *         description: Array of symbols with per-exchange funding rates
 *       502:
 *         description: Upstream CoinGlass error
 */
derivativesRoutes.get("/funding", async (c) => {
  try {
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
  } catch (err) {
    return ApiError.upstream(c, "coinglass", extractErrorMessage(err));
  }
});

// ─── GET /api/derivatives/funding/:symbol ────────────────────

/**
 * @openapi
 * /api/derivatives/funding/{symbol}:
 *   get:
 *     summary: Funding rate for a single symbol
 *     tags: [Derivatives]
 *     parameters:
 *       - in: path
 *         name: symbol
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Symbol funding rate detail
 *       400:
 *         description: Invalid symbol parameter
 *       404:
 *         description: Symbol not found
 *       502:
 *         description: Upstream CoinGlass error
 */
derivativesRoutes.get("/funding/:symbol", async (c) => {
  const pv = validateParam(c, "symbol", SymbolParamSchema);
  if (!pv.success) return pv.error;
  const symbol = pv.data.toUpperCase();

  try {
    const result = await glass.getFundingRates(symbol);

    const match = (result.data || []).find((d) => d.symbol === symbol);
    if (!match) return ApiError.notFound(c, `Symbol ${symbol} not found`);

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
  } catch (err) {
    return ApiError.upstream(c, "coinglass", extractErrorMessage(err));
  }
});

// ─── GET /api/derivatives/oi ─────────────────────────────────

/**
 * @openapi
 * /api/derivatives/oi:
 *   get:
 *     summary: Open interest overview
 *     tags: [Derivatives]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *           maximum: 200
 *     responses:
 *       200:
 *         description: Sorted open interest list
 *       400:
 *         description: Invalid query parameters
 *       502:
 *         description: Upstream CoinGlass error
 */
derivativesRoutes.get("/oi", async (c) => {
  const q = validateQueries(c, DerivativesOiQuerySchema);
  if (!q.success) return q.error;
  const { limit } = q.data;

  try {
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
  } catch (err) {
    return ApiError.upstream(c, "coinglass", extractErrorMessage(err));
  }
});

// ─── GET /api/derivatives/oi/:symbol ─────────────────────────

/**
 * @openapi
 * /api/derivatives/oi/{symbol}:
 *   get:
 *     summary: Open interest breakdown by exchange for a symbol
 *     tags: [Derivatives]
 *     parameters:
 *       - in: path
 *         name: symbol
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Per-exchange OI breakdown
 *       400:
 *         description: Invalid symbol parameter
 *       502:
 *         description: Upstream CoinGlass error
 */
derivativesRoutes.get("/oi/:symbol", async (c) => {
  const pv = validateParam(c, "symbol", SymbolParamSchema);
  if (!pv.success) return pv.error;
  const symbol = pv.data.toUpperCase();

  try {
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
  } catch (err) {
    return ApiError.upstream(c, "coinglass", extractErrorMessage(err));
  }
});

// ─── GET /api/derivatives/liquidations ───────────────────────

/**
 * @openapi
 * /api/derivatives/liquidations:
 *   get:
 *     summary: Liquidation data across symbols
 *     tags: [Derivatives]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *           maximum: 200
 *     responses:
 *       200:
 *         description: Sorted liquidation data
 *       400:
 *         description: Invalid query parameters
 *       502:
 *         description: Upstream CoinGlass error
 */
derivativesRoutes.get("/liquidations", async (c) => {
  const q = validateQueries(c, DerivativesLiquidationsQuerySchema);
  if (!q.success) return q.error;
  const { limit } = q.data;

  try {
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
  } catch (err) {
    return ApiError.upstream(c, "coinglass", extractErrorMessage(err));
  }
});

// ─── GET /api/derivatives/long-short/:symbol ─────────────────

/**
 * @openapi
 * /api/derivatives/long-short/{symbol}:
 *   get:
 *     summary: Long/short ratio history for a symbol
 *     tags: [Derivatives]
 *     parameters:
 *       - in: path
 *         name: symbol
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: interval
 *         schema:
 *           type: string
 *           default: h1
 *     responses:
 *       200:
 *         description: Long/short ratio timeseries
 *       400:
 *         description: Invalid symbol or query parameters
 *       502:
 *         description: Upstream CoinGlass error
 */
derivativesRoutes.get("/long-short/:symbol", async (c) => {
  const pv = validateParam(c, "symbol", SymbolParamSchema);
  if (!pv.success) return pv.error;
  const symbol = pv.data.toUpperCase();

  const q = validateQueries(c, DerivativesLongShortQuerySchema);
  if (!q.success) return q.error;
  const { interval } = q.data;

  try {
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
  } catch (err) {
    return ApiError.upstream(c, "coinglass", extractErrorMessage(err));
  }
});
