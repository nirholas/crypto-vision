/**
 * Wallet Funder — Multi-wallet batch funding coordinator
 *
 * Coordinates funding multiple agent wallets from a master wallet.
 * Batches transfers efficiently via multi-instruction transactions,
 * handles partial failures with per-transfer tracking, verifies
 * all wallets are properly funded, and supports reclamation.
 *
 * Features:
 * - Batch SOL transfers (configurable instructions per TX)
 * - Role-based priority ordering (creator → bundler → trader → holder)
 * - Anti-detection amount randomization with configurable variance
 * - Post-funding balance verification via getMultipleAccountsInfo
 * - Fund reclamation (sweep SOL + close token accounts)
 * - Pre-execution cost estimation
 * - Partial failure tracking with retry support
 */

import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  getAccount,
  createCloseAccountInstruction,
} from '@solana/spl-token';
import { v4 as uuidv4 } from 'uuid';

import { SwarmEventBus } from '../infra/event-bus.js';
import { SwarmLogger } from '../infra/logger.js';

// ─── Types ────────────────────────────────────────────────────

export type FundingRole = 'creator' | 'bundler' | 'trader' | 'holder';

export interface FundingTarget {
  wallet: PublicKey;
  amountLamports: bigint;
  /** Optional: role determines priority (creators get funded first) */
  role?: FundingRole;
  /** Optional: label for logging */
  label?: string;
}

export interface WalletFunderConfig {
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

export interface FundingResult {
  success: boolean;
  totalFunded: bigint;
  totalTargeted: bigint;
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

export interface FundingTransferResult {
  wallet: string;
  targetAmount: bigint;
  actualAmount: bigint;
  success: boolean;
  signature?: string;
  error?: string;
  retries: number;
}

export interface FundingVerification {
  allFunded: boolean;
  wallets: Array<{
    wallet: string;
    expectedBalance: bigint;
    actualBalance: bigint;
    funded: boolean;
    shortfall: bigint;
  }>;
  totalShortfall: bigint;
}

export interface FundingCostEstimate {
  totalTransferAmount: bigint;
  transactionFees: bigint;
  numberOfBatches: number;
  numberOfTransactions: number;
  totalCost: bigint;
  masterBalanceRequired: bigint;
}

export interface ReclaimResult {
  success: boolean;
  totalReclaimed: bigint;
  walletsReclaimed: number;
  walletsFailed: number;
  tokenAccountsClosed: number;
  transfers: FundingTransferResult[];
  batches: Array<{
    batchIndex: number;
    signature: string;
    transfers: number;
    success: boolean;
    error?: string;
  }>;
  duration: number;
}

// ─── Constants ────────────────────────────────────────────────

/** Minimum rent-exempt balance for a system account (~0.00089 SOL) */
const DEFAULT_RENT_EXEMPT_LAMPORTS = 890_880n;

/** Estimated fee per transaction signature (5000 lamports) */
const ESTIMATED_FEE_PER_TX = 5_000n;

/** Max accounts fetchable in a single getMultipleAccountsInfo call */
const MAX_ACCOUNTS_PER_BATCH = 100;

/** Role priority order (lower index = higher priority) */
const ROLE_PRIORITY: Record<FundingRole, number> = {
  creator: 0,
  bundler: 1,
  trader: 2,
  holder: 3,
};

/** Default funder configuration */
const DEFAULT_CONFIG: WalletFunderConfig = {
  maxTransfersPerTx: 10,
  commitment: 'confirmed',
  maxRetries: 3,
  batchDelay: 1_000,
  randomizeAmounts: false,
  randomVariance: 5,
  rentExemptMinimum: DEFAULT_RENT_EXEMPT_LAMPORTS,
  masterReserve: 50_000_000n, // 0.05 SOL
};

// ─── Helpers ──────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Apply ±variance% randomization to an amount.
 * E.g. variance=5 → amount adjusted by up to ±5%.
 */
function randomizeAmount(amount: bigint, variancePercent: number): bigint {
  if (variancePercent <= 0) return amount;
  const deviation = (Math.random() * 2 - 1) * (variancePercent / 100);
  const multiplier = 1 + deviation;
  const result = BigInt(Math.round(Number(amount) * multiplier));
  // Never go below 1 lamport
  return result < 1n ? 1n : result;
}

/**
 * Sort funding targets by role priority (creator first, holder last).
 * Targets without a role are placed after all role-assigned targets.
 */
function sortByRolePriority(targets: FundingTarget[]): FundingTarget[] {
  return [...targets].sort((a, b) => {
    const priorityA = a.role !== undefined ? ROLE_PRIORITY[a.role] : 999;
    const priorityB = b.role !== undefined ? ROLE_PRIORITY[b.role] : 999;
    return priorityA - priorityB;
  });
}

/**
 * Split an array into chunks of the given size.
 */
function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

// ─── WalletFunder ─────────────────────────────────────────────

export class WalletFunder {
  private readonly connection: Connection;
  private readonly eventBus: SwarmEventBus;
  private readonly logger: SwarmLogger;
  private readonly config: WalletFunderConfig;

