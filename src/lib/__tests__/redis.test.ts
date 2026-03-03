/**
 * Tests for lib/redis.ts — Redis client singleton, graceful degradation,
 * health check, disconnect
 *
 * Redis is NOT available in test — exercises the graceful-degradation code paths.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock logger
vi.mock("@/lib/logger.js", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Ensure REDIS_URL is cleared for graceful-degradation tests
vi.stubEnv("REDIS_URL", "");

import {
  getRedis,
  getRedisSubscriber,
  isRedisConnected,
  disconnectRedis,
} from "@/lib/redis.js";

// ─── getRedis ───────────────────────────────────────────────

describe("getRedis()", () => {
  it("returns null when REDIS_URL is not set", async () => {
    const client = await getRedis();
    expect(client).toBeNull();
  });

  it("returns null consistently on repeated calls without REDIS_URL", async () => {
    const client1 = await getRedis();
    const client2 = await getRedis();
    expect(client1).toBeNull();
    expect(client2).toBeNull();
  });
});

// ─── getRedisSubscriber ─────────────────────────────────────

describe("getRedisSubscriber()", () => {
  it("returns null when REDIS_URL is not set", async () => {
    const sub = await getRedisSubscriber();
    expect(sub).toBeNull();
  });

  it("returns null consistently on repeated calls without REDIS_URL", async () => {
    const sub1 = await getRedisSubscriber();
    const sub2 = await getRedisSubscriber();
    expect(sub1).toBeNull();
    expect(sub2).toBeNull();
  });
});

// ─── isRedisConnected ───────────────────────────────────────

describe("isRedisConnected()", () => {
  it("returns false when no client is connected", () => {
    expect(isRedisConnected()).toBe(false);
  });

  it("returns a boolean value", () => {
    expect(typeof isRedisConnected()).toBe("boolean");
  });
});

// ─── disconnectRedis ────────────────────────────────────────

describe("disconnectRedis()", () => {
  it("resolves without error when no connections exist", async () => {
    await expect(disconnectRedis()).resolves.toBeUndefined();
  });

  it("can be called multiple times safely", async () => {
    await disconnectRedis();
    await disconnectRedis();
    // No error thrown
  });
});
