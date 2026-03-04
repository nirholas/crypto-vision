# Prompt 36 — Launch Sequencer

## Agent Identity & Rules

```
You are the LAUNCH-SEQUENCER builder.

RULES:
- Work on current branch (main), commit as nirholas
- Always use isBackground: true for terminals, always kill_terminal after
- No mocks — real state machine with persistent state
- TypeScript strict mode, run npx tsc --noEmit after changes
- Commit message: "feat(swarm): add end-to-end launch sequencer with state machine orchestration"
```

## Objective

Create `packages/pump-agent-swarm/src/bundle/launch-sequencer.ts` — the end-to-end launch sequence orchestrator. This is the master state machine that takes a token from concept to actively traded, coordinating all bundle components: wallet funding → token creation → dev buy → bundle buys → supply distribution → trading kickoff.

## File Ownership

- **Creates**: `packages/pump-agent-swarm/src/bundle/launch-sequencer.ts`

## Dependencies

- `bundle/bundle-coordinator.ts` — `BundleCoordinator`
- `bundle/jito-client.ts` — `JitoClient`
- `bundle/supply-distributor.ts` — `SupplyDistributor`
- `bundle/anti-detection.ts` — `AntiDetection`
- `bundle/timing-engine.ts` — `TimingEngine`
- `bundle/bundle-validator.ts` — `BundleValidator`
- `bundle/wallet-funder.ts` — `WalletFunder`
- `bundle/dev-buy-optimizer.ts` — `DevBuyOptimizer`
- `agents/creator-agent.ts` — `CreatorAgent`
- `infra/state-machine.ts` — `SwarmStateMachine`
- `infra/event-bus.ts` — `SwarmEventBus`
- `infra/logger.ts` — structured logging

## Deliverables

### Create `packages/pump-agent-swarm/src/bundle/launch-sequencer.ts`

1. **`LaunchSequencer` class**:
   - `constructor(config: LaunchSequencerConfig, deps: LaunchSequencerDeps)`
   - `prepareLaunch(tokenConfig: TokenConfig): Promise<LaunchPlan>`
   - `executeLaunch(plan: LaunchPlan): Promise<LaunchResult>`
   - `getLaunchStatus(): LaunchStatus`
   - `abort(reason: string): Promise<void>`
   - `retry(fromPhase?: LaunchPhase): Promise<LaunchResult>`
   - `estimateCost(plan: LaunchPlan): LaunchCostEstimate`

2. **Launch phases** (state machine):
   ```typescript
   type LaunchPhase = 
     | 'idle'
     | 'planning'           // Calculate amounts, prepare wallets
     | 'funding'            // Fund all trader wallets from master
     | 'creating'           // Create token on Pump.fun
     | 'dev-buying'         // Dev buy (creator's initial buy)
     | 'bundling'           // Multi-wallet bundle buys
     | 'distributing'       // Redistribute tokens across wallets
     | 'verifying'          // Verify all wallets have expected tokens/SOL
     | 'ready'              // Ready for trading phase
     | 'failed'             // Launch failed
     | 'aborted';           // Manually aborted

   // Each phase transition emits events and checks preconditions
   ```

3. **LaunchPlan**:
   ```typescript
   interface LaunchPlan {
     id: string;
     tokenConfig: TokenConfig;
     walletPlan: {
       masterWallet: string;          // Pubkey of funding source
       traderWallets: string[];       // Pubkeys of trader wallets
       totalSOLRequired: number;      // Total SOL needed across all wallets
       perWalletSOL: Map<string, number>; // SOL allocation per wallet
     };
     devBuy: {
       amountSOL: number;
       expectedTokens: bigint;
       slippageBps: number;
     };
     bundleBuys: Array<{
       walletIndex: number;
       amountSOL: number;
       expectedTokens: bigint;
       delayAfterCreate: number;      // ms delay after token creation
     }>;
     distribution: {
       strategy: string;
       targetDistribution: Map<string, number>; // wallet -> target % of supply
     };
     timing: {
       fundingTimeout: number;
       createTimeout: number;
       bundleTimeout: number;
       distributionTimeout: number;
       totalTimeout: number;
     };
     estimatedCost: LaunchCostEstimate;
     createdAt: number;
   }
   ```

