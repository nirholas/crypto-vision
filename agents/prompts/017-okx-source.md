# Prompt 017 — OKX Source Adapter (CEX + DEX Aggregator)

## Preamble — Read Every Time

You are an expert TypeScript engineer building **cryptocurrency.cv**. Stack: **Hono + TypeScript + Node.js**, Google Cloud Run, Redis caching, Zod validation.

### Absolute Rules

1. **Never mock, stub, or fake anything.** 2. **TypeScript strict mode.** 3. **Always kill terminals.** 4. **Commit and push as `nirholas`.** 5. **If close to hallucinating — tell the prompter.** 6. **Run `npx tsc --noEmit` and `npx vitest run`.**

---

## Task

Build `src/sources/okx.ts` — adapter for OKX, a top-3 CEX with comprehensive market data APIs. No auth for public endpoints.

### API Base URL

```
https://www.okx.com/api/v5     # v5 API
# Public endpoints: no auth needed
# Rate limit: 20 req/2s per endpoint
```

### Requirements

#### 1. Response Wrapper

```typescript
// OKX wraps all responses: { code: "0", msg: "", data: [...] }
// code "0" = success, anything else = error
function okxFetch<T>(path: string, params?: Record<string, string>, ttl?: number): Promise<T[]>
```

#### 2. Zod Schemas

- `OkxTicker` — instId, last, lastSz, askPx, askSz, bidPx, bidSz, open24h, high24h, low24h, volCcy24h, vol24h, sodUtc0, sodUtc8, ts
- `OkxCandle` — [ts, o, h, l, c, vol, volCcy, volCcyQuote, confirm]
- `OkxOrderBook` — asks[][], bids[][], ts
- `OkxInstrument` — instType, instId, uly, instFamily, baseCcy, quoteCcy, settleCcy, ctVal, ctMult, ctType, expTime, lever, tickSz, lotSz, minSz, state
- `OkxFundingRate` — instId, fundingRate, nextFundingRate, fundingTime, nextFundingTime
- `OkxOpenInterest` — instId, oi, oiCcy, ts
- `OkxLongShortRatio` — ts, oeRatio
- `OkxTakerVolume` — ts, sellVol, buyVol, ts

#### 3. Exported Functions

**Market Data:**

| Function | Endpoint | Cache TTL |
|----------|----------|-----------|
| `getTickers(instType)` | `/market/tickers` | 15s |
| `getTicker(instId)` | `/market/ticker` | 10s |
| `getCandles(instId, bar?, limit?)` | `/market/candles` | 30s |
| `getHistoryCandles(instId, bar?, after?, before?)` | `/market/history-candles` | 120s |
| `getOrderBook(instId, sz?)` | `/market/books` | 5s |
| `getTrades(instId, limit?)` | `/market/trades` | 10s |
| `getInstruments(instType)` | `/public/instruments` | 600s |

**Derivatives:**

| Function | Endpoint | Cache TTL |
|----------|----------|-----------|
| `getFundingRate(instId)` | `/public/funding-rate` | 30s |
| `getFundingRateHistory(instId, limit?)` | `/public/funding-rate-history` | 120s |
| `getOpenInterest(instType, instId?)` | `/public/open-interest` | 30s |
| `getLiquidations(instType, instId?, state?)` | `/public/liquidation-orders` | 15s |
| `getMarkPrice(instType, instId?)` | `/public/mark-price` | 10s |

**On-Chain & Analytics:**

| Function | Endpoint | Cache TTL |
|----------|----------|-----------|
| `getLongShortRatio(ccy, period?)` | `/rubik/stat/contracts/long-short-account-ratio` | 60s |
| `getTakerVolume(ccy, instType?, period?)` | `/rubik/stat/taker-volume` | 60s |
| `getMarginLendingRatio(ccy, period?)` | `/rubik/stat/margin/loan-ratio` | 120s |

**Analytics Helpers:**

```typescript
export function getTopMoversByOkx(tickers: OkxTicker[], limit: number): { gainers: OkxTicker[]; losers: OkxTicker[] }
export function calculateOkxBasis(spot: OkxTicker, futures: OkxTicker): { basis: number; annualized: number }
export function aggregateTakerSentiment(takerData: OkxTakerVolume[]): { buyPressure: number; trend: string }
```

### Acceptance Criteria

- [ ] File compiles with zero errors
- [ ] OKX response wrapper properly handled
- [ ] All spot, derivatives, and analytics functions work
- [ ] Candle data (string arrays) properly parsed to numbers
- [ ] `src/routes/cex.ts` imports work
- [ ] All tests pass, committed and pushed as `nirholas`, terminals killed

### Hallucination Warning

OKX candle data is an array of string arrays, not objects. All numeric fields (price, volume) are STRINGS. The `instType` values are SPOT, MARGIN, SWAP, FUTURES, OPTION. If unsure, tell the prompter.
