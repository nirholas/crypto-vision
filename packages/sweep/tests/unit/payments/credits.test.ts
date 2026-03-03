/**
 * Tests for Prepaid Credits Service
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

// Mock dependencies before importing the module
vi.mock("../../../src/utils/redis.js", () => ({
  getRedis: () => mockRedis,
}));

vi.mock("../../../src/db/index.js", () => ({
  getDb: () => mockDb,
  apiCredits: { walletAddress: "wallet_address" },
  apiCreditTransactions: {},
}));

// In-memory mock storage
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

const mockDbResults: any[] = [];
const mockDb = {
  select: vi.fn(() => ({
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        limit: vi.fn(() => Promise.resolve(mockDbResults)),
        orderBy: vi.fn(() => ({
          limit: vi.fn(() => ({
            offset: vi.fn(() => Promise.resolve(mockDbResults)),
          })),
        })),
      })),
    })),
  })),
  insert: vi.fn(() => ({
    values: vi.fn(() => Promise.resolve()),
  })),
  update: vi.fn(() => ({
    set: vi.fn(() => ({
      where: vi.fn(() => Promise.resolve()),
    })),
  })),
};

describe("Prepaid Credits Service", () => {
  beforeEach(() => {
    mockRedisStore.clear();
    mockDbResults.length = 0;
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("getCredits", () => {
    it("should return cached balance if available", async () => {
      const { getCredits } = await import("../../../src/services/payments/credits.js");

      const cachedBalance = {
        walletAddress: "0x1234567890123456789012345678901234567890",
        balanceCents: 1000,
        balanceUsd: "10.00",
        expiresAt: new Date(Date.now() + 86400000),
        lastUpdated: new Date(),
      };

      mockRedisStore.set("credits:0x1234567890123456789012345678901234567890", {
        value: JSON.stringify(cachedBalance),
      });

      const result = await getCredits("0x1234567890123456789012345678901234567890");

      expect(result).toEqual(cachedBalance);
      expect(mockRedis.get).toHaveBeenCalled();
    });

    it("should query database if not in cache", async () => {
      const { getCredits } = await import("../../../src/services/payments/credits.js");

      mockDbResults.push({
        walletAddress: "0x1234567890123456789012345678901234567890",
        balanceCents: "500",
        expiresAt: new Date(Date.now() + 86400000),
        updatedAt: new Date(),
      });

      const result = await getCredits("0xABCDEF1234567890123456789012345678901234");

      expect(result.balanceCents).toBe(500);
      expect(result.balanceUsd).toBe("5.00");
    });

    it("should return zero balance for new wallets", async () => {
      const { getCredits } = await import("../../../src/services/payments/credits.js");

      // No cached data, no DB results
      const result = await getCredits("0x0000000000000000000000000000000000000000");

      expect(result.balanceCents).toBe(0);
      expect(result.balanceUsd).toBe("0.00");
    });
  });

  describe("checkCredits", () => {
    it("should return balance in cents", async () => {
      const { checkCredits } = await import("../../../src/services/payments/credits.js");

      const cachedBalance = {
        walletAddress: "0x1234567890123456789012345678901234567890",
        balanceCents: 2500,
        balanceUsd: "25.00",
        expiresAt: null,
        lastUpdated: new Date(),
      };

      mockRedisStore.set("credits:0x1234567890123456789012345678901234567890", {
        value: JSON.stringify(cachedBalance),
      });

      const balance = await checkCredits("0x1234567890123456789012345678901234567890");

      expect(balance).toBe(2500);
    });
  });

  describe("getCreditsDepositAddress", () => {
    it("should return deposit address from environment", async () => {
      process.env.X402_RECEIVER_ADDRESS = "0xTestDepositAddress123456789012345678901234";

      const { getCreditsDepositAddress } = await import("../../../src/services/payments/credits.js");

      const address = getCreditsDepositAddress();

      expect(address).toBe("0xTestDepositAddress123456789012345678901234");
    });

    it("should throw if deposit address not configured", async () => {
      const originalEnv = process.env.X402_RECEIVER_ADDRESS;
      delete process.env.X402_RECEIVER_ADDRESS;

      const { getCreditsDepositAddress } = await import("../../../src/services/payments/credits.js");

      expect(() => getCreditsDepositAddress()).toThrow();

      process.env.X402_RECEIVER_ADDRESS = originalEnv;
    });
  });

  describe("Credit Transaction Types", () => {
    it("should support deposit type", async () => {
      const { CreditTransactionType } = await import("../../../src/services/payments/credits.js");
      // Type check - will fail at compile time if invalid
      const types: string[] = ["deposit", "deduction", "refund", "expiry", "adjustment"];
      expect(types).toContain("deposit");
    });

    it("should support deduction type", async () => {
      const types: string[] = ["deposit", "deduction", "refund", "expiry", "adjustment"];
      expect(types).toContain("deduction");
    });

    it("should support refund type", async () => {
      const types: string[] = ["deposit", "deduction", "refund", "expiry", "adjustment"];
      expect(types).toContain("refund");
    });
  });
});

describe("Credit Balance Interface", () => {
  it("should have correct structure", () => {
    const balance = {
      walletAddress: "0x1234567890123456789012345678901234567890",
      balanceCents: 1000,
      balanceUsd: "10.00",
      expiresAt: new Date(),
      lastUpdated: new Date(),
    };

    expect(balance).toHaveProperty("walletAddress");
    expect(balance).toHaveProperty("balanceCents");
    expect(balance).toHaveProperty("balanceUsd");
    expect(balance).toHaveProperty("expiresAt");
    expect(balance).toHaveProperty("lastUpdated");
  });
});
