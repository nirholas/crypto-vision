/**
 * Volume Agent — Generates organic-looking trading volume
 *
 * Orchestrates balanced buy/sell cycles across multiple wallets
 * to create convincing activity patterns on Pump.fun bonding curves.
 *
 * Features:
 * - Balanced cycles: buy → wait → sell from different wallet → net zero
 * - Cascade patterns: A→B→C→A chain trades
 * - Burst patterns: quick successive trades then quiet periods
 * - Natural time-of-day volume curves
 * - Wallet rotation to prevent detectable patterns
 * - Real-time volume stats with per-wallet utilization tracking
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
import { PUMP_SDK, OnlinePumpSdk, getBuyTokenAmountFromSolAmount } from '@pump-fun/pump-sdk';
import BN from 'bn.js';
import { v4 as uuid } from 'uuid';
import { EventEmitter } from 'eventemitter3';
import type {
  AgentWallet,
  TradeOrder,
  TradeResult,
  TradeDirection,
} from '../types.js';

// ─── Configuration ────────────────────────────────────────────

export interface VolumeConfig {
  /** Target SOL volume per hour */
  targetVolumeSolPerHour: number;
  /** Minimum trade size in lamports */
  minTradeSize: BN;
  /** Maximum trade size in lamports */
  maxTradeSize: BN;
  /** Minimum interval between trades in ms */
  minIntervalMs: number;
  /** Maximum interval between trades in ms */
  maxIntervalMs: number;
  /** Whether to rotate wallets to avoid detection */
  walletRotationEnabled: boolean;
  /** Max consecutive trades from a single wallet */
  maxTradesPerWallet: number;
  /** true = net zero volume (buy+sell cancel out), false = allow imbalance */
  balancedMode: boolean;
  /** true = apply time-of-day volume curves for realism */
  naturalPatterns: boolean;
  /** Priority fee in microlamports for compute budget */
  priorityFeeMicroLamports?: number;
  /** Max slippage in basis points (e.g., 500 = 5%) */
  slippageBps?: number;
  /** Peak hours for natural volume curve (0-23 UTC). Defaults to 14-22. */
  peakHoursUtc?: number[];
}

// ─── Volume Pattern Types ─────────────────────────────────────

type VolumePattern = 'balanced' | 'cascade' | 'burst' | 'natural';

interface PlannedTrade {
  walletIndex: number;
  direction: TradeDirection;
  amountLamports: BN;
  delayMs: number;
}

// ─── Wallet Tracking ──────────────────────────────────────────

interface WalletTracker {
  wallet: AgentWallet;
  consecutiveTrades: number;
  totalTrades: number;
  totalVolumeLamports: BN;
  lastTradeAt: number;
  cooldownUntil: number;
  tokensHeld: BN;
}

// ─── Volume Stats ─────────────────────────────────────────────

export interface VolumeStats {
  /** Total SOL volume generated (sum of all trade sizes) */
  totalVolumeSol: number;
  /** Volume in the last 60 minutes */
  volumeLastHour: number;
  /** Volume in the last 60 seconds */
  volumeLastMinute: number;
  /** Total number of trades executed (buys + sells) */
  tradesExecuted: number;
  /** Average trade size in SOL */
  avgTradeSize: number;
  /** Per-wallet utilization breakdown */
  walletUtilization: Record<string, { trades: number; volumeSol: number }>;
  /** Net position change in lamports (positive = net buy, negative = net sell) */
  netPositionChange: BN;
}

// ─── Events ───────────────────────────────────────────────────

interface VolumeAgentEvents {
  'trade:submitted': (order: TradeOrder) => void;
  'trade:executed': (result: TradeResult) => void;
  'trade:failed': (order: TradeOrder, error: Error) => void;
  'cycle:complete': (pattern: VolumePattern, tradesInCycle: number) => void;
  'volume:target-reached': (actualSolPerHour: number) => void;
  'wallet:rotated': (fromAddress: string, toAddress: string) => void;
  'stopped': (reason: string) => void;
}

// ─── Constants ────────────────────────────────────────────────

