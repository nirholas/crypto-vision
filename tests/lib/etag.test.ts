/**
 * Tests for lib/etag.ts — ETag generation, Cache-Control, conditional requests
 *
 * Covers:
 *   - computeEtag: SHA-256 weak ETag generation
 *   - etagMatches: If-None-Match header parsing
 *   - getCacheProfile: Route-specific cache profile resolution
 *   - buildCacheControl: Cache-Control header construction
 *   - etagMiddleware: Full middleware integration (304, headers, Vary)
 */

import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import {
  computeEtag,
  etagMatches,
  getCacheProfile,
  buildCacheControl,
  etagMiddleware,
} from "@/lib/etag.js";

// ─── Unit: computeEtag ──────────────────────────────────────

describe("computeEtag", () => {
  it("returns a weak ETag string", () => {
    const etag = computeEtag('{"price":42000}');
    expect(etag).toMatch(/^W\/"[0-9a-f]{16}"$/);
  });

  it("returns the same ETag for identical input", () => {
    const body = '{"a":1,"b":2}';
    expect(computeEtag(body)).toBe(computeEtag(body));
  });

  it("returns different ETags for different input", () => {
    const a = computeEtag('{"price":42000}');
    const b = computeEtag('{"price":42001}');
    expect(a).not.toBe(b);
  });

  it("handles empty string input", () => {
    const etag = computeEtag("");
    expect(etag).toMatch(/^W\/"[0-9a-f]{16}"$/);
  });

  it("handles large body input", () => {
    const largeBody = "x".repeat(100_000);
    const etag = computeEtag(largeBody);
    expect(etag).toMatch(/^W\/"[0-9a-f]{16}"$/);
  });
});

// ─── Unit: etagMatches ───────────────────────────────────────

describe("etagMatches", () => {
  it("matches exact ETag value", () => {
    const etag = 'W/"abc123def456789a"';
    expect(etagMatches(etag, etag)).toBe(true);
  });

  it("does not match different ETag", () => {
    expect(etagMatches('W/"aaa"', 'W/"bbb"')).toBe(false);
  });

  it("matches wildcard *", () => {
    expect(etagMatches("*", 'W/"anything"')).toBe(true);
  });

  it("matches within comma-separated list", () => {
    const etag = 'W/"target1234567890"';
    const header = 'W/"other1234567890", W/"target1234567890", W/"third1234567890"';
    expect(etagMatches(header, etag)).toBe(true);
  });

  it("does not match when absent from list", () => {
    const header = 'W/"aaa", W/"bbb"';
    expect(etagMatches(header, 'W/"ccc"')).toBe(false);
  });

  it("handles whitespace variations in comma-separated list", () => {
    const etag = 'W/"abc"';
    expect(etagMatches('W/"abc",W/"def"', etag)).toBe(true);
    expect(etagMatches('  W/"abc"  ,  W/"def"  ', etag)).toBe(true);
  });
});

// ─── Unit: getCacheProfile ───────────────────────────────────

describe("getCacheProfile", () => {
  it("returns no-cache for AI routes", () => {
    const profile = getCacheProfile("/api/ai/sentiment/bitcoin");
    expect(profile.maxAge).toBe(0);
    expect(profile.swr).toBe(0);
  });

  it("returns no-cache for agent chat routes", () => {
    const profile = getCacheProfile("/api/agents/defi-yield-farmer/chat");
    expect(profile.maxAge).toBe(0);
    expect(profile.swr).toBe(0);
  });

  it("returns long cache for static data routes", () => {
    expect(getCacheProfile("/api/categories").maxAge).toBe(3600);
    expect(getCacheProfile("/api/exchanges/list").maxAge).toBe(3600);
    expect(getCacheProfile("/api/dex/networks").maxAge).toBe(3600);
    expect(getCacheProfile("/api/security/chains").maxAge).toBe(3600);
  });

  it("returns medium cache for DeFi routes", () => {
    const profile = getCacheProfile("/api/defi/protocols");
    expect(profile.maxAge).toBe(300);
    expect(profile.swr).toBe(600);
  });

  it("returns moderate cache for news routes", () => {
    const profile = getCacheProfile("/api/news");
    expect(profile.maxAge).toBe(60);
    expect(profile.swr).toBe(120);
  });

  it("returns short cache for market data routes", () => {
    const profile = getCacheProfile("/api/coins");
    expect(profile.maxAge).toBe(30);
    expect(profile.swr).toBe(60);
  });

  it("returns default moderate cache for unknown routes", () => {
    const profile = getCacheProfile("/api/unknown-route");
    expect(profile.maxAge).toBe(60);
    expect(profile.swr).toBe(120);
  });
});

// ─── Unit: buildCacheControl ─────────────────────────────────

describe("buildCacheControl", () => {
  it("builds no-cache header for maxAge=0", () => {
    expect(buildCacheControl(0, 0)).toBe("no-cache, no-store, must-revalidate");
  });

  it("builds public header with swr", () => {
    const cc = buildCacheControl(30, 60);
    expect(cc).toBe("public, max-age=30, s-maxage=30, stale-while-revalidate=60");
  });

  it("builds public header without swr when swr=0", () => {
    const cc = buildCacheControl(3600, 0);
    expect(cc).toBe("public, max-age=3600, s-maxage=3600");
    expect(cc).not.toContain("stale-while-revalidate");
  });

  it("includes s-maxage equal to max-age for CDN caching", () => {
    const cc = buildCacheControl(300, 600);
    expect(cc).toContain("s-maxage=300");
  });
});

