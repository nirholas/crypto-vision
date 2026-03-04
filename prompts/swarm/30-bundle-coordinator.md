# Prompt 30 — Bundle Coordinator

## Agent Identity & Rules

```
You are the BUNDLE-COORDINATOR builder.

RULES:
- Work on current branch (main), commit as nirholas
- Always use isBackground: true for terminals, always kill_terminal after
- No mocks — real Solana transactions, real bundle execution
- TypeScript strict mode, run npx tsc --noEmit after changes
- Commit message: "feat(swarm): add bundle coordinator for multi-wallet atomic token acquisition"
```

## Objective

Create `packages/pump-agent-swarm/src/bundle/bundle-coordinator.ts` — orchestrates multi-wallet bundle buys at token launch or for existing tokens, coordinating N wallets to buy simultaneously and acquire a target supply percentage.

## File Ownership

- **Creates**: `packages/pump-agent-swarm/src/bundle/bundle-coordinator.ts`

## Deliverables

### Create `packages/pump-agent-swarm/src/bundle/bundle-coordinator.ts`

1. **`BundleCoordinator` class**:
   - `constructor(connection: Connection, walletVault: WalletVault, eventBus: SwarmEventBus, config: BundleCoordinatorConfig)`
   - `planBundle(mint: string, totalSol: BN, walletCount: number): Promise<BundlePlan>` — creates execution plan
   - `executeBundle(plan: BundlePlan): Promise<BundleResult>` — executes the plan
   - `executeBundleWithCreate(narrative: TokenNarrative, totalSol: BN, devBuySol: BN, walletCount: number): Promise<BundleResult>` — creates token AND bundles in one operation
   - `getActiveBundles(): BundlePlan[]`
   - `cancelBundle(bundleId: string): void`
   - `getBundleResult(bundleId: string): BundleResult | undefined`

2. **BundleCoordinatorConfig**:
   ```typescript
   interface BundleCoordinatorConfig {
     /** Maximum wallets per bundle */
     maxWalletsPerBundle: number;
     /** Whether to use Jito for atomic execution */
     useJito: boolean;
     /** Jito configuration */
     jitoConfig?: JitoBundleConfig;
     /** Maximum total SOL per bundle */
     maxTotalSol: BN;
     /** Whether to distribute amounts evenly or randomly */
     distribution: 'even' | 'weighted' | 'random';
     /** Stagger delay between buys if not using Jito (ms) */
     staggerDelayMs: { min: number; max: number };
     /** Slippage tolerance per buy (bps) */
     slippageBps: number;
     /** Priority fee multiplier for bundle buys */
     priorityFeeMultiplier: number;
     /** Whether to verify all buys landed before proceeding */
     verifyAll: boolean;
   }
   ```

3. **Bundle planning logic**:
   - Calculate how to split `totalSol` across `walletCount` wallets
   - For `even`: Equal split
   - For `weighted`: Larger amounts for first wallets (creator's wallet gets most)
   - For `random`: Random distribution with min/max constraints
   - Estimate tokens each wallet will receive
   - Estimate total supply percentage acquired
   - Calculate fees and priority fees

4. **Bundle execution** — Two modes:

   a. **Jito mode** (preferred for atomicity):
      - Build all buy transactions
      - Submit as a Jito bundle for guaranteed same-slot execution
      - All buys land or none do
      - Include Jito tip

   b. **Stagger mode** (fallback):
      - Execute buys sequentially with random delays
      - Submit to multiple RPCs for speed
      - Verify each buy before proceeding to next
      - Retry failures up to 3 times

5. **BundleResult**:
   ```typescript
   interface BundleResult {
     bundleId: string;
     mint: string;
     plan: BundlePlan;
     status: 'success' | 'partial' | 'failed';
     results: Array<{
       wallet: string;
       solSpent: BN;
       tokensReceived: BN;
       signature: string;
       status: 'confirmed' | 'failed';
       error?: string;
     }>;
     totalSolSpent: BN;
     totalTokensReceived: BN;
     estimatedSupplyPercent: number;
     executionTimeMs: number;
     jitoBundle?: boolean;
   }
   ```

6. **Create + Bundle combo**: For launching a new token:
   - Step 1: Creator agent creates token with dev buy
   - Step 2: Immediately (same slot if Jito) all bundle wallets buy
   - This ensures agents acquire maximum supply before anyone else

### Success Criteria

- Bundle planning correctly distributes SOL across wallets
- Both Jito and stagger execution modes work
- Create+bundle combo executes token creation and bundle atomically
- Supply percentage estimation is accurate
- Failed individual buys don't crash the whole bundle
- Compiles with `npx tsc --noEmit`
