# Prompt 37 — Dev Buy Optimizer

## Agent Identity & Rules

```
You are the DEV-BUY-OPTIMIZER builder.

RULES:
- Work on current branch (main), commit as nirholas
- Always use isBackground: true for terminals, always kill_terminal after
- No mocks — real bonding curve math against real Pump.fun parameters
- TypeScript strict mode, run npx tsc --noEmit after changes
- Commit message: "feat(swarm): add dev buy optimizer with bonding curve analysis"
```

## Objective

Create `packages/pump-agent-swarm/src/bundle/dev-buy-optimizer.ts` — calculates the optimal dev buy size at token creation. The dev buy is the atomic purchase that happens in the same transaction as token creation. This analyzer considers bonding curve parameters, target supply ownership, SOL budget constraints, and price impact to recommend the ideal amount.

## File Ownership

- **Creates**: `packages/pump-agent-swarm/src/bundle/dev-buy-optimizer.ts`

## Dependencies

- `@pump-fun/pump-sdk` — bonding curve constants and math
- `types.ts` — `BondingCurveState`, `TokenConfig`
- `infra/logger.ts` — structured logging
- `bn.js` for big number arithmetic

## Deliverables

### Create `packages/pump-agent-swarm/src/bundle/dev-buy-optimizer.ts`

1. **`DevBuyOptimizer` class**:
   - `constructor(config?: DevBuyOptimizerConfig)`
   - `calculateOptimalDevBuy(params: DevBuyParams): DevBuyRecommendation`
   - `simulateDevBuy(solAmount: number): DevBuySimulation`
   - `calculateTokensForSOL(solAmount: number, virtualSolReserves?: bigint, virtualTokenReserves?: bigint): bigint`
   - `calculateSOLForTokens(tokenAmount: bigint, virtualSolReserves?: bigint, virtualTokenReserves?: bigint): number`
   - `calculatePriceImpact(solAmount: number): number` — percent price impact
   - `getMaxDevBuy(maxSupplyPercent: number): number` — max SOL for target supply %
   - `getBondingCurveParams(): PumpFunCurveParams`

2. **Pump.fun bonding curve math** (real parameters):
   ```typescript
   // Pump.fun uses constant product bonding curve: x * y = k
   // Initial virtual reserves:
   //   virtualSolReserves = 30 SOL (30_000_000_000 lamports)
   //   virtualTokenReserves = 1_073_000_000 tokens (with 6 decimals = 1_073_000_000_000_000)
   //   Total supply = 1_000_000_000 tokens (with 6 decimals)
   //   k = virtualSolReserves * virtualTokenReserves
   
   // Buy formula:
   //   tokensOut = virtualTokenReserves - (k / (virtualSolReserves + solIn))
   //   Actual tokens received = min(tokensOut, realTokenReserves)
   
   // Price at any point:
   //   price = virtualSolReserves / virtualTokenReserves (in SOL per token)
   
   // Graduation threshold:
   //   When real SOL in curve reaches ~85 SOL, token graduates to Raydium
   
   interface PumpFunCurveParams {
     virtualSolReserves: bigint;     // 30 SOL in lamports
     virtualTokenReserves: bigint;   // 1.073B tokens
     realTokenReserves: bigint;      // Tokens available for purchase
     totalSupply: bigint;
     tokenDecimals: number;          // 6
     graduationThreshold: bigint;    // ~85 SOL in lamports
     feeBasisPoints: number;         // Pump.fun trading fee (1% = 100 bps)
   }
   ```

3. **DevBuyParams**:
   ```typescript
   interface DevBuyParams {
     /** Maximum SOL budget for dev buy */
     maxSOLBudget: number;
     /** Target percentage of supply to acquire (1-10 recommended) */
     targetSupplyPercent: number;
     /** Maximum acceptable price impact percent */
     maxPriceImpactPercent: number;
     /** Whether this is the first buy (token creation) or buying into existing */
     isCreationBuy: boolean;
     /** If buying existing, current curve state */
     currentCurveState?: BondingCurveState;
     /** Strategy: minimize cost, maximize supply, or balance */
     optimizationGoal: 'minimize-cost' | 'maximize-supply' | 'balanced';
   }
   ```

4. **DevBuyRecommendation**:
   ```typescript
   interface DevBuyRecommendation {
     recommendedSOL: number;
     expectedTokens: bigint;
     expectedSupplyPercent: number;
     priceImpactPercent: number;
     effectivePrice: number;         // Average price per token
     postBuyPrice: number;           // Price after dev buy
     priceMultiple: number;          // postBuyPrice / initialPrice
     costBreakdown: {
       solForTokens: number;
       platformFee: number;
       transactionFee: number;
       total: number;
     };
     reasoning: string;              // Why this amount was chosen
     alternatives: Array<{
       sol: number;
       tokens: bigint;
       supplyPercent: number;
       priceImpact: number;
       note: string;
     }>;
   }
   ```

5. **DevBuySimulation** (simulate without executing):
   ```typescript
   interface DevBuySimulation {
     solIn: number;
     tokensOut: bigint;
     supplyPercent: number;
     priceImpact: number;
     preBuyPrice: number;
     postBuyPrice: number;
     newVirtualSolReserves: bigint;
     newVirtualTokenReserves: bigint;
     remainingRealTokens: bigint;
     percentToGraduation: number;    // How close to 85 SOL threshold
   }
   ```

6. **Optimization strategies**:
   - **minimize-cost**: Find the SOL amount that gets closest to target supply % while minimizing total cost. Avoid large buys with high price impact.
   - **maximize-supply**: Spend the full budget to get maximum tokens. Accept higher price impact.
   - **balanced**: Target the "sweet spot" where marginal cost of next 1% supply starts rising significantly. Use binary search on the price impact curve.

7. **Safety checks**:
   - Warn if dev buy would move price more than 20%
   - Warn if dev buy would acquire more than 10% of supply (looks suspicious)
   - Warn if dev buy exceeds 5 SOL (significant capital at risk in new token)
   - Error if SOL budget exceeds wallet balance
   - Cap recommendations at 80% of graduation threshold (don't accidentally graduate)

### Success Criteria

- Bonding curve math matches real Pump.fun behavior exactly
- Token output calculations match on-chain results within rounding tolerance
- Price impact calculations are accurate
- Optimization strategies produce meaningfully different recommendations
- Safety checks prevent dangerous over-buys
- Compiles with `npx tsc --noEmit`
