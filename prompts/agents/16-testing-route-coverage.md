# Prompt 16 — Testing: Route Test Coverage

## Context

You are working on route tests for the crypto-vision API. There are 39 route modules in `src/routes/` but only ~24 have tests in `src/routes/__tests__/` and ~10 in `tests/routes/`.

**Test framework:** Vitest
**Config:** `vitest.config.ts` at project root
**Pattern:** Tests use Hono's `app.request()` for HTTP testing (no real server)
**Mocking:** Mock external API calls, test route logic

## Routes WITH Tests (verify they pass)

In `src/routes/__tests__/`: agents, aggregate, ai, analytics, bitcoin, cex, defi, depin, derivatives, dex, exchanges, gas, governance, keys, l2, macro, market, news, onchain, perps, research, search, security, solana

In `tests/routes/`: agents-orchestrate, anomaly, defi, health, market, portfolio, solana, staking, unlocks, whales

## Routes WITHOUT Tests (need new tests)

| Route | Endpoints | Priority |
|-------|-----------|----------|
| `calendar.ts` | GET /api/calendar/events | Medium |
| `crypto-vision.ts` | Bot endpoints | Low |
| `ecosystem.ts` | GET /api/ecosystem/* | Medium |
| `etf.ts` | GET /api/etf/* | Medium |
| `export.ts` | POST /api/export/* | High |
| `news-aggregator.ts` | GET /api/news-aggregator/* | Medium |
| `nft.ts` | GET /api/nft/* | Medium |
| `oracles.ts` | GET /api/oracles/* | Medium |
| `social.ts` | GET /api/social/* | Medium |
| `ws.ts` | WebSocket | High |

## Task

### 1. Fix Existing Tests

Run all existing tests and fix any failures:
```bash
cd /workspaces/crypto-vision && npm test
```

For each failing test:
- If the route changed, update the test to match
- If a mock is outdated, update the mock data
- If a type changed, update test types
- Do NOT skip or disable tests

### 2. Write New Route Tests

For each untested route, write comprehensive tests following the existing pattern.

**Test Pattern (example from existing tests):**
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { routeModule } from '../route-file.js';

// Mock external dependencies
vi.mock('../../lib/some-dependency.js', () => ({
  someFunction: vi.fn().mockResolvedValue(mockData),
}));

describe('Route Module', () => {
  let app: Hono;

  beforeEach(() => {
    app = new Hono();
    app.route('/api/prefix', routeModule);
  });

  describe('GET /api/prefix/endpoint', () => {
    it('returns data successfully', async () => {
      const res = await app.request('/api/prefix/endpoint');
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data).toBeDefined();
    });

    it('handles query parameters', async () => {
      const res = await app.request('/api/prefix/endpoint?page=1&limit=10');
      expect(res.status).toBe(200);
    });

    it('returns 400 for invalid params', async () => {
      const res = await app.request('/api/prefix/endpoint?page=-1');
      expect(res.status).toBe(400);
    });

    it('handles upstream failures gracefully', async () => {
      // Mock the dependency to throw
      vi.mocked(someFunction).mockRejectedValueOnce(new Error('API down'));
      const res = await app.request('/api/prefix/endpoint');
      expect(res.status).toBe(502);
    });
  });
});
```

### 3. Tests to Write

**`calendar.test.ts`:**
- GET /api/calendar/events returns events list
- Supports date range filtering
- Handles empty results

**`ecosystem.test.ts`:**
- GET /api/ecosystem returns overview
- GET /api/ecosystem/organisms returns list (may be empty)
- GET /api/ecosystem/leaderboard returns rankings
- Pagination works correctly

**`etf.test.ts`:**
- GET /api/etf/list returns ETF list
- GET /api/etf/:id returns ETF detail
- GET /api/etf/flows returns fund flows

**`export.test.ts`:**
- POST /api/export triggers data export
- Validates export parameters
- Returns export status/results

**`news-aggregator.test.ts`:**
- GET /api/news-aggregator/feed returns aggregated news
- Supports source filtering
- Handles RSS feed failures

**`nft.test.ts`:**
- GET /api/nft/collections returns collections
- GET /api/nft/trending returns trending NFTs
- Handles external API failures

**`oracles.test.ts`:**
- GET /api/oracles/prices returns oracle data
- GET /api/oracles/:network/:pair returns specific pair
- Handles stale data scenarios

**`social.test.ts`:**
- GET /api/social/trending returns social trends
- GET /api/social/:coinId returns coin social metrics
- Handles missing social data

**`ws.test.ts`:**
- WebSocket connection establishes
- Subscribe message works
- Unsubscribe message works
- Invalid messages handled
- Connection cleanup on close

### 4. Test Coverage Goals

- Each route module: >80% line coverage
- Every endpoint has at least: success case, error case, edge case
- All query parameter combinations tested
- Rate limiting tested where applicable
- Auth-required endpoints tested with and without valid API key

## Verification

1. `npm test` — ALL tests pass (0 failures)
2. New route tests exist for all 10 previously untested routes
3. No `any` types in test files
4. No skipped or disabled tests
5. Coverage report shows improvement: `npm test -- --coverage`
