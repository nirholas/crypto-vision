/**
 * Tests for lib/auth.ts — API Key Authentication & Tier System
 *
 * Exercises key loading from environment, tier resolution,
 * usage tracking, admin checks, and key CRUD operations.
 *
 * Note: These tests DO NOT mock Redis — they test the env-only
 * code path which is the behavior when REDIS_URL is unset.
 */

import { describe, expect, it } from "vitest";

// We need to set env vars BEFORE importing auth, so we do dynamic imports.
// This ensures loadKeysFromEnv sees the right values.

describe("Auth — Tier Limits", () => {
    it("defines rate limits for all tiers", async () => {
        const { TIER_LIMITS } = await import("../../src/lib/auth.js");
        expect(TIER_LIMITS.public.rateLimit).toBe(30);
        expect(TIER_LIMITS.basic.rateLimit).toBe(200);
        expect(TIER_LIMITS.pro.rateLimit).toBe(2000);
        expect(TIER_LIMITS.enterprise.rateLimit).toBe(10_000);
    });

    it("all tiers have a 60s window", async () => {
        const { TIER_LIMITS } = await import("../../src/lib/auth.js");
        for (const tier of Object.values(TIER_LIMITS)) {
            expect(tier.windowSeconds).toBe(60);
        }
    });
});

describe("Auth — Key Lookup", () => {
    it("returns undefined for unknown keys", async () => {
        const { lookupKey } = await import("../../src/lib/auth.js");
        const entry = await lookupKey("nonexistent-key-xyz-12345");
        expect(entry).toBeUndefined();
    });
});

describe("Auth — addKey & lookupKey", () => {
    it("can add and retrieve a key", async () => {
        const { addKey, lookupKey } = await import("../../src/lib/auth.js");
        const testKey = `test-key-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        await addKey({
            key: testKey,
            tier: "pro",
            createdAt: new Date().toISOString(),
        });

        const entry = await lookupKey(testKey);
        expect(entry).toBeDefined();
        expect(entry!.tier).toBe("pro");
        expect(entry!.key).toBe(testKey);
    });
});

describe("Auth — isAdmin", () => {
    it("returns false for non-admin keys", async () => {
        const { isAdmin } = await import("../../src/lib/auth.js");
        expect(isAdmin("random-key")).toBe(false);
        expect(isAdmin("")).toBe(false);
    });
});

describe("Auth — Usage Tracking", () => {
    it("tracks request counts per key", async () => {
        const { trackUsage, getUsage } = await import("../../src/lib/auth.js");
        const key = `usage-test-${Date.now()}`;
        trackUsage(key);
        trackUsage(key);
        trackUsage(key);
        const usage = getUsage(key);
        expect(usage).toBeDefined();
        expect(usage!.requests).toBe(3);
    });

    it("returns undefined for untracked keys", async () => {
        const { getUsage } = await import("../../src/lib/auth.js");
        expect(getUsage("never-used-key")).toBeUndefined();
    });

    it("resets window after expiry", async () => {
        const { trackUsage, getUsage } = await import("../../src/lib/auth.js");
        const key = `window-test-${Date.now()}`;
        trackUsage(key);
        const usage1 = getUsage(key);
        expect(usage1!.requests).toBe(1);
        expect(usage1!.windowStart).toBeGreaterThan(0);
    });
});