  constructor(
    connection: Connection,
    eventBus: SwarmEventBus,
    config?: Partial<WalletFunderConfig>,
  ) {
    this.connection = connection;
    this.eventBus = eventBus;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.logger = new SwarmLogger({
      level: 'info',
      agentId: 'wallet-funder',
      category: 'wallet',
    });
  }

  // ─── Public API ─────────────────────────────────────────

  /**
   * Fund multiple wallets from a master keypair.
   * Groups transfers into batched transactions sorted by role priority.
   */
  async fundWallets(
    master: Keypair,
    targets: FundingTarget[],
  ): Promise<FundingResult> {
    return this.batchFund(master, targets);
  }

  /**
   * Fund a single wallet from the master keypair.
   */
  async fundWallet(
    master: Keypair,
    target: PublicKey,
    lamports: bigint,
  ): Promise<FundingTransferResult> {
    const singleTarget: FundingTarget = {
      wallet: target,
      amountLamports: lamports,
    };
    const result = await this.batchFund(master, [singleTarget], 1);
    return result.transfers[0];
  }

  /**
   * Batch-fund wallets with configurable batch size.
   * Core implementation for all funding operations.
   */
  async batchFund(
    master: Keypair,
    targets: FundingTarget[],
    batchSize?: number,
  ): Promise<FundingResult> {
    const startTime = Date.now();
    const effectiveBatchSize = batchSize ?? this.config.maxTransfersPerTx;
    const correlationId = uuidv4();

    this.logger.info('Starting batch funding', {
      targetCount: targets.length,
      batchSize: effectiveBatchSize,
      randomizeAmounts: this.config.randomizeAmounts,
      correlationId,
    });

    // Get master balance before funding
    const masterBalanceBefore = await this.getMasterBalance(master.publicKey);
    const totalTargeted = targets.reduce((sum, t) => sum + t.amountLamports, 0n);

    // Pre-flight: check master has sufficient balance
    const estimate = this.estimateFundingCost(targets);
    if (masterBalanceBefore < estimate.masterBalanceRequired) {
      const shortfall = estimate.masterBalanceRequired - masterBalanceBefore;
      this.logger.error(
        'Insufficient master balance for funding',
        new Error('Insufficient balance'),
        {
          masterBalance: masterBalanceBefore.toString(),
          required: estimate.masterBalanceRequired.toString(),
          shortfall: shortfall.toString(),
        },
      );

      this.eventBus.emit(
        'funding:insufficient-balance',
        'wallet',
        'wallet-funder',
        {
          masterBalance: masterBalanceBefore.toString(),
          required: estimate.masterBalanceRequired.toString(),
          shortfall: shortfall.toString(),
        },
        correlationId,
      );

      return {
        success: false,
        totalFunded: 0n,
        totalTargeted,
        walletsFullyFunded: 0,
        walletsFailed: targets.length,
        transfers: targets.map((t) => ({
          wallet: t.wallet.toBase58(),
          targetAmount: t.amountLamports,
          actualAmount: 0n,
          success: false,
          error: `Insufficient master balance: have ${masterBalanceBefore}, need ${estimate.masterBalanceRequired}`,
          retries: 0,
        })),
        batches: [],
        duration: Date.now() - startTime,
        masterBalanceBefore,
        masterBalanceAfter: masterBalanceBefore,
      };
    }

    // Sort by role priority
    const sorted = sortByRolePriority(targets);

    // Apply amount randomization if configured
    const processedTargets = sorted.map((t) => ({
      ...t,
      actualAmount: this.config.randomizeAmounts
        ? randomizeAmount(t.amountLamports, this.config.randomVariance)
        : t.amountLamports,
    }));

    // Split into batches
    const batches = chunk(processedTargets, effectiveBatchSize);
    const allTransfers: FundingTransferResult[] = [];
    const batchResults: FundingResult['batches'] = [];

    this.eventBus.emit(
      'funding:started',
      'wallet',
      'wallet-funder',
      {
        targetCount: targets.length,
        batchCount: batches.length,
        totalTargeted: totalTargeted.toString(),
        masterBalance: masterBalanceBefore.toString(),
      },
      correlationId,
    );

    for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
      const batch = batches[batchIdx];

      // Apply inter-batch delay for anti-detection (skip first batch)
      if (batchIdx > 0 && this.config.batchDelay > 0) {
        this.logger.debug('Waiting between batches', {
          batchIndex: batchIdx,
          delayMs: this.config.batchDelay,
        });
        await sleep(this.config.batchDelay);
      }

      const batchResult = await this.executeBatch(
        master,
        batch,
        batchIdx,
        correlationId,
      );

      batchResults.push(batchResult.batchInfo);
      allTransfers.push(...batchResult.transfers);
    }

