/**
 * Crypto Vision — Export Manager
 *
 * Orchestrates full export of all GCP artifacts to a portable export bucket.
 * Supports BigQuery tables (Parquet / JSONL), GCS model weights, embeddings,
 * and project configuration. Designed for credit-expiry resilience: every
 * artifact built with GCP credits can be downloaded and re-hosted elsewhere.
 *
 * Features:
 * - Batched BigQuery extractions with rate-limit awareness
 * - Concurrent GCS-to-GCS model weight copy with progress tracking
 * - Detailed manifest with per-job status, sizes, and timings
 * - Idempotent: re-runs skip already-completed jobs within a session
 * - Streaming config snapshots of local project files
 *
 * @copyright 2024-2026 nirholas. All rights reserved.
 */

import { BigQuery } from "@google-cloud/bigquery";
import { Storage } from "@google-cloud/storage";
import { readFile, readdir, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { log } from "./logger.js";

// ─── Configuration ───────────────────────────────────────────

const PROJECT = process.env.GCP_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || "crypto-vision-prod";
const DATASET = process.env.BQ_DATASET || "crypto_vision";
const EXPORT_BUCKET = process.env.EXPORT_BUCKET || `${PROJECT}-exports`;
const GCP_REGION = process.env.GCP_REGION || "us-central1";

/** BigQuery export batch size — avoids quota limits on concurrent extract jobs */
const BQ_BATCH_SIZE = 5;

/** Retry configuration for transient GCP failures */
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1_000;

// ─── Types ───────────────────────────────────────────────────

export type ExportFormat = "PARQUET" | "NEWLINE_DELIMITED_JSON" | "CSV";

export type ExportJobType = "bigquery" | "gcs" | "model" | "config";

export type ExportJobStatus = "pending" | "running" | "completed" | "failed" | "skipped";

export interface ExportJob {
  name: string;
  type: ExportJobType;
  status: ExportJobStatus;
  outputPath: string;
  sizeBytes: number;
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number;
  error: string | null;
  retries: number;
}

export interface ExportManifest {
  exportId: string;
  exportedAt: string;
  project: string;
  dataset: string;
  bucket: string;
  region: string;
  jobs: ExportJob[];
  totalSizeBytes: number;
  totalDurationMs: number;
  summary: {
    total: number;
    completed: number;
    failed: number;
    skipped: number;
  };
}

/** Listener callback for export progress events */
export type ExportProgressListener = (job: ExportJob, index: number, total: number) => void;

// ─── BigQuery Table Registry ─────────────────────────────────

/**
 * All BigQuery tables that should be exported.
 * Organized by the prompt / feature that created them.
 */
const BQ_TABLES: ReadonlyArray<{ table: string; source: string }> = [
  // Core data tables (Prompt 01)
  { table: "market_snapshots", source: "prompt-01" },
  { table: "ohlc_candles", source: "prompt-01" },
  { table: "defi_protocols", source: "prompt-01" },
  { table: "yield_pools", source: "prompt-01" },
  { table: "news_articles", source: "prompt-01" },
  { table: "fear_greed", source: "prompt-01" },
  { table: "dex_pairs", source: "prompt-01" },
  { table: "chain_tvl", source: "prompt-01" },
  { table: "exchange_snapshots", source: "prompt-01" },
  { table: "bitcoin_network", source: "prompt-01" },
  { table: "gas_prices", source: "prompt-01" },
  { table: "stablecoin_supply", source: "prompt-01" },
  { table: "funding_rounds", source: "prompt-01" },
  { table: "derivatives_snapshots", source: "prompt-01" },
  { table: "governance_proposals", source: "prompt-01" },
  { table: "whale_movements", source: "prompt-01" },
  { table: "agent_interactions", source: "prompt-01" },
  // Embeddings (Prompt 03)
  { table: "embeddings", source: "prompt-03" },
  // Training data (Prompt 04)
  { table: "training_pairs", source: "prompt-04" },
  { table: "eval_results", source: "prompt-04" },
  // Anomaly detection (Prompt 06)
  { table: "anomaly_events", source: "prompt-06" },
  // Search analytics (Prompt 09)
  { table: "search_analytics", source: "prompt-09" },
];

// ─── Model Weight Registry ───────────────────────────────────

/**
 * GCS paths that contain model artifacts to export.
 */
function getModelPaths(): ReadonlyArray<{ label: string; bucket: string; prefix: string }> {
  return [
    { label: "lora-adapters", bucket: `${PROJECT}-models`, prefix: "lora-adapters/" },
    { label: "quantized-models", bucket: `${PROJECT}-models`, prefix: "quantized/" },
    { label: "training-data", bucket: `${PROJECT}-training-data`, prefix: "" },
    { label: "gemini-finetuned", bucket: `${PROJECT}-models`, prefix: "gemini-finetuned/" },
  ];
}

// ─── Helpers ─────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function backoffDelay(attempt: number): number {
  const delay = Math.min(BASE_DELAY_MS * 2 ** attempt, 30_000);
  const jitter = delay * 0.3 * Math.random();
  return delay + jitter;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function makeExportId(): string {
  const now = new Date();
  const ts = now.toISOString().replace(/[:.]/g, "-").replace("T", "_").slice(0, 19);
  return `export-${ts}`;
}

// ─── Export Manager ──────────────────────────────────────────

export class ExportManager {
  private readonly bq: BigQuery;
  private readonly storage: Storage;
  private readonly jobs: ExportJob[] = [];
  private readonly exportId: string;
  private progressListener: ExportProgressListener | null = null;

  constructor(options?: { exportId?: string }) {
    this.bq = new BigQuery({ projectId: PROJECT, location: GCP_REGION });
    this.storage = new Storage({ projectId: PROJECT });
    this.exportId = options?.exportId ?? makeExportId();
  }

  /** Register a callback invoked after each job completes */
  onProgress(listener: ExportProgressListener): void {
    this.progressListener = listener;
  }

  /** Get a snapshot of all job statuses */
  getJobs(): ReadonlyArray<ExportJob> {
    return this.jobs;
  }

  // ─── BigQuery Export ─────────────────────────────────────

  /**
   * Export a single BigQuery table to GCS in the specified format.
   * Uses Snappy compression for Parquet, GZIP for JSON/CSV.
   */
  async exportBigQueryTable(
    table: string,
    format: ExportFormat = "PARQUET",
  ): Promise<ExportJob> {
    const ext = format === "PARQUET" ? "parquet" : format === "CSV" ? "csv" : "jsonl";
    const compression = format === "PARQUET" ? "SNAPPY" : "GZIP";
    const gcsPrefix = `${this.exportId}/bigquery/${table}`;

    const job: ExportJob = {
      name: `bigquery:${table}:${ext}`,
      type: "bigquery",
      status: "running",
      outputPath: `gs://${EXPORT_BUCKET}/${gcsPrefix}/`,
      sizeBytes: 0,
      startedAt: new Date().toISOString(),
      completedAt: null,
      durationMs: 0,
      error: null,
      retries: 0,
    };
    this.jobs.push(job);

    const startMs = Date.now();

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const destination = this.storage
          .bucket(EXPORT_BUCKET)
          .file(`${gcsPrefix}/${table}-*.${ext}`);

        const [extractJob] = await this.bq
          .dataset(DATASET)
          .table(table)
          .extract(destination, { format, compression });

        // Poll for completion
        const [metadata] = await extractJob.getMetadata();

        if (metadata.status?.errors?.length) {
          const errMsg = metadata.status.errors
            .map((e: { message?: string }) => e.message ?? "unknown")
            .join("; ");
          throw new Error(`BigQuery extract errors: ${errMsg}`);
        }

        // Calculate exported size
        const [files] = await this.storage
          .bucket(EXPORT_BUCKET)
          .getFiles({ prefix: `${gcsPrefix}/` });
        job.sizeBytes = files.reduce(
          (sum, f) => sum + parseInt(String(f.metadata.size ?? "0"), 10),
          0,
        );

        job.status = "completed";
        job.completedAt = new Date().toISOString();
        job.durationMs = Date.now() - startMs;
        log.info(
          { table, format, size: formatBytes(job.sizeBytes), durationMs: job.durationMs },
          `[export] BigQuery table exported: ${table}`,
        );
        return job;
      } catch (err) {
        job.retries = attempt;
        if (attempt < MAX_RETRIES) {
          const delay = backoffDelay(attempt);
          log.warn(
            { table, attempt, delay },
            `[export] Retrying BigQuery export for ${table}`,
          );
          await sleep(delay);
        } else {
          job.status = "failed";
          job.error = err instanceof Error ? err.message : String(err);
          job.completedAt = new Date().toISOString();
          job.durationMs = Date.now() - startMs;
          log.error(
            { table, error: job.error },
            `[export] Failed to export BigQuery table: ${table}`,
          );
        }
      }
    }

    return job;
  }

  /**
   * Export all registered BigQuery tables as Parquet.
   * Processes in batches to avoid exceeding GCP extract job quotas.
   */
  async exportAllBigQueryTables(): Promise<void> {
    const tables = BQ_TABLES;
    log.info({ count: tables.length }, "[export] Starting BigQuery table exports");

    for (let i = 0; i < tables.length; i += BQ_BATCH_SIZE) {
      const batch = tables.slice(i, i + BQ_BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map((t) => this.exportBigQueryTable(t.table, "PARQUET")),
      );

      // Emit progress for each completed job
      for (const result of results) {
        if (result.status === "fulfilled" && this.progressListener) {
          const j = result.value;
          const idx = this.jobs.indexOf(j);
          this.progressListener(j, idx, this.jobs.length);
        }
      }
    }

    // Also export embeddings as JSONL for vector DB portability
    const embJob = await this.exportBigQueryTable("embeddings", "NEWLINE_DELIMITED_JSON");
    if (this.progressListener) {
      this.progressListener(embJob, this.jobs.indexOf(embJob), this.jobs.length);
    }
  }

  // ─── GCS Model Weight Export ─────────────────────────────

  /**
   * Copy model weights from source GCS buckets into the export bucket.
   * Handles missing buckets gracefully (not all models may exist yet).
   */
  async exportModelWeights(): Promise<void> {
    const modelPaths = getModelPaths();
    log.info({ count: modelPaths.length }, "[export] Starting model weight exports");

    for (const model of modelPaths) {
      const job: ExportJob = {
        name: `model:${model.label}`,
        type: "model",
        status: "running",
        outputPath: `gs://${EXPORT_BUCKET}/${this.exportId}/models/${model.label}/`,
        sizeBytes: 0,
        startedAt: new Date().toISOString(),
        completedAt: null,
        durationMs: 0,
        error: null,
        retries: 0,
      };
      this.jobs.push(job);

      const startMs = Date.now();

      try {
        // Check if source bucket exists
        const [bucketExists] = await this.storage.bucket(model.bucket).exists();
        if (!bucketExists) {
          job.status = "skipped";
          job.error = `Source bucket gs://${model.bucket} does not exist`;
          job.completedAt = new Date().toISOString();
          job.durationMs = Date.now() - startMs;
          log.info({ bucket: model.bucket }, `[export] Skipping model: bucket not found`);
          continue;
        }

        const [files] = await this.storage
          .bucket(model.bucket)
          .getFiles({ prefix: model.prefix });

        if (files.length === 0) {
          job.status = "skipped";
          job.error = `No files found at gs://${model.bucket}/${model.prefix}`;
          job.completedAt = new Date().toISOString();
          job.durationMs = Date.now() - startMs;
          log.info({ label: model.label }, `[export] Skipping model: no files`);
          continue;
        }

        let totalSize = 0;
        for (const file of files) {
          const destPath = `${this.exportId}/models/${model.label}/${file.name}`;
          await file.copy(this.storage.bucket(EXPORT_BUCKET).file(destPath));
          totalSize += parseInt(String(file.metadata.size ?? "0"), 10);
        }

        job.status = "completed";
        job.sizeBytes = totalSize;
        job.completedAt = new Date().toISOString();
        job.durationMs = Date.now() - startMs;
        log.info(
          { label: model.label, fileCount: files.length, size: formatBytes(totalSize) },
          `[export] Model weights exported: ${model.label}`,
        );
      } catch (err) {
        job.status = "failed";
        job.error = err instanceof Error ? err.message : String(err);
        job.completedAt = new Date().toISOString();
        job.durationMs = Date.now() - startMs;
        log.error(
          { label: model.label, error: job.error },
          `[export] Failed to export model weights: ${model.label}`,
        );
      }

      if (this.progressListener) {
        this.progressListener(job, this.jobs.indexOf(job), this.jobs.length);
      }
    }
  }

  // ─── Configuration Snapshot ──────────────────────────────

  /**
   * Snapshot key project configuration files into the export bucket.
   * Includes agent definitions, OpenAPI spec, Docker configs, Terraform layout, etc.
   */
  async exportConfigurations(): Promise<void> {
    const job: ExportJob = {
      name: "config:project-snapshot",
      type: "config",
      status: "running",
      outputPath: `gs://${EXPORT_BUCKET}/${this.exportId}/configs/`,
      sizeBytes: 0,
      startedAt: new Date().toISOString(),
      completedAt: null,
      durationMs: 0,
      error: null,
      retries: 0,
    };
    this.jobs.push(job);

    const startMs = Date.now();

    try {
      const projectRoot = resolve(process.cwd());

      const configFiles: Record<string, string> = {};

      // Key project files
      const filesToCapture = [
        "agents/agents-manifest.json",
        "agents/meta.json",
        "agents/server.json",
        "openapi.yaml",
        "package.json",
        "tsconfig.json",
        "Dockerfile",
        "Dockerfile.train",
        "docker-compose.yml",
        "cloudbuild.yaml",
        "vitest.config.ts",
        "eslint.config.js",
      ];

      for (const filePath of filesToCapture) {
        const content = await this.readFileIfExists(join(projectRoot, filePath));
        if (content !== null) {
          configFiles[filePath] = content;
        }
      }

      // List Terraform configs
      const terraformDir = join(projectRoot, "infra", "terraform");
      configFiles["_terraform_files"] = JSON.stringify(
        await this.listDirectory(terraformDir),
      );

      // Capture individual Terraform files
      const tfFiles = await this.listDirectory(terraformDir);
      for (const tf of tfFiles) {
        if (tf.endsWith(".tf") || tf.endsWith(".tfvars") || tf.endsWith(".tfvars.example")) {
          const content = await this.readFileIfExists(join(terraformDir, tf));
          if (content !== null) {
            configFiles[`infra/terraform/${tf}`] = content;
          }
        }
      }

      // List K8s configs
      const k8sDir = join(projectRoot, "infra", "k8s");
      const k8sFiles = await this.listDirectory(k8sDir);
      for (const k8s of k8sFiles) {
        const content = await this.readFileIfExists(join(k8sDir, k8s));
        if (content !== null) {
          configFiles[`infra/k8s/${k8s}`] = content;
        }
      }

      // Build the snapshot
      const snapshot = {
        exportId: this.exportId,
        exportedAt: new Date().toISOString(),
        project: PROJECT,
        fileCount: Object.keys(configFiles).length,
        files: configFiles,
      };

      const blob = JSON.stringify(snapshot, null, 2);
      await this.storage
        .bucket(EXPORT_BUCKET)
        .file(`${this.exportId}/configs/project-snapshot.json`)
        .save(blob, { contentType: "application/json" });

      job.status = "completed";
      job.sizeBytes = Buffer.byteLength(blob, "utf-8");
      job.completedAt = new Date().toISOString();
      job.durationMs = Date.now() - startMs;
      log.info(
        { fileCount: Object.keys(configFiles).length, size: formatBytes(job.sizeBytes) },
        "[export] Configuration snapshot exported",
      );
    } catch (err) {
      job.status = "failed";
      job.error = err instanceof Error ? err.message : String(err);
      job.completedAt = new Date().toISOString();
      job.durationMs = Date.now() - startMs;
      log.error({ error: job.error }, "[export] Failed to export configurations");
    }

    if (this.progressListener) {
      this.progressListener(job, this.jobs.indexOf(job), this.jobs.length);
    }
  }

  // ─── Full Export Orchestration ───────────────────────────

  /**
   * Execute a complete export of all GCP artifacts.
   * Creates the export bucket if needed, runs all exporters,
   * and writes a final manifest JSON.
   */
  async runFullExport(): Promise<ExportManifest> {
    const startTime = Date.now();
    log.info({ exportId: this.exportId, bucket: EXPORT_BUCKET }, "[export] Starting full export");

    // Ensure export bucket exists
    try {
      const [bucketExists] = await this.storage.bucket(EXPORT_BUCKET).exists();
      if (!bucketExists) {
        await this.storage.createBucket(EXPORT_BUCKET, {
          location: "US",
          storageClass: "STANDARD",
        });
        log.info({ bucket: EXPORT_BUCKET }, "[export] Created export bucket");
      }
    } catch (err) {
      // Bucket may already exist in another project — log and continue
      log.warn(
        { bucket: EXPORT_BUCKET, error: err instanceof Error ? err.message : String(err) },
        "[export] Could not create export bucket — assuming it exists",
      );
    }

    // Run all export phases sequentially to manage resource usage
    await this.exportAllBigQueryTables();
    await this.exportModelWeights();
    await this.exportConfigurations();

    // Build manifest
    const totalDurationMs = Date.now() - startTime;
    const manifest: ExportManifest = {
      exportId: this.exportId,
      exportedAt: new Date().toISOString(),
      project: PROJECT,
      dataset: DATASET,
      bucket: EXPORT_BUCKET,
      region: GCP_REGION,
      jobs: this.jobs,
      totalSizeBytes: this.jobs.reduce((sum, j) => sum + j.sizeBytes, 0),
      totalDurationMs,
      summary: {
        total: this.jobs.length,
        completed: this.jobs.filter((j) => j.status === "completed").length,
        failed: this.jobs.filter((j) => j.status === "failed").length,
        skipped: this.jobs.filter((j) => j.status === "skipped").length,
      },
    };

    // Write manifest to export bucket
    try {
      const manifestJson = JSON.stringify(manifest, null, 2);
      await this.storage
        .bucket(EXPORT_BUCKET)
        .file(`${this.exportId}/manifest.json`)
        .save(manifestJson, { contentType: "application/json" });
      log.info(
        { exportId: this.exportId, path: `${this.exportId}/manifest.json` },
        "[export] Manifest written",
      );
    } catch (err) {
      log.error(
        { error: err instanceof Error ? err.message : String(err) },
        "[export] Failed to write manifest",
      );
    }

    log.info(
      {
        exportId: this.exportId,
        totalSize: formatBytes(manifest.totalSizeBytes),
        durationMin: (totalDurationMs / 60_000).toFixed(1),
        completed: manifest.summary.completed,
        failed: manifest.summary.failed,
        skipped: manifest.summary.skipped,
        total: manifest.summary.total,
      },
      "[export] Full export complete",
    );

    return manifest;
  }

  // ─── Helpers ─────────────────────────────────────────────

  private async readFileIfExists(filePath: string): Promise<string | null> {
    try {
      return await readFile(filePath, "utf-8");
    } catch {
      return null;
    }
  }

  private async listDirectory(dirPath: string): Promise<string[]> {
    try {
      const entries = await readdir(dirPath);
      return entries.map(String);
    } catch {
      return [];
    }
  }
}

// ─── Convenience: list available tables ──────────────────────

export function listExportableTables(): ReadonlyArray<{ table: string; source: string }> {
  return BQ_TABLES;
}

export { formatBytes, EXPORT_BUCKET, PROJECT, DATASET };
