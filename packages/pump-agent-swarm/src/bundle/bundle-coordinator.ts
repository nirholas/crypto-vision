/**
 * Bundle Coordinator — Multi-wallet atomic token acquisition
 *
 * Orchestrates N wallets to buy a token simultaneously at launch or
 * for existing tokens, acquiring a target supply percentage. Supports
 * two execution modes:
 *
 *   1. **Jito mode** (preferred) — builds all buy transactions and submits
 *      them as a Jito bundle for guaranteed same-slot execution. All buys
 *      land atomically or none do.
 *
 *   2. **Stagger mode** (fallback) — executes buys sequentially with random
 *      delays between them, retrying failures up to 3 times.
 *
 * Also supports a create+bundle combo where token creation and all bundle
 * buys are submitted atomically via Jito.
 *
 * @example
 * ```typescript
 * const coordinator = new BundleCoordinator(connection, walletVault, eventBus, {
 *   maxWalletsPerBundle: 5,
 *   useJito: true,
 *   jitoConfig: { blockEngineUrl: '...', tipLamports: 10_000, maxBundleSize: 5, useOnChainTip: true },
 *   maxTotalSol: new BN(10 * LAMPORTS_PER_SOL),
 *   distribution: 'weighted',
 *   staggerDelayMs: { min: 500, max: 2000 },
 *   slippageBps: 500,
 *   priorityFeeMultiplier: 1.5,
 *   verifyAll: true,
 * });
 *
 * const plan = await coordinator.planBundle(mint, new BN(5 * LAMPORTS_PER_SOL), 4);
 * const result = await coordinator.executeBundle(plan);
 * ```
 */

import {
  Connection,
  PublicKey,
  Keypair,
  Transaction,
  ComputeBudgetProgram,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync } from '@solana/spl-token';
import { PUMP_SDK, OnlinePumpSdk } from '@pump-fun/pump-sdk';
import BN from 'bn.js';
import { v4 as uuidv4 } from 'uuid';

import type {
  AgentWallet,
  BundlePlan,
  BundleParticipant,
  JitoBundleConfig,
  TokenNarrative,
} from '../types.js';
import { WalletVault } from '../wallet-manager.js';
import { SwarmEventBus } from '../infra/event-bus.js';
import { SwarmLogger } from '../infra/logger.js';
import { JitoClient } from './jito-client.js';

// ─── Types ────────────────────────────────────────────────────

export interface BundleCoordinatorConfig {
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

export interface BundleResult {
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

// ─── Constants ────────────────────────────────────────────────

/** Pump.fun total supply (1B tokens with 6 decimals) */
const TOTAL_SUPPLY = new BN(1_000_000_000).mul(new BN(10).pow(new BN(6)));

/** Initial virtual SOL reserves: 30 SOL */
const INITIAL_VIRTUAL_SOL = new BN(30).mul(new BN(LAMPORTS_PER_SOL));

/** Initial virtual token reserves: 1.073B tokens */
const INITIAL_VIRTUAL_TOKENS = new BN(1_073_000_000).mul(new BN(10).pow(new BN(6)));

/** Default base priority fee in microlamports */
const BASE_PRIORITY_FEE_MICRO_LAMPORTS = 100_000;

/** Compute unit limit per buy transaction */
const COMPUTE_UNIT_LIMIT = 200_000;

/** Max retry attempts per buy in stagger mode */
const MAX_STAGGER_RETRIES = 3;

/** Retry base delay for stagger mode (ms) */
const RETRY_BASE_DELAY_MS = 500;

/** Minimum SOL per wallet in a bundle (0.001 SOL) */
const MIN_SOL_PER_WALLET = new BN(1_000_000);

// ─── Helpers ──────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomInRange(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Estimate tokens received from a buy using constant product formula.
 *
 *   tokensOut = virtualTokenReserves - (k / (virtualSolReserves + solIn))
 *
 * where k = virtualSolReserves * virtualTokenReserves
 */
function estimateTokensOut(
  solIn: BN,
  virtualSolReserves: BN,
  virtualTokenReserves: BN,
): BN {
  if (solIn.isZero()) return new BN(0);
  // k = virtualSolReserves * virtualTokenReserves
  const k = virtualSolReserves.mul(virtualTokenReserves);
  // newVirtualSol = virtualSolReserves + solIn
  const newVirtualSol = virtualSolReserves.add(solIn);
  // newVirtualTokens = k / newVirtualSol
  const newVirtualTokens = k.div(newVirtualSol);
  // tokensOut = virtualTokenReserves - newVirtualTokens
  return virtualTokenReserves.sub(newVirtualTokens);
}

// ─── Bundle Coordinator ───────────────────────────────────────

export class BundleCoordinator {
  private readonly connection: Connection;
  private readonly walletVault: WalletVault;
  private readonly eventBus: SwarmEventBus;
  private readonly config: BundleCoordinatorConfig;
  private readonly logger: SwarmLogger;
  private readonly jitoClient: JitoClient | null;
  private readonly activePlans: Map<string, BundlePlan> = new Map();
  private readonly bundleResults: Map<string, BundleResult> = new Map();
  private onlineSdk: OnlinePumpSdk | null = null;

  constructor(
    connection: Connection,
    walletVault: WalletVault,
    eventBus: SwarmEventBus,
    config: BundleCoordinatorConfig,
  ) {
    this.connection = connection;
    this.walletVault = walletVault;
    this.eventBus = eventBus;
    this.config = config;
    this.logger = new SwarmLogger({
      level: 'info',
      category: 'bundle-coordinator',
    });

    this.jitoClient =
      config.useJito && config.jitoConfig
        ? new JitoClient(config.jitoConfig)
        : null;
  }

  // ─── Public API ───────────────────────────────────────────

