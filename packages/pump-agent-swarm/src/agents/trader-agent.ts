/**
 * Trader Agent V2 — Enhanced trading on Pump.fun bonding curves
 *
 * Each trader agent:
 * 1. Has its own Solana wallet
 * 2. Follows a trading strategy with personality-driven behavior
 * 3. Executes trades with anti-detection randomization
 * 4. Tracks advanced P&L with unrealized gains, Sharpe ratio, drawdown
 * 5. Supports directed/paired trading with other agents
 * 6. Coordinates with the swarm via instruction interface
 * 7. Integrates with event bus, structured logging, metrics, error handler
 *
 * Multiple trader agents run concurrently, each with a unique personality
 * that affects timing, sizing, and direction decisions.
 */

import {
  Connection,
  Transaction,
  ComputeBudgetProgram,
  sendAndConfirmTransaction,
  PublicKey,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import { getAssociatedTokenAddress, getAccount, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { PUMP_SDK, OnlinePumpSdk } from '@pump-fun/pump-sdk';
import BN from 'bn.js';
import { v4 as uuid } from 'uuid';
import { EventEmitter } from 'eventemitter3';

import { SwarmEventBus } from '../infra/event-bus.js';
import { SwarmErrorHandler } from '../infra/error-handler.js';
import { SwarmLogger } from '../infra/logger.js';
import { MetricsCollector } from '../infra/metrics.js';
import type {
  AgentWallet,
  TradingStrategy,
  TradeOrder,
  TradeResult,
  TradeDirection,
  TraderStats,
} from '../types.js';

// ─── Trading Personality ──────────────────────────────────────

export interface TraderPersonality {
  /** Base aggression (0=conservative, 1=aggressive) */
  aggression: number;
  /** Timing randomness multiplier */
  timingVariance: number;
  /** Trade size randomness */
  sizeVariance: number;
  /** Likelihood to follow trend vs counter-trade (0=contrarian, 1=momentum) */
  trendFollowing: number;
  /** Maximum position as % of budget */
  maxPositionPercent: number;
  /** Whether to prefer natural (non-round) sizes */
  naturalSizing: boolean;
}

// ─── Advanced P&L ─────────────────────────────────────────────

export interface AdvancedPnL {
  /** Total SOL spent on buys */
  solSpent: BN;
  /** Total SOL received from sells */
  solReceived: BN;
  /** Realized profit/loss (sells - cost basis of sold tokens) */
  realizedPnl: BN;
  /** Unrealized P&L based on current market price */
  unrealizedPnl: BN;
  /** Current token balance */
  tokensHeld: BN;
  /** Volume-weighted average cost basis (lamports per token) */
  avgEntryPrice: BN;
  /** Last known market price (lamports per token) */
  currentPrice: BN;
  /** Total SOL volume traded (buys + sells) */
  totalVolume: BN;
  /** Worst P&L point reached */
  maxDrawdown: BN;
  /** Best P&L point reached */
  bestPnl: BN;
  /** Risk-adjusted return (annualized) */
  sharpeRatio: number;
  /** Percentage of profitable trades */
  winRate: number;
  /** Average SOL profit on winning trades */
  avgWin: BN;
  /** Average SOL loss on losing trades */
  avgLoss: BN;
}

// ─── Trade Instruction (from coordinator) ─────────────────────

export interface TradeInstruction {
  /** Unique instruction ID for tracking */
  instructionId: string;
  /** Direction to trade */
  direction: TradeDirection;
  /** SOL amount for buys (lamports) / Token amount for sells */
  amount: BN;
  /** Max slippage BPS */
  slippageBps: number;
  /** Optional delay before executing (ms) */
  delayMs?: number;
  /** Correlation ID for paired trades */
  correlationId?: string;
  /** Priority override */
  priorityFeeMicroLamports?: number;
}

// ─── Paired Trade Tracking ────────────────────────────────────

interface PairedTradeRecord {
  correlationId: string;
  myResult: TradeResult;
  counterpartyId: string;
  direction: TradeDirection;
  timestamp: number;
}

// ─── Events ───────────────────────────────────────────────────

interface TraderAgentEvents {
  'trade:submitted': (order: TradeOrder) => void;
  'trade:executed': (result: TradeResult) => void;
  'trade:failed': (order: TradeOrder, error: Error) => void;
  'trade:skipped': (reason: string) => void;
  'trade:paired': (record: PairedTradeRecord) => void;
  'balance:updated': (sol: number, tokens: number) => void;
  'personality:applied': (personality: TraderPersonality) => void;
  'instruction:received': (instruction: TradeInstruction) => void;
  'pnl:updated': (pnl: AdvancedPnL) => void;
  'stopped': (reason: string) => void;
}

// ─── Helpers ──────────────────────────────────────────────────

/**
 * Generate a Poisson-distributed random interval.
 * More realistic than uniform random — models real human trading patterns.
 * Uses the inverse transform method: -ln(U) * mean.
 */
function poissonInterval(meanMs: number): number {
  // Clamp to avoid zero or infinite values
  const u = Math.max(1e-10, Math.random());
  return Math.min(-Math.log(u) * meanMs, meanMs * 5);
}

/**
 * Generate a random personality with coherent traits.
 * Aggression correlates with timing variance and trend following.
 */
function generatePersonality(): TraderPersonality {
  const aggression = Math.random();
  return {
    aggression,
    timingVariance: 0.5 + Math.random() * 1.5,
    sizeVariance: 0.1 + Math.random() * 0.3,
    trendFollowing: 0.3 + aggression * 0.5 + (Math.random() - 0.5) * 0.2,
    maxPositionPercent: 0.3 + aggression * 0.5,
    naturalSizing: Math.random() > 0.3, // 70% use natural sizing
  };
}

/**
 * Apply natural sizing: avoid round numbers by adding ±noise.
 */
function naturalize(amount: number, variance: number): number {
  // Add small percentage noise to avoid round numbers
  const noise = 1 + (Math.random() - 0.5) * 2 * variance;
  const result = Math.floor(amount * noise);
  // Ensure the last digits aren't all zeros (less detectable)
  if (result % 1000 === 0 && result > 10000) {
    return result + Math.floor(Math.random() * 999) + 1;
  }
  return result;
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

// ─── Trader Agent ─────────────────────────────────────────────

export class TraderAgent extends EventEmitter<TraderAgentEvents> {
  readonly id: string;
  readonly wallet: AgentWallet;

  private readonly connection: Connection;
  private strategy: TradingStrategy;
  private onlineSdk: OnlinePumpSdk | null = null;
  private mint: PublicKey | null = null;
  private running = false;
  private tradingEnabled = true;
  private tradeTimer: ReturnType<typeof setTimeout> | null = null;

  // Infrastructure
  private readonly logger: SwarmLogger;
  private readonly bus: SwarmEventBus;
  private readonly errorHandler: SwarmErrorHandler;
  private readonly metrics: MetricsCollector;

  // Personality
  readonly personality: TraderPersonality;

  // Stats tracking
  private stats: TraderStats;
  private tradeHistory: TradeResult[] = [];
  private startedAt = 0;

  // Advanced P&L tracking
  private advancedPnl: AdvancedPnL;
  private pnlSnapshots: number[] = []; // historical P&L values for Sharpe
  private winningTrades: BN[] = [];
  private losingTrades: BN[] = [];
  private totalCostBasis: BN = new BN(0); // total SOL spent on current holdings

  // Paired trade tracking
  private pairedTrades: PairedTradeRecord[] = [];

  // Anti-detection state
  private lastTradeDirection: TradeDirection | null = null;
  private consecutiveSameDirection = 0;
  private cyclesSinceLastSkip = 0;

  constructor(
    id: string,
    wallet: AgentWallet,
    connection: Connection,
    strategy: TradingStrategy,
    personality?: TraderPersonality,
    bus?: SwarmEventBus,
    errorHandler?: SwarmErrorHandler,
  ) {
    super();
    this.id = id;
    this.wallet = wallet;
    this.connection = connection;
    this.strategy = { ...strategy };
    this.personality = personality ?? generatePersonality();

    // Infrastructure
    this.logger = SwarmLogger.create(id, 'trading');
    this.bus = bus ?? SwarmEventBus.getInstance();
    this.errorHandler = errorHandler ?? new SwarmErrorHandler(this.bus);
    this.metrics = MetricsCollector.getInstance();

    this.stats = {
      traderId: id,
      address: wallet.address,
      totalBuys: 0,
      totalSells: 0,
      solSpent: new BN(0),
      solReceived: new BN(0),
      tokensHeld: new BN(0),
    };

    this.advancedPnl = {
      solSpent: new BN(0),
      solReceived: new BN(0),
      realizedPnl: new BN(0),
      unrealizedPnl: new BN(0),
      tokensHeld: new BN(0),
      avgEntryPrice: new BN(0),
      currentPrice: new BN(0),
      totalVolume: new BN(0),
      maxDrawdown: new BN(0),
      bestPnl: new BN(0),
      sharpeRatio: 0,
      winRate: 0,
      avgWin: new BN(0),
      avgLoss: new BN(0),
    };

    this.logger.info('Trader agent created', {
      personality: {
        aggression: this.personality.aggression.toFixed(2),
        timingVariance: this.personality.timingVariance.toFixed(2),
        sizeVariance: this.personality.sizeVariance.toFixed(2),
        trendFollowing: this.personality.trendFollowing.toFixed(2),
        maxPositionPercent: this.personality.maxPositionPercent.toFixed(2),
        naturalSizing: this.personality.naturalSizing,
      },
    });
    this.emit('personality:applied', this.personality);
  }

  private getOnlineSdk(): OnlinePumpSdk {
    if (!this.onlineSdk) {
      this.onlineSdk = new OnlinePumpSdk(this.connection);
    }
    return this.onlineSdk;
  }

  // ─── Lifecycle ──────────────────────────────────────────────

  /**
   * Start the trading loop for a specific token.
   *
   * The agent will trade at random intervals within the strategy's
   * min/max interval range, choosing buy or sell based on the
   * configured buy/sell ratio, personality, and current token holdings.
   * Anti-detection patterns are applied automatically.
   */
  start(mintAddress: string): void {
    this.mint = new PublicKey(mintAddress);
    this.running = true;
    this.startedAt = Date.now();

    this.logger.info(`Started trading ${mintAddress}`);
    this.bus.emit('agent:started', 'trading', this.id, {
      mint: mintAddress,
      personality: this.personality,
    });
    this.metrics.counter('swarm.trader.started', { traderId: this.id }).inc();
    this.scheduleNextTrade();
  }

  /**
   * Stop the trading loop gracefully.
   */
  stop(reason: string = 'manual'): void {
    this.running = false;
    if (this.tradeTimer) {
      clearTimeout(this.tradeTimer);
      this.tradeTimer = null;
    }
    this.emit('stopped', reason);
    this.logger.info(`Stopped: ${reason}`);
    this.bus.emit('agent:stopped', 'trading', this.id, { reason });
    this.metrics.counter('swarm.trader.stopped', { traderId: this.id, reason }).inc();
  }

  // ─── Coordination Interface ─────────────────────────────────

  /**
   * Receive a trade instruction from the coordinator.
   * Executes the instruction after an optional delay.
   */
  async receiveInstruction(instruction: TradeInstruction): Promise<TradeResult> {
    this.emit('instruction:received', instruction);
    this.logger.info('Received trade instruction', {
      instructionId: instruction.instructionId,
      direction: instruction.direction,
      amount: instruction.amount.toString(),
      correlationId: instruction.correlationId,
    });
    this.bus.emit('trade:instruction-received', 'coordination', this.id, {
      instructionId: instruction.instructionId,
      direction: instruction.direction,
      correlationId: instruction.correlationId,
    });

    // Optional delay for staggering paired trades
    if (instruction.delayMs && instruction.delayMs > 0) {
      await sleep(instruction.delayMs);
    }

    const slippage = instruction.slippageBps;

    if (instruction.direction === 'buy') {
      return this.buy(instruction.amount, slippage);
    }
    return this.sell(instruction.amount, slippage);
  }

  /**
   * Pause or resume trading from the coordinator.
   */
  setTradingEnabled(enabled: boolean): void {
    this.tradingEnabled = enabled;
    this.logger.info(`Trading ${enabled ? 'enabled' : 'disabled'}`);
    this.bus.emit('agent:trading-toggle', 'coordination', this.id, { enabled });
  }

  /**
   * Hot-reload strategy parameters without restarting.
   */
  adjustStrategy(updates: Partial<TradingStrategy>): void {
    const before = { ...this.strategy };
    this.strategy = { ...this.strategy, ...updates };
    this.logger.info('Strategy adjusted', {
      changes: Object.keys(updates),
      before: { minInterval: before.minIntervalSeconds, maxInterval: before.maxIntervalSeconds },
      after: { minInterval: this.strategy.minIntervalSeconds, maxInterval: this.strategy.maxIntervalSeconds },
    });
    this.bus.emit('agent:strategy-adjusted', 'coordination', this.id, {
      updates: Object.keys(updates),
    });
  }

  /**
   * Get current position details.
   */
  getPosition(): { tokens: BN; solValue: BN; percentage: number } {
    const tokens = this.advancedPnl.tokensHeld;
    const solValue = tokens.gtn(0) && this.advancedPnl.currentPrice.gtn(0)
      ? tokens.mul(this.advancedPnl.currentPrice).div(new BN(LAMPORTS_PER_SOL))
      : new BN(0);

    const totalBudget = this.strategy.maxTotalBudgetLamports.toNumber();
    const percentage = totalBudget > 0
      ? (solValue.toNumber() / totalBudget) * 100
      : 0;

    return { tokens, solValue, percentage };
  }

  // ─── Directed / Paired Trading ──────────────────────────────

  /**
   * Execute a paired trade with a counterparty agent.
   *
   * Agent A buys while Agent B sells (or vice versa) the same amount ± variance.
   * Transactions are staggered by 1-5 seconds for realism.
   * Both results are tracked and correlated for P&L netting.
   */
  async executePairedTrade(
    counterparty: TraderAgent,
    direction: TradeDirection,
  ): Promise<[TradeResult, TradeResult]> {
    if (!this.mint) throw new Error('No mint set — call start() first');

    const correlationId = uuid();
    const baseAmount = this.randomTradeSize();

    // Add variance to counterparty's amount (±15%)
    const varianceFactor = 1 + (Math.random() - 0.5) * 0.3;
    const counterpartyAmount = new BN(Math.floor(baseAmount.toNumber() * varianceFactor));

    // Stagger timing: 1-5 seconds between trades
    const staggerMs = 1000 + Math.floor(Math.random() * 4000);

    const slippage = 500; // 5%
    const counterDirection: TradeDirection = direction === 'buy' ? 'sell' : 'buy';

    this.logger.info('Executing paired trade', {
      correlationId,
      myDirection: direction,
      myAmount: baseAmount.toString(),
      counterpartyId: counterparty.id,
      counterDirection,
      counterAmount: counterpartyAmount.toString(),
      staggerMs,
    });

    this.bus.emit('trade:paired-start', 'coordination', this.id, {
      correlationId,
      counterpartyId: counterparty.id,
      direction,
      counterDirection,
    });

    // Randomly decide who goes first for anti-detection
    const iGoFirst = Math.random() > 0.5;

    let myResult: TradeResult;
    let counterResult: TradeResult;

    if (iGoFirst) {
      myResult = await this.receiveInstruction({
        instructionId: uuid(),
        direction,
        amount: baseAmount,
        slippageBps: slippage,
        correlationId,
      });

      await sleep(staggerMs);

      counterResult = await counterparty.receiveInstruction({
        instructionId: uuid(),
        direction: counterDirection,
        amount: counterpartyAmount,
        slippageBps: slippage,
        correlationId,
      });
    } else {
      counterResult = await counterparty.receiveInstruction({
        instructionId: uuid(),
        direction: counterDirection,
        amount: counterpartyAmount,
        slippageBps: slippage,
        correlationId,
      });

      await sleep(staggerMs);

      myResult = await this.receiveInstruction({
        instructionId: uuid(),
        direction,
        amount: baseAmount,
        slippageBps: slippage,
        correlationId,
      });
    }

    // Track paired trade
    const record: PairedTradeRecord = {
      correlationId,
      myResult,
      counterpartyId: counterparty.id,
      direction,
      timestamp: Date.now(),
    };
    this.pairedTrades.push(record);
    this.emit('trade:paired', record);

    this.bus.emit('trade:paired-complete', 'coordination', this.id, {
      correlationId,
      mySuccess: myResult.success,
      counterSuccess: counterResult.success,
    });

    return [myResult, counterResult];
  }

  // ─── Core Trading ───────────────────────────────────────────

  /**
   * Execute a single buy order on the bonding curve.
   * Uses retry logic, circuit breaker, and preflight simulation.
   */
  async buy(solAmountLamports: BN, slippageBps: number): Promise<TradeResult> {
    if (!this.mint) throw new Error('No mint set — call start() first');

    // Apply personality-driven natural sizing
    const finalAmount = this.personality.naturalSizing
      ? new BN(naturalize(solAmountLamports.toNumber(), this.personality.sizeVariance))
      : solAmountLamports;

    const order: TradeOrder = {
      id: uuid(),
      traderId: this.id,
      mint: this.mint.toBase58(),
      direction: 'buy',
      amount: finalAmount,
      slippageBps,
      priorityFeeMicroLamports: this.strategy.priorityFeeMicroLamports,
    };

    this.emit('trade:submitted', order);
    this.bus.emit('trade:submitted', 'trading', this.id, {
      orderId: order.id,
      direction: 'buy',
      amount: finalAmount.toString(),
    });

    const startTime = Date.now();

    try {
      const result = await this.errorHandler.withCircuitBreaker('trade', async () => {
        return this.errorHandler.withRetry(async () => {
          return this.executeBuy(order, finalAmount, slippageBps);
        }, { maxRetries: 2, initialDelayMs: 500 });
      });

      // Record metrics
      const latency = Date.now() - startTime;
      this.metrics.histogram('swarm.trade.latency_ms', undefined, { traderId: this.id, direction: 'buy' }).observe(latency);
      this.metrics.counter('swarm.trade.total', { traderId: this.id, direction: 'buy', status: 'success' }).inc();

      // Update advanced P&L after successful buy
      if (result.success) {
        this.updatePnlAfterBuy(finalAmount, result.amountOut, result.executionPrice);
      }

      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('Buy failed after retries', err, { orderId: order.id });

      this.metrics.counter('swarm.trade.total', { traderId: this.id, direction: 'buy', status: 'failed' }).inc();

      const failedResult: TradeResult = {
        order,
        signature: '',
        amountOut: new BN(0),
        executionPrice: new BN(0),
        feesPaid: new BN(0),
        success: false,
        error: err.message,
        executedAt: Date.now(),
      };
      this.tradeHistory.push(failedResult);
      this.emit('trade:failed', order, err);
      this.bus.emit('trade:failed', 'trading', this.id, {
        orderId: order.id,
        error: err.message,
      });
      return failedResult;
    }
  }

  /**
   * Internal buy execution — called within retry/circuit breaker.
   */
  private async executeBuy(order: TradeOrder, solAmountLamports: BN, slippageBps: number): Promise<TradeResult> {
    const mint = this.mint!;
    const sdk = this.getOnlineSdk();
    const global = await sdk.fetchGlobal();
    const buyState = await sdk.fetchBuyState(
      mint,
      this.wallet.keypair.publicKey,
      TOKEN_PROGRAM_ID,
    );

    const buyIxs = await PUMP_SDK.buyInstructions({
      global,
      bondingCurveAccountInfo: buyState.bondingCurveAccountInfo,
      bondingCurve: buyState.bondingCurve,
      associatedUserAccountInfo: buyState.associatedUserAccountInfo,
      mint,
      user: this.wallet.keypair.publicKey,
      amount: new BN(0),
      solAmount: solAmountLamports,
      slippage: slippageBps / 100,
      tokenProgram: TOKEN_PROGRAM_ID,
    });

    const dynamicPriorityFee = await this.getDynamicPriorityFee();
    const computeIxs = [
      ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }),
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: dynamicPriorityFee }),
    ];

    const { blockhash } = await this.connection.getLatestBlockhash('confirmed');
    const tx = new Transaction({ recentBlockhash: blockhash, feePayer: this.wallet.keypair.publicKey });
    tx.add(...computeIxs, ...buyIxs);

    // Preflight simulation — catch errors before spending SOL on fees
    await this.simulateTransaction(tx);

    const signature = await sendAndConfirmTransaction(
      this.connection,
      tx,
      [this.wallet.keypair],
      { commitment: 'confirmed', maxRetries: 3 },
    );

    // Fetch token balance after buy
    const ata = await getAssociatedTokenAddress(mint, this.wallet.keypair.publicKey);
    let tokensReceived = new BN(0);
    try {
      const tokenAccount = await getAccount(this.connection, ata);
      const newBalance = new BN(tokenAccount.amount.toString());
      tokensReceived = newBalance.sub(this.stats.tokensHeld);
      this.stats.tokensHeld = newBalance;
    } catch {
      // ATA might not exist yet on first buy
    }

    const result: TradeResult = {
      order,
      signature,
      amountOut: tokensReceived,
      executionPrice: tokensReceived.gtn(0)
        ? solAmountLamports.mul(new BN(LAMPORTS_PER_SOL)).div(tokensReceived)
        : new BN(0),
      feesPaid: new BN(5000),
      success: true,
      executedAt: Date.now(),
    };

    // Update basic stats
    this.stats.totalBuys++;
    this.stats.solSpent = this.stats.solSpent.add(solAmountLamports);
    this.stats.lastTradeAt = result.executedAt;
    this.tradeHistory.push(result);

    this.emit('trade:executed', result);
    this.bus.emit('trade:executed', 'trading', this.id, {
      orderId: order.id,
      direction: 'buy',
      signature,
      solAmount: solAmountLamports.toString(),
      tokensReceived: tokensReceived.toString(),
    });
    this.logger.info('Buy executed', {
      signature: signature.slice(0, 16),
      sol: solAmountLamports.toString(),
      tokens: tokensReceived.toString(),
    });

    return result;
  }

  /**
   * Execute a single sell order on the bonding curve.
   * Uses retry logic, circuit breaker, and preflight simulation.
   */
  async sell(tokenAmount: BN, slippageBps: number): Promise<TradeResult> {
    if (!this.mint) throw new Error('No mint set — call start() first');

    // Apply personality-driven natural sizing
    const finalAmount = this.personality.naturalSizing
      ? new BN(naturalize(tokenAmount.toNumber(), this.personality.sizeVariance))
      : tokenAmount;

    const order: TradeOrder = {
      id: uuid(),
      traderId: this.id,
      mint: this.mint.toBase58(),
      direction: 'sell',
      amount: finalAmount,
      slippageBps,
      priorityFeeMicroLamports: this.strategy.priorityFeeMicroLamports,
    };

    this.emit('trade:submitted', order);
    this.bus.emit('trade:submitted', 'trading', this.id, {
      orderId: order.id,
      direction: 'sell',
      amount: finalAmount.toString(),
    });

    const startTime = Date.now();

    try {
      const result = await this.errorHandler.withCircuitBreaker('trade', async () => {
        return this.errorHandler.withRetry(async () => {
          return this.executeSell(order, finalAmount, slippageBps);
        }, { maxRetries: 2, initialDelayMs: 500 });
      });

      // Record metrics
      const latency = Date.now() - startTime;
      this.metrics.histogram('swarm.trade.latency_ms', undefined, { traderId: this.id, direction: 'sell' }).observe(latency);
      this.metrics.counter('swarm.trade.total', { traderId: this.id, direction: 'sell', status: 'success' }).inc();

      // Update advanced P&L after successful sell
      if (result.success) {
        this.updatePnlAfterSell(finalAmount, result.amountOut);
      }

      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('Sell failed after retries', err, { orderId: order.id });

      this.metrics.counter('swarm.trade.total', { traderId: this.id, direction: 'sell', status: 'failed' }).inc();

      const failedResult: TradeResult = {
        order,
        signature: '',
        amountOut: new BN(0),
        executionPrice: new BN(0),
        feesPaid: new BN(0),
        success: false,
        error: err.message,
        executedAt: Date.now(),
      };
      this.tradeHistory.push(failedResult);
      this.emit('trade:failed', order, err);
      this.bus.emit('trade:failed', 'trading', this.id, {
        orderId: order.id,
        error: err.message,
      });
      return failedResult;
    }
  }

  /**
   * Internal sell execution — called within retry/circuit breaker.
   */
  private async executeSell(order: TradeOrder, tokenAmount: BN, slippageBps: number): Promise<TradeResult> {
    const mint = this.mint!;
    const sdk = this.getOnlineSdk();
    const global = await sdk.fetchGlobal();
    const sellState = await sdk.fetchSellState(
      mint,
      this.wallet.keypair.publicKey,
      TOKEN_PROGRAM_ID,
    );

    const sellIxs = await PUMP_SDK.sellInstructions({
      global,
      bondingCurveAccountInfo: sellState.bondingCurveAccountInfo,
      bondingCurve: sellState.bondingCurve,
      mint,
      user: this.wallet.keypair.publicKey,
      amount: tokenAmount,
      solAmount: new BN(0),
      slippage: slippageBps / 100,
      tokenProgram: TOKEN_PROGRAM_ID,
      mayhemMode: false,
    });

    const dynamicPriorityFee = await this.getDynamicPriorityFee();
    const computeIxs = [
      ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }),
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: dynamicPriorityFee }),
    ];

    const { blockhash } = await this.connection.getLatestBlockhash('confirmed');
    const tx = new Transaction({ recentBlockhash: blockhash, feePayer: this.wallet.keypair.publicKey });
    tx.add(...computeIxs, ...sellIxs);

    // Preflight simulation
    await this.simulateTransaction(tx);

    // Get SOL balance before sell to calculate SOL received
    const solBefore = await this.connection.getBalance(this.wallet.keypair.publicKey);

    const signature = await sendAndConfirmTransaction(
      this.connection,
      tx,
      [this.wallet.keypair],
      { commitment: 'confirmed', maxRetries: 3 },
    );

    const solAfter = await this.connection.getBalance(this.wallet.keypair.publicKey);
    const solReceived = new BN(Math.max(0, solAfter - solBefore));

    // Update token balance
    const ata = await getAssociatedTokenAddress(mint, this.wallet.keypair.publicKey);
    try {
      const tokenAccount = await getAccount(this.connection, ata);
      this.stats.tokensHeld = new BN(tokenAccount.amount.toString());
    } catch {
      this.stats.tokensHeld = new BN(0);
    }

    const result: TradeResult = {
      order,
      signature,
      amountOut: solReceived,
      executionPrice: tokenAmount.gtn(0)
        ? solReceived.mul(new BN(LAMPORTS_PER_SOL)).div(tokenAmount)
        : new BN(0),
      feesPaid: new BN(5000),
      success: true,
      executedAt: Date.now(),
    };

    // Update basic stats
    this.stats.totalSells++;
    this.stats.solReceived = this.stats.solReceived.add(solReceived);
    this.stats.lastTradeAt = result.executedAt;
    this.tradeHistory.push(result);

    this.emit('trade:executed', result);
    this.bus.emit('trade:executed', 'trading', this.id, {
      orderId: order.id,
      direction: 'sell',
      signature,
      tokenAmount: tokenAmount.toString(),
      solReceived: solReceived.toString(),
    });
    this.logger.info('Sell executed', {
      signature: signature.slice(0, 16),
      tokens: tokenAmount.toString(),
      sol: solReceived.toString(),
    });

    return result;
  }

  // ─── Trade Execution Helpers ────────────────────────────────

  /**
   * Simulate a transaction before submitting to catch errors early
   * and avoid wasting SOL on failed transaction fees.
   */
  private async simulateTransaction(tx: Transaction): Promise<void> {
    try {
      const simulation = await this.connection.simulateTransaction(tx);
      if (simulation.value.err) {
        const errMsg = typeof simulation.value.err === 'string'
          ? simulation.value.err
          : JSON.stringify(simulation.value.err);
        throw new Error(`Transaction simulation failed: ${errMsg}`);
      }
    } catch (error) {
      // Rethrow simulation failures — don't submit a tx that will fail
      if (error instanceof Error && error.message.includes('simulation failed')) {
        throw error;
      }
      // Network errors during simulation are non-fatal — proceed with submission
      this.logger.warn('Simulation check failed (non-fatal)', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Get dynamic priority fee based on recent network congestion.
   * Falls back to strategy's configured fee if estimation fails.
   */
  private async getDynamicPriorityFee(): Promise<number> {
    try {
      const fees = await this.connection.getRecentPrioritizationFees();
      if (fees.length === 0) {
        return this.strategy.priorityFeeMicroLamports;
      }

      // Use the median of recent fees, with min/max bounds
      const sortedFees = fees
        .map((f) => f.prioritizationFee)
        .sort((a, b) => a - b);
      const medianFee = sortedFees[Math.floor(sortedFees.length / 2)];

      // Aggressive traders pay more for speed, conservative less
      const personalityMultiplier = 0.8 + this.personality.aggression * 0.4;
      const adjustedFee = Math.floor(medianFee * personalityMultiplier);

      // Bound between 1000 and 500000 microlamports
      const minFee = 1_000;
      const maxFee = 500_000;
      return Math.max(minFee, Math.min(maxFee, adjustedFee));
    } catch {
      return this.strategy.priorityFeeMicroLamports;
    }
  }

  // ─── Advanced P&L Tracking ──────────────────────────────────

  /**
   * Update P&L metrics after a successful buy.
   * Maintains volume-weighted average cost basis.
   */
  private updatePnlAfterBuy(solSpent: BN, tokensReceived: BN, executionPrice: BN): void {
    this.advancedPnl.solSpent = this.advancedPnl.solSpent.add(solSpent);
    this.advancedPnl.totalVolume = this.advancedPnl.totalVolume.add(solSpent);
    this.advancedPnl.tokensHeld = this.stats.tokensHeld.clone();

    // Update cost basis
    this.totalCostBasis = this.totalCostBasis.add(solSpent);

    // Recalculate volume-weighted average entry price
    if (this.advancedPnl.tokensHeld.gtn(0)) {
      this.advancedPnl.avgEntryPrice = this.totalCostBasis
        .mul(new BN(LAMPORTS_PER_SOL))
        .div(this.advancedPnl.tokensHeld);
    }

    // Update current price
    if (executionPrice.gtn(0)) {
      this.advancedPnl.currentPrice = executionPrice;
    }

    this.updateUnrealizedPnl();
    this.updatePnlMetrics();
    this.emit('pnl:updated', this.getAdvancedPnl());
  }

  /**
   * Update P&L metrics after a successful sell.
   * Calculates realized P&L using average cost basis.
   */
  private updatePnlAfterSell(tokensSold: BN, solReceived: BN): void {
    this.advancedPnl.solReceived = this.advancedPnl.solReceived.add(solReceived);
    this.advancedPnl.totalVolume = this.advancedPnl.totalVolume.add(solReceived);

    // Calculate cost basis of sold tokens
    const prevTokens = this.advancedPnl.tokensHeld;
    if (prevTokens.gtn(0) && this.totalCostBasis.gtn(0)) {
      // Proportional cost basis: (tokens sold / total tokens) * total cost
      const costOfSold = this.totalCostBasis.mul(tokensSold).div(prevTokens);
      const tradePnl = solReceived.sub(costOfSold);

      this.advancedPnl.realizedPnl = this.advancedPnl.realizedPnl.add(tradePnl);

      // Deduct cost basis
      this.totalCostBasis = this.totalCostBasis.sub(costOfSold);

      // Track win/loss
      if (tradePnl.gtn(0)) {
        this.winningTrades.push(tradePnl);
      } else if (tradePnl.isNeg()) {
        this.losingTrades.push(tradePnl.abs());
      }
    }

    // Update token balance
    this.advancedPnl.tokensHeld = this.stats.tokensHeld.clone();

    // Update current price from sell execution
    if (tokensSold.gtn(0)) {
      this.advancedPnl.currentPrice = solReceived
        .mul(new BN(LAMPORTS_PER_SOL))
        .div(tokensSold);
    }

    this.updateUnrealizedPnl();
    this.updatePnlMetrics();
    this.emit('pnl:updated', this.getAdvancedPnl());
  }

  /**
   * Recalculate unrealized P&L using current market price.
   */
  private updateUnrealizedPnl(): void {
    if (this.advancedPnl.tokensHeld.gtn(0) && this.advancedPnl.currentPrice.gtn(0)) {
      // Current value of holdings
      const holdingsValue = this.advancedPnl.tokensHeld
        .mul(this.advancedPnl.currentPrice)
        .div(new BN(LAMPORTS_PER_SOL));

      // Unrealized = current value - remaining cost basis
      this.advancedPnl.unrealizedPnl = holdingsValue.sub(this.totalCostBasis);
    } else {
      this.advancedPnl.unrealizedPnl = new BN(0);
    }
  }

  /**
   * Update aggregate P&L metrics: drawdown, best P&L, win rate, Sharpe ratio.
   */
  private updatePnlMetrics(): void {
    const totalPnl = this.advancedPnl.realizedPnl.add(this.advancedPnl.unrealizedPnl);
    const pnlNumber = totalPnl.toNumber();

    // Track P&L snapshots for Sharpe ratio
    this.pnlSnapshots.push(pnlNumber);

    // Max drawdown (worst P&L point)
    if (totalPnl.lt(this.advancedPnl.maxDrawdown)) {
      this.advancedPnl.maxDrawdown = totalPnl.clone();
    }

    // Best P&L
    if (totalPnl.gt(this.advancedPnl.bestPnl)) {
      this.advancedPnl.bestPnl = totalPnl.clone();
    }

    // Win rate
    const totalDecided = this.winningTrades.length + this.losingTrades.length;
    this.advancedPnl.winRate = totalDecided > 0
      ? this.winningTrades.length / totalDecided
      : 0;

    // Average win
    if (this.winningTrades.length > 0) {
      const totalWins = this.winningTrades.reduce((sum, w) => sum.add(w), new BN(0));
      this.advancedPnl.avgWin = totalWins.div(new BN(this.winningTrades.length));
    }

    // Average loss
    if (this.losingTrades.length > 0) {
      const totalLosses = this.losingTrades.reduce((sum, l) => sum.add(l), new BN(0));
      this.advancedPnl.avgLoss = totalLosses.div(new BN(this.losingTrades.length));
    }

    // Sharpe ratio (simplified: mean return / std dev of returns)
    if (this.pnlSnapshots.length >= 2) {
      const returns: number[] = [];
      for (let i = 1; i < this.pnlSnapshots.length; i++) {
        returns.push(this.pnlSnapshots[i] - this.pnlSnapshots[i - 1]);
      }
      const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
      const variance = returns.reduce((sum, r) => sum + (r - meanReturn) ** 2, 0) / returns.length;
      const stdDev = Math.sqrt(variance);
      this.advancedPnl.sharpeRatio = stdDev > 0 ? meanReturn / stdDev : 0;
    }

    // Update metrics gauges
    this.metrics.gauge('swarm.trader.pnl_realized', { traderId: this.id })
      .set(this.advancedPnl.realizedPnl.toNumber());
    this.metrics.gauge('swarm.trader.pnl_unrealized', { traderId: this.id })
      .set(this.advancedPnl.unrealizedPnl.toNumber());
    this.metrics.gauge('swarm.trader.tokens_held', { traderId: this.id })
      .set(this.advancedPnl.tokensHeld.toNumber());
    this.metrics.gauge('swarm.trader.win_rate', { traderId: this.id })
      .set(this.advancedPnl.winRate);
  }

  // ─── Private: Trading Loop ──────────────────────────────────

  private scheduleNextTrade(): void {
    if (!this.running) return;

    // Check stopping conditions
    if (this.shouldStop()) return;

    // Use Poisson distribution for more natural interval timing
    const meanIntervalMs =
      ((this.strategy.minIntervalSeconds + this.strategy.maxIntervalSeconds) / 2) * 1000;

    // Apply personality's timing variance
    const adjustedMean = meanIntervalMs * this.personality.timingVariance;
    const intervalMs = poissonInterval(adjustedMean);

    // Add small jitter to avoid exact-second boundaries
    const jitterMs = Math.floor(Math.random() * 500) - 250;
    const finalIntervalMs = Math.max(500, intervalMs + jitterMs);

    this.tradeTimer = setTimeout(async () => {
      if (!this.running || !this.tradingEnabled) return;

      // Anti-detection: occasionally skip a trade cycle (5-10% chance)
      this.cyclesSinceLastSkip++;
      const skipChance = 0.05 + (this.cyclesSinceLastSkip > 20 ? 0.05 : 0);
      if (Math.random() < skipChance && this.cyclesSinceLastSkip >= 3) {
        this.cyclesSinceLastSkip = 0;
        const skipReason = 'anti-detection-skip';
        this.emit('trade:skipped', skipReason);
        this.logger.debug('Skipped trade cycle for anti-detection');
        this.bus.emit('trade:skipped', 'trading', this.id, { reason: skipReason });
        this.scheduleNextTrade();
        return;
      }

      try {
        await this.executeTradeCycle();
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        this.logger.error('Trade cycle error', err);
        await this.errorHandler.handle(err, { traderId: this.id });
      }

      // Schedule next
      this.scheduleNextTrade();
    }, finalIntervalMs);
  }

  private async executeTradeCycle(): Promise<void> {
    // Decide direction with personality + anti-detection
    const direction = this.decideDirection();
    const slippageBps = 500; // 5% default slippage

    if (direction === 'buy') {
      // Use anti-detection sizing: 80% small trades, 20% large trades
      const size = this.antiDetectionTradeSize();
      await this.buy(size, slippageBps);
    } else {
      // Sell a portion of holdings
      if (this.stats.tokensHeld.gtn(0)) {
        // Personality-driven sell fraction
        const baseFraction = 0.1 + this.personality.aggression * 0.4;
        const variance = (Math.random() - 0.5) * 0.2;
        const sellFraction = Math.max(0.05, Math.min(0.8, baseFraction + variance));
        const sellAmount = this.stats.tokensHeld
          .mul(new BN(Math.floor(sellFraction * 10000)))
          .div(new BN(10000));

        if (sellAmount.gtn(0)) {
          await this.sell(sellAmount, slippageBps);
        }
      } else {
        // No tokens to sell, buy instead
        const size = this.antiDetectionTradeSize();
        await this.buy(size, slippageBps);
      }
    }
  }

  private decideDirection(): TradeDirection {
    // If we have no tokens, always buy
    if (this.stats.tokensHeld.isZero()) return 'buy';

    // Check position size limit from personality
    const position = this.getPosition();
    if (position.percentage > this.personality.maxPositionPercent * 100) {
      // Over max position — force sell
      return 'sell';
    }

    // Base probability from strategy
    const baseBuyProb = this.strategy.buySellRatio / (1 + this.strategy.buySellRatio);

    // Personality: trend following adjusts based on recent results
    let trendAdjustment = 0;
    if (this.tradeHistory.length > 0) {
      const lastTrade = this.tradeHistory[this.tradeHistory.length - 1];
      if (lastTrade.success && lastTrade.order.direction === 'buy') {
        // Last buy succeeded — trend followers buy more, contrarians sell
        trendAdjustment = (this.personality.trendFollowing - 0.5) * 0.15;
      } else if (lastTrade.success && lastTrade.order.direction === 'sell') {
        trendAdjustment = -(this.personality.trendFollowing - 0.5) * 0.15;
      }
    }

    // Anti-detection: avoid more than 3 consecutive same-direction trades
    let antiDetectionAdjustment = 0;
    if (this.consecutiveSameDirection >= 3) {
      // Strongly favor the opposite direction
      antiDetectionAdjustment = this.lastTradeDirection === 'buy' ? -0.3 : 0.3;
    }

    const finalBuyProb = Math.max(0.1, Math.min(0.9,
      baseBuyProb + trendAdjustment + antiDetectionAdjustment));

    const direction: TradeDirection = Math.random() < finalBuyProb ? 'buy' : 'sell';

    // Track consecutive direction for anti-detection
    if (direction === this.lastTradeDirection) {
      this.consecutiveSameDirection++;
    } else {
      this.consecutiveSameDirection = 1;
    }
    this.lastTradeDirection = direction;

    return direction;
  }

  /**
   * Generate trade size with anti-detection patterns:
   * - 80% small trades, 20% large trades
   * - ±15% randomization to avoid pattern detection
   * - Natural sizing to avoid round numbers
   */
  private antiDetectionTradeSize(): BN {
    const min = this.strategy.minTradeSizeLamports.toNumber();
    const max = this.strategy.maxTradeSizeLamports.toNumber();
    const range = max - min;

    let baseSize: number;

    // 80/20 split: small vs large trades
    if (Math.random() < 0.8) {
      // Small trade: 0-40% of range
      baseSize = min + Math.random() * range * 0.4;
    } else {
      // Large trade: 60-100% of range, adjusted by aggression
      const largeMin = min + range * 0.6;
      const largeRange = range * 0.4 * this.personality.aggression;
      baseSize = largeMin + Math.random() * largeRange;
    }

    // ±15% randomization
    const variance = 1 + (Math.random() - 0.5) * 0.3;
    const finalSize = Math.floor(baseSize * variance);

    // Apply personality-driven natural sizing
    if (this.personality.naturalSizing) {
      return new BN(naturalize(finalSize, this.personality.sizeVariance));
    }
    return new BN(finalSize);
  }

  private randomTradeSize(): BN {
    const min = this.strategy.minTradeSizeLamports.toNumber();
    const max = this.strategy.maxTradeSizeLamports.toNumber();
    const size = min + Math.random() * (max - min);
    return new BN(Math.floor(size));
  }

  private shouldStop(): boolean {
    // Max trades reached
    if (this.strategy.maxTrades && this.tradeHistory.length >= this.strategy.maxTrades) {
      this.stop('max-trades-reached');
      return true;
    }

    // Max duration reached
    if (this.strategy.maxDurationSeconds) {
      const elapsed = (Date.now() - this.startedAt) / 1000;
      if (elapsed >= this.strategy.maxDurationSeconds) {
        this.stop('max-duration-reached');
        return true;
      }
    }

    // Budget exhausted
    if (this.stats.solSpent.gte(this.strategy.maxTotalBudgetLamports)) {
      this.stop('budget-exhausted');
      return true;
    }

    return false;
  }

  // ─── Public: Stats & State ──────────────────────────────────

  getStats(): TraderStats {
    return { ...this.stats };
  }

  getAdvancedPnl(): AdvancedPnL {
    return {
      solSpent: this.advancedPnl.solSpent.clone(),
      solReceived: this.advancedPnl.solReceived.clone(),
      realizedPnl: this.advancedPnl.realizedPnl.clone(),
      unrealizedPnl: this.advancedPnl.unrealizedPnl.clone(),
      tokensHeld: this.advancedPnl.tokensHeld.clone(),
      avgEntryPrice: this.advancedPnl.avgEntryPrice.clone(),
      currentPrice: this.advancedPnl.currentPrice.clone(),
      totalVolume: this.advancedPnl.totalVolume.clone(),
      maxDrawdown: this.advancedPnl.maxDrawdown.clone(),
      bestPnl: this.advancedPnl.bestPnl.clone(),
      sharpeRatio: this.advancedPnl.sharpeRatio,
      winRate: this.advancedPnl.winRate,
      avgWin: this.advancedPnl.avgWin.clone(),
      avgLoss: this.advancedPnl.avgLoss.clone(),
    };
  }

  getTradeHistory(): TradeResult[] {
    return [...this.tradeHistory];
  }

  getPairedTrades(): PairedTradeRecord[] {
    return [...this.pairedTrades];
  }

  getNetPnl(): BN {
    return this.stats.solReceived.sub(this.stats.solSpent);
  }

  isRunning(): boolean {
    return this.running;
  }
}
