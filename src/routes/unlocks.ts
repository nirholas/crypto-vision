/**
 * Crypto Vision — Token Unlocks & Emissions Routes
 *
 * Token vesting schedules, upcoming unlocks, impact analysis, and emission data.
 *
 * GET /api/unlocks/upcoming            — Upcoming token unlocks (?days=30)
 * GET /api/unlocks/token/:symbol       — Unlock schedule for token
 * GET /api/unlocks/calendar            — Calendar view of unlocks
 * GET /api/unlocks/large               — Large unlocks (>$10M)
 * GET /api/unlocks/impact/:symbol      — Unlock price impact analysis
 * GET /api/unlocks/cliff               — Upcoming cliff unlocks
 * GET /api/unlocks/vesting/:symbol     — Full vesting schedule
 * GET /api/unlocks/protocols           — All protocols with emission data
 * GET /api/unlocks/protocol/:name      — Emission schedule for a protocol
 * GET /api/unlocks/supply/:name        — Protocol supply breakdown
 * GET /api/unlocks/tracked             — Tracked major protocol emissions
 *
 * @copyright 2024-2026 nirholas. All rights reserved.
 */

import { Hono } from "hono";
import { ApiError } from "../lib/api-error.js";
import * as unlocks from "../sources/unlocks.js";

export const unlocksRoutes = new Hono();

// ─── GET /api/unlocks/upcoming ───────────────────────────────

unlocksRoutes.get("/upcoming", async (c) => {
  const days = Math.min(Math.max(Number(c.req.query("days")) || 30, 1), 365);
  const data = await unlocks.getUpcomingUnlocks(days);
  return c.json({
    ...data,
    days,
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/unlocks/token/:symbol ──────────────────────────

unlocksRoutes.get("/token/:symbol", async (c) => {
  const symbol = c.req.param("symbol");
  const data = await unlocks.getTokenUnlocks(symbol);

  if (!data) {
    throw new ApiError({
      code: "NOT_FOUND",
      message: `No unlock data found for token: ${symbol}`,
    });
  }

  return c.json({
    data,
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/unlocks/calendar ───────────────────────────────

unlocksRoutes.get("/calendar", async (c) => {
  const days = Math.min(Math.max(Number(c.req.query("days")) || 90, 1), 365);
  const data = await unlocks.getUnlockCalendar(days);

  return c.json({
    ...data,
    days,
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/unlocks/large ──────────────────────────────────

unlocksRoutes.get("/large", async (c) => {
  const threshold = Math.max(Number(c.req.query("threshold")) || 10_000_000, 100_000);
  const days = Math.min(Math.max(Number(c.req.query("days")) || 90, 1), 365);
  const data = await unlocks.getLargeUnlocks(threshold, days);

  return c.json({
    ...data,
    thresholdUsd: threshold,
    days,
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/unlocks/impact/:symbol ─────────────────────────

unlocksRoutes.get("/impact/:symbol", async (c) => {
  const symbol = c.req.param("symbol");
  const data = await unlocks.getUnlockImpact(symbol);

  return c.json({
    data,
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/unlocks/cliff ──────────────────────────────────

unlocksRoutes.get("/cliff", async (c) => {
  const days = Math.min(Math.max(Number(c.req.query("days")) || 90, 1), 365);
  const data = await unlocks.getCliffUnlocks(days);

  return c.json({
    ...data,
    days,
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/unlocks/vesting/:symbol ────────────────────────

unlocksRoutes.get("/vesting/:symbol", async (c) => {
  const symbol = c.req.param("symbol");
  const data = await unlocks.getVestingSchedule(symbol);

  if (!data) {
    throw new ApiError({
      code: "NOT_FOUND",
      message: `No vesting schedule found for token: ${symbol}`,
    });
  }

  return c.json({
    data,
    timestamp: new Date().toISOString(),
  });
});

// ─── Legacy / Protocol-level endpoints ───────────────────────

unlocksRoutes.get("/protocols", async (c) => {
  const data = await unlocks.getEmissionsProtocols();
  return c.json({ count: Array.isArray(data) ? data.length : 0, data });
});

unlocksRoutes.get("/protocol/:name", async (c) => {
  const name = c.req.param("name");
  const data = await unlocks.getProtocolEmissions(name);
  return c.json(data);
});

unlocksRoutes.get("/supply/:name", async (c) => {
  const name = c.req.param("name");
  const data = await unlocks.getProtocolSupply(name);
  return c.json(data);
});

unlocksRoutes.get("/tracked", async (c) => {
  const data = await unlocks.getTrackedEmissions();
  return c.json({ count: data.length, data, timestamp: new Date().toISOString() });
});