  /**
   * Plan a bundle buy for an existing token.
   *
   * Allocates wallets from the vault, distributes SOL amounts according
   * to the configured strategy, and estimates token acquisition.
   *
   * @param mint - Token mint address (base58)
   * @param totalSol - Total SOL to spend across all wallets (lamports)
   * @param walletCount - Number of wallets to use
   * @returns A BundlePlan ready for execution
   */
  async planBundle(
    mint: string,
    totalSol: BN,
    walletCount: number,
  ): Promise<BundlePlan> {
    this.validateBundleParams(totalSol, walletCount);

    const effectiveWalletCount = Math.min(
      walletCount,
      this.config.maxWalletsPerBundle,
    );

    // Get available wallets from the vault
    const wallets = this.allocateWallets(effectiveWalletCount);
    const allocations = this.distributeSOL(
      totalSol,
      effectiveWalletCount,
      this.config.distribution,
    );

    // Build participants list
    const participants: BundleParticipant[] = wallets.map((wallet, i) => ({
      wallet,
      amountLamports: allocations[i],
      delayMs: this.config.useJito
        ? 0
        : randomInRange(
            this.config.staggerDelayMs.min,
            this.config.staggerDelayMs.max,
          ) * i,
      priorityMultiplier: this.config.priorityFeeMultiplier,
      status: 'pending' as const,
    }));

    // Estimate supply acquisition using bonding curve math
    const targetSupplyPercent = this.estimateSupplyPercent(
      totalSol,
      INITIAL_VIRTUAL_SOL,
      INITIAL_VIRTUAL_TOKENS,
    );

    // Select the first wallet as "creator" for the plan
    const creatorWallet = wallets[0];

    const plan: BundlePlan = {
      id: uuidv4(),
      mint,
      creator: creatorWallet,
      participants,
      totalSolAllocated: totalSol,
      targetSupplyPercent,
      useJito: this.config.useJito,
      jitoConfig: this.config.jitoConfig,
      createdAt: Date.now(),
      status: 'planned',
    };

    this.activePlans.set(plan.id, plan);

    this.eventBus.emit(
      'bundle:planned',
      'bundle',
      'bundle-coordinator',
      {
        bundleId: plan.id,
        mint,
        walletCount: effectiveWalletCount,
        totalSol: totalSol.toString(),
        distribution: this.config.distribution,
        targetSupplyPercent,
        useJito: this.config.useJito,
      },
    );

    this.logger.info('Bundle planned', {
      bundleId: plan.id,
      mint,
      walletCount: effectiveWalletCount,
      totalSol: totalSol.toString(),
      targetSupplyPercent,
    });

    return plan;
  }

  /**
   * Execute a previously planned bundle.
   *
   * Dispatches to Jito mode or stagger mode based on configuration.
   *
   * @param plan - The BundlePlan to execute
   * @returns BundleResult with per-wallet outcomes
   */
  async executeBundle(plan: BundlePlan): Promise<BundleResult> {
    if (plan.status !== 'planned') {
      throw new Error(
        `[BundleCoordinator] Cannot execute plan in status '${plan.status}'`,
      );
    }

    plan.status = 'executing';
    plan.executedAt = Date.now();

    this.eventBus.emit(
      'bundle:executing',
      'bundle',
      'bundle-coordinator',
      { bundleId: plan.id, mode: plan.useJito ? 'jito' : 'stagger' },
    );

    const startTime = Date.now();

    let result: BundleResult;

    if (plan.useJito && this.jitoClient) {
      result = await this.executeJitoBundle(plan, startTime);
    } else {
      result = await this.executeStaggerBundle(plan, startTime);
    }

    // Update plan status from result
    plan.status = result.status === 'success'
      ? 'completed'
      : result.status === 'partial'
        ? 'partial'
        : 'failed';

    this.bundleResults.set(plan.id, result);

    this.eventBus.emit(
      'bundle:completed',
      'bundle',
      'bundle-coordinator',
      {
        bundleId: plan.id,
        status: result.status,
        totalSolSpent: result.totalSolSpent.toString(),
        totalTokensReceived: result.totalTokensReceived.toString(),
        estimatedSupplyPercent: result.estimatedSupplyPercent,
        executionTimeMs: result.executionTimeMs,
        confirmedCount: result.results.filter((r) => r.status === 'confirmed').length,
        failedCount: result.results.filter((r) => r.status === 'failed').length,
      },
    );

    this.logger.info('Bundle execution completed', {
      bundleId: plan.id,
      status: result.status,
      executionTimeMs: result.executionTimeMs,
      confirmedCount: result.results.filter((r) => r.status === 'confirmed').length,
    });

    return result;
  }

