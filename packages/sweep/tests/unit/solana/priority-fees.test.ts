/**
 * Tests for Solana Priority Fees Service
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  PriorityFeesService,
  type PriorityLevel,
} from "../../../src/services/solana/priority-fees.js";

// Mock @solana/web3.js
vi.mock("@solana/web3.js", () => ({
  Connection: vi.fn().mockImplementation(() => ({
    getRecentPrioritizationFees: vi.fn().mockResolvedValue([
      { slot: 1, prioritizationFee: 1000 },
      { slot: 2, prioritizationFee: 5000 },
      { slot: 3, prioritizationFee: 10000 },
      { slot: 4, prioritizationFee: 2000 },
      { slot: 5, prioritizationFee: 8000 },
    ]),
  })),
  PublicKey: vi.fn().mockImplementation((key: string) => ({
    toBase58: () => key,
    toString: () => key,
  })),
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("PriorityFeesService", () => {
  let service: PriorityFeesService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new PriorityFeesService({
      rpcUrl: "https://api.mainnet-beta.solana.com",
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("getPriorityFees", () => {
    it("should return priority fees from Helius when configured", async () => {
      const heliusService = new PriorityFeesService({
        rpcUrl: "https://api.mainnet-beta.solana.com",
        heliusApiKey: "test-api-key",
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          result: {
            priorityFeeEstimate: 5000,
            priorityFeeLevels: {
              min: 100,
              low: 1000,
              medium: 5000,
              high: 20000,
              veryHigh: 100000,
              unsafeMax: 500000,
            },
          },
        }),
      });

      const fees = await heliusService.getPriorityFees([], true);

      expect(fees.source).toBe("helius");
      expect(fees.recommended.microLamports).toBe(5000);
      expect(fees.levels.low.microLamports).toBe(1000);
      expect(fees.levels.medium.microLamports).toBe(5000);
      expect(fees.levels.high.microLamports).toBe(20000);
      expect(fees.levels.turbo.microLamports).toBe(100000);
    });

    it("should fall back to native RPC when Helius fails", async () => {
      const heliusService = new PriorityFeesService({
        rpcUrl: "https://api.mainnet-beta.solana.com",
        heliusApiKey: "test-api-key",
      });

      mockFetch.mockRejectedValueOnce(new Error("API Error"));

      const fees = await heliusService.getPriorityFees([], true);

      expect(fees.source).toBe("native");
      expect(fees.levels.low).toBeDefined();
      expect(fees.levels.medium).toBeDefined();
      expect(fees.levels.high).toBeDefined();
      expect(fees.levels.turbo).toBeDefined();
    });

    it("should use cached fees within TTL", async () => {
      const heliusService = new PriorityFeesService({
        rpcUrl: "https://api.mainnet-beta.solana.com",
        heliusApiKey: "test-api-key",
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          result: {
            priorityFeeEstimate: 5000,
            priorityFeeLevels: {
              min: 100,
              low: 1000,
              medium: 5000,
              high: 20000,
              veryHigh: 100000,
              unsafeMax: 500000,
            },
          },
        }),
      });

      // First call - fetches from API
      const fees1 = await heliusService.getPriorityFees([], true);
      
      // Second call - should use cache
      const fees2 = await heliusService.getPriorityFees([]);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(fees1.lastUpdated).toBe(fees2.lastUpdated);
    });
  });

  describe("getRecommendedFee", () => {
    it("should return recommended fee for each priority level", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          result: {
            priorityFeeEstimate: 5000,
            priorityFeeLevels: {
              min: 100,
              low: 1000,
              medium: 5000,
              high: 20000,
              veryHigh: 100000,
              unsafeMax: 500000,
            },
          },
        }),
      });

      const heliusService = new PriorityFeesService({
        heliusApiKey: "test-api-key",
      });

      const lowFee = await heliusService.getRecommendedFee("low");
      const mediumFee = await heliusService.getRecommendedFee("medium");
      const highFee = await heliusService.getRecommendedFee("high");
      const turboFee = await heliusService.getRecommendedFee("turbo");

      expect(lowFee).toBeLessThan(mediumFee);
      expect(mediumFee).toBeLessThan(highFee);
      expect(highFee).toBeLessThan(turboFee);
    });
  });

  describe("calculateComputeUnitPrice", () => {
    it("should calculate correct compute unit price", () => {
      // 1000 lamports for 100,000 compute units
      // = 1000 * 1,000,000 / 100,000 = 10,000 micro-lamports
      const price = service.calculateComputeUnitPrice(1000, 100000);
      expect(price).toBe(10000);
    });

    it("should handle small values", () => {
      const price = service.calculateComputeUnitPrice(100, 50000);
      expect(price).toBe(2000);
    });
  });

  describe("estimateTotalFee", () => {
    it("should estimate total fee correctly", () => {
      // 200,000 compute units at 10,000 micro-lamports/CU
      // Priority fee = (200,000 * 10,000) / 1,000,000 = 2,000 lamports
      // Base fee = 5,000 lamports
      // Total = 7,000 lamports
      const estimate = service.estimateTotalFee(200000, 10000);

      expect(estimate.priorityFeeLamports).toBe(2000);
      expect(estimate.baseFee).toBe(5000);
      expect(estimate.totalFee).toBe(7000);
    });

    it("should handle zero priority fee", () => {
      const estimate = service.estimateTotalFee(200000, 0);

      expect(estimate.priorityFeeLamports).toBe(0);
      expect(estimate.baseFee).toBe(5000);
      expect(estimate.totalFee).toBe(5000);
    });
  });
});
