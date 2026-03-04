# Prompt 12 — Backend: Data Source Adapters Audit & Fix

## Context

You are working on `src/sources/` in the crypto-vision monorepo. There are 37 data source adapters that connect to external APIs. Each adapter fetches data from a specific service and normalizes it for the route handlers.

The adapters use:
- `src/lib/fetcher.ts` — HTTP client with circuit breaker, retries, timeout
- `src/lib/cache.ts` — Two-tier caching (LRU + Redis)
- `src/lib/coingecko-rate-limit.ts` — CoinGecko-specific rate limiter
- `src/lib/logger.ts` — Structured logging

## All 37 Source Adapters

| Adapter | External API | Priority |
|---------|-------------|----------|
| `coingecko.ts` | CoinGecko v3 | Critical |
| `defillama.ts` | DeFiLlama | Critical |
| `binance.ts` | Binance Public API | Critical |
| `bitcoin.ts` | BlockCypher, Mempool.space | High |
| `blockchain.ts` | Blockchain.info | High |
| `geckoterminal.ts` | GeckoTerminal DEX API | High |
| `alternative.ts` | Alternative.me (F&G Index) | High |
| `cryptocompare.ts` | CryptoCompare | Medium |
| `coinglass.ts` | CoinGlass derivatives | Medium |
| `hyperliquid.ts` | Hyperliquid DEX | Medium |
| `dydx.ts` | dYdX v4 | Medium |
| `deribit.ts` | Deribit options | Medium |
| `jupiter.ts` | Jupiter Solana DEX | Medium |
| `snapshot.ts` | Snapshot.org governance | Medium |
| `l2beat.ts` | L2Beat analytics | Medium |
| `coincap.ts` | CoinCap.io | Medium |
| `coinlore.ts` | CoinLore | Low |
| `bybit.ts` | Bybit API | Medium |
| `okx.ts` | OKX API | Medium |
| `macro.ts` | Yahoo Finance, FRED | Medium |
| `etf.ts` | ETF data sources | Medium |
| `staking.ts` | StakingRewards | Medium |
| `unlocks.ts` | Token.Unlocks | Medium |
| `whales.ts` | Whale Alert, Arkham | Medium |
| `social.ts` | LunarCrush, Santiment | Medium |
| `nft.ts` | OpenSea, Reservoir | Low |
| `oracles.ts` | Chainlink, Pyth | Medium |
| `depinscan.ts` | DePINscan | Low |
| `tokenterminal.ts` | Token Terminal | Low |
| `messari.ts` | Messari | Low |
| `goplus.ts` | GoPlus Security | Medium |
| `evm.ts` | EVM RPC calls | Medium |
| `calendar.ts` | CoinMarketCal | Low |
| `crypto-news.ts` | CryptoPanic | Medium |
| `news-aggregator.ts` | RSS feeds | Medium |
| `portfolio.ts` | Multi-source portfolio | Low |

## Task

### 1. Audit Each Adapter

For each of the 37 adapters, verify:

**API Connectivity:**
- Base URLs are correct and current (APIs change URLs)
- API key handling: env var name, header format, query param format
- Free tier rate limits are respected
- Response parsing handles current API schema (APIs evolve)

**Error Handling:**
- HTTP error codes handled: 400, 401, 403, 404, 429, 500, 502, 503
- Network timeouts handled (5s default, 10s for slow APIs)
- JSON parse errors caught
- Empty/null response data handled
- API deprecation warnings logged

**Data Normalization:**
- Consistent return types (TypeScript interfaces)
- Numbers as numbers (not strings), dates as ISO 8601
- Missing fields use sensible defaults or null (not undefined)
- Arrays never undefined (empty array default)

**Caching:**
- Appropriate TTLs (30s for prices, 5min for DeFi, 30min for static)
- Cache keys include all relevant parameters
- Cache invalidation on error (don't cache error responses)

**Rate Limiting:**
- Per-source rate limiting (not global)
- CoinGecko: 10-30 req/min (free tier)
- Binance: 20 req/sec weight
- DeFiLlama: 100 req/min (generous)
- Others: check docs and implement appropriate limits

### 2. Fix Critical Adapters

**`coingecko.ts`** — Most important, powers main market data:
- Verify all endpoints: `/coins/markets`, `/coins/{id}`, `/trending`, `/global`, `/search`
- Rate limiter: use existing `coingecko-rate-limit.ts`
- Support both free API and Pro API (with key)
- Handle response schema changes

**`defillama.ts`** — DeFi data:
- TVL by protocol, chain
- Yields data
- Stablecoin data
- DEX volumes
- Fees and revenue

**`binance.ts`** — Exchange data with WebSocket option:
- REST: ticker, klines, depth, trades
- Zod schemas for response validation (already partially done)
- Weight tracking for rate limits

### 3. Add Missing Type Definitions

Create or complete `src/sources/__tests__/*.test.ts` type definitions:
- Each adapter's return types should be in its own file or in a shared types file
- Export types for route handlers to consume
- No `any` types in adapter returns

### 4. Add Source Health Monitoring

Create `src/sources/health.ts`:
```typescript
// Check connectivity to each data source
// Returns: { source: string, status: 'up' | 'down' | 'degraded', latency: number, lastSuccess: Date }
// Used by the /health endpoint to report upstream status
```

### 5. Add Fallback Chains

Some data is available from multiple sources. Implement fallback chains:
- Bitcoin price: CoinGecko → Binance → CoinCap → CryptoCompare
- ETH gas: on-chain RPC → Etherscan → Blocknative
- DeFi TVL: DeFiLlama (primary, no fallback needed)
- News: CryptoPanic → RSS feeds → CryptoCompare news

Use `src/lib/fallback.ts` if it exists, or create one.

## Verification

1. `npm run typecheck` passes
2. Each adapter handles a 429 response gracefully (doesn't crash)
3. Each adapter returns typed data (no `any`)
4. Cache keys are unique per source + params
5. Health endpoint reports status of all sources
