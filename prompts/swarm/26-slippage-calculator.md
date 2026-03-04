# Prompt 26 — Slippage Calculator

## Agent Identity & Rules

```
You are the SLIPPAGE-CALC builder.

RULES:
- Work on current branch (main), commit as nirholas
- Always use isBackground: true for terminals, always kill_terminal after
- TypeScript strict mode, run npx tsc --noEmit after changes
- Commit message: "feat(swarm): add bonding curve slippage calculator with price impact estimation"
```

## Objective

Create `packages/pump-agent-swarm/src/trading/slippage-calculator.ts` — accurately calculates expected slippage on Pump.fun bonding curve trades before execution, estimates price impact, warns on excessive slippage, and suggests optimal trade sizes.

## File Ownership

- **Creates**: `packages/pump-agent-swarm/src/trading/slippage-calculator.ts`

## Deliverables

### Create `packages/pump-agent-swarm/src/trading/slippage-calculator.ts`

1. **`SlippageCalculator` class**:
   - `constructor(connection: Connection)`
   - `calculateBuySlippage(mint: string, solAmount: BN): Promise<SlippageEstimate>`
   - `calculateSellSlippage(mint: string, tokenAmount: BN): Promise<SlippageEstimate>`
   - `estimatePriceImpact(mint: string, direction: TradeDirection, amount: BN): Promise<number>` — returns percentage
   - `suggestOptimalSize(mint: string, direction: TradeDirection, maxSlippageBps: number, totalAmount: BN): Promise<BN[]>` — splits order into optimal chunks
   - `getBondingCurveState(mint: string): Promise<BondingCurveState>` — fetches current curve state
   - `calculateSpotPrice(state: BondingCurveState): number` — current price in SOL per token
   - `calculateExecutionPrice(state: BondingCurveState, direction: TradeDirection, amount: BN): number`

2. **SlippageEstimate**:
   ```typescript
   interface SlippageEstimate {
     spotPrice: number;           // Price before trade
     executionPrice: number;      // Expected average price of trade
     slippageBps: number;         // Slippage in basis points
     slippagePercent: number;     // Slippage as percentage
     priceImpactPercent: number;  // How much the trade moves the price
     tokensReceived?: BN;         // For buys: tokens you'd receive
     solReceived?: BN;            // For sells: SOL you'd receive
     priceAfterTrade: number;     // New spot price after trade
     fee: BN;                     // Pump.fun trading fee (1%)
     warning?: string;            // Warning if slippage is high
   }
   ```

3. **Pump.fun bonding curve math** (constant product: x * y = k):
   ```typescript
   // Pump.fun specific constants
   const PUMP_FUN_FEE_BPS = 100; // 1% fee
   const INITIAL_VIRTUAL_TOKEN_RESERVES = new BN('1_073_000_000_000_000'); // ~1.073B tokens
   const INITIAL_VIRTUAL_SOL_RESERVES = new BN('30_000_000_000'); // 30 SOL
   const TOKEN_DECIMALS = 6;
   const SOL_DECIMALS = 9;
   
   // Buy: solIn → tokensOut
   // tokensOut = (virtualTokenReserves * solIn) / (virtualSolReserves + solIn)
   // After fee: actualSolIn = solIn * (1 - feeBps/10000)
   
   // Sell: tokensIn → solOut
   // solOut = (virtualSolReserves * tokensIn) / (virtualTokenReserves + tokensIn)
   // After fee: actualSolOut = solOut * (1 - feeBps/10000)
   ```

4. **Optimal size suggestions**: If a single trade would cause >2% slippage, suggest splitting into smaller trades that each stay under the threshold. Return array of suggested amounts.

5. **On-chain data fetching**: Read the bonding curve account directly using the PDA derivation formula:
   ```typescript
   // Bonding curve PDA = PDA(["bonding-curve", mint], PUMP_FUN_PROGRAM_ID)
   const PUMP_FUN_PROGRAM_ID = new PublicKey('6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P');
   ```

### Success Criteria

- Accurately calculates slippage for bonding curve trades
- Price impact estimation within 5% of actual
- Optimal size splitting keeps slippage under threshold
- Real on-chain data fetching from bonding curve accounts
- Fee calculation matches Pump.fun's 1% fee
- Compiles with `npx tsc --noEmit`
