# Prompt 17 — Accumulator Agent

## Agent Identity & Rules

```
You are the ACCUMULATOR-AGENT builder. Create the gradual token accumulation agent.

RULES:
- Work on current branch (main), commit as nirholas
- Always use isBackground: true for terminals, always kill_terminal after
- TypeScript strict mode, run npx tsc --noEmit after changes
- Commit message: "feat(swarm): add accumulator agent for gradual position building"
```

## Objective

Create `packages/pump-agent-swarm/src/agents/accumulator-agent.ts` — an agent that slowly accumulates a token position over time using TWAP (Time-Weighted Average Price) and VWAP (Volume-Weighted Average Price) strategies, minimizing price impact.

## File Ownership

- **Creates**: `packages/pump-agent-swarm/src/agents/accumulator-agent.ts`

## Deliverables

### Create `packages/pump-agent-swarm/src/agents/accumulator-agent.ts`

1. **`AccumulatorAgent` class**:
   - `constructor(wallet: AgentWallet, connection: Connection, config: AccumulatorConfig)`
   - `start(mint: string, targetAmount: BN, durationMs: number): void` — accumulate targetAmount over duration
   - `stop(): void`
   - `getProgress(): { acquired: BN; target: BN; percentage: number; avgPrice: BN; elapsed: number; remaining: number }`
   - `adjustTarget(newTarget: BN): void`
   - `adjustDuration(newDurationMs: number): void`

2. **AccumulatorConfig**:
   ```typescript
   interface AccumulatorConfig {
     strategy: 'twap' | 'vwap' | 'iceberg' | 'adaptive';
     maxPriceImpactPercent: number; // max acceptable price impact per trade
     maxSlippageBps: number;
     splitFactor: number; // how many sub-orders to split large orders into
     pauseOnHighVolatility: boolean;
     volatilityThreshold: number; // pause if price change exceeds this %
   }
   ```

3. **Accumulation strategies**:
   - **TWAP**: Split total amount evenly across time intervals. Buy equal portions at regular intervals regardless of price.
   - **VWAP**: Adjust order size proportional to observed volume. Buy more when volume is high (price impact is lower).
   - **Iceberg**: Show only small orders, execute larger ones in slices. Each visible order is 10-20% of the actual order.
   - **Adaptive**: Use ML-like heuristics to buy when price dips and hold when price is elevated. Uses rolling average as baseline.

4. **Price impact estimation**: Before each trade, estimate the price impact on the bonding curve using the constant product formula. If impact exceeds threshold, split into smaller orders.

5. **Progress tracking**: Real-time tracking of accumulation progress, average cost basis, time remaining, projected completion.

### Success Criteria

- All four accumulation strategies work correctly
- Price impact estimation prevents excessive slippage
- Progress tracking is accurate
- TWAP/VWAP execute at appropriate intervals
- Iceberg hides true order size
- Adaptive strategy responds to price changes
- Compiles with `npx tsc --noEmit`
