/**
 * Across Bridge Provider Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { type AcrossBridgeProvider, createAcrossProvider } from "../../../src/services/bridge/across.js";
import { BridgeProvider, BridgeStatus, BRIDGE_CONFIG } from "../../../src/services/bridge/types.js";

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock Redis
vi.mock("../../../src/utils/redis.js", () => ({
  cacheGet: vi.fn().mockResolvedValue(null),
  cacheSet: vi.fn().mockResolvedValue(undefined),
}));

describe("AcrossBridgeProvider", () => {
  let provider: AcrossBridgeProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = createAcrossProvider();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("supportsRoute", () => {
    it("should return true for supported chains", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          minDeposit: "1000000",
          maxDeposit: "10000000000",
          maxDepositInstant: "5000000000",
        }),
      });

      const result = await provider.supportsRoute(
        "ethereum",
        "arbitrum",
        "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" // USDC
      );

      expect(result).toBe(true);
    });

    it("should return false for unsupported chains", async () => {
      const result = await provider.supportsRoute(
        "solana" as any,
        "ethereum",
        "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
      );

      expect(result).toBe(false);
    });
  });

  describe("getQuote", () => {
    it("should return a valid quote", async () => {
      const mockQuoteResponse = {
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
        expectedFillTime: 300,
        expectedFillTimeSec: 300,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockQuoteResponse,
      });

      const quote = await provider.getQuote({
        sourceChain: "ethereum",
        destinationChain: "arbitrum",
        sourceToken: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        destinationToken: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
        amount: 1000000000n, // 1000 USDC
        sender: "0x1234567890123456789012345678901234567890",
        recipient: "0x1234567890123456789012345678901234567890",
      });

      expect(quote).not.toBeNull();
      expect(quote?.provider).toBe(BridgeProvider.ACROSS);
      expect(quote?.sourceChain).toBe("ethereum");
      expect(quote?.destinationChain).toBe("arbitrum");
      expect(quote?.inputAmount).toBe(1000000000n);
      expect(quote?.outputAmount).toBeLessThan(1000000000n); // Fees deducted
    });

    it("should return null when amount is too low", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          isAmountTooLow: true,
        }),
      });

      const quote = await provider.getQuote({
        sourceChain: "ethereum",
        destinationChain: "arbitrum",
        sourceToken: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        destinationToken: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
        amount: 100n, // Too small
        sender: "0x1234567890123456789012345678901234567890",
        recipient: "0x1234567890123456789012345678901234567890",
      });

      expect(quote).toBeNull();
    });

    it("should return null for unsupported route", async () => {
      const quote = await provider.getQuote({
        sourceChain: "solana" as any,
        destinationChain: "arbitrum",
        sourceToken: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        destinationToken: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
        amount: 1000000000n,
        sender: "0x1234567890123456789012345678901234567890",
        recipient: "0x1234567890123456789012345678901234567890",
      });

      expect(quote).toBeNull();
    });
  });

  describe("getStatus", () => {
    it("should return completed status for filled transfers", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: "filled",
          fillTx: "0xabcdef1234567890",
          depositTxHash: "0x123456",
          depositId: 12345,
          originChainId: 1,
          destinationChainId: 42161,
          amount: "1000000000",
          outputAmount: "999000000",
          fillDeadline: 1700000000,
        }),
      });

      const receipt = await provider.getStatus(
        "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
        "ethereum"
      );

      expect(receipt.status).toBe(BridgeStatus.COMPLETED);
      expect(receipt.destinationTxHash).toBeDefined();
    });

    it("should return failed status for expired transfers", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: "expired",
          depositTxHash: "0x123456",
          depositId: 12345,
          originChainId: 1,
          destinationChainId: 42161,
          amount: "1000000000",
          fillDeadline: 1700000000,
        }),
      });

      const receipt = await provider.getStatus(
        "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
        "ethereum"
      );

      expect(receipt.status).toBe(BridgeStatus.FAILED);
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
