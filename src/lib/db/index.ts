/**
 * Crypto Vision — Core API Database Connection
 *
 * Drizzle ORM connection using the `postgres` (postgres.js) driver.
 * Singleton pattern — one pool per process, lazy-initialized.
 *
 * Connection pool settings:
 * - max: 10 connections (suitable for API server)
 * - idle_timeout: 30s
 * - connect_timeout: 15s
 * - max_lifetime: 30 min (recycle to avoid stale connections)
 * - SSL required in production
 *
 * @copyright 2024-2026 nirholas. All rights reserved.
 */

import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { logger } from "@/lib/logger.js";
import * as schema from "./schema.js";

let _db: PostgresJsDatabase<typeof schema> | null = null;
let _client: ReturnType<typeof postgres> | null = null;

/**
 * Get the shared database instance for the core API schema.
 * Lazy-initializes on first call. Requires DATABASE_URL env var.
 */
export function getDb(): PostgresJsDatabase<typeof schema> {
  if (_db) return _db;

  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is required. " +
        "Set it to a PostgreSQL connection string (e.g. postgres://user:pass@host:5432/dbname)",
    );
  }

  const isProduction = process.env.NODE_ENV === "production";
  const log = logger.child({ module: "db:core" });

  _client = postgres(url, {
    max: Number(process.env.DB_POOL_MAX ?? "10"),
    idle_timeout: 30,
    connect_timeout: 15,
    max_lifetime: 60 * 30,
    ssl: isProduction ? { rejectUnauthorized: true } : undefined,
    onnotice: () => {},
    onclose: () => {
      log.warn("Database connection closed — driver will attempt reconnect");
    },
  });

  _db = drizzle(_client, { schema });

  log.info("Core database connection established");
  return _db;
}

/**
 * Gracefully close the core database connection pool.
 * Call during server shutdown.
 */
export async function closeDb(): Promise<void> {
  if (_client) {
    await _client.end();
    _client = null;
    _db = null;
    logger.info("Core database connection closed");
  }
}

/** Re-export schema for convenience */
export { schema };
export type Db = PostgresJsDatabase<typeof schema>;
