# Prompt 02: Real-Time Data Ingestion Pipelines

## Agent Identity & Rules

```
You are building production-grade data ingestion pipelines for Crypto Vision.
- Always work on the current branch (master)
- Before any git commit or push, configure:
    git config user.name "nirholas"
    git config user.email "nirholas@users.noreply.github.com"
- Always use background terminals (isBackground: true)
- Always kill terminals after commands complete
- We have unlimited Claude credits — build the best possible version
- Every dollar spent must produce a permanent artifact (pipeline code, schemas, configs)
```

## Objective

Build a real-time data ingestion system using Google Cloud Pub/Sub + Cloud Functions/Cloud Run Jobs that continuously collects data from all 26 sources in `src/sources/` and streams it to BigQuery. The pipeline code is portable and runs anywhere (not locked to GCP).

## Budget: $10k

- Pub/Sub: $40/TiB ingested + $0.04/million operations
- Cloud Functions: Free tier covers most (2M invocations/month free)
- Cloud Scheduler: $0.10/job/month
- Cloud Run Jobs: Same pricing as Cloud Run

## Current State

The project already has:
- 26 data sources in `src/sources/`: alternative, binance, bitcoin, blockchain, bybit, coincap, coingecko, coinglass, coinlore, crypto-news, cryptocompare, defillama, depinscan, deribit, dydx, evm, geckoterminal, goplus, hyperliquid, jupiter, l2beat, macro, messari, okx, snapshot, tokenterminal
- 7 Cloud Scheduler jobs in `infra/setup.sh` for basic cache warming
- WebSocket infrastructure in `src/lib/ws.ts` for real-time data
- BigQuery schema (from Prompt 01)

## Deliverables

### 1. Pub/Sub Topic Architecture (`infra/pubsub/`)

Create topics for different data frequencies:

```
crypto-vision-realtime     — WebSocket ticks (< 1s latency)
  ├── binance-trades
  ├── bybit-trades
  ├── hyperliquid-trades
  └── deribit-options

crypto-vision-frequent     — Poll every 1-2 min
  ├── prices (CoinGecko /simple/price)
  ├── gas-prices (mempool.space + EVM RPCs)
  ├── dex-pairs (DexScreener)
  └── fear-greed (Alternative.me)

crypto-vision-standard     — Poll every 5-10 min
  ├── market-snapshots (CoinGecko /coins/markets)
  ├── trending (CoinGecko /search/trending)
  ├── defi-protocols (DeFiLlama)
  ├── defi-chains (DeFiLlama)
  ├── yields (DeFiLlama /pools)
  ├── stablecoins (DeFiLlama)
  ├── dex-volumes (DeFiLlama)
  ├── fees-revenue (DeFiLlama)
  └── news (RSS feeds)

crypto-vision-hourly       — Poll every 30-60 min
  ├── exchanges (CoinGecko)
  ├── categories (CoinGecko)
  ├── derivatives (CoinGlass + dYdX + Deribit)
  ├── funding-rounds (DeFiLlama)
  ├── bridges (DeFiLlama)
  ├── l2-data (L2Beat)
  ├── governance (Snapshot)
  ├── depin (DePINScan)
  └── macro (macro sources)

crypto-vision-daily        — Poll once per day
  ├── ohlc-candles (CoinGecko, all top 500 coins)
  ├── protocol-detail (DeFiLlama, all top 200)
  ├── bitcoin-network (mempool.space)
  └── security-scans (GoPlus)
```

### 2. Terraform Module (`infra/terraform/pubsub.tf`)

```hcl
# Pub/Sub topics + subscriptions
resource "google_pubsub_topic" "realtime" {
  name    = "crypto-vision-realtime"
  project = var.project_id

  message_retention_duration = "86400s"  # 24h retention

  schema_settings {
    schema   = google_pubsub_schema.market_event.id
    encoding = "JSON"
  }
}

resource "google_pubsub_subscription" "realtime_bq" {
  name    = "crypto-vision-realtime-bq"
  topic   = google_pubsub_topic.realtime.id
  project = var.project_id

  bigquery_config {
    table          = "${var.project_id}.crypto_vision.realtime_ticks"
    write_metadata = true
  }

  ack_deadline_seconds = 20
}

# Repeat for each topic tier...
```

### 3. Publisher Module (`src/lib/pubsub.ts`)

