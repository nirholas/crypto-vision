# Prompt 015 — Deribit Source Adapter (Options & Volatility)

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

Build `src/sources/deribit.ts` — adapter for Deribit, the largest crypto options exchange. Provides options chains, implied volatility, Greeks, and volatility surface data. No auth needed for public market data.

### API Base URL

```
https://www.deribit.com/api/v2/public     # Public API
# No auth for market data
# Rate limit: 20 req/sec non-matching engine
```

### Requirements

#### 1. Zod Schemas

- `DeribitInstrument` — instrument_name, kind (future/option), base_currency, quote_currency, settlement_currency, min_trade_amount, tick_size, maker_commission, taker_commission, expiration_timestamp, strike, option_type (call/put), creation_timestamp, is_active, settlement_period
- `DeribitTicker` — instrument_name, best_bid_price, best_ask_price, last_price, mark_price, index_price, mark_iv, underlying_price, underlying_index, open_interest, volume_usd, volume_notional, estimated_delivery_price, greeks { delta, gamma, vega, theta, rho }, stats { high, low, volume, volume_usd, price_change }
- `DeribitOrderBook` — instrument_name, bids[][], asks[][], state, timestamp, stats
- `DeribitVolatilityIndex` — data: [timestamp, open, high, low, close][]
- `DeribitTradeHistory` — trades: { trade_id, instrument_name, direction, price, amount, timestamp, iv }[]
- `DeribitDeliveryPrice` — data: { date, delivery_price }[]

#### 2. Exported Functions

**Instruments:**

| Function | Endpoint | Cache TTL |
|----------|----------|-----------|
| `getInstruments(currency, kind?, expired?)` | `/get_instruments` | 300s |
| `getOptionInstruments(currency)` | Filter from instruments | 300s |
| `getFutureInstruments(currency)` | Filter from instruments | 300s |
| `getActiveExpiries(currency)` | Derive from instruments | 300s |

**Tickers & Prices:**

| Function | Endpoint | Cache TTL |
|----------|----------|-----------|
| `getTicker(instrument)` | `/ticker` | 10s |
| `getBatchTickers(instruments[])` | Multiple `/ticker` calls | 10s |
| `getIndexPrice(currency)` | `/get_index_price` | 10s |
| `getOrderBook(instrument, depth?)` | `/get_order_book` | 5s |
| `getTradeHistory(instrument, count?)` | `/get_last_trades_by_instrument` | 15s |

**Options Analytics:**

| Function | Endpoint | Cache TTL |
|----------|----------|-----------|
| `getOptionsChain(currency, expiry)` | Filter instruments + batch tickers | 30s |
| `getVolatilityIndex(currency, resolution?)` | `/get_volatility_index_data` | 60s |
| `getHistoricalVolatility(currency, period?)` | `/get_historical_volatility` | 300s |
| `getDeliveryPrices(currency, count?)` | `/get_delivery_prices` | 600s |

**Futures:**

| Function | Endpoint | Cache TTL |
|----------|----------|-----------|
| `getFundingRate(instrument)` | `/get_funding_rate_value` | 30s |
| `getFundingRateHistory(instrument, start, end)` | `/get_funding_rate_history` | 600s |

#### 3. Options Analytics Engine

```typescript
export function buildOptionsChain(instruments: DeribitInstrument[], tickers: DeribitTicker[]): {
  expiry: string;
  daysToExpiry: number;
  strikes: {
    strike: number;
    call: { bid: number; ask: number; iv: number; delta: number; gamma: number; theta: number; vega: number; oi: number; volume: number } | null;
    put: { bid: number; ask: number; iv: number; delta: number; gamma: number; theta: number; vega: number; oi: number; volume: number } | null;
  }[];
}[]

export function calculateMaxPain(chain: OptionsChain): { strike: number; totalPain: number }
export function calculatePutCallRatio(chain: OptionsChain): { oiRatio: number; volumeRatio: number }
export function buildVolatilitySurface(chains: OptionsChain[]): { strike: number; expiry: number; iv: number }[]
export function findVolatilitySmile(chain: OptionsChain): { strike: number; iv: number; delta: number }[]
export function calculateImpliedMove(atm_iv: number, daysToExpiry: number): number
export function identifyUnusualActivity(tickers: DeribitTicker[]): { instrument: string; signal: string; volume: number; oi: number; ratio: number }[]

export function blackScholesPrice(S: number, K: number, T: number, r: number, sigma: number, type: 'call' | 'put'): number
export function impliedVolatility(price: number, S: number, K: number, T: number, r: number, type: 'call' | 'put'): number
```

#### 4. Term Structure

```typescript
export function buildTermStructure(currency: string, futureInstruments: DeribitInstrument[], tickers: DeribitTicker[]): {
  expiry: string;
  daysToExpiry: number;
  price: number;
  basis: number;         // futures premium over spot
  basisAnnualized: number;
  openInterest: number;
}[]

export function isInContango(termStructure: TermStructureEntry[]): boolean
export function isInBackwardation(termStructure: TermStructureEntry[]): boolean
export function calculateCarryTrade(near: TermStructureEntry, far: TermStructureEntry): {
  spread: number;
  annualizedReturn: number;
  daysHeld: number;
}
```

### Acceptance Criteria

- [ ] File compiles with zero errors
- [ ] Options chain builder properly pairs calls/puts by strike/expiry
- [ ] Volatility surface construction works across multiple expiries
- [ ] Greeks from Deribit properly parsed and exposed
- [ ] Max pain calculation is correct
- [ ] Black-Scholes implementation matches industry standard
- [ ] Term structure identifies contango/backwardation
- [ ] `src/routes/derivatives.ts` imports work
- [ ] All tests pass, committed and pushed as `nirholas`, terminals killed

### Hallucination Warning

Deribit instrument names follow a pattern: `BTC-31MAR26-65000-C` (currency-expiry-strike-type). The API uses `GET` with query params, not path params. Greeks come from the ticker endpoint, not a separate endpoint. IV is expressed as a decimal (0.65 = 65%). If unsure about any formula or endpoint, tell the prompter.
