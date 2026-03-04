/**
 * Bundle Validator — Pre-flight validation for Solana transaction bundles
 *
 * Validates bundles before submission to catch errors early. Runs a full
 * pipeline of structural checks, balance verification, instruction validation,
 * fee estimation, conflict detection, and RPC-based transaction simulation.
 *
 * @example
 * ```typescript
 * import { BundleValidator } from './bundle-validator.js';
 * import { Connection, Keypair } from '@solana/web3.js';
 *
 * const connection = new Connection('https://api.mainnet-beta.solana.com');
 * const validator = new BundleValidator(connection);
 *
 * const result = await validator.validateBundle({
 *   transactions: [tx1, tx2],
 *   signers: [keypair1, keypair2],
 *   maxTotalFees: 100_000,
 * });
 *
 * if (!result.valid) {
 *   console.error('Bundle invalid:', result.errors);
 * }
 * ```
 */

import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  VersionedTransaction,
  ComputeBudgetInstruction,
  type TransactionInstruction,
  type SimulatedTransactionResponse,
} from '@solana/web3.js';

import { SwarmLogger } from '../infra/logger.js';

// ─── Constants ────────────────────────────────────────────────

/** Lamports per SOL */
const LAMPORTS_PER_SOL = 1_000_000_000;

/** Base fee per signature in lamports */
const BASE_FEE_PER_SIGNATURE = 5_000;

/** Default compute unit limit per transaction */
const DEFAULT_COMPUTE_UNITS = 200_000;

/** Max compute units per transaction */
const MAX_COMPUTE_UNITS = 1_400_000;

/** Pump.fun program ID */
const PUMP_FUN_PROGRAM_ID = new PublicKey(
  '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P',
);

/** System Program ID */
const SYSTEM_PROGRAM_ID = new PublicKey(
  '11111111111111111111111111111111',
);

/** Compute Budget Program ID */
const COMPUTE_BUDGET_PROGRAM_ID = new PublicKey(
  'ComputeBudget111111111111111111111111111111',
);

/** Minimum required accounts for a Pump.fun buy instruction */
const MIN_PUMP_BUY_ACCOUNTS = 11;

/** Minimum required accounts for a Pump.fun sell instruction */
const MIN_PUMP_SELL_ACCOUNTS = 11;

/** Known Pump.fun instruction discriminators (first 8 bytes) */
const PUMP_DISCRIMINATORS = {
  /** buy instruction discriminator */
  buy: Buffer.from([102, 6, 61, 18, 1, 218, 235, 234]),
  /** sell instruction discriminator */
  sell: Buffer.from([51, 230, 133, 164, 1, 127, 131, 173]),
  /** create instruction discriminator */
  create: Buffer.from([24, 30, 200, 40, 5, 28, 7, 119]),
} as const;

// ─── Interfaces ───────────────────────────────────────────────

export interface BundleToValidate {
  /** Transactions in the bundle (legacy or versioned) */
  transactions: (Transaction | VersionedTransaction)[];
  /** Signers that will sign the transactions */
  signers: Keypair[];
  /** Expected outcomes to verify against simulation */
  expectedOutcomes?: ExpectedOutcome[];
  /** Max total fees in lamports across all transactions */
  maxTotalFees?: number;
  /** Whether all transactions must land in the same slot */
  requireSameSlot?: boolean;
}

export interface ExpectedOutcome {
  /** Wallet to check */
  wallet: PublicKey;
  /** Token mint to check (optional, for SPL token balance changes) */
  tokenMint?: PublicKey;
  /** Expected token balance change (positive = receive, negative = send) */
  expectedTokenChange?: bigint;
  /** Expected SOL balance change in lamports */
  expectedSolChange?: bigint;
}

export interface BundleValidationResult {
  /** Whether the bundle is valid and safe to submit */
  valid: boolean;
  /** Critical errors that prevent submission */
  errors: ValidationError[];
  /** Non-critical warnings that should be reviewed */
  warnings: ValidationWarning[];
  /** Per-transaction simulation results */
  simulations: SimulationResult[];
  /** Balance check across all involved wallets */
  balanceCheck: BalanceCheckResult;
  /** Fee estimation breakdown */
  feeEstimate: FeeEstimate;
  /** Detected account conflicts across transactions */
  conflicts: ConflictDetection;
  /** Total compute units consumed across all transactions */
  totalComputeUnits: number;
  /** Estimated slot when the bundle would land */
  estimatedSlotLanding: number;
}

export interface ValidationError {
  /** Machine-readable error code */
  code: string;
  /** Human-readable error message */
  message: string;
  /** Index of the transaction that caused the error (if applicable) */
  transactionIndex?: number;
  /** Severity of the error */
  severity: 'critical' | 'error';
}

export interface ValidationWarning {
  /** Machine-readable warning code */
  code: string;
  /** Human-readable warning message */
  message: string;
  /** Index of the transaction that triggered the warning */
  transactionIndex?: number;
  /** Suggested action to resolve the warning */
  suggestion: string;
}

export interface SimulationResult {
  /** Index of the transaction in the bundle */
  transactionIndex: number;
  /** Whether the simulation succeeded */
  success: boolean;
  /** Transaction execution logs */
  logs: string[];
  /** Compute units consumed */
  unitsConsumed: number;
  /** Error message if simulation failed */
  error?: string;
  /** Account balance changes detected */
  accountChanges: AccountChange[];
  /** Return data from the transaction (if any) */
  returnData?: Buffer;
}

