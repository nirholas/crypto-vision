/**
 * Crypto Vision — Advanced Analytics Routes
 *
 * GET /api/analytics/correlation — Cross-asset correlation matrix
 * GET /api/analytics/volatility  — Historical volatility rankings
 * GET /api/analytics/l2          — Layer 2 comparison data
 * GET /api/analytics/revenue     — Protocol revenue rankings
 */

import { Hono } from "hono";
import { cache } from "../lib/cache.js";
import * as cg from "../sources/coingecko.js";
import * as cc from "../sources/cryptocompare.js";
import * as l2beat from "../sources/l2beat.js";
import * as llama from "../sources/defillama.js";
import * as tt from "../sources/tokenterminal.js";

export const analyticsRoutes = new Hono();

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

/** Pearson correlation coefficient between two number arrays */
function pearson(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n < 2) return 0;

  let sumA = 0,
    sumB = 0,
    sumAB = 0,
    sumA2 = 0,
    sumB2 = 0;
  for (let i = 0; i < n; i++) {
    sumA += a[i];
    sumB += b[i];
    sumAB += a[i] * b[i];
    sumA2 += a[i] * a[i];
    sumB2 += b[i] * b[i];
  }

  const num = n * sumAB - sumA * sumB;
  const den = Math.sqrt((n * sumA2 - sumA * sumA) * (n * sumB2 - sumB * sumB));
  return den === 0 ? 0 : Math.round((num / den) * 10000) / 10000;
}

/** Annualized volatility from daily returns */
function annualizedVol(prices: number[]): number {
  if (prices.length < 2) return 0;
  const returns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    if (prices[i - 1] > 0) {
      returns.push(Math.log(prices[i] / prices[i - 1]));
    }
  }
  if (returns.length < 2) return 0;
  const mean = returns.reduce((s, r) => s + r, 0) / returns.length;
  const variance =
    returns.reduce((s, r) => s + (r - mean) ** 2, 0) / (returns.length - 1);
  return Math.round(Math.sqrt(variance * 365) * 10000) / 100; // percentage
}

// ═══════════════════════════════════════════════════════════════
// GET /api/analytics/correlation
// ═══════════════════════════════════════════════════════════════

