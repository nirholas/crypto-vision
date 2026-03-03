/**
 * Tests for lib/cdn-cache.ts — CDN cache header middleware
 *
 * Uses a real Hono app to verify Cache-Control header behavior.
 */

import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import { cdnCacheHeaders } from "@/lib/cdn-cache.js";

// ─── Helpers ─────────────────────────────────────────────────

function buildApp() {
  const app = new Hono();
  app.use("/*", cdnCacheHeaders);
  return app;
}

// ─── cdnCacheHeaders ────────────────────────────────────────

describe("cdnCacheHeaders", () => {
  it("sets Cache-Control header on successful GET requests", async () => {
    const app = buildApp();
    app.get("/api/prices", (c) => c.json({ price: 100 }));

    const res = await app.request("/api/prices");
    expect(res.status).toBe(200);

    const cc = res.headers.get("Cache-Control");
    expect(cc).toBeDefined();
    expect(cc).toContain("public");
    expect(cc).toContain("max-age=");
    expect(cc).toContain("s-maxage=");
    expect(cc).toContain("stale-while-revalidate=");
  });

  it("does not set Cache-Control on POST requests", async () => {
    const app = buildApp();
    app.post("/api/data", (c) => c.json({ ok: true }));

    const res = await app.request("/api/data", { method: "POST" });
    expect(res.status).toBe(200);

    const cc = res.headers.get("Cache-Control");
    expect(cc).toBeNull();
  });

  it("does not set Cache-Control on 4xx responses", async () => {
    const app = buildApp();
    app.get("/api/missing", (c) => c.json({ error: "not found" }, 404));

    const res = await app.request("/api/missing");
    expect(res.status).toBe(404);

    const cc = res.headers.get("Cache-Control");
    expect(cc).toBeNull();
  });

  it("does not set Cache-Control on 5xx responses", async () => {
    const app = buildApp();
    app.get("/api/error", (c) => c.json({ error: "boom" }, 500));

    const res = await app.request("/api/error");
    expect(res.status).toBe(500);

    const cc = res.headers.get("Cache-Control");
    expect(cc).toBeNull();
  });

  it("does not override existing Cache-Control header", async () => {
    const app = buildApp();
    app.get("/api/custom", (c) => {
      c.header("Cache-Control", "no-cache");
      return c.json({ ok: true });
    });

    const res = await app.request("/api/custom");
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-cache");
  });

  it("uses default max-age of 30 seconds", async () => {
    const app = buildApp();
    app.get("/api/test", (c) => c.json({ ok: true }));

    const res = await app.request("/api/test");
    const cc = res.headers.get("Cache-Control")!;
    expect(cc).toContain("max-age=30");
    expect(cc).toContain("s-maxage=30");
  });

  it("uses default stale-while-revalidate of 60 seconds", async () => {
    const app = buildApp();
    app.get("/api/test", (c) => c.json({ ok: true }));

    const res = await app.request("/api/test");
    const cc = res.headers.get("Cache-Control")!;
    expect(cc).toContain("stale-while-revalidate=60");
  });
});