const DEFAULT_PRIORITY_FEE_MICRO_LAMPORTS = 100_000;
const DEFAULT_SLIPPAGE_BPS = 500;
const DEFAULT_PEAK_HOURS: number[] = [14, 15, 16, 17, 18, 19, 20, 21, 22];
const COOLDOWN_MS = 10_000;
const VOLUME_HISTORY_RETENTION_MS = 3_600_000; // 1 hour
const SOL_DECIMALS = LAMPORTS_PER_SOL;

// ─── Volume Agent ─────────────────────────────────────────────

export class VolumeAgent extends EventEmitter<VolumeAgentEvents> {
  private readonly connection: Connection;
  private config: VolumeConfig;
  private walletTrackers: WalletTracker[] = [];
  private onlineSdk: OnlinePumpSdk | null = null;
  private mint: PublicKey | null = null;
  private running = false;
  private loopTimer: ReturnType<typeof setTimeout> | null = null;
  private _startedAt = 0;

  /** Rolling window of recent trade amounts + timestamps for rate calculation */
  private tradeLog: Array<{ timestampMs: number; volumeLamports: BN }> = [];
  /** Cumulative counters */
  private totalVolumeLamports = new BN(0);
  private totalTradesExecuted = 0;
  private netPositionLamports = new BN(0); // positive = net bought SOL worth of tokens
  private currentWalletIndex = 0;
  private patternCycleCount = 0;

  constructor(
    wallets: AgentWallet[],
    connection: Connection,
    config: VolumeConfig,
  ) {
    super();

    if (wallets.length === 0) {
      throw new Error('VolumeAgent requires at least one wallet');
    }

    this.connection = connection;
    this.config = { ...config };

    for (const wallet of wallets) {
      this.walletTrackers.push({
        wallet,
        consecutiveTrades: 0,
        totalTrades: 0,
        totalVolumeLamports: new BN(0),
        lastTradeAt: 0,
        cooldownUntil: 0,
        tokensHeld: new BN(0),
      });
    }
  }

  // ─── Public API ─────────────────────────────────────────────

  /**
   * Start generating volume for the given token mint.
   */
  start(mint: string): void {
    if (this.running) return;

    this.mint = new PublicKey(mint);
    this.running = true;
    this._startedAt = Date.now();
    this.patternCycleCount = 0;

    console.log(
      `[volume-agent] Started volume generation for ${mint} ` +
      `(target: ${this.config.targetVolumeSolPerHour} SOL/hr, wallets: ${this.walletTrackers.length})`,
    );

    this.scheduleNextCycle();
  }

  /**
   * Stop all volume generation gracefully.
   */
  stop(): void {
    if (!this.running) return;

    this.running = false;
    if (this.loopTimer) {
      clearTimeout(this.loopTimer);
      this.loopTimer = null;
    }

    const stats = this.getVolumeStats();
    const runtimeSec = ((Date.now() - this._startedAt) / 1_000).toFixed(1);
    console.log(
      `[volume-agent] Stopped after ${runtimeSec}s. Total volume: ${stats.totalVolumeSol.toFixed(4)} SOL, ` +
      `trades: ${stats.tradesExecuted}`,
    );

    this.emit('stopped', 'manual');
  }

  /**
   * Get current volume statistics.
   */
  getVolumeStats(): VolumeStats {
    const now = Date.now();
    this.pruneTradeLog(now);

    const oneHourAgo = now - VOLUME_HISTORY_RETENTION_MS;
    const oneMinuteAgo = now - 60_000;

    let volumeLastHourLamports = new BN(0);
    let volumeLastMinuteLamports = new BN(0);

    for (const entry of this.tradeLog) {
      if (entry.timestampMs >= oneHourAgo) {
        volumeLastHourLamports = volumeLastHourLamports.add(entry.volumeLamports);
      }
      if (entry.timestampMs >= oneMinuteAgo) {
        volumeLastMinuteLamports = volumeLastMinuteLamports.add(entry.volumeLamports);
      }
    }

    const walletUtilization: Record<string, { trades: number; volumeSol: number }> = {};
    for (const tracker of this.walletTrackers) {
      walletUtilization[tracker.wallet.address] = {
        trades: tracker.totalTrades,
        volumeSol: lamportsToSol(tracker.totalVolumeLamports),
      };
    }

    return {
      totalVolumeSol: lamportsToSol(this.totalVolumeLamports),
      volumeLastHour: lamportsToSol(volumeLastHourLamports),
      volumeLastMinute: lamportsToSol(volumeLastMinuteLamports),
      tradesExecuted: this.totalTradesExecuted,
      avgTradeSize: this.totalTradesExecuted > 0
        ? lamportsToSol(this.totalVolumeLamports) / this.totalTradesExecuted
        : 0,
      walletUtilization,
      netPositionChange: this.netPositionLamports.clone(),
    };
  }