    const totalFunded = allTransfers
      .filter((t) => t.success)
      .reduce((sum, t) => sum + t.actualAmount, 0n);
    const walletsFunded = allTransfers.filter((t) => t.success).length;
    const walletsFailed = allTransfers.filter((t) => !t.success).length;

    // Get master balance after funding
    const masterBalanceAfter = await this.getMasterBalance(master.publicKey);
    const duration = Date.now() - startTime;

    const result: FundingResult = {
      success: walletsFailed === 0,
      totalFunded,
      totalTargeted,
      walletsFullyFunded: walletsFunded,
      walletsFailed,
      transfers: allTransfers,
      batches: batchResults,
      duration,
      masterBalanceBefore,
      masterBalanceAfter,
    };

    this.logger.info('Batch funding completed', {
      success: result.success,
      walletsFullyFunded: walletsFunded,
      walletsFailed,
      totalFunded: totalFunded.toString(),
      totalTargeted: totalTargeted.toString(),
      durationMs: duration,
      masterSpent: (masterBalanceBefore - masterBalanceAfter).toString(),
    });

    this.eventBus.emit(
      'funding:completed',
      'wallet',
      'wallet-funder',
      {
        success: result.success,
        walletsFullyFunded: walletsFunded,
        walletsFailed,
        totalFunded: totalFunded.toString(),
        durationMs: duration,
      },
      correlationId,
    );

    return result;
  }

  /**
   * Verify all funding targets have the expected balance.
   * Uses getMultipleAccountsInfo in batches of 100 for efficiency.
   */
  async verifyFunding(targets: FundingTarget[]): Promise<FundingVerification> {
    this.logger.info('Verifying funding', { targetCount: targets.length });

    const walletPubkeys = targets.map((t) => t.wallet);
    const balances = await this.batchGetBalances(walletPubkeys);

    const walletResults: FundingVerification['wallets'] = [];
    let totalShortfall = 0n;
    let allFunded = true;

    for (let i = 0; i < targets.length; i++) {
      const target = targets[i];
      const actualBalance = balances[i];
      const funded = actualBalance >= target.amountLamports;
      const shortfall = funded ? 0n : target.amountLamports - actualBalance;

      if (!funded) {
        allFunded = false;
        totalShortfall += shortfall;
      }

      walletResults.push({
        wallet: target.wallet.toBase58(),
        expectedBalance: target.amountLamports,
        actualBalance,
        funded,
        shortfall,
      });
    }

    const verification: FundingVerification = {
      allFunded,
      wallets: walletResults,
      totalShortfall,
    };

    this.logger.info('Funding verification complete', {
      allFunded,
      totalShortfall: totalShortfall.toString(),
      funded: walletResults.filter((w) => w.funded).length,
      underfunded: walletResults.filter((w) => !w.funded).length,
    });

    this.eventBus.emit(
      'funding:verified',
      'wallet',
      'wallet-funder',
      {
        allFunded,
        totalShortfall: totalShortfall.toString(),
        walletCount: targets.length,
      },
    );

    return verification;
  }