```typescript
// src/lib/pubsub.ts — Portable Pub/Sub publisher
import { PubSub, Topic } from "@google-cloud/pubsub";
import { log } from "./logger.js";

const BATCH_SETTINGS = {
  maxMessages: 100,
  maxMilliseconds: 1000,  // Flush every 1s
  maxBytes: 1024 * 1024,  // 1MB
};

let pubsub: PubSub | null = null;
const topicCache = new Map<string, Topic>();

function getClient(): PubSub | null {
  if (!process.env.GCP_PROJECT_ID) return null;
  if (!pubsub) pubsub = new PubSub({ projectId: process.env.GCP_PROJECT_ID });
  return pubsub;
}

function getTopic(name: string): Topic | null {
  const client = getClient();
  if (!client) return null;
  if (!topicCache.has(name)) {
    const topic = client.topic(name, { batching: BATCH_SETTINGS });
    topicCache.set(name, topic);
  }
  return topicCache.get(name)!;
}

export async function publish(topicName: string, data: Record<string, unknown>, attributes?: Record<string, string>): Promise<void> {
  const topic = getTopic(topicName);
  if (!topic) return;  // Graceful degradation when not on GCP

  try {
    await topic.publishMessage({
      json: data,
      attributes: {
        source: data.source as string || "unknown",
        timestamp: new Date().toISOString(),
        ...attributes,
      },
    });
  } catch (err: any) {
    log.warn({ err: err.message, topic: topicName }, "Pub/Sub publish failed");
  }
}

export async function publishBatch(topicName: string, items: Record<string, unknown>[]): Promise<void> {
  const topic = getTopic(topicName);
  if (!topic || items.length === 0) return;

  const promises = items.map(data =>
    topic.publishMessage({ json: data }).catch(err =>
      log.warn({ err: err.message }, "Pub/Sub batch item failed")
    )
  );
  await Promise.allSettled(promises);
}
```

### 4. Ingestion Workers (`src/workers/`)

Create dedicated ingestion workers that run as Cloud Run Jobs:

```
src/workers/
├── ingest-market.ts       — CoinGecko market data (every 2 min)
├── ingest-defi.ts         — DeFiLlama protocols, yields, chains (every 5 min)
├── ingest-news.ts         — RSS feeds + enrichment (every 5 min)
├── ingest-dex.ts          — DexScreener + GeckoTerminal (every 2 min)
├── ingest-derivatives.ts  — CoinGlass, Hyperliquid, dYdX (every 10 min)
├── ingest-onchain.ts      — Gas, Bitcoin stats, token lookups (every 5 min)
├── ingest-governance.ts   — Snapshot proposals (every 30 min)
├── ingest-macro.ts        — Macro data (every 60 min)
├── backfill-historical.ts — One-time historical backfill
└── worker-base.ts         — Shared utilities (retry, metrics, graceful shutdown)
```

Each worker:
1. Fetches data from the upstream source using existing `src/sources/` functions
2. Publishes to the appropriate Pub/Sub topic
3. Also inserts directly into BigQuery (dual-write for reliability)
4. Logs structured metrics (latency, row count, errors)
5. Has graceful shutdown on SIGTERM
6. Is idempotent (safe to re-run)

#### Worker Base Template:

```typescript
// src/workers/worker-base.ts
import { log } from "../lib/logger.js";
import { insertRows } from "../lib/bigquery.js";
import { publish } from "../lib/pubsub.js";

export interface WorkerConfig {
  name: string;
  intervalMs: number;
  bqTable: string;
  pubsubTopic: string;
}

export abstract class Worker {
  protected config: WorkerConfig;
  private running = true;
  private metrics = { runs: 0, rows: 0, errors: 0, lastRunMs: 0 };

  constructor(config: WorkerConfig) {
    this.config = config;
    process.on("SIGTERM", () => this.shutdown());
    process.on("SIGINT", () => this.shutdown());
  }

  abstract fetch(): Promise<Record<string, unknown>[]>;

  async run(): Promise<void> {
    log.info({ worker: this.config.name }, "Worker started");
    
    while (this.running) {
      const start = Date.now();
      try {
        const rows = await this.fetch();
        this.metrics.rows += rows.length;
        
        // Dual-write: BigQuery + Pub/Sub
        await Promise.allSettled([
          insertRows(this.config.bqTable, rows),
          ...rows.map(r => publish(this.config.pubsubTopic, r)),
        ]);
        
        this.metrics.runs++;
        this.metrics.lastRunMs = Date.now() - start;
        
        log.info({
          worker: this.config.name,
          rows: rows.length,
          durationMs: this.metrics.lastRunMs,
        }, "Ingestion cycle complete");
      } catch (err: any) {
        this.metrics.errors++;
        log.error({ worker: this.config.name, err: err.message }, "Ingestion error");
      }
      
      await this.sleep(this.config.intervalMs);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(r => setTimeout(r, ms));
  }

  private shutdown(): void {
    log.info({ worker: this.config.name, metrics: this.metrics }, "Shutting down");
    this.running = false;
  }
}
```

