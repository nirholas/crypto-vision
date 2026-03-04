/**
 * Exit Agent — Coordinated profit-taking and position unwinding
 *
 * Orchestrates the selling of tokens across multiple wallets when
 * exit conditions are met. Strategies include:
 *
 * 1. **Gradual** — Spread sells evenly across a time window using different wallets
 * 2. **Staged** — Define price targets (2x, 3x, 5x) and sell percentages at each
 * 3. **Immediate** — Sell all tokens across all wallets as fast as possible
 * 4. **Trailing stop** — Follow price up, sell when price drops by X% from peak
 *
 * Exit planning estimates price impact and generates an ordered
 * sequence of sell instructions across wallets for minimal slippage.
 */

import {
  Connection,
  Transaction,
  ComputeBudgetProgram,
  sendAndConfirmTransaction,
  PublicKey,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  getAccount,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import {
  PUMP_SDK,
  OnlinePumpSdk,
  getTokenPrice,
} from '@pump-fun/pump-sdk';
import type { DecodedBondingCurve } from '@pump-fun/pump-sdk';
import BN from 'bn.js';
import { v4 as uuid } from 'uuid';
import { EventEmitter } from 'eventemitter3';
import type { AgentWallet, TradeOrder, TradeResult } from '../types.js';
import type { SwarmEventBus } from '../infra/event-bus.js';
import { SwarmLogger } from '../infra/logger.js';

// ─── Configuration ────────────────────────────────────────────

export interface ExitConfig {
  /** Exit strategy to employ */
  strategy: 'gradual' | 'staged' | 'immediate' | 'trailing-stop';
  /** For gradual: time to spread sells across (ms) */
  exitDurationMs: number;
  /** For staged: sell X% at each price target */
  stages: Array<{ priceMultiplier: number; sellPercent: number }>;
  /** Max price impact per sell (percentage) */
  maxPriceImpactPercent: number;
  /** Percentage of tokens to retain after exit (0-100) */
  retainPercent: number;
  /** Priority fee for exit transactions (high for urgency) */
  priorityFeeMicroLamports: number;
  /** Max slippage in basis points (e.g., 500 = 5%) */
  slippageBps: number;
  /** Monitor polling interval in ms (default: 2000) */
  monitorIntervalMs: number;
}

// ─── Exit Conditions ──────────────────────────────────────────

export interface ExitConditions {
  /** Exit when price hits this multiplier from entry (e.g. 3.0 = 3x) */
  takeProfitMultiplier?: number;
  /** Exit when price drops below this % from peak (e.g. 30 = sell if down 30%) */
  stopLossPercent?: number;
  /** Exit when graduation progress reaches this % (e.g. 80) */
  graduationThreshold?: number;
  /** Exit after this many seconds */
  maxHoldTimeSeconds?: number;
  /** Exit if recent volume drops below this SOL threshold */
  minVolumeSol?: number;
  /** Exit if holder count drops below this */
  minHolders?: number;
}

// ─── Exit Plan ────────────────────────────────────────────────

export interface ExitPlan {
  /** Unique plan identifier */
  id: string;
  /** Token mint address */
  mint: string;
  /** Total tokens planned to sell across all wallets */
  totalTokensToSell: BN;
  /** Expected total SOL proceeds */
  totalExpectedSol: BN;
  /** Ordered sequence of sell instructions */
  orders: ExitOrder[];
  /** Expected total duration to execute (ms) */
  expectedDuration: number;
  /** Expected aggregate price impact (%) */
  expectedPriceImpact: number;
  /** Strategy that generated this plan */
  strategy: ExitConfig['strategy'];
  /** Entry price used for calculations (SOL per token, lamport-scale) */
  entryPrice: BN;
  /** Timestamp when plan was created */
  createdAt: number;
}

export interface ExitOrder {
  /** Wallet executing the sell */
  wallet: AgentWallet;
  /** Number of tokens to sell */
  tokenAmount: BN;
  /** Estimated SOL proceeds */
  estimatedSol: BN;
  /** Delay from plan start before executing (ms) */
  delayMs: number;
  /** Execution priority (lower = sooner, for tie-breaking) */
  priority: number;
}

// ─── Exit Result ──────────────────────────────────────────────

export interface ExitResult {
  /** The plan that was executed */
  plan: ExitPlan;
  /** Number of orders successfully executed */
  executed: number;
  /** Number of orders that failed */
  failed: number;
  /** Actual total SOL received */
  totalSolReceived: BN;
  /** Average sell price (SOL per token, lamport-scale) */
  avgSellPrice: BN;
  /** Actual aggregate price impact (%) */
  priceImpact: number;
  /** Actual duration from first to last sell (ms) */
  duration: number;
  /** Transaction signatures for successful sells */
  signatures: string[];
  /** Errors from failed orders */
  errors: Array<{ orderIndex: number; error: string }>;
  /** Timestamp when execution completed */
  completedAt: number;
}

// ─── Events ───────────────────────────────────────────────────

interface ExitAgentEvents {
  'exit:plan-created': (plan: ExitPlan) => void;
  'exit:order-executed': (order: ExitOrder, result: TradeResult) => void;
  'exit:order-failed': (order: ExitOrder, error: Error) => void;
  'exit:completed': (result: ExitResult) => void;
  'exit:emergency': (reason: string) => void;
  'exit:condition-met': (condition: string, value: number) => void;
  'exit:monitoring-started': (mint: string) => void;
  'exit:monitoring-stopped': (mint: string) => void;
  'exit:trailing-stop-update': (peakPrice: number, currentPrice: number, drawdownPercent: number) => void;
  'exit:staged-trigger': (stage: number, priceMultiplier: number, sellPercent: number) => void;
}

// ─── Wallet Token Snapshot ────────────────────────────────────

interface WalletTokenSnapshot {
  wallet: AgentWallet;
  tokenBalance: BN;
  tokenAccount: PublicKey;
}

// ─── Exit Agent ───────────────────────────────────────────────

export class ExitAgent extends EventEmitter<ExitAgentEvents> {
  private readonly config: ExitConfig;
  private readonly connection: Connection;
  private readonly eventBus: SwarmEventBus;
  private readonly logger: SwarmLogger;
  private onlineSdk: OnlinePumpSdk | null = null;

  /** Current exit conditions (can be updated at runtime) */
  private conditions: ExitConditions = {};
  /** Entry price used for profit calculations (SOL per token, lamport-scale) */
  private entryPrice: BN = new BN(0);
  /** Peak price observed during monitoring (for trailing stop) */
  private peakPrice = 0;
  /** Monitoring interval handle */
  private monitorTimer: ReturnType<typeof setInterval> | null = null;
  /** Whether monitoring is active */
  private monitoring = false;
  /** Timestamp when monitoring started (for maxHoldTime) */
  private monitoringStartedAt = 0;
  /** Stages already triggered (indices into config.stages) */
  private triggeredStages = new Set<number>();
  /** Track whether we are currently executing an exit to prevent re-entry */
  private executing = false;

  constructor(config: ExitConfig, connection: Connection, eventBus: SwarmEventBus) {
    super();
    this.config = config;
    this.connection = connection;
    this.eventBus = eventBus;
    this.logger = new SwarmLogger({ level: 'info', prefix: 'exit-agent' });
  }

  // ─── SDK Helper ─────────────────────────────────────────────

  private getOnlineSdk(): OnlinePumpSdk {
    if (!this.onlineSdk) {
      this.onlineSdk = new OnlinePumpSdk(this.connection);
    }
    return this.onlineSdk;
  }

  // ─── Set / Update Conditions ────────────────────────────────

  /**
   * Set or update exit conditions at runtime.
   */
  setExitConditions(conditions: ExitConditions): void {
    this.conditions = { ...conditions };
    this.logger.info('Exit conditions updated', { conditions: this.conditions });
  }

  /**
   * Set the entry price for profit/loss calculations.
   */
  setEntryPrice(entryPrice: BN): void {
    this.entryPrice = entryPrice;
    this.logger.info('Entry price set', { entryPrice: entryPrice.toString() });
  }

  // ─── Monitor for Exit ──────────────────────────────────────

  /**
   * Continuously poll the bonding curve and check exit conditions.
   * When a condition triggers, it fires the appropriate event and
   * can optionally auto-execute the exit plan.
   */
  monitorForExit(
    mint: string,
    wallets: AgentWallet[],
    autoExecute = false,
  ): void {
    if (this.monitoring) {
      this.logger.warn('Already monitoring — stop current monitor first');
      return;
    }

    this.monitoring = true;
    this.monitoringStartedAt = Date.now();
    this.peakPrice = 0;
    this.triggeredStages.clear();

    this.emit('exit:monitoring-started', mint);
    this.eventBus.emit(
      'exit:monitoring-started',
      'coordination',
      'exit-agent',
      { mint },
    );

    const intervalMs = this.config.monitorIntervalMs || 2000;

    this.monitorTimer = setInterval(async () => {
      if (!this.monitoring) return;

      try {
        await this.checkConditions(mint, wallets, autoExecute);
      } catch (err) {
        this.logger.error('Monitor cycle error', {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }, intervalMs);

    this.logger.info('Exit monitoring started', { mint, intervalMs, autoExecute });
  }

  /**
   * Stop monitoring.
   */
  stopMonitoring(mint: string): void {
    this.monitoring = false;
    if (this.monitorTimer) {
      clearInterval(this.monitorTimer);
      this.monitorTimer = null;
    }
    this.emit('exit:monitoring-stopped', mint);
    this.eventBus.emit(
      'exit:monitoring-stopped',
      'coordination',
      'exit-agent',
      { mint },
    );
    this.logger.info('Exit monitoring stopped', { mint });
  }

  // ─── Condition Checks ──────────────────────────────────────

  private async checkConditions(
    mint: string,
    wallets: AgentWallet[],
    autoExecute: boolean,
  ): Promise<void> {
    const sdk = this.getOnlineSdk();
    const mintPk = new PublicKey(mint);

    // Fetch current bonding curve state
    let curve: DecodedBondingCurve;
    try {
      const state = await sdk.fetchBuyState(
        mintPk,
        wallets[0].keypair.publicKey,
        TOKEN_PROGRAM_ID,
      );
      curve = state.bondingCurve;
    } catch (err) {
      this.logger.warn('Failed to fetch bonding curve', {
        error: err instanceof Error ? err.message : String(err),
      });
      return;
    }

    const currentPrice = getTokenPrice(curve);
    const currentPriceLamports = Math.floor(currentPrice * LAMPORTS_PER_SOL);

    // Update peak for trailing stop
    if (currentPrice > this.peakPrice) {
      this.peakPrice = currentPrice;
    }

    // ── Take Profit ───────────────────────────────────────────
    if (
      this.conditions.takeProfitMultiplier !== undefined &&
      !this.entryPrice.isZero()
    ) {
      const entryPriceNum = this.entryPrice.toNumber() / LAMPORTS_PER_SOL;
      const multiplier = currentPrice / entryPriceNum;
      if (multiplier >= this.conditions.takeProfitMultiplier) {
        this.emit('exit:condition-met', 'take-profit', multiplier);
        this.logger.info('Take profit triggered', {
          multiplier: multiplier.toFixed(2),
          target: this.conditions.takeProfitMultiplier,
        });
        if (autoExecute && !this.executing) {
          await this.autoExit(wallets, mint);
        }
        return;
      }
    }

    // ── Stop Loss / Trailing Stop ─────────────────────────────
    if (
      this.conditions.stopLossPercent !== undefined &&
      this.peakPrice > 0
    ) {
      const drawdownPercent =
        ((this.peakPrice - currentPrice) / this.peakPrice) * 100;

      if (this.config.strategy === 'trailing-stop') {
        this.emit('exit:trailing-stop-update', this.peakPrice, currentPrice, drawdownPercent);
      }

      if (drawdownPercent >= this.conditions.stopLossPercent) {
        this.emit('exit:condition-met', 'stop-loss', drawdownPercent);
        this.logger.info('Stop loss triggered', {
          drawdownPercent: drawdownPercent.toFixed(2),
          threshold: this.conditions.stopLossPercent,
          peakPrice: this.peakPrice,
          currentPrice,
        });
        if (autoExecute && !this.executing) {
          await this.autoExit(wallets, mint);
        }
        return;
      }
    }

    // ── Graduation Threshold ──────────────────────────────────
    if (this.conditions.graduationThreshold !== undefined) {
      const realTokenReserves = new BN(curve.realTokenReserves.toString());
      const virtualTokenReserves = new BN(curve.virtualTokenReserves.toString());
      const totalSupply = virtualTokenReserves;
      const sold = totalSupply.sub(realTokenReserves);
      const graduationProgress = totalSupply.gtn(0)
        ? (sold.toNumber() / totalSupply.toNumber()) * 100
        : 0;

      if (graduationProgress >= this.conditions.graduationThreshold) {
        this.emit('exit:condition-met', 'graduation', graduationProgress);
        this.logger.info('Graduation threshold triggered', {
          graduationProgress: graduationProgress.toFixed(1),
          threshold: this.conditions.graduationThreshold,
        });
        if (autoExecute && !this.executing) {
          await this.autoExit(wallets, mint);
        }
        return;
      }
    }

    // ── Max Hold Time ─────────────────────────────────────────
    if (this.conditions.maxHoldTimeSeconds !== undefined) {
      const elapsedSeconds = (Date.now() - this.monitoringStartedAt) / 1000;
      if (elapsedSeconds >= this.conditions.maxHoldTimeSeconds) {
        this.emit('exit:condition-met', 'max-hold-time', elapsedSeconds);
        this.logger.info('Max hold time triggered', {
          elapsedSeconds: Math.floor(elapsedSeconds),
          threshold: this.conditions.maxHoldTimeSeconds,
        });
        if (autoExecute && !this.executing) {
          await this.autoExit(wallets, mint);
        }
        return;
      }
    }

    // ── Staged Exit Checks ────────────────────────────────────
    if (
      this.config.strategy === 'staged' &&
      !this.entryPrice.isZero()
    ) {
      const entryPriceNum = this.entryPrice.toNumber() / LAMPORTS_PER_SOL;
      const multiplier = currentPrice / entryPriceNum;

      for (let i = 0; i < this.config.stages.length; i++) {
        if (this.triggeredStages.has(i)) continue;

        const stage = this.config.stages[i];
        if (multiplier >= stage.priceMultiplier) {
          this.triggeredStages.add(i);
          this.emit('exit:staged-trigger', i, stage.priceMultiplier, stage.sellPercent);
          this.logger.info('Staged exit triggered', {
            stageIndex: i,
            priceMultiplier: stage.priceMultiplier,
            sellPercent: stage.sellPercent,
            currentMultiplier: multiplier.toFixed(2),
          });

          if (autoExecute && !this.executing) {
            await this.executeStagedSell(wallets, mint, stage.sellPercent);
          }
        }
      }
    }
  }

  // ─── Auto Exit Helper ──────────────────────────────────────

  private async autoExit(wallets: AgentWallet[], mint: string): Promise<void> {
    this.stopMonitoring(mint);
    const plan = await this.planExit(wallets, mint);
    await this.executeExit(plan);
  }

  // ─── Staged Sell Helper ─────────────────────────────────────

  private async executeStagedSell(
    wallets: AgentWallet[],
    mint: string,
    sellPercent: number,
  ): Promise<void> {
    this.executing = true;
    try {
      const snapshots = await this.snapshotWalletTokens(wallets, mint);

      const totalTokens = snapshots.reduce(
        (sum, s) => sum.add(s.tokenBalance),
        new BN(0),
      );

      if (totalTokens.isZero()) {
        this.logger.warn('No tokens to sell for staged exit');
        return;
      }

      const tokensToSell = totalTokens
        .mul(new BN(Math.floor(sellPercent * 100)))
        .div(new BN(10_000));

      // Distribute sell across wallets proportionally
      const orders = this.distributeSellAcrossWallets(
        snapshots,
        tokensToSell,
        0, // immediate delays for staged sells
      );

      const plan: ExitPlan = {
        id: uuid(),
        mint,
        totalTokensToSell: tokensToSell,
        totalExpectedSol: new BN(0), // estimated below
        orders,
        expectedDuration: 0,
        expectedPriceImpact: 0,
        strategy: 'staged',
        entryPrice: this.entryPrice,
        createdAt: Date.now(),
      };

      await this.executeExit(plan);
    } finally {
      this.executing = false;
    }
  }

  // ─── Plan Exit ─────────────────────────────────────────────

  /**
   * Generate an exit plan: a sequence of sell orders across wallets
   * optimized for minimal price impact.
   */
  async planExit(wallets: AgentWallet[], mint: string): Promise<ExitPlan> {
    const snapshots = await this.snapshotWalletTokens(wallets, mint);
    const totalTokens = snapshots.reduce(
      (sum, s) => sum.add(s.tokenBalance),
      new BN(0),
    );

    if (totalTokens.isZero()) {
      this.logger.warn('planExit: no tokens across wallets');
      return this.emptyPlan(mint);
    }

    // Calculate tokens to sell after retaining configured percentage
    const retainBps = Math.floor(this.config.retainPercent * 100);
    const sellBps = 10_000 - retainBps;
    const tokensToSell = totalTokens.mul(new BN(sellBps)).div(new BN(10_000));

    if (tokensToSell.isZero()) {
      this.logger.warn('planExit: nothing to sell after retain %', {
        retainPercent: this.config.retainPercent,
      });
      return this.emptyPlan(mint);
    }

    // Fetch current curve for price impact estimation
    const sdk = this.getOnlineSdk();
    const mintPk = new PublicKey(mint);
    let curve: DecodedBondingCurve;
    try {
      const state = await sdk.fetchBuyState(
        mintPk,
        wallets[0].keypair.publicKey,
        TOKEN_PROGRAM_ID,
      );
      curve = state.bondingCurve;
    } catch (err) {
      this.logger.error('planExit: failed to fetch bonding curve', {
        error: err instanceof Error ? err.message : String(err),
      });
      return this.emptyPlan(mint);
    }

    const currentPrice = getTokenPrice(curve);
    const currentPriceLamports = new BN(
      Math.floor(currentPrice * LAMPORTS_PER_SOL),
    );

    let orders: ExitOrder[];
    let expectedDuration: number;

    switch (this.config.strategy) {
      case 'gradual':
        ({ orders, expectedDuration } = this.buildGradualOrders(
          snapshots,
          tokensToSell,
        ));
        break;

      case 'staged':
        ({ orders, expectedDuration } = this.buildStagedOrders(
          snapshots,
          tokensToSell,
        ));
        break;

      case 'immediate':
        ({ orders, expectedDuration } = this.buildImmediateOrders(
          snapshots,
          tokensToSell,
        ));
        break;

      case 'trailing-stop':
        // Trailing stop uses gradual once triggered
        ({ orders, expectedDuration } = this.buildGradualOrders(
          snapshots,
          tokensToSell,
        ));
        break;

      default: {
        const exhaustive: never = this.config.strategy;
        throw new Error(`Unknown exit strategy: ${String(exhaustive)}`);
      }
    }

    // Estimate total SOL proceeds
    const totalExpectedSol = this.estimateSolProceeds(
      tokensToSell,
      curve,
      currentPriceLamports,
    );

    // Estimate price impact
    const virtualSolReserves = new BN(curve.virtualSolReserves.toString());
    const virtualTokenReserves = new BN(curve.virtualTokenReserves.toString());
    const expectedPriceImpact = this.estimatePriceImpact(
      tokensToSell,
      virtualSolReserves,
      virtualTokenReserves,
    );

    const plan: ExitPlan = {
      id: uuid(),
      mint,
      totalTokensToSell: tokensToSell,
      totalExpectedSol,
      orders,
      expectedDuration,
      expectedPriceImpact,
      strategy: this.config.strategy,
      entryPrice: this.entryPrice,
      createdAt: Date.now(),
    };

    this.emit('exit:plan-created', plan);
    this.eventBus.emit(
      'exit:plan-created',
      'coordination',
      'exit-agent',
      {
        planId: plan.id,
        mint,
        totalTokensToSell: tokensToSell.toString(),
        totalExpectedSol: totalExpectedSol.toString(),
        orderCount: orders.length,
        expectedDuration,
        expectedPriceImpact,
        strategy: this.config.strategy,
      },
    );

    this.logger.info('Exit plan created', {
      planId: plan.id,
      strategy: this.config.strategy,
      totalTokens: tokensToSell.toString(),
      expectedSol: totalExpectedSol.toString(),
      orders: orders.length,
      expectedDuration,
      expectedPriceImpact: expectedPriceImpact.toFixed(2),
    });

    return plan;
  }

  // ─── Execute Exit ──────────────────────────────────────────

  /**
   * Execute a previously created exit plan.
   * Orders are dispatched sequentially, respecting the delay between each.
   */
  async executeExit(plan: ExitPlan): Promise<ExitResult> {
    this.executing = true;
    const startTime = Date.now();
    const signatures: string[] = [];
    const errors: Array<{ orderIndex: number; error: string }> = [];
    let executed = 0;
    let failed = 0;
    let totalSolReceived = new BN(0);
    let totalTokensSold = new BN(0);

    this.logger.info('Executing exit plan', {
      planId: plan.id,
      strategy: plan.strategy,
      orders: plan.orders.length,
    });

    // Sort orders by delayMs then priority
    const sortedOrders = [...plan.orders].sort((a, b) => {
      if (a.delayMs !== b.delayMs) return a.delayMs - b.delayMs;
      return a.priority - b.priority;
    });

    let lastDelayMs = 0;

    for (let i = 0; i < sortedOrders.length; i++) {
      const order = sortedOrders[i];

      // Wait for the required delay
      const waitMs = order.delayMs - lastDelayMs;
      if (waitMs > 0) {
        await this.sleep(waitMs);
      }
      lastDelayMs = order.delayMs;

      // Skip zero-amount orders
      if (order.tokenAmount.isZero()) continue;

      try {
        const result = await this.executeSellOrder(plan.mint, order);

        if (result.success) {
          executed++;
          totalSolReceived = totalSolReceived.add(result.amountOut);
          totalTokensSold = totalTokensSold.add(order.tokenAmount);
          signatures.push(result.signature);
          this.emit('exit:order-executed', order, result);
        } else {
          failed++;
          errors.push({ orderIndex: i, error: result.error ?? 'Unknown error' });
          this.emit(
            'exit:order-failed',
            order,
            new Error(result.error ?? 'Unknown error'),
          );
        }
      } catch (err) {
        failed++;
        const errMsg = err instanceof Error ? err.message : String(err);
        errors.push({ orderIndex: i, error: errMsg });
        this.emit('exit:order-failed', order, err instanceof Error ? err : new Error(errMsg));
      }
    }

    const duration = Date.now() - startTime;
    const avgSellPrice = totalTokensSold.gtn(0)
      ? totalSolReceived.mul(new BN(LAMPORTS_PER_SOL)).div(totalTokensSold)
      : new BN(0);

    // Calculate actual price impact from expected vs received
    const priceImpact = plan.totalExpectedSol.gtn(0)
      ? Math.abs(
          1 -
            totalSolReceived.toNumber() / plan.totalExpectedSol.toNumber(),
        ) * 100
      : 0;

    const exitResult: ExitResult = {
      plan,
      executed,
      failed,
      totalSolReceived,
      avgSellPrice,
      priceImpact,
      duration,
      signatures,
      errors,
      completedAt: Date.now(),
    };

    this.executing = false;

    this.emit('exit:completed', exitResult);
    this.eventBus.emit(
      'exit:completed',
      'coordination',
      'exit-agent',
      {
        planId: plan.id,
        executed,
        failed,
        totalSolReceived: totalSolReceived.toString(),
        avgSellPrice: avgSellPrice.toString(),
        priceImpact,
        duration,
        signatures,
      },
    );

    this.logger.info('Exit plan executed', {
      planId: plan.id,
      executed,
      failed,
      totalSolReceived: totalSolReceived.toString(),
      avgSellPrice: avgSellPrice.toString(),
      priceImpact: priceImpact.toFixed(2),
      duration,
    });

    return exitResult;
  }

  // ─── Emergency Exit ─────────────────────────────────────────

  /**
   * Emergency exit: sell everything across all wallets as fast as
   * possible, ignoring price impact limits and retain percentages.
   */
  async emergencyExit(
    wallets: AgentWallet[],
    mint: string,
  ): Promise<ExitResult> {
    this.logger.warn('EMERGENCY EXIT initiated', { mint, wallets: wallets.length });

    this.emit('exit:emergency', `Emergency exit for ${mint}`);
    this.eventBus.emit(
      'exit:emergency',
      'coordination',
      'exit-agent',
      { mint, walletCount: wallets.length },
    );

    // Stop any current monitoring
    if (this.monitoring) {
      this.stopMonitoring(mint);
    }

    const snapshots = await this.snapshotWalletTokens(wallets, mint);
    const totalTokens = snapshots.reduce(
      (sum, s) => sum.add(s.tokenBalance),
      new BN(0),
    );

    if (totalTokens.isZero()) {
      this.logger.warn('Emergency exit: no tokens to sell');
      return {
        plan: this.emptyPlan(mint),
        executed: 0,
        failed: 0,
        totalSolReceived: new BN(0),
        avgSellPrice: new BN(0),
        priceImpact: 0,
        duration: 0,
        signatures: [],
        errors: [],
        completedAt: Date.now(),
      };
    }

    // Build immediate orders — sell 100%, no delays, no retain
    const orders: ExitOrder[] = snapshots
      .filter((s) => s.tokenBalance.gtn(0))
      .map((s, idx) => ({
        wallet: s.wallet,
        tokenAmount: s.tokenBalance,
        estimatedSol: new BN(0),
        delayMs: 0,
        priority: idx,
      }));

    const plan: ExitPlan = {
      id: uuid(),
      mint,
      totalTokensToSell: totalTokens,
      totalExpectedSol: new BN(0),
      orders,
      expectedDuration: 0,
      expectedPriceImpact: 100, // worst case
      strategy: 'immediate',
      entryPrice: this.entryPrice,
      createdAt: Date.now(),
    };

    return this.executeExit(plan);
  }

  // ─── Order Building Strategies ─────────────────────────────

  /**
   * Gradual: spread sells evenly across `exitDurationMs`, rotating wallets.
   */
  private buildGradualOrders(
    snapshots: WalletTokenSnapshot[],
    tokensToSell: BN,
  ): { orders: ExitOrder[]; expectedDuration: number } {
    const walletsWithTokens = snapshots.filter((s) => s.tokenBalance.gtn(0));
    if (walletsWithTokens.length === 0) {
      return { orders: [], expectedDuration: 0 };
    }

    const totalDuration = this.config.exitDurationMs;
    // Split into chunks — one per wallet, then repeat if needed
    const chunkCount = Math.max(walletsWithTokens.length * 2, 6);
    const intervalMs = Math.floor(totalDuration / chunkCount);
    const tokensPerChunk = tokensToSell.div(new BN(chunkCount));

    const orders: ExitOrder[] = [];
    let remaining = new BN(tokensToSell.toString());

    for (let i = 0; i < chunkCount; i++) {
      if (remaining.isZero()) break;

      const walletSnapshot = walletsWithTokens[i % walletsWithTokens.length];
      const chunkAmount = i === chunkCount - 1
        ? remaining // last chunk gets the remainder
        : BN.min(tokensPerChunk, remaining);

      // Cap to wallet's actual balance
      const maxFromWallet = walletSnapshot.tokenBalance;
      const sellAmount = BN.min(chunkAmount, maxFromWallet);

      if (sellAmount.isZero()) continue;

      // Reduce wallet's available balance for subsequent chunks
      walletSnapshot.tokenBalance = walletSnapshot.tokenBalance.sub(sellAmount);

      orders.push({
        wallet: walletSnapshot.wallet,
        tokenAmount: sellAmount,
        estimatedSol: new BN(0),
        delayMs: i * intervalMs,
        priority: i,
      });

      remaining = remaining.sub(sellAmount);
    }

    // If there are remaining tokens (wallet balances were exhausted), sweep
    if (remaining.gtn(0)) {
      for (const snap of walletsWithTokens) {
        if (remaining.isZero()) break;
        if (snap.tokenBalance.isZero()) continue;

        const sellAmount = BN.min(remaining, snap.tokenBalance);
        snap.tokenBalance = snap.tokenBalance.sub(sellAmount);

        orders.push({
          wallet: snap.wallet,
          tokenAmount: sellAmount,
          estimatedSol: new BN(0),
          delayMs: totalDuration, // at the end
          priority: orders.length,
        });

        remaining = remaining.sub(sellAmount);
      }
    }

    return {
      orders,
      expectedDuration: totalDuration,
    };
  }

  /**
   * Staged: one batch per stage, selling the configured percentage.
   * All stages are pre-planned; during monitoring, sells trigger
   * when the price hits each multiplier.
   */
  private buildStagedOrders(
    snapshots: WalletTokenSnapshot[],
    tokensToSell: BN,
  ): { orders: ExitOrder[]; expectedDuration: number } {
    const walletsWithTokens = snapshots.filter((s) => s.tokenBalance.gtn(0));
    if (walletsWithTokens.length === 0) {
      return { orders: [], expectedDuration: 0 };
    }

    // Sort stages by price multiplier ascending
    const sortedStages = [...this.config.stages].sort(
      (a, b) => a.priceMultiplier - b.priceMultiplier,
    );

    const orders: ExitOrder[] = [];
    let stageDelay = 0;
    const perStageDelay = 5_000; // 5s between stages for plan-based execution

    for (const stage of sortedStages) {
      const stageTokens = tokensToSell
        .mul(new BN(Math.floor(stage.sellPercent * 100)))
        .div(new BN(10_000));

      const stageOrders = this.distributeSellAcrossWallets(
        snapshots,
        stageTokens,
        stageDelay,
      );
      orders.push(...stageOrders);
      stageDelay += perStageDelay;
    }

    return {
      orders,
      expectedDuration: stageDelay,
    };
  }

  /**
   * Immediate: sell everything across all wallets with zero delay.
   */
  private buildImmediateOrders(
    snapshots: WalletTokenSnapshot[],
    tokensToSell: BN,
  ): { orders: ExitOrder[]; expectedDuration: number } {
    const orders = this.distributeSellAcrossWallets(snapshots, tokensToSell, 0);
    return { orders, expectedDuration: 0 };
  }

  // ─── Order Distribution ─────────────────────────────────────

  /**
   * Distribute a token sell amount proportionally across wallet snapshots.
   */
  private distributeSellAcrossWallets(
    snapshots: WalletTokenSnapshot[],
    totalToSell: BN,
    baseDelayMs: number,
  ): ExitOrder[] {
    const orders: ExitOrder[] = [];
    const walletsWithTokens = snapshots.filter((s) => s.tokenBalance.gtn(0));
    if (walletsWithTokens.length === 0) return orders;

    const totalAvailable = walletsWithTokens.reduce(
      (sum, s) => sum.add(s.tokenBalance),
      new BN(0),
    );

    if (totalAvailable.isZero()) return orders;

    let remaining = BN.min(totalToSell, totalAvailable);

    for (let i = 0; i < walletsWithTokens.length; i++) {
      if (remaining.isZero()) break;

      const snap = walletsWithTokens[i];
      // Proportional allocation
      const proportion = snap.tokenBalance.mul(totalToSell).div(totalAvailable);
      const sellAmount =
        i === walletsWithTokens.length - 1
          ? remaining // last wallet gets remainder
          : BN.min(proportion, remaining);

      const cappedAmount = BN.min(sellAmount, snap.tokenBalance);
      if (cappedAmount.isZero()) continue;

      orders.push({
        wallet: snap.wallet,
        tokenAmount: cappedAmount,
        estimatedSol: new BN(0),
        delayMs: baseDelayMs,
        priority: i,
      });

      remaining = remaining.sub(cappedAmount);
    }

    return orders;
  }

  // ─── Execute Single Sell ────────────────────────────────────

  private async executeSellOrder(
    mint: string,
    order: ExitOrder,
  ): Promise<TradeResult> {
    const mintPk = new PublicKey(mint);
    const sdk = this.getOnlineSdk();

    const tradeOrder: TradeOrder = {
      id: uuid(),
      traderId: 'exit-agent',
      mint,
      direction: 'sell',
      amount: order.tokenAmount,
      slippageBps: this.config.slippageBps,
      priorityFeeMicroLamports: this.config.priorityFeeMicroLamports,
    };

    try {
      const global = await sdk.fetchGlobal();
      const sellState = await sdk.fetchSellState(
        mintPk,
        order.wallet.keypair.publicKey,
        TOKEN_PROGRAM_ID,
      );

      const sellIxs = await PUMP_SDK.sellInstructions({
        global,
        bondingCurveAccountInfo: sellState.bondingCurveAccountInfo,
        bondingCurve: sellState.bondingCurve,
        mint: mintPk,
        user: order.wallet.keypair.publicKey,
        amount: order.tokenAmount,
        solAmount: new BN(0),
        slippage: this.config.slippageBps / 100,
        tokenProgram: TOKEN_PROGRAM_ID,
        mayhemMode: false,
      });

      const computeIxs = [
        ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }),
        ComputeBudgetProgram.setComputeUnitPrice({
          microLamports: this.config.priorityFeeMicroLamports,
        }),
      ];

      // Get SOL balance before to measure actual SOL received
      const solBefore = await this.connection.getBalance(
        order.wallet.keypair.publicKey,
      );

      const { blockhash } = await this.connection.getLatestBlockhash('confirmed');
      const tx = new Transaction({
        recentBlockhash: blockhash,
        feePayer: order.wallet.keypair.publicKey,
      });
      tx.add(...computeIxs, ...sellIxs);

      const signature = await sendAndConfirmTransaction(
        this.connection,
        tx,
        [order.wallet.keypair],
        { commitment: 'confirmed', maxRetries: 3 },
      );

      const solAfter = await this.connection.getBalance(
        order.wallet.keypair.publicKey,
      );
      const solReceived = new BN(Math.max(0, solAfter - solBefore));

      return {
        order: tradeOrder,
        signature,
        amountOut: solReceived,
        executionPrice: order.tokenAmount.gtn(0)
          ? solReceived.mul(new BN(LAMPORTS_PER_SOL)).div(order.tokenAmount)
          : new BN(0),
        feesPaid: new BN(5_000),
        success: true,
        executedAt: Date.now(),
      };
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      this.logger.error('Sell order failed', {
        wallet: order.wallet.address,
        tokenAmount: order.tokenAmount.toString(),
        error: errMsg,
      });
      return {
        order: tradeOrder,
        signature: '',
        amountOut: new BN(0),
        executionPrice: new BN(0),
        feesPaid: new BN(0),
        success: false,
        error: errMsg,
        executedAt: Date.now(),
      };
    }
  }

  // ─── Wallet Token Snapshot ──────────────────────────────────

  /**
   * Fetch current token balances for all wallets.
   */
  private async snapshotWalletTokens(
    wallets: AgentWallet[],
    mint: string,
  ): Promise<WalletTokenSnapshot[]> {
    const mintPk = new PublicKey(mint);
    const snapshots: WalletTokenSnapshot[] = [];

    // Fetch all balances in parallel
    const results = await Promise.allSettled(
      wallets.map(async (wallet) => {
        const ata = await getAssociatedTokenAddress(
          mintPk,
          wallet.keypair.publicKey,
        );
        try {
          const account = await getAccount(this.connection, ata);
          return {
            wallet,
            tokenBalance: new BN(account.amount.toString()),
            tokenAccount: ata,
          };
        } catch {
          // Token account doesn't exist — wallet holds no tokens
          return {
            wallet,
            tokenBalance: new BN(0),
            tokenAccount: ata,
          };
        }
      }),
    );

    for (const result of results) {
      if (result.status === 'fulfilled') {
        snapshots.push(result.value);
      }
    }

    return snapshots;
  }

  // ─── Price Impact Estimation ────────────────────────────────

  /**
   * Estimate how much SOL we'll receive for selling `tokenAmount`
   * against the current bonding curve state.
   *
   * Uses the constant-product approximation:
   *   solOut = (virtualSol * tokenAmount) / (virtualTokens + tokenAmount)
   */
  private estimateSolProceeds(
    tokenAmount: BN,
    curve: DecodedBondingCurve,
    currentPriceLamports: BN,
  ): BN {
    const virtualSol = new BN(curve.virtualSolReserves.toString());
    const virtualTokens = new BN(curve.virtualTokenReserves.toString());

    if (virtualTokens.add(tokenAmount).isZero()) {
      return new BN(0);
    }

    // Constant product: solOut = (virtualSol * tokenAmount) / (virtualTokens + tokenAmount)
    const solOut = virtualSol
      .mul(tokenAmount)
      .div(virtualTokens.add(tokenAmount));

    return solOut;
  }

  /**
   * Estimate price impact as a percentage.
   *
   * Impact = 1 - (effectivePrice / spotPrice)
   * where effectivePrice = solOut / tokenAmount
   *       spotPrice = virtualSol / virtualTokens
   */
  private estimatePriceImpact(
    tokenAmount: BN,
    virtualSol: BN,
    virtualTokens: BN,
  ): number {
    if (virtualTokens.isZero() || tokenAmount.isZero()) return 0;

    // Effective price per token after sell
    const solOut = virtualSol
      .mul(tokenAmount)
      .div(virtualTokens.add(tokenAmount));
    const effectivePrice = solOut.toNumber() / tokenAmount.toNumber();

    // Spot price
    const spotPrice = virtualSol.toNumber() / virtualTokens.toNumber();

    if (spotPrice === 0) return 0;

    const impact = (1 - effectivePrice / spotPrice) * 100;
    return Math.max(0, impact);
  }

  // ─── Utilities ──────────────────────────────────────────────

  private emptyPlan(mint: string): ExitPlan {
    return {
      id: uuid(),
      mint,
      totalTokensToSell: new BN(0),
      totalExpectedSol: new BN(0),
      orders: [],
      expectedDuration: 0,
      expectedPriceImpact: 0,
      strategy: this.config.strategy,
      entryPrice: this.entryPrice,
      createdAt: Date.now(),
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /** Whether the agent is currently executing a sell plan */
  isExecuting(): boolean {
    return this.executing;
  }

  /** Whether monitoring is currently active */
  isMonitoring(): boolean {
    return this.monitoring;
  }

  /** Get the current peak price observed during monitoring */
  getPeakPrice(): number {
    return this.peakPrice;
  }
}
