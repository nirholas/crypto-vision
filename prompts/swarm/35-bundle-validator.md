# Prompt 35 — Bundle Validator

## Agent Identity & Rules

```
You are the BUNDLE-VALIDATOR builder.

RULES:
- Work on current branch (main), commit as nirholas
- Always use isBackground: true for terminals, always kill_terminal after
- No mocks — real Solana transaction simulation via RPC
- TypeScript strict mode, run npx tsc --noEmit after changes
- Commit message: "feat(swarm): add pre-flight bundle validation with transaction simulation"
```

## Objective

Create `packages/pump-agent-swarm/src/bundle/bundle-validator.ts` — validates bundles before submission to catch errors early. Simulates transactions, checks balances, verifies instructions, estimates fees, and detects conflicts.

## File Ownership

- **Creates**: `packages/pump-agent-swarm/src/bundle/bundle-validator.ts`

## Dependencies

- `@solana/web3.js` — `Connection`, `Transaction`, `VersionedTransaction`, `simulateTransaction`
- `infra/rpc-pool.ts` — `RPCConnectionPool`
- `infra/logger.ts` — structured logging

## Deliverables

### Create `packages/pump-agent-swarm/src/bundle/bundle-validator.ts`

1. **`BundleValidator` class**:
   - `constructor(connection: Connection)`
   - `validateBundle(bundle: BundleToValidate): Promise<BundleValidationResult>`
   - `simulateTransaction(tx: Transaction | VersionedTransaction): Promise<SimulationResult>`
   - `simulateBundle(transactions: (Transaction | VersionedTransaction)[]): Promise<SimulationResult[]>`
   - `checkBalances(wallets: PublicKey[], requiredLamports: Map<string, bigint>): Promise<BalanceCheckResult>`
   - `estimateFees(transactions: (Transaction | VersionedTransaction)[]): Promise<FeeEstimate>`
   - `detectConflicts(transactions: (Transaction | VersionedTransaction)[]): ConflictDetection`
   - `validateInstructions(tx: Transaction): InstructionValidation`

2. **BundleToValidate**:
   ```typescript
   interface BundleToValidate {
     transactions: (Transaction | VersionedTransaction)[];
     signers: Keypair[];
     expectedOutcomes?: ExpectedOutcome[];
     maxTotalFees?: number;    // Max total fees in lamports
     requireSameSlot?: boolean;
   }

   interface ExpectedOutcome {
     wallet: PublicKey;
     tokenMint?: PublicKey;
     expectedTokenChange?: bigint;   // Positive = receive, negative = send
     expectedSolChange?: bigint;     // In lamports
   }
   ```

3. **Full validation pipeline** (executed in order):
   - **Step 1: Structural validation** — check all TXs are properly constructed, have correct recent blockhash, all required signers are present
   - **Step 2: Balance check** — ensure all source wallets have sufficient SOL for the transactions + fees
   - **Step 3: Instruction validation** — verify Pump.fun program invocations have correct accounts and data
   - **Step 4: Fee estimation** — calculate total priority fees + base fees across all TXs
   - **Step 5: Conflict detection** — check for conflicting writes to same accounts across TXs
   - **Step 6: Simulation** — simulate each TX via `connection.simulateTransaction()` against current chain state
   - **Step 7: Outcome verification** — if expected outcomes provided, verify simulation results match

4. **BundleValidationResult**:
   ```typescript
   interface BundleValidationResult {
     valid: boolean;
     errors: ValidationError[];
     warnings: ValidationWarning[];
     simulations: SimulationResult[];
     balanceCheck: BalanceCheckResult;
     feeEstimate: FeeEstimate;
     conflicts: ConflictDetection;
     totalComputeUnits: number;
     estimatedSlotLanding: number;
   }

   interface ValidationError {
     code: string;
     message: string;
     transactionIndex?: number;
     severity: 'critical' | 'error';
   }

   interface ValidationWarning {
     code: string;
     message: string;
     transactionIndex?: number;
     suggestion: string;
   }
   ```

5. **SimulationResult**:
   ```typescript
   interface SimulationResult {
     transactionIndex: number;
     success: boolean;
     logs: string[];
     unitsConsumed: number;
     error?: string;
     accountChanges: AccountChange[];
     returnData?: Buffer;
   }

   interface AccountChange {
     pubkey: string;
     preBalance: bigint;
     postBalance: bigint;
     preTokenBalance?: bigint;
     postTokenBalance?: bigint;
   }
   ```

6. **Conflict detection**:
   - Detect when two TXs in the same bundle write to the same account
   - Detect when a TX reads an account that a previous TX in the bundle writes to (order-dependent)
   - Flag if any TXs could deadlock on account locks
   - Mark conflicts as errors only if they would cause bundle failure; order-dependent reads are warnings

7. **Fee estimation**:
   ```typescript
   interface FeeEstimate {
     baseFees: bigint;
     priorityFees: bigint;
     totalFees: bigint;
     perTransaction: Array<{ index: number; baseFee: bigint; priorityFee: bigint }>;
     jitoTip?: bigint;
     totalCostLamports: bigint;  // Total: fees + tips
     totalCostSOL: number;
   }
   ```

### Success Criteria

- Full validation pipeline catches structural errors before submission
- Transaction simulation uses real `connection.simulateTransaction()`
- Balance checks prevent insufficient-funds failures
- Conflict detection identifies same-account write collisions
- Fee estimates are accurate for budget planning
- Compiles with `npx tsc --noEmit`