  /**
   * Reclaim SOL from all agent wallets back to the master.
   * Sweeps SOL (leaving rent-exempt minimum) and closes token accounts.
   */
  async reclaimAll(
    wallets: Keypair[],
    master: PublicKey,
  ): Promise<ReclaimResult> {
    const startTime = Date.now();
    const correlationId = uuidv4();

    this.logger.info('Starting fund reclamation', {
      walletCount: wallets.length,
      masterTarget: master.toBase58(),
      correlationId,
    });

    this.eventBus.emit(
      'funding:reclaim-started',
      'wallet',
      'wallet-funder',
      { walletCount: wallets.length, master: master.toBase58() },
      correlationId,
    );

    // Close token accounts first (earns back rent)
    let tokenAccountsClosed = 0;
    for (const wallet of wallets) {
      const closed = await this.closeTokenAccounts(wallet, master);
      tokenAccountsClosed += closed;
    }

    // Now sweep SOL from each wallet
    const allTransfers: FundingTransferResult[] = [];
    const batchResults: ReclaimResult['batches'] = [];

    // Reclaim must be individual transactions (each wallet signs its own)
    const batches = chunk(wallets, this.config.maxTransfersPerTx);

    for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
      const batch = batches[batchIdx];

      if (batchIdx > 0 && this.config.batchDelay > 0) {
        await sleep(this.config.batchDelay);
      }

      // Each wallet in the batch sends its own transaction
      const batchTransfers: FundingTransferResult[] = [];
      const signatures: string[] = [];
      let batchSuccess = true;
      let batchError: string | undefined;

      for (const wallet of batch) {
        const transferResult = await this.reclaimWallet(wallet, master);
        batchTransfers.push(transferResult);
        if (transferResult.success && transferResult.signature) {
          signatures.push(transferResult.signature);
        } else {
          batchSuccess = false;
          batchError = transferResult.error;
        }
      }

      batchResults.push({
        batchIndex: batchIdx,
        signature: signatures[0] ?? '',
        transfers: batchTransfers.length,
        success: batchSuccess,
        error: batchError,
      });

      allTransfers.push(...batchTransfers);
    }

    const totalReclaimed = allTransfers
      .filter((t) => t.success)
      .reduce((sum, t) => sum + t.actualAmount, 0n);
    const walletsReclaimed = allTransfers.filter((t) => t.success).length;
    const walletsFailed = allTransfers.filter((t) => !t.success).length;
    const duration = Date.now() - startTime;

    const result: ReclaimResult = {
      success: walletsFailed === 0,
      totalReclaimed,
      walletsReclaimed,
      walletsFailed,
      tokenAccountsClosed,
      transfers: allTransfers,
      batches: batchResults,
      duration,
    };

    this.logger.info('Fund reclamation completed', {
      totalReclaimed: totalReclaimed.toString(),
      walletsReclaimed,
      walletsFailed,
      tokenAccountsClosed,
      durationMs: duration,
    });

    this.eventBus.emit(
      'funding:reclaim-completed',
      'wallet',
      'wallet-funder',
      {
        totalReclaimed: totalReclaimed.toString(),
        walletsReclaimed,
        walletsFailed,
        tokenAccountsClosed,
        durationMs: duration,
      },
      correlationId,
    );

    return result;
  }

  /**
   * Reclaim SOL from a single wallet back to master.
   * Leaves rent-exempt minimum in the wallet.
   */
  async reclaimWallet(
    wallet: Keypair,
    master: PublicKey,
  ): Promise<FundingTransferResult> {
    const walletAddress = wallet.publicKey.toBase58();
    let retries = 0;

    while (retries <= this.config.maxRetries) {
      try {
        const balance = BigInt(
          await this.connection.getBalance(wallet.publicKey, this.config.commitment),
        );

        // Must leave rent-exempt minimum + enough for the transfer fee
        const sweepableAmount = balance - this.config.rentExemptMinimum - ESTIMATED_FEE_PER_TX;

        if (sweepableAmount <= 0n) {
          this.logger.debug('Wallet has insufficient balance to reclaim', {
            wallet: walletAddress,
            balance: balance.toString(),
            rentExemptMinimum: this.config.rentExemptMinimum.toString(),
          });

          return {
            wallet: walletAddress,
            targetAmount: 0n,
            actualAmount: 0n,
            success: true,
            retries,
            error: undefined,
          };
        }

        const tx = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: wallet.publicKey,
            toPubkey: master,
            lamports: sweepableAmount,
          }),
        );

        const signature = await sendAndConfirmTransaction(
          this.connection,
          tx,
          [wallet],
          { commitment: this.config.commitment },
        );

        this.logger.debug('Reclaimed from wallet', {
          wallet: walletAddress,
          amount: sweepableAmount.toString(),
          signature,
        });