  /**
   * Update the target volume rate dynamically.
   */
  setTargetVolume(solPerHour: number): void {
    if (solPerHour <= 0) {
      throw new Error('Target volume must be positive');
    }
    this.config.targetVolumeSolPerHour = solPerHour;
    console.log(`[volume-agent] Target volume updated to ${solPerHour} SOL/hr`);
  }

  /**
   * Add a new wallet to the rotation pool.
   */
  addWallet(wallet: AgentWallet): void {
    // Prevent duplicates
    const exists = this.walletTrackers.some(
      (t) => t.wallet.address === wallet.address,
    );
    if (exists) return;

    this.walletTrackers.push({
      wallet,
      consecutiveTrades: 0,
      totalTrades: 0,
      totalVolumeLamports: new BN(0),
      lastTradeAt: 0,
      cooldownUntil: 0,
      tokensHeld: new BN(0),
    });
    console.log(`[volume-agent] Wallet added: ${wallet.address} (pool size: ${this.walletTrackers.length})`);
  }

  /**
   * Remove a wallet from the rotation pool by agent/wallet address.
   */
  removeWallet(agentId: string): void {
    const idx = this.walletTrackers.findIndex(
      (t) => t.wallet.address === agentId || t.wallet.label === agentId,
    );
    if (idx === -1) return;

    const removed = this.walletTrackers.splice(idx, 1)[0];
    console.log(`[volume-agent] Wallet removed: ${removed.wallet.address} (pool size: ${this.walletTrackers.length})`);

    // Adjust current index if needed
    if (this.currentWalletIndex >= this.walletTrackers.length) {
      this.currentWalletIndex = 0;
    }
  }

  /**
   * Whether the agent is currently running.
   */
  isRunning(): boolean {
    return this.running;
  }

  // ─── Core Loop ──────────────────────────────────────────────

  private scheduleNextCycle(): void {
    if (!this.running) return;

    const intervalMs = this.computeNextInterval();

    this.loopTimer = setTimeout(async () => {
      if (!this.running) return;

      try {
        const pattern = this.selectPattern();
        await this.executeCycle(pattern);
        this.patternCycleCount++;
      } catch (error) {
        console.error('[volume-agent] Cycle error:', error);
      }

      this.scheduleNextCycle();
    }, intervalMs);
  }

  /**
   * Compute the delay until the next cycle, adjusting for natural patterns
   * and current volume rate vs. target.
   */
  private computeNextInterval(): number {
    const { minIntervalMs, maxIntervalMs, naturalPatterns } = this.config;

    // Base random interval
    let interval = minIntervalMs + Math.random() * (maxIntervalMs - minIntervalMs);

    // Apply natural time-of-day curve (reduce frequency during off-peak)
    if (naturalPatterns) {
      const multiplier = this.getNaturalCurveMultiplier();
      // During off-peak, stretch intervals (multiplier < 1 → longer waits)
      // During peak, shrink intervals (multiplier > 1 → shorter waits)
      interval = interval / Math.max(multiplier, 0.1);
    }

    // Adaptive rate control: if we're above target, slow down; below, speed up
    const stats = this.getVolumeStats();
    if (stats.volumeLastHour > 0 && this.config.targetVolumeSolPerHour > 0) {
      const ratio = stats.volumeLastHour / this.config.targetVolumeSolPerHour;
      if (ratio > 1.1) {
        // Over target by >10%, slow down proportionally
        interval *= Math.min(ratio, 3.0);
      } else if (ratio < 0.9) {
        // Under target by >10%, speed up proportionally
        interval *= Math.max(ratio, 0.3);
      }
    }

    return Math.max(interval, 500); // Floor at 500ms
  }

