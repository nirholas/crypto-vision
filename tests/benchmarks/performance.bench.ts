/**
 * Performance Benchmarks — Cache, Queue, and Anomaly Engine
 *
 * Micro-benchmarks for hot paths using Vitest bench mode.
 * Run with: npx vitest bench tests/benchmarks/
 */

import { bench, describe, beforeAll, afterAll } from "vitest";
import { cache } from "../../src/lib/cache.js";
import { RequestQueue } from "../../src/lib/queue.js";
import { anomalyEngine, SlidingWindow } from "../../src/lib/anomaly.js";

// ─── Cache Benchmarks ────────────────────────────────────────

describe("Cache Performance", () => {
  beforeAll(async () => {
    await cache.set("bench-key", { data: "test-value" }, 3600);
  });

  afterAll(async () => {
    await cache.del("bench-key");
  });

  bench("cache.get (hit)", async () => {
    await cache.get("bench-key");
  });

  bench("cache.set", async () => {
    await cache.set(`bench-${Math.random()}`, { data: "value" }, 60);
  });

  bench("cache.get (miss)", async () => {
    await cache.get(`nonexistent-${Math.random()}`);
  });

  bench("cache.wrap (hit)", async () => {
    await cache.wrap("bench-key", 3600, async () => "fallback");
  });

  bench("cache.del", async () => {
    const key = `bench-del-${Math.random()}`;
    await cache.set(key, "x", 60);
    await cache.del(key);
  });
});

// ─── Queue Benchmarks ────────────────────────────────────────

describe("Queue Performance", () => {
  const q = new RequestQueue({ concurrency: 100, maxQueue: 10000, timeout: 5000 });

  bench("queue.execute (instant resolve)", async () => {
    await q.execute(() => Promise.resolve(42));
  });

  bench("queue.execute (1ms delay)", async () => {
    await q.execute(
      () => new Promise((r) => setTimeout(() => r(42), 1)),
    );
  });

  bench("queue.stats()", () => {
    q.stats();
  });
});

// ─── SlidingWindow Benchmarks ────────────────────────────────

describe("SlidingWindow Performance", () => {
  let window: SlidingWindow;

  beforeAll(() => {
    window = new SlidingWindow(1000);
    for (let i = 0; i < 1000; i++) {
      window.add(50000 + Math.random() * 1000);
    }
  });

  bench("window.add (at capacity)", () => {
    window.add(50000 + Math.random() * 1000);
  });

  bench("window.mean", () => {
    void window.mean;
  });

  bench("window.median", () => {
    void window.median;
  });

  bench("window.std", () => {
    void window.std;
  });

  bench("window.modifiedZScore", () => {
    window.modifiedZScore(55000);
  });

  bench("window.ewma", () => {
    window.ewma(0.1);
  });
});

// ─── Anomaly Engine Benchmarks ───────────────────────────────

describe("AnomalyEngine Performance", () => {
  beforeAll(() => {
    anomalyEngine.reset();
    // Pre-populate with baseline data
    for (let i = 0; i < 100; i++) {
      anomalyEngine.ingest(
        "price_spike",
        "bench-coin",
        "price_usd",
        50000 + Math.random() * 100,
      );
    }
  });

  afterAll(() => {
    anomalyEngine.reset();
  });

  bench("anomalyEngine.ingest (normal value)", () => {
    anomalyEngine.ingest(
      "price_spike",
      "bench-coin",
      "price_usd",
      50000 + Math.random() * 100,
    );
  });

  bench("anomalyEngine.ingest (new asset)", () => {
    anomalyEngine.ingest(
      "price_spike",
      `coin-${Math.random()}`,
      "price_usd",
      50000,
    );
  });

  bench("anomalyEngine.stats()", () => {
    anomalyEngine.stats();
  });
});
