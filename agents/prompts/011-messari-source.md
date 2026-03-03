# Prompt 011 — Messari Source Adapter (Research & Metrics)

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

Build the **complete Messari source adapter** at `src/sources/messari.ts`. Messari provides institutional-grade crypto research, on-chain metrics, and fundamental analysis data.

### API Base URL

```
https://data.messari.io/api/v1     # v1 endpoints
https://data.messari.io/api/v2     # v2 endpoints (newer)
# Auth: x-messari-api-key header
# Env: MESSARI_API_KEY
# Free tier: 20 req/min, 1000/day
```

### Requirements

#### 1. Zod Schemas

- `MessariAsset` — id, symbol, name, slug, metrics (market_data, marketcap, supply, blockchain_stats, developer_activity, roi_data, misc_data, reddit, on_chain_data), profile
- `MessariMetrics` — market_data (price_usd, volume_last_24_hours, percent_change_usd_last_24_hours, ohlcv_last_1_hour/24_hours), marketcap (current_marketcap_usd, y_2050_marketcap_usd, outstanding_marketcap), supply (y_2050, y_plus10, liquid, circulating), roi_data (percent_change_last_1_week/month/3_months/1_year), on_chain_data (txn_count_last_24_hours, active_addresses, average_fee_usd)
- `MessariProfile` — general (overview, background, technology, regulation), economics (token, launch, consensus_and_emission), technology, governance
- `MessariTimeseries` — values array of { timestamp, value }
- `MessariNews` — id, title, content, author, published_at, tags, url, reference_url
- `AssetMarketData` — exchange_name, pair, price_usd, volume_24h, last_trade_at

#### 2. Exported Functions

**Assets & Metrics:**

| Function | Endpoint | Cache TTL |
|----------|----------|-----------|
| `getAssets(page?, limit?, fields?)` | `/v2/assets` | 120s |
| `getAssetBySlug(slug)` | `/v2/assets/{slug}` | 120s |
| `getAssetMetrics(slug)` | `/v1/assets/{slug}/metrics` | 60s |
| `getAssetMarketData(slug)` | `/v1/assets/{slug}/metrics/market-data` | 30s |
| `getAssetProfile(slug)` | `/v2/assets/{slug}/profile` | 600s |

**Time Series:**

| Function | Endpoint | Cache TTL |
|----------|----------|-----------|
| `getTimeseries(slug, metric, start?, end?, interval?)` | `/v1/assets/{slug}/metrics/{metric}/time-series` | 120s |
| `getPriceTimeseries(slug, start?, end?)` | Above with `price` metric | 120s |
| `getVolumeTimeseries(slug, start?, end?)` | Above with `volume` metric | 120s |
| `getMarketCapTimeseries(slug, start?, end?)` | Above with `mcap.current` metric | 120s |
| `getOnChainTimeseries(slug, metric)` | Above with on-chain metric | 300s |

**Markets & Exchanges:**

| Function | Endpoint | Cache TTL |
|----------|----------|-----------|
| `getAssetMarkets(slug)` | `/v1/assets/{slug}/markets` | 120s |
| `getMarkets(page?, limit?)` | `/v1/markets` | 120s |
| `getExchanges(page?, limit?)` | `/v1/exchanges` | 300s |

**News & Research:**

| Function | Endpoint | Cache TTL |
|----------|----------|-----------|
| `getNews(page?, limit?)` | `/v1/news` | 60s |
| `getNewsByAsset(slug)` | `/v1/news/{slug}` | 60s |

#### 3. Fundamental Analysis Helpers

```typescript
export function calculateNVT(price: number, dailyTxVolume: number, supply: number): number
export function calculateMVRV(marketCap: number, realizedCap: number): number
export function calculateStockToFlow(supply: number, annualIssuance: number): number
export function calculatePERatio(price: number, revenue: number, supply: number): number
export function assetHealthScore(metrics: MessariMetrics): {
  score: number;
  breakdown: { liquidity: number; development: number; community: number; onChain: number; marketStructure: number };
}
export function compareAssets(a: MessariAsset, b: MessariAsset): {
  winner: string;
  categories: Record<string, { metric: string; aValue: number; bValue: number; winner: string }>;
}
```

### Acceptance Criteria

- [ ] File compiles with zero errors
- [ ] All asset, metrics, timeseries, and news functions implemented
- [ ] Messari response wrapper (`{ data: T }`) properly unwrapped
- [ ] Fundamental analysis calculations are economically sound
- [ ] Time series supports custom date ranges and intervals
- [ ] Rate limiting awareness (20 req/min free tier)
- [ ] `src/routes/research.ts` imports work
- [ ] All tests pass, committed and pushed as `nirholas`
- [ ] All terminals killed

### Hallucination Warning

Messari v1 vs v2 endpoints have different response structures. v2 wraps in `{ data: { ... } }`, v1 uses `{ data: { ... }, status: { ... } }`. The metrics endpoint has deeply nested fields — `data.market_data.price_usd` not `data.price_usd`. If unclear about nesting, tell the prompter.
