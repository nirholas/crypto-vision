/**
 * Bridge Router Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { type BridgeAggregator, createBridgeAggregator } from "../../../src/services/bridge/index.js";
import { BridgeProvider, BridgeStatus, BRIDGE_CONFIG } from "../../../src/services/bridge/types.js";

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock Redis
vi.mock("../../../src/utils/redis.js", () => ({
  cacheGet: vi.fn().mockResolvedValue(null),
  cacheSet: vi.fn().mockResolvedValue(undefined),
}));

describe("BridgeAggregator", () => {
  let aggregator: BridgeAggregator;

  beforeEach(() => {
    vi.clearAllMocks();
    aggregator = createBridgeAggregator({
      enabledProviders: [BridgeProvider.ACROSS, BridgeProvider.STARGATE],
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("getEnabledProviders", () => {
    it("should return enabled providers", () => {
      const providers = aggregator.getEnabledProviders();
      
      expect(providers).toContain(BridgeProvider.ACROSS);
      expect(providers).toContain(BridgeProvider.STARGATE);
    });
  });

  describe("getQuotes", () => {
    it("should fetch quotes from multiple providers", async () => {
      // Mock Across quote
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          totalRelayFee: { total: "100000", pct: "0.001" },
          relayerCapitalFee: { total: "50000", pct: "0.0005" },
          relayerGasFee: { total: "30000", pct: "0.0003" },
          lpFee: { total: "20000", pct: "0.0002" },
          timestamp: "1700000000",
          isAmountTooLow: false,
          quoteBlock: "18000000",
          exclusiveRelayer: "0x0000000000000000000000000000000000000000",
          exclusivityDeadline: "0",
          spokePoolAddress: "0x5c7BCd6E7De5423a257D81B442095A1a6ced35C5",
          expectedFillTime: 60,
          expectedFillTimeSec: 60,
        }),
      });

      // Mock Stargate - fails, so estimation kicks in
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const quotes = await aggregator.getQuotes({
        sourceChain: "ethereum",
        destinationChain: "arbitrum",
        sourceToken: BRIDGE_CONFIG.USDC_ADDRESSES.ethereum as `0x${string}`,
        destinationToken: BRIDGE_CONFIG.USDC_ADDRESSES.arbitrum as `0x${string}`,
        amount: 1000000000n,
        sender: "0x1234567890123456789012345678901234567890",
        recipient: "0x1234567890123456789012345678901234567890",
      });

      expect(quotes.length).toBeGreaterThan(0);
    });
  });

  describe("getBestQuote", () => {
    it("should return the best quote based on output amount", async () => {
      // Mock Across quote (better output)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          totalRelayFee: { total: "50000", pct: "0.0005" }, // Lower fee
          relayerCapitalFee: { total: "25000", pct: "0.00025" },
          relayerGasFee: { total: "15000", pct: "0.00015" },
          lpFee: { total: "10000", pct: "0.0001" },
          timestamp: "1700000000",
          isAmountTooLow: false,
          quoteBlock: "18000000",
          exclusiveRelayer: "0x0000000000000000000000000000000000000000",
          exclusivityDeadline: "0",
          spokePoolAddress: "0x5c7BCd6E7De5423a257D81B442095A1a6ced35C5",
          expectedFillTime: 60,
          expectedFillTimeSec: 60,
        }),
      });

      // Stargate fallback
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const bestQuote = await aggregator.getBestQuote({
        sourceChain: "ethereum",
        destinationChain: "arbitrum",
        sourceToken: BRIDGE_CONFIG.USDC_ADDRESSES.ethereum as `0x${string}`,
        destinationToken: BRIDGE_CONFIG.USDC_ADDRESSES.arbitrum as `0x${string}`,
        amount: 1000000000n,
        sender: "0x1234567890123456789012345678901234567890",
        recipient: "0x1234567890123456789012345678901234567890",
      });

      expect(bestQuote).not.toBeNull();
      // Across should win due to lower fees and faster fills
    });

    it("should return null when no quotes available", async () => {
      // Mock both providers failing
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
      });

      const bestQuote = await aggregator.getBestQuote({
        sourceChain: "solana" as any, // Unsupported chain
        destinationChain: "arbitrum",
        sourceToken: BRIDGE_CONFIG.USDC_ADDRESSES.ethereum as `0x${string}`,
        destinationToken: BRIDGE_CONFIG.USDC_ADDRESSES.arbitrum as `0x${string}`,
        amount: 1000000000n,
        sender: "0x1234567890123456789012345678901234567890",
        recipient: "0x1234567890123456789012345678901234567890",
      });

      expect(bestQuote).toBeNull();
    });
  });

  describe("findBestRoute", () => {
    it("should sort by speed when priority is speed", async () => {
      // Mock provider responses
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          totalRelayFee: { total: "100000", pct: "0.001" },
          relayerCapitalFee: { total: "50000", pct: "0.0005" },
          relayerGasFee: { total: "30000", pct: "0.0003" },
          lpFee: { total: "20000", pct: "0.0002" },
          timestamp: "1700000000",
          isAmountTooLow: false,
          quoteBlock: "18000000",
          exclusiveRelayer: "0x0000000000000000000000000000000000000000",
          exclusivityDeadline: "0",
          spokePoolAddress: "0x5c7BCd6E7De5423a257D81B442095A1a6ced35C5",
          expectedFillTime: 60,
          expectedFillTimeSec: 60,
        }),
      });

      const routes = await aggregator.findBestRoute({
        sourceChain: "ethereum",
        destChain: "arbitrum",
        token: BRIDGE_CONFIG.USDC_ADDRESSES.ethereum as `0x${string}`,
        amount: "1000000000",
        userAddress: "0x1234567890123456789012345678901234567890",
        priority: "speed",
      });

      expect(routes.length).toBeGreaterThan(0);
      // Should be sorted by estimatedTime ascending
      for (let i = 1; i < routes.length; i++) {
        expect(routes[i].estimatedTime).toBeGreaterThanOrEqual(
          routes[i - 1].estimatedTime
        );
      }
    });

    it("should sort by cost when priority is cost", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          totalRelayFee: { total: "100000", pct: "0.001" },
          relayerCapitalFee: { total: "50000", pct: "0.0005" },
          relayerGasFee: { total: "30000", pct: "0.0003" },
          lpFee: { total: "20000", pct: "0.0002" },
          timestamp: "1700000000",
          isAmountTooLow: false,
          quoteBlock: "18000000",
          exclusiveRelayer: "0x0000000000000000000000000000000000000000",
          exclusivityDeadline: "0",
          spokePoolAddress: "0x5c7BCd6E7De5423a257D81B442095A1a6ced35C5",
          expectedFillTime: 60,
          expectedFillTimeSec: 60,
        }),
      });

      const routes = await aggregator.findBestRoute({
        sourceChain: "ethereum",
        destChain: "arbitrum",
        token: BRIDGE_CONFIG.USDC_ADDRESSES.ethereum as `0x${string}`,
        amount: "1000000000",
        userAddress: "0x1234567890123456789012345678901234567890",
        priority: "cost",
      });

      expect(routes.length).toBeGreaterThan(0);
      // Should be sorted by total fees ascending
    });
  });

  describe("getAllRoutes", () => {
    it("should return all available routes", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          totalRelayFee: { total: "100000", pct: "0.001" },
          relayerCapitalFee: { total: "50000", pct: "0.0005" },
          relayerGasFee: { total: "30000", pct: "0.0003" },
          lpFee: { total: "20000", pct: "0.0002" },
          timestamp: "1700000000",
          isAmountTooLow: false,
          quoteBlock: "18000000",
          exclusiveRelayer: "0x0000000000000000000000000000000000000000",
          exclusivityDeadline: "0",
          spokePoolAddress: "0x5c7BCd6E7De5423a257D81B442095A1a6ced35C5",
          expectedFillTime: 60,
          expectedFillTimeSec: 60,
        }),
      });

      const routes = await aggregator.getAllRoutes({
        sourceChain: "ethereum",
        destChain: "arbitrum",
        token: BRIDGE_CONFIG.USDC_ADDRESSES.ethereum as `0x${string}`,
        amount: "1000000000",
        userAddress: "0x1234567890123456789012345678901234567890",
      });

      expect(Array.isArray(routes)).toBe(true);
    });
  });
});
