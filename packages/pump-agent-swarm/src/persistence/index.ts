/**
 * Persistence Layer — Public API
 *
 * Re-exports the database, schema, repositories, and migration
 * utilities as a single entry point for the persistence module.
 *
 * Usage:
 * ```ts
 * import {
 *   SwarmDatabase,
 *   SessionRepository,
 *   TradeRepository,
 *   runMigrations,
 * } from './persistence/index.js';
 *
 * const db = new SwarmDatabase({ path: './data/swarm.db' });
 * db.connect();
 * runMigrations(db.getRawDb());
 *
 * const sessions = new SessionRepository(db.getDb());
 * const session = sessions.create({
 *   name: 'My Swarm Session',
 *   config: JSON.stringify(config),
 *   strategy: JSON.stringify(strategy),
 *   startedAt: Date.now(),
 * });
 * ```
 */

// Database connection manager
export { SwarmDatabase } from './database.js';
export type { SwarmDatabaseConfig } from './database.js';

// Schema tables and inferred types
export {
  sessions,
  trades,
  walletAssignments,
  pnlSnapshots,
  auditLogs,
  agentSnapshots,
} from './schema.js';
export type {
  Session,
  NewSession,
  Trade,
  NewTrade,
  WalletAssignment,
  NewWalletAssignment,
  PnLSnapshot,
  NewPnLSnapshot,
  AuditLog,
  NewAuditLog,
  AgentSnapshot,
  NewAgentSnapshot,
} from './schema.js';

// Repository classes
export {
  SessionRepository,
  TradeRepository,
  WalletAssignmentRepository,
  PnLSnapshotRepository,
  AuditLogRepository,
  AgentSnapshotRepository,
} from './repositories.js';

// Migrations
export {
  runMigrations,
  getCurrentVersion,
  getAppliedMigrations,
  MIGRATIONS,
} from './migrations.js';
export type { Migration } from './migrations.js';