4. **Phase execution logic**:

   **Planning phase**:
   - Calculate optimal dev buy size (via `DevBuyOptimizer`)
   - Determine how many wallets participate in bundle
   - Calculate per-wallet buy amounts with anti-detection variance
   - Estimate total SOL cost including fees and tips
   - Validate master wallet has sufficient balance

   **Funding phase**:
   - Use `WalletFunder` to distribute SOL from master to all trader wallets
   - Batch into max 5 transfers per transaction
   - Verify all wallets received expected amounts
   - If any wallet underfunded, retry that specific transfer

   **Creating phase**:
   - Use `CreatorAgent` to create token on Pump.fun
   - Store mint address and bonding curve account
   - Verify token exists on-chain after creation
   - If creation fails, retry up to 3 times with new blockhash

   **Dev-buying phase**:
   - Execute dev buy (creator's initial purchase)
   - Use pre-calculated amount from plan
   - Verify tokens received in creator wallet

   **Bundling phase**:
   - Use `BundleCoordinator` for multi-wallet buys
   - If Jito available, submit as Jito bundle for same-slot execution
   - If not, submit transactions with optimal timing via `TimingEngine`
   - Validate bundle before submission via `BundleValidator`
   - Verify all expected token purchases completed

   **Distributing phase**:
   - Use `SupplyDistributor` to spread tokens across wallets
   - Apply anti-detection timing between transfers
   - Verify final distribution matches target percentages

   **Verifying phase**:
   - Check every wallet's SOL balance (sufficient for trading fees)
   - Check every wallet's token balance (matches expected)
   - Read bonding curve state to verify total purchases
   - Calculate actual supply percentage held by swarm

5. **LaunchResult**:
   ```typescript
   interface LaunchResult {
     success: boolean;
     planId: string;
     mint: string;                    // Token mint address
     bondingCurve: string;            // Bonding curve account
     phases: Array<{
       phase: LaunchPhase;
       startedAt: number;
       completedAt: number;
       duration: number;
       success: boolean;
       error?: string;
       retries: number;
     }>;
     walletResults: Array<{
       wallet: string;
       solBalance: number;
       tokenBalance: bigint;
       supplyPercent: number;
     }>;
     totalCost: {
       solSpent: number;
       feesLamports: bigint;
       jitoTipsLamports: bigint;
     };
     totalDuration: number;
     supplyControlled: number;        // Total % of supply held by swarm
   }
   ```

6. **Error recovery**:
   - Each phase has a retry count and backoff
   - Failed funding: retry specific wallet
   - Failed creation: retry with new keypair
   - Failed bundle: fall back to sequential buys
   - Failed distribution: mark which transfers succeeded, retry remainder
   - `retry(fromPhase)` allows resuming from any phase
   - `abort()` attempts to reclaim any funded SOL from wallets

7. **Cost estimation**:
   ```typescript
   interface LaunchCostEstimate {
     devBuyCost: number;              // SOL for dev buy
     bundleBuyCost: number;           // SOL for all bundle buys
     transactionFees: number;         // Base TX fees (lamports → SOL)
     priorityFees: number;            // Priority fees estimate
     jitoTips: number;                // Jito bundle tips
     totalSOLRequired: number;        // Grand total
     bufferPercent: number;           // Safety buffer applied
     totalWithBuffer: number;         // Total + buffer
   }
   ```

### Success Criteria

- Full state machine with clean phase transitions and event emissions
- Each phase has retry logic with configurable limits
- Cost estimation is accurate before execution
- Abort cleanly recovers funds from wallets
- Phase results are detailed enough for post-mortem analysis
- Compiles with `npx tsc --noEmit`
