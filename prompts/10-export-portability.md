# Prompt 10: Export, Portability & Credit-Expiry Playbook

## Agent Identity & Rules

```
You are building the export and portability layer for Crypto Vision.
Your goal: ensure every artifact built with GCP credits survives after credits expire.
- Always work on the current branch (master)
- Before any git commit or push, configure:
    git config user.name "nirholas"
    git config user.email "nirholas@users.noreply.github.com"
- Always use background terminals (isBackground: true)
- Always kill terminals after commands complete
- We have unlimited Claude credits — build the best possible version
- No mocks, no fakes, no stubs — real implementations only
```

## Objective

Build an automated export pipeline that extracts ALL valuable artifacts from GCP before credits expire. Every dataset, model weight, embedding index, training data file, and configuration must be downloadable and portable to any cloud or self-hosted environment. This is the most critical prompt — it ensures $110k worth of work is not lost.

## Budget: $5k (for storage and egress)

- GCS storage: ~$0.02/GB/month
- Egress: $0.12/GB (budget for ~40TB transfer)
- BigQuery export: free to GCS in same region

## Value At Risk

Artifacts that MUST be exported:

| Artifact | Estimated Size | Source |
|----------|---------------|--------|
| BigQuery tables (17+) | 50-200 GB | Prompt 01 |
| Training data (JSONL) | 1-5 GB | Prompt 04 |
| Gemini fine-tuned models | Export weights if possible | Prompt 04 |
| LoRA adapters (4-8 models) | 500 MB - 2 GB each | Prompt 05 |
| Quantized model weights | 5-20 GB each | Prompt 05 |
| Embedding vectors | 10-50 GB | Prompt 03 |
| Search analytics | 1-10 GB | Prompt 09 |
| Anomaly detection history | 5-20 GB | Prompt 06 |
| Agent interaction logs | 1-10 GB | Prompt 07 |
| Pub/Sub dead letter archive | 1-5 GB | Prompt 02 |

**Total estimated: 100-500 GB**

## Deliverables

### 1. Export Manager (`src/lib/export-manager.ts`)

