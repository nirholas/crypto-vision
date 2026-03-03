/**
 * Crypto Vision — Calendar / Events Routes
 *
 * Crypto event data from CoinMarketCal and CoinPaprika.
 *
 * GET /api/calendar/events             — Upcoming hot crypto events
 * GET /api/calendar/coin/:symbol       — Events for a specific coin
 * GET /api/calendar/categories         — Event categories
 * GET /api/calendar/category/:id       — Events by category
 * GET /api/calendar/coins              — Coins with upcoming events
 * GET /api/calendar/paprika/:coinId    — CoinPaprika events for a coin
 * GET /api/calendar/aggregate          — Aggregated events from all sources
 *
 * @copyright 2024-2026 nirholas. All rights reserved.
 */

import { Hono } from "hono";
import * as cal from "../sources/calendar.js";

export const calendarRoutes = new Hono();

calendarRoutes.get("/events", async (c) => {
  const page = Number(c.req.query("page")) || 1;
  const max = Math.min(Number(c.req.query("max")) || 50, 100);
  const sortBy = c.req.query("sortBy") || "hot_events";
  const data = await cal.getEvents(page, max, sortBy);
  return c.json(data);
});

calendarRoutes.get("/coin/:symbol", async (c) => {
  const symbol = c.req.param("symbol");
  const page = Number(c.req.query("page")) || 1;
  const max = Math.min(Number(c.req.query("max")) || 25, 100);
  const data = await cal.getCoinEvents(symbol, page, max);
  return c.json(data);
});

calendarRoutes.get("/categories", async (c) => {
  const data = await cal.getCategories();
  return c.json(data);
});

calendarRoutes.get("/category/:id", async (c) => {
  const id = Number(c.req.param("id"));
  if (isNaN(id)) return c.json({ error: "Category ID must be a number" }, 400);
  const page = Number(c.req.query("page")) || 1;
  const max = Math.min(Number(c.req.query("max")) || 25, 100);
  const data = await cal.getEventsByCategory(id, page, max);
  return c.json(data);
});

calendarRoutes.get("/coins", async (c) => {
  const data = await cal.getCoinsWithEvents();
  return c.json(data);
});

calendarRoutes.get("/paprika/:coinId", async (c) => {
  const coinId = c.req.param("coinId");
  const data = await cal.getPaprikaEvents(coinId);
  return c.json({ count: Array.isArray(data) ? data.length : 0, data });
});

calendarRoutes.get("/aggregate", async (c) => {
  const days = Number(c.req.query("days")) || 30;
  const data = await cal.getAggregatedCalendar(days);
  return c.json(data);
});
