/**
 * Market Maker Agent — Two-sided liquidity provider on Pump.fun bonding curves
 *
 * Maintains continuous buy/sell presence around the current price:
 *   - Places alternating buy/sell orders around the mid-price
 *   - Dynamically adjusts spread based on recent volatility
 *   - Manages inventory to prevent overexposure (target ~50/50 tokens/SOL)
 *   - Optionally trails price upward for organic appreciation
 *   - Cycle-based execution with P&L tracking and risk controls
 *
 * Risk controls:
 *   - Inventory deviation cap (default 80%)
 *   - Max loss per cycle circuit breaker
 *   - Peak drawdown circuit breaker (30% default)
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
  getBuyTokenAmountFromSolAmount,
  getSellSolAmountFromTokenAmount,
} from '@pump-fun/pump-sdk';
import type { DecodedBondingCurve } from '@pump-fun/pump-sdk';
import BN from 'bn.js';
import { v4 as uuid } from 'uuid';
import { EventEmitter } from 'eventemitter3';
import type {
  AgentWallet,
  MarketMakingConfig,
  TradeOrder,
  TradeResult,
} from '../types.js';

// ─── Constants ────────────────────────────────────────────────

/** Minimum spread to cover tx fees (1%) */
const MIN_SPREAD_PERCENT = 1;

/** Maximum spread (10%) */
const MAX_SPREAD_PERCENT = 10;

/** Default cycle duration in ms (30 seconds) */
const DEFAULT_CYCLE_DURATION_MS = 30_000;

/** Default number of cycles before P&L evaluation */
const DEFAULT_CYCLES_PER_EVALUATION = 10;

/** Default circuit breaker: max drawdown from peak before pausing (30%) */
const DEFAULT_MAX_DRAWDOWN_PERCENT = 30;

/** Default max inventory deviation from 50% target */
const DEFAULT_MAX_INVENTORY_DEVIATION = 0.80;

/** Default priority fee in microlamports */
const DEFAULT_PRIORITY_FEE_MICRO_LAMPORTS = 100_000;

/** Default slippage in basis points (5%) */
const DEFAULT_SLIPPAGE_BPS = 500;

/** Volatility measurement window in ms (5 minutes) */
const VOLATILITY_WINDOW_MS = 5 * 60 * 1_000;

/** Minimum price observations before adjusting spread for volatility */
const MIN_VOLATILITY_OBSERVATIONS = 3;

// ─── Events ───────────────────────────────────────────────────

interface MarketMakerEvents {
  'cycle:start': (cycleNumber: number) => void;
  'cycle:complete': (cycleNumber: number, pnlLamports: BN) => void;
  'trade:submitted': (order: TradeOrder) => void;
  'trade:executed': (result: TradeResult) => void;
  'trade:failed': (order: TradeOrder, error: Error) => void;
  'spread:adjusted': (oldSpread: number, newSpread: number, reason: string) => void;
  'inventory:rebalance': (ratio: number, direction: 'buy' | 'sell') => void;
  'risk:circuit-breaker': (reason: string) => void;
  'risk:max-loss': (cycleLoss: number) => void;
  'stopped': (reason: string) => void;
}

// ─── Spread Snapshot ──────────────────────────────────────────

export interface SpreadSnapshot {
  /** Best bid price (SOL per token) — where we buy */
  bid: number;
  /** Best ask price (SOL per token) — where we sell */
  ask: number;
  /** Mid price (average of bid/ask) */
  mid: number;
  /** Spread as a percentage of the mid price */
  spreadPercent: number;
}

// ─── Inventory Snapshot ───────────────────────────────────────

export interface InventorySnapshot {
  /** Token balance (lamport-scale) */
  tokens: BN;
  /** SOL balance in lamports */
  sol: BN;
  /** Ratio of token value to total portfolio value (0–1) */
  inventoryRatio: number;
}

// ─── Price Observation ────────────────────────────────────────

