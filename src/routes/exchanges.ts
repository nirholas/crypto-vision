/**
 * Crypto Vision — Exchanges Route
 *
 * Extended exchange data: CoinCap exchanges, markets, rates.
 * Also: Bybit insurance fund, Deribit index prices.
 *
 * GET /api/exchanges/list                — Ranked list of exchanges (CoinCap)
 * GET /api/exchanges/:id                 — Single exchange detail
 * GET /api/exchanges/:id/markets         — Markets on an exchange
 * GET /api/exchanges/rates               — Conversion rates
 * GET /api/exchanges/rates/:id           — Single rate
 * GET /api/exchanges/bybit/insurance     — Bybit insurance fund history
 * GET /api/exchanges/bybit/risk-limit    — Bybit risk limits for a symbol
 * GET /api/exchanges/deribit/index       — Deribit index prices
 * GET /api/exchanges/coincap/candles     — CoinCap candles for exchange
 */

import { Hono } from "hono";
import * as coincap from "../sources/coincap.js";
import * as bybit from "../sources/bybit.js";
import * as deribit from "../sources/deribit.js";

export const exchangesRoutes = new Hono();

exchangesRoutes.get("/list", async (c) => {
  const { data } = await coincap.getExchanges();
  return c.json({ count: data.length, data });
});

exchangesRoutes.get("/rates", async (c) => {
  const { data } = await coincap.getRates();
  return c.json({ count: data.length, data });
});

exchangesRoutes.get("/rates/:id", async (c) => {
  const id = c.req.param("id");
  const data = await coincap.getRate(id);
  return c.json(data);
});

exchangesRoutes.get("/bybit/insurance", async (c) => {
  const coin = c.req.query("coin") || "BTC";
  const data = await bybit.getInsuranceFund(coin);
  return c.json(data);
});

exchangesRoutes.get("/bybit/risk-limit", async (c) => {
  const symbol = c.req.query("symbol") || "BTCUSDT";
  const data = await bybit.getRiskLimit(symbol);
  return c.json(data);
});

exchangesRoutes.get("/deribit/index", async (c) => {
  const currency = c.req.query("currency") || "BTC";
  const data = await deribit.getIndexPrice(currency);
  return c.json(data);
});

exchangesRoutes.get("/coincap/candles", async (c) => {
  const exchangeId = c.req.query("exchange") || "binance";
  const baseId = c.req.query("base") || "bitcoin";
  const quoteId = c.req.query("quote") || "tether";
  const interval = c.req.query("interval") || "h1";
  const data = await coincap.getCandles(exchangeId, baseId, quoteId, interval);
  return c.json({ exchange: exchangeId, base: baseId, quote: quoteId, interval, data });
});

exchangesRoutes.get("/:id/markets", async (c) => {
  const id = c.req.param("id");
  const { data } = await coincap.getMarkets(id);
  return c.json({ exchange: id, count: data.length, data });
});

exchangesRoutes.get("/:id", async (c) => {
  const id = c.req.param("id");
  const data = await coincap.getExchange(id);
  return c.json(data);
});