```typescript
// src/lib/export-manager.ts — Orchestrates full export of all GCP artifacts

import { BigQuery } from "@google-cloud/bigquery";
import { Storage } from "@google-cloud/storage";
import { log } from "./logger.js";

const PROJECT = process.env.GOOGLE_CLOUD_PROJECT || "crypto-vision-prod";
const DATASET = "crypto_vision";
const EXPORT_BUCKET = `${PROJECT}-exports`;

interface ExportJob {
  name: string;
  type: "bigquery" | "gcs" | "model" | "config";
  status: "pending" | "running" | "completed" | "failed";
  outputPath: string;
  sizeBytes?: number;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
}

interface ExportManifest {
  exportId: string;
  exportedAt: string;
  project: string;
  jobs: ExportJob[];
  totalSizeBytes: number;
  totalDurationMs: number;
}

export class ExportManager {
  private bq: BigQuery;
  private storage: Storage;
  private jobs: ExportJob[] = [];
  private manifest: ExportManifest;

  constructor() {
    this.bq = new BigQuery({ projectId: PROJECT });
    this.storage = new Storage({ projectId: PROJECT });
    this.manifest = {
      exportId: `export-${Date.now()}`,
      exportedAt: new Date().toISOString(),
      project: PROJECT,
      jobs: [],
      totalSizeBytes: 0,
      totalDurationMs: 0,
    };
  }

  // ─── BigQuery Export ─────────────────────────────────────

  async exportBigQueryTable(table: string, format: "PARQUET" | "NEWLINE_DELIMITED_JSON" | "CSV" = "PARQUET"): Promise<void> {
    const job: ExportJob = {
      name: `bigquery:${table}`,
      type: "bigquery",
      status: "running",
      outputPath: `gs://${EXPORT_BUCKET}/bigquery/${table}/`,
      startedAt: new Date(),
    };
    this.jobs.push(job);

    try {
      const ext = format === "PARQUET" ? "parquet" : format === "CSV" ? "csv" : "jsonl";
      const destination = this.storage
        .bucket(EXPORT_BUCKET)
        .file(`bigquery/${table}/${table}-*.${ext}`);

      const [exportJob] = await this.bq
        .dataset(DATASET)
        .table(table)
        .extract(destination, {
          format,
          compression: format === "PARQUET" ? "SNAPPY" : "GZIP",
        });

      // Wait for completion
      const [metadata] = await exportJob.getMetadata();
      job.status = metadata.status?.state === "DONE" ? "completed" : "failed";
      job.completedAt = new Date();

      if (metadata.status?.errors?.length) {
        job.error = metadata.status.errors.map((e: any) => e.message).join("; ");
        job.status = "failed";
      }

      // Get size
      const [files] = await this.storage.bucket(EXPORT_BUCKET).getFiles({ prefix: `bigquery/${table}/` });
      job.sizeBytes = files.reduce((sum, f) => sum + parseInt(f.metadata.size || "0"), 0);

      log.info(`Exported ${table}: ${(job.sizeBytes / 1024 / 1024).toFixed(1)} MB`);
    } catch (err) {
      job.status = "failed";
      job.error = err instanceof Error ? err.message : String(err);
      job.completedAt = new Date();
      log.error(`Failed to export ${table}`, err);
    }
  }

  async exportAllBigQueryTables(): Promise<void> {
    const tables = [
      // Core data tables (Prompt 01)
      "market_snapshots",
      "ohlc_candles",
      "defi_protocols",
      "yield_pools",
      "news_articles",
      "fear_greed",
      "dex_pairs",
      "chain_tvl",
      "exchange_snapshots",
      "bitcoin_network",
      "gas_prices",
      "stablecoin_supply",
      "funding_rounds",
      "derivatives_snapshots",
      "governance_proposals",
      "whale_movements",
      "agent_interactions",
      // Embeddings (Prompt 03)
      "embeddings",
      // Anomalies (Prompt 06)
      "anomaly_events",
      // Search analytics (Prompt 09)
      "search_analytics",
      // Training data (Prompt 04)
      "training_pairs",
      "eval_results",
    ];

    log.info(`Exporting ${tables.length} BigQuery tables...`);

    // Export in batches of 5 to avoid quota limits
    for (let i = 0; i < tables.length; i += 5) {
      const batch = tables.slice(i, i + 5);
      await Promise.allSettled(
        batch.map(t => this.exportBigQueryTable(t, "PARQUET"))
      );
    }

    // Also export embeddings as JSONL for portability
    await this.exportBigQueryTable("embeddings", "NEWLINE_DELIMITED_JSON");
  }

  // ─── Model Weight Export ─────────────────────────────────

  async exportModelWeights(): Promise<void> {
    const modelPaths = [
      // LoRA adapters (Prompt 05)
      `gs://${PROJECT}-models/lora-adapters/`,
      // Quantized models (Prompt 05)
      `gs://${PROJECT}-models/quantized/`,
      // Training data (Prompt 04)
      `gs://${PROJECT}-training-data/`,
      // Gemini fine-tuned model metadata
      `gs://${PROJECT}-models/gemini-finetuned/`,
    ];

    for (const sourcePath of modelPaths) {
      const job: ExportJob = {
        name: `model:${sourcePath.split("/").slice(-2, -1)[0]}`,
        type: "model",
        status: "running",
        outputPath: `gs://${EXPORT_BUCKET}/models/`,
        startedAt: new Date(),
      };
      this.jobs.push(job);

      try {
        const bucketName = sourcePath.replace("gs://", "").split("/")[0];
        const prefix = sourcePath.replace(`gs://${bucketName}/`, "");
        
        const [files] = await this.storage.bucket(bucketName).getFiles({ prefix });
        
        let totalSize = 0;
        for (const file of files) {
          const destPath = `models/${file.name}`;
          await file.copy(this.storage.bucket(EXPORT_BUCKET).file(destPath));
          totalSize += parseInt(file.metadata.size || "0");
        }

        job.status = "completed";
        job.sizeBytes = totalSize;
        job.completedAt = new Date();
        log.info(`Exported model weights: ${(totalSize / 1024 / 1024).toFixed(1)} MB`);
      } catch (err) {
        job.status = "failed";
        job.error = err instanceof Error ? err.message : String(err);
        job.completedAt = new Date();
      }
    }
  }

  // ─── Configuration Export ────────────────────────────────

  async exportConfigurations(): Promise<void> {
    const configs = {
      // Agent definitions
      agents: await this.readFileIfExists("agents/agents-manifest.json"),
      // OpenAPI spec
      openapi: await this.readFileIfExists("openapi.yaml"),
      // Infrastructure
      terraform: await this.listDirectory("infra/terraform/"),
      // Docker
      dockerfile: await this.readFileIfExists("Dockerfile"),
      dockerCompose: await this.readFileIfExists("docker-compose.yml"),
      // Cloud Build
      cloudbuild: await this.readFileIfExists("cloudbuild.yaml"),
      // Package info
      packageJson: await this.readFileIfExists("package.json"),
    };

    const configBlob = JSON.stringify(configs, null, 2);
    await this.storage
      .bucket(EXPORT_BUCKET)
      .file("configs/project-config.json")
      .save(configBlob);

    log.info("Exported project configurations");
  }

  private async readFileIfExists(path: string): Promise<string | null> {
    try {
      const fs = await import("node:fs/promises");
      return await fs.readFile(path, "utf-8");
    } catch { return null; }
  }

  private async listDirectory(path: string): Promise<string[]> {
    try {
      const fs = await import("node:fs/promises");
      return await fs.readdir(path, { recursive: true }).then(f => f.map(String));
    } catch { return []; }
  }

  // ─── Full Export ─────────────────────────────────────────

  async runFullExport(): Promise<ExportManifest> {
    const startTime = Date.now();
    log.info("Starting full export...");

    // Ensure export bucket exists
    const [bucketExists] = await this.storage.bucket(EXPORT_BUCKET).exists();
    if (!bucketExists) {
      await this.storage.createBucket(EXPORT_BUCKET, {
        location: "US",
        storageClass: "STANDARD",
      });
    }

    // Run all exports
    await this.exportAllBigQueryTables();
    await this.exportModelWeights();
    await this.exportConfigurations();

    // Write manifest
    this.manifest.jobs = this.jobs;
    this.manifest.totalSizeBytes = this.jobs.reduce((sum, j) => sum + (j.sizeBytes || 0), 0);
    this.manifest.totalDurationMs = Date.now() - startTime;

    await this.storage
      .bucket(EXPORT_BUCKET)
      .file(`manifest-${this.manifest.exportId}.json`)
      .save(JSON.stringify(this.manifest, null, 2));

    log.info(`Full export complete: ${this.jobs.filter(j => j.status === "completed").length}/${this.jobs.length} succeeded`);
    log.info(`Total size: ${(this.manifest.totalSizeBytes / 1024 / 1024 / 1024).toFixed(2)} GB`);
    log.info(`Duration: ${(this.manifest.totalDurationMs / 1000 / 60).toFixed(1)} minutes`);

    return this.manifest;
  }
}
```

### 2. Export API Route (`src/routes/export.ts`)

```typescript
// src/routes/export.ts — Admin endpoints for triggering and monitoring exports
import { Hono } from "hono";
import { ExportManager } from "../lib/export-manager.js";
import { Storage } from "@google-cloud/storage";

