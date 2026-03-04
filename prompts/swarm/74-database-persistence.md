# Prompt 74 — Database Persistence Layer

## Agent Identity & Rules

```
You are the DATABASE-PERSISTENCE builder.

RULES:
- Work on current branch (main), commit as nirholas
- Always use isBackground: true for terminals, always kill_terminal after
- No mocks — real SQLite database with real Drizzle ORM queries
- TypeScript strict mode, run npx tsc --noEmit after changes
- Commit message: "feat(swarm): add SQLite persistence layer with Drizzle ORM for state survival across restarts"
```

## Objective

Create `packages/pump-agent-swarm/src/persistence/` — a database persistence layer using Drizzle ORM with SQLite (via `better-sqlite3`) that stores all swarm state so it survives restarts. This includes trade history, session state, wallet assignments, P&L records, audit logs, and agent health snapshots. The swarm currently holds everything in memory — this prompt makes it durable.

## File Ownership

- **Creates**: `packages/pump-agent-swarm/src/persistence/schema.ts`
- **Creates**: `packages/pump-agent-swarm/src/persistence/database.ts`
- **Creates**: `packages/pump-agent-swarm/src/persistence/repositories.ts`
- **Creates**: `packages/pump-agent-swarm/src/persistence/migrations.ts`
- **Creates**: `packages/pump-agent-swarm/src/persistence/index.ts`

## Dependencies

- `drizzle-orm` (already in monorepo — used by root project with `drizzle.config.ts`)
- `better-sqlite3` and `@types/better-sqlite3` (add to pump-agent-swarm package.json)
- `drizzle-orm/better-sqlite3` adapter
- Types from `../types.ts` (P01)
- Logger from `../infra/logger.ts` (P07)
- EventBus from `../infra/event-bus.ts` (P04)

## Deliverables

### Create `packages/pump-agent-swarm/src/persistence/schema.ts`

Define all Drizzle table schemas:

1. **`sessions` table**:
   ```typescript
   export const sessions = sqliteTable('sessions', {
     id: text('id').primaryKey(),                    // UUID
     strategy: text('strategy').notNull(),            // SwarmStrategy name
     status: text('status').notNull(),                // SwarmPhase enum value
     config: text('config').notNull(),                // JSON-serialized SwarmConfig
     masterWallet: text('master_wallet').notNull(),   // Base58 public key
     tokenMint: text('token_mint'),                   // Created token mint (null until created)
     startedAt: integer('started_at', { mode: 'timestamp' }).notNull(),
     endedAt: integer('ended_at', { mode: 'timestamp' }),
     exitReason: text('exit_reason'),                 // Why session ended
     totalPnlSol: real('total_pnl_sol').default(0),
     totalPnlPercent: real('total_pnl_percent').default(0),
     metadata: text('metadata'),                      // JSON blob for extensibility
   });
   ```

2. **`trades` table**:
   ```typescript
   export const trades = sqliteTable('trades', {
     id: text('id').primaryKey(),
     sessionId: text('session_id').notNull().references(() => sessions.id),
     agentId: text('agent_id').notNull(),
     walletAddress: text('wallet_address').notNull(),
     tokenMint: text('token_mint').notNull(),
     side: text('side').notNull(),                    // 'buy' | 'sell'
     amountSol: real('amount_sol').notNull(),
     amountTokens: real('amount_tokens').notNull(),
     pricePerToken: real('price_per_token').notNull(),
     slippage: real('slippage'),
     txSignature: text('tx_signature').notNull(),
     bundleId: text('bundle_id'),                     // If part of a Jito bundle
     status: text('status').notNull(),                // 'pending' | 'confirmed' | 'failed'
     gasCost: real('gas_cost'),
     priorityFee: real('priority_fee'),
     executedAt: integer('executed_at', { mode: 'timestamp' }).notNull(),
     confirmedAt: integer('confirmed_at', { mode: 'timestamp' }),
     errorMessage: text('error_message'),
   });
   ```

3. **`walletAssignments` table**:
   ```typescript
   export const walletAssignments = sqliteTable('wallet_assignments', {
     id: text('id').primaryKey(),
     sessionId: text('session_id').notNull().references(() => sessions.id),
     walletIndex: integer('wallet_index').notNull(),
     publicKey: text('public_key').notNull(),
     role: text('role').notNull(),                    // 'creator' | 'bundler' | 'trader' | 'sniper'
     assignedAt: integer('assigned_at', { mode: 'timestamp' }).notNull(),
     releasedAt: integer('released_at', { mode: 'timestamp' }),
     balanceSol: real('balance_sol').default(0),
     tradeCount: integer('trade_count').default(0),
     pnlSol: real('pnl_sol').default(0),
   });
   ```