### 5. Expanded Cloud Scheduler Jobs

Expand from 7 to 50+ jobs covering every data source:

```typescript
// infra/scheduler-jobs.ts — Generate scheduler job configs
export const SCHEDULER_JOBS = [
  // Market data (high frequency)
  { name: "ingest-coins", schedule: "*/2 * * * *", endpoint: "/api/coins", desc: "Market snapshots" },
  { name: "ingest-prices", schedule: "*/1 * * * *", endpoint: "/api/price?ids=bitcoin,ethereum,solana,bnb", desc: "Key prices" },
  { name: "ingest-trending", schedule: "*/5 * * * *", endpoint: "/api/trending", desc: "Trending coins" },
  { name: "ingest-global", schedule: "*/5 * * * *", endpoint: "/api/global", desc: "Global stats" },
  { name: "ingest-fear-greed", schedule: "*/15 * * * *", endpoint: "/api/fear-greed", desc: "Fear & Greed" },
  
  // DeFi (standard frequency)
  { name: "ingest-defi-protocols", schedule: "*/10 * * * *", endpoint: "/api/defi/protocols", desc: "DeFi TVL" },
  { name: "ingest-defi-chains", schedule: "*/10 * * * *", endpoint: "/api/defi/chains", desc: "Chain TVL" },
  { name: "ingest-defi-yields", schedule: "*/10 * * * *", endpoint: "/api/defi/yields", desc: "Yield pools" },
  { name: "ingest-defi-stablecoins", schedule: "*/15 * * * *", endpoint: "/api/defi/stablecoins", desc: "Stablecoins" },
  { name: "ingest-defi-dex-volumes", schedule: "*/15 * * * *", endpoint: "/api/defi/dex-volumes", desc: "DEX volumes" },
  { name: "ingest-defi-fees", schedule: "*/15 * * * *", endpoint: "/api/defi/fees", desc: "Protocol fees" },
  { name: "ingest-defi-bridges", schedule: "*/30 * * * *", endpoint: "/api/defi/bridges", desc: "Bridge volumes" },
  { name: "ingest-defi-raises", schedule: "0 */2 * * *", endpoint: "/api/defi/raises", desc: "Funding rounds" },
  
  // News
  { name: "ingest-news", schedule: "*/5 * * * *", endpoint: "/api/news", desc: "Latest news" },
  { name: "ingest-news-bitcoin", schedule: "*/5 * * * *", endpoint: "/api/news/bitcoin", desc: "Bitcoin news" },
  { name: "ingest-news-defi", schedule: "*/10 * * * *", endpoint: "/api/news/defi", desc: "DeFi news" },
  
  // On-chain
  { name: "ingest-gas", schedule: "*/5 * * * *", endpoint: "/api/onchain/gas", desc: "Gas prices" },
  { name: "ingest-btc-fees", schedule: "*/5 * * * *", endpoint: "/api/onchain/bitcoin/fees", desc: "BTC fees" },
  { name: "ingest-btc-stats", schedule: "*/15 * * * *", endpoint: "/api/onchain/bitcoin/stats", desc: "BTC network" },
  
  // Exchanges & derivatives
  { name: "ingest-exchanges", schedule: "*/30 * * * *", endpoint: "/api/exchanges", desc: "Exchanges" },
  { name: "ingest-derivatives", schedule: "*/15 * * * *", endpoint: "/api/derivatives", desc: "Derivatives" },
  { name: "ingest-perps", schedule: "*/10 * * * *", endpoint: "/api/perps", desc: "Perps data" },
  
  // Other
  { name: "ingest-categories", schedule: "*/30 * * * *", endpoint: "/api/categories", desc: "Categories" },
  { name: "ingest-l2", schedule: "*/30 * * * *", endpoint: "/api/l2", desc: "L2 data" },
  { name: "ingest-governance", schedule: "0 */1 * * *", endpoint: "/api/governance", desc: "Governance" },
  { name: "ingest-macro", schedule: "0 */2 * * *", endpoint: "/api/macro", desc: "Macro data" },
  { name: "ingest-depin", schedule: "0 */1 * * *", endpoint: "/api/depin", desc: "DePIN data" },
  { name: "ingest-solana", schedule: "*/15 * * * *", endpoint: "/api/solana", desc: "Solana data" },
  
  // AI (cache warming)
  { name: "warm-ai-digest", schedule: "0 */4 * * *", endpoint: "/api/ai/digest", desc: "AI digest" },
  { name: "warm-ai-signals", schedule: "0 */2 * * *", endpoint: "/api/ai/signals", desc: "AI signals" },
  { name: "warm-ai-sentiment-btc", schedule: "*/30 * * * *", endpoint: "/api/ai/sentiment/bitcoin", desc: "BTC sentiment" },
  { name: "warm-ai-sentiment-eth", schedule: "*/30 * * * *", endpoint: "/api/ai/sentiment/ethereum", desc: "ETH sentiment" },
];
```

