/**
 * Integration tests for health & meta endpoints: /, /health, /api
 *
 * Builds a minimal Hono app that mirrors the health/meta routes from index.ts
 * without starting an actual HTTP server.
 */

import { describe, it, expect, vi } from "vitest";
import { Hono } from "hono";
import { cache } from "@/lib/cache.js";
import { circuitBreakerStats } from "@/lib/fetcher.js";

// ─── Build a test app that mirrors the health/meta routes ────

function buildHealthApp() {
  const app = new Hono();

  app.get("/", (c) =>
    c.json({
      name: "Crypto Vision",
      description: "The complete cryptocurrency intelligence API",
      version: "0.1.0",
      docs: "/api",
      health: "/health",
      website: "https://cryptocurrency.cv",
    })
  );

  app.get("/health", async (c) => {
    const cacheStats = cache.stats();
    return c.json({
      status: "ok",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      cache: cacheStats,
      circuitBreakers: circuitBreakerStats(),
      queues: {
        ai: { pending: 0, active: 0 },
        heavyFetch: { pending: 0, active: 0 },
      },
      memory: {
        rss: Math.round(process.memoryUsage.rss() / 1024 / 1024),
        heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      },
      env: process.env.NODE_ENV || "development",
    });
  });

  app.get("/api", (c) =>
    c.json({
      name: "Crypto Vision API",
      version: "0.1.0",
      endpoints: {
        market: { "GET /api/coins": "Top coins by market cap" },
        defi: { "GET /api/defi/protocols": "Top DeFi protocols by TVL" },
        news: { "GET /api/news": "Latest crypto news" },
        ai: { "GET /api/ai/sentiment/:coin": "AI sentiment analysis" },
      },
    })
  );

  app.notFound((c) =>
    c.json(
      {
        error: "Not Found",
        message: `No route matches ${c.req.method} ${c.req.path}`,
        docs: "/api",
      },
      404
    )
  );

  return app;
}

const app = buildHealthApp();

// ─── GET / ───────────────────────────────────────────────────

describe("GET /", () => {
  it("returns the API identity payload", async () => {
    const res = await app.request("/");
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toMatchObject({
      name: "Crypto Vision",
      version: "0.1.0",
    });
    expect(body).toHaveProperty("docs", "/api");
    expect(body).toHaveProperty("health", "/health");
  });
});

// ─── GET /health ─────────────────────────────────────────────

describe("GET /health", () => {
  it("returns status ok with diagnostic info", async () => {
    const res = await app.request("/health");
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body).toHaveProperty("uptime");
    expect(body).toHaveProperty("timestamp");
    expect(body).toHaveProperty("cache");
    expect(body).toHaveProperty("memory");
    expect(typeof body.uptime).toBe("number");
    expect(typeof body.timestamp).toBe("string");
  });

  it("includes cache stats", async () => {
    const res = await app.request("/health");
    const body = await res.json();
    expect(body.cache).toHaveProperty("memoryEntries");
    expect(body.cache).toHaveProperty("redisConnected");
  });

  it("includes memory stats", async () => {
    const res = await app.request("/health");
    const body = await res.json();
    expect(body.memory).toHaveProperty("rss");
    expect(body.memory).toHaveProperty("heapUsed");
    expect(typeof body.memory.rss).toBe("number");
    expect(typeof body.memory.heapUsed).toBe("number");
  });
});

// ─── GET /api ────────────────────────────────────────────────

describe("GET /api", () => {
  it("returns API documentation", async () => {
    const res = await app.request("/api");
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toHaveProperty("name", "Crypto Vision API");
    expect(body).toHaveProperty("version");
    expect(body).toHaveProperty("endpoints");
    expect(body.endpoints).toHaveProperty("market");
    expect(body.endpoints).toHaveProperty("defi");
    expect(body.endpoints).toHaveProperty("news");
    expect(body.endpoints).toHaveProperty("ai");
  });
});

// ─── 404 ─────────────────────────────────────────────────────

describe("404 handler", () => {
  it("returns 404 JSON for unmatched routes", async () => {
    const res = await app.request("/nonexistent-path");
    expect(res.status).toBe(404);

    const body = await res.json();
    expect(body).toHaveProperty("error");
    expect(body).toHaveProperty("message");
    expect(body).toHaveProperty("docs", "/api");
  });
});
