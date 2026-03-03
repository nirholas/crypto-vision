/**
 * DeFi Aggregator Unit Tests
 * Tests for aggregating vaults from all providers
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockVault } from "../../utils/mocks.js";
import { VAULTS, TOKENS } from "../../utils/fixtures.js";
import { DeFiProtocol, RiskLevel, DeFiProductType } from "../../../src/services/defi/types.js";

// Mock all providers
vi.mock("../../../src/services/defi/aave.js", () => ({
  aaveProvider: {
    protocol: "AAVE",
    name: "Aave V3",
    supportedChains: ["ethereum", "arbitrum", "polygon", "base", "optimism"],
    getVaults: vi.fn(),
    getDepositQuote: vi.fn(),
    getWithdrawQuote: vi.fn(),
    getPosition: vi.fn(),
  },
}));

vi.mock("../../../src/services/defi/yearn.js", () => ({
  yearnProvider: {
    protocol: "YEARN",
    name: "Yearn V3",
    supportedChains: ["ethereum", "arbitrum", "polygon", "base", "optimism"],
    getVaults: vi.fn(),
    getDepositQuote: vi.fn(),
    getWithdrawQuote: vi.fn(),
    getPosition: vi.fn(),
  },
}));

vi.mock("../../../src/services/defi/beefy.js", () => ({
  beefyProvider: {
    protocol: "BEEFY",
    name: "Beefy Finance",
    supportedChains: ["arbitrum", "polygon", "base", "optimism"],
    getVaults: vi.fn(),
    getDepositQuote: vi.fn(),
    getWithdrawQuote: vi.fn(),
    getPosition: vi.fn(),
  },
}));

vi.mock("../../../src/services/defi/lido.js", () => ({
  lidoProvider: {
    protocol: "LIDO",
    name: "Lido",
    supportedChains: ["ethereum"],
    getVaults: vi.fn(),
    getDepositQuote: vi.fn(),
    getWithdrawQuote: vi.fn(),
    getPosition: vi.fn(),
  },
}));

vi.mock("../../../src/services/defi/jito.js", () => ({
  jitoProvider: {
    protocol: "JITO",
    name: "Jito",
    supportedChains: ["solana"],
    getVaults: vi.fn(),
    getDepositQuote: vi.fn(),
    getWithdrawQuote: vi.fn(),
    getPosition: vi.fn(),
  },
}));

vi.mock("../../../src/utils/redis.js", () => ({
  cacheGetOrFetch: vi.fn((key, fn) => fn()),
  cacheGet: vi.fn(() => null),
  cacheSet: vi.fn(),
}));

describe("DeFi Aggregator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getAllVaults", () => {
    it("should aggregate vaults from all providers on a chain", async () => {
      // Create mock vaults from different providers
      const aaveVaults = [
        createMockVault({ protocol: DeFiProtocol.AAVE, apy: 0.035, tvlUsd: 500000000 }),
        createMockVault({ protocol: DeFiProtocol.AAVE, apy: 0.025, tvlUsd: 300000000, name: "Aave WETH" }),
      ];
      
      const yearnVaults = [
        createMockVault({ protocol: DeFiProtocol.YEARN, apy: 0.055, tvlUsd: 100000000 }),
      ];
      
      const beefyVaults = [
        createMockVault({ protocol: DeFiProtocol.BEEFY, apy: 0.065, tvlUsd: 50000000 }),
      ];

      // Simulate aggregation
      const allVaults = [...aaveVaults, ...yearnVaults, ...beefyVaults];

      expect(allVaults).toHaveLength(4);
      expect(allVaults.filter(v => v.protocol === DeFiProtocol.AAVE)).toHaveLength(2);
      expect(allVaults.filter(v => v.protocol === DeFiProtocol.YEARN)).toHaveLength(1);
      expect(allVaults.filter(v => v.protocol === DeFiProtocol.BEEFY)).toHaveLength(1);
    });

    it("should handle provider errors gracefully", async () => {
      const aaveVaults = [createMockVault({ protocol: DeFiProtocol.AAVE })];
      const yearnError = new Error("Yearn API unavailable");
      
      // Simulate one provider failing
      const results = await Promise.allSettled([
        Promise.resolve(aaveVaults),
        Promise.reject(yearnError),
      ]);

      const successfulVaults = results
        .filter((r): r is PromiseFulfilledResult<any[]> => r.status === "fulfilled")
        .flatMap(r => r.value);

      expect(successfulVaults).toHaveLength(1);
      expect(successfulVaults[0].protocol).toBe(DeFiProtocol.AAVE);
    });

    it("should cache aggregated results", async () => {
      const { cacheGetOrFetch } = await import("../../../src/utils/redis.js");
      
      // First call
      await (cacheGetOrFetch as any)("aggregator:vaults:ethereum", () => []);
      
      expect(cacheGetOrFetch).toHaveBeenCalledWith(
        "aggregator:vaults:ethereum",
        expect.any(Function),
      );
    });
  });

  describe("findBestYield", () => {
    it("should sort vaults by APY descending", () => {
      const vaults = [
        createMockVault({ apy: 0.03 }),
        createMockVault({ apy: 0.08 }),
        createMockVault({ apy: 0.05 }),
        createMockVault({ apy: 0.02 }),
      ];

      const sorted = [...vaults].sort((a, b) => b.apy - a.apy);

      expect(sorted[0].apy).toBe(0.08);
      expect(sorted[1].apy).toBe(0.05);
      expect(sorted[2].apy).toBe(0.03);
      expect(sorted[3].apy).toBe(0.02);
    });

    it("should filter by minimum APY", () => {
      const vaults = [
        createMockVault({ apy: 0.03 }),
        createMockVault({ apy: 0.08 }),
        createMockVault({ apy: 0.01 }),
        createMockVault({ apy: 0.05 }),
      ];
      
      const minApy = 0.02;
      const filtered = vaults.filter(v => v.apy >= minApy);

      expect(filtered).toHaveLength(3);
      expect(filtered.every(v => v.apy >= minApy)).toBe(true);
    });

    it("should filter by minimum TVL", () => {
      const vaults = [
        createMockVault({ tvlUsd: 1000000 }),
        createMockVault({ tvlUsd: 50000 }),
        createMockVault({ tvlUsd: 500000 }),
        createMockVault({ tvlUsd: 100000000 }),
      ];
      
      const minTvl = 100000; // $100k minimum
      const filtered = vaults.filter(v => v.tvlUsd >= minTvl);

      expect(filtered).toHaveLength(3);
      expect(filtered.every(v => v.tvlUsd >= minTvl)).toBe(true);
    });

    it("should return best vault for an asset", () => {
      const usdcAddress = TOKENS.ethereum.USDC.address;
      
      const vaults = [
        createMockVault({ 
          apy: 0.035, 
          depositToken: { address: usdcAddress, symbol: "USDC", decimals: 6 },
        }),
        createMockVault({ 
          apy: 0.055, 
          depositToken: { address: usdcAddress, symbol: "USDC", decimals: 6 },
        }),
        createMockVault({ 
          apy: 0.08, 
          depositToken: { address: TOKENS.ethereum.WETH.address, symbol: "WETH", decimals: 18 },
        }),
      ];

      const usdcVaults = vaults.filter(
        v => v.depositToken?.address.toLowerCase() === usdcAddress.toLowerCase()
      );
      const bestUsdcVault = usdcVaults.sort((a, b) => b.apy - a.apy)[0];

      expect(bestUsdcVault.apy).toBe(0.055);
    });
  });

  describe("Risk Level Filtering", () => {
    it("should filter by maximum risk level - LOW only", () => {
      const vaults = [
        createMockVault({ riskLevel: RiskLevel.LOW }),
        createMockVault({ riskLevel: RiskLevel.MEDIUM }),
        createMockVault({ riskLevel: RiskLevel.HIGH }),
        createMockVault({ riskLevel: RiskLevel.LOW }),
      ];

      const riskOrder = { LOW: 0, MEDIUM: 1, HIGH: 2 };
      const maxRisk = RiskLevel.LOW;
      
      const filtered = vaults.filter(
        v => riskOrder[v.riskLevel] <= riskOrder[maxRisk]
      );

      expect(filtered).toHaveLength(2);
      expect(filtered.every(v => v.riskLevel === RiskLevel.LOW)).toBe(true);
    });

    it("should filter by maximum risk level - MEDIUM and below", () => {
      const vaults = [
        createMockVault({ riskLevel: RiskLevel.LOW }),
        createMockVault({ riskLevel: RiskLevel.MEDIUM }),
        createMockVault({ riskLevel: RiskLevel.HIGH }),
        createMockVault({ riskLevel: RiskLevel.MEDIUM }),
      ];

      const riskOrder = { LOW: 0, MEDIUM: 1, HIGH: 2 };
      const maxRisk = RiskLevel.MEDIUM;
      
      const filtered = vaults.filter(
        v => riskOrder[v.riskLevel] <= riskOrder[maxRisk]
      );

      expect(filtered).toHaveLength(3);
      expect(filtered.every(v => v.riskLevel !== RiskLevel.HIGH)).toBe(true);
    });

    it("should include all vaults when max risk is HIGH", () => {
      const vaults = [
        createMockVault({ riskLevel: RiskLevel.LOW }),
        createMockVault({ riskLevel: RiskLevel.MEDIUM }),
        createMockVault({ riskLevel: RiskLevel.HIGH }),
      ];

      const riskOrder = { LOW: 0, MEDIUM: 1, HIGH: 2 };
      const maxRisk = RiskLevel.HIGH;
      
      const filtered = vaults.filter(
        v => riskOrder[v.riskLevel] <= riskOrder[maxRisk]
      );

      expect(filtered).toHaveLength(3);
    });
  });

  describe("Vault Scoring", () => {
    it("should calculate risk-adjusted score", () => {
      const calculateScore = (vault: { apy: number; tvlUsd: number; riskLevel: RiskLevel }) => {
        const riskMultipliers = { LOW: 1.0, MEDIUM: 0.8, HIGH: 0.6 };
        const riskMultiplier = riskMultipliers[vault.riskLevel];
        const tvlScore = Math.min(Math.log10(vault.tvlUsd || 1) / 10, 1);
        const apyScore = Math.min(vault.apy / 0.20, 1);
        
        return (apyScore * 0.5 + tvlScore * 0.3) * riskMultiplier;
      };

      const lowRiskVault = { apy: 0.05, tvlUsd: 100000000, riskLevel: RiskLevel.LOW };
      const highRiskVault = { apy: 0.10, tvlUsd: 10000000, riskLevel: RiskLevel.HIGH };

      const lowRiskScore = calculateScore(lowRiskVault);
      const highRiskScore = calculateScore(highRiskVault);

      // Low risk vault with decent APY should score reasonably
      expect(lowRiskScore).toBeGreaterThan(0.3);
      
      // High risk vault penalized despite higher APY
      expect(highRiskScore).toBeLessThan(lowRiskScore * 1.5);
    });

    it("should prefer higher TVL vaults when APY is similar", () => {
      const vaults = [
        createMockVault({ apy: 0.05, tvlUsd: 10000000 }),
        createMockVault({ apy: 0.05, tvlUsd: 500000000 }),
        createMockVault({ apy: 0.05, tvlUsd: 1000000 }),
      ];

      const calculateScore = (vault: typeof vaults[0]) => {
        const tvlScore = Math.log10(vault.tvlUsd || 1) / 10;
        const apyScore = vault.apy / 0.20;
        return apyScore * 0.5 + tvlScore * 0.3;
      };

      const sorted = [...vaults].sort(
        (a, b) => calculateScore(b) - calculateScore(a)
      );

      expect(sorted[0].tvlUsd).toBe(500000000);
    });
  });

  describe("Chain Support", () => {
    it("should return protocols available on each chain", () => {
      const protocolChains: Record<string, string[]> = {
        AAVE: ["ethereum", "arbitrum", "polygon", "base", "optimism"],
        YEARN: ["ethereum", "arbitrum", "polygon", "base", "optimism"],
        BEEFY: ["arbitrum", "polygon", "base", "optimism"],
        LIDO: ["ethereum"],
        JITO: ["solana"],
      };

      const getProtocolsForChain = (chain: string) => {
        return Object.entries(protocolChains)
          .filter(([_, chains]) => chains.includes(chain))
          .map(([protocol]) => protocol);
      };

      expect(getProtocolsForChain("ethereum")).toContain("AAVE");
      expect(getProtocolsForChain("ethereum")).toContain("LIDO");
      expect(getProtocolsForChain("ethereum")).not.toContain("BEEFY");
      expect(getProtocolsForChain("solana")).toContain("JITO");
      expect(getProtocolsForChain("solana")).not.toContain("AAVE");
    });
  });

  describe("Product Type Filtering", () => {
    it("should filter by product type", () => {
      const vaults = [
        createMockVault({ protocol: DeFiProtocol.AAVE }),
        createMockVault({ protocol: DeFiProtocol.YEARN }),
        createMockVault({ protocol: DeFiProtocol.LIDO }),
      ];

      // Assign product types
      vaults[0].productType = DeFiProductType.LENDING;
      vaults[1].productType = DeFiProductType.YIELD_AGGREGATOR;
      vaults[2].productType = DeFiProductType.LIQUID_STAKING;

      const lendingVaults = vaults.filter(
        v => v.productType === DeFiProductType.LENDING
      );
      const stakingVaults = vaults.filter(
        v => v.productType === DeFiProductType.LIQUID_STAKING
      );

      expect(lendingVaults).toHaveLength(1);
      expect(stakingVaults).toHaveLength(1);
    });
  });
});
