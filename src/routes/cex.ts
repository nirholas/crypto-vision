/**
 * Crypto Vision — CEX (Centralized Exchange) Routes
 *
 * Live market data from Binance public API (no key required).
 *
 * GET /api/cex/tickers          — All 24h tickers (or filter by quote asset)
 * GET /api/cex/ticker/:symbol   — 24h ticker for a symbol (e.g. BTCUSDT)
 * GET /api/cex/price/:symbol    — Current price for a symbol
 * GET /api/cex/prices           — All current prices
 * GET /api/cex/orderbook/:symbol — Order book depth
 * GET /api/cex/trades/:symbol    — Recent trades
 * GET /api/cex/klines/:symbol    — Candlestick/kline data
 * GET /api/cex/pairs             — Available trading pairs
 * GET /api/cex/book-ticker       — Best bid/ask for all pairs
 */

import { Hono } from "hono";
import * as binance from "../sources/binance.js";

export const cexRoutes = new Hono();

// ─── GET /api/cex/tickers ────────────────────────────────────

cexRoutes.get("/tickers", async (c) => {
  const quote = c.req.query("quote")?.toUpperCase(); // e.g. USDT, BTC, ETH
  const limit = Math.min(Number(c.req.query("limit") || 100), 500);

  const data = (await binance.getTicker24h()) as binance.Ticker24h[];

  let tickers = data;
  if (quote) {
    tickers = tickers.filter((t) => t.symbol.endsWith(quote));
  }

  // Sort by quote volume descending
  tickers.sort(
    (a, b) => Number(b.quoteVolume) - Number(a.quoteVolume)
  );

  return c.json({
    data: tickers.slice(0, limit).map((t) => ({
      symbol: t.symbol,
      price: Number(t.lastPrice),
      change: Number(t.priceChange),
      changePercent: Number(t.priceChangePercent),
      high: Number(t.highPrice),
      low: Number(t.lowPrice),
      volume: Number(t.volume),
      quoteVolume: Number(t.quoteVolume),
      trades: t.count,
    })),
    count: Math.min(tickers.length, limit),
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/cex/ticker/:symbol ─────────────────────────────

cexRoutes.get("/ticker/:symbol", async (c) => {
  const symbol = c.req.param("symbol").toUpperCase();

  try {
    const t = (await binance.getTicker24h(symbol)) as binance.Ticker24h;
    return c.json({
      data: {
        symbol: t.symbol,
        price: Number(t.lastPrice),
        change: Number(t.priceChange),
        changePercent: Number(t.priceChangePercent),
        weightedAvgPrice: Number(t.weightedAvgPrice),
        high: Number(t.highPrice),
        low: Number(t.lowPrice),
        open: Number(t.openPrice),
        volume: Number(t.volume),
        quoteVolume: Number(t.quoteVolume),
        trades: t.count,
        bid: Number(t.bidPrice),
        ask: Number(t.askPrice),
      },
      timestamp: new Date().toISOString(),
    });
  } catch {
    return c.json({ error: `Symbol '${symbol}' not found` }, 404);
  }
});

// ─── GET /api/cex/price/:symbol ──────────────────────────────

cexRoutes.get("/price/:symbol", async (c) => {
  const symbol = c.req.param("symbol").toUpperCase();

  try {
    const data = (await binance.getTickerPrice(symbol)) as binance.TickerPrice;
    return c.json({
      data: { symbol: data.symbol, price: Number(data.price) },
      timestamp: new Date().toISOString(),
    });
  } catch {
    return c.json({ error: `Symbol '${symbol}' not found` }, 404);
  }
});

// ─── GET /api/cex/prices ─────────────────────────────────────

cexRoutes.get("/prices", async (c) => {
  const quote = c.req.query("quote")?.toUpperCase();
  const limit = Math.min(Number(c.req.query("limit") || 200), 2000);

  let prices = (await binance.getTickerPrice()) as binance.TickerPrice[];
  if (quote) {
    prices = prices.filter((p) => p.symbol.endsWith(quote));
  }

  return c.json({
    data: prices.slice(0, limit).map((p) => ({
      symbol: p.symbol,
      price: Number(p.price),
    })),
    count: Math.min(prices.length, limit),
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/cex/orderbook/:symbol ──────────────────────────

cexRoutes.get("/orderbook/:symbol", async (c) => {
  const symbol = c.req.param("symbol").toUpperCase();
  const limit = Math.min(Number(c.req.query("limit") || 20), 1000);

  const book = await binance.getOrderBook(symbol, limit);

  return c.json({
    data: {
      lastUpdateId: book.lastUpdateId,
      bids: book.bids.map(([price, qty]) => ({
        price: Number(price),
        quantity: Number(qty),
      })),
      asks: book.asks.map(([price, qty]) => ({
        price: Number(price),
        quantity: Number(qty),
      })),
    },
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/cex/trades/:symbol ─────────────────────────────

cexRoutes.get("/trades/:symbol", async (c) => {
  const symbol = c.req.param("symbol").toUpperCase();
  const limit = Math.min(Number(c.req.query("limit") || 50), 1000);

  const trades = await binance.getRecentTrades(symbol, limit);

  return c.json({
    data: trades.map((t) => ({
      id: t.id,
      price: Number(t.price),
      quantity: Number(t.qty),
      quoteQty: Number(t.quoteQty),
      time: new Date(t.time).toISOString(),
      isBuyerMaker: t.isBuyerMaker,
      side: t.isBuyerMaker ? "sell" : "buy",
    })),
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/cex/klines/:symbol ─────────────────────────────

cexRoutes.get("/klines/:symbol", async (c) => {
  const symbol = c.req.param("symbol").toUpperCase();
  const interval = c.req.query("interval") || "1h";
  const limit = Math.min(Number(c.req.query("limit") || 100), 1000);

  const klines = await binance.getKlines(symbol, interval, limit);

  return c.json({
    data: klines.map((k) => ({
      openTime: k[0],
      open: Number(k[1]),
      high: Number(k[2]),
      low: Number(k[3]),
      close: Number(k[4]),
      volume: Number(k[5]),
      closeTime: k[6],
      quoteVolume: Number(k[7]),
      trades: k[8],
    })),
    symbol,
    interval,
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/cex/pairs ──────────────────────────────────────

cexRoutes.get("/pairs", async (c) => {
  const quote = c.req.query("quote")?.toUpperCase();
  const status = c.req.query("status") || "TRADING";

  const info = await binance.getExchangeInfo();

  let symbols = info.symbols.filter((s) => s.status === status);
  if (quote) {
    symbols = symbols.filter((s) => s.quoteAsset === quote);
  }

  return c.json({
    data: symbols.map((s) => ({
      symbol: s.symbol,
      base: s.baseAsset,
      quote: s.quoteAsset,
      status: s.status,
    })),
    count: symbols.length,
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/cex/book-ticker ────────────────────────────────

cexRoutes.get("/book-ticker", async (c) => {
  const symbol = c.req.query("symbol")?.toUpperCase();

  if (symbol) {
    const data = (await binance.getBookTicker(symbol)) as binance.BookTicker;
    return c.json({
      data: {
        symbol: data.symbol,
        bidPrice: Number(data.bidPrice),
        bidQty: Number(data.bidQty),
        askPrice: Number(data.askPrice),
        askQty: Number(data.askQty),
        spread: Number(data.askPrice) - Number(data.bidPrice),
      },
      timestamp: new Date().toISOString(),
    });
  }

  const all = (await binance.getBookTicker()) as binance.BookTicker[];
  const quote = c.req.query("quote")?.toUpperCase();
  let filtered = quote ? all.filter((t) => t.symbol.endsWith(quote)) : all;
  filtered = filtered.slice(0, 200);

  return c.json({
    data: filtered.map((t) => ({
      symbol: t.symbol,
      bidPrice: Number(t.bidPrice),
      askPrice: Number(t.askPrice),
      spread: Number(t.askPrice) - Number(t.bidPrice),
    })),
    count: filtered.length,
    timestamp: new Date().toISOString(),
  });
});