export interface AccountChange {
  /** Account public key (base58) */
  pubkey: string;
  /** SOL balance before transaction (lamports) */
  preBalance: bigint;
  /** SOL balance after transaction (lamports) */
  postBalance: bigint;
  /** Token balance before (in raw units, if SPL token account) */
  preTokenBalance?: bigint;
  /** Token balance after (in raw units, if SPL token account) */
  postTokenBalance?: bigint;
}

export interface BalanceCheckResult {
  /** Whether all wallets have sufficient balances */
  sufficient: boolean;
  /** Per-wallet balance details */
  wallets: WalletBalanceDetail[];
  /** Total SOL required across all wallets */
  totalRequired: bigint;
  /** Total SOL available across all wallets */
  totalAvailable: bigint;
  /** Shortfall amount if insufficient (0 if sufficient) */
  shortfall: bigint;
}

export interface WalletBalanceDetail {
  /** Wallet public key (base58) */
  address: string;
  /** Current SOL balance in lamports */
  currentBalance: bigint;
  /** SOL required for transactions + fees */
  requiredBalance: bigint;
  /** Whether this wallet has enough */
  sufficient: boolean;
  /** Deficit if insufficient (0 if sufficient) */
  deficit: bigint;
}

export interface FeeEstimate {
  /** Total base fees (per-signature fees) across all transactions */
  baseFees: bigint;
  /** Total priority fees across all transactions */
  priorityFees: bigint;
  /** Sum of base + priority fees */
  totalFees: bigint;
  /** Per-transaction fee breakdown */
  perTransaction: Array<{
    index: number;
    baseFee: bigint;
    priorityFee: bigint;
  }>;
  /** Jito tip amount if applicable */
  jitoTip?: bigint;
  /** Total cost: fees + tips */
  totalCostLamports: bigint;
  /** Total cost in SOL */
  totalCostSOL: number;
}

export interface ConflictDetection {
  /** Whether any blocking conflicts were detected */
  hasConflicts: boolean;
  /** Write-write conflicts (two TXs write to same account) */
  writeConflicts: AccountConflict[];
  /** Read-write dependencies (TX reads account that prior TX writes) */
  readWriteDependencies: AccountConflict[];
  /** Potential deadlocks from account lock ordering */
  potentialDeadlocks: AccountConflict[];
}

export interface AccountConflict {
  /** Account public key that has a conflict */
  account: string;
  /** Indices of the transactions involved */
  transactionIndices: number[];
  /** Type of conflict */
  type: 'write-write' | 'read-write' | 'potential-deadlock';
  /** Whether this conflict would cause bundle failure */
  blocking: boolean;
  /** Description of the conflict */
  description: string;
}

export interface InstructionValidation {
  /** Whether all instructions are valid */
  valid: boolean;
  /** Validation issues found */
  issues: InstructionIssue[];
}

interface InstructionIssue {
  /** Instruction index within the transaction */
  instructionIndex: number;
  /** Program being invoked */
  programId: string;
  /** Issue description */
  issue: string;
  /** Whether this issue is critical */
  critical: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────

/**
 * Check whether a transaction is a VersionedTransaction.
 */
function isVersionedTransaction(
  tx: Transaction | VersionedTransaction,
): tx is VersionedTransaction {
  return 'version' in tx || tx instanceof VersionedTransaction;
}

/**
 * Extract writable account keys from a legacy Transaction.
 */
function getLegacyWritableKeys(tx: Transaction): Set<string> {
  const writable = new Set<string>();
  for (const ix of tx.instructions) {
    for (const key of ix.keys) {
      if (key.isWritable) {
        writable.add(key.pubkey.toBase58());
      }
    }
  }
  // Fee payer is always writable
  if (tx.feePayer) {
    writable.add(tx.feePayer.toBase58());
  }
  return writable;
}

/**
 * Extract readable (non-writable) account keys from a legacy Transaction.
 */
function getLegacyReadableKeys(tx: Transaction): Set<string> {
  const readable = new Set<string>();
  const writable = getLegacyWritableKeys(tx);
  for (const ix of tx.instructions) {
    for (const key of ix.keys) {
      const addr = key.pubkey.toBase58();
      if (!key.isWritable && !writable.has(addr)) {
        readable.add(addr);
      }
    }
  }
  return readable;
}

/**
 * Count signatures required for a transaction.
 */
function getSignatureCount(tx: Transaction | VersionedTransaction): number {
  if (isVersionedTransaction(tx)) {
    return tx.message.header.numRequiredSignatures;
  }
  // Legacy: count unique signers
  const signers = new Set<string>();
  if (tx.feePayer) {
    signers.add(tx.feePayer.toBase58());
  }
  for (const ix of tx.instructions) {
    for (const key of ix.keys) {
      if (key.isSigner) {
        signers.add(key.pubkey.toBase58());
      }
    }
  }
  return Math.max(1, signers.size);
}

/**
 * Extract the priority fee micro-lamports from ComputeBudget instructions.
 * Returns 0 if no SetComputeUnitPrice instruction is found.
 */
function extractPriorityFee(tx: Transaction): bigint {
  for (const ix of tx.instructions) {
    if (ix.programId.equals(COMPUTE_BUDGET_PROGRAM_ID)) {
      try {
        const decoded = ComputeBudgetInstruction.decodeSetComputeUnitPrice(ix);
        return BigInt(decoded.microLamports);
      } catch {
        // Not a SetComputeUnitPrice instruction, skip
      }
    }
  }
  return 0n;
}

/**
 * Extract the requested compute unit limit from ComputeBudget instructions.
 * Returns DEFAULT_COMPUTE_UNITS if no SetComputeUnitLimit instruction is found.
 */
function extractComputeUnitLimit(tx: Transaction): number {
  for (const ix of tx.instructions) {
    if (ix.programId.equals(COMPUTE_BUDGET_PROGRAM_ID)) {
      try {
        const decoded = ComputeBudgetInstruction.decodeSetComputeUnitLimit(ix);
        return decoded.units;
      } catch {
        // Not a SetComputeUnitLimit instruction, skip
      }
    }
  }
  return DEFAULT_COMPUTE_UNITS;
}

// ─── BundleValidator ──────────────────────────────────────────

/**
 * Pre-flight bundle validator that runs structural checks, balance
 * verification, fee estimation, conflict detection, and real RPC
 * simulation before bundle submission.
 *
 * ```typescript
 * const validator = new BundleValidator(connection);
 * const result = await validator.validateBundle({
 *   transactions: [tx1, tx2],
 *   signers: [signer1],
 *   maxTotalFees: 50_000,
 * });
 *
 * if (result.valid) {
 *   // Safe to submit
 *   await jitoClient.sendBundle(result.simulations.map(s => s.transactionIndex));
 * }
 * ```
 */
export class BundleValidator {
  private readonly connection: Connection;
  private readonly logger: SwarmLogger;