export const exportRoutes = new Hono();

let activeExport: ReturnType<ExportManager["runFullExport"]> | null = null;

// POST /api/admin/export — Trigger full export
exportRoutes.post("/", async (c) => {
  const adminKey = c.req.header("x-admin-key");
  if (adminKey !== process.env.ADMIN_API_KEY) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  if (activeExport) {
    return c.json({ error: "Export already in progress" }, 409);
  }

  const manager = new ExportManager();
  activeExport = manager.runFullExport();
  
  // Non-blocking — return immediately
  activeExport.finally(() => { activeExport = null; });

  return c.json({
    message: "Export started",
    status: "running",
    timestamp: new Date().toISOString(),
  });
});

// GET /api/admin/export/status — Check export status
exportRoutes.get("/status", async (c) => {
  const adminKey = c.req.header("x-admin-key");
  if (adminKey !== process.env.ADMIN_API_KEY) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  // List recent manifests from export bucket
  const PROJECT = process.env.GOOGLE_CLOUD_PROJECT || "crypto-vision-prod";
  const storage = new Storage({ projectId: PROJECT });
  
  try {
    const [files] = await storage
      .bucket(`${PROJECT}-exports`)
      .getFiles({ prefix: "manifest-", maxResults: 10 });

    const manifests = await Promise.all(
      files.map(async f => {
        const [content] = await f.download();
        return JSON.parse(content.toString());
      })
    );

    return c.json({
      activeExport: !!activeExport,
      recentExports: manifests.sort((a, b) =>
        new Date(b.exportedAt).getTime() - new Date(a.exportedAt).getTime()
      ),
    });
  } catch {
    return c.json({ activeExport: !!activeExport, recentExports: [] });
  }
});
```

### 3. Export CLI Script (`scripts/export-all.ts`)

```typescript
#!/usr/bin/env npx tsx
// scripts/export-all.ts — Run full export from CLI
// Usage: npx tsx scripts/export-all.ts [--format parquet|jsonl] [--include-models] [--dry-run]

