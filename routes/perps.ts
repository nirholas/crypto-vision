/**
 * Crypto Vision — Perpetual / Cross-Exchange Route
 *
 * Cross-exchange perpetual futures data from Bybit, OKX, Hyperliquid, dYdX, Deribit.
 *
 * GET /api/perps/overview         — Multi-exchange perp overview
 * GET /api/perps/funding           — Cross-exchange funding rates
 * GET /api/perps/funding/:symbol   — Funding rate for one asset across exchanges
 * GET /api/perps/oi                — Open interest overview
 * GET /api/perps/oi/:symbol        — OI for one asset across exchanges
 * GET /api/perps/markets           — All perp markets (Hyperliquid)
 * GET /api/perps/markets/dydx      — dYdX markets
 * GET /api/perps/markets/bybit     — Bybit linear markets
 * GET /api/perps/markets/okx       — OKX swap markets
 * GET /api/perps/orderbook/:exchange/:symbol — Orderbook
 * GET /api/perps/trades/:exchange/:symbol    — Recent trades
 * GET /api/perps/klines/:exchange/:symbol    — Klines
 * GET /api/perps/dydx/sparklines   — dYdX sparklines
 */

import { Hono } from "hono";
import * as bybit from "../sources/bybit.js";
import * as okx from "../sources/okx.js";
import * as hl from "../sources/hyperliquid.js";
import * as dydx from "../sources/dydx.js";
import * as deribit from "../sources/deribit.js";

export const perpsRoutes = new Hono();

// ─── Overview ────────────────────────────────────────────────

perpsRoutes.get("/overview", async (c) => {
  const [bybitTickers, okxSwaps, hlData, dydxMarkets] = await Promise.all([
    bybit.getLinearTickers().catch(() => []),
    okx.getSwapTickers().catch(() => []),
    hl.getMetaAndAssetCtxs().catch(() => null),
    dydx.getMarkets().catch(() => ({ markets: {} })),
  ]);

  return c.json({
    bybit: { count: bybitTickers.length, tickers: bybitTickers.slice(0, 20) },
    okx: { count: okxSwaps.length, tickers: okxSwaps.slice(0, 20) },
    hyperliquid: hlData ? {
      count: hlData[0].universe.length,
      markets: hlData[0].universe.map((u, i) => ({
        ...u,
        ...hlData[1][i],
      })).slice(0, 20),
    } : null,
    dydx: {
      count: Object.keys(dydxMarkets.markets).length,
      markets: Object.values(dydxMarkets.markets).slice(0, 20),
    },
    timestamp: new Date().toISOString(),
  });
});

// ─── Cross-Exchange Funding Rates ────────────────────────────

perpsRoutes.get("/funding", async (c) => {
  const [bybitTickers, okxSwaps, hlData] = await Promise.all([
    bybit.getLinearTickers().catch(() => []),
    okx.getSwapTickers().catch(() => []),
    hl.getMetaAndAssetCtxs().catch(() => null),
  ]);

  const rates: Array<{
    symbol: string;
    bybit?: string;
    okx?: string;
    hyperliquid?: string;
  }> = [];

  // Collect unique symbols
  const symbols = new Set<string>();
  bybitTickers.forEach((t) => symbols.add(t.symbol.replace("USDT", "")));

  for (const sym of symbols) {
    const bt = bybitTickers.find((t) => t.symbol === `${sym}USDT`);
    const ot = okxSwaps.find((t) => t.instId === `${sym}-USDT-SWAP`);
    const hlIdx = hlData?.[0].universe.findIndex((u) => u.name === sym);
    const hlCtx = hlIdx !== undefined && hlIdx >= 0 ? hlData?.[1][hlIdx] : null;

    if (bt || ot || hlCtx) {
      rates.push({
        symbol: sym,
        bybit: bt?.fundingRate || undefined,
        okx: ot ? undefined : undefined, // OKX ticker doesn't include funding
        hyperliquid: hlCtx?.funding || undefined,
      });
    }
  }

  // Sort by absolute funding rate (most extreme first)
  rates.sort((a, b) => {
    const aRate = Math.abs(Number(a.bybit || a.hyperliquid || 0));
    const bRate = Math.abs(Number(b.bybit || b.hyperliquid || 0));
    return bRate - aRate;
  });

  return c.json({ data: rates.slice(0, 50), timestamp: new Date().toISOString() });
});