### 6. Docker Compose for Local Development

```yaml
# docker-compose.ingest.yml
version: "3.8"
services:
  pubsub-emulator:
    image: gcr.io/google.com/cloudsdktool/google-cloud-cli:emulators
    command: gcloud beta emulators pubsub start --host-port=0.0.0.0:8085
    ports: ["8085:8085"]
  
  worker-market:
    build: .
    command: node dist/src/workers/ingest-market.js
    env_file: .env
    environment:
      PUBSUB_EMULATOR_HOST: pubsub-emulator:8085
    depends_on: [pubsub-emulator]
  
  worker-defi:
    build: .
    command: node dist/src/workers/ingest-defi.js
    env_file: .env
    environment:
      PUBSUB_EMULATOR_HOST: pubsub-emulator:8085
    depends_on: [pubsub-emulator]
  
  worker-news:
    build: .
    command: node dist/src/workers/ingest-news.js
    env_file: .env
    environment:
      PUBSUB_EMULATOR_HOST: pubsub-emulator:8085
    depends_on: [pubsub-emulator]
```

### 7. Cloud Run Job Definitions

```yaml
# cloudbuild-workers.yaml — Build and deploy ingestion workers
steps:
  - name: gcr.io/cloud-builders/docker
    args: [build, -t, "${_REGION}-docker.pkg.dev/$PROJECT_ID/crypto-vision/worker:$SHORT_SHA", -f, Dockerfile.worker, .]
  
  - name: gcr.io/cloud-builders/docker
    args: [push, "${_REGION}-docker.pkg.dev/$PROJECT_ID/crypto-vision/worker:$SHORT_SHA"]
  
  # Deploy each worker as a Cloud Run Job
  - name: gcr.io/google.com/cloudsdktool/cloud-sdk
    entrypoint: bash
    args:
      - -c
      - |
        for worker in market defi news dex derivatives onchain governance macro; do
          gcloud run jobs create ingest-${worker} \
            --image=${_REGION}-docker.pkg.dev/$PROJECT_ID/crypto-vision/worker:$SHORT_SHA \
            --region=${_REGION} \
            --command=node \
            --args=dist/src/workers/ingest-${worker}.js \
            --set-secrets=... \
            --max-retries=3 \
            --task-timeout=300s \
            || gcloud run jobs update ingest-${worker} \
              --image=${_REGION}-docker.pkg.dev/$PROJECT_ID/crypto-vision/worker:$SHORT_SHA \
              --region=${_REGION}
        done
```

## Validation

1. Pub/Sub emulator works locally with `docker compose -f docker-compose.ingest.yml up`
2. Workers successfully fetch from each source and publish messages
3. BigQuery receives streaming inserts from both the API and workers
4. Cloud Scheduler triggers all 30+ endpoints without failures
5. `npx tsc --noEmit` passes
6. Workers handle graceful shutdown on SIGTERM
7. No impact to existing API performance (fire-and-forget pattern)

## npm Dependencies to Add

```bash
npm install @google-cloud/pubsub
```
