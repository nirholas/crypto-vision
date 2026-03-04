# CoinGecko Rate Limiting Implementation

## Problem

The application was experiencing rate limit errors (HTTP 429) from the CoinGecko API. The free tier allows only 30 calls/min, but the app was making concurrent requests without respecting these limits, leading to `Rate limited by CoinGecko API` errors.

## Solution

Implemented a comprehensive **client-side rate limiting system** with three main components:

### 1. Token Bucket Algorithm (`src/lib/coingecko-rate-limit.ts`)

**Key Features:**
- **Token Bucket**: Smooth token distribution (1 token = 1 request)
- **Free tier**: 30 tokens/minute (0.5 tokens/second)
- **Pro tier**: 500 tokens/minute (with `COINGECKO_API_KEY` env var)
- **Request Queuing**: Automatic queueing when tokens unavailable
- **Adaptive Rate Learning**: Monitors `Retry-After` and rate limit headers from CoinGecko
- **Metrics Tracking**: Exposes stats via health endpoint

**Exports:**
- `waitForCoinGeckoToken()` - Acquires token with automatic queuing
- `updateRateLimitInfo(headers)` - Updates rate limit knowledge from responses
- `recordCoinGeckoSuccess/Failure()` - Tracks request outcomes
- `getCoinGeckoRateLimitStats()` - Returns current metrics
- `resetCoinGeckoRateLimit()` - Resets state (testing)

### 2. Integration with CoinGecko Source (`src/sources/coingecko.ts`)

**Changes:**
- Added `await waitForCoinGeckoToken()` before each API request
- Requests now go through rate limiter transparently
- Updated import to include rate limiter module
- No breaking changes to public API

**Cache TTL Improvements:**
- Market data: 60s → 180s (3 min)
- Coin details: 120s → 600s (10 min)
- Simple prices: 30s → 60s (1 min)
- Trending: 300s → 600s (10 min)
- Global stats: 120s → 600s (10 min)
- Market chart: 300s → 1800s (30 min) - *immutable historical data*
- **OHLC candles: 300s → 3600s (1 hour)** - *immutable historical data*
- Exchanges: 300s → 1800s (30 min)

### 3. Fetcher Integration (`src/lib/fetcher.ts`)

**Changes:**
- Added 429 status handling to notify rate limiter
- Records rate limit headers when received
- Includes `updateRateLimitInfo()` callbacks
- Supports both success and failure notifications
- Soft error handling (silently skips if rate limiter unavailable)

### 4. Health Endpoint Enhancement (`src/index.ts`)

**New Metrics:**
- `coingeckoRateLimit` object in `/health` response includes:
  - `isPro` - Whether using pro tier
  - `capacity` - Current rate limit capacity (30 or 500)
  - `currentTokens` - Available tokens right now
  - `successCount` - Successful requests
  - `failureCount` - Failed/retried requests
  - `queueLength` - Pending requests waiting for tokens
  - `observedLimit` - Last reported limit from API

## Behavior

### Normal Operation

1. **Request arrives** → Rate limiter checks token availability
2. **Token available** → Request proceeds immediately (100ms min delay between requests)
3. **No tokens** → Request queued automatically
4. **Token refills** → Queued request processes
5. **Response received** → Rate limiter updated with response headers

### Rate Limiting Trigger

When CoinGecko sends `Retry-After` or rate limit headers:
1. Rate limiter reduces available tokens
2. Fetcher retries with exponential backoff
3. Queued requests respect the new limit
4. Recovery automatic as tokens refill

## Testing the Fix

### Check Rate Limit Status
```bash
curl http://localhost:8080/health | jq .coingeckoRateLimit
```

Expected output:
```json
{
  "isPro": false,
  "capacity": 30,
  "currentTokens": "29.50",
  "successCount": 5,
  "failureCount": 0,
  "queueLength": 0,
  "observedLimit": null
}
```

### Simulate High Load
The rate limiter will queue requests and process them at 30 req/min:
```bash
for i in {1..60}; do
  curl -s http://localhost:8080/api/v1/ohlc/bitcoin?days=7 &
done
```

All 60 requests will eventually succeed (may take 2+ minutes for free tier).

## Configuration

### Use Pro Tier
Set environment variable:
```bash
export COINGECKO_API_KEY=your-pro-api-key
export COINGECKO_PRO=true
```

This enables 500 calls/min rate limit automatically.

## Performance Impact

- ✅ **Eliminates 429 errors** - Respects upstream limits
- ✅ **Reduced retries** - Proactive queuing prevents wasted requests
- ✅ **Better cache hits** - Longer TTLs reduce API load
- ✅ **Graceful degradation** - Requests queue instead of failing
- ✅ **Minimal latency addition** - 100ms typical request spacing
- ⚠️ **Throughput trade-off** - Limited to 30-500 req/min depending on tier

## Files Changed

1. **New**: `src/lib/coingecko-rate-limit.ts` - Core rate limiter (165 lines)
2. **Updated**: `src/sources/coingecko.ts` - Integrated rate limiter into `cg()` function
3. **Updated**: `src/lib/fetcher.ts` - Added rate limit header notifications
4. **Updated**: `src/index.ts` - Added `coingeckoRateLimit` to health endpoint

## Future Improvements

1. **Distributed Rate Limiting** - Use Redis for multi-instance rate limiting
2. **Adaptive Throttling** - Dynamically adjust based on observed 429s
3. **Batch Requests** - Combine multiple coin requests into single paginated call
4. **Circuit Breaker** - Fail fast if repeatedly rate limited
5. **Per-Endpoint Limits** - Different limits for different endpoints
