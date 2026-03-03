# Prompt 019 — dYdX v4 Source (Orderbook DEX)

## Preamble — Read Every Time

You are an expert TypeScript engineer building **cryptocurrency.cv**. Stack: **Hono + TypeScript + Node.js**, Google Cloud Run, Redis caching, Zod validation.

### Absolute Rules

1. **Never mock, stub, or fake anything.** 2. **TypeScript strict mode.** 3. **Always kill terminals.** 4. **Commit and push as `nirholas`.** 5. **If close to hallucinating — tell the prompter.** 6. **Run `npx tsc --noEmit` and `npx vitest run`.**

---

## Task

Build `src/sources/dydx.ts` — a comprehensive dYdX v4 (Cosmos-based) adapter for their decentralized perpetual exchange data.

### API Base URLs

```
https://indexer.dydx.trade/v4          # dYdX v4 Indexer (public, no key)
wss://indexer.dydx.trade/v4/ws         # WebSocket streams
```

**Critical**: dYdX v4 migrated from Ethereum L2 to a Cosmos appchain. The Indexer REST API is the primary data source. All perpetual markets use USDC as settlement. The "v4" prefix is required in all URL paths.

### Zod Schemas

```typescript
const DydxMarket = z.object({
  clobPairId: z.string(),
  ticker: z.string(),              // "BTC-USD", "ETH-USD"
  status: z.enum(['ACTIVE', 'PAUSED', 'CANCEL_ONLY', 'POST_ONLY', 'INITIALIZING', 'FINAL_SETTLEMENT']),
  oraclePrice: z.string(),        // decimal string
  priceChange24H: z.string(),
  volume24H: z.string(),
  trades24H: z.number(),
  nextFundingRate: z.string(),
  initialMarginFraction: z.string(),
  maintenanceMarginFraction: z.string(),
  openInterest: z.string(),
  atomicResolution: z.number(),
  quantumConversionExponent: z.number(),
  tickSize: z.string(),
  stepSize: z.string(),
  stepBaseQuantums: z.number(),
  subticksPerTick: z.number(),
})

const DydxOrderbookLevel = z.object({
  price: z.string(),
  size: z.string(),
})

const DydxOrderbook = z.object({
  bids: z.array(DydxOrderbookLevel),
  asks: z.array(DydxOrderbookLevel),
})

const DydxCandle = z.object({
  startedAt: z.string(),
  ticker: z.string(),
  resolution: z.string(),
  low: z.string(),
  high: z.string(),
  open: z.string(),
  close: z.string(),
  baseTokenVolume: z.string(),
  usdVolume: z.string(),
  trades: z.number(),
  startingOpenInterest: z.string(),
})

const DydxTrade = z.object({
  id: z.string(),
  side: z.enum(['BUY', 'SELL']),
  size: z.string(),
  price: z.string(),
  type: z.enum(['LIMIT', 'LIQUIDATED', 'DELEVERAGED']),
  createdAt: z.string(),
  createdAtHeight: z.string(),
})

const DydxFundingRate = z.object({
  ticker: z.string(),
  rate: z.string(),
  price: z.string(),
  effectiveAt: z.string(),
  effectiveAtHeight: z.string(),
})

const DydxPosition = z.object({
  market: z.string(),
  status: z.enum(['OPEN', 'CLOSED', 'LIQUIDATED']),
  side: z.enum(['LONG', 'SHORT']),
  size: z.string(),
  maxSize: z.string(),
  entryPrice: z.string(),
  exitPrice: z.string().nullable(),
  realizedPnl: z.string(),
  unrealizedPnl: z.string(),
  createdAt: z.string(),
  closedAt: z.string().nullable(),
  sumOpen: z.string(),
  sumClose: z.string(),
  netFunding: z.string(),
})

const DydxSubaccount = z.object({
  address: z.string(),
  subaccountNumber: z.number(),
  equity: z.string(),
  freeCollateral: z.string(),
  openPerpetualPositions: z.record(z.string(), DydxPosition),
  assetPositions: z.record(z.string(), z.object({
    symbol: z.string(),
    side: z.enum(['LONG', 'SHORT']),
    size: z.string(),
    assetId: z.string(),
  })),
  marginEnabled: z.boolean(),
})

const DydxHistoricalBlockTradingReward = z.object({
  tradingReward: z.string(),
  createdAt: z.string(),
  createdAtHeight: z.string(),
})

const DydxSparkline = z.record(z.string(), z.array(z.string()))
// Maps ticker → array of prices (one per hour for 7 days)
```

### Exported Functions