  /**
   * Returns a multiplier (0.1–2.0) based on current UTC hour.
   * Peak hours get higher multipliers → more trades.
   */
  private getNaturalCurveMultiplier(): number {
    const peakHours = this.config.peakHoursUtc ?? DEFAULT_PEAK_HOURS;
    const currentHour = new Date().getUTCHours();

    if (peakHours.includes(currentHour)) {
      // Peak: high volume, small random jitter
      return 1.2 + Math.random() * 0.8; // 1.2–2.0
    }

    // Check shoulder hours (adjacent to peak)
    const isShoulderHour = peakHours.some(
      (h) => Math.abs(h - currentHour) === 1 || Math.abs(h - currentHour) === 23,
    );
    if (isShoulderHour) {
      return 0.6 + Math.random() * 0.4; // 0.6–1.0
    }

    // Off-peak: minimal volume
    return 0.1 + Math.random() * 0.3; // 0.1–0.4
  }

  // ─── Pattern Selection ──────────────────────────────────────

  /**
   * Select which volume pattern to execute this cycle.
   * Varies selection to avoid detectable repetition.
   */
  private selectPattern(): VolumePattern {
    const rand = Math.random();
    const { balancedMode, naturalPatterns } = this.config;

    // Weight patterns based on configuration
    if (balancedMode) {
      // In balanced mode, prefer balanced and cascade patterns
      if (rand < 0.45) return 'balanced';
      if (rand < 0.75) return 'cascade';
      if (rand < 0.90) return 'burst';
      return naturalPatterns ? 'natural' : 'balanced';
    }

    // Non-balanced: more variety
    if (rand < 0.30) return 'balanced';
    if (rand < 0.55) return 'cascade';
    if (rand < 0.80) return 'burst';
    return 'natural';
  }

  // ─── Cycle Execution ───────────────────────────────────────

  private async executeCycle(pattern: VolumePattern): Promise<void> {
    if (!this.mint) return;

    const trades = this.planCycle(pattern);
    let executed = 0;

    for (const planned of trades) {
      if (!this.running) break;

      if (planned.delayMs > 0) {
        await sleep(planned.delayMs);
      }

      if (!this.running) break;

      const tracker = this.walletTrackers[planned.walletIndex];
      if (!tracker) continue;

      const result = await this.executeTrade(
        tracker,
        planned.direction,
        planned.amountLamports,
      );

      if (result.success) {
        executed++;
      }
    }

    this.emit('cycle:complete', pattern, executed);
  }

  /**
   * Plan a set of trades for a given pattern.
   */
  private planCycle(pattern: VolumePattern): PlannedTrade[] {
    switch (pattern) {
      case 'balanced':
        return this.planBalancedCycle();
      case 'cascade':
        return this.planCascadeCycle();
      case 'burst':
        return this.planBurstCycle();
      case 'natural':
        return this.planNaturalCycle();
    }
  }

  /**
   * Balanced cycle: Wallet A buys → delay → Wallet B sells equivalent.
   * Net position change is near zero.
   */
  private planBalancedCycle(): PlannedTrade[] {
    const trades: PlannedTrade[] = [];
    const tradeSize = this.randomTradeSize();

    const buyWalletIdx = this.selectNextWallet();
    const sellWalletIdx = this.selectNextWallet(buyWalletIdx);

    // Buy with wallet A
    trades.push({
      walletIndex: buyWalletIdx,
      direction: 'buy',
      amountLamports: tradeSize,
      delayMs: 0,
    });

    // Wait a realistic delay, then sell with wallet B
    const delay = 2_000 + Math.floor(Math.random() * 8_000); // 2–10s
    trades.push({
      walletIndex: sellWalletIdx,
      direction: 'sell',
      amountLamports: tradeSize,
      delayMs: delay,
    });

    return trades;
  }

