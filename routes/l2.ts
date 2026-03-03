/**
 * Crypto Vision — Layer 2 Routes
 *
 * L2 analytics via L2Beat (free, no key).
 *
 * GET /api/l2/summary    — All L2 projects with TVL
 * GET /api/l2/tvl        — TVL breakdown (canonical, external, native)
 * GET /api/l2/activity   — Transaction activity / TPS across L2s
 */

import { Hono } from "hono";
import * as l2 from "../sources/l2beat.js";

export const l2Routes = new Hono();

// ─── GET /api/l2/summary ─────────────────────────────────────

l2Routes.get("/summary", async (c) => {
  const { projects } = await l2.getScalingSummary();

  const list = Object.values(projects)
    .filter((p) => p.tvl && p.tvl.value > 0)
    .sort((a, b) => (b.tvl?.value || 0) - (a.tvl?.value || 0))
    .map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      category: p.category,
      provider: p.provider || null,
      purposes: p.purposes,
      stage: p.stage?.stage || null,
      tvl: p.tvl?.value || 0,
      tvlDisplay: p.tvl?.displayValue || "0",
      tvlChange7d: p.tvl?.change || 0,
    }));

  return c.json({
    data: list,
    count: list.length,
    totalTvl: list.reduce((sum, p) => sum + p.tvl, 0),
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/l2/tvl ─────────────────────────────────────────

l2Routes.get("/tvl", async (c) => {
  const limit = Math.min(Number(c.req.query("limit") || 20), 100);
  const { projects } = await l2.getScalingTvl();

  const list = Object.entries(projects)
    .map(([id, p]) => {
      const latest = p.charts?.daily?.data?.slice(-1)[0];
      return {
        id,
        canonical: latest?.[1] || 0,
        external: latest?.[2] || 0,
        native: latest?.[3] || 0,
        total: (latest?.[1] || 0) + (latest?.[2] || 0) + (latest?.[3] || 0),
        historyDays30: (p.charts?.daily?.data || []).slice(-30).map(([ts, c, e, n]) => ({
          timestamp: ts,
          canonical: c,
          external: e,
          native: n,
          total: c + e + n,
        })),
      };
    })
    .filter((p) => p.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);

  return c.json({
    data: list,
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/l2/activity ────────────────────────────────────

l2Routes.get("/activity", async (c) => {
  const limit = Math.min(Number(c.req.query("limit") || 20), 100);
  const { projects } = await l2.getScalingActivity();

  const list = Object.entries(projects)
    .map(([id, p]) => {
      const latest = p.daily?.data?.slice(-1)[0];
      return {
        id,
        txCount24h: latest?.[1] || 0,
        uopsCount24h: latest?.[2] || 0,
        historyDays7: (p.daily?.data || []).slice(-7).map(([ts, tx, uops]) => ({
          timestamp: ts,
          txCount: tx,
          uopsCount: uops,
        })),
      };
    })
    .filter((p) => p.txCount24h > 0)
    .sort((a, b) => b.txCount24h - a.txCount24h)
    .slice(0, limit);

  return c.json({
    data: list,
    timestamp: new Date().toISOString(),
  });
});
