import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  type AutoSweepSubscription,
  type CreateSubscriptionRequest,
  type UpdateSubscriptionRequest,
  type TriggerType,
  type SubscriptionStatus,
  createSubscriptionSchema,
  updateSubscriptionSchema,
  MAX_SUBSCRIPTION_EXPIRY_DAYS,
  MIN_SWEEP_INTERVAL_HOURS,
  DEFAULT_MIN_SWEEP_VALUE_USD,
  DEFAULT_MAX_SWEEP_COST_PERCENT,
  SUPPORTED_AUTO_SWEEP_CHAINS,
  SUPPORTED_DESTINATION_ASSETS,
} from "../../../src/services/subscriptions/types.js";

describe("Subscription Types", () => {
  describe("createSubscriptionSchema", () => {
    const validRequest: CreateSubscriptionRequest = {
      walletAddress: "0x1234567890123456789012345678901234567890",
      sourceChains: [1, 8453, 42161],
      destinationChain: 8453,
      destinationAsset: "USDC",
      triggerType: "threshold",
      thresholdUsd: 50,
      minSweepValueUsd: 10,
      maxSweepCostPercent: 15,
      spendPermissionSignature: "0x1234567890abcdef",
      spendPermissionExpiry: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      spendPermissionMaxAmount: "1000000000",
    };

    it("should validate a valid threshold-based subscription", () => {
      const result = createSubscriptionSchema.safeParse(validRequest);
      expect(result.success).toBe(true);
    });

    it("should validate a valid schedule-based subscription", () => {
      const scheduleRequest = {
        ...validRequest,
        triggerType: "schedule" as TriggerType,
        thresholdUsd: undefined,
        schedulePattern: "daily",
      };
      const result = createSubscriptionSchema.safeParse(scheduleRequest);
      expect(result.success).toBe(true);
    });

    it("should reject invalid wallet address", () => {
      const result = createSubscriptionSchema.safeParse({
        ...validRequest,
        walletAddress: "invalid",
      });
      expect(result.success).toBe(false);
    });

    it("should reject empty source chains", () => {
      const result = createSubscriptionSchema.safeParse({
        ...validRequest,
        sourceChains: [],
      });
      expect(result.success).toBe(false);
    });

    it("should reject threshold trigger without threshold value", () => {
      const result = createSubscriptionSchema.safeParse({
        ...validRequest,
        thresholdUsd: undefined,
      });
      expect(result.success).toBe(false);
    });

    it("should reject schedule trigger without schedule pattern", () => {
      const result = createSubscriptionSchema.safeParse({
        ...validRequest,
        triggerType: "schedule",
        thresholdUsd: undefined,
        schedulePattern: undefined,
      });
      expect(result.success).toBe(false);
    });

    it("should reject maxSweepCostPercent over 50%", () => {
      const result = createSubscriptionSchema.safeParse({
        ...validRequest,
        maxSweepCostPercent: 60,
      });
      expect(result.success).toBe(false);
    });

    it("should reject invalid expiry date", () => {
      const result = createSubscriptionSchema.safeParse({
        ...validRequest,
        spendPermissionExpiry: "not-a-date",
      });
      expect(result.success).toBe(false);
    });

    it("should apply default values", () => {
      const minimalRequest = {
        walletAddress: "0x1234567890123456789012345678901234567890",
        sourceChains: [8453],
        destinationChain: 8453,
        destinationAsset: "USDC",
        triggerType: "threshold",
        thresholdUsd: 50,
        spendPermissionSignature: "0x1234567890abcdef",
        spendPermissionExpiry: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        spendPermissionMaxAmount: "1000000000",
      };
      const result = createSubscriptionSchema.safeParse(minimalRequest);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.minSweepValueUsd).toBe(DEFAULT_MIN_SWEEP_VALUE_USD);
        expect(result.data.maxSweepCostPercent).toBe(DEFAULT_MAX_SWEEP_COST_PERCENT);
      }
    });
  });

  describe("updateSubscriptionSchema", () => {
    it("should validate partial updates", () => {
      const result = updateSubscriptionSchema.safeParse({
        thresholdUsd: 100,
      });
      expect(result.success).toBe(true);
    });

    it("should allow updating multiple fields", () => {
      const result = updateSubscriptionSchema.safeParse({
        sourceChains: [1, 8453],
        destinationChain: 42161,
        destinationAsset: "ETH",
        triggerType: "schedule",
        schedulePattern: "weekly",
      });
      expect(result.success).toBe(true);
    });

    it("should allow nullable fields", () => {
      const result = updateSubscriptionSchema.safeParse({
        destinationProtocol: null,
        destinationVault: null,
        thresholdUsd: null,
      });
      expect(result.success).toBe(true);
    });

    it("should reject invalid chain array", () => {
      const result = updateSubscriptionSchema.safeParse({
        sourceChains: [],
      });
      expect(result.success).toBe(false);
    });
  });

  describe("Constants", () => {
    it("should have correct max expiry days", () => {
      expect(MAX_SUBSCRIPTION_EXPIRY_DAYS).toBe(30);
    });

    it("should have correct min sweep interval hours", () => {
      expect(MIN_SWEEP_INTERVAL_HOURS).toBe(6);
    });

    it("should have correct default values", () => {
      expect(DEFAULT_MIN_SWEEP_VALUE_USD).toBe(5);
      expect(DEFAULT_MAX_SWEEP_COST_PERCENT).toBe(10);
    });

    it("should have supported chains configured", () => {
      expect(SUPPORTED_AUTO_SWEEP_CHAINS[1]).toBe("ethereum");
      expect(SUPPORTED_AUTO_SWEEP_CHAINS[8453]).toBe("base");
      expect(SUPPORTED_AUTO_SWEEP_CHAINS[42161]).toBe("arbitrum");
      expect(SUPPORTED_AUTO_SWEEP_CHAINS[137]).toBe("polygon");
      expect(SUPPORTED_AUTO_SWEEP_CHAINS[10]).toBe("optimism");
    });

    it("should have supported destination assets", () => {
      expect(SUPPORTED_DESTINATION_ASSETS).toContain("USDC");
      expect(SUPPORTED_DESTINATION_ASSETS).toContain("USDT");
      expect(SUPPORTED_DESTINATION_ASSETS).toContain("DAI");
      expect(SUPPORTED_DESTINATION_ASSETS).toContain("ETH");
      expect(SUPPORTED_DESTINATION_ASSETS).toContain("WETH");
    });
  });
});
