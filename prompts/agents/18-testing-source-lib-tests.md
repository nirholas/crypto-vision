# Prompt 18 — Testing: Source Adapter & Lib Module Tests

## Context

You are working on unit tests for the core library modules (`src/lib/`) and data source adapters (`src/sources/`) in crypto-vision.

**Existing lib tests** (in `src/lib/__tests__/` and `tests/lib/`):
agents, ai, api-error, anomaly, auth, bigquery, bq-ingest, cache, cdn-cache, embeddings, env, etag, export-manager, fallback, fetcher, logger, metrics, middleware, orchestrator, pubsub, queue, rag, rate-limit, redis, response-envelope, schemas, search-analytics, search, security, training-config, validation, vector-store, workflow-templates, ws

**Existing source tests** (in `src/sources/__tests__/`): Unknown — audit what exists.

## Task

### 1. Audit Existing Lib Tests

Run all existing lib tests and fix failures:
```bash
npm test -- --reporter=verbose 2>&1 | head -200
```

For each failing test, fix the test or the underlying code.

### 2. Write Source Adapter Tests

Each source adapter needs tests. These should mock HTTP responses (not call real APIs):

**Pattern:**
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { someAdapter } from '../some-source.js';

// Mock the fetcher
vi.mock('../../lib/fetcher.js', () => ({
  fetchWithResilience: vi.fn(),
}));

describe('SomeSource', () => {
  it('returns parsed data on success', async () => {
    vi.mocked(fetchWithResilience).mockResolvedValue({
      ok: true,
      json: async () => mockApiResponse,
    });
    const result = await someAdapter.getData();
    expect(result).toEqual(expectedParsedData);
  });

  it('handles API errors', async () => {
    vi.mocked(fetchWithResilience).mockResolvedValue({
      ok: false,
      status: 429,
    });
    await expect(someAdapter.getData()).rejects.toThrow();
  });

  it('handles network failures', async () => {
    vi.mocked(fetchWithResilience).mockRejectedValue(new Error('fetch failed'));
    await expect(someAdapter.getData()).rejects.toThrow();
  });
});
```

**Sources that need tests (priority order):**

| Source | Key Functions to Test |
|--------|----------------------|
| `coingecko.ts` | getMarkets, getCoin, getTrending, getGlobal, search |
| `defillama.ts` | getProtocols, getChains, getYields, getStablecoins |
| `binance.ts` | getTicker, getKlines, getDepth, get24hStats |
| `bitcoin.ts` | getNetworkStats, getMempoolInfo, getBlocks |
| `geckoterminal.ts` | getTrendingPairs, getNewPairs, getPoolData |
| `alternative.ts` | getFearGreedIndex |
| `coinglass.ts` | getFundingRates, getOpenInterest, getLiquidations |
| `hyperliquid.ts` | getMarkets, getPositions, getFunding |
| `jupiter.ts` | getQuote, getTokens, getPrice |
| `snapshot.ts` | getProposals, getVotes, getSpaces |
| `l2beat.ts` | getTVL, getProjects, getRiskAnalysis |
| `macro.ts` | getDXY, getGold, getSP500, getTreasury |
| `etf.ts` | getETFs, getFlows |
| `whales.ts` | getTransactions, getTopHolders |
| `social.ts` | getTrending, getCoinSentiment |

### 3. Improve Lib Module Tests

For each lib module with existing tests, check and improve coverage:

**`cache.ts`** — Test:
- LRU eviction when max size reached
- Redis fallback when LRU misses
- TTL expiration
- Stampede protection (multiple concurrent requests for same key)
- Cache invalidation
- Serialization/deserialization of complex objects

**`fetcher.ts`** — Test:
- Circuit breaker: opens after N failures, closes after cooldown
- Retry logic: 3 retries with exponential backoff
- Timeout enforcement
- Custom headers
- Response type handling (JSON, text, buffer)

**`rate-limit.ts`** — Test:
- Token bucket: allows burst, refills over time
- Sliding window: correct counts per window
- Per-IP limiting
- Per-API-key limiting
- X-RateLimit headers generated correctly

**`anomaly.ts`** — Test:
- Modified Z-Score detection
- EWMA detection
- Different anomaly types (16 types)
- Edge cases: empty data, single data point, all same values

**`auth.ts`** — Test:
- Valid API key accepted
- Invalid API key rejected (401)
- Missing API key (public endpoints still work)
- Rate limit per API key
- Key metadata attached to request context

**`ai.ts`** — Test:
- Provider chain fallthrough
- Timeout handling per provider
- Structured output parsing with Zod
- Token usage tracking
- Graceful degradation when no API keys set

### 4. Test Coverage Thresholds

Update `vitest.config.ts` coverage thresholds:
```typescript
thresholds: {
  statements: 60,  // up from 50
  branches: 50,    // up from 40
  functions: 55,   // up from 45
  lines: 60,       // up from 50
}
```

### 5. Add Test Utils

Create `tests/helpers/mock-responses.ts`:
```typescript
// Shared mock API responses for consistent testing:
// - CoinGecko market data (10 coins)
// - DeFiLlama TVL data
// - Binance ticker data
// - Fear & Greed Index
// - News articles (5 items)
// All with realistic data shapes matching actual API responses
```

## Verification

1. `npm test` — ALL tests pass
2. `npm test -- --coverage` — Coverage meets thresholds
3. Every source adapter has at least: success, API error, network error tests
4. No `any` types in test files
5. No skipped tests
