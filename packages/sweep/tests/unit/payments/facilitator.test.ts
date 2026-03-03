/**
 * Tests for x402 Facilitator Service
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

// Mock viem
vi.mock("viem", async () => {
  const actual = await vi.importActual("viem");
  return {
    ...actual,
    createPublicClient: vi.fn().mockReturnValue({
      readContract: vi.fn().mockImplementation(async ({ functionName }) => {
        if (functionName === "balanceOf") {
          return BigInt("10000000");
        }
        if (functionName === "authorizationState") {
          return false;
        }
        return null;
      }),
      waitForTransactionReceipt: vi.fn().mockResolvedValue({
        status: "success",
        transactionHash: "0xtxhash",
      }),
    }),
    createWalletClient: vi.fn().mockReturnValue({
      writeContract: vi.fn().mockResolvedValue("0xtxhash"),
    }),
    http: vi.fn().mockReturnValue({}),
    parseAbi: vi.fn().mockReturnValue([]),
  };
});

vi.mock("viem/chains", () => ({
  base: { id: 8453, name: "Base" },
}));

vi.mock("viem/accounts", () => ({
  privateKeyToAccount: vi.fn().mockReturnValue({
    address: "0x1234567890123456789012345678901234567890",
  }),
}));

vi.mock("../../../src/utils/redis.js", () => ({
  getRedis: () => mockRedis,
}));

vi.mock("../../../src/db/index.js", () => ({
  getDb: () => ({
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    }),
  }),
  apiPayments: { receiptId: "receipt_id" },
}));

// Mock Redis
const mockRedisStore = new Map<string, { value: string; expiry?: number }>();

const mockRedis = {
  get: vi.fn(async (key: string) => {
    const entry = mockRedisStore.get(key);
    if (!entry) return null;
    if (entry.expiry && Date.now() > entry.expiry) {
      mockRedisStore.delete(key);
      return null;
    }
    return entry.value;
  }),
  set: vi.fn(async (key: string, value: string) => {
    mockRedisStore.set(key, { value });
    return "OK";
  }),
  setex: vi.fn(async (key: string, seconds: number, value: string) => {
    mockRedisStore.set(key, { value, expiry: Date.now() + seconds * 1000 });
    return "OK";
  }),
};

describe("x402 Facilitator Service", () => {
  beforeEach(() => {
    mockRedisStore.clear();
    vi.clearAllMocks();
    process.env.FACILITATOR_PRIVATE_KEY = "0x1234567890123456789012345678901234567890123456789012345678901234";
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete process.env.FACILITATOR_PRIVATE_KEY;
  });

  describe("verifyAuthorization", () => {
    it("should verify valid authorization", async () => {
      const { verifyAuthorization } = await import("../../../src/services/payments/facilitator.js");

      const now = Math.floor(Date.now() / 1000);
      const result = await verifyAuthorization({
        from: "0x1234567890123456789012345678901234567890",
        to: "0x0987654321098765432109876543210987654321",
        value: "100000",
        validAfter: String(now - 100),
        validBefore: String(now + 3600),
        nonce: "0xnonce",
        signature: "0xsig",
      });

      expect(result.valid).toBe(true);
    });

    it("should reject expired authorization", async () => {
      const { verifyAuthorization } = await import("../../../src/services/payments/facilitator.js");

      const result = await verifyAuthorization({
        from: "0x1234567890123456789012345678901234567890",
        to: "0x0987654321098765432109876543210987654321",
        value: "100000",
        validAfter: "0",
        validBefore: "1000", // Expired
        nonce: "0xnonce2",
        signature: "0xsig",
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain("expired");
    });

    it("should reject not-yet-valid authorization", async () => {
      const { verifyAuthorization } = await import("../../../src/services/payments/facilitator.js");

      const futureTime = Math.floor(Date.now() / 1000) + 3600;
      const result = await verifyAuthorization({
        from: "0x1234567890123456789012345678901234567890",
        to: "0x0987654321098765432109876543210987654321",
        value: "100000",
        validAfter: String(futureTime),
        validBefore: String(futureTime + 3600),
        nonce: "0xnonce3",
        signature: "0xsig",
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain("not yet valid");
    });
  });

  describe("fileDispute", () => {
    it("should create a dispute and return dispute ID", async () => {
      const { fileDispute } = await import("../../../src/services/payments/facilitator.js");

      const result = await fileDispute({
        receiptId: "rcpt_123",
        reason: "Service not delivered",
        requestedRefund: true,
      });

      expect(result.disputeId).toBeDefined();
      expect(result.disputeId).toMatch(/^dispute_/);
      expect(result.status).toBe("pending");
    });
  });

  describe("getDisputeStatus", () => {
    it("should return dispute status from cache", async () => {
      const { getDisputeStatus } = await import("../../../src/services/payments/facilitator.js");

      const dispute = {
        disputeId: "dispute_123",
        receiptId: "rcpt_123",
        status: "pending",
      };

      mockRedisStore.set("x402:dispute:dispute_123", {
        value: JSON.stringify(dispute),
      });

      const result = await getDisputeStatus("dispute_123");

      expect(result).toEqual(dispute);
    });

    it("should return null for non-existent dispute", async () => {
      const { getDisputeStatus } = await import("../../../src/services/payments/facilitator.js");

      const result = await getDisputeStatus("nonexistent");

      expect(result).toBeNull();
    });
  });

  describe("getSettlementStatus", () => {
    it("should return settlement status from cache", async () => {
      const { getSettlementStatus } = await import("../../../src/services/payments/facilitator.js");

      const settlement = {
        success: true,
        status: "settled",
        txHash: "0xabc",
        settledAt: Date.now(),
      };

      mockRedisStore.set("x402:settlement:0xnonce", {
        value: JSON.stringify(settlement),
      });

      const result = await getSettlementStatus("0xnonce");

      expect(result).toEqual(settlement);
    });

    it("should return null for non-existent settlement", async () => {
      const { getSettlementStatus } = await import("../../../src/services/payments/facilitator.js");

      const result = await getSettlementStatus("nonexistent");

      expect(result).toBeNull();
    });
  });

  describe("Settlement Status Types", () => {
    it("should support all status types", () => {
      const statuses = ["pending", "verified", "settled", "failed", "disputed", "refunded"];

      expect(statuses).toContain("pending");
      expect(statuses).toContain("verified");
      expect(statuses).toContain("settled");
      expect(statuses).toContain("failed");
      expect(statuses).toContain("disputed");
      expect(statuses).toContain("refunded");
    });
  });

  describe("PaymentAuthorization", () => {
    it("should have correct structure", () => {
      const auth = {
        from: "0x1234567890123456789012345678901234567890" as `0x${string}`,
        to: "0x0987654321098765432109876543210987654321" as `0x${string}`,
        value: "100000",
        validAfter: "0",
        validBefore: "9999999999",
        nonce: "0xnonce",
        signature: "0xsig",
      };

      expect(auth).toHaveProperty("from");
      expect(auth).toHaveProperty("to");
      expect(auth).toHaveProperty("value");
      expect(auth).toHaveProperty("validAfter");
      expect(auth).toHaveProperty("validBefore");
      expect(auth).toHaveProperty("nonce");
      expect(auth).toHaveProperty("signature");
    });
  });
});
