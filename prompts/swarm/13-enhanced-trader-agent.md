# Prompt 13 — Enhanced Trader Agent

## Agent Identity & Rules

```
You are the TRADER-AGENT-V2 builder. Enhance the existing trader agent.

RULES:
- Work on current branch (main), commit as nirholas
- Always use isBackground: true for terminals, always kill_terminal after
- Preserve ALL existing functionality
- TypeScript strict mode, run npx tsc --noEmit after changes
- Commit message: "feat(swarm): enhance trader agent with coordination, anti-detection, and advanced P&L"
```

## Objective

Enhance `packages/pump-agent-swarm/src/agents/trader-agent.ts` with: directed trading (buy FROM agent A, sell TO agent B), wallet rotation awareness, anti-detection randomization, advanced P&L tracking with unrealized gains, configurable trading personalities, and infrastructure integration.

## File Ownership

- **Modifies**: `packages/pump-agent-swarm/src/agents/trader-agent.ts`

## Deliverables

### Enhance `packages/pump-agent-swarm/src/agents/trader-agent.ts`

Keep all existing methods. Add:

1. **Directed trading** — ability to execute a trade that's coordinated with another agent:
   - `executePairedTrade(counterparty: TraderAgent, direction: TradeDirection): Promise<[TradeResult, TradeResult]>`
   - Agent A buys, Agent B sells the same amount ± variance
   - Stagger the transactions by 1-5 seconds for realism
   - Track the pair for P&L netting

2. **Trading personality** system:
   ```typescript
   interface TraderPersonality {
     /** Base aggression (0=conservative, 1=aggressive) */
     aggression: number;
     /** Timing randomness multiplier */
     timingVariance: number;
     /** Trade size randomness */
     sizeVariance: number;
     /** Likelihood to follow trend vs counter-trade */
     trendFollowing: number;
     /** Maximum position as % of budget */
     maxPositionPercent: number;
     /** Whether to prefer round numbers (less human) or random sizes */
     naturalSizing: boolean;
   }
   ```
   - Each trader gets a randomly generated but consistent personality
   - Personality affects all trading decisions

3. **Anti-detection patterns**:
   - Randomize trade sizes to avoid patterns (±15% of target)
   - Vary intervals non-uniformly (Poisson distribution instead of uniform random)
   - Occasionally skip a trade cycle (5-10% chance)
   - Mix small and large trades (80/20 split)
   - Avoid trading at exact intervals (add jitter)
   - Don't always buy/sell in same order

4. **Advanced P&L tracking**:
   ```typescript
   interface AdvancedPnL {
     // Existing
     solSpent: BN;
     solReceived: BN;
     realizedPnl: BN;
     // New
     unrealizedPnl: BN; // current token value at market price
     tokensHeld: BN;
     avgEntryPrice: BN; // volume-weighted average cost basis
     currentPrice: BN;  // last known price
     totalVolume: BN;   // total SOL volume traded
     maxDrawdown: BN;   // worst P&L point
     bestPnl: BN;       // best P&L point
     sharpeRatio: number; // risk-adjusted return
     winRate: number;     // percentage of profitable trades
     avgWin: BN;
     avgLoss: BN;
   }
   ```
   - Track cost basis properly across multiple buys
   - Calculate unrealized P&L using last known bonding curve price
   - Update metrics in real-time

5. **Trade execution improvements**:
   - Use `withRetry` from error handler for all TX submissions
   - Use `withCircuitBreaker('trade')` to stop trading if too many failures
   - Preflight simulation before submitting (catch errors before wasting SOL on fees)
   - Dynamic priority fees based on network congestion

6. **Coordination interface**:
   - `receiveInstruction(instruction: TradeInstruction): Promise<TradeResult>` — receive a trade instruction from the coordinator
   - `setTradingEnabled(enabled: boolean): void` — pause/resume from coordinator
   - `adjustStrategy(updates: Partial<TradingStrategy>): void` — hot-reload strategy params
   - `getPosition(): { tokens: BN; solValue: BN; percentage: number }` — current position

7. **Infrastructure integration**:
   - Event bus for all events
   - Structured logging with agent ID context
   - Metrics for trades, latency, P&L
   - Error handler with circuit breaker

### Success Criteria

- All existing functionality preserved
- Paired trades execute with realistic timing
- Personalities create distinct trading behaviors
- Anti-detection patterns avoid uniform patterns
- P&L tracking is accurate with unrealized gains
- Coordination interface allows external direction
- Compiles with `npx tsc --noEmit`
