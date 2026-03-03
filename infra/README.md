# Crypto Vision — GCP Infrastructure

Full infrastructure setup for **cryptocurrency.cv** on Google Cloud Platform.

**Budget:** $110k GCP credits over 6 months.

---

## Architecture Overview

```
                          ┌──────────────────────┐
                          │   cryptocurrency.cv   │
                          │    (Custom Domain)     │
                          └──────────┬─────────────┘
                                     │
                          ┌──────────▼─────────────┐
                          │      Cloud Run          │
                          │    crypto-vision        │
                          │  (1–20 instances)       │
                          │  2 vCPU / 1Gi RAM each  │
                          └─────┬──────────┬────────┘
                                │          │
                    ┌───────────▼──┐  ┌────▼──────────────┐
                    │  Secret Mgr  │  │  VPC Connector     │
                    │  (API Keys)  │  │  10.8.0.0/28       │
                    └──────────────┘  └────┬──────────────┘
                                           │
                               ┌───────────▼──────────────┐
                               │   Memorystore Redis      │
                               │   (cache, shared state)  │
                               └──────────────────────────┘

         Cloud Scheduler ──(OIDC)──► Cloud Run /api/* endpoints
         (7 cron jobs for data refresh)
```

## Components

| Component | Resource | Purpose |
|-----------|----------|---------|
| **Cloud Run** | `crypto-vision` | API server (Hono + Node 22) |
| **Memorystore Redis** | `crypto-vision-cache` | Shared cache across instances |
| **VPC Connector** | `crypto-vision-vpc` | Private network for Cloud Run → Redis |
| **Secret Manager** | 7 secrets | API keys (CoinGecko, Groq, Gemini, OpenAI, Anthropic, OpenRouter, Redis URL) |
| **Cloud Scheduler** | 7 cron jobs | Periodic cache warming for market/DeFi/news data |
| **Domain Mapping** | `cryptocurrency.cv` | Custom domain with managed TLS |

## Secrets

| Secret | Description |
|--------|-------------|
| `COINGECKO_API_KEY` | CoinGecko Pro API key |
| `GROQ_API_KEY` | Groq LLM API key |
| `GEMINI_API_KEY` | Google Gemini API key |
| `OPENAI_API_KEY` | OpenAI API key |
| `ANTHROPIC_API_KEY` | Anthropic Claude API key |
| `OPENROUTER_API_KEY` | OpenRouter API key |
| `REDIS_URL` | Auto-populated from Memorystore |

## Scheduler Jobs

| Job | Schedule | Endpoint | Purpose |
|-----|----------|----------|---------|
| `refresh-coins` | Every 2 min | `/api/coins` | Top coins by market cap |
| `refresh-trending` | Every 5 min | `/api/trending` | Trending coins |
| `refresh-global` | Every 5 min | `/api/global` | Global market stats |
| `refresh-fear-greed` | Every 15 min | `/api/fear-greed` | Fear & Greed index |
| `refresh-defi-protocols` | Every 10 min | `/api/defi/protocols` | DeFi TVL data |
| `refresh-defi-chains` | Every 10 min | `/api/defi/chains` | Chain TVL rankings |
| `refresh-news` | Every 5 min | `/api/news` | Crypto news feed |

---

## Setup Options

### Option A: Shell Script (Quick Start)

One-command provisioning for all resources:

```bash
export GCP_PROJECT=your-project-id
bash infra/setup.sh
```

**Optional overrides:**
```bash
export GCP_REGION=us-central1        # default
export SERVICE_NAME=crypto-vision     # default
export REDIS_TIER=STANDARD_HA        # default: BASIC
export REDIS_SIZE_GB=5               # default: 1
export DOMAIN=cryptocurrency.cv      # default
```

### Option B: Terraform (Recommended for Production)

Full IaC with state management, drift detection, and plan/apply workflow.

#### Prerequisites
```bash
# Install Terraform
brew install terraform  # or download from hashicorp.com

# Create state bucket
gsutil mb -l us-central1 gs://crypto-vision-terraform-state

# Authenticate
gcloud auth application-default login
```

#### Deploy
```bash
cd infra/terraform

# Copy and edit variables
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your project ID

# Initialize
terraform init

# Review changes
terraform plan

# Apply
terraform apply
```

#### Terraform Files

| File | Purpose |
|------|---------|
| `main.tf` | Provider config, backend state |
| `variables.tf` | All configurable inputs |
| `apis.tf` | GCP API enablement |
| `network.tf` | VPC connector |
| `redis.tf` | Memorystore Redis instance |
| `secrets.tf` | Secret Manager entries + IAM |
| `iam.tf` | Service accounts |
| `cloud_run.tf` | Cloud Run service + domain mapping |
| `scheduler.tf` | Cloud Scheduler cron jobs |
| `outputs.tf` | Exported values (URLs, IPs, etc.) |