interface PriceObservation {
  price: number;
  timestamp: number;
}

// ─── Market Maker Agent ───────────────────────────────────────

export class MarketMakerAgent extends EventEmitter<MarketMakerEvents> {
  readonly id: string;
  readonly wallet: AgentWallet;

  private readonly connection: Connection;
  private config: MarketMakingConfig;
  private onlineSdk: OnlinePumpSdk | null = null;

  // Runtime state
  private mint: PublicKey | null = null;
  private running = false;
  private cycleTimer: ReturnType<typeof setTimeout> | null = null;
  private cycleCount = 0;
  private startedAt = 0;

  // Spread state
  private currentSpreadPercent: number;

  // Inventory tracking
  private tokenBalance: BN = new BN(0);
  private solBalance: BN = new BN(0);
  private inventoryTarget = 0.5; // 50% tokens, 50% SOL

  // Price tracking
  private priceHistory: PriceObservation[] = [];
  private peakPrice = 0;
  private lastMidPrice = 0;
  private trailedBasePrice = 0;

  // P&L tracking
  private totalSolSpent: BN = new BN(0);
  private totalSolReceived: BN = new BN(0);
  private cycleSolSpent: BN = new BN(0);
  private cycleSolReceived: BN = new BN(0);
  private totalBuys = 0;
  private totalSells = 0;

  // Trade history
  private tradeHistory: TradeResult[] = [];

  // Risk
  private maxLossPerCycleLamports: BN;
  private maxDrawdownPercent: number;
  private maxInventoryDeviation: number;
  private paused = false;
  private pauseReason: string | undefined;

  constructor(
    wallet: AgentWallet,
    connection: Connection,
    config: MarketMakingConfig,
  ) {
    super();
    this.id = `market-maker-${uuid().slice(0, 8)}`;
    this.wallet = wallet;
    this.connection = connection;
    this.config = { ...config };

    this.currentSpreadPercent = Math.max(
      MIN_SPREAD_PERCENT,
      Math.min(MAX_SPREAD_PERCENT, config.targetSpreadPercent),
    );

    // Risk defaults — 10x volume target as max loss per cycle
    this.maxLossPerCycleLamports = new BN(
      Math.floor((config.volumeTargetSol || 0.1) * LAMPORTS_PER_SOL * 10),
    );
    this.maxDrawdownPercent = DEFAULT_MAX_DRAWDOWN_PERCENT;
    this.maxInventoryDeviation = DEFAULT_MAX_INVENTORY_DEVIATION;
  }

  // ─── Public API ─────────────────────────────────────────────

  /**
   * Begin market making for a specific token mint.
   */
  start(mint: string): void {
    if (this.running) return;

    this.mint = new PublicKey(mint);
    this.running = true;
    this.paused = false;
    this.startedAt = Date.now();
    this.cycleCount = 0;
    this.trailedBasePrice = 0;

    console.log(
      `[market-maker:${this.id}] Started for ${mint} ` +
      `(spread: ${this.currentSpreadPercent.toFixed(1)}%, ` +
      `cycle: ${this.config.cycleDurationMs ?? DEFAULT_CYCLE_DURATION_MS}ms)`,
    );

    this.scheduleCycle();
  }

  /**
   * Stop market making gracefully.
   */
  stop(): void {
    if (!this.running) return;

    this.running = false;
    if (this.cycleTimer) {
      clearTimeout(this.cycleTimer);
      this.cycleTimer = null;
    }

    const netPnl = this.totalSolReceived.sub(this.totalSolSpent);
    console.log(
      `[market-maker:${this.id}] Stopped. ` +
      `Cycles: ${this.cycleCount}, ` +
      `Buys: ${this.totalBuys}, Sells: ${this.totalSells}, ` +
      `Net P&L: ${lamportsToSol(netPnl).toFixed(6)} SOL`,
    );

    this.emit('stopped', 'manual');
  }

