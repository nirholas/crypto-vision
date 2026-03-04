# Prompt 22 — Price Trajectory Controller

## Agent Identity & Rules

```
You are the PRICE-TRAJECTORY builder. Create the price trajectory planning system.

RULES:
- Work on current branch (main), commit as nirholas
- Always use isBackground: true for terminals, always kill_terminal after
- TypeScript strict mode, run npx tsc --noEmit after changes
- Commit message: "feat(swarm): add price trajectory controller for controlled price movement"
```

## Objective

Create `packages/pump-agent-swarm/src/trading/price-trajectory.ts` — plans and executes price trajectories on the bonding curve by calculating the exact buy/sell imbalance needed to move price from point A to point B over a given duration.

## File Ownership

- **Creates**: `packages/pump-agent-swarm/src/trading/price-trajectory.ts`

## Deliverables

### Create `packages/pump-agent-swarm/src/trading/price-trajectory.ts`

1. **`PriceTrajectoryController` class**:
   - `constructor(connection: Connection, eventBus: SwarmEventBus)`
   - `planTrajectory(mint: string, targetPriceSol: number, durationMs: number, curve: 'linear' | 'exponential' | 'step' | 's-curve'): Promise<PriceTrajectoryPlan>`
   - `getCurrentPrice(mint: string): Promise<number>` — reads bonding curve
   - `estimateSolNeeded(mint: string, currentPrice: number, targetPrice: number): Promise<BN>` — estimates SOL needed for price movement using bonding curve math
   - `getTrajectoryProgress(plan: PriceTrajectoryPlan): TrajectoryProgress`
   - `recordPriceUpdate(price: number): void` — track actual price against plan

2. **Bonding curve math** (Pump.fun uses constant product x*y=k):
   ```typescript
   /** Calculate tokens received for a given SOL input */
   calculateBuyOutput(virtualSolReserves: BN, virtualTokenReserves: BN, solInput: BN): BN
   
   /** Calculate SOL received for a given token input */
   calculateSellOutput(virtualSolReserves: BN, virtualTokenReserves: BN, tokenInput: BN): BN
   
   /** Calculate SOL needed to move price to target */
   calculateSolForPriceTarget(currentState: BondingCurveState, targetPriceSol: number): BN
   
   /** Calculate price after a hypothetical trade */
   simulatePriceAfterTrade(currentState: BondingCurveState, direction: 'buy' | 'sell', amount: BN): number
   ```

3. **PriceTrajectoryPlan**:
   ```typescript
   interface PriceTrajectoryPlan {
     id: string;
     mint: string;
     startPrice: number;
     targetPrice: number;
     durationMs: number;
     curve: string;
     checkpoints: Array<{
       timestampMs: number;
       targetPrice: number;
       netBuyPressureSol: BN; // positive = net buy needed, negative = net sell
       tolerance: number; // acceptable deviation from target
     }>;
     totalNetBuySol: BN;
     createdAt: number;
   }
   ```

4. **Trajectory curves**:
   - `linear`: Constant rate of price change
   - `exponential`: Slow start, accelerating price increase  
   - `step`: Price jumps at intervals with plateaus between
   - `s-curve`: Slow → fast → slow (logistic function)

5. **Feedback loop**: Compare actual price to planned price at each checkpoint. If behind, increase buy pressure. If ahead, reduce or add sell pressure.

### Success Criteria

- Bonding curve math accurately predicts trade outcomes
- All trajectory curves produce valid plans
- SOL estimation is within 15% of actual cost
- Feedback loop keeps price within tolerance of target
- Compiles with `npx tsc --noEmit`
