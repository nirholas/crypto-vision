import { describe, it, expect, beforeEach, vi, type Mock } from "vitest";

// Mock the database
vi.mock("../../../src/db/index.js", () => ({
  getDb: vi.fn(() => mockDb),
  subscriptions: { id: "subscriptions.id" },
  dustTokens: {},
}));

// Mock redis
vi.mock("../../../src/utils/redis.js", () => ({
  cacheGet: vi.fn(),
  cacheSet: vi.fn(),
}));

// Mock subscription service
vi.mock("../../../src/services/subscriptions/index.js", () => ({
  getSubscriptionService: vi.fn(() => mockSubscriptionService),
}));

// Mock queue
vi.mock("../../../src/queue/index.js", () => ({
  addSubscriptionSweepJob: vi.fn(),
}));

const mockDb = {
  update: vi.fn(() => ({
    set: vi.fn(() => ({
      where: vi.fn().mockResolvedValue({ rowCount: 1 }),
    })),
  })),
  query: {
    dustTokens: {
      findMany: vi.fn(),
    },
  },
};

const mockSubscriptionService = {
  getActiveSubscriptions: vi.fn(),
  getSubscription: vi.fn(),
  expireStaleSubscriptions: vi.fn(),
  recordSweep: vi.fn(),
};

import { SubscriptionMonitor } from "../../../src/services/subscriptions/monitor.js";
import { cacheGet, cacheSet } from "../../../src/utils/redis.js";
import { addSubscriptionSweepJob } from "../../../src/queue/index.js";
import {
  type AutoSweepSubscription,
  MIN_SWEEP_INTERVAL_HOURS,
} from "../../../src/services/subscriptions/types.js";