import { ExportManager } from "../src/lib/export-manager.js";

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");

  console.log("╔══════════════════════════════════════════╗");
  console.log("║   Crypto Vision — Full Export Pipeline   ║");
  console.log("╚══════════════════════════════════════════╝");
  console.log();

  if (dryRun) {
    console.log("DRY RUN — listing what would be exported:");
    console.log();
    console.log("BigQuery Tables:");
    console.log("  - market_snapshots (partitioned by day)");
    console.log("  - ohlc_candles (partitioned by day)");
    console.log("  - defi_protocols (partitioned by day)");
    console.log("  - yield_pools (partitioned by day)");
    console.log("  - news_articles (partitioned by day)");
    console.log("  - fear_greed (partitioned by day)");
    console.log("  - dex_pairs (partitioned by day)");
    console.log("  - chain_tvl (partitioned by day)");
    console.log("  - exchange_snapshots (partitioned by day)");
    console.log("  - bitcoin_network (partitioned by day)");
    console.log("  - gas_prices (partitioned by day)");
    console.log("  - stablecoin_supply (partitioned by day)");
    console.log("  - funding_rounds (partitioned by day)");
    console.log("  - derivatives_snapshots (partitioned by day)");
    console.log("  - governance_proposals (partitioned by day)");
    console.log("  - whale_movements (partitioned by day)");
    console.log("  - agent_interactions (partitioned by day)");
    console.log("  - embeddings (partitioned by day)");
    console.log("  - anomaly_events (partitioned by day)");
    console.log("  - search_analytics (partitioned by day)");
    console.log("  - training_pairs");
    console.log("  - eval_results");
    console.log();
    console.log("Model Weights:");
    console.log("  - LoRA adapters (Llama 3.1 8B, 70B, Mistral 7B, Qwen 2.5 7B)");
    console.log("  - Quantized models (GPTQ 4-bit)");
    console.log("  - Training data (JSONL)");
    console.log("  - Gemini fine-tuned model metadata");
    console.log();
    console.log("Configurations:");
    console.log("  - Agent definitions");
    console.log("  - OpenAPI spec");
    console.log("  - Terraform configs");
    console.log("  - Docker configs");
    console.log();
    process.exit(0);
  }

  console.log("Starting full export...");
  console.log();

  const manager = new ExportManager();
  const manifest = await manager.runFullExport();

  console.log();
  console.log("═══════════════════════════════════════════");
  console.log("Export Complete!");
  console.log(`  Export ID:   ${manifest.exportId}`);
  console.log(`  Total Size:  ${(manifest.totalSizeBytes / 1024 / 1024 / 1024).toFixed(2)} GB`);
  console.log(`  Duration:    ${(manifest.totalDurationMs / 1000 / 60).toFixed(1)} minutes`);
  console.log(`  Succeeded:   ${manifest.jobs.filter(j => j.status === "completed").length}/${manifest.jobs.length}`);
  console.log(`  Failed:      ${manifest.jobs.filter(j => j.status === "failed").length}/${manifest.jobs.length}`);
  console.log();

  // Print failed jobs
  const failed = manifest.jobs.filter(j => j.status === "failed");
  if (failed.length > 0) {
    console.log("Failed exports:");
    for (const job of failed) {
      console.log(`  ✗ ${job.name}: ${job.error}`);
    }
  }

  console.log();
  console.log(`Manifest: gs://${process.env.GOOGLE_CLOUD_PROJECT}-exports/manifest-${manifest.exportId}.json`);
}

