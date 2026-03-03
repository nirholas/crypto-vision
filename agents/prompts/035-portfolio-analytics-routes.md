# Prompt 035 — Portfolio & Analytics Routes

## Preamble — Read Every Time

You are an expert TypeScript engineer building **cryptocurrency.cv**. Stack: **Hono + TypeScript + Node.js**, Google Cloud Run, Redis caching, Zod validation.

### Absolute Rules

1. **Never mock, stub, or fake anything.** 2. **TypeScript strict mode** — no `any`. 3. **Always kill terminals** after every command. 4. **Commit and push as `nirholas`.** 5. **If close to hallucinating — tell the prompter.** 6. **Run `npx tsc --noEmit` and `npx vitest run`.** 7. **Improve any existing code you touch.**

---

## Task

Build / improve `src/routes/portfolio.ts` and `src/routes/analytics.ts` — portfolio tracking, analytics computations, and market intelligence.

### Source Imports

```typescript
// portfolio.ts
import { Hono } from 'hono';
import * as cg from '../sources/coingecko.js';
import * as evm from '../sources/evm.js';
import { ApiError } from '../lib/api-error.js';
export const portfolioRoutes = new Hono();

// analytics.ts
import { Hono } from 'hono';
import * as cg from '../sources/coingecko.js';
import * as llama from '../sources/defillama.js';
import * as alt from '../sources/alternative.js';
import { ApiError } from '../lib/api-error.js';
export const analyticsRoutes = new Hono();
```

### Portfolio Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/calculate` | Calculate portfolio value and metrics |
| POST | `/analyze` | Deep portfolio analysis |
| POST | `/optimize` | Portfolio optimization suggestions |
| POST | `/risk` | Portfolio risk assessment |
| POST | `/correlation` | Asset correlation matrix |
| POST | `/backtest` | Historical portfolio backtest |
| GET | `/wallet/:address` | Auto-detect portfolio from wallet |

### Analytics Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/market-regime` | Current market regime classification |
| GET | `/sector-performance` | Sector/category performance |
| GET | `/correlation-matrix` | Top coin correlation matrix |
| GET | `/volatility-ranking` | Coins ranked by volatility |
| GET | `/momentum-scanner` | Momentum signal scanner |
| GET | `/value-metrics` | Value metrics (NVT, MVRV, etc.) |
| GET | `/seasonality/:id` | Monthly/daily seasonality patterns |
| GET | `/sharpe-ranking` | Coins ranked by Sharpe ratio |
| GET | `/drawdown-analysis` | Max drawdown analysis |
| GET | `/altcoin-season` | Altcoin season index |
| GET | `/market-breadth` | Market breadth indicators |
| GET | `/heat-map` | Performance heat map by timeframe |

### Portfolio Calculation

```typescript
portfolioRoutes.post('/calculate', async (c) => {
  const body = z.object({
    holdings: z.array(z.object({
      coinId: z.string(),
      amount: z.number().positive(),
      costBasis: z.number().optional(),     // USD per unit purchase price
    })).min(1).max(100),
  }).parse(await c.req.json());
  
  const coinIds = body.holdings.map(h => h.coinId).join(',');
  const prices = await cg.getSimplePrice(coinIds, 'usd', { 
    include_24hr_change: true,
    include_7d_change: true,
    include_market_cap: true,
  });
  
  const positions = body.holdings.map(holding => {
    const price = prices[holding.coinId];
    if (!price) return null;
    
    const currentValue = holding.amount * price.usd;
    const costBasisTotal = holding.costBasis ? holding.amount * holding.costBasis : null;
    const pnl = costBasisTotal ? currentValue - costBasisTotal : null;
    const pnlPercent = costBasisTotal ? ((currentValue - costBasisTotal) / costBasisTotal) * 100 : null;
    
    return {
      coinId: holding.coinId,
      amount: holding.amount,
      price: price.usd,
      value: currentValue,
      change24h: price.usd_24h_change,
      marketCap: price.usd_market_cap,
      costBasis: holding.costBasis ?? null,
      costBasisTotal,
      pnl,
      pnlPercent,
    };
  }).filter(Boolean);
  
  const totalValue = positions.reduce((sum, p) => sum + p!.value, 0);
  const totalCostBasis = positions.reduce((sum, p) => sum + (p!.costBasisTotal ?? 0), 0);
  
  return c.json({
    data: {
      totalValue,
      totalCostBasis: totalCostBasis || null,
      totalPnl: totalCostBasis ? totalValue - totalCostBasis : null,
      totalPnlPercent: totalCostBasis ? ((totalValue - totalCostBasis) / totalCostBasis) * 100 : null,
      positions: positions.map(p => ({
        ...p,
        allocation: (p!.value / totalValue) * 100,
      })),
      diversification: computeDiversificationScore(positions),
    },
    timestamp: new Date().toISOString(),
  });
});
```

