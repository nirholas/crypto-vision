/**
 * Crypto Vision — Export API Routes
 *
 * Admin-only endpoints for triggering, monitoring, and listing GCP artifact exports.
 * All endpoints require an admin API key (via the `requireAdmin` middleware).
 *
 * POST /api/admin/export             — Trigger a full export
 * GET  /api/admin/export/status      — Get status of current / recent exports
 * GET  /api/admin/export/tables      — List all exportable BigQuery tables
 * GET  /api/admin/export/manifest/:id — Fetch a specific manifest by export ID
 *
 * @copyright 2024-2026 nirholas. All rights reserved.
 */

import { Storage } from "@google-cloud/storage";
import { Hono } from "hono";
import { requireAdmin } from "../lib/auth.js";
import {
  EXPORT_BUCKET,
  ExportManager,
  listExportableTables,
  PROJECT,
  type ExportManifest,
} from "../lib/export-manager.js";
import { log } from "../lib/logger.js";

export const exportRoutes = new Hono();

// All export routes require admin privileges
exportRoutes.use("*", requireAdmin());

// ─── State ───────────────────────────────────────────────────

/**
 * Track the active export promise so we can:
 * 1. Prevent concurrent exports (409 if one is running)
 * 2. Report whether an export is in-progress from /status
 */
let activeExportPromise: Promise<ExportManifest> | null = null;
let activeExportId: string | null = null;
let lastManifest: ExportManifest | null = null;

// ─── POST / — Trigger Full Export ────────────────────────────

exportRoutes.post("/", async (c) => {
  if (activeExportPromise) {
    return c.json(
      {
        error: "CONFLICT",
        message: "An export is already in progress.",
        activeExportId,
      },
      409,
    );
  }

  const manager = new ExportManager();
  const exportId = manager.getJobs.length === 0
    ? `export-${Date.now()}`
    : "unknown";

  // Read export ID from jobs metadata after construction
  activeExportId = exportId;

  log.info({ exportId }, "[export-api] Full export triggered");

  // Non-blocking — kick off the export and return immediately
  activeExportPromise = manager.runFullExport();

  activeExportPromise
    .then((manifest) => {
      lastManifest = manifest;
      log.info(
        { exportId: manifest.exportId, completed: manifest.summary.completed, failed: manifest.summary.failed },
        "[export-api] Export completed",
      );
    })
    .catch((err) => {
      log.error({ error: err instanceof Error ? err.message : String(err) }, "[export-api] Export failed");
    })
    .finally(() => {
      activeExportPromise = null;
      activeExportId = null;
    });

  return c.json({
    message: "Export started",
    status: "running",
    exportId,
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /status — Export Status ─────────────────────────────

exportRoutes.get("/status", async (c) => {
  const storage = new Storage({ projectId: PROJECT });
  const recentExports: ExportManifest[] = [];

  try {
    // List manifest files from the export bucket
    const [files] = await storage
      .bucket(EXPORT_BUCKET)
      .getFiles({ prefix: "export-", delimiter: "/" });

    // Each export lives under a top-level prefix like "export-2026-03-01_02-00-00/"
    // We look for manifest.json inside each
    const exportPrefixes = files
      .map((f) => f.name.split("/")[0])
      .filter((name, i, arr) => name.startsWith("export-") && arr.indexOf(name) === i)
      .slice(0, 20);

    for (const prefix of exportPrefixes) {
      try {
        const [content] = await storage
          .bucket(EXPORT_BUCKET)
          .file(`${prefix}/manifest.json`)
          .download();
        const manifest = JSON.parse(content.toString()) as ExportManifest;
        recentExports.push(manifest);
      } catch {
        // Manifest not found for this export — skip
      }
    }
  } catch {
    // Export bucket doesn't exist yet — that's fine
  }

  // Sort by date descending
  recentExports.sort(
    (a, b) => new Date(b.exportedAt).getTime() - new Date(a.exportedAt).getTime(),
  );

  return c.json({
    activeExport: activeExportPromise !== null,
    activeExportId,
    lastManifest: lastManifest ?? null,
    recentExports,
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /tables — List Exportable Tables ────────────────────

exportRoutes.get("/tables", (c) => {
  const tables = listExportableTables();
  return c.json({
    data: tables,
    count: tables.length,
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /manifest/:id — Fetch Specific Manifest ─────────────

exportRoutes.get("/manifest/:id", async (c) => {
  const id = c.req.param("id");

  if (!id || !id.startsWith("export-")) {
    return c.json({ error: "BAD_REQUEST", message: "Invalid export ID format" }, 400);
  }

  const storage = new Storage({ projectId: PROJECT });

  try {
    const [content] = await storage
      .bucket(EXPORT_BUCKET)
      .file(`${id}/manifest.json`)
      .download();
    const manifest = JSON.parse(content.toString()) as ExportManifest;
    return c.json({ data: manifest, timestamp: new Date().toISOString() });
  } catch {
    return c.json(
      { error: "NOT_FOUND", message: `Manifest not found for export ${id}` },
      404,
    );
  }
});
