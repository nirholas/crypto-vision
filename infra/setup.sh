#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# Crypto Vision — GCP Infrastructure Provisioning Script
#
# Provisions all resources needed for cryptocurrency.cv:
#   • Cloud Run service
#   • VPC connector (for Redis access)
#   • Memorystore Redis instance
#   • Secret Manager secrets for API keys
#   • Cloud Scheduler jobs for periodic data refresh
#   • Custom domain mapping for cryptocurrency.cv
#
# Prerequisites:
#   - gcloud CLI authenticated with owner/editor role
#   - Billing account linked to project
#   - APIs will be enabled automatically
#
# Usage:
#   export GCP_PROJECT=your-project-id
#   bash infra/setup.sh
# ─────────────────────────────────────────────────────────────
set -euo pipefail

# ─── Configuration ────────────────────────────────────────────

PROJECT="${GCP_PROJECT:?Set GCP_PROJECT env var}"
REGION="${GCP_REGION:-us-central1}"
SERVICE_NAME="${SERVICE_NAME:-crypto-vision}"
REDIS_INSTANCE="${REDIS_INSTANCE:-crypto-vision-cache}"
REDIS_TIER="${REDIS_TIER:-STANDARD_HA}"          # STANDARD_HA for production failover
REDIS_SIZE_GB="${REDIS_SIZE_GB:-5}"
REDIS_VERSION="${REDIS_VERSION:-REDIS_7_0}"
VPC_CONNECTOR="${VPC_CONNECTOR:-crypto-vision-vpc}"
DOMAIN="${DOMAIN:-cryptocurrency.cv}"
SCHEDULER_SA="${SCHEDULER_SA:-scheduler-invoker}"
CLOUD_RUN_SA="${CLOUD_RUN_SA:-crypto-vision-run}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log()  { echo -e "${GREEN}[✓]${NC} $*"; }
info() { echo -e "${BLUE}[i]${NC} $*"; }
warn() { echo -e "${YELLOW}[!]${NC} $*"; }
err()  { echo -e "${RED}[✗]${NC} $*" >&2; }

# ─── Preflight ────────────────────────────────────────────────

info "Project:  ${PROJECT}"
info "Region:   ${REGION}"
info "Service:  ${SERVICE_NAME}"
info "Domain:   ${DOMAIN}"
echo ""

gcloud config set project "${PROJECT}" --quiet

# ─── 1. Enable required APIs ─────────────────────────────────

info "Enabling GCP APIs..."
gcloud services enable \
  run.googleapis.com \
  redis.googleapis.com \
  secretmanager.googleapis.com \
  cloudscheduler.googleapis.com \
  vpcaccess.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  compute.googleapis.com \
  monitoring.googleapis.com \
  --quiet
log "APIs enabled"

# ─── 1b. Create Artifact Registry repository ─────────────────

info "Creating Artifact Registry Docker repository..."
if ! gcloud artifacts repositories describe "crypto-vision" \
  --location="${REGION}" &>/dev/null; then
  gcloud artifacts repositories create "crypto-vision" \
    --repository-format=docker \
    --location="${REGION}" \
    --description="Docker images for crypto-vision" \
    --quiet
  log "Artifact Registry repo created: crypto-vision"
else
  warn "Artifact Registry repo already exists"
fi

# ─── 2. Create Service Accounts ──────────────────────────────

info "Creating service accounts..."

# Cloud Run service account
if ! gcloud iam service-accounts describe "${CLOUD_RUN_SA}@${PROJECT}.iam.gserviceaccount.com" &>/dev/null; then
  gcloud iam service-accounts create "${CLOUD_RUN_SA}" \
    --display-name="Crypto Vision Cloud Run SA" \
    --quiet
  log "Created Cloud Run service account: ${CLOUD_RUN_SA}"
else
  warn "Cloud Run service account already exists"
fi

# Grant Secret Manager access to Cloud Run SA
gcloud projects add-iam-policy-binding "${PROJECT}" \
  --member="serviceAccount:${CLOUD_RUN_SA}@${PROJECT}.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor" \
  --quiet
log "Granted Secret Manager access to Cloud Run SA"

# Scheduler invoker service account
if ! gcloud iam service-accounts describe "${SCHEDULER_SA}@${PROJECT}.iam.gserviceaccount.com" &>/dev/null; then
  gcloud iam service-accounts create "${SCHEDULER_SA}" \
    --display-name="Cloud Scheduler Invoker" \
    --quiet
  log "Created Scheduler service account: ${SCHEDULER_SA}"
else
  warn "Scheduler service account already exists"
fi

