/**
 * Tests for lib/pubsub.ts — Google Cloud Pub/Sub publisher
 *
 * GCP_PROJECT_ID and PUBSUB_EMULATOR_HOST are unset in test,
 * so Pub/Sub is disabled. We verify graceful degradation.
 */

import { describe, it, expect, vi, afterAll } from "vitest";

vi.stubEnv("GCP_PROJECT_ID", "");
vi.stubEnv("PUBSUB_EMULATOR_HOST", "");

const { publish, publishBatch, getPubSubMetrics, closePubSub, Topics } =
  await import("../../src/lib/pubsub.js");

// ─── Topics ──────────────────────────────────────────────────

describe("Topics", () => {
  it("defines all expected topic name constants", () => {
    expect(Topics.REALTIME).toBe("crypto-vision-realtime");
    expect(Topics.FREQUENT).toBe("crypto-vision-frequent");
    expect(Topics.STANDARD).toBe("crypto-vision-standard");
    expect(Topics.HOURLY).toBe("crypto-vision-hourly");
    expect(Topics.DAILY).toBe("crypto-vision-daily");
  });
});

// ─── publish (disabled mode) ─────────────────────────────────

describe("publish (Pub/Sub disabled)", () => {
  it("resolves silently when Pub/Sub is unavailable", async () => {
    await expect(
      publish(Topics.REALTIME, { source: "test", type: "price", value: 50000 }),
    ).resolves.toBeUndefined();
  });

  it("handles various data shapes", async () => {
    await expect(
      publish(Topics.STANDARD, { nested: { deep: { value: true } } }),
    ).resolves.toBeUndefined();
  });

  it("handles extra attributes", async () => {
    await expect(
      publish(
        Topics.FREQUENT,
        { source: "coingecko", data: [] },
        { priority: "high", category: "market" },
      ),
    ).resolves.toBeUndefined();
  });
});

// ─── publishBatch (disabled mode) ────────────────────────────

describe("publishBatch (Pub/Sub disabled)", () => {
  it("resolves silently for empty batch", async () => {
    await expect(publishBatch(Topics.DAILY, [])).resolves.toBeUndefined();
  });

  it("resolves silently for non-empty batch", async () => {
    const items = [
      { source: "test", coin: "bitcoin", price: 50000 },
      { source: "test", coin: "ethereum", price: 3500 },
      { source: "test", coin: "solana", price: 120 },
    ];
    await expect(
      publishBatch(Topics.HOURLY, items),
    ).resolves.toBeUndefined();
  });
});

// ─── getPubSubMetrics ────────────────────────────────────────

describe("getPubSubMetrics", () => {
  it("returns a metrics object", () => {
    const metrics = getPubSubMetrics();
    expect(metrics).toHaveProperty("enabled");
    expect(metrics).toHaveProperty("totalPublished");
    expect(metrics).toHaveProperty("totalErrors");
    expect(metrics).toHaveProperty("totalBatches");
    expect(metrics).toHaveProperty("avgLatencyMs");
    expect(metrics).toHaveProperty("lastPublishAt");
  });

  it("reports disabled when no GCP credentials", () => {
    const metrics = getPubSubMetrics();
    expect(metrics.enabled).toBe(false);
  });
});

// ─── closePubSub ─────────────────────────────────────────────

describe("closePubSub", () => {
  afterAll(async () => {
    await closePubSub();
  });

  it("resolves without error even when no client is initialized", async () => {
    await expect(closePubSub()).resolves.toBeUndefined();
  });
});
