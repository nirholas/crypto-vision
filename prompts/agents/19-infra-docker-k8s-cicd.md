# Prompt 19 — Infrastructure: Docker, K8s & CI/CD

## Context

You are working on the deployment infrastructure for crypto-vision:

- `Dockerfile` — Main API server image
- `Dockerfile.worker` — Worker image
- `Dockerfile.train` — ML training image
- `docker-compose.yml` — Full stack (API + Redis + PostgreSQL)
- `docker-compose.ingest.yml` — Data ingestion workers
- `cloudbuild.yaml` — GCP Cloud Build CI/CD
- `cloudbuild-workers.yaml` — Worker deployment
- `infra/k8s/` — Kubernetes manifests (12 files)
- `infra/terraform/` — Terraform configs (18 files)
- `infra/setup.sh` — Infrastructure setup script
- `infra/teardown.sh` — Teardown script

## Task

### 1. Fix the Main Dockerfile

```dockerfile
# Multi-stage build for minimal production image
# Stage 1: Build
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --production=false
COPY . .
RUN npm run build

# Stage 2: Production
FROM node:22-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/agents/src ./agents/src

# Security: non-root user
RUN addgroup -g 1001 -S appuser && \
    adduser -S appuser -u 1001
USER appuser

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD wget -qO- http://localhost:8080/health || exit 1

CMD ["node", "dist/src/index.js"]
```

Verify this builds and runs correctly.

### 2. Fix docker-compose.yml

Ensure the compose file works for local development:
- API service: build from Dockerfile, port 8080, depends on Redis + Postgres
- Redis: redis:7-alpine, port 6379, persistence enabled
- PostgreSQL: postgres:16-alpine, port 5432, volume for data
- Health checks on all services
- Environment variables via `.env` file
- Resource limits (memory, CPU)

Add missing services:
- Dashboard: Next.js app from `apps/dashboard/`
- Workers: run data ingestion workers

### 3. Fix docker-compose.ingest.yml

Worker-specific compose for data ingestion:
- Each worker as a separate service
- Shared Redis and Postgres from main compose
- Configurable worker selection via env

### 4. Fix Kubernetes Manifests

**`infra/k8s/deployment.yml`:**
- Deployment with 2 replicas
- Resource limits: 512Mi memory, 500m CPU
- Liveness probe: GET /health every 30s
- Readiness probe: GET /health every 10s
- Rolling update strategy: maxUnavailable=0, maxSurge=1
- Environment from ConfigMap and Secrets

**`infra/k8s/service.yml`:**
- ClusterIP service on port 80 → target 8080
- Optional LoadBalancer type via annotation

**`infra/k8s/hpa.yml`:**
- Horizontal Pod Autoscaler: 2-10 replicas
- Scale on CPU (70%) and memory (80%)
- Scale on custom metric: requests per second

**`infra/k8s/redis.yml`:**
- Redis deployment with persistence
- PVC for data (1Gi)
- Resource limits

**`infra/k8s/cronjobs.yml`:**
- CronJobs for data ingestion workers
- Market data: every 2 minutes
- DeFi data: every 5 minutes
- News: every 5 minutes

**`infra/k8s/secrets.example.yml`:**
- Template for required secrets
- All API keys, database URLs, etc.

**`infra/k8s/policies.yml`:**
- NetworkPolicy: restrict pod-to-pod communication
- PodDisruptionBudget: minAvailable=1

### 5. Fix Cloud Build CI/CD

**`cloudbuild.yaml`:**
```yaml
# CI/CD pipeline for GCP Cloud Build:
# 1. Install dependencies
# 2. Run typecheck
# 3. Run all tests
# 4. Build Docker image
# 5. Push to Artifact Registry
# 6. Deploy to Cloud Run
# 7. Run smoke tests against deployed URL
```

### 6. Create GitHub Actions CI (alternative to Cloud Build)

Create `.github/workflows/ci.yml`:
```yaml
# GitHub Actions CI:
# On push to main and PRs:
# 1. Lint (eslint)
# 2. Typecheck (tsc --noEmit)
# 3. Unit tests (vitest run)
# 4. Build (tsc -p tsconfig.build.json)
# 5. Docker build (verify Dockerfile works)
#
# On push to main only:
# 6. Push Docker image to GHCR
# 7. Deploy to staging
```

### 7. Create .env.example

Comprehensive `.env.example` with ALL required and optional env vars:
```bash
# Required
PORT=8080
NODE_ENV=production
REDIS_URL=redis://localhost:6379
DATABASE_URL=postgresql://user:pass@localhost:5432/cryptovision

# API Keys (at least one AI provider required)
GROQ_API_KEY=
GOOGLE_GEMINI_API_KEY=
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
OPENROUTER_API_KEY=

# Optional
COINGECKO_API_KEY=
COINGLASS_API_KEY=
... (all optional keys)
```

## Verification

1. `docker compose up -d --build` starts all services
2. `curl http://localhost:8080/health` returns 200
3. `docker compose down` cleans up
4. Kubernetes manifests are valid: `kubectl apply --dry-run=client -f infra/k8s/`
5. Cloud Build config is valid YAML
6. GitHub Actions workflow is valid
