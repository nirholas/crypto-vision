import { beforeAll, afterAll, beforeEach, afterEach, vi } from "vitest";
import type Redis from "ioredis";

// ============================================================
// Mock Redis
// ============================================================

// In-memory storage for mock Redis
const mockRedisStore = new Map<string, { value: string; expiry?: number }>();

// Create a mock Redis client
export function createMockRedis(): Partial<Redis> {
  return {
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
      mockRedisStore.set(key, {
        value,
        expiry: Date.now() + seconds * 1000,
      });
      return "OK";
    }),
    
    del: vi.fn(async (...keys: string[]) => {
      let deleted = 0;
      for (const key of keys) {
        if (mockRedisStore.delete(key)) deleted++;
      }
      return deleted;
    }),
    
    exists: vi.fn(async (...keys: string[]) => {
      let count = 0;
      for (const key of keys) {
        const entry = mockRedisStore.get(key);
        if (entry && (!entry.expiry || Date.now() <= entry.expiry)) {
          count++;
        }
      }
      return count;
    }),
    
    ping: vi.fn(async () => "PONG"),
    
    incr: vi.fn(async (key: string) => {
      const entry = mockRedisStore.get(key);
      const newValue = entry ? parseInt(entry.value) + 1 : 1;
      mockRedisStore.set(key, { value: newValue.toString() });
      return newValue;
    }),
    
    expire: vi.fn(async (key: string, seconds: number) => {
      const entry = mockRedisStore.get(key);
      if (entry) {
        entry.expiry = Date.now() + seconds * 1000;
        return 1;
      }
      return 0;
    }),
    
    ttl: vi.fn(async (key: string) => {
      const entry = mockRedisStore.get(key);
      if (!entry) return -2;
      if (!entry.expiry) return -1;
      return Math.ceil((entry.expiry - Date.now()) / 1000);
    }),
    
    keys: vi.fn(async (pattern: string) => {
      const regex = new RegExp(pattern.replace(/\*/g, ".*"));
      return Array.from(mockRedisStore.keys()).filter(k => regex.test(k));
    }),
    
    flushall: vi.fn(async () => {
      mockRedisStore.clear();
      return "OK";
    }),

    lpush: vi.fn(async (key: string, ...values: string[]) => {
      const entry = mockRedisStore.get(key);
      let list: string[] = [];
      if (entry) {
        try {
          list = JSON.parse(entry.value);
        } catch {
          list = [entry.value];
        }
      }
      // lpush adds to the front
      list.unshift(...values.reverse());
      mockRedisStore.set(key, { value: JSON.stringify(list) });
      return list.length;
    }),

    ltrim: vi.fn(async (key: string, start: number, stop: number) => {
      const entry = mockRedisStore.get(key);
      if (entry) {
        try {
          const list = JSON.parse(entry.value) as string[];
          const trimmed = list.slice(start, stop + 1);
          mockRedisStore.set(key, { value: JSON.stringify(trimmed) });
        } catch {
          // Not a list, ignore
        }
      }
      return "OK";
    }),

    lrange: vi.fn(async (key: string, start: number, stop: number) => {
      const entry = mockRedisStore.get(key);
      if (!entry) return [];
      try {
        const list = JSON.parse(entry.value) as string[];
        if (stop < 0) stop = list.length + stop + 1;
        return list.slice(start, stop + 1);
      } catch {
        return [];
      }
    }),

    rpush: vi.fn(async (key: string, ...values: string[]) => {
      const entry = mockRedisStore.get(key);
      let list: string[] = [];
      if (entry) {
        try {
          list = JSON.parse(entry.value);
        } catch {
          list = [entry.value];
        }
      }
      list.push(...values);
      mockRedisStore.set(key, { value: JSON.stringify(list) });
      return list.length;
    }),

    publish: vi.fn(async (_channel: string, _message: string) => {
      // No-op for testing, just return subscriber count (0)
      return 0;
    }),

    subscribe: vi.fn(async (..._channels: string[]) => {
      return 0;
    }),

    quit: vi.fn(async () => "OK"),
    disconnect: vi.fn(),
  };
}

// Mock Redis instance
let mockRedis: ReturnType<typeof createMockRedis>;

// ============================================================
// Mock Database
// ============================================================

