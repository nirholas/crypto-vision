# Prompt 025 — Derivatives & Perps Routes

## Preamble — Read Every Time

You are an expert TypeScript engineer building **cryptocurrency.cv**. Stack: **Hono + TypeScript + Node.js**, Google Cloud Run, Redis caching, Zod validation.

### Absolute Rules

1. **Never mock, stub, or fake anything.** 2. **TypeScript strict mode** — no `any`. 3. **Always kill terminals** after every command. 4. **Commit and push as `nirholas`.** 5. **If close to hallucinating — tell the prompter.** 6. **Run `npx tsc --noEmit` and `npx vitest run`.** 7. **Improve any existing code you touch.**

---

## Task

Build / improve `src/routes/derivatives.ts` and `src/routes/perps.ts` — comprehensive derivatives, perpetual futures, and options data routes.

### Source Imports

```typescript
import { Hono } from 'hono';
import * as coinglass from '../sources/coinglass.js';
import * as deribit from '../sources/deribit.js';
import * as dydx from '../sources/dydx.js';
import * as binance from '../sources/binance.js';
import * as hyperliquid from '../sources/hyperliquid.js';
import { ApiError } from '../lib/api-error.js';

export const derivativesRoutes = new Hono();
export const perpsRoutes = new Hono();
```

### Derivatives Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/open-interest` | Aggregated open interest across exchanges |
| GET | `/open-interest/:symbol` | OI breakdown by exchange for a symbol |
| GET | `/open-interest/history/:symbol` | Historical OI chart |
| GET | `/funding-rates` | Current funding rates across exchanges |
| GET | `/funding-rates/:symbol` | Funding rate history for symbol |
| GET | `/funding-heatmap` | Funding rate heatmap (all symbols × exchanges) |
| GET | `/liquidations` | Real-time liquidation feed |
| GET | `/liquidations/:symbol` | Liquidation history for symbol |
| GET | `/liquidation-heatmap` | Liquidation heatmap by price level |
| GET | `/long-short-ratio` | Long/short ratio across exchanges |
| GET | `/options/overview` | Options market overview |
| GET | `/options/chain/:symbol` | Options chain (calls + puts by strike/expiry) |
| GET | `/options/oi` | Options open interest by strike/expiry |
| GET | `/options/max-pain/:symbol` | Max pain calculation |
| GET | `/options/volatility/:symbol` | Implied and historical volatility |
| GET | `/options/greeks/:symbol` | Greeks surface |
| GET | `/etf/flows` | BTC/ETH ETF flow data |
| GET | `/etf/holdings` | ETF AUM and holdings |

### Perps Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/markets` | All perpetual markets across DEXs |
| GET | `/market/:protocol/:id` | Specific perp market |
| GET | `/orderbook/:protocol/:id` | Perp orderbook (dYdX, Hyperliquid) |
| GET | `/trades/:protocol/:id` | Recent perp trades |
| GET | `/funding/:protocol` | Funding rates for a DEX |
| GET | `/leaderboard/:protocol` | Top traders leaderboard |
| GET | `/volume-comparison` | DEX perps volume comparison |
| GET | `/oi-comparison` | DEX perps OI comparison |

### Aggregated Open Interest

```typescript
derivativesRoutes.get('/open-interest', async (c) => {
  const [coinglassOI, dydxMarkets, hlMarkets] = await Promise.allSettled([
    coinglass.getOpenInterest(),
    dydx.getMarkets(),
    hyperliquid.getExchangeInfo(),
  ]);
  
  // Merge OI data from all sources, normalize by symbol
  // Return total OI per symbol across all venues
  // Sort by total OI descending
  
  return c.json({
    data: {
      totalOpenInterest: totalOI,
      symbols: mergedSymbols,
      byExchange: exchangeBreakdown,
    },
    timestamp: new Date().toISOString(),
  });
});
```

### Funding Rate Heatmap

