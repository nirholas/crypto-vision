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
import { z } from "zod";
import * as cal from "../sources/calendar.js";
import { ApiError, extractErrorMessage } from "../lib/api-error.js";
import { validateQueries, validateParam } from "../lib/validation.js";
import {
  CalendarEventsQuerySchema,
  CalendarCoinQuerySchema,
  CalendarCategoryQuerySchema,
  CalendarAggregateQuerySchema,
} from "../lib/route-schemas.js";

export const calendarRoutes = new Hono();

/** Short param schema reused for :symbol, :coinId, :id */
const SlugParamSchema = z.string().min(1).max(64);

/**
 * @openapi
 * /api/calendar/events:
 *   get:
 *     summary: Upcoming hot crypto events
 *     tags: [Calendar]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: max
 *         schema: { type: integer, default: 50, maximum: 100 }
 *       - in: query
 *         name: sortBy
 *         schema: { type: string, default: hot_events }
 *     responses:
 *       200: { description: List of upcoming crypto events }
 *       502: { description: Upstream calendar service error }
 */
calendarRoutes.get("/events", async (c) => {
  const q = validateQueries(c, CalendarEventsQuerySchema);
  if (!q.success) return q.error;
  const { page, max, sortBy } = q.data;

  try {
    const data = await cal.getEvents(page, max, sortBy);
    return c.json({ ...data, timestamp: new Date().toISOString() });
  } catch (err: unknown) {
    const message = extractErrorMessage(err);
    return ApiError.upstream(c, "coinmarketcal", message);
  }
});

/**
 * @openapi
 * /api/calendar/coin/{symbol}:
 *   get:
 *     summary: Events for a specific coin
 *     tags: [Calendar]
 *     parameters:
 *       - in: path
 *         name: symbol
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: max
 *         schema: { type: integer, default: 25, maximum: 100 }
 *     responses:
 *       200: { description: Events for the specified coin }
 *       400: { description: Invalid symbol }
 *       502: { description: Upstream calendar service error }
 */
calendarRoutes.get("/coin/:symbol", async (c) => {
  const p = validateParam(c, "symbol", SlugParamSchema);
  if (!p.success) return p.error;
  const symbol = p.data;

  const q = validateQueries(c, CalendarCoinQuerySchema);
  if (!q.success) return q.error;
  const { page, max } = q.data;

  try {
    const data = await cal.getCoinEvents(symbol, page, max);
    return c.json({ ...data, timestamp: new Date().toISOString() });
  } catch (err: unknown) {
    const message = extractErrorMessage(err);
    return ApiError.upstream(c, "coinmarketcal", message);
  }
});

/**
 * @openapi
 * /api/calendar/categories:
 *   get:
 *     summary: Event categories
 *     tags: [Calendar]
 *     responses:
 *       200: { description: List of event categories }
 *       502: { description: Upstream calendar service error }
 */
calendarRoutes.get("/categories", async (c) => {
  try {
    const data = await cal.getCategories();
    return c.json({ ...data, timestamp: new Date().toISOString() });
  } catch (err: unknown) {
    const message = extractErrorMessage(err);
    return ApiError.upstream(c, "coinmarketcal", message);
  }
});

/**
 * @openapi
 * /api/calendar/category/{id}:
 *   get:
 *     summary: Events by category
 *     tags: [Calendar]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: max
 *         schema: { type: integer, default: 25, maximum: 100 }
 *     responses:
 *       200: { description: Events in the specified category }
 *       400: { description: Invalid category ID }
 *       502: { description: Upstream calendar service error }
 */
calendarRoutes.get("/category/:id", async (c) => {
  const p = validateParam(c, "id", SlugParamSchema);
  if (!p.success) return p.error;
  const id = Number(p.data);
  if (isNaN(id)) return ApiError.badRequest(c, "Category ID must be a number");

  const q = validateQueries(c, CalendarCategoryQuerySchema);
  if (!q.success) return q.error;
  const { page, max } = q.data;

  try {
    const data = await cal.getEventsByCategory(id, page, max);
    return c.json({ ...data, timestamp: new Date().toISOString() });
  } catch (err: unknown) {
    const message = extractErrorMessage(err);
    return ApiError.upstream(c, "coinmarketcal", message);
  }
});

/**
 * @openapi
 * /api/calendar/coins:
 *   get:
 *     summary: Coins with upcoming events
 *     tags: [Calendar]
 *     responses:
 *       200: { description: List of coins that have upcoming events }
 *       502: { description: Upstream calendar service error }
 */
calendarRoutes.get("/coins", async (c) => {
  try {
    const data = await cal.getCoinsWithEvents();
    return c.json({ ...data, timestamp: new Date().toISOString() });
  } catch (err: unknown) {
    const message = extractErrorMessage(err);
    return ApiError.upstream(c, "coinmarketcal", message);
  }
});

/**
 * @openapi
 * /api/calendar/paprika/{coinId}:
 *   get:
 *     summary: CoinPaprika events for a coin
 *     tags: [Calendar]
 *     parameters:
 *       - in: path
 *         name: coinId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Events from CoinPaprika for the specified coin }
 *       400: { description: Invalid coinId }
 *       502: { description: Upstream CoinPaprika service error }
 */
calendarRoutes.get("/paprika/:coinId", async (c) => {
  const p = validateParam(c, "coinId", SlugParamSchema);
  if (!p.success) return p.error;
  const coinId = p.data;

  try {
    const data = await cal.getPaprikaEvents(coinId);
    return c.json({
      count: Array.isArray(data) ? data.length : 0,
      data,
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const message = extractErrorMessage(err);
    return ApiError.upstream(c, "coinpaprika", message);
  }
});

/**
 * @openapi
 * /api/calendar/aggregate:
 *   get:
 *     summary: Aggregated events from all sources
 *     tags: [Calendar]
 *     parameters:
 *       - in: query
 *         name: days
 *         schema: { type: integer, default: 30, maximum: 365 }
 *     responses:
 *       200: { description: Aggregated calendar events }
 *       500: { description: Internal server error }
 */
calendarRoutes.get("/aggregate", async (c) => {
  const q = validateQueries(c, CalendarAggregateQuerySchema);
  if (!q.success) return q.error;
  const { days } = q.data;

  try {
    const data = await cal.getAggregatedCalendar(days);
    return c.json({ ...data, timestamp: new Date().toISOString() });
  } catch (err: unknown) {
    const message = extractErrorMessage(err);
    return ApiError.internal(c, "Failed to aggregate calendar data", message);
  }
});
