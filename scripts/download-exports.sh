#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# Crypto Vision — Download All Exported Artifacts to Local Disk
#
# Downloads BigQuery exports, model weights, configs, and manifests
# from GCS to a timestamped local directory.
#
# Prerequisites:
#   - Google Cloud SDK installed (gsutil available on PATH)
#   - Authenticated: gcloud auth login
#
# Usage:
#   ./scripts/download-exports.sh                        # defaults to ./exports
#   ./scripts/download-exports.sh /mnt/external-drive    # custom destination
#   EXPORT_ID=export-2026-03-01_02-00-00 ./scripts/download-exports.sh  # specific export
#
# Environment:
#   GOOGLE_CLOUD_PROJECT / GCP_PROJECT_ID  — GCP project ID
#   EXPORT_ID                              — Specific export ID to download (optional)
#
# Copyright 2024-2026 nirholas. All rights reserved.
# ─────────────────────────────────────────────────────────────

set -euo pipefail

# ─── Configuration ────────────────────────────────────────────

PROJECT="${GCP_PROJECT_ID:-${GOOGLE_CLOUD_PROJECT:-crypto-vision-prod}}"
BUCKET="${PROJECT}-exports"
DEST="${1:-./exports}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# ─── Resolve Export ID ────────────────────────────────────────

if [[ -n "${EXPORT_ID:-}" ]]; then
  PREFIX="${EXPORT_ID}"
else
  # Find the latest export by listing top-level prefixes
  echo "Discovering latest export..."
  PREFIX=$(gsutil ls "gs://${BUCKET}/" 2>/dev/null \
    | grep -oP 'export-[^/]+' \
    | sort -r \
    | head -1 || true)

  if [[ -z "${PREFIX}" ]]; then
    echo "ERROR: No exports found in gs://${BUCKET}/"
    echo "Run 'npx tsx scripts/export-all.ts' first."
    exit 1
  fi
fi

EXPORT_DIR="${DEST}/crypto-vision-${PREFIX}"

# ─── Banner ───────────────────────────────────────────────────

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║     Download Crypto Vision Exports               ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""
echo "  Project:     ${PROJECT}"
echo "  Source:       gs://${BUCKET}/${PREFIX}/"
echo "  Destination:  ${EXPORT_DIR}"
echo ""

mkdir -p "${EXPORT_DIR}"

# ─── Download: Manifest ──────────────────────────────────────

echo "[1/4] Downloading manifest..."
gsutil cp "gs://${BUCKET}/${PREFIX}/manifest.json" "${EXPORT_DIR}/" 2>/dev/null \
  && echo "  Done." \
  || echo "  Warning: No manifest found."

# ─── Download: BigQuery Exports ──────────────────────────────

echo "[2/4] Downloading BigQuery tables (Parquet + JSONL)..."
if gsutil ls "gs://${BUCKET}/${PREFIX}/bigquery/" &>/dev/null; then
  gsutil -m cp -r "gs://${BUCKET}/${PREFIX}/bigquery/" "${EXPORT_DIR}/bigquery/"
  PARQUET_COUNT=$(find "${EXPORT_DIR}/bigquery" -name "*.parquet" 2>/dev/null | wc -l)
  JSONL_COUNT=$(find "${EXPORT_DIR}/bigquery" -name "*.jsonl*" 2>/dev/null | wc -l)
  echo "  Done. Parquet files: ${PARQUET_COUNT}, JSONL files: ${JSONL_COUNT}"
else
  echo "  Warning: No BigQuery exports found — skipping."
fi

# ─── Download: Model Weights ─────────────────────────────────

echo "[3/4] Downloading model weights..."
if gsutil ls "gs://${BUCKET}/${PREFIX}/models/" &>/dev/null; then
  gsutil -m cp -r "gs://${BUCKET}/${PREFIX}/models/" "${EXPORT_DIR}/models/"
  MODEL_COUNT=$(find "${EXPORT_DIR}/models" -type f 2>/dev/null | wc -l)
  echo "  Done. Model files: ${MODEL_COUNT}"
else
  echo "  Warning: No model exports found — skipping."
fi

# ─── Download: Configurations ─────────────────────────────────

echo "[4/4] Downloading configurations..."
if gsutil ls "gs://${BUCKET}/${PREFIX}/configs/" &>/dev/null; then
  gsutil -m cp -r "gs://${BUCKET}/${PREFIX}/configs/" "${EXPORT_DIR}/configs/"
  CONFIG_COUNT=$(find "${EXPORT_DIR}/configs" -type f 2>/dev/null | wc -l)
  echo "  Done. Config files: ${CONFIG_COUNT}"
else
  echo "  Warning: No config exports found — skipping."
fi

# ─── Summary ──────────────────────────────────────────────────

TOTAL_SIZE=$(du -sh "${EXPORT_DIR}" | cut -f1)

echo ""
echo "═══════════════════════════════════════════════════"
echo "  Download Complete!"
echo ""
echo "  Location:  ${EXPORT_DIR}"
echo "  Total Size: ${TOTAL_SIZE}"
echo ""
echo "  File counts:"
echo "    Parquet:  $(find "${EXPORT_DIR}" -name "*.parquet" 2>/dev/null | wc -l)"
echo "    JSONL:    $(find "${EXPORT_DIR}" -name "*.jsonl*" 2>/dev/null | wc -l)"
echo "    Models:   $(find "${EXPORT_DIR}/models" -type f 2>/dev/null | wc -l || echo 0)"
echo "    Configs:  $(find "${EXPORT_DIR}/configs" -type f 2>/dev/null | wc -l || echo 0)"
echo ""

# Print manifest summary if available
if [[ -f "${EXPORT_DIR}/manifest.json" ]]; then
  echo "  Manifest summary:"
  # Use node to parse JSON if available, otherwise raw
  if command -v node &>/dev/null; then
    node -e "
      const m = JSON.parse(require('fs').readFileSync('${EXPORT_DIR}/manifest.json','utf8'));
      console.log('    Export ID:  ' + m.exportId);
      console.log('    Exported:   ' + m.exportedAt);
      console.log('    Jobs:       ' + m.summary.total + ' total, ' + m.summary.completed + ' completed, ' + m.summary.failed + ' failed');
      console.log('    Size:       ' + (m.totalSizeBytes / 1024 / 1024 / 1024).toFixed(2) + ' GB');
    "
  else
    echo "    (install node.js to see parsed manifest)"
  fi
  echo ""
fi

echo "  Next steps:"
echo "    1. Verify Parquet: duckdb -c \"SELECT count(*) FROM read_parquet('${EXPORT_DIR}/bigquery/market_snapshots/*.parquet')\""
echo "    2. Import to PostgreSQL: npx tsx scripts/import-to-postgres.ts --dir ${EXPORT_DIR}/bigquery"
echo "    3. Import embeddings to Qdrant: see docs/SELF_HOSTING.md"
echo ""
echo "═══════════════════════════════════════════════════"
