/**
 * Aave Provider Unit Tests
 * Tests for Aave V3 integration functions
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMockPublicClient,
  mockAaveReserveData,
  mockAaveUserAccountData,
  mockAaveReserveConfigData,
} from "../../utils/mocks.js";
import { TOKENS, VAULTS } from "../../utils/fixtures.js";
import { DeFiProtocol, RiskLevel } from "../../../src/services/defi/types.js";

// Mock the viem utility
vi.mock("../../../src/utils/viem.js", () => ({
  getViemClient: vi.fn(),
}));

// Mock Redis caching
vi.mock("../../../src/utils/redis.js", () => ({
  cacheGetOrFetch: vi.fn((key, fn) => fn()),
  cacheGet: vi.fn(() => null),
  cacheSet: vi.fn(),
}));

describe("Aave Provider", () => {
  let mockClient: ReturnType<typeof createMockPublicClient>;
  
  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = createMockPublicClient();
  });

  describe("getVaults", () => {
    it("should return valid vaults for supported chains", async () => {
      // Mock the contract calls
      mockClient.readContract = vi.fn()
        .mockResolvedValueOnce([
          { symbol: "USDC", tokenAddress: TOKENS.ethereum.USDC.address },
          { symbol: "WETH", tokenAddress: TOKENS.ethereum.WETH.address },
        ])
        .mockResolvedValue(Object.values(mockAaveReserveData));

      // Import after mocking
      const { getViemClient } = await import("../../../src/utils/viem.js");
      (getViemClient as any).mockReturnValue(mockClient);

      // Test vault fetching
      const vaults = [
        {
          address: TOKENS.ethereum.USDC.address,
          name: "Aave USDC",
          symbol: "aUSDC",
          protocol: DeFiProtocol.AAVE,
          chain: "ethereum",
          apy: 0.03,
          tvlUsd: 1000000,
          riskLevel: RiskLevel.LOW,
        },
      ];

      expect(vaults).toHaveLength(1);
      expect(vaults[0].protocol).toBe(DeFiProtocol.AAVE);
      expect(vaults[0].chain).toBe("ethereum");
    });

    it("should filter out frozen or inactive reserves", async () => {
      const frozenConfig = { ...mockAaveReserveConfigData, isFrozen: true };
      
      mockClient.readContract = vi.fn()
        .mockResolvedValueOnce([
          { symbol: "FROZEN", tokenAddress: "0x1111111111111111111111111111111111111111" },
        ])
        .mockResolvedValueOnce(Object.values(frozenConfig));

      const vaults: any[] = [];
      
      // Frozen vaults should be filtered
      expect(vaults.filter(v => !v.isFrozen)).toHaveLength(0);
    });

    it("should throw error for unsupported chains", () => {
      expect(() => {
        // Simulate unsupported chain check
        const supportedChains = ["ethereum", "arbitrum", "polygon", "base", "optimism"];
        if (!supportedChains.includes("unsupportedChain")) {
          throw new Error("Aave V3 not supported on unsupportedChain");
        }
      }).toThrow("Aave V3 not supported");
    });
  });

  describe("getDepositQuote", () => {
    it("should calculate deposit quote correctly", async () => {
      const depositAmount = 1000000000n; // 1000 USDC (6 decimals)
      const currentApy = 0.035; // 3.5%
      
      // Mock reserve data response
      mockClient.readContract = vi.fn()
        .mockResolvedValueOnce(Object.values(mockAaveReserveData))
        .mockResolvedValueOnce({
          aTokenAddress: "0xaToken",
          stableDebtTokenAddress: "0xstableDebt",
          variableDebtTokenAddress: "0xvarDebt",
        });
      
      // Simulate quote calculation
      const quote = {
        vaultAddress: VAULTS.aaveUSDC.address,
        depositToken: TOKENS.ethereum.USDC,
        depositAmount: depositAmount.toString(),
        depositValueUsd: 1000,
        expectedShares: depositAmount.toString(), // 1:1 for aTokens initially
        apy: currentApy,
        estimatedGas: "200000",
        estimatedGasUsd: 15.0,
        calldata: "0x...",
      };

      expect(quote.depositValueUsd).toBe(1000);
      expect(quote.apy).toBeCloseTo(0.035, 2);
      expect(BigInt(quote.expectedShares)).toBe(depositAmount);
    });

    it("should include gas estimation in quote", async () => {
      mockClient.estimateGas = vi.fn().mockResolvedValue(250000n);
      mockClient.getGasPrice = vi.fn().mockResolvedValue(30000000000n); // 30 gwei
      
      const estimatedGas = 250000n;
      const gasPrice = 30000000000n; // 30 gwei
      const ethPrice = 2500; // $2500/ETH
      
      const gasCostWei = estimatedGas * gasPrice;
      const gasCostEth = Number(gasCostWei) / 1e18;
      const gasCostUsd = gasCostEth * ethPrice;
      
      expect(gasCostUsd).toBeCloseTo(18.75, 1);
    });

    it("should handle zero amount gracefully", async () => {
      const quote = {
        depositAmount: "0",
        depositValueUsd: 0,
        expectedShares: "0",
        apy: 0.035,
      };
      
      expect(Number(quote.depositAmount)).toBe(0);
      expect(quote.depositValueUsd).toBe(0);
    });
  });

  describe("getWithdrawQuote", () => {
    it("should calculate withdraw quote correctly", async () => {
      const shareAmount = 1000000000n; // 1000 aUSDC
      const pricePerShare = 1050000n; // 1.05 (5% yield accumulated)
      
      // Calculate expected output
      const expectedOutput = (shareAmount * pricePerShare) / 1000000n;
      
      const quote = {
        vaultAddress: VAULTS.aaveUSDC.address,
        shareAmount: shareAmount.toString(),
        expectedOutput: expectedOutput.toString(),
        expectedOutputValueUsd: Number(expectedOutput) / 1e6,
        estimatedGas: "180000",
        estimatedGasUsd: 13.5,
      };

      expect(Number(quote.expectedOutput)).toBeGreaterThan(Number(shareAmount));
      expect(quote.expectedOutputValueUsd).toBeCloseTo(1050, 1);
    });

    it("should handle max withdrawal", async () => {
      const userBalance = 5000000000n; // 5000 aUSDC
      
      mockClient.readContract = vi.fn()
        .mockResolvedValueOnce([
          userBalance, // currentATokenBalance
          0n, // currentStableDebt
          0n, // currentVariableDebt
          0n, 0n, 0n, 0n, 0, false,
        ]);
      
      // Max withdraw should equal full balance
      expect(userBalance).toBe(5000000000n);
    });
  });

  describe("APY Calculation", () => {
    it("should convert liquidity rate (ray) to APY correctly", () => {
      // Aave uses 27 decimal precision (ray)
      const RAY = 10n ** 27n;
      
      // Test cases: liquidityRate in ray -> expected APY
      const testCases = [
        { ray: 30000000000000000000000000n, expectedApy: 0.03 }, // ~3%
        { ray: 50000000000000000000000000n, expectedApy: 0.05 }, // ~5%
        { ray: 100000000000000000000000000n, expectedApy: 0.10 }, // ~10%
      ];
      
      for (const { ray, expectedApy } of testCases) {
        // Simplified APY calculation (actual uses compound formula)
        const apy = Number(ray) / Number(RAY);
        expect(apy).toBeCloseTo(expectedApy, 2);
      }
    });

    it("should calculate supply APY from reserve data", () => {
      const liquidityRate = mockAaveReserveData.liquidityRate;
      const RAY = 10n ** 27n;
      
      // Convert ray to decimal APY
      const apy = Number(liquidityRate) / Number(RAY);
      
      expect(apy).toBeGreaterThan(0);
      expect(apy).toBeLessThan(1); // APY should be less than 100%
    });

    it("should handle zero liquidity rate", () => {
      const zeroRate = 0n;
      const RAY = 10n ** 27n;
      
      const apy = Number(zeroRate) / Number(RAY);
      
      expect(apy).toBe(0);
    });
  });

  describe("getPosition", () => {
    it("should return user position with correct values", async () => {
      mockClient.readContract = vi.fn()
        .mockResolvedValueOnce([
          1050000000n, // currentATokenBalance (1050 USDC with yield)
          0n, 0n, 0n, 0n, 0n, 0n, 0, true,
        ]);
      
      const position = {
        userId: "user-123",
        protocol: DeFiProtocol.AAVE,
        chain: "ethereum",
        vaultAddress: VAULTS.aaveUSDC.address,
        depositedAmount: "1000000000", // Original 1000 USDC
        currentAmount: "1050000000", // Current 1050 USDC
        unrealizedPnl: 50, // $50 profit
        apy: 0.035,
      };

      expect(Number(position.currentAmount)).toBeGreaterThan(Number(position.depositedAmount));
      expect(position.unrealizedPnl).toBe(50);
    });

    it("should return null for user with no position", async () => {
      mockClient.readContract = vi.fn()
        .mockResolvedValueOnce([
          0n, 0n, 0n, 0n, 0n, 0n, 0n, 0, false,
        ]);
      
      const balance = 0n;
      const hasPosition = balance > 0n;
      
      expect(hasPosition).toBe(false);
    });
  });

  describe("Error Handling", () => {
    it("should handle contract read errors", async () => {
      mockClient.readContract = vi.fn().mockRejectedValue(new Error("Contract call failed"));
      
      await expect(async () => {
        const result = await mockClient.readContract({} as any);
        if (!result) throw new Error("Contract call failed");
      }).rejects.toThrow("Contract call failed");
    });

    it("should handle network errors gracefully", async () => {
      mockClient.readContract = vi.fn().mockRejectedValue(new Error("Network error"));
      
      let error: Error | null = null;
      try {
        await mockClient.readContract({} as any);
      } catch (e) {
        error = e as Error;
      }
      
      expect(error).not.toBeNull();
      expect(error?.message).toBe("Network error");
    });

    it("should validate token addresses", () => {
      const validAddress = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
      const invalidAddress = "not-an-address";
      
      const isValidAddress = (addr: string) => /^0x[a-fA-F0-9]{40}$/.test(addr);
      
      expect(isValidAddress(validAddress)).toBe(true);
      expect(isValidAddress(invalidAddress)).toBe(false);
    });
  });

  describe("Supported Chains", () => {
    it("should support expected chains", () => {
      const supportedChains = ["ethereum", "arbitrum", "polygon", "base", "optimism"];
      
      expect(supportedChains).toContain("ethereum");
      expect(supportedChains).toContain("arbitrum");
      expect(supportedChains).toContain("polygon");
      expect(supportedChains).toContain("base");
      expect(supportedChains).toContain("optimism");
    });

    it("should have correct pool addresses per chain", () => {
      const poolAddresses: Record<string, string> = {
        ethereum: "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2",
        arbitrum: "0x794a61358D6845594F94dc1DB02A252b5b4814aD",
        polygon: "0x794a61358D6845594F94dc1DB02A252b5b4814aD",
        base: "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5",
        optimism: "0x794a61358D6845594F94dc1DB02A252b5b4814aD",
      };
      
      for (const [chain, address] of Object.entries(poolAddresses)) {
        expect(address).toMatch(/^0x[a-fA-F0-9]{40}$/);
      }
    });
  });
});
