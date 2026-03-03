# Deployment Guide

> **⚠️ CRITICAL: This application handles user funds. Follow all security practices for production deployments.**

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Container Images](#container-images)
4. [Kubernetes Deployment](#kubernetes-deployment)
5. [Secrets Management](#secrets-management)
6. [Database Setup](#database-setup)
7. [Deployment Procedure](#deployment-procedure)
8. [Rollback Procedure](#rollback-procedure)
9. [Health Checks](#health-checks)
10. [Scaling](#scaling)
11. [CI/CD Pipeline](#cicd-pipeline)

---

## Overview

Sweep is deployed as a containerized application on Kubernetes with the following components:

| Component | Replicas | Description |
|-----------|----------|-------------|
| **API Server** | 3 | REST API (Hono + Node.js) |
| **Workers** | 2 | Background job processors |
| **PostgreSQL** | 1 | Primary database |
| **Redis** | 1 | Queue & cache |

### Architecture

```
                    ┌─────────────┐
                    │   Ingress   │
                    │   (nginx)   │
                    └──────┬──────┘
                           │
              ┌────────────┴────────────┐
              │                         │
        ┌─────▼─────┐            ┌──────▼──────┐
        │  API Pod  │            │  API Pod    │
        │  (x3)     │            │  (replica)  │
        └─────┬─────┘            └──────┬──────┘
              │                         │
              └────────────┬────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
  ┌─────▼─────┐     ┌──────▼──────┐   ┌───────▼───────┐
  │ PostgreSQL│     │    Redis    │   │    Workers    │
  │           │     │             │   │     (x2)      │
  └───────────┘     └─────────────┘   └───────────────┘
```

---

## Prerequisites

### Required Access

- Kubernetes cluster (GKE, EKS, AKS, or self-managed)
- Container registry (ghcr.io, Docker Hub, or private)
- Domain name with DNS management
- SSL/TLS certificates (cert-manager recommended)

### Required Tools

```bash
# Kubernetes CLI
brew install kubectl

# Helm (for dependencies)
brew install helm

# Docker
brew install --cask docker
```

### Cluster Requirements

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| Nodes | 2 | 3+ |
| CPU | 4 cores | 8+ cores |
| Memory | 8 GB | 16+ GB |
| Storage | 50 GB | 100+ GB |

---

## Container Images

### Build Images

```bash
# Build API image
docker build -t ghcr.io/nirholas/sweep-api:v1.0.0 -f Dockerfile .

# Build Workers image
docker build -t ghcr.io/nirholas/sweep-workers:v1.0.0 -f Dockerfile.workers .
```

### Push to Registry

```bash
# Authenticate
echo $GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin

# Push images
docker push ghcr.io/nirholas/sweep-api:v1.0.0
docker push ghcr.io/nirholas/sweep-workers:v1.0.0
```

### Image Tags

| Tag | Purpose |
|-----|---------|
| `latest` | Current staging build |
| `v1.0.0` | Semantic version for production |
| `main-abc123` | Commit SHA for traceability |

---

## Kubernetes Deployment

### Namespace Setup

```bash
# Create namespace
kubectl apply -f k8s/namespace.yaml

# Verify
kubectl get namespace sweep
```

### Deploy Components

```bash
# 1. Apply ConfigMap
kubectl apply -f k8s/configmap.yaml

# 2. Apply Secrets (see Secrets Management section)
kubectl apply -f k8s/secrets.yaml

# 3. Deploy PostgreSQL
kubectl apply -f k8s/postgres-deployment.yaml

# 4. Deploy Redis
kubectl apply -f k8s/redis-deployment.yaml

# 5. Wait for databases
kubectl wait --for=condition=ready pod -l app.kubernetes.io/component=postgres -n sweep --timeout=120s
kubectl wait --for=condition=ready pod -l app.kubernetes.io/component=redis -n sweep --timeout=60s

# 6. Run database migrations
kubectl run migration --rm -it --restart=Never \
  --image=ghcr.io/nirholas/sweep-api:v1.0.0 \
  -n sweep \
  --env="DATABASE_URL=$DATABASE_URL" \
  -- npm run db:migrate

# 7. Deploy API
kubectl apply -f k8s/api-deployment.yaml
kubectl apply -f k8s/api-service.yaml

# 8. Deploy Workers
kubectl apply -f k8s/workers-deployment.yaml

# 9. Deploy Ingress
kubectl apply -f k8s/api-ingress.yaml

# 10. Deploy HPA (auto-scaling)
kubectl apply -f k8s/hpa.yaml
```

### Verify Deployment

```bash
# Check all pods
kubectl get pods -n sweep

# Check services
kubectl get svc -n sweep

# Check ingress
kubectl get ingress -n sweep

# View logs
kubectl logs -f deployment/sweep-api -n sweep
kubectl logs -f deployment/sweep-workers -n sweep
```

---

## Secrets Management

### ⚠️ NEVER Commit Real Secrets

The `k8s/secrets.yaml` file is a template only. Create secrets using one of these methods:

### Method 1: kubectl (Simple)

```bash
kubectl create secret generic sweep-secrets -n sweep \
  --from-literal=DATABASE_PASSWORD='secure_password_here' \
  --from-literal=PIMLICO_API_KEY='pim_xxx' \
  --from-literal=ALCHEMY_API_KEY='xxx' \
  --from-literal=ONEINCH_API_KEY='xxx' \
  --from-literal=LIFI_API_KEY='xxx' \
  --from-literal=COINGECKO_API_KEY='xxx' \
  --from-literal=RPC_ETHEREUM='https://eth-mainnet.g.alchemy.com/v2/xxx' \
  --from-literal=RPC_BASE='https://base-mainnet.g.alchemy.com/v2/xxx' \
  --from-literal=RPC_ARBITRUM='https://arb-mainnet.g.alchemy.com/v2/xxx' \
  --from-literal=RPC_POLYGON='https://polygon-mainnet.g.alchemy.com/v2/xxx' \
  --from-literal=RPC_OPTIMISM='https://opt-mainnet.g.alchemy.com/v2/xxx' \
  --from-literal=RPC_BSC='https://bsc-dataseed1.binance.org' \
  --from-literal=RPC_LINEA='https://linea-mainnet.g.alchemy.com/v2/xxx' \
  --from-literal=RPC_SOLANA='https://api.mainnet-beta.solana.com'
```

### Method 2: Sealed Secrets (Recommended)

```bash
# Install sealed-secrets controller
helm repo add sealed-secrets https://bitnami-labs.github.io/sealed-secrets
helm install sealed-secrets sealed-secrets/sealed-secrets -n kube-system

# Create sealed secret
kubeseal --format=yaml < secrets.yaml > sealed-secrets.yaml

# Apply sealed secret
kubectl apply -f sealed-secrets.yaml
```

### Method 3: External Secrets Operator

```bash
# Install ESO
helm repo add external-secrets https://charts.external-secrets.io
helm install external-secrets external-secrets/external-secrets -n external-secrets --create-namespace

# Configure with AWS Secrets Manager, HashiCorp Vault, etc.
```

### Required Secrets

| Secret | Required | Description |
|--------|----------|-------------|
| `DATABASE_PASSWORD` | ✅ | PostgreSQL password |
| `PIMLICO_API_KEY` | ✅ | Bundler API key |
| `ALCHEMY_API_KEY` | ✅ | Fallback bundler |
| `ONEINCH_API_KEY` | ✅ | DEX aggregator |
| `LIFI_API_KEY` | ✅ | Bridge aggregator |
| `COINGECKO_API_KEY` | ✅ | Price data |
| `RPC_*` | ✅ | RPC endpoints for each chain |
| `COINBASE_PAYMASTER_URL` | ❌ | Optional paymaster |
| `JUPITER_API_KEY` | ❌ | Solana DEX |

---

## Database Setup

### PostgreSQL in Kubernetes

The included `postgres-deployment.yaml` is suitable for development/staging. For production:

1. **Use a managed service** (Cloud SQL, RDS, Azure Database)
2. **Enable replication** for high availability
3. **Configure automated backups**
4. **Use connection pooling** (PgBouncer)

### Run Migrations

```bash
# One-time migration job
kubectl run db-migrate \
  --rm -it \
  --restart=Never \
  --image=ghcr.io/nirholas/sweep-api:v1.0.0 \
  -n sweep \
  --env="DATABASE_URL=$DATABASE_URL" \
  -- npm run db:migrate
```

### Backup Strategy

```bash
# Create backup
kubectl exec -n sweep deployment/postgres -- \
  pg_dump -U sweep sweep > backup-$(date +%Y%m%d).sql

# Restore backup
cat backup-20260122.sql | kubectl exec -i -n sweep deployment/postgres -- \
  psql -U sweep sweep
```

---

## Deployment Procedure

### Using deploy.sh Script

```bash
# Deploy to staging
./scripts/deploy.sh staging v1.0.0

# Deploy to production
./scripts/deploy.sh production v1.0.0
```

### Manual Deployment

```bash
# 1. Build and push images
docker build -t ghcr.io/nirholas/sweep-api:v1.0.0 -f Dockerfile .
docker push ghcr.io/nirholas/sweep-api:v1.0.0

# 2. Update deployment image
kubectl set image deployment/sweep-api \
  api=ghcr.io/nirholas/sweep-api:v1.0.0 \
  -n sweep

# 3. Watch rollout
kubectl rollout status deployment/sweep-api -n sweep

# 4. Verify health
kubectl get pods -n sweep
curl https://api.sweep.xyz/health
```

### Blue/Green Deployment

```bash
# Deploy new version as "green"
kubectl apply -f k8s/api-deployment-green.yaml

# Test green deployment
curl http://sweep-api-green:3000/health

# Switch traffic
kubectl patch ingress sweep-api -n sweep \
  -p '{"spec":{"rules":[{"http":{"paths":[{"backend":{"service":{"name":"sweep-api-green"}}}]}}]}}'

# Remove old "blue" deployment
kubectl delete deployment sweep-api-blue -n sweep
```

---

## Rollback Procedure

### Automatic Rollback

```bash
# View rollout history
kubectl rollout history deployment/sweep-api -n sweep

# Rollback to previous version
kubectl rollout undo deployment/sweep-api -n sweep

# Rollback to specific revision
kubectl rollout undo deployment/sweep-api -n sweep --to-revision=2
```

### Manual Rollback

```bash
# Set previous image
kubectl set image deployment/sweep-api \
  api=ghcr.io/nirholas/sweep-api:v0.9.0 \
  -n sweep

# Watch rollback
kubectl rollout status deployment/sweep-api -n sweep
```

---

## Health Checks

### Endpoints

| Endpoint | Purpose | Expected Response |
|----------|---------|-------------------|
| `/health` | General health | `200 OK` |
| `/health/live` | Liveness (is running) | `200 OK` |
| `/health/ready` | Readiness (can serve) | `200 OK` |
| `/metrics` | Prometheus metrics | Metrics text |

### Manual Health Check

```bash
# Check health
./scripts/health-check.sh https://api.sweep.xyz

# Or directly
curl -f https://api.sweep.xyz/health
```

### Kubernetes Probes

Configured in `api-deployment.yaml`:

```yaml
livenessProbe:
  httpGet:
    path: /health/live
    port: 3000
  initialDelaySeconds: 10
  periodSeconds: 10

readinessProbe:
  httpGet:
    path: /health/ready
    port: 3000
  initialDelaySeconds: 5
  periodSeconds: 5
```

---

## Scaling

### Horizontal Pod Autoscaler

The HPA automatically scales based on CPU/memory:

```yaml
# k8s/hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
spec:
  minReplicas: 3
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
```

### Manual Scaling

```bash
# Scale API
kubectl scale deployment/sweep-api --replicas=5 -n sweep

# Scale workers
kubectl scale deployment/sweep-workers --replicas=4 -n sweep
```

### Recommended Scaling

| Load | API Replicas | Worker Replicas |
|------|--------------|-----------------|
| Low (<100 rps) | 2-3 | 1-2 |
| Medium (100-500 rps) | 3-5 | 2-3 |
| High (500+ rps) | 5-10 | 4-6 |

---

## CI/CD Pipeline

### GitHub Actions Workflow

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy

on:
  push:
    tags:
      - 'v*'

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Log in to Container Registry
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      
      - name: Extract version
        id: version
        run: echo "VERSION=${GITHUB_REF#refs/tags/}" >> $GITHUB_OUTPUT
      
      - name: Build and push API
        uses: docker/build-push-action@v5
        with:
          context: .
          file: ./Dockerfile
          push: true
          tags: |
            ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}-api:${{ steps.version.outputs.VERSION }}
            ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}-api:latest
      
      - name: Build and push Workers
        uses: docker/build-push-action@v5
        with:
          context: .
          file: ./Dockerfile.workers
          push: true
          tags: |
            ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}-workers:${{ steps.version.outputs.VERSION }}
            ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}-workers:latest
      
      - name: Deploy to Kubernetes
        uses: azure/k8s-deploy@v4
        with:
          namespace: sweep
          manifests: |
            k8s/api-deployment.yaml
            k8s/workers-deployment.yaml
          images: |
            ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}-api:${{ steps.version.outputs.VERSION }}
            ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}-workers:${{ steps.version.outputs.VERSION }}
```

### Release Process

1. **Create release branch**: `git checkout -b release/v1.0.0`
2. **Update version**: Update `package.json` version
3. **Run tests**: `npm test`
4. **Create tag**: `git tag v1.0.0`
5. **Push**: `git push origin v1.0.0`
6. **CI deploys automatically**
7. **Verify**: Check health endpoints
8. **Monitor**: Watch Grafana dashboards

---

## Environment-Specific Configuration

### Staging

| Setting | Value |
|---------|-------|
| Namespace | `sweep-staging` |
| Replicas | 1-2 |
| Domain | `staging-api.sweep.xyz` |
| Database | Shared test DB |

### Production

| Setting | Value |
|---------|-------|
| Namespace | `sweep` |
| Replicas | 3-10 |
| Domain | `api.sweep.xyz` |
| Database | Dedicated managed DB |

---

## Related Documentation

- [DEVELOPMENT.md](./DEVELOPMENT.md) - Local development setup
- [MONITORING.md](./MONITORING.md) - Observability and alerting
- [SECURITY.md](./SECURITY.md) - Security practices
- [CONTRACTS.md](./CONTRACTS.md) - Smart contract deployment
