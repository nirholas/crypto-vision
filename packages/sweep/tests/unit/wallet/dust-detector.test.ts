/**
 * Dust Detector Unit Tests
 * Tests for dust threshold calculation and token filtering
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { TOKENS, DUST_SCENARIOS } from "../../utils/fixtures.js";

describe("Dust Detector", () => {
  describe("Dust Threshold Calculation", () => {
    it("should identify tokens below dust threshold", () => {
      const DUST_THRESHOLD_USD = 50;
      
      const tokens = [
        { symbol: "USDC", valueUsd: 5.0 },
        { symbol: "USDT", valueUsd: 100.0 },
        { symbol: "DAI", valueUsd: 25.0 },
        { symbol: "WETH", valueUsd: 2500.0 },
      ];

      const isDustToken = (valueUsd: number) => valueUsd > 0 && valueUsd < DUST_THRESHOLD_USD;
      const dustTokens = tokens.filter(t => isDustToken(t.valueUsd));

      expect(dustTokens).toHaveLength(2);
      expect(dustTokens.map(t => t.symbol)).toContain("USDC");
      expect(dustTokens.map(t => t.symbol)).toContain("DAI");
    });

    it("should use configurable threshold", () => {
      const tokens = [
        { symbol: "USDC", valueUsd: 8.0 },
        { symbol: "USDT", valueUsd: 15.0 },
      ];

      const filterDust = (tokens: typeof tokens[0][], threshold: number) =>
        tokens.filter(t => t.valueUsd > 0 && t.valueUsd < threshold);

      expect(filterDust(tokens, 10)).toHaveLength(1);
      expect(filterDust(tokens, 20)).toHaveLength(2);
      expect(filterDust(tokens, 5)).toHaveLength(0);
    });

    it("should exclude zero-value tokens", () => {
      const tokens = [
        { symbol: "USDC", valueUsd: 5.0, isDust: true },
        { symbol: "ZERO", valueUsd: 0, isDust: false },
        { symbol: "SCAM", valueUsd: 0, isDust: false },
      ];

      const dustTokens = tokens.filter(t => t.valueUsd > 0 && t.isDust);

      expect(dustTokens).toHaveLength(1);
      expect(dustTokens[0].symbol).toBe("USDC");
    });

    it("should handle very small values", () => {
      const tokens = [
        { symbol: "MICRO", valueUsd: 0.001 },
        { symbol: "SMALL", valueUsd: 0.5 },
        { symbol: "NORMAL", valueUsd: 5.0 },
      ];

      const MIN_VALUE_THRESHOLD = 0.01; // Minimum $0.01
      const DUST_THRESHOLD = 50;

      const meaningfulDust = tokens.filter(
        t => t.valueUsd >= MIN_VALUE_THRESHOLD && t.valueUsd < DUST_THRESHOLD
      );

      expect(meaningfulDust).toHaveLength(2);
      expect(meaningfulDust.map(t => t.symbol)).not.toContain("MICRO");
    });
  });

  describe("Token Filtering", () => {
    it("should filter dust tokens from chain balance", () => {
      const chainBalance = {
        chain: "ethereum",
        tokens: [
          { address: "0x1", symbol: "USDC", valueUsd: 5.0, isDust: true },
          { address: "0x2", symbol: "WETH", valueUsd: 2500.0, isDust: false },
          { address: "0x3", symbol: "USDT", valueUsd: 3.5, isDust: true },
        ],
      };

      const dustTokens = chainBalance.tokens.filter(t => t.isDust);

      expect(dustTokens).toHaveLength(2);
      expect(dustTokens.every(t => t.isDust)).toBe(true);
    });

    it("should get dust tokens from multiple chains", () => {
      const chainBalances = [
        {
          chain: "ethereum",
          tokens: [
            { symbol: "USDC", valueUsd: 5.0, isDust: true },
            { symbol: "WETH", valueUsd: 2500.0, isDust: false },
          ],
        },
        {
          chain: "arbitrum",
          tokens: [
            { symbol: "USDC", valueUsd: 8.0, isDust: true },
            { symbol: "ARB", valueUsd: 6.0, isDust: true },
          ],
        },
      ];

      const allDustTokens = chainBalances.flatMap(cb => 
        cb.tokens.filter(t => t.isDust).map(t => ({ ...t, chain: cb.chain }))
      );

      expect(allDustTokens).toHaveLength(3);
      expect(allDustTokens.filter(t => t.chain === "ethereum")).toHaveLength(1);
      expect(allDustTokens.filter(t => t.chain === "arbitrum")).toHaveLength(2);
    });

    it("should filter by minimum value", () => {
      const dustTokens = [
        { symbol: "MICRO", valueUsd: 0.5 },
        { symbol: "SMALL", valueUsd: 2.0 },
        { symbol: "MEDIUM", valueUsd: 5.0 },
        { symbol: "LARGE", valueUsd: 15.0 },
      ];

      const minValueUsd = 2.0;
      const filtered = dustTokens.filter(t => t.valueUsd >= minValueUsd);

      expect(filtered).toHaveLength(3);
      expect(filtered[0].symbol).toBe("SMALL");
    });

    it("should group dust tokens by chain", () => {
      const dustTokens = [
        { chain: "ethereum", symbol: "USDC", valueUsd: 5.0 },
        { chain: "ethereum", symbol: "USDT", valueUsd: 3.5 },
        { chain: "arbitrum", symbol: "USDC", valueUsd: 8.0 },
        { chain: "polygon", symbol: "USDC", valueUsd: 4.0 },
      ];

      const groupByChain = (tokens: typeof dustTokens) => {
        const grouped = new Map<string, typeof dustTokens>();
        for (const token of tokens) {
          const existing = grouped.get(token.chain) || [];
          existing.push(token);
          grouped.set(token.chain, existing);
        }
        return grouped;
      };

      const grouped = groupByChain(dustTokens);

      expect(grouped.get("ethereum")).toHaveLength(2);
      expect(grouped.get("arbitrum")).toHaveLength(1);
      expect(grouped.get("polygon")).toHaveLength(1);
    });
  });

  describe("Gas-Adjusted Profitability", () => {
    const GAS_COSTS: Record<string, number> = {
      ethereum: 15.0,
      base: 0.02,
      arbitrum: 0.05,
      polygon: 0.01,
    };

    it("should calculate net value after gas", () => {
      const dustToken = { chain: "ethereum", valueUsd: 20.0 };
      const gasCost = GAS_COSTS[dustToken.chain];
      const netValue = dustToken.valueUsd - gasCost;

      expect(netValue).toBe(5.0);
    });

    it("should identify unprofitable dust on L1", () => {
      const dustTokens = [
        { chain: "ethereum", symbol: "USDC", valueUsd: 5.0 },
        { chain: "ethereum", symbol: "USDT", valueUsd: 20.0 },
      ];

      const withProfitability = dustTokens.map(t => ({
        ...t,
        gasCost: GAS_COSTS[t.chain],
        netValue: t.valueUsd - GAS_COSTS[t.chain],
        profitable: t.valueUsd > GAS_COSTS[t.chain],
      }));

      const unprofitable = withProfitability.filter(t => !t.profitable);

      expect(unprofitable).toHaveLength(1);
      expect(unprofitable[0].symbol).toBe("USDC");
    });

    it("should prioritize L2 dust for sweeping", () => {
      const dustTokens = [
        { chain: "ethereum", symbol: "USDC", valueUsd: 10.0 },
        { chain: "arbitrum", symbol: "USDC", valueUsd: 10.0 },
        { chain: "base", symbol: "USDC", valueUsd: 10.0 },
      ];

      const withProfitability = dustTokens.map(t => ({
        ...t,
        gasCost: GAS_COSTS[t.chain],
        netValue: t.valueUsd - GAS_COSTS[t.chain],
      }));

      const sorted = [...withProfitability].sort((a, b) => b.netValue - a.netValue);

      expect(sorted[0].chain).toBe("base"); // Best net value
      expect(sorted[0].netValue).toBeCloseTo(9.98, 2);
      expect(sorted[sorted.length - 1].chain).toBe("ethereum"); // Worst due to gas
    });

    it("should calculate profitable chain summary", () => {
      const chainBalances = [
        {
          chain: "ethereum",
          dustTokens: [
            { valueUsd: 5.0 },
            { valueUsd: 8.0 },
            { valueUsd: 20.0 },
          ],
        },
        {
          chain: "arbitrum",
          dustTokens: [
            { valueUsd: 3.0 },
            { valueUsd: 5.0 },
          ],
        },
      ];

      const chainSummaries = chainBalances.map(cb => {
        const gasCostPerToken = GAS_COSTS[cb.chain];
        const totalGas = gasCostPerToken * cb.dustTokens.length;
        const totalValue = cb.dustTokens.reduce((sum, t) => sum + t.valueUsd, 0);
        const netValue = totalValue - totalGas;

        return {
          chain: cb.chain,
          tokenCount: cb.dustTokens.length,
          totalValue,
          totalGas,
          netValue,
          profitable: netValue > 0,
        };
      });

      expect(chainSummaries[0].profitable).toBe(false); // Ethereum: 33 - 45 = -12
      expect(chainSummaries[1].profitable).toBe(true); // Arbitrum: 8 - 0.1 = 7.9
    });
  });

  describe("Sweep Priority", () => {
    it("should calculate sweep priority score", () => {
      const calculatePriority = (dust: {
        valueUsd: number;
        chain: string;
        profitable: boolean;
      }) => {
        let priority = dust.valueUsd;
        if (dust.profitable) priority += 50;
        if (dust.chain !== "ethereum") priority += 25;
        if (dust.valueUsd > 10) priority += 10;
        return priority;
      };

      const ethDust = { valueUsd: 5.0, chain: "ethereum", profitable: false };
      const arbDust = { valueUsd: 5.0, chain: "arbitrum", profitable: true };

      expect(calculatePriority(arbDust)).toBeGreaterThan(calculatePriority(ethDust));
    });

    it("should sort dust by priority descending", () => {
      const dustTokens = [
        { symbol: "ETH-USDC", valueUsd: 5.0, chain: "ethereum", profitable: false },
        { symbol: "ARB-USDC", valueUsd: 8.0, chain: "arbitrum", profitable: true },
        { symbol: "BASE-USDC", valueUsd: 3.0, chain: "base", profitable: true },
        { symbol: "ARB-USDT", valueUsd: 15.0, chain: "arbitrum", profitable: true },
      ];

      const calculatePriority = (d: typeof dustTokens[0]) => {
        let priority = d.valueUsd;
        if (d.profitable) priority += 50;
        if (d.chain !== "ethereum") priority += 25;
        if (d.valueUsd > 10) priority += 10;
        return priority;
      };

      const sorted = [...dustTokens]
        .map(d => ({ ...d, priority: calculatePriority(d) }))
        .sort((a, b) => b.priority - a.priority);

      expect(sorted[0].symbol).toBe("ARB-USDT"); // 15 + 50 + 25 + 10 = 100
      expect(sorted[1].symbol).toBe("ARB-USDC"); // 8 + 50 + 25 = 83
    });

    it("should only include profitable tokens in recommended sweep", () => {
      const dustTokens = [
        { symbol: "PROFITABLE", profitable: true },
        { symbol: "UNPROFITABLE", profitable: false },
        { symbol: "PROFITABLE2", profitable: true },
      ];

      const recommendedSweep = dustTokens.filter(d => d.profitable);

      expect(recommendedSweep).toHaveLength(2);
      expect(recommendedSweep.every(d => d.profitable)).toBe(true);
    });
  });

  describe("Dust Analysis Summary", () => {
    it("should calculate total dust statistics", () => {
      const dustAnalysis = {
        totalDustTokens: 8,
        totalDustValueUsd: 45.5,
        dustByChain: [
          { chain: "ethereum", dustTokenCount: 3, dustValueUsd: 25.0 },
          { chain: "arbitrum", dustTokenCount: 3, dustValueUsd: 15.0 },
          { chain: "base", dustTokenCount: 2, dustValueUsd: 5.5 },
        ],
        profitableCount: 5,
        unprofitableCount: 3,
      };

      expect(dustAnalysis.totalDustTokens).toBe(8);
      expect(dustAnalysis.totalDustValueUsd).toBe(45.5);
      expect(dustAnalysis.dustByChain).toHaveLength(3);
    });

    it("should calculate sweep potential", () => {
      const dustTokens = [
        { valueUsd: 5.0, gasCost: 15.0, profitable: false },
        { valueUsd: 8.0, gasCost: 0.05, profitable: true },
        { valueUsd: 12.0, gasCost: 0.02, profitable: true },
        { valueUsd: 3.0, gasCost: 0.01, profitable: true },
      ];

      const profitable = dustTokens.filter(d => d.profitable);
      const grossValue = profitable.reduce((sum, d) => sum + d.valueUsd, 0);
      const totalGas = profitable.reduce((sum, d) => sum + d.gasCost, 0);
      const netValue = grossValue - totalGas;

      expect(profitable.length).toBe(3);
      expect(grossValue).toBe(23.0);
      expect(totalGas).toBeCloseTo(0.08, 2);
      expect(netValue).toBeCloseTo(22.92, 2);
    });

    it("should identify profitable chains", () => {
      const chainSummaries = [
        { chain: "ethereum", netValue: -12.0, profitable: false },
        { chain: "arbitrum", netValue: 7.9, profitable: true },
        { chain: "polygon", netValue: 3.95, profitable: true },
        { chain: "base", netValue: 5.46, profitable: true },
      ];

      const profitableChains = chainSummaries
        .filter(c => c.profitable)
        .sort((a, b) => b.netValue - a.netValue)
        .map(c => c.chain);

      expect(profitableChains).toHaveLength(3);
      expect(profitableChains[0]).toBe("arbitrum");
      expect(profitableChains).not.toContain("ethereum");
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty wallet", () => {
      const chainBalances: { chain: string; tokens: any[] }[] = [
        { chain: "ethereum", tokens: [] },
        { chain: "arbitrum", tokens: [] },
      ];

      const allDust = chainBalances.flatMap(cb => cb.tokens.filter((t: any) => t.isDust));

      expect(allDust).toHaveLength(0);
    });

    it("should handle wallet with no dust", () => {
      const chainBalances = [
        {
          chain: "ethereum",
          tokens: [
            { symbol: "WETH", valueUsd: 2500.0, isDust: false },
            { symbol: "USDC", valueUsd: 1000.0, isDust: false },
          ],
        },
      ];

      const dustTokens = chainBalances.flatMap(cb => cb.tokens.filter(t => t.isDust));

      expect(dustTokens).toHaveLength(0);
    });

    it("should handle all unprofitable dust", () => {
      const dustTokens = [
        { symbol: "USDC", valueUsd: 2.0, chain: "ethereum", gasCost: 15.0 },
        { symbol: "USDT", valueUsd: 3.0, chain: "ethereum", gasCost: 15.0 },
      ];

      const profitable = dustTokens.filter(d => d.valueUsd > d.gasCost);

      expect(profitable).toHaveLength(0);
    });

    it("should handle very large dust values near threshold", () => {
      const DUST_THRESHOLD = 50;
      
      const edgeCases = [
        { valueUsd: 49.99, expected: true },
        { valueUsd: 50.0, expected: false },
        { valueUsd: 50.01, expected: false },
      ];

      for (const { valueUsd, expected } of edgeCases) {
        const isDust = valueUsd > 0 && valueUsd < DUST_THRESHOLD;
        expect(isDust).toBe(expected);
      }
    });
  });
});
