/**
 * Tests for API Pricing Service
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  API_PRICING,
  getEndpointPrice,
  getAllPricing,
  getPricingSummary,
  calculateDiscount,
  applyDiscount,
  isEndpointFree,
  RATE_LIMITS,
  FREE_TIER_DAILY_LIMITS,
  DISCOUNT_TIERS,
} from "../../../src/services/payments/pricing.js";

describe("API Pricing Service", () => {
  describe("getEndpointPrice", () => {
    it("should return correct price for exact endpoint match", () => {
      expect(getEndpointPrice("GET", "/wallet/:address/dust")).toBe(0);
      expect(getEndpointPrice("POST", "/quote")).toBe(5);
      expect(getEndpointPrice("POST", "/sweep")).toBe(10);
      expect(getEndpointPrice("POST", "/consolidate/execute")).toBe(25);
    });

    it("should return correct price with /api prefix", () => {
      expect(getEndpointPrice("POST", "/api/quote")).toBe(5);
      expect(getEndpointPrice("POST", "/api/sweep")).toBe(10);
    });

    it("should handle dynamic path segments", () => {
      // Addresses should be normalized to :address
      expect(getEndpointPrice("GET", "/wallet/0x1234567890123456789012345678901234567890/dust")).toBe(0);
    });

    it("should return 0 for unknown endpoints", () => {
      expect(getEndpointPrice("GET", "/unknown/endpoint")).toBe(0);
      expect(getEndpointPrice("POST", "/nonexistent")).toBe(0);
    });

    it("should be case-insensitive for methods", () => {
      expect(getEndpointPrice("post", "/quote")).toBe(5);
      expect(getEndpointPrice("POST", "/quote")).toBe(5);
      expect(getEndpointPrice("Post", "/quote")).toBe(5);
    });
  });

  describe("getAllPricing", () => {
    it("should return all pricing information", () => {
      const pricing = getAllPricing();

      expect(pricing).toHaveProperty("endpoints");
      expect(pricing).toHaveProperty("categories");
      expect(pricing).toHaveProperty("rateLimits");
      expect(pricing).toHaveProperty("freeTier");
      expect(pricing).toHaveProperty("discounts");
    });

    it("should include rate limits", () => {
      const pricing = getAllPricing();

      expect(pricing.rateLimits).toEqual(RATE_LIMITS);
      expect(pricing.rateLimits.free).toBe(10);
      expect(pricing.rateLimits.paid).toBe(100);
      expect(pricing.rateLimits.premium).toBe(1000);
    });

    it("should include free tier limits", () => {
      const pricing = getAllPricing();

      expect(pricing.freeTier).toEqual(FREE_TIER_DAILY_LIMITS);
      expect(pricing.freeTier.total).toBe(10);
    });

    it("should include discount tiers", () => {
      const pricing = getAllPricing();

      expect(pricing.discounts).toEqual(DISCOUNT_TIERS);
      expect(pricing.discounts.length).toBeGreaterThan(0);
    });

    it("should include USD prices", () => {
      const pricing = getAllPricing();

      for (const [_, info] of Object.entries(pricing.endpoints)) {
        expect(info).toHaveProperty("priceCents");
        expect(info).toHaveProperty("priceUsd");
        expect(typeof info.priceUsd).toBe("string");
      }
    });
  });

  describe("getPricingSummary", () => {
    it("should return pricing summary", () => {
      const summary = getPricingSummary();

      expect(summary).toHaveProperty("cheapest");
      expect(summary).toHaveProperty("mostExpensive");
      expect(summary).toHaveProperty("averagePrice");
      expect(summary).toHaveProperty("freeEndpointsCount");
      expect(summary).toHaveProperty("paidEndpointsCount");
    });

    it("should have valid counts", () => {
      const summary = getPricingSummary();

      expect(summary.freeEndpointsCount).toBeGreaterThanOrEqual(0);
      expect(summary.paidEndpointsCount).toBeGreaterThanOrEqual(0);
      expect(summary.freeEndpointsCount + summary.paidEndpointsCount).toBe(
        Object.keys(API_PRICING).length
      );
    });
  });

  describe("calculateDiscount", () => {
    it("should return 0 for low spend", () => {
      expect(calculateDiscount(0)).toBe(0);
      expect(calculateDiscount(5000)).toBe(0);
      expect(calculateDiscount(9999)).toBe(0);
    });

    it("should return 5% for $100+ spend", () => {
      expect(calculateDiscount(10000)).toBe(0.05);
      expect(calculateDiscount(25000)).toBe(0.05);
    });

    it("should return 10% for $500+ spend", () => {
      expect(calculateDiscount(50000)).toBe(0.10);
      expect(calculateDiscount(75000)).toBe(0.10);
    });

    it("should return 15% for $1000+ spend", () => {
      expect(calculateDiscount(100000)).toBe(0.15);
      expect(calculateDiscount(250000)).toBe(0.15);
    });

    it("should return 20% for $5000+ spend", () => {
      expect(calculateDiscount(500000)).toBe(0.20);
      expect(calculateDiscount(1000000)).toBe(0.20);
    });
  });

  describe("applyDiscount", () => {
    it("should apply discount correctly", () => {
      expect(applyDiscount(100, 0)).toBe(100);
      expect(applyDiscount(100, 0.10)).toBe(90);
      expect(applyDiscount(100, 0.20)).toBe(80);
    });

    it("should round to nearest cent", () => {
      expect(applyDiscount(99, 0.10)).toBe(89);
      expect(applyDiscount(101, 0.10)).toBe(91);
    });
  });

  describe("isEndpointFree", () => {
    it("should return true for free endpoints", () => {
      expect(isEndpointFree("GET", "/wallet/:address/dust")).toBe(true);
      expect(isEndpointFree("GET", "/health")).toBe(true);
    });

    it("should return false for paid endpoints", () => {
      expect(isEndpointFree("POST", "/quote")).toBe(false);
      expect(isEndpointFree("POST", "/sweep")).toBe(false);
    });
  });
});