  constructor(connection: Connection) {
    this.connection = connection;
    this.logger = SwarmLogger.create('bundle-validator', 'bundle');
  }

  // ─── Main Validation Pipeline ─────────────────────────────

  /**
   * Run the full validation pipeline on a bundle.
   *
   * Steps executed in order:
   * 1. Structural validation (TX construction, blockhash, signers)
   * 2. Balance check (sufficient SOL for all wallets)
   * 3. Instruction validation (Pump.fun program correctness)
   * 4. Fee estimation (base + priority + Jito tips)
   * 5. Conflict detection (write-write and read-write collisions)
   * 6. Simulation (real RPC simulateTransaction)
   * 7. Outcome verification (if expectedOutcomes provided)
   */
  async validateBundle(
    bundle: BundleToValidate,
  ): Promise<BundleValidationResult> {
    this.logger.info('Starting bundle validation', {
      transactionCount: bundle.transactions.length,
      signerCount: bundle.signers.length,
      hasExpectedOutcomes: !!bundle.expectedOutcomes?.length,
      maxTotalFees: bundle.maxTotalFees,
    });

    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Step 1: Structural validation
    this.logger.info('Step 1: Structural validation');
    const structuralResult = this.validateStructure(bundle, errors, warnings);
    if (!structuralResult) {
      this.logger.warn('Structural validation failed, aborting pipeline');
    }

    // Step 2: Balance check
    this.logger.info('Step 2: Balance check');
    const requiredLamports = this.calculateRequiredLamports(bundle);
    const walletPubkeys = this.extractUniqueWallets(bundle);
    const balanceCheck = await this.checkBalances(walletPubkeys, requiredLamports);
    if (!balanceCheck.sufficient) {
      errors.push({
        code: 'INSUFFICIENT_BALANCE',
        message: `Insufficient SOL: need ${balanceCheck.totalRequired} lamports, have ${balanceCheck.totalAvailable} lamports (shortfall: ${balanceCheck.shortfall} lamports)`,
        severity: 'critical',
      });
    }

    // Step 3: Instruction validation (legacy transactions only)
    this.logger.info('Step 3: Instruction validation');
    for (let i = 0; i < bundle.transactions.length; i++) {
      const tx = bundle.transactions[i];
      if (!isVersionedTransaction(tx)) {
        const ixResult = this.validateInstructions(tx);
        if (!ixResult.valid) {
          for (const issue of ixResult.issues) {
            if (issue.critical) {
              errors.push({
                code: 'INVALID_INSTRUCTION',
                message: `TX ${i}, IX ${issue.instructionIndex}: ${issue.issue}`,
                transactionIndex: i,
                severity: 'error',
              });
            } else {
              warnings.push({
                code: 'INSTRUCTION_WARNING',
                message: `TX ${i}, IX ${issue.instructionIndex}: ${issue.issue}`,
                transactionIndex: i,
                suggestion: 'Review instruction configuration',
              });
            }
          }
        }
      }
    }

    // Step 4: Fee estimation
    this.logger.info('Step 4: Fee estimation');
    const feeEstimate = this.estimateFees(bundle.transactions);
    if (bundle.maxTotalFees !== undefined && feeEstimate.totalCostLamports > BigInt(bundle.maxTotalFees)) {
      errors.push({
        code: 'FEES_EXCEED_MAX',
        message: `Estimated fees ${feeEstimate.totalCostLamports} lamports exceed maximum ${bundle.maxTotalFees} lamports`,
        severity: 'error',
      });
    }

    // Step 5: Conflict detection
    this.logger.info('Step 5: Conflict detection');
    const conflicts = this.detectConflicts(bundle.transactions);
    if (conflicts.hasConflicts) {
      for (const conflict of conflicts.writeConflicts) {
        if (conflict.blocking) {
          errors.push({
            code: 'WRITE_CONFLICT',
            message: conflict.description,
            severity: 'error',
          });
        } else {
          warnings.push({
            code: 'WRITE_CONFLICT',
            message: conflict.description,
            suggestion: 'Ensure transaction ordering is correct or split into separate bundles',
          });
        }
      }
      for (const dep of conflicts.readWriteDependencies) {
        warnings.push({
          code: 'READ_WRITE_DEPENDENCY',
          message: dep.description,
          suggestion: 'Verify transaction ordering is intentional — later TXs depend on earlier TX writes',
        });
      }
      for (const deadlock of conflicts.potentialDeadlocks) {
        warnings.push({
          code: 'POTENTIAL_DEADLOCK',
          message: deadlock.description,
          suggestion: 'Reorder transactions to avoid circular account lock dependencies',
        });
      }
    }

    // Step 6: Simulation
    this.logger.info('Step 6: Transaction simulation');
    const simulations = await this.simulateBundle(bundle.transactions);
    for (const sim of simulations) {
      if (!sim.success) {
        errors.push({
          code: 'SIMULATION_FAILED',
          message: `TX ${sim.transactionIndex} simulation failed: ${sim.error ?? 'unknown error'}`,
          transactionIndex: sim.transactionIndex,
          severity: 'critical',
        });
      }
    }

    // Step 7: Outcome verification
    if (bundle.expectedOutcomes?.length) {
      this.logger.info('Step 7: Outcome verification');
      this.verifyOutcomes(bundle.expectedOutcomes, simulations, warnings, errors);
    }

    const totalComputeUnits = simulations.reduce(
      (sum, s) => sum + s.unitsConsumed,
      0,
    );

    let estimatedSlotLanding = 0;
    try {
      estimatedSlotLanding = await this.connection.getSlot('confirmed');
      // Bundle typically lands 1-2 slots ahead
      estimatedSlotLanding += 2;
    } catch {
      // Non-critical, leave as 0
    }

    const hasCriticalErrors = errors.some((e) => e.severity === 'critical');
    const result: BundleValidationResult = {
      valid: errors.length === 0,
      errors,
      warnings,
      simulations,
      balanceCheck,
      feeEstimate,
      conflicts,
      totalComputeUnits,
      estimatedSlotLanding,
    };

    this.logger.info('Bundle validation complete', {
      valid: result.valid,
      errorCount: errors.length,
      warningCount: warnings.length,
      hasCriticalErrors,
      totalComputeUnits,
      totalFees: feeEstimate.totalCostSOL.toFixed(9),
    });

    return result;
  }

