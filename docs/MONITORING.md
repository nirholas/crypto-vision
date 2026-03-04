# Monitoring & Observability

> Prometheus metrics, structured logging, health checks, and alerting for the Crypto Vision platform.

---

## Table of Contents

- [Overview](#overview)
- [Prometheus Metrics](#prometheus-metrics)
  - [HTTP Metrics](#http-metrics)
  - [Upstream Metrics](#upstream-metrics)
  - [Cache Metrics](#cache-metrics)
  - [Queue Metrics](#queue-metrics)
  - [Circuit Breaker Metrics](#circuit-breaker-metrics)
  - [WebSocket Metrics](#websocket-metrics)
- [Health Endpoint](#health-endpoint)
- [Structured Logging](#structured-logging)
- [Path Normalization](#path-normalization)
- [Dashboard Setup](#dashboard-setup)
- [Alerting Recommendations](#alerting-recommendations)

---

## Overview

Crypto Vision provides three pillars of observability:

| Pillar | Technology | Endpoint / Config |
|---|---|---|
| **Metrics** | Prometheus (prom-client) | `GET /metrics` |
| **Logging** | Pino (structured JSON) | `LOG_LEVEL` env var |
| **Health** | Custom health check | `GET /health` |

**Source files:**
- `src/lib/metrics.ts` — Prometheus metrics registration and helpers
- `src/lib/middleware.ts` — Request logging, timing, and metrics middleware
- `src/index.ts` — Health endpoint and metric summary

---

## Prometheus Metrics

All metrics are exposed at `GET /metrics` in Prometheus exposition format. Scrape with a standard Prometheus configuration:

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'crypto-vision'
    scrape_interval: 15s
    static_configs:
      - targets: ['crypto-vision:8080']
```

### HTTP Metrics

| Metric | Type | Labels | Description |
|---|---|---|---|
| `http_requests_total` | Counter | `method`, `path`, `status` | Total HTTP requests |
| `http_request_duration_seconds` | Histogram | `method`, `path`, `status` | Request latency distribution |

**Histogram buckets:** 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10

**Example PromQL queries:**

```promql
# Request rate (per second)
rate(http_requests_total[5m])

# P99 latency
histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m]))

# Error rate (5xx)
rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m])

# Slow endpoints (P95 > 1s)
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 1
```

---

### Upstream Metrics

| Metric | Type | Labels | Description |
|---|---|---|---|
| `upstream_requests_total` | Counter | `source`, `status` | Total upstream API requests |
| `upstream_request_duration_seconds` | Histogram | `source`, `status` | Upstream request latency |

**Histogram buckets:** 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30

**Example queries:**

```promql
# CoinGecko error rate
rate(upstream_requests_total{source="coingecko", status!="200"}[5m])

# Upstream latency by source (P95)
histogram_quantile(0.95, rate(upstream_request_duration_seconds_bucket[5m])) by (source)

# 429 rate limit hits per source
rate(upstream_requests_total{status="429"}[5m]) by (source)
```

---

### Cache Metrics

| Metric | Type | Labels | Description |
|---|---|---|---|
| `cache_hits_total` | Counter | `layer` | Cache hit count |
| `cache_misses_total` | Counter | `layer` | Cache miss count |

**Labels:**
- `layer="memory"` — In-memory LRU cache (L1)
- `layer="redis"` — Redis cache (L2)

**Example queries:**

```promql
# Overall cache hit rate
sum(rate(cache_hits_total[5m])) / (sum(rate(cache_hits_total[5m])) + sum(rate(cache_misses_total[5m])))

# Memory cache hit rate vs Redis
rate(cache_hits_total{layer="memory"}[5m]) / (rate(cache_hits_total{layer="memory"}[5m]) + rate(cache_misses_total{layer="memory"}[5m]))
```

---

### Queue Metrics

| Metric | Type | Labels | Description |
|---|---|---|---|
| `queue_depth` | Gauge | `queue_name` | Current tasks waiting in queue |
| `queue_tasks_total` | Counter | `queue_name`, `result` | Total tasks processed |
| `queue_task_duration_seconds` | Histogram | `queue_name` | Task execution time |

**Queue names:** `ai`, `heavy`
**Result labels:** `completed`, `rejected`, `timed_out`

**Example queries:**

```promql
# AI queue saturation
queue_depth{queue_name="ai"} / 500  # 500 = max queue size

# AI request rejection rate
rate(queue_tasks_total{queue_name="ai", result="rejected"}[5m])

# Average AI response time
rate(queue_task_duration_seconds_sum{queue_name="ai"}[5m]) / rate(queue_task_duration_seconds_count{queue_name="ai"}[5m])
```

---

### Circuit Breaker Metrics

| Metric | Type | Labels | Description |
|---|---|---|---|
| `circuit_breaker_state` | Gauge | `host` | 0 = closed, 0.5 = half-open, 1 = open |

**Example queries:**

```promql
# Hosts with open circuit breakers
circuit_breaker_state == 1

# Circuit breaker state changes (detect flapping)
changes(circuit_breaker_state[1h])
```

---

### WebSocket Metrics

| Metric | Type | Labels | Description |
|---|---|---|---|
| `active_websocket_connections` | Gauge | — | Current WebSocket connections |

**Example queries:**

```promql
# WebSocket connections
active_websocket_connections

# Connection growth rate
deriv(active_websocket_connections[1h])
```

---

## Health Endpoint

**`GET /health`**

Returns comprehensive system status. Used by Kubernetes liveness/readiness probes, load balancers, and monitoring systems.

### Response Format

```json
{
  "status": "healthy",
  "version": "0.1.0",
  "uptime": 86400,
  "cache": {
    "size": 15420,
    "hitRate": 0.87,
    "staleHits": 1200,
    "evictions": 0
  },
  "circuitBreakers": {
    "api.coingecko.com": "CLOSED",
    "api.llama.fi": "CLOSED",
    "api.binance.com": "HALF-OPEN"
  },
  "queue": {
    "ai": {
      "pending": 2,
      "active": 1,
      "totalExecuted": 15000
    },
    "heavy": {
      "pending": 0,
      "active": 3,
      "totalExecuted": 80000
    }
  },
  "websocket": {
    "connections": 42,
    "topics": {
      "prices": 25,
      "bitcoin": 8,
      "trades": 5,
      "alerts": 4
    }
  },
  "degradedRoutes": [
    "/api/market/global"
  ],
  "memory": {
    "heapUsed": "150MB",
    "rss": "250MB"
  }
}
```

### Status Values

| Status | Condition |
|---|---|
| `healthy` | All systems operational, no degraded routes |
| `degraded` | Some routes are using fallback sources |
| `unhealthy` | Critical failures (multiple open circuit breakers) |

### Kubernetes Integration

```yaml
# k8s deployment
livenessProbe:
  httpGet:
    path: /health
    port: 8080
  initialDelaySeconds: 10
  periodSeconds: 30
readinessProbe:
  httpGet:
    path: /health
    port: 8080
  initialDelaySeconds: 5
  periodSeconds: 10
```

---

## Structured Logging

All logs are emitted as structured JSON via Pino. This enables machine-readable log pipelines (Elasticsearch, Cloud Logging, Loki, etc.).

### Log Format

```json
{
  "level": "info",
  "time": 1709568000000,
  "msg": "GET /api/market/prices 200 45ms",
  "reqId": "a1b2c3d4",
  "method": "GET",
  "path": "/api/market/prices",
  "status": 200,
  "latencyMs": 45
}
```

### Log Levels

| Level | `LOG_LEVEL` Value | Use Case |
|---|---|---|
| `fatal` | `fatal` | Unrecoverable errors — process will exit |
| `error` | `error` | Actionable errors — needs investigation |
| `warn` | `warn` | Degraded behavior — circuit breaker open, fallback used |
| `info` | `info` | Normal operations — request logs, startup, shutdown |
| `debug` | `debug` | Detailed operation — cache hits/misses, query details |
| `trace` | `trace` | Very detailed — raw payloads, full headers |

**Default:** `info` (set via `LOG_LEVEL` environment variable)

### Slow Request Warnings

Any request exceeding 5 seconds triggers a `warn`-level log entry:

```json
{
  "level": "warn",
  "time": 1709568000000,
  "msg": "Slow request: GET /api/ai/analyze took 7234ms",
  "method": "GET",
  "path": "/api/ai/analyze",
  "latencyMs": 7234
}
```

### Server-Timing Header

Every response includes a `Server-Timing` header for browser DevTools integration:

```
Server-Timing: total;dur=45.2
```

---

## Path Normalization

To prevent label cardinality explosion in Prometheus (which can cause memory issues), all dynamic path segments are normalized:

| Actual Path | Normalized Path |
|---|---|
| `/api/market/bitcoin` | `/api/market/:id` |
| `/api/defi/protocol/aave` | `/api/defi/protocol/:id` |
| `/api/keys/abc123` | `/api/keys/:key` |

The `normalizePath()` function in `metrics.ts` applies these transformations before recording metrics, ensuring a bounded set of metric labels regardless of how many unique paths are requested.

---

## Dashboard Setup

### Grafana

Import the Prometheus data source and create dashboards with these panels:

#### Overview Dashboard

| Panel | Query | Visualization |
|---|---|---|
| Request Rate | `rate(http_requests_total[5m])` | Time series |
| Error Rate | `rate(http_requests_total{status=~"5.."}[5m])` | Time series |
| P99 Latency | `histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m]))` | Gauge |
| Cache Hit Rate | `cache_hits_total / (cache_hits_total + cache_misses_total)` | Gauge |
| Circuit Breakers | `circuit_breaker_state` | State timeline |
| AI Queue Depth | `queue_depth{queue_name="ai"}` | Time series |
| WebSocket Connections | `active_websocket_connections` | Gauge |

#### Upstream Health Dashboard

| Panel | Query |
|---|---|
| Upstream latency by source | `histogram_quantile(0.95, rate(upstream_request_duration_seconds_bucket[5m])) by (source)` |
| 429 rate per source | `rate(upstream_requests_total{status="429"}[5m]) by (source)` |
| Upstream error rates | `rate(upstream_requests_total{status=~"[45].."}[5m]) by (source)` |

---

## Alerting Recommendations

### Critical Alerts

| Alert | Condition | Severity |
|---|---|---|
| High Error Rate | 5xx rate > 5% for 5 minutes | Critical |
| All Circuit Breakers Open | All hosts have `circuit_breaker_state == 1` | Critical |
| AI Queue Full | `queue_depth{queue_name="ai"} > 450` for 2 minutes | Critical |
| Health Check Failing | `/health` returns non-200 for 3 checks | Critical |
| Process OOM | RSS > 90% of memory limit | Critical |

### Warning Alerts

| Alert | Condition | Severity |
|---|---|---|
| Elevated Latency | P99 > 5s for 10 minutes | Warning |
| Cache Hit Rate Drop | Cache hit rate < 50% for 15 minutes | Warning |
| Circuit Breaker Open | Any host `circuit_breaker_state == 1` for > 5 minutes | Warning |
| Queue Saturation | AI queue > 50% capacity for 10 minutes | Warning |
| Upstream Degraded | Any source 429 rate > 10/min for 5 minutes | Warning |

### Example Alertmanager Rules

```yaml
groups:
  - name: crypto-vision
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m]) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High 5xx error rate ({{ $value | humanizePercentage }})"

      - alert: CircuitBreakerOpen
        expr: circuit_breaker_state == 1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Circuit breaker open for {{ $labels.host }}"

      - alert: AIQueueSaturation
        expr: queue_depth{queue_name="ai"} / 500 > 0.9
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "AI queue at {{ $value | humanizePercentage }} capacity"
```