```typescript
derivativesRoutes.get('/funding-heatmap', async (c) => {
  // Fetch funding rates from binance, bybit, okx, dydx, hyperliquid
  // Build a matrix: symbols (rows) × exchanges (columns) × funding rate (value)
  
  return c.json({
    data: {
      symbols: ['BTC', 'ETH', 'SOL', ...],
      exchanges: ['binance', 'bybit', 'okx', 'dydx', 'hyperliquid'],
      rates: {
        BTC: { binance: 0.0001, bybit: 0.00012, okx: 0.0001, dydx: 0.00015, hyperliquid: 0.0002 },
        // ...
      },
      annualized: { ... },  // rates * 3 * 365 (for 8-hour funding) or * 8760 (hourly)
    },
    timestamp: new Date().toISOString(),
  });
});
```

### Options Max Pain Calculation

```typescript
derivativesRoutes.get('/options/max-pain/:symbol', async (c) => {
  const { symbol } = c.req.param();
  const expiry = c.req.query('expiry');
  
  // Fetch option chain from Deribit
  const instruments = await deribit.getInstruments(`${symbol.toUpperCase()}-USD`, 'option');
  
  // For each strike price, calculate total pain:
  // pain(strike) = sum(call_oi * max(0, strike - call_strike)) + sum(put_oi * max(0, put_strike - strike))
  // Max pain = strike with minimum total pain
  
  return c.json({
    data: {
      symbol,
      expiry,
      maxPainStrike: maxPainPrice,
      currentPrice: spotPrice,
      distancePercent: ((spotPrice - maxPainPrice) / spotPrice) * 100,
      painByStrike: painLevels,
    },
    timestamp: new Date().toISOString(),
  });
});
```

### Liquidation Map

```typescript
derivativesRoutes.get('/liquidation-heatmap', async (c) => {
  const symbol = c.req.query('symbol') || 'BTC';
  
  // Fetch liquidation data from CoinGlass
  // Build a price-level heatmap showing estimated liquidation clusters
  // Key insight: Show where leveraged positions would be liquidated
  
  return c.json({
    data: {
      symbol,
      currentPrice: price,
      longLiquidations: [  // price levels where longs get liquidated (below current price)
        { price: 59000, estimatedUsd: 150_000_000 },
        // ...
      ],
      shortLiquidations: [ // price levels where shorts get liquidated (above current price)
        { price: 67000, estimatedUsd: 200_000_000 },
        // ...
      ],
      total24hLiquidations: total,
      longTotal: longSum,
      shortTotal: shortSum,
    },
    timestamp: new Date().toISOString(),
  });
});
```

### DEX Perps Volume Comparison

```typescript
perpsRoutes.get('/volume-comparison', async (c) => {
  const [dydxData, hlData] = await Promise.allSettled([
    dydx.getMarkets(),
    hyperliquid.getExchangeInfo(),
  ]);
  
  // Compare 24h volume, OI, unique traders, number of markets
  return c.json({
    data: [
      { protocol: 'dydx', volume24h, openInterest, markets, topPairs },
      { protocol: 'hyperliquid', volume24h, openInterest, markets, topPairs },
    ],
    timestamp: new Date().toISOString(),
  });
});
```

### Acceptance Criteria

- [ ] All 26+ endpoints compile and return JSON
- [ ] Multi-source OI aggregation works across CEXs and DEXs
- [ ] Funding heatmap covers 5+ exchanges
- [ ] Options chain, max pain, and volatility surface work via Deribit
- [ ] Liquidation heatmap builds price-level clusters
- [ ] DEX perps routes support dYdX and Hyperliquid
- [ ] Annualized funding correctly handles 8h vs 1h funding periods
- [ ] Tests pass, committed and pushed as `nirholas`, terminals killed

### Hallucination Warning

CoinGlass API response format varies by endpoint. Open interest endpoints return data keyed by exchange. Deribit instruments for options use naming like `BTC-28MAR25-100000-C`. dYdX v4 has hourly funding (multiply by 8760 for annual), while CEXs have 8-hour funding (multiply by 1095). If unsure about CoinGlass or Deribit specifics, tell the prompter.
