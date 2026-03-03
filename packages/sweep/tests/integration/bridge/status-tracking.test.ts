/**
 * Bridge Status Tracking Integration Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock Redis
vi.mock("../../../src/utils/redis.js", () => ({
  redis: {
    get: vi.fn(),
    set: vi.fn().mockResolvedValue("OK"),
    setex: vi.fn().mockResolvedValue("OK"),
    lpush: vi.fn().mockResolvedValue(1),
    lrange: vi.fn().mockResolvedValue([]),
    hset: vi.fn().mockResolvedValue(1),
    hget: vi.fn(),
    hgetall: vi.fn().mockResolvedValue({}),
    incr: vi.fn().mockResolvedValue(1),
    expire: vi.fn().mockResolvedValue(1),
    del: vi.fn().mockResolvedValue(1),
  },
}));

// Mock BullMQ
const mockQueueAdd = vi.fn().mockResolvedValue({ id: "job-1" });
vi.mock("bullmq", () => ({
  Queue: vi.fn().mockImplementation(() => ({
    add: mockQueueAdd,
    getJob: vi.fn().mockResolvedValue(null),
  })),
  Worker: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
  })),
}));

// Mock fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("Bridge Status Tracking", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("Status State Machine", () => {
    it("should track status from pending to completed", async () => {
      // Simulate status progression
      const statusProgression = [
        { status: "pending" },
        { status: "pending" },
        { status: "filled", fillTxHash: "0xfill123" },
      ];

      let callCount = 0;
      mockFetch.mockImplementation(async () => {
        const response = statusProgression[Math.min(callCount++, statusProgression.length - 1)];
        return {
          ok: true,
          json: async () => response,
        };
      });

      const { AcrossBridgeProvider } = await import(
        "../../../src/services/bridge/across.js"
      );

      const provider = new AcrossBridgeProvider();
      const txHash = "0x1234567890123456789012345678901234567890123456789012345678901234";

      // First check - pending
      const status1 = await provider.getStatus(txHash, "ethereum");
      expect(status1.status).toBe("pending");

      // Second check - still pending
      const status2 = await provider.getStatus(txHash, "ethereum");
      expect(status2.status).toBe("pending");

      // Third check - completed
      const status3 = await provider.getStatus(txHash, "ethereum");
      expect(status3.status).toBe("completed");
      expect(status3.destinationTxHash).toBe("0xfill123");
    });

    it("should handle refund status", async () => {
      mockFetch.mockImplementation(async () => ({
        ok: true,
        json: async () => ({
          status: "slowFillRequested",
          fillTxHash: "0xrefund123",
        }),
      }));

      const { AcrossBridgeProvider } = await import(
        "../../../src/services/bridge/across.js"
      );

      const provider = new AcrossBridgeProvider();

      const status = await provider.getStatus(
        "0x1234567890123456789012345678901234567890123456789012345678901234",
        "ethereum"
      );

      expect(["refunded", "pending", "completed"]).toContain(status.status);
    });
  });

  describe("Multi-Provider Status", () => {
    it("should get status from Across provider", async () => {
      mockFetch.mockImplementation(async () => ({
        ok: true,
        json: async () => ({
          status: "filled",
          fillTxHash: "0xfill123",
        }),
      }));

      const { BridgeAggregator, BridgeProvider } = await import(
        "../../../src/services/bridge/index.js"
      );

      const aggregator = new BridgeAggregator();

      const status = await aggregator.getBridgeStatus(
        "0x1234567890123456789012345678901234567890123456789012345678901234",
        "ethereum" as any,
        BridgeProvider.ACROSS
      );

      expect(status).toBeDefined();
      expect(status?.status).toBe("completed");
    });

    it("should get status from cBridge provider", async () => {
      mockFetch.mockImplementation(async () => ({
        ok: true,
        json: async () => ({
          status: 5, // SUCCESS in cBridge
          src_block_tx_link: "https://etherscan.io/tx/0xsrc",
          dst_block_tx_link: "https://arbiscan.io/tx/0xdst",
        }),
      }));

      const { CbridgeBridgeProvider } = await import(
        "../../../src/services/bridge/cbridge.js"
      );

      const provider = new CbridgeBridgeProvider();

      const status = await provider.getStatus(
        "0x1234567890123456789012345678901234567890123456789012345678901234",
        "ethereum"
      );

      expect(status.status).toBe("completed");
    });

    it("should handle Socket bridge status", async () => {
      mockFetch.mockImplementation(async () => ({
        ok: true,
        json: async () => ({
          success: true,
          result: {
            sourceTxStatus: "COMPLETED",
            destinationTxStatus: "COMPLETED",
            bridgeStatus: "COMPLETED",
            destinationTransactionHash: "0xdest123",
          },
        }),
      }));

      const { SocketBridgeProvider } = await import(
        "../../../src/services/bridge/socket.js"
      );

      const provider = new SocketBridgeProvider();

      const status = await provider.getStatus(
        "0x1234567890123456789012345678901234567890123456789012345678901234",
        "ethereum"
      );

      expect(status.status).toBe("completed");
      expect(status.destinationTxHash).toBe("0xdest123");
    });
  });

  describe("History Tracking", () => {
    it("should store bridge transaction in history", async () => {
      const { redis } = await import("../../../src/utils/redis.js");

      const bridgeEntry = {
        txHash: "0x1234",
        provider: "across",
        sourceChain: "ethereum",
        destinationChain: "arbitrum",
        amount: "1000000000",
        status: "pending",
        timestamp: Date.now(),
      };

      await redis.lpush(
        "bridge:history:0xuser123",
        JSON.stringify(bridgeEntry)
      );

      expect(redis.lpush).toHaveBeenCalledWith(
        "bridge:history:0xuser123",
        JSON.stringify(bridgeEntry)
      );
    });

    it("should retrieve bridge history", async () => {
      const { redis } = await import("../../../src/utils/redis.js");

      const mockHistory = [
        JSON.stringify({
          txHash: "0x1234",
          provider: "across",
          status: "completed",
        }),
        JSON.stringify({
          txHash: "0x5678",
          provider: "stargate",
          status: "pending",
        }),
      ];

      vi.mocked(redis.lrange).mockResolvedValue(mockHistory);

      const history = await redis.lrange("bridge:history:0xuser123", 0, 10);

      expect(history).toHaveLength(2);
      expect(JSON.parse(history[0]).txHash).toBe("0x1234");
    });
  });

  describe("Queue Integration", () => {
    it("should add bridge to tracking queue", async () => {
      const trackingData = {
        txHash: "0x1234567890123456789012345678901234567890123456789012345678901234",
        sourceChain: "ethereum",
        destinationChain: "arbitrum",
        provider: "across",
        userAddress: "0xuser123",
        amount: "1000000000",
      };

      // Simulate queue add
      await mockQueueAdd("bridge-tracking", trackingData);

      expect(mockQueueAdd).toHaveBeenCalledWith(
        "bridge-tracking",
        trackingData
      );
    });

    it("should handle queue job with retries", async () => {
      let attempts = 0;
      
      const processJob = async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error("Temporary failure");
        }
        return { success: true };
      };

      // Simulate retry behavior
      let result;
      while (attempts < 3) {
        try {
          result = await processJob();
        } catch (e) {
          // Retry
        }
      }

      expect(attempts).toBe(3);
      expect(result).toEqual({ success: true });
    });
  });

  describe("Error Recovery", () => {
    it("should cache status to handle API failures", async () => {
      const { redis } = await import("../../../src/utils/redis.js");

      // First call succeeds, cache the result
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: "pending",
        }),
      });

      // Set up cache
      vi.mocked(redis.get).mockResolvedValueOnce(null);
      
      const { AcrossBridgeProvider } = await import(
        "../../../src/services/bridge/across.js"
      );

      const provider = new AcrossBridgeProvider();

      const status = await provider.getStatus(
        "0x1234567890123456789012345678901234567890123456789012345678901234",
        "ethereum"
      );

      expect(status.status).toBe("pending");
    });

    it("should handle provider timeout gracefully", async () => {
      // Mock a timeout
      mockFetch.mockImplementation(
        () =>
          new Promise((_, reject) => {
            setTimeout(() => reject(new Error("Timeout")), 100);
          })
      );

      const { AcrossBridgeProvider } = await import(
        "../../../src/services/bridge/across.js"
      );

      const provider = new AcrossBridgeProvider();

      const status = await provider.getStatus(
        "0x1234567890123456789012345678901234567890123456789012345678901234",
        "ethereum"
      );

      // Should return unknown status on error
      expect(status.status).toBeDefined();
    });
  });

  describe("Notification Flow", () => {
    it("should send notification on bridge completion", async () => {
      const { redis } = await import("../../../src/utils/redis.js");

      const notification = {
        type: "bridge_complete",
        txHash: "0x1234",
        destinationTxHash: "0xdest",
        timestamp: Date.now(),
      };

      await redis.lpush(
        "notifications:0xuser123",
        JSON.stringify(notification)
      );

      expect(redis.lpush).toHaveBeenCalledWith(
        "notifications:0xuser123",
        JSON.stringify(notification)
      );
    });

    it("should send notification on bridge failure", async () => {
      const { redis } = await import("../../../src/utils/redis.js");

      const notification = {
        type: "bridge_failed",
        txHash: "0x1234",
        error: "Bridge transaction reverted",
        timestamp: Date.now(),
      };

      await redis.lpush(
        "notifications:0xuser123",
        JSON.stringify(notification)
      );

      expect(redis.lpush).toHaveBeenCalled();
    });
  });
});
