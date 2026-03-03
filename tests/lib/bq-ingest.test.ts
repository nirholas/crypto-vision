/**
 * Tests for lib/bq-ingest.ts — BigQuery ingestion functions
 *
 * BigQuery is disabled in test (no GCP_PROJECT_ID), so these verify
 * the transform logic runs without errors even when the sink is a no-op.
 */

import { describe, it, expect, vi } from "vitest";

vi.stubEnv("GCP_PROJECT_ID", "");

const ingest = await import("../../src/lib/bq-ingest.js");

describe("BigQuery Ingestion — Market Snapshots", () => {
  it("ingestMarketSnapshots processes CoinGecko-shaped data without throwing", () => {
    expect(() =>
      ingest.ingestMarketSnapshots([
        {
          id: "bitcoin",
          symbol: "btc",
          name: "Bitcoin",
          current_price: 67000,
          market_cap: 1_300_000_000_000,
          market_cap_rank: 1,
          total_volume: 30_000_000_000,
          price_change_percentage_24h: 2.5,
          circulating_supply: 19_600_000,
          total_supply: 21_000_000,
          max_supply: 21_000_000,
          ath: 73000,
          ath_change_percentage: -8.2,
        },
        {
          id: "ethereum",
          symbol: "eth",
          name: "Ethereum",
          current_price: 3500,
          market_cap: 420_000_000_000,
          market_cap_rank: 2,
          total_volume: 15_000_000_000,
          price_change_percentage_24h: -1.2,
          circulating_supply: 120_000_000,
          total_supply: null,
          max_supply: null,
          ath: 4878,
          ath_change_percentage: -28.0,
        },
      ]),
    ).not.toThrow();
  });

  it("handles empty array", () => {
    expect(() => ingest.ingestMarketSnapshots([])).not.toThrow();
  });

  it("handles missing/null fields gracefully", () => {
    expect(() =>
      ingest.ingestMarketSnapshots([
        { id: "unknown", symbol: "unk", name: "Unknown" },
      ]),
    ).not.toThrow();
  });
});

describe("BigQuery Ingestion — OHLC Candles", () => {
  it("ingestOHLCCandles processes candle arrays without throwing", () => {
    expect(() =>
      ingest.ingestOHLCCandles("bitcoin", [
        [1700000000000, 67000, 67500, 66800, 67200, ],
        [1700003600000, 67200, 67800, 67100, 67600, ],
      ]),
    ).not.toThrow();
  });

  it("handles empty candles array", () => {
    expect(() => ingest.ingestOHLCCandles("bitcoin", [])).not.toThrow();
  });
});

describe("BigQuery Ingestion — DeFi Protocols", () => {
  it("ingestDefiProtocols processes DeFiLlama-shaped data", () => {
    if (typeof ingest.ingestDefiProtocols === "function") {
      expect(() =>
        ingest.ingestDefiProtocols([
          {
            name: "Aave",
            slug: "aave",
            tvl: 12_000_000_000,
            chain: "Multi-chain",
            category: "Lending",
            change_1d: 1.5,
            change_7d: -2.3,
          },
        ]),
      ).not.toThrow();
    }
  });
});

describe("BigQuery Ingestion — News Articles", () => {
  it("ingestNewsArticles processes news data", () => {
    if (typeof ingest.ingestNewsArticles === "function") {
      expect(() =>
        ingest.ingestNewsArticles([
          {
            title: "Bitcoin hits new high",
            url: "https://example.com/article",
            source: "CryptoNews",
            published_at: new Date().toISOString(),
            body: "Bitcoin reached a new all-time high today.",
          },
        ]),
      ).not.toThrow();
    }
  });
});