  /**
   * Cascade cycle: A→B→C→A chain of trades creating directional flow.
   * Uses 3+ wallets in sequence.
   */
  private planCascadeCycle(): PlannedTrade[] {
    const trades: PlannedTrade[] = [];
    const chainLength = Math.min(
      3 + Math.floor(Math.random() * 3), // 3–5 hops
      this.walletTrackers.length,
    );

    const walletIndices: number[] = [];
    for (let i = 0; i < chainLength; i++) {
      const exclude = walletIndices.length > 0 ? walletIndices[walletIndices.length - 1] : undefined;
      walletIndices.push(this.selectNextWallet(exclude));
    }

    // Alternate buy/sell through the chain
    for (let i = 0; i < walletIndices.length; i++) {
      const direction: TradeDirection = i % 2 === 0 ? 'buy' : 'sell';
      const tradeSize = this.randomTradeSize();

      trades.push({
        walletIndex: walletIndices[i],
        direction,
        amountLamports: tradeSize,
        delayMs: i === 0 ? 0 : 1_000 + Math.floor(Math.random() * 4_000), // 1–5s between hops
      });
    }

    return trades;
  }

  /**
   * Burst cycle: 3–5 rapid trades then silence.
   * Mimics organic retail FOMO bursts.
   */
  private planBurstCycle(): PlannedTrade[] {
    const trades: PlannedTrade[] = [];
    const burstSize = 3 + Math.floor(Math.random() * 3); // 3–5 trades

    for (let i = 0; i < burstSize; i++) {
      const direction: TradeDirection = Math.random() < 0.6 ? 'buy' : 'sell';
      const tradeSize = this.randomTradeSize();

      trades.push({
        walletIndex: this.selectNextWallet(),
        direction,
        amountLamports: tradeSize,
        // Rapid succession: 200–800ms between trades
        delayMs: i === 0 ? 0 : 200 + Math.floor(Math.random() * 600),
      });
    }

    return trades;
  }

  /**
   * Natural cycle: variable-size trades influenced by the time-of-day curve.
   * Larger trades during peak hours, smaller during off-peak.
   */
  private planNaturalCycle(): PlannedTrade[] {
    const multiplier = this.getNaturalCurveMultiplier();
    const trades: PlannedTrade[] = [];

    // Number of trades scales with time-of-day activity
    const tradeCount = Math.max(1, Math.round(2 * multiplier));

    for (let i = 0; i < tradeCount; i++) {
      // Scale trade size by natural curve
      const baseSize = this.randomTradeSize();
      const scaledSize = new BN(
        Math.floor(baseSize.toNumber() * Math.max(multiplier, 0.2)),
      );
      // Clamp to config bounds
      const clampedSize = BN.max(
        this.config.minTradeSize,
        BN.min(this.config.maxTradeSize, scaledSize),
      );

      const direction: TradeDirection = this.config.balancedMode
        ? (i % 2 === 0 ? 'buy' : 'sell')
        : (Math.random() < 0.55 ? 'buy' : 'sell');

      trades.push({
        walletIndex: this.selectNextWallet(),
        direction,
        amountLamports: clampedSize,
        delayMs: i === 0 ? 0 : 1_500 + Math.floor(Math.random() * 5_000),
      });
    }

    return trades;
  }

  // ─── Wallet Rotation ────────────────────────────────────────

