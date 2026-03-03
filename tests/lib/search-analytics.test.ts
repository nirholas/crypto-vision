/**
 * Tests for lib/search-analytics.ts — Search analytics logging
 *
 * BigQuery is disabled in test — we verify functions run without throwing
 * and handle edge cases gracefully (fire-and-forget pattern).
 */

import { describe, it, expect, vi } from "vitest";

vi.stubEnv("GCP_PROJECT_ID", "");

const { logSearch, logSearchClick } = await import(
  "../../src/lib/search-analytics.js"
);

describe("logSearch", () => {
  it("logs a search event without throwing", () => {
    expect(() =>
      logSearch("bitcoin price", "price_lookup", 15, 120),
    ).not.toThrow();
  });

  it("handles zero results", () => {
    expect(() =>
      logSearch("nonexistent coin xyz", "general", 0, 50),
    ).not.toThrow();
  });

  it("handles optional click and result types", () => {
    expect(() =>
      logSearch(
        "aave tvl",
        "protocol_search",
        5,
        200,
        "protocol:aave",
        ["protocol", "coin"],
      ),
    ).not.toThrow();
  });

  it("truncates very long queries without throwing", () => {
    const longQuery = "a".repeat(2000);
    expect(() => logSearch(longQuery, "general", 0, 10)).not.toThrow();
  });
});

describe("logSearchClick", () => {
  it("logs a click event without throwing", () => {
    expect(() =>
      logSearchClick("bitcoin", "price_lookup", "coin:bitcoin"),
    ).not.toThrow();
  });

  it("handles empty strings", () => {
    expect(() => logSearchClick("", "", "")).not.toThrow();
  });
});
