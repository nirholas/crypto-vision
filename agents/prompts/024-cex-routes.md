# Prompt 024 — CEX Routes (Centralized Exchange Data)

## Preamble — Read Every Time

You are an expert TypeScript engineer building **cryptocurrency.cv**. Stack: **Hono + TypeScript + Node.js**, Google Cloud Run, Redis caching, Zod validation.

### Absolute Rules

1. **Never mock, stub, or fake anything.** 2. **TypeScript strict mode** — no `any`. 3. **Always kill terminals** after every command. 4. **Commit and push as `nirholas`.** 5. **If close to hallucinating — tell the prompter.** 6. **Run `npx tsc --noEmit` and `npx vitest run`.** 7. **Improve any existing code you touch.**

---

## Task

Build / improve `src/routes/cex.ts` — centralized exchange data aggregation from Binance, ByBit, OKX, and CoinGecko exchange APIs.

### Source Imports

```typescript
import { Hono } from 'hono';
import * as binance from '../sources/binance.js';
import * as bybit from '../sources/bybit.js';
import * as okx from '../sources/okx.js';
import * as cg from '../sources/coingecko.js';
import { ApiError } from '../lib/api-error.js';

export const cexRoutes = new Hono();
```

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/exchanges` | Exchange rankings by volume/trust |
| GET | `/exchange/:id` | Exchange detail (volume, pairs, trust score) |
| GET | `/tickers/:exchange` | All live tickers for an exchange |
| GET | `/ticker/:exchange/:symbol` | Specific pair ticker |
| GET | `/orderbook/:exchange/:symbol` | Order book snapshot |
| GET | `/trades/:exchange/:symbol` | Recent trades |
| GET | `/klines/:exchange/:symbol` | Candlestick data |
| GET | `/funding-rates` | Funding rates across all CEXs |
| GET | `/open-interest` | Open interest across all CEXs |
| GET | `/price-comparison` | Same pair price across exchanges (arb finder) |
| GET | `/volume-comparison` | Volume comparison across exchanges |
| GET | `/exchange-flows` | Deposit/withdrawal flow estimates |
| GET | `/market-depth/:symbol` | Aggregated orderbook depth across CEXs |
| GET | `/spreads` | Bid-ask spreads comparison |
| GET | `/liquidations` | Recent liquidation events |

### Multi-Exchange Dispatcher

```typescript
type SupportedExchange = 'binance' | 'bybit' | 'okx';

function getExchangeSource(exchange: SupportedExchange) {
  switch (exchange) {
    case 'binance': return binance;
    case 'bybit': return bybit;
    case 'okx': return okx;
    default: throw new ApiError(400, `Unsupported exchange: ${exchange}`);
  }
}
```

### Cross-Exchange Price Comparison

```typescript
cexRoutes.get('/price-comparison', async (c) => {
  const symbol = c.req.query('symbol'); // e.g., "BTC"
  if (!symbol) throw new ApiError(400, 'symbol required');
  
  const [binancePrice, bybitPrice, okxPrice] = await Promise.allSettled([
    binance.getTicker(`${symbol}USDT`),
    bybit.getTicker('spot', `${symbol}USDT`),
    okx.getTicker(`${symbol}-USDT`),
  ]);
  
  const prices = [
    binancePrice.status === 'fulfilled' ? { exchange: 'binance', price: binancePrice.value.lastPrice } : null,
    bybitPrice.status === 'fulfilled' ? { exchange: 'bybit', price: bybitPrice.value.lastPrice } : null,
    okxPrice.status === 'fulfilled' ? { exchange: 'okx', price: okxPrice.value.last } : null,
  ].filter(Boolean);
  
  const avg = prices.reduce((sum, p) => sum + Number(p!.price), 0) / prices.length;
  const spread = Math.max(...prices.map(p => Number(p!.price))) - Math.min(...prices.map(p => Number(p!.price)));
  const spreadBps = (spread / avg) * 10000;
  
  return c.json({
    data: {
      symbol,
      prices,
      averagePrice: avg,
      spread,
      spreadBps,
      arbitrageOpportunity: spreadBps > 10,
    },
    timestamp: new Date().toISOString(),
  });
});
```

### Aggregated Funding Rates

```typescript
cexRoutes.get('/funding-rates', async (c) => {
  const symbol = c.req.query('symbol'); // optional filter
  
  const [binanceFunding, bybitFunding, okxFunding] = await Promise.allSettled([
    binance.getFundingRates(symbol ? `${symbol}USDT` : undefined),
    bybit.getFundingRates('linear', symbol ? `${symbol}USDT` : undefined),
    okx.getFundingRates(symbol ? `${symbol}-USDT-SWAP` : undefined),
  ]);
  
  // Merge, normalize symbol format, sort by absolute rate
  // Include annualized rate calculation: rate * 3 * 365
});
```

### Symbol Normalization

Different exchanges use different formats:
```typescript
function normalizeSymbol(exchange: SupportedExchange, base: string, quote: string = 'USDT'): string {
  switch (exchange) {
    case 'binance': return `${base}${quote}`;       // BTCUSDT
    case 'bybit': return `${base}${quote}`;          // BTCUSDT
    case 'okx': return `${base}-${quote}`;            // BTC-USDT
  }
}

function normalizeSwapSymbol(exchange: SupportedExchange, base: string): string {
  switch (exchange) {
    case 'binance': return `${base}USDT`;              // BTCUSDT (futures)
    case 'bybit': return `${base}USDT`;                // BTCUSDT (linear)
    case 'okx': return `${base}-USDT-SWAP`;            // BTC-USDT-SWAP
  }
}
```

### Cache Strategy

```typescript
// Real-time data (tickers, orderbook, trades): 5-10s
c.header('Cache-Control', 'public, max-age=5, s-maxage=10');

// Aggregate data (funding rates, OI, rankings): 30-60s
c.header('Cache-Control', 'public, max-age=15, s-maxage=30');

// Historical data (klines): 5 min
c.header('Cache-Control', 'public, max-age=60, s-maxage=300');
```

### Acceptance Criteria

- [ ] All 15 endpoints compile and return JSON
- [ ] Multi-exchange dispatch works for binance/bybit/okx
- [ ] Symbol normalization is correct per exchange
- [ ] Price comparison calculates arbitrage spreads
- [ ] Funding rate aggregation normalizes across exchanges
- [ ] `Promise.allSettled` handles partial failures
- [ ] Error handling on invalid exchange or symbol
- [ ] Tests pass, committed and pushed as `nirholas`, terminals killed

### Hallucination Warning

Binance uses `BTCUSDT` format, ByBit uses `BTCUSDT` for spot/linear and `BTCUSD` for inverse, OKX uses `BTC-USDT` for spot and `BTC-USDT-SWAP` for perpetuals. Binance futures funding is every 8 hours; ByBit linear is every 8 hours; OKX is every 8 hours. If unsure about specific exchange API differences, tell the prompter.
