import { describe, it, expect, beforeEach, vi, afterEach, type Mock } from "vitest";

// Mock the database
vi.mock("../../../src/db/index.js", () => ({
  getDb: vi.fn(() => mockDb),
  subscriptions: {},
  subscriptionSweeps: {},
  users: {},
}));

// Mock redis
vi.mock("../../../src/utils/redis.js", () => ({
  cacheGet: vi.fn(),
  cacheSet: vi.fn(),
}));

const mockDb = {
  insert: vi.fn(() => ({ values: vi.fn().mockResolvedValue(undefined) })),
  update: vi.fn(() => ({
    set: vi.fn(() => ({
      where: vi.fn().mockResolvedValue({ rowCount: 1 }),
    })),
  })),
  query: {
    subscriptions: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    subscriptionSweeps: {
      findMany: vi.fn(),
    },
  },
};

import { SubscriptionService } from "../../../src/services/subscriptions/index.js";
import { cacheGet, cacheSet } from "../../../src/utils/redis.js";
import {
  type CreateSubscriptionRequest,
  SUPPORTED_AUTO_SWEEP_CHAINS,
  MAX_SUBSCRIPTION_EXPIRY_DAYS,
} from "../../../src/services/subscriptions/types.js";

describe("SubscriptionService", () => {
  let service: SubscriptionService;

  const validRequest: CreateSubscriptionRequest = {
    walletAddress: "0x1234567890123456789012345678901234567890",
    sourceChains: [1, 8453],
    destinationChain: 8453,
    destinationAsset: "USDC",
    triggerType: "threshold",
    thresholdUsd: 50,
    minSweepValueUsd: 10,
    maxSweepCostPercent: 15,
    spendPermissionSignature: "0x" + "a".repeat(130),
    spendPermissionExpiry: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    spendPermissionMaxAmount: "1000000000",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new SubscriptionService();
  });

  describe("createSubscription", () => {
    it("should create a valid subscription", async () => {
      const userId = "user-123";
      
      const subscription = await service.createSubscription(userId, validRequest);

      expect(subscription).toBeDefined();
      expect(subscription.userId).toBe(userId);
      expect(subscription.walletAddress).toBe(validRequest.walletAddress.toLowerCase());
      expect(subscription.sourceChains).toEqual(validRequest.sourceChains);
      expect(subscription.destinationChain).toBe(validRequest.destinationChain);
      expect(subscription.status).toBe("active");
    });

    it("should reject unsupported source chains", async () => {
      const invalidRequest = {
        ...validRequest,
        sourceChains: [999999], // Invalid chain
      };

      await expect(
        service.createSubscription("user-123", invalidRequest)
      ).rejects.toThrow("Unsupported chains: 999999");
    });

    it("should reject unsupported destination chain", async () => {
      const invalidRequest = {
        ...validRequest,
        destinationChain: 999999,
      };

      await expect(
        service.createSubscription("user-123", invalidRequest)
      ).rejects.toThrow("Unsupported destination chain: 999999");
    });

    it("should reject expired permission", async () => {
      const invalidRequest = {
        ...validRequest,
        spendPermissionExpiry: new Date(Date.now() - 1000).toISOString(),
      };

      await expect(
        service.createSubscription("user-123", invalidRequest)
      ).rejects.toThrow("Subscription expiry must be in the future");
    });

    it("should reject expiry beyond max days", async () => {
      const tooFarExpiry = new Date();
      tooFarExpiry.setDate(tooFarExpiry.getDate() + MAX_SUBSCRIPTION_EXPIRY_DAYS + 1);

      const invalidRequest = {
        ...validRequest,
        spendPermissionExpiry: tooFarExpiry.toISOString(),
      };

      await expect(
        service.createSubscription("user-123", invalidRequest)
      ).rejects.toThrow(`Subscription expiry cannot exceed ${MAX_SUBSCRIPTION_EXPIRY_DAYS} days`);
    });

    it("should reject invalid spend permission signature", async () => {
      const invalidRequest = {
        ...validRequest,
        spendPermissionSignature: "0x123", // Too short
      };

      await expect(
        service.createSubscription("user-123", invalidRequest)
      ).rejects.toThrow("Invalid spend permission signature");
    });

    it("should set nextScheduledAt for schedule-based subscriptions", async () => {
      const scheduleRequest = {
        ...validRequest,
        triggerType: "schedule" as const,
        thresholdUsd: undefined,
        schedulePattern: "daily",
      };

      const subscription = await service.createSubscription("user-123", scheduleRequest);

      expect(subscription.nextScheduledAt).toBeDefined();
    });

    it("should log audit event on creation", async () => {
      await service.createSubscription("user-123", validRequest);

      expect(cacheSet).toHaveBeenCalled();
    });
  });

  describe("getSubscription", () => {
    it("should return subscription when found", async () => {
      const mockSubscription = {
        id: "sub-123",
        userId: "user-123",
        walletAddress: "0x1234567890123456789012345678901234567890",
        sourceChains: [8453],
        destinationChain: 8453,
        destinationAsset: "USDC",
        triggerType: "threshold",
        thresholdUsd: "50",
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date(),
        spendPermissionExpiry: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      };

      mockDb.query.subscriptions.findFirst.mockResolvedValue(mockSubscription);

      const subscription = await service.getSubscription("sub-123");

      expect(subscription).toBeDefined();
      expect(subscription?.id).toBe("sub-123");
    });

    it("should return null when not found", async () => {
      mockDb.query.subscriptions.findFirst.mockResolvedValue(null);

      const subscription = await service.getSubscription("non-existent");

      expect(subscription).toBeNull();
    });
  });

  describe("listSubscriptions", () => {
    it("should return all user subscriptions", async () => {
      const mockSubscriptions = [
        {
          id: "sub-1",
          userId: "user-123",
          walletAddress: "0x1234567890123456789012345678901234567890",
          sourceChains: [8453],
          destinationChain: 8453,
          destinationAsset: "USDC",
          triggerType: "threshold",
          status: "active",
          createdAt: new Date(),
        },
        {
          id: "sub-2",
          userId: "user-123",
          walletAddress: "0x1234567890123456789012345678901234567890",
          sourceChains: [1, 8453],
          destinationChain: 1,
          destinationAsset: "ETH",
          triggerType: "schedule",
          status: "paused",
          createdAt: new Date(),
        },
      ];

      mockDb.query.subscriptions.findMany.mockResolvedValue(mockSubscriptions);

      const subscriptions = await service.listSubscriptions("user-123");

      expect(subscriptions).toHaveLength(2);
      expect(subscriptions[0].id).toBe("sub-1");
      expect(subscriptions[1].id).toBe("sub-2");
    });

    it("should return empty array when no subscriptions", async () => {
      mockDb.query.subscriptions.findMany.mockResolvedValue([]);

      const subscriptions = await service.listSubscriptions("user-123");

      expect(subscriptions).toEqual([]);
    });
  });

  describe("updateSubscription", () => {
    beforeEach(() => {
      mockDb.query.subscriptions.findFirst.mockResolvedValue({
        id: "sub-123",
        userId: "user-123",
        status: "active",
      });
    });

    it("should update subscription fields", async () => {
      mockDb.query.subscriptions.findFirst
        .mockResolvedValueOnce({
          id: "sub-123",
          userId: "user-123",
          status: "active",
        })
        .mockResolvedValueOnce({
          id: "sub-123",
          userId: "user-123",
          thresholdUsd: "100",
          status: "active",
          sourceChains: [8453],
          destinationChain: 8453,
          destinationAsset: "USDC",
          triggerType: "threshold",
          createdAt: new Date(),
          updatedAt: new Date(),
          spendPermissionExpiry: new Date(),
        });

      const updated = await service.updateSubscription("sub-123", "user-123", {
        thresholdUsd: 100,
      });

      expect(updated).toBeDefined();
      expect(mockDb.update).toHaveBeenCalled();
    });

    it("should return null for non-existent subscription", async () => {
      mockDb.query.subscriptions.findFirst.mockResolvedValue(null);

      const updated = await service.updateSubscription("non-existent", "user-123", {
        thresholdUsd: 100,
      });

      expect(updated).toBeNull();
    });

    it("should reject invalid source chains", async () => {
      await expect(
        service.updateSubscription("sub-123", "user-123", {
          sourceChains: [999999],
        })
      ).rejects.toThrow("Unsupported chains: 999999");
    });
  });

  describe("pauseSubscription", () => {
    it("should pause an active subscription", async () => {
      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue({ rowCount: 1 }),
        }),
      });

      const result = await service.pauseSubscription("sub-123", "user-123");

      expect(result).toBe(true);
      expect(cacheSet).toHaveBeenCalled(); // Audit log
    });

    it("should return false for non-existent subscription", async () => {
      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue({ rowCount: 0 }),
        }),
      });

      const result = await service.pauseSubscription("non-existent", "user-123");

      expect(result).toBe(false);
    });
  });

  describe("resumeSubscription", () => {
    it("should resume a paused subscription with valid permission", async () => {
      mockDb.query.subscriptions.findFirst.mockResolvedValue({
        id: "sub-123",
        userId: "user-123",
        status: "paused",
        spendPermissionExpiry: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        sourceChains: [8453],
        destinationChain: 8453,
        destinationAsset: "USDC",
        triggerType: "threshold",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue({ rowCount: 1 }),
        }),
      });

      const result = await service.resumeSubscription("sub-123", "user-123");

      expect(result).toBe(true);
    });

    it("should throw when spend permission expired", async () => {
      mockDb.query.subscriptions.findFirst.mockResolvedValue({
        id: "sub-123",
        userId: "user-123",
        status: "paused",
        spendPermissionExpiry: new Date(Date.now() - 1000), // Expired
        sourceChains: [8453],
        destinationChain: 8453,
        destinationAsset: "USDC",
        triggerType: "threshold",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await expect(
        service.resumeSubscription("sub-123", "user-123")
      ).rejects.toThrow("Spend permission has expired");
    });
  });

  describe("cancelSubscription", () => {
    it("should cancel a subscription", async () => {
      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue({ rowCount: 1 }),
        }),
      });

      const result = await service.cancelSubscription("sub-123", "user-123");

      expect(result).toBe(true);
      expect(cacheSet).toHaveBeenCalled();
    });
  });

  describe("canExecuteSweep", () => {
    it("should return true for subscription without previous sweep", async () => {
      mockDb.query.subscriptions.findFirst.mockResolvedValue({
        id: "sub-123",
        lastSweepAt: null,
        sourceChains: [8453],
        destinationChain: 8453,
        destinationAsset: "USDC",
        triggerType: "threshold",
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date(),
        spendPermissionExpiry: new Date(),
      });

      const result = await service.canExecuteSweep("sub-123");

      expect(result).toBe(true);
    });

    it("should return false for recent sweep", async () => {
      mockDb.query.subscriptions.findFirst.mockResolvedValue({
        id: "sub-123",
        lastSweepAt: new Date(), // Just swept
        sourceChains: [8453],
        destinationChain: 8453,
        destinationAsset: "USDC",
        triggerType: "threshold",
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date(),
        spendPermissionExpiry: new Date(),
      });

      const result = await service.canExecuteSweep("sub-123");

      expect(result).toBe(false);
    });

    it("should return true for sweep older than 6 hours", async () => {
      const oldSweep = new Date();
      oldSweep.setHours(oldSweep.getHours() - 7); // 7 hours ago

      mockDb.query.subscriptions.findFirst.mockResolvedValue({
        id: "sub-123",
        lastSweepAt: oldSweep,
        sourceChains: [8453],
        destinationChain: 8453,
        destinationAsset: "USDC",
        triggerType: "threshold",
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date(),
        spendPermissionExpiry: new Date(),
      });

      const result = await service.canExecuteSweep("sub-123");

      expect(result).toBe(true);
    });
  });

  describe("recordSweep", () => {
    it("should record sweep and update stats", async () => {
      const insertMock = vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      });
      mockDb.insert = insertMock;

      const setMock = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue({ rowCount: 1 }),
      });
      mockDb.update = vi.fn().mockReturnValue({ set: setMock });

      const sweepRecord = await service.recordSweep("sub-123", "sweep-456", {
        triggeredBy: "threshold",
        dustValueUsd: 100,
        sweepCostUsd: 5,
        tokensSwept: 10,
        chains: [8453, 42161],
      });

      expect(sweepRecord.subscriptionId).toBe("sub-123");
      expect(sweepRecord.sweepId).toBe("sweep-456");
      expect(sweepRecord.netValueUsd).toBe(95);
      expect(insertMock).toHaveBeenCalled();
      expect(mockDb.update).toHaveBeenCalled();
    });
  });
});
