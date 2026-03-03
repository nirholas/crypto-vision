import { describe, it, expect } from "vitest";
import { cache } from "../cache.js";

describe("cache", () => {
  it("wrap() stores and returns values", async () => {
    const result = await cache.wrap("test-key-1", 60, async () => "hello");
    expect(result).toBe("hello");

    // Second call should return cached value without calling fn
    let fnCalled = false;
    const cached = await cache.wrap("test-key-1", 60, async () => {
      fnCalled = true;
      return "world";
    });
    expect(cached).toBe("hello");
    expect(fnCalled).toBe(false);
  });

  it("get() returns null for missing keys", async () => {
    const result = await cache.get("nonexistent-key");
    expect(result).toBeNull();
  });

  it("stats() returns expected shape", () => {
    const stats = cache.stats();
    expect(stats).toHaveProperty("memoryEntries");
    expect(stats).toHaveProperty("redisConnected");
    expect(typeof stats.memoryEntries).toBe("number");
    expect(typeof stats.redisConnected).toBe("boolean");
  });
});
