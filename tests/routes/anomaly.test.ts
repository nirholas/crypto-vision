/**
 * Integration tests for /api/anomalies routes
 *
 * Tests the anomaly detection API endpoints:
 * - GET /api/anomalies          — List recent anomalies with filtering
 * - GET /api/anomalies/stats    — Engine statistics
 * - GET /api/anomalies/types    — Available anomaly type configs
 * - GET /api/anomalies/config   — Full detector configuration
 * - GET /api/anomalies/stream   — SSE stream (verifies connection setup)
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock WebSocket and BigQuery to prevent side effects from anomaly-processors
vi.mock("@/lib/ws.js", () => ({
  broadcastToTopic: vi.fn(),
}));
vi.mock("@/lib/bigquery.js", () => ({
  insertRows: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/cache.js", () => ({
  cache: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    wrap: vi.fn((_k: string, _t: number, fn: () => Promise<unknown>) => fn()),
  },
}));

import { anomalyEngine } from "@/lib/anomaly.js";
import { anomalyRoutes } from "@/routes/anomaly.js";
import { Hono } from "hono";

const app = new Hono();
app.route("/api/anomalies", anomalyRoutes);

// Helper to populate engine with enough data to trigger anomalies
function seedStableData(type: string, asset: string, metric: string, value: number, count = 100): void {
  for (let i = 0; i < count; i++) {
    anomalyEngine.ingest(type as Parameters<typeof anomalyEngine.ingest>[0], asset, metric, value);
  }
}

// ─── GET /api/anomalies ──────────────────────────────────────

describe("GET /api/anomalies", () => {
  beforeEach(() => {
    anomalyEngine.reset();
  });

  it("returns empty list initially", async () => {
    const res = await app.request("/api/anomalies");
    expect(res.status).toBe(200);

    const body = (await res.json()) as Record<string, any>;
    expect(body.data).toEqual([]);
    expect(body.total).toBe(0);
    expect(body.timestamp).toBeDefined();
  });

  it("returns anomaly events after detection", async () => {
    // Seed stable data then inject spike
    seedStableData("price_spike", "bitcoin", "price", 50000);
    anomalyEngine.ingest("price_spike", "bitcoin", "price", 60000);

    const res = await app.request("/api/anomalies");
    expect(res.status).toBe(200);

    const body = (await res.json()) as Record<string, any>;
    // At least one event should exist from the ring buffer listener registered in the route
    expect(body.engineStats).toBeDefined();
    expect(body.engineStats.totalDetected).toBeGreaterThanOrEqual(1);
  });

  it("respects limit parameter", async () => {
    const res = await app.request("/api/anomalies?limit=5");
    expect(res.status).toBe(200);

    const body = (await res.json()) as Record<string, any>;
    expect(body.data.length).toBeLessThanOrEqual(5);
  });

  it("caps limit at 200", async () => {
    const res = await app.request("/api/anomalies?limit=999");
    expect(res.status).toBe(200);
    // Should not crash — just cap internally
  });
});

// ─── GET /api/anomalies/stats ────────────────────────────────

describe("GET /api/anomalies/stats", () => {
  beforeEach(() => {
    anomalyEngine.reset();
  });

  it("returns engine statistics", async () => {
    // Feed some data
    seedStableData("price_spike", "bitcoin", "price", 50000, 50);

    const res = await app.request("/api/anomalies/stats");
    expect(res.status).toBe(200);

    const body = (await res.json()) as Record<string, any>;
    expect(body.data).toBeDefined();
    expect(body.data.windows).toBeGreaterThanOrEqual(1);
    expect(body.data.totalDataPoints).toBeGreaterThanOrEqual(50);
    expect(body.data.severityCounts).toBeDefined();
    expect(body.data.topAssets).toBeDefined();
    expect(body.data.topTypes).toBeDefined();
    expect(body.timestamp).toBeDefined();
  });

  it("returns zero stats when engine is fresh", async () => {
    const res = await app.request("/api/anomalies/stats");
    expect(res.status).toBe(200);

    const body = (await res.json()) as Record<string, any>;
    expect(body.data.windows).toBe(0);
    expect(body.data.totalDetected).toBe(0);
  });
});

// ─── GET /api/anomalies/types ────────────────────────────────

describe("GET /api/anomalies/types", () => {
  it("returns all anomaly types with configs", async () => {
    const res = await app.request("/api/anomalies/types");
    expect(res.status).toBe(200);

    const body = (await res.json()) as Record<string, any>;
    expect(body.data).toBeInstanceOf(Array);
    expect(body.count).toBeGreaterThanOrEqual(16);

    // Verify structure of each type entry
    for (const entry of body.data) {
      expect(entry.type).toBeDefined();
      expect(entry.name).toBeDefined();
      expect(typeof entry.zScoreThreshold).toBe("number");
      expect(typeof entry.minDataPoints).toBe("number");
      expect(typeof entry.cooldownMs).toBe("number");
    }

    // Check specific types exist
    const typeNames = body.data.map((d: { type: string }) => d.type);
    expect(typeNames).toContain("price_spike");
    expect(typeNames).toContain("price_crash");
    expect(typeNames).toContain("tvl_drain");
    expect(typeNames).toContain("stablecoin_depeg");
    expect(typeNames).toContain("whale_movement");
    expect(typeNames).toContain("funding_rate_extreme");
  });
});

// ─── GET /api/anomalies/config ───────────────────────────────

describe("GET /api/anomalies/config", () => {
  it("returns full detector configuration", async () => {
    const res = await app.request("/api/anomalies/config");
    expect(res.status).toBe(200);

    const body = (await res.json()) as Record<string, any>;
    expect(body.detectorMethod).toBe("modified-z-score");
    expect(body.description).toContain("MAD");
    expect(body.data).toBeDefined();

    // Check config structure for price_spike
    const priceSpike = body.data.price_spike;
    expect(priceSpike).toBeDefined();
    expect(priceSpike.name).toBe("Price Spike");
    expect(typeof priceSpike.zScoreThreshold).toBe("number");
    expect(typeof priceSpike.cooldownMinutes).toBe("number");
    expect(typeof priceSpike.minDataPoints).toBe("number");
  });

  it("includes cooldown in both ms and minutes", async () => {
    const res = await app.request("/api/anomalies/config");
    const body = (await res.json()) as Record<string, any>;

    for (const [, config] of Object.entries(body.data) as [string, { cooldownMs: number; cooldownMinutes: number }][]) {
      expect(config.cooldownMs).toBeGreaterThan(0);
      expect(config.cooldownMinutes).toBeCloseTo(config.cooldownMs / 60_000, 5);
    }
  });
});

// ─── GET /api/anomalies/stream ───────────────────────────────

describe("GET /api/anomalies/stream", () => {
  it("returns SSE content type", async () => {
    const res = await app.request("/api/anomalies/stream");
    // SSE endpoint should respond with text/event-stream
    expect(res.headers.get("content-type")).toContain("text/event-stream");
  });
});