# Grant Cloud Run invoker role to scheduler SA
gcloud projects add-iam-policy-binding "${PROJECT}" \
  --member="serviceAccount:${SCHEDULER_SA}@${PROJECT}.iam.gserviceaccount.com" \
  --role="roles/run.invoker" \
  --quiet
log "Granted Cloud Run invoker to Scheduler SA"

# ─── 3. Create VPC Connector ─────────────────────────────────

info "Creating Serverless VPC Access connector..."
if ! gcloud compute networks vpc-access connectors describe "${VPC_CONNECTOR}" \
  --region="${REGION}" &>/dev/null; then
  gcloud compute networks vpc-access connectors create "${VPC_CONNECTOR}" \
    --region="${REGION}" \
    --range="10.8.0.0/28" \
    --min-instances=2 \
    --max-instances=10 \
    --quiet
  log "VPC connector created: ${VPC_CONNECTOR}"
else
  warn "VPC connector already exists"
fi

# ─── 4. Provision Memorystore Redis ──────────────────────────

info "Provisioning Memorystore Redis instance..."
if ! gcloud redis instances describe "${REDIS_INSTANCE}" \
  --region="${REGION}" &>/dev/null; then
  gcloud redis instances create "${REDIS_INSTANCE}" \
    --region="${REGION}" \
    --tier="${REDIS_TIER}" \
    --size="${REDIS_SIZE_GB}" \
    --redis-version="${REDIS_VERSION}" \
    --display-name="Crypto Vision Cache" \
    --quiet
  log "Redis instance created: ${REDIS_INSTANCE}"
else
  warn "Redis instance already exists"
fi

# Get Redis host/port for later
REDIS_HOST=$(gcloud redis instances describe "${REDIS_INSTANCE}" \
  --region="${REGION}" --format='value(host)')
REDIS_PORT=$(gcloud redis instances describe "${REDIS_INSTANCE}" \
  --region="${REGION}" --format='value(port)')
log "Redis endpoint: ${REDIS_HOST}:${REDIS_PORT}"

# ─── 5. Create Secret Manager Secrets ────────────────────────

info "Creating Secret Manager entries..."

SECRETS=(
  "COINGECKO_API_KEY"
  "GROQ_API_KEY"
  "GEMINI_API_KEY"
  "OPENAI_API_KEY"
  "ANTHROPIC_API_KEY"
  "OPENROUTER_API_KEY"
  "REDIS_URL"
)

for secret_name in "${SECRETS[@]}"; do
  if ! gcloud secrets describe "${secret_name}" &>/dev/null; then
    gcloud secrets create "${secret_name}" \
      --replication-policy="automatic" \
      --quiet
    log "Created secret: ${secret_name}"
  else
    warn "Secret already exists: ${secret_name}"
  fi
done

# Set Redis URL secret automatically (with AUTH string)
REDIS_AUTH=$(gcloud redis instances describe "${REDIS_INSTANCE}" \
  --region="${REGION}" --format='value(authString)' 2>/dev/null || echo "")
if [ -n "${REDIS_AUTH}" ]; then
  echo -n "redis://:${REDIS_AUTH}@${REDIS_HOST}:${REDIS_PORT}" | \
    gcloud secrets versions add "REDIS_URL" --data-file=- --quiet
  log "Set REDIS_URL secret with AUTH string"
else
  echo -n "redis://${REDIS_HOST}:${REDIS_PORT}" | \
    gcloud secrets versions add "REDIS_URL" --data-file=- --quiet
  log "Set REDIS_URL secret to redis://${REDIS_HOST}:${REDIS_PORT}"
fi

echo ""
warn "Remember to populate remaining secrets:"
warn "  gcloud secrets versions add COINGECKO_API_KEY --data-file=- <<< 'your-key'"
warn "  gcloud secrets versions add GROQ_API_KEY      --data-file=- <<< 'your-key'"
warn "  (repeat for each API key)"
echo ""

# ─── 6. Deploy Cloud Run Service ─────────────────────────────

info "Deploying Cloud Run service (initial placeholder)..."

# Build secret env var flags
SECRET_FLAGS=""
for secret_name in "${SECRETS[@]}"; do
  SECRET_FLAGS="${SECRET_FLAGS} --set-secrets=${secret_name}=${secret_name}:latest"
done

