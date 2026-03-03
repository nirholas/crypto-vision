/**
 * Crypto Vision — Token Unlocks & Emissions Routes
 *
 * Token vesting schedules, upcoming unlocks, and emission data from DeFi Llama.
 *
 * GET /api/unlocks/upcoming            — Upcoming token unlocks (?days=30)
 * GET /api/unlocks/protocols           — All protocols with emission data
 * GET /api/unlocks/protocol/:name      — Emission schedule for a protocol
 * GET /api/unlocks/supply/:name        — Protocol supply breakdown
 * GET /api/unlocks/tracked             — Tracked major protocol emissions
 *
 * @copyright 2024-2026 nirholas. All rights reserved.
 */

import { Hono } from "hono";
import * as unlocks from "../sources/unlocks.js";

export const unlocksRoutes = new Hono();

unlocksRoutes.get("/upcoming", async (c) => {
  const days = Math.min(Number(c.req.query("days")) || 30, 365);
  const data = await unlocks.getUpcomingUnlocks(days);
  return c.json(data);
});

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
  return c.json({ count: Array.isArray(data) ? data.length : 0, data });
});
