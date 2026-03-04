# Prompt 24 — Trade Scheduler

## Agent Identity & Rules

```
You are the TRADE-SCHEDULER builder. Create the central trade scheduling engine.

RULES:
- Work on current branch (main), commit as nirholas
- Always use isBackground: true for terminals, always kill_terminal after
- TypeScript strict mode, run npx tsc --noEmit after changes
- Commit message: "feat(swarm): add trade scheduler with priority queue and conflict resolution"
```

## Objective

Create `packages/pump-agent-swarm/src/trading/trade-scheduler.ts` — a central scheduler that coordinates timing across all trading agents, preventing conflicts, managing a priority queue, and ensuring slot-aware execution.

## File Ownership

- **Creates**: `packages/pump-agent-swarm/src/trading/trade-scheduler.ts`

## Dependencies

- `../types.ts` — `TradeDirection` (P01)
- `../infra/event-bus.ts` — `SwarmEventBus` (P04)
- `../infra/logger.ts` — `SwarmLogger` (P07)
- `../infra/metrics.ts` — `MetricsCollector` (P08)
- `@solana/web3.js` — `Connection`
- `bn.js` — `BN`

## Deliverables

### Create `packages/pump-agent-swarm/src/trading/trade-scheduler.ts`

1. **`TradeScheduler` class**:
   - `constructor(connection: Connection, eventBus: SwarmEventBus, config: SchedulerConfig)`
   - `schedule(order: ScheduledOrder): string` — add to queue, returns schedule ID
   - `cancel(scheduleId: string): boolean`
   - `getQueue(): ScheduledOrder[]`
   - `getNextExecution(): { order: ScheduledOrder; executeAt: number } | null`
   - `start(): void` — begin processing queue
   - `stop(): void`
   - `pause(): void`
   - `resume(): void`
   - `drain(): Promise<void>` — execute all pending, then stop
   - `getStats(): SchedulerStats`

2. **ScheduledOrder**:
   ```typescript
   interface ScheduledOrder {
     id: string;
     agentId: string;
     walletAddress: string;
     mint: string;
     direction: TradeDirection;
     amount: BN;
     priority: 'low' | 'normal' | 'high' | 'critical';
     executeAt?: number;        // Specific timestamp, or ASAP if undefined
     executeAfter?: string;     // Execute after this schedule ID completes
     maxDelayMs?: number;       // Max acceptable delay from executeAt
     conflictPolicy: 'queue' | 'skip' | 'replace';
     metadata?: Record<string, unknown>;
   }
   ```

3. **Priority queue**: Process orders by:
   1. Priority level (critical > high > normal > low)
   2. Scheduled time (earliest first)
   3. FIFO within same priority and time

4. **Conflict resolution**: Detect and handle conflicts:
   - **Same wallet conflicts**: Can't submit two TXs from same wallet simultaneously
   - **Direction conflicts**: Avoid two agents buying at exact same moment (would spike price)
   - **Slot conflicts**: Space out transactions to different slots when possible
   - Policies: `queue` (delay until clear), `skip` (drop the order), `replace` (cancel existing)

5. **Execution windowing**: Group trades into time windows (e.g., 2-second windows) and ensure max 1 trade per wallet per window.

6. **SchedulerConfig**:
   ```typescript
   interface SchedulerConfig {
     maxConcurrentTrades: number;     // Max simultaneous TX submissions
     minInterTradeDelayMs: number;    // Min gap between any two trades
     executionWindowMs: number;       // Time window for grouping
     enableConflictDetection: boolean;
     maxQueueSize: number;
     staleOrderTimeoutMs: number;     // Auto-cancel orders older than this
   }
   ```

7. **SchedulerStats**:
   ```typescript
   interface SchedulerStats {
     pending: number;
     executing: number;
     completed: number;
     cancelled: number;
     conflicts: number;
     avgWaitTimeMs: number;
     avgExecutionTimeMs: number;
   }
   ```

### Success Criteria

- Priority queue orders trades correctly
- Conflict detection prevents same-wallet collisions
- Execution windowing spaces out trades
- Pause/resume works without losing orders
- Drain completes all pending before stopping
- Compiles with `npx tsc --noEmit`
