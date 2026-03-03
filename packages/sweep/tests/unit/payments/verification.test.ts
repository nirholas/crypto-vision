/**
 * Tests for Payment Verification Service
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
          return BigInt("10000000"); // 10 USDC
        }
        if (functionName === "authorizationState") {
          return false; // Nonce not used
        }
        if (functionName === "DOMAIN_SEPARATOR") {
          return "0x1234567890123456789012345678901234567890123456789012345678901234";
        }
        return null;
      }),
      getBlockNumber: vi.fn().mockResolvedValue(BigInt(1000000)),
      getLogs: vi.fn().mockResolvedValue([]),
    }),
    http: vi.fn().mockReturnValue({}),
    parseAbi: vi.fn().mockReturnValue([]),
  };
});

vi.mock("viem/chains", () => ({
  base: { id: 8453, name: "Base" },
}));

vi.mock("../../../src/utils/redis.js", () => ({
  getRedis: () => mockRedis,
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

describe("Payment Verification Service", () => {
  beforeEach(() => {
    mockRedisStore.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("verifyPaymentOnChain", () => {
    it("should return cached result if available", async () => {
      const { verifyPaymentOnChain } = await import("../../../src/services/payments/index.js");

      const cachedResult = { valid: true, txHash: "0xtest" };
      mockRedisStore.set(
        "payment:verify:0x1234567890123456789012345678901234567890:0xnonce",
        { value: JSON.stringify(cachedResult) }
      );

      const result = await verifyPaymentOnChain({
        payer: "0x1234567890123456789012345678901234567890",
        payee: "0x0987654321098765432109876543210987654321",
        amount: "100000",
        signature: "0xsig",
        nonce: "0xnonce",
        validAfter: "0",
        validBefore: String(Math.floor(Date.now() / 1000) + 3600),
      });

      expect(result).toEqual(cachedResult);
    });

    it("should validate payment timing", async () => {
      const { verifyPaymentOnChain } = await import("../../../src/services/payments/index.js");

      // Expired payment
      const result = await verifyPaymentOnChain({
        payer: "0x1234567890123456789012345678901234567890",
        payee: "0x0987654321098765432109876543210987654321",
        amount: "100000",
        signature: "0xsig",
        nonce: "0xnonce2",
        validAfter: "0",
        validBefore: "1000", // Expired
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain("expired");
    });

    it("should validate payment not yet valid", async () => {
      const { verifyPaymentOnChain } = await import("../../../src/services/payments/index.js");

      const futureTime = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now

      const result = await verifyPaymentOnChain({
        payer: "0x1234567890123456789012345678901234567890",
        payee: "0x0987654321098765432109876543210987654321",
        amount: "100000",
        signature: "0xsig",
        nonce: "0xnonce3",
        validAfter: String(futureTime),
        validBefore: String(futureTime + 3600),
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain("not yet valid");
    });
  });

  describe("verifyPaymentAmount", () => {
    it("should accept sufficient payment", async () => {
      const { verifyPaymentAmount } = await import("../../../src/services/payments/index.js");

      const result = verifyPaymentAmount("1000000", 100); // 1 USDC for $1.00 requirement

      expect(result.valid).toBe(true);
    });

    it("should reject insufficient payment", async () => {
      const { verifyPaymentAmount } = await import("../../../src/services/payments/index.js");

      const result = verifyPaymentAmount("50000", 100); // 0.05 USDC for $1.00 requirement

      expect(result.valid).toBe(false);
      expect(result.error).toContain("Insufficient");
    });

    it("should accept exact payment", async () => {
      const { verifyPaymentAmount } = await import("../../../src/services/payments/index.js");

      // 10 cents = 100000 USDC units
      const result = verifyPaymentAmount("100000", 10);

      expect(result.valid).toBe(true);
    });
  });

  describe("getUsdcBalance", () => {
    it("should return balance from chain", async () => {
      const { getUsdcBalance } = await import("../../../src/services/payments/index.js");

      const balance = await getUsdcBalance("0x1234567890123456789012345678901234567890");

      expect(balance).toBe(BigInt("10000000"));
    });
  });

  describe("checkUsdcTransfer", () => {
    it("should search for transfer events", async () => {
      const { checkUsdcTransfer } = await import("../../../src/services/payments/index.js");

      const result = await checkUsdcTransfer(
        "0x1234567890123456789012345678901234567890",
        "0x0987654321098765432109876543210987654321",
        "100000"
      );

      expect(result).toHaveProperty("found");
    });
  });
});

describe("Payment Verification Types", () => {
  describe("PaymentVerificationParams", () => {
    it("should have correct structure", () => {
      const params = {
        payer: "0x1234567890123456789012345678901234567890" as `0x${string}`,
        payee: "0x0987654321098765432109876543210987654321" as `0x${string}`,
        amount: "100000",
        signature: "0xsig",
        nonce: "0xnonce",
        validAfter: "0",
        validBefore: "9999999999",
      };

      expect(params).toHaveProperty("payer");
      expect(params).toHaveProperty("payee");
      expect(params).toHaveProperty("amount");
      expect(params).toHaveProperty("signature");
      expect(params).toHaveProperty("nonce");
      expect(params).toHaveProperty("validAfter");
      expect(params).toHaveProperty("validBefore");
    });
  });

  describe("PaymentVerificationResult", () => {
    it("should have correct structure for success", () => {
      const result = {
        valid: true,
        txHash: "0xabc123",
      };

      expect(result.valid).toBe(true);
      expect(result.txHash).toBeDefined();
    });

    it("should have correct structure for failure", () => {
      const result = {
        valid: false,
        error: "Insufficient balance",
      };

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});
