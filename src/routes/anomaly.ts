/**
 * Crypto Vision — Anomaly Detection API Routes
 *
 * GET /api/anomalies          — Recent anomaly events with filtering
 * GET /api/anomalies/stats    — Detection engine statistics
 * GET /api/anomalies/stream   — Server-Sent Events for real-time anomalies
 */

import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import {
  anomalyEngine,
  DETECTOR_CONFIGS,
  type AnomalyEvent,
  type AnomalyType,
  type AnomalyHandler,
} from "../lib/anomaly.js";

export const anomalyRoutes = new Hono();

// ─── In-Memory Ring Buffer ───────────────────────────────────

const RECENT_EVENTS: AnomalyEvent[] = [];
const MAX_RECENT = 500;

anomalyEngine.onAnomaly((event) => {
  RECENT_EVENTS.unshift(event);
  if (RECENT_EVENTS.length > MAX_RECENT) RECENT_EVENTS.pop();
});

// ─── GET /api/anomalies ──────────────────────────────────────

anomalyRoutes.get("/", (c) => {
  const severity = c.req.query("severity") as
    | "info"
    | "warning"
    | "critical"
    | undefined;
  const type = c.req.query("type") as AnomalyType | undefined;
  const asset = c.req.query("asset");
  const limit = Math.min(
    parseInt(c.req.query("limit") || "50", 10),
    200,
  );

  let events: AnomalyEvent[] = RECENT_EVENTS;
  if (severity) events = events.filter((e) => e.severity === severity);
  if (type) events = events.filter((e) => e.type === type);
  if (asset)
    events = events.filter((e) =>
      e.asset.toLowerCase().includes(asset.toLowerCase()),
    );

  return c.json({
    data: events.slice(0, limit),
    total: events.length,
    engineStats: anomalyEngine.stats(),
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/anomalies/stats ────────────────────────────────

anomalyRoutes.get("/stats", (c) => {
  const stats = anomalyEngine.stats();
  const severityCounts = {
    critical: RECENT_EVENTS.filter((e) => e.severity === "critical").length,
    warning: RECENT_EVENTS.filter((e) => e.severity === "warning").length,
    info: RECENT_EVENTS.filter((e) => e.severity === "info").length,
  };

  return c.json({
    data: {
      ...stats,
      recentEvents: RECENT_EVENTS.length,
      severityCounts,
      topAssets: getTopAssets(),
      topTypes: getTopTypes(),
    },
    timestamp: new Date().toISOString(),
  });
});

function getTopAssets(): Array<{ asset: string; count: number }> {
  const counts = new Map<string, number>();
  for (const e of RECENT_EVENTS) {
    counts.set(e.asset, (counts.get(e.asset) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([asset, count]) => ({ asset, count }));
}

function getTopTypes(): Array<{ type: string; count: number }> {
  const counts = new Map<string, number>();
  for (const e of RECENT_EVENTS) {
    counts.set(e.type, (counts.get(e.type) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([type, count]) => ({ type, count }));
}

// ─── GET /api/anomalies/types — Available anomaly types ──────

anomalyRoutes.get("/types", (c) => {
  const types = Object.entries(DETECTOR_CONFIGS).map(([type, config]) => ({
    type,
    name: config.name,
    zScoreThreshold: config.zScoreThreshold,
    minDataPoints: config.minDataPoints,
    cooldownMs: config.cooldownMs,
  }));

  return c.json({
    data: types,
    count: types.length,
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/anomalies/config — Current detector configuration ────

anomalyRoutes.get("/config", (c) => {
  const configs = Object.fromEntries(
    Object.entries(DETECTOR_CONFIGS).map(([type, config]) => [
      type,
      {
        name: config.name,
        zScoreThreshold: config.zScoreThreshold,
        minDataPoints: config.minDataPoints,
        cooldownMs: config.cooldownMs,
        cooldownMinutes: config.cooldownMs / 60_000,
      },
    ]),
  );

  return c.json({
    data: configs,
    detectorMethod: "modified-z-score",
    description: "Statistical anomaly detection using Median Absolute Deviation (MAD) for robustness against outliers",
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/anomalies/stream — Server-Sent Events ─────────

anomalyRoutes.get("/stream", (c) => {
  return streamSSE(c, async (stream) => {
    // Create handler that pushes events to this SSE client
    const handler: AnomalyHandler = (event: AnomalyEvent) => {
      stream.writeSSE({
        data: JSON.stringify(event),
        event: event.severity,
        id: event.id,
      });
    };

    anomalyEngine.onAnomaly(handler);

    // Keep-alive ping every 30 seconds
    const keepAlive = setInterval(() => {
      stream.writeSSE({ data: "ping", event: "ping" });
    }, 30_000);

    // Clean up on disconnect
    stream.onAbort(() => {
      clearInterval(keepAlive);
      anomalyEngine.removeHandler(handler);
    });

    // Hold connection open — never resolves (SSE stays open)
    await new Promise<void>(() => {
      // Intentionally never resolved — connection stays open
      // until client disconnects (handled by onAbort above)
    });
  });
});
