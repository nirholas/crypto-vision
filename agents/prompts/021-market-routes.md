# Prompt 021 — Market Routes (Core Market Data API)

## Preamble — Read Every Time

You are an expert TypeScript engineer building **cryptocurrency.cv**. Stack: **Hono + TypeScript + Node.js**, Google Cloud Run, Redis caching, Zod validation.

### Absolute Rules

1. **Never mock, stub, or fake anything.** 2. **TypeScript strict mode** — no `any`. 3. **Always kill terminals** after every command. 4. **Commit and push as `nirholas`.** 5. **If close to hallucinating — tell the prompter.** 6. **Run `npx tsc --noEmit` and `npx vitest run`.** 7. **Improve any existing code you touch.**

---

## Task

Build / improve `src/routes/market.ts` — the primary market data route module. This is the highest-traffic set of endpoints and must be production-grade.

### Route Pattern

```typescript
import { Hono } from 'hono';
import * as cg from '../sources/coingecko.js';
import * as alt from '../sources/alternative.js';
import * as coinlore from '../sources/coinlore.js';
import { ApiError } from '../lib/api-error.js';

export const marketRoutes = new Hono();
```

### Endpoints to Implement

| Method | Path | Description | Source |
|--------|------|-------------|--------|
| GET | `/coins` | Top coins by market cap, paginated | CoinGecko |
| GET | `/coin/:id` | Detailed coin data (description, links, stats) | CoinGecko |
| GET | `/price` | Simple multi-coin price lookup (`?ids=bitcoin,ethereum`) | CoinGecko |
| GET | `/trending` | Trending coins (top 15) | CoinGecko |
| GET | `/global` | Global market stats (total mcap, volume, dominance) | CoinGecko |
| GET | `/search` | Search coins by name/symbol | CoinGecko |
| GET | `/chart/:id` | Price chart data with configurable timeframe | CoinGecko |
| GET | `/ohlc/:id` | OHLC candle data | CoinGecko |
| GET | `/exchanges` | Exchange rankings by volume | CoinGecko |
| GET | `/categories` | Market categories with aggregate stats | CoinGecko |
| GET | `/fear-greed` | Fear & Greed Index (current + historical) | Alternative.me |
| GET | `/gainers` | Top 24h price gainers | CoinGecko + computed |
| GET | `/losers` | Top 24h price losers | CoinGecko + computed |
| GET | `/high-volume` | Highest 24h volume coins | CoinGecko + computed |
| GET | `/ath-distance` | Coins ranked by distance from all-time high | CoinGecko + computed |
| GET | `/compare` | Compare multiple coins side-by-side | CoinGecko |
| GET | `/dominance` | BTC/ETH/stablecoin dominance over time | CoinGecko global |
| GET | `/market-overview` | Combined multi-source overview | All sources |
| GET | `/coinlore/global` | CoinLore global stats | CoinLore |
| GET | `/coinlore/tickers` | CoinLore tickers | CoinLore |
| GET | `/heatmap` | Market heatmap (top 100 by sector) | CoinGecko |
| GET | `/market-cap-history` | Total market cap history chart | CoinGecko |

### Request Validation Pattern

Every endpoint must validate query parameters with Zod:

```typescript
import { z } from 'zod';

const CoinsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  per_page: z.coerce.number().int().min(1).max(250).default(100),
  order: z.enum(['market_cap_desc', 'market_cap_asc', 'volume_desc', 'volume_asc',
    'gecko_desc', 'gecko_asc', 'id_asc', 'id_desc']).default('market_cap_desc'),
  sparkline: z.coerce.boolean().default(false),
  ids: z.string().optional(),
  category: z.string().optional(),
});
```

### Response Envelope

All responses must follow this structure:

```typescript
{
  data: T,                  // the actual payload
  meta?: {                  // optional pagination/info
    page?: number,
    perPage?: number,
    total?: number,
  },
  timestamp: string,        // ISO 8601
}
```

### Error Handling

```typescript
marketRoutes.get('/coin/:id', async (c) => {
  try {
    const { id } = c.req.param();
    if (!id || id.length > 100) throw new ApiError(400, 'Invalid coin ID');
    
    const coin = await cg.getCoinDetail(id);
    if (!coin) throw new ApiError(404, 'Coin not found');
    
    return c.json({ data: coin, timestamp: new Date().toISOString() });
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(502, 'Failed to fetch coin data');
  }
});
```

### Computed Endpoints (No Direct API)

For `/gainers`, `/losers`, `/high-volume`, and `/ath-distance`, fetch top 250 coins and compute rankings locally:

```typescript
marketRoutes.get('/gainers', async (c) => {
  const limit = Math.min(Number(c.req.query('limit') || 20), 100);
  const coins = await cg.getCoins({ perPage: 250, sparkline: false });
  
  const sorted = coins
    .filter(coin => coin.price_change_percentage_24h != null)
    .sort((a, b) => (b.price_change_percentage_24h ?? 0) - (a.price_change_percentage_24h ?? 0))
    .slice(0, limit);
  
  return c.json({
    data: sorted.map(coin => ({
      id: coin.id, symbol: coin.symbol, name: coin.name,
      price: coin.current_price, change24h: coin.price_change_percentage_24h,
      volume24h: coin.total_volume, marketCap: coin.market_cap,
    })),
    timestamp: new Date().toISOString(),
  });
});
```

### Multi-Source Market Overview

The `/market-overview` endpoint combines data from CoinGecko, Alternative.me, and CoinLore into a single response:

```typescript
{
  data: {
    global: { /* CoinGecko global stats */ },
    fearGreed: { /* Alternative.me */ },
    topCoins: [ /* top 10 by mcap */ ],
    trending: [ /* CoinGecko trending */ ],
    topGainers: [ /* top 5 gainers */ ],
    topLosers: [ /* top 5 losers */ ],
    btcDominance: number,
    ethDominance: number,
    totalMarketCap: number,
    total24hVolume: number,
    activeCryptocurrencies: number,
  },
  timestamp: string,
}
```

Use `Promise.allSettled()` for multi-source calls so one failing source doesn't break the whole response.

### Performance Requirements

- All list endpoints must support pagination
- `/coins` response should be shaped (remove unnecessary CoinGecko fields)
- Pass `Cache-Control` headers for CDN caching: `c.header('Cache-Control', 'public, max-age=30, s-maxage=60')`
- Use the `cacheResponse` utility from `src/lib/cdn-cache.ts` for edge caching

### Acceptance Criteria

- [ ] All 22+ endpoints compile and return valid JSON
- [ ] Request parameters are validated with Zod schemas
- [ ] Error responses follow `ApiError` pattern
- [ ] Multi-source endpoint uses `Promise.allSettled()`
- [ ] CDN cache headers set on all endpoints
- [ ] Response shapes are consistent (data/meta/timestamp)
- [ ] Tests cover key endpoints
- [ ] Committed and pushed as `nirholas`, terminals killed

### Hallucination Warning

CoinGecko's free API returns up to 250 items per page for `/coins/markets`. The `/search` endpoint returns `{ coins, exchanges, categories }`. The chart endpoint is `/coins/{id}/market_chart` with `vs_currency` and `days` params. If unsure about exact CoinGecko response fields, tell the prompter.