main().catch(err => {
  console.error("Export failed:", err);
  process.exit(1);
});
```

### 4. Download Script (`scripts/download-exports.sh`)

```bash
#!/usr/bin/env bash
# scripts/download-exports.sh — Download all exported artifacts to local disk
# Usage: ./scripts/download-exports.sh [destination_dir]
# Requires: gsutil (Google Cloud SDK)

set -euo pipefail

PROJECT="${GOOGLE_CLOUD_PROJECT:-crypto-vision-prod}"
BUCKET="${PROJECT}-exports"
DEST="${1:-./exports}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
EXPORT_DIR="${DEST}/crypto-vision-export-${TIMESTAMP}"

echo "╔══════════════════════════════════════════╗"
echo "║    Download Crypto Vision Exports        ║"
echo "╚══════════════════════════════════════════╝"
echo ""
echo "Source:      gs://${BUCKET}"
echo "Destination: ${EXPORT_DIR}"
echo ""

mkdir -p "${EXPORT_DIR}"

# Download BigQuery exports (Parquet)
echo "📦 Downloading BigQuery tables..."
gsutil -m cp -r "gs://${BUCKET}/bigquery/" "${EXPORT_DIR}/bigquery/" || echo "  ⚠ Some BigQuery exports missing"

# Download model weights
echo "🤖 Downloading model weights..."
gsutil -m cp -r "gs://${BUCKET}/models/" "${EXPORT_DIR}/models/" || echo "  ⚠ Some model exports missing"

# Download configurations
echo "⚙️  Downloading configurations..."
gsutil -m cp -r "gs://${BUCKET}/configs/" "${EXPORT_DIR}/configs/" || echo "  ⚠ Some config exports missing"

# Download manifest
echo "📋 Downloading manifest..."
gsutil cp "gs://${BUCKET}/manifest-*.json" "${EXPORT_DIR}/" || echo "  ⚠ No manifest found"

# Calculate total size
TOTAL_SIZE=$(du -sh "${EXPORT_DIR}" | cut -f1)

echo ""
echo "═══════════════════════════════════════════"
echo "Download Complete!"
echo "  Location: ${EXPORT_DIR}"
echo "  Size:     ${TOTAL_SIZE}"
echo ""
echo "Contents:"
find "${EXPORT_DIR}" -type d -maxdepth 2 | sed 's/^/  /'
echo ""
echo "File counts by type:"
echo "  Parquet: $(find "${EXPORT_DIR}" -name "*.parquet" | wc -l)"
echo "  JSONL:   $(find "${EXPORT_DIR}" -name "*.jsonl*" | wc -l)"
echo "  Models:  $(find "${EXPORT_DIR}/models" -type f 2>/dev/null | wc -l)"
echo "  Configs: $(find "${EXPORT_DIR}/configs" -type f 2>/dev/null | wc -l)"
```

### 5. Self-Hosting Migration Guide (`docs/SELF_HOSTING.md`)

Create a comprehensive document covering:

```markdown
# Self-Hosting Crypto Vision After GCP Credits Expire

## Overview

This guide covers how to run Crypto Vision on any infrastructure after GCP
credits are exhausted. All artifacts have been exported and are portable.

## Exported Artifacts

### BigQuery Data → PostgreSQL / DuckDB / ClickHouse

All BigQuery tables are exported as Parquet files. These can be imported into
any analytical database:

**DuckDB (recommended for small-medium deployments):**
```sql
-- Install DuckDB: brew install duckdb
-- Import all Parquet files
CREATE TABLE market_snapshots AS 
  SELECT * FROM read_parquet('exports/bigquery/market_snapshots/*.parquet');
-- Repeat for all tables...
```

**PostgreSQL:**
```sql
-- Use pgloader or COPY with parquet_fdw extension
CREATE EXTENSION parquet_fdw;
-- Or convert to CSV first:
-- duckdb -c "COPY (SELECT * FROM read_parquet('*.parquet')) TO 'output.csv'"
```

