/**
 * Persistence Repositories — Data Access Layer
 *
 * Six repository classes providing typed CRUD operations over the
 * Drizzle ORM schema. Each repository handles serialization/
 * deserialization of BN values (stored as text) and JSON payloads.
 */

import { eq, desc, and, gte, lte, sql, type SQL } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { v4 as uuidv4 } from 'uuid';

import * as schema from './schema.js';
import type {
  Session, NewSession,
  Trade, NewTrade,
  WalletAssignment, NewWalletAssignment,
  PnLSnapshot, NewPnLSnapshot,
  AuditLog, NewAuditLog,
  AgentSnapshot, NewAgentSnapshot,
} from './schema.js';

type DB = BetterSQLite3Database<typeof schema>;

// ─── Session Repository ──────────────────────────────────────

export class SessionRepository {
  constructor(private readonly db: DB) {}

  /** Create a new session */
  create(data: Omit<NewSession, 'id' | 'updatedAt'>): Session {
    const now = Date.now();
    const row = {
      id: uuidv4(),
      ...data,
      updatedAt: now,
    };
    this.db.insert(schema.sessions).values(row).run();
    return this.getById(row.id)!;
  }

  /** Get session by ID */
  getById(id: string): Session | undefined {
    return this.db
      .select()
      .from(schema.sessions)
      .where(eq(schema.sessions.id, id))
      .get();
  }

  /** Get the most recent active session */
  getActiveSession(): Session | undefined {
    return this.db
      .select()
      .from(schema.sessions)
      .where(sql`${schema.sessions.endedAt} IS NULL`)
      .orderBy(desc(schema.sessions.startedAt))
      .limit(1)
      .get();
  }

  /** List all sessions, most recent first */
  list(limit = 50, offset = 0): Session[] {
    return this.db
      .select()
      .from(schema.sessions)
      .orderBy(desc(schema.sessions.startedAt))
      .limit(limit)
      .offset(offset)
      .all();
  }

  /** Update session phase and metadata */
  updatePhase(id: string, phase: string, extra?: Partial<NewSession>): void {
    this.db
      .update(schema.sessions)
      .set({
        phase,
        updatedAt: Date.now(),
        ...extra,
      })
      .where(eq(schema.sessions.id, id))
      .run();
  }

  /** Mark a session as ended */
  endSession(id: string, cleanExit: boolean, errorMessage?: string): void {
    this.db
      .update(schema.sessions)
      .set({
        endedAt: Date.now(),
        cleanExit,
        errorMessage: errorMessage ?? null,
        updatedAt: Date.now(),
      })
      .where(eq(schema.sessions.id, id))
      .run();
  }

  /** Update aggregate stats */
  updateStats(
    id: string,
    stats: {
      totalTrades?: number;
      totalSolDeployed?: string;
      netPnlLamports?: string;
    },
  ): void {
    this.db
      .update(schema.sessions)
      .set({
        ...stats,
        updatedAt: Date.now(),
      })
      .where(eq(schema.sessions.id, id))
      .run();
  }

  /** Delete a session and all related data (cascading) */
  delete(id: string): void {
    // Delete child records first (SQLite FK cascade may not be enabled)
    this.db.delete(schema.agentSnapshots).where(eq(schema.agentSnapshots.sessionId, id)).run();
    this.db.delete(schema.auditLogs).where(eq(schema.auditLogs.sessionId, id)).run();
    this.db.delete(schema.pnlSnapshots).where(eq(schema.pnlSnapshots.sessionId, id)).run();
    this.db.delete(schema.walletAssignments).where(eq(schema.walletAssignments.sessionId, id)).run();
    this.db.delete(schema.trades).where(eq(schema.trades.sessionId, id)).run();
    this.db.delete(schema.sessions).where(eq(schema.sessions.id, id)).run();
  }
}

// ─── Trade Repository ────────────────────────────────────────

export class TradeRepository {
  constructor(private readonly db: DB) {}

  /** Record a new trade */
  create(data: Omit<NewTrade, 'id'>): Trade {
    const row = { id: uuidv4(), ...data };
    this.db.insert(schema.trades).values(row).run();
    return this.getById(row.id)!;
  }

  /** Get trade by ID */
  getById(id: string): Trade | undefined {
    return this.db
      .select()
      .from(schema.trades)
      .where(eq(schema.trades.id, id))
      .get();
  }

  /** Get trade by on-chain signature */
  getBySignature(signature: string): Trade | undefined {
    return this.db
      .select()
      .from(schema.trades)
      .where(eq(schema.trades.signature, signature))
      .get();
  }