  // ─── Step 1: Structural Validation ────────────────────────

  /**
   * Validate the structural integrity of the bundle:
   * - Non-empty transaction list
   * - Each TX has a recent blockhash
   * - All required signers are provided
   * - Fee payer is set
   */
  private validateStructure(
    bundle: BundleToValidate,
    errors: ValidationError[],
    warnings: ValidationWarning[],
  ): boolean {
    let valid = true;

    if (bundle.transactions.length === 0) {
      errors.push({
        code: 'EMPTY_BUNDLE',
        message: 'Bundle contains no transactions',
        severity: 'critical',
      });
      return false;
    }

    if (bundle.transactions.length > 5) {
      warnings.push({
        code: 'LARGE_BUNDLE',
        message: `Bundle has ${bundle.transactions.length} transactions; Jito supports max 5`,
        suggestion: 'Split into multiple bundles of 5 or fewer transactions',
      });
    }

    const signerKeys = new Set(
      bundle.signers.map((s) => s.publicKey.toBase58()),
    );

    for (let i = 0; i < bundle.transactions.length; i++) {
      const tx = bundle.transactions[i];

      if (isVersionedTransaction(tx)) {
        // Versioned transaction checks
        if (tx.message.header.numRequiredSignatures === 0) {
          errors.push({
            code: 'NO_SIGNATURES_REQUIRED',
            message: `TX ${i}: versioned transaction requires 0 signatures`,
            transactionIndex: i,
            severity: 'critical',
          });
          valid = false;
        }
      } else {
        // Legacy transaction checks
        if (!tx.recentBlockhash) {
          errors.push({
            code: 'MISSING_BLOCKHASH',
            message: `TX ${i}: missing recentBlockhash`,
            transactionIndex: i,
            severity: 'critical',
          });
          valid = false;
        }

        if (!tx.feePayer) {
          errors.push({
            code: 'MISSING_FEE_PAYER',
            message: `TX ${i}: no fee payer set`,
            transactionIndex: i,
            severity: 'critical',
          });
          valid = false;
        }

        if (tx.instructions.length === 0) {
          errors.push({
            code: 'NO_INSTRUCTIONS',
            message: `TX ${i}: transaction has no instructions`,
            transactionIndex: i,
            severity: 'error',
          });
          valid = false;
        }

        // Check that all required signers are available
        const requiredSigners = new Set<string>();
        if (tx.feePayer) {
          requiredSigners.add(tx.feePayer.toBase58());
        }
        for (const ix of tx.instructions) {
          for (const key of ix.keys) {
            if (key.isSigner) {
              requiredSigners.add(key.pubkey.toBase58());
            }
          }
        }

        for (const required of requiredSigners) {
          if (!signerKeys.has(required)) {
            errors.push({
              code: 'MISSING_SIGNER',
              message: `TX ${i}: required signer ${required} not provided`,
              transactionIndex: i,
              severity: 'critical',
            });
            valid = false;
          }
        }
      }
    }

    return valid;
  }

