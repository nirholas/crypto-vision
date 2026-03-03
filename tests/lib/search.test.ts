/**
 * Tests for lib/search.ts — Unified Semantic Search Engine
 *
 * Exercises intent detection, search result types, and the detectIntent function.
 * Network-dependent search strategies are tested through integration tests.
 */

import { describe, it, expect } from "vitest";
import { detectIntent, type SearchIntent } from "../../src/lib/search.js";

// ─── Intent Detection ────────────────────────────────────────

describe("detectIntent", () => {
  const cases: [string, SearchIntent][] = [
    // Comparison intent
    ["ETH vs SOL", "comparison"],
    ["Compare Aave versus Compound", "comparison"],
    ["bitcoin compared to gold", "comparison"],

    // Event queries
    ["what happened to Luna", "event_query"],
    ["FTX crash", "event_query"],
    ["Euler exploit details", "event_query"],
    ["USDC depeg", "event_query"],
    ["Terra collapse", "event_query"],
    ["rug pull alert", "event_query"],

    // Concept explanations
    ["what is impermanent loss", "concept_explain"],
    ["explain DeFi lending", "concept_explain"],
    ["how does staking work", "concept_explain"],
    ["ELI5 liquidity pools", "concept_explain"],

    // Risk assessment
    ["is USDT safe", "risk_assessment"],
    ["audit report for Aave", "risk_assessment"],
    ["honeypot detector", "risk_assessment"],
    ["scam token check", "risk_assessment"],

    // Yield search
    ["best stablecoin yields", "yield_search"],
    ["highest APY on Ethereum", "yield_search"],
    ["staking rewards comparison", "yield_search"],
    ["where to farm USDC", "yield_search"],

    // Protocol search
    ["Aave TVL", "protocol_search"],
    ["top DeFi protocols", "protocol_search"],
    ["liquidity on Uniswap", "protocol_search"],

    // News search
    ["latest crypto news", "news_search"],
    ["breaking bitcoin headlines", "news_search"],

    // Chain comparison
    ["cheapest L2 for transactions", "chain_comparison"],
    ["fastest rollup", "chain_comparison"],
    ["Arbitrum vs Optimism bridge", "chain_comparison"],

    // Price lookup
    ["bitcoin price", "price_lookup"],
    ["ETH market cap", "price_lookup"],
    ["how much is solana worth", "price_lookup"],

    // General (no clear intent)
    ["bitcoin", "general"],
    ["Aave", "general"],
    ["solana development", "general"],
  ];

  for (const [query, expectedIntent] of cases) {
    it(`"${query}" → ${expectedIntent}`, () => {
      expect(detectIntent(query)).toBe(expectedIntent);
    });
  }

  it("returns 'general' for empty-like queries", () => {
    expect(detectIntent("")).toBe("general");
    expect(detectIntent("xyzzy")).toBe("general");
  });

  it("is case-insensitive", () => {
    expect(detectIntent("BITCOIN PRICE")).toBe("price_lookup");
    expect(detectIntent("What Is Impermanent Loss")).toBe("concept_explain");
  });
});
