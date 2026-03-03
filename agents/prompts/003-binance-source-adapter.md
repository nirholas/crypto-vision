# Prompt 003 — Binance Source Adapter (CEX Market Data)

## Preamble — Read Every Time

You are an expert TypeScript engineer building **cryptocurrency.cv**, the most comprehensive crypto/DeFi API infrastructure. Stack: **Hono + TypeScript + Node.js**, Google Cloud Run, Redis caching, Zod validation.

### Absolute Rules

1. **Never mock, stub, or fake anything.** Real implementations only.
2. **TypeScript strict mode** — no `any`, no `@ts-ignore`.
3. **Every async call** needs try/catch, every response needs validation.
4. **Always kill terminals** after commands complete.
5. **Always commit and push** as `nirholas`.
6. **If close to hallucinating** — stop and tell the prompter.
7. **Always improve existing code** you touch.
8. **Run `npx tsc --noEmit` and `npx vitest run`** after changes.

### Conventions

- `@/` alias → `src/`, `.js` extensions, named exports, Zod schemas
- `fetchJSON` from `@/lib/fetcher.js`, `cache.wrap()` for all fetches
- `log` from `@/lib/logger.js` for structured logging

---

## Task

Build the **complete Binance source adapter** at `src/sources/binance.ts`. Binance is the world's largest crypto exchange and provides extensive public APIs with no auth required for market data.

### API Base URLs

```
https://api.binance.com/api/v3         # Spot market
https://fapi.binance.com/fapi/v1       # USD-M Futures
https://dapi.binance.com/dapi/v1       # COIN-M Futures
https://api.binance.com/sapi/v1        # Additional endpoints
```

### Requirements

#### 1. Base Client

```typescript
function binanceFetch<T>(base: string, path: string, params?: Record<string, string>, ttl?: number): Promise<T>
```

- No auth for public market data endpoints
- Rate limit: 1200 weight/min (track via `X-MBX-USED-WEIGHT-1M` header)
- Handle IP bans gracefully (418/429 status codes)

#### 2. Zod Schemas

- `Ticker24h` — symbol, priceChange, priceChangePercent, weightedAvgPrice, prevClosePrice, lastPrice, volume, quoteVolume, openTime, closeTime, highPrice, lowPrice, count
- `OrderBookDepth` — bids, asks array of [price, qty]
- `KlineData` — [openTime, open, high, low, close, volume, closeTime, quoteAssetVolume, trades, ...]
- `ExchangeInfo` — symbols array with filters, status, permissions
- `AggTrade` — aggregated trade data
- `FundingRate` — symbol, fundingRate, fundingTime, markPrice
- `OpenInterest` — symbol, openInterest, time
- `LongShortRatio` — symbol, longShortRatio, longAccount, shortAccount

#### 3. Exported Functions

**Spot Market:**

| Function | Endpoint | Cache TTL |
|----------|----------|-----------|
| `getTicker24h(symbol?)` | `/ticker/24hr` | 15s |
| `getTickerPrice(symbol?)` | `/ticker/price` | 10s |
| `getOrderBook(symbol, limit?)` | `/depth` | 5s |
| `getKlines(symbol, interval, limit?)` | `/klines` | 30s |
| `getAggTrades(symbol, limit?)` | `/aggTrades` | 10s |
| `getExchangeInfo()` | `/exchangeInfo` | 3600s |
| `getAvgPrice(symbol)` | `/avgPrice` | 15s |
| `get24hStats()` | `/ticker/24hr` (all) | 30s |

**Futures:**

| Function | Endpoint | Cache TTL |
|----------|----------|-----------|
| `getFundingRates(symbol?)` | `/fapi/v1/fundingRate` | 60s |
| `getOpenInterest(symbol)` | `/fapi/v1/openInterest` | 30s |
| `getFuturesKlines(symbol, interval)` | `/fapi/v1/klines` | 30s |
| `getLongShortRatio(symbol, period)` | `/futures/data/globalLongShortAccountRatio` | 60s |
| `getTopTraderLongShort(symbol, period)` | `/futures/data/topLongShortPositionRatio` | 60s |
| `getLiquidations(symbol?, limit?)` | `/fapi/v1/allForceOrders` | 15s |

**Analytics:**

| Function | Endpoint | Cache TTL |
|----------|----------|-----------|
| `getTopVolumePairs(limit)` | Sort from `/ticker/24hr` | 30s |
| `getTopGainers(limit)` | Sort from `/ticker/24hr` | 30s |
| `getTopLosers(limit)` | Sort from `/ticker/24hr` | 30s |
| `getVolumeProfile(symbol)` | Aggregate from klines | 120s |

#### 4. Data Transformation Helpers

```typescript
export function binanceSymbolToStandard(symbol: string): { base: string; quote: string }
export function standardToBinanceSymbol(base: string, quote: string): string
export function formatKlinesToOHLCV(klines: KlineData[]): { time: number; open: number; high: number; low: number; close: number; volume: number }[]
export function calculateVWAP(trades: AggTrade[]): number
export function aggregateFundingHistory(rates: FundingRate[]): { symbol: string; avgRate: number; totalPayments: number }
export function calculateAnnualizedFunding(rate: number): number
```

#### 5. Weight Tracking

```typescript
export function getUsedWeight(): number        // Current weight used this minute
export function getRemainingWeight(): number   // Weight remaining
export function isNearRateLimit(): boolean     // true if > 80% used
```

Log warnings when weight exceeds 80% of limit.

#### 6. Symbol Filtering

- Filter out leveraged tokens (symbols containing "UP", "DOWN", "BULL", "BEAR")
- Filter out illiquid pairs (volume < threshold)
- Provide `getActiveSymbols()` returning only TRADING status pairs

### Acceptance Criteria

- [ ] File compiles with zero errors
- [ ] All spot + futures + analytics functions implemented
- [ ] Zod schemas validate all Binance response shapes
- [ ] Weight tracking prevents hitting rate limits
- [ ] Symbol normalization handles all edge cases
- [ ] Kline data properly formatted for charting
- [ ] Funding rate calculations are mathematically correct
- [ ] `src/routes/cex.ts` imports work correctly
- [ ] All tests pass, committed and pushed as `nirholas`
- [ ] All terminals killed

### Hallucination Warning

Binance API has many subtle differences between spot and futures endpoints. The kline array format is particularly tricky — it's an array of arrays, not objects. The funding rate formula for annualization is `rate * 3 * 365` (8-hour intervals). If unsure about any endpoint schema, check https://binance-docs.github.io/apidocs/ or tell the prompter.