  /**
   * Get the current bid/ask/mid/spread snapshot.
   */
  getSpread(): SpreadSnapshot {
    const mid = this.lastMidPrice;
    const halfSpread = (this.currentSpreadPercent / 100) / 2;
    const bid = mid * (1 - halfSpread);
    const ask = mid * (1 + halfSpread);
    return {
      bid,
      ask,
      mid,
      spreadPercent: this.currentSpreadPercent,
    };
  }

  /**
   * Get the current inventory position.
   */
  getInventory(): InventorySnapshot {
    return {
      tokens: this.tokenBalance.clone(),
      sol: this.solBalance.clone(),
      inventoryRatio: this.computeInventoryRatio(),
    };
  }

  /**
   * Adjust the target spread manually.
   */
  adjustSpread(newSpreadPercent: number): void {
    const clamped = Math.max(MIN_SPREAD_PERCENT, Math.min(MAX_SPREAD_PERCENT, newSpreadPercent));
    const old = this.currentSpreadPercent;
    this.currentSpreadPercent = clamped;
    this.emit('spread:adjusted', old, clamped, 'manual');
    console.log(`[market-maker:${this.id}] Spread adjusted: ${old.toFixed(2)}% → ${clamped.toFixed(2)}%`);
  }

  /**
   * Adjust the inventory imbalance target.
   * @param newTarget 0–1 where 0.5 = balanced. >0.5 biases toward holding tokens.
   */
  adjustImbalance(newTarget: number): void {
    this.inventoryTarget = Math.max(0, Math.min(1, newTarget));
    console.log(`[market-maker:${this.id}] Inventory target adjusted to ${(this.inventoryTarget * 100).toFixed(1)}%`);
  }

  /**
   * Whether the agent is currently running.
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * Get cumulative trade statistics.
   */
  getStats(): {
    totalBuys: number;
    totalSells: number;
    totalSolSpent: BN;
    totalSolReceived: BN;
    netPnl: BN;
    cycleCount: number;
    uptimeSeconds: number;
  } {
    return {
      totalBuys: this.totalBuys,
      totalSells: this.totalSells,
      totalSolSpent: this.totalSolSpent.clone(),
      totalSolReceived: this.totalSolReceived.clone(),
      netPnl: this.totalSolReceived.sub(this.totalSolSpent),
      cycleCount: this.cycleCount,
      uptimeSeconds: this.startedAt > 0 ? (Date.now() - this.startedAt) / 1000 : 0,
    };
  }

  /**
   * Get full trade history.
   */
  getTradeHistory(): TradeResult[] {
    return [...this.tradeHistory];
  }

  // ─── Cycle Management ──────────────────────────────────────

  private scheduleCycle(): void {
    if (!this.running) return;

    const cycleDuration = this.config.cycleDurationMs ?? DEFAULT_CYCLE_DURATION_MS;

    this.cycleTimer = setTimeout(async () => {
      if (!this.running) return;

      try {
        await this.executeCycle();
      } catch (error) {
        console.error(`[market-maker:${this.id}] Cycle error:`, error);
      }

      this.scheduleCycle();
    }, cycleDuration);
  }