  /**
   * Create a token AND execute bundle buys in one atomic operation.
   *
   * In Jito mode: the create transaction and all buy transactions are
   * submitted as a single Jito bundle for guaranteed same-slot execution.
   * This ensures agents acquire maximum supply before anyone else.
   *
   * In stagger mode: creates the token first, then immediately executes
   * sequential buys with randomized delays.
   *
   * @param narrative - Token metadata (name, symbol, description, metadataUri)
   * @param totalSol - Total SOL for bundle buys (excluding dev buy)
   * @param devBuySol - SOL for the creator's dev buy (lamports)
   * @param walletCount - Number of additional wallets for bundle buys
   * @returns BundleResult including creation details
   */
  async executeBundleWithCreate(
    narrative: TokenNarrative,
    totalSol: BN,
    devBuySol: BN,
    walletCount: number,
  ): Promise<BundleResult> {
    this.validateBundleParams(totalSol, walletCount);

    if (!narrative.metadataUri) {
      throw new Error(
        '[BundleCoordinator] TokenNarrative must have metadataUri set before create+bundle',
      );
    }

    const effectiveWalletCount = Math.min(
      walletCount,
      // Reserve 1 slot in Jito bundle for the create tx
      this.config.useJito
        ? this.config.maxWalletsPerBundle - 1
        : this.config.maxWalletsPerBundle,
    );

    const wallets = this.allocateWallets(effectiveWalletCount + 1); // +1 for creator
    const creatorWallet = wallets[0];
    const buyerWallets = wallets.slice(1);

    const allocations = this.distributeSOL(
      totalSol,
      buyerWallets.length,
      this.config.distribution,
    );

    const participants: BundleParticipant[] = buyerWallets.map((wallet, i) => ({
      wallet,
      amountLamports: allocations[i],
      delayMs: this.config.useJito
        ? 0
        : randomInRange(
            this.config.staggerDelayMs.min,
            this.config.staggerDelayMs.max,
          ) * (i + 1),
      priorityMultiplier: this.config.priorityFeeMultiplier,
      status: 'pending' as const,
    }));

    // Calculate the combined target percent (dev buy + bundle buys)
    const combinedSol = totalSol.add(devBuySol);
    const targetSupplyPercent = this.estimateSupplyPercent(
      combinedSol,
      INITIAL_VIRTUAL_SOL,
      INITIAL_VIRTUAL_TOKENS,
    );

    const mintKeypair = Keypair.generate();
    const mint = mintKeypair.publicKey.toBase58();

    const plan: BundlePlan = {
      id: uuidv4(),
      mint,
      creator: creatorWallet,
      participants,
      totalSolAllocated: combinedSol,
      targetSupplyPercent,
      useJito: this.config.useJito,
      jitoConfig: this.config.jitoConfig,
      createdAt: Date.now(),
      status: 'planned',
    };

    this.activePlans.set(plan.id, plan);

    this.eventBus.emit(
      'bundle:create-planned',
      'bundle',
      'bundle-coordinator',
      {
        bundleId: plan.id,
        mint,
        tokenName: narrative.name,
        tokenSymbol: narrative.symbol,
        walletCount: effectiveWalletCount,
        devBuySol: devBuySol.toString(),
        totalBundleSol: totalSol.toString(),
        targetSupplyPercent,
        useJito: this.config.useJito,
      },
    );

    plan.status = 'executing';
    plan.executedAt = Date.now();
    const startTime = Date.now();

    let result: BundleResult;

    if (this.config.useJito && this.jitoClient) {
      result = await this.executeJitoCreateAndBundle(
        plan,
        narrative,
        mintKeypair,
        creatorWallet,
        buyerWallets,
        allocations,
        devBuySol,
        startTime,
      );
    } else {
      result = await this.executeStaggerCreateAndBundle(
        plan,
        narrative,
        mintKeypair,
        creatorWallet,
        buyerWallets,
        allocations,
        devBuySol,
        startTime,
      );
    }

    plan.status = result.status === 'success'
      ? 'completed'
      : result.status === 'partial'
        ? 'partial'
        : 'failed';

    this.bundleResults.set(plan.id, result);

    this.eventBus.emit(
      'bundle:create-completed',
      'bundle',
      'bundle-coordinator',
      {
        bundleId: plan.id,
        mint,
        status: result.status,
        totalSolSpent: result.totalSolSpent.toString(),
        totalTokensReceived: result.totalTokensReceived.toString(),
        estimatedSupplyPercent: result.estimatedSupplyPercent,
        executionTimeMs: result.executionTimeMs,
      },
    );

    this.logger.info('Create + bundle completed', {
      bundleId: plan.id,
      status: result.status,
      mint,
      executionTimeMs: result.executionTimeMs,
    });

    return result;
  }

  /**
   * Get all currently active (planned or executing) bundle plans.
   */
  getActiveBundles(): BundlePlan[] {
    return Array.from(this.activePlans.values()).filter(
      (p) => p.status === 'planned' || p.status === 'executing',
    );
  }

  /**
   * Cancel a planned (not yet executing) bundle.
   *
   * @param bundleId - The bundle plan ID to cancel
   * @throws If the bundle is already executing or not found
   */
  cancelBundle(bundleId: string): void {
    const plan = this.activePlans.get(bundleId);
    if (!plan) {
      throw new Error(`[BundleCoordinator] Bundle '${bundleId}' not found`);
    }
    if (plan.status === 'executing') {
      throw new Error(
        `[BundleCoordinator] Cannot cancel bundle '${bundleId}' — already executing`,
      );
    }
    if (plan.status !== 'planned') {
      throw new Error(
        `[BundleCoordinator] Cannot cancel bundle '${bundleId}' — status is '${plan.status}'`,
      );
    }

    plan.status = 'failed';
    this.activePlans.delete(bundleId);

    this.eventBus.emit(
      'bundle:cancelled',
      'bundle',
      'bundle-coordinator',
      { bundleId },
    );

    this.logger.info('Bundle cancelled', { bundleId });
  }

  /**
   * Retrieve the result of a completed bundle.
   */
  getBundleResult(bundleId: string): BundleResult | undefined {
    return this.bundleResults.get(bundleId);
  }

  // ─── Jito Execution ──────────────────────────────────────