  /** List trades for a session */
  listBySession(sessionId: string, limit = 100, offset = 0): Trade[] {
    return this.db
      .select()
      .from(schema.trades)
      .where(eq(schema.trades.sessionId, sessionId))
      .orderBy(desc(schema.trades.executedAt))
      .limit(limit)
      .offset(offset)
      .all();
  }

  /** List trades for a specific agent */
  listByAgent(sessionId: string, agentId: string, limit = 100): Trade[] {
    return this.db
      .select()
      .from(schema.trades)
      .where(
        and(
          eq(schema.trades.sessionId, sessionId),
          eq(schema.trades.agentId, agentId),
        ),
      )
      .orderBy(desc(schema.trades.executedAt))
      .limit(limit)
      .all();
  }

  /** List trades for a specific mint */
  listByMint(sessionId: string, mint: string, limit = 100): Trade[] {
    return this.db
      .select()
      .from(schema.trades)
      .where(
        and(
          eq(schema.trades.sessionId, sessionId),
          eq(schema.trades.mint, mint),
        ),
      )
      .orderBy(desc(schema.trades.executedAt))
      .limit(limit)
      .all();
  }

  /** Count trades in a session */
  countBySession(sessionId: string): number {
    const result = this.db
      .select({ count: sql<number>`COUNT(*)` })
      .from(schema.trades)
      .where(eq(schema.trades.sessionId, sessionId))
      .get();
    return result?.count ?? 0;
  }

  /** Get trades within a time range */
  listByTimeRange(sessionId: string, startMs: number, endMs: number): Trade[] {
    return this.db
      .select()
      .from(schema.trades)
      .where(
        and(
          eq(schema.trades.sessionId, sessionId),
          gte(schema.trades.executedAt, startMs),
          lte(schema.trades.executedAt, endMs),
        ),
      )
      .orderBy(schema.trades.executedAt)
      .all();
  }
}

// ─── Wallet Assignment Repository ────────────────────────────

export class WalletAssignmentRepository {
  constructor(private readonly db: DB) {}

  /** Create a new wallet assignment */
  create(data: Omit<NewWalletAssignment, 'id' | 'lastUpdatedAt'>): WalletAssignment {
    const row = {
      id: uuidv4(),
      ...data,
      lastUpdatedAt: Date.now(),
    };
    this.db.insert(schema.walletAssignments).values(row).run();
    return this.getById(row.id)!;
  }

  /** Get assignment by ID */
  getById(id: string): WalletAssignment | undefined {
    return this.db
      .select()
      .from(schema.walletAssignments)
      .where(eq(schema.walletAssignments.id, id))
      .get();
  }

  /** List active assignments for a session */
  listActive(sessionId: string): WalletAssignment[] {
    return this.db
      .select()
      .from(schema.walletAssignments)
      .where(
        and(
          eq(schema.walletAssignments.sessionId, sessionId),
          sql`${schema.walletAssignments.releasedAt} IS NULL`,
        ),
      )
      .all();
  }

  /** Get assignment for a specific agent */
  getByAgent(sessionId: string, agentId: string): WalletAssignment | undefined {
    return this.db
      .select()
      .from(schema.walletAssignments)
      .where(
        and(
          eq(schema.walletAssignments.sessionId, sessionId),
          eq(schema.walletAssignments.agentId, agentId),
          sql`${schema.walletAssignments.releasedAt} IS NULL`,
        ),
      )
      .get();
  }

  /** Update wallet balance */
  updateBalance(id: string, balanceLamports: string): void {
    this.db
      .update(schema.walletAssignments)
      .set({
        balanceLamports,
        lastUpdatedAt: Date.now(),
      })
      .where(eq(schema.walletAssignments.id, id))
      .run();
  }

  /** Set lock status */
  setLock(id: string, locked: boolean): void {
    this.db
      .update(schema.walletAssignments)
      .set({
        locked,
        lastUpdatedAt: Date.now(),
      })
      .where(eq(schema.walletAssignments.id, id))
      .run();
  }

  /** Release a wallet assignment */
  release(id: string): void {
    this.db
      .update(schema.walletAssignments)
      .set({
        releasedAt: Date.now(),
        locked: false,
        lastUpdatedAt: Date.now(),
      })
      .where(eq(schema.walletAssignments.id, id))
      .run();
  }
}

// ─── P&L Snapshot Repository ─────────────────────────────────

export class PnLSnapshotRepository {
  constructor(private readonly db: DB) {}