---

## CI/CD Deployment

Two parallel deployment pathways are available. Use whichever fits your workflow.

### Cloud Build (GCP-native)

Triggered automatically on push to `master` via Cloud Build trigger, or manually:

```bash
gcloud builds submit --config cloudbuild.yaml .
```

**Pipeline stages:**
1. `npm ci` — Install dependencies
2. `npm run typecheck` — TypeScript type checking (parallel)
3. `npm run lint` — ESLint (parallel)
4. `npm run test` — Vitest tests (parallel)
5. Docker build with `$SHORT_SHA` tag
6. Push to GCR
7. Deploy to Cloud Run with secrets + VPC connector

Steps 2–4 run in parallel after install for faster builds.

### GitHub Actions (Alternative)

Located at `.github/workflows/deploy.yml`. Runs on push to `master` or manual dispatch.

**Required GitHub Secrets:**

| Secret | Description |
|--------|-------------|
| `GCP_PROJECT_ID` | Your GCP project ID |
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | WIF provider (format: `projects/PROJECT_NUM/locations/global/workloadIdentityPools/POOL/providers/PROVIDER`) |
| `GCP_SA_EMAIL` | Service account email for deployment |

#### Setting Up Workload Identity Federation

Preferred over service account keys for security:

```bash
# Create WIF pool
gcloud iam workload-identity-pools create "github-pool" \
  --location="global" \
  --display-name="GitHub Actions Pool"

# Create provider
gcloud iam workload-identity-pools providers create-oidc "github-provider" \
  --location="global" \
  --workload-identity-pool="github-pool" \
  --display-name="GitHub Provider" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" \
  --issuer-uri="https://token.actions.githubusercontent.com"

# Grant impersonation
gcloud iam service-accounts add-iam-policy-binding \
  "crypto-vision-run@${PROJECT}.iam.gserviceaccount.com" \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github-pool/attribute.repository/nirholas/crypto-vision"
```

---

## Populating Secrets

After infrastructure is provisioned:

```bash
# Set each API key
echo -n "your-coingecko-key" | gcloud secrets versions add COINGECKO_API_KEY --data-file=-
echo -n "your-groq-key"      | gcloud secrets versions add GROQ_API_KEY --data-file=-
echo -n "your-gemini-key"    | gcloud secrets versions add GEMINI_API_KEY --data-file=-
echo -n "your-openai-key"    | gcloud secrets versions add OPENAI_API_KEY --data-file=-
echo -n "your-anthropic-key" | gcloud secrets versions add ANTHROPIC_API_KEY --data-file=-
echo -n "your-openrouter-key"| gcloud secrets versions add OPENROUTER_API_KEY --data-file=-

# REDIS_URL is auto-populated by setup.sh / Terraform
```

## DNS Configuration

After domain mapping is created, configure DNS for `cryptocurrency.cv`:

```
Type   Name   Value
A      @      <IP from gcloud beta run domain-mappings describe>
AAAA   @      <IPv6 from domain-mappings describe>
CNAME  www    ghs.googlehosted.com.
```

Verify with:
```bash
gcloud beta run domain-mappings describe \
  --domain=cryptocurrency.cv \
  --region=us-central1
```

## Cost Estimates (Monthly)

| Resource | Estimate |
|----------|----------|
| Cloud Run (1 min instance, 2 vCPU, 1Gi) | ~$50–100 |
| Cloud Run (burst to 20 instances) | ~$500–1,500 |
| Memorystore Redis (1GB BASIC) | ~$35 |
| Memorystore Redis (1GB STANDARD_HA) | ~$70 |
| Cloud Scheduler (7 jobs) | Free tier |
| Secret Manager (7 secrets) | ~$0.50 |
| VPC Connector (2 min instances) | ~$15 |
| Container Registry storage | ~$5 |
| **Total (steady state)** | **~$100–200/mo** |
| **Total (high traffic)** | **~$600–1,700/mo** |

With $110k in credits over 6 months, this is well within budget even at peak load.

## Troubleshooting

```bash
# Check Cloud Run logs
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=crypto-vision" --limit=50

# Check Redis connectivity
gcloud redis instances describe crypto-vision-cache --region=us-central1

# Test scheduler job manually
gcloud scheduler jobs run refresh-coins --location=us-central1

# Verify secrets
gcloud secrets versions access latest --secret=REDIS_URL

# Check VPC connector status
gcloud compute networks vpc-access connectors describe crypto-vision-vpc --region=us-central1
```
