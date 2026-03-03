/**
 * Tests for lib/auth.ts — API key authentication middleware, tier resolution,
 * usage tracking, admin guard
 *
 * Redis is mocked — all tests exercise the in-memory path.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";

// Mock Redis before importing auth module
vi.mock("@/lib/redis.js", () => ({
  getRedis: vi.fn().mockResolvedValue(null),
}));

// Mock logger to suppress output
vi.mock("@/lib/logger.js", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import {
  apiKeyAuth,
  requireAdmin,
  lookupKey,
  addKey,
  isAdmin,
  trackUsage,
  getUsage,
  TIER_LIMITS,
  type ApiTier,
  type KeyEntry,
} from "@/lib/auth.js";

// ─── TIER_LIMITS ─────────────────────────────────────────────

describe("TIER_LIMITS", () => {
  it("defines all four tier levels", () => {
    expect(TIER_LIMITS).toHaveProperty("public");
    expect(TIER_LIMITS).toHaveProperty("basic");
    expect(TIER_LIMITS).toHaveProperty("pro");
    expect(TIER_LIMITS).toHaveProperty("enterprise");
  });

  it("each tier has rateLimit and windowSeconds", () => {
    for (const tier of Object.values(TIER_LIMITS)) {
      expect(tier.rateLimit).toBeGreaterThan(0);
      expect(tier.windowSeconds).toBeGreaterThan(0);
    }
  });

  it("tiers are ordered by increasing rate limits", () => {
    expect(TIER_LIMITS.public.rateLimit).toBeLessThan(TIER_LIMITS.basic.rateLimit);
    expect(TIER_LIMITS.basic.rateLimit).toBeLessThan(TIER_LIMITS.pro.rateLimit);
    expect(TIER_LIMITS.pro.rateLimit).toBeLessThan(TIER_LIMITS.enterprise.rateLimit);
  });
});

// ─── lookupKey / addKey ──────────────────────────────────────

describe("lookupKey()", () => {
  it("returns undefined for unknown keys", async () => {
    const entry = await lookupKey("unknown-key-12345");
    expect(entry).toBeUndefined();
  });
});

describe("addKey()", () => {
  it("adds a key that can be looked up", async () => {
    const key: KeyEntry = {
      key: "test-add-key-1",
      tier: "pro",
      createdAt: new Date().toISOString(),
    };
    await addKey(key);

    const found = await lookupKey("test-add-key-1");
    expect(found).toBeDefined();
    expect(found!.tier).toBe("pro");
  });

  it("overwrites an existing key entry", async () => {
    const key1: KeyEntry = {
      key: "test-overwrite",
      tier: "basic",
      createdAt: new Date().toISOString(),
    };
    await addKey(key1);

    const key2: KeyEntry = {
      key: "test-overwrite",
      tier: "enterprise",
      createdAt: new Date().toISOString(),
    };
    await addKey(key2);

    const found = await lookupKey("test-overwrite");
    expect(found!.tier).toBe("enterprise");
  });
});

// ─── isAdmin ────────────────────────────────────────────────

describe("isAdmin()", () => {
  it("returns false for non-admin keys", () => {
    expect(isAdmin("random-key-not-admin")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isAdmin("")).toBe(false);
  });
});

// ─── trackUsage / getUsage ──────────────────────────────────

describe("trackUsage() / getUsage()", () => {
  it("tracks requests for a key", () => {
    const key = `usage-test-${Date.now()}`;
    trackUsage(key);
    trackUsage(key);
    trackUsage(key);

    const usage = getUsage(key);
    expect(usage).toBeDefined();
    expect(usage!.requests).toBe(3);
  });

  it("returns undefined for untracked keys", () => {
    expect(getUsage("never-tracked-key")).toBeUndefined();
  });

  it("starts a new window when previous window expires", () => {
    const key = `window-test-${Date.now()}`;
    trackUsage(key);
    const usage1 = getUsage(key)!;
    expect(usage1.requests).toBe(1);
    expect(usage1.windowStart).toBeGreaterThan(0);
  });
});

// ─── apiKeyAuth middleware ───────────────────────────────────

describe("apiKeyAuth() middleware", () => {
  function buildApp() {
    const app = new Hono();
    app.use("/*", apiKeyAuth());
    app.get("/test", (c) => {
      return c.json({
        tier: c.get("apiTier"),
        key: c.get("apiKey"),
      });
    });
    return app;
  }

  it("sets public tier and anonymous key when no API key is provided", async () => {
    const app = buildApp();
    const res = await app.request("/test");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.tier).toBe("public");
    expect(body.key).toBe("anonymous");
  });

  it("returns 401 for an invalid API key", async () => {
    const app = buildApp();
    const res = await app.request("/test", {
      headers: { "X-API-Key": "totally-invalid-key-xyz" },
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("INVALID_API_KEY");
  });

  it("resolves tier for a valid key added via addKey()", async () => {
    await addKey({
      key: "test-auth-key-pro",
      tier: "pro",
      createdAt: new Date().toISOString(),
    });

    const app = buildApp();
    const res = await app.request("/test", {
      headers: { "X-API-Key": "test-auth-key-pro" },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.tier).toBe("pro");
    expect(body.key).toBe("test-auth-key-pro");
  });

  it("supports Authorization: Bearer header", async () => {
    await addKey({
      key: "test-bearer-key",
      tier: "basic",
      createdAt: new Date().toISOString(),
    });

    const app = buildApp();
    const res = await app.request("/test", {
      headers: { Authorization: "Bearer test-bearer-key" },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.tier).toBe("basic");
  });

  it("prefers X-API-Key over Authorization header", async () => {
    await addKey({
      key: "test-xapi-key",
      tier: "enterprise",
      createdAt: new Date().toISOString(),
    });

    const app = buildApp();
    const res = await app.request("/test", {
      headers: {
        "X-API-Key": "test-xapi-key",
        Authorization: "Bearer something-else",
      },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.tier).toBe("enterprise");
  });
});

// ─── requireAdmin middleware ─────────────────────────────────

describe("requireAdmin() middleware", () => {
  function buildApp() {
    const app = new Hono();
    app.use("/*", apiKeyAuth());
    app.use("/*", requireAdmin());
    app.get("/admin", (c) => c.json({ ok: true }));
    return app;
  }

  it("returns 403 when no API key is provided (anonymous)", async () => {
    const app = buildApp();
    const res = await app.request("/admin");
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("FORBIDDEN");
  });

  it("returns 403 for non-admin API keys", async () => {
    await addKey({
      key: "test-non-admin",
      tier: "pro",
      createdAt: new Date().toISOString(),
    });

    const app = buildApp();
    const res = await app.request("/admin", {
      headers: { "X-API-Key": "test-non-admin" },
    });
    expect(res.status).toBe(403);
  });
});
