/**
 * Stargate Bridge Provider Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { type StargateBridgeProvider, createStargateProvider } from "../../../src/services/bridge/stargate.js";
import { BridgeProvider, BridgeStatus, BRIDGE_CONFIG } from "../../../src/services/bridge/types.js";

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock Redis
vi.mock("../../../src/utils/redis.js", () => ({
  cacheGet: vi.fn().mockResolvedValue(null),
  cacheSet: vi.fn().mockResolvedValue(undefined),
}));

describe("StargateBridgeProvider", () => {
  let provider: StargateBridgeProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = createStargateProvider();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("supportsRoute", () => {
    it("should return true for supported chains with USDC", async () => {
      const result = await provider.supportsRoute(
        "ethereum",
        "arbitrum",
        BRIDGE_CONFIG.USDC_ADDRESSES.ethereum as `0x${string}`
      );

      expect(result).toBe(true);
    });

    it("should return false for unsupported chains", async () => {
      const result = await provider.supportsRoute(
        "solana" as any,
        "ethereum",
        BRIDGE_CONFIG.USDC_ADDRESSES.ethereum as `0x${string}`
      );

      expect(result).toBe(false);
    });

    it("should return false for unknown tokens", async () => {
      const result = await provider.supportsRoute(
        "ethereum",
        "arbitrum",
        "0x1234567890123456789012345678901234567890" // Unknown token
      );

      expect(result).toBe(false);
    });
  });

  describe("getQuote", () => {
    it("should return a quote using estimation when API fails", async () => {
      // API fails
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const quote = await provider.getQuote({
        sourceChain: "ethereum",
        destinationChain: "arbitrum",
        sourceToken: BRIDGE_CONFIG.USDC_ADDRESSES.ethereum as `0x${string}`,
        destinationToken: BRIDGE_CONFIG.USDC_ADDRESSES.arbitrum as `0x${string}`,
        amount: 1000000000n, // 1000 USDC
        sender: "0x1234567890123456789012345678901234567890",
        recipient: "0x1234567890123456789012345678901234567890",
      });

      expect(quote).not.toBeNull();
      expect(quote?.provider).toBe(BridgeProvider.STARGATE);
      expect(quote?.sourceChain).toBe("ethereum");
      expect(quote?.destinationChain).toBe("arbitrum");
    });

    it("should return a valid quote from API", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          srcPoolId: 1,
          dstPoolId: 1,
          dstChainId: 110,
          amountSD: "999400000",
          amountLD: "999400000",
          eqFee: "100000",
          eqReward: "0",
          lpFee: "300000",
          protocolFee: "200000",
          lzFee: "50000000000000", // 0.00005 ETH
          minAmountLD: "994400000",
          expectedTime: 300,
        }),
      });

      const quote = await provider.getQuote({
        sourceChain: "ethereum",
        destinationChain: "arbitrum",
        sourceToken: BRIDGE_CONFIG.USDC_ADDRESSES.ethereum as `0x${string}`,
        destinationToken: BRIDGE_CONFIG.USDC_ADDRESSES.arbitrum as `0x${string}`,
        amount: 1000000000n, // 1000 USDC
        sender: "0x1234567890123456789012345678901234567890",
        recipient: "0x1234567890123456789012345678901234567890",
      });

      expect(quote).not.toBeNull();
      expect(quote?.provider).toBe(BridgeProvider.STARGATE);
      expect(quote?.estimatedTime).toBe(300);
    });

    it("should return null for unsupported route", async () => {
      const quote = await provider.getQuote({
        sourceChain: "solana" as any,
        destinationChain: "arbitrum",
        sourceToken: BRIDGE_CONFIG.USDC_ADDRESSES.ethereum as `0x${string}`,
        destinationToken: BRIDGE_CONFIG.USDC_ADDRESSES.arbitrum as `0x${string}`,
        amount: 1000000000n,
        sender: "0x1234567890123456789012345678901234567890",
        recipient: "0x1234567890123456789012345678901234567890",
      });

      expect(quote).toBeNull();
    });
  });

  describe("getStatus", () => {
    it("should return completed status for delivered transactions", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: "delivered",
          status_name: "delivered",
          srcTxHash: "0x123",
          dstTxHash: "0xabc",
          srcChainId: 101,
          dstChainId: 110,
          srcBlockNumber: 18000000,
          dstBlockNumber: 150000000,
          nonce: 12345,
        }),
      });

      const receipt = await provider.getStatus(
        "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
        "ethereum"
      );

      expect(receipt.status).toBe(BridgeStatus.COMPLETED);
      expect(receipt.destinationTxHash).toBe("0xabc");
    });

    it("should return bridging status for in-flight transactions", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: "inflight",
          status_name: "inflight",
          srcTxHash: "0x123",
          srcChainId: 101,
          dstChainId: 110,
          srcBlockNumber: 18000000,
          nonce: 12345,
        }),
      });

      const receipt = await provider.getStatus(
        "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
        "ethereum"
      );

      expect(receipt.status).toBe(BridgeStatus.BRIDGING);
    });

    it("should return pending status when not found", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const receipt = await provider.getStatus(
        "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
        "ethereum"
      );

      expect(receipt.status).toBe(BridgeStatus.PENDING);
    });
  });
});
