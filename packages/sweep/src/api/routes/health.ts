import { Hono } from "hono";

const health = new Hono();

/**
 * GET /health
 * Basic health check endpoint
 */
health.get("/", (c) => {
  return c.json({
    status: "ok",
    timestamp: Date.now(),
    service: "sweep-api",
    version: process.env.npm_package_version || "0.1.0",
  });
});

/**
 * GET /health/ready
 * Readiness check - verifies all dependencies are available
 */
health.get("/ready", async (c) => {
  const checks: Record<string, { status: "ok" | "error"; latencyMs?: number; error?: string }> = {};

  // Check Redis
  try {
    const start = Date.now();
    const { getRedis } = await import("../../utils/redis.js");
    const redis = getRedis();
    await redis.ping();
    checks.redis = { status: "ok", latencyMs: Date.now() - start };
  } catch (error) {
    checks.redis = {
      status: "error",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }

  // Check Database
  try {
    const start = Date.now();
    const { getClient } = await import("../../db/index.js");
    const client = getClient();
    await client`SELECT 1`;
    checks.database = { status: "ok", latencyMs: Date.now() - start };
  } catch (error) {
    checks.database = {
      status: "error",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }

  const allHealthy = Object.values(checks).every((c) => c.status === "ok");

  return c.json(
    {
      status: allHealthy ? "ready" : "degraded",
      timestamp: Date.now(),
      checks,
    },
    allHealthy ? 200 : 503
  );
});

/**
 * GET /health/live
 * Liveness check - just confirms the service is running
 */
health.get("/live", (c) => {
  return c.json({
    status: "alive",
    timestamp: Date.now(),
    uptime: process.uptime(),
  });
});

export { health };
