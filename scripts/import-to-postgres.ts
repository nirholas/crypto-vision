#!/usr/bin/env npx tsx
/**
 * Crypto Vision — Import Parquet Exports into PostgreSQL
 *
 * Converts exported Parquet files to CSV via DuckDB and bulk-loads
 * them into PostgreSQL using COPY. This is the recommended migration
 * path when moving off BigQuery.
 *
 * Prerequisites:
 *   - DuckDB CLI installed: brew install duckdb / apt install duckdb
 *   - PostgreSQL running with target database created
 *   - psql available on PATH
 *
 * Usage:
 *   npx tsx scripts/import-to-postgres.ts --dir ./exports/bigquery --db postgres://localhost:5432/crypto_vision
 *   npx tsx scripts/import-to-postgres.ts --dir ./exports/bigquery --db postgres://localhost:5432/crypto_vision --dry-run
 *   npx tsx scripts/import-to-postgres.ts --dir ./exports/bigquery --db postgres://localhost:5432/crypto_vision --table market_snapshots
 *
 * @copyright 2024-2026 nirholas. All rights reserved.
 */

import { readdir, stat, unlink } from "node:fs/promises";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";

// ─── Argument Parsing ────────────────────────────────────────

const args = process.argv.slice(2);

function getArgValue(flag: string, fallback: string): string {
  const idx = args.indexOf(flag);
  if (idx === -1 || idx + 1 >= args.length) return fallback;
  return args[idx + 1];
}

function hasFlag(flag: string): boolean {
  return args.includes(flag);
}

const exportDir = getArgValue("--dir", "./exports/bigquery");
const dbUrl = getArgValue("--db", "postgres://localhost:5432/crypto_vision");
const dryRun = hasFlag("--dry-run");
const onlyTable = getArgValue("--table", "");
const skipErrors = hasFlag("--skip-errors");

// ─── Types ───────────────────────────────────────────────────

interface ImportResult {
  table: string;
  status: "success" | "failed" | "skipped";
  rowCount: number;
  durationMs: number;
  error?: string;
}

// ─── Helpers ─────────────────────────────────────────────────

function checkPrerequisites(): void {
  try {
    execSync("which duckdb", { stdio: "pipe" });
  } catch {
    console.error("ERROR: duckdb is not installed or not on PATH.");
    console.error("Install it: brew install duckdb  /  apt install duckdb  /  https://duckdb.org/docs/installation");
    process.exit(1);
  }

  try {
    execSync("which psql", { stdio: "pipe" });
  } catch {
    console.error("ERROR: psql is not installed or not on PATH.");
    console.error("Install it: apt install postgresql-client  /  brew install postgresql");
    process.exit(1);
  }
}

function execCommand(cmd: string): string {
  return execSync(cmd, { stdio: "pipe", maxBuffer: 50 * 1024 * 1024 }).toString().trim();
}

/**
 * Import a single table from Parquet files into PostgreSQL.
 * Steps:
 *  1. Read Parquet schema with DuckDB to auto-create the table
 *  2. Convert Parquet to CSV
 *  3. Load CSV into PostgreSQL via COPY
 */
async function importTable(tableName: string, parquetDir: string): Promise<ImportResult> {
  const startMs = Date.now();
  const csvPath = `/tmp/cv-import-${tableName}-${Date.now()}.csv`;

  try {
    // Check if parquet files exist
    const files = await readdir(parquetDir);
    const parquetFiles = files.filter((f) => f.endsWith(".parquet"));

    if (parquetFiles.length === 0) {
      return {
        table: tableName,
        status: "skipped",
        rowCount: 0,
        durationMs: Date.now() - startMs,
        error: "No .parquet files found",
      };
    }

    // Step 1: Get row count from Parquet
    const countResult = execCommand(
      `duckdb -c "SELECT count(*) AS cnt FROM read_parquet('${parquetDir}/*.parquet')" -csv -noheader`,
    );
    const rowCount = parseInt(countResult, 10) || 0;

    if (rowCount === 0) {
      return {
        table: tableName,
        status: "skipped",
        rowCount: 0,
        durationMs: Date.now() - startMs,
        error: "Table is empty",
      };
    }

    // Step 2: Generate CREATE TABLE DDL from Parquet schema
    const ddl = execCommand(
      `duckdb -c "SELECT sql FROM duckdb_tables() WHERE table_name = 't'" -csv -noheader <<'DUCKEOF'
CREATE TABLE t AS SELECT * FROM read_parquet('${parquetDir}/*.parquet') LIMIT 0;
SELECT sql FROM duckdb_tables() WHERE table_name = 't';
DUCKEOF`,
    );

    // Convert DuckDB DDL to PostgreSQL-compatible DDL
    const pgDdl = convertDuckDbDdlToPostgres(ddl, tableName);

    // Step 3: Create table in PostgreSQL (drop if exists for idempotency)
    execCommand(
      `psql "${dbUrl}" -c "DROP TABLE IF EXISTS ${tableName} CASCADE;"`,
    );
    execCommand(`psql "${dbUrl}" -c "${pgDdl}"`);

    // Step 4: Export Parquet to CSV via DuckDB
    execCommand(
      `duckdb -c "COPY (SELECT * FROM read_parquet('${parquetDir}/*.parquet')) TO '${csvPath}' (HEADER, DELIMITER ',')"`,
    );

    // Step 5: COPY CSV into PostgreSQL
    execCommand(
      `psql "${dbUrl}" -c "\\COPY ${tableName} FROM '${csvPath}' WITH (FORMAT csv, HEADER true)"`,
    );

    // Verify row count in PostgreSQL
    const pgCount = execCommand(
      `psql "${dbUrl}" -t -c "SELECT count(*) FROM ${tableName}"`,
    ).trim();

    // Cleanup temp CSV
    try {
      await unlink(csvPath);
    } catch {
      // Non-critical
    }

    return {
      table: tableName,
      status: "success",
      rowCount: parseInt(pgCount, 10) || rowCount,
      durationMs: Date.now() - startMs,
    };
  } catch (err) {
    // Cleanup temp CSV on error
    try {
      await unlink(csvPath);
    } catch {
      // Non-critical
    }

    return {
      table: tableName,
      status: "failed",
      rowCount: 0,
      durationMs: Date.now() - startMs,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Convert DuckDB CREATE TABLE DDL to PostgreSQL-compatible syntax.
 * Handles common type mappings.
 */
function convertDuckDbDdlToPostgres(ddl: string, tableName: string): string {
  let pg = ddl
    // Replace table name
    .replace(/CREATE TABLE \w+/i, `CREATE TABLE ${tableName}`)
    // DuckDB types → PostgreSQL
    .replace(/\bHUGEINT\b/gi, "NUMERIC")
    .replace(/\bUHUGEINT\b/gi, "NUMERIC")
    .replace(/\bUBIGINT\b/gi, "NUMERIC")
    .replace(/\bUINTEGER\b/gi, "BIGINT")
    .replace(/\bUSMALLINT\b/gi, "INTEGER")
    .replace(/\bUTINYINT\b/gi, "SMALLINT")
    .replace(/\bTINYINT\b/gi, "SMALLINT")
    .replace(/\bBLOB\b/gi, "BYTEA")
    .replace(/\bSTRUCT\([^)]*\)/gi, "JSONB")
    .replace(/\bMAP\([^)]*\)/gi, "JSONB")
    .replace(/\bLIST\([^)]*\)/gi, "JSONB")
    .replace(/\bUNION\([^)]*\)/gi, "TEXT");

  // Ensure it ends with a semicolon
  if (!pg.trim().endsWith(";")) {
    pg = pg.trim() + ";";
  }

  return pg;
}