  /** Store a P&L snapshot */
  create(data: Omit<NewPnLSnapshot, 'id'>): PnLSnapshot {
    const row = { id: uuidv4(), ...data };
    this.db.insert(schema.pnlSnapshots).values(row).run();
    return this.getById(row.id)!;
  }

  /** Get snapshot by ID */
  getById(id: string): PnLSnapshot | undefined {
    return this.db
      .select()
      .from(schema.pnlSnapshots)
      .where(eq(schema.pnlSnapshots.id, id))
      .get();
  }

  /** Get the latest snapshot for a session */
  getLatest(sessionId: string): PnLSnapshot | undefined {
    return this.db
      .select()
      .from(schema.pnlSnapshots)
      .where(eq(schema.pnlSnapshots.sessionId, sessionId))
      .orderBy(desc(schema.pnlSnapshots.timestamp))
      .limit(1)
      .get();
  }

  /** List snapshots for a session (time-series data) */
  listBySession(sessionId: string, limit = 1000): PnLSnapshot[] {
    return this.db
      .select()
      .from(schema.pnlSnapshots)
      .where(eq(schema.pnlSnapshots.sessionId, sessionId))
      .orderBy(schema.pnlSnapshots.timestamp)
      .limit(limit)
      .all();
  }

  /** List snapshots within a time range */
  listByTimeRange(sessionId: string, startMs: number, endMs: number): PnLSnapshot[] {
    return this.db
      .select()
      .from(schema.pnlSnapshots)
      .where(
        and(
          eq(schema.pnlSnapshots.sessionId, sessionId),
          gte(schema.pnlSnapshots.timestamp, startMs),
          lte(schema.pnlSnapshots.timestamp, endMs),
        ),
      )
      .orderBy(schema.pnlSnapshots.timestamp)
      .all();
  }

  /** Delete old snapshots to manage database size */
  pruneOlderThan(sessionId: string, cutoffMs: number): number {
    const result = this.db
      .delete(schema.pnlSnapshots)
      .where(
        and(
          eq(schema.pnlSnapshots.sessionId, sessionId),
          lte(schema.pnlSnapshots.timestamp, cutoffMs),
        ),
      )
      .run();
    return result.changes;
  }
}

// ─── Audit Log Repository ───────────────────────────────────

export class AuditLogRepository {
  constructor(private readonly db: DB) {}

  /** Append an audit log entry */
  create(data: Omit<NewAuditLog, 'id'>): AuditLog {
    const row = { id: uuidv4(), ...data };
    this.db.insert(schema.auditLogs).values(row).run();
    return this.getById(row.id)!;
  }

  /** Get entry by ID */
  getById(id: string): AuditLog | undefined {
    return this.db
      .select()
      .from(schema.auditLogs)
      .where(eq(schema.auditLogs.id, id))
      .get();
  }

  /** List audit logs for a session */
  listBySession(sessionId: string, limit = 500, offset = 0): AuditLog[] {
    return this.db
      .select()
      .from(schema.auditLogs)
      .where(eq(schema.auditLogs.sessionId, sessionId))
      .orderBy(desc(schema.auditLogs.timestamp))
      .limit(limit)
      .offset(offset)
      .all();
  }

  /** List logs by event type */
  listByEventType(sessionId: string, eventType: string, limit = 100): AuditLog[] {
    return this.db
      .select()
      .from(schema.auditLogs)
      .where(
        and(
          eq(schema.auditLogs.sessionId, sessionId),
          eq(schema.auditLogs.eventType, eventType),
        ),
      )
      .orderBy(desc(schema.auditLogs.timestamp))
      .limit(limit)
      .all();
  }

  /** List logs by category */
  listByCategory(sessionId: string, category: string, limit = 100): AuditLog[] {
    return this.db
      .select()
      .from(schema.auditLogs)
      .where(
        and(
          eq(schema.auditLogs.sessionId, sessionId),
          eq(schema.auditLogs.category, category),
        ),
      )
      .orderBy(desc(schema.auditLogs.timestamp))
      .limit(limit)
      .all();
  }

  /** Get logs by correlation ID */
  listByCorrelation(correlationId: string): AuditLog[] {
    return this.db
      .select()
      .from(schema.auditLogs)
      .where(eq(schema.auditLogs.correlationId, correlationId))
      .orderBy(schema.auditLogs.timestamp)
      .all();
  }

  /** Count logs by severity */
  countBySeverity(sessionId: string): Record<string, number> {
    const rows = this.db
      .select({
        severity: schema.auditLogs.severity,
        count: sql<number>`COUNT(*)`,
      })
      .from(schema.auditLogs)
      .where(eq(schema.auditLogs.sessionId, sessionId))
      .groupBy(schema.auditLogs.severity)
      .all();

    const result: Record<string, number> = {};
    for (const row of rows) {
      result[row.severity] = row.count;
    }
    return result;
  }

