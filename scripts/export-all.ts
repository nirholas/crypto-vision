#!/usr/bin/env npx tsx
/**
 * Crypto Vision — Full Export Pipeline CLI
 *
 * Exports all GCP artifacts (BigQuery tables, model weights, configs) to a
 * portable export bucket. Run this periodically leading up to credit expiry.
 *
 * Usage:
 *   npx tsx scripts/export-all.ts                           # Full export
 *   npx tsx scripts/export-all.ts --dry-run                 # List what would be exported
 *   npx tsx scripts/export-all.ts --tables-only             # BigQuery tables only
 *   npx tsx scripts/export-all.ts --models-only             # Model weights only
 *   npx tsx scripts/export-all.ts --format NEWLINE_DELIMITED_JSON  # Override format
 *
 * Environment:
 *   GCP_PROJECT_ID   — GCP project (default: crypto-vision-prod)
 *   BQ_DATASET       — BigQuery dataset (default: crypto_vision)
 *   EXPORT_BUCKET    — Destination bucket (default: {project}-exports)
 *
 * @copyright 2024-2026 nirholas. All rights reserved.
 */

import { DATASET, EXPORT_BUCKET, ExportManager, listExportableTables, PROJECT } from "../src/lib/export-manager.js";

// ─── CLI Argument Parsing ────────────────────────────────────

const args = process.argv.slice(2);

function hasFlag(flag: string): boolean {
    return args.includes(flag);
}

function getFlagValue(flag: string, fallback: string): string {
    const idx = args.indexOf(flag);
    if (idx === -1 || idx + 1 >= args.length) return fallback;
    return args[idx + 1];
}

const dryRun = hasFlag("--dry-run");
const tablesOnly = hasFlag("--tables-only");
const modelsOnly = hasFlag("--models-only");
const format = getFlagValue("--format", "PARQUET");

// ─── Banner ──────────────────────────────────────────────────

function printBanner(): void {
    console.log();
    console.log("╔══════════════════════════════════════════════════╗");
    console.log("║       Crypto Vision — Full Export Pipeline       ║");
    console.log("╚══════════════════════════════════════════════════╝");
    console.log();
    console.log(`  Project:     ${PROJECT}`);
    console.log(`  Dataset:     ${DATASET}`);
    console.log(`  Dest Bucket: ${EXPORT_BUCKET}`);
    console.log(`  Format:      ${format}`);
    console.log(`  Mode:        ${dryRun ? "DRY RUN" : tablesOnly ? "Tables Only" : modelsOnly ? "Models Only" : "Full Export"}`);
    console.log();
}

// ─── Dry Run ─────────────────────────────────────────────────

function printDryRun(): void {
    const tables = listExportableTables();

    console.log("BigQuery Tables to Export:");
    console.log("─────────────────────────");
    for (const { table, source } of tables) {
        console.log(`  • ${table.padEnd(30)} (${source})`);
    }
    console.log(`  Total: ${tables.length} tables`);
    console.log();

    console.log("Model Weight Buckets:");
    console.log("─────────────────────");
    console.log(`  • gs://${PROJECT}-models/lora-adapters/`);
    console.log(`  • gs://${PROJECT}-models/quantized/`);
    console.log(`  • gs://${PROJECT}-training-data/`);
    console.log(`  • gs://${PROJECT}-models/gemini-finetuned/`);
    console.log();

    console.log("Configuration Files:");
    console.log("────────────────────");
    console.log("  • agents/agents-manifest.json, meta.json, server.json");
    console.log("  • openapi.yaml");
    console.log("  • package.json, tsconfig.json");
    console.log("  • Dockerfile, Dockerfile.train, docker-compose.yml");
    console.log("  • cloudbuild.yaml");
    console.log("  • infra/terraform/*.tf");
    console.log("  • infra/k8s/*");
    console.log();

    console.log("Estimated Total Size: 100–500 GB");
    console.log("Estimated Egress Cost: $12–60 (at $0.12/GB)");
    console.log();
    console.log("Run without --dry-run to execute the export.");
}

// ─── Full Export ─────────────────────────────────────────────

async function runExport(): Promise<void> {
    const manager = new ExportManager();

    // Attach progress listener for CLI output
    manager.onProgress((job, idx, total) => {
        const icon = job.status === "completed" ? "✓" : job.status === "failed" ? "✗" : "⊘";
        const size = job.sizeBytes > 0 ? ` (${formatSize(job.sizeBytes)})` : "";
        const dur = job.durationMs > 0 ? ` [${(job.durationMs / 1000).toFixed(1)}s]` : "";
        console.log(`  ${icon} ${job.name}${size}${dur}`);

        if (job.status === "failed" && job.error) {
            console.log(`    └─ Error: ${job.error}`);
        }
    });

    if (tablesOnly) {
        console.log("Exporting BigQuery tables...");
        console.log();
        await manager.exportAllBigQueryTables();
    } else if (modelsOnly) {
        console.log("Exporting model weights...");
        console.log();
        await manager.exportModelWeights();
    } else {
        console.log("Running full export...");
        console.log();
        const manifest = await manager.runFullExport();
        printSummary(manifest);
        return;
    }

    // Partial export — print what we know
    const jobs = manager.getJobs();
    const completed = jobs.filter((j) => j.status === "completed").length;
    const failed = jobs.filter((j) => j.status === "failed").length;
    const skipped = jobs.filter((j) => j.status === "skipped").length;
    const totalSize = jobs.reduce((sum, j) => sum + j.sizeBytes, 0);

    console.log();
    console.log("═══════════════════════════════════════════════════");
    console.log(`  Completed: ${completed} / ${jobs.length}`);
    console.log(`  Failed:    ${failed}`);
    console.log(`  Skipped:   ${skipped}`);
    console.log(`  Total Size: ${formatSize(totalSize)}`);
    console.log("═══════════════════════════════════════════════════");
}

function printSummary(manifest: {
    exportId: string;
    totalSizeBytes: number;
    totalDurationMs: number;
    summary: { total: number; completed: number; failed: number; skipped: number };
    jobs: ReadonlyArray<{ name: string; status: string; error: string | null }>;
}): void {
    console.log();
    console.log("═══════════════════════════════════════════════════");
    console.log("  Export Complete!");
    console.log(`  Export ID:   ${manifest.exportId}`);
    console.log(`  Total Size:  ${formatSize(manifest.totalSizeBytes)}`);
    console.log(`  Duration:    ${(manifest.totalDurationMs / 60_000).toFixed(1)} minutes`);
    console.log(`  Completed:   ${manifest.summary.completed} / ${manifest.summary.total}`);
    console.log(`  Failed:      ${manifest.summary.failed}`);
    console.log(`  Skipped:     ${manifest.summary.skipped}`);
    console.log("═══════════════════════════════════════════════════");

    const failed = manifest.jobs.filter((j) => j.status === "failed");
    if (failed.length > 0) {
        console.log();
        console.log("  Failed exports:");
        for (const job of failed) {
            console.log(`    ✗ ${job.name}: ${job.error}`);
        }
    }

    console.log();
    console.log(`  Manifest: gs://${EXPORT_BUCKET}/${manifest.exportId}/manifest.json`);
    console.log();
}

function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

// ─── Main ────────────────────────────────────────────────────

async function main(): Promise<void> {
    printBanner();

    if (dryRun) {
        printDryRun();
        process.exit(0);
    }

    await runExport();
}

main().catch((err) => {
    console.error();
    console.error("Export failed:", err instanceof Error ? err.message : String(err));
    if (err instanceof Error && err.stack) {
        console.error(err.stack);
    }
    process.exit(1);
});
