/**
 * Swarm Database — SQLite + Drizzle ORM Connection Manager
 *
 * Manages the SQLite database lifecycle:
 * - WAL mode for concurrent read/write performance
 * - Automatic table creation on first connect
 * - Connection pooling (single writer, multiple readers)
 * - Graceful shutdown with pending write drain
 * - Data directory auto-creation
 */

import { existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';

import * as schema from './schema.js';
import { SwarmLogger } from '../infra/logger.js';

// ─── Types ────────────────────────────────────────────────────

export interface SwarmDatabaseConfig {
  /** Path to the SQLite database file. Use ':memory:' for in-memory. */
  path: string;
  /** Enable WAL mode for concurrent reads (default: true) */
  walMode?: boolean;
  /** Busy timeout in ms when the database is locked (default: 5000) */
  busyTimeout?: number;
  /** Enable foreign keys (default: true) */
  foreignKeys?: boolean;
  /** Journal size limit in bytes (default: 64MB) */
  journalSizeLimit?: number;
  /** Synchronous mode (default: 'NORMAL') */
  synchronous?: 'OFF' | 'NORMAL' | 'FULL' | 'EXTRA';
  /** Cache size in pages (negative = KiB, default: -64000 = ~64MB) */
  cacheSize?: number;
}

const DEFAULT_CONFIG: Required<SwarmDatabaseConfig> = {
  path: './data/swarm.db',
  walMode: true,
  busyTimeout: 5_000,
  foreignKeys: true,
  journalSizeLimit: 67_108_864, // 64 MB
  synchronous: 'NORMAL',
  cacheSize: -64_000, // ~64 MB
};

// ─── SwarmDatabase ────────────────────────────────────────────

/**
 * Central database class for the pump-agent-swarm persistence layer.
 *
 * Usage:
 * ```ts
 * const db = new SwarmDatabase({ path: './data/swarm.db' });
 * db.connect();
 * const drizzleDb = db.getDb();
 * // ... use drizzle queries ...
 * db.close();
 * ```
 */
export class SwarmDatabase {
  private readonly config: Required<SwarmDatabaseConfig>;
  private readonly logger: SwarmLogger;
  private sqlite: Database.Database | null = null;
  private db: BetterSQLite3Database<typeof schema> | null = null;
  private connected = false;

  constructor(config?: Partial<SwarmDatabaseConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.logger = SwarmLogger.create('database', 'system');
  }

  // ─── Connection ─────────────────────────────────────────────

  /**
   * Open the SQLite database, configure pragmas, and create tables.
   * Idempotent — calling connect() on an already-connected database is a no-op.
   */
  connect(): void {
    if (this.connected) return;

    // Ensure data directory exists (unless in-memory)
    if (this.config.path !== ':memory:') {
      const dir = dirname(resolve(this.config.path));
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
        this.logger.info('Created database directory', { dir });
      }
    }

    // Open SQLite connection
    this.sqlite = new Database(this.config.path);
    this.logger.info('SQLite connection opened', { path: this.config.path });

    // Configure pragmas for performance and safety
    this.configurePragmas();

    // Create Drizzle ORM instance
    this.db = drizzle(this.sqlite, { schema });

    // Run table creation (Drizzle handles this via push or migrate)
    this.createTables();

    this.connected = true;
    this.logger.info('Database ready', {
      path: this.config.path,
      walMode: this.config.walMode,
    });
  }

  /**
   * Close the database connection gracefully.
   * Checkpoints WAL before closing.
   */
  close(): void {
    if (!this.connected || !this.sqlite) return;

    try {
      // Checkpoint WAL to main database file before closing
      if (this.config.walMode) {
        this.sqlite.pragma('wal_checkpoint(TRUNCATE)');
        this.logger.debug('WAL checkpoint completed');
      }

      this.sqlite.close();
      this.sqlite = null;
      this.db = null;
      this.connected = false;
      this.logger.info('Database connection closed');
    } catch (err) {
      this.logger.error('Error closing database', {
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }

  // ─── Accessors ──────────────────────────────────────────────

  /**
   * Get the Drizzle ORM database instance.
   * Throws if not connected.
   */
  getDb(): BetterSQLite3Database<typeof schema> {
    if (!this.db) {
      throw new Error(
        'Database not connected. Call connect() before accessing the database.',
      );
    }
    return this.db;
  }

  /**
   * Get the raw better-sqlite3 instance for custom queries.
   * Throws if not connected.
   */
  getRawDb(): Database.Database {
    if (!this.sqlite) {
      throw new Error('Database not connected. Call connect() first.');
    }
    return this.sqlite;
  }

  /** Whether the database is currently connected */
  isConnected(): boolean {
    return this.connected;
  }

  // ─── Maintenance ────────────────────────────────────────────

  /**
   * Run VACUUM to reclaim space after large deletions.
   * This rebuilds the database file and can be slow for large DBs.
   */
  vacuum(): void {
    this.ensureConnected();
    this.sqlite!.exec('VACUUM');
    this.logger.info('Database vacuumed');
  }

  /**
   * Run ANALYZE to update query planner statistics.
   */
  analyze(): void {
    this.ensureConnected();
    this.sqlite!.exec('ANALYZE');
    this.logger.info('Database analyzed');
  }

  /**
   * Get database file size in bytes.
   */
  getFileSize(): number {
    this.ensureConnected();
    const result = this.sqlite!.pragma('page_count') as Array<{ page_count: number }>;
    const pageSize = this.sqlite!.pragma('page_size') as Array<{ page_size: number }>;
    return (result[0]?.page_count ?? 0) * (pageSize[0]?.page_size ?? 4096);
  }

  /**
   * Get database statistics for monitoring.
   */
  getStats(): {
    fileSizeBytes: number;
    pageCount: number;
    freePageCount: number;
    walMode: boolean;
    journalMode: string;
  } {
    this.ensureConnected();
    const pages = this.sqlite!.pragma('page_count') as Array<{ page_count: number }>;
    const freePages = this.sqlite!.pragma('freelist_count') as Array<{ freelist_count: number }>;
    const pageSize = this.sqlite!.pragma('page_size') as Array<{ page_size: number }>;
    const journalMode = this.sqlite!.pragma('journal_mode') as Array<{ journal_mode: string }>;

    const pageCount = pages[0]?.page_count ?? 0;
    const freePageCount = freePages[0]?.freelist_count ?? 0;

    return {
      fileSizeBytes: pageCount * (pageSize[0]?.page_size ?? 4096),
      pageCount,
      freePageCount,
      walMode: journalMode[0]?.journal_mode === 'wal',
      journalMode: journalMode[0]?.journal_mode ?? 'unknown',
    };
  }

  // ─── Internal ───────────────────────────────────────────────

  private configurePragmas(): void {
    if (!this.sqlite) return;

    // WAL mode for concurrent reads
    if (this.config.walMode) {
      this.sqlite.pragma('journal_mode = WAL');
    }

    // Foreign keys
    if (this.config.foreignKeys) {
      this.sqlite.pragma('foreign_keys = ON');
    }

    // Busy timeout
    this.sqlite.pragma(`busy_timeout = ${this.config.busyTimeout}`);

    // Synchronous mode
    this.sqlite.pragma(`synchronous = ${this.config.synchronous}`);

    // Cache size
    this.sqlite.pragma(`cache_size = ${this.config.cacheSize}`);

    // Journal size limit
    this.sqlite.pragma(`journal_size_limit = ${this.config.journalSizeLimit}`);

    // Memory-mapped I/O (256 MB)
    this.sqlite.pragma('mmap_size = 268435456');

    this.logger.debug('Pragmas configured', {
      walMode: this.config.walMode,
      synchronous: this.config.synchronous,
      cacheSize: this.config.cacheSize,
      busyTimeout: this.config.busyTimeout,
    });
  }

  private createTables(): void {
    if (!this.sqlite) return;

    // Create all tables using raw SQL (Drizzle push requires a separate CLI step).
    // We generate CREATE TABLE IF NOT EXISTS for each schema table.
    this.sqlite.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        phase TEXT NOT NULL DEFAULT 'idle',
        mint TEXT,
        config TEXT NOT NULL,
        strategy TEXT NOT NULL,
        total_sol_deployed TEXT DEFAULT '0',
        total_trades INTEGER DEFAULT 0,
        net_pnl_lamports TEXT DEFAULT '0',
        started_at INTEGER NOT NULL,
        ended_at INTEGER,
        clean_exit INTEGER DEFAULT 0,
        updated_at INTEGER NOT NULL,
        error_message TEXT
      );

      CREATE INDEX IF NOT EXISTS sessions_phase_idx ON sessions(phase);
      CREATE INDEX IF NOT EXISTS sessions_mint_idx ON sessions(mint);
      CREATE INDEX IF NOT EXISTS sessions_started_at_idx ON sessions(started_at);

      CREATE TABLE IF NOT EXISTS trades (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL REFERENCES sessions(id),
        agent_id TEXT NOT NULL,
        mint TEXT NOT NULL,
        direction TEXT NOT NULL,
        sol_amount_lamports TEXT NOT NULL,
        token_amount TEXT NOT NULL,
        price REAL NOT NULL,
        fee_lamports TEXT NOT NULL,
        signature TEXT NOT NULL,
        slippage REAL DEFAULT 0,
        success INTEGER NOT NULL DEFAULT 1,
        error_message TEXT,
        executed_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS trades_session_id_idx ON trades(session_id);
      CREATE INDEX IF NOT EXISTS trades_agent_id_idx ON trades(agent_id);
      CREATE INDEX IF NOT EXISTS trades_mint_idx ON trades(mint);
      CREATE INDEX IF NOT EXISTS trades_direction_idx ON trades(direction);
      CREATE INDEX IF NOT EXISTS trades_executed_at_idx ON trades(executed_at);
      CREATE UNIQUE INDEX IF NOT EXISTS trades_signature_idx ON trades(signature);

      CREATE TABLE IF NOT EXISTS wallet_assignments (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL REFERENCES sessions(id),
        agent_id TEXT NOT NULL,
        role TEXT NOT NULL,
        wallet_address TEXT NOT NULL,
        label TEXT NOT NULL,
        balance_lamports TEXT DEFAULT '0',
        locked INTEGER DEFAULT 0,
        assigned_at INTEGER NOT NULL,
        released_at INTEGER,
        last_updated_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS wallet_assignments_session_id_idx ON wallet_assignments(session_id);
      CREATE INDEX IF NOT EXISTS wallet_assignments_agent_id_idx ON wallet_assignments(agent_id);
      CREATE INDEX IF NOT EXISTS wallet_assignments_address_idx ON wallet_assignments(wallet_address);

      CREATE TABLE IF NOT EXISTS pnl_snapshots (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL REFERENCES sessions(id),
        total_sol_deployed TEXT NOT NULL,
        realized_pnl TEXT NOT NULL,
        unrealized_pnl TEXT NOT NULL,
        total_pnl TEXT NOT NULL,
        total_pnl_percent REAL NOT NULL,
        portfolio_value TEXT NOT NULL,
        active_agents INTEGER NOT NULL,
        total_trades INTEGER NOT NULL,
        drawdown_percent REAL DEFAULT 0,
        max_drawdown_percent REAL DEFAULT 0,
        sharpe_ratio REAL,
        swarm_roi REAL DEFAULT 0,
        full_snapshot TEXT,
        timestamp INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS pnl_snapshots_session_id_idx ON pnl_snapshots(session_id);
      CREATE INDEX IF NOT EXISTS pnl_snapshots_timestamp_idx ON pnl_snapshots(timestamp);

      CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL REFERENCES sessions(id),
        event_type TEXT NOT NULL,
        category TEXT NOT NULL,
        source TEXT NOT NULL,
        severity TEXT NOT NULL DEFAULT 'info',
        message TEXT NOT NULL,
        payload TEXT,
        correlation_id TEXT,
        timestamp INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS audit_logs_session_id_idx ON audit_logs(session_id);
      CREATE INDEX IF NOT EXISTS audit_logs_event_type_idx ON audit_logs(event_type);
      CREATE INDEX IF NOT EXISTS audit_logs_category_idx ON audit_logs(category);
      CREATE INDEX IF NOT EXISTS audit_logs_timestamp_idx ON audit_logs(timestamp);
      CREATE INDEX IF NOT EXISTS audit_logs_correlation_id_idx ON audit_logs(correlation_id);

      CREATE TABLE IF NOT EXISTS agent_snapshots (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL REFERENCES sessions(id),
        agent_id TEXT NOT NULL,
        role TEXT NOT NULL,
        name TEXT NOT NULL,
        active INTEGER NOT NULL,
        state TEXT NOT NULL,
        config TEXT NOT NULL,
        wallet_address TEXT,
        wallet_balance TEXT,
        trades_completed INTEGER DEFAULT 0,
        sol_spent TEXT DEFAULT '0',
        sol_received TEXT DEFAULT '0',
        last_heartbeat INTEGER,
        timestamp INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS agent_snapshots_session_id_idx ON agent_snapshots(session_id);
      CREATE INDEX IF NOT EXISTS agent_snapshots_agent_id_idx ON agent_snapshots(agent_id);
      CREATE INDEX IF NOT EXISTS agent_snapshots_timestamp_idx ON agent_snapshots(timestamp);
    `);

    this.logger.debug('Tables created/verified');
  }

  private ensureConnected(): void {
    if (!this.connected || !this.sqlite) {
      throw new Error('Database not connected. Call connect() first.');
    }
  }
}