4. **`pnlSnapshots` table**:
   ```typescript
   export const pnlSnapshots = sqliteTable('pnl_snapshots', {
     id: text('id').primaryKey(),
     sessionId: text('session_id').notNull().references(() => sessions.id),
     timestamp: integer('timestamp', { mode: 'timestamp' }).notNull(),
     totalInvestedSol: real('total_invested_sol').notNull(),
     currentValueSol: real('current_value_sol').notNull(),
     realizedPnlSol: real('realized_pnl_sol').notNull(),
     unrealizedPnlSol: real('unrealized_pnl_sol').notNull(),
     tokenPriceAtSnapshot: real('token_price_at_snapshot'),
     holdingsTokens: real('holdings_tokens'),
     walletCount: integer('wallet_count').notNull(),
   });
   ```

5. **`auditLogs` table**:
   ```typescript
   export const auditLogs = sqliteTable('audit_logs', {
     id: text('id').primaryKey(),
     sessionId: text('session_id').references(() => sessions.id),
     level: text('level').notNull(),                  // 'info' | 'warn' | 'error' | 'critical'
     category: text('category').notNull(),            // 'agent' | 'trade' | 'bundle' | 'system' | 'security'
     agentId: text('agent_id'),
     action: text('action').notNull(),
     detail: text('detail'),                          // JSON blob with full event context
     timestamp: integer('timestamp', { mode: 'timestamp' }).notNull(),
   });
   ```

6. **`agentSnapshots` table**:
   ```typescript
   export const agentSnapshots = sqliteTable('agent_snapshots', {
     id: text('id').primaryKey(),
     sessionId: text('session_id').notNull().references(() => sessions.id),
     agentId: text('agent_id').notNull(),
     agentType: text('agent_type').notNull(),
     status: text('status').notNull(),
     lastActionAt: integer('last_action_at', { mode: 'timestamp' }),
     errorCount: integer('error_count').default(0),
     tradeCount: integer('trade_count').default(0),
     pnlSol: real('pnl_sol').default(0),
     metadata: text('metadata'),                      // JSON agent-specific state
     snapshotAt: integer('snapshot_at', { mode: 'timestamp' }).notNull(),
   });
   ```

Add indexes:
```typescript
export const tradesSessionIdx = index('trades_session_idx').on(trades.sessionId);
export const tradesAgentIdx = index('trades_agent_idx').on(trades.agentId);
export const tradesTokenIdx = index('trades_token_idx').on(trades.tokenMint);
export const auditSessionIdx = index('audit_session_idx').on(auditLogs.sessionId);
export const auditCategoryIdx = index('audit_category_idx').on(auditLogs.category);
export const pnlSessionIdx = index('pnl_session_idx').on(pnlSnapshots.sessionId);
```

### Create `packages/pump-agent-swarm/src/persistence/database.ts`

1. **`SwarmDatabase` class**:
   - `constructor(dbPath?: string)` — defaults to `./data/swarm.db`, creates directory if missing
   - `initialize(): Promise<void>` — runs migrations, enables WAL mode, sets pragmas (`journal_mode=WAL`, `synchronous=NORMAL`, `foreign_keys=ON`, `busy_timeout=5000`)
   - `getDb(): BetterSqlite3Database` — returns Drizzle instance
   - `close(): void` — closes SQLite connection gracefully
   - `backup(path: string): void` — creates a backup copy of the database
   - `vacuum(): void` — runs VACUUM to reclaim space
   - `getStats(): DatabaseStats` — returns table row counts, file size, WAL size

   ```typescript
   interface DatabaseStats {
     fileSizeBytes: number;
     walSizeBytes: number;
     tableCounts: Record<string, number>;
     lastVacuumAt: Date | null;
   }
   ```

### Create `packages/pump-agent-swarm/src/persistence/repositories.ts`

Repository pattern with one class per domain:

1. **`SessionRepository` class**:
   - `create(session: NewSession): Session`
   - `getById(id: string): Session | undefined`
   - `getActive(): Session[]` — sessions where `endedAt` is null
   - `updateStatus(id: string, status: string): void`
   - `setTokenMint(id: string, mint: string): void`
   - `complete(id: string, exitReason: string, pnl: { sol: number; percent: number }): void`
   - `getHistory(limit?: number): Session[]` — most recent completed sessions
   - `getByDateRange(from: Date, to: Date): Session[]`

2. **`TradeRepository` class**:
   - `record(trade: NewTrade): Trade`
   - `getBySession(sessionId: string): Trade[]`
   - `getByAgent(agentId: string, limit?: number): Trade[]`
   - `getByWallet(wallet: string): Trade[]`
   - `confirm(id: string, signature: string): void`
   - `fail(id: string, errorMessage: string): void`
   - `getRecentTrades(limit: number): Trade[]`
   - `getTradeVolume(sessionId: string): { buySol: number; sellSol: number; count: number }`
   - `getTradesByBundle(bundleId: string): Trade[]`

