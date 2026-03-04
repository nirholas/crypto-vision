# Prompt 38 — Wallet Funder

## Agent Identity & Rules

```
You are the WALLET-FUNDER builder.

RULES:
- Work on current branch (main), commit as nirholas
- Always use isBackground: true for terminals, always kill_terminal after
- No mocks — real Solana transfers
- TypeScript strict mode, run npx tsc --noEmit after changes
- Commit message: "feat(swarm): add multi-wallet batch funding coordinator"
```

## Objective

Create `packages/pump-agent-swarm/src/bundle/wallet-funder.ts` — coordinates funding multiple agent wallets from a master wallet. Batches transfers efficiently, handles partial failures, and verifies all wallets are properly funded before proceeding.

## File Ownership

- **Creates**: `packages/pump-agent-swarm/src/bundle/wallet-funder.ts`

## Dependencies

- `@solana/web3.js` — `Connection`, `SystemProgram`, `Transaction`, `sendAndConfirmTransaction`
- `wallet-manager.ts` or `infra/wallet-vault.ts` — wallet access
- `infra/event-bus.ts` — `SwarmEventBus`
- `infra/logger.ts` — structured logging
- `bundle/anti-detection.ts` — `AntiDetection` (optional, for randomizing amounts)

## Deliverables

### Create `packages/pump-agent-swarm/src/bundle/wallet-funder.ts`

1. **`WalletFunder` class**:
   - `constructor(connection: Connection, eventBus: SwarmEventBus, config?: WalletFunderConfig)`
   - `fundWallets(master: Keypair, targets: FundingTarget[]): Promise<FundingResult>`
   - `fundWallet(master: Keypair, target: PublicKey, lamports: bigint): Promise<FundingTransferResult>`
   - `batchFund(master: Keypair, targets: FundingTarget[], batchSize?: number): Promise<FundingResult>`
   - `verifyFunding(targets: FundingTarget[]): Promise<FundingVerification>`
   - `reclaimAll(wallets: Keypair[], master: PublicKey): Promise<ReclaimResult>`
   - `reclaimWallet(wallet: Keypair, master: PublicKey): Promise<FundingTransferResult>`
   - `estimateFundingCost(targets: FundingTarget[]): FundingCostEstimate`
   - `getMasterBalance(master: PublicKey): Promise<bigint>`

2. **FundingTarget**:
   ```typescript
   interface FundingTarget {
     wallet: PublicKey;
     amountLamports: bigint;
     /** Optional: role determines priority (creators get funded first) */
     role?: 'creator' | 'bundler' | 'trader' | 'holder';
     /** Optional: label for logging */
     label?: string;
   }

   interface WalletFunderConfig {
     /** Max transfers per transaction (Solana limit ~20 for simple transfers) */
     maxTransfersPerTx: number;
     /** Confirmation commitment level */
     commitment: 'processed' | 'confirmed' | 'finalized';
     /** Max retries per transfer */
     maxRetries: number;
     /** Delay between batches (ms) for anti-detection */
     batchDelay: number;
     /** Whether to randomize amounts slightly for anti-detection */
     randomizeAmounts: boolean;
     /** Variance percentage if randomizing (e.g., 5 = ±5%) */
     randomVariance: number;
     /** Leave this many lamports as rent-exempt minimum in funded wallets */
     rentExemptMinimum: bigint;
     /** Minimum SOL to keep in master wallet after funding */
     masterReserve: bigint;
   }
   ```

3. **Batch funding logic**:
   - Group transfers into batches of N (configurable, default 10 per TX)
   - Each batch is one transaction with multiple `SystemProgram.transfer` instructions
   - Sort targets by role priority: creator → bundler → trader → holder
   - Between batches, apply configurable delay (anti-detection)
   - If `randomizeAmounts` is enabled, apply ±variance to each amount
   - Track which transfers succeeded and which failed per batch

4. **FundingResult**:
   ```typescript
   interface FundingResult {
     success: boolean;
     totalFunded: bigint;            // Total lamports actually transferred
     totalTargeted: bigint;          // Total lamports requested
     walletsFullyFunded: number;
     walletsFailed: number;
     transfers: FundingTransferResult[];
     batches: Array<{
       batchIndex: number;
       signature: string;
       transfers: number;
       success: boolean;
       error?: string;
     }>;
     duration: number;
     masterBalanceBefore: bigint;
     masterBalanceAfter: bigint;
   }

   interface FundingTransferResult {
     wallet: string;
     targetAmount: bigint;
     actualAmount: bigint;
     success: boolean;
     signature?: string;
     error?: string;
     retries: number;
   }
   ```

5. **Verification**:
   ```typescript
   interface FundingVerification {
     allFunded: boolean;
     wallets: Array<{
       wallet: string;
       expectedBalance: bigint;
       actualBalance: bigint;
       funded: boolean;
       shortfall: bigint;           // 0 if fully funded
     }>;
     totalShortfall: bigint;
   }
   ```
   - After funding, verify every wallet has expected balance via `getMultipleAccountsInfo`
   - Batch balance checks in groups of 100 (RPC limit)
   - Report shortfalls for retry

6. **Fund reclamation**:
   - Sweep SOL from all agent wallets back to master
   - Leave rent-exempt minimum (0.00089 SOL) in each wallet
   - Also sweep any remaining token accounts if present (close token accounts)
   - Batch reclaim transactions similar to funding
   - Report total reclaimed

7. **Cost estimation**:
   ```typescript
   interface FundingCostEstimate {
     totalTransferAmount: bigint;    // Sum of all target amounts
     transactionFees: bigint;        // Estimated fees for all batches
     numberOfBatches: number;
     numberOfTransactions: number;
     totalCost: bigint;              // transfers + fees
     masterBalanceRequired: bigint;  // totalCost + masterReserve
   }
   ```

### Success Criteria

- Batch funding correctly groups transfers and sends real transactions
- Partial failures are tracked and can be retried
- Verification accurately checks all wallet balances
- Reclamation properly sweeps funds back to master
- Anti-detection amount randomization works when enabled
- Cost estimation is accurate before execution
- Compiles with `npx tsc --noEmit`
