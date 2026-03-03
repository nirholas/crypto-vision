# Crypto Vision — Infrastructure

Deployment infrastructure for **cryptocurrency.cv**.

Current home: GCP ($110k credits, 6 months). Designed for portability — can migrate to AWS, Azure, bare metal, or any Kubernetes cluster with minimal changes.

---

## Architecture Overview

```
                          ┌──────────────────────┐
                          │   cryptocurrency.cv   │
                          │    (Custom Domain)     │
                          └──────────┬─────────────┘
                                     │
                          ┌──────────▼─────────────┐
                          │     Container Runtime   │
                          │   (Cloud Run / K8s)     │
                          │  auto-scaling 2→500     │
                          └─────┬──────────┬────────┘
                                │          │
                    ┌───────────▼──┐  ┌────▼──────────────┐
                    │   Secrets    │  │  Private Network   │
                    │  (env vars)  │  │  (VPC / overlay)   │
                    └──────────────┘  └────┬──────────────┘
                                           │
                               ┌───────────▼──────────────┐
                               │       Redis 7            │
                               │   (cache, shared state)  │
                               └──────────────────────────┘

         Scheduler (Cloud Scheduler / K8s CronJob / cron)
         → 7 periodic cache-warming jobs
```

## Components

| Concern | GCP | Kubernetes | Docker Compose |
|---------|-----|------------|----------------|
| **Compute** | Cloud Run | Deployment + HPA | `api` service |
| **Cache** | Memorystore Redis | Redis pod | `redis` service |
| **Secrets** | Secret Manager | K8s Secret | `.env` file |
| **Scheduling** | Cloud Scheduler | CronJobs | `scheduler` sidecar |
| **Networking** | VPC Connector | ClusterIP + Ingress | Docker bridge |
| **TLS** | Managed by Cloud Run | cert-manager | Reverse proxy |
| **Registry** | Artifact Registry | Any (GHCR, ECR, ACR) | Local build |
| **Monitoring** | Cloud Monitoring | Prometheus/Grafana | Docker healthchecks |

## Secrets

| Secret | Description |
|--------|-------------|
| `COINGECKO_API_KEY` | CoinGecko Pro API key |
| `GROQ_API_KEY` | Groq LLM API key |
| `GEMINI_API_KEY` | Google Gemini API key |
| `OPENAI_API_KEY` | OpenAI API key |
| `ANTHROPIC_API_KEY` | Anthropic Claude API key |
| `OPENROUTER_API_KEY` | OpenRouter API key |
| `REDIS_URL` | Auto-populated (GCP/Terraform) or set manually |

## Scheduler Jobs

| Job | Schedule | Endpoint |
|-----|----------|----------|
| `refresh-coins` | Every 2 min | `/api/coins` |
| `refresh-trending` | Every 5 min | `/api/trending` |
| `refresh-global` | Every 5 min | `/api/global` |
| `refresh-fear-greed` | Every 15 min | `/api/fear-greed` |
| `refresh-defi-protocols` | Every 10 min | `/api/defi/protocols` |
| `refresh-defi-chains` | Every 10 min | `/api/defi/chains` |
| `refresh-news` | Every 5 min | `/api/news` |

---

## Deployment Options

### Option 1: Docker Compose (Simplest — Any Machine)

Zero cloud dependencies. Works on any machine with Docker.

```bash
cp .env.example .env   # fill in API keys
docker compose up -d --build
```

Includes API server, Redis, and cron scheduler. That's it.

### Option 2: Kubernetes (Any Cloud or Self-Hosted)

Portable manifests using Kustomize. Works on GKE, EKS, AKS, k3s, etc.

```bash
# Create secrets
kubectl create namespace crypto-vision
kubectl create secret generic crypto-vision-secrets \
  --namespace=crypto-vision \
  --from-literal=COINGECKO_API_KEY=xxx \
  --from-literal=GROQ_API_KEY=xxx \
  # ... etc

# Set your image
cd infra/k8s
kustomize edit set image crypto-vision=your-registry/crypto-vision:latest

# Deploy
kubectl apply -k infra/k8s/
```

Includes: Deployment, Service, Ingress, HPA (2→20 pods), Redis, 7 CronJobs.

GitHub Actions workflow: `.github/workflows/deploy-k8s.yml`

### Option 3: GCP Cloud Run (Current Production)

Two sub-options for provisioning:

#### Shell Script (Quick Start)
```bash
export GCP_PROJECT=your-project-id
bash infra/setup.sh
```

#### Terraform (Recommended)
```bash
cd infra/terraform
cp terraform.tfvars.example terraform.tfvars
terraform init && terraform plan && terraform apply
```

Provisions: Cloud Run, Artifact Registry, Memorystore Redis (with AUTH), VPC connector, Secret Manager, Cloud Scheduler, domain mapping, monitoring alerts.

---

## CI/CD Workflows

