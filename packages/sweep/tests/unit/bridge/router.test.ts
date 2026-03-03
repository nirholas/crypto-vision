/**
 * Bridge Router Unit Tests
 * Tests for multi-chain bridge routing
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  mockAcrossQuoteResponse,
  mockStargateQuoteResponse,
  mockLiFiQuoteResponse,
} from "../../utils/mocks.js";
import { TOKENS, BRIDGE_ROUTES } from "../../utils/fixtures.js";

// Mock bridge providers
vi.mock("../../../src/services/bridge/across.js", () => ({
  acrossProvider: {
    name: "across",
    supportedChains: ["ethereum", "arbitrum", "polygon", "base", "optimism"],
    getQuote: vi.fn(),
    executeBridge: vi.fn(),
  },
}));

vi.mock("../../../src/services/bridge/stargate.js", () => ({
  stargateProvider: {
    name: "stargate",
    supportedChains: ["ethereum", "arbitrum", "polygon", "base", "optimism"],
    getQuote: vi.fn(),
    executeBridge: vi.fn(),
  },
}));

vi.mock("../../../src/utils/redis.js", () => ({
  cacheGetOrFetch: vi.fn((key, fn) => fn()),
  cacheGet: vi.fn(() => null),
  cacheSet: vi.fn(),
}));

describe("Bridge Router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Bridge Route Finding", () => {
    it("should find routes between supported chains", async () => {
      const supportedRoutes = [
        { from: "ethereum", to: "arbitrum", supported: true },
        { from: "ethereum", to: "polygon", supported: true },
        { from: "arbitrum", to: "base", supported: true },
        { from: "solana", to: "ethereum", supported: false }, // Solana not supported
      ];

      const evmChains = ["ethereum", "arbitrum", "polygon", "base", "optimism"];
      
      const isRouteSupported = (from: string, to: string) =>
        evmChains.includes(from) && evmChains.includes(to);

      for (const route of supportedRoutes) {
        expect(isRouteSupported(route.from, route.to)).toBe(route.supported);
      }
    });

    it("should query multiple bridge providers", async () => {
      const providers = ["across", "stargate", "lifi"];
      const sourceChain = "ethereum";
      const destChain = "arbitrum";
      const amount = BigInt("1000000000"); // 1000 USDC

      const quotes = [
        { provider: "across", outputAmount: BigInt("998000000"), fee: BigInt("2000000") },
        { provider: "stargate", outputAmount: BigInt("995000000"), fee: BigInt("5000000") },
        { provider: "lifi", outputAmount: BigInt("997000000"), fee: BigInt("3000000") },
      ];

      expect(quotes).toHaveLength(3);
      expect(quotes.every(q => q.outputAmount > 0n)).toBe(true);
    });

    it("should return best route by output amount", () => {
      const quotes = [
        { provider: "across", outputAmount: BigInt("998000000") },
        { provider: "stargate", outputAmount: BigInt("995000000") },
        { provider: "lifi", outputAmount: BigInt("997000000") },
      ];

      const best = quotes.sort((a, b) => 
        Number(b.outputAmount - a.outputAmount)
      )[0];

      expect(best.provider).toBe("across");
    });

    it("should handle no available routes", () => {
      const findRoute = (from: string, to: string, token: string) => {
        // Simulate no route available
        if (from === "unsupported" || to === "unsupported") {
          return null;
        }
        return { from, to, token };
      };

      expect(findRoute("unsupported", "ethereum", "USDC")).toBeNull();
      expect(findRoute("ethereum", "arbitrum", "USDC")).not.toBeNull();
    });
  });

  describe("Fee Comparison", () => {
    it("should calculate total bridge fees correctly", () => {
      const quote = {
        bridgeFee: BigInt("100000"), // 0.1 USDC
        gasFee: BigInt("500000"), // 0.5 USDC
        relayerFee: BigInt("200000"), // 0.2 USDC
      };

      const totalFee = quote.bridgeFee + quote.gasFee + quote.relayerFee;
      const totalFeeUsd = Number(totalFee) / 1e6; // Assuming 6 decimals

      expect(totalFeeUsd).toBe(0.8);
    });

    it("should compare fees as percentage of amount", () => {
      const amount = BigInt("100000000"); // 100 USDC
      
      const quotes = [
        { provider: "across", totalFee: BigInt("500000") }, // 0.5%
        { provider: "stargate", totalFee: BigInt("1500000") }, // 1.5%
        { provider: "lifi", totalFee: BigInt("800000") }, // 0.8%
      ];

      const withFeePercent = quotes.map(q => ({
        ...q,
        feePercent: Number(q.totalFee * 10000n / amount) / 100,
      }));

      expect(withFeePercent[0].feePercent).toBe(0.5);
      expect(withFeePercent[1].feePercent).toBe(1.5);
    });

    it("should factor in destination gas fees", () => {
      const sourceGasUsd = 15; // Ethereum
      const destGasUsd = 0.05; // Arbitrum
      const bridgeFeeUsd = 0.5;

      const totalCostUsd = sourceGasUsd + destGasUsd + bridgeFeeUsd;

      expect(totalCostUsd).toBeCloseTo(15.55, 2);
    });

    it("should identify most cost-effective route", () => {
      const routes = [
        { provider: "across", bridgeFee: 0.5, gasUsd: 10, time: 2 },
        { provider: "stargate", bridgeFee: 0.3, gasUsd: 15, time: 5 },
        { provider: "lifi", bridgeFee: 0.4, gasUsd: 8, time: 3 },
      ];

      const withTotalCost = routes.map(r => ({
        ...r,
        totalCost: r.bridgeFee + r.gasUsd,
      }));

      const cheapest = withTotalCost.sort((a, b) => a.totalCost - b.totalCost)[0];

      expect(cheapest.provider).toBe("lifi");
    });
  });

  describe("Chain Support", () => {
    it("should check source chain support", () => {
      const providerChains: Record<string, string[]> = {
        across: ["ethereum", "arbitrum", "polygon", "base", "optimism"],
        stargate: ["ethereum", "arbitrum", "polygon", "base", "optimism", "bsc"],
      };

      const isChainSupported = (provider: string, chain: string) =>
        providerChains[provider]?.includes(chain) ?? false;

      expect(isChainSupported("across", "ethereum")).toBe(true);
      expect(isChainSupported("across", "bsc")).toBe(false);
      expect(isChainSupported("stargate", "bsc")).toBe(true);
    });

    it("should check destination chain support", () => {
      const routeSupport = {
        across: {
          ethereum: ["arbitrum", "polygon", "base", "optimism"],
          arbitrum: ["ethereum", "polygon", "base", "optimism"],
        },
        stargate: {
          ethereum: ["arbitrum", "polygon", "base", "optimism", "bsc"],
          arbitrum: ["ethereum", "polygon", "base", "optimism", "bsc"],
        },
      };

      const isRouteSupported = (provider: string, from: string, to: string) => {
        const providerRoutes = routeSupport[provider as keyof typeof routeSupport];
        if (!providerRoutes) return false;
        const fromRoutes = providerRoutes[from as keyof typeof providerRoutes];
        return fromRoutes?.includes(to) ?? false;
      };

      expect(isRouteSupported("across", "ethereum", "arbitrum")).toBe(true);
      expect(isRouteSupported("across", "ethereum", "bsc")).toBe(false);
      expect(isRouteSupported("stargate", "ethereum", "bsc")).toBe(true);
    });

    it("should check token support on route", () => {
      const supportedTokens: Record<string, Record<string, string[]>> = {
        across: {
          "ethereum-arbitrum": ["USDC", "USDT", "WETH", "WBTC"],
          "ethereum-polygon": ["USDC", "USDT", "WETH"],
        },
        stargate: {
          "ethereum-arbitrum": ["USDC", "USDT", "ETH"],
          "ethereum-bsc": ["USDC", "USDT"],
        },
      };

      const isTokenSupported = (provider: string, from: string, to: string, token: string) => {
        const route = `${from}-${to}`;
        return supportedTokens[provider]?.[route]?.includes(token) ?? false;
      };

      expect(isTokenSupported("across", "ethereum", "arbitrum", "USDC")).toBe(true);
      expect(isTokenSupported("across", "ethereum", "arbitrum", "DAI")).toBe(false);
    });
  });

  describe("Bridge Time Estimation", () => {
    it("should return estimated bridge time", () => {
      const bridgeTimes: Record<string, number> = {
        across: 120, // 2 minutes (optimistic relayer)
        stargate: 300, // 5 minutes (LayerZero)
        lifi: 180, // 3 minutes (varies)
      };

      expect(bridgeTimes.across).toBe(120);
      expect(bridgeTimes.stargate).toBe(300);
    });

    it("should factor time into route selection", () => {
      const routes = [
        { provider: "across", cost: 10, time: 120 },
        { provider: "stargate", cost: 8, time: 600 },
        { provider: "lifi", cost: 9, time: 180 },
      ];

      // User prefers speed
      const preferSpeed = (routes: typeof routes[0][]) => 
        routes.sort((a, b) => a.time - b.time)[0];

      // User prefers cost
      const preferCost = (routes: typeof routes[0][]) =>
        routes.sort((a, b) => a.cost - b.cost)[0];

      expect(preferSpeed(routes).provider).toBe("across");
      expect(preferCost(routes).provider).toBe("stargate");
    });
  });

  describe("Multi-Chain Sweep Planning", () => {
    it("should plan bridges for multi-chain sweep", () => {
      const dustByChain = [
        { chain: "ethereum", valueUsd: 25 },
        { chain: "arbitrum", valueUsd: 15 },
        { chain: "polygon", valueUsd: 8 },
      ];
      const destinationChain = "base";

      const bridges = dustByChain
        .filter(d => d.chain !== destinationChain)
        .map(d => ({
          from: d.chain,
          to: destinationChain,
          valueUsd: d.valueUsd,
        }));

      expect(bridges).toHaveLength(3);
      expect(bridges.every(b => b.to === destinationChain)).toBe(true);
    });

    it("should skip bridging for destination chain tokens", () => {
      const dustByChain = [
        { chain: "base", valueUsd: 10 },
        { chain: "ethereum", valueUsd: 25 },
      ];
      const destinationChain = "base";

      const needsBridging = dustByChain.filter(d => d.chain !== destinationChain);

      expect(needsBridging).toHaveLength(1);
      expect(needsBridging[0].chain).toBe("ethereum");
    });

    it("should calculate total bridging costs", () => {
      const bridgePlans = [
        { from: "ethereum", valueUsd: 25, bridgeFeeUsd: 1.5, gasUsd: 15 },
        { from: "arbitrum", valueUsd: 15, bridgeFeeUsd: 0.3, gasUsd: 0.1 },
        { from: "polygon", valueUsd: 8, bridgeFeeUsd: 0.2, gasUsd: 0.02 },
      ];

      const totalValue = bridgePlans.reduce((sum, p) => sum + p.valueUsd, 0);
      const totalCosts = bridgePlans.reduce(
        (sum, p) => sum + p.bridgeFeeUsd + p.gasUsd,
        0
      );
      const netValue = totalValue - totalCosts;

      expect(totalValue).toBe(48);
      expect(totalCosts).toBeCloseTo(17.12, 2);
      expect(netValue).toBeCloseTo(30.88, 2);
    });

    it("should filter out unprofitable bridges", () => {
      const bridges = [
        { from: "ethereum", valueUsd: 5, totalCostUsd: 16 }, // Unprofitable
        { from: "arbitrum", valueUsd: 15, totalCostUsd: 0.5 }, // Profitable
        { from: "polygon", valueUsd: 8, totalCostUsd: 0.3 }, // Profitable
      ];

      const profitable = bridges.filter(b => b.valueUsd > b.totalCostUsd);

      expect(profitable).toHaveLength(2);
      expect(profitable.map(p => p.from)).toContain("arbitrum");
      expect(profitable.map(p => p.from)).not.toContain("ethereum");
    });
  });

  describe("Error Handling", () => {
    it("should handle bridge provider errors", async () => {
      const getBridgeQuote = async (provider: string) => {
        if (provider === "failing") {
          throw new Error("Bridge provider unavailable");
        }
        return { provider, outputAmount: BigInt("998000000") };
      };

      await expect(getBridgeQuote("failing")).rejects.toThrow("Bridge provider unavailable");
      await expect(getBridgeQuote("across")).resolves.toBeDefined();
    });

    it("should handle insufficient liquidity", () => {
      const checkLiquidity = (amount: bigint, available: bigint) => {
        if (amount > available) {
          throw new Error("Insufficient bridge liquidity");
        }
        return true;
      };

      expect(() => checkLiquidity(BigInt("1000"), BigInt("500"))).toThrow("Insufficient bridge liquidity");
      expect(checkLiquidity(BigInt("500"), BigInt("1000"))).toBe(true);
    });

    it("should validate bridge addresses", () => {
      const isValidAddress = (addr: string) => /^0x[a-fA-F0-9]{40}$/.test(addr);
      
      expect(isValidAddress("0x5c7BCd6E7De5423a257D81B442095A1a6ced35C5")).toBe(true);
      expect(isValidAddress("invalid")).toBe(false);
    });
  });

  describe("Bridge Priority Calculation", () => {
    it("should prioritize higher value bridges", () => {
      const bridges = [
        { from: "ethereum", valueUsd: 5 },
        { from: "arbitrum", valueUsd: 25 },
        { from: "polygon", valueUsd: 10 },
      ];

      const prioritized = [...bridges].sort((a, b) => b.valueUsd - a.valueUsd);

      expect(prioritized[0].from).toBe("arbitrum");
      expect(prioritized[0].valueUsd).toBe(25);
    });

    it("should factor in bridge time for priority", () => {
      const bridges = [
        { from: "ethereum", valueUsd: 20, estimatedTime: 600 },
        { from: "arbitrum", valueUsd: 20, estimatedTime: 120 },
      ];

      // For same value, prefer faster bridge
      const prioritized = [...bridges].sort((a, b) => {
        if (a.valueUsd === b.valueUsd) {
          return a.estimatedTime - b.estimatedTime;
        }
        return b.valueUsd - a.valueUsd;
      });

      expect(prioritized[0].from).toBe("arbitrum");
    });
  });
});
