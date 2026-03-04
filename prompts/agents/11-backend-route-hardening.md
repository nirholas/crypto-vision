# Prompt 11 — Backend API: Fix & Harden All Route Handlers

## Context

You are working on the main API server in `src/routes/` of the crypto-vision monorepo. It's a Hono-based REST API running on port 8080 with 39 route modules and 200+ endpoints.

The API uses:
- Hono v4.7 (HTTP framework)
- Zod for validation (`src/lib/validation.ts`, `src/lib/route-schemas.ts`)
- Custom error handling (`src/lib/api-error.ts` — `AppError` class)
- Response envelope (`src/lib/response-envelope.ts`)
- Rate limiting (`src/lib/rate-limit.ts`)
- Caching (`src/lib/cache.ts` — two-tier LRU + Redis)
- Multi-source fetcher (`src/lib/fetcher.ts` — circuit breaker, retries)
- Auth (`src/lib/auth.ts` — API key validation)

## Task

### 1. Audit Every Route Module

Go through each of the 39 route files in `src/routes/` and ensure:

**Error Handling:**
- Every async handler has try/catch
- Errors thrown as `AppError` with proper HTTP status codes
- Upstream API failures return 502 with descriptive message
- Validation failures return 400 with field-level errors
- Rate limit errors return 429 with `Retry-After` header

**Input Validation:**
- All query parameters validated with Zod schemas
- All path parameters validated (`:id` must be non-empty string, numeric where expected)
- Pagination validated: `page >= 1`, `limit` between 1 and 100
- Sort fields validated against allowlist
- No SQL injection vectors (all params sanitized)

**Response Consistency:**
- All responses use `response-envelope.ts` format: `{ success: true, data: ..., meta: { ... } }`
- Error responses: `{ success: false, error: { code, message, details? } }`
- Pagination in meta: `{ page, limit, total, totalPages }`
- Cache headers: `Cache-Control`, `ETag` where appropriate

**Caching:**
- Appropriate TTLs per endpoint type:
  - Prices/market data: 30-60s
  - News: 300s
  - Static data (about, docs): 3600s
  - User-specific (portfolio): no cache
- Using the two-tier cache (LRU + Redis)

### 2. Fix Known Route Issues

**High Priority (broken or incomplete):**
- `ecosystem.ts` — Returns empty arrays for all endpoints, needs real implementation or proper "coming soon" response
- `crypto-vision.ts` — Bot-related endpoints, verify they connect to bot services
- `export.ts` — Verify export pipeline works end-to-end
- `ws.ts` — WebSocket route, verify connection lifecycle and heartbeat

**Medium Priority:**
- `news-aggregator.ts` — RSS feed parsing, verify error handling on feed failures
- `oracles.ts` — Oracle price feeds, verify data freshness
- `perps.ts` — Cross-exchange perpetuals, verify all exchange adapters work
- `derivatives.ts` — Deribit/CoinGlass integration, verify API connectivity

**Low Priority (polish):**
- Add `X-Request-Id` header to all responses for tracing
- Add response time logging (already in metrics middleware?)
- Ensure consistent date formats (ISO 8601 UTC everywhere)

### 3. Add Missing Rate Limit Headers

Every response should include:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1709550000
```

### 4. Add Health Check Improvements

`GET /health` should return:
```json
{
  "status": "healthy",
  "version": "0.1.0",
  "uptime": 3600,
  "checks": {
    "redis": { "status": "up", "latency": 2 },
    "postgres": { "status": "up", "latency": 5 },
    "coingecko": { "status": "up", "quota": "80/100" }
  }
}
```

### 5. Add OpenAPI Annotations

Add JSDoc comments to each route handler following the OpenAPI pattern for future swagger generation. Don't add a swagger dependency — just the comments.

## Files to Audit/Fix

All 39 files in `src/routes/`:
`agents.ts`, `aggregate.ts`, `ai.ts`, `analytics.ts`, `anomaly.ts`, `bitcoin.ts`, `calendar.ts`, `cex.ts`, `crypto-vision.ts`, `defi.ts`, `depin.ts`, `derivatives.ts`, `dex.ts`, `ecosystem.ts`, `etf.ts`, `exchanges.ts`, `export.ts`, `gas.ts`, `governance.ts`, `keys.ts`, `l2.ts`, `macro.ts`, `market.ts`, `news.ts`, `news-aggregator.ts`, `nft.ts`, `onchain.ts`, `oracles.ts`, `perps.ts`, `portfolio.ts`, `research.ts`, `search.ts`, `security.ts`, `social.ts`, `solana.ts`, `staking.ts`, `unlocks.ts`, `whales.ts`, `ws.ts`

## Verification

1. `npm run typecheck` passes
2. `npm test` passes (existing tests don't break)
3. `GET /health` returns proper status
4. All endpoints return consistent response envelope format
5. Rate limit headers present on all responses