| Workflow | File | Target | Trigger |
|----------|------|--------|---------|
| **CI** | `.github/workflows/ci.yml` | — | Push/PR to master |
| **Deploy GCP** | `.github/workflows/deploy.yml` | Cloud Run | Push to master |
| **Deploy K8s** | `.github/workflows/deploy-k8s.yml` | Any K8s cluster | Manual dispatch |
| **Cloud Build** | `cloudbuild.yaml` | Cloud Run | GCP trigger |

### GCP Deploy — Required GitHub Secrets

| Secret | Description |
|--------|-------------|
| `GCP_PROJECT_ID` | GCP project ID |
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | WIF provider |
| `GCP_SA_EMAIL` | Service account email |

### K8s Deploy — Required GitHub Secrets

| Secret | Description |
|--------|-------------|
| `REGISTRY_URL` | Container registry (e.g. `ghcr.io/nirholas`) |
| `REGISTRY_USERNAME` | Registry auth user |
| `REGISTRY_PASSWORD` | Registry auth token |
| `KUBECONFIG_B64` | Base64-encoded kubeconfig |

---

## Cloud Portability

The app has **zero cloud vendor lock-in** at the code level. Everything cloud-specific is isolated in `infra/`.

### What's Portable (No Changes Needed)

- **Application code** — Hono + Node.js, standard Docker image
- **Redis** — standard `ioredis`, connects via `REDIS_URL` env var
- **Secrets** — all config via environment variables
- **Dockerfile** — multi-stage, runs anywhere

### GCP-Specific (in `infra/` only)

| Resource | GCP Service | Portable Equivalent |
|----------|-------------|---------------------|
| Compute | Cloud Run | K8s Deployment, ECS, App Runner, Fly.io |
| Cache | Memorystore | ElastiCache, Upstash, any Redis |
| Secrets | Secret Manager | K8s Secrets, AWS Secrets Manager, Vault |
| Cron | Cloud Scheduler | K8s CronJobs, EventBridge, cron |
| Registry | Artifact Registry | ECR, GHCR, ACR, Docker Hub |
| Monitoring | Cloud Monitoring | Prometheus + Grafana, Datadog |
| Networking | VPC Connector | VPC peering, K8s ClusterIP |

### Migration Playbook

To move off GCP:

1. **Push image to new registry** — `docker tag` + `docker push` to ECR/GHCR/ACR
2. **Provision Redis** — any managed Redis (ElastiCache, Upstash, Aiven) or self-hosted
3. **Set env vars** — same 7 secrets, just in the new platform's secret store
4. **Deploy** — use `infra/k8s/` manifests or `docker-compose.yml`
5. **Update DNS** — point `cryptocurrency.cv` A/AAAA records to new ingress

No application code changes required. Total migration time: ~1 hour.

---

## Terraform Files

| File | Purpose |
|------|---------|
| `main.tf` | Provider config, backend state |
| `variables.tf` | All configurable inputs |
| `apis.tf` | GCP API enablement + Artifact Registry |
| `network.tf` | VPC connector |
| `redis.tf` | Memorystore Redis (AUTH enabled) |
| `secrets.tf` | Secret Manager entries + IAM |
| `iam.tf` | Service accounts |
| `cloud_run.tf` | Cloud Run service + domain mapping |
| `scheduler.tf` | Cloud Scheduler cron jobs |
| `monitoring.tf` | Uptime checks + alert policies |
| `outputs.tf` | Exported values |

## Kubernetes Files

| File | Purpose |
|------|---------|
| `kustomization.yml` | Kustomize entry point |
| `namespace.yml` | `crypto-vision` namespace |
| `deployment.yml` | API pods (2 replicas, rolling update) |
| `service.yml` | ClusterIP + Ingress with TLS |
| `redis.yml` | Redis deployment + service |
| `hpa.yml` | Horizontal Pod Autoscaler (2→20) |
| `cronjobs.yml` | 7 cache-warming cron jobs |
| `secrets.example.yml` | Secret template |

---

## DNS Configuration

Point `cryptocurrency.cv` to your deployment:

**Cloud Run:**
```
A      @   <IP from gcloud beta run domain-mappings describe>
AAAA   @   <IPv6 from domain-mappings describe>
CNAME  www ghs.googlehosted.com.
```

**Kubernetes (with Ingress):**
```
A      @   <Load balancer external IP>
CNAME  www <Load balancer hostname>
```

## Populating Secrets

**GCP:**
```bash
echo -n "key" | gcloud secrets versions add COINGECKO_API_KEY --data-file=-
```

**Kubernetes:**
```bash
kubectl create secret generic crypto-vision-secrets \
  --namespace=crypto-vision \
  --from-literal=COINGECKO_API_KEY=xxx
```

**Docker Compose:**
```bash
# Just edit .env
COINGECKO_API_KEY=xxx
```