  /**
   * Execute all buy transactions as a Jito bundle (same-slot atomicity).
   */
  private async executeJitoBundle(
    plan: BundlePlan,
    startTime: number,
  ): Promise<BundleResult> {
    if (!this.jitoClient || !plan.mint) {
      throw new Error(
        '[BundleCoordinator] Jito client not configured or mint not set',
      );
    }

    const sdk = this.getOnlineSdk();
    const mintPubkey = new PublicKey(plan.mint);
    const global = await sdk.fetchGlobal();

    const transactions: Transaction[] = [];
    const participantMap: Map<number, BundleParticipant> = new Map();

    for (let i = 0; i < plan.participants.length; i++) {
      const participant = plan.participants[i];

      try {
        const buyState = await sdk.fetchBuyState(
          mintPubkey,
          participant.wallet.keypair.publicKey,
          TOKEN_PROGRAM_ID,
        );

        const buyIxs = await PUMP_SDK.buyInstructions({
          global,
          bondingCurveAccountInfo: buyState.bondingCurveAccountInfo,
          bondingCurve: buyState.bondingCurve,
          associatedUserAccountInfo: buyState.associatedUserAccountInfo,
          mint: mintPubkey,
          user: participant.wallet.keypair.publicKey,
          amount: new BN(0),
          solAmount: participant.amountLamports,
          slippage: this.config.slippageBps / 100,
          tokenProgram: TOKEN_PROGRAM_ID,
        });

        const priorityFee = Math.round(
          BASE_PRIORITY_FEE_MICRO_LAMPORTS * participant.priorityMultiplier,
        );

        const computeIxs = [
          ComputeBudgetProgram.setComputeUnitLimit({ units: COMPUTE_UNIT_LIMIT }),
          ComputeBudgetProgram.setComputeUnitPrice({
            microLamports: priorityFee,
          }),
        ];

        const { blockhash } = await this.connection.getLatestBlockhash('confirmed');
        const tx = new Transaction({
          recentBlockhash: blockhash,
          feePayer: participant.wallet.keypair.publicKey,
        });
        tx.add(...computeIxs, ...buyIxs);
        tx.sign(participant.wallet.keypair);

        // Add Jito tip to the last transaction only
        if (i === plan.participants.length - 1 && this.jitoClient) {
          await this.jitoClient.addTipInstruction(
            tx,
            plan.jitoConfig?.tipLamports ?? 10_000,
          );
          tx.sign(participant.wallet.keypair);
        }

        transactions.push(tx);
        participantMap.set(transactions.length - 1, participant);
        participant.status = 'submitted';
      } catch (error) {
        const errMsg =
          error instanceof Error ? error.message : String(error);
        this.logger.error(
          `Failed to build tx for ${participant.wallet.label}`,
          new Error(errMsg),
        );
        participant.status = 'failed';
      }
    }

    if (transactions.length === 0) {
      return this.buildResult(plan, [], startTime, true);
    }

    // Submit as Jito bundle
    const jitoBundleResult = await this.jitoClient.sendBundle(transactions);

    if (jitoBundleResult.status === 'failed') {
      this.logger.error(
        'Jito bundle submission failed',
        new Error(jitoBundleResult.error ?? 'Unknown Jito error'),
      );
      // Mark all participants as failed
      for (const participant of plan.participants) {
        if (participant.status === 'submitted') {
          participant.status = 'failed';
        }
      }
      return this.buildResult(plan, [], startTime, true);
    }

    // Wait for confirmation
    const confirmation = await this.jitoClient.waitForBundleConfirmation(
      jitoBundleResult.bundleId,
    );

    const walletResults: BundleResult['results'] = [];

    if (confirmation.status === 'landed') {
      // All transactions in the bundle landed
      for (const [txIndex, participant] of participantMap) {
        participant.status = 'confirmed';
        participant.signature = jitoBundleResult.signatures[txIndex] ?? '';

        // Estimate tokens received based on bonding curve math
        const tokensReceived = estimateTokensOut(
          participant.amountLamports,
          INITIAL_VIRTUAL_SOL,
          INITIAL_VIRTUAL_TOKENS,
        );
        participant.tokensReceived = tokensReceived;

        walletResults.push({
          wallet: participant.wallet.address,
          solSpent: participant.amountLamports,
          tokensReceived,
          signature: participant.signature,
          status: 'confirmed',
        });
      }
    } else {
      // Bundle failed or timed out
      for (const [, participant] of participantMap) {
        participant.status = 'failed';
        walletResults.push({
          wallet: participant.wallet.address,
          solSpent: new BN(0),
          tokensReceived: new BN(0),
          signature: '',
          status: 'failed',
          error: confirmation.error ?? `Bundle status: ${confirmation.status}`,
        });
      }
    }

    return this.buildResult(plan, walletResults, startTime, true);
  }

  /**
   * Execute buys sequentially with staggered delays (non-Jito fallback).
   */
  private async executeStaggerBundle(
    plan: BundlePlan,
    startTime: number,
  ): Promise<BundleResult> {
    if (!plan.mint) {
      throw new Error('[BundleCoordinator] Mint not set on plan');
    }

    const sdk = this.getOnlineSdk();
    const mintPubkey = new PublicKey(plan.mint);
    const walletResults: BundleResult['results'] = [];

    for (const participant of plan.participants) {
      // Stagger delay
      if (participant.delayMs > 0) {
        await sleep(participant.delayMs);
      }

      let lastError: string | undefined;
      let succeeded = false;

      for (let attempt = 0; attempt < MAX_STAGGER_RETRIES; attempt++) {
        try {
          const global = await sdk.fetchGlobal();
          const buyState = await sdk.fetchBuyState(
            mintPubkey,
            participant.wallet.keypair.publicKey,
            TOKEN_PROGRAM_ID,
          );

          const buyIxs = await PUMP_SDK.buyInstructions({
            global,
            bondingCurveAccountInfo: buyState.bondingCurveAccountInfo,
            bondingCurve: buyState.bondingCurve,
            associatedUserAccountInfo: buyState.associatedUserAccountInfo,
            mint: mintPubkey,
            user: participant.wallet.keypair.publicKey,
            amount: new BN(0),
            solAmount: participant.amountLamports,
            slippage: this.config.slippageBps / 100,
            tokenProgram: TOKEN_PROGRAM_ID,
          });

          const priorityFee = Math.round(
            BASE_PRIORITY_FEE_MICRO_LAMPORTS * participant.priorityMultiplier,
          );

          const computeIxs = [
            ComputeBudgetProgram.setComputeUnitLimit({ units: COMPUTE_UNIT_LIMIT }),
            ComputeBudgetProgram.setComputeUnitPrice({
              microLamports: priorityFee,
            }),
          ];

          const { blockhash } = await this.connection.getLatestBlockhash('confirmed');
          const tx = new Transaction({
            recentBlockhash: blockhash,
            feePayer: participant.wallet.keypair.publicKey,
          });
          tx.add(...computeIxs, ...buyIxs);

          const signature = await sendAndConfirmTransaction(
            this.connection,
            tx,
            [participant.wallet.keypair],
            { commitment: 'confirmed', maxRetries: 3 },
          );

          participant.status = 'confirmed';
          participant.signature = signature;

          // Fetch actual token balance to determine tokens received
          const tokensReceived = await this.fetchTokensReceived(
            mintPubkey,
            participant.wallet.keypair.publicKey,
          );
          participant.tokensReceived = tokensReceived;

          walletResults.push({
            wallet: participant.wallet.address,
            solSpent: participant.amountLamports,
            tokensReceived,
            signature,
            status: 'confirmed',
          });

          succeeded = true;

          this.eventBus.emit(
            'bundle:buy-confirmed',
            'bundle',
            'bundle-coordinator',
            {
              bundleId: plan.id,
              wallet: participant.wallet.address,
              solSpent: participant.amountLamports.toString(),
              tokensReceived: tokensReceived.toString(),
              signature,
              attempt: attempt + 1,
            },
          );

          break;
        } catch (error) {
          lastError =
            error instanceof Error ? error.message : String(error);
          this.logger.warn(
            `Buy attempt ${attempt + 1}/${MAX_STAGGER_RETRIES} failed for ${participant.wallet.label}`,
            { error: lastError },
          );

          if (attempt < MAX_STAGGER_RETRIES - 1) {
            const backoff = RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
            await sleep(backoff);
          }
        }
      }

      if (!succeeded) {
        participant.status = 'failed';
        walletResults.push({
          wallet: participant.wallet.address,
          solSpent: new BN(0),
          tokensReceived: new BN(0),
          signature: '',
          status: 'failed',
          error: lastError ?? 'Unknown error',
        });

        this.eventBus.emit(
          'bundle:buy-failed',
          'bundle',
          'bundle-coordinator',
          {
            bundleId: plan.id,
            wallet: participant.wallet.address,
            error: lastError,
          },
        );
      }
    }

    return this.buildResult(plan, walletResults, startTime, false);
  }

