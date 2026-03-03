# Prompt 11: Bitcoin Route Integration Tests

## Agent Identity & Rules

```
You are building comprehensive integration tests for the Bitcoin routes in Crypto Vision.
- Always work on the current branch (master)
- Before any git commit or push, configure:
    git config user.name "nirholas"
    git config user.email "nirholas@users.noreply.github.com"
- Always use background terminals (isBackground: true)
- Always kill terminals after commands complete
- We have unlimited Claude credits — build the best possible version
- No mocks of the module under test — only mock external dependencies
- Every test must test REAL behavior, not implementation details
```

## Objective

Create a full integration test suite for `src/routes/bitcoin.ts` (226 lines, ~20 endpoints) using vitest + Hono's `app.request()` test helper. Mock only the source adapters so no real HTTP calls are made. Test every endpoint with happy path AND error cases.

## Context

### Current Test Infrastructure
- Test runner: vitest v3.2.4
- Config: `vitest.config.ts` — includes `src/routes/__tests__/**/*.test.ts`
- Pattern: `vi.mock("../../sources/{name}.js")` before imports
- Mount: `const app = new Hono().route("/api/bitcoin", bitcoinRoutes)`
- Error system: `src/lib/api-error.ts` returns `{ error, code, timestamp }`

### Existing Test Examples (READ THESE FOR PATTERNS)
- `src/routes/__tests__/market.test.ts` — 458 lines, 24 tests (best reference)
- `src/routes/__tests__/defi.test.ts` — DeFi route tests
- `src/routes/__tests__/ai.test.ts` — AI route tests with cache/queue mocking

### The Route File: `src/routes/bitcoin.ts`
```
Read the actual file at src/routes/bitcoin.ts (226 lines) to understand:
- All exported route handlers
- Which source adapters are imported
- What query/path parameters each endpoint expects
- How errors are handled (try/catch with ApiError)
- Response shapes returned by each endpoint
```

## Deliverables

### File: `src/routes/__tests__/bitcoin.test.ts`

Create this file with the following structure:

```typescript
/**
 * Integration tests for Bitcoin routes.
 *
 * Mocks source adapters (bitcoin, blockchain, alternative, coingecko)
 * so no real HTTP calls are made. Uses Hono's app.request() test helper.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";

// ─── Mock sources BEFORE importing routes ────────────────────

// Read src/routes/bitcoin.ts to find ALL imports from src/sources/*
// Then mock each one. Example:

vi.mock("../../sources/bitcoin.js", () => ({
  getBitcoinStats: vi.fn(),
  getBitcoinFees: vi.fn(),
  getMempoolInfo: vi.fn(),
  getBlockchainInfo: vi.fn(),
  getLatestBlocks: vi.fn(),
  getAddressInfo: vi.fn(),
  getTransactionInfo: vi.fn(),
  getBitcoinHashrate: vi.fn(),
  getDifficultyHistory: vi.fn(),
  getLightningStats: vi.fn(),
}));

vi.mock("../../sources/blockchain.js", () => ({
  getBlockchainStats: vi.fn(),
  getBlockHeight: vi.fn(),
  getUnconfirmedTxCount: vi.fn(),
}));

vi.mock("../../sources/coingecko.js", () => ({
  getCoinDetail: vi.fn(),
  getMarketChart: vi.fn(),
}));

vi.mock("../../sources/alternative.js", () => ({
  getFearGreedIndex: vi.fn(),
}));

vi.mock("../../lib/logger.js", () => ({
  log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

// ─── Import AFTER mocks ─────────────────────────────────────

import * as btc from "../../sources/bitcoin.js";
import * as blockchain from "../../sources/blockchain.js";
import * as cg from "../../sources/coingecko.js";
import * as alt from "../../sources/alternative.js";
import { bitcoinRoutes } from "../bitcoin.js";

// ─── Set up app ──────────────────────────────────────────────

const app = new Hono().route("/api/bitcoin", bitcoinRoutes);

beforeEach(() => {
  vi.clearAllMocks();
});
```

### Test Cases Required

For EVERY endpoint in `src/routes/bitcoin.ts`, write at minimum:

#### 1. GET /api/bitcoin/stats
```typescript
describe("GET /api/bitcoin/stats", () => {
  it("returns Bitcoin network stats on success", async () => {
    // Mock the source function with realistic data
    vi.mocked(btc.getBitcoinStats).mockResolvedValue({
      price: 97250.42,
      marketCap: 1920000000000,
      volume24h: 38500000000,
      supply: 19750000,
      blockHeight: 890234,
      hashRate: "650 EH/s",
      difficulty: 95672345678901,
      mempoolSize: 45000,
      avgBlockTime: 9.8,
      halvingCountdown: { blocksRemaining: 120000, estimatedDate: "2028-04-15" },
    });

    const res = await app.request("/api/bitcoin/stats");
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveProperty("price");
    expect(json).toHaveProperty("marketCap");
    expect(json).toHaveProperty("blockHeight");
    expect(json).toHaveProperty("hashRate");
    expect(json).toHaveProperty("halvingCountdown");
    expect(json.price).toBe(97250.42);
  });

  it("returns 500 when source fails", async () => {
    vi.mocked(btc.getBitcoinStats).mockRejectedValue(new Error("mempool.space down"));

    const res = await app.request("/api/bitcoin/stats");
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json).toHaveProperty("error");
    expect(json).toHaveProperty("code");
  });
});
```

