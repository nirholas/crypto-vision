# Phase 5.2: Distributed Processing

**Priority:** Medium | **Effort:** 3-4 days | **Impact:** Medium (Priority Score: 5)  
**Dependency:** Redis (already configured in `src/lib/rag/redis-vector-store.ts`)

---

## Objective

Scale the RAG system horizontally with queue-based processing, worker pools, distributed caching, and load balancing. Handle traffic spikes gracefully with backpressure and priority queues. Target: 100+ concurrent RAG queries with P95 < 1s.

---

## Implementation Prompt

> Build a distributed processing layer for the RAG system using BullMQ (Redis-backed queues). Add horizontal scaling support with worker pools, distributed caching with cache invalidation, and intelligent load balancing. The app already has Redis configured in `src/lib/rag/redis-vector-store.ts` and caching in `src/lib/rag/cache.ts`.

### Files to Create

```
src/lib/rag/distributed/
├── index.ts                  # Public exports
├── types.ts                  # QueueJob, WorkerConfig, CacheConfig
├── queue-manager.ts          # BullMQ queue setup, job scheduling
├── rag-worker.ts             # Worker that processes RAG jobs from queue
├── worker-pool.ts            # Manage multiple workers, health checks
├── load-balancer.ts          # Route queries to least-loaded worker
├── distributed-cache.ts      # Redis-based cache with pub/sub invalidation
├── backpressure.ts           # Adaptive rate limiting when overloaded
└── metrics-collector.ts      # Queue depth, worker utilization, latency
```

### Dependencies to Add

```json
{
  "bullmq": "^5.x",
  "ioredis": "^5.x"    // If not already present
}
```

### Type Definitions

```typescript
interface RAGJob {
  id: string;
  type: 'ask' | 'search' | 'batch' | 'index' | 'evaluate';
  priority: 'high' | 'normal' | 'low';
  payload: {
    query?: string;
    queries?: string[];        // For batch
    options?: RAGQueryOptions;
    userId?: string;
  };
  createdAt: string;
  timeout: number;              // ms, default: 30000
  retries: number;              // default: 2
  webhook?: string;             // Optional callback URL
}

interface WorkerConfig {
  id: string;
  concurrency: number;          // Parallel jobs per worker (default: 3)
  maxMemoryMB: number;          // Memory limit before GC (default: 512)
  heartbeatInterval: number;    // ms (default: 5000)
  queues: string[];             // Which queues to listen on
  capabilities: string[];       // 'ask', 'search', 'index', etc.
}

interface WorkerStatus {
  id: string;
  status: 'idle' | 'busy' | 'overloaded' | 'draining' | 'offline';
  activeJobs: number;
  completedJobs: number;
  failedJobs: number;
  avgLatencyMs: number;
  memoryUsageMB: number;
  cpuPercent: number;
  uptime: number;
  lastHeartbeat: string;
}

interface QueueMetrics {
  name: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  avgProcessingTime: number;
  throughput: number;           // jobs/minute
}

interface BackpressureConfig {
  maxQueueDepth: number;        // Reject at this depth (default: 1000)
  warningThreshold: number;     // Slow down at this depth (default: 500)
  cooldownMs: number;           // Wait time when overloaded (default: 1000)
  priorityBuckets: {
    high: number;               // Reserved capacity % (default: 30)
    normal: number;             // (default: 50)
    low: number;                // (default: 20)
  };
}
```

### Key Implementation Details

1. **Queue Manager** (`queue-manager.ts`):
   - Create BullMQ queues: `rag:ask`, `rag:search`, `rag:batch`, `rag:index`
   - Priority queue support: high priority jobs jump the queue
   - Job deduplication: same query within 5s returns existing job result
   - Dead letter queue for failed jobs after max retries
   - Graceful shutdown: drain workers, complete active jobs, then exit

2. **RAG Worker** (`rag-worker.ts`):
   - Wraps `ultimate-rag-service.ts` pipeline in a BullMQ Worker
   - Each job: deserialize → execute RAG pipeline → serialize result → return
   - Memory monitoring: if heap > `maxMemoryMB`, stop accepting jobs until GC
   - Timeout handling: abort long-running LLM calls, return partial result
   - Sandboxed execution: catch all errors, never crash the worker process

3. **Worker Pool** (`worker-pool.ts`):
   - Spawn N workers based on available CPU cores (`os.cpus().length`)
   - Health checks: heartbeat monitoring, restart unhealthy workers
   - Auto-scaling: if queue depth > threshold, spawn additional workers (up to max)
   - Graceful drain: mark worker as `draining`, finish active jobs, then shutdown

4. **Load Balancer** (`load-balancer.ts`):
   - Strategy: least-connections (route to worker with fewest active jobs)
   - Fallback: round-robin if all workers equally loaded
   - Sticky sessions: same userId routes to same worker (for cache locality)
   - Circuit breaker: if worker fails 3x in 60s, remove from pool for 30s

5. **Distributed Cache** (`distributed-cache.ts`):
   - Extend existing `cache.ts` with Redis pub/sub for invalidation
   - Two-tier: L1 in-memory (per-worker, 100MB) → L2 Redis (shared)
   - Cache invalidation: publish on Redis channel when data changes
   - TTLs: embedding cache (24h), query cache (1h), LLM response cache (30m)
   - Cache warming: pre-populate trending query results on startup

6. **Backpressure** (`backpressure.ts`):
   - Monitor queue depth every 1s
   - Warning zone (>500 waiting): increase processing delay, log warnings
   - Critical zone (>1000 waiting): return 503 to new requests with `Retry-After` header
   - Priority reservation: always accept high-priority jobs even under load
   - Adaptive: learn from traffic patterns, pre-scale during predicted peak hours

### API Integration

```
GET  /api/rag/queue/status    # Queue depths, worker counts
GET  /api/rag/queue/metrics   # Throughput, latency histograms
POST /api/rag/ask             # Now queues job instead of direct execution
  Response: { jobId: string, estimatedWaitMs: number }  (async mode)
  OR direct response (sync mode, when queue depth < 10)
GET  /api/rag/job/:jobId      # Poll for async job result
```

### Deployment Modes

1. **Single-process** (default): Worker runs in-process, no BullMQ, direct execution. Zero overhead.
2. **Multi-worker**: BullMQ with multiple workers on same machine. Requires Redis.
3. **Distributed**: Workers on separate machines, shared Redis. Requires Redis + networking.

Enable via `RAG_PROCESSING_MODE=single|multi|distributed` env var. Default: `single` (backwards compatible).

### Testing

- Unit tests: queue job serialization, load balancer routing, backpressure thresholds
- Integration test: submit 50 concurrent queries, verify all complete correctly
- Load test: 200 queries/min sustained for 5 minutes, check P95 latency
- Failure tests: worker crash recovery, Redis disconnection handling, timeout behavior
