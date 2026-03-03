# Prompt 031 — Analytics Routes (Advanced Market Analytics)

## Preamble

You are an expert TypeScript engineer building **cryptocurrency.cv** — the most comprehensive free crypto API. Stack: **Hono + TypeScript + Node 22**, deployed to Google Cloud Run with Redis caching.

### Absolute Rules

1. **Never mock, stub, or fake anything.** Every function must do real work with real APIs.
2. **TypeScript strict mode** — no `any`, no `@ts-ignore`, no type assertions without justification.
3. **Always use `isBackground: true`** for terminal commands, then **always kill the terminal** after getting output.
4. **Before any git commit**: `git config user.name "nirholas" && git config user.email "nirholas@users.noreply.github.com"`
5. **Always stay on the current branch** — run `git branch --show-current` first and never switch.
6. **Run `npx tsc --noEmit` and `npx vitest run`** before committing. Fix all errors.
7. **Improve any existing code you touch** — Boy Scout Rule.

---

## Context

The project lives at `/workspaces/crypto-vision`. Key paths:
- `src/routes/analytics.ts` — the route file to build/improve (currently 433 lines, 11 endpoints)
- `src/sources/coingecko.ts` — CoinGecko adapter (223 lines, 14 exports)
- `src/sources/defillama.ts` — DeFiLlama adapter (326 lines, 22 exports)
- `src/sources/alternative.ts` — Alternative.me + free APIs (1171 lines, 77 exports)
- `src/sources/cryptocompare.ts` — CryptoCompare adapter (211 lines, 14 exports)
- `src/sources/messari.ts` — Messari adapter (171 lines, 6 exports)
- `src/lib/api-error.ts` — Error factory (240 lines)
- `src/lib/validation.ts` — Zod validation helpers (275 lines)
- `src/lib/cache.ts` — Two-tier caching (235 lines)
- `src/lib/fetcher.ts` — HTTP client with retries + circuit breaker (214 lines)

---

## Task

Build comprehensive analytics routes in `src/routes/analytics.ts`. These are computed endpoints that aggregate data from multiple sources, perform calculations, and return derived insights that no single upstream API provides.

### Architecture

```typescript
import { Hono } from "hono";
import { z } from "zod";
import * as cg from "../sources/coingecko.js";
import * as llama from "../sources/defillama.js";
import * as alt from "../sources/alternative.js";
import * as cc from "../sources/cryptocompare.js";
import { cache } from "../lib/cache.js";
import { ApiError } from "../lib/api-error.js";
import { logger } from "../lib/logger.js";

export const analyticsRoutes = new Hono();
```

### Endpoints to Implement

Every endpoint must have Zod validation, error handling, caching, and structured logging.

#### 1. GET `/correlation`

Calculate price correlation matrix between multiple assets.

```typescript
const CorrelationSchema = z.object({
  ids: z.string().min(1, "ids required — comma-separated coin IDs"),
  days: z.coerce.number().int().min(7).max(365).default(30),
  vs_currency: z.string().default("usd"),
});
```

Implementation:
- Fetch historical price data for each coin from CoinGecko `getMarketChart(id, days)`
- Align timestamps across all assets (use nearest-neighbor matching for misaligned data points)
- Calculate Pearson correlation coefficient for each pair:
  ```
  r = Σ((xi - x̄)(yi - ȳ)) / √(Σ(xi - x̄)² × Σ(yi - ȳ)²)
  ```
