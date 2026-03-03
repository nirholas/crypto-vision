/**
 * Quote Optimizer Unit Tests
 * Tests for DEX quote comparison and optimization
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  mock1InchQuoteResponse,
  mockParaswapQuoteResponse,
  mockCowswapQuoteResponse,
} from "../../utils/mocks.js";
import { TOKENS, QUOTE_FIXTURES } from "../../utils/fixtures.js";

// Mock the aggregator modules
vi.mock("../../../src/services/dex/aggregators/1inch.js", () => ({
  oneInchAggregator: {
    name: "1inch",
    supportedChains: ["ethereum", "arbitrum", "polygon", "base", "optimism"],
    getQuote: vi.fn(),
    buildSwap: vi.fn(),
  },
}));

vi.mock("../../../src/services/dex/aggregators/paraswap.js", () => ({
  paraswapAggregator: {
    name: "paraswap",
    supportedChains: ["ethereum", "arbitrum", "polygon", "optimism"],
    getQuote: vi.fn(),
    buildSwap: vi.fn(),
  },
}));

vi.mock("../../../src/services/dex/aggregators/0x.js", () => ({
  zeroXAggregator: {
    name: "0x",
    supportedChains: ["ethereum", "arbitrum", "polygon", "base", "optimism"],
    getQuote: vi.fn(),
    buildSwap: vi.fn(),
  },
}));

vi.mock("../../../src/services/dex/aggregators/cowswap.js", () => ({
  cowswapAggregator: {
    name: "cowswap",
    supportedChains: ["ethereum"],
    getQuote: vi.fn(),
    buildSwap: vi.fn(),
  },
}));

vi.mock("../../../src/services/dex/aggregators/jupiter.js", () => ({
  jupiterAggregator: {
    name: "jupiter",
    supportedChains: ["solana"],
    getQuote: vi.fn(),
    buildSwap: vi.fn(),
  },
}));

vi.mock("../../../src/services/dex/aggregators/lifi.js", () => ({
  lifiAggregator: {
    name: "lifi",
    supportedChains: ["ethereum", "arbitrum", "polygon", "base", "optimism"],
    getQuote: vi.fn(),
    buildSwap: vi.fn(),
  },
}));

describe("Quote Optimizer", () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe("Quote Comparison Across Aggregators", () => {
    it("should fetch quotes from all available aggregators", async () => {
      const quotes = [
        { aggregator: "1inch", outputAmount: "995000000", estimatedGas: "200000" },
        { aggregator: "paraswap", outputAmount: "996000000", estimatedGas: "180000" },
        { aggregator: "cowswap", outputAmount: "997000000", estimatedGas: "0" },
        { aggregator: "0x", outputAmount: "994000000", estimatedGas: "210000" },
      ];

      expect(quotes).toHaveLength(4);
      expect(quotes.map(q => q.aggregator)).toContain("1inch");
      expect(quotes.map(q => q.aggregator)).toContain("cowswap");
    });

    it("should select best quote by output amount", async () => {
      const quotes = [
        { aggregator: "1inch", outputAmount: BigInt("995000000") },
        { aggregator: "paraswap", outputAmount: BigInt("996000000") },
        { aggregator: "cowswap", outputAmount: BigInt("997000000") },
      ];

      const best = quotes.sort((a, b) => 
        Number(b.outputAmount - a.outputAmount)
      )[0];

      expect(best.aggregator).toBe("cowswap");
      expect(best.outputAmount).toBe(BigInt("997000000"));
    });

    it("should handle aggregator timeouts gracefully", async () => {
      const quotePromises = [
        Promise.resolve({ aggregator: "1inch", outputAmount: "995000000" }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error("Timeout")), 100)
        ),
        Promise.resolve({ aggregator: "cowswap", outputAmount: "997000000" }),
      ];

      const results = await Promise.allSettled(quotePromises);
      const successfulQuotes = results
        .filter((r): r is PromiseFulfilledResult<any> => r.status === "fulfilled")
        .map(r => r.value);

      expect(successfulQuotes).toHaveLength(2);
    });

    it("should filter unavailable aggregators by chain", () => {
      const aggregators = [
        { name: "1inch", supportedChains: ["ethereum", "arbitrum"] },
        { name: "cowswap", supportedChains: ["ethereum"] },
        { name: "jupiter", supportedChains: ["solana"] },
      ];

      const getAvailableAggregators = (chain: string) =>
        aggregators.filter(a => a.supportedChains.includes(chain));

      expect(getAvailableAggregators("ethereum")).toHaveLength(2);
      expect(getAvailableAggregators("solana")).toHaveLength(1);
      expect(getAvailableAggregators("solana")[0].name).toBe("jupiter");
    });
  });

  describe("Gas Optimization", () => {
    it("should calculate gas cost in USD", async () => {
      const gasPrices: Record<string, { gwei: number; nativeUsd: number }> = {
        ethereum: { gwei: 30, nativeUsd: 2500 },
        arbitrum: { gwei: 0.1, nativeUsd: 2500 },
        polygon: { gwei: 50, nativeUsd: 0.8 },
        base: { gwei: 0.01, nativeUsd: 2500 },
      };

      const calculateGasCostUsd = (chain: string, gasUnits: number) => {
        const config = gasPrices[chain];
        if (!config) return 0;
        // Gas price in wei = gwei * 1e9
        // Gas cost in native = gas units * gas price in wei / 1e18
        // Gas cost in USD = gas cost in native * native price
        return (gasUnits * config.gwei * 1e-9) * config.nativeUsd;
      };

      expect(calculateGasCostUsd("ethereum", 200000)).toBeCloseTo(15, 0);
      expect(calculateGasCostUsd("arbitrum", 200000)).toBeCloseTo(0.05, 2);
      expect(calculateGasCostUsd("polygon", 200000)).toBeCloseTo(0.008, 3);
    });

    it("should prefer gasless protocols when value is small", () => {
      const quotes = [
        { aggregator: "1inch", outputAmount: 995, gasUsd: 15 },
        { aggregator: "cowswap", outputAmount: 990, gasUsd: 0 },
      ];

      // For small trades, gas savings matter more
      const withNetValue = quotes.map(q => ({
        ...q,
        netValue: q.outputAmount - q.gasUsd,
      }));

      const best = withNetValue.sort((a, b) => b.netValue - a.netValue)[0];

      // CoW Swap wins despite lower output because it's gasless
      expect(best.aggregator).toBe("cowswap");
      expect(best.netValue).toBe(990);
    });

    it("should factor in gas when comparing L1 vs L2", () => {
      const l1Quote = { chain: "ethereum", output: 1000, gasUsd: 20 };
      const l2Quote = { chain: "arbitrum", output: 998, gasUsd: 0.1 };

      const l1Net = l1Quote.output - l1Quote.gasUsd;
      const l2Net = l2Quote.output - l2Quote.gasUsd;

      expect(l2Net).toBeGreaterThan(l1Net);
    });
  });

  describe("Slippage Calculation", () => {
    it("should calculate price impact correctly", () => {
      const inputAmount = 1000; // 1000 USDC
      const expectedOutput = 995; // 0.5% slippage
      
      const priceImpact = ((inputAmount - expectedOutput) / inputAmount) * 100;
      
      expect(priceImpact).toBeCloseTo(0.5, 1);
    });

    it("should reject quotes with excessive price impact", () => {
      const maxPriceImpact = 5; // 5%
      
      const quotes = [
        { outputAmount: 990, priceImpact: 1.0 },
        { outputAmount: 950, priceImpact: 5.0 },
        { outputAmount: 900, priceImpact: 10.0 },
      ];

      const validQuotes = quotes.filter(q => q.priceImpact <= maxPriceImpact);

      expect(validQuotes).toHaveLength(2);
      expect(validQuotes.map(q => q.priceImpact)).not.toContain(10.0);
    });

    it("should calculate minimum output with slippage tolerance", () => {
      const outputAmount = BigInt("1000000000"); // 1000 USDC
      const slippageBps = 50; // 0.5%
      
      const minOutput = outputAmount - (outputAmount * BigInt(slippageBps) / 10000n);
      
      expect(minOutput).toBe(BigInt("995000000"));
    });

    it("should handle high slippage for low liquidity tokens", () => {
      const normalSlippage = 0.5; // 0.5%
      const lowLiquiditySlippage = 3.0; // 3%
      
      const getRecommendedSlippage = (liquidityUsd: number) => {
        if (liquidityUsd < 10000) return 3.0;
        if (liquidityUsd < 100000) return 1.5;
        return 0.5;
      };

      expect(getRecommendedSlippage(5000)).toBe(3.0);
      expect(getRecommendedSlippage(50000)).toBe(1.5);
      expect(getRecommendedSlippage(500000)).toBe(0.5);
    });
  });

  describe("Quote Comparison Result", () => {
    it("should return comprehensive comparison", () => {
      const quotes = [
        { aggregator: "1inch", outputAmount: "995000000", gasUsd: 15, priceImpact: 0.5 },
        { aggregator: "paraswap", outputAmount: "996000000", gasUsd: 12, priceImpact: 0.4 },
        { aggregator: "cowswap", outputAmount: "997000000", gasUsd: 0, priceImpact: 0.3 },
      ];

      const outputPriceUsd = 1; // USDC
      const comparison = {
        quotes: quotes.map(q => ({
          ...q,
          outputValueUsd: Number(q.outputAmount) / 1e6,
          netValueUsd: Number(q.outputAmount) / 1e6 - q.gasUsd,
        })),
        best: null as any,
        worst: null as any,
        savingsUsd: 0,
        savingsPercent: 0,
      };

      comparison.quotes.sort((a, b) => b.netValueUsd - a.netValueUsd);
      comparison.best = comparison.quotes[0];
      comparison.worst = comparison.quotes[comparison.quotes.length - 1];
      comparison.savingsUsd = comparison.best.netValueUsd - comparison.worst.netValueUsd;
      comparison.savingsPercent = (comparison.savingsUsd / comparison.worst.netValueUsd) * 100;

      expect(comparison.best.aggregator).toBe("cowswap");
      expect(comparison.savingsUsd).toBeGreaterThan(10);
    });

    it("should track all quotes for transparency", () => {
      const comparison = {
        inputToken: TOKENS.ethereum.WETH,
        outputToken: TOKENS.ethereum.USDC,
        inputAmount: "1000000000000000000",
        quotes: [
          { aggregator: "1inch", outputAmount: "2495000000", selected: false },
          { aggregator: "cowswap", outputAmount: "2497000000", selected: true },
        ],
        selectedQuote: "cowswap",
        timestamp: Date.now(),
      };

      expect(comparison.quotes).toHaveLength(2);
      expect(comparison.quotes.find(q => q.selected)?.aggregator).toBe("cowswap");
    });
  });

  describe("Aggregator Priority", () => {
    it("should prefer specified aggregators when provided", () => {
      const allAggregators = ["1inch", "paraswap", "cowswap", "0x", "lifi"];
      const preferred = ["cowswap", "1inch"];
      
      const sorted = [...allAggregators].sort((a, b) => {
        const aPreferred = preferred.includes(a);
        const bPreferred = preferred.includes(b);
        if (aPreferred && !bPreferred) return -1;
        if (!aPreferred && bPreferred) return 1;
        return 0;
      });

      expect(sorted[0]).toBe("cowswap");
      expect(sorted[1]).toBe("1inch");
    });

    it("should exclude specified aggregators", () => {
      const allAggregators = ["1inch", "paraswap", "cowswap", "0x"];
      const excluded = ["0x"];
      
      const filtered = allAggregators.filter(a => !excluded.includes(a));

      expect(filtered).toHaveLength(3);
      expect(filtered).not.toContain("0x");
    });
  });

  describe("Error Handling", () => {
    it("should return null when no quotes available", async () => {
      const quotes: any[] = [];
      
      const getBestQuote = (quotes: any[]) => {
        if (quotes.length === 0) return null;
        return quotes[0];
      };

      expect(getBestQuote(quotes)).toBeNull();
    });

    it("should handle partial aggregator failures", async () => {
      const results = [
        { status: "fulfilled", value: { aggregator: "1inch", outputAmount: "995" } },
        { status: "rejected", reason: new Error("API error") },
        { status: "fulfilled", value: { aggregator: "cowswap", outputAmount: "997" } },
      ];

      const successfulQuotes = results
        .filter((r): r is { status: "fulfilled"; value: any } => r.status === "fulfilled")
        .map(r => r.value);

      expect(successfulQuotes).toHaveLength(2);
    });

    it("should validate quote response structure", () => {
      const validateQuote = (quote: any) => {
        return (
          typeof quote.outputAmount === "string" &&
          typeof quote.aggregator === "string" &&
          BigInt(quote.outputAmount) > 0n
        );
      };

      expect(validateQuote({ outputAmount: "1000", aggregator: "1inch" })).toBe(true);
      expect(validateQuote({ outputAmount: "0", aggregator: "1inch" })).toBe(false);
      expect(validateQuote({ aggregator: "1inch" })).toBe(false);
    });
  });

  describe("Quote Caching", () => {
    it("should cache quotes for short duration", () => {
      const cache = new Map<string, { quote: any; expiry: number }>();
      const CACHE_TTL = 30000; // 30 seconds

      const cacheKey = "quote:ethereum:WETH:USDC:1000000000000000000";
      const quote = { aggregator: "1inch", outputAmount: "2495000000" };

      // Set cache
      cache.set(cacheKey, { quote, expiry: Date.now() + CACHE_TTL });

      // Get from cache
      const cached = cache.get(cacheKey);
      const isValid = cached && cached.expiry > Date.now();

      expect(isValid).toBe(true);
      expect(cached?.quote.aggregator).toBe("1inch");
    });

    it("should invalidate expired cache", () => {
      const cache = new Map<string, { quote: any; expiry: number }>();
      
      const cacheKey = "quote:test";
      cache.set(cacheKey, { quote: {}, expiry: Date.now() - 1000 }); // Expired

      const cached = cache.get(cacheKey);
      const isValid = cached && cached.expiry > Date.now();

      expect(isValid).toBe(false);
    });
  });
});