  // ─── Create + Bundle (Jito) ───────────────────────────────

  /**
   * Build a create transaction, then all buy transactions, and submit
   * them as a single Jito bundle for same-slot execution.
   */
  private async executeJitoCreateAndBundle(
    plan: BundlePlan,
    narrative: TokenNarrative,
    mintKeypair: Keypair,
    creatorWallet: AgentWallet,
    buyerWallets: AgentWallet[],
    allocations: BN[],
    devBuySol: BN,
    startTime: number,
  ): Promise<BundleResult> {
    if (!this.jitoClient) {
      throw new Error('[BundleCoordinator] Jito client not configured');
    }

    const sdk = this.getOnlineSdk();
    const transactions: Transaction[] = [];
    const { blockhash } = await this.connection.getLatestBlockhash('confirmed');

    // ── Step 1: Build create + dev buy transaction ──────────
    try {
      const global = await sdk.fetchGlobal();
      const creatorPubkey = creatorWallet.keypair.publicKey;

      const computeIxs = [
        ComputeBudgetProgram.setComputeUnitLimit({ units: 250_000 }),
        ComputeBudgetProgram.setComputeUnitPrice({
          microLamports: Math.round(
            BASE_PRIORITY_FEE_MICRO_LAMPORTS * this.config.priorityFeeMultiplier,
          ),
        }),
      ];

      let createIxs;
      if (devBuySol.gtn(0)) {
        createIxs = await PUMP_SDK.createV2AndBuyInstructions({
          global,
          creator: creatorPubkey,
          user: creatorPubkey,
          mint: mintKeypair.publicKey,
          name: narrative.name,
          symbol: narrative.symbol,
          uri: narrative.metadataUri!,
          amount: new BN(0),
          solAmount: devBuySol,
          mayhemMode: false,
        });
      } else {
        const createIx = await PUMP_SDK.createV2Instruction({
          creator: creatorPubkey,
          user: creatorPubkey,
          mint: mintKeypair.publicKey,
          name: narrative.name,
          symbol: narrative.symbol,
          uri: narrative.metadataUri!,
          mayhemMode: false,
        });
        createIxs = [createIx];
      }

      const createTx = new Transaction({
        recentBlockhash: blockhash,
        feePayer: creatorPubkey,
      });
      createTx.add(...computeIxs, ...createIxs);
      createTx.sign(creatorWallet.keypair, mintKeypair);

      transactions.push(createTx);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(
        'Failed to build create transaction',
        new Error(errMsg),
      );
      return this.buildResult(plan, [], startTime, true);
    }

    // ── Step 2: Build buy transactions for each bundle wallet ──
    const mintPubkey = mintKeypair.publicKey;
    const participantMap: Map<number, { walletAddr: string; solAmount: BN }> =
      new Map();

    for (let i = 0; i < buyerWallets.length; i++) {
      const wallet = buyerWallets[i];
      const solAmount = allocations[i];

      try {
        // For Jito create+bundle, we can't fetch buy state because the token
        // doesn't exist yet. Build the buy instruction with predicted accounts.
        const associatedUser = getAssociatedTokenAddressSync(
          mintPubkey,
          wallet.keypair.publicKey,
          false,
          TOKEN_PROGRAM_ID,
        );

        // Build a buy using the predicted bonding curve state after creation
        const global = await sdk.fetchGlobal();
        const buyIx = await PUMP_SDK.buyInstruction({
          global,
          mint: mintPubkey,
          creator: creatorWallet.keypair.publicKey,
          user: wallet.keypair.publicKey,
          associatedUser,
          amount: new BN(0),
          solAmount,
          slippage: this.config.slippageBps / 100,
          tokenProgram: TOKEN_PROGRAM_ID,
        });

        const priorityFee = Math.round(
          BASE_PRIORITY_FEE_MICRO_LAMPORTS * this.config.priorityFeeMultiplier,
        );

        const computeIxs = [
          ComputeBudgetProgram.setComputeUnitLimit({ units: COMPUTE_UNIT_LIMIT }),
          ComputeBudgetProgram.setComputeUnitPrice({
            microLamports: priorityFee,
          }),
        ];

        const buyTx = new Transaction({
          recentBlockhash: blockhash,
          feePayer: wallet.keypair.publicKey,
        });
        buyTx.add(...computeIxs, buyIx);

        // Add Jito tip to the last buy transaction
        if (i === buyerWallets.length - 1) {
          await this.jitoClient.addTipInstruction(
            buyTx,
            plan.jitoConfig?.tipLamports ?? 10_000,
          );
        }

        buyTx.sign(wallet.keypair);
        transactions.push(buyTx);
        participantMap.set(transactions.length - 1, {
          walletAddr: wallet.address,
          solAmount,
        });
      } catch (error) {
        const errMsg =
          error instanceof Error ? error.message : String(error);
        this.logger.warn(
          `Failed to build buy tx for ${wallet.label}: ${errMsg}`,
        );
      }
    }

    // ── Step 3: Submit Jito bundle ──────────────────────────
    const jitoBundleResult = await this.jitoClient.sendBundle(transactions);

    if (jitoBundleResult.status === 'failed') {
      this.logger.error(
        'Jito create+bundle submission failed',
        new Error(jitoBundleResult.error ?? 'Unknown Jito error'),
      );
      return this.buildResult(plan, [], startTime, true);
    }

    // Wait for confirmation
    const confirmation = await this.jitoClient.waitForBundleConfirmation(
      jitoBundleResult.bundleId,
    );

    const walletResults: BundleResult['results'] = [];

    if (confirmation.status === 'landed') {
      // Creator dev buy
      const devTokens = estimateTokensOut(
        devBuySol,
        INITIAL_VIRTUAL_SOL,
        INITIAL_VIRTUAL_TOKENS,
      );
      walletResults.push({
        wallet: creatorWallet.address,
        solSpent: devBuySol,
        tokensReceived: devTokens,
        signature: jitoBundleResult.signatures[0] ?? '',
        status: 'confirmed',
      });

      // Cumulative SOL to track bonding curve movement
      let cumulativeSol = devBuySol.clone();

      // Bundle buyer results
      for (const [txIndex, info] of participantMap) {
        // Estimate tokens based on cumulative SOL spent
        // After each buy, the reserves shift
        const currentVirtualSol = INITIAL_VIRTUAL_SOL.add(cumulativeSol);
        const currentVirtualTokens = INITIAL_VIRTUAL_SOL.mul(INITIAL_VIRTUAL_TOKENS).div(currentVirtualSol);
        const tokensReceived = estimateTokensOut(
          info.solAmount,
          currentVirtualSol,
          currentVirtualTokens,
        );

        cumulativeSol = cumulativeSol.add(info.solAmount);

        const participant = plan.participants.find(
          (p) => p.wallet.address === info.walletAddr,
        );
        if (participant) {
          participant.status = 'confirmed';
          participant.signature = jitoBundleResult.signatures[txIndex] ?? '';
          participant.tokensReceived = tokensReceived;
        }

        walletResults.push({
          wallet: info.walletAddr,
          solSpent: info.solAmount,
          tokensReceived,
          signature: jitoBundleResult.signatures[txIndex] ?? '',
          status: 'confirmed',
        });
      }
    } else {
      // All failed
      walletResults.push({
        wallet: creatorWallet.address,
        solSpent: new BN(0),
        tokensReceived: new BN(0),
        signature: '',
        status: 'failed',
        error: confirmation.error ?? `Bundle status: ${confirmation.status}`,
      });

      for (const [, info] of participantMap) {
        walletResults.push({
          wallet: info.walletAddr,
          solSpent: new BN(0),
          tokensReceived: new BN(0),
          signature: '',
          status: 'failed',
          error: confirmation.error ?? `Bundle status: ${confirmation.status}`,
        });
      }
    }

    return this.buildResult(plan, walletResults, startTime, true);
  }

