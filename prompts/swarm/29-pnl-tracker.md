# Prompt 29 — P&L Tracker

## Agent Identity & Rules

```
You are the PNL-TRACKER builder.

RULES:
- Work on current branch (main), commit as nirholas
- Always use isBackground: true for terminals, always kill_terminal after
- TypeScript strict mode, run npx tsc --noEmit after changes
- Commit message: "feat(swarm): add real-time P&L tracker with time-series and drawdown tracking"
```

## Objective

Create `packages/pump-agent-swarm/src/trading/pnl-tracker.ts` — real-time profit and loss tracking across all agent wallets with realized/unrealized breakdown, time-series history, drawdown tracking, and per-agent attribution.

## File Ownership

- **Creates**: `packages/pump-agent-swarm/src/trading/pnl-tracker.ts`

## Deliverables

### Create `packages/pump-agent-swarm/src/trading/pnl-tracker.ts`

1. **`PnLTracker` class**:
   - `constructor(eventBus: SwarmEventBus)`
   - `recordTrade(trade: TradeRecord): void`
   - `recordFunding(agentId: string, solAmount: BN): void` — track initial SOL deployed
   - `getAgentPnL(agentId: string): AgentPnL`
   - `getSwarmPnL(): SwarmPnL`
   - `getTimeSeries(intervalMs: number, since?: number): PnLDataPoint[]`
   - `getDrawdown(): DrawdownInfo`
   - `getROI(): { absolute: BN; percent: number; annualized: number }`
   - `getSharpeRatio(riskFreeRate?: number): number`
   - `getTradeHistory(options?: { agentId?: string; direction?: string; limit?: number }): TradeRecord[]`
   - `exportCSV(): string`
   - `snapshot(): PnLSnapshot`

2. **TradeRecord**:
   ```typescript
   interface TradeRecord {
     id: string;
     agentId: string;
     walletAddress: string;
     mint: string;
     direction: TradeDirection;
     solAmount: BN;
     tokenAmount: BN;
     price: number;           // SOL per token at execution
     fee: BN;                 // Transaction fee paid
     signature: string;
     timestamp: number;
     slippage: number;
   }
   ```

3. **AgentPnL**:
   ```typescript
   interface AgentPnL {
     agentId: string;
     solDeployed: BN;          // Initial SOL allocated
     solSpent: BN;             // Total SOL spent on buys (including fees)
     solReceived: BN;          // Total SOL received from sells
     realizedPnl: BN;          // solReceived - solSpent (for completed round-trips)
     unrealizedPnl: BN;        // (tokensHeld * currentPrice) - costBasis
     totalPnl: BN;             // realized + unrealized
     totalPnlPercent: number;
     tokensHeld: BN;
     costBasis: BN;
     currentValue: BN;
     tradesCount: number;
     winCount: number;
     lossCount: number;
     winRate: number;
     avgWin: number;
     avgLoss: number;
     bestTrade: TradeRecord | null;
     worstTrade: TradeRecord | null;
     maxDrawdown: BN;
     maxDrawdownPercent: number;
   }
   ```

4. **SwarmPnL** — aggregation across all agents:
   ```typescript
   interface SwarmPnL {
     totalSolDeployed: BN;
     totalRealizedPnl: BN;
     totalUnrealizedPnl: BN;
     totalPnl: BN;
     totalPnlPercent: number;
     totalTrades: number;
     totalVolume: BN;
     swarmROI: number;
     startedAt: number;
     duration: number;
     agentBreakdown: AgentPnL[];
   }
   ```

5. **Time-series tracking**: Store P&L snapshots at configurable intervals. Each data point contains timestamp, totalPnl, realizedPnl, unrealizedPnl, tokenPrice, activeAgents.

6. **Drawdown tracking**: Track peak portfolio value and current value. Calculate current drawdown, max drawdown, drawdown duration. Alert when drawdown exceeds threshold.

7. **FIFO cost basis**: Use First-In-First-Out for matching buys to sells. When a sell occurs, match it against the earliest unmatched buy to calculate realized P&L.

### Success Criteria

- Accurate P&L with proper FIFO cost basis
- Per-agent and swarm-wide aggregation
- Time-series data for charting
- Drawdown tracking with max drawdown
- Sharpe ratio and ROI calculations
- CSV export for post-mortem analysis
- Compiles with `npx tsc --noEmit`
