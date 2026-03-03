/**
 * Tests for Jupiter Aggregator
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { JupiterAggregator } from "../../../src/services/dex/aggregators/jupiter.js";

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("JupiterAggregator", () => {
  let aggregator: JupiterAggregator;

  beforeEach(() => {
    vi.clearAllMocks();
    aggregator = new JupiterAggregator();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("isAvailable", () => {
    it("should return true for solana chain", () => {
      expect(aggregator.isAvailable("solana")).toBe(true);
    });

    it("should return false for non-solana chains", () => {
      expect(aggregator.isAvailable("ethereum")).toBe(false);
      expect(aggregator.isAvailable("base")).toBe(false);
      expect(aggregator.isAvailable("arbitrum")).toBe(false);
    });
  });

  describe("getQuote", () => {
    it("should return a valid quote for a swap", async () => {
      const mockQuoteResponse = {
        inputMint: "TokenA111111111111111111111111111111111111",
        inAmount: "1000000000",
        outputMint: "So11111111111111111111111111111111111111112",
        outAmount: "500000000",
        otherAmountThreshold: "495000000",
        swapMode: "ExactIn",
        slippageBps: 100,
        platformFee: null,
        priceImpactPct: "0.05",
        routePlan: [
          {
            swapInfo: {
              ammKey: "amm1",
              label: "Orca",
              inputMint: "TokenA111111111111111111111111111111111111",
              outputMint: "So11111111111111111111111111111111111111112",
              inAmount: "1000000000",
              outAmount: "500000000",
              feeAmount: "1000000",
              feeMint: "TokenA111111111111111111111111111111111111",
            },
            percent: 100,
          },
        ],
        contextSlot: 12345678,
        timeTaken: 0.05,
      };

      // Mock quote endpoint
      mockFetch.mockImplementation((url: string) => {
        if (url.includes("/quote")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockQuoteResponse),
          });
        }
        if (url.includes("/token/")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              address: "TokenA111111111111111111111111111111111111",
              name: "Test Token",
              symbol: "TEST",
              decimals: 9,
            }),
          });
        }
        return Promise.resolve({ ok: false });
      });

      const quote = await aggregator.getQuote({
        chain: "solana",
        inputToken: "TokenA111111111111111111111111111111111111",
        outputToken: "So11111111111111111111111111111111111111112",
        inputAmount: "1000000000",
        slippage: 1,
        userAddress: "User111111111111111111111111111111111111111",
      });

      expect(quote).not.toBeNull();
      expect(quote!.aggregator).toBe("jupiter");
      expect(quote!.inputAmount).toBe("1000000000");
      expect(quote!.outputAmount).toBe("500000000");
      expect(quote!.priceImpact).toBe(5); // 0.05 * 100
      expect(quote!.slippage).toBe(1);
    });

    it("should return null for non-solana chains", async () => {
      const quote = await aggregator.getQuote({
        chain: "ethereum",
        inputToken: "0x0000000000000000000000000000000000000000",
        outputToken: "0x0000000000000000000000000000000000000001",
        inputAmount: "1000000000000000000",
        slippage: 0.5,
        userAddress: "0x1234567890123456789012345678901234567890",
      });

      expect(quote).toBeNull();
    });

    it("should handle native SOL addresses correctly", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          inputMint: "So11111111111111111111111111111111111111112",
          inAmount: "1000000000",
          outputMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
          outAmount: "150000000",
          otherAmountThreshold: "148500000",
          swapMode: "ExactIn",
          slippageBps: 50,
          priceImpactPct: "0.01",
          routePlan: [],
          contextSlot: 12345678,
          timeTaken: 0.03,
        }),
      });

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          address: "test",
          symbol: "SOL",
          decimals: 9,
        }),
      });

      const quote = await aggregator.getQuote({
        chain: "solana",
        inputToken: "SOL", // Should normalize to wrapped SOL
        outputToken: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        inputAmount: "1000000000",
        slippage: 0.5,
        userAddress: "User111111111111111111111111111111111111111",
      });

      expect(quote).not.toBeNull();
    });

    it("should return null when Jupiter API fails", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        text: () => Promise.resolve("Internal Server Error"),
      });

      const quote = await aggregator.getQuote({
        chain: "solana",
        inputToken: "TokenA111111111111111111111111111111111111",
        outputToken: "So11111111111111111111111111111111111111112",
        inputAmount: "1000000000",
        slippage: 1,
        userAddress: "User111111111111111111111111111111111111111",
      });

      expect(quote).toBeNull();
    });
  });

  describe("getTokenPrice", () => {
    it("should return token price from Jupiter Price API", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: {
            "So11111111111111111111111111111111111111112": {
              id: "So11111111111111111111111111111111111111112",
              mintSymbol: "SOL",
              vsToken: "USDC",
              vsTokenSymbol: "USDC",
              price: 150.25,
            },
          },
        }),
      });

      const price = await aggregator.getTokenPrice(
        "So11111111111111111111111111111111111111112"
      );

      expect(price).toBe(150.25);
    });

    it("should return null when price not found", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: {} }),
      });

      const price = await aggregator.getTokenPrice("unknown-token");

      expect(price).toBeNull();
    });
  });

  describe("getTokenPrices", () => {
    it("should return prices for multiple tokens", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: {
            "So11111111111111111111111111111111111111112": { price: 150.25 },
            "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v": { price: 1.0 },
          },
        }),
      });

      const prices = await aggregator.getTokenPrices([
        "So11111111111111111111111111111111111111112",
        "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      ]);

      expect(prices.get("So11111111111111111111111111111111111111112")).toBe(150.25);
      expect(prices.get("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v")).toBe(1.0);
    });
  });

  describe("isTokenTradeable", () => {
    it("should return true for tradeable tokens", async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      const tradeable = await aggregator.isTokenTradeable(
        "So11111111111111111111111111111111111111112"
      );

      expect(tradeable).toBe(true);
    });

    it("should return false for non-tradeable tokens", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false });

      const tradeable = await aggregator.isTokenTradeable("fake-token");

      expect(tradeable).toBe(false);
    });
  });

  describe("getDustSwapQuote", () => {
    it("should use higher slippage for dust swaps", async () => {
      let capturedUrl = "";
      mockFetch.mockImplementation((url: string) => {
        capturedUrl = url;
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            inputMint: "DustToken1111111111111111111111111111111111",
            inAmount: "1000",
            outputMint: "So11111111111111111111111111111111111111112",
            outAmount: "100",
            otherAmountThreshold: "98",
            swapMode: "ExactIn",
            slippageBps: 200, // 2%
            priceImpactPct: "0.1",
            routePlan: [],
            contextSlot: 12345678,
            timeTaken: 0.05,
          }),
        });
      });

      await aggregator.getDustSwapQuote(
        "DustToken1111111111111111111111111111111111",
        "1000",
        "User111111111111111111111111111111111111111"
      );

      // Should use 2% slippage (200 bps) for dust
      expect(capturedUrl).toContain("slippageBps=200");
    });
  });

  describe("getBatchQuotes", () => {
    it("should return quotes for multiple tokens", async () => {
      let callCount = 0;
      mockFetch.mockImplementation(() => {
        callCount++;
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            inputMint: `Token${callCount}`,
            inAmount: "1000000",
            outputMint: "So11111111111111111111111111111111111111112",
            outAmount: "500000",
            otherAmountThreshold: "490000",
            swapMode: "ExactIn",
            slippageBps: 200,
            priceImpactPct: "0.05",
            routePlan: [],
            contextSlot: 12345678,
            timeTaken: 0.03,
          }),
        });
      });

      const results = await aggregator.getBatchQuotes(
        [
          { mint: "Token1111111111111111111111111111111111111", amount: "1000000" },
          { mint: "Token2222222222222222222222222222222222222", amount: "2000000" },
        ],
        "User111111111111111111111111111111111111111"
      );

      expect(results).toHaveLength(2);
      expect(results[0].mint).toBe("Token1111111111111111111111111111111111111");
      expect(results[1].mint).toBe("Token2222222222222222222222222222222222222");
    });
  });
});
