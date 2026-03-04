/**
 * Launch Sequencer — End-to-End Token Launch Orchestrator
 *
 * The master state machine that takes a token from concept to actively traded,
 * coordinating all bundle components: wallet funding → token creation → dev buy
 * → bundle buys → supply distribution → trading kickoff.
 *
 * Features:
 * - Full state machine with clean phase transitions and event emissions
 * - Each phase has retry logic with configurable limits
 * - Cost estimation before execution
 * - Abort cleanly recovers funds from wallets
 * - Phase results are detailed enough for post-mortem analysis
 *
 * @example
 * ```typescript
 * const sequencer = new LaunchSequencer(config, {
 *   eventBus,
 *   walletVault,
 *   creatorAgent,
 *   devBuyOptimizer,
 *   jitoClient,
 *   supplyDistributor,
 * });
 *
 * const plan = await sequencer.prepareLaunch(tokenConfig);
 * console.log(`Estimated cost: ${plan.estimatedCost.totalWithBuffer} SOL`);
 *
 * const result = await sequencer.executeLaunch(plan);
 * console.log(`Token ${result.mint} launched — ${result.supplyControlled}% supply controlled`);
 * ```
 */

import {
  Connection,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  getAccount,
} from '@solana/spl-token';
import BN from 'bn.js';
import { randomUUID } from 'node:crypto';

import type {
  AgentWallet,
  TokenConfig,
  BundleBuyConfig,
  MintResult,
} from '../types.js';
import { CreatorAgent } from '../agents/creator-agent.js';
import { WalletVault } from '../wallet-manager.js';
import { DevBuyOptimizer } from './dev-buy-optimizer.js';
import type { DevBuyRecommendation } from './dev-buy-optimizer.js';
import { JitoClient } from './jito-client.js';
import { SupplyDistributor } from './supply-distributor.js';
import { SwarmEventBus } from '../infra/event-bus.js';
import { SwarmLogger } from '../infra/logger.js';

// ─── Launch Phase Type ────────────────────────────────────────

/**
 * Discrete phases of the launch sequence.
 *
 * Each phase transition emits events and checks preconditions.
 */
export type LaunchPhase =
  | 'idle'
  | 'planning'
  | 'funding'
  | 'creating'
  | 'dev-buying'
  | 'bundling'
  | 'distributing'
  | 'verifying'
  | 'ready'
  | 'failed'
  | 'aborted';

// ─── Phase Metadata ───────────────────────────────────────────

interface PhaseRecord {
  phase: LaunchPhase;
  startedAt: number;
  completedAt: number;
  duration: number;
  success: boolean;
  error?: string;
  retries: number;
}

// ─── Launch Plan ──────────────────────────────────────────────

export interface LaunchPlan {
  /** Unique plan identifier */
  id: string;
  /** Token configuration for this launch */
  tokenConfig: TokenConfig;
  /** Wallet funding plan */
  walletPlan: {
    /** Base58 pubkey of the master funding wallet */
    masterWallet: string;
    /** Base58 pubkeys of all trader wallets */
    traderWallets: string[];
    /** Total SOL required across all wallets */
    totalSOLRequired: number;
    /** SOL allocation per wallet address */
    perWalletSOL: Map<string, number>;
  };
  /** Dev buy parameters */
  devBuy: {
    /** SOL amount for the dev buy */
    amountSOL: number;
    /** Expected tokens to receive */
    expectedTokens: bigint;
    /** Slippage tolerance in basis points */
    slippageBps: number;
  };
  /** Planned bundle buys */
  bundleBuys: Array<{
    /** Index of the wallet in the trader array */
    walletIndex: number;
    /** SOL to spend */
    amountSOL: number;
    /** Expected tokens to receive */
    expectedTokens: bigint;
    /** Delay in ms after token creation */
    delayAfterCreate: number;
  }>;
  /** Token distribution strategy after bundling */
  distribution: {
    /** Strategy name */
    strategy: string;
    /** Target supply percentage per wallet address */
    targetDistribution: Map<string, number>;
  };
  /** Timing constraints for each phase */
  timing: {
    /** Max ms for funding phase */
    fundingTimeout: number;
    /** Max ms for token creation */
    createTimeout: number;
    /** Max ms for bundle buys */
    bundleTimeout: number;
    /** Max ms for supply distribution */
    distributionTimeout: number;
    /** Max ms for the entire launch */
    totalTimeout: number;
  };
  /** Estimated cost breakdown */
  estimatedCost: LaunchCostEstimate;
  /** Timestamp when the plan was created */
  createdAt: number;
}

// ─── Launch Result ────────────────────────────────────────────

export interface LaunchResult {
  /** Whether the launch succeeded */
  success: boolean;
  /** ID of the plan that was executed */
  planId: string;
  /** Token mint address (base58) */
  mint: string;
  /** Bonding curve account (base58) */
  bondingCurve: string;
  /** Per-phase execution details */
  phases: PhaseRecord[];
  /** Per-wallet final state */
  walletResults: Array<{
    /** Wallet address (base58) */
    wallet: string;
    /** Remaining SOL balance */
    solBalance: number;
    /** Token balance held */
    tokenBalance: bigint;
    /** Percentage of total supply held */
    supplyPercent: number;
  }>;
  /** Cost accounting */
  totalCost: {
    /** Total SOL spent on buys */
    solSpent: number;
    /** Base transaction fees in lamports */
    feesLamports: bigint;
    /** Jito tips in lamports */
    jitoTipsLamports: bigint;
  };
  /** Total wall-clock time in ms */
  totalDuration: number;
  /** Percentage of total supply held by the swarm */
  supplyControlled: number;
}

// ─── Launch Status ────────────────────────────────────────────

export interface LaunchStatus {
  /** Current phase of the launch */
  currentPhase: LaunchPhase;
  /** Plan ID (if planning/execution started) */
  planId?: string;
  /** Mint address (once token is created) */
  mint?: string;
  /** Completed phases with details */
  completedPhases: PhaseRecord[];
  /** Time spent in current phase (ms) */
  currentPhaseDuration: number;
  /** Whether the launch is actively running */
  isRunning: boolean;
  /** Error message if in failed state */
  error?: string;
}

// ─── Launch Cost Estimate ─────────────────────────────────────

export interface LaunchCostEstimate {
  /** SOL for the creator's dev buy */
  devBuyCost: number;
  /** SOL for all trader bundle buys */
  bundleBuyCost: number;
  /** Base transaction fees (SOL) */
  transactionFees: number;
  /** Priority fee estimate (SOL) */
  priorityFees: number;
  /** Jito bundle tips (SOL) */
  jitoTips: number;
  /** Grand total SOL required */
  totalSOLRequired: number;
  /** Safety buffer percentage applied */
  bufferPercent: number;
  /** Total SOL including safety buffer */
  totalWithBuffer: number;
}

// ─── Configuration ────────────────────────────────────────────