**ClickHouse:**
```sql
-- ClickHouse natively reads Parquet
INSERT INTO market_snapshots 
  SELECT * FROM file('exports/bigquery/market_snapshots/*.parquet', Parquet);
```

### Model Weights → Local GPU / RunPod / Vast.ai

LoRA adapters and quantized models are in standard formats compatible with:
- **vLLM**: Run GPTQ models with OpenAI-compatible API
- **text-generation-inference (TGI)**: Hugging Face's inference server
- **llama.cpp**: CPU inference with GGUF quantization
- **Ollama**: Easy local deployment

**Quick start with vLLM:**
```bash
pip install vllm
python -m vllm.entrypoints.openai.api_server \
  --model ./exports/models/quantized/llama-3.1-8b-crypto-gptq \
  --quantization gptq \
  --port 8000
```

**Budget alternatives:**
| Provider | GPU | Cost (8B model) | Cost (70B model) |
|----------|-----|-----------------|-------------------|
| RunPod | A100 80GB | $1.64/hr | $3.28/hr (2xA100) |
| Vast.ai | A100 80GB | $1.10/hr | $2.20/hr |
| Lambda | A100 80GB | $1.25/hr | $2.50/hr |
| Self-hosted | RTX 4090 | $0 (after purchase) | N/A |

### Embeddings → Any Vector Database

Embeddings are exported as JSONL with vectors. Import into:

**Qdrant (recommended):**
```python
from qdrant_client import QdrantClient
client = QdrantClient(url="http://localhost:6333")
# Import from JSONL...
```

**ChromaDB, Pinecone, Weaviate, pgvector** — all standard formats
supported.

### Running Without GCP

1. **Replace BigQuery** with DuckDB (embedded) or PostgreSQL
2. **Replace Vertex AI** with vLLM or Ollama for inference
3. **Replace Pub/Sub** with Redis Streams or BullMQ
4. **Replace GCS** with S3/MinIO/local filesystem
5. **Replace Cloud Run** with Docker Compose or k3s
6. **Replace Memorystore** with self-hosted Redis
7. **Replace Cloud Scheduler** with cron or node-cron

## Minimal Self-Hosted Stack

```yaml
# docker-compose.self-hosted.yml
services:
  app:
    build: .
    ports: ["3000:3000"]
    environment:
      - REDIS_URL=redis://redis:6379
      - DATABASE_URL=postgresql://postgres:postgres@db:5432/crypto
    depends_on: [redis, db]

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: crypto
      POSTGRES_PASSWORD: postgres
    volumes:
      - pgdata:/var/lib/postgresql/data

  vllm:
    image: vllm/vllm-openai:latest
    runtime: nvidia
    ports: ["8000:8000"]
    volumes:
      - ./exports/models:/models
    command: >
      --model /models/quantized/llama-3.1-8b-crypto-gptq
      --quantization gptq

  qdrant:
    image: qdrant/qdrant:latest
    ports: ["6333:6333"]
    volumes:
      - qdrant_data:/qdrant/storage

volumes:
  pgdata:
  qdrant_data:
```

## Monthly Costs After GCP (estimated)

| Component | Self-Hosted | Cloud (cheap) |
|-----------|------------|---------------|
| App Server | $20/mo (VPS) | $50/mo (Fly.io) |
| Redis | included | $15/mo (Upstash) |
| Database | included | $25/mo (Supabase) |
| GPU (8B model) | $0 (RTX 4090) | $320/mo (RunPod) |
| Vector DB | included | $25/mo (Qdrant Cloud) |
| **Total** | **$20/mo** | **$435/mo** |

## Export Schedule

Run exports on this schedule leading up to credit expiry:

- **Month 4**: First full export (test the pipeline)
- **Month 5**: Weekly incremental exports 
- **Month 5.5**: Daily exports, set up self-hosted infra
- **Month 6**: Final export, switch DNS, decommission GCP
```

### 6. Automated Export Cloud Scheduler

```hcl
# infra/terraform/export.tf