  // ─── Create + Bundle (Stagger) ────────────────────────────

  /**
   * Create the token, then execute sequential buys with staggered delays.
   */
  private async executeStaggerCreateAndBundle(
    plan: BundlePlan,
    narrative: TokenNarrative,
    mintKeypair: Keypair,
    creatorWallet: AgentWallet,
    buyerWallets: AgentWallet[],
    allocations: BN[],
    devBuySol: BN,
    startTime: number,
  ): Promise<BundleResult> {
    const sdk = this.getOnlineSdk();
    const walletResults: BundleResult['results'] = [];
    const creatorPubkey = creatorWallet.keypair.publicKey;

    // ── Step 1: Create token with dev buy ───────────────────
    let mintAddress: string;
    try {
      const global = await sdk.fetchGlobal();

      const computeIxs = [
        ComputeBudgetProgram.setComputeUnitLimit({ units: 250_000 }),
        ComputeBudgetProgram.setComputeUnitPrice({
          microLamports: Math.round(
            BASE_PRIORITY_FEE_MICRO_LAMPORTS * this.config.priorityFeeMultiplier,
          ),
        }),
      ];

      let createIxs;
      if (devBuySol.gtn(0)) {
        createIxs = await PUMP_SDK.createV2AndBuyInstructions({
          global,
          creator: creatorPubkey,
          user: creatorPubkey,
          mint: mintKeypair.publicKey,
          name: narrative.name,
          symbol: narrative.symbol,
          uri: narrative.metadataUri!,
          amount: new BN(0),
          solAmount: devBuySol,
          mayhemMode: false,
        });
      } else {
        const createIx = await PUMP_SDK.createV2Instruction({
          creator: creatorPubkey,
          user: creatorPubkey,
          mint: mintKeypair.publicKey,
          name: narrative.name,
          symbol: narrative.symbol,
          uri: narrative.metadataUri!,
          mayhemMode: false,
        });
        createIxs = [createIx];
      }

      const { blockhash } = await this.connection.getLatestBlockhash('confirmed');
      const tx = new Transaction({
        recentBlockhash: blockhash,
        feePayer: creatorPubkey,
      });
      tx.add(...computeIxs, ...createIxs);

      const signature = await sendAndConfirmTransaction(
        this.connection,
        tx,
        [creatorWallet.keypair, mintKeypair],
        { commitment: 'confirmed', maxRetries: 3 },
      );

      mintAddress = mintKeypair.publicKey.toBase58();
      plan.mint = mintAddress;

      const devTokens = devBuySol.gtn(0)
        ? await this.fetchTokensReceived(
            mintKeypair.publicKey,
            creatorPubkey,
          )
        : new BN(0);

      walletResults.push({
        wallet: creatorWallet.address,
        solSpent: devBuySol,
        tokensReceived: devTokens,
        signature,
        status: 'confirmed',
      });

      this.logger.info('Token created successfully', {
        mint: mintAddress,
        devBuySol: devBuySol.toString(),
        devTokens: devTokens.toString(),
        signature,
      });
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      this.logger.error('Token creation failed', new Error(errMsg));

      walletResults.push({
        wallet: creatorWallet.address,
        solSpent: new BN(0),
        tokensReceived: new BN(0),
        signature: '',
        status: 'failed',
        error: errMsg,
      });

      return this.buildResult(plan, walletResults, startTime, false);
    }

    // ── Step 2: Execute staggered buys ──────────────────────
    const mintPubkey = mintKeypair.publicKey;

    for (let i = 0; i < buyerWallets.length; i++) {
      const wallet = buyerWallets[i];
      const solAmount = allocations[i];
      const participant = plan.participants[i];

      // Stagger delay
      const delay = randomInRange(
        this.config.staggerDelayMs.min,
        this.config.staggerDelayMs.max,
      );
      if (delay > 0) {
        await sleep(delay);
      }

      let lastError: string | undefined;
      let succeeded = false;

      for (let attempt = 0; attempt < MAX_STAGGER_RETRIES; attempt++) {
        try {
          const global = await sdk.fetchGlobal();
          const buyState = await sdk.fetchBuyState(
            mintPubkey,
            wallet.keypair.publicKey,
            TOKEN_PROGRAM_ID,
          );

          const buyIxs = await PUMP_SDK.buyInstructions({
            global,
            bondingCurveAccountInfo: buyState.bondingCurveAccountInfo,
            bondingCurve: buyState.bondingCurve,
            associatedUserAccountInfo: buyState.associatedUserAccountInfo,
            mint: mintPubkey,
            user: wallet.keypair.publicKey,
            amount: new BN(0),
            solAmount,
            slippage: this.config.slippageBps / 100,
            tokenProgram: TOKEN_PROGRAM_ID,
          });

          const priorityFee = Math.round(
            BASE_PRIORITY_FEE_MICRO_LAMPORTS * this.config.priorityFeeMultiplier,
          );

          const computeIxs = [
            ComputeBudgetProgram.setComputeUnitLimit({ units: COMPUTE_UNIT_LIMIT }),
            ComputeBudgetProgram.setComputeUnitPrice({
              microLamports: priorityFee,
            }),
          ];

          const { blockhash: bh } = await this.connection.getLatestBlockhash('confirmed');
          const buyTx = new Transaction({
            recentBlockhash: bh,
            feePayer: wallet.keypair.publicKey,
          });
          buyTx.add(...computeIxs, ...buyIxs);

          const sig = await sendAndConfirmTransaction(
            this.connection,
            buyTx,
            [wallet.keypair],
            { commitment: 'confirmed', maxRetries: 3 },
          );

          const tokensReceived = await this.fetchTokensReceived(
            mintPubkey,
            wallet.keypair.publicKey,
          );

          if (participant) {
            participant.status = 'confirmed';
            participant.signature = sig;
            participant.tokensReceived = tokensReceived;
          }

          walletResults.push({
            wallet: wallet.address,
            solSpent: solAmount,
            tokensReceived,
            signature: sig,
            status: 'confirmed',
          });

          succeeded = true;
          break;
        } catch (error) {
          lastError =
            error instanceof Error ? error.message : String(error);
          this.logger.warn(
            `Buy attempt ${attempt + 1}/${MAX_STAGGER_RETRIES} failed for ${wallet.label}`,
            { error: lastError },
          );

          if (attempt < MAX_STAGGER_RETRIES - 1) {
            const backoff = RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
            await sleep(backoff);
          }
        }
      }

      if (!succeeded) {
        if (participant) {
          participant.status = 'failed';
        }

        walletResults.push({
          wallet: wallet.address,
          solSpent: new BN(0),
          tokensReceived: new BN(0),
          signature: '',
          status: 'failed',
          error: lastError ?? 'Unknown error',
        });
      }
    }

    return this.buildResult(plan, walletResults, startTime, false);
  }