describe("SubscriptionMonitor", () => {
  let monitor: SubscriptionMonitor;

  const mockActiveSubscription: AutoSweepSubscription = {
    id: "sub-123",
    userId: "user-123",
    walletAddress: "0x1234567890123456789012345678901234567890",
    sourceChains: [8453],
    destinationChain: 8453,
    destinationAsset: "USDC",
    triggerType: "threshold",
    thresholdUsd: 50,
    minSweepValueUsd: 5,
    maxSweepCostPercent: 10,
    spendPermissionSignature: "0x" + "a".repeat(130),
    spendPermissionHash: "0xhash",
    spendPermissionExpiry: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    spendPermissionMaxAmount: "1000000000",
    status: "active",
    createdAt: new Date(),
    updatedAt: new Date(),
    totalSweeps: 0,
    totalValueSwept: "0",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    monitor = new SubscriptionMonitor();
    (cacheGet as Mock).mockResolvedValue(null);
    (cacheSet as Mock).mockResolvedValue(undefined);
  });

  describe("checkAllSubscriptions", () => {
    it("should check all active subscriptions", async () => {
      mockSubscriptionService.getActiveSubscriptions.mockResolvedValue([
        mockActiveSubscription,
      ]);
      mockSubscriptionService.expireStaleSubscriptions.mockResolvedValue(0);
      mockDb.query.dustTokens.findMany.mockResolvedValue([]);

      const result = await monitor.checkAllSubscriptions();

      expect(result.checked).toBe(1);
      expect(mockSubscriptionService.getActiveSubscriptions).toHaveBeenCalled();
    });

    it("should expire stale subscriptions", async () => {
      mockSubscriptionService.getActiveSubscriptions.mockResolvedValue([]);
      mockSubscriptionService.expireStaleSubscriptions.mockResolvedValue(3);

      const result = await monitor.checkAllSubscriptions();

      expect(result.expired).toBe(3);
    });

    it("should handle errors gracefully", async () => {
      mockSubscriptionService.getActiveSubscriptions.mockRejectedValue(
        new Error("Database error")
      );
      mockSubscriptionService.expireStaleSubscriptions.mockResolvedValue(0);

      const result = await monitor.checkAllSubscriptions();

      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe("checkSubscription", () => {
    it("should skip rate-limited subscriptions", async () => {
      const rateLimitedTime = Date.now();
      (cacheGet as Mock).mockResolvedValue(rateLimitedTime);

      const result = await monitor.checkSubscription(mockActiveSubscription);

      expect(result).toBe(false);
      expect(addSubscriptionSweepJob).not.toHaveBeenCalled();
    });

    it("should skip subscriptions with expired permissions", async () => {
      const expiredSubscription = {
        ...mockActiveSubscription,
        spendPermissionExpiry: new Date(Date.now() - 1000),
      };

      const result = await monitor.checkSubscription(expiredSubscription);

      expect(result).toBe(false);
    });
  });

  describe("checkThresholdTrigger", () => {
    it("should trigger when dust exceeds threshold", async () => {
      const subscription = {
        ...mockActiveSubscription,
        thresholdUsd: 50,
        minSweepValueUsd: 5,
      };

      // Mock dust tokens with $75 total value
      mockDb.query.dustTokens.findMany.mockResolvedValue([
        { valueUsd: "50" },
        { valueUsd: "25" },
      ]);

      const result = await monitor.checkThresholdTrigger(subscription);

      expect(result).toBe(true);
    });

    it("should not trigger when dust below threshold", async () => {
      const subscription = {
        ...mockActiveSubscription,
        thresholdUsd: 100,
        minSweepValueUsd: 5,
      };

      mockDb.query.dustTokens.findMany.mockResolvedValue([
        { valueUsd: "30" },
      ]);

      const result = await monitor.checkThresholdTrigger(subscription);

      expect(result).toBe(false);
    });

    it("should not trigger when no threshold set", async () => {
      const subscription = {
        ...mockActiveSubscription,
        thresholdUsd: undefined,
      };

      const result = await monitor.checkThresholdTrigger(subscription);

      expect(result).toBe(false);
    });

    it("should respect minimum sweep value", async () => {
      const subscription = {
        ...mockActiveSubscription,
        thresholdUsd: 1,
        minSweepValueUsd: 50,
      };

      mockDb.query.dustTokens.findMany.mockResolvedValue([
        { valueUsd: "5" }, // Above threshold but below minimum
      ]);

      const result = await monitor.checkThresholdTrigger(subscription);

      expect(result).toBe(false);
    });
  });

  describe("checkScheduleTrigger", () => {
    it("should trigger when past scheduled time with enough dust", async () => {
      const subscription = {
        ...mockActiveSubscription,
        triggerType: "schedule" as const,
        nextScheduledAt: new Date(Date.now() - 1000), // 1 second ago
        minSweepValueUsd: 5,
      };

      mockDb.query.dustTokens.findMany.mockResolvedValue([
        { valueUsd: "50" },
      ]);

      const result = await monitor.checkScheduleTrigger(subscription);

      expect(result).toBe(true);
    });

    it("should not trigger when scheduled time in future", async () => {
      const subscription = {
        ...mockActiveSubscription,
        triggerType: "schedule" as const,
        nextScheduledAt: new Date(Date.now() + 60000), // 1 minute from now
        minSweepValueUsd: 5,
      };

      const result = await monitor.checkScheduleTrigger(subscription);

      expect(result).toBe(false);
    });

    it("should not trigger when no next scheduled time", async () => {
      const subscription = {
        ...mockActiveSubscription,
        triggerType: "schedule" as const,
        nextScheduledAt: undefined,
      };

      const result = await monitor.checkScheduleTrigger(subscription);

      expect(result).toBe(false);
    });

    it("should not trigger with insufficient dust", async () => {
      const subscription = {
        ...mockActiveSubscription,
        triggerType: "schedule" as const,
        nextScheduledAt: new Date(Date.now() - 1000),
        minSweepValueUsd: 100,
      };

      mockDb.query.dustTokens.findMany.mockResolvedValue([
        { valueUsd: "10" },
      ]);

      const result = await monitor.checkScheduleTrigger(subscription);

      expect(result).toBe(false);
    });
  });

  describe("calculateDustValue", () => {
    it("should calculate total dust value", async () => {
      mockDb.query.dustTokens.findMany.mockResolvedValue([
        { valueUsd: "50.5" },
        { valueUsd: "25.25" },
        { valueUsd: "10.75" },
      ]);

      const value = await monitor.calculateDustValue(
        "0x1234567890123456789012345678901234567890" as any,
        [8453]
      );

      expect(value).toBe(86.5);
    });

    it("should use cached value when available", async () => {
      (cacheGet as Mock).mockResolvedValue(100);

      const value = await monitor.calculateDustValue(
        "0x1234567890123456789012345678901234567890" as any,
        [8453]
      );

      expect(value).toBe(100);
      expect(mockDb.query.dustTokens.findMany).not.toHaveBeenCalled();
    });

    it("should cache calculated value", async () => {
      mockDb.query.dustTokens.findMany.mockResolvedValue([
        { valueUsd: "50" },
      ]);

      await monitor.calculateDustValue(
        "0x1234567890123456789012345678901234567890" as any,
        [8453]
      );

      expect(cacheSet).toHaveBeenCalled();
    });

    it("should return 0 when no dust tokens", async () => {
      mockDb.query.dustTokens.findMany.mockResolvedValue([]);

      const value = await monitor.calculateDustValue(
        "0x1234567890123456789012345678901234567890" as any,
        [8453]
      );

      expect(value).toBe(0);
    });
  });

  describe("checkRateLimit", () => {
    it("should return true when not rate limited", async () => {
      (cacheGet as Mock).mockResolvedValue(null);

      const result = await monitor.checkRateLimit("sub-123");

      expect(result).toBe(true);
    });

    it("should return false when recently swept", async () => {
      (cacheGet as Mock).mockResolvedValue(Date.now() - 1000); // 1 second ago

      const result = await monitor.checkRateLimit("sub-123");

      expect(result).toBe(false);
    });

    it("should return true when rate limit expired", async () => {
      const oldTime = Date.now() - (MIN_SWEEP_INTERVAL_HOURS + 1) * 60 * 60 * 1000;
      (cacheGet as Mock).mockResolvedValue(oldTime);

      const result = await monitor.checkRateLimit("sub-123");

      expect(result).toBe(true);
    });
  });

  describe("triggerSweep", () => {
    beforeEach(() => {
      mockDb.query.dustTokens.findMany.mockResolvedValue([
        {
          tokenAddress: "0xtoken1",
          chain: "base",
          balance: "1000000",
          symbol: "TOKEN1",
          valueUsd: "50",
        },
      ]);
    });

    it("should queue sweep job", async () => {
      const result = await monitor.triggerSweep(mockActiveSubscription);

      expect(result).toBe(true);
      expect(addSubscriptionSweepJob).toHaveBeenCalledWith(
        expect.objectContaining({
          subscriptionId: mockActiveSubscription.id,
          userId: mockActiveSubscription.userId,
          walletAddress: mockActiveSubscription.walletAddress,
        })
      );
    });

    it("should set rate limit after triggering", async () => {
      await monitor.triggerSweep(mockActiveSubscription);

      expect(cacheSet).toHaveBeenCalledWith(
        expect.stringContaining("ratelimit"),
        expect.any(Number),
        expect.any(Number)
      );
    });

    it("should return false when no tokens to sweep", async () => {
      mockDb.query.dustTokens.findMany.mockResolvedValue([]);

      const result = await monitor.triggerSweep(mockActiveSubscription);

      expect(result).toBe(false);
      expect(addSubscriptionSweepJob).not.toHaveBeenCalled();
    });

    it("should skip when cost exceeds max percentage", async () => {
      const lowToleranceSubscription = {
        ...mockActiveSubscription,
        maxSweepCostPercent: 1, // Only 1% tolerance
      };

      // Mock will return tokens, but cost will be ~5% (default estimate)
      const result = await monitor.triggerSweep(lowToleranceSubscription);

      expect(result).toBe(false);
    });

    it("should update next scheduled time for schedule-based subs", async () => {
      const scheduleSubscription = {
        ...mockActiveSubscription,
        triggerType: "schedule" as const,
        schedulePattern: "daily",
      };

      await monitor.triggerSweep(scheduleSubscription);

      expect(mockDb.update).toHaveBeenCalled();
    });
  });
});