// In-memory database tables
export const mockDb = {
  users: new Map<string, any>(),
  sweeps: new Map<string, any>(),
  sweepQuotes: new Map<string, any>(),
  positions: new Map<string, any>(),
};

// Mock database client
export function createMockDbClient() {
  return {
    // Simulate SQL template literal
    query: vi.fn(async (strings: TemplateStringsArray, ...values: any[]) => {
      const query = strings.join("?");
      // Simple SELECT 1 for health check
      if (query.includes("SELECT 1")) {
        return [{ "?column?": 1 }];
      }
      return [];
    }),
    
    // Table query builders
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => []),
        })),
      })),
    })),
    
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(async () => [{ id: "test-id" }]),
      })),
    })),
    
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(async () => []),
      })),
    })),
    
    delete: vi.fn(() => ({
      where: vi.fn(async () => []),
    })),
  };
}

// ============================================================
// Mock Services
// ============================================================

export const mockPriceService = {
  getValidatedPrice: vi.fn(async (tokenAddress: string, chain: string) => ({
    price: 1.0,
    confidence: "HIGH" as const,
    sources: [
      { name: "coingecko", price: 1.0, timestamp: Date.now() },
      { name: "defillama", price: 1.0, timestamp: Date.now() },
    ],
    requiresApproval: false,
  })),
  
  fetchCoinGeckoPrice: vi.fn(async () => ({
    name: "coingecko",
    price: 1.0,
    timestamp: Date.now(),
  })),
  
  fetchDefiLlamaPrice: vi.fn(async () => ({
    name: "defillama",
    price: 1.0,
    timestamp: Date.now(),
  })),
  
  checkTokenLiquidity: vi.fn(async () => ({
    isLiquid: true,
    liquidityUsd: 100000,
    topPools: [{ dex: "uniswap", liquidity: 100000 }],
  })),
};

export const mockValidationService = {
  filterDustTokens: vi.fn(async (balances: any[], threshold = 10) => {
    return balances
      .filter(b => b.usdValue && b.usdValue <= threshold && b.usdValue > 0)
      .map(b => ({
        token: b,
        usdValue: b.usdValue,
        validation: {
          canSweep: true,
          requiresApproval: false,
          validatedPrice: { price: b.usdValue, confidence: "HIGH", sources: [], requiresApproval: false },
          liquidityCheck: { isLiquid: true, liquidityUsd: 100000, topPools: [] },
          anomalyCheck: { isAnomalous: false, currentPrice: b.usdValue, avg7d: b.usdValue, deviation: 0 },
          executionGuard: { canExecute: true, requiresApproval: false, expectedValue: b.usdValue, minAcceptableValue: b.usdValue * 0.95 },
          listStatus: "WHITELIST" as const,
          reasons: [],
        },
      }));
  }),
  
  validateToken: vi.fn(async () => ({
    canSweep: true,
    requiresApproval: false,
    reasons: [],
  })),
};

export const mockWalletService = {
  getWalletTokenBalancesAlchemy: vi.fn(async (address: string, chain: string) => [
    {
      address: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
      symbol: "USDC",
      name: "USD Coin",
      decimals: 6,
      balance: "5000000",
      chain,
      usdValue: 5.0,
    },
    {
      address: "0x4200000000000000000000000000000000000006",
      symbol: "WETH",
      name: "Wrapped Ether",
      decimals: 18,
      balance: "1000000000000000",
      chain,
      usdValue: 2.5,
    },
  ]),
  
  scanAllChains: vi.fn(async (address: string) => ({
    base: [
      {
        address: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
        symbol: "USDC",
        name: "USD Coin",
        decimals: 6,
        balance: "5000000",
        chain: "base",
        usdValue: 5.0,
      },
    ],
    ethereum: [],
    arbitrum: [],
    polygon: [],
    bsc: [],
    linea: [],
    optimism: [],
  })),
};

// ============================================================
// Mock Queue
// ============================================================

export const mockQueue = {
  addWalletScanJob: vi.fn(async (data: any) => ({
    id: "mock-job-id",
    data,
  })),
  
  addSweepExecuteJob: vi.fn(async (data: any) => ({
    id: "mock-sweep-job-id",
    data,
  })),
};

// ============================================================
// Test Utilities
// ============================================================

