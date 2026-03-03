# Prompt 032 — Whale & Social Routes (Whale Watching + Social Signals)

## Preamble — Read Every Time

You are an expert TypeScript engineer building **cryptocurrency.cv**. Stack: **Hono + TypeScript + Node.js**, Google Cloud Run, Redis caching, Zod validation.

### Absolute Rules

1. **Never mock, stub, or fake anything.** 2. **TypeScript strict mode** — no `any`. 3. **Always kill terminals** after every command. 4. **Commit and push as `nirholas`.** 5. **If close to hallucinating — tell the prompter.** 6. **Run `npx tsc --noEmit` and `npx vitest run`.** 7. **Improve any existing code you touch.**

---

## Task

Build / improve `src/routes/whales.ts` and `src/routes/social.ts` — whale transaction monitoring and social media signal aggregation.

### Source Imports

```typescript
// whales.ts
import { Hono } from 'hono';
import * as whaleSource from '../sources/whales.js';
import { ApiError } from '../lib/api-error.js';
export const whaleRoutes = new Hono();

// social.ts
import { Hono } from 'hono';
import * as cryptocompare from '../sources/cryptocompare.js';
import { ApiError } from '../lib/api-error.js';
export const socialRoutes = new Hono();
```

### Whale Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/transactions` | Recent whale transactions (>$100K) |
| GET | `/transactions/:symbol` | Whale txs for specific token |
| GET | `/alerts` | Generated whale alerts |
| GET | `/smart-money` | Smart money movement tracker |
| GET | `/smart-money/:token` | Smart money trades for token |
| GET | `/exchange-flows` | Exchange deposit/withdrawal flows |
| GET | `/exchange-flows/:symbol` | Token exchange flows |
| GET | `/wallets/top/:chain` | Top wallets by holdings |
| GET | `/wallets/:address` | Wallet profile & activity |
| GET | `/wallets/:address/track` | Track a wallet (add to watchlist) |
| GET | `/accumulation/:symbol` | Accumulation/distribution signal |
| GET | `/dormant` | Recently active dormant wallets |

### Social Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/stats/:symbol` | Social stats for a coin |
| GET | `/trending` | Trending coins on social media |
| GET | `/volume/:symbol` | Social volume (mention count) over time |
| GET | `/sentiment/:symbol` | Social sentiment analysis |
| GET | `/influencers/:symbol` | Top social influencers for a coin |
| GET | `/reddit/:symbol` | Reddit activity metrics |
| GET | `/github/:symbol` | GitHub development activity |
| GET | `/correlation` | Social vs price correlation analysis |

### Whale Transaction Feed

```typescript
whaleRoutes.get('/transactions', async (c) => {
  const minUsd = Number(c.req.query('min_usd') || 100000);
  const chain = c.req.query('chain');
  const type = c.req.query('type');  // exchange_deposit, exchange_withdrawal, whale_transfer
  const limit = Math.min(Number(c.req.query('limit') || 25), 100);
  
  let txs = await whaleSource.getRecentWhaleTransactions({ minUsd });
  
  if (chain) txs = txs.filter(tx => tx.blockchain === chain);
  if (type) txs = txs.filter(tx => tx.transactionType === type);
  
  // Classify activity
  const classification = whaleSource.classifyWhaleActivity(txs);
  
  return c.json({
    data: {
      transactions: txs.slice(0, limit),
      classification: {
        overallSignal: classification.overallSignal,
        signalStrength: classification.signalStrength,
        exchangeDeposits: classification.exchangeDeposits,
        exchangeWithdrawals: classification.exchangeWithdrawals,
      },
    },
    timestamp: new Date().toISOString(),
  });
});
```

### Smart Money Consensus

```typescript
whaleRoutes.get('/smart-money', async (c) => {
  const limit = Math.min(Number(c.req.query('limit') || 20), 50);
  
  const trades = await whaleSource.getSmartMoneyTrades(undefined, 200);
  const analysis = whaleSource.analyzeSmartMoney(trades);
  
  return c.json({
    data: {
      consensusBuys: analysis.consensusBuys.slice(0, limit),
      consensusSells: analysis.consensusSells.slice(0, limit),
      newPositions: analysis.newPositions.slice(0, 10),
      exitingPositions: analysis.exitingPositions.slice(0, 10),
      topPerformingWallets: analysis.topPerformingWallets.slice(0, 10),
      defiTrends: analysis.defiTrends.slice(0, 10),
    },
    timestamp: new Date().toISOString(),
  });
});
```

### Social Signal Analysis

```typescript
socialRoutes.get('/correlation', async (c) => {
  const symbol = c.req.query('symbol');
  if (!symbol) throw new ApiError(400, 'symbol required');
  const days = Math.min(Number(c.req.query('days') || 30), 90);
  
  // Fetch social volume and price data for the period
  const [socialData, priceData] = await Promise.allSettled([
    cryptocompare.getSocialStats(symbol),
    cg.getChart(symbol, days),
  ]);
  
  // Calculate Pearson correlation between social volume and price
  // Detect if social activity leads or lags price movements
  
  return c.json({
    data: {
      symbol,
      period: `${days}d`,
      socialPriceCorrelation: pearsonR,
      socialLeadsPrice: socialLeadsPrice, // boolean
      leadTimeHours: leadTime,
      interpretation: pearsonR > 0.7 ? 'strong_positive' : pearsonR > 0.3 ? 'moderate_positive' : pearsonR < -0.3 ? 'negative' : 'weak',
    },
    timestamp: new Date().toISOString(),
  });
});
```

### Acceptance Criteria

- [ ] All 20 endpoints compile and return JSON
- [ ] Whale transaction feed filters by chain/type/amount
- [ ] Smart money consensus identifies agreement across wallets
- [ ] Social stats pull from CryptoCompare social data
- [ ] Social-price correlation computed correctly
- [ ] Accumulation/distribution signal derived from exchange flows
- [ ] Tests pass, committed and pushed as `nirholas`, terminals killed

### Hallucination Warning

Whale Alert API has a 5-minute delay on free tier. CryptoCompare social stats come from `/data/social/coin/latest` and include Reddit, Twitter, and code repository data. The structure includes `CryptoCompare`, `Twitter`, `Reddit`, `CodeRepository` sub-objects. If unsure about specific field names, tell the prompter.