analyticsRoutes.get("/correlation", async (c) => {
  const idsParam =
    c.req.query("ids") || "bitcoin,ethereum,solana,cardano,avalanche-2";
  const days = Math.min(Number(c.req.query("days") || 90), 365);
  const ids = idsParam.split(",").slice(0, 10).map((s) => s.trim());

  const cacheKey = `analytics:corr:${ids.join(",")}:${days}`;

  const result = await cache.wrap(cacheKey, 900, async () => {
    // Fetch price history for each coin in parallel
    const histories = await Promise.allSettled(
      ids.map((id) => cg.getMarketChart(id, days, "daily")),
    );

    // Extract daily close prices, keyed by coin id
    const priceMap: Record<string, number[]> = {};
    for (let i = 0; i < ids.length; i++) {
      const h = histories[i];
      if (h.status === "fulfilled" && h.value.prices?.length > 0) {
        priceMap[ids[i]] = h.value.prices.map((p) => p[1]);
      }
    }

    const validIds = Object.keys(priceMap);

    // Build correlation matrix
    const matrix: Record<string, Record<string, number>> = {};
    for (const a of validIds) {
      matrix[a] = {};
      for (const b of validIds) {
        matrix[a][b] = a === b ? 1 : pearson(priceMap[a], priceMap[b]);
      }
    }

    return {
      assets: validIds,
      days,
      matrix,
    };
  });

  return c.json({
    data: result,
    timestamp: new Date().toISOString(),
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/analytics/volatility
// ═══════════════════════════════════════════════════════════════

analyticsRoutes.get("/volatility", async (c) => {
  const limit = Math.min(Number(c.req.query("limit") || 50), 100);
  const days = Math.min(Number(c.req.query("days") || 30), 365);

  const cacheKey = `analytics:vol:${limit}:${days}`;

  const result = await cache.wrap(cacheKey, 600, async () => {
    // Get top coins by market cap
    const coins = await cg.getCoins({ perPage: limit, sparkline: false });

    // Fetch daily price history for each coin in parallel
    const histories = await Promise.allSettled(
      coins.map((coin) => cg.getMarketChart(coin.id, days, "daily")),
    );

    const rankings: Array<{
      id: string;
      symbol: string;
      name: string;
      volatility: number;
      priceChange24h: number;
      marketCap: number;
    }> = [];

    for (let i = 0; i < coins.length; i++) {
      const h = histories[i];
      if (h.status === "fulfilled" && h.value.prices?.length > 5) {
        const prices = h.value.prices.map((p) => p[1]);
        rankings.push({
          id: coins[i].id,
          symbol: coins[i].symbol,
          name: coins[i].name,
          volatility: annualizedVol(prices),
          priceChange24h: coins[i].price_change_percentage_24h,
          marketCap: coins[i].market_cap,
        });
      }
    }

    // Sort by volatility descending
    rankings.sort((a, b) => b.volatility - a.volatility);

    return {
      period: `${days}d`,
      rankings,
    };
  });

  return c.json({
    data: result,
    count: result.rankings.length,
    timestamp: new Date().toISOString(),
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/analytics/l2
// ═══════════════════════════════════════════════════════════════

analyticsRoutes.get("/l2", async (c) => {
  const sortBy = c.req.query("sort") || "tvl";
  const limit = Math.min(Number(c.req.query("limit") || 50), 200);

  const cacheKey = `analytics:l2:${sortBy}:${limit}`;

  const result = await cache.wrap(cacheKey, 600, async () => {
    // Fetch L2Beat summary and DeFiLlama chains in parallel
    const [l2Summary, llamaChains] = await Promise.all([
      l2beat.getScalingSummary(),
      llama.getChainsTVL(),
    ]);

    // Build a DeFiLlama TVL lookup for cross-referencing
    const llamaTvlMap: Record<string, number> = {};
    for (const ch of llamaChains) {
      llamaTvlMap[ch.name.toLowerCase()] = ch.tvl;
    }

    // Parse L2Beat projects (it's a Record<string, project>)
    const projects = Object.entries(l2Summary.projects).map(
      ([key, p]) => {
        const l2Tvl = p.tvl?.value ?? null;
        const llamaTvl = llamaTvlMap[p.name?.toLowerCase()] ?? null;

        return {
          id: key,
          name: p.name,
          slug: p.slug,
          category: p.category,
          provider: p.provider ?? null,
          stage: p.stage?.stage ?? null,
          purposes: p.purposes,
          tvlL2Beat: l2Tvl,
          tvlDeFiLlama: llamaTvl,
        };
      },
    );

    // Sort
    if (sortBy === "name") {
      projects.sort((a, b) => a.name.localeCompare(b.name));
    } else {
      projects.sort(
        (a, b) => (b.tvlL2Beat ?? b.tvlDeFiLlama ?? 0) - (a.tvlL2Beat ?? a.tvlDeFiLlama ?? 0),
      );
    }

    return projects.slice(0, limit);
  });

  return c.json({
    data: result,
    count: result.length,
    timestamp: new Date().toISOString(),
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/analytics/revenue
// ═══════════════════════════════════════════════════════════════

analyticsRoutes.get("/revenue", async (c) => {
  const limit = Math.min(Number(c.req.query("limit") || 50), 200);
  const period = c.req.query("period") || "24h"; // 24h | 7d | 30d

  const cacheKey = `analytics:revenue:${period}:${limit}`;

  const result = await cache.wrap(cacheKey, 300, async () => {
    // Fetch from both DeFiLlama and Token Terminal in parallel
    const [llamaFees, llamaRevenue] = await Promise.allSettled([
      llama.getFeesRevenue(),
      llama.getRevenue(),
    ]);

    // Try Token Terminal (may fail if no API key)
    let ttData: tt.ProtocolMetrics[] = [];
    try {
      const ttRevenue = await tt.getProtocolRevenue();
      ttData = ttRevenue.data ?? [];
    } catch {
      // Token Terminal unavailable — continue with DeFiLlama only
    }

    // Build unified revenue list from DeFiLlama fees endpoint
    type RevenueEntry = {
      name: string;
      fees24h: number | null;
      fees7d: number | null;
      fees30d: number | null;
      revenue24h: number | null;
      revenue7d: number | null;
      revenue30d: number | null;
      category: string | null;
      source: string;
    };

    const entries: RevenueEntry[] = [];

    // DeFiLlama fees data
    if (llamaFees.status === "fulfilled") {
      for (const p of llamaFees.value.protocols ?? []) {
        entries.push({
          name: p.name,
          fees24h: p.total24h ?? null,
          fees7d: p.total7d ?? null,
          fees30d: p.total30d ?? null,
          revenue24h: null,
          revenue7d: null,
          revenue30d: null,
          category: p.category ?? null,
          source: "defillama",
        });
      }
    }

    // Merge DeFiLlama revenue data
    if (llamaRevenue.status === "fulfilled") {
      const revenueByName = new Map(
        (llamaRevenue.value.protocols ?? []).map((p) => [p.name, p]),
      );
      for (const entry of entries) {
        const rev = revenueByName.get(entry.name);
        if (rev) {
          entry.revenue24h = rev.total24h ?? null;
          entry.revenue7d = rev.total7d ?? null;
          entry.revenue30d = rev.total30d ?? null;
        }
      }
    }

    // Enrich with Token Terminal data if available
    if (ttData.length > 0) {
      const ttByName = new Map(
        ttData.map((p) => [p.project_name?.toLowerCase(), p]),
      );
      for (const entry of entries) {
        const ttEntry = ttByName.get(entry.name.toLowerCase());
        if (ttEntry) {
          entry.revenue24h = entry.revenue24h ?? ttEntry.revenue_24h ?? null;
          entry.revenue7d = entry.revenue7d ?? ttEntry.revenue_7d ?? null;
          entry.revenue30d = entry.revenue30d ?? ttEntry.revenue_30d ?? null;
        }
      }
    }

    // Sort by selected period
    const sortKey =
      period === "7d"
        ? "fees7d"
        : period === "30d"
          ? "fees30d"
          : "fees24h";

    entries.sort(
      (a, b) => (b[sortKey as keyof RevenueEntry] as number ?? 0) - (a[sortKey as keyof RevenueEntry] as number ?? 0),
    );

    return entries.slice(0, limit);
  });

  return c.json({
    data: result,
    count: result.length,
    period,
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/analytics/tt/projects ──────────────────────────
// All Token Terminal tracked projects

analyticsRoutes.get("/tt/projects", async (c) => {
  const data = await tt.getProjects();

  return c.json({
    data: (data.data || []).map((p: any) => ({
      id: p.project_id,
      name: p.project_name,
      symbol: p.symbol,
      category: p.category,
      chains: p.chains,
      logo: p.logo,
    })),
    count: data.data?.length || 0,
    source: "tokenterminal",
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/analytics/tt/project/:id ───────────────────────
// Per-project metrics (Token Terminal)

analyticsRoutes.get("/tt/project/:id", async (c) => {
  const projectId = c.req.param("id");
  const data = await tt.getProjectMetrics(projectId);

  return c.json({
    data: data.data,
    projectId,
    source: "tokenterminal",
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/analytics/tt/fees ──────────────────────────────
// Protocol fee rankings (Token Terminal)

analyticsRoutes.get("/tt/fees", async (c) => {
  const limit = Math.min(Number(c.req.query("limit") || 50), 200);
  const data = await tt.getProtocolFees();

  return c.json({
    data: (data.data || []).slice(0, limit),
    count: Math.min(data.data?.length || 0, limit),
    source: "tokenterminal",
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/analytics/tt/active-users ──────────────────────
// Protocol DAU rankings (Token Terminal)

analyticsRoutes.get("/tt/active-users", async (c) => {
  const limit = Math.min(Number(c.req.query("limit") || 50), 200);
  const data = await tt.getActiveUsers();

  return c.json({
    data: (data.data || []).slice(0, limit),
    count: Math.min(data.data?.length || 0, limit),
    source: "tokenterminal",
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/analytics/tt/market/:metric ────────────────────
// Market-level time series (Token Terminal)

analyticsRoutes.get("/tt/market/:metric", async (c) => {
  const metric = c.req.param("metric");
  const days = Math.min(Number(c.req.query("days") || 30), 365);
  const data = await tt.getMarketMetric(metric, days);

  return c.json({
    data: {
      metricId: data.metric_id,
      values: (data.data || []).map((v: any) => ({
        timestamp: v.timestamp,
        value: v.value,
      })),
    },
    metric,
    days,
    source: "tokenterminal",
    timestamp: new Date().toISOString(),
  });
});