  // ─── SOL Distribution ─────────────────────────────────────

  /**
   * Distribute SOL across wallets according to the configured strategy.
   */
  private distributeSOL(
    totalSol: BN,
    walletCount: number,
    strategy: 'even' | 'weighted' | 'random',
  ): BN[] {
    switch (strategy) {
      case 'even':
        return this.distributeEven(totalSol, walletCount);
      case 'weighted':
        return this.distributeWeighted(totalSol, walletCount);
      case 'random':
        return this.distributeRandom(totalSol, walletCount);
    }
  }

  /**
   * Equal distribution: each wallet gets totalSol / walletCount.
   * Remainder goes to the first wallet.
   */
  private distributeEven(totalSol: BN, count: number): BN[] {
    const perWallet = totalSol.div(new BN(count));
    const remainder = totalSol.mod(new BN(count));
    const allocations: BN[] = [];

    for (let i = 0; i < count; i++) {
      allocations.push(i === 0 ? perWallet.add(remainder) : perWallet.clone());
    }

    return allocations;
  }

  /**
   * Weighted distribution: first wallets get larger amounts (linearly
   * decreasing weights). The first wallet (closest to creator) gets the
   * largest allocation.
   */
  private distributeWeighted(totalSol: BN, count: number): BN[] {
    const weights: number[] = [];
    let totalWeight = 0;

    for (let i = 0; i < count; i++) {
      const weight = count - i; // First wallet gets highest weight
      weights.push(weight);
      totalWeight += weight;
    }

    const allocations: BN[] = [];
    let allocated = new BN(0);

    for (let i = 0; i < count; i++) {
      const share =
        i === count - 1
          ? totalSol.sub(allocated) // Last wallet gets remainder
          : totalSol.mul(new BN(weights[i])).div(new BN(totalWeight));

      // Enforce minimum
      const clamped = BN.max(share, MIN_SOL_PER_WALLET);
      allocations.push(clamped);
      allocated = allocated.add(clamped);
    }

    return allocations;
  }

