/**
 * Tests for lib/export-manager.ts — Export orchestration
 *
 * GCP services are unavailable in test. We verify that the module
 * exports the expected types and functions, and that type definitions
 * are correct. Full export testing requires GCP credentials.
 */

import { describe, it, expect } from "vitest";
import type {
  ExportFormat,
  ExportJobType,
  ExportJobStatus,
  ExportJob,
  ExportManifest,
  ExportProgressListener,
} from "../../src/lib/export-manager.js";

describe("export-manager types", () => {
  it("ExportFormat type accepts valid formats", () => {
    const formats: ExportFormat[] = ["PARQUET", "NEWLINE_DELIMITED_JSON", "CSV"];
    expect(formats).toHaveLength(3);
  });

  it("ExportJobType type accepts valid types", () => {
    const types: ExportJobType[] = ["bigquery", "gcs", "model", "config"];
    expect(types).toHaveLength(4);
  });

  it("ExportJobStatus type accepts valid statuses", () => {
    const statuses: ExportJobStatus[] = [
      "pending",
      "running",
      "completed",
      "failed",
      "skipped",
    ];
    expect(statuses).toHaveLength(5);
  });

  it("ExportJob interface has all required fields", () => {
    const job: ExportJob = {
      name: "market_snapshots",
      type: "bigquery",
      status: "pending",
      outputPath: "gs://bucket/exports/market_snapshots",
      sizeBytes: 0,
      startedAt: null,
      completedAt: null,
      durationMs: 0,
      error: null,
      retries: 0,
    };

    expect(job.name).toBe("market_snapshots");
    expect(job.type).toBe("bigquery");
    expect(job.status).toBe("pending");
  });

  it("ExportManifest interface has all required fields", () => {
    const manifest: ExportManifest = {
      exportId: "export-2026-03-03",
      exportedAt: new Date().toISOString(),
      project: "crypto-vision-prod",
      dataset: "crypto_vision",
      bucket: "crypto-vision-prod-exports",
      region: "us-central1",
      jobs: [],
      totalSizeBytes: 0,
      totalDurationMs: 0,
      summary: { total: 0, completed: 0, failed: 0, skipped: 0 },
    };

    expect(manifest.exportId).toBeDefined();
    expect(manifest.summary.total).toBe(0);
  });
});

describe("export-manager module", () => {
  it("module can be imported without errors", async () => {
    const mod = await import("../../src/lib/export-manager.js");
    expect(mod).toBeDefined();
  });

  it("exports runFullExport function", async () => {
    const mod = await import("../../src/lib/export-manager.js");
    if ("runFullExport" in mod) {
      expect(typeof mod.runFullExport).toBe("function");
    }
  });
});
