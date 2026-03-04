# Infrastructure

> Deployment, CI/CD, and infrastructure configuration for Crypto Vision.

## Deployment Options

| Method | Complexity | Monthly Cost | Best For |
|---|---|---|---|
| Docker Compose | Low | ~$43 (Hetzner) | Development, small deployments |
| Kubernetes | Medium | ~$50–150 | Production self-hosted |
| GCP Cloud Run | Low | ~$305 | Production managed |
| Bare metal | High | Varies | Maximum control |

---

## Docker Compose

### Full Stack

```bash
docker compose up -d
```

**Services:**

| Service | Image | Port | Description |
|---|---|---|---|
| `api` | Dockerfile (build) | 8080 | Hono API server (2G RAM, 4 CPU) |
| `redis` | redis:7-alpine | 6379 | Cache (256MB, allkeys-lru) |
| `postgres` | postgres:16-alpine | 5432 | Bot database (user: cryptovision, db: cryptovision) |
| `scheduler` | alpine (cron) | — | Periodic data refresh |

**Scheduler jobs:**
- Coins: every 2 min
- Trending/global/news: every 5 min
- Fear & Greed: every 15 min
- DeFi protocols: every 10 min

### Ingestion Workers

```bash
docker compose -f docker-compose.ingest.yml up -d
```

**Services:**

| Service | Frequency | Description |
|---|---|---|
| `pubsub-emulator` | — | GCP Pub/Sub emulator (port 8085) |
| `worker-market` | 2 min | Market data ingestion |
| `worker-defi` | 5 min | DeFi protocol data |
| `worker-news` | 5 min | News aggregation |
| `worker-dex` | 2 min | DEX pair data |
| `worker-derivatives` | 10 min | Derivatives/perps data |
| `worker-onchain` | 5 min | On-chain metrics |
| `worker-governance` | 30 min | Governance proposals |
| `worker-macro` | 60 min | Macro economic data |

### Dockerfiles

| File | Base | Purpose |
|---|---|---|
| `Dockerfile` | node:22-alpine | API server (3-stage: deps→build→run) |
| `Dockerfile.worker` | node:22-alpine | Ingestion workers (STOPSIGNAL SIGTERM) |
| `Dockerfile.train` | nvidia/cuda:12.4.0 | ML training (Python 3.11, PyTorch 2.4, Unsloth, vLLM) |

---

## Kubernetes

Manifests in `infra/k8s/` use Kustomize. Compatible with GKE, EKS, AKS, k3s.

### Apply

```bash
kubectl apply -k infra/k8s/
```

### Resources

| Resource | File | Description |
|---|---|---|
| Namespace | `namespace.yml` | `crypto-vision` namespace |
| Deployment | `deployment.yml` | 2 replicas, rolling update (maxSurge: 1, maxUnavailable: 0) |
| Service | `service.yml` | ClusterIP on port 80 → 8080 |
| HPA | `hpa.yml` | Auto-scale 2→20 pods (70% CPU target) |
| Redis | `redis.yml` | Single-replica Redis with PVC |
| CronJobs | `cronjobs.yml` | Ingestion workers on schedule |
| PDB | `policies.yml` | Pod Disruption Budget (minAvailable: 1) |
| NetworkPolicy | `policies.yml` | Restrict ingress to API port only |
| Secrets | `secrets.example.yml` | Template for API keys and config |
| PVC | `redis-pvc.yml` | 5Gi persistent volume for Redis |

### Probes

```yaml
startupProbe:
  httpGet: { path: /health, port: 8080 }
  failureThreshold: 30
  periodSeconds: 2

readinessProbe:
  httpGet: { path: /api/ready, port: 8080 }
  periodSeconds: 10
  failureThreshold: 3

livenessProbe:
  httpGet: { path: /health, port: 8080 }
  periodSeconds: 30
  failureThreshold: 3
```

### ML Training Job

```bash
kubectl apply -f infra/k8s/training-job.yaml
```

Requests `nvidia.com/gpu: 1` resource. Uses `Dockerfile.train` image.

### Inference Deployment

```bash
kubectl apply -f infra/k8s/inference-deployment.yaml
```

Runs vLLM with the fine-tuned model, exposed as a service.

---

## GCP Cloud Run

### Quick Deploy (Shell Script)

```bash
cd infra && bash setup.sh
```

The `infra/setup.sh` script (528 lines) provisions:

