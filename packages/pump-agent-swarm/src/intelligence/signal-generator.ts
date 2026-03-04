/**
 * Signal Generator — On-Chain Trading Signal Engine for Pump.fun Bonding Curves
 *
 * Generates buy/sell signals from real-time bonding curve data by computing:
 *   - Momentum (rate of change in SOL reserves)
 *   - Volume acceleration (buy/sell volume trend)
 *   - Price velocity (speed and direction of price movement)
 *   - RSI-like indicator (adapted for bonding curve reserve changes)
 *   - Whale detection (large wallet movements on the curve)
 *   - Graduation proximity (how close to Raydium migration)
 *
 * All data is sourced directly from Solana RPC — no mocks, no fakes.
 */

import {
  Connection,
  PublicKey,
} from '@solana/web3.js';
import type { ParsedTransactionWithMeta } from '@solana/web3.js';
import {
  bondingCurvePda,
  getTokenPrice,
  PUMP_SDK,
} from '@pump-fun/pump-sdk';

import type { SwarmEventBus } from '../infra/event-bus.js';
import { SwarmLogger } from '../infra/logger.js';

// ─── Constants ────────────────────────────────────────────────

/** Graduation threshold SOL in the real reserves (~85 SOL for Pump.fun v2) */
const GRADUATION_THRESHOLD_SOL = 85;

/** SOL decimals (lamports) */
const LAMPORTS_PER_SOL = 1_000_000_000;

/** Minimum snapshots required for any signal computation */
const MIN_SNAPSHOTS_FOR_SIGNAL = 3;

// ─── Signal Types ─────────────────────────────────────────────

export interface CurveSnapshot {
  /** Unix ms timestamp */
  timestamp: number;
  /** Solana slot number */
  slot: number;
  /** Virtual SOL reserves (lamports) */
  virtualSolReserves: bigint;
  /** Virtual token reserves (raw) */
  virtualTokenReserves: bigint;
  /** Real SOL reserves (lamports) */
  realSolReserves: bigint;
  /** Real token reserves (raw) */
  realTokenReserves: bigint;
  /** Price in SOL per token */
  price: number;
  /** Tokens purchased from curve (supply held by buyers) */
  totalSupplyHeld: bigint;
}

export interface MomentumSignal {
  /** Rate of change in SOL reserves (positive = buying pressure) */
  value: number;
  /** Normalized direction: -1 to 1 */
  direction: number;
  /** Signal: buy/sell/neutral */
  signal: 'buy' | 'sell' | 'neutral';
  /** How many periods the momentum has been sustained */
  sustainedPeriods: number;
}

export interface VolumeSignal {
  /** Is volume increasing or decreasing? */
  acceleration: number;
  /** Current period volume in SOL */
  currentVolume: number;
  /** Previous period volume in SOL */
  previousVolume: number;
  /** Signal */
  signal: 'buy' | 'sell' | 'neutral';
}

export interface PriceVelocitySignal {
  /** Price change per snapshot period */
  velocity: number;
  /** Is velocity increasing (acceleration) or decreasing (deceleration)? */
  accelerating: boolean;
  /** Percent change over lookback period */
  percentChange: number;
  signal: 'buy' | 'sell' | 'neutral';
}

export interface RSISignal {
  /** RSI value: 0–100 */
  value: number;
  /** Interpretation */
  condition: 'overbought' | 'neutral' | 'oversold';
  /** Signal (oversold = buy opportunity, overbought = sell opportunity) */
  signal: 'buy' | 'sell' | 'neutral';
}

export interface WhaleSignal {
  /** Has whale activity been detected? */
  detected: boolean;
  /** Direction of whale activity */
  direction: 'buying' | 'selling' | 'mixed' | 'none';
  /** Estimated SOL volume from whale transactions */
  estimatedVolume: number;
  signal: 'buy' | 'sell' | 'neutral';
}

export interface GraduationSignal {
  /** How close to graduation threshold (0–100%) */
  proximityPercent: number;
  /** Estimated time to graduation at current rate (ms), -1 if moving away */
  estimatedTimeMs: number;
  /** Is graduation imminent? */
  imminent: boolean;
  signal: 'buy' | 'sell' | 'neutral';
}

