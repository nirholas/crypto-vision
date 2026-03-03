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
REDIS_TIER="${REDIS_TIER:-BASIC}"          # BASIC (dev) or STANDARD_HA (prod)
REDIS_SIZE_GB="${REDIS_SIZE_GB:-1}"
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
  containerregistry.googleapis.com \
  artifactregistry.googleapis.com \
  compute.googleapis.com \
  --quiet
log "APIs enabled"

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

# Set Redis URL secret automatically
echo -n "redis://${REDIS_HOST}:${REDIS_PORT}" | \
  gcloud secrets versions add "REDIS_URL" --data-file=- --quiet
log "Set REDIS_URL secret to redis://${REDIS_HOST}:${REDIS_PORT}"

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
  --image="gcr.io/${PROJECT}/${SERVICE_NAME}:latest" \
  --region="${REGION}" \
  --platform=managed \
  --allow-unauthenticated \
  --port=8080 \
  --memory=1Gi \
  --cpu=2 \
  --min-instances=1 \
  --max-instances=20 \
  --timeout=60s \
  --concurrency=200 \
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

# Market data — every 2 minutes
create_job "refresh-coins" \
  "*/2 * * * *" \
  "/api/coins" \
  "Refresh top coins by market cap"

# Trending — every 5 minutes
create_job "refresh-trending" \
  "*/5 * * * *" \
  "/api/trending" \
  "Refresh trending coins"

# Global market stats — every 5 minutes
create_job "refresh-global" \
  "*/5 * * * *" \
  "/api/global" \
  "Refresh global market stats"

# Fear & Greed — every 15 minutes
create_job "refresh-fear-greed" \
  "*/15 * * * *" \
  "/api/fear-greed" \
  "Refresh Fear and Greed index"

# DeFi protocols — every 10 minutes
create_job "refresh-defi-protocols" \
  "*/10 * * * *" \
  "/api/defi/protocols" \
  "Refresh DeFi protocol TVL data"

# DeFi chains — every 10 minutes
create_job "refresh-defi-chains" \
  "*/10 * * * *" \
  "/api/defi/chains" \
  "Refresh chain TVL rankings"

# Crypto news — every 5 minutes
create_job "refresh-news" \
  "*/5 * * * *" \
  "/api/news" \
  "Refresh crypto news feed"

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