// ─── Funding Rate per Symbol ─────────────────────────────────

perpsRoutes.get("/funding/:symbol", async (c) => {
  const sym = c.req.param("symbol").toUpperCase();

  const [bybitFunding, okxFunding, hlFunding, dydxFunding] = await Promise.all([
    bybit.getFundingHistory(`${sym}USDT`).catch(() => []),
    okx.getFundingHistory(`${sym}-USDT-SWAP`).catch(() => []),
    hl.getFundingHistory(sym).catch(() => []),
    dydx.getFundingRates(`${sym}-USD`).catch(() => ({ historicalFunding: [] })),
  ]);

  return c.json({
    symbol: sym,
    bybit: bybitFunding,
    okx: okxFunding,
    hyperliquid: hlFunding,
    dydx: dydxFunding.historicalFunding,
    timestamp: new Date().toISOString(),
  });
});

// ─── Open Interest ───────────────────────────────────────────

perpsRoutes.get("/oi", async (c) => {
  const [bybitTickers, okxOI] = await Promise.all([
    bybit.getLinearTickers().catch(() => []),
    okx.getOpenInterest().catch(() => []),
  ]);

  const bybitOI = bybitTickers
    .filter((t) => Number(t.openInterestValue) > 0)
    .sort((a, b) => Number(b.openInterestValue) - Number(a.openInterestValue))
    .slice(0, 50)
    .map((t) => ({
      symbol: t.symbol,
      openInterest: t.openInterest,
      openInterestValue: t.openInterestValue,
    }));

  return c.json({
    bybit: bybitOI,
    okx: okxOI.slice(0, 50),
    timestamp: new Date().toISOString(),
  });
});

perpsRoutes.get("/oi/:symbol", async (c) => {
  const sym = c.req.param("symbol").toUpperCase();

  const [bybitOI, okxOI, dydxMarket] = await Promise.all([
    bybit.getOpenInterest(`${sym}USDT`).catch(() => []),
    okx.getOpenInterest().catch(() => []),
    dydx.getMarket(`${sym}-USD`).catch(() => null),
  ]);

  return c.json({
    symbol: sym,
    bybit: bybitOI,
    okx: okxOI.filter((o) => o.instId.startsWith(sym)),
    dydx: dydxMarket ? { openInterest: dydxMarket.openInterest } : null,
    timestamp: new Date().toISOString(),
  });
});

// ─── Markets by Exchange ─────────────────────────────────────

perpsRoutes.get("/markets", async (c) => {
  const data = await hl.getMetaAndAssetCtxs();
  const markets = data[0].universe.map((u, i) => ({
    ...u,
    ...data[1][i],
  }));
  return c.json({ exchange: "hyperliquid", count: markets.length, data: markets });
});

perpsRoutes.get("/markets/dydx", async (c) => {
  const data = await dydx.getMarkets();
  return c.json({
    exchange: "dydx",
    count: Object.keys(data.markets).length,
    data: Object.values(data.markets),
  });
});

perpsRoutes.get("/markets/bybit", async (c) => {
  const data = await bybit.getLinearTickers();
  return c.json({ exchange: "bybit", count: data.length, data });
});

perpsRoutes.get("/markets/okx", async (c) => {
  const data = await okx.getSwapTickers();
  return c.json({ exchange: "okx", count: data.length, data });
});

// ─── Orderbook ───────────────────────────────────────────────

