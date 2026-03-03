/**
 * Integration tests for API Key Management routes.
 *
 * Mocks the auth module so no real key store is used.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";

// ─── Mock auth module BEFORE importing routes ────────────────

vi.mock("../../lib/auth.js", () => ({
  requireAdmin: vi.fn(() => async (c: any, next: any) => {
    // Simulate admin middleware — by default allow through
    await next();
  }),
  lookupKey: vi.fn(),
  addKey: vi.fn(),
  getUsage: vi.fn(),
  isAdmin: vi.fn().mockReturnValue(true),
  TIER_LIMITS: {
    public: { rateLimit: 100, dailyLimit: 1000 },
    basic: { rateLimit: 500, dailyLimit: 5000 },
    pro: { rateLimit: 2000, dailyLimit: 20000 },
    enterprise: { rateLimit: 10000, dailyLimit: 100000 },
  },
}));

vi.mock("../../lib/validation.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/validation.js")>();
  return { ...actual };
});

import * as auth from "../../lib/auth.js";
import { keysRoutes } from "../keys.js";

const app = new Hono();
// The keys routes define full paths like /api/keys, so mount at root
app.route("/", keysRoutes);

beforeEach(() => {
  vi.clearAllMocks();
  // Re-set requireAdmin to allow through by default
  vi.mocked(auth.requireAdmin).mockReturnValue(async (c: any, next: any) => {
    await next();
  });
});

// ═══════════════════════════════════════════════════════════════
// POST /api/keys — Generate a new API key
// ═══════════════════════════════════════════════════════════════

describe("POST /api/keys", () => {
  it("generates a new API key with default tier", async () => {
    vi.mocked(auth.addKey).mockResolvedValue(undefined);

    const res = await app.request("/api/keys", {
      method: "POST",
    });
    expect(res.status).toBe(201);

    const json = await res.json();
    expect(json.key).toMatch(/^cv_basic_/);
    expect(json.tier).toBe("basic");
    expect(json).toHaveProperty("rateLimit");
    expect(json).toHaveProperty("createdAt");
    expect(json).toHaveProperty("message");
    expect(auth.addKey).toHaveBeenCalledTimes(1);
  });

  it("generates a key with specified tier", async () => {
    vi.mocked(auth.addKey).mockResolvedValue(undefined);

    const res = await app.request("/api/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tier: "pro" }),
    });
    expect(res.status).toBe(201);

    const json = await res.json();
    expect(json.key).toMatch(/^cv_pro_/);
    expect(json.tier).toBe("pro");
  });

  it("returns 400 for invalid tier", async () => {
    const res = await app.request("/api/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tier: "invalid_tier" }),
    });
    expect(res.status).toBe(400);
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/keys/usage — Usage stats
// ═══════════════════════════════════════════════════════════════

describe("GET /api/keys/usage", () => {
  it("returns public tier info when no API key provided", async () => {
    const res = await app.request("/api/keys/usage");
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.tier).toBe("public");
    expect(json.usage).toBeNull();
    expect(json.message).toContain("No API key");
  });

  it("returns usage stats for a valid API key", async () => {
    vi.mocked(auth.lookupKey).mockResolvedValue({
      key: "cv_basic_test123",
      tier: "basic",
      createdAt: "2026-01-01T00:00:00Z",
    } as any);
    vi.mocked(auth.getUsage).mockReturnValue({
      requests: 42,
      windowStart: Date.now() - 60000,
    } as any);

    // Simulate middleware setting apiKey on context
    const testApp = new Hono();
    testApp.use("*", async (c, next) => {
      c.set("apiKey", "cv_basic_test123");
      c.set("apiTier", "basic");
      await next();
    });
    testApp.route("/", keysRoutes);

    const res = await testApp.request("/api/keys/usage");
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.tier).toBe("basic");
    expect(json.usage.requests).toBe(42);
    expect(json.usage).toHaveProperty("remaining");
    expect(json).toHaveProperty("createdAt");
  });

  it("returns 401 for invalid API key", async () => {
    vi.mocked(auth.lookupKey).mockResolvedValue(undefined);

    const testApp = new Hono();
    testApp.use("*", async (c, next) => {
      c.set("apiKey", "cv_invalid_key");
      c.set("apiTier", "basic");
      await next();
    });
    testApp.route("/", keysRoutes);

    const res = await testApp.request("/api/keys/usage");
    expect(res.status).toBe(401);

    const json = await res.json();
    expect(json.error).toBe("INVALID_API_KEY");
  });

  it("returns zero usage when no usage record exists", async () => {
    vi.mocked(auth.lookupKey).mockResolvedValue({
      key: "cv_pro_newkey",
      tier: "pro",
      createdAt: "2026-03-01T00:00:00Z",
    } as any);
    vi.mocked(auth.getUsage).mockReturnValue(undefined);

    const testApp = new Hono();
    testApp.use("*", async (c, next) => {
      c.set("apiKey", "cv_pro_newkey");
      c.set("apiTier", "pro");
      await next();
    });
    testApp.route("/", keysRoutes);

    const res = await testApp.request("/api/keys/usage");
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.usage.requests).toBe(0);
    expect(json.usage.remaining).toBe(auth.TIER_LIMITS.pro.rateLimit);
  });
});
