# Prompt 010 — CoinGlass Source Adapter (Derivatives Analytics)

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

---

## Task

Build the **complete CoinGlass source adapter** at `src/sources/coinglass.ts`. CoinGlass is THE source for crypto derivatives data — open interest, liquidations, funding rates, long/short ratios, exchange flows.

### API Base URL

```
https://open-api-v3.coinglass.com/api    # v3 API
# Auth: coinglassSecret header
# Env: COINGLASS_API_KEY
```

### Requirements

#### 1. Base Client

```typescript
function cgFetch<T>(path: string, params?: Record<string, string>, ttl?: number): Promise<T>
// Auth: header `coinglassSecret: ${COINGLASS_API_KEY}`
// Response wrapper: { code: "0", msg: "success", data: T } — unwrap data field
// Error: code !== "0" means error, throw with msg
```

#### 2. Zod Schemas

- `OpenInterest` — symbol, openInterest, openInterestAmount, h1Change, h4Change, h24Change, exchanges[]
- `OIByExchange` — exchangeName, openInterest, openInterestAmount, change
- `LiquidationData` — symbol, longLiquidationUsd, shortLiquidationUsd, totalLiquidationUsd, h1, h4, h12, h24
- `LiquidationMap` — price levels with aggregated liquidation amounts (heatmap data)
- `FundingRate` — symbol, exchanges[] { exchangeName, rate, nextFundingTime, predictedRate }
- `LongShortRatio` — symbol, longRate, shortRate, longAccount, shortAccount, exchanges[]
- `ExchangeFlow` — exchange, inflow, outflow, netflow, symbol
- `OIHistorical` — array of { timestamp, openInterest, price }
- `GrayscaleHolding` — fund, symbol, shares, price, totalValue, premium, change
- `ETFFlow` — fund, ticker, inflow, outflow, netFlow, totalAssets, price
- `OptionData` — symbol, callOI, putOI, callVolume, putVolume, pcRatio, maxPain, expiry
- `FearGreedDerivatives` — value, classification, timestamp

#### 3. Exported Functions

**Open Interest:**

| Function | Endpoint | Cache TTL |
|----------|----------|-----------|
| `getOpenInterest(symbol?)` | `/futures/openInterest` | 30s |
| `getOIByExchange(symbol)` | `/futures/openInterest/chart` | 60s |
| `getOIHistory(symbol, interval)` | `/futures/openInterest/ohlc-history` | 120s |
| `getOIAggregated()` | `/futures/openInterest/aggregated-ohlc` | 60s |
| `getTopOIChanges(period)` | Sort from `/futures/openInterest` | 60s |

**Liquidations:**

| Function | Endpoint | Cache TTL |
|----------|----------|-----------|
| `getLiquidations(symbol?)` | `/futures/liquidation/info` | 15s |
| `getLiquidationHistory(symbol, interval)` | `/futures/liquidation/chart` | 60s |
| `getLiquidationMap(symbol)` | `/futures/liquidation_map` | 30s |
| `getRecentLiquidations(limit?)` | `/futures/liquidation/order` | 10s |
| `getLargestLiquidations(period)` | Sort from recent | 60s |

**Funding Rates:**

| Function | Endpoint | Cache TTL |
|----------|----------|-----------|
| `getFundingRates(symbol?)` | `/futures/funding/current` | 30s |
| `getFundingHistory(symbol, interval)` | `/futures/funding/ohlc-history` | 120s |
| `getAverageFunding(symbol, period)` | `/futures/funding/avg` | 120s |
| `getFundingArbitrageOpps()` | Derived: compare across exchanges | 60s |

**Long/Short Ratios:**

| Function | Endpoint | Cache TTL |
|----------|----------|-----------|
| `getLongShortRatio(symbol)` | `/futures/longShort/chart` | 60s |
| `getTopTraderSentiment(symbol)` | `/futures/topLongShortAccount/chart` | 60s |
| `getGlobalLongShort()` | `/futures/longShort` | 60s |

**Exchange Flows:**

| Function | Endpoint | Cache TTL |
|----------|----------|-----------|
| `getExchangeFlows(symbol)` | `/futures/exchange/flow` | 120s |
| `getFlowHistory(symbol, interval)` | `/futures/exchange/flow/chart` | 120s |
| `getExchangeBalances(symbols?)` | `/futures/exchange/balance` | 120s |

**Options:**

| Function | Endpoint | Cache TTL |
|----------|----------|-----------|
| `getOptionsData(symbol?)` | `/option/info` | 60s |
| `getOptionsOI(symbol)` | `/option/openInterest` | 60s |
| `getOptionsVolume(symbol)` | `/option/volume` | 60s |
| `getMaxPain(symbol)` | `/option/maxpain` | 120s |

**ETF & Grayscale:**

| Function | Endpoint | Cache TTL |
|----------|----------|-----------|
| `getBitcoinETFFlows()` | `/etf/bitcoin` | 300s |
| `getEthereumETFFlows()` | `/etf/ethereum` | 300s |
| `getGrayscaleHoldings()` | `/grayscale` | 300s |

#### 4. Analytics Functions

```typescript
export function calculateFundingAPR(rate: number, periodsPerDay: number): number
export function detectLiquidationCascadeRisk(oi: OpenInterest, liqMap: LiquidationMap): {
  riskLevel: 'low' | 'medium' | 'high' | 'extreme';
  nearestLiquidationCluster: { price: number; amountUsd: number };
  cascadeThreshold: number;
}
export function calculatePutCallSentiment(options: OptionData): {
  sentiment: 'bullish' | 'bearish' | 'neutral';
  pcRatio: number;
  maxPain: number;
  impliedMove: number;
}
export function identifyFundingArbitrage(rates: FundingRate[]): {
  symbol: string;
  longExchange: string;
  shortExchange: string;
  spread: number;
  annualizedReturn: number;
}[]
export function aggregateDerivativeSentiment(
  funding: FundingRate[],
  longShort: LongShortRatio[],
  oi: OpenInterest[],
  liq: LiquidationData[]
): {
  overallSentiment: 'bullish' | 'bearish' | 'neutral';
  confidence: number;
  signals: { name: string; direction: string; strength: number }[];
}
export function calculateETFImpact(flows: ETFFlow[]): {
  totalNetFlow: number;
  trend: 'inflow' | 'outflow' | 'balanced';
  biggestFund: string;
  weeklyAvg: number;
}
```

### Acceptance Criteria

- [ ] File compiles with zero errors
- [ ] All OI, liquidation, funding, L/S ratio, options, ETF functions implemented
- [ ] CoinGlass response wrapper properly unwrapped
- [ ] Funding APR calculations correct for different payment intervals
- [ ] Liquidation cascade detection identifies real risk levels
- [ ] Exchange flow analysis tracks net direction
- [ ] `src/routes/derivatives.ts` imports work
- [ ] All tests pass, committed and pushed as `nirholas`
- [ ] All terminals killed

### Hallucination Warning

CoinGlass v3 API wraps all responses in `{ code, msg, data }`. The `code` field is a STRING "0" for success, not a number. Funding rates are expressed as decimals (0.0001 = 0.01%). OI changes are in percentage points. If unsure about any endpoint or response shape, check https://coinglass.com/api or tell the prompter.
