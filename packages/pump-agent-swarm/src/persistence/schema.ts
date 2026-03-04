/**
 * Persistence Schema — Drizzle ORM Table Definitions
 *
 * Six core tables for persisting swarm state across restarts:
 * - sessions: swarm session metadata and configuration
 * - trades: every trade executed by any agent
 * - walletAssignments: agent-to-wallet mappings
 * - pnlSnapshots: periodic P&L capture for time-series analysis
 * - auditLogs: state machine transitions and operational events
 * - agentSnapshots: serialized agent state for crash recovery
 */

import {
  sqliteTable,
  text,
  integer,
  real,
  blob,
  index,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

// ─── Sessions ─────────────────────────────────────────────────

export const sessions = sqliteTable(
  'sessions',
  {
    /** UUID primary key */
    id: text('id').primaryKey(),
    /** Human-readable session name */
    name: text('name').notNull(),
    /** Current swarm phase */
    phase: text('phase').notNull().default('idle'),
    /** Token mint address (set after minting) */
    mint: text('mint'),
    /** Serialized SwarmMasterConfig as JSON */
    config: text('config').notNull(),
    /** Serialized strategy as JSON */
    strategy: text('strategy').notNull(),
    /** Total SOL deployed across all agents (lamports) */
    totalSolDeployed: text('total_sol_deployed').default('0'),
    /** Total trades executed */
    totalTrades: integer('total_trades').default(0),
    /** Net P&L in lamports */
    netPnlLamports: text('net_pnl_lamports').default('0'),
    /** Session start timestamp (ms since epoch) */
    startedAt: integer('started_at').notNull(),
    /** Session end timestamp (ms since epoch, null if active) */
    endedAt: integer('ended_at'),
    /** Whether the session ended cleanly */
    cleanExit: integer('clean_exit', { mode: 'boolean' }).default(false),
    /** Last updated timestamp */
    updatedAt: integer('updated_at').notNull(),
    /** Error message if session ended in error */
    errorMessage: text('error_message'),
  },
  (table) => ({
    phaseIdx: index('sessions_phase_idx').on(table.phase),
    mintIdx: index('sessions_mint_idx').on(table.mint),
    startedAtIdx: index('sessions_started_at_idx').on(table.startedAt),
  }),
);

// ─── Trades ───────────────────────────────────────────────────

export const trades = sqliteTable(
  'trades',
  {
    /** Trade UUID */
    id: text('id').primaryKey(),
    /** Session this trade belongs to */
    sessionId: text('session_id')
      .notNull()
      .references(() => sessions.id),
    /** Agent that executed the trade */
    agentId: text('agent_id').notNull(),
    /** Token mint address */
    mint: text('mint').notNull(),
    /** 'buy' or 'sell' */
    direction: text('direction').notNull(),
    /** SOL amount in lamports (stored as text for big number safety) */
    solAmountLamports: text('sol_amount_lamports').notNull(),
    /** Token amount (stored as text for big number safety) */
    tokenAmount: text('token_amount').notNull(),
    /** Execution price (SOL per token) */
    price: real('price').notNull(),
    /** Transaction fee in lamports */
    feeLamports: text('fee_lamports').notNull(),
    /** On-chain transaction signature */
    signature: text('signature').notNull(),
    /** Slippage percentage experienced */
    slippage: real('slippage').default(0),
    /** Whether the trade succeeded */
    success: integer('success', { mode: 'boolean' }).notNull().default(true),
    /** Error message if trade failed */
    errorMessage: text('error_message'),
    /** Execution timestamp (ms since epoch) */
    executedAt: integer('executed_at').notNull(),
  },
  (table) => ({
    sessionIdx: index('trades_session_id_idx').on(table.sessionId),
    agentIdx: index('trades_agent_id_idx').on(table.agentId),
    mintIdx: index('trades_mint_idx').on(table.mint),
    directionIdx: index('trades_direction_idx').on(table.direction),
    executedAtIdx: index('trades_executed_at_idx').on(table.executedAt),
    signatureIdx: uniqueIndex('trades_signature_idx').on(table.signature),
  }),
);

// ─── Wallet Assignments ──────────────────────────────────────

export const walletAssignments = sqliteTable(
  'wallet_assignments',
  {
    /** Assignment UUID */
    id: text('id').primaryKey(),
    /** Session this assignment belongs to */
    sessionId: text('session_id')
      .notNull()
      .references(() => sessions.id),
    /** Agent ID that owns the wallet */
    agentId: text('agent_id').notNull(),
    /** Agent role */
    role: text('role').notNull(),
    /** Wallet address (base58 public key) */
    walletAddress: text('wallet_address').notNull(),
    /** Wallet label */
    label: text('label').notNull(),
    /** Current balance in lamports */
    balanceLamports: text('balance_lamports').default('0'),
    /** Whether the wallet is currently locked */
    locked: integer('locked', { mode: 'boolean' }).default(false),
    /** When the wallet was assigned */
    assignedAt: integer('assigned_at').notNull(),
    /** When the wallet was released (null if still assigned) */
    releasedAt: integer('released_at'),
    /** Last balance update timestamp */
    lastUpdatedAt: integer('last_updated_at').notNull(),
  },
  (table) => ({
    sessionIdx: index('wallet_assignments_session_id_idx').on(table.sessionId),
    agentIdx: index('wallet_assignments_agent_id_idx').on(table.agentId),
    addressIdx: index('wallet_assignments_address_idx').on(table.walletAddress),
  }),
);

// ─── P&L Snapshots ──────────────────────────────────────────

export const pnlSnapshots = sqliteTable(
  'pnl_snapshots',
  {
    /** Snapshot UUID */
    id: text('id').primaryKey(),
    /** Session this snapshot belongs to */
    sessionId: text('session_id')
      .notNull()
      .references(() => sessions.id),
    /** Total deployed SOL in lamports */
    totalSolDeployed: text('total_sol_deployed').notNull(),
    /** Total realized P&L in lamports */
    realizedPnl: text('realized_pnl').notNull(),
    /** Total unrealized P&L in lamports */
    unrealizedPnl: text('unrealized_pnl').notNull(),
    /** Total P&L (realized + unrealized) in lamports */
    totalPnl: text('total_pnl').notNull(),
    /** Total P&L as percentage */
    totalPnlPercent: real('total_pnl_percent').notNull(),
    /** Portfolio value in lamports */
    portfolioValue: text('portfolio_value').notNull(),
    /** Number of active agents */
    activeAgents: integer('active_agents').notNull(),
    /** Total number of trades at this point */
    totalTrades: integer('total_trades').notNull(),
    /** Current drawdown percent */
    drawdownPercent: real('drawdown_percent').default(0),
    /** Maximum drawdown percent ever observed */
    maxDrawdownPercent: real('max_drawdown_percent').default(0),
    /** Sharpe ratio at this point */
    sharpeRatio: real('sharpe_ratio'),
    /** Swarm ROI percentage */
    swarmRoi: real('swarm_roi').default(0),
    /** Full serialized PnLSnapshot as JSON */
    fullSnapshot: text('full_snapshot'),
    /** Snapshot timestamp (ms since epoch) */
    timestamp: integer('timestamp').notNull(),
  },
  (table) => ({
    sessionIdx: index('pnl_snapshots_session_id_idx').on(table.sessionId),
    timestampIdx: index('pnl_snapshots_timestamp_idx').on(table.timestamp),
  }),
);

// ─── Audit Logs ─────────────────────────────────────────────

export const auditLogs = sqliteTable(
  'audit_logs',
  {
    /** Log entry UUID */
    id: text('id').primaryKey(),
    /** Session this log belongs to */
    sessionId: text('session_id')
      .notNull()
      .references(() => sessions.id),
    /** Event type (e.g., 'phase:transition', 'risk:circuit-breaker') */
    eventType: text('event_type').notNull(),
    /** Event category */
    category: text('category').notNull(),
    /** Source agent or component */
    source: text('source').notNull(),
    /** Severity level */
    severity: text('severity').notNull().default('info'),
    /** Human-readable message */
    message: text('message').notNull(),
    /** Serialized event payload as JSON */
    payload: text('payload'),
    /** Correlation ID for tracing */
    correlationId: text('correlation_id'),
    /** Event timestamp (ms since epoch) */
    timestamp: integer('timestamp').notNull(),
  },
  (table) => ({
    sessionIdx: index('audit_logs_session_id_idx').on(table.sessionId),
    eventTypeIdx: index('audit_logs_event_type_idx').on(table.eventType),
    categoryIdx: index('audit_logs_category_idx').on(table.category),
    timestampIdx: index('audit_logs_timestamp_idx').on(table.timestamp),
    correlationIdx: index('audit_logs_correlation_id_idx').on(table.correlationId),
  }),
);

// ─── Agent Snapshots ────────────────────────────────────────

export const agentSnapshots = sqliteTable(
  'agent_snapshots',
  {
    /** Snapshot UUID */
    id: text('id').primaryKey(),
    /** Session this snapshot belongs to */
    sessionId: text('session_id')
      .notNull()
      .references(() => sessions.id),
    /** Agent ID */
    agentId: text('agent_id').notNull(),
    /** Agent role */
    role: text('role').notNull(),
    /** Agent name */
    name: text('name').notNull(),
    /** Whether agent was active at snapshot time */
    active: integer('active', { mode: 'boolean' }).notNull(),
    /** Serialized agent state as JSON */
    state: text('state').notNull(),
    /** Serialized agent config as JSON */
    config: text('config').notNull(),
    /** Agent's wallet address */
    walletAddress: text('wallet_address'),
    /** Wallet balance at snapshot time (lamports) */
    walletBalance: text('wallet_balance'),
    /** Number of trades completed */
    tradesCompleted: integer('trades_completed').default(0),
    /** SOL spent by this agent (lamports) */
    solSpent: text('sol_spent').default('0'),
    /** SOL received by this agent (lamports) */
    solReceived: text('sol_received').default('0'),
    /** Agent's last heartbeat timestamp */
    lastHeartbeat: integer('last_heartbeat'),
    /** Snapshot timestamp (ms since epoch) */
    timestamp: integer('timestamp').notNull(),
  },
  (table) => ({
    sessionIdx: index('agent_snapshots_session_id_idx').on(table.sessionId),
    agentIdx: index('agent_snapshots_agent_id_idx').on(table.agentId),
    timestampIdx: index('agent_snapshots_timestamp_idx').on(table.timestamp),
  }),
);

// ─── Type Exports ───────────────────────────────────────────

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;

export type Trade = typeof trades.$inferSelect;
export type NewTrade = typeof trades.$inferInsert;

export type WalletAssignment = typeof walletAssignments.$inferSelect;
export type NewWalletAssignment = typeof walletAssignments.$inferInsert;

export type PnLSnapshot = typeof pnlSnapshots.$inferSelect;
export type NewPnLSnapshot = typeof pnlSnapshots.$inferInsert;

export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;

export type AgentSnapshot = typeof agentSnapshots.$inferSelect;
export type NewAgentSnapshot = typeof agentSnapshots.$inferInsert;