| Function | Endpoint | Cache TTL |
|----------|----------|-----------|
| `getMarkets()` | `GET /perpetualMarkets` | 30s |
| `getMarket(ticker)` | `GET /perpetualMarkets?ticker={ticker}` | 15s |
| `getOrderbook(ticker)` | `GET /orderbooks/perpetualMarket/{ticker}` | 5s |
| `getTrades(ticker, limit?)` | `GET /trades/perpetualMarket/{ticker}` | 10s |
| `getCandles(ticker, resolution, from?, to?, limit?)` | `GET /candles/perpetualMarket/{ticker}` | 30s |
| `getHistoricalFunding(ticker, limit?)` | `GET /historicalFunding/{ticker}` | 60s |
| `getSparklines(period?)` | `GET /sparklines?timePeriod={period}` | 300s |
| `getSubaccount(address, subaccountNumber)` | `GET /addresses/{address}/subaccountNumber/{n}` | 15s |
| `getSubaccountOrders(address, subaccountNumber, status?)` | `GET /orders?address={addr}&subaccountNumber={n}` | 10s |
| `getSubaccountFills(address, subaccountNumber, market?, limit?)` | `GET /fills?address={addr}&subaccountNumber={n}` | 15s |
| `getSubaccountTransfers(address, subaccountNumber, limit?)` | `GET /transfers?address={addr}&subaccountNumber={n}` | 30s |
| `getSubaccountHistoricalPnl(address, subaccountNumber, limit?)` | `GET /historical-pnl?address={addr}&subaccountNumber={n}` | 60s |
| `getTradingRewards(address, limit?)` | `GET /historicalBlockTradingRewards/{address}` | 120s |

### Candle Resolutions

```typescript
type DydxResolution = '1MIN' | '5MINS' | '15MINS' | '30MINS' | '1HOUR' | '4HOURS' | '1DAY'
```

### Analytics: Market Overview

```typescript
export function buildDydxMarketOverview(markets: DydxMarket[]): {
  totalMarkets: number;
  totalOpenInterest: number;        // USD
  totalVolume24h: number;           // USD
  topByVolume: { ticker: string; volume: number }[];
  topByOI: { ticker: string; openInterest: number }[];
  avgFundingRate: number;
  mostBullishFunding: { ticker: string; rate: number };
  mostBearishFunding: { ticker: string; rate: number };
  marketsInPostOnly: string[];
  marketsInCancelOnly: string[];
}
```

### Analytics: Orderbook Depth

```typescript
export function analyzeDydxOrderbook(orderbook: DydxOrderbook, oraclePrice: number): {
  bidDepthUsd: number;
  askDepthUsd: number;
  spread: number;
  spreadBps: number;
  midPrice: number;
  imbalanceRatio: number;     // positive = more bids
  bidWalls: { price: number; size: number }[];
  askWalls: { price: number; size: number }[];
  depth2Percent: { bids: number; asks: number };
  depth5Percent: { bids: number; asks: number };
}
```

### Analytics: Funding Rate Analytics

```typescript
export function analyzeFundingRates(rates: DydxFundingRate[]): {
  currentRate: number;
  annualizedRate: number;         // rate * 8760 (hourly funding)
  avgRate8h: number;
  avgRate24h: number;
  avgRate7d: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  isExtreme: boolean;             // > |0.1%| per hour
  predictedNextRate: number;      // simple linear regression
  cumulativePnlPerUnit: number;   // sum of all rates in window
}
```

### Analytics: Position Risk

```typescript
export function analyzePositionRisk(position: DydxPosition, market: DydxMarket): {
  leverage: number;
  marginUsed: number;
  liquidationPrice: number;
  distanceToLiquidation: number;
  distanceToLiquidationPercent: number;
  unrealizedPnlPercent: number;
  realizedPnlPercent: number;
  breakEvenPrice: number;
  netFundingPaid: number;
  effectiveEntryPrice: number;    // adjusted for funding
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}
```

### WebSocket Subscription Messages

```typescript
// Subscribe to trades
{ type: 'subscribe', channel: 'v4_trades', id: 'BTC-USD' }

// Subscribe to orderbook
{ type: 'subscribe', channel: 'v4_orderbook', id: 'BTC-USD', batched: true }

// Subscribe to candles
{ type: 'subscribe', channel: 'v4_candles', id: 'BTC-USD/1HOUR' }

// Subscribe to markets (all market updates)
{ type: 'subscribe', channel: 'v4_markets' }

// Subscribe to subaccount
{ type: 'subscribe', channel: 'v4_subaccounts', id: '{address}/{subaccountNumber}' }
```

### Important dYdX v4 Gotchas

1. **String decimals** — All price/size fields are strings. Parse with `parseFloat()`.
2. **Hourly funding** — dYdX v4 has hourly funding payments, not 8-hour.
3. **Cosmos addresses** — Start with `dydx1...` not `0x...`.
4. **Subaccount model** — Each address can have multiple subaccounts (0-127).
5. **CLOB Pair IDs** — Markets identified by both ticker ("BTC-USD") and numeric clobPairId.
6. **Pagination** — Uses `createdBeforeOrAt` cursor for pagination, not page numbers.
7. **Rate limits** — The public indexer is permissive but implement exponential backoff.
8. **Market status** — Only trade markets in `ACTIVE` status. Other statuses restrict operations.

### Acceptance Criteria

- [ ] File compiles with zero errors
- [ ] All market, orderbook, candle, trade, funding endpoints work
- [ ] Subaccount queries return positions, orders, fills, transfers, PnL
- [ ] Analytics functions compute leverage, liquidation prices, funding stats
- [ ] WebSocket message types are properly typed
- [ ] String-to-number parsing is consistent and safe
- [ ] Routes in `src/routes/derivatives.ts` can import and use these functions
- [ ] Committed and pushed as `nirholas`, terminals killed

### Hallucination Warning

dYdX v4 runs on Cosmos, NOT Ethereum L2 anymore. The Indexer API path starts with `/v4/`, not `/v3/`. Funding is **hourly**, not 8-hourly. If you are unsure about v4-specific endpoint paths, tell the prompter rather than guessing v3 paths.