perpsRoutes.get("/orderbook/:exchange/:symbol", async (c) => {
  const exchange = c.req.param("exchange").toLowerCase();
  const symbol = c.req.param("symbol").toUpperCase();

  let data: any;
  switch (exchange) {
    case "bybit":
      data = await bybit.getOrderbook(`${symbol}USDT`);
      break;
    case "okx":
      data = await okx.getOrderbook(`${symbol}-USDT-SWAP`);
      break;
    case "dydx":
      data = await dydx.getOrderbook(`${symbol}-USD`);
      break;
    case "deribit":
      data = await deribit.getOrderbook(`${symbol}-PERPETUAL`);
      break;
    default:
      return c.json({ error: "Unknown exchange. Use: bybit, okx, dydx, deribit" }, 400);
  }

  return c.json({ exchange, symbol, data });
});

// ─── Trades ──────────────────────────────────────────────────

perpsRoutes.get("/trades/:exchange/:symbol", async (c) => {
  const exchange = c.req.param("exchange").toLowerCase();
  const symbol = c.req.param("symbol").toUpperCase();

  let data: any;
  switch (exchange) {
    case "bybit":
      data = await bybit.getRecentTrades(`${symbol}USDT`);
      break;
    case "dydx": {
      const res = await dydx.getTrades(`${symbol}-USD`);
      data = res.trades;
      break;
    }
    case "hyperliquid":
      data = await hl.getRecentTrades(symbol);
      break;
    default:
      return c.json({ error: "Unknown exchange. Use: bybit, dydx, hyperliquid" }, 400);
  }

  return c.json({ exchange, symbol, data });
});

// ─── Klines ──────────────────────────────────────────────────

perpsRoutes.get("/klines/:exchange/:symbol", async (c) => {
  const exchange = c.req.param("exchange").toLowerCase();
  const symbol = c.req.param("symbol").toUpperCase();
  const interval = c.req.query("interval") || "60";
  const limit = Number(c.req.query("limit") || "100");

  let data: any;
  switch (exchange) {
    case "bybit":
      data = await bybit.getKlines(`${symbol}USDT`, interval, limit);
      break;
    case "okx":
      data = await okx.getCandles(`${symbol}-USDT-SWAP`, interval, limit);
      break;
    case "dydx": {
      const res = await dydx.getCandles(`${symbol}-USD`, interval === "60" ? "1HOUR" : "1DAY", limit);
      data = res.candles;
      break;
    }
    default:
      return c.json({ error: "Unknown exchange. Use: bybit, okx, dydx" }, 400);
  }

  return c.json({ exchange, symbol, interval, data });
});

// ─── Options (Deribit) ───────────────────────────────────────

perpsRoutes.get("/options/:currency", async (c) => {
  const currency = c.req.param("currency").toUpperCase();
  const [instruments, bookSummary, vol] = await Promise.all([
    deribit.getInstruments(currency, "option").catch(() => []),
    deribit.getBookSummary(currency, "option").catch(() => []),
    deribit.getVolatilityIndex(currency).catch(() => null),
  ]);

  return c.json({
    currency,
    totalInstruments: instruments.length,
    bookSummary: bookSummary.slice(0, 50),
    volatilityIndex: vol,
    timestamp: new Date().toISOString(),
  });
});

perpsRoutes.get("/volatility/:currency", async (c) => {
  const currency = c.req.param("currency").toUpperCase();
  const [vol, hvol] = await Promise.all([
    deribit.getVolatilityIndex(currency),
    deribit.getHistoricalVolatility(currency),
  ]);

  return c.json({
    currency,
    impliedVolatility: vol,
    historicalVolatility: hvol,
    timestamp: new Date().toISOString(),
  });
});

// ─── dYdX Sparklines ────────────────────────────────────────

perpsRoutes.get("/dydx/sparklines", async (c) => {
  const period = c.req.query("period") || "ONE_DAY";
  const data = await dydx.getSparklines(period);
  return c.json({ data, period });
});

// ─── Hyperliquid user position ──────────────────────────────

perpsRoutes.get("/hl/user/:address", async (c) => {
  const address = c.req.param("address");
  const [state, orders] = await Promise.all([
    hl.getUserState(address),
    hl.getOpenOrders(address),
  ]);
  return c.json({ state, orders });
});