# Deploy the service
gcloud run deploy "${SERVICE_NAME}" \
  --image="${REGION}-docker.pkg.dev/${PROJECT}/${SERVICE_NAME}/${SERVICE_NAME}:latest" \
  --region="${REGION}" \
  --platform=managed \
  --no-allow-unauthenticated \
  --port=8080 \
  --memory=2Gi \
  --cpu=4 \
  --min-instances=2 \
  --max-instances=500 \
  --timeout=60s \
  --concurrency=250 \
  --cpu-boost \
  --execution-environment=gen2 \
  --vpc-connector="${VPC_CONNECTOR}" \
  --vpc-egress=private-ranges-only \
  --service-account="${CLOUD_RUN_SA}@${PROJECT}.iam.gserviceaccount.com" \
  --set-env-vars="NODE_ENV=production,COINGECKO_PRO=true" \
  ${SECRET_FLAGS} \
  --quiet || warn "Cloud Run deploy skipped — build and push the image first"

# Get the Cloud Run URL
SERVICE_URL=$(gcloud run services describe "${SERVICE_NAME}" \
  --region="${REGION}" --format='value(status.url)' 2>/dev/null || echo "https://${SERVICE_NAME}-xxxxx.a.run.app")
log "Cloud Run URL: ${SERVICE_URL}"

# ─── 7. Cloud Scheduler Jobs ─────────────────────────────────

info "Creating Cloud Scheduler jobs for periodic data refresh..."

# Helper: create or update a scheduler job
create_job() {
  local name="$1" schedule="$2" path="$3" desc="$4"
  local uri="${SERVICE_URL}${path}"

  if gcloud scheduler jobs describe "${name}" --location="${REGION}" &>/dev/null; then
    gcloud scheduler jobs update http "${name}" \
      --location="${REGION}" \
      --schedule="${schedule}" \
      --uri="${uri}" \
      --http-method=GET \
      --oidc-service-account-email="${SCHEDULER_SA}@${PROJECT}.iam.gserviceaccount.com" \
      --oidc-token-audience="${SERVICE_URL}" \
      --description="${desc}" \
      --quiet
    log "Updated job: ${name}"
  else
    gcloud scheduler jobs create http "${name}" \
      --location="${REGION}" \
      --schedule="${schedule}" \
      --uri="${uri}" \
      --http-method=GET \
      --oidc-service-account-email="${SCHEDULER_SA}@${PROJECT}.iam.gserviceaccount.com" \
      --oidc-token-audience="${SERVICE_URL}" \
      --description="${desc}" \
      --time-zone="UTC" \
      --attempt-deadline="120s" \
      --quiet
    log "Created job: ${name}"
  fi
}

# ── Market Data (high frequency) ──────────────────────────────

create_job "ingest-coins" \
  "*/2 * * * *" \
  "/api/coins" \
  "Market snapshots (top 250)"

create_job "ingest-prices-btc-eth" \
  "*/1 * * * *" \
  "/api/price?ids=bitcoin,ethereum,solana,bnb" \
  "Key prices"

create_job "ingest-trending" \
  "*/5 * * * *" \
  "/api/trending" \
  "Trending coins"

create_job "ingest-global" \
  "*/5 * * * *" \
  "/api/global" \
  "Global market stats"

create_job "ingest-fear-greed" \
  "*/15 * * * *" \
  "/api/fear-greed" \
  "Fear & Greed Index"

# ── DeFi (standard frequency) ────────────────────────────────

create_job "ingest-defi-protocols" \
  "*/10 * * * *" \
  "/api/defi/protocols" \
  "DeFi protocol TVL"

create_job "ingest-defi-chains" \
  "*/10 * * * *" \
  "/api/defi/chains" \
  "Chain TVL rankings"

create_job "ingest-defi-yields" \
  "*/10 * * * *" \
  "/api/defi/yields" \
  "Yield pool APYs"

create_job "ingest-defi-stablecoins" \
  "*/15 * * * *" \
  "/api/defi/stablecoins" \
  "Stablecoin supply"

create_job "ingest-defi-dex-volumes" \
  "*/15 * * * *" \
  "/api/defi/dex-volumes" \
  "DEX trading volumes"

create_job "ingest-defi-fees" \
  "*/15 * * * *" \
  "/api/defi/fees" \
  "Protocol fees & revenue"

create_job "ingest-defi-bridges" \
  "*/30 * * * *" \
  "/api/defi/bridges" \
  "Bridge volumes"

create_job "ingest-defi-raises" \
  "0 */2 * * *" \
  "/api/defi/raises" \
  "Funding rounds"

# ── News ─────────────────────────────────────────────────────

create_job "ingest-news" \
  "*/5 * * * *" \
  "/api/news" \
  "Latest crypto news"

create_job "ingest-news-bitcoin" \
  "*/5 * * * *" \
  "/api/news/bitcoin" \
  "Bitcoin-specific news"

create_job "ingest-news-defi" \
  "*/10 * * * *" \
  "/api/news/defi" \
  "DeFi news"

create_job "ingest-news-breaking" \
  "*/5 * * * *" \
  "/api/news/breaking" \
  "Breaking crypto news"