  /**
   * Select the next wallet index for a trade, applying rotation rules.
   * @param excludeIndex - Optional index to exclude (e.g., the wallet used in the previous trade of this cycle)
   */
  private selectNextWallet(excludeIndex?: number): number {
    const now = Date.now();
    const available: number[] = [];

    for (let i = 0; i < this.walletTrackers.length; i++) {
      if (i === excludeIndex) continue;

      const tracker = this.walletTrackers[i];

      // Skip wallets on cooldown
      if (tracker.cooldownUntil > now) continue;

      // Skip wallets at max consecutive trades (if rotation enabled)
      if (
        this.config.walletRotationEnabled &&
        tracker.consecutiveTrades >= this.config.maxTradesPerWallet
      ) {
        continue;
      }

      available.push(i);
    }

    // If no wallets available, reset cooldowns and consecutive counts
    if (available.length === 0) {
      for (const tracker of this.walletTrackers) {
        tracker.consecutiveTrades = 0;
        tracker.cooldownUntil = 0;
      }
      // Re-select excluding only the explicit exclude
      const fallback: number[] = [];
      for (let i = 0; i < this.walletTrackers.length; i++) {
        if (i !== excludeIndex) fallback.push(i);
      }
      return fallback.length > 0
        ? fallback[Math.floor(Math.random() * fallback.length)]
        : 0;
    }

    // Prefer wallets with fewer total trades (distribute evenly)
    available.sort((a, b) => {
      const aTracker = this.walletTrackers[a];
      const bTracker = this.walletTrackers[b];
      return aTracker.totalTrades - bTracker.totalTrades;
    });

    // Pick from the bottom half (fewest trades) with random selection for variety
    const topN = Math.max(1, Math.ceil(available.length / 2));
    const candidates = available.slice(0, topN);
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  /**
   * Record a trade on a wallet tracker: update counters, apply cooldown, emit rotation events.
   */
  private recordWalletTrade(tracker: WalletTracker, volumeLamports: BN): void {
    const previousAddress = this.walletTrackers[this.currentWalletIndex]?.wallet.address;

    tracker.consecutiveTrades++;
    tracker.totalTrades++;
    tracker.totalVolumeLamports = tracker.totalVolumeLamports.add(volumeLamports);
    tracker.lastTradeAt = Date.now();

    // Apply cooldown if at max consecutive trades
    if (
      this.config.walletRotationEnabled &&
      tracker.consecutiveTrades >= this.config.maxTradesPerWallet
    ) {
      tracker.cooldownUntil = Date.now() + COOLDOWN_MS;
      tracker.consecutiveTrades = 0;

      // Find this tracker's index and emit rotation
      const trackerIdx = this.walletTrackers.indexOf(tracker);
      if (trackerIdx !== this.currentWalletIndex && previousAddress) {
        this.emit('wallet:rotated', previousAddress, tracker.wallet.address);
      }
      this.currentWalletIndex = trackerIdx;
    }

    // Reset consecutive count of other wallets (they had a break)
    for (const other of this.walletTrackers) {
      if (other !== tracker) {
        other.consecutiveTrades = 0;
      }
    }
  }

  // ─── Trade Execution ────────────────────────────────────────

  private getOnlineSdk(): OnlinePumpSdk {
    if (!this.onlineSdk) {
      this.onlineSdk = new OnlinePumpSdk(this.connection);
    }
    return this.onlineSdk;
  }

  /**
   * Execute a single trade (buy or sell) using the given wallet tracker.
   */
  private async executeTrade(
    tracker: WalletTracker,
    direction: TradeDirection,
    amountLamports: BN,
  ): Promise<TradeResult> {
    if (!this.mint) {
      throw new Error('No mint set — call start() first');
    }

    const slippageBps = this.config.slippageBps ?? DEFAULT_SLIPPAGE_BPS;
    const priorityFee = this.config.priorityFeeMicroLamports ?? DEFAULT_PRIORITY_FEE_MICRO_LAMPORTS;

    const order: TradeOrder = {
      id: uuid(),
      traderId: `volume-${tracker.wallet.address.slice(0, 8)}`,
      mint: this.mint.toBase58(),
      direction,
      amount: amountLamports,
      slippageBps,
      priorityFeeMicroLamports: priorityFee,
    };

    this.emit('trade:submitted', order);

    try {
      const result = direction === 'buy'
        ? await this.executeBuy(tracker, order, amountLamports, slippageBps, priorityFee)
        : await this.executeSell(tracker, order, amountLamports, slippageBps, priorityFee);

      if (result.success) {
        // Track volume
        this.totalVolumeLamports = this.totalVolumeLamports.add(amountLamports);
        this.totalTradesExecuted++;
        this.tradeLog.push({ timestampMs: Date.now(), volumeLamports: amountLamports });
        this.recordWalletTrade(tracker, amountLamports);

        // Track net position
        if (direction === 'buy') {
          this.netPositionLamports = this.netPositionLamports.add(amountLamports);
        } else {
          this.netPositionLamports = this.netPositionLamports.sub(amountLamports);
        }

        this.emit('trade:executed', result);

        // Check if volume target is being met
        const stats = this.getVolumeStats();
        if (
          stats.volumeLastHour >= this.config.targetVolumeSolPerHour * 0.9 &&
          stats.volumeLastHour <= this.config.targetVolumeSolPerHour * 1.1
        ) {
          this.emit('volume:target-reached', stats.volumeLastHour);
        }
      } else {
        const err = new Error(result.error ?? 'Trade failed');
        this.emit('trade:failed', order, err);
      }

      return result;
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
      this.emit('trade:failed', order, err);
      return failedResult;
    }
  }

  /**
   * Execute a buy on the bonding curve.
   */
  private async executeBuy(
    tracker: WalletTracker,
    order: TradeOrder,
    solAmountLamports: BN,
    slippageBps: number,
    priorityFee: number,
  ): Promise<TradeResult> {
    const mint = this.mint!;
    const sdk = this.getOnlineSdk();

    const global = await sdk.fetchGlobal();
    const buyState = await sdk.fetchBuyState(
      mint,
      tracker.wallet.keypair.publicKey,
      TOKEN_PROGRAM_ID,
    );

    const buyIxs = await PUMP_SDK.buyInstructions({
      global,
      bondingCurveAccountInfo: buyState.bondingCurveAccountInfo,
      bondingCurve: buyState.bondingCurve,
      associatedUserAccountInfo: buyState.associatedUserAccountInfo,
      mint,
      user: tracker.wallet.keypair.publicKey,
      amount: new BN(0),
      solAmount: solAmountLamports,
      slippage: slippageBps / 100,
      tokenProgram: TOKEN_PROGRAM_ID,
    });

    const computeIxs = [
      ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }),
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: priorityFee }),
    ];

    const { blockhash } = await this.connection.getLatestBlockhash('confirmed');
    const tx = new Transaction({
      recentBlockhash: blockhash,
      feePayer: tracker.wallet.keypair.publicKey,
    });
    tx.add(...computeIxs, ...buyIxs);

    const signature = await sendAndConfirmTransaction(
      this.connection,
      tx,
      [tracker.wallet.keypair],
      { commitment: 'confirmed', maxRetries: 3 },
    );

    // Fetch updated token balance
    const ata = await getAssociatedTokenAddress(mint, tracker.wallet.keypair.publicKey);
    let tokensReceived = new BN(0);
    try {
      const tokenAccount = await getAccount(this.connection, ata);
      const newBalance = new BN(tokenAccount.amount.toString());
      tokensReceived = newBalance.sub(tracker.tokensHeld);
      tracker.tokensHeld = newBalance;
    } catch {
      // ATA may not exist yet on first buy — balance will be tracked on next cycle
    }

    return {
      order,
      signature,
      amountOut: tokensReceived,
      executionPrice: tokensReceived.gtn(0)
        ? solAmountLamports.mul(new BN(SOL_DECIMALS)).div(tokensReceived)
        : new BN(0),
      feesPaid: new BN(5000),
      success: true,
      executedAt: Date.now(),
    };
  }

  /**
   * Execute a sell on the bonding curve.
   * If `amountLamports` represents a SOL-denominated size, we convert to token amount
   * using the current bonding curve price; if the wallet doesn't hold enough tokens
   * we sell all available tokens instead.
   */
  private async executeSell(
    tracker: WalletTracker,
    order: TradeOrder,
    amountLamports: BN,
    slippageBps: number,
    priorityFee: number,
  ): Promise<TradeResult> {
    const mint = this.mint!;
    const sdk = this.getOnlineSdk();

    // Determine how many tokens to sell
    let tokenAmount: BN;

    // Refresh on-chain token balance for this wallet
    const ata = await getAssociatedTokenAddress(mint, tracker.wallet.keypair.publicKey);
    try {
      const tokenAccount = await getAccount(this.connection, ata);
      tracker.tokensHeld = new BN(tokenAccount.amount.toString());
    } catch {
      tracker.tokensHeld = new BN(0);
    }

    if (tracker.tokensHeld.isZero()) {
      // No tokens to sell — return a no-op result
      return {
        order,
        signature: '',
        amountOut: new BN(0),
        executionPrice: new BN(0),
        feesPaid: new BN(0),
        success: false,
        error: 'No tokens held to sell',
        executedAt: Date.now(),
      };
    }

    // Estimate token amount from SOL amount using bonding curve
    const bondingCurve = await sdk.fetchBondingCurve(mint);
    const estimatedTokens = getBuyTokenAmountFromSolAmount(bondingCurve, amountLamports);

    // Sell either the estimated equivalent or all held tokens (whichever is less)
    tokenAmount = BN.min(estimatedTokens, tracker.tokensHeld);
    if (tokenAmount.isZero()) {
      tokenAmount = tracker.tokensHeld; // Sell whatever we have
    }

    // Fetch sell state
    const global = await sdk.fetchGlobal();
    const sellState = await sdk.fetchSellState(
      mint,
      tracker.wallet.keypair.publicKey,
      TOKEN_PROGRAM_ID,
    );

    const sellIxs = await PUMP_SDK.sellInstructions({
      global,
      bondingCurveAccountInfo: sellState.bondingCurveAccountInfo,
      bondingCurve: sellState.bondingCurve,
      mint,
      user: tracker.wallet.keypair.publicKey,
      amount: tokenAmount,
      solAmount: new BN(0),
      slippage: slippageBps / 100,
      tokenProgram: TOKEN_PROGRAM_ID,
      mayhemMode: false,
    });

    const computeIxs = [
      ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }),
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: priorityFee }),
    ];

    const { blockhash } = await this.connection.getLatestBlockhash('confirmed');
    const tx = new Transaction({
      recentBlockhash: blockhash,
      feePayer: tracker.wallet.keypair.publicKey,
    });
    tx.add(...computeIxs, ...sellIxs);

    // Track SOL balance before sell
    const solBefore = await this.connection.getBalance(tracker.wallet.keypair.publicKey);

    const signature = await sendAndConfirmTransaction(
      this.connection,
      tx,
      [tracker.wallet.keypair],
      { commitment: 'confirmed', maxRetries: 3 },
    );

    const solAfter = await this.connection.getBalance(tracker.wallet.keypair.publicKey);
    const solReceived = new BN(Math.max(0, solAfter - solBefore));

    // Update token balance post-sell
    try {
      const tokenAccount = await getAccount(this.connection, ata);
      tracker.tokensHeld = new BN(tokenAccount.amount.toString());
    } catch {
      tracker.tokensHeld = new BN(0);
    }

    return {
      order,
      signature,
      amountOut: solReceived,
      executionPrice: tokenAmount.gtn(0)
        ? solReceived.mul(new BN(SOL_DECIMALS)).div(tokenAmount)
        : new BN(0),
      feesPaid: new BN(5000),
      success: true,
      executedAt: Date.now(),
    };
  }

  // ─── Helpers ────────────────────────────────────────────────

  /**
   * Generate a random trade size within configured bounds.
   */
  private randomTradeSize(): BN {
    const min = this.config.minTradeSize.toNumber();
    const max = this.config.maxTradeSize.toNumber();
    return new BN(Math.floor(min + Math.random() * (max - min)));
  }

  /**
   * Remove trade log entries older than the retention window.
   */
  private pruneTradeLog(now: number): void {
    const cutoff = now - VOLUME_HISTORY_RETENTION_MS;
    // Binary search would be faster but array is small enough for filter
    this.tradeLog = this.tradeLog.filter((e) => e.timestampMs >= cutoff);
  }
}

// ─── Utility ──────────────────────────────────────────────────

function lamportsToSol(lamports: BN): number {
  return lamports.toNumber() / LAMPORTS_PER_SOL;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