#### 2. GET /api/bitcoin/fees
```typescript
describe("GET /api/bitcoin/fees", () => {
  it("returns fee estimates on success", async () => {
    vi.mocked(btc.getBitcoinFees).mockResolvedValue({
      fastest: 45,
      halfHour: 35,
      hour: 25,
      economy: 15,
      minimum: 5,
    });

    const res = await app.request("/api/bitcoin/fees");
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveProperty("fastest");
    expect(json.fastest).toBeGreaterThan(0);
  });

  it("returns 500 when mempool API fails", async () => {
    vi.mocked(btc.getBitcoinFees).mockRejectedValue(new Error("timeout"));

    const res = await app.request("/api/bitcoin/fees");
    expect(res.status).toBe(500);
  });
});
```

#### 3. GET /api/bitcoin/mempool
```typescript
describe("GET /api/bitcoin/mempool", () => {
  it("returns mempool information", async () => {
    vi.mocked(btc.getMempoolInfo).mockResolvedValue({
      count: 45000,
      vsize: 120000000,
      totalFee: 3.5,
      feeHistogram: [[45, 500], [35, 1200], [25, 3000], [15, 8000]],
    });

    const res = await app.request("/api/bitcoin/mempool");
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveProperty("count");
    expect(json.count).toBe(45000);
  });

  it("propagates source errors as 500", async () => {
    vi.mocked(btc.getMempoolInfo).mockRejectedValue(new Error("fail"));
    const res = await app.request("/api/bitcoin/mempool");
    expect(res.status).toBe(500);
  });
});
```

#### 4. GET /api/bitcoin/blocks
```typescript
describe("GET /api/bitcoin/blocks", () => {
  it("returns latest blocks", async () => {
    vi.mocked(btc.getLatestBlocks).mockResolvedValue([
      {
        height: 890234,
        hash: "00000000000000000002a7c4c1e48",
        timestamp: 1709500000,
        txCount: 3400,
        size: 1500000,
        weight: 3993000,
        miner: "Foundry USA",
      },
      {
        height: 890233,
        hash: "00000000000000000001b8d5e2f37",
        timestamp: 1709499400,
        txCount: 2800,
        size: 1400000,
        weight: 3900000,
        miner: "AntPool",
      },
    ]);

    const res = await app.request("/api/bitcoin/blocks");
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(Array.isArray(json)).toBe(true);
    expect(json.length).toBeGreaterThan(0);
    expect(json[0]).toHaveProperty("height");
    expect(json[0]).toHaveProperty("miner");
  });

  it("returns 500 on failure", async () => {
    vi.mocked(btc.getLatestBlocks).mockRejectedValue(new Error("fail"));
    const res = await app.request("/api/bitcoin/blocks");
    expect(res.status).toBe(500);
  });
});
```

#### 5. GET /api/bitcoin/address/:address
```typescript
describe("GET /api/bitcoin/address/:address", () => {
  it("returns address information for a valid address", async () => {
    vi.mocked(btc.getAddressInfo).mockResolvedValue({
      address: "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
      balance: 150000000, // satoshis
      txCount: 42,
      received: 500000000,
      sent: 350000000,
      unconfirmed: 0,
    });

    const res = await app.request("/api/bitcoin/address/bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh");
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveProperty("address");
    expect(json).toHaveProperty("balance");
    expect(json.balance).toBe(150000000);
  });

  it("returns 404 for nonexistent address", async () => {
    vi.mocked(btc.getAddressInfo).mockResolvedValue(null);
    const res = await app.request("/api/bitcoin/address/invalid");
    expect(res.status).toBe(404);
  });

  it("returns 500 when source fails", async () => {
    vi.mocked(btc.getAddressInfo).mockRejectedValue(new Error("fail"));
    const res = await app.request("/api/bitcoin/address/bc1test");
    expect(res.status).toBe(500);
  });
});
```

#### 6. GET /api/bitcoin/tx/:txid
```typescript
describe("GET /api/bitcoin/tx/:txid", () => {
  it("returns transaction details", async () => {
    const txid = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2";
    vi.mocked(btc.getTransactionInfo).mockResolvedValue({
      txid,
      status: { confirmed: true, blockHeight: 890200, blockTime: 1709490000 },
      fee: 15000,
      size: 250,
      weight: 900,
      vin: [{ txid: "prev_tx", vout: 0, value: 50000000 }],
      vout: [{ value: 49985000, address: "bc1q..." }],
    });

    const res = await app.request(`/api/bitcoin/tx/${txid}`);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveProperty("txid");
    expect(json.txid).toBe(txid);
    expect(json.status.confirmed).toBe(true);
  });

  it("returns 404 for nonexistent tx", async () => {
    vi.mocked(btc.getTransactionInfo).mockResolvedValue(null);
    const res = await app.request("/api/bitcoin/tx/0000000000000000");
    expect(res.status).toBe(404);
  });
});
```

