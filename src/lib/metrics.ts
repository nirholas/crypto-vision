/**
 * Crypto Vision — Prometheus Metrics & Observability
 *
 * Lightweight Prometheus-compatible metrics using prom-client.
 * Tracks HTTP requests, upstream calls, cache hit/miss rates,
 * WebSocket connections, queue depth, and circuit breaker state.
 *
 * All metrics are registered on a dedicated Registry to avoid
 * polluting the global default registry, making tests deterministic.
 *
 * @copyright 2024-2026 nirholas. All rights reserved.
 */

import client from "prom-client";

// ─── Registry ────────────────────────────────────────────────

export const registry = new client.Registry();

// Collect default Node.js process metrics (CPU, memory, GC, event loop)
client.collectDefaultMetrics({ register: registry, prefix: "cv_" });

// ─── HTTP Request Metrics ────────────────────────────────────

/** Total HTTP requests served, labelled by method, path, and status code. */
export const httpRequestsTotal = new client.Counter({
  name: "http_requests_total",
  help: "Total number of HTTP requests served",
  labelNames: ["method", "path", "status"] as const,
  registers: [registry],
});

/** HTTP request duration in seconds, labelled by method and path. */
export const httpRequestDurationSeconds = new client.Histogram({
  name: "http_request_duration_seconds",
  help: "HTTP request duration in seconds",
  labelNames: ["method", "path"] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [registry],
});

// ─── Upstream Request Metrics ────────────────────────────────

/** Total upstream (fetcher) requests, labelled by source host and status. */
export const upstreamRequestsTotal = new client.Counter({
  name: "upstream_requests_total",
  help: "Total upstream API requests",
  labelNames: ["source", "status"] as const,
  registers: [registry],
});

/** Upstream request duration in seconds, labelled by source host. */
export const upstreamRequestDurationSeconds = new client.Histogram({
  name: "upstream_request_duration_seconds",
  help: "Upstream API request duration in seconds",
  labelNames: ["source"] as const,
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30],
  registers: [registry],
});

// ─── Cache Metrics ───────────────────────────────────────────

/** Total cache hits, labelled by layer (memory / redis). */
export const cacheHitsTotal = new client.Counter({
  name: "cache_hits_total",
  help: "Total cache hits",
  labelNames: ["layer"] as const,
  registers: [registry],
});

/** Total cache misses, labelled by layer (memory / redis). */
export const cacheMissesTotal = new client.Counter({
  name: "cache_misses_total",
  help: "Total cache misses",
  labelNames: ["layer"] as const,
  registers: [registry],
});

// ─── WebSocket Metrics ───────────────────────────────────────

/** Number of currently active WebSocket connections. */
export const activeWebsocketConnections = new client.Gauge({
  name: "active_websocket_connections",
  help: "Number of active WebSocket connections",
  registers: [registry],
});

// ─── Queue Metrics ───────────────────────────────────────────

/** Current queue depth (waiting + running), labelled by queue name. */
export const queueDepth = new client.Gauge({
  name: "queue_depth",
  help: "Current queue depth (queued + running tasks)",
  labelNames: ["queue_name"] as const,
  registers: [registry],
});

/** Total tasks executed through queues, labelled by queue name. */
export const queueTasksTotal = new client.Counter({
  name: "queue_tasks_total",
  help: "Total tasks processed through the queue",
  labelNames: ["queue_name", "result"] as const,
  registers: [registry],
});

/** Queue task execution duration in seconds, labelled by queue name. */
export const queueTaskDurationSeconds = new client.Histogram({
  name: "queue_task_duration_seconds",
  help: "Queue task execution duration in seconds",
  labelNames: ["queue_name"] as const,
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2.5, 5, 10, 30, 60],
  registers: [registry],
});

// ─── Circuit Breaker Metrics ─────────────────────────────────

/**
 * Circuit breaker state gauge, labelled by host and state.
 * Value is 1 for the current state, 0 for others.
 * States: closed (0), open (1), half-open (0.5)
 */
export const circuitBreakerState = new client.Gauge({
  name: "circuit_breaker_state",
  help: "Circuit breaker state: 0=closed, 0.5=half-open, 1=open",
  labelNames: ["host"] as const,
  registers: [registry],
});

