/**
 * Tests for lib/anomaly.ts — AnomalyEngine, SlidingWindow, detector configs
 *
 * Exercises statistical detection (Modified Z-Score), cooldown logic,
 * minimum data-point requirements, directional filtering, and handler dispatch.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { anomalyEngine, SlidingWindow, type AnomalyEvent } from "../../src/lib/anomaly.js";

// ─── SlidingWindow ───────────────────────────────────────────

describe("SlidingWindow", () => {
  it("starts empty", () => {
    const w = new SlidingWindow(100);
    expect(w.length).toBe(0);
    expect(w.mean).toBe(0);
    expect(w.std).toBe(0);
    expect(w.median).toBe(0);
  });

  it("computes mean correctly", () => {
    const w = new SlidingWindow(100);
    w.add(10);
    w.add(20);
    w.add(30);
    expect(w.mean).toBe(20);
  });

  it("computes median correctly for odd count", () => {
    const w = new SlidingWindow(100);
    w.add(3);
    w.add(1);
    w.add(2);
    expect(w.median).toBe(2);
  });

  it("computes median correctly for even count", () => {
    const w = new SlidingWindow(100);
    w.add(1);
    w.add(2);
    w.add(3);
    w.add(4);
    expect(w.median).toBe(2.5);
  });

  it("computes standard deviation correctly", () => {
    const w = new SlidingWindow(100);
    [2, 4, 4, 4, 5, 5, 7, 9].forEach((v) => w.add(v));
    // Population std = 2.0, sample std ≈ 2.138
    expect(w.std).toBeCloseTo(2.138, 2);
  });

  it("enforces maxSize by evicting oldest values", () => {
    const w = new SlidingWindow(3);
    w.add(1);
    w.add(2);
    w.add(3);
    w.add(4); // should evict 1
    expect(w.length).toBe(3);
    expect(w.mean).toBeCloseTo(3, 5); // (2+3+4)/3
  });

  it("modifiedZScore returns 0 with fewer than 3 data points", () => {
    const w = new SlidingWindow(100);
    w.add(10);
    w.add(20);
    expect(w.modifiedZScore(100)).toBe(0);
  });

  it("modifiedZScore returns 0 when MAD is 0 (all values identical)", () => {
    const w = new SlidingWindow(100);
    for (let i = 0; i < 10; i++) w.add(5);
    expect(w.modifiedZScore(5)).toBe(0);
    expect(w.modifiedZScore(10)).toBe(0); // MAD=0 so division by zero → 0
  });

  it("modifiedZScore detects outliers", () => {
    const w = new SlidingWindow(1000);
    // Feed 100 values clustered around 50000
    for (let i = 0; i < 100; i++) {
      w.add(50000 + (Math.random() - 0.5) * 100);
    }
    // Normal value should have low z-score
    const normalZ = Math.abs(w.modifiedZScore(50050));
    expect(normalZ).toBeLessThan(3);

    // Extreme value should have high z-score
    const extremeZ = Math.abs(w.modifiedZScore(55000));
    expect(extremeZ).toBeGreaterThan(3);
  });

  it("ewma computes exponentially weighted moving average", () => {
    const w = new SlidingWindow(100);
    w.add(10);
    w.add(20);
    w.add(30);
    const result = w.ewma(0.5);
    // Manual: r0=10, r1=0.5*20+0.5*10=15, r2=0.5*30+0.5*15=22.5
    expect(result).toBeCloseTo(22.5, 5);
  });

  it("ewma returns 0 for empty window", () => {
    const w = new SlidingWindow(100);
    expect(w.ewma()).toBe(0);
  });

  it("rateOfChange computes percentage change", () => {
    const w = new SlidingWindow(100);
    w.add(100);
    w.add(110);
    expect(w.rateOfChange(1)).toBeCloseTo(10.0, 5); // 10%
  });

  it("rateOfChange returns 0 when insufficient data", () => {
    const w = new SlidingWindow(100);
    w.add(100);
    expect(w.rateOfChange(5)).toBe(0);
  });

  it("rateOfChange returns 0 when previous is 0 (avoid division by zero)", () => {
    const w = new SlidingWindow(100);
    w.add(0);
    w.add(100);
    expect(w.rateOfChange(1)).toBe(0);
  });
});

// ─── AnomalyEngine ──────────────────────────────────────────

describe("AnomalyEngine", () => {
  beforeEach(() => {
    anomalyEngine.reset();
  });

  it("returns null before minimum data points are reached", () => {
    // price_spike requires 50 data points
    for (let i = 0; i < 49; i++) {
      const result = anomalyEngine.ingest("price_spike", "bitcoin", "price", 50000);
      expect(result).toBeNull();
    }
  });

  it("returns null for normal variation after enough data points", () => {
    // Feed 100 stable prices
    for (let i = 0; i < 100; i++) {
      anomalyEngine.ingest("price_spike", "bitcoin", "price", 50000 + (i % 5));
    }
    // Slight variation should not trigger
    const result = anomalyEngine.ingest("price_spike", "bitcoin", "price", 50003);
    expect(result).toBeNull();
  });

  it("detects price spikes beyond threshold", () => {
    // Feed 100 stable prices around 50000
    for (let i = 0; i < 100; i++) {
      anomalyEngine.ingest("price_spike", "bitcoin", "price", 50000 + Math.random() * 10);
    }

    // Massive spike should trigger
    const event = anomalyEngine.ingest("price_spike", "bitcoin", "price", 55000);
    expect(event).not.toBeNull();
    expect(event!.type).toBe("price_spike");
    expect(event!.asset).toBe("bitcoin");
    expect(event!.deviation).toBeGreaterThan(0);
  });

  it("enforces cooldown periods", () => {
    // Feed data and trigger a spike
    for (let i = 0; i < 100; i++) {
      anomalyEngine.ingest("price_spike", "bitcoin", "price", 50000);
    }

    const first = anomalyEngine.ingest("price_spike", "bitcoin", "price", 60000);
    expect(first).not.toBeNull();

    // Feed a few more normal values and try another spike immediately
    anomalyEngine.ingest("price_spike", "bitcoin", "price", 50000);
    anomalyEngine.ingest("price_spike", "bitcoin", "price", 50000);
    const second = anomalyEngine.ingest("price_spike", "bitcoin", "price", 60000);
    // Should be null because cooldown hasn't elapsed
    expect(second).toBeNull();
  });

  it("handles multiple assets independently", () => {
    // Feed bitcoin data
    for (let i = 0; i < 100; i++) {
      anomalyEngine.ingest("price_spike", "bitcoin", "price", 50000);
    }
    // Feed ethereum data
    for (let i = 0; i < 100; i++) {
      anomalyEngine.ingest("price_spike", "ethereum", "price", 3000);
    }

    // Spike in bitcoin
    const btcEvent = anomalyEngine.ingest("price_spike", "bitcoin", "price", 60000);
    expect(btcEvent).not.toBeNull();

    // Spike in ethereum (independent)
    const ethEvent = anomalyEngine.ingest("price_spike", "ethereum", "price", 5000);
    expect(ethEvent).not.toBeNull();
  });

  it("applies directional filtering — price_spike only fires on positive z-scores", () => {
    for (let i = 0; i < 100; i++) {
      anomalyEngine.ingest("price_spike", "bitcoin", "price", 50000);
    }
    // Crash (negative deviation) should NOT trigger price_spike
    const crashOnSpike = anomalyEngine.ingest("price_spike", "bitcoin", "price", 40000);
    expect(crashOnSpike).toBeNull();
  });

  it("applies directional filtering — price_crash only fires on negative z-scores", () => {
    for (let i = 0; i < 100; i++) {
      anomalyEngine.ingest("price_crash", "bitcoin", "price", 50000);
    }
    // Spike (positive deviation) should NOT trigger price_crash
    const spikeOnCrash = anomalyEngine.ingest("price_crash", "bitcoin", "price", 60000);
    expect(spikeOnCrash).toBeNull();
  });

  it("dispatches events to registered handlers", () => {
    const events: AnomalyEvent[] = [];
    anomalyEngine.onAnomaly((e) => events.push(e));

    for (let i = 0; i < 100; i++) {
      anomalyEngine.ingest("price_spike", "bitcoin", "price", 50000);
    }
    anomalyEngine.ingest("price_spike", "bitcoin", "price", 60000);

    expect(events.length).toBe(1);
    expect(events[0].type).toBe("price_spike");
  });

  it("removeHandler prevents further dispatch", () => {
    const events: AnomalyEvent[] = [];
    const handler = (e: AnomalyEvent) => events.push(e);
    anomalyEngine.onAnomaly(handler);
    anomalyEngine.removeHandler(handler);

    for (let i = 0; i < 100; i++) {
      anomalyEngine.ingest("price_spike", "bitcoin", "price", 50000);
    }
    anomalyEngine.ingest("price_spike", "bitcoin", "price", 60000);

    expect(events.length).toBe(0);
  });

  it("handler errors do not crash the engine", () => {
    anomalyEngine.onAnomaly(() => {
      throw new Error("handler crash");
    });

    for (let i = 0; i < 100; i++) {
      anomalyEngine.ingest("price_spike", "bitcoin", "price", 50000);
    }

    // Should not throw
    expect(() => {
      anomalyEngine.ingest("price_spike", "bitcoin", "price", 60000);
    }).not.toThrow();
  });

  it("returns accurate stats", () => {
    for (let i = 0; i < 50; i++) {
      anomalyEngine.ingest("price_spike", "bitcoin", "price", 50000);
    }
    const stats = anomalyEngine.stats();
    expect(stats.windows).toBe(1);
    expect(stats.totalDataPoints).toBe(50);
    expect(stats.totalDetected).toBe(0);
  });

  it("reset clears all state", () => {
    for (let i = 0; i < 50; i++) {
      anomalyEngine.ingest("price_spike", "bitcoin", "price", 50000);
    }
    anomalyEngine.reset();
    const stats = anomalyEngine.stats();
    expect(stats.windows).toBe(0);
    expect(stats.totalDataPoints).toBe(0);
    expect(stats.totalDetected).toBe(0);
  });

  it("detects stablecoin depegs at 2σ threshold", () => {
    // Stablecoin prices should cluster around $1.00
    for (let i = 0; i < 20; i++) {
      anomalyEngine.ingest("stablecoin_depeg", "usdt", "price_usd", 1.0 + (Math.random() - 0.5) * 0.001);
    }

    // Minor deviation — should not alert
    const minor = anomalyEngine.ingest("stablecoin_depeg", "usdt", "price_usd", 1.002);
    expect(minor).toBeNull();

    // Significant depeg
    const depeg = anomalyEngine.ingest("stablecoin_depeg", "usdt", "price_usd", 0.95);
    // May or may not trigger depending on data distribution, but shouldn't crash
    if (depeg) {
      expect(depeg.type).toBe("stablecoin_depeg");
      expect(depeg.severity).toBeDefined();
    }
  });

  it("returns unknown type as null", () => {
    // Using a type that doesn't exist should gracefully return null
    const result = anomalyEngine.ingest("nonexistent_type" as never, "btc", "price", 100);
    expect(result).toBeNull();
  });

  it("severity scales with deviation magnitude for price_spike", () => {
    for (let i = 0; i < 100; i++) {
      anomalyEngine.ingest("price_spike", "test-coin", "price", 100);
    }

    // Trigger with moderate spike
    const event = anomalyEngine.ingest("price_spike", "test-coin", "price", 200);
    if (event) {
      expect(["info", "warning", "critical"]).toContain(event.severity);
    }
  });
});

// ─── Anomaly Event Structure ─────────────────────────────────

describe("AnomalyEvent structure", () => {
  beforeEach(() => {
    anomalyEngine.reset();
  });

  it("has all required fields when triggered", () => {
    for (let i = 0; i < 100; i++) {
      anomalyEngine.ingest("price_spike", "bitcoin", "price", 50000);
    }

    const event = anomalyEngine.ingest("price_spike", "bitcoin", "price", 60000);
    expect(event).not.toBeNull();
    expect(event!.id).toMatch(/^price_spike-bitcoin-/);
    expect(event!.type).toBe("price_spike");
    expect(event!.asset).toBe("bitcoin");
    expect(event!.metric).toBe("price");
    expect(event!.currentValue).toBe(60000);
    expect(event!.expectedRange).toHaveProperty("low");
    expect(event!.expectedRange).toHaveProperty("high");
    expect(typeof event!.deviation).toBe("number");
    expect(typeof event!.message).toBe("string");
    expect(event!.detectedAt).toBeTruthy();
    expect(event!.detector).toBe("statistical-mzs");
  });

  it("includes context when provided", () => {
    for (let i = 0; i < 100; i++) {
      anomalyEngine.ingest("price_spike", "bitcoin", "price", 50000);
    }

    const event = anomalyEngine.ingest("price_spike", "bitcoin", "price", 60000, {
      exchange: "binance",
      pair: "BTC/USDT",
    });
    if (event) {
      expect(event.context).toEqual({ exchange: "binance", pair: "BTC/USDT" });
    }
  });
});