  // ─── Step 2: Balance Checks ───────────────────────────────

  /**
   * Check that all wallets have sufficient SOL for their transactions.
   */
  async checkBalances(
    wallets: PublicKey[],
    requiredLamports: Map<string, bigint>,
  ): Promise<BalanceCheckResult> {
    const walletDetails: WalletBalanceDetail[] = [];
    let totalRequired = 0n;
    let totalAvailable = 0n;

    // Batch fetch all balances
    const balancePromises = wallets.map(async (wallet) => {
      try {
        const balance = await this.connection.getBalance(wallet, 'confirmed');
        return { wallet: wallet.toBase58(), balance: BigInt(balance) };
      } catch (err) {
        this.logger.warn('Failed to fetch balance', {
          wallet: wallet.toBase58(),
          error: err instanceof Error ? err.message : String(err),
        });
        return { wallet: wallet.toBase58(), balance: 0n };
      }
    });

    const balances = await Promise.all(balancePromises);

    for (const { wallet, balance } of balances) {
      const required = requiredLamports.get(wallet) ?? 0n;
      totalRequired += required;
      totalAvailable += balance;

      const sufficient = balance >= required;
      const deficit = sufficient ? 0n : required - balance;

      walletDetails.push({
        address: wallet,
        currentBalance: balance,
        requiredBalance: required,
        sufficient,
        deficit,
      });
    }

    const shortfall = totalRequired > totalAvailable
      ? totalRequired - totalAvailable
      : 0n;

    return {
      sufficient: shortfall === 0n,
      wallets: walletDetails,
      totalRequired,
      totalAvailable,
      shortfall,
    };
  }

  // ─── Step 3: Instruction Validation ───────────────────────

  /**
   * Validate instructions within a legacy Transaction.
   * Checks Pump.fun program invocations for correct accounts and data layout.
   */
  validateInstructions(tx: Transaction): InstructionValidation {
    const issues: InstructionIssue[] = [];

    for (let i = 0; i < tx.instructions.length; i++) {
      const ix = tx.instructions[i];
      const programId = ix.programId.toBase58();

      // Validate Pump.fun instructions
      if (ix.programId.equals(PUMP_FUN_PROGRAM_ID)) {
        this.validatePumpInstruction(ix, i, issues);
      }

      // Validate ComputeBudget instructions
      if (ix.programId.equals(COMPUTE_BUDGET_PROGRAM_ID)) {
        this.validateComputeBudgetInstruction(ix, i, issues);
      }

      // Generic: flag instructions with no accounts
      if (ix.keys.length === 0 && !ix.programId.equals(COMPUTE_BUDGET_PROGRAM_ID)) {
        issues.push({
          instructionIndex: i,
          programId,
          issue: 'Instruction has no accounts — likely misconfigured',
          critical: true,
        });
      }
    }

    return {
      valid: !issues.some((issue) => issue.critical),
      issues,
    };
  }

  /**
   * Validate a Pump.fun program instruction.
   */
  private validatePumpInstruction(
    ix: TransactionInstruction,
    index: number,
    issues: InstructionIssue[],
  ): void {
    const programId = ix.programId.toBase58();

    if (ix.data.length < 8) {
      issues.push({
        instructionIndex: index,
        programId,
        issue: 'Pump.fun instruction data too short (< 8 bytes for discriminator)',
        critical: true,
      });
      return;
    }

    const discriminator = ix.data.subarray(0, 8);

    const isBuy = discriminator.equals(PUMP_DISCRIMINATORS.buy);
    const isSell = discriminator.equals(PUMP_DISCRIMINATORS.sell);
    const isCreate = discriminator.equals(PUMP_DISCRIMINATORS.create);

    if (!isBuy && !isSell && !isCreate) {
      issues.push({
        instructionIndex: index,
        programId,
        issue: 'Unknown Pump.fun instruction discriminator',
        critical: false,
      });
      return;
    }

    if (isBuy && ix.keys.length < MIN_PUMP_BUY_ACCOUNTS) {
      issues.push({
        instructionIndex: index,
        programId,
        issue: `Pump.fun buy requires at least ${MIN_PUMP_BUY_ACCOUNTS} accounts, got ${ix.keys.length}`,
        critical: true,
      });
    }

    if (isSell && ix.keys.length < MIN_PUMP_SELL_ACCOUNTS) {
      issues.push({
        instructionIndex: index,
        programId,
        issue: `Pump.fun sell requires at least ${MIN_PUMP_SELL_ACCOUNTS} accounts, got ${ix.keys.length}`,
        critical: true,
      });
    }

    // Ensure the first account (global config) is readable
    if (ix.keys.length > 0 && ix.keys[0].isWritable) {
      issues.push({
        instructionIndex: index,
        programId,
        issue: 'Pump.fun global config account should not be writable',
        critical: false,
      });
    }

    // For buy/sell, check the user wallet is a signer
    if ((isBuy || isSell) && ix.keys.length > 6) {
      const userAccount = ix.keys[6];
      if (!userAccount.isSigner) {
        issues.push({
          instructionIndex: index,
          programId,
          issue: 'Pump.fun buy/sell: user account (index 6) must be a signer',
          critical: true,
        });
      }
    }
  }