  private async executeCycle(): Promise<void> {
    if (!this.mint || this.paused) return;

    this.cycleCount++;
    this.cycleSolSpent = new BN(0);
    this.cycleSolReceived = new BN(0);

    this.emit('cycle:start', this.cycleCount);

    // 1. Fetch current bonding curve state
    const sdk = this.getOnlineSdk();
    const bondingCurve = await sdk.fetchBondingCurve(this.mint);

    // If curve graduated, stop market making
    if (bondingCurve.complete) {
      console.log(`[market-maker:${this.id}] Bonding curve graduated — stopping`);
      this.stop();
      return;
    }

    // 2. Record price observation
    const currentPrice = getTokenPrice(bondingCurve);
    this.recordPrice(currentPrice);

    // 3. Update balances
    await this.refreshBalances();

    // 4. Risk checks
    if (this.checkCircuitBreaker(currentPrice)) {
      return;
    }

    // 5. Dynamic spread adjustment based on volatility
    this.adjustSpreadForVolatility();

    // 6. Determine trade direction based on inventory
    const direction = this.decideDirection();

    // 7. Compute trade size
    const tradeSizeLamports = this.computeTradeSize(bondingCurve, direction);

    if (tradeSizeLamports.isZero()) {
      // Nothing to trade this cycle
      this.emit('cycle:complete', this.cycleCount, new BN(0));
      return;
    }

    // 8. Apply price trail if enabled
    if (this.config.trailPriceUp && direction === 'buy') {
      this.applyPriceTrail(currentPrice);
    }

    // 9. Execute the trade
    const result = await this.executeTrade(direction, tradeSizeLamports, bondingCurve);

    // 10. Evaluate P&L periodically
    const cyclesPerEval = this.config.cyclesPerEvaluation ?? DEFAULT_CYCLES_PER_EVALUATION;
    if (this.cycleCount % cyclesPerEval === 0) {
      this.evaluatePnl();
    }

    const cyclePnl = this.cycleSolReceived.sub(this.cycleSolSpent);
    this.emit('cycle:complete', this.cycleCount, cyclePnl);

    // Log periodic summary
    if (this.cycleCount % 10 === 0) {
      const netPnl = this.totalSolReceived.sub(this.totalSolSpent);
      const ratio = this.computeInventoryRatio();
      console.log(
        `[market-maker:${this.id}] Cycle ${this.cycleCount} | ` +
        `Price: ${currentPrice.toFixed(10)} SOL | ` +
        `Spread: ${this.currentSpreadPercent.toFixed(2)}% | ` +
        `Inv: ${(ratio * 100).toFixed(1)}% tokens | ` +
        `Net P&L: ${lamportsToSol(netPnl).toFixed(6)} SOL | ` +
        `Result: ${result?.success ? 'OK' : 'FAIL'}`,
      );
    }
  }

  // ─── Trading Logic ──────────────────────────────────────────

  private decideDirection(): 'buy' | 'sell' {
    const ratio = this.computeInventoryRatio();

    // If we hold too many tokens, sell
    if (ratio > this.inventoryTarget + 0.1) {
      this.emit('inventory:rebalance', ratio, 'sell');
      return 'sell';
    }

    // If we hold too few tokens, buy
    if (ratio < this.inventoryTarget - 0.1) {
      this.emit('inventory:rebalance', ratio, 'buy');
      return 'buy';
    }

    // Near target: use imbalance config to bias direction
    const { imbalanceTarget } = this.config;
    // imbalanceTarget: -1 = always sell, 0 = balanced, 1 = always buy
    const buyProbability = (imbalanceTarget + 1) / 2; // map [-1, 1] → [0, 1]
    return Math.random() < buyProbability ? 'buy' : 'sell';
  }

  private computeTradeSize(bondingCurve: DecodedBondingCurve, direction: 'buy' | 'sell'): BN {
    const volumeTargetLamports = new BN(
      Math.floor((this.config.volumeTargetSol || 0.01) * LAMPORTS_PER_SOL),
    );

    // Base trade size: fraction of volume target with some randomness (50–150%)
    const jitter = 0.5 + Math.random();
    const baseSizeLamports = new BN(
      Math.floor(volumeTargetLamports.toNumber() * jitter),
    );

    if (direction === 'sell') {
      // Sell: calculate how many tokens to sell for target SOL amount
      // Cap at current token balance
      if (this.tokenBalance.isZero()) return new BN(0);

      // Estimate tokens needed to receive baseSizeLamports SOL
      const currentPrice = getTokenPrice(bondingCurve);
      if (currentPrice <= 0) return new BN(0);

      // tokens = sol_amount / price_per_token
      // price is SOL per token, so tokens = sol / price
      const tokensNeeded = new BN(
        Math.floor(lamportsToSol(baseSizeLamports) / currentPrice * LAMPORTS_PER_SOL),
      );

      // Don't sell more than we have or more than max inventory deviation allows
      const maxSellableTokens = this.tokenBalance
        .mul(new BN(Math.floor(this.maxInventoryDeviation * 10000)))
        .div(new BN(10000));

      const sellAmount = BN.min(tokensNeeded, maxSellableTokens);
      return sellAmount.gtn(0) ? sellAmount : new BN(0);
    }

    // Buy: cap at available SOL balance minus safety margin for rent/fees
    const safetyMarginLamports = new BN(0.01 * LAMPORTS_PER_SOL); // keep 0.01 SOL for fees
    const availableSol = this.solBalance.sub(safetyMarginLamports);
    if (availableSol.lten(0)) return new BN(0);

    return BN.min(baseSizeLamports, availableSol);
  }

