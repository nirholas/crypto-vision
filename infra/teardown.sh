#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# Crypto Vision — GCP Infrastructure Teardown
#
# Safely destroys all GCP resources. Requires confirmation.
#
# Usage:
#   export GCP_PROJECT=your-project-id
#   bash infra/teardown.sh
# ─────────────────────────────────────────────────────────────
set -euo pipefail

PROJECT="${GCP_PROJECT:?Set GCP_PROJECT env var}"
REGION="${GCP_REGION:-us-central1}"
SERVICE_NAME="${SERVICE_NAME:-crypto-vision}"
REDIS_INSTANCE="${REDIS_INSTANCE:-crypto-vision-cache}"
VPC_CONNECTOR="${VPC_CONNECTOR:-crypto-vision-vpc}"
DOMAIN="${DOMAIN:-cryptocurrency.cv}"
SCHEDULER_SA="${SCHEDULER_SA:-scheduler-invoker}"
CLOUD_RUN_SA="${CLOUD_RUN_SA:-crypto-vision-run}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()  { echo -e "${GREEN}[✓]${NC} $*"; }
warn() { echo -e "${YELLOW}[!]${NC} $*"; }
err()  { echo -e "${RED}[✗]${NC} $*" >&2; }

echo -e "${RED}"
echo "═══════════════════════════════════════════════════════════"
echo "  WARNING: This will DESTROY all crypto-vision infrastructure"
echo "═══════════════════════════════════════════════════════════"
echo -e "${NC}"
echo "  Project: ${PROJECT}"
echo "  Region:  ${REGION}"
echo ""
echo "  Resources to be deleted:"
echo "    - Cloud Run service: ${SERVICE_NAME}"
echo "    - Memorystore Redis: ${REDIS_INSTANCE}"
echo "    - VPC connector: ${VPC_CONNECTOR}"
echo "    - Cloud Scheduler jobs (7)"
echo "    - Domain mapping: ${DOMAIN}"
echo "    - Artifact Registry repo: ${SERVICE_NAME}"
echo "    - Secret Manager secrets (7)"
echo "    - Service accounts (2)"
echo ""
read -p "Type 'destroy' to confirm: " CONFIRM
if [ "${CONFIRM}" != "destroy" ]; then
  echo "Aborted."
  exit 0
fi

gcloud config set project "${PROJECT}" --quiet

# ─── 1. Delete Cloud Scheduler Jobs ──────────────────────────

warn "Deleting Cloud Scheduler jobs..."
for job in refresh-coins refresh-trending refresh-global refresh-fear-greed \
           refresh-defi-protocols refresh-defi-chains refresh-news; do
  gcloud scheduler jobs delete "${job}" --location="${REGION}" --quiet 2>/dev/null && \
    log "Deleted job: ${job}" || warn "Job not found: ${job}"
done

# ─── 2. Delete Domain Mapping ────────────────────────────────

warn "Deleting domain mapping..."
gcloud beta run domain-mappings delete \
  --domain="${DOMAIN}" \
  --region="${REGION}" \
  --quiet 2>/dev/null && log "Deleted domain mapping" || warn "Domain mapping not found"

# ─── 3. Delete Cloud Run Service ─────────────────────────────

warn "Deleting Cloud Run service..."
gcloud run services delete "${SERVICE_NAME}" \
  --region="${REGION}" \
  --quiet 2>/dev/null && log "Deleted Cloud Run service" || warn "Service not found"

# ─── 4. Delete Memorystore Redis ─────────────────────────────

warn "Deleting Memorystore Redis (this may take several minutes)..."
gcloud redis instances delete "${REDIS_INSTANCE}" \
  --region="${REGION}" \
  --quiet 2>/dev/null && log "Deleted Redis instance" || warn "Redis instance not found"

# ─── 5. Delete VPC Connector ─────────────────────────────────

warn "Deleting VPC connector..."
gcloud compute networks vpc-access connectors delete "${VPC_CONNECTOR}" \
  --region="${REGION}" \
  --quiet 2>/dev/null && log "Deleted VPC connector" || warn "VPC connector not found"

# ─── 6. Delete Artifact Registry ─────────────────────────────

warn "Deleting Artifact Registry repository..."
gcloud artifacts repositories delete "${SERVICE_NAME}" \
  --location="${REGION}" \
  --quiet 2>/dev/null && log "Deleted Artifact Registry repo" || warn "Repo not found"

# ─── 7. Delete Secrets ───────────────────────────────────────

warn "Deleting Secret Manager secrets..."
for secret in COINGECKO_API_KEY GROQ_API_KEY GEMINI_API_KEY OPENAI_API_KEY \
              ANTHROPIC_API_KEY OPENROUTER_API_KEY REDIS_URL; do
  gcloud secrets delete "${secret}" --quiet 2>/dev/null && \
    log "Deleted secret: ${secret}" || warn "Secret not found: ${secret}"
done

# ─── 8. Delete Service Accounts ──────────────────────────────

warn "Deleting service accounts..."
for sa in "${CLOUD_RUN_SA}" "${SCHEDULER_SA}"; do
  gcloud iam service-accounts delete \
    "${sa}@${PROJECT}.iam.gserviceaccount.com" \
    --quiet 2>/dev/null && log "Deleted SA: ${sa}" || warn "SA not found: ${sa}"
done

echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  Teardown complete.${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo ""
warn "APIs were NOT disabled (they may be used by other services)."
warn "To disable APIs: gcloud services disable SERVICE_NAME --force"
