# Prompt 20 — Wash Trading Engine

## Agent Identity & Rules

```
You are the WASH-ENGINE builder. Create the coordinated wash trading engine.

RULES:
- Work on current branch (main), commit as nirholas
- Always use isBackground: true for terminals, always kill_terminal after
- No mocks — real Solana transactions on real bonding curves
- TypeScript strict mode, run npx tsc --noEmit after changes
- Commit message: "feat(swarm): add wash trading engine with coordinated agent-to-agent routes"
```

## Objective

Create `packages/pump-agent-swarm/src/trading/wash-engine.ts` — the core engine that coordinates trades between agent-controlled wallets, creating realistic-looking volume and price action while minimizing net SOL loss.

## File Ownership

- **Creates**: `packages/pump-agent-swarm/src/trading/wash-engine.ts`

## Dependencies

- Types from `../types.ts`: `WashTradeRoute`, `TradeCycle`, `MarketMakingConfig`, `AgentWallet`, `TradeResult`
- Trader agents from `../agents/trader-agent.ts`
- Event bus, logger, metrics from `../infra/`

## Deliverables

### Create `packages/pump-agent-swarm/src/trading/wash-engine.ts`

1. **`WashEngine` class**:
   - `constructor(wallets: AgentWallet[], connection: Connection, config: WashEngineConfig, eventBus: SwarmEventBus)`
   - `planCycle(mint: string): TradeCycle` — generates a cycle of trades
   - `executeCycle(cycle: TradeCycle): Promise<CycleResult>` — executes all trades in a cycle
   - `startContinuous(mint: string): void` — runs cycles continuously
   - `stopContinuous(): void`
   - `getStats(): WashStats`
   - `adjustConfig(updates: Partial<WashEngineConfig>): void`

2. **WashEngineConfig**:
   ```typescript
   interface WashEngineConfig {
     /** Number of trades per cycle */
     tradesPerCycle: number;
     /** Delay between trades in a cycle (ms) */
     intraTradeDelayMs: { min: number; max: number };
     /** Delay between cycles (ms) */
     interCycleDelayMs: { min: number; max: number };
     /** Trade size range in SOL */
     tradeSizeRange: { min: number; max: number };
     /** Target net SOL change per cycle (should be near zero) */
     maxNetChangePercent: number;
     /** Price drift target per cycle (positive = price up) */
     priceDriftPercent: number;
     /** Maximum number of consecutive buys before forcing a sell */
     maxConsecutiveBuys: number;
     /** Maximum number of consecutive sells before forcing a buy */
     maxConsecutiveSells: number;
     /** Whether to make trade sizes look natural */
     naturalSizing: boolean;
     /** Max SOL budget for the engine */
     maxBudgetLamports: BN;
   }
   ```

3. **Cycle planning algorithm**:
   - Given N wallets, generate a sequence of trades where:
     - Each wallet both buys and sells during the cycle
     - Total buys ≈ total sells (net zero within `maxNetChangePercent`)
     - Trade sizes are randomized but within the configured range
     - If `priceDriftPercent > 0`, slightly more buy volume than sell volume
     - Delays between trades are randomized for organic appearance
   - Example cycle with 4 wallets (A, B, C, D):
     ```
     A buys  0.05 SOL  (t=0s)
     C buys  0.03 SOL  (t=4s)
     B sells 0.04 SOL  (t=9s)
     D buys  0.02 SOL  (t=15s)
     A sells 0.03 SOL  (t=22s)
     C sells 0.04 SOL  (t=28s)
     ```

4. **Natural trade sizing**:
   - Avoid round numbers (0.1 → 0.0973 or 0.1042)
   - Mix order magnitudes (some 0.01 SOL, some 0.05 SOL, occasional 0.1 SOL)
   - Follow approximate Pareto distribution (many smalls, few large)
   - Each wallet has its own "average size" that stays consistent

5. **Cycle result tracking**:
   ```typescript
   interface CycleResult {
     cycle: TradeCycle;
     trades: TradeResult[];
     netSolChange: BN;
     volume: BN;
     priceChange: number;
     duration: number;
     successRate: number;
   }
   ```

6. **WashStats**:
   ```typescript
   interface WashStats {
     cyclesCompleted: number;
     totalVolumeSol: number;
     netSolChange: number;
     avgCycleDuration: number;
     avgTradeSuccess: number;
     volumePerHour: number;
     priceChangeSinceStart: number;
   }
   ```

7. **Integration**: Event bus emissions for every trade and cycle. Metrics for volume, P&L, cycle timing.

### Success Criteria

- Cycle planning generates balanced buy/sell sequences
- Net SOL change per cycle stays within threshold
- Natural sizing avoids detectable patterns
- Continuous mode runs without memory leaks
- Price drift works as configured
- Volume generation is consistent and configurable
- Compiles with `npx tsc --noEmit`