- Return NxN correlation matrix with coin IDs as labels
- Cache for 1 hour (correlations don't change rapidly)
- Limit to max 10 coins per request (combinatorial explosion)

Response shape:
```typescript
{
  data: {
    coins: string[],
    matrix: number[][],  // NxN correlation coefficients (-1 to 1)
    period: { days: number, from: string, to: string },
    strongest_positive: { pair: [string, string], correlation: number },
    strongest_negative: { pair: [string, string], correlation: number },
  },
  meta: { cached: boolean, computedAt: string }
}
```

#### 2. GET `/volatility`

Calculate rolling volatility for assets.

```typescript
const VolatilitySchema = z.object({
  ids: z.string().min(1, "ids required"),
  days: z.coerce.number().int().min(7).max(365).default(30),
  window: z.coerce.number().int().min(5).max(60).default(14),
});
```

Implementation:
- Fetch daily price data from CoinGecko
- Calculate rolling standard deviation of daily returns: `return_i = ln(price_i / price_{i-1})`
- Annualize: `volatility = daily_std × √365`
- Return time series of rolling volatility per asset
- Compare to BTC volatility as benchmark
- Cache 30 minutes

Response:
```typescript
{
  data: {
    assets: Array<{
      id: string,
      name: string,
      current_volatility: number,    // annualized %
      avg_volatility: number,
      max_volatility: number,
      min_volatility: number,
      volatility_vs_btc: number,     // ratio
      series: Array<{ timestamp: number, volatility: number }>,
    }>,
    window_days: number,
    period_days: number,
  }
}
```

#### 3. GET `/sharpe-ratio`

Risk-adjusted return analysis.

```typescript
const SharpeSchema = z.object({
  ids: z.string().min(1),
  days: z.coerce.number().int().min(30).max(365).default(90),
  risk_free_rate: z.coerce.number().min(0).max(0.2).default(0.05),
});
```

Implementation:
- Fetch price history for each coin
- Calculate daily returns
- Sharpe = (mean_daily_return - risk_free_daily) / std_daily_return × √365
- Also calculate Sortino ratio (only downside deviation):
  ```
  sortino = (mean_return - risk_free) / downside_deviation
  ```
- Rank assets by Sharpe ratio
- Cache 1 hour

#### 4. GET `/market-regime`

Detect current market regime (bull/bear/sideways).

Implementation:
- Fetch BTC price data (90 days) + Fear & Greed Index + global market data
- Calculate:
  - 50-day SMA vs 200-day SMA crossover signal
  - RSI (14-day) for overbought/oversold
  - Fear & Greed classification
  - Volume trend (increasing/decreasing)
  - Market cap dominance shifts
- Classify regime: "strong_bull", "bull", "neutral", "bear", "strong_bear"
- Provide confidence score (0-100) based on signal agreement
- Cache 15 minutes

#### 5. GET `/sector-performance`

Performance breakdown by crypto sector/category.

```typescript
const SectorSchema = z.object({
  period: z.enum(["1h", "24h", "7d", "30d", "90d", "1y"]).default("24h"),
  limit: z.coerce.number().int().min(5).max(50).default(20),
});
```

Implementation:
- Fetch CoinGecko categories with market data
- For each category: calculate weighted average performance (by market cap)
- Sort by performance
- Include: total market cap, volume, number of coins, top 3 coins per sector
- Cache 10 minutes

#### 6. GET `/whale-impact`

Analyze how large holder movements affect price.

Implementation:
- Fetch whale transaction data from `src/sources/whales.ts`
- Fetch price data from CoinGecko for the same timeframe
- Correlate large transactions with subsequent price movements
- Calculate: avg price impact after whale buy/sell, time to impact, magnitude
- Cache 30 minutes

#### 7. GET `/defi-yield-risk`

Risk-adjusted yield analysis for DeFi protocols.

```typescript
const YieldRiskSchema = z.object({
  min_tvl: z.coerce.number().default(1_000_000),
  min_apy: z.coerce.number().default(1),
  max_apy: z.coerce.number().default(1000),
  chains: z.string().optional(),
  stablecoins_only: z.coerce.boolean().default(false),
});
```

Implementation:
- Fetch yield pools from DeFiLlama
- Fetch TVL history for each pool (to calculate stability)
- Calculate risk score based on:
  - TVL stability (standard deviation of daily TVL changes)
  - APY sustainability (how stable is APY over time)
  - Protocol age and audit status
  - Chain security tier (Ethereum > L2s > alt L1s > new chains)
  - IL risk (volatile pairs vs stablecoin pairs)
- Return risk-adjusted yield: `adjusted_yield = apy × (1 - risk_score)`
- Sort by risk-adjusted yield
- Cache 30 minutes

#### 8. GET `/divergence`

Detect price divergences between correlated assets.

```typescript
const DivergenceSchema = z.object({
  base: z.string().min(1),
  quote: z.string().min(1),
  days: z.coerce.number().int().min(7).max(180).default(30),
  threshold: z.coerce.number().min(0.01).max(0.5).default(0.1),
});
```

Implementation:
- Fetch price history for both assets
- Calculate rolling ratio (base/quote price)
- Calculate z-score of current ratio vs historical mean
- Flag divergences where |z-score| > threshold × σ
- Provide mean-reversion signal: "BUY base / SELL quote" or vice versa
- Include historical divergence events and their resolution
- Cache 15 minutes

#### 9. GET `/momentum`

Multi-factor momentum scoring.

```typescript
const MomentumSchema = z.object({
  ids: z.string().optional(),
  limit: z.coerce.number().int().min(10).max(100).default(50),
  min_market_cap: z.coerce.number().default(10_000_000),
});
```

Implementation:
- Fetch top coins from CoinGecko (with price change data)
- For each coin calculate momentum score (0-100) based on:
  - Price change: 1h (5%), 24h (15%), 7d (25%), 30d (30%), 90d (25%)
  - Volume surge: current vs 7d avg volume ratio
  - Social mention trend (if available from CryptoCompare)
  - RSI position (not too overbought)
- Rank by composite momentum score
- Cache 10 minutes

#### 10. GET `/drawdown`

Maximum drawdown analysis.

```typescript
const DrawdownSchema = z.object({
  ids: z.string().min(1),
  days: z.coerce.number().int().min(30).max(365).default(90),
});
```

Implementation:
- Fetch historical prices
- For each asset, calculate:
  - Maximum drawdown (peak-to-trough decline)
  - Current drawdown from ATH
  - Recovery time from past drawdowns
  - Drawdown duration distribution
- Cache 1 hour

#### 11. GET `/concentration`

Market concentration analysis (Herfindahl-Hirschman Index).

Implementation:
- Fetch top 100 coins by market cap from CoinGecko
- Calculate HHI: `HHI = Σ(market_share_i²) × 10000`
- Calculate Gini coefficient for market cap distribution
- Show dominance breakdown: top 5, top 10, top 20, rest
- Compare to historical HHI (if cached data available)
- Cache 1 hour

### Error Handling

Every endpoint must:
1. Validate inputs with Zod — return `ApiError.validationFailed(issues)` on failure
2. Try/catch all source calls — return `ApiError.serviceUnavailable()` or `ApiError.internal()` with context
3. Log errors with structured pino logger including endpoint name and params
4. Return partial data when possible (if one of three sources fails, return data from the two that worked)

### Caching Strategy

```typescript
// Example caching pattern
const cacheKey = `analytics:correlation:${ids}:${days}`;
const cached = await cache.get(cacheKey);
if (cached) return c.json({ data: cached, meta: { cached: true } });

const result = computeCorrelation(prices);
await cache.set(cacheKey, result, 3600); // 1 hour TTL
return c.json({ data: result, meta: { cached: false, computedAt: new Date().toISOString() } });
```

### index.ts Registration

Ensure `src/index.ts` mounts the routes:
```typescript
import { analyticsRoutes } from "@/routes/analytics";
app.route("/api/analytics", analyticsRoutes);
```

Check if this import + mount already exists. If it does, ensure the prefix matches. If not, add it.

---

## Verification Checklist

After implementation:

1. `npx tsc --noEmit` — zero errors
2. `npx vitest run` — all existing tests pass
3. Start dev server: `npx tsx src/index.ts` — verify it boots
4. Test at least 3 endpoints with curl:
   ```bash
   curl localhost:8080/api/analytics/correlation?ids=bitcoin,ethereum&days=30
   curl localhost:8080/api/analytics/volatility?ids=bitcoin&days=30
   curl localhost:8080/api/analytics/market-regime
   ```
5. Verify error handling: `curl localhost:8080/api/analytics/correlation` (missing ids → 400)

---

## Git

```bash
git config user.name "nirholas"
git config user.email "nirholas@users.noreply.github.com"
git add -A
git commit -m "feat(routes): comprehensive analytics endpoints with correlation, volatility, Sharpe, regime detection"
git push origin $(git branch --show-current)
```