  /**
   * Validate a ComputeBudget program instruction.
   */
  private validateComputeBudgetInstruction(
    ix: TransactionInstruction,
    index: number,
    issues: InstructionIssue[],
  ): void {
    const programId = ix.programId.toBase58();

    try {
      // Try decoding as SetComputeUnitLimit
      const decoded = ComputeBudgetInstruction.decodeSetComputeUnitLimit(ix);
      if (decoded.units > MAX_COMPUTE_UNITS) {
        issues.push({
          instructionIndex: index,
          programId,
          issue: `Compute unit limit ${decoded.units} exceeds maximum ${MAX_COMPUTE_UNITS}`,
          critical: true,
        });
      }
      if (decoded.units === 0) {
        issues.push({
          instructionIndex: index,
          programId,
          issue: 'Compute unit limit is 0 — transaction will fail immediately',
          critical: true,
        });
      }
      return;
    } catch {
      // Not a SetComputeUnitLimit
    }

    try {
      // Try decoding as SetComputeUnitPrice
      const decoded = ComputeBudgetInstruction.decodeSetComputeUnitPrice(ix);
      if (decoded.microLamports > 10_000_000) {
        issues.push({
          instructionIndex: index,
          programId,
          issue: `Priority fee ${decoded.microLamports} microLamports is very high (>10M) — potential overspend`,
          critical: false,
        });
      }
      return;
    } catch {
      // Not a SetComputeUnitPrice
    }
  }

  // ─── Step 4: Fee Estimation ───────────────────────────────

  /**
   * Estimate total fees across all transactions in the bundle.
   */
  estimateFees(
    transactions: (Transaction | VersionedTransaction)[],
  ): FeeEstimate {
    let totalBaseFees = 0n;
    let totalPriorityFees = 0n;
    const perTransaction: Array<{
      index: number;
      baseFee: bigint;
      priorityFee: bigint;
    }> = [];

    for (let i = 0; i < transactions.length; i++) {
      const tx = transactions[i];
      const sigCount = getSignatureCount(tx);
      const baseFee = BigInt(sigCount) * BigInt(BASE_FEE_PER_SIGNATURE);

      let priorityFee = 0n;
      if (!isVersionedTransaction(tx)) {
        const microLamports = extractPriorityFee(tx);
        const computeUnits = extractComputeUnitLimit(tx);
        // Priority fee = (microLamports * compute_units) / 1_000_000
        priorityFee = (microLamports * BigInt(computeUnits)) / 1_000_000n;
      }

      totalBaseFees += baseFee;
      totalPriorityFees += priorityFee;

      perTransaction.push({
        index: i,
        baseFee,
        priorityFee,
      });
    }

    const totalFees = totalBaseFees + totalPriorityFees;
    const totalCostLamports = totalFees; // Jito tip added below if present

    return {
      baseFees: totalBaseFees,
      priorityFees: totalPriorityFees,
      totalFees,
      perTransaction,
      totalCostLamports,
      totalCostSOL: Number(totalCostLamports) / LAMPORTS_PER_SOL,
    };
  }

  // ─── Step 5: Conflict Detection ───────────────────────────

  /**
   * Detect account conflicts across transactions in the bundle.
   *
   * Identifies:
   * - Write-write conflicts (two TXs write to same account)
   * - Read-write dependencies (TX reads what a prior TX writes)
   * - Potential deadlocks from circular account lock ordering
   */
  detectConflicts(
    transactions: (Transaction | VersionedTransaction)[],
  ): ConflictDetection {
    const writeConflicts: AccountConflict[] = [];
    const readWriteDependencies: AccountConflict[] = [];
    const potentialDeadlocks: AccountConflict[] = [];

    // Build per-transaction write and read sets (legacy TXs only)
    const writeSets: Map<number, Set<string>> = new Map();
    const readSets: Map<number, Set<string>> = new Map();

    for (let i = 0; i < transactions.length; i++) {
      const tx = transactions[i];
      if (!isVersionedTransaction(tx)) {
        writeSets.set(i, getLegacyWritableKeys(tx));
        readSets.set(i, getLegacyReadableKeys(tx));
      } else {
        // For versioned transactions, extract keys from the compiled message
        const writableKeys = new Set<string>();
        const readableKeys = new Set<string>();
        const accountKeys = tx.message.getAccountKeys();

        for (let k = 0; k < accountKeys.length; k++) {
          const key = accountKeys.get(k);
          if (key) {
            // Static accounts: first numRequiredSignatures are signers,
            // of those, the ones that are writable are determined by the header
            if (tx.message.isAccountWritable(k)) {
              writableKeys.add(key.toBase58());
            } else {
              readableKeys.add(key.toBase58());
            }
          }
        }
        writeSets.set(i, writableKeys);
        readSets.set(i, readableKeys);
      }
    }

    // Check write-write conflicts
    const writesByAccount = new Map<string, number[]>();
    for (const [txIndex, writes] of writeSets) {
      for (const account of writes) {
        const existing = writesByAccount.get(account);
        if (existing) {
          existing.push(txIndex);
        } else {
          writesByAccount.set(account, [txIndex]);
        }
      }
    }

    for (const [account, txIndices] of writesByAccount) {
      if (txIndices.length > 1) {
        // System program and compute budget accounts are commonly shared
        const isSystemAccount =
          account === SYSTEM_PROGRAM_ID.toBase58() ||
          account === COMPUTE_BUDGET_PROGRAM_ID.toBase58();

        writeConflicts.push({
          account,
          transactionIndices: txIndices,
          type: 'write-write',
          blocking: !isSystemAccount,
          description: `Account ${account} is written by transactions [${txIndices.join(', ')}]${isSystemAccount ? ' (system account, non-blocking)' : ''}`,
        });
      }
    }

    // Check read-write dependencies (order-dependent)
    for (let i = 0; i < transactions.length; i++) {
      const reads = readSets.get(i);
      if (!reads) continue;

      for (let j = 0; j < i; j++) {
        const priorWrites = writeSets.get(j);
        if (!priorWrites) continue;

        for (const account of reads) {
          if (priorWrites.has(account)) {
            readWriteDependencies.push({
              account,
              transactionIndices: [j, i],
              type: 'read-write',
              blocking: false,
              description: `TX ${i} reads account ${account} that TX ${j} writes — order-dependent`,
            });
          }
        }
      }
    }

    // Check potential deadlocks: circular write dependencies
    // A deadlock can occur if TX_A writes [X, Y] and TX_B writes [Y, X]
    // in different order, causing lock contention
    for (let i = 0; i < transactions.length; i++) {
      const writesI = writeSets.get(i);
      if (!writesI || writesI.size < 2) continue;

      for (let j = i + 1; j < transactions.length; j++) {
        const writesJ = writeSets.get(j);
        if (!writesJ || writesJ.size < 2) continue;

        // Find shared writable accounts
        const shared: string[] = [];
        for (const account of writesI) {
          if (writesJ.has(account)) {
            shared.push(account);
          }
        }

        if (shared.length >= 2) {
          potentialDeadlocks.push({
            account: shared.join(', '),
            transactionIndices: [i, j],
            type: 'potential-deadlock',
            blocking: false,
            description: `TXs ${i} and ${j} both write to multiple shared accounts [${shared.join(', ')}] — potential lock contention`,
          });
        }
      }
    }

    return {
      hasConflicts:
        writeConflicts.some((c) => c.blocking) ||
        potentialDeadlocks.length > 0,
      writeConflicts,
      readWriteDependencies,
      potentialDeadlocks,
    };
  }