resource "google_cloud_scheduler_job" "weekly_export" {
  name             = "weekly-full-export"
  description      = "Run full export every Sunday at 2 AM UTC"
  schedule         = "0 2 * * 0"
  time_zone        = "UTC"
  attempt_deadline = "1800s"

  http_target {
    http_method = "POST"
    uri         = "${google_cloud_run_v2_service.api.uri}/api/admin/export"
    headers = {
      "x-admin-key" = "{{ADMIN_API_KEY}}"
      "Content-Type" = "application/json"
    }
    oidc_token {
      service_account_email = google_service_account.scheduler.email
    }
  }
}

resource "google_storage_bucket" "exports" {
  name     = "${var.project_id}-exports"
  location = "US"

  lifecycle_rule {
    condition {
      age = 90  # Keep exports for 90 days
    }
    action {
      type = "Delete"
    }
  }

  versioning {
    enabled = true
  }
}
```

### 7. Parquet-to-Database Migration Script (`scripts/import-to-postgres.ts`)

```typescript
#!/usr/bin/env npx tsx
// scripts/import-to-postgres.ts — Import exported Parquet files into PostgreSQL
// Usage: npx tsx scripts/import-to-postgres.ts --dir ./exports/bigquery --db postgres://localhost/crypto

import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { execSync } from "node:child_process";

const args = process.argv.slice(2);
const exportDir = args[args.indexOf("--dir") + 1] || "./exports/bigquery";
const dbUrl = args[args.indexOf("--db") + 1] || "postgres://localhost:5432/crypto_vision";

async function importTable(tableName: string, parquetDir: string): Promise<void> {
  console.log(`Importing ${tableName}...`);
  
  // Use DuckDB as a bridge: Parquet → CSV → PostgreSQL COPY
  // This avoids needing the parquet_fdw extension
  const csvPath = `/tmp/${tableName}.csv`;
  
  // Convert Parquet to CSV using DuckDB
  execSync(
    `duckdb -c "COPY (SELECT * FROM read_parquet('${parquetDir}/*.parquet')) TO '${csvPath}' (HEADER, DELIMITER ',')"`,
    { stdio: "pipe" }
  );
  
  // Create table from CSV header
  execSync(
    `head -1 ${csvPath} | psql "${dbUrl}" -c "CREATE TABLE IF NOT EXISTS ${tableName} AS SELECT * FROM read_csv_auto('${csvPath}') LIMIT 0"`,
    { stdio: "pipe" }
  );
  
  // Import CSV into PostgreSQL
  execSync(
    `psql "${dbUrl}" -c "\\COPY ${tableName} FROM '${csvPath}' WITH (FORMAT csv, HEADER true)"`,
    { stdio: "pipe" }
  );
  
  console.log(`  ✓ ${tableName} imported`);
}

async function main(): Promise<void> {
  console.log("Importing Parquet exports into PostgreSQL...");
  console.log(`Source: ${exportDir}`);
  console.log(`Database: ${dbUrl}`);
  console.log();

  const tables = await readdir(exportDir);
  
  for (const table of tables) {
    const tablePath = join(exportDir, table);
    try {
      await importTable(table, tablePath);
    } catch (err) {
      console.error(`  ✗ Failed to import ${table}:`, err);
    }
  }

  console.log();
  console.log("Import complete!");
}

main().catch(console.error);
```

## Validation

1. `scripts/export-all.ts --dry-run` lists all artifacts to be exported
2. `ExportManager.runFullExport()` exports all BigQuery tables as Parquet
3. Model weights copied to export bucket
4. Manifest JSON includes all job statuses and sizes
5. `scripts/download-exports.sh` downloads everything locally
6. Parquet files are readable with DuckDB: `duckdb -c "SELECT count(*) FROM read_parquet('market_snapshots/*.parquet')"`
7. `scripts/import-to-postgres.ts` successfully imports into PostgreSQL
8. Self-hosting docker-compose stack boots and runs
9. Weekly Cloud Scheduler job triggers export
10. `npx tsc --noEmit` passes

## Timeline

- **Month 4**: Implement export pipeline, first test export
- **Month 5**: Run weekly exports, validate all artifacts  
- **Month 5.5**: Set up self-hosted infra, run parallel for validation
- **Day before expiry**: Final export, DNS switch, GCP decommission
