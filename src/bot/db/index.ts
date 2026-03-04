/**
 * Sect Bot — Database Connection
 *
 * Drizzle ORM connection using the `postgres` (postgres.js) driver.
 * Singleton pattern — one pool per process, lazy-initialized.
 *
 * @copyright 2024-2026 nirholas. All rights reserved.
 */

import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { logger } from "@/lib/logger";
import * as schema from "./schema.js";

let _db: PostgresJsDatabase<typeof schema> | null = null;
let _client: ReturnType<typeof postgres> | null = null;

/**
 * Get the shared database instance.
 * Requires DATABASE_URL env var to be set.
 */
export function getDb(): PostgresJsDatabase<typeof schema> {
  if (_db) return _db;

  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is required for Sect Bot. " +
        "Set it to a PostgreSQL connection string (e.g. postgres://user:pass@host:5432/dbname)",
    );
  }

  const log = logger.child({ module: "sectbot:db" });

  _client = postgres(url, {
    max: 20,
    idle_timeout: 30,
    connect_timeout: 15,
    max_lifetime: 60 * 30,       // recycle connections every 30 min
    backoff: (attemptNum: number) => {
      // Exponential backoff for reconnection: 500ms, 1s, 2s, ... up to 30s
      return Math.min(500 * Math.pow(2, attemptNum), 30_000);
    },
    onnotice: () => {},
    onclose: () => {
      log.warn("Database connection closed — driver will attempt reconnect");
    },
  });

  _db = drizzle(_client, { schema });

  logger.info("Database connection established (Sect Bot)");
  return _db;
}

/**
 * Gracefully close the database connection pool.
 */
export async function closeDb(): Promise<void> {
  if (_client) {
    await _client.end();
    _client = null;
    _db = null;
    logger.info("Database connection closed (Sect Bot)");
  }
}

export type Db = PostgresJsDatabase<typeof schema>;
