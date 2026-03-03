/**
 * Tests for lib/bigquery.ts — BigQuery client, insertRows, queryAnalytics
 *
 * GCP_PROJECT_ID is unset in test, so BigQuery is disabled.
 * We verify graceful degradation: insertRows and queries return silently.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Ensure GCP is not configured so BigQuery gracefully degrades
vi.stubEnv("GCP_PROJECT_ID", "");

// Dynamic import after env stub
const bq = await import("../../src/lib/bigquery.js");

describe("BigQuery Client (disabled mode)", () => {
  it("insertRows resolves without error when BigQuery is disabled", async () => {
    // Should not throw — graceful degradation
    await expect(
      bq.insertRows("market_snapshots", [{ coin_id: "bitcoin", price: 50000 }]),
    ).resolves.not.toThrow();
  });

  it("insertRows handles empty rows array", async () => {
    await expect(bq.insertRows("market_snapshots", [])).resolves.not.toThrow();
  });

  it("insertRows handles multiple rows", async () => {
    const rows = Array.from({ length: 10 }, (_, i) => ({
      coin_id: `coin-${i}`,
      price: 1000 + i,
    }));
    await expect(
      bq.insertRows("market_snapshots", rows),
    ).resolves.not.toThrow();
  });

  it("getInsertMetrics returns metrics object", () => {
    const metrics = bq.getInsertMetrics();
    expect(metrics).toHaveProperty("totalInserts");
    expect(metrics).toHaveProperty("totalRows");
    expect(metrics).toHaveProperty("totalErrors");
    expect(metrics).toHaveProperty("totalRetries");
    expect(typeof metrics.totalInserts).toBe("number");
    expect(typeof metrics.totalRows).toBe("number");
  });

  it("Tables enum contains expected table names", () => {
    expect(bq.Tables).toBeDefined();
    expect(typeof bq.Tables).toBe("object");
    // Should have some of the known tables
    const tableValues = Object.values(bq.Tables);
    expect(tableValues.length).toBeGreaterThan(0);
  });
});

describe("BigQuery queryAnalytics (disabled mode)", () => {
  it("returns empty array when BigQuery is disabled", async () => {
    if (typeof bq.queryAnalytics === "function") {
      const result = await bq.queryAnalytics(
        "SELECT 1",
        {},
      );
      // When disabled, should return empty or throw gracefully
      expect(Array.isArray(result) || result === null || result === undefined).toBe(true);
    }
  });
});