// ─── Helpers ─────────────────────────────────────────────────

/**
 * Normalize a route path for metric labels.
 * Replaces dynamic path segments (e.g. /api/coin/bitcoin) with :param
 * to prevent high-cardinality label explosion.
 *
 * Examples:
 *  - /api/coin/bitcoin → /api/coin/:id
 *  - /api/bitcoin/tx/abc123 → /api/bitcoin/tx/:txid
 *  - /api/defi/protocol/aave → /api/defi/protocol/:slug
 *  - /health → /health
 */
export function normalizePath(path: string): string {
  // Remove query string
  const base = path.split("?")[0];

  // Known patterns where we want to collapse dynamic segments.
  // We match /api/<group>/<subgroup>/<dynamic> style paths.
  // Anything after a known "anchor" segment is treated as a parameter.
  const segments = base.split("/").filter(Boolean);
  if (segments.length <= 2) return base; // short paths like /health, /api

  // Heuristic: If a segment looks like a dynamic value (hex, UUID, number,
  // known coin IDs are too many), replace segments after the 3rd with :param.
  // This keeps /api/defi/protocols (static) but collapses /api/coin/bitcoin.
  const normalized: string[] = [];
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    // Always keep the first 3 segments verbatim (e.g. "api", "bitcoin", "tx")
    if (i < 3) {
      normalized.push(seg);
      continue;
    }
    // 4th+ segments are likely dynamic parameters — collapse them
    // But keep well-known static segments
    if (isStaticSegment(seg)) {
      normalized.push(seg);
    } else {
      normalized.push(":param");
    }
  }
  return "/" + normalized.join("/");
}

/** Known static path segments that should not be collapsed. */
const STATIC_SEGMENTS = new Set([
  "overview", "summary", "search", "trending", "breaking", "latest",
  "categories", "sources", "active", "stats", "config", "types",
  "list", "feeds", "network", "validators", "operators", "metrics",
  "yields", "chains", "stablecoins", "bridges", "hacks", "fees",
  "treasuries", "history", "revenue", "global", "tickers", "assets",
  "prices", "quote", "pairs", "markets", "spot", "options",
  "liquidations", "funding", "premiums", "flows", "events",
  "upcoming", "protocols", "supply", "tracked", "strict", "popular",
  "projects", "ready", "usage", "homepage", "stream",
]);

function isStaticSegment(seg: string): boolean {
  return STATIC_SEGMENTS.has(seg.toLowerCase());
}

/**
 * Get a JSON summary of all metrics for the /api/metrics/summary endpoint.
 * Returns a human-friendly dashboard object instead of Prometheus text format.
 */
export async function getMetricsSummary(): Promise<Record<string, unknown>> {
  const metrics = await registry.getMetricsAsJSON();

  const summary: Record<string, unknown> = {};
  for (const metric of metrics) {
    // Skip default process metrics in summary — they're in /metrics
    if (metric.name.startsWith("cv_")) continue;

    if (metric.type === "counter" || metric.type === "gauge") {
      const values: Record<string, number> = {};
      for (const val of metric.values) {
        const labelKey = Object.entries(val.labels)
          .map(([k, v]) => `${k}=${v}`)
          .join(",");
        values[labelKey || "total"] = val.value;
      }
      summary[metric.name] = {
        type: metric.type,
        help: metric.help,
        values,
      };
    } else if (metric.type === "histogram") {
      const buckets: Record<string, Record<string, number>> = {};
      for (const val of metric.values) {
        const labelKey = Object.entries(val.labels)
          .filter(([k]) => k !== "le")
          .map(([k, v]) => `${k}=${v}`)
          .join(",") || "total";
        if (!buckets[labelKey]) buckets[labelKey] = {};
        const metricName = val.metricName ?? metric.name;
        if (metricName.endsWith("_sum")) {
          buckets[labelKey]["sum"] = val.value;
        } else if (metricName.endsWith("_count")) {
          buckets[labelKey]["count"] = val.value;
        }
      }
      summary[metric.name] = {
        type: "histogram",
        help: metric.help,
        values: buckets,
      };
    }
  }

  return summary;
}

/**
 * Reset all metrics. Used in tests for isolation.
 */
export function resetMetrics(): void {
  registry.resetMetrics();
}