export interface TradingSignals {
  /** Overall signal direction */
  overall: 'strong-buy' | 'buy' | 'neutral' | 'sell' | 'strong-sell';
  /** Numeric score: 0 = strong sell, 50 = neutral, 100 = strong buy */
  score: number;
  /** Confidence in signal quality (0–1), based on data freshness and consistency */
  confidence: number;
  /** Individual indicators */
  indicators: {
    momentum: MomentumSignal;
    volumeAcceleration: VolumeSignal;
    priceVelocity: PriceVelocitySignal;
    rsi: RSISignal;
    whaleActivity: WhaleSignal;
    graduationProximity: GraduationSignal;
  };
  /** Timestamp of signal generation */
  generatedAt: number;
  /** Number of snapshots used for computation */
  dataPoints: number;
  /** Mint address */
  mint: string;
}

export interface SignalSnapshot {
  signals: TradingSignals;
  curveSnapshot: CurveSnapshot;
  timestamp: number;
}

export interface SignalConfig {
  /** Number of snapshots to keep for analysis */
  historyLength: number;
  /** Snapshot interval when monitoring (ms) */
  snapshotInterval: number;
  /** RSI period (number of snapshots) */
  rsiPeriod: number;
  /** Momentum lookback period (snapshots) */
  momentumPeriod: number;
  /** Whale threshold: min SOL for a single trade to be "whale" */
  whaleThresholdSOL: number;
  /** Signal strength thresholds */
  thresholds: {
    strongBuy: number;
    buy: number;
    sell: number;
    strongSell: number;
  };
  /** Indicator weights for aggregation (must sum to 1.0) */
  weights: {
    momentum: number;
    volume: number;
    priceVelocity: number;
    rsi: number;
    whale: number;
    graduation: number;
  };
}

// ─── Defaults ─────────────────────────────────────────────────

const DEFAULT_CONFIG: SignalConfig = {
  historyLength: 100,
  snapshotInterval: 5_000,
  rsiPeriod: 14,
  momentumPeriod: 10,
  whaleThresholdSOL: 5,
  thresholds: {
    strongBuy: 80,
    buy: 60,
    sell: 40,
    strongSell: 20,
  },
  weights: {
    momentum: 0.25,
    volume: 0.20,
    priceVelocity: 0.15,
    rsi: 0.20,
    whale: 0.10,
    graduation: 0.10,
  },
};

// ─── Helpers ──────────────────────────────────────────────────

/** Convert bigint (lamports) → SOL as number */
function lamportsToSol(lamports: bigint): number {
  return Number(lamports) / LAMPORTS_PER_SOL;
}

/** Clamp a number to [min, max] */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// ─── Signal Generator ─────────────────────────────────────────

export class SignalGenerator {
  private readonly connection: Connection;
  private readonly eventBus: SwarmEventBus;
  private readonly config: SignalConfig;
  private readonly logger: SwarmLogger;

  /** Per-mint snapshot history (ring-buffer trimmed to historyLength) */
  private readonly snapshots = new Map<string, CurveSnapshot[]>();

  /** Per-mint signal history */
  private readonly signalHistory = new Map<string, SignalSnapshot[]>();

  /** Per-mint latest signals cache */
  private readonly latestSignals = new Map<string, TradingSignals>();

  /** Active monitoring intervals keyed by mint */
  private readonly monitors = new Map<string, ReturnType<typeof setInterval>>();

  constructor(
    connection: Connection,
    eventBus: SwarmEventBus,
    config?: Partial<SignalConfig>,
  ) {
    this.connection = connection;
    this.eventBus = eventBus;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.logger = SwarmLogger.create('signal-generator', 'intelligence');
    this.logger.info('Signal generator initialized', {
      historyLength: this.config.historyLength,
      snapshotInterval: this.config.snapshotInterval,
      rsiPeriod: this.config.rsiPeriod,
    });
  }

  // ── Public API ────────────────────────────────────────────

  /**
   * Generate all trading signals for a token by taking a fresh snapshot
   * and computing indicators against historical data.
   */
  async generateSignals(mint: string): Promise<TradingSignals> {
    const snapshot = await this.takeSnapshot(mint);
    this.pushSnapshot(mint, snapshot);

    const history = this.getSnapshots(mint);
    const signals = await this.computeAllSignals(mint, history);

    // Cache and store
    this.latestSignals.set(mint, signals);
    this.pushSignalHistory(mint, { signals, curveSnapshot: snapshot, timestamp: Date.now() });

    // Emit event
    this.eventBus.emit({
      type: 'intelligence:signal-generated',
      payload: { mint, overall: signals.overall, score: signals.score, confidence: signals.confidence },
      timestamp: Date.now(),
    });

    return signals;
  }

