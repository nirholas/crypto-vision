/**
 * Unit tests for search analytics (src/lib/search-analytics.ts).
 *
 * Verifies fire-and-forget BigQuery logging for search events
 * and click-through tracking.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Mock BigQuery ───────────────────────────────────────────

vi.mock("../bigquery.js", () => ({
  insertRows: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../logger.js", () => ({
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { insertRows } from "../bigquery.js";
import { logSearch, logSearchClick } from "../search-analytics.js";

beforeEach(() => {
  vi.clearAllMocks();
});

// ═══════════════════════════════════════════════════════════════
// logSearch
// ═══════════════════════════════════════════════════════════════

describe("logSearch", () => {
  it("inserts a row to search_analytics table", () => {
    logSearch("bitcoin", "price_lookup", 5, 42);

    expect(insertRows).toHaveBeenCalledWith("search_analytics", [
      expect.objectContaining({
        query: "bitcoin",
        intent: "price_lookup",
        result_count: 5,
        search_time_ms: 42,
        clicked_result: null,
        searched_at: expect.any(String),
      }),
    ]);
  });

  it("truncates long queries to 500 chars", () => {
    const longQuery = "a".repeat(1000);
    logSearch(longQuery, "general", 0, 10);

    const [, rows] = vi.mocked(insertRows).mock.calls[0];
    expect((rows[0] as { query: string }).query).toHaveLength(500);
  });

  it("rounds search_time_ms to integer", () => {
    logSearch("test", "general", 1, 42.7);

    const [, rows] = vi.mocked(insertRows).mock.calls[0];
    expect((rows[0] as { search_time_ms: number }).search_time_ms).toBe(43);
  });

  it("includes result_types when provided", () => {
    logSearch("test", "general", 3, 50, undefined, ["coin", "protocol", "news"]);

    const [, rows] = vi.mocked(insertRows).mock.calls[0];
    expect((rows[0] as { result_types: string }).result_types).toBe("coin,protocol,news");
  });

  it("does not throw when BigQuery fails", async () => {
    vi.mocked(insertRows).mockRejectedValue(new Error("BQ down"));

    // Should not throw
    expect(() => logSearch("test", "general", 0, 10)).not.toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════
// logSearchClick
// ═══════════════════════════════════════════════════════════════

describe("logSearchClick", () => {
  it("inserts a click event row", () => {
    logSearchClick("bitcoin", "price_lookup", "coin:bitcoin");

    expect(insertRows).toHaveBeenCalledWith("search_analytics", [
      expect.objectContaining({
        query: "bitcoin",
        intent: "price_lookup",
        clicked_result: "coin:bitcoin",
        result_count: 0,
        search_time_ms: 0,
      }),
    ]);
  });

  it("does not throw when BigQuery fails", async () => {
    vi.mocked(insertRows).mockRejectedValue(new Error("BQ down"));

    expect(() => logSearchClick("test", "general", "coin:test")).not.toThrow();
  });
});
