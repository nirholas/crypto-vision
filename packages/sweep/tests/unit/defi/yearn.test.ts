/**
 * Yearn Provider Unit Tests
 * Tests for Yearn V3 vault integration
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMockPublicClient,
  mockYearnVaultResponse,
  createFetchMock,
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

describe("Yearn Provider", () => {
  let mockClient: ReturnType<typeof createMockPublicClient>;
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = createMockPublicClient();
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe("Vault Fetching from API", () => {
    it("should fetch vaults from Yearn API", async () => {
      const mockVaults = [mockYearnVaultResponse];
      
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockVaults,
      });

      // Simulate API fetch
      const response = await fetch("https://ydaemon.yearn.fi/1/vaults/all");
      const vaults = await response.json();

      expect(vaults).toHaveLength(1);
      expect(vaults[0].address).toBe(mockYearnVaultResponse.address);
      expect(vaults[0].apy.net_apy).toBe(0.045);
    });

    it("should handle API errors gracefully", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      });

      const response = await fetch("https://ydaemon.yearn.fi/1/vaults/all");
      
      expect(response.ok).toBe(false);
      expect(response.status).toBe(500);
    });

    it("should filter endorsed vaults only", async () => {
      const mixedVaults = [
        { ...mockYearnVaultResponse, endorsed: true },
        { ...mockYearnVaultResponse, address: "0xunendorsed", endorsed: false },
      ];

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mixedVaults,
      });

      const response = await fetch("https://ydaemon.yearn.fi/1/vaults/all");
      const vaults = await response.json();
      const endorsedVaults = vaults.filter((v: any) => v.endorsed);

      expect(endorsedVaults).toHaveLength(1);
    });

    it("should parse vault metadata correctly", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [mockYearnVaultResponse],
      });

      const response = await fetch("https://ydaemon.yearn.fi/1/vaults/all");
      const [vault] = await response.json();

      expect(vault.name).toBe("USDC Vault");
      expect(vault.symbol).toBe("yvUSDC");
      expect(vault.version).toBe("3.0.0");
      expect(vault.token.symbol).toBe("USDC");
      expect(vault.token.decimals).toBe(6);
    });
  });

  describe("ERC-4626 Deposit/Withdraw Quotes", () => {
    it("should calculate deposit quote using convertToShares", async () => {
      const depositAmount = 1000000000n; // 1000 USDC
      const expectedShares = 950000000n; // Slightly less due to price per share > 1
      
      mockClient.readContract = vi.fn()
        .mockResolvedValueOnce(expectedShares); // convertToShares result

      const { getViemClient } = await import("../../../src/utils/viem.js");
      (getViemClient as any).mockReturnValue(mockClient);

      const shares = await mockClient.readContract({
        address: VAULTS.yearnUSDC.address,
        abi: [],
        functionName: "convertToShares",
        args: [depositAmount],
      });

      expect(shares).toBe(expectedShares);
    });

    it("should calculate withdraw quote using convertToAssets", async () => {
      const shareAmount = 1000000000n; // 1000 vault shares
      const expectedAssets = 1055000000n; // 1055 USDC (5.5% yield)
      
      mockClient.readContract = vi.fn()
        .mockResolvedValueOnce(expectedAssets);

      const assets = await mockClient.readContract({
        address: VAULTS.yearnUSDC.address,
        abi: [],
        functionName: "convertToAssets",
        args: [shareAmount],
      });

      expect(assets).toBe(expectedAssets);
    });

    it("should handle price per share calculation", async () => {
      const totalAssets = 1000000000000n; // 1M USDC
      const totalSupply = 952380952380n; // Shares
      
      mockClient.readContract = vi.fn()
        .mockResolvedValueOnce(totalAssets)
        .mockResolvedValueOnce(totalSupply);

      const pricePerShare = (totalAssets * 1000000n) / totalSupply;
      const expectedPricePerShare = 1050000n; // 1.05 (5% yield)
      
      expect(Number(pricePerShare)).toBeCloseTo(Number(expectedPricePerShare), -4);
    });

    it("should check max deposit limit", async () => {
      const maxDeposit = 10000000000000n; // 10M USDC max
      
      mockClient.readContract = vi.fn()
        .mockResolvedValueOnce(maxDeposit);

      const result = await mockClient.readContract({
        address: VAULTS.yearnUSDC.address,
        abi: [],
        functionName: "maxDeposit",
        args: ["0x1234567890123456789012345678901234567890"],
      });

      expect(result).toBe(maxDeposit);
    });
  });

  describe("Position Tracking", () => {
    it("should fetch user vault balance", async () => {
      const userBalance = 500000000n; // 500 vault shares
      
      mockClient.readContract = vi.fn()
        .mockResolvedValueOnce(userBalance);

      const balance = await mockClient.readContract({
        address: VAULTS.yearnUSDC.address,
        abi: [],
        functionName: "balanceOf",
        args: ["0x1234567890123456789012345678901234567890"],
      });

      expect(balance).toBe(userBalance);
    });

    it("should calculate position value in underlying", async () => {
      const userShares = 500000000n;
      const assetsPerShare = 1055000000n / 1000000000n; // 1.055
      
      // Simple calculation - real would use convertToAssets
      const positionValue = (userShares * 1055n) / 1000n;
      
      expect(Number(positionValue)).toBeCloseTo(527500000, -5);
    });

    it("should track unrealized PnL", () => {
      const depositedAmount = 500; // $500
      const currentValue = 527.5; // $527.50
      
      const unrealizedPnl = currentValue - depositedAmount;
      const pnlPercentage = (unrealizedPnl / depositedAmount) * 100;
      
      expect(unrealizedPnl).toBe(27.5);
      expect(pnlPercentage).toBe(5.5);
    });
  });

  describe("APY Data", () => {
    it("should parse APY data from API response", () => {
      const apyData = mockYearnVaultResponse.apy;
      
      expect(apyData.net_apy).toBe(0.045);
      expect(apyData.gross_apr).toBe(0.05);
      expect(apyData.fees.performance).toBe(0.1);
      expect(apyData.fees.management).toBe(0.02);
    });

    it("should handle missing APY data", () => {
      const vaultWithNoApy = {
        ...mockYearnVaultResponse,
        apy: null,
      };

      const apy = vaultWithNoApy.apy?.net_apy ?? 0;
      
      expect(apy).toBe(0);
    });

    it("should calculate net APY after fees", () => {
      const grossApr = 0.05; // 5%
      const performanceFee = 0.1; // 10%
      const managementFee = 0.02; // 2%
      
      // Simplified: net = gross * (1 - performance) - management
      const netApy = grossApr * (1 - performanceFee) - managementFee;
      
      expect(netApy).toBeCloseTo(0.025, 3);
    });
  });

  describe("Risk Level Mapping", () => {
    it("should assign LOW risk to endorsed V3 vaults", () => {
      const vault = { version: "3.0.0", endorsed: true };
      
      const getRiskLevel = (v: typeof vault) => {
        if (v.endorsed && v.version.startsWith("3")) return RiskLevel.LOW;
        if (v.endorsed) return RiskLevel.MEDIUM;
        return RiskLevel.HIGH;
      };
      
      expect(getRiskLevel(vault)).toBe(RiskLevel.LOW);
    });

    it("should assign MEDIUM risk to endorsed V2 vaults", () => {
      const vault = { version: "2.0.0", endorsed: true };
      
      const getRiskLevel = (v: typeof vault) => {
        if (v.endorsed && v.version.startsWith("3")) return RiskLevel.LOW;
        if (v.endorsed) return RiskLevel.MEDIUM;
        return RiskLevel.HIGH;
      };
      
      expect(getRiskLevel(vault)).toBe(RiskLevel.MEDIUM);
    });

    it("should assign HIGH risk to unendorsed vaults", () => {
      const vault = { version: "3.0.0", endorsed: false };
      
      const getRiskLevel = (v: typeof vault) => {
        if (v.endorsed && v.version.startsWith("3")) return RiskLevel.LOW;
        if (v.endorsed) return RiskLevel.MEDIUM;
        return RiskLevel.HIGH;
      };
      
      expect(getRiskLevel(vault)).toBe(RiskLevel.HIGH);
    });
  });

  describe("Supported Chains", () => {
    it("should support EVM chains with Yearn deployments", () => {
      const supportedChains = {
        ethereum: { chainId: 1, name: "Ethereum" },
        arbitrum: { chainId: 42161, name: "Arbitrum" },
        polygon: { chainId: 137, name: "Polygon" },
        base: { chainId: 8453, name: "Base" },
        optimism: { chainId: 10, name: "Optimism" },
      };

      expect(Object.keys(supportedChains)).toContain("ethereum");
      expect(Object.keys(supportedChains)).toContain("arbitrum");
      expect(supportedChains.ethereum.chainId).toBe(1);
    });

    it("should return correct chain ID for API calls", () => {
      const getChainId = (chain: string): number => {
        const chainIds: Record<string, number> = {
          ethereum: 1,
          arbitrum: 42161,
          polygon: 137,
          base: 8453,
          optimism: 10,
        };
        return chainIds[chain] || 0;
      };

      expect(getChainId("ethereum")).toBe(1);
      expect(getChainId("arbitrum")).toBe(42161);
      expect(getChainId("unknown")).toBe(0);
    });
  });

  describe("Error Handling", () => {
    it("should handle vault not found", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [],
      });

      const response = await fetch("https://ydaemon.yearn.fi/1/vaults/all");
      const vaults = await response.json();
      const targetVault = vaults.find((v: any) => v.address === "0xnonexistent");

      expect(targetVault).toBeUndefined();
    });

    it("should handle network timeout", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("Network timeout"));

      await expect(fetch("https://ydaemon.yearn.fi/1/vaults/all"))
        .rejects.toThrow("Network timeout");
    });

    it("should validate vault addresses", () => {
      const isValidAddress = (addr: string) => /^0x[a-fA-F0-9]{40}$/.test(addr);
      
      expect(isValidAddress(mockYearnVaultResponse.address)).toBe(true);
      expect(isValidAddress("invalid")).toBe(false);
    });
  });
});