1. Enable GCP APIs (Run, BigQuery, Pub/Sub, Redis, Secret Manager, Scheduler, Artifact Registry)
2. Create Artifact Registry repository
3. Create service accounts (Cloud Run SA + Scheduler SA)
4. Create VPC connector (10.8.0.0/28)
5. Create Memorystore Redis (STANDARD_HA, 5GB, Redis 7)
6. Create Secret Manager secrets (7 secrets)
7. Create Cloud Scheduler jobs (7 scheduled endpoints)
8. Map custom domain
9. Configure monitoring alerts

### Terraform

```bash
cd infra/terraform
terraform init
terraform plan
terraform apply
```

**Terraform modules:**

| File | Resources |
|---|---|
| `main.tf` | Provider config, locals |
| `variables.tf` | Input variables with defaults |
| `apis.tf` | GCP API enablement |
| `network.tf` | VPC connector for Cloud Run → Redis |
| `redis.tf` | Memorystore Redis (STANDARD_HA, 5GB) |
| `secrets.tf` | Secret Manager secrets |
| `iam.tf` | Service accounts and IAM bindings |
| `cloud_run.tf` | Cloud Run service (2Gi, 4 CPU, 2–500 instances) |
| `scheduler.tf` | Cloud Scheduler (37 cron jobs) |
| `monitoring.tf` | Uptime checks and alert policies |
| `bigquery.tf` | Dataset + 18 tables + 10 materialized views |
| `pubsub.tf` | 5 topic tiers + dead letter queues |
| `gke-gpu.tf` | GKE cluster for GPU training |
| `vertex.tf` | Vertex AI endpoint for inference |
| `export.tf` | GCS bucket for data exports |
| `outputs.tf` | Service URL, Redis host, etc. |

**Key variables:**

| Variable | Default | Description |
|---|---|---|
| `project_id` | — | GCP project ID (required) |
| `region` | `us-central1` | Deployment region |
| `service_name` | `crypto-vision` | Cloud Run service name |
| `domain` | `cryptocurrency.cv` | Custom domain |
| `redis_tier` | `STANDARD_HA` | Redis tier |
| `redis_memory_size_gb` | `5` | Redis memory |
| `cloud_run_memory` | `2Gi` | Container memory |
| `cloud_run_cpu` | `4` | Container CPUs |
| `min_instances` | `2` | Minimum instances |
| `max_instances` | `500` | Maximum instances |

### Teardown

```bash
cd infra && bash teardown.sh
```

---

## CI/CD (Cloud Build)

### API Pipeline (`cloudbuild.yaml`)

9-step pipeline with canary deployment:

```
1. npm install
2. Typecheck (npx tsc --noEmit)     ─┐
3. Lint (npx eslint .)               ├── Parallel
4. Test (npx vitest run)            ─┘
5. Build (npm run build)
6. Docker push to Artifact Registry
7. Canary deploy (5% traffic)
8. Health check verification
9. Promote to 100% traffic
```

**Cloud Run config:**
- Memory: 2Gi
- CPU: 4
- Min instances: 2
- Max instances: 500
- Concurrency: 250
- Execution environment: gen2

### Workers Pipeline (`cloudbuild-workers.yaml`)

Builds and deploys 8 Cloud Run Jobs:

| Job | Schedule | Worker |
|---|---|---|
| `worker-market` | `*/2 * * * *` | ingest-market.js |
| `worker-defi` | `*/5 * * * *` | ingest-defi.js |
| `worker-news` | `*/5 * * * *` | ingest-news.js |
| `worker-dex` | `*/2 * * * *` | ingest-dex.js |
| `worker-derivatives` | `*/10 * * * *` | ingest-derivatives.js |
| `worker-onchain` | `*/5 * * * *` | ingest-onchain.js |
| `worker-governance` | `*/30 * * * *` | ingest-governance.js |
| `worker-macro` | `0 * * * *` | ingest-macro.js |

Plus: `backfill-historical` job (on-demand).

---

## Pub/Sub Topics

5 tiers organized by latency requirements:

### Tier 1: Realtime (<1s)

| Topic | Sources |
|---|---|
| `realtime-binance-trades` | Binance WebSocket |
| `realtime-bybit-trades` | Bybit WebSocket |
| `realtime-hyperliquid-trades` | Hyperliquid WebSocket |
| `realtime-deribit-trades` | Deribit WebSocket |
| `realtime-coincap-prices` | CoinCap WebSocket |
| `realtime-mempool-blocks` | mempool.space WebSocket |

### Tier 2: Frequent (1–2 min)

| Topic | Data |
|---|---|
| `frequent-prices` | Coin prices (top 250) |
| `frequent-gas` | Multi-chain gas prices |
| `frequent-dex-pairs` | DEX pair updates |
| `frequent-fear-greed` | Fear & Greed Index |
| `frequent-market-snapshots` | Full market snapshots |

