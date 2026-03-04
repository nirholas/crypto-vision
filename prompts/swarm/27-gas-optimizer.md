# Prompt 27 — Gas Optimizer

## Agent Identity & Rules

```
You are the GAS-OPTIMIZER builder.

RULES:
- Work on current branch (main), commit as nirholas
- Always use isBackground: true for terminals, always kill_terminal after
- TypeScript strict mode, run npx tsc --noEmit after changes
- Commit message: "feat(swarm): add dynamic priority fee optimizer with compute budget management"
```

## Objective

Create `packages/pump-agent-swarm/src/trading/gas-optimizer.ts` — dynamically optimizes Solana transaction priority fees and compute budgets based on real-time network conditions, balancing speed of inclusion vs cost.

## File Ownership

- **Creates**: `packages/pump-agent-swarm/src/trading/gas-optimizer.ts`

## Dependencies

- `../infra/logger.ts` — `SwarmLogger` (P07)
- `../infra/metrics.ts` — `MetricsCollector` (P08)
- `@solana/web3.js` — `Connection`, `Transaction`, `VersionedTransaction`, `TransactionInstruction`, `ComputeBudgetProgram`

## Deliverables

### Create `packages/pump-agent-swarm/src/trading/gas-optimizer.ts`

1. **`GasOptimizer` class**:
   - `constructor(connection: Connection, config: GasConfig)`
   - `getOptimalPriorityFee(urgency: 'low' | 'normal' | 'high' | 'critical'): Promise<number>` — returns micro-lamports
   - `getOptimalComputeUnits(instructions: TransactionInstruction[]): Promise<number>`
   - `addPriorityInstructions(tx: Transaction | VersionedTransaction, urgency: string): Promise<void>` — adds ComputeBudgetProgram instructions
   - `estimateTransactionCost(tx: Transaction, urgency: string): Promise<{ baseFee: number; priorityFee: number; total: number }>`
   - `getNetworkCongestion(): Promise<'low' | 'medium' | 'high' | 'extreme'>`
   - `getFeeHistory(): FeeDataPoint[]`
   - `startMonitoring(): void` — continuously track fees
   - `stopMonitoring(): void`

2. **GasConfig**:
   ```typescript
   interface GasConfig {
     maxPriorityFeeMicroLamports: number;  // Cap on priority fees
     defaultComputeUnits: number;           // Default CU if estimation fails
     computeUnitBuffer: number;             // Multiplier (e.g., 1.2 = 20% buffer)
     feeHistorySize: number;                // Number of data points to keep
     monitorIntervalMs: number;             // How often to sample fees
     urgencyMultipliers: Record<string, number>; // Multiplier per urgency level
   }
   ```

3. **Priority fee calculation**:
   - Use `getRecentPrioritizationFees()` RPC call to get recent fee data
   - Calculate percentiles: p25 (low), p50 (normal), p75 (high), p95 (critical)
   - Apply urgency multiplier on top
   - Cap at configured maximum
   - Fall back to sensible defaults if RPC call fails

4. **Compute unit estimation**:
   - Use `simulateTransaction()` to get actual CU consumption
   - Add configured buffer (default 20%)
   - Fall back to default CU if simulation fails
   - Special handling for Pump.fun buy/sell instructions (~200,000 CU typically)

5. **Network congestion detection**:
   - Sample recent slots for transactions per slot
   - Compare to historical average
   - Low: <50% capacity, Medium: 50-75%, High: 75-90%, Extreme: >90%
   - Adjust fee recommendations based on congestion

6. **Fee history tracking**:
   ```typescript
   interface FeeDataPoint {
     timestamp: number;
     p25: number;
     p50: number;
     p75: number;
     p95: number;
     congestion: string;
     slot: number;
   }
   ```

### Success Criteria

- Priority fee recommendations reflect real network conditions
- Compute unit estimation prevents CU exhaustion errors
- Network congestion detection is accurate
- Urgency levels produce appropriately different fee levels
- Fee capping prevents excessive spending
- Compiles with `npx tsc --noEmit`
