# Monitoring & Observability Guide

> **⚠️ CRITICAL: Proper monitoring is essential for a financial application handling user funds.**

## Table of Contents

1. [Overview](#overview)
2. [Metrics](#metrics)
3. [Prometheus Setup](#prometheus-setup)
4. [Grafana Dashboards](#grafana-dashboards)
5. [Alerting](#alerting)
6. [Logging](#logging)
7. [Health Checks](#health-checks)
8. [Tracing](#tracing)

---

## Overview

Sweep uses a comprehensive observability stack:

| Component | Technology | Purpose |
|-----------|------------|---------|
| **Metrics** | Prometheus | Time-series metrics collection |
| **Visualization** | Grafana | Dashboards and visualization |
| **Alerting** | Alertmanager | Alert routing and notifications |
| **Logging** | Structured JSON | Application logs |
| **Health Checks** | HTTP endpoints | Kubernetes probes |

### Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       OBSERVABILITY ARCHITECTURE                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                    │
│   │  API Pods   │    │   Workers   │    │   Redis     │                    │
│   │  /metrics   │    │             │    │             │                    │
│   └──────┬──────┘    └──────┬──────┘    └──────┬──────┘                    │
│          │                  │                  │                            │
│          └──────────────────┴──────────────────┘                            │
│                             │                                               │
│                             ▼                                               │
│                    ┌─────────────────┐                                      │
│                    │   Prometheus    │                                      │
│                    │  (scrape/store) │                                      │
│                    └────────┬────────┘                                      │
│                             │                                               │
│              ┌──────────────┼──────────────┐                               │
│              │              │              │                               │
│              ▼              ▼              ▼                               │
│     ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                     │
│     │   Grafana   │  │ Alertmanager│  │   Storage   │                     │
│     │ (dashboards)│  │  (alerts)   │  │  (long-term)│                     │
│     └─────────────┘  └──────┬──────┘  └─────────────┘                     │
│                             │                                               │
│                             ▼                                               │
│                    ┌─────────────────┐                                      │
│                    │  Slack/PagerDuty│                                      │
│                    │   (notifications)│                                     │
│                    └─────────────────┘                                      │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Metrics

### Application Metrics

The API server exposes Prometheus metrics at `/metrics` (port 9090).

#### HTTP Metrics

```prometheus
# Request count by endpoint and status
sweep_http_requests_total{method, path, status}

# Request duration histogram
sweep_http_request_duration_seconds{method, path}

# Active connections
sweep_http_connections_active
```

#### Business Metrics

```prometheus
# Sweep operations
sweep_sweeps_total{status, chain}           # Total sweeps by status
sweep_sweeps_value_usd{chain}               # Total USD value swept
sweep_sweeps_duration_seconds{chain}        # Sweep execution time

# Quotes
sweep_quotes_total{status}                  # Quotes generated
sweep_quotes_expired_total                  # Expired quotes

# Tokens
sweep_tokens_scanned_total{chain}           # Tokens scanned
sweep_dust_value_usd{chain}                 # Total dust value

# Subscriptions
sweep_subscriptions_active                  # Active subscriptions
sweep_subscription_sweeps_total{status}     # Auto-sweep executions
```

#### Queue Metrics

```prometheus
# Job counts
sweep_queue_jobs_total{queue, status}       # Jobs by queue and status
sweep_queue_jobs_waiting{queue}             # Waiting jobs
sweep_queue_jobs_active{queue}              # Active jobs
sweep_queue_jobs_failed{queue}              # Failed jobs

# Job timing
sweep_queue_job_duration_seconds{queue}     # Job processing time
sweep_queue_job_wait_seconds{queue}         # Time in queue
```

#### External Service Metrics

```prometheus
# DEX aggregators
sweep_dex_requests_total{provider, status}  # Requests by provider
sweep_dex_latency_seconds{provider}         # Response time

# Price oracles
sweep_price_requests_total{source, status}  # Price fetches
sweep_price_staleness_seconds{chain}        # Price age

# Bundlers
sweep_bundler_requests_total{provider}      # Bundler requests
sweep_bundler_userops_total{status}         # UserOp submissions
```

### Metric Implementation

```typescript
// src/api/middleware/metrics.ts
import { Registry, Counter, Histogram, Gauge } from "prom-client";

export const registry = new Registry();

// HTTP metrics
export const httpRequestsTotal = new Counter({
  name: "sweep_http_requests_total",
  help: "Total HTTP requests",
  labelNames: ["method", "path", "status"],
  registers: [registry],
});

export const httpRequestDuration = new Histogram({
  name: "sweep_http_request_duration_seconds",
  help: "HTTP request duration",
  labelNames: ["method", "path"],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 5, 10],
  registers: [registry],
});

// Business metrics
export const sweepsTotal = new Counter({
  name: "sweep_sweeps_total",
  help: "Total sweep operations",
  labelNames: ["status", "chain"],
  registers: [registry],
});

// Middleware
export function metricsMiddleware() {
  return async (c, next) => {
    const start = Date.now();
    
    await next();
    
    const duration = (Date.now() - start) / 1000;
    const path = c.req.path;
    const method = c.req.method;
    const status = c.res.status;
    
    httpRequestsTotal.inc({ method, path, status });
    httpRequestDuration.observe({ method, path }, duration);
  };
}
```

---

## Prometheus Setup

### Configuration

Located at `monitoring/prometheus.yml`:

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s
  external_labels:
    environment: production
    app: sweep

alerting:
  alertmanagers:
    - static_configs:
        - targets: ["alertmanager:9093"]

rule_files:
  - /etc/prometheus/rules/*.yml

scrape_configs:
  # API metrics
  - job_name: "sweep-api"
    metrics_path: /metrics
    kubernetes_sd_configs:
      - role: pod
        namespaces:
          names: ["sweep"]
    relabel_configs:
      - source_labels: [__meta_kubernetes_pod_label_app_kubernetes_io_component]
        action: keep
        regex: api

  # Redis metrics
  - job_name: "redis"
    static_configs:
      - targets: ["redis-exporter:9121"]

  # PostgreSQL metrics
  - job_name: "postgres"
    static_configs:
      - targets: ["postgres-exporter:9187"]
```

### Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: prometheus
  namespace: monitoring
spec:
  replicas: 1
  template:
    spec:
      containers:
        - name: prometheus
          image: prom/prometheus:v2.47.0
          args:
            - "--config.file=/etc/prometheus/prometheus.yml"
            - "--storage.tsdb.path=/prometheus"
            - "--storage.tsdb.retention.time=30d"
          ports:
            - containerPort: 9090
          volumeMounts:
            - name: config
              mountPath: /etc/prometheus
            - name: storage
              mountPath: /prometheus
      volumes:
        - name: config
          configMap:
            name: prometheus-config
        - name: storage
          persistentVolumeClaim:
            claimName: prometheus-pvc
```

---

## Grafana Dashboards

### Available Dashboards

Located at `monitoring/grafana/dashboards/`:

| Dashboard | File | Purpose |
|-----------|------|---------|
| **API Overview** | `api-dashboard.json` | HTTP metrics, latency, errors |
| **Queue Metrics** | `queue-dashboard.json` | Job processing, queue depths |
| **DeFi Metrics** | `defi-dashboard.json` | Protocol usage, TVL |

### API Dashboard Panels

1. **Request Rate** - Requests per second by endpoint
2. **Error Rate** - 4xx/5xx responses
3. **Latency Percentiles** - p50, p95, p99
4. **Active Connections** - Concurrent connections
5. **Sweep Activity** - Sweeps by status
6. **Quote Conversion** - Quote → Execute rate

### Queue Dashboard Panels

1. **Queue Depths** - Jobs waiting per queue
2. **Processing Rate** - Jobs/second
3. **Job Duration** - Processing time distribution
4. **Failed Jobs** - Failed job count
5. **Worker Utilization** - Active workers

### Importing Dashboards

1. Open Grafana (http://localhost:3000)
2. Go to Dashboards → Import
3. Upload JSON file or paste contents
4. Select Prometheus data source
5. Click Import

### Creating Custom Dashboards

```json
{
  "dashboard": {
    "title": "Custom Sweep Metrics",
    "panels": [
      {
        "title": "Sweep Success Rate",
        "type": "gauge",
        "targets": [
          {
            "expr": "sum(rate(sweep_sweeps_total{status=\"confirmed\"}[5m])) / sum(rate(sweep_sweeps_total[5m])) * 100",
            "legendFormat": "Success Rate"
          }
        ],
        "fieldConfig": {
          "defaults": {
            "unit": "percent",
            "thresholds": {
              "steps": [
                { "value": 0, "color": "red" },
                { "value": 90, "color": "yellow" },
                { "value": 99, "color": "green" }
              ]
            }
          }
        }
      }
    ]
  }
}
```

---

## Alerting

### Alert Rules

Create `monitoring/prometheus/rules/alerts.yml`:

```yaml
groups:
  - name: sweep-critical
    rules:
      # High error rate
      - alert: HighErrorRate
        expr: |
          sum(rate(sweep_http_requests_total{status=~"5.."}[5m]))
          / sum(rate(sweep_http_requests_total[5m])) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value | humanizePercentage }}"

      # Sweep failures
      - alert: SweepFailureSpike
        expr: |
          sum(rate(sweep_sweeps_total{status="failed"}[5m]))
          / sum(rate(sweep_sweeps_total[5m])) > 0.1
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High sweep failure rate"
          description: "{{ $value | humanizePercentage }} of sweeps failing"

      # Queue backup
      - alert: QueueBacklog
        expr: sweep_queue_jobs_waiting{queue="sweep-execute"} > 100
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Sweep execution queue backing up"
          description: "{{ $value }} jobs waiting"

      # API latency
      - alert: HighLatency
        expr: |
          histogram_quantile(0.95, 
            rate(sweep_http_request_duration_seconds_bucket[5m])
          ) > 5
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High API latency"
          description: "p95 latency is {{ $value }}s"

      # Database connection issues
      - alert: DatabaseConnectionErrors
        expr: pg_up == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Database connection lost"

      # Redis connection issues
      - alert: RedisDown
        expr: redis_up == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Redis connection lost"

  - name: sweep-warning
    rules:
      # Price staleness
      - alert: StalePrices
        expr: sweep_price_staleness_seconds > 300
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Token prices are stale"
          description: "Prices for {{ $labels.chain }} are {{ $value }}s old"

      # Low subscription activity
      - alert: SubscriptionMonitorStalled
        expr: |
          time() - sweep_subscription_last_check_timestamp > 600
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Subscription monitor not running"
```

### Alertmanager Configuration

```yaml
# monitoring/alertmanager.yml
global:
  slack_api_url: "https://hooks.slack.com/services/xxx/xxx/xxx"

route:
  receiver: "slack-notifications"
  group_by: ["alertname", "severity"]
  group_wait: 30s
  group_interval: 5m
  repeat_interval: 4h

  routes:
    - match:
        severity: critical
      receiver: "pagerduty-critical"
      continue: true
    
    - match:
        severity: warning
      receiver: "slack-notifications"

receivers:
  - name: "slack-notifications"
    slack_configs:
      - channel: "#sweep-alerts"
        send_resolved: true
        title: "{{ .Status | toUpper }}: {{ .CommonAnnotations.summary }}"
        text: "{{ .CommonAnnotations.description }}"

  - name: "pagerduty-critical"
    pagerduty_configs:
      - service_key: "your-pagerduty-key"
        severity: critical
```

---

## Logging

### Structured Logging

All logs are JSON formatted for easy parsing:

```typescript
// src/utils/logger.ts
export function log(level: string, message: string, meta?: object) {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    message,
    ...meta,
  }));
}

export const logger = {
  info: (msg: string, meta?: object) => log("info", msg, meta),
  warn: (msg: string, meta?: object) => log("warn", msg, meta),
  error: (msg: string, meta?: object) => log("error", msg, meta),
  debug: (msg: string, meta?: object) => log("debug", msg, meta),
};

// Usage
logger.info("Sweep started", { 
  sweepId: "123", 
  userId: "456", 
  chain: "base" 
});
```

### Log Levels

| Level | Usage |
|-------|-------|
| `error` | Errors requiring attention |
| `warn` | Potential issues |
| `info` | Normal operations |
| `debug` | Detailed debugging (disabled in prod) |

### Log Output

```json
{
  "timestamp": "2026-01-22T12:00:00.000Z",
  "level": "info",
  "message": "Sweep completed",
  "sweepId": "abc-123",
  "userId": "user-456",
  "chain": "base",
  "tokensSwept": 5,
  "valueUsd": 12.50,
  "durationMs": 3500
}
```

### Kubernetes Log Aggregation

Logs are collected via:
- **Fluentd** / **Fluent Bit** - Log collection
- **Elasticsearch** / **Loki** - Log storage
- **Kibana** / **Grafana** - Log visualization

---

## Health Checks

### Endpoints

| Endpoint | Purpose | Response |
|----------|---------|----------|
| `/health` | General health | `200 OK` or `503` |
| `/health/live` | Liveness probe | `200 OK` |
| `/health/ready` | Readiness probe | `200 OK` or `503` |

### Implementation

```typescript
// src/api/routes/health.ts
import { Hono } from "hono";
import { getDb } from "@/db";
import { getRedis } from "@/utils/redis";

const health = new Hono();

// Basic health check
health.get("/", async (c) => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Liveness - is the process running?
health.get("/live", (c) => {
  return c.json({ status: "live" });
});

// Readiness - can we serve requests?
health.get("/ready", async (c) => {
  try {
    // Check database
    const db = getDb();
    await db.execute("SELECT 1");
    
    // Check Redis
    const redis = getRedis();
    await redis.ping();
    
    return c.json({ 
      status: "ready",
      checks: {
        database: "ok",
        redis: "ok",
      }
    });
  } catch (error) {
    return c.json({ 
      status: "not ready",
      error: error.message 
    }, 503);
  }
});

export default health;
```

### Kubernetes Probe Configuration

```yaml
livenessProbe:
  httpGet:
    path: /health/live
    port: 3000
  initialDelaySeconds: 10
  periodSeconds: 10
  timeoutSeconds: 5
  failureThreshold: 3

readinessProbe:
  httpGet:
    path: /health/ready
    port: 3000
  initialDelaySeconds: 5
  periodSeconds: 5
  timeoutSeconds: 3
  failureThreshold: 3
```

---

## Tracing

### Distributed Tracing (Optional)

For complex debugging, implement OpenTelemetry:

```typescript
// src/utils/tracing.ts
import { trace, SpanStatusCode } from "@opentelemetry/api";

const tracer = trace.getTracer("sweep-api");

export async function withTrace<T>(
  name: string, 
  fn: () => Promise<T>
): Promise<T> {
  return tracer.startActiveSpan(name, async (span) => {
    try {
      const result = await fn();
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
      throw error;
    } finally {
      span.end();
    }
  });
}

// Usage
await withTrace("execute-sweep", async () => {
  // Sweep logic
});
```

---

## Quick Reference

### Common PromQL Queries

```promql
# Request rate
sum(rate(sweep_http_requests_total[5m])) by (path)

# Error rate percentage
sum(rate(sweep_http_requests_total{status=~"5.."}[5m])) 
/ sum(rate(sweep_http_requests_total[5m])) * 100

# p95 latency
histogram_quantile(0.95, 
  sum(rate(sweep_http_request_duration_seconds_bucket[5m])) by (le, path)
)

# Sweep success rate
sum(rate(sweep_sweeps_total{status="confirmed"}[5m])) 
/ sum(rate(sweep_sweeps_total[5m])) * 100

# Queue depth
sweep_queue_jobs_waiting{queue="sweep-execute"}

# Active workers
sweep_queue_jobs_active
```

### Accessing Services

| Service | Local URL | K8s Port-Forward |
|---------|-----------|------------------|
| Prometheus | http://localhost:9090 | `kubectl port-forward svc/prometheus 9090:9090 -n monitoring` |
| Grafana | http://localhost:3000 | `kubectl port-forward svc/grafana 3000:3000 -n monitoring` |
| Alertmanager | http://localhost:9093 | `kubectl port-forward svc/alertmanager 9093:9093 -n monitoring` |

---

## Related Documentation

- [DEPLOYMENT.md](./DEPLOYMENT.md) - Production deployment
- [QUEUE_WORKERS.md](./QUEUE_WORKERS.md) - Worker monitoring
- [SECURITY.md](./SECURITY.md) - Security monitoring