  /**
   * Random distribution: wallets get random amounts between 20% and 300%
   * of the average, normalized to sum to totalSol exactly.
   */
  private distributeRandom(totalSol: BN, count: number): BN[] {
    const rawShares: number[] = [];
    let rawTotal = 0;

    for (let i = 0; i < count; i++) {
      const share = Math.random() * 0.8 + 0.2; // 0.2 – 1.0
      rawShares.push(share);
      rawTotal += share;
    }

    const allocations: BN[] = [];
    let allocated = new BN(0);

    for (let i = 0; i < count; i++) {
      if (i === count - 1) {
        // Last wallet gets the remainder
        const remaining = totalSol.sub(allocated);
        allocations.push(BN.max(remaining, MIN_SOL_PER_WALLET));
      } else {
        const rawAllocation = totalSol
          .mul(new BN(Math.floor(rawShares[i] * 1_000_000)))
          .div(new BN(Math.floor(rawTotal * 1_000_000)));

        const clamped = BN.max(rawAllocation, MIN_SOL_PER_WALLET);
        allocations.push(clamped);
        allocated = allocated.add(clamped);
      }
    }

    return allocations;
  }

  // ─── Supply Estimation ────────────────────────────────────

  /**
   * Estimate the percentage of total supply acquired from a given SOL buy.
   *
   * Uses constant product formula on the bonding curve.
   */
  private estimateSupplyPercent(
    totalSolIn: BN,
    virtualSolReserves: BN,
    virtualTokenReserves: BN,
  ): number {
    const tokensOut = estimateTokensOut(
      totalSolIn,
      virtualSolReserves,
      virtualTokenReserves,
    );
    // Supply percent = (tokensOut / TOTAL_SUPPLY) * 100
    // Use floating point for the final percentage
    const tokensOutNum = tokensOut.toNumber();
    const totalSupplyNum = TOTAL_SUPPLY.toNumber();

    if (totalSupplyNum === 0) return 0;
    return (tokensOutNum / totalSupplyNum) * 100;
  }

  // ─── Helpers ──────────────────────────────────────────────

  /**
   * Fetch the token balance for a wallet (real on-chain data).
   */
  private async fetchTokensReceived(
    mint: PublicKey,
    owner: PublicKey,
  ): Promise<BN> {
    try {
      const { getAssociatedTokenAddress } = await import('@solana/spl-token');
      const ata = await getAssociatedTokenAddress(mint, owner);
      const balance = await this.connection.getTokenAccountBalance(ata);
      return new BN(balance.value.amount);
    } catch {
      // Token account may not exist if the buy failed
      return new BN(0);
    }
  }

  /**
   * Get or create the OnlinePumpSdk instance.
   */
  private getOnlineSdk(): OnlinePumpSdk {
    if (!this.onlineSdk) {
      this.onlineSdk = new OnlinePumpSdk(this.connection);
    }
    return this.onlineSdk;
  }

  /**
   * Allocate wallets from the vault for the bundle.
   * Uses the 'trader' role for wallet assignments.
   */
  private allocateWallets(count: number): AgentWallet[] {
    const wallets: AgentWallet[] = [];
    for (let i = 0; i < count; i++) {
      const agentId = `bundle-${uuidv4().slice(0, 8)}`;
      const wallet = this.walletVault.getWallet('trader', agentId);
      wallets.push(wallet);
    }
    return wallets;
  }

  /**
   * Validate bundle parameters.
   */
  private validateBundleParams(totalSol: BN, walletCount: number): void {
    if (totalSol.isZero() || totalSol.isNeg()) {
      throw new Error('[BundleCoordinator] totalSol must be positive');
    }
    if (totalSol.gt(this.config.maxTotalSol)) {
      throw new Error(
        `[BundleCoordinator] totalSol (${totalSol.toString()}) exceeds maxTotalSol (${this.config.maxTotalSol.toString()})`,
      );
    }
    if (walletCount <= 0) {
      throw new Error('[BundleCoordinator] walletCount must be positive');
    }
    if (walletCount > this.config.maxWalletsPerBundle) {
      this.logger.warn(
        `Requested ${walletCount} wallets, capping to max ${this.config.maxWalletsPerBundle}`,
      );
    }
  }

  /**
   * Build a BundleResult from individual wallet results.
   */
  private buildResult(
    plan: BundlePlan,
    walletResults: BundleResult['results'],
    startTime: number,
    isJito: boolean,
  ): BundleResult {
    const confirmedResults = walletResults.filter(
      (r) => r.status === 'confirmed',
    );
    const totalSolSpent = confirmedResults.reduce(
      (sum, r) => sum.add(r.solSpent),
      new BN(0),
    );
    const totalTokensReceived = confirmedResults.reduce(
      (sum, r) => sum.add(r.tokensReceived),
      new BN(0),
    );

    const totalSupplyNum = TOTAL_SUPPLY.toNumber();
    const estimatedSupplyPercent =
      totalSupplyNum > 0
        ? (totalTokensReceived.toNumber() / totalSupplyNum) * 100
        : 0;

    let status: BundleResult['status'];
    if (confirmedResults.length === 0) {
      status = 'failed';
    } else if (confirmedResults.length === walletResults.length) {
      status = 'success';
    } else {
      status = 'partial';
    }

    return {
      bundleId: plan.id,
      mint: plan.mint ?? '',
      plan,
      status,
      results: walletResults,
      totalSolSpent,
      totalTokensReceived,
      estimatedSupplyPercent,
      executionTimeMs: Date.now() - startTime,
      jitoBundle: isJito,
    };
  }
}