// ─── Integration: etagMiddleware ─────────────────────────────

function createTestApp() {
  const app = new Hono();
  app.use("/api/*", etagMiddleware);

  app.get("/api/coins", (c) => c.json({ data: [{ id: "bitcoin", price: 42000 }] }));
  app.get("/api/ai/sentiment/bitcoin", (c) => c.json({ sentiment: "bullish" }));
  app.get("/api/defi/protocols", (c) => c.json({ protocols: ["aave", "compound"] }));
  app.get("/api/categories", (c) => c.json({ categories: ["defi", "nft"] }));
  app.post("/api/ai/ask", (c) => c.json({ answer: "BTC is great" }));
  app.get("/health", (c) => c.json({ status: "ok" }));

  return app;
}

describe("etagMiddleware", () => {
  const app = createTestApp();

  it("sets ETag header on successful GET JSON responses", async () => {
    const res = await app.request("/api/coins");
    expect(res.status).toBe(200);
    const etag = res.headers.get("ETag");
    expect(etag).toBeTruthy();
    expect(etag).toMatch(/^W\/"[0-9a-f]{16}"$/);
  });

  it("sets Cache-Control header based on route profile", async () => {
    const res = await app.request("/api/coins");
    const cc = res.headers.get("Cache-Control");
    expect(cc).toContain("max-age=30");
    expect(cc).toContain("stale-while-revalidate=60");
  });

  it("sets no-cache for AI routes", async () => {
    const res = await app.request("/api/ai/sentiment/bitcoin");
    const cc = res.headers.get("Cache-Control");
    expect(cc).toContain("no-cache");
    expect(cc).toContain("no-store");
  });

  it("sets long cache for static routes", async () => {
    const res = await app.request("/api/categories");
    const cc = res.headers.get("Cache-Control");
    expect(cc).toContain("max-age=3600");
  });

  it("sets medium cache for DeFi routes", async () => {
    const res = await app.request("/api/defi/protocols");
    const cc = res.headers.get("Cache-Control");
    expect(cc).toContain("max-age=300");
    expect(cc).toContain("stale-while-revalidate=600");
  });

  it("sets Vary header including Accept-Encoding and If-None-Match", async () => {
    const res = await app.request("/api/coins");
    const vary = res.headers.get("Vary");
    expect(vary).toContain("Accept-Encoding");
    expect(vary).toContain("If-None-Match");
  });

  it("returns 304 Not Modified when If-None-Match matches ETag", async () => {
    // First request to get the ETag
    const res1 = await app.request("/api/coins");
    const etag = res1.headers.get("ETag");
    expect(etag).toBeTruthy();

    // Second request with matching If-None-Match
    const res2 = await app.request("/api/coins", {
      headers: { "If-None-Match": etag! },
    });
    expect(res2.status).toBe(304);

    // 304 should have no body
    const body = await res2.text();
    expect(body).toBe("");
  });

  it("304 response preserves ETag and Cache-Control headers", async () => {
    const res1 = await app.request("/api/coins");
    const etag = res1.headers.get("ETag");

    const res2 = await app.request("/api/coins", {
      headers: { "If-None-Match": etag! },
    });
    expect(res2.status).toBe(304);
    expect(res2.headers.get("ETag")).toBe(etag);
    expect(res2.headers.get("Cache-Control")).toContain("max-age=30");
  });

  it("returns 200 when If-None-Match does not match", async () => {
    const res = await app.request("/api/coins", {
      headers: { "If-None-Match": 'W/"0000000000000000"' },
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as Record<string, any>;
    expect(data).toBeTruthy();
  });

  it("does not set ETag on POST requests", async () => {
    const res = await app.request("/api/ai/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: "what is BTC?" }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("ETag")).toBeNull();
  });

  it("does not apply to non-API routes", async () => {
    const res = await app.request("/health");
    expect(res.headers.get("ETag")).toBeNull();
    expect(res.headers.get("Cache-Control")).toBeNull();
  });

  it("returns consistent ETags for same response body", async () => {
    const res1 = await app.request("/api/coins");
    const res2 = await app.request("/api/coins");
    expect(res1.headers.get("ETag")).toBe(res2.headers.get("ETag"));
  });

  it("handles wildcard If-None-Match header", async () => {
    const res = await app.request("/api/coins", {
      headers: { "If-None-Match": "*" },
    });
    expect(res.status).toBe(304);
  });

  it("handles comma-separated If-None-Match with the correct ETag", async () => {
    const res1 = await app.request("/api/coins");
    const etag = res1.headers.get("ETag");

    const res2 = await app.request("/api/coins", {
      headers: { "If-None-Match": `W/"0000000000000000", ${etag}, W/"1111111111111111"` },
    });
    expect(res2.status).toBe(304);
  });
});