### Portfolio Risk Assessment

```typescript
portfolioRoutes.post('/risk', async (c) => {
  const body = z.object({
    holdings: z.array(z.object({
      coinId: z.string(),
      allocation: z.number(), // percentage
    })),
  }).parse(await c.req.json());
  
  // Fetch 30-day price history for each asset
  const histories = await Promise.allSettled(
    body.holdings.map(h => cg.getChart(h.coinId, 30))
  );
  
  // Compute:
  // - Portfolio volatility (weighted std dev of daily returns)
  // - Max drawdown
  // - Value at Risk (VaR) at 95% confidence
  // - Sharpe ratio (assuming risk-free rate of 4%)
  // - Concentration risk (Herfindahl index)
  // - Correlation risk
  
  return c.json({
    data: {
      volatility: annualizedVolatility,
      maxDrawdown: maxDD,
      valueAtRisk95: vaR95,
      sharpeRatio: sharpe,
      concentrationRisk: herfindahl > 0.3 ? 'high' : herfindahl > 0.15 ? 'medium' : 'low',
      herfindahlIndex: herfindahl,
      riskLevel: overallRisk,
      recommendations: riskRecommendations,
    },
    timestamp: new Date().toISOString(),
  });
});
```

### Market Regime Classification

```typescript
analyticsRoutes.get('/market-regime', async (c) => {
  const [global, fearGreed, btcChart] = await Promise.allSettled([
    cg.getGlobalData(),
    alt.getFearGreedIndex(),
    cg.getChart('bitcoin', 90),
  ]);
  
  // Classify regime based on:
  // 1. BTC price vs 50/200 SMA (golden cross / death cross)
  // 2. Fear & Greed index
  // 3. Total market cap trend
  // 4. BTC dominance trend
  // 5. Altcoin performance relative to BTC
  
  return c.json({
    data: {
      regime: 'bull_market' | 'bear_market' | 'accumulation' | 'distribution' | 'ranging',
      confidence: 0.85,
      signals: {
        btcTrend: 'above_200sma',
        fearGreed: 'greed',
        marketCapTrend: 'up',
        btcDominance: 'declining',  // alt season signal
        volatility: 'normal',
      },
      recommendation: 'Risk-on environment. Favor altcoin exposure with BTC core.',
    },
    timestamp: new Date().toISOString(),
  });
});
```

### Altcoin Season Index

```typescript
analyticsRoutes.get('/altcoin-season', async (c) => {
  const coins = await cg.getCoins({ perPage: 100 });
  
  // Calculate how many of top 100 coins outperformed BTC over 90 days
  const btc = coins.find(c => c.id === 'bitcoin');
  const btcChange90d = btc?.price_change_percentage_90d ?? 0;
  
  const outperformers = coins.filter(c => 
    c.id !== 'bitcoin' && 
    (c.price_change_percentage_90d ?? 0) > btcChange90d
  );
  
  const altcoinSeasonIndex = (outperformers.length / (coins.length - 1)) * 100;
  
  return c.json({
    data: {
      index: altcoinSeasonIndex,
      season: altcoinSeasonIndex > 75 ? 'altcoin_season' : altcoinSeasonIndex < 25 ? 'bitcoin_season' : 'neutral',
      outperformers: outperformers.length,
      total: coins.length - 1,
      btcChange90d,
      topOutperformers: outperformers
        .sort((a, b) => (b.price_change_percentage_90d ?? 0) - (a.price_change_percentage_90d ?? 0))
        .slice(0, 10)
        .map(c => ({ id: c.id, symbol: c.symbol, change90d: c.price_change_percentage_90d })),
    },
    timestamp: new Date().toISOString(),
  });
});
```

### Acceptance Criteria

- [ ] All 19 endpoints compile and return JSON
- [ ] Portfolio calculation computes PnL, allocation, diversification
- [ ] Risk assessment includes volatility, VaR, max drawdown, Sharpe
- [ ] Market regime classification uses multiple signals
- [ ] Altcoin season index computed from top 100 performance
- [ ] Correlation matrix builds proper N×N matrix
- [ ] POST endpoints validate request bodies with Zod
- [ ] Tests pass, committed and pushed as `nirholas`, terminals killed

### Hallucination Warning

CoinGecko's `getSimplePrice` supports comma-separated IDs. The `include_24hr_change` param returns `usd_24h_change` (not `change_24h`). Market chart data from `/coins/{id}/market_chart` returns `{ prices: [[timestamp, price], ...], market_caps, total_volumes }`. If unsure about CoinGecko response fields, tell the prompter.
