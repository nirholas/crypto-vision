/**
 * Tests for x402 Middleware
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { Hono } from "hono";

// Mock dependencies
vi.mock("../../../src/utils/redis.js", () => ({
  getRedis: () => mockRedis,
}));

vi.mock("../../../src/services/payments/index.js", () => ({
  verifyPaymentOnChain: vi.fn().mockResolvedValue({ valid: true }),
}));

vi.mock("../../../src/services/payments/credits.js", () => ({
  checkCredits: vi.fn().mockResolvedValue(0),
  deductCredits: vi.fn().mockResolvedValue({ success: true, newBalance: 0 }),
}));

vi.mock("../../../src/services/payments/pricing.js", () => ({
  getEndpointPrice: vi.fn().mockReturnValue(10),
}));

vi.mock("../../../src/db/index.js", () => ({
  getDb: () => ({
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    }),
  }),
  apiPayments: {},
  apiUsage: {},
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
  del: vi.fn(async (...keys: string[]) => {
    let deleted = 0;
    for (const key of keys) {
      if (mockRedisStore.delete(key)) deleted++;
    }
    return deleted;
  }),
  exists: vi.fn(async (key: string) => {
    return mockRedisStore.has(key) ? 1 : 0;
  }),
  incr: vi.fn(async (key: string) => {
    const entry = mockRedisStore.get(key);
    const newValue = entry ? parseInt(entry.value) + 1 : 1;
    mockRedisStore.set(key, { value: String(newValue) });
    return newValue;
  }),
};

describe("x402 Middleware", () => {
  beforeEach(() => {
    mockRedisStore.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("centsToUsdcAmount", () => {
    it("should convert cents to USDC amount correctly", async () => {
      const { centsToUsdcAmount } = await import("../../../src/api/middleware/x402.js");

      // $0.10 = 10 cents = 100000 USDC units (6 decimals)
      expect(centsToUsdcAmount(10)).toBe("100000");

      // $1.00 = 100 cents = 1000000 USDC units
      expect(centsToUsdcAmount(100)).toBe("1000000");

      // $0.01 = 1 cent = 10000 USDC units
      expect(centsToUsdcAmount(1)).toBe("10000");

      // $0.05 = 5 cents = 50000 USDC units
      expect(centsToUsdcAmount(5)).toBe("50000");
    });
  });

  describe("usdcAmountToCents", () => {
    it("should convert USDC amount to cents correctly", async () => {
      const { usdcAmountToCents } = await import("../../../src/api/middleware/x402.js");

      expect(usdcAmountToCents("100000")).toBe(10); // $0.10
      expect(usdcAmountToCents("1000000")).toBe(100); // $1.00
      expect(usdcAmountToCents("10000")).toBe(1); // $0.01
    });
  });

  describe("X402_VERSION", () => {
    it("should be version 1", async () => {
      const { X402_VERSION } = await import("../../../src/api/middleware/x402.js");

      expect(X402_VERSION).toBe(1);
    });
  });

  describe("isX402Configured", () => {
    it("should return true when X402_RECEIVER_ADDRESS is set", async () => {
      process.env.X402_RECEIVER_ADDRESS = "0x1234567890123456789012345678901234567890";

      const { isX402Configured } = await import("../../../src/api/middleware/x402.js");

      expect(isX402Configured()).toBe(true);
    });

    it("should return false when X402_RECEIVER_ADDRESS is not set", async () => {
      const originalEnv = process.env.X402_RECEIVER_ADDRESS;
      delete process.env.X402_RECEIVER_ADDRESS;

      // Need to re-import to pick up the change
      vi.resetModules();

      // Re-mock dependencies after reset
      vi.doMock("../../../src/utils/redis.js", () => ({
        getRedis: () => mockRedis,
      }));
      vi.doMock("../../../src/services/payments/index.js", () => ({
        verifyPaymentOnChain: vi.fn().mockResolvedValue({ valid: true }),
      }));
      vi.doMock("../../../src/services/payments/credits.js", () => ({
        checkCredits: vi.fn().mockResolvedValue(0),
        deductCredits: vi.fn().mockResolvedValue({ success: true, newBalance: 0 }),
      }));
      vi.doMock("../../../src/services/payments/pricing.js", () => ({
        getEndpointPrice: vi.fn().mockReturnValue(10),
      }));
      vi.doMock("../../../src/db/index.js", () => ({
        getDb: () => ({
          insert: vi.fn().mockReturnValue({
            values: vi.fn().mockResolvedValue(undefined),
          }),
        }),
        apiPayments: {},
        apiUsage: {},
      }));

      const { isX402Configured } = await import("../../../src/api/middleware/x402.js");

      expect(isX402Configured()).toBe(false);

      process.env.X402_RECEIVER_ADDRESS = originalEnv;
    });
  });

  describe("getX402ReceiverAddress", () => {
    it("should return the receiver address", async () => {
      process.env.X402_RECEIVER_ADDRESS = "0xTestReceiver1234567890123456789012345678";

      const { getX402ReceiverAddress } = await import("../../../src/api/middleware/x402.js");

      expect(getX402ReceiverAddress()).toBe("0xTestReceiver1234567890123456789012345678");
    });

    it("should throw when not configured", async () => {
      const originalEnv = process.env.X402_RECEIVER_ADDRESS;
      delete process.env.X402_RECEIVER_ADDRESS;

      vi.resetModules();

      // Re-mock dependencies
      vi.doMock("../../../src/utils/redis.js", () => ({
        getRedis: () => mockRedis,
      }));
      vi.doMock("../../../src/services/payments/index.js", () => ({
        verifyPaymentOnChain: vi.fn().mockResolvedValue({ valid: true }),
      }));
      vi.doMock("../../../src/services/payments/credits.js", () => ({
        checkCredits: vi.fn().mockResolvedValue(0),
        deductCredits: vi.fn().mockResolvedValue({ success: true, newBalance: 0 }),
      }));
      vi.doMock("../../../src/services/payments/pricing.js", () => ({
        getEndpointPrice: vi.fn().mockReturnValue(10),
      }));
      vi.doMock("../../../src/db/index.js", () => ({
        getDb: () => ({
          insert: vi.fn().mockReturnValue({
            values: vi.fn().mockResolvedValue(undefined),
          }),
        }),
        apiPayments: {},
        apiUsage: {},
      }));

      const { getX402ReceiverAddress } = await import("../../../src/api/middleware/x402.js");

      expect(() => getX402ReceiverAddress()).toThrow();

      process.env.X402_RECEIVER_ADDRESS = originalEnv;
    });
  });

  describe("x402Middleware", () => {
    it("should skip payment when disabled", async () => {
      const { x402Middleware } = await import("../../../src/api/middleware/x402.js");

      const app = new Hono();
      app.use(
        "/test",
        x402Middleware({
          amountCents: 10,
          receiverAddress: "0x1234567890123456789012345678901234567890",
          enabled: false,
        })
      );
      app.get("/test", (c) => c.json({ success: true }));

      const res = await app.request("/test");

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
    });

    it("should allow free tier requests", async () => {
      const { x402Middleware } = await import("../../../src/api/middleware/x402.js");

      const app = new Hono();
      app.use(
        "/test",
        x402Middleware({
          amountCents: 10,
          receiverAddress: "0x1234567890123456789012345678901234567890",
          enabled: true,
          freeTierLimit: 10,
        })
      );
      app.get("/test", (c) => c.json({ success: true }));

      const res = await app.request("/test");

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
    });

    it("should return 402 when no payment and free tier exhausted", async () => {
      const { x402Middleware } = await import("../../../src/api/middleware/x402.js");

      // Exhaust free tier
      mockRedisStore.set("x402:free:anonymous", { value: "10" });

      const app = new Hono();
      app.use(
        "/test",
        x402Middleware({
          amountCents: 10,
          receiverAddress: "0x1234567890123456789012345678901234567890",
          enabled: true,
          freeTierLimit: 10,
        })
      );
      app.get("/test", (c) => c.json({ success: true }));

      const res = await app.request("/test");

      expect(res.status).toBe(402);
      const body = await res.json();
      expect(body.error).toBe("Payment required");
      expect(body.accepts).toBeDefined();
      expect(body.accepts.length).toBeGreaterThan(0);
    });
  });

  describe("Payment Requirement Format", () => {
    it("should return correct x402 response format", async () => {
      const { x402Middleware } = await import("../../../src/api/middleware/x402.js");

      // Exhaust free tier
      mockRedisStore.set("x402:free:anonymous", { value: "10" });

      const app = new Hono();
      app.use(
        "/test",
        x402Middleware({
          amountCents: 10,
          receiverAddress: "0xReceiverAddress1234567890123456789012345",
          enabled: true,
          freeTierLimit: 10,
          description: "Test payment",
        })
      );
      app.get("/test", (c) => c.json({ success: true }));

      const res = await app.request("/test");
      const body = await res.json();

      expect(body.accepts[0]).toMatchObject({
        scheme: "exact",
        network: "eip155:8453",
        payTo: "0xReceiverAddress1234567890123456789012345",
        asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        maxAmountRequired: "100000", // 10 cents = 100000 USDC units
      });
    });
  });

  describe("Middleware Factory Functions", () => {
    it("should create sweep payment middleware", async () => {
      const { sweepPaymentMiddleware } = await import("../../../src/api/middleware/x402.js");

      const middleware = sweepPaymentMiddleware("0x1234567890123456789012345678901234567890");

      expect(middleware).toBeDefined();
      expect(typeof middleware).toBe("function");
    });

    it("should create quote payment middleware", async () => {
      const { quotePaymentMiddleware } = await import("../../../src/api/middleware/x402.js");

      const middleware = quotePaymentMiddleware("0x1234567890123456789012345678901234567890");

      expect(middleware).toBeDefined();
      expect(typeof middleware).toBe("function");
    });

    it("should create defi deposit middleware", async () => {
      const { defiDepositMiddleware } = await import("../../../src/api/middleware/x402.js");

      const middleware = defiDepositMiddleware("0x1234567890123456789012345678901234567890");

      expect(middleware).toBeDefined();
      expect(typeof middleware).toBe("function");
    });

    it("should create defi positions middleware", async () => {
      const { defiPositionsMiddleware } = await import("../../../src/api/middleware/x402.js");

      const middleware = defiPositionsMiddleware("0x1234567890123456789012345678901234567890");

      expect(middleware).toBeDefined();
      expect(typeof middleware).toBe("function");
    });

    it("should create consolidate execute middleware", async () => {
      const { consolidateExecuteMiddleware } = await import("../../../src/api/middleware/x402.js");

      const middleware = consolidateExecuteMiddleware("0x1234567890123456789012345678901234567890");

      expect(middleware).toBeDefined();
      expect(typeof middleware).toBe("function");
    });
  });
});
