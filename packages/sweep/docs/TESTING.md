# Testing Guide

> **⚠️ CRITICAL: This application handles user funds. All changes must have comprehensive test coverage.**

## Table of Contents

1. [Overview](#overview)
2. [Test Structure](#test-structure)
3. [Running Tests](#running-tests)
4. [Test Types](#test-types)
5. [Writing Tests](#writing-tests)
6. [Mocking](#mocking)
7. [Coverage](#coverage)
8. [CI/CD Integration](#cicd-integration)
9. [Best Practices](#best-practices)

---

## Overview

Sweep uses **Vitest** as the testing framework with a comprehensive test suite covering unit, integration, API, and end-to-end tests.

### Technology Stack

| Component | Technology |
|-----------|------------|
| Test Framework | Vitest |
| Coverage | @vitest/coverage-v8 |
| Test UI | @vitest/ui |
| Mocking | Vitest built-in (vi) |
| Assertions | Vitest expect |

### Coverage Thresholds

| Metric | Minimum |
|--------|---------|
| Lines | 80% |
| Branches | 70% |
| Functions | 80% |
| Statements | 80% |

---

## Test Structure

```
tests/
├── setup.ts              # Global test setup
├── unit/                 # Unit tests
│   ├── utils/            # Utility function tests
│   ├── services/         # Service unit tests
│   └── config/           # Configuration tests
├── integration/          # Integration tests
│   ├── services/         # Service integration
│   └── db/               # Database tests
├── api/                  # API route tests
│   ├── routes/           # Route handler tests
│   └── middleware/       # Middleware tests
├── services/             # Service-specific tests
│   ├── dex/              # DEX aggregator tests
│   ├── price/            # Price service tests
│   └── wallet/           # Wallet service tests
├── e2e/                  # End-to-end tests
│   └── flows/            # User flow tests
└── utils/                # Test utilities
    ├── factories.ts      # Test data factories
    ├── mocks.ts          # Common mocks
    └── helpers.ts        # Test helpers
```

---

## Running Tests

### All Tests

```bash
npm test
```

### Specific Test Groups

```bash
# Unit tests only
npm run test:unit

# Integration tests
npm run test:integration

# API tests
npm run test:api

# Service tests
npm run test:services

# End-to-end tests
npm run test:e2e
```

### Single File

```bash
# Run specific test file
npx vitest run tests/unit/utils/price.test.ts

# Run tests matching pattern
npx vitest run --grep "should calculate"
```

### Watch Mode

```bash
# Watch all tests
npm run test:watch

# Watch specific file
npx vitest watch tests/unit/utils/price.test.ts
```

### Visual UI

```bash
npm run test:ui
# Opens at http://localhost:51204
```

### Coverage Report

```bash
# Full coverage
npm run test:coverage

# Unit test coverage only
npm run test:coverage:unit

# View HTML report
open coverage/index.html
```

---

## Test Types

### Unit Tests

Test individual functions and modules in isolation.

**Location**: `tests/unit/`

**Characteristics**:
- Fast execution
- No external dependencies
- Mock all external services
- Focus on edge cases

**Example**:

```typescript
// tests/unit/utils/price.test.ts
import { describe, it, expect } from "vitest";
import { calculateNetValue, validatePrice } from "@/utils/price";

describe("Price Utils", () => {
  describe("calculateNetValue", () => {
    it("should subtract fees from gross value", () => {
      const result = calculateNetValue({
        grossValue: 100,
        gasCost: 5,
        protocolFee: 2,
      });
      
      expect(result).toBe(93);
    });

    it("should return 0 for negative results", () => {
      const result = calculateNetValue({
        grossValue: 5,
        gasCost: 10,
        protocolFee: 2,
      });
      
      expect(result).toBe(0);
    });
  });

  describe("validatePrice", () => {
    it("should accept valid price", () => {
      expect(validatePrice(1.5)).toBe(true);
    });

    it("should reject negative price", () => {
      expect(validatePrice(-1)).toBe(false);
    });

    it("should reject NaN", () => {
      expect(validatePrice(NaN)).toBe(false);
    });
  });
});
```

---

### Integration Tests

Test multiple components working together.

**Location**: `tests/integration/`

**Characteristics**:
- May use real database (test container)
- May use real Redis
- Mock external APIs
- Test service interactions

**Example**:

```typescript
// tests/integration/services/sweep.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getDb } from "@/db";
import { sweeps, users } from "@/db/schema";
import { SweepService } from "@/services/sweep.service";

describe("SweepService Integration", () => {
  let db: ReturnType<typeof getDb>;
  let sweepService: SweepService;

  beforeEach(async () => {
    db = getDb();
    sweepService = new SweepService(db);
    
    // Create test user
    await db.insert(users).values({
      walletAddress: "0x1234567890123456789012345678901234567890",
    });
  });

  afterEach(async () => {
    // Cleanup
    await db.delete(sweeps);
    await db.delete(users);
  });

  it("should create a new sweep record", async () => {
    const sweep = await sweepService.create({
      userId: "test-user-id",
      chains: ["base", "arbitrum"],
      tokens: [
        { address: "0x...", chain: "base", amount: "1000000" },
      ],
    });

    expect(sweep.id).toBeDefined();
    expect(sweep.status).toBe("pending");
  });

  it("should update sweep status", async () => {
    const sweep = await sweepService.create({ /* ... */ });
    
    await sweepService.updateStatus(sweep.id, "confirmed");
    
    const updated = await sweepService.getById(sweep.id);
    expect(updated.status).toBe("confirmed");
  });
});
```

---

### API Tests

Test HTTP endpoints and request/response handling.

**Location**: `tests/api/`

**Characteristics**:
- Test full request cycle
- Validate request/response schemas
- Test authentication/authorization
- Test error responses

**Example**:

```typescript
// tests/api/routes/quote.test.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { app } from "@/api/server";

describe("Quote API", () => {
  describe("POST /api/quote", () => {
    it("should return quote for valid request", async () => {
      const response = await app.request("/api/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress: "0x1234567890123456789012345678901234567890",
          tokens: [
            {
              address: "0xabc...",
              chain: "base",
              amount: "1000000000000000000",
            },
          ],
          outputToken: "USDC",
          outputChain: "base",
        }),
      });

      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.quoteId).toBeDefined();
      expect(data.outputAmount).toBeDefined();
      expect(data.expiresAt).toBeDefined();
    });

    it("should return 400 for invalid wallet address", async () => {
      const response = await app.request("/api/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress: "invalid",
          tokens: [],
          outputToken: "USDC",
          outputChain: "base",
        }),
      });

      expect(response.status).toBe(400);
      
      const data = await response.json();
      expect(data.error).toBeDefined();
    });

    it("should return 401 without authentication", async () => {
      // Test authenticated endpoint without token
      const response = await app.request("/api/sweep/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ /* ... */ }),
      });

      expect(response.status).toBe(401);
    });
  });
});
```

---

### Service Tests

Test business logic services with mocked dependencies.

**Location**: `tests/services/`

**Characteristics**:
- Test service methods
- Mock external APIs
- Test error handling
- Test business rules

**Example**:

```typescript
// tests/services/dex/aggregator.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DexAggregator } from "@/services/dex/aggregator";

vi.mock("@/services/dex/1inch", () => ({
  OneInchService: vi.fn().mockImplementation(() => ({
    getQuote: vi.fn().mockResolvedValue({
      outputAmount: "1000000",
      gasEstimate: "100000",
    }),
  })),
}));

describe("DexAggregator", () => {
  let aggregator: DexAggregator;

  beforeEach(() => {
    aggregator = new DexAggregator();
  });

  it("should get best quote from multiple sources", async () => {
    const quote = await aggregator.getBestQuote({
      inputToken: "0x...",
      outputToken: "0x...",
      amount: "1000000000000000000",
      chain: "base",
    });

    expect(quote.outputAmount).toBeDefined();
    expect(quote.source).toBeDefined();
  });

  it("should fall back when primary source fails", async () => {
    // Mock primary failure
    vi.spyOn(aggregator, "get1inchQuote").mockRejectedValue(new Error("Rate limited"));

    const quote = await aggregator.getBestQuote({ /* ... */ });

    // Should use fallback
    expect(quote.source).not.toBe("1inch");
  });
});
```

---

### E2E Tests

Test complete user flows.

**Location**: `tests/e2e/`

**Characteristics**:
- Test full user journeys
- May use test network (forked mainnet)
- Longer timeouts
- Test real integrations

**Example**:

```typescript
// tests/e2e/flows/sweep.test.ts
import { describe, it, expect, beforeAll } from "vitest";
import { app } from "@/api/server";
import { createTestWallet } from "@tests/utils/helpers";

describe("Sweep Flow E2E", () => {
  let authToken: string;
  let walletAddress: string;

  beforeAll(async () => {
    // Create test wallet and authenticate
    const wallet = await createTestWallet();
    walletAddress = wallet.address;
    authToken = await authenticateWallet(wallet);
  });

  it("should complete full sweep flow", async () => {
    // Step 1: Scan wallet
    const scanResponse = await app.request("/api/wallet/scan", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        walletAddress,
        chains: ["base"],
      }),
    });
    expect(scanResponse.status).toBe(200);
    const { tokens } = await scanResponse.json();

    // Step 2: Get quote
    const quoteResponse = await app.request("/api/quote", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        walletAddress,
        tokens: tokens.slice(0, 5),
        outputToken: "USDC",
        outputChain: "base",
      }),
    });
    expect(quoteResponse.status).toBe(200);
    const { quoteId } = await quoteResponse.json();

    // Step 3: Execute sweep
    const executeResponse = await app.request("/api/sweep/execute", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        quoteId,
        signature: "0x...", // Signed permit2 message
      }),
    });
    expect(executeResponse.status).toBe(200);
    const { sweepId } = await executeResponse.json();

    // Step 4: Check status
    const statusResponse = await app.request(`/api/status/${sweepId}`, {
      headers: { "Authorization": `Bearer ${authToken}` },
    });
    expect(statusResponse.status).toBe(200);
    const { status } = await statusResponse.json();
    expect(["pending", "submitted", "confirmed"]).toContain(status);
  }, 60000); // 60s timeout for E2E
});
```

---

## Writing Tests

### Test File Naming

```
[module].test.ts           # General tests
[module].unit.test.ts      # Unit tests (optional)
[module].integration.test.ts # Integration tests (optional)
```

### Test Structure

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

describe("ModuleName", () => {
  // Setup
  beforeEach(() => {
    // Runs before each test
  });

  afterEach(() => {
    // Cleanup after each test
    vi.clearAllMocks();
  });

  describe("methodName", () => {
    it("should do expected behavior", () => {
      // Arrange
      const input = { /* ... */ };

      // Act
      const result = methodName(input);

      // Assert
      expect(result).toBe(expected);
    });

    it("should handle edge case", () => {
      // Test edge cases
    });

    it("should throw on invalid input", () => {
      expect(() => methodName(null)).toThrow("Invalid input");
    });
  });
});
```

---

## Mocking

### Mock Functions

```typescript
import { vi } from "vitest";

// Create mock function
const mockFn = vi.fn();
mockFn.mockReturnValue(42);
mockFn.mockResolvedValue({ data: "async" });

// Verify calls
expect(mockFn).toHaveBeenCalled();
expect(mockFn).toHaveBeenCalledWith("arg1", "arg2");
expect(mockFn).toHaveBeenCalledTimes(2);
```

### Mock Modules

```typescript
// Mock entire module
vi.mock("@/services/price", () => ({
  PriceService: vi.fn().mockImplementation(() => ({
    getPrice: vi.fn().mockResolvedValue(1.5),
  })),
}));

// Mock specific exports
vi.mock("@/config/chains", async () => {
  const actual = await vi.importActual("@/config/chains");
  return {
    ...actual,
    CHAIN_CONFIG: {
      ...actual.CHAIN_CONFIG,
      ethereum: { ...actual.CHAIN_CONFIG.ethereum, rpcEnvKey: "TEST_RPC" },
    },
  };
});
```

### Mock Redis (from setup.ts)

```typescript
import { createMockRedis } from "@tests/setup";

const redis = createMockRedis();
await redis.set("key", "value");
await redis.get("key"); // Returns "value"
```

### Mock External APIs

```typescript
import { vi } from "vitest";

// Mock fetch globally
vi.stubGlobal("fetch", vi.fn());

// Configure mock responses
(fetch as any).mockResolvedValue({
  ok: true,
  json: async () => ({ price: 1.5 }),
});
```

---

## Coverage

### View Coverage Report

```bash
npm run test:coverage
open coverage/index.html
```

### Coverage Configuration

From `vitest.config.ts`:

```typescript
coverage: {
  provider: "v8",
  reporter: ["text", "json", "html", "lcov"],
  reportsDirectory: "./coverage",
  include: ["src/**/*.ts"],
  exclude: [
    "src/**/*.d.ts",
    "src/**/types.ts",
    "src/**/index.ts",
    "src/**/*.test.ts",
    "src/workers.ts",
  ],
  thresholds: {
    lines: 80,
    branches: 70,
    functions: 80,
    statements: 80,
  },
},
```

### Ignore Coverage

```typescript
/* v8 ignore next */
function debugOnly() { /* ... */ }

/* v8 ignore start */
// Ignored block
/* v8 ignore stop */
```

---

## CI/CD Integration

### GitHub Actions Workflow

```yaml
# .github/workflows/test.yml
name: Tests

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: test
        ports:
          - 5432:5432
      redis:
        image: redis:7-alpine
        ports:
          - 6379:6379

    steps:
      - uses: actions/checkout@v4
      
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      
      - run: npm ci
      
      - name: Run tests
        run: npm run test:coverage
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/test
          REDIS_URL: redis://localhost:6379
      
      - name: Upload coverage
        uses: codecov/codecov-action@v4
        with:
          files: ./coverage/lcov.info
```

---

## Best Practices

### Do's

✅ **Test behavior, not implementation**
```typescript
// Good: Test what it does
expect(result.isValid).toBe(true);

// Bad: Test how it does it
expect(internalMethod).toHaveBeenCalled();
```

✅ **Use descriptive test names**
```typescript
// Good
it("should return empty array when wallet has no dust tokens")

// Bad
it("test case 1")
```

✅ **Keep tests independent**
```typescript
// Each test should set up its own state
beforeEach(() => {
  // Fresh setup
});
```

✅ **Test edge cases**
```typescript
it("should handle empty array")
it("should handle null input")
it("should handle maximum value")
```

### Don'ts

❌ **Don't test external libraries**
```typescript
// Bad: Testing that Zod works
expect(z.string().parse("hello")).toBe("hello");
```

❌ **Don't share state between tests**
```typescript
// Bad: Tests depend on order
let sharedValue;
it("test 1", () => { sharedValue = 1; });
it("test 2", () => { expect(sharedValue).toBe(1); }); // Fragile!
```

❌ **Don't make tests too slow**
```typescript
// Bad: Real network calls in unit tests
await fetch("https://api.coingecko.com/..."); // Mock this!
```

---

## Related Documentation

- [DEVELOPMENT.md](./DEVELOPMENT.md) - Local development setup
- [API.md](./API.md) - API documentation
- [QUEUE_WORKERS.md](./QUEUE_WORKERS.md) - Worker testing
