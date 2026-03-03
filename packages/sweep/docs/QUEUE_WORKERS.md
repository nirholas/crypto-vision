# Queue Workers Documentation

> **⚠️ CRITICAL: Workers process financial transactions. Ensure proper error handling and monitoring.**

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Queue Configuration](#queue-configuration)
4. [Worker Types](#worker-types)
5. [Job Data Schemas](#job-data-schemas)
6. [Error Handling](#error-handling)
7. [Monitoring](#monitoring)
8. [Development](#development)

---

## Overview

Sweep uses **BullMQ** for background job processing, backed by **Redis**. Workers handle async operations like:

- Wallet scanning
- Price updates
- Sweep execution
- Transaction tracking
- Bridge operations
- Subscription monitoring

### Technology Stack

| Component | Technology |
|-----------|------------|
| Queue Library | BullMQ |
| Storage | Redis 7 |
| Runtime | Node.js 20+ |

### Architecture Benefits

- **Reliability**: Jobs persist in Redis, survive restarts
- **Scalability**: Horizontal scaling with multiple workers
- **Observability**: Built-in metrics and events
- **Retry Logic**: Configurable retry with backoff

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          QUEUE ARCHITECTURE                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌─────────────┐     ┌─────────────────────────────────────┐              │
│   │  API Server │────▶│              REDIS                   │              │
│   └─────────────┘     │  ┌─────────┐ ┌─────────┐ ┌─────────┐│              │
│                       │  │ wallet  │ │  sweep  │ │  price  ││              │
│                       │  │  -scan  │ │-execute │ │ -update ││              │
│                       │  └────┬────┘ └────┬────┘ └────┬────┘│              │
│                       │       │           │           │      │              │
│                       │  ┌────┴────┐ ┌────┴────┐ ┌────┴────┐│              │
│                       │  │ bridge  │ │ sub     │ │  sweep  ││              │
│                       │  │-execute │ │-monitor │ │ -track  ││              │
│                       │  └─────────┘ └─────────┘ └─────────┘│              │
│                       └──────────────────┬──────────────────┘              │
│                                          │                                  │
│                                          ▼                                  │
│                       ┌──────────────────────────────────────┐             │
│                       │           WORKER PODS                 │             │
│                       │  ┌─────────┐  ┌─────────┐  ┌────────┐│             │
│                       │  │ Worker 1│  │ Worker 2│  │Worker N││             │
│                       │  │         │  │         │  │        ││             │
│                       │  │ scan    │  │ sweep   │  │ bridge ││             │
│                       │  │ price   │  │ track   │  │ sub    ││             │
│                       │  └─────────┘  └─────────┘  └────────┘│             │
│                       └──────────────────────────────────────┘             │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Queue Configuration

### Queue Names

Defined in `src/queue/index.ts`:

```typescript
export const QUEUE_NAMES = {
  WALLET_SCAN: "wallet-scan",
  PRICE_UPDATE: "price-update",
  SWEEP_EXECUTE: "sweep-execute",
  SWEEP_TRACK: "sweep-track",
  BRIDGE_EXECUTE: "bridge-execute",
  BRIDGE_TRACK: "bridge-track",
  CONSOLIDATION_EXECUTE: "consolidation-execute",
  SUBSCRIPTION_MONITOR: "subscription-monitor",
  SUBSCRIPTION_SWEEP: "subscription-sweep",
} as const;
```

### Default Queue Options

```typescript
const defaultQueueOptions = {
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 1000,
    },
    removeOnComplete: 100,   // Keep last 100 completed
    removeOnFail: 500,       // Keep last 500 failed
  },
};
```

### Redis Connection

```typescript
const connection = {
  url: process.env.REDIS_URL || "redis://localhost:6379",
};
```

---

## Worker Types

### 1. Wallet Scan Worker

**Queue**: `wallet-scan`  
**File**: `src/queue/workers/scan.ts`

Scans wallet balances across multiple chains.

| Property | Value |
|----------|-------|
| Concurrency | 5 |
| Max Retries | 3 |
| Timeout | 60s |

**Triggers**:
- User requests wallet scan
- Subscription monitoring

---

### 2. Price Update Worker

**Queue**: `price-update`  
**File**: `src/queue/workers/price.ts`

Updates token prices from multiple oracles.

| Property | Value |
|----------|-------|
| Concurrency | 10 |
| Max Retries | 2 |
| Timeout | 30s |

**Triggers**:
- Cache miss on price lookup
- Scheduled price refresh
- Quote generation

---

### 3. Sweep Execute Worker

**Queue**: `sweep-execute`  
**File**: `src/queue/workers/sweep.ts`

Executes dust sweep transactions.

| Property | Value |
|----------|-------|
| Concurrency | 3 |
| Max Retries | 2 |
| Timeout | 120s |

**Flow**:
1. Validate quote not expired
2. Update sweep status to "signing"
3. Build UserOperation
4. Submit to bundler
5. Queue tracking job
6. Update status to "submitted"

---

### 4. Sweep Track Worker

**Queue**: `sweep-track`  
**File**: `src/queue/workers/sweep.ts`

Monitors sweep transaction confirmations.

| Property | Value |
|----------|-------|
| Concurrency | 10 |
| Max Retries | 20 |
| Backoff | 5s → 30s |

**Flow**:
1. Query transaction receipt
2. Check confirmation count
3. Update sweep status
4. Re-queue if pending

---

### 5. Bridge Execute Worker

**Queue**: `bridge-execute`  
**File**: `src/queue/workers/bridge.ts`

Executes cross-chain bridge transactions.

| Property | Value |
|----------|-------|
| Concurrency | 2 |
| Max Retries | 2 |
| Timeout | 180s |

---

### 6. Bridge Track Worker

**Queue**: `bridge-track`  
**File**: `src/queue/workers/bridge.ts`

Tracks bridge transfers until destination confirmation.

| Property | Value |
|----------|-------|
| Concurrency | 10 |
| Max Retries | 50 |
| Backoff | 10s → 60s |

---

### 7. Consolidation Worker

**Queue**: `consolidation-execute`  
**File**: `src/queue/workers/consolidation.ts`

Handles multi-step consolidation flows.

| Property | Value |
|----------|-------|
| Concurrency | 2 |
| Max Retries | 3 |
| Timeout | 300s |

---

### 8. Subscription Monitor Worker

**Queue**: `subscription-monitor`  
**File**: `src/queue/workers/subscription-monitor.ts`

Cron job that checks all active subscriptions.

| Property | Value |
|----------|-------|
| Concurrency | 1 |
| Schedule | Every 5 minutes |
| Singleton | Yes |

**Flow**:
1. Query active subscriptions
2. Check trigger conditions (threshold/schedule)
3. Queue subscription sweep jobs

---

### 9. Subscription Sweep Worker

**Queue**: `subscription-sweep`  
**File**: `src/queue/workers/subscription-monitor.ts`

Executes auto-sweeps for subscriptions.

| Property | Value |
|----------|-------|
| Concurrency | 3 |
| Max Retries | 2 |
| Timeout | 120s |

---

## Job Data Schemas

### WalletScanJobData

```typescript
interface WalletScanJobData {
  userId: string;
  walletAddress: string;
  chains: string[];        // ["ethereum", "base", "arbitrum"]
  dustThreshold?: number;  // Minimum USD value (default: 0.10)
}
```

### PriceUpdateJobData

```typescript
interface PriceUpdateJobData {
  tokenAddress: string;
  chain: string;
  force?: boolean;  // Bypass cache
}
```

### SweepExecuteJobData

```typescript
interface SweepExecuteJobData {
  userId: string;
  sweepId: string;
  quoteId: string;
  walletAddress: string;
  signature: string;
  tokens: {
    address: string;
    chain: string;
    amount: string;
  }[];
  outputToken: string;
  outputChain: string;
  gasToken?: string;
}
```

### SweepTrackJobData

```typescript
interface SweepTrackJobData {
  sweepId: string;
  txHash: string;
  chain: string;
  userOpHash?: string;
}
```

### BridgeExecuteJobData

```typescript
interface BridgeExecuteJobData {
  planId: string;
  userId: string;
  walletAddress: string;
  signature: string;
  bridges: {
    sourceChain: string;
    destinationChain: string;
    quoteId: string;
    token: string;
    amount: string;
  }[];
}
```

### BridgeTrackJobData

```typescript
interface BridgeTrackJobData {
  planId: string;
  bridgeId: string;
  sourceTxHash: string;
  sourceChain: string;
  destinationChain: string;
  provider: "across" | "stargate" | "hop" | "lifi";
}
```

### SubscriptionMonitorJobData

```typescript
interface SubscriptionMonitorJobData {
  batchId?: string;  // Optional batch tracking ID
}
```

### SubscriptionSweepJobData

```typescript
interface SubscriptionSweepJobData {
  subscriptionId: string;
  userId: string;
  walletAddress: string;
  tokens: {
    address: string;
    chain: string;
    amount: string;
    symbol: string;
    valueUsd: number;
  }[];
  destinationChain: number;
  destinationAsset: string;
  destinationProtocol?: string;
  destinationVault?: string;
}
```

---

## Error Handling

### Retry Strategy

```typescript
const retryStrategy = {
  attempts: 3,
  backoff: {
    type: "exponential",
    delay: 1000,  // 1s, 2s, 4s
  },
};
```

### Error Categories

| Category | Retry | Action |
|----------|-------|--------|
| **Transient** | Yes | Network timeout, rate limit |
| **Quote Expired** | No | Return error, user re-quotes |
| **Insufficient Funds** | No | Log, notify user |
| **Invalid Signature** | No | Return error |
| **Contract Revert** | Maybe | Depends on revert reason |

### Error Handling Pattern

```typescript
async function processJob(job: Job<SweepExecuteJobData>) {
  try {
    // Process job
    const result = await executeSweep(job.data);
    return result;
  } catch (error) {
    if (isTransientError(error)) {
      // BullMQ will retry automatically
      throw error;
    }
    
    if (isQuoteExpired(error)) {
      // Don't retry, mark as failed
      await updateSweepStatus(job.data.sweepId, "failed", error.message);
      return { success: false, error: error.message };
    }
    
    // Log unexpected errors
    console.error(`[SweepWorker] Unexpected error:`, error);
    throw error;
  }
}
```

### Dead Letter Queue

Failed jobs after max retries go to the failed job set:

```typescript
// Query failed jobs
const failedJobs = await queue.getFailed(0, 100);

// Retry a failed job
await failedJobs[0].retry();

// Remove failed job
await failedJobs[0].remove();
```

---

## Monitoring

### BullMQ Events

```typescript
worker.on("completed", (job, result) => {
  console.log(`Job ${job.id} completed:`, result);
  metrics.jobsCompleted.inc({ queue: QUEUE_NAME });
});

worker.on("failed", (job, error) => {
  console.error(`Job ${job?.id} failed:`, error);
  metrics.jobsFailed.inc({ queue: QUEUE_NAME });
});

worker.on("stalled", (jobId) => {
  console.warn(`Job ${jobId} stalled`);
  metrics.jobsStalled.inc({ queue: QUEUE_NAME });
});
```

### Prometheus Metrics

```typescript
// Queue metrics
sweep_jobs_total{queue, status}         // Total jobs by queue and status
sweep_jobs_duration_seconds{queue}      // Job duration histogram
sweep_queue_size{queue}                 // Current queue size
sweep_queue_active{queue}               // Active job count
sweep_queue_failed{queue}               // Failed job count
```

### Health Checks

```typescript
// Worker health
async function checkWorkerHealth() {
  const redis = await getRedis();
  await redis.ping();
  
  for (const queueName of Object.values(QUEUE_NAMES)) {
    const queue = new Queue(queueName, { connection });
    const counts = await queue.getJobCounts();
    
    if (counts.failed > 100) {
      throw new Error(`Queue ${queueName} has ${counts.failed} failed jobs`);
    }
  }
  
  return { healthy: true };
}
```

### Grafana Dashboard

See `monitoring/grafana/dashboards/queue-dashboard.json` for:

- Jobs processed per minute
- Queue depths
- Error rates
- Processing latency
- Worker utilization

---

## Development

### Running Workers Locally

```bash
# Start workers
npm run start:workers

# Or with tsx for hot reload
npx tsx watch src/workers.ts
```

### Testing Workers

```typescript
import { describe, it, expect, vi } from "vitest";
import { createSweepWorker } from "../src/queue/workers/sweep";

describe("SweepWorker", () => {
  it("should execute sweep successfully", async () => {
    const job = {
      id: "test-job-1",
      data: {
        sweepId: "sweep-123",
        quoteId: "quote-456",
        walletAddress: "0x...",
        tokens: [{ address: "0x...", chain: "base", amount: "1000" }],
        outputToken: "0x...",
        outputChain: "base",
      },
      updateProgress: vi.fn(),
    };
    
    const result = await processJob(job);
    
    expect(result.success).toBe(true);
    expect(result.txHashes).toBeDefined();
  });
});
```

### Adding a New Worker

1. **Define job data type** in `src/queue/index.ts`:

```typescript
export interface MyNewJobData {
  userId: string;
  data: any;
}
```

2. **Add queue name**:

```typescript
export const QUEUE_NAMES = {
  // ...existing
  MY_NEW_QUEUE: "my-new-queue",
} as const;
```

3. **Create worker file** `src/queue/workers/my-new.ts`:

```typescript
import { Worker, Job } from "bullmq";
import { QUEUE_NAMES, type MyNewJobData } from "../index.js";

export function createMyNewWorker(): Worker<MyNewJobData> {
  return new Worker<MyNewJobData>(
    QUEUE_NAMES.MY_NEW_QUEUE,
    async (job: Job<MyNewJobData>) => {
      console.log(`Processing job ${job.id}`);
      // Your logic here
      return { success: true };
    },
    {
      connection: { url: process.env.REDIS_URL },
      concurrency: 5,
    }
  );
}
```

4. **Register in workers.ts**:

```typescript
import { createMyNewWorker } from "./queue/workers/my-new.js";

const workers = [
  // ...existing
  createMyNewWorker(),
];
```

5. **Add helper function** in `src/queue/index.ts`:

```typescript
export async function addMyNewJob(data: MyNewJobData) {
  const queue = new Queue(QUEUE_NAMES.MY_NEW_QUEUE, { connection });
  return queue.add("my-new-job", data);
}
```

---

### Queue Inspection

```bash
# Using Redis CLI
docker exec -it sweep-redis redis-cli

# List all queues
KEYS bull:*:id

# View queue info
LLEN bull:sweep-execute:wait   # Waiting jobs
LLEN bull:sweep-execute:active # Active jobs
ZCARD bull:sweep-execute:failed # Failed jobs
```

### BullBoard UI

```bash
# Install globally
npm install -g bull-board

# Start UI
npx bull-board --redis redis://localhost:6379

# Opens at http://localhost:3030
```

---

## Related Documentation

- [DEVELOPMENT.md](./DEVELOPMENT.md) - Local development setup
- [DEPLOYMENT.md](./DEPLOYMENT.md) - Production deployment
- [MONITORING.md](./MONITORING.md) - Observability
- [API.md](./API.md) - API documentation