  /** Delete old logs to manage database size */
  pruneOlderThan(sessionId: string, cutoffMs: number): number {
    const result = this.db
      .delete(schema.auditLogs)
      .where(
        and(
          eq(schema.auditLogs.sessionId, sessionId),
          lte(schema.auditLogs.timestamp, cutoffMs),
        ),
      )
      .run();
    return result.changes;
  }
}

// ─── Agent Snapshot Repository ──────────────────────────────

export class AgentSnapshotRepository {
  constructor(private readonly db: DB) {}

  /** Store an agent snapshot */
  create(data: Omit<NewAgentSnapshot, 'id'>): AgentSnapshot {
    const row = { id: uuidv4(), ...data };
    this.db.insert(schema.agentSnapshots).values(row).run();
    return this.getById(row.id)!;
  }

  /** Get snapshot by ID */
  getById(id: string): AgentSnapshot | undefined {
    return this.db
      .select()
      .from(schema.agentSnapshots)
      .where(eq(schema.agentSnapshots.id, id))
      .get();
  }

  /** Get the latest snapshot for each agent in a session */
  getLatestBySession(sessionId: string): AgentSnapshot[] {
    // Get distinct agent IDs, then latest snapshot for each
    const latestIds = this.db
      .select({
        id: sql<string>`(
          SELECT id FROM agent_snapshots AS inner_snap
          WHERE inner_snap.session_id = ${sessionId}
            AND inner_snap.agent_id = ${schema.agentSnapshots.agentId}
          ORDER BY timestamp DESC
          LIMIT 1
        )`,
      })
      .from(schema.agentSnapshots)
      .where(eq(schema.agentSnapshots.sessionId, sessionId))
      .groupBy(schema.agentSnapshots.agentId)
      .all();

    return latestIds
      .map((row) => this.getById(row.id))
      .filter((s): s is AgentSnapshot => s !== undefined);
  }

  /** Get the latest snapshot for a specific agent */
  getLatestByAgent(sessionId: string, agentId: string): AgentSnapshot | undefined {
    return this.db
      .select()
      .from(schema.agentSnapshots)
      .where(
        and(
          eq(schema.agentSnapshots.sessionId, sessionId),
          eq(schema.agentSnapshots.agentId, agentId),
        ),
      )
      .orderBy(desc(schema.agentSnapshots.timestamp))
      .limit(1)
      .get();
  }

  /** List all snapshots for an agent (history) */
  listByAgent(sessionId: string, agentId: string, limit = 100): AgentSnapshot[] {
    return this.db
      .select()
      .from(schema.agentSnapshots)
      .where(
        and(
          eq(schema.agentSnapshots.sessionId, sessionId),
          eq(schema.agentSnapshots.agentId, agentId),
        ),
      )
      .orderBy(desc(schema.agentSnapshots.timestamp))
      .limit(limit)
      .all();
  }

  /** Bulk insert multiple agent snapshots */
  createBatch(snapshots: Array<Omit<NewAgentSnapshot, 'id'>>): void {
    const rows = snapshots.map((s) => ({ id: uuidv4(), ...s }));
    if (rows.length === 0) return;
    this.db.insert(schema.agentSnapshots).values(rows).run();
  }

  /** Delete old snapshots, keeping the latest N per agent */
  pruneKeepLatest(sessionId: string, keepPerAgent: number): number {
    // Get agent IDs
    const agents = this.db
      .selectDistinct({ agentId: schema.agentSnapshots.agentId })
      .from(schema.agentSnapshots)
      .where(eq(schema.agentSnapshots.sessionId, sessionId))
      .all();

    let totalDeleted = 0;
    for (const { agentId } of agents) {
      const snapshots = this.db
        .select({ id: schema.agentSnapshots.id })
        .from(schema.agentSnapshots)
        .where(
          and(
            eq(schema.agentSnapshots.sessionId, sessionId),
            eq(schema.agentSnapshots.agentId, agentId),
          ),
        )
        .orderBy(desc(schema.agentSnapshots.timestamp))
        .all();

      const toDelete = snapshots.slice(keepPerAgent);
      for (const { id } of toDelete) {
        this.db.delete(schema.agentSnapshots).where(eq(schema.agentSnapshots.id, id)).run();
        totalDeleted++;
      }
    }

    return totalDeleted;
  }
}
