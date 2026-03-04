# Prompt 39 — Bundle Analytics

## Agent Identity & Rules

```
You are the BUNDLE-ANALYTICS builder.

RULES:
- Work on current branch (main), commit as nirholas
- Always use isBackground: true for terminals, always kill_terminal after
- No mocks — real analytics computed from real on-chain data
- TypeScript strict mode, run npx tsc --noEmit after changes
- Commit message: "feat(swarm): add bundle execution analytics and performance reporting"
```

## Objective

Create `packages/pump-agent-swarm/src/bundle/bundle-analytics.ts` — post-execution analytics for bundle operations. Analyzes timing precision, cost efficiency, supply distribution achieved vs target, and generates performance reports.

## File Ownership

- **Creates**: `packages/pump-agent-swarm/src/bundle/bundle-analytics.ts`

## Dependencies

- `@solana/web3.js` — `Connection` for on-chain verification
- `types.ts` — `BondingCurveState`, `MintResult`, `AgentWallet`
- `infra/event-bus.ts` — `SwarmEventBus`
- `infra/logger.ts` — structured logging
- `bundle/launch-sequencer.ts` — `LaunchResult` type

## Deliverables

### Create `packages/pump-agent-swarm/src/bundle/bundle-analytics.ts`

1. **`BundleAnalytics` class**:
   - `constructor(connection: Connection, eventBus: SwarmEventBus)`
   - `analyzeLaunch(result: LaunchResult): Promise<LaunchAnalysis>`
   - `analyzeTimingPrecision(signatures: string[]): Promise<TimingAnalysis>`
   - `analyzeCostEfficiency(result: LaunchResult): CostAnalysis`
   - `analyzeSupplyDistribution(mint: string, wallets: string[]): Promise<SupplyAnalysis>`
   - `analyzeBondingCurveImpact(mint: string, beforeState: BondingCurveState, afterState: BondingCurveState): CurveImpactAnalysis`
   - `generateReport(launchId: string): Promise<LaunchReport>`
   - `compareToBaseline(analysis: LaunchAnalysis): BaselineComparison`

2. **LaunchAnalysis** (comprehensive analysis of a completed launch):
   ```typescript
   interface LaunchAnalysis {
     launchId: string;
     analyzedAt: number;
     timing: TimingAnalysis;
     cost: CostAnalysis;
     supply: SupplyAnalysis;
     curveImpact: CurveImpactAnalysis;
     overallScore: number;          // 0-100 overall quality score
     grade: 'A' | 'B' | 'C' | 'D' | 'F';
     insights: string[];            // Human-readable insights
     recommendations: string[];     // Suggestions for next launch
   }
   ```

3. **TimingAnalysis**:
   ```typescript
   interface TimingAnalysis {
     /** Did all bundle TXs land in same slot? */
     sameSlot: boolean;
     /** Slots spanned by all TXs */
     slotSpan: number;
     /** Slot numbers for each TX */
     slots: Array<{ signature: string; slot: number; blockTime: number }>;
     /** Time between first and last TX confirmation */
     totalSpreadMs: number;
     /** Time from token creation to first bundle buy */
     creationToBundleMs: number;
     /** Average confirmation time */
     avgConfirmationMs: number;
     /** Score: 100 = all same slot, lower = more spread */
     timingScore: number;
   }
   ```

4. **CostAnalysis**:
   ```typescript
   interface CostAnalysis {
     totalSOLSpent: number;
     totalTokensAcquired: bigint;
     averagePricePerToken: number;
     priceImpactPercent: number;
     feesAsPercentOfTotal: number;
     jitoTipAsPercentOfTotal: number;
     efficiency: number;            // Tokens acquired per SOL, relative to initial price
     wastedSOL: number;             // SOL lost to excessive slippage or failed TXs
     costScore: number;             // 0-100
   }
   ```

5. **SupplyAnalysis**:
   ```typescript
   interface SupplyAnalysis {
     targetDistribution: Map<string, number>;  // What we wanted
     actualDistribution: Map<string, number>;  // What we got
     totalSupplyControlled: number;             // Total % held by swarm
     distributionError: number;                 // Mean absolute error vs target
     largestWalletPercent: number;              // Biggest single wallet holding
     smallestWalletPercent: number;
     giniCoefficient: number;                   // 0 = perfect equality, 1 = one wallet holds all
     herfindahlIndex: number;                   // Concentration metric
     supplyScore: number;                       // 0-100
   }
   ```

6. **CurveImpactAnalysis**:
   ```typescript
   interface CurveImpactAnalysis {
     preBuyPrice: number;
     postBuyPrice: number;
     priceChangePercent: number;
     preVirtualSolReserves: bigint;
     postVirtualSolReserves: bigint;
     preVirtualTokenReserves: bigint;
     postVirtualTokenReserves: bigint;
     tokensPurchasedFromCurve: bigint;
     percentOfCurveDrained: number;   // What % of available tokens bought
     distanceToGraduation: number;    // How close to 85 SOL threshold (%)
   }
   ```

7. **LaunchReport** (formatted report):
   ```typescript
   interface LaunchReport {
     launchId: string;
     generatedAt: string;
     summary: string;                // One-paragraph summary
     analysis: LaunchAnalysis;
     timeline: Array<{
       timestamp: number;
       event: string;
       details: string;
       signature?: string;
     }>;
     formattedReport: string;        // Markdown-formatted full report
   }
   ```

8. **Baseline comparison** — compare this launch to historical baseline:
   ```typescript
   interface BaselineComparison {
     timingVsBaseline: 'better' | 'same' | 'worse';
     costVsBaseline: 'better' | 'same' | 'worse';
     supplyVsBaseline: 'better' | 'same' | 'worse';
     overallVsBaseline: 'better' | 'same' | 'worse';
     /** Percentile rank compared to past launches */
     percentileRank: number;
   }
   ```
   - Store analysis results in memory (or emitted via events for persistence)
   - Compare current launch to rolling average of past launches
   - Identify trends (are launches getting more or less efficient?)

9. **Metric calculations**:
   - Gini coefficient: standard inequality metric, useful for distribution analysis
   - Herfindahl index: sum of squared market shares, measures concentration
   - Timing score: 100 if all same slot, -10 per additional slot spread
   - Cost score: based on efficiency ratio vs theoretical optimal (zero slippage)
   - Overall score: weighted combination (timing 25%, cost 35%, supply 40%)

### Success Criteria

- Timing analysis correctly fetches real transaction slots via RPC
- Supply analysis accurately reads token balances across all wallets
- Gini coefficient and Herfindahl index are computed correctly
- Cost analysis accounts for all fees, tips, and slippage
- Report generation produces useful, actionable markdown
- Compiles with `npx tsc --noEmit`
