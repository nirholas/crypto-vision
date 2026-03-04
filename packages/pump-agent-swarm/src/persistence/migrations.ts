/**
 * Database Migrations — Schema Version Management
 *
 * Manages schema migrations for the swarm SQLite database.
 * Uses a simple version-based migration system with forward-only
 * migrations (no rollbacks — SQLite doesn't support DROP COLUMN
 * well anyway).
 *
 * Migrations are idempotent and safe to run multiple times.
 */

import type Database from 'better-sqlite3';
import { SwarmLogger } from '../infra/logger.js';

// ─── Types ────────────────────────────────────────────────────

export interface Migration {
  /** Version number (monotonically increasing) */
  version: number;
  /** Human-readable description */
  description: string;
  /** SQL statements to execute */
  up: string;
}

// ─── Migration Registry ─────────────────────────────────────

/**
 * All migrations in order. Each migration is applied once.
 * The migrations table tracks which versions have been applied.
 */
export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    description: 'Initial schema — sessions, trades, wallet_assignments, pnl_snapshots, audit_logs, agent_snapshots',
    up: `
      -- This migration is handled by SwarmDatabase.createTables()
      -- It exists as a marker for the migration system.
      SELECT 1;
    `,
  },
  {
    version: 2,
    description: 'Add session tags and trade correlation ID',
    up: `
      ALTER TABLE sessions ADD COLUMN tags TEXT;
      ALTER TABLE trades ADD COLUMN correlation_id TEXT;
      CREATE INDEX IF NOT EXISTS trades_correlation_id_idx ON trades(correlation_id);
    `,
  },
  {
    version: 3,
    description: 'Add P&L snapshot compression flag',
    up: `
      ALTER TABLE pnl_snapshots ADD COLUMN compressed INTEGER DEFAULT 0;
    `,
  },
];

// ─── Migration Runner ────────────────────────────────────────

/**
 * Run all pending migrations on the given database.
 *
 * Creates the `schema_migrations` table if it doesn't exist,
 * then applies each migration that hasn't been run yet.
 *
 * @param db - The better-sqlite3 database instance
 * @returns Number of migrations applied
 */
export function runMigrations(db: Database.Database): number {
  const logger = SwarmLogger.create('migrations', 'system');

  // Create the migrations tracking table
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      description TEXT NOT NULL,
      applied_at INTEGER NOT NULL
    );
  `);

  // Get applied versions
  const applied = new Set<number>(
    (
      db.prepare('SELECT version FROM schema_migrations ORDER BY version').all() as Array<{
        version: number;
      }>
    ).map((row) => row.version),
  );

  let migrationsApplied = 0;

  for (const migration of MIGRATIONS) {
    if (applied.has(migration.version)) {
      continue;
    }

    logger.info(`Applying migration v${migration.version}: ${migration.description}`);

    const runMigration = db.transaction(() => {
      // Execute migration SQL
      try {
        db.exec(migration.up);
      } catch (err) {
        // Some ALTER TABLE statements may fail if column already exists.
        // This is expected for idempotent migrations.
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('duplicate column name') || msg.includes('already exists')) {
          logger.debug(`Migration v${migration.version}: column/table already exists, skipping statement`);
        } else {
          throw err;
        }
      }

      // Record the migration
      db.prepare(
        'INSERT INTO schema_migrations (version, description, applied_at) VALUES (?, ?, ?)',
      ).run(migration.version, migration.description, Date.now());
    });

    runMigration();
    migrationsApplied++;
    logger.info(`Migration v${migration.version} applied successfully`);
  }

  if (migrationsApplied === 0) {
    logger.debug('All migrations up to date');
  } else {
    logger.info(`Applied ${migrationsApplied} migration(s)`);
  }

  return migrationsApplied;
}

/**
 * Get the current schema version.
 */
export function getCurrentVersion(db: Database.Database): number {
  try {
    const row = db
      .prepare('SELECT MAX(version) as version FROM schema_migrations')
      .get() as { version: number | null } | undefined;
    return row?.version ?? 0;
  } catch {
    // Table doesn't exist yet
    return 0;
  }
}

/**
 * Get the list of applied migrations.
 */
export function getAppliedMigrations(
  db: Database.Database,
): Array<{ version: number; description: string; appliedAt: number }> {
  try {
    return (
      db
        .prepare(
          'SELECT version, description, applied_at as appliedAt FROM schema_migrations ORDER BY version',
        )
        .all() as Array<{ version: number; description: string; appliedAt: number }>
    );
  } catch {
    return [];
  }
}