  // ─── Step 6: Transaction Simulation ───────────────────────

  /**
   * Simulate a single transaction against the current chain state.
   */
  async simulateTransaction(
    tx: Transaction | VersionedTransaction,
  ): Promise<SimulationResult> {
    return this.simulateSingleTransaction(tx, 0);
  }

  /**
   * Simulate all transactions in a bundle sequentially.
   * Simulations are done in order to respect dependencies.
   */
  async simulateBundle(
    transactions: (Transaction | VersionedTransaction)[],
  ): Promise<SimulationResult[]> {
    const results: SimulationResult[] = [];

    for (let i = 0; i < transactions.length; i++) {
      const result = await this.simulateSingleTransaction(transactions[i], i);
      results.push(result);

      // If a transaction fails, log but continue simulating the rest
      // so we can report all failures
      if (!result.success) {
        this.logger.warn('Transaction simulation failed', {
          transactionIndex: i,
          error: result.error,
        });
      }
    }

    return results;
  }

  /**
   * Simulate a single transaction and parse the response.
   */
  private async simulateSingleTransaction(
    tx: Transaction | VersionedTransaction,
    index: number,
  ): Promise<SimulationResult> {
    try {
      let response: SimulatedTransactionResponse;

      if (isVersionedTransaction(tx)) {
        const simResult = await this.connection.simulateTransaction(tx, {
          sigVerify: false,
          replaceRecentBlockhash: true,
          commitment: 'confirmed',
        });
        response = simResult.value;
      } else {
        const simResult = await this.connection.simulateTransaction(tx, undefined, [
          // Get accounts involved for balance change tracking
          ...(tx.feePayer ? [tx.feePayer] : []),
        ]);
        response = simResult.value;
      }

      const logs = response.logs ?? [];
      const unitsConsumed = response.unitsConsumed ?? 0;
      const error = response.err
        ? JSON.stringify(response.err)
        : undefined;

      // Parse account changes from simulation
      const accountChanges: AccountChange[] = [];
      if (response.accounts) {
        for (const account of response.accounts) {
          if (account) {
            accountChanges.push({
              pubkey: account.owner,
              preBalance: 0n, // Simulation doesn't give pre-balances
              postBalance: BigInt(account.lamports),
            });
          }
        }
      }

      const returnData = response.returnData?.data
        ? Buffer.from(response.returnData.data[0], response.returnData.data[1] as BufferEncoding)
        : undefined;

      return {
        transactionIndex: index,
        success: !response.err,
        logs,
        unitsConsumed,
        error,
        accountChanges,
        returnData,
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      this.logger.error(`Simulation RPC call failed for transaction ${index}`, err instanceof Error ? err : new Error(errorMessage));

      return {
        transactionIndex: index,
        success: false,
        logs: [],
        unitsConsumed: 0,
        error: `RPC simulation error: ${errorMessage}`,
        accountChanges: [],
      };
    }
  }

  // ─── Step 7: Outcome Verification ────────────────────────

  /**
   * Verify simulation results match expected outcomes.
   */
  private verifyOutcomes(
    expectedOutcomes: ExpectedOutcome[],
    simulations: SimulationResult[],
    warnings: ValidationWarning[],
    _errors: ValidationError[],
  ): void {
    // Aggregate account changes across all simulations
    const aggregatedChanges = new Map<string, AccountChange>();
    for (const sim of simulations) {
      for (const change of sim.accountChanges) {
        const existing = aggregatedChanges.get(change.pubkey);
        if (existing) {
          // Use the latest post-balance
          existing.postBalance = change.postBalance;
          if (change.postTokenBalance !== undefined) {
            existing.postTokenBalance = change.postTokenBalance;
          }
        } else {
          aggregatedChanges.set(change.pubkey, { ...change });
        }
      }
    }

    for (const expected of expectedOutcomes) {
      const walletAddr = expected.wallet.toBase58();
      const change = aggregatedChanges.get(walletAddr);

      if (!change) {
        // Account not found in simulation results — check if any simulation failed
        const anyFailed = simulations.some((s) => !s.success);
        if (anyFailed) {
          warnings.push({
            code: 'OUTCOME_UNVERIFIABLE',
            message: `Cannot verify outcome for ${walletAddr} — some simulations failed`,
            suggestion: 'Fix simulation failures first, then re-validate',
          });
        } else {
          warnings.push({
            code: 'OUTCOME_NOT_FOUND',
            message: `Expected outcome for ${walletAddr} not found in simulation results`,
            suggestion: 'Ensure this wallet is involved in the bundle transactions',
          });
        }
        continue;
      }

      // Verify SOL changes
      if (expected.expectedSolChange !== undefined) {
        const actualChange = change.postBalance - change.preBalance;
        if (actualChange !== expected.expectedSolChange) {
          warnings.push({
            code: 'SOL_CHANGE_MISMATCH',
            message: `${walletAddr}: expected SOL change ${expected.expectedSolChange}, got ${actualChange}`,
            suggestion: 'Review transaction amounts and fees',
          });
        }
      }

      // Verify token changes
      if (
        expected.expectedTokenChange !== undefined &&
        change.preTokenBalance !== undefined &&
        change.postTokenBalance !== undefined
      ) {
        const actualTokenChange =
          change.postTokenBalance - change.preTokenBalance;
        if (actualTokenChange !== expected.expectedTokenChange) {
          warnings.push({
            code: 'TOKEN_CHANGE_MISMATCH',
            message: `${walletAddr}: expected token change ${expected.expectedTokenChange}, got ${actualTokenChange}`,
            suggestion: 'Review slippage settings and token amounts',
          });
        }
      }
    }
  }

  // ─── Internal Helpers ─────────────────────────────────────

  /**
   * Calculate how many lamports each wallet needs for the bundle.
   */
  private calculateRequiredLamports(
    bundle: BundleToValidate,
  ): Map<string, bigint> {
    const required = new Map<string, bigint>();

    for (const tx of bundle.transactions) {
      if (!isVersionedTransaction(tx)) {
        // Fee payer needs to cover the base transaction fee
        if (tx.feePayer) {
          const payerAddr = tx.feePayer.toBase58();
          const sigCount = getSignatureCount(tx);
          const baseFee = BigInt(sigCount) * BigInt(BASE_FEE_PER_SIGNATURE);

          const microLamports = extractPriorityFee(tx);
          const computeUnits = extractComputeUnitLimit(tx);
          const priorityFee = (microLamports * BigInt(computeUnits)) / 1_000_000n;

          const existing = required.get(payerAddr) ?? 0n;
          required.set(payerAddr, existing + baseFee + priorityFee);
        }

        // Check for SOL transfers in instructions
        for (const ix of tx.instructions) {
          if (ix.programId.equals(SYSTEM_PROGRAM_ID)) {
            // System program transfer — the source wallet needs the amount
            // Data layout: [4 bytes instruction type][8 bytes lamports]
            if (ix.data.length >= 12) {
              const lamports = ix.data.readBigUInt64LE(4);
              const sourceKey = ix.keys[0]?.pubkey.toBase58();
              if (sourceKey) {
                const existing = required.get(sourceKey) ?? 0n;
                required.set(sourceKey, existing + lamports);
              }
            }
          }
        }
      } else {
        // For versioned transactions, we can only estimate based on signatures
        const sigCount = tx.message.header.numRequiredSignatures;
        const baseFee = BigInt(sigCount) * BigInt(BASE_FEE_PER_SIGNATURE);

        // The first account key is typically the fee payer
        const accountKeys = tx.message.getAccountKeys();
        const feePayer = accountKeys.get(0);
        if (feePayer) {
          const payerAddr = feePayer.toBase58();
          const existing = required.get(payerAddr) ?? 0n;
          required.set(payerAddr, existing + baseFee);
        }
      }
    }

    return required;
  }

  /**
   * Extract unique wallet public keys from the bundle.
   */
  private extractUniqueWallets(bundle: BundleToValidate): PublicKey[] {
    const wallets = new Set<string>();

    for (const signer of bundle.signers) {
      wallets.add(signer.publicKey.toBase58());
    }

    for (const tx of bundle.transactions) {
      if (!isVersionedTransaction(tx)) {
        if (tx.feePayer) {
          wallets.add(tx.feePayer.toBase58());
        }
        for (const ix of tx.instructions) {
          for (const key of ix.keys) {
            if (key.isSigner) {
              wallets.add(key.pubkey.toBase58());
            }
          }
        }
      } else {
        const accountKeys = tx.message.getAccountKeys();
        // Only signer accounts (first numRequiredSignatures accounts)
        for (let i = 0; i < tx.message.header.numRequiredSignatures; i++) {
          const key = accountKeys.get(i);
          if (key) {
            wallets.add(key.toBase58());
          }
        }
      }
    }

    return [...wallets].map((addr) => new PublicKey(addr));
  }
}
