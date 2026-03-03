# Prompt 016 — ByBit Source Adapter (CEX + Derivatives)

## Preamble — Read Every Time

You are an expert TypeScript engineer building **cryptocurrency.cv**. Stack: **Hono + TypeScript + Node.js**, Google Cloud Run, Redis caching, Zod validation.

### Absolute Rules

1. **Never mock, stub, or fake anything.** Real implementations only.
2. **TypeScript strict mode** — no `any`, no `@ts-ignore`.
3. **Always kill terminals**, **commit and push as `nirholas`**.
4. **If close to hallucinating** — stop and tell the prompter.
5. **Run `npx tsc --noEmit` and `npx vitest run`** after changes.

---

## Task

Build `src/sources/bybit.ts` — adapter for ByBit, a major CEX with spot, derivatives, and copy-trading. v5 unified API.

### API Base URL

```
https://api.bybit.com/v5      # v5 unified API
# No auth for public market data
# Rate limit: 120 req/min for public endpoints
```

### Requirements

#### 1. Base Client

```typescript
function bybitFetch<T>(category: string, path: string, params?: Record<string, string>, ttl?: number): Promise<T>
// Response: { retCode: 0, retMsg: "OK", result: { list: [...] }, time: ... }
// Unwrap result, throw on retCode !== 0
```

#### 2. Zod Schemas

- `BybitTicker` — symbol, lastPrice, highPrice24h, lowPrice24h, turnover24h, volume24h, bid1Price, ask1Price, prevPrice24h, price24hPcnt, markPrice, indexPrice, openInterestValue, fundingRate, nextFundingTime
- `BybitKline` — startTime, openPrice, highPrice, lowPrice, closePrice, volume, turnover
- `BybitOrderBook` — s (symbol), b (bids), a (asks), ts, u (update_id)
- `BybitInstrumentInfo` — symbol, contractType, status, baseCoin, quoteCoin, settleCoin, lotSizeFilter, priceFilter, leverageFilter, fundingInterval
- `BybitOpenInterest` — symbol, openInterest, timestamp
- `BybitInsurance` — coin, balance, value
- `BybitRiskLimit` — id, symbol, limit, maintainMargin, initialMargin, maxLeverage
- `BybitLongShortRatio` — buyRatio, sellRatio, timestamp

#### 3. Exported Functions

**Spot & Market:**

| Function | Endpoint | Cache TTL |
|----------|----------|-----------|
| `getTickers(category, symbol?)` | `/market/tickers` | 15s |
| `getKlines(category, symbol, interval, limit?)` | `/market/kline` | 30s |
| `getOrderBook(category, symbol, limit?)` | `/market/orderbook` | 5s |
| `getRecentTrades(category, symbol, limit?)` | `/market/recent-trade` | 10s |
| `getInstrumentsInfo(category, symbol?)` | `/market/instruments-info` | 600s |
| `getMarkPriceKline(category, symbol, interval)` | `/market/mark-price-kline` | 30s |
| `getIndexPriceKline(category, symbol, interval)` | `/market/index-price-kline` | 30s |

**Derivatives:**

| Function | Endpoint | Cache TTL |
|----------|----------|-----------|
| `getOpenInterest(category, symbol, interval)` | `/market/open-interest` | 30s |
| `getHistoricalVolatility(category, period?)` | `/market/historical-volatility` | 120s |
| `getInsurance(coin?)` | `/market/insurance` | 300s |
| `getRiskLimit(category, symbol?)` | `/market/risk-limit` | 600s |
| `getFundingRateHistory(category, symbol, limit?)` | `/market/funding/history` | 60s |
| `getLongShortRatio(category, symbol, period)` | `/market/account-ratio` | 60s |

**Analytics:**

```typescript
export function getTopMoversBybit(limit: number): Promise<{ gainers: BybitTicker[]; losers: BybitTicker[] }>
export function getHighestFundingRates(tickers: BybitTicker[]): BybitTicker[]
export function calculateSpotFuturesBasis(spotTicker: BybitTicker, futuresTicker: BybitTicker): { basis: number; annualized: number }
export function aggregateOI(tickers: BybitTicker[]): { totalOI: number; topByOI: { symbol: string; oi: number }[] }
```

### Acceptance Criteria

- [ ] File compiles with zero errors
- [ ] ByBit v5 response wrapper properly handled (retCode check)
- [ ] All spot + derivatives functions work with `category` parameter
- [ ] Kline/OHLCV data properly formatted
- [ ] Funding rate history aggregation correct
- [ ] `src/routes/cex.ts` imports work
- [ ] All tests pass, committed and pushed as `nirholas`, terminals killed

### Hallucination Warning

ByBit v5 uses a `category` param (linear, inverse, option, spot) for all endpoints. The kline response has string values for prices. Response wrapper is `{ retCode: 0, result: { list: [] } }` — result.list is the array. If unsure, tell the prompter.
