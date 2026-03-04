/**
 * Crypto Vision — Migration Runner
 *
 * Runs pending Drizzle ORM migrations against the database.
 * Can be used:
 * - On server startup (optional, via RUN_MIGRATIONS=true)
 * - As a standalone script: `npx tsx src/lib/db/migrate.ts`
 *
 * Uses Drizzle's built-in migration runner with the postgres.js driver.
 * Logs migration status and rolls back on failure via transaction semantics.
 *
 * @copyright 2024-2026 nirholas. All rights reserved.
 */

import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { logger } from "@/lib/logger.js";

const MIGRATIONS_DIR = "./drizzle";

/**
 * Run all pending migrations.
 * Creates a dedicated short-lived connection (not from the pool)
 * to avoid holding pool slots during potentially slow DDL.
 */
export async function runMigrations(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is required to run migrations");
  }

  const log = logger.child({ module: "db:migrate" });
  log.info("Running database migrations…");

  const client = postgres(url, { max: 1, onnotice: () => {} });
  const db = drizzle(client);

  try {
    await migrate(db, { migrationsFolder: MIGRATIONS_DIR });
    log.info("All migrations applied successfully");
  } catch (err) {
    log.error({ err }, "Migration failed — database may be in an inconsistent state");
    throw err;
  } finally {
    await client.end();
  }
}

/**
 * Optionally run migrations on startup.
 * Only runs if RUN_MIGRATIONS=true is set in the environment.
 */
export async function maybeRunMigrations(): Promise<void> {
  if (process.env.RUN_MIGRATIONS !== "true") {
    return;
  }
  await runMigrations();
}

// Allow running directly: npx tsx src/lib/db/migrate.ts
const isDirectRun =
  process.argv[1]?.endsWith("migrate.ts") ||
  process.argv[1]?.endsWith("migrate.js");

if (isDirectRun) {
  runMigrations()
    .then(() => {
      logger.info("Migration script completed");
      process.exit(0);
    })
    .catch((err) => {
      logger.error({ err }, "Migration script failed");
      process.exit(1);
    });
}