#### 7. GET /api/bitcoin/hashrate
```typescript
describe("GET /api/bitcoin/hashrate", () => {
  it("returns hashrate data", async () => {
    vi.mocked(btc.getBitcoinHashrate).mockResolvedValue({
      current: "650 EH/s",
      history: [
        { timestamp: 1709400000, hashrate: 640000000000000000000 },
        { timestamp: 1709300000, hashrate: 635000000000000000000 },
      ],
    });

    const res = await app.request("/api/bitcoin/hashrate");
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveProperty("current");
    expect(json).toHaveProperty("history");
  });

  it("returns 500 on failure", async () => {
    vi.mocked(btc.getBitcoinHashrate).mockRejectedValue(new Error("fail"));
    const res = await app.request("/api/bitcoin/hashrate");
    expect(res.status).toBe(500);
  });
});
```

#### 8. GET /api/bitcoin/difficulty
```typescript
describe("GET /api/bitcoin/difficulty", () => {
  it("returns difficulty history", async () => {
    vi.mocked(btc.getDifficultyHistory).mockResolvedValue({
      current: 95672345678901,
      adjustmentEstimate: "+3.2%",
      nextAdjustment: { blocksRemaining: 1200, estimatedDate: "2026-03-10" },
      history: [
        { height: 890208, difficulty: 95672345678901, timestamp: 1709400000 },
        { height: 888192, difficulty: 92700000000000, timestamp: 1708200000 },
      ],
    });

    const res = await app.request("/api/bitcoin/difficulty");
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveProperty("current");
    expect(json).toHaveProperty("adjustmentEstimate");
    expect(json).toHaveProperty("history");
  });

  it("returns 500 on failure", async () => {
    vi.mocked(btc.getDifficultyHistory).mockRejectedValue(new Error("fail"));
    const res = await app.request("/api/bitcoin/difficulty");
    expect(res.status).toBe(500);
  });
});
```

#### 9. GET /api/bitcoin/lightning
```typescript
describe("GET /api/bitcoin/lightning", () => {
  it("returns Lightning Network stats", async () => {
    vi.mocked(btc.getLightningStats).mockResolvedValue({
      nodeCount: 16500,
      channelCount: 72000,
      totalCapacity: 5600,
      avgChannelSize: 0.078,
      medianBaseFee: 1,
    });

    const res = await app.request("/api/bitcoin/lightning");
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveProperty("nodeCount");
    expect(json).toHaveProperty("channelCount");
    expect(json).toHaveProperty("totalCapacity");
  });

  it("returns 500 on failure", async () => {
    vi.mocked(btc.getLightningStats).mockRejectedValue(new Error("fail"));
    const res = await app.request("/api/bitcoin/lightning");
    expect(res.status).toBe(500);
  });
});
```

## Implementation Steps

1. **Read `src/routes/bitcoin.ts`** — understand every endpoint, import, param, and error path
2. **Read `src/sources/bitcoin.ts`** and `src/sources/blockchain.ts` — understand function signatures
3. **Read `src/routes/__tests__/market.test.ts`** — this is the gold standard pattern to follow
4. **Create `src/routes/__tests__/bitcoin.test.ts`** with all mocks and tests
5. **Adapt the mock values** to match what the real source functions actually return (read the source adapter)
6. **Run**: `npx vitest run src/routes/__tests__/bitcoin.test.ts`
7. **Fix any failures** — adjust mock shapes or assertions to match actual route behavior
8. **Run full suite**: `npx vitest run` to check for regressions
9. **Commit**: `git add src/routes/__tests__/bitcoin.test.ts && git commit -m "test(routes): add bitcoin route integration tests"`
10. **Push**: `git push origin master`

## Verification

```bash
# Run just bitcoin tests
npx vitest run src/routes/__tests__/bitcoin.test.ts

# Expected: Test Files 1 passed (1), Tests 18+ passed
# All tests should pass with no real HTTP calls made

# Run full suite to verify no regressions  
npx vitest run

# Expected: All existing tests still pass
```

## Key Patterns to Follow

### Mock Shape Must Match Source
The mock return value shape MUST match what the actual source function returns. Read the source file.

### Error Code Assertions
Route error handlers use `ApiError` which returns `{ error: string, code: string, timestamp: string }`.
Check `json.code` (e.g., `"INTERNAL_ERROR"`, `"NOT_FOUND"`) not `json.error` text.

### beforeEach Clears Mocks
With `restoreMocks: true` in vitest config, use `vi.clearAllMocks()` in `beforeEach`.

### Response Validation
Always check:
1. `res.status` — the HTTP status code
2. Response JSON has expected keys
3. Response JSON has expected values for key fields
4. Array responses: check `Array.isArray()` and length

## Dependencies
- Must run AFTER Prompt 08 (testing-hardening) if changes to test infrastructure were made
- No new npm dependencies needed
