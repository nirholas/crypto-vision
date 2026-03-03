/**
 * Tests for lib/metrics.ts — Prometheus metrics module
 *
 * Validates metric registration, instrumentation, path normalization,
 * and the JSON summary generator.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  registry,
  httpRequestsTotal,
  httpRequestDurationSeconds,
  upstreamRequestsTotal,
  upstreamRequestDurationSeconds,
  cacheHitsTotal,
  cacheMissesTotal,
  activeWebsocketConnections,
  queueDepth,
  queueTasksTotal,
  queueTaskDurationSeconds,
  circuitBreakerState,
  normalizePath,
  getMetricsSummary,
  resetMetrics,
} from "@/lib/metrics.js";

beforeEach(() => {
  resetMetrics();
});

// ─── Metric Registration ─────────────────────────────────────

describe("metric registration", () => {
  it("registers all expected metrics in the registry", async () => {
    const metrics = await registry.getMetricsAsJSON();
    const names = metrics.map((m) => m.name);

    expect(names).toContain("http_requests_total");
    expect(names).toContain("http_request_duration_seconds");
    expect(names).toContain("upstream_requests_total");
    expect(names).toContain("upstream_request_duration_seconds");
    expect(names).toContain("cache_hits_total");
    expect(names).toContain("cache_misses_total");
    expect(names).toContain("active_websocket_connections");
    expect(names).toContain("queue_depth");
    expect(names).toContain("queue_tasks_total");
    expect(names).toContain("queue_task_duration_seconds");
    expect(names).toContain("circuit_breaker_state");
  });

  it("includes default Node.js process metrics with cv_ prefix", async () => {
    const metrics = await registry.getMetricsAsJSON();
    const defaultNames = metrics.filter((m) => m.name.startsWith("cv_"));
    expect(defaultNames.length).toBeGreaterThan(0);
  });

  it("generates valid Prometheus text output", async () => {
    const text = await registry.metrics();
    expect(text).toContain("# HELP");
    expect(text).toContain("# TYPE");
    expect(text).toBeTruthy();
  });
});

// ─── Counter Operations ──────────────────────────────────────

describe("counter metrics", () => {
  it("increments http_requests_total correctly", async () => {
    httpRequestsTotal.inc({ method: "GET", path: "/api/coins", status: "200" });
    httpRequestsTotal.inc({ method: "GET", path: "/api/coins", status: "200" });
    httpRequestsTotal.inc({ method: "POST", path: "/api/ai/ask", status: "400" });

    const metric = await httpRequestsTotal.get();
    const values = metric.values;

    const getCoins200 = values.find(
      (v) => v.labels.method === "GET" && v.labels.path === "/api/coins" && v.labels.status === "200",
    );
    expect(getCoins200?.value).toBe(2);

    const postAi400 = values.find(
      (v) => v.labels.method === "POST" && v.labels.status === "400",
    );
    expect(postAi400?.value).toBe(1);
  });

  it("increments upstream_requests_total correctly", async () => {
    upstreamRequestsTotal.inc({ source: "api.coingecko.com", status: "200" });
    upstreamRequestsTotal.inc({ source: "api.coingecko.com", status: "429" });

    const metric = await upstreamRequestsTotal.get();
    expect(metric.values).toHaveLength(2);
  });

  it("tracks cache hits and misses independently", async () => {
    cacheHitsTotal.inc({ layer: "memory" });
    cacheHitsTotal.inc({ layer: "memory" });
    cacheHitsTotal.inc({ layer: "redis" });
    cacheMissesTotal.inc({ layer: "memory" });

    const hits = await cacheHitsTotal.get();
    const misses = await cacheMissesTotal.get();

    const memHits = hits.values.find((v) => v.labels.layer === "memory");
    expect(memHits?.value).toBe(2);

    const redisHits = hits.values.find((v) => v.labels.layer === "redis");
    expect(redisHits?.value).toBe(1);

    const memMisses = misses.values.find((v) => v.labels.layer === "memory");
    expect(memMisses?.value).toBe(1);
  });

  it("tracks queue tasks by name and result", async () => {
    queueTasksTotal.inc({ queue_name: "ai", result: "success" });
    queueTasksTotal.inc({ queue_name: "ai", result: "success" });
    queueTasksTotal.inc({ queue_name: "ai", result: "timeout" });

    const metric = await queueTasksTotal.get();
    const success = metric.values.find(
      (v) => v.labels.queue_name === "ai" && v.labels.result === "success",
    );
    expect(success?.value).toBe(2);
  });
});

// ─── Gauge Operations ────────────────────────────────────────

describe("gauge metrics", () => {
  it("sets and reads active_websocket_connections", async () => {
    activeWebsocketConnections.set(42);
    const metric = await activeWebsocketConnections.get();
    expect(metric.values[0].value).toBe(42);
  });

  it("sets and reads queue_depth with labels", async () => {
    queueDepth.set({ queue_name: "ai" }, 15);
    queueDepth.set({ queue_name: "heavyFetch" }, 3);

    const metric = await queueDepth.get();
    const ai = metric.values.find((v) => v.labels.queue_name === "ai");
    expect(ai?.value).toBe(15);

    const heavy = metric.values.find((v) => v.labels.queue_name === "heavyFetch");
    expect(heavy?.value).toBe(3);
  });

  it("tracks circuit breaker state numerically", async () => {
    circuitBreakerState.set({ host: "api.example.com" }, 0); // closed
    let metric = await circuitBreakerState.get();
    expect(metric.values[0].value).toBe(0);

    circuitBreakerState.set({ host: "api.example.com" }, 1); // open
    metric = await circuitBreakerState.get();
    expect(metric.values[0].value).toBe(1);

    circuitBreakerState.set({ host: "api.example.com" }, 0.5); // half-open
    metric = await circuitBreakerState.get();
    expect(metric.values[0].value).toBe(0.5);
  });
});

// ─── Histogram Operations ────────────────────────────────────

describe("histogram metrics", () => {
  it("observes http_request_duration_seconds", async () => {
    httpRequestDurationSeconds.observe({ method: "GET", path: "/api/coins" }, 0.15);
    httpRequestDurationSeconds.observe({ method: "GET", path: "/api/coins" }, 0.25);

    const metric = await httpRequestDurationSeconds.get();
    const sum = metric.values.find(
      (v) => v.metricName === "http_request_duration_seconds_sum" &&
             v.labels.method === "GET" && v.labels.path === "/api/coins",
    );
    expect(sum?.value).toBeCloseTo(0.40, 2);

    const count = metric.values.find(
      (v) => v.metricName === "http_request_duration_seconds_count" &&
             v.labels.method === "GET" && v.labels.path === "/api/coins",
    );
    expect(count?.value).toBe(2);
  });

  it("observes upstream_request_duration_seconds", async () => {
    upstreamRequestDurationSeconds.observe({ source: "api.coingecko.com" }, 0.5);

    const metric = await upstreamRequestDurationSeconds.get();
    const count = metric.values.find(
      (v) => v.metricName === "upstream_request_duration_seconds_count",
    );
    expect(count?.value).toBe(1);
  });

  it("uses startTimer for accurate duration tracking", async () => {
    const end = httpRequestDurationSeconds.startTimer({ method: "GET", path: "/health" });

    // Simulate some work
    await new Promise((resolve) => setTimeout(resolve, 10));
    end();

    const metric = await httpRequestDurationSeconds.get();
    const sum = metric.values.find(
      (v) => v.metricName === "http_request_duration_seconds_sum" &&
             v.labels.path === "/health",
    );
    expect(sum?.value).toBeGreaterThan(0.005); // at least 5ms
  });

  it("observes queue_task_duration_seconds", async () => {
    queueTaskDurationSeconds.observe({ queue_name: "ai" }, 2.5);

    const metric = await queueTaskDurationSeconds.get();
    const sum = metric.values.find(
      (v) => v.metricName === "queue_task_duration_seconds_sum",
    );
    expect(sum?.value).toBe(2.5);
  });
});

// ─── Path Normalization ──────────────────────────────────────

describe("normalizePath", () => {
  it("keeps short paths unchanged", () => {
    expect(normalizePath("/")).toBe("/");
    expect(normalizePath("/health")).toBe("/health");
    expect(normalizePath("/metrics")).toBe("/metrics");
    expect(normalizePath("/api")).toBe("/api");
  });

  it("keeps 3-segment static paths unchanged", () => {
    expect(normalizePath("/api/defi/protocols")).toBe("/api/defi/protocols");
    expect(normalizePath("/api/ai/signals")).toBe("/api/ai/signals");
  });

  it("collapses dynamic 4th+ segments to :param", () => {
    expect(normalizePath("/api/coin/bitcoin")).toBe("/api/coin/bitcoin");
    expect(normalizePath("/api/bitcoin/tx/abc123def")).toBe("/api/bitcoin/tx/:param");
    expect(normalizePath("/api/defi/protocol/aave")).toBe("/api/defi/protocol/:param");
  });

  it("preserves known static segments beyond 3rd position", () => {
    expect(normalizePath("/api/nft/collection/overview")).toBe("/api/nft/collection/overview");
    expect(normalizePath("/api/staking/eth/validators")).toBe("/api/staking/eth/validators");
  });

  it("strips query strings", () => {
    expect(normalizePath("/api/coins?page=1&limit=50")).toBe("/api/coins");
    expect(normalizePath("/api/dex/search?q=uniswap")).toBe("/api/dex/search");
  });

  it("handles trailing slashes", () => {
    expect(normalizePath("/api/defi/protocols/")).toBe("/api/defi/protocols");
  });
});

// ─── Metrics Summary ─────────────────────────────────────────

describe("getMetricsSummary", () => {
  it("returns a JSON object with metric summaries", async () => {
    // Populate some metrics
    httpRequestsTotal.inc({ method: "GET", path: "/api/coins", status: "200" });
    cacheHitsTotal.inc({ layer: "memory" });
    activeWebsocketConnections.set(5);

    const summary = await getMetricsSummary();
    expect(summary).toBeDefined();
    expect(typeof summary).toBe("object");
  });

  it("excludes default process metrics (cv_ prefix)", async () => {
    const summary = await getMetricsSummary();
    const keys = Object.keys(summary);
    const cvKeys = keys.filter((k) => k.startsWith("cv_"));
    expect(cvKeys).toHaveLength(0);
  });

  it("includes counter values in the summary", async () => {
    httpRequestsTotal.inc({ method: "GET", path: "/health", status: "200" });

    const summary = await getMetricsSummary();
    const httpMetric = summary["http_requests_total"] as Record<string, unknown>;
    expect(httpMetric).toBeDefined();
    expect(httpMetric.type).toBe("counter");
  });

  it("includes histogram data in the summary", async () => {
    httpRequestDurationSeconds.observe({ method: "GET", path: "/health" }, 0.1);

    const summary = await getMetricsSummary();
    const durationMetric = summary["http_request_duration_seconds"] as Record<string, unknown>;
    expect(durationMetric).toBeDefined();
    expect(durationMetric.type).toBe("histogram");
  });
});

// ─── Reset ───────────────────────────────────────────────────

describe("resetMetrics", () => {
  it("resets all metric values to zero", async () => {
    httpRequestsTotal.inc({ method: "GET", path: "/test", status: "200" });
    activeWebsocketConnections.set(99);
    cacheHitsTotal.inc({ layer: "memory" });

    resetMetrics();

    const http = await httpRequestsTotal.get();
    // After reset, values array may be empty or all zero
    for (const v of http.values) {
      expect(v.value).toBe(0);
    }

    const ws = await activeWebsocketConnections.get();
    for (const v of ws.values) {
      expect(v.value).toBe(0);
    }
  });
});
