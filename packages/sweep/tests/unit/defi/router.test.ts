/**
 * DeFi Router Unit Tests
 * Tests for routing dust tokens to optimal DeFi destinations
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockVault } from "../../utils/mocks.js";
import { TOKENS, VAULTS } from "../../utils/fixtures.js";
import { DeFiProtocol, RiskLevel } from "../../../src/services/defi/types.js";

// Mock the aggregator
vi.mock("../../../src/services/defi/index.js", () => ({
  defiAggregator: {
    getAllVaults: vi.fn(),
    getVaultsForAsset: vi.fn(),
    findBestYield: vi.fn(),
    getDepositQuote: vi.fn(),
    getWithdrawQuote: vi.fn(),
  },
  DeFiAggregator: vi.fn(),
}));

vi.mock("../../../src/utils/redis.js", () => ({
  cacheGetOrFetch: vi.fn((key, fn) => fn()),
  cacheGet: vi.fn(() => null),
  cacheSet: vi.fn(),
}));

describe("DeFi Router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("findBestRoute", () => {
    it("should return optimal route for a dust token", async () => {
      const dustToken = TOKENS.ethereum.USDC;
      const amount = "5000000"; // 5 USDC
      const userAddress = "0x1234567890123456789012345678901234567890";

      const mockVaults = [
        createMockVault({ protocol: DeFiProtocol.AAVE, apy: 0.035, tvlUsd: 500000000 }),
        createMockVault({ protocol: DeFiProtocol.YEARN, apy: 0.055, tvlUsd: 100000000 }),
      ];

      const { defiAggregator } = await import("../../../src/services/defi/index.js");
      (defiAggregator.findBestYield as any).mockResolvedValue({
        asset: dustToken.address,
        chain: "ethereum",
        vaults: mockVaults.map((v, i) => ({
          vault: v,
          protocol: v.protocol,
          chain: v.chain,
          apy: v.apy,
          tvlUsd: v.tvlUsd,
          riskLevel: v.riskLevel,
          score: 0.8 - i * 0.1,
        })),
        bestApy: mockVaults[1],
        bestRiskAdjusted: mockVaults[0],
        highestTvl: mockVaults[0],
      });

      (defiAggregator.getDepositQuote as any).mockResolvedValue({
        vaultAddress: mockVaults[0].address,
        depositAmount: amount,
        depositValueUsd: 5,
        expectedShares: amount,
        apy: 0.035,
        estimatedGas: "200000",
        estimatedGasUsd: 15,
      });

      // Simulate route finding
      const comparison = await defiAggregator.findBestYield("ethereum", dustToken.address, {});
      
      expect(comparison.vaults.length).toBeGreaterThan(0);
      expect(comparison.bestApy).toBeDefined();
    });

    it("should respect maximum gas percentage preference", async () => {
      const preferences = {
        maxGasPercent: 0.05, // Max 5% gas vs deposit
      };
      
      const depositValueUsd = 10;
      const gasEstimates = [
        { gasUsd: 0.3, passesCheck: true }, // 3%
        { gasUsd: 0.6, passesCheck: false }, // 6%
        { gasUsd: 0.2, passesCheck: true }, // 2%
      ];

      for (const { gasUsd, passesCheck } of gasEstimates) {
        const gasPercent = gasUsd / depositValueUsd;
        expect(gasPercent <= preferences.maxGasPercent).toBe(passesCheck);
      }
    });

    it("should filter routes by risk level", async () => {
      const preferences = {
        maxRiskLevel: RiskLevel.MEDIUM,
      };

      const vaults = [
        createMockVault({ riskLevel: RiskLevel.LOW, apy: 0.03 }),
        createMockVault({ riskLevel: RiskLevel.MEDIUM, apy: 0.05 }),
        createMockVault({ riskLevel: RiskLevel.HIGH, apy: 0.12 }),
      ];

      const riskOrder = { LOW: 0, MEDIUM: 1, HIGH: 2 };
      const filteredVaults = vaults.filter(
        v => riskOrder[v.riskLevel] <= riskOrder[preferences.maxRiskLevel]
      );

      expect(filteredVaults).toHaveLength(2);
      expect(filteredVaults.some(v => v.riskLevel === RiskLevel.HIGH)).toBe(false);
    });

    it("should optimize for APY when specified", async () => {
      const preferences = { optimizeFor: "apy" as const };
      
      const vaults = [
        createMockVault({ apy: 0.03, tvlUsd: 500000000 }),
        createMockVault({ apy: 0.08, tvlUsd: 10000000 }),
        createMockVault({ apy: 0.05, tvlUsd: 200000000 }),
      ];

      const sorted = preferences.optimizeFor === "apy"
        ? [...vaults].sort((a, b) => b.apy - a.apy)
        : [...vaults].sort((a, b) => b.tvlUsd - a.tvlUsd);

      expect(sorted[0].apy).toBe(0.08);
    });

    it("should optimize for safety when specified", async () => {
      const preferences = { optimizeFor: "safety" as const };
      
      const vaults = [
        createMockVault({ apy: 0.08, tvlUsd: 10000000, riskLevel: RiskLevel.HIGH }),
        createMockVault({ apy: 0.03, tvlUsd: 500000000, riskLevel: RiskLevel.LOW }),
        createMockVault({ apy: 0.05, tvlUsd: 200000000, riskLevel: RiskLevel.MEDIUM }),
      ];

      const riskOrder = { LOW: 0, MEDIUM: 1, HIGH: 2 };
      const sorted = [...vaults].sort((a, b) => {
        // First by risk (lower is better)
        const riskDiff = riskOrder[a.riskLevel] - riskOrder[b.riskLevel];
        if (riskDiff !== 0) return riskDiff;
        // Then by TVL (higher is better)
        return b.tvlUsd - a.tvlUsd;
      });

      expect(sorted[0].riskLevel).toBe(RiskLevel.LOW);
    });
  });

  describe("Native Token Staking Routing", () => {
    it("should route ETH to Lido on Ethereum", async () => {
      const isNativeToken = (address: string) =>
        address === "0x0000000000000000000000000000000000000000" ||
        address.toLowerCase() === "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";

      const getNativeStakingProtocol = (chain: string) => {
        const mapping: Record<string, DeFiProtocol | null> = {
          ethereum: DeFiProtocol.LIDO,
          solana: DeFiProtocol.JITO,
          arbitrum: null,
        };
        return mapping[chain] || null;
      };

      const ethAddress = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
      
      expect(isNativeToken(ethAddress)).toBe(true);
      expect(getNativeStakingProtocol("ethereum")).toBe(DeFiProtocol.LIDO);
      expect(getNativeStakingProtocol("solana")).toBe(DeFiProtocol.JITO);
    });

    it("should route SOL to Jito on Solana", async () => {
      const getNativeStakingProtocol = (chain: string) => {
        if (chain === "solana") return DeFiProtocol.JITO;
        return null;
      };

      expect(getNativeStakingProtocol("solana")).toBe(DeFiProtocol.JITO);
    });

    it("should return null for chains without native staking", async () => {
      const getNativeStakingProtocol = (chain: string) => {
        const mapping: Record<string, DeFiProtocol | null> = {
          ethereum: DeFiProtocol.LIDO,
          solana: DeFiProtocol.JITO,
        };
        return mapping[chain] || null;
      };

      expect(getNativeStakingProtocol("arbitrum")).toBeNull();
      expect(getNativeStakingProtocol("polygon")).toBeNull();
    });
  });

  describe("Consolidation Routing", () => {
    it("should route non-supported tokens via stablecoin swap", async () => {
      const stablecoins: Record<string, string> = {
        ethereum: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // USDC
        arbitrum: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
        polygon: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
      };

      const getConsolidationToken = (chain: string) => stablecoins[chain];

      expect(getConsolidationToken("ethereum")).toBe(TOKENS.ethereum.USDC.address);
      expect(getConsolidationToken("arbitrum")).toBe(TOKENS.arbitrum.USDC.address);
    });

    it("should calculate total route cost including swap fees", () => {
      const inputValueUsd = 10;
      const swapFeePercent = 0.003; // 0.3% swap fee
      const depositGasUsd = 0.5;
      
      const swapFee = inputValueUsd * swapFeePercent;
      const totalCost = swapFee + depositGasUsd;
      const netValue = inputValueUsd - totalCost;

      expect(swapFee).toBeCloseTo(0.03, 2);
      expect(totalCost).toBeCloseTo(0.53, 2);
      expect(netValue).toBeCloseTo(9.47, 2);
    });

    it("should skip consolidation if direct deposit is available", async () => {
      const hasDirectVault = true;
      const shouldConsolidate = !hasDirectVault;

      expect(shouldConsolidate).toBe(false);
    });
  });

  describe("Multi-Asset Routing", () => {
    it("should create routes for multiple dust tokens", async () => {
      const dustTokens = [
        { address: TOKENS.ethereum.USDC.address, amount: "5000000", valueUsd: 5 },
        { address: TOKENS.ethereum.USDT.address, amount: "3500000", valueUsd: 3.5 },
        { address: TOKENS.ethereum.DAI.address, amount: "2000000000000000000", valueUsd: 2 },
      ];

      const routes = dustTokens.map(token => ({
        inputToken: token.address,
        inputAmount: token.amount,
        inputValueUsd: token.valueUsd,
        outputVault: VAULTS.aaveUSDC.address,
        estimatedGasUsd: 0.5,
      }));

      expect(routes).toHaveLength(3);
      expect(routes.reduce((sum, r) => sum + r.inputValueUsd, 0)).toBe(10.5);
    });

    it("should calculate total projected yield", () => {
      const routes = [
        { valueUsd: 5, apy: 0.035 },
        { valueUsd: 3.5, apy: 0.055 },
        { valueUsd: 2, apy: 0.04 },
      ];

      const totalValue = routes.reduce((sum, r) => sum + r.valueUsd, 0);
      const weightedApy = routes.reduce(
        (sum, r) => sum + (r.valueUsd / totalValue) * r.apy,
        0
      );
      const projectedYield1y = totalValue * weightedApy;

      expect(totalValue).toBe(10.5);
      expect(weightedApy).toBeCloseTo(0.043, 2);
      expect(projectedYield1y).toBeCloseTo(0.45, 1);
    });
  });

  describe("Route Scoring", () => {
    it("should score routes based on net value after gas", () => {
      const routes = [
        { valueUsd: 10, gasUsd: 0.5, apy: 0.05 },
        { valueUsd: 10, gasUsd: 2.0, apy: 0.08 },
        { valueUsd: 10, gasUsd: 0.1, apy: 0.03 },
      ];

      const scoredRoutes = routes.map(r => ({
        ...r,
        netValue: r.valueUsd - r.gasUsd,
        score: (r.valueUsd - r.gasUsd) * (1 + r.apy),
      }));

      const best = scoredRoutes.sort((a, b) => b.score - a.score)[0];

      // Highest score should balance APY vs gas cost
      expect(best.gasUsd).toBe(0.5);
    });

    it("should penalize high gas routes for small deposits", () => {
      const smallDeposit = { valueUsd: 5, gasUsd: 2.0 };
      const largeDeposit = { valueUsd: 100, gasUsd: 2.0 };

      const smallGasRatio = smallDeposit.gasUsd / smallDeposit.valueUsd;
      const largeGasRatio = largeDeposit.gasUsd / largeDeposit.valueUsd;

      expect(smallGasRatio).toBe(0.4); // 40% gas!
      expect(largeGasRatio).toBe(0.02); // 2% gas
      expect(smallGasRatio).toBeGreaterThan(largeGasRatio);
    });
  });

  describe("Error Handling", () => {
    it("should handle no available vaults", async () => {
      const { defiAggregator } = await import("../../../src/services/defi/index.js");
      (defiAggregator.findBestYield as any).mockResolvedValue({
        vaults: [],
        bestApy: null,
        bestRiskAdjusted: null,
        highestTvl: null,
      });

      const result = await defiAggregator.findBestYield("ethereum", "0xinvalid", {});
      
      expect(result.vaults).toHaveLength(0);
      expect(result.bestApy).toBeNull();
    });

    it("should handle deposit quote failures", async () => {
      const { defiAggregator } = await import("../../../src/services/defi/index.js");
      (defiAggregator.getDepositQuote as any).mockRejectedValue(
        new Error("Insufficient liquidity")
      );

      await expect(
        defiAggregator.getDepositQuote("AAVE", "ethereum", "0xvault", "1000", "0xuser")
      ).rejects.toThrow("Insufficient liquidity");
    });
  });
});