export function generateTestWalletAddress(): `0x${string}` {
  const chars = "0123456789abcdef";
  let address = "0x";
  for (let i = 0; i < 40; i++) {
    address += chars[Math.floor(Math.random() * chars.length)];
  }
  return address as `0x${string}`;
}

export function generateTestUserId(): string {
  return `test-user-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function generateTestQuoteId(): string {
  return crypto.randomUUID();
}

export function createTestToken(overrides: Partial<{
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  balance: string;
  chain: string;
  usdValue: number;
}> = {}) {
  return {
    address: overrides.address || "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
    symbol: overrides.symbol || "USDC",
    name: overrides.name || "USD Coin",
    decimals: overrides.decimals ?? 6,
    balance: overrides.balance || "5000000",
    chain: overrides.chain || "base",
    usdValue: overrides.usdValue ?? 5.0,
  };
}

export function createTestQuote(overrides: Partial<{
  quoteId: string;
  wallet: string;
  tokens: any[];
  destination: any;
  expiresAt: number;
}> = {}) {
  return {
    quoteId: overrides.quoteId || generateTestQuoteId(),
    wallet: overrides.wallet || generateTestWalletAddress(),
    tokens: overrides.tokens || [createTestToken()],
    destination: overrides.destination || {
      chain: "base",
      token: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
      symbol: "USDC",
    },
    summary: {
      totalInputValueUsd: 5.0,
      estimatedOutputAmount: "4950000",
      estimatedOutputValueUsd: 4.95,
      estimatedGasUsd: 0.05,
      netValueUsd: 4.90,
      savingsVsManual: 0.5,
    },
    route: {
      aggregator: "1inch",
      steps: [],
    },
    expiresAt: overrides.expiresAt || Date.now() + 5 * 60 * 1000,
    createdAt: Date.now(),
  };
}

// ============================================================
// Setup Mocks Before Tests
// ============================================================

beforeAll(async () => {
  // Create mock Redis
  mockRedis = createMockRedis();
  
  // Mock the redis module
  vi.mock("../src/utils/redis.js", () => ({
    getRedis: () => mockRedis,
    cacheGet: async (key: string) => {
      const value = await mockRedis.get!(key);
      return value ? JSON.parse(value) : null;
    },
    cacheSet: async (key: string, value: any, ttl?: number) => {
      if (ttl) {
        await mockRedis.setex!(key, ttl, JSON.stringify(value));
      } else {
        await mockRedis.set!(key, JSON.stringify(value));
      }
    },
    cacheGetOrFetch: async (key: string, fetcher: () => Promise<any>, ttl?: number) => {
      const cached = await mockRedis.get!(key);
      if (cached) return JSON.parse(cached);
      const value = await fetcher();
      if (ttl) {
        await mockRedis.setex!(key, ttl, JSON.stringify(value));
      } else {
        await mockRedis.set!(key, JSON.stringify(value));
      }
      return value;
    },
  }));
  
  // Mock the database module
  vi.mock("../src/db/index.js", () => ({
    getDb: () => createMockDbClient(),
    getClient: () => createMockDbClient(),
    users: { id: "id", walletAddress: "walletAddress" },
    sweeps: { id: "id" },
    sweepQuotes: { id: "id" },
  }));
  
  // Mock services
  vi.mock("../src/services/price.service.js", () => mockPriceService);
  vi.mock("../src/services/validation.service.js", () => mockValidationService);
  vi.mock("../src/services/wallet.service.js", () => mockWalletService);
  
  // Mock queue
  vi.mock("../src/queue/index.js", () => ({
    ...mockQueue,
    QUEUE_NAMES: {
      WALLET_SCAN: "wallet-scan",
      SWEEP_EXECUTE: "sweep-execute",
      PRICE_UPDATE: "price-update",
    },
  }));
  
  console.log("✓ Test setup complete");
});

beforeEach(() => {
  // Clear mock Redis before each test
  mockRedisStore.clear();
  
  // Clear mock database
  mockDb.users.clear();
  mockDb.sweeps.clear();
  mockDb.sweepQuotes.clear();
  mockDb.positions.clear();
  
  // Reset all mocks
  vi.clearAllMocks();
});

afterEach(() => {
  // Additional cleanup if needed
});

afterAll(async () => {
  // Clean up resources
  vi.restoreAllMocks();
  console.log("✓ Test teardown complete");
});

// Export mock instances for tests
export { mockRedis, mockRedisStore };