// ─── Main ────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log();
  console.log("╔══════════════════════════════════════════════════╗");
  console.log("║   Import Parquet Exports into PostgreSQL         ║");
  console.log("╚══════════════════════════════════════════════════╝");
  console.log();
  console.log(`  Source:   ${exportDir}`);
  console.log(`  Database: ${dbUrl.replace(/\/\/[^@]+@/, "//***@")}`); // Redact credentials
  console.log(`  Mode:     ${dryRun ? "DRY RUN" : "Import"}`);
  console.log();

  if (!dryRun) {
    checkPrerequisites();
  }

  // Discover tables (each subdirectory in the export dir)
  if (!existsSync(exportDir)) {
    console.error(`ERROR: Export directory not found: ${exportDir}`);
    console.error("Run 'npx tsx scripts/export-all.ts' and './scripts/download-exports.sh' first.");
    process.exit(1);
  }

  const entries = await readdir(exportDir);
  const tables: string[] = [];

  for (const entry of entries) {
    const entryPath = join(exportDir, entry);
    const s = await stat(entryPath);
    if (s.isDirectory()) {
      if (onlyTable && entry !== onlyTable) continue;
      tables.push(entry);
    }
  }

  if (tables.length === 0) {
    console.error("No table directories found in export dir.");
    process.exit(1);
  }

  console.log(`Found ${tables.length} table(s) to import:`);
  for (const t of tables) {
    console.log(`  • ${t}`);
  }
  console.log();

  if (dryRun) {
    console.log("Dry run — no changes made.");
    process.exit(0);
  }

  // Import each table
  const results: ImportResult[] = [];

  for (const table of tables) {
    const tablePath = join(exportDir, table);
    process.stdout.write(`  Importing ${table}... `);

    const result = await importTable(table, tablePath);
    results.push(result);

    if (result.status === "success") {
      console.log(`done (${result.rowCount.toLocaleString()} rows, ${(result.durationMs / 1000).toFixed(1)}s)`);
    } else if (result.status === "skipped") {
      console.log(`skipped: ${result.error}`);
    } else {
      console.log(`FAILED: ${result.error}`);
      if (!skipErrors) {
        console.error(`\nUse --skip-errors to continue past failures.`);
        process.exit(1);
      }
    }
  }

  // Summary
  const succeeded = results.filter((r) => r.status === "success");
  const failed = results.filter((r) => r.status === "failed");
  const skipped = results.filter((r) => r.status === "skipped");
  const totalRows = succeeded.reduce((sum, r) => sum + r.rowCount, 0);
  const totalDuration = results.reduce((sum, r) => sum + r.durationMs, 0);

  console.log();
  console.log("═══════════════════════════════════════════════════");
  console.log("  Import Complete!");
  console.log(`  Succeeded: ${succeeded.length} / ${results.length}`);
  console.log(`  Failed:    ${failed.length}`);
  console.log(`  Skipped:   ${skipped.length}`);
  console.log(`  Total Rows: ${totalRows.toLocaleString()}`);
  console.log(`  Duration:  ${(totalDuration / 1000).toFixed(1)}s`);
  console.log("═══════════════════════════════════════════════════");

  if (failed.length > 0) {
    console.log();
    console.log("  Failed tables:");
    for (const f of failed) {
      console.log(`    ✗ ${f.table}: ${f.error}`);
    }
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Import failed:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