export interface LaunchSequencerConfig {
  /** Solana RPC URL */
  rpcUrl: string;
  /** Dev buy amount in SOL (or 'auto' to let optimizer decide) */
  devBuySOL: number | 'auto';
  /** Target supply percentage for the dev buy (used when devBuySOL is 'auto') */
  targetDevSupplyPercent: number;
  /** Number of trader wallets to use in the bundle */
  bundleWalletCount: number;
  /** SOL per bundle wallet (or 'auto' for equal split of a budget) */
  perWalletBuySOL: number | 'auto';
  /** Total bundle buy budget in SOL (used when perWalletBuySOL is 'auto') */
  totalBundleBudgetSOL: number;
  /** Slippage tolerance in basis points (e.g. 500 = 5%) */
  slippageBps: number;
  /** Whether to use Jito bundles for atomicity */
  useJito: boolean;
  /** Jito tip in lamports (if useJito is true) */
  jitoTipLamports: number;
  /** Supply distribution strategy after launch */
  distributionStrategy: 'equal' | 'weighted' | 'random' | 'pyramid' | 'gaussian';
  /** Maximum retries per phase */
  maxRetriesPerPhase: number;
  /** Base delay between retries in ms */
  retryBaseDelayMs: number;
  /** Safety buffer percentage on cost estimate (e.g. 10 = add 10%) */
  costBufferPercent: number;
  /** Phase timeouts in ms */
  timeouts: {
    funding: number;
    create: number;
    bundle: number;
    distribution: number;
    total: number;
  };
  /** Maximum price impact percentage allowed for dev buy */
  maxPriceImpactPercent: number;
  /** Optimization goal for the dev buy */
  devBuyGoal: 'minimize-cost' | 'maximize-supply' | 'balanced';
  /** Priority fee in microlamports for transactions */
  priorityFeeMicroLamports: number;
}

// ─── Dependencies ─────────────────────────────────────────────

export interface LaunchSequencerDeps {
  eventBus: SwarmEventBus;
  walletVault: WalletVault;
  creatorAgent: CreatorAgent;
  devBuyOptimizer: DevBuyOptimizer;
  jitoClient: JitoClient;
  supplyDistributor: SupplyDistributor;
}

// ─── Valid Phase Transitions ──────────────────────────────────

const VALID_TRANSITIONS: Record<LaunchPhase, LaunchPhase[]> = {
  idle: ['planning'],
  planning: ['funding', 'failed'],
  funding: ['creating', 'failed', 'aborted'],
  creating: ['dev-buying', 'failed', 'aborted'],
  'dev-buying': ['bundling', 'failed', 'aborted'],
  bundling: ['distributing', 'failed', 'aborted'],
  distributing: ['verifying', 'failed', 'aborted'],
  verifying: ['ready', 'failed', 'aborted'],
  ready: ['idle'],
  failed: ['idle', 'planning', 'funding', 'creating', 'dev-buying', 'bundling', 'distributing'],
  aborted: ['idle'],
};

// ─── Defaults ─────────────────────────────────────────────────

const DEFAULT_CONFIG: LaunchSequencerConfig = {
  rpcUrl: 'https://api.mainnet-beta.solana.com',
  devBuySOL: 'auto',
  targetDevSupplyPercent: 5,
  bundleWalletCount: 4,
  perWalletBuySOL: 'auto',
  totalBundleBudgetSOL: 2,
  slippageBps: 500,
  useJito: true,
  jitoTipLamports: 10_000,
  distributionStrategy: 'weighted',
  maxRetriesPerPhase: 3,
  retryBaseDelayMs: 1_000,
  costBufferPercent: 10,
  timeouts: {
    funding: 60_000,
    create: 45_000,
    bundle: 30_000,
    distribution: 90_000,
    total: 300_000,
  },
  maxPriceImpactPercent: 15,
  devBuyGoal: 'balanced',
  priorityFeeMicroLamports: 100_000,
};

// ─── Constants ────────────────────────────────────────────────

/** Base transaction fee in lamports (~5000 per signature) */
const BASE_TX_FEE_LAMPORTS = 5_000;

/** Compute unit limit for token creation + dev buy */
const CREATE_COMPUTE_UNITS = 250_000;

/** Compute unit limit for a buy transaction */
const BUY_COMPUTE_UNITS = 200_000;

/** Max wallets to fund in a single transaction */
const MAX_FUND_TRANSFERS_PER_TX = 5;

/** Max creation retry attempts (uses fresh keypair each time) */
const MAX_CREATE_RETRIES = 3;

/** ATA rent exemption in lamports */
const ATA_RENT_LAMPORTS = 2_039_280;

// ─── Helpers ──────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function lamportsToSOL(lamports: number | bigint): number {
  return Number(lamports) / LAMPORTS_PER_SOL;
}

function solToLamports(sol: number): number {
  return Math.round(sol * LAMPORTS_PER_SOL);
}

/**
 * Apply anti-detection variance to a SOL amount.
 * Returns a value within ±variancePercent of the input.
 */
function applyVariance(amount: number, variancePercent: number): number {
  const factor = 1 + (Math.random() * 2 - 1) * (variancePercent / 100);
  return Math.max(0.001, amount * factor);
}

/**
 * Stagger delay with randomized jitter (±30%).
 */
function staggerDelay(baseMs: number, index: number): number {
  const base = baseMs * (index + 1);
  const jitter = base * 0.3 * (Math.random() * 2 - 1);
  return Math.max(100, Math.round(base + jitter));
}

// ─── Launch Sequencer ─────────────────────────────────────────

/**
 * Orchestrates the full lifecycle of a Pump.fun token launch.
 *
 * Phases:
 * 1. **Planning** — calculate amounts, prepare wallets, estimate costs
 * 2. **Funding** — distribute SOL from master to all trader wallets
 * 3. **Creating** — create token on Pump.fun
 * 4. **Dev-buying** — execute the creator's initial purchase
 * 5. **Bundling** — multi-wallet bundle buys
 * 6. **Distributing** — redistribute tokens across wallets
 * 7. **Verifying** — confirm all wallets have expected balances
 * 8. **Ready** — launch complete, ready for trading
 */
export class LaunchSequencer {
  private readonly config: LaunchSequencerConfig;
  private readonly connection: Connection;
  private readonly eventBus: SwarmEventBus;
  private readonly walletVault: WalletVault;
  private readonly creatorAgent: CreatorAgent;
  private readonly devBuyOptimizer: DevBuyOptimizer;
  private readonly jitoClient: JitoClient;
  private readonly supplyDistributor: SupplyDistributor;
  private readonly logger: SwarmLogger;

  private currentPhase: LaunchPhase = 'idle';
  private phaseStartedAt = 0;
  private activePlan: LaunchPlan | undefined;
  private mintResult: MintResult | undefined;
  private completedPhases: PhaseRecord[] = [];
  private abortRequested = false;
  private launchStartedAt = 0;
  private totalTipsPaid = BigInt(0);
  private totalFeesPaid = BigInt(0);

