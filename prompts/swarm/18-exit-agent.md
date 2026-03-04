# Prompt 18 — Exit Agent

## Agent Identity & Rules

```
You are the EXIT-AGENT builder. Create the coordinated exit/profit-taking agent.

RULES:
- Work on current branch (main), commit as nirholas
- Always use isBackground: true for terminals, always kill_terminal after
- TypeScript strict mode, run npx tsc --noEmit after changes
- Commit message: "feat(swarm): add exit agent for coordinated profit-taking and position unwinding"
```

## Objective

Create `packages/pump-agent-swarm/src/agents/exit-agent.ts` — an agent that coordinates the selling of tokens across multiple wallets when exit conditions are met, minimizing price impact during distribution.

## File Ownership

- **Creates**: `packages/pump-agent-swarm/src/agents/exit-agent.ts`

## Deliverables

### Create `packages/pump-agent-swarm/src/agents/exit-agent.ts`

1. **`ExitAgent` class**:
   - `constructor(config: ExitConfig, connection: Connection, eventBus: SwarmEventBus)`
   - `planExit(wallets: AgentWallet[], mint: string): Promise<ExitPlan>`
   - `executeExit(plan: ExitPlan): Promise<ExitResult>`
   - `emergencyExit(wallets: AgentWallet[], mint: string): Promise<ExitResult>` — sell everything ASAP
   - `setExitConditions(conditions: ExitConditions): void`
   - `monitorForExit(mint: string): void` — continuously check exit conditions

2. **ExitConfig**:
   ```typescript
   interface ExitConfig {
     strategy: 'gradual' | 'staged' | 'immediate' | 'trailing-stop';
     /** For gradual: time to spread sells across (ms) */
     exitDurationMs: number;
     /** For staged: sell X% at each price target */
     stages: Array<{ priceMultiplier: number; sellPercent: number }>;
     /** Max price impact per sell */
     maxPriceImpactPercent: number;
     /** Whether to leave some tokens unsold (diamond hands) */
     retainPercent: number;
     /** Priority fee for exit transactions (high for urgency) */
     priorityFeeMicroLamports: number;
   }
   ```

3. **Exit conditions**:
   ```typescript
   interface ExitConditions {
     /** Exit when price hits this multiplier from entry */
     takeProfitMultiplier?: number; // e.g., 3.0 = 3x
     /** Exit when price drops below this from peak */
     stopLossPercent?: number; // e.g., 30 = sell if down 30% from peak
     /** Exit when graduation is near */
     graduationThreshold?: number; // e.g., 80 = exit at 80% graduation
     /** Exit after this many seconds */
     maxHoldTimeSeconds?: number;
     /** Exit if volume drops below threshold */
     minVolumeSol?: number;
     /** Exit if holder count drops */
     minHolders?: number;
   }
   ```

4. **Exit strategies**:
   - **Gradual**: Spread sells evenly across `exitDurationMs`, using different wallets
   - **Staged**: Define price targets (2x, 3x, 5x) and sell percentages at each
   - **Immediate**: Sell all tokens across all wallets as fast as possible
   - **Trailing stop**: Follow price up, sell when price drops by `stopLossPercent` from peak

5. **ExitPlan**: Generates a sequence of sell orders across wallets, optimized for minimal price impact:
   ```typescript
   interface ExitPlan {
     id: string;
     mint: string;
     totalTokensToSell: BN;
     totalExpectedSol: BN;
     orders: Array<{
       wallet: AgentWallet;
       tokenAmount: BN;
       estimatedSol: BN;
       delayMs: number;
       priority: number;
     }>;
     expectedDuration: number;
     expectedPriceImpact: number;
   }
   ```

6. **ExitResult**: Track actual execution vs plan:
   ```typescript
   interface ExitResult {
     plan: ExitPlan;
     executed: number;
     failed: number;
     totalSolReceived: BN;
     avgSellPrice: BN;
     priceImpact: number;
     duration: number;
     signatures: string[];
   }
   ```

### Success Criteria

- All exit strategies work correctly
- Gradual exit spreads sells realistically
- Staged exit triggers at correct price multiples
- Trailing stop tracks peak and triggers on drawdown
- Emergency exit sells everything immediately
- Exit planning estimates are within 20% of actual
- Compiles with `npx tsc --noEmit`
