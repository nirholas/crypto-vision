# Prompt 21 — Monitoring, Metrics & Observability

## Context

You are working on the observability layer for crypto-vision. The project is a TypeScript crypto data platform:

- **API server**: Hono v4.7 on Node.js 22, port 8080, 39 route modules, 200+ endpoints
- **Workers**: 15 background workers (market snapshots, DeFi TVL, news aggregation, anomaly detection, etc.)
- **External APIs**: CoinGecko, DeFiLlama, Binance, CryptoCompare, Messari, etc. — all rate-limited
- **Database**: PostgreSQL 16 (Drizzle ORM), Redis 7 (ioredis), BigQuery
- **Infrastructure**: Docker, Kubernetes (GCP Cloud Run), Pub/Sub

Currently, observability is minimal:
- `src/lib/bigquery.ts` has internal `BQMetrics` tracking inserts/errors/latency
- No Prometheus metrics endpoint
- No structured logging (just `console.log`)
- No health check endpoint beyond basic `/`
- No alerting rules

## Task

### 1. Create Prometheus Metrics Module (`src/lib/metrics.ts`)

```typescript
// Use prom-client library
// Export a singleton Registry
// Expose standard metrics:
//
// HTTP Metrics:
//   http_requests_total (counter) — labels: method, route, status_code
//   http_request_duration_seconds (histogram) — labels: method, route
//   http_request_size_bytes (histogram) — labels: method, route
//   http_response_size_bytes (histogram) — labels: method, route
//   http_active_requests (gauge) — labels: method
//
// Data Source Metrics:
//   data_source_requests_total (counter) — labels: source, endpoint, status
//   data_source_request_duration_seconds (histogram) — labels: source, endpoint
//   data_source_cache_hits_total (counter) — labels: source
//   data_source_cache_misses_total (counter) — labels: source
//   data_source_rate_limit_hits_total (counter) — labels: source
//
// Worker Metrics:
//   worker_jobs_total (counter) — labels: worker, status (success/error)
//   worker_job_duration_seconds (histogram) — labels: worker
//   worker_last_run_timestamp (gauge) — labels: worker
//   worker_backlog_size (gauge) — labels: worker
//
// Database Metrics:
//   db_query_duration_seconds (histogram) — labels: operation, table
//   db_connections_active (gauge)
//   db_connections_idle (gauge)
//   db_errors_total (counter) — labels: operation
//
// Redis Metrics:
//   redis_commands_total (counter) — labels: command
//   redis_command_duration_seconds (histogram) — labels: command
//   redis_connections_active (gauge)
//   redis_memory_bytes (gauge)
//
// BigQuery Metrics:
//   bigquery_inserts_total (counter) — labels: table
//   bigquery_rows_inserted_total (counter) — labels: table
//   bigquery_insert_duration_seconds (histogram) — labels: table
//   bigquery_errors_total (counter) — labels: table, error_type
//
// Business Metrics:
//   api_keys_active (gauge)
//   ws_connections_active (gauge)
//   anomalies_detected_total (counter) — labels: type, severity
//   tokens_tracked (gauge)
```

### 2. Create Metrics Middleware (`src/lib/middleware/metrics.ts`)

Hono middleware that:
- Records request count, duration, sizes for every route
- Sets standard labels: `method`, `route` (normalized — strip IDs), `status_code`
- Tracks active request count
- Skips `/metrics` and `/health` endpoints
- Uses `process.hrtime.bigint()` for high-precision timing

### 3. Create `/metrics` Endpoint

In `src/routes/metrics.ts`:
```typescript
import { Hono } from 'hono';
import { register } from '../lib/metrics.js';

const app = new Hono();

app.get('/metrics', async (c) => {
  c.header('Content-Type', register.contentType);
  return c.text(await register.metrics());
});

export default app;
```

### 4. Create Health Check Endpoint (`src/routes/health.ts`)

```typescript
// GET /health — basic liveness probe (always 200)
// GET /health/ready — readiness probe:
//   Checks: PostgreSQL connection, Redis connection, external API reachability
//   Returns 200 if all pass, 503 if any fail
//   Body: { status: 'healthy' | 'degraded' | 'unhealthy', checks: { db, redis, apis } }
// GET /health/startup — startup probe:
//   Checks: schema migrations applied, workers initialized
```

### 5. Structured Logging (`src/lib/logger.ts`)

Replace all `console.log` statements across the codebase with structured JSON logging:

```typescript
// Use pino for structured logging
// Levels: trace, debug, info, warn, error, fatal
// Fields: timestamp, level, msg, service, requestId, traceId, duration, error
// Production: JSON output
// Development: pretty-print
// Request logging middleware: correlate logs with requestId
// Child loggers for subsystems: db, redis, worker, source, bigquery

import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV === 'development'
    ? { target: 'pino-pretty' }
    : undefined,
  base: { service: 'crypto-vision' },
  serializers: pino.stdSerializers,
});

export const dbLogger = logger.child({ subsystem: 'database' });
export const redisLogger = logger.child({ subsystem: 'redis' });
export const workerLogger = logger.child({ subsystem: 'worker' });
export const sourceLogger = logger.child({ subsystem: 'source' });
```

### 6. Instrument Data Sources

In every source adapter (`src/sources/*.ts`):
- Wrap API calls with `data_source_requests_total` and `data_source_request_duration_seconds`
- Track rate limit hits with `data_source_rate_limit_hits_total`
- Track cache hits/misses
- Use structured logging for errors

### 7. Instrument Workers

In every worker (`src/workers/*.ts`):
- Track job execution counts and durations
- Record `worker_last_run_timestamp` after each run
- Log job start/end with structured context
- Record errors with stack traces

### 8. Grafana Dashboard JSON

Create `infra/grafana/dashboard.json` with panels:
- API request rate and latency (p50, p95, p99)
- Error rate by route
- Data source availability and latency
- Worker execution status
- Database connection pool
- Redis memory and command rate
- WebSocket connections
- Rate limit exhaustion

### 9. Alerting Rules

Create `infra/prometheus/alerts.yml` with rules:
- High error rate (>5% of requests returning 5xx in 5m window)
- API latency spike (p99 > 2s for 5m)
- Data source down (0 successful requests in 10m)
- Worker stalled (last_run > 2× expected interval)
- Database connection exhausted (active >= max_connections * 0.8)
- Redis memory high (>80% of maxmemory)
- Rate limit exhaustion (>50 hits in 1m window)

## Dependencies

```bash
npm install prom-client pino pino-pretty
npm install -D @types/pino
```

## Verification

1. Start server → `curl localhost:8080/metrics` returns Prometheus text format
2. Make requests → metrics counters increment correctly
3. `GET /health/ready` returns structured JSON with all checks
4. Logs output structured JSON in production mode
5. `npm run typecheck` passes
6. No `console.log` statements remain in `src/` (all replaced with logger)