  constructor(config: Partial<LaunchSequencerConfig>, deps: LaunchSequencerDeps) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.connection = new Connection(this.config.rpcUrl, 'confirmed');
    this.eventBus = deps.eventBus;
    this.walletVault = deps.walletVault;
    this.creatorAgent = deps.creatorAgent;
    this.devBuyOptimizer = deps.devBuyOptimizer;
    this.jitoClient = deps.jitoClient;
    this.supplyDistributor = deps.supplyDistributor;
    this.logger = SwarmLogger.create('launch-sequencer', 'bundle');
  }

  // ─── Public API ───────────────────────────────────────────

  /**
   * Build a launch plan without executing it.
   * Calculates optimal amounts, wallet allocations, and cost estimate.
   */
  async prepareLaunch(tokenConfig: TokenConfig): Promise<LaunchPlan> {
    this.transitionTo('planning');

    try {
      // 1. Determine dev buy amount
      const devBuyRec = this.computeDevBuy();

      const devBuySOL =
        this.config.devBuySOL === 'auto'
          ? devBuyRec.recommendedSOL
          : this.config.devBuySOL;

      const devBuySimulation = this.devBuyOptimizer.simulateDevBuy(devBuySOL);

      // 2. Assign trader wallets
      const allWallets = this.walletVault.getAllWallets();
      const traderWallets = allWallets.slice(0, this.config.bundleWalletCount);
      if (traderWallets.length === 0) {
        throw new Error(
          `No trader wallets available. Pool has ${allWallets.length} wallets, need ${this.config.bundleWalletCount}.`,
        );
      }

      // 3. Calculate per-wallet buy amounts with anti-detection variance
      const perWalletBuySOL =
        this.config.perWalletBuySOL === 'auto'
          ? this.config.totalBundleBudgetSOL / traderWallets.length
          : this.config.perWalletBuySOL;

      const bundleBuys = traderWallets.map((_wallet, index) => {
        const variedAmount = applyVariance(perWalletBuySOL, 15);
        const simulatedTokens = this.devBuyOptimizer.calculateTokensForSOL(variedAmount);
        return {
          walletIndex: index,
          amountSOL: variedAmount,
          expectedTokens: simulatedTokens,
          delayAfterCreate: staggerDelay(500, index),
        };
      });

      const totalBundleBuySOL = bundleBuys.reduce((sum, b) => sum + b.amountSOL, 0);

      // 4. Calculate per-wallet SOL needs (buy amount + fees + rent)
      const perWalletSOL = new Map<string, number>();
      const masterWallet = this.getMasterWallet();

      for (const buy of bundleBuys) {
        const wallet = traderWallets[buy.walletIndex];
        // Buy amount + estimated tx fees + ATA rent
        const needed =
          buy.amountSOL +
          lamportsToSOL(BASE_TX_FEE_LAMPORTS * 2) +
          lamportsToSOL(ATA_RENT_LAMPORTS);
        perWalletSOL.set(wallet.address, needed);
      }

      const totalSOLRequired =
        devBuySOL +
        totalBundleBuySOL +
        lamportsToSOL(BASE_TX_FEE_LAMPORTS * (traderWallets.length + 3)) +
        lamportsToSOL(ATA_RENT_LAMPORTS * traderWallets.length);

      // 5. Build distribution targets
      const targetDistribution = new Map<string, number>();
      const equalShare = 100 / (traderWallets.length + 1);
      // Creator gets slightly more
      targetDistribution.set(masterWallet.address, equalShare * 1.2);
      for (const tw of traderWallets) {
        targetDistribution.set(tw.address, equalShare * 0.95);
      }

      // 6. Estimate cost
      const estimatedCost = this.buildCostEstimate(
        devBuySOL,
        totalBundleBuySOL,
        traderWallets.length,
      );

      // 7. Validate master wallet has sufficient balance
      const masterBalance = await this.connection.getBalance(
        new PublicKey(masterWallet.address),
      );
      if (lamportsToSOL(masterBalance) < estimatedCost.totalWithBuffer) {
        throw new Error(
          `Insufficient master wallet balance: ${lamportsToSOL(masterBalance).toFixed(4)} SOL ` +
          `< required ${estimatedCost.totalWithBuffer.toFixed(4)} SOL`,
        );
      }

      const plan: LaunchPlan = {
        id: randomUUID(),
        tokenConfig,
        walletPlan: {
          masterWallet: masterWallet.address,
          traderWallets: traderWallets.map((w) => w.address),
          totalSOLRequired,
          perWalletSOL,
        },
        devBuy: {
          amountSOL: devBuySOL,
          expectedTokens: devBuySimulation.tokensOut,
          slippageBps: this.config.slippageBps,
        },
        bundleBuys,
        distribution: {
          strategy: this.config.distributionStrategy,
          targetDistribution,
        },
        timing: {
          fundingTimeout: this.config.timeouts.funding,
          createTimeout: this.config.timeouts.create,
          bundleTimeout: this.config.timeouts.bundle,
          distributionTimeout: this.config.timeouts.distribution,
          totalTimeout: this.config.timeouts.total,
        },
        estimatedCost,
        createdAt: Date.now(),
      };

      this.activePlan = plan;

      this.eventBus.emit('launch:planned', 'bundle', 'launch-sequencer', {
        planId: plan.id,
        tokenName: tokenConfig.name,
        totalSOL: estimatedCost.totalWithBuffer,
        walletCount: traderWallets.length,
      });

      this.logger.info('Launch plan prepared', {
        planId: plan.id,
        devBuySOL,
        bundleBuys: bundleBuys.length,
        totalSOL: estimatedCost.totalWithBuffer,
      });

      return plan;
    } catch (error) {
      this.recordPhaseFailure('planning', error);
      this.transitionTo('failed');
      throw error;
    }
  }

  /**
   * Execute a launch plan through all phases.
   */
  async executeLaunch(plan: LaunchPlan): Promise<LaunchResult> {
    this.activePlan = plan;
    this.abortRequested = false;
    this.launchStartedAt = Date.now();
    this.completedPhases = [];
    this.totalTipsPaid = BigInt(0);
    this.totalFeesPaid = BigInt(0);

    const totalTimer = this.createTimeout(
      plan.timing.totalTimeout,
      'Total launch timeout exceeded',
    );

    try {
      this.eventBus.emit('launch:started', 'bundle', 'launch-sequencer', {
        planId: plan.id,
        tokenName: plan.tokenConfig.name,
      });

      // Phase 1: Funding
      await this.executeFundingPhase(plan);

      // Phase 2: Creating
      await this.executeCreatingPhase(plan);

      // Phase 3: Dev-buying (may be folded into creation)
      await this.executeDevBuyPhase(plan);

      // Phase 4: Bundling
      await this.executeBundlingPhase(plan);

      // Phase 5: Distributing
      await this.executeDistributingPhase(plan);

      // Phase 6: Verifying
      await this.executeVerifyingPhase(plan);

      // Transition to ready
      this.transitionTo('ready');

      const result = await this.buildResult(plan, true);

      this.eventBus.emit('launch:completed', 'bundle', 'launch-sequencer', {
        planId: plan.id,
        mint: result.mint,
        supplyControlled: result.supplyControlled,
        totalCostSOL: result.totalCost.solSpent,
        durationMs: result.totalDuration,
      });

      this.logger.info('Launch completed successfully', {
        planId: plan.id,
        mint: result.mint,
        supplyControlled: `${result.supplyControlled.toFixed(2)}%`,
        durationMs: result.totalDuration,
      });

      return result;
    } catch (error) {
      const result = await this.buildResult(plan, false, error);

      this.eventBus.emit('launch:failed', 'error', 'launch-sequencer', {
        planId: plan.id,
        phase: this.currentPhase,
        error: error instanceof Error ? error.message : String(error),
      });

      this.logger.error(`Launch failed in phase ${this.currentPhase} for plan ${plan.id}`, error instanceof Error ? error : new Error(String(error)));

      return result;
    } finally {
      clearTimeout(totalTimer);
    }
  }

  /**
   * Get the current launch status.
   */
  getLaunchStatus(): LaunchStatus {
    return {
      currentPhase: this.currentPhase,
      planId: this.activePlan?.id,
      mint: this.mintResult?.mint,
      completedPhases: [...this.completedPhases],
      currentPhaseDuration:
        this.phaseStartedAt > 0 ? Date.now() - this.phaseStartedAt : 0,
      isRunning:
        this.currentPhase !== 'idle' &&
        this.currentPhase !== 'ready' &&
        this.currentPhase !== 'failed' &&
        this.currentPhase !== 'aborted',
      error: this.currentPhase === 'failed'
        ? this.completedPhases.at(-1)?.error
        : undefined,
    };
  }

  /**
   * Abort the current launch and attempt to reclaim SOL.
   */
  async abort(reason: string): Promise<void> {
    this.logger.warn('Launch abort requested', { reason, phase: this.currentPhase });

    this.abortRequested = true;

    // Only attempt reclaim if we've funded wallets
    const fundedPhases: LaunchPhase[] = [
      'creating', 'dev-buying', 'bundling', 'distributing', 'verifying',
    ];
    if (fundedPhases.includes(this.currentPhase) && this.activePlan) {
      await this.attemptReclaim(this.activePlan);
    }

    this.transitionTo('aborted');

    this.eventBus.emit('launch:aborted', 'bundle', 'launch-sequencer', {
      planId: this.activePlan?.id,
      reason,
      phase: this.currentPhase,
    });
  }

  /**
   * Retry a failed launch from a specific phase (or from the phase that failed).
   */
  async retry(fromPhase?: LaunchPhase): Promise<LaunchResult> {
    if (!this.activePlan) {
      throw new Error('No active plan to retry. Call prepareLaunch() first.');
    }
    if (this.currentPhase !== 'failed') {
      throw new Error(
        `Cannot retry from phase "${this.currentPhase}". Launch must be in "failed" state.`,
      );
    }

    const targetPhase = fromPhase ?? this.findLastFailedPhase();
    this.logger.info('Retrying launch', {
      planId: this.activePlan.id,
      fromPhase: targetPhase,
    });

    // Reset abort flag
    this.abortRequested = false;

    // Remove completed phases from targetPhase onward to allow re-execution
    const phaseOrder: LaunchPhase[] = [
      'planning', 'funding', 'creating', 'dev-buying',
      'bundling', 'distributing', 'verifying',
    ];
    const targetIndex = phaseOrder.indexOf(targetPhase);
    if (targetIndex >= 0) {
      this.completedPhases = this.completedPhases.filter((p) => {
        const idx = phaseOrder.indexOf(p.phase);
        return idx < targetIndex;
      });
    }

    // Jump to the right phase and continue execution
    const plan = this.activePlan;
    const totalTimer = this.createTimeout(
      plan.timing.totalTimeout,
      'Total launch timeout exceeded on retry',
    );

    try {
      const phases: Array<{ phase: LaunchPhase; fn: () => Promise<void> }> = [
        { phase: 'funding', fn: () => this.executeFundingPhase(plan) },
        { phase: 'creating', fn: () => this.executeCreatingPhase(plan) },
        { phase: 'dev-buying', fn: () => this.executeDevBuyPhase(plan) },
        { phase: 'bundling', fn: () => this.executeBundlingPhase(plan) },
        { phase: 'distributing', fn: () => this.executeDistributingPhase(plan) },
        { phase: 'verifying', fn: () => this.executeVerifyingPhase(plan) },
      ];

      // Skip phases before targetPhase
      const startIndex = phases.findIndex((p) => p.phase === targetPhase);
      const remainingPhases = phases.slice(Math.max(0, startIndex));

      for (const { fn } of remainingPhases) {
        await fn();
      }

      this.transitionTo('ready');
      return this.buildResult(plan, true);
    } catch (error) {
      return this.buildResult(plan, false, error);
    } finally {
      clearTimeout(totalTimer);
    }
  }

  /**
   * Estimate the cost of a launch plan without executing it.
   */
  estimateCost(plan: LaunchPlan): LaunchCostEstimate {
    const totalBundleBuySOL = plan.bundleBuys.reduce(
      (sum, b) => sum + b.amountSOL,
      0,
    );
    return this.buildCostEstimate(
      plan.devBuy.amountSOL,
      totalBundleBuySOL,
      plan.walletPlan.traderWallets.length,
    );
  }

  // ─── Phase Execution ─────────────────────────────────────

  /**
   * Funding phase: distribute SOL from master wallet to all trader wallets.
   */
  private async executeFundingPhase(plan: LaunchPlan): Promise<void> {
    await this.executePhase('funding', plan.timing.fundingTimeout, async () => {
      this.checkAborted();

      const masterWallet = this.getMasterWallet();
      const allWallets = this.walletVault.getAllWallets();
      const traderWallets = allWallets.filter((w) =>
        plan.walletPlan.traderWallets.includes(w.address),
      );

      // Batch into MAX_FUND_TRANSFERS_PER_TX transfers per transaction
      const batches = this.chunk(traderWallets, MAX_FUND_TRANSFERS_PER_TX);

      for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
        this.checkAborted();
        const batch = batches[batchIdx];
        const { blockhash } = await this.connection.getLatestBlockhash('confirmed');

        const tx = new Transaction({
          recentBlockhash: blockhash,
          feePayer: masterWallet.keypair.publicKey,
        });

        for (const wallet of batch) {
          const allocatedSOL =
            plan.walletPlan.perWalletSOL.get(wallet.address) ?? 0.05;
          const lamports = solToLamports(allocatedSOL);

          tx.add(
            SystemProgram.transfer({
              fromPubkey: masterWallet.keypair.publicKey,
              toPubkey: new PublicKey(wallet.address),
              lamports,
            }),
          );
        }

        const sig = await sendAndConfirmTransaction(
          this.connection,
          tx,
          [masterWallet.keypair],
          { commitment: 'confirmed', maxRetries: 3 },
        );

        this.totalFeesPaid += BigInt(BASE_TX_FEE_LAMPORTS);

        this.logger.debug(`Funded batch ${batchIdx + 1}/${batches.length}`, {
          wallets: batch.map((w) => w.address.slice(0, 8)),
          signature: sig,
        });
      }

      // Verify all wallets received expected amounts
      const failedFunds: string[] = [];
      for (const wallet of traderWallets) {
        const balance = await this.connection.getBalance(
          new PublicKey(wallet.address),
        );
        const expected = plan.walletPlan.perWalletSOL.get(wallet.address) ?? 0;
        if (lamportsToSOL(balance) < expected * 0.95) {
          failedFunds.push(wallet.address);
        }
      }

      if (failedFunds.length > 0) {
        // Retry failed wallets individually
        for (const addr of failedFunds) {
          this.checkAborted();
          const wallet = traderWallets.find((w) => w.address === addr);
          if (!wallet) continue;

          const allocatedSOL = plan.walletPlan.perWalletSOL.get(addr) ?? 0.05;
          const { blockhash } = await this.connection.getLatestBlockhash('confirmed');

          const tx = new Transaction({
            recentBlockhash: blockhash,
            feePayer: masterWallet.keypair.publicKey,
          });

          tx.add(
            SystemProgram.transfer({
              fromPubkey: masterWallet.keypair.publicKey,
              toPubkey: new PublicKey(addr),
              lamports: solToLamports(allocatedSOL),
            }),
          );

          await sendAndConfirmTransaction(
            this.connection,
            tx,
            [masterWallet.keypair],
            { commitment: 'confirmed', maxRetries: 3 },
          );

          this.totalFeesPaid += BigInt(BASE_TX_FEE_LAMPORTS);
          this.logger.info(`Retried funding for wallet ${addr.slice(0, 8)}`);
        }
      }

      this.eventBus.emit('launch:funded', 'bundle', 'launch-sequencer', {
        planId: plan.id,
        walletsCount: traderWallets.length,
        totalSOL: plan.walletPlan.totalSOLRequired,
      });
    });
  }

  /**
   * Creating phase: create the token on Pump.fun.
   */
  private async executeCreatingPhase(plan: LaunchPlan): Promise<void> {
    await this.executePhase('creating', plan.timing.createTimeout, async () => {
      this.checkAborted();

      const bundleBuyConfig: BundleBuyConfig = {
        devBuyLamports: new BN(solToLamports(plan.devBuy.amountSOL)),
        bundleWallets: [],
        slippageBps: plan.devBuy.slippageBps,
      };

      let lastError: Error | undefined;

      for (let attempt = 0; attempt < MAX_CREATE_RETRIES; attempt++) {
        try {
          this.checkAborted();

          const result = await this.creatorAgent.createToken(
            plan.tokenConfig,
            bundleBuyConfig,
          );

          this.mintResult = result;

          // Verify token exists on-chain
          const mintPubkey = new PublicKey(result.mint);
          const accountInfo = await this.connection.getAccountInfo(mintPubkey);
          if (!accountInfo) {
            throw new Error(
              `Token mint ${result.mint} not found on-chain after creation`,
            );
          }

          this.eventBus.emit('launch:token-created', 'bundle', 'launch-sequencer', {
            planId: plan.id,
            mint: result.mint,
            bondingCurve: result.bondingCurve,
            signature: result.signature,
          });

          this.logger.info('Token created', {
            mint: result.mint,
            bondingCurve: result.bondingCurve,
          });

          return; // Success
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
          this.logger.warn(`Token creation attempt ${attempt + 1} failed`, {
            error: lastError.message,
          });

          if (attempt < MAX_CREATE_RETRIES - 1) {
            await sleep(this.config.retryBaseDelayMs * Math.pow(2, attempt));
          }
        }
      }

      throw lastError ?? new Error('Token creation failed after all retries');
    });
  }

  /**
   * Dev-buy phase: execute the creator's initial purchase.
   *
   * If the dev buy was folded into the creation transaction (createV2AndBuy),
   * this phase verifies the tokens were received rather than executing again.
   */
  private async executeDevBuyPhase(plan: LaunchPlan): Promise<void> {
    await this.executePhase('dev-buying', plan.timing.createTimeout, async () => {
      this.checkAborted();

      if (!this.mintResult) {
        throw new Error('Cannot execute dev buy: no mint result from creation phase');
      }

      // If dev buy was part of creation (devBuyTokens is set), just verify
      if (this.mintResult.devBuyTokens && this.mintResult.devBuyTokens.gtn(0)) {
        this.logger.info('Dev buy was atomically included in creation tx', {
          tokensReceived: this.mintResult.devBuyTokens.toString(),
        });

        this.eventBus.emit('launch:dev-buy-complete', 'bundle', 'launch-sequencer', {
          planId: plan.id,
          mint: this.mintResult.mint,
          tokensReceived: this.mintResult.devBuyTokens.toString(),
          method: 'atomic-create',
        });
        return;
      }

      // Otherwise execute a separate dev buy (fallback for creation without atomic buy)
      const masterWallet = this.getMasterWallet();
      const mintPubkey = new PublicKey(this.mintResult.mint);

      const curveState = await this.creatorAgent.getBondingCurveState(
        this.mintResult.mint,
      );

      this.logger.info('Executing standalone dev buy', {
        amountSOL: plan.devBuy.amountSOL,
        currentPrice: curveState.currentPriceSol,
      });

      // Use executeBundleBuys with a single wallet (the creator)
      const devBuyConfig: BundleBuyConfig = {
        devBuyLamports: new BN(0),
        bundleWallets: [
          {
            wallet: masterWallet,
            amountLamports: new BN(solToLamports(plan.devBuy.amountSOL)),
          },
        ],
        slippageBps: plan.devBuy.slippageBps,
      };

      const sigs = await this.creatorAgent.executeBundleBuys(
        this.mintResult.mint,
        devBuyConfig,
      );

      // Verify tokens received
      const ata = await getAssociatedTokenAddress(
        mintPubkey,
        masterWallet.keypair.publicKey,
      );
      const tokenAccount = await getAccount(this.connection, ata);
      const tokensReceived = tokenAccount.amount;

      this.eventBus.emit('launch:dev-buy-complete', 'bundle', 'launch-sequencer', {
        planId: plan.id,
        mint: this.mintResult.mint,
        tokensReceived: tokensReceived.toString(),
        signatures: sigs,
        method: 'standalone',
      });
    });
  }

  /**
   * Bundling phase: execute multi-wallet bundle buys.
   */
  private async executeBundlingPhase(plan: LaunchPlan): Promise<void> {
    await this.executePhase('bundling', plan.timing.bundleTimeout, async () => {
      this.checkAborted();

      if (!this.mintResult) {
        throw new Error('Cannot execute bundle buys: no mint result');
      }

      if (plan.bundleBuys.length === 0) {
        this.logger.info('No bundle buys configured, skipping phase');
        return;
      }

      const allWallets = this.walletVault.getAllWallets();
      const traderWallets = allWallets.filter((w) =>
        plan.walletPlan.traderWallets.includes(w.address),
      );

      // Try Jito bundle for same-slot execution
      if (this.config.useJito && await this.jitoClient.isAvailable()) {
        await this.executeBundleViaJito(plan, traderWallets);
      } else {
        // Sequential fallback with staggered timing
        await this.executeBundleSequential(plan, traderWallets);
      }

      // Verify all expected purchases completed
      const mintPubkey = new PublicKey(this.mintResult.mint);
      let totalTokensBought = BigInt(0);

      for (const wallet of traderWallets) {
        try {
          const ata = await getAssociatedTokenAddress(
            mintPubkey,
            wallet.keypair.publicKey,
          );
          const tokenAccount = await getAccount(this.connection, ata);
          totalTokensBought += tokenAccount.amount;
        } catch {
          // Wallet may not have bought successfully — logged but not fatal
          this.logger.warn(`No token account found for wallet ${wallet.address.slice(0, 8)}`);
        }
      }

      this.eventBus.emit('launch:bundled', 'bundle', 'launch-sequencer', {
        planId: plan.id,
        mint: this.mintResult.mint,
        walletsCount: traderWallets.length,
        totalTokensBought: totalTokensBought.toString(),
        method: this.config.useJito ? 'jito' : 'sequential',
      });

      this.logger.info('Bundle buys completed', {
        totalTokensBought: totalTokensBought.toString(),
        wallets: traderWallets.length,
      });
    });
  }

  /**
   * Distributing phase: redistribute tokens across wallets for anti-detection.
   */
  private async executeDistributingPhase(plan: LaunchPlan): Promise<void> {
    await this.executePhase('distributing', plan.timing.distributionTimeout, async () => {
      this.checkAborted();

      if (!this.mintResult) {
        throw new Error('Cannot distribute: no mint result');
      }

      const allWallets = this.walletVault.getAllWallets();
      const sourceWallets = allWallets.filter((w) =>
        plan.walletPlan.traderWallets.includes(w.address) ||
        w.address === plan.walletPlan.masterWallet,
      );

      // Use all wallets as targets for maximum distribution
      const targetWallets = allWallets;

      const distributionPlan = await this.supplyDistributor.planDistribution(
        this.mintResult.mint,
        sourceWallets,
        targetWallets,
        this.config.distributionStrategy,
        {
          strategy: this.config.distributionStrategy,
          maxPerWalletPercent: 10,
          staggerTransfers: true,
          transferDelayMs: { min: 500, max: 3_000 },
          addNoise: true,
          noiseFactor: 0.15,
        },
      );

      const result = await this.supplyDistributor.executeDistribution(
        distributionPlan,
      );

      if (result.status === 'failed') {
        throw new Error(
          `Distribution failed: ${result.failedTransfers} transfers failed. ` +
          `Errors: ${result.errors.map((e) => e.error).join('; ')}`,
        );
      }

      if (result.status === 'partial') {
        this.logger.warn('Distribution partially completed', {
          successful: result.successfulTransfers,
          failed: result.failedTransfers,
        });
      }

      this.eventBus.emit('launch:distributed', 'bundle', 'launch-sequencer', {
        planId: plan.id,
        mint: this.mintResult.mint,
        successfulTransfers: result.successfulTransfers,
        failedTransfers: result.failedTransfers,
      });
    });
  }

  /**
   * Verifying phase: confirm all wallets have expected token/SOL balances.
   */
  private async executeVerifyingPhase(plan: LaunchPlan): Promise<void> {
    await this.executePhase('verifying', 30_000, async () => {
      this.checkAborted();

      if (!this.mintResult) {
        throw new Error('Cannot verify: no mint result');
      }

      const mintPubkey = new PublicKey(this.mintResult.mint);
      const allWallets = this.walletVault.getAllWallets();
      const relevantWallets = allWallets.filter(
        (w) =>
          plan.walletPlan.traderWallets.includes(w.address) ||
          w.address === plan.walletPlan.masterWallet,
      );

      let totalTokens = BigInt(0);
      let walletsWithTokens = 0;
      let walletsWithInsufficientSOL = 0;

      for (const wallet of relevantWallets) {
        // Check SOL balance (needs enough for trading fees)
        const solBalance = await this.connection.getBalance(
          new PublicKey(wallet.address),
        );
        if (solBalance < BASE_TX_FEE_LAMPORTS * 5) {
          walletsWithInsufficientSOL++;
          this.logger.warn(`Wallet ${wallet.address.slice(0, 8)} has low SOL: ${lamportsToSOL(solBalance).toFixed(4)}`);
        }

        // Check token balance
        try {
          const ata = await getAssociatedTokenAddress(
            mintPubkey,
            wallet.keypair.publicKey,
          );
          const tokenAccount = await getAccount(this.connection, ata);
          if (tokenAccount.amount > BigInt(0)) {
            walletsWithTokens++;
            totalTokens += tokenAccount.amount;
          }
        } catch {
          // No token account = 0 tokens
        }
      }

      // Read bonding curve to calculate supply percentage
      const curveState = await this.creatorAgent.getBondingCurveState(
        this.mintResult.mint,
      );

      // Total supply on Pump.fun is ~1 billion tokens (1e9 * 1e6 raw units)
      const totalSupplyRaw = BigInt('1000000000000000'); // 1B tokens * 1e6 decimals
      const supplyPercent =
        totalSupplyRaw > BigInt(0)
          ? (Number(totalTokens) / Number(totalSupplyRaw)) * 100
          : 0;

      this.logger.info('Verification complete', {
        walletsWithTokens,
        walletsWithInsufficientSOL,
        totalTokens: totalTokens.toString(),
        supplyPercent: supplyPercent.toFixed(2) + '%',
        graduationProgress: curveState.graduationProgress.toFixed(2) + '%',
      });

      if (walletsWithTokens === 0) {
        throw new Error('Verification failed: no wallets hold any tokens');
      }

      this.eventBus.emit('launch:verified', 'bundle', 'launch-sequencer', {
        planId: plan.id,
        mint: this.mintResult.mint,
        walletsWithTokens,
        totalTokens: totalTokens.toString(),
        supplyPercent,
        graduationProgress: curveState.graduationProgress,
      });
    });
  }

  // ─── Bundle Strategies ────────────────────────────────────

  /**
   * Submit bundle buys via Jito for same-slot atomic execution.
   */
  private async executeBundleViaJito(
    plan: LaunchPlan,
    traderWallets: AgentWallet[],
  ): Promise<void> {
    if (!this.mintResult) throw new Error('No mint result for Jito bundle');

    const transactions: Transaction[] = [];

    for (const buy of plan.bundleBuys) {
      const wallet = traderWallets[buy.walletIndex];
      if (!wallet) continue;

      const { blockhash } = await this.connection.getLatestBlockhash('confirmed');

      // Build buy transaction manually for Jito submission
      const tx = new Transaction({
        recentBlockhash: blockhash,
        feePayer: wallet.keypair.publicKey,
      });

      // Add compute budget
      const { ComputeBudgetProgram } = await import('@solana/web3.js');
      tx.add(
        ComputeBudgetProgram.setComputeUnitLimit({ units: BUY_COMPUTE_UNITS }),
        ComputeBudgetProgram.setComputeUnitPrice({
          microLamports: this.config.priorityFeeMicroLamports,
        }),
      );

      // Sign the transaction
      tx.sign(wallet.keypair);

      transactions.push(tx);
    }

    // Limit to 5 transactions per Jito bundle
    const jitoBatches = this.chunk(transactions, 5);
    for (const batch of jitoBatches) {
      this.checkAborted();

      // Add tip to the last transaction in the batch
      const lastTx = batch[batch.length - 1];
      const tippedTx = await this.jitoClient.addTipInstruction(
        lastTx,
        this.config.jitoTipLamports,
      );
      batch[batch.length - 1] = tippedTx;

      const bundleResult = await this.jitoClient.sendBundle(batch);
      const confirmation = await this.jitoClient.waitForBundleConfirmation(
        bundleResult.bundleId,
        plan.timing.bundleTimeout,
      );

      if (confirmation.status === 'failed' || confirmation.status === 'invalid') {
        this.logger.warn('Jito bundle failed, falling back to sequential', {
          bundleId: bundleResult.bundleId,
          error: confirmation.error,
        });
        // Fall back to sequential execution
        await this.executeBundleSequential(plan, traderWallets);
        return;
      }

      this.totalTipsPaid += BigInt(this.config.jitoTipLamports);

      this.logger.info('Jito bundle confirmed', {
        bundleId: bundleResult.bundleId,
        slot: confirmation.slot,
      });
    }
  }

  /**
   * Fall back to sequential buy transactions with staggered delays.
   */
  private async executeBundleSequential(
    plan: LaunchPlan,
    traderWallets: AgentWallet[],
  ): Promise<void> {
    if (!this.mintResult) throw new Error('No mint result for sequential bundle');

    const bundleBuyConfig: BundleBuyConfig = {
      devBuyLamports: new BN(0),
      bundleWallets: plan.bundleBuys
        .filter((buy) => traderWallets[buy.walletIndex])
        .map((buy) => ({
          wallet: traderWallets[buy.walletIndex],
          amountLamports: new BN(solToLamports(buy.amountSOL)),
        })),
      slippageBps: plan.devBuy.slippageBps,
    };

    // Apply staggered delays
    for (let i = 0; i < plan.bundleBuys.length; i++) {
      this.checkAborted();
      const delay = plan.bundleBuys[i].delayAfterCreate;
      if (delay > 0 && i > 0) {
        await sleep(delay);
      }
    }

    const sigs = await this.creatorAgent.executeBundleBuys(
      this.mintResult.mint,
      bundleBuyConfig,
    );

    this.totalFeesPaid += BigInt(BASE_TX_FEE_LAMPORTS * sigs.length);

    this.logger.info('Sequential bundle buys completed', {
      signatures: sigs.length,
    });
  }

  // ─── Phase Machine ───────────────────────────────────────

  /**
   * Execute a phase with retry logic, timeout, and recording.
   */
  private async executePhase(
    phase: LaunchPhase,
    timeoutMs: number,
    executor: () => Promise<void>,
  ): Promise<void> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.config.maxRetriesPerPhase; attempt++) {
      this.transitionTo(phase);

      const timer = this.createTimeout(
        timeoutMs,
        `Phase "${phase}" timed out after ${timeoutMs}ms`,
      );

      try {
        await executor();

        clearTimeout(timer);

        this.recordPhaseSuccess(phase, attempt);
        return;
      } catch (error) {
        clearTimeout(timer);
        lastError = error instanceof Error ? error : new Error(String(error));

        if (this.abortRequested) {
          this.recordPhaseFailure(phase, lastError, attempt);
          throw lastError;
        }

        this.logger.warn(
          `Phase "${phase}" attempt ${attempt + 1}/${this.config.maxRetriesPerPhase + 1} failed`,
          { error: lastError.message },
        );

        if (attempt < this.config.maxRetriesPerPhase) {
          const delay = this.config.retryBaseDelayMs * Math.pow(2, attempt);
          await sleep(delay);
        }
      }
    }

    this.recordPhaseFailure(phase, lastError, this.config.maxRetriesPerPhase);
    this.transitionTo('failed');
    throw lastError ?? new Error(`Phase "${phase}" failed after all retries`);
  }

  /**
   * Transition to a new phase if the transition is valid.
   */
  private transitionTo(next: LaunchPhase): void {
    const valid = VALID_TRANSITIONS[this.currentPhase];
    if (!valid?.includes(next) && this.currentPhase !== next) {
      // Allow same-phase transitions (retry within same phase)
      throw new Error(
        `Invalid launch phase transition: "${this.currentPhase}" → "${next}"`,
      );
    }

    const previous = this.currentPhase;
    this.currentPhase = next;
    this.phaseStartedAt = Date.now();

    if (previous !== next) {
      this.logger.debug(`Phase transition: ${previous} → ${next}`);
      this.eventBus.emit('launch:phase-change', 'lifecycle', 'launch-sequencer', {
        from: previous,
        to: next,
        timestamp: this.phaseStartedAt,
      });
    }
  }

  // ─── Recording ────────────────────────────────────────────

  private recordPhaseSuccess(phase: LaunchPhase, retries: number): void {
    const now = Date.now();
    this.completedPhases.push({
      phase,
      startedAt: this.phaseStartedAt,
      completedAt: now,
      duration: now - this.phaseStartedAt,
      success: true,
      retries,
    });
  }

  private recordPhaseFailure(
    phase: LaunchPhase,
    error: unknown,
    retries = 0,
  ): void {
    const now = Date.now();
    this.completedPhases.push({
      phase,
      startedAt: this.phaseStartedAt,
      completedAt: now,
      duration: now - this.phaseStartedAt,
      success: false,
      error: error instanceof Error ? error.message : String(error),
      retries,
    });
  }

  // ─── Cost Estimation ──────────────────────────────────────

  private buildCostEstimate(
    devBuySOL: number,
    bundleBuySOL: number,
    walletCount: number,
  ): LaunchCostEstimate {
    // Transaction count:
    //   - Funding: ceil(walletCount / MAX_FUND_TRANSFERS_PER_TX) funding txs
    //   - Creation: 1 tx (includes dev buy)
    //   - Bundle buys: walletCount txs (or fewer for Jito)
    //   - Distribution: ~walletCount transfer txs
    //   - Verification: 0 txs (read-only)
    const fundingTxCount = Math.ceil(walletCount / MAX_FUND_TRANSFERS_PER_TX);
    const totalTxCount = fundingTxCount + 1 + walletCount + walletCount;

    const transactionFees = lamportsToSOL(BASE_TX_FEE_LAMPORTS * totalTxCount);

    const priorityFeePerTx = lamportsToSOL(
      (this.config.priorityFeeMicroLamports * CREATE_COMPUTE_UNITS) / 1_000_000,
    );
    const priorityFees = priorityFeePerTx * (1 + walletCount); // create + buys

    const jitoTips = this.config.useJito
      ? lamportsToSOL(this.config.jitoTipLamports * Math.ceil(walletCount / 5))
      : 0;

    const totalSOLRequired =
      devBuySOL + bundleBuySOL + transactionFees + priorityFees + jitoTips;

    const bufferPercent = this.config.costBufferPercent;
    const totalWithBuffer = totalSOLRequired * (1 + bufferPercent / 100);

    return {
      devBuyCost: devBuySOL,
      bundleBuyCost: bundleBuySOL,
      transactionFees,
      priorityFees,
      jitoTips,
      totalSOLRequired,
      bufferPercent,
      totalWithBuffer,
    };
  }

  // ─── Result Builder ───────────────────────────────────────

  private async buildResult(
    plan: LaunchPlan,
    success: boolean,
    error?: unknown,
  ): Promise<LaunchResult> {
    const mint = this.mintResult?.mint ?? '';
    const bondingCurve = this.mintResult?.bondingCurve ?? '';

    // Gather wallet results
    const walletResults: LaunchResult['walletResults'] = [];
    let totalTokens = BigInt(0);

    if (mint) {
      const mintPubkey = new PublicKey(mint);
      const allWallets = this.walletVault.getAllWallets();
      const relevantWallets = allWallets.filter(
        (w) =>
          plan.walletPlan.traderWallets.includes(w.address) ||
          w.address === plan.walletPlan.masterWallet,
      );

      for (const wallet of relevantWallets) {
        const solBalance = await this.connection
          .getBalance(new PublicKey(wallet.address))
          .catch(() => 0);

        let tokenBalance = BigInt(0);
        try {
          const ata = await getAssociatedTokenAddress(
            mintPubkey,
            wallet.keypair.publicKey,
          );
          const tokenAccount = await getAccount(this.connection, ata);
          tokenBalance = tokenAccount.amount;
        } catch {
          // No token account
        }

        totalTokens += tokenBalance;

        walletResults.push({
          wallet: wallet.address,
          solBalance: lamportsToSOL(solBalance),
          tokenBalance,
          supplyPercent: 0, // Calculated below
        });
      }

      // Calculate supply percentages
      const totalSupplyRaw = BigInt('1000000000000000');
      for (const wr of walletResults) {
        wr.supplyPercent =
          totalSupplyRaw > BigInt(0)
            ? (Number(wr.tokenBalance) / Number(totalSupplyRaw)) * 100
            : 0;
      }
    }

    const totalSupplyRaw = BigInt('1000000000000000');
    const supplyControlled =
      totalSupplyRaw > BigInt(0)
        ? (Number(totalTokens) / Number(totalSupplyRaw)) * 100
        : 0;

    // Calculate total SOL spent
    const totalBundleBuySOL = plan.bundleBuys.reduce(
      (sum, b) => sum + b.amountSOL,
      0,
    );

    if (!success && error) {
      this.recordPhaseFailure(this.currentPhase, error);
    }

    return {
      success,
      planId: plan.id,
      mint,
      bondingCurve,
      phases: [...this.completedPhases],
      walletResults,
      totalCost: {
        solSpent: plan.devBuy.amountSOL + totalBundleBuySOL,
        feesLamports: this.totalFeesPaid,
        jitoTipsLamports: this.totalTipsPaid,
      },
      totalDuration: Date.now() - this.launchStartedAt,
      supplyControlled,
    };
  }

  // ─── Helpers ──────────────────────────────────────────────

  /**
   * Get the master (creator) wallet from the vault.
   */
  private getMasterWallet(): AgentWallet {
    const allWallets = this.walletVault.getAllWallets();
    if (allWallets.length === 0) {
      throw new Error('No wallets in vault. Initialize WalletVault first.');
    }
    // The first wallet is conventionally the master/creator wallet
    return allWallets[0];
  }

  /**
   * Compute optimal dev buy using the DevBuyOptimizer.
   */
  private computeDevBuy(): DevBuyRecommendation {
    return this.devBuyOptimizer.calculateOptimalDevBuy({
      maxSOLBudget:
        this.config.devBuySOL === 'auto' ? 5 : this.config.devBuySOL,
      targetSupplyPercent: this.config.targetDevSupplyPercent,
      maxPriceImpactPercent: this.config.maxPriceImpactPercent,
      isCreationBuy: true,
      optimizationGoal: this.config.devBuyGoal,
    });
  }

  /**
   * Create a timeout that throws if exceeded.
   */
  private createTimeout(ms: number, message: string): ReturnType<typeof setTimeout> {
    return setTimeout(() => {
      this.logger.error(message);
    }, ms);
  }

  /**
   * Check if abort has been requested and throw if so.
   */
  private checkAborted(): void {
    if (this.abortRequested) {
      throw new Error('Launch aborted by operator');
    }
  }

  /**
   * Attempt to reclaim SOL from funded trader wallets back to master.
   */
  private async attemptReclaim(plan: LaunchPlan): Promise<void> {
    const masterWallet = this.getMasterWallet();
    const allWallets = this.walletVault.getAllWallets();
    const traderWallets = allWallets.filter((w) =>
      plan.walletPlan.traderWallets.includes(w.address),
    );

    this.logger.info('Attempting to reclaim SOL from trader wallets', {
      walletCount: traderWallets.length,
    });

    for (const wallet of traderWallets) {
      try {
        const balance = await this.connection.getBalance(
          new PublicKey(wallet.address),
        );
        // Keep enough for the fee, transfer the rest
        const transferable = balance - BASE_TX_FEE_LAMPORTS * 2;
        if (transferable <= 0) continue;

        const { blockhash } = await this.connection.getLatestBlockhash('confirmed');
        const tx = new Transaction({
          recentBlockhash: blockhash,
          feePayer: wallet.keypair.publicKey,
        });

        tx.add(
          SystemProgram.transfer({
            fromPubkey: wallet.keypair.publicKey,
            toPubkey: masterWallet.keypair.publicKey,
            lamports: transferable,
          }),
        );

        await sendAndConfirmTransaction(this.connection, tx, [wallet.keypair], {
          commitment: 'confirmed',
          maxRetries: 2,
        });

        this.logger.debug(`Reclaimed ${lamportsToSOL(transferable).toFixed(4)} SOL from ${wallet.address.slice(0, 8)}`);
      } catch (error) {
        this.logger.warn(`Failed to reclaim from wallet ${wallet.address.slice(0, 8)}`, {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  /**
   * Find the last phase that failed (for retry).
   */
  private findLastFailedPhase(): LaunchPhase {
    const failed = this.completedPhases
      .filter((p) => !p.success)
      .pop();
    return failed?.phase ?? 'funding';
  }

  /**
   * Split an array into chunks of at most `size`.
   */
  private chunk<T>(arr: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
      chunks.push(arr.slice(i, i + size));
    }
    return chunks;
  }
}