3. **`WalletRepository` class**:
   - `assign(assignment: NewWalletAssignment): WalletAssignment`
   - `release(id: string): void`
   - `getActiveBySession(sessionId: string): WalletAssignment[]`
   - `updateBalance(id: string, balance: number): void`
   - `updatePnl(id: string, pnl: number): void`
   - `incrementTradeCount(id: string): void`

4. **`PnLRepository` class**:
   - `snapshot(data: NewPnLSnapshot): PnLSnapshot`
   - `getBySession(sessionId: string): PnLSnapshot[]`
   - `getLatest(sessionId: string): PnLSnapshot | undefined`
   - `getTimeSeries(sessionId: string, interval: 'minute' | 'hour'): PnLSnapshot[]`

5. **`AuditRepository` class**:
   - `log(entry: NewAuditLog): AuditLog`
   - `getBySession(sessionId: string, filters?: AuditFilters): AuditLog[]`
   - `getByCategory(category: string, limit?: number): AuditLog[]`
   - `getErrors(sessionId?: string): AuditLog[]`
   - `purgeOlderThan(days: number): number` — returns count of deleted rows

6. **`AgentSnapshotRepository` class**:
   - `save(snapshot: NewAgentSnapshot): AgentSnapshot`
   - `getLatestByAgent(agentId: string): AgentSnapshot | undefined`
   - `getBySession(sessionId: string): AgentSnapshot[]`
   - `getHealthHistory(agentId: string, hours: number): AgentSnapshot[]`

Each repository takes `BetterSqlite3Database` in constructor. All methods use Drizzle query builder (no raw SQL). All IDs generated with `crypto.randomUUID()`.

### Create `packages/pump-agent-swarm/src/persistence/migrations.ts`

1. **`runMigrations(db: BetterSqlite3Database)` function**:
   - Uses `drizzle-orm/better-sqlite3/migrator` if migration files exist
   - Falls back to `db.run(sql)` with table creation statements for initial setup
   - Idempotent — safe to run multiple times (`CREATE TABLE IF NOT EXISTS`)
   - Creates all indexes
   - Logs migration status via Logger

2. **`getMigrationStatus(db): MigrationStatus` function**:
   ```typescript
   interface MigrationStatus {
     tablesExist: boolean;
     tableCount: number;
     version: string;
   }
   ```

### Create `packages/pump-agent-swarm/src/persistence/index.ts`

Barrel export:
```typescript
export { SwarmDatabase } from './database.js';
export {
  SessionRepository,
  TradeRepository,
  WalletRepository,
  PnLRepository,
  AuditRepository,
  AgentSnapshotRepository,
} from './repositories.js';
export * from './schema.js';
export { runMigrations, getMigrationStatus } from './migrations.js';
```

### Integration with EventBus

The `SwarmDatabase` should subscribe to the EventBus (P04) to automatically persist events:

```typescript
// In database.ts or a separate event-persistence.ts
eventBus.on('trade:executed', (trade) => tradeRepo.record(trade));
eventBus.on('trade:confirmed', ({ id, sig }) => tradeRepo.confirm(id, sig));
eventBus.on('trade:failed', ({ id, err }) => tradeRepo.fail(id, err));
eventBus.on('session:started', (session) => sessionRepo.create(session));
eventBus.on('session:completed', ({ id, reason, pnl }) => sessionRepo.complete(id, reason, pnl));
eventBus.on('pnl:snapshot', (snap) => pnlRepo.snapshot(snap));
eventBus.on('agent:health', (snap) => agentRepo.save(snap));
eventBus.on('audit:log', (entry) => auditRepo.log(entry));
```

This is passive persistence — the swarm doesn't need to call repositories explicitly for most events.

### Session Recovery on Restart

`SwarmDatabase` should provide a recovery method:

```typescript
async recoverSession(sessionId: string): Promise<SessionRecoveryData> {
  const session = this.sessionRepo.getById(sessionId);
  const wallets = this.walletRepo.getActiveBySession(sessionId);
  const lastPnl = this.pnlRepo.getLatest(sessionId);
  const recentTrades = this.tradeRepo.getBySession(sessionId);
  const agentStates = this.agentRepo.getBySession(sessionId);

  return {
    session,
    activeWallets: wallets,
    lastPnlSnapshot: lastPnl,
    tradeHistory: recentTrades,
    agentStates,
  };
}
```

The `SwarmOrchestrator` (P50) can call this on startup to resume an interrupted session rather than starting fresh.

### Success Criteria

- SQLite database created at `./data/swarm.db` on first run
- All 6 tables created with correct schemas and indexes
- WAL mode enabled for concurrent read/write performance
- Repositories provide full CRUD for all domain entities
- EventBus integration automatically persists trades, sessions, and P&L
- Session recovery reconstructs full swarm state from database
- Database backup and vacuum utilities work
- Compiles with `npx tsc --noEmit`