  /**
   * Start continuous signal monitoring for a token.
   * Takes snapshots at the configured interval and emits signals.
   */
  startMonitoring(mint: string, intervalMs?: number): void {
    if (this.monitors.has(mint)) {
      this.logger.warn('Already monitoring', { mint });
      return;
    }

    const interval = intervalMs ?? this.config.snapshotInterval;
    this.logger.info('Starting signal monitoring', { mint, intervalMs: interval });

    const timer = setInterval(() => {
      void this.generateSignals(mint).catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.error('Signal generation failed during monitoring', { mint, error: message });
      });
    }, interval);

    this.monitors.set(mint, timer);

    // Take an initial snapshot immediately
    void this.generateSignals(mint).catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error('Initial signal generation failed', { mint, error: message });
    });
  }

  /** Stop monitoring a token. */
  stopMonitoring(mint: string): void {
    const timer = this.monitors.get(mint);
    if (timer) {
      clearInterval(timer);
      this.monitors.delete(mint);
      this.logger.info('Stopped signal monitoring', { mint });
    }
  }

  /** Stop all active monitors (for graceful shutdown). */
  stopAll(): void {
    for (const [mint, timer] of this.monitors) {
      clearInterval(timer);
      this.logger.info('Stopped signal monitoring', { mint });
    }
    this.monitors.clear();
  }

  /** Get full signal history for a mint. */
  getSignalHistory(mint: string): SignalSnapshot[] {
    return this.signalHistory.get(mint) ?? [];
  }

  /** Get the most recently computed signals for a mint. */
  getLatestSignals(mint: string): TradingSignals | undefined {
    return this.latestSignals.get(mint);
  }

  // ── Indicator Computation (public for testability) ────────

  /**
   * Compute momentum — rate of change in SOL reserves.
   * Positive momentum = net buying, negative = net selling.
   */
  computeMomentum(snapshots: CurveSnapshot[]): MomentumSignal {
    if (snapshots.length < 2) {
      return { value: 0, direction: 0, signal: 'neutral', sustainedPeriods: 0 };
    }

    const period = Math.min(this.config.momentumPeriod, snapshots.length - 1);
    const recent = snapshots.slice(-period - 1);

    // SOL reserve changes between consecutive snapshots
    const changes: number[] = [];
    for (let i = 1; i < recent.length; i++) {
      const prev = lamportsToSol(recent[i - 1].realSolReserves);
      const curr = lamportsToSol(recent[i].realSolReserves);
      changes.push(curr - prev);
    }

    const totalChange = changes.reduce((sum, c) => sum + c, 0);
    const avgChange = totalChange / changes.length;

    // Count sustained periods in the same direction
    let sustainedPeriods = 0;
    const lastDirection = Math.sign(changes[changes.length - 1]);
    for (let i = changes.length - 1; i >= 0; i--) {
      if (Math.sign(changes[i]) === lastDirection && lastDirection !== 0) {
        sustainedPeriods++;
      } else {
        break;
      }
    }

    // Normalize direction to [-1, 1] using tanh for smooth scaling
    const direction = clamp(Math.tanh(avgChange * 10), -1, 1);

    const signal: 'buy' | 'sell' | 'neutral' =
      direction > 0.1 ? 'buy' :
      direction < -0.1 ? 'sell' :
      'neutral';

    return {
      value: totalChange,
      direction,
      signal,
      sustainedPeriods,
    };
  }

  /**
   * Compute volume acceleration — is trading volume increasing or decreasing?
   * Compares SOL volume in the most recent half of snapshots vs the prior half.
   */
  computeVolumeAcceleration(snapshots: CurveSnapshot[]): VolumeSignal {
    if (snapshots.length < 4) {
      return { acceleration: 0, currentVolume: 0, previousVolume: 0, signal: 'neutral' };
    }

    const mid = Math.floor(snapshots.length / 2);
    const firstHalf = snapshots.slice(0, mid);
    const secondHalf = snapshots.slice(mid);

    // Volume = sum of absolute SOL reserve changes in each half
    const computeVolume = (snaps: CurveSnapshot[]): number => {
      let volume = 0;
      for (let i = 1; i < snaps.length; i++) {
        const delta = Math.abs(
          lamportsToSol(snaps[i].realSolReserves) -
          lamportsToSol(snaps[i - 1].realSolReserves),
        );
        volume += delta;
      }
      return volume;
    };

    const previousVolume = computeVolume(firstHalf);
    const currentVolume = computeVolume(secondHalf);

    // Acceleration: positive = volume increasing, negative = decreasing
    const acceleration = previousVolume > 0
      ? (currentVolume - previousVolume) / previousVolume
      : currentVolume > 0 ? 1 : 0;

    // Increasing volume with buying = bullish, increasing volume with selling = bearish
    // We use direction of net reserve change in the recent half as proxy
    const netChange = lamportsToSol(secondHalf[secondHalf.length - 1].realSolReserves) -
                      lamportsToSol(secondHalf[0].realSolReserves);

    let signal: 'buy' | 'sell' | 'neutral' = 'neutral';
    if (acceleration > 0.1) {
      signal = netChange >= 0 ? 'buy' : 'sell';
    }

    return { acceleration, currentVolume, previousVolume, signal };
  }

  /**
   * Compute price velocity — speed and direction of price movement.
   */
  computePriceVelocity(snapshots: CurveSnapshot[]): PriceVelocitySignal {
    if (snapshots.length < 2) {
      return { velocity: 0, accelerating: false, percentChange: 0, signal: 'neutral' };
    }

    const period = Math.min(this.config.momentumPeriod, snapshots.length - 1);
    const recent = snapshots.slice(-period - 1);

    const firstPrice = recent[0].price;
    const lastPrice = recent[recent.length - 1].price;
    const overallVelocity = (lastPrice - firstPrice) / recent.length;

    // Percent change over the lookback
    const percentChange = firstPrice > 0
      ? ((lastPrice - firstPrice) / firstPrice) * 100
      : 0;

    // Acceleration: compare velocity in first half vs second half
    let accelerating = false;
    if (recent.length >= 4) {
      const mid = Math.floor(recent.length / 2);
      const firstHalfVelocity = (recent[mid].price - recent[0].price) / mid;
      const secondHalfVelocity = (recent[recent.length - 1].price - recent[mid].price) / (recent.length - mid);
      accelerating = Math.abs(secondHalfVelocity) > Math.abs(firstHalfVelocity) &&
                     Math.sign(secondHalfVelocity) === Math.sign(overallVelocity);
    }

    const signal: 'buy' | 'sell' | 'neutral' =
      percentChange > 1 ? 'buy' :
      percentChange < -1 ? 'sell' :
      'neutral';

    return {
      velocity: overallVelocity,
      accelerating,
      percentChange,
      signal,
    };
  }

  /**
   * Compute RSI adapted for bonding curves.
   * Uses change in virtualSolReserves between snapshots.
   * Positive change = "up period" (buying), negative = "down period" (selling).
   * Uses exponential moving average for smoothing.
   */
  computeRSI(snapshots: CurveSnapshot[], period?: number): number {
    const rsiPeriod = period ?? this.config.rsiPeriod;

    if (snapshots.length < rsiPeriod + 1) {
      return 50; // Insufficient data → neutral
    }

    // Calculate period-over-period changes in virtualSolReserves
    const changes: number[] = [];
    for (let i = 1; i < snapshots.length; i++) {
      const delta = Number(snapshots[i].virtualSolReserves - snapshots[i - 1].virtualSolReserves);
      changes.push(delta);
    }

    // Seed the EMA with the simple average of the first `rsiPeriod` values
    let avgGain = 0;
    let avgLoss = 0;
    for (let i = 0; i < rsiPeriod; i++) {
      if (changes[i] > 0) {
        avgGain += changes[i];
      } else {
        avgLoss += Math.abs(changes[i]);
      }
    }
    avgGain /= rsiPeriod;
    avgLoss /= rsiPeriod;

    // Apply EMA smoothing over remaining changes
    const alpha = 1 / rsiPeriod;
    for (let i = rsiPeriod; i < changes.length; i++) {
      const gain = changes[i] > 0 ? changes[i] : 0;
      const loss = changes[i] < 0 ? Math.abs(changes[i]) : 0;
      avgGain = avgGain * (1 - alpha) + gain * alpha;
      avgLoss = avgLoss * (1 - alpha) + loss * alpha;
    }

    if (avgLoss === 0) {
      return 100; // All gains, no losses
    }

    const rs = avgGain / avgLoss;
    const rsi = 100 - (100 / (1 + rs));
    return clamp(rsi, 0, 100);
  }

  /**
   * Detect whale activity by scanning recent transactions on the bonding curve.
   * Whale = any single trade ≥ whaleThresholdSOL.
   */
  async detectWhaleActivity(mint: string): Promise<WhaleSignal> {
    const noWhale: WhaleSignal = {
      detected: false,
      direction: 'none',
      estimatedVolume: 0,
      signal: 'neutral',
    };

    try {
      const mintPubkey = new PublicKey(mint);
      const bondingCurveAddress = bondingCurvePda(mintPubkey);

      // Fetch recent transaction signatures for the bonding curve
      const signatures = await this.connection.getSignaturesForAddress(
        bondingCurveAddress,
        { limit: 20 },
      );

      if (signatures.length === 0) {
        return noWhale;
      }

      // Fetch parsed transaction details
      const txSigs = signatures.map((s) => s.signature);
      const transactions = await this.connection.getParsedTransactions(txSigs, {
        maxSupportedTransactionVersion: 0,
      });

      let whaleBuyVolume = 0;
      let whaleSellVolume = 0;
      const thresholdLamports = this.config.whaleThresholdSOL * LAMPORTS_PER_SOL;

      for (const tx of transactions) {
        if (!tx?.meta) continue;
        const preBalances = tx.meta.preBalances;
        const postBalances = tx.meta.postBalances;

        // Find the bonding curve account index to measure SOL flow
        const bcIndex = this.findAccountIndex(tx, bondingCurveAddress);
        if (bcIndex === -1) continue;

        const solDelta = (postBalances[bcIndex] ?? 0) - (preBalances[bcIndex] ?? 0);
        const absDelta = Math.abs(solDelta);

        if (absDelta >= thresholdLamports) {
          if (solDelta > 0) {
            // SOL flowed INTO the curve → user bought tokens
            whaleBuyVolume += absDelta / LAMPORTS_PER_SOL;
          } else {
            // SOL flowed OUT of the curve → user sold tokens
            whaleSellVolume += absDelta / LAMPORTS_PER_SOL;
          }
        }
      }

      const totalWhaleVolume = whaleBuyVolume + whaleSellVolume;
      if (totalWhaleVolume === 0) {
        return noWhale;
      }

      let direction: WhaleSignal['direction'] = 'none';
      if (whaleBuyVolume > 0 && whaleSellVolume > 0) {
        direction = 'mixed';
      } else if (whaleBuyVolume > 0) {
        direction = 'buying';
      } else if (whaleSellVolume > 0) {
        direction = 'selling';
      }

      const signal: 'buy' | 'sell' | 'neutral' =
        direction === 'buying' ? 'buy' :
        direction === 'selling' ? 'sell' :
        'neutral';

      return {
        detected: true,
        direction,
        estimatedVolume: totalWhaleVolume,
        signal,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn('Whale detection failed, returning neutral', { mint, error: message });
      return noWhale;
    }
  }

  // ── Private Methods ───────────────────────────────────────

  /**
   * Take a point-in-time snapshot of the bonding curve state from on-chain data.
   */
  private async takeSnapshot(mint: string): Promise<CurveSnapshot> {
    const mintPubkey = new PublicKey(mint);
    const bondingCurveAddress = bondingCurvePda(mintPubkey);

    const accountInfo = await this.connection.getAccountInfo(bondingCurveAddress);
    if (!accountInfo) {
      throw new Error(`Bonding curve account not found for mint ${mint}`);
    }

    const decoded = PUMP_SDK.decodeBondingCurve(accountInfo);
    const price = getTokenPrice(decoded);
    const slot = await this.connection.getSlot();

    // Total supply held = tokenTotalSupply - realTokenReserves
    // (tokens purchased from curve = total supply minus what remains in the curve)
    const totalSupplyHeld = decoded.tokenTotalSupply.sub(decoded.realTokenReserves);

    return {
      timestamp: Date.now(),
      slot,
      virtualSolReserves: BigInt(decoded.virtualSolReserves.toString()),
      virtualTokenReserves: BigInt(decoded.virtualTokenReserves.toString()),
      realSolReserves: BigInt(decoded.realSolReserves.toString()),
      realTokenReserves: BigInt(decoded.realTokenReserves.toString()),
      price,
      totalSupplyHeld: BigInt(totalSupplyHeld.toString()),
    };
  }

  /**
   * Push a snapshot into the history ring buffer for a given mint.
   * Trims to historyLength.
   */
  private pushSnapshot(mint: string, snapshot: CurveSnapshot): void {
    let history = this.snapshots.get(mint);
    if (!history) {
      history = [];
      this.snapshots.set(mint, history);
    }
    history.push(snapshot);
    if (history.length > this.config.historyLength) {
      history.splice(0, history.length - this.config.historyLength);
    }
  }

  /** Push a signal snapshot into history, trimmed to historyLength. */
  private pushSignalHistory(mint: string, snapshot: SignalSnapshot): void {
    let history = this.signalHistory.get(mint);
    if (!history) {
      history = [];
      this.signalHistory.set(mint, history);
    }
    history.push(snapshot);
    if (history.length > this.config.historyLength) {
      history.splice(0, history.length - this.config.historyLength);
    }
  }

  /** Get all stored snapshots for a mint. */
  private getSnapshots(mint: string): CurveSnapshot[] {
    return this.snapshots.get(mint) ?? [];
  }

  /**
   * Compute all indicators and aggregate into TradingSignals.
   */
  private async computeAllSignals(
    mint: string,
    history: CurveSnapshot[],
  ): Promise<TradingSignals> {
    // Individual indicators
    const momentum = this.computeMomentum(history);
    const volumeAcceleration = this.computeVolumeAcceleration(history);
    const priceVelocity = this.computePriceVelocity(history);
    const rsiValue = this.computeRSI(history);
    const rsi = this.buildRSISignal(rsiValue);
    const whaleActivity = await this.detectWhaleActivity(mint);
    const graduationProximity = this.computeGraduationProximity(history);

    // Aggregate score (0–100)
    const { score, confidence } = this.aggregateScore(
      { momentum, volumeAcceleration, priceVelocity, rsi, whaleActivity, graduationProximity },
      history.length,
    );

    const overall = this.scoreToOverall(score);

    const signals: TradingSignals = {
      overall,
      score,
      confidence,
      indicators: {
        momentum,
        volumeAcceleration,
        priceVelocity,
        rsi,
        whaleActivity,
        graduationProximity,
      },
      generatedAt: Date.now(),
      dataPoints: history.length,
      mint,
    };

    this.logger.info('Signals computed', {
      mint,
      overall,
      score: Math.round(score * 100) / 100,
      confidence: Math.round(confidence * 100) / 100,
      dataPoints: history.length,
    });

    return signals;
  }

  /**
   * Build an RSI signal from a raw RSI value.
   */
  private buildRSISignal(rsiValue: number): RSISignal {
    let condition: RSISignal['condition'] = 'neutral';
    let signal: 'buy' | 'sell' | 'neutral' = 'neutral';

    if (rsiValue >= 70) {
      condition = 'overbought';
      signal = 'sell'; // Overbought → sell opportunity
    } else if (rsiValue <= 30) {
      condition = 'oversold';
      signal = 'buy'; // Oversold → buy opportunity
    }

    return { value: rsiValue, condition, signal };
  }

  /**
   * Compute graduation proximity signal from the latest snapshot.
   */
  private computeGraduationProximity(history: CurveSnapshot[]): GraduationSignal {
    const neutral: GraduationSignal = {
      proximityPercent: 0,
      estimatedTimeMs: -1,
      imminent: false,
      signal: 'neutral',
    };

    if (history.length === 0) return neutral;

    const latest = history[history.length - 1];
    const realSolSOL = lamportsToSol(latest.realSolReserves);
    const proximityPercent = clamp((realSolSOL / GRADUATION_THRESHOLD_SOL) * 100, 0, 100);

    // Estimate time to graduation from rate of SOL inflow
    let estimatedTimeMs = -1;
    if (history.length >= 2) {
      const oldestRelevant = history[Math.max(0, history.length - this.config.momentumPeriod)];
      const elapsedMs = latest.timestamp - oldestRelevant.timestamp;
      const solChange = lamportsToSol(latest.realSolReserves) -
                        lamportsToSol(oldestRelevant.realSolReserves);

      if (solChange > 0 && elapsedMs > 0) {
        const solPerMs = solChange / elapsedMs;
        const solRemaining = GRADUATION_THRESHOLD_SOL - realSolSOL;
        if (solRemaining > 0) {
          estimatedTimeMs = solRemaining / solPerMs;
        } else {
          estimatedTimeMs = 0; // Already graduated
        }
      }
    }

    const imminent = proximityPercent >= 90;

    // Near graduation is bullish (price explodes post-graduation on Raydium)
    let signal: 'buy' | 'sell' | 'neutral' = 'neutral';
    if (proximityPercent >= 80) {
      signal = 'buy';
    } else if (proximityPercent < 10 && history.length > 5) {
      // Very early, low progress — extra caution
      signal = 'neutral';
    }

    return { proximityPercent, estimatedTimeMs, imminent, signal };
  }

  /**
   * Aggregate individual indicator scores into a final score.
   * Each indicator maps its signal to a 0–100 sub-score:
   *   buy = 75, sell = 25, neutral = 50
   * Weighted sum produces the final score.
   */
  private aggregateScore(
    indicators: TradingSignals['indicators'],
    dataPoints: number,
  ): { score: number; confidence: number } {
    const { weights } = this.config;

    const signalToScore = (s: 'buy' | 'sell' | 'neutral'): number =>
      s === 'buy' ? 75 : s === 'sell' ? 25 : 50;

    // Base scores from signal direction
    const momentumScore = signalToScore(indicators.momentum.signal) +
      indicators.momentum.direction * 25; // [-25, +25] boost based on strength
    const volumeScore = signalToScore(indicators.volumeAcceleration.signal);
    const priceScore = signalToScore(indicators.priceVelocity.signal);

    // RSI maps directly: oversold (RSI 0-30) → high score, overbought (70-100) → low score
    const rsiScore = 100 - indicators.rsi.value;

    const whaleScore = signalToScore(indicators.whaleActivity.signal);
    const graduationScore = signalToScore(indicators.graduationProximity.signal) +
      (indicators.graduationProximity.imminent ? 15 : 0); // Bonus for imminent graduation

    const rawScore =
      clamp(momentumScore, 0, 100) * weights.momentum +
      clamp(volumeScore, 0, 100) * weights.volume +
      clamp(priceScore, 0, 100) * weights.priceVelocity +
      clamp(rsiScore, 0, 100) * weights.rsi +
      clamp(whaleScore, 0, 100) * weights.whale +
      clamp(graduationScore, 0, 100) * weights.graduation;

    const score = clamp(rawScore, 0, 100);

    // Confidence based on:
    // 1. Data sufficiency (more data points → higher confidence, up to historyLength)
    // 2. Signal consistency (all indicators agree → higher confidence)
    const dataSufficiency = clamp(dataPoints / this.config.historyLength, 0, 1);
    const signals = [
      indicators.momentum.signal,
      indicators.volumeAcceleration.signal,
      indicators.priceVelocity.signal,
      indicators.rsi.signal,
      indicators.whaleActivity.signal,
      indicators.graduationProximity.signal,
    ];
    const buyCount = signals.filter((s) => s === 'buy').length;
    const sellCount = signals.filter((s) => s === 'sell').length;
    const dominantCount = Math.max(buyCount, sellCount);
    const signalConsistency = dominantCount / signals.length;

    // Freshness: penalize stale data
    const freshness = dataPoints >= MIN_SNAPSHOTS_FOR_SIGNAL ? 1 : 0.5;

    const confidence = clamp(
      dataSufficiency * 0.4 + signalConsistency * 0.4 + freshness * 0.2,
      0,
      1,
    );

    return { score, confidence };
  }

  /**
   * Map a numeric score to an overall signal label based on configured thresholds.
   */
  private scoreToOverall(score: number): TradingSignals['overall'] {
    const { thresholds } = this.config;
    if (score >= thresholds.strongBuy) return 'strong-buy';
    if (score >= thresholds.buy) return 'neutral'; // 60-79 is mild buy territory but not decisive
    if (score > thresholds.sell) return 'neutral';
    if (score > thresholds.strongSell) return 'sell';
    return 'strong-sell';
  }

  /**
   * Find the index of the bonding curve account within a parsed transaction.
   */
  private findAccountIndex(
    tx: ParsedTransactionWithMeta,
    address: PublicKey,
  ): number {
    const keys = tx.transaction.message.accountKeys;
    const addressStr = address.toBase58();
    for (let i = 0; i < keys.length; i++) {
      if (keys[i].pubkey.toBase58() === addressStr) {
        return i;
      }
    }
    return -1;
  }
}