### Tier 3: Standard (5–10 min)

| Topic | Data |
|---|---|
| `standard-trending` | Trending coins |
| `standard-defi-*` | DeFi protocols, chains, yields, stablecoins |
| `standard-news` | News articles |
| `standard-derivatives` | Derivatives data |

### Tier 4: Hourly (30–60 min)

| Topic | Data |
|---|---|
| `hourly-exchanges` | Exchange snapshots |
| `hourly-categories` | Market categories |
| `hourly-bridges` | Bridge volumes |
| `hourly-funding-rounds` | Funding events |
| `hourly-l2` | L2 metrics |
| `hourly-governance` | Governance proposals |
| `hourly-depin` | DePIN data |
| `hourly-macro` | Macro indicators |

### Tier 5: Daily (24h)

| Topic | Data |
|---|---|
| `daily-ohlc-backfill` | OHLC candle backfill |
| `daily-protocol-details` | Detailed protocol data |
| `daily-bitcoin-network` | Bitcoin network stats |
| `daily-security-scans` | Security audit scans |

Each tier has a corresponding dead letter topic (`*-dlq`) for failed messages.

---

## Monitoring & Observability

### Health Checks

```bash
# Basic health
curl http://localhost:8080/health

# Readiness (Kubernetes probe)
curl http://localhost:8080/api/ready

# Prometheus metrics
curl http://localhost:8080/metrics
```

### Prometheus Metrics

| Metric | Type | Description |
|---|---|---|
| `http_requests_total` | counter | Total requests by method, path, status |
| `http_request_duration_seconds` | histogram | Request latency |
| `cache_hits_total` | counter | Cache hit count |
| `cache_misses_total` | counter | Cache miss count |
| `circuit_breaker_state` | gauge | Circuit breaker state (0=closed, 1=open) |
| `websocket_connections` | gauge | Active WebSocket connections |
| `ai_requests_total` | counter | AI provider requests by provider |
| `upstream_errors_total` | counter | Upstream API errors by source |

### Logging

Structured JSON via Pino. Key fields:

```json
{
  "level": "info",
  "time": 1709510400000,
  "msg": "Request completed",
  "requestId": "uuid",
  "method": "GET",
  "path": "/api/coins",
  "status": 200,
  "duration": 42,
  "cached": true
}
```

### Alerting (GCP)

Terraform provisions alerts for:
- Uptime check failures (5xx or timeout)
- High error rate (>5% of requests)
- High latency (p95 > 5s)
- Instance count at max_instances

---

## Cloud Scheduler Jobs (37)

The Terraform scheduler module creates 37 jobs that hit API endpoints on a schedule to warm caches and trigger ingestion:

| Category | Jobs | Frequency |
|---|---|---|
| Market data | coins, price, trending, global, categories, fear-greed, exchanges | 2–15 min |
| DeFi | protocols, chains, yields, stablecoins, dex-volumes, fees, bridges, raises | 5–60 min |
| News | articles, search, bitcoin, defi, breaking | 3–5 min |
| On-chain | gas, bitcoin-fees, bitcoin-stats | 2–5 min |
| DEX | trending, pools | 2–5 min |
| Derivatives | funding, oi, liquidations | 5–10 min |
| Others | l2, governance, depin, macro, nft, whales, staking, solana, etf | 10–60 min |
| AI | digest, signals (cache warm) | 10–15 min |

---

## Directory Structure

```
infra/
├── README.md              # Infrastructure overview
├── setup.sh               # GCP provisioning script (528 lines)
├── teardown.sh            # GCP teardown script
├── bigquery/              # BigQuery table definitions
├── k8s/                   # Kubernetes manifests
│   ├── kustomization.yml
│   ├── namespace.yml
│   ├── deployment.yml
│   ├── service.yml
│   ├── hpa.yml
│   ├── redis.yml
│   ├── redis-pvc.yml
│   ├── cronjobs.yml
│   ├── policies.yml
│   ├── secrets.example.yml
│   ├── inference-deployment.yaml
│   └── training-job.yaml
├── pubsub/                # Pub/Sub topic definitions
├── scheduler/             # Scheduler job configs
└── terraform/             # Full Terraform IaC
    ├── main.tf
    ├── variables.tf
    ├── apis.tf
    ├── network.tf
    ├── redis.tf
    ├── secrets.tf
    ├── iam.tf
    ├── cloud_run.tf
    ├── scheduler.tf
    ├── monitoring.tf
    ├── bigquery.tf
    ├── pubsub.tf
    ├── gke-gpu.tf
    ├── vertex.tf
    ├── export.tf
    └── outputs.tf
```