        return {
          wallet: walletAddress,
          targetAmount: sweepableAmount,
          actualAmount: sweepableAmount,
          success: true,
          signature,
          retries,
        };
      } catch (err) {
        retries++;
        const errorMessage = err instanceof Error ? err.message : String(err);

        if (retries > this.config.maxRetries) {
          this.logger.error(
            `Failed to reclaim from wallet after ${this.config.maxRetries} retries`,
            err instanceof Error ? err : new Error(errorMessage),
            { wallet: walletAddress },
          );

          return {
            wallet: walletAddress,
            targetAmount: 0n,
            actualAmount: 0n,
            success: false,
            error: errorMessage,
            retries,
          };
        }

        this.logger.warn('Reclaim retry', {
          wallet: walletAddress,
          attempt: retries,
          error: errorMessage,
        });

        // Exponential backoff
        await sleep(500 * 2 ** (retries - 1));
      }
    }

    // Should not reach here, but satisfy TypeScript
    return {
      wallet: walletAddress,
      targetAmount: 0n,
      actualAmount: 0n,
      success: false,
      error: 'Exceeded max retries',
      retries,
    };
  }

  /**
   * Estimate the total cost of funding all targets.
   * Includes transfer amounts and transaction fees.
   */
  estimateFundingCost(targets: FundingTarget[]): FundingCostEstimate {
    const totalTransferAmount = targets.reduce(
      (sum, t) => sum + t.amountLamports,
      0n,
    );

    const numberOfBatches = Math.ceil(
      targets.length / this.config.maxTransfersPerTx,
    );
    // Each batch is one transaction
    const numberOfTransactions = numberOfBatches;
    const transactionFees = ESTIMATED_FEE_PER_TX * BigInt(numberOfTransactions);

    const totalCost = totalTransferAmount + transactionFees;
    const masterBalanceRequired = totalCost + this.config.masterReserve;

    return {
      totalTransferAmount,
      transactionFees,
      numberOfBatches,
      numberOfTransactions,
      totalCost,
      masterBalanceRequired,
    };
  }

  /**
   * Get the master wallet's current balance.
   */
  async getMasterBalance(master: PublicKey): Promise<bigint> {
    const balance = await this.connection.getBalance(
      master,
      this.config.commitment,
    );
    return BigInt(balance);
  }

  // ─── Private Methods ────────────────────────────────────

  /**
   * Execute a single batch of transfers as one transaction.
   * Each batch contains multiple SystemProgram.transfer instructions.
   */
  private async executeBatch(
    master: Keypair,
    batch: Array<FundingTarget & { actualAmount: bigint }>,
    batchIndex: number,
    correlationId: string,
  ): Promise<{
    batchInfo: FundingResult['batches'][number];
    transfers: FundingTransferResult[];
  }> {
    let retries = 0;
    const transfers: FundingTransferResult[] = batch.map((t) => ({
      wallet: t.wallet.toBase58(),
      targetAmount: t.amountLamports,
      actualAmount: t.actualAmount,
      success: false,
      retries: 0,
    }));

    while (retries <= this.config.maxRetries) {
      try {
        const tx = new Transaction();

        for (const target of batch) {
          tx.add(
            SystemProgram.transfer({
              fromPubkey: master.publicKey,
              toPubkey: target.wallet,
              lamports: target.actualAmount,
            }),
          );
        }

        const signature = await sendAndConfirmTransaction(
          this.connection,
          tx,
          [master],
          { commitment: this.config.commitment },
        );

        this.logger.info('Batch funded successfully', {
          batchIndex,
          transfers: batch.length,
          signature,
          totalAmount: batch
            .reduce((sum, t) => sum + t.actualAmount, 0n)
            .toString(),
        });

        // Mark all transfers in this batch as successful
        for (const transfer of transfers) {
          transfer.success = true;
          transfer.signature = signature;
          transfer.retries = retries;
        }

        this.eventBus.emit(
          'funding:batch-completed',
          'wallet',
          'wallet-funder',
          {
            batchIndex,
            signature,
            transfers: batch.length,
            success: true,
          },
          correlationId,
        );

        return {
          batchInfo: {
            batchIndex,
            signature,
            transfers: batch.length,
            success: true,
          },
          transfers,
        };
      } catch (err) {
        retries++;
        const errorMessage = err instanceof Error ? err.message : String(err);

        this.logger.warn('Batch funding failed, retrying', {
          batchIndex,
          attempt: retries,
          maxRetries: this.config.maxRetries,
          error: errorMessage,
        });

        if (retries > this.config.maxRetries) {
          this.logger.error(
            `Batch ${batchIndex} failed after ${this.config.maxRetries} retries`,
            err instanceof Error ? err : new Error(errorMessage),
            { batchIndex },
          );

          for (const transfer of transfers) {
            transfer.error = errorMessage;
            transfer.retries = retries;
          }

          this.eventBus.emit(
            'funding:batch-failed',
            'wallet',
            'wallet-funder',
            {
              batchIndex,
              error: errorMessage,
              transfers: batch.length,
            },
            correlationId,
          );

          return {
            batchInfo: {
              batchIndex,
              signature: '',
              transfers: batch.length,
              success: false,
              error: errorMessage,
            },
            transfers,
          };
        }

        // Exponential backoff between retries
        await sleep(500 * 2 ** (retries - 1));
      }
    }

    // TypeScript exhaustion guard
    return {
      batchInfo: {
        batchIndex,
        signature: '',
        transfers: batch.length,
        success: false,
        error: 'Exceeded max retries',
      },
      transfers,
    };
  }

  /**
   * Fetch balances for multiple wallets via getMultipleAccountsInfo.
   * Batches requests in groups of 100 (RPC limit).
   */
  private async batchGetBalances(pubkeys: PublicKey[]): Promise<bigint[]> {
    const balances: bigint[] = new Array(pubkeys.length).fill(0n);
    const batches = chunk(pubkeys, MAX_ACCOUNTS_PER_BATCH);

    for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
      const batch = batches[batchIdx];
      const accountInfos = await this.connection.getMultipleAccountsInfo(
        batch,
        this.config.commitment,
      );

      for (let i = 0; i < accountInfos.length; i++) {
        const globalIndex = batchIdx * MAX_ACCOUNTS_PER_BATCH + i;
        const info = accountInfos[i];
        balances[globalIndex] = info ? BigInt(info.lamports) : 0n;
      }
    }

    return balances;
  }

  /**
   * Close all SPL token accounts for a wallet, sweeping rent SOL to master.
   * Returns the number of token accounts closed.
   */
  private async closeTokenAccounts(
    wallet: Keypair,
    master: PublicKey,
  ): Promise<number> {
    try {
      const tokenAccounts = await this.connection.getTokenAccountsByOwner(
        wallet.publicKey,
        { programId: TOKEN_PROGRAM_ID },
        this.config.commitment,
      );

      if (tokenAccounts.value.length === 0) {
        return 0;
      }

      let closed = 0;

      // Process token accounts in small batches to avoid TX size limits
      const accountBatches = chunk([...tokenAccounts.value], 5);

      for (const batch of accountBatches) {
        const tx = new Transaction();
        let hasClosableAccounts = false;

        for (const { pubkey } of batch) {
          try {
            // Check if account has zero token balance before closing
            const accountInfo = await getAccount(
              this.connection,
              pubkey,
              this.config.commitment,
            );

            if (accountInfo.amount === 0n) {
              tx.add(
                createCloseAccountInstruction(
                  pubkey,
                  master,
                  wallet.publicKey,
                ),
              );
              hasClosableAccounts = true;
            } else {
              this.logger.debug('Skipping non-empty token account', {
                wallet: wallet.publicKey.toBase58(),
                tokenAccount: pubkey.toBase58(),
                balance: accountInfo.amount.toString(),
              });
            }
          } catch {
            // Account may have been closed already, skip
            this.logger.debug('Could not read token account, skipping', {
              tokenAccount: pubkey.toBase58(),
            });
          }
        }

        if (hasClosableAccounts) {
          try {
            await sendAndConfirmTransaction(
              this.connection,
              tx,
              [wallet],
              { commitment: this.config.commitment },
            );
            closed += batch.length;
          } catch (err) {
            this.logger.warn('Failed to close token accounts batch', {
              wallet: wallet.publicKey.toBase58(),
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }
      }

      if (closed > 0) {
        this.logger.debug('Closed token accounts', {
          wallet: wallet.publicKey.toBase58(),
          accountsClosed: closed,
        });
      }

      return closed;
    } catch (err) {
      this.logger.warn('Failed to enumerate token accounts', {
        wallet: wallet.publicKey.toBase58(),
        error: err instanceof Error ? err.message : String(err),
      });
      return 0;
    }
  }
}
