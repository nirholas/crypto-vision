# Prompt 17 — Testing: Integration, E2E & Load Tests

## Context

You are working on integration and E2E tests for crypto-vision. The test infrastructure includes:

- `vitest.config.ts` — Unit/integration test config
- `vitest.e2e.config.ts` — E2E config (starts real server via `tests/e2e/global-setup.ts`)
- `tests/e2e/smoke.test.ts` — Basic E2E smoke test
- `tests/integration/api-flows.test.ts` — Integration test
- `tests/fuzz/api-fuzz.test.ts` — Fuzz test
- `tests/benchmarks/` — Benchmark directory (empty)
- `tests/load/` — Load test directory (empty)

## Task

### 1. Fix E2E Test Suite

Review and fix `tests/e2e/global-setup.ts` to properly start/stop the API server:

```typescript
// Global setup should:
// 1. Start the Hono server on a random available port
// 2. Wait for /health to return 200
// 3. Export the base URL for test files
// 4. On teardown: gracefully stop the server
```

Fix `tests/e2e/smoke.test.ts` to test against the running server:

```typescript
// Smoke tests should verify:
// - GET /health returns 200 with status "healthy"
// - GET /api/market/prices returns valid market data
// - GET /api/market/trending returns trending coins
// - GET /api/defi/tvl returns DeFi TVL data
// - GET /api/gas returns gas prices
// - GET /api/ai/models returns available AI models
// - 404 for unknown routes
// - CORS headers present
```

### 2. Write Integration Tests (`tests/integration/`)

**`api-flows.test.ts`** — Complete user journey tests:

```typescript
// Flow 1: Market Research
// 1. GET /api/market/prices → get bitcoin ID
// 2. GET /api/market/coin/bitcoin → get detail
// 3. GET /api/analytics/correlation?coins=bitcoin,ethereum → get correlation
// 4. POST /api/ai/analyze → analyze bitcoin

// Flow 2: DeFi Research
// 1. GET /api/defi/protocols → list protocols
// 2. GET /api/defi/protocol/aave → get Aave detail
// 3. GET /api/defi/yields → get yield opportunities
// 4. GET /api/analytics/defi-comparison → compare protocols

// Flow 3: Portfolio Management
// 1. POST /api/portfolio/create → create portfolio
// 2. POST /api/portfolio/add → add holdings
// 3. GET /api/portfolio → get portfolio with current values
// 4. GET /api/portfolio/performance → get performance

// Flow 4: API Key Management
// 1. POST /api/keys/create → create API key
// 2. GET /api/keys → list keys
// 3. Use key in X-API-Key header for authenticated request
// 4. DELETE /api/keys/:id → revoke key

// Flow 5: Search
// 1. GET /api/search?q=ethereum → semantic search
// 2. GET /api/search/suggestions?q=eth → autocomplete
// 3. POST /api/ai/ask → ask a question
```

**`websocket-flows.test.ts`** — WebSocket integration:

```typescript
// 1. Connect to ws://localhost:PORT/ws
// 2. Subscribe to "prices" channel
// 3. Verify price update received within 60s
// 4. Unsubscribe
// 5. Verify no more updates
// 6. Test reconnection after server restart
```

**`rate-limiting.test.ts`** — Rate limit enforcement:

```typescript
// 1. Send N requests rapidly to same endpoint
// 2. Verify 429 response after limit exceeded
// 3. Verify Retry-After header present
// 4. Wait and verify requests succeed again
```

### 3. Write Fuzz Tests (`tests/fuzz/`)

**`api-fuzz.test.ts`** — Fuzz all API endpoints with invalid input:

```typescript
// For each endpoint:
// 1. Send random strings as query params
// 2. Send very long strings (10KB+)
// 3. Send special characters: <script>, '../', null bytes
// 4. Send negative numbers for page/limit
// 5. Send arrays/objects where strings expected
// 6. Verify API never returns 500 (should be 400 or handle gracefully)
// 7. Verify no stack traces in responses
```

### 4. Write Benchmark Tests (`tests/benchmarks/`)

**`api-benchmark.test.ts`:**

```typescript
// Benchmark key endpoints for response time:
// - GET /health → should be < 10ms
// - GET /api/market/prices → should be < 200ms (cached)
// - GET /api/market/prices → should be < 2000ms (uncached, first request)
// - POST /api/ai/ask → should be < 10000ms (AI inference)
// - GET /api/search → should be < 500ms
//
// Use vitest's bench() function or manual timing
// Report p50, p95, p99 latencies
```

### 5. Write Load Tests (`tests/load/`)

**`stress.test.ts`:**

```typescript
// Load test with concurrent requests:
// 1. 10 concurrent requests to /api/market/prices → all succeed
// 2. 50 concurrent requests → most succeed, some may be rate limited
// 3. 100 concurrent requests → verify no crashes, graceful degradation
// 4. Sustained load: 10 req/sec for 60 seconds → verify stable memory/CPU
//
// Use Promise.all() with fetch() — no external load test tools
// Track: success rate, avg latency, max latency, error count
```

### 6. Add Test Utilities

**`tests/helpers/`:**

```typescript
// test-server.ts — Start/stop test server with random port
// test-client.ts — HTTP client for E2E tests with auth helpers
// fixtures.ts — Shared test data (mock coins, mock news, etc.)
// assertions.ts — Custom matchers (toBeValidResponse, toHaveCacheHeaders, etc.)
```

## Technical Requirements

- E2E tests run against a real server (no mocks)
- Integration tests may mock external APIs but use real server logic
- Fuzz tests must never cause server crashes
- Benchmarks must run in CI without timing out
- Load tests should be tag-gated (don't run on every commit)
- All tests use TypeScript with no `any`
- Test utilities are shared across test directories

## Verification

1. `npm test` — All unit tests pass
2. `npm run test:e2e` — All E2E tests pass (server starts and stops correctly)
3. Fuzz tests don't produce any 500 responses
4. Benchmark results printed to console
5. Load test completes without crashes
6. `npm run typecheck` passes
