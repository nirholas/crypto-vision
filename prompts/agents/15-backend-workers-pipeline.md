# Prompt 15 — Backend: Workers & Data Pipeline

## Context

You are working on the data ingestion pipeline in `src/workers/` of the crypto-vision monorepo. There are 15 worker files that periodically fetch data from external APIs, write to BigQuery + Pub/Sub, and index into vector stores.

The workers use a shared base class:
- `src/workers/worker-base.ts` — Periodic fetch, BigQuery+Pub/Sub dual-write, metrics, backoff, graceful shutdown

## Workers

**Data Ingestion (fetch from APIs → store):**
| Worker | Schedule | Source | Data |
|--------|----------|--------|------|
| `ingest-market.ts` | 2 min | CoinGecko | Market snapshots, F&G index |
| `ingest-defi.ts` | 5 min | DeFiLlama | TVL, yields, stables, DEX vols, fees |
| `ingest-news.ts` | 5 min | CryptoPanic, RSS | News articles |
| `ingest-dex.ts` | 2 min | DexScreener, GeckoTerminal | DEX pairs, trades |
| `ingest-derivatives.ts` | 10 min | CoinGlass, Hyperliquid, dYdX, Deribit | Funding, OI, liquidations |
| `ingest-governance.ts` | 30 min | Snapshot | Governance proposals |
| `ingest-macro.ts` | 60 min | Yahoo Finance | Macro indicators (DXY, Gold, S&P) |
| `ingest-onchain.ts` | 5 min | Mempool.space, RPCs | Gas prices, BTC network stats |
| `backfill-historical.ts` | On-demand | Multiple | OHLC candles, historical TVL |

**Embedding/Indexing (process → vector store):**
| Worker | Schedule | Input | Output |
|--------|----------|-------|--------|
| `index-news.ts` | 5 min | News articles | Vector store (search) |
| `index-protocols.ts` | 15 min | Protocol metadata | Vector store (search) |
| `index-governance.ts` | 30 min | Governance proposals | Vector store (search) |
| `index-agents.ts` | Startup | Agent JSON definitions | Vector store (search) |
| `index.ts` | — | Orchestrator for all workers | — |

## Task

### 1. Fix the Worker Base Class

Review `src/workers/worker-base.ts` and ensure:

```typescript
// WorkerBase should:
// 1. Accept config: { name, intervalMs, batchSize }
// 2. Run on schedule: every intervalMs, call this.execute()
// 3. Error handling: catch errors, log, increment error counter, apply backoff
// 4. Backoff: exponential backoff on consecutive failures (1x, 2x, 4x, max 16x)
// 5. Reset backoff on success
// 6. Metrics: track runs, successes, failures, duration, items processed
// 7. Graceful shutdown: finish current run, don't start new ones
// 8. Health reporting: isHealthy(), lastRunAt, lastError
// 9. BigQuery write: if BQ client available, write batch data
// 10. Pub/Sub publish: if Pub/Sub client available, publish events
// 11. Both BQ and Pub/Sub are optional — worker works without them
```

### 2. Complete Each Ingestion Worker

For each ingest worker, ensure:

**`ingest-market.ts`:**
- Fetch top 250 coins from CoinGecko `/coins/markets` (paginated)
- Fetch Fear & Greed Index from alternative.me
- Fetch global market data from CoinGecko `/global`
- Write to BigQuery table: `market_snapshots`
- Update Redis cache for API routes
- Broadcast to WebSocket "prices" channel

**`ingest-defi.ts`:**
- Fetch TVL by protocol from DeFiLlama `/protocols`
- Fetch TVL by chain from DeFiLlama `/chains`
- Fetch yield pools from DeFiLlama `/pools`
- Fetch stablecoin data from DeFiLlama `/stablecoins`
- Fetch DEX volumes from DeFiLlama `/overview/dexs`
- Write to BigQuery table: `defi_snapshots`

**`ingest-news.ts`:**
- Fetch from CryptoPanic API (`/posts/`)
- Fetch from RSS feeds (configurable list)
- Deduplicate by URL
- Extract: title, source, url, publishedAt, sentiment (if available)
- Write to BigQuery table: `news_articles`
- Broadcast new articles to WebSocket "news" channel

**`ingest-dex.ts`:**
- Fetch trending pairs from GeckoTerminal
- Fetch new pairs from DexScreener
- Track volume and liquidity changes
- Write to BigQuery table: `dex_pairs`

**`ingest-derivatives.ts`:**
- Fetch funding rates from CoinGlass/Hyperliquid
- Fetch open interest from CoinGlass
- Fetch liquidation data
- Write to BigQuery table: `derivatives_snapshots`

**`ingest-governance.ts`:**
- Fetch active proposals from Snapshot
- Track voting progress
- Write to BigQuery table: `governance_proposals`

**`ingest-macro.ts`:**
- Fetch DXY (Dollar Index), Gold, S&P 500, Treasury yields
- Use Yahoo Finance API (no key needed for basic data)
- Write to BigQuery table: `macro_indicators`

**`ingest-onchain.ts`:**
- Multi-chain gas prices (ETH, BSC, Polygon, Arbitrum, etc.)
- Bitcoin network stats (hashrate, difficulty, mempool)
- Write to BigQuery table: `onchain_metrics`
- Broadcast gas to WebSocket "gas" channel

### 3. Complete Indexing Workers

**`index-news.ts`:**
- Read recent news from cache or BigQuery
- Generate embeddings (via `src/lib/embeddings.ts`)
- Upsert into vector store with metadata: { source, url, publishedAt, sentiment }
- Deduplicate: don't re-index already indexed articles

**`index-protocols.ts`:**
- Read protocol metadata from DeFiLlama
- Generate embeddings of protocol descriptions
- Upsert into vector store: { name, chain, category, tvl, description }

**`index-governance.ts`:**
- Read governance proposals from Snapshot
- Embed proposal titles + descriptions
- Upsert: { protocol, title, status, endDate }

**`index-agents.ts`:**
- Read all agent JSON definitions from `agents/src/`
- Embed agent descriptions
- Upsert: { agentId, name, description, capabilities }
- Only runs once at startup

### 4. Complete the Worker Orchestrator (`src/workers/index.ts`)

```typescript
// WorkerOrchestrator should:
// 1. Register all workers
// 2. Start all workers with staggered start times (avoid thundering herd)
// 3. Health check: report status of all workers
// 4. Graceful shutdown: stop all workers on SIGTERM/SIGINT
// 5. Restart failed workers after backoff
// 6. Dashboard API endpoint for worker status
```

### 5. Add Worker Status to Health Check

Wire worker health into the existing `/health` endpoint:
```json
{
  "workers": {
    "ingest-market": { "healthy": true, "lastRun": "...", "runsTotal": 100, "errorsTotal": 2 },
    "ingest-defi": { "healthy": true, "lastRun": "...", "runsTotal": 50, "errorsTotal": 0 }
  }
}
```

## Technical Requirements

- Workers run without BigQuery/Pub/Sub (graceful degradation)
- Redis is the minimum requirement for caching
- All workers must be independently startable (for docker-compose scaling)
- Structured logging with worker name context
- Prometheus metrics per worker
- No `any` types
- All data fetching uses the `fetcher.ts` client (circuit breaker, retries)

## Verification

1. `npm run typecheck` passes
2. Starting the API server also starts workers (if enabled via env)
3. Workers can run standalone: `npx tsx src/workers/ingest-market.ts`
4. `/health` includes worker status
5. Data appears in Redis cache after worker runs
6. WebSocket broadcasts happen after data ingestion