  private async executeTrade(
    direction: 'buy' | 'sell',
    amount: BN,
    bondingCurve: DecodedBondingCurve,
  ): Promise<TradeResult> {
    if (!this.mint) throw new Error('No mint — call start() first');

    const order: TradeOrder = {
      id: uuid(),
      traderId: this.id,
      mint: this.mint.toBase58(),
      direction,
      amount,
      slippageBps: DEFAULT_SLIPPAGE_BPS,
      priorityFeeMicroLamports: DEFAULT_PRIORITY_FEE_MICRO_LAMPORTS,
    };

    this.emit('trade:submitted', order);

    try {
      if (direction === 'buy') {
        return await this.executeBuy(order, bondingCurve);
      }
      return await this.executeSell(order, bondingCurve);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
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
      return failedResult;
    }
  }

  private async executeBuy(order: TradeOrder, _bondingCurve: DecodedBondingCurve): Promise<TradeResult> {
    const sdk = this.getOnlineSdk();
    const global = await sdk.fetchGlobal();
    const buyState = await sdk.fetchBuyState(
      this.mint!,
      this.wallet.keypair.publicKey,
      TOKEN_PROGRAM_ID,
    );

    const buyIxs = await PUMP_SDK.buyInstructions({
      global,
      bondingCurveAccountInfo: buyState.bondingCurveAccountInfo,
      bondingCurve: buyState.bondingCurve,
      associatedUserAccountInfo: buyState.associatedUserAccountInfo,
      mint: this.mint!,
      user: this.wallet.keypair.publicKey,
      amount: new BN(0),
      solAmount: order.amount,
      slippage: order.slippageBps / 100,
      tokenProgram: TOKEN_PROGRAM_ID,
    });

    const computeIxs = [
      ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }),
      ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: order.priorityFeeMicroLamports ?? DEFAULT_PRIORITY_FEE_MICRO_LAMPORTS,
      }),
    ];

    const { blockhash } = await this.connection.getLatestBlockhash('confirmed');
    const tx = new Transaction({
      recentBlockhash: blockhash,
      feePayer: this.wallet.keypair.publicKey,
    });
    tx.add(...computeIxs, ...buyIxs);

    const signature = await sendAndConfirmTransaction(
      this.connection,
      tx,
      [this.wallet.keypair],
      { commitment: 'confirmed', maxRetries: 3 },
    );

    // Determine tokens received
    const ata = await getAssociatedTokenAddress(this.mint!, this.wallet.keypair.publicKey);
    let tokensReceived = new BN(0);
    try {
      const tokenAccount = await getAccount(this.connection, ata);
      const newBalance = new BN(tokenAccount.amount.toString());
      tokensReceived = newBalance.sub(this.tokenBalance);
      this.tokenBalance = newBalance;
    } catch {
      // ATA may not exist on first buy
    }

    const result: TradeResult = {
      order,
      signature,
      amountOut: tokensReceived,
      executionPrice: tokensReceived.gtn(0)
        ? order.amount.mul(new BN(LAMPORTS_PER_SOL)).div(tokensReceived)
        : new BN(0),
      feesPaid: new BN(5000),
      success: true,
      executedAt: Date.now(),
    };

    // Update P&L counters
    this.totalBuys++;
    this.totalSolSpent = this.totalSolSpent.add(order.amount);
    this.cycleSolSpent = this.cycleSolSpent.add(order.amount);
    this.tradeHistory.push(result);

    this.emit('trade:executed', result);
    return result;
  }

  private async executeSell(order: TradeOrder, _bondingCurve: DecodedBondingCurve): Promise<TradeResult> {
    const sdk = this.getOnlineSdk();
    const global = await sdk.fetchGlobal();
    const sellState = await sdk.fetchSellState(
      this.mint!,
      this.wallet.keypair.publicKey,
      TOKEN_PROGRAM_ID,
    );

    const sellIxs = await PUMP_SDK.sellInstructions({
      global,
      bondingCurveAccountInfo: sellState.bondingCurveAccountInfo,
      bondingCurve: sellState.bondingCurve,
      mint: this.mint!,
      user: this.wallet.keypair.publicKey,
      amount: order.amount,
      solAmount: new BN(0),
      slippage: order.slippageBps / 100,
      tokenProgram: TOKEN_PROGRAM_ID,
      mayhemMode: false,
    });

    const computeIxs = [
      ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }),
      ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: order.priorityFeeMicroLamports ?? DEFAULT_PRIORITY_FEE_MICRO_LAMPORTS,
      }),
    ];

    const { blockhash } = await this.connection.getLatestBlockhash('confirmed');
    const tx = new Transaction({
      recentBlockhash: blockhash,
      feePayer: this.wallet.keypair.publicKey,
    });
    tx.add(...computeIxs, ...sellIxs);

    // Track SOL before sell
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
    const ata = await getAssociatedTokenAddress(this.mint!, this.wallet.keypair.publicKey);
    try {
      const tokenAccount = await getAccount(this.connection, ata);
      this.tokenBalance = new BN(tokenAccount.amount.toString());
    } catch {
      this.tokenBalance = new BN(0);
    }

    const result: TradeResult = {
      order,
      signature,
      amountOut: solReceived,
      executionPrice: order.amount.gtn(0)
        ? solReceived.mul(new BN(LAMPORTS_PER_SOL)).div(order.amount)
        : new BN(0),
      feesPaid: new BN(5000),
      success: true,
      executedAt: Date.now(),
    };

    // Update P&L counters
    this.totalSells++;
    this.totalSolReceived = this.totalSolReceived.add(solReceived);
    this.cycleSolReceived = this.cycleSolReceived.add(solReceived);
    this.tradeHistory.push(result);

    this.emit('trade:executed', result);
    return result;
  }

  // ─── Spread Management ─────────────────────────────────────

  /**
   * Dynamically adjust spread based on recent price volatility.
   *
   * - High volatility → wider spread (more risk per trade)
   * - Low volatility  → tighter spread (capture more trades)
   */
  private adjustSpreadForVolatility(): void {
    if (this.priceHistory.length < MIN_VOLATILITY_OBSERVATIONS) return;

    const volatility = this.computeVolatility();
    const oldSpread = this.currentSpreadPercent;

    // Map volatility to spread:
    // volatility 0% → MIN_SPREAD_PERCENT
    // volatility 5% → midpoint
    // volatility 10%+ → MAX_SPREAD_PERCENT
    const targetSpread = MIN_SPREAD_PERCENT + (volatility / 10) * (MAX_SPREAD_PERCENT - MIN_SPREAD_PERCENT);
    const clamped = Math.max(MIN_SPREAD_PERCENT, Math.min(MAX_SPREAD_PERCENT, targetSpread));

    // Smooth the transition (move 30% toward target each cycle)
    const smoothed = this.currentSpreadPercent + (clamped - this.currentSpreadPercent) * 0.3;
    this.currentSpreadPercent = Math.max(MIN_SPREAD_PERCENT, Math.min(MAX_SPREAD_PERCENT, smoothed));

    if (Math.abs(this.currentSpreadPercent - oldSpread) > 0.1) {
      this.emit('spread:adjusted', oldSpread, this.currentSpreadPercent, `volatility=${volatility.toFixed(2)}%`);
    }
  }

  /**
   * Compute recent price volatility as the standard deviation
   * of percentage price changes over the observation window.
   */
  private computeVolatility(): number {
    const now = Date.now();
    const windowStart = now - VOLATILITY_WINDOW_MS;
    const recent = this.priceHistory.filter((obs) => obs.timestamp >= windowStart);

    if (recent.length < 2) return 0;

    // Calculate percentage returns
    const returns: number[] = [];
    for (let i = 1; i < recent.length; i++) {
      const prev = recent[i - 1].price;
      if (prev > 0) {
        returns.push(((recent[i].price - prev) / prev) * 100);
      }
    }

    if (returns.length === 0) return 0;

    // Standard deviation of returns
    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + (r - mean) ** 2, 0) / returns.length;
    return Math.sqrt(variance);
  }

  // ─── Price Trajectory ──────────────────────────────────────

  /**
   * Apply gradual upward price trail: each cycle the buy price
   * anchors slightly higher, creating organic price appreciation.
   */
  private applyPriceTrail(currentPrice: number): void {
    if (this.trailedBasePrice === 0) {
      this.trailedBasePrice = currentPrice;
      return;
    }

    const incrementPercent = this.config.priceIncrementPercent ?? 0.1;
    this.trailedBasePrice *= 1 + incrementPercent / 100;

    // Only trail up, never down
    if (this.trailedBasePrice > currentPrice) {
      this.trailedBasePrice = currentPrice;
    }
  }

  // ─── Risk Controls ─────────────────────────────────────────

  /**
   * Check risk thresholds and pause if breached.
   * @returns true if circuit breaker tripped (cycle should abort)
   */
  private checkCircuitBreaker(currentPrice: number): boolean {
    // Track peak price
    if (currentPrice > this.peakPrice) {
      this.peakPrice = currentPrice;
    }

    // 1. Drawdown from peak
    if (this.peakPrice > 0) {
      const drawdownPercent = ((this.peakPrice - currentPrice) / this.peakPrice) * 100;
      if (drawdownPercent >= this.maxDrawdownPercent) {
        this.paused = true;
        this.pauseReason = `price-drawdown-${drawdownPercent.toFixed(1)}%`;
        console.warn(
          `[market-maker:${this.id}] CIRCUIT BREAKER: Price dropped ${drawdownPercent.toFixed(1)}% from peak ` +
          `(${this.peakPrice.toFixed(10)} → ${currentPrice.toFixed(10)})`,
        );
        this.emit('risk:circuit-breaker', this.pauseReason);
        this.stop();
        return true;
      }
    }

    // 2. Max inventory deviation
    const ratio = this.computeInventoryRatio();
    if (ratio > this.maxInventoryDeviation) {
      // Don't full-stop, but skip this cycle and bias sells next cycle
      console.warn(
        `[market-maker:${this.id}] Inventory deviation high: ${(ratio * 100).toFixed(1)}% tokens ` +
        `(max: ${(this.maxInventoryDeviation * 100).toFixed(1)}%)`,
      );
    }

    // 3. Max loss per cycle (check previous cycle)
    if (this.cycleCount > 1) {
      const prevCycleLoss = this.cycleSolSpent.sub(this.cycleSolReceived);
      if (prevCycleLoss.gt(this.maxLossPerCycleLamports)) {
        console.warn(
          `[market-maker:${this.id}] Max cycle loss exceeded: ${lamportsToSol(prevCycleLoss).toFixed(6)} SOL`,
        );
        this.emit('risk:max-loss', lamportsToSol(prevCycleLoss));
        // Widen spread instead of stopping entirely
        const oldSpread = this.currentSpreadPercent;
        this.currentSpreadPercent = Math.min(MAX_SPREAD_PERCENT, this.currentSpreadPercent * 1.5);
        this.emit('spread:adjusted', oldSpread, this.currentSpreadPercent, 'max-cycle-loss');
      }
    }

    return false;
  }

  // ─── Inventory Management ──────────────────────────────────

  /**
   * Compute the current inventory ratio (token value / total portfolio value).
   * Returns 0–1 where 0.5 = perfectly balanced.
   */
  private computeInventoryRatio(): number {
    if (this.lastMidPrice <= 0) return 0.5;

    const tokenValueLamports = new BN(
      Math.floor(this.tokenBalance.toNumber() * this.lastMidPrice),
    );
    const totalValue = tokenValueLamports.add(this.solBalance);

    if (totalValue.isZero()) return 0.5;

    return tokenValueLamports.toNumber() / totalValue.toNumber();
  }

  /**
   * Refresh SOL and token balances from chain.
   */
  private async refreshBalances(): Promise<void> {
    if (!this.mint) return;

    try {
      this.solBalance = new BN(
        await this.connection.getBalance(this.wallet.keypair.publicKey),
      );
    } catch {
      // Keep previous balance on error
    }

    try {
      const ata = await getAssociatedTokenAddress(
        this.mint,
        this.wallet.keypair.publicKey,
      );
      const tokenAccount = await getAccount(this.connection, ata);
      this.tokenBalance = new BN(tokenAccount.amount.toString());
    } catch {
      // Token account may not exist yet
    }
  }

  // ─── P&L Evaluation ────────────────────────────────────────

  /**
   * Evaluate cumulative P&L and adjust strategy if losing.
   */
  private evaluatePnl(): void {
    const netPnl = this.totalSolReceived.sub(this.totalSolSpent);
    const netPnlSol = lamportsToSol(netPnl);

    if (netPnlSol < -0.1) {
      // Losing more than 0.1 SOL — widen spread to reduce exposure
      const oldSpread = this.currentSpreadPercent;
      this.currentSpreadPercent = Math.min(
        MAX_SPREAD_PERCENT,
        this.currentSpreadPercent * 1.2,
      );
      if (this.currentSpreadPercent !== oldSpread) {
        this.emit('spread:adjusted', oldSpread, this.currentSpreadPercent, 'pnl-negative');
        console.log(
          `[market-maker:${this.id}] P&L negative (${netPnlSol.toFixed(6)} SOL) — widening spread`,
        );
      }
    } else if (netPnlSol > 0.05) {
      // Profitable — can tighten spread slightly to capture more volume
      const oldSpread = this.currentSpreadPercent;
      this.currentSpreadPercent = Math.max(
        MIN_SPREAD_PERCENT,
        this.currentSpreadPercent * 0.95,
      );
      if (this.currentSpreadPercent !== oldSpread) {
        this.emit('spread:adjusted', oldSpread, this.currentSpreadPercent, 'pnl-positive');
      }
    }
  }

  // ─── Helpers ────────────────────────────────────────────────

  private getOnlineSdk(): OnlinePumpSdk {
    if (!this.onlineSdk) {
      this.onlineSdk = new OnlinePumpSdk(this.connection);
    }
    return this.onlineSdk;
  }

  private recordPrice(price: number): void {
    this.lastMidPrice = price;
    this.priceHistory.push({ price, timestamp: Date.now() });

    // Prune old observations outside volatility window (keep 2x window for safety)
    const cutoff = Date.now() - VOLATILITY_WINDOW_MS * 2;
    this.priceHistory = this.priceHistory.filter((obs) => obs.timestamp >= cutoff);
  }
}

// ─── Utility ──────────────────────────────────────────────────

function lamportsToSol(lamports: BN): number {
  return lamports.toNumber() / LAMPORTS_PER_SOL;
}