# ── DEX & Trading ────────────────────────────────────────────

create_job "ingest-dex-trending" \
  "*/5 * * * *" \
  "/api/dex/trending" \
  "Trending DEX pairs"

create_job "ingest-dex-new-pools" \
  "*/5 * * * *" \
  "/api/dex/new" \
  "Newly created pools"

# ── On-chain ─────────────────────────────────────────────────

create_job "ingest-gas" \
  "*/5 * * * *" \
  "/api/onchain/gas" \
  "Multi-chain gas prices"

create_job "ingest-btc-fees" \
  "*/5 * * * *" \
  "/api/onchain/bitcoin/fees" \
  "Bitcoin fee estimates"

create_job "ingest-btc-stats" \
  "*/15 * * * *" \
  "/api/onchain/bitcoin/stats" \
  "Bitcoin network stats"

# ── Derivatives ──────────────────────────────────────────────

create_job "ingest-funding-rates" \
  "*/10 * * * *" \
  "/api/derivatives/funding" \
  "Perp funding rates"

create_job "ingest-open-interest" \
  "*/10 * * * *" \
  "/api/derivatives/oi" \
  "Open interest"

create_job "ingest-liquidations" \
  "*/10 * * * *" \
  "/api/derivatives/liquidations" \
  "Liquidation data"

# ── Exchanges & Categories ───────────────────────────────────

create_job "ingest-exchanges" \
  "*/30 * * * *" \
  "/api/exchanges" \
  "Exchange rankings"

create_job "ingest-categories" \
  "*/30 * * * *" \
  "/api/categories" \
  "Coin categories"

# ── Layer 2 ──────────────────────────────────────────────────

create_job "ingest-l2-summary" \
  "*/30 * * * *" \
  "/api/l2" \
  "L2 scaling summary"

# ── Governance ───────────────────────────────────────────────

create_job "ingest-governance" \
  "0 */1 * * *" \
  "/api/governance" \
  "Governance proposals"

# ── DePIN ────────────────────────────────────────────────────

create_job "ingest-depin" \
  "0 */1 * * *" \
  "/api/depin" \
  "DePIN projects"

# ── Macro ────────────────────────────────────────────────────

create_job "ingest-macro" \
  "0 */2 * * *" \
  "/api/macro" \
  "Macro economic data"

# ── AI Cache Warming ─────────────────────────────────────────

create_job "warm-ai-digest" \
  "0 */4 * * *" \
  "/api/ai/digest" \
  "AI market digest"

create_job "warm-ai-signals" \
  "0 */2 * * *" \
  "/api/ai/signals" \
  "AI trading signals"

create_job "warm-ai-sentiment-btc" \
  "*/30 * * * *" \
  "/api/ai/sentiment/bitcoin" \
  "BTC AI sentiment"

create_job "warm-ai-sentiment-eth" \
  "*/30 * * * *" \
  "/api/ai/sentiment/ethereum" \
  "ETH AI sentiment"

# ─── 8. Custom Domain Mapping ────────────────────────────────

info "Setting up custom domain mapping for ${DOMAIN}..."

gcloud beta run domain-mappings create \
  --service="${SERVICE_NAME}" \
  --domain="${DOMAIN}" \
  --region="${REGION}" \
  --quiet 2>/dev/null || warn "Domain mapping may already exist or needs DNS verification"

echo ""
log "Domain mapping requested for ${DOMAIN}"
warn "Configure DNS records as shown by:"
warn "  gcloud beta run domain-mappings describe --domain=${DOMAIN} --region=${REGION}"
echo ""
warn "Typical DNS setup:"
warn "  Type  Name  Value"
warn "  A     @     (IP from domain-mappings describe)"
warn "  AAAA  @     (IPv6 from domain-mappings describe)"
warn "  CNAME www   ghs.googlehosted.com."

# ─── Summary ──────────────────────────────────────────────────

echo ""
echo "═══════════════════════════════════════════════════════════"
echo -e "${GREEN} Infrastructure provisioning complete!${NC}"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "  Project:     ${PROJECT}"
echo "  Region:      ${REGION}"
echo "  Service:     ${SERVICE_NAME}"
echo "  Service URL: ${SERVICE_URL}"
echo "  Redis:       ${REDIS_HOST}:${REDIS_PORT}"
echo "  Domain:      ${DOMAIN}"
echo ""
echo "Next steps:"
echo "  1. Populate API key secrets (see warnings above)"
echo "  2. Build and push container image:"
echo "     gcloud builds submit --config cloudbuild.yaml ."
echo "  3. Verify DNS records for ${DOMAIN}"
echo "  4. Test: curl ${SERVICE_URL}/health"
echo ""
