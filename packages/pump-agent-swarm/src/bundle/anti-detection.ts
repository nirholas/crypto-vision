/**
 * Anti-Detection Patterns — Organic-looking on-chain activity
 *
 * Makes agent swarm trading activity appear human-generated rather than
 * bot-driven. Covers amount randomization with cryptographic entropy,
 * timing jitter with human-like patterns, wallet behavior profiling,
 * trade pattern obfuscation, and self-audit risk scoring.
 *
 * All randomness uses `crypto.randomBytes()` — never `Math.random()`.
 */

import { randomBytes } from 'node:crypto';

import type { AgentWallet, TradeOrder, TradeDirection, SwarmEventCategory } from '../types.js';
import { SwarmEventBus } from '../infra/event-bus.js';
import { SwarmLogger } from '../infra/logger.js';

// ─── Constants ────────────────────────────────────────────────

/** 1 SOL = 1_000_000_000 lamports */
const LAMPORTS_PER_SOL = 1_000_000_000n;

/** Round SOL values that humans avoid (bots don't) */
const ROUND_SOL_VALUES = [
  0.1, 0.2, 0.25, 0.5, 0.75, 1.0, 1.5, 2.0, 2.5, 3.0, 4.0, 5.0, 10.0,
];

/** Tolerance for considering a number "round" (0.1%) */
const ROUND_TOLERANCE = 0.001;

/** Round token quantities to avoid */
const ROUND_TOKEN_AMOUNTS = [
  100, 500, 1_000, 2_000, 5_000, 10_000, 25_000, 50_000, 100_000, 500_000,
  1_000_000,
];

/** Default hourly activity weights (humans trade less at 3am UTC) */
const DEFAULT_HOURLY_WEIGHTS: number[] = [
  0.15, 0.10, 0.08, 0.05, 0.04, 0.06, // 00-05: minimal night activity
  0.12, 0.25, 0.45, 0.65, 0.80, 0.85, // 06-11: waking up, morning ramp
  0.90, 1.00, 0.95, 0.90, 0.85, 0.80, // 12-17: peak afternoon
  0.70, 0.60, 0.55, 0.45, 0.35, 0.20, // 18-23: evening wind-down
];

// ─── Interfaces ───────────────────────────────────────────────

export interface AntiDetectionConfig {
  /** Minimum variance applied to all amounts (percent, 5-20 recommended) */
  minAmountVariance: number;
  /** Maximum variance applied to all amounts */
  maxAmountVariance: number;
  /** Base timing jitter range in ms [min, max] */
  timingJitterRange: [number, number];
  /** Max trades per wallet per hour before forced cooldown */
  maxTradesPerWalletPerHour: number;
  /** Max trades per wallet per day */
  maxTradesPerWalletPerDay: number;
  /** Whether to insert noise transactions between real trades */
  enableNoiseTransactions: boolean;
  /** Probability of inserting a noise transaction (0-1) */
  noiseProbability: number;
  /** Min different wallets to cycle through before reusing one */
  minWalletRotation: number;
  /** Avoid round numbers (e.g., exactly 1.0 SOL) */
  avoidRoundNumbers: boolean;
  /** Add human-like patterns: occasional pauses, variable activity levels */
  humanPatternEmulation: boolean;
}

export interface TradeTimingProfile {
  /** Delay before first trade of session (simulate "opening app") */
  sessionStartDelay: number;
  /** Base interval between trades */
  baseInterval: number;
  /** Variance on interval */
  intervalJitter: number;
  /** Probability of a longer "distraction" pause */
  longPauseProbability: number;
  /** Duration of long pauses [min, max] */
  longPauseRange: [number, number];
  /** Time of day weighting (humans trade less at 3am) */
  hourlyActivityWeights: number[];
  /** Burst trading periods (simulate "found an alpha" behavior) */
  burstProbability: number;
  /** Range of trades in a burst [min, max] */
  burstTradeCount: [number, number];
  /** Interval between burst trades [min, max] ms */
  burstInterval: [number, number];
}

export interface TradeHistoryEntry {
  walletAddress: string;
  direction: TradeDirection;
  amountLamports: bigint;
  timestamp: number;
  mint: string;
}

export interface OnChainActivity {
  walletAddress: string;
  type: 'buy' | 'sell' | 'transfer' | 'wrap' | 'unwrap' | 'other';
  amountLamports: bigint;
  timestamp: number;
  slot: number;
  mint?: string;
}

export interface DetectionRiskScore {
  /** 0-100, higher = more detectable */
  overall: number;
  factors: {
    timingRegularity: number;
    amountPatterns: number;
    walletConcentration: number;
    directionBias: number;
    volumeSpikes: number;
    sameBlockClustering: number;
  };
  recommendations: string[];
}

export interface WalletRotationPlan {
  /** Ordered list of wallets to use next */
  sequence: Array<{
    wallet: AgentWallet;
    role: 'buyer' | 'seller' | 'holder' | 'flipper';
    cooldownUntil: number;
    tradesRemaining: number;
  }>;
  /** Wallets currently on cooldown */
  cooldownWallets: string[];
  /** Next wallet to use */
  nextWalletIndex: number;
  /** Estimated time until all cooldowns expire */
  fullAvailabilityAt: number;
}

export type NoiseTransactionType =
  | 'wrap_sol'
  | 'unwrap_sol'
  | 'self_transfer'
  | 'balance_check';

export interface NoiseTransactionConfig {
  type: NoiseTransactionType;
  wallet: string;
  amountLamports: bigint;
  delayBeforeMs: number;
  description: string;
}

export interface TradeSequenceValidation {
  valid: boolean;
  riskScore: number;
  issues: Array<{
    severity: 'low' | 'medium' | 'high';
    description: string;
    tradeIndices: number[];
  }>;
  suggestions: string[];
}

/** Per-wallet activity tracker */
interface WalletActivityRecord {
  address: string;
  tradesLastHour: TradeHistoryEntry[];
  tradesLast24h: TradeHistoryEntry[];
  lastTradeTimestamp: number;
  consecutiveUses: number;
  totalBuys: number;
  totalSells: number;
  assignedRole: 'buyer' | 'seller' | 'holder' | 'flipper';
}

// ─── Secure RNG Helpers ───────────────────────────────────────

/**
 * Generate a cryptographically secure random float in [0, 1).
 * Uses 6 bytes (48 bits) of entropy from `crypto.randomBytes()`.
 */
function secureRandom(): number {
  const bytes = randomBytes(6);
  // Read 6 bytes as a 48-bit unsigned integer
  const value =
    bytes[0]! * 2 ** 40 +
    bytes[1]! * 2 ** 32 +
    bytes[2]! * 2 ** 24 +
    bytes[3]! * 2 ** 16 +
    bytes[4]! * 2 ** 8 +
    bytes[5]!;
  return value / 2 ** 48;
}

/**
 * Secure random integer in [min, max] (inclusive).
 */
function secureRandomInt(min: number, max: number): number {
  return Math.floor(secureRandom() * (max - min + 1)) + min;
}

/**
 * Secure random bigint in [0, maxExclusive).
 */
function secureRandomBigInt(maxExclusive: bigint): bigint {
  if (maxExclusive <= 0n) return 0n;
  // Determine byte length needed
  const bitLength = maxExclusive.toString(2).length;
  const byteLength = Math.ceil(bitLength / 8);
  // Rejection sampling for uniform distribution
  const mask = (1n << BigInt(bitLength)) - 1n;
  for (let attempt = 0; attempt < 100; attempt++) {
    const bytes = randomBytes(byteLength);
    let value = 0n;
    for (let i = 0; i < byteLength; i++) {
      value = (value << 8n) | BigInt(bytes[i]!);
    }
    value &= mask;
    if (value < maxExclusive) return value;
  }
  // Fallback (statistically near-impossible to reach)
  return maxExclusive - 1n;
}

/**
 * Generate a gaussian-distributed random number using Box-Muller transform.
 * Mean = 0, StdDev = 1. Uses `secureRandom()` for entropy.
 */
function secureGaussian(): number {
  let u1 = secureRandom();
  // Avoid log(0)
  while (u1 === 0) u1 = secureRandom();
  const u2 = secureRandom();
  return Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
}

/**
 * Check if a SOL value is "round" (bot-like).
 */
function isRoundSolValue(sol: number): boolean {
  return ROUND_SOL_VALUES.some(
    (round) => Math.abs(sol - round) / round < ROUND_TOLERANCE,
  );
}

/**
 * Check if a token amount is "round" (bot-like).
 */
function isRoundTokenAmount(amount: number): boolean {
  return ROUND_TOKEN_AMOUNTS.some(
    (round) => Math.abs(amount - round) / round < ROUND_TOLERANCE,
  );
}

/**
 * Nudge a value away from roundness by adding a small perturbation.
 */
function nudgeAwayFromRound(value: number, minNudge: number): number {
  const nudge = minNudge + secureRandom() * minNudge * 2;
  return secureRandom() > 0.5 ? value + nudge : value - nudge;
}

// ─── AntiDetection Class ──────────────────────────────────────

export class AntiDetection {
  private readonly config: AntiDetectionConfig;
  private readonly eventBus: SwarmEventBus;
  private readonly logger: SwarmLogger;
  private readonly walletActivity: Map<string, WalletActivityRecord> =
    new Map();
  private lastUsedWalletAddresses: string[] = [];

  constructor(
    config: AntiDetectionConfig,
    eventBus: SwarmEventBus,
    logger?: SwarmLogger,
  ) {
    this.config = config;
    this.eventBus = eventBus;
    this.logger =
      logger ?? SwarmLogger.create('anti-detection', 'coordination');

    this.logger.info('AntiDetection initialized', {
      minVariance: config.minAmountVariance,
      maxVariance: config.maxAmountVariance,
      jitterRange: config.timingJitterRange,
      maxTradesPerHour: config.maxTradesPerWalletPerHour,
      noiseEnabled: config.enableNoiseTransactions,
    });
  }

  // ─── Amount Randomization ────────────────────────────────────

  /**
   * Add random variance to a lamport amount using gaussian-distributed
   * noise. The result is clamped to [1, ∞) and never a round SOL value.
   *
   * @param baseLamports - Base amount in lamports
   * @param variancePercent - Maximum variance as a percentage (e.g. 15 = ±15%)
   * @returns Randomized lamport amount
   */
  randomizeAmount(baseLamports: bigint, variancePercent: number): bigint {
    const effectiveVariance = Math.max(
      this.config.minAmountVariance,
      Math.min(variancePercent, this.config.maxAmountVariance),
    );

    // Gaussian noise centered at 0 with ~68% of values within ±stddev
    const stddev = effectiveVariance / 3; // 3σ ≈ 99.7% within variance
    const gaussianFactor = secureGaussian() * stddev;
    const clampedFactor = Math.max(
      -effectiveVariance,
      Math.min(gaussianFactor, effectiveVariance),
    );

    // Apply percentage-based variance
    const multiplier = 1 + clampedFactor / 100;
    let result = BigInt(Math.round(Number(baseLamports) * multiplier));

    // Ensure positive
    if (result <= 0n) result = 1n;

    // Avoid round SOL values
    if (this.config.avoidRoundNumbers) {
      result = this.avoidRoundLamports(result);
    }

    this.logger.debug('Amount randomized', {
      base: baseLamports.toString(),
      variance: effectiveVariance,
      factor: clampedFactor.toFixed(4),
      result: result.toString(),
    });

    return result;
  }

  /**
   * Convenience method for SOL amounts (floating point).
   * Converts to lamports internally for precision, then back to SOL.
   */
  randomizeAmountSOL(baseSOL: number, variancePercent: number): number {
    const baseLamports = BigInt(Math.round(baseSOL * Number(LAMPORTS_PER_SOL)));
    const randomLamports = this.randomizeAmount(baseLamports, variancePercent);
    const result = Number(randomLamports) / Number(LAMPORTS_PER_SOL);

    // Extra round-number check at SOL level
    if (this.config.avoidRoundNumbers && isRoundSolValue(result)) {
      return nudgeAwayFromRound(result, 0.003);
    }

    return result;
  }

  /**
   * Nudge a lamport value away from round SOL boundaries.
   */
  private avoidRoundLamports(lamports: bigint): bigint {
    const sol = Number(lamports) / Number(LAMPORTS_PER_SOL);
    if (!isRoundSolValue(sol)) return lamports;

    // Add a small random perturbation (0.3%-3% of value)
    const perturbPercent = 0.3 + secureRandom() * 2.7;
    const perturbLamports = secureRandomBigInt(
      BigInt(Math.max(1, Math.round(Number(lamports) * (perturbPercent / 100)))),
    );
    return secureRandom() > 0.5
      ? lamports + perturbLamports + 1n
      : lamports - perturbLamports;
  }

  // ─── Timing Patterns ────────────────────────────────────────

  /**
   * Wait for a random jittered delay. Uses configurable base + jitter.
   */
  async jitterDelay(baseMs: number, maxJitterMs: number): Promise<void> {
    const jitter = secureRandomInt(0, maxJitterMs);
    const total = baseMs + jitter;

    this.logger.debug('Jitter delay', { baseMs, jitter, totalMs: total });

    await new Promise<void>((resolve) => setTimeout(resolve, total));
  }

  /**
   * Generate a realistic human-like trading timing profile.
   * Incorporates session start delays, distraction pauses, burst
   * trading patterns, and time-of-day weighting.
   */
  generateHumanTiming(): TradeTimingProfile {
    const [_jitterMin, _jitterMax] = this.config.timingJitterRange;
    void _jitterMin; void _jitterMax;

    // Humans take 2-15 seconds to "open the app and look around"
    const sessionStartDelay = secureRandomInt(2_000, 15_000);

    // Base interval: 8-45 seconds between trades (humans aren't instant)
    const baseInterval = secureRandomInt(8_000, 45_000);

    // Jitter is 20-60% of base interval
    const intervalJitter = Math.round(
      baseInterval * (0.2 + secureRandom() * 0.4),
    );

    // 10-25% chance of a "got distracted" pause
    const longPauseProbability = 0.1 + secureRandom() * 0.15;

    // Long pauses: 30s to 5 minutes
    const longPauseMin = secureRandomInt(30_000, 60_000);
    const longPauseMax = secureRandomInt(
      Math.max(longPauseMin + 10_000, 120_000),
      300_000,
    );

    // 5-15% chance of burst trading ("found alpha!")
    const burstProbability = 0.05 + secureRandom() * 0.1;

    // Burst: 3-8 rapid trades
    const burstCountMin = secureRandomInt(3, 4);
    const burstCountMax = secureRandomInt(
      Math.max(burstCountMin + 1, 5),
      8,
    );

    // Burst interval: 2-8 seconds (fast but not inhuman)
    const burstIntervalMin = secureRandomInt(2_000, 4_000);
    const burstIntervalMax = secureRandomInt(
      Math.max(burstIntervalMin + 500, 5_000),
      8_000,
    );

    const profile: TradeTimingProfile = {
      sessionStartDelay,
      baseInterval,
      intervalJitter,
      longPauseProbability,
      longPauseRange: [longPauseMin, longPauseMax],
      hourlyActivityWeights: [...DEFAULT_HOURLY_WEIGHTS],
      burstProbability,
      burstTradeCount: [burstCountMin, burstCountMax],
      burstInterval: [burstIntervalMin, burstIntervalMax],
    };

    this.logger.info('Generated human timing profile', {
      sessionStartDelay,
      baseInterval,
      intervalJitter,
      longPauseProbability: longPauseProbability.toFixed(3),
      burstProbability: burstProbability.toFixed(3),
    });

    this.eventBus.emit(
      'anti-detection:timing-generated',
      'coordination' as SwarmEventCategory,
      'anti-detection',
      { profile },
    );

    return profile;
  }

  /**
   * Decide whether to skip a trade based on recent activity patterns.
   * Returns true if trading now would create a detectable pattern.
   */
  shouldSkipTrade(recentTrades: TradeHistoryEntry[]): boolean {
    if (recentTrades.length === 0) return false;

    const now = Date.now();
    const oneHourAgo = now - 3_600_000;

    // Check trades in last hour
    const recentHour = recentTrades.filter((t) => t.timestamp > oneHourAgo);

    // Skip if too many trades in the last hour
    if (recentHour.length >= this.config.maxTradesPerWalletPerHour * 2) {
      this.logger.warn('Skipping trade: too many recent trades', {
        tradesInHour: recentHour.length,
        limit: this.config.maxTradesPerWalletPerHour * 2,
      });
      return true;
    }

    // Check for suspicious regularity in intervals
    if (recentHour.length >= 4) {
      const intervals: number[] = [];
      const sorted = [...recentHour].sort((a, b) => a.timestamp - b.timestamp);
      for (let i = 1; i < sorted.length; i++) {
        intervals.push(sorted[i]!.timestamp - sorted[i - 1]!.timestamp);
      }
      const avgInterval =
        intervals.reduce((s, v) => s + v, 0) / intervals.length;
      const variance =
        intervals.reduce((s, v) => s + (v - avgInterval) ** 2, 0) /
        intervals.length;
      const coeffOfVariation = Math.sqrt(variance) / avgInterval;

      // If intervals are too regular (CV < 0.15), skip to break the pattern
      if (coeffOfVariation < 0.15) {
        this.logger.warn('Skipping trade: intervals too regular', {
          coeffOfVariation: coeffOfVariation.toFixed(4),
          avgInterval: Math.round(avgInterval),
        });
        return true;
      }
    }

    // Time-of-day check: reduce probability during dead hours
    if (this.config.humanPatternEmulation) {
      const hour = new Date().getUTCHours();
      const weight = DEFAULT_HOURLY_WEIGHTS[hour] ?? 0.5;
      if (secureRandom() > weight) {
        this.logger.debug('Skipping trade: low activity hour', {
          hour,
          weight,
        });
        return true;
      }
    }

    return false;
  }

  /**
   * Calculate the recommended delay before the next trade, factoring
   * in strategy, recent history, and human-like patterns.
   *
   * @param strategy - Trading strategy identifier
   * @param recentTrades - Recent trade history for this wallet
   * @returns Delay in milliseconds
   */
  getNextTradeDelay(
    strategy: string,
    recentTrades: TradeHistoryEntry[],
  ): number {
    const [jitterMin, jitterMax] = this.config.timingJitterRange;
    const baseJitter = secureRandomInt(jitterMin, jitterMax);

    // Strategy multipliers
    const strategyMultipliers: Record<string, number> = {
      aggressive: 0.5,
      moderate: 1.0,
      conservative: 2.0,
      accumulate: 1.5,
      distribute: 0.8,
      market_make: 0.6,
    };
    const multiplier = strategyMultipliers[strategy] ?? 1.0;

    let delay = Math.round(baseJitter * multiplier);

    // If there are recent trades, increase delay based on how active we've been
    if (recentTrades.length > 0) {
      const oneHourAgo = Date.now() - 3_600_000;
      const recentCount = recentTrades.filter(
        (t) => t.timestamp > oneHourAgo,
      ).length;

      // Exponential backoff as trade count approaches the limit
      const loadFactor =
        recentCount / this.config.maxTradesPerWalletPerHour;
      if (loadFactor > 0.5) {
        const backoffMultiplier = 1 + (loadFactor - 0.5) * 4; // 1x at 50%, 3x at 100%
        delay = Math.round(delay * backoffMultiplier);
      }
    }

    // Human pattern: occasional long pause
    if (this.config.humanPatternEmulation && secureRandom() < 0.12) {
      const longPause = secureRandomInt(30_000, 180_000);
      delay += longPause;
      this.logger.debug('Adding long pause to trade delay', {
        longPause,
        totalDelay: delay,
      });
    }

    // Time-of-day adjustment
    if (this.config.humanPatternEmulation) {
      const hour = new Date().getUTCHours();
      const weight = DEFAULT_HOURLY_WEIGHTS[hour] ?? 0.5;
      // Invert weight: low-activity hours → longer delays
      if (weight < 1.0) {
        const timeMultiplier = 1 + (1 - weight) * 2;
        delay = Math.round(delay * timeMultiplier);
      }
    }

    this.logger.debug('Calculated next trade delay', {
      strategy,
      baseJitter,
      multiplier,
      finalDelay: delay,
    });

    return delay;
  }

  // ─── Wallet Behavior Profiling ──────────────────────────────

  /**
   * Record a trade for a wallet to track its activity pattern.
   */
  recordTrade(entry: TradeHistoryEntry): void {
    const record = this.getOrCreateWalletRecord(entry.walletAddress);
    const now = Date.now();
    const oneHourAgo = now - 3_600_000;
    const oneDayAgo = now - 86_400_000;

    record.lastTradeTimestamp = entry.timestamp;

    // Update directional counts
    if (entry.direction === 'buy') {
      record.totalBuys++;
    } else {
      record.totalSells++;
    }

    // Maintain rolling windows
    record.tradesLastHour = [
      ...record.tradesLastHour.filter((t) => t.timestamp > oneHourAgo),
      entry,
    ];
    record.tradesLast24h = [
      ...record.tradesLast24h.filter((t) => t.timestamp > oneDayAgo),
      entry,
    ];

    // Track consecutive uses
    const lastUsed =
      this.lastUsedWalletAddresses[
        this.lastUsedWalletAddresses.length - 1
      ];
    if (lastUsed === entry.walletAddress) {
      record.consecutiveUses++;
    } else {
      record.consecutiveUses = 1;
    }
    this.lastUsedWalletAddresses.push(entry.walletAddress);
    // Keep only last 50 entries
    if (this.lastUsedWalletAddresses.length > 50) {
      this.lastUsedWalletAddresses = this.lastUsedWalletAddresses.slice(-50);
    }

    this.walletActivity.set(entry.walletAddress, record);
  }

  /**
   * Plan wallet usage order to maximize organic appearance.
   * Enforces cooldowns, prevents consecutive reuse, and assigns
   * behavioral roles (holder, flipper, etc.).
   */
  obfuscateWalletPattern(wallets: AgentWallet[]): WalletRotationPlan {
    const now = Date.now();
    const sequence: WalletRotationPlan['sequence'] = [];
    const cooldownWallets: string[] = [];

    for (const wallet of wallets) {
      const record = this.getOrCreateWalletRecord(wallet.address);

      // Check if wallet needs cooldown
      const hourlyCount = record.tradesLastHour.length;
      const dailyCount = record.tradesLast24h.length;
      let cooldownUntil = 0;
      let tradesRemaining =
        this.config.maxTradesPerWalletPerHour - hourlyCount;

      if (hourlyCount >= this.config.maxTradesPerWalletPerHour) {
        // Cooldown until oldest trade in window expires + jitter
        const oldestInHour = record.tradesLastHour[0];
        cooldownUntil = oldestInHour
          ? oldestInHour.timestamp + 3_600_000 + secureRandomInt(5_000, 60_000)
          : now + 3_600_000;
        tradesRemaining = 0;
        cooldownWallets.push(wallet.address);
      } else if (dailyCount >= this.config.maxTradesPerWalletPerDay) {
        const oldestInDay = record.tradesLast24h[0];
        cooldownUntil = oldestInDay
          ? oldestInDay.timestamp +
            86_400_000 +
            secureRandomInt(60_000, 600_000)
          : now + 86_400_000;
        tradesRemaining = 0;
        cooldownWallets.push(wallet.address);
      }

      // Enforce minimum rotation: skip if used too recently
      if (
        record.consecutiveUses >= 3 ||
        this.wasRecentlyUsed(wallet.address)
      ) {
        cooldownUntil = Math.max(
          cooldownUntil,
          now + secureRandomInt(10_000, 30_000),
        );
        if (!cooldownWallets.includes(wallet.address)) {
          cooldownWallets.push(wallet.address);
        }
      }

      sequence.push({
        wallet,
        role: record.assignedRole,
        cooldownUntil,
        tradesRemaining: Math.max(0, tradesRemaining),
      });
    }

    // Sort: available wallets first, then by least recently used
    sequence.sort((a, b) => {
      const aAvail = a.cooldownUntil <= now ? 0 : 1;
      const bAvail = b.cooldownUntil <= now ? 0 : 1;
      if (aAvail !== bAvail) return aAvail - bAvail;

      const aRecord = this.walletActivity.get(a.wallet.address);
      const bRecord = this.walletActivity.get(b.wallet.address);
      return (
        (aRecord?.lastTradeTimestamp ?? 0) -
        (bRecord?.lastTradeTimestamp ?? 0)
      );
    });

    // Find first available wallet
    const nextIndex = sequence.findIndex(
      (s) => s.cooldownUntil <= now && s.tradesRemaining > 0,
    );

    const fullAvailabilityAt =
      cooldownWallets.length > 0
        ? Math.max(...sequence.map((s) => s.cooldownUntil))
        : now;

    const plan: WalletRotationPlan = {
      sequence,
      cooldownWallets,
      nextWalletIndex: Math.max(0, nextIndex),
      fullAvailabilityAt,
    };

    this.logger.info('Wallet rotation plan generated', {
      totalWallets: wallets.length,
      availableNow: sequence.filter(
        (s) => s.cooldownUntil <= now && s.tradesRemaining > 0,
      ).length,
      onCooldown: cooldownWallets.length,
      nextWalletIndex: plan.nextWalletIndex,
    });

    this.eventBus.emit(
      'anti-detection:wallet-rotation',
      'coordination' as SwarmEventCategory,
      'anti-detection',
      {
        availableWallets: sequence.filter((s) => s.cooldownUntil <= now).length,
        cooldownWallets: cooldownWallets.length,
      },
    );

    return plan;
  }

  // ─── Pattern Detection Self-Audit ───────────────────────────

  /**
   * Analyze recent on-chain activity and score how bot-like it appears.
   * Returns a 0-100 risk score with per-factor breakdown and recommendations.
   */
  scoreDetectionRisk(recentActivity: OnChainActivity[]): DetectionRiskScore {
    if (recentActivity.length < 2) {
      return {
        overall: 0,
        factors: {
          timingRegularity: 0,
          amountPatterns: 0,
          walletConcentration: 0,
          directionBias: 0,
          volumeSpikes: 0,
          sameBlockClustering: 0,
        },
        recommendations: [],
      };
    }

    const factors = {
      timingRegularity: this.scoreTimingRegularity(recentActivity),
      amountPatterns: this.scoreAmountPatterns(recentActivity),
      walletConcentration: this.scoreWalletConcentration(recentActivity),
      directionBias: this.scoreDirectionBias(recentActivity),
      volumeSpikes: this.scoreVolumeSpikes(recentActivity),
      sameBlockClustering: this.scoreSameBlockClustering(recentActivity),
    };

    // Weighted average
    const weights = {
      timingRegularity: 0.25,
      amountPatterns: 0.20,
      walletConcentration: 0.15,
      directionBias: 0.12,
      volumeSpikes: 0.13,
      sameBlockClustering: 0.15,
    };

    const overall = Math.round(
      Object.entries(factors).reduce(
        (sum, [key, value]) =>
          sum + value * (weights[key as keyof typeof weights] ?? 0),
        0,
      ),
    );

    const recommendations = this.generateRecommendations(factors);

    const score: DetectionRiskScore = { overall, factors, recommendations };

    this.logger.info('Detection risk scored', {
      overall: score.overall,
      factors,
      recommendationCount: recommendations.length,
    });

    this.eventBus.emit(
      'anti-detection:risk-scored',
      'analytics' as SwarmEventCategory,
      'anti-detection',
      { score },
    );

    return score;
  }

  /**
   * Validate a planned trade sequence for detectable patterns
   * before execution, allowing preemptive correction.
   */
  validateTradeSequence(trades: TradeOrder[]): TradeSequenceValidation {
    const issues: TradeSequenceValidation['issues'] = [];
    const suggestions: string[] = [];

    if (trades.length === 0) {
      return { valid: true, riskScore: 0, issues: [], suggestions: [] };
    }

    // Check 1: Are amounts suspiciously similar?
    const amounts = trades.map((t) => Number(t.amount.toString()));
    const avgAmount = amounts.reduce((s, v) => s + v, 0) / amounts.length;
    const amountCV =
      avgAmount > 0
        ? Math.sqrt(
            amounts.reduce((s, v) => s + (v - avgAmount) ** 2, 0) /
              amounts.length,
          ) / avgAmount
        : 0;

    if (amountCV < 0.05 && trades.length >= 3) {
      issues.push({
        severity: 'high',
        description:
          'Trade amounts are nearly identical — extremely bot-like',
        tradeIndices: trades.map((_, i) => i),
      });
      suggestions.push(
        'Apply randomizeAmount() to each trade with variance >= 10%',
      );
    } else if (amountCV < 0.15 && trades.length >= 3) {
      issues.push({
        severity: 'medium',
        description: 'Trade amounts have low variance — somewhat suspicious',
        tradeIndices: trades.map((_, i) => i),
      });
      suggestions.push(
        'Increase amount variance to at least 15% for more organic appearance',
      );
    }

    // Check 2: Are all trades the same direction?
    const buyCount = trades.filter((t) => t.direction === 'buy').length;
    const sellCount = trades.length - buyCount;
    const directionRatio =
      trades.length > 0
        ? Math.abs(buyCount - sellCount) / trades.length
        : 0;

    if (directionRatio > 0.8 && trades.length >= 4) {
      issues.push({
        severity: 'high',
        description: `Sequence is ${directionRatio * 100}% one-directional (${buyCount} buys, ${sellCount} sells)`,
        tradeIndices: trades.map((_, i) => i),
      });
      suggestions.push(
        'Mix in counter-directional trades to appear more organic',
      );
    }

    // Check 3: Are all trades from the same wallet?
    const walletSet = new Set(trades.map((t) => t.traderId));
    if (walletSet.size === 1 && trades.length >= 3) {
      issues.push({
        severity: 'medium',
        description:
          'All trades use the same wallet — consider rotating wallets',
        tradeIndices: trades.map((_, i) => i),
      });
      suggestions.push(
        `Distribute trades across at least ${this.config.minWalletRotation} wallets`,
      );
    }

    // Check 4: Round number amounts
    if (this.config.avoidRoundNumbers) {
      const roundIndices: number[] = [];
      for (let i = 0; i < amounts.length; i++) {
        const solValue = amounts[i]! / Number(LAMPORTS_PER_SOL);
        if (isRoundSolValue(solValue) || isRoundTokenAmount(amounts[i]!)) {
          roundIndices.push(i);
        }
      }
      if (roundIndices.length > 0) {
        issues.push({
          severity: 'medium',
          description: `${roundIndices.length} trade(s) use round numbers`,
          tradeIndices: roundIndices,
        });
        suggestions.push('Apply randomizeAmount() to eliminate round values');
      }
    }

    // Check 5: Same-mint concentration
    const mintCounts = new Map<string, number>();
    for (const trade of trades) {
      mintCounts.set(trade.mint, (mintCounts.get(trade.mint) ?? 0) + 1);
    }
    for (const [mint, count] of mintCounts) {
      if (count >= 5 && count / trades.length > 0.8) {
        issues.push({
          severity: 'low',
          description: `${count} trades target the same mint (${mint.slice(0, 8)}…)`,
          tradeIndices: trades
            .map((t, i) => (t.mint === mint ? i : -1))
            .filter((i) => i >= 0),
        });
      }
    }

    // Calculate overall risk score
    const severityWeights = { low: 10, medium: 25, high: 45 };
    const riskScore = Math.min(
      100,
      issues.reduce(
        (sum, issue) => sum + severityWeights[issue.severity],
        0,
      ),
    );

    const validation: TradeSequenceValidation = {
      valid: riskScore < 50,
      riskScore,
      issues,
      suggestions,
    };

    this.logger.info('Trade sequence validated', {
      tradeCount: trades.length,
      valid: validation.valid,
      riskScore: validation.riskScore,
      issueCount: issues.length,
    });

    return validation;
  }

  // ─── Noise Transactions ─────────────────────────────────────

  /**
   * Generate a noise transaction configuration to break up patterns.
   * Returns an innocuous transaction type (wrap/unwrap SOL, self-transfer,
   * or balance check) with randomized parameters.
   */
  generateNoiseTransaction(): NoiseTransactionConfig {
    const types: NoiseTransactionType[] = [
      'wrap_sol',
      'unwrap_sol',
      'self_transfer',
      'balance_check',
    ];

    // Weighted selection: wraps and transfers are more natural
    const weights = [0.3, 0.25, 0.35, 0.1];
    const roll = secureRandom();
    let cumulative = 0;
    let selectedType: NoiseTransactionType = 'self_transfer';
    for (let i = 0; i < types.length; i++) {
      cumulative += weights[i]!;
      if (roll <= cumulative) {
        selectedType = types[i]!;
        break;
      }
    }

    // Small, irregular amounts for noise
    const baseNoiseLamports =
      BigInt(secureRandomInt(1_000, 50_000)) * 1_000n; // 0.001 - 0.05 SOL
    const noiseLamports = this.randomizeAmount(baseNoiseLamports, 20);

    // Random delay before noise (1-10 seconds)
    const delayBefore = secureRandomInt(1_000, 10_000);

    // Pick a random wallet from recently active ones
    const activeWallets = [...this.walletActivity.keys()];
    const walletAddress =
      activeWallets.length > 0
        ? activeWallets[secureRandomInt(0, activeWallets.length - 1)]!
        : 'unknown';

    const descriptions: Record<NoiseTransactionType, string> = {
      wrap_sol: 'Wrap SOL to wSOL (natural DeFi activity)',
      unwrap_sol: 'Unwrap wSOL to SOL (cleanup activity)',
      self_transfer: 'Transfer small SOL between own wallets',
      balance_check: 'No-op balance check transaction',
    };

    const config: NoiseTransactionConfig = {
      type: selectedType,
      wallet: walletAddress,
      amountLamports: noiseLamports,
      delayBeforeMs: delayBefore,
      description: descriptions[selectedType],
    };

    this.logger.debug('Generated noise transaction', {
      type: selectedType,
      amountLamports: noiseLamports.toString(),
      delayMs: delayBefore,
    });

    return config;
  }

  /**
   * Determine whether a noise transaction should be inserted at this point.
   */
  shouldInsertNoise(): boolean {
    if (!this.config.enableNoiseTransactions) return false;
    return secureRandom() < this.config.noiseProbability;
  }

  // ─── Wallet Role Assignment ─────────────────────────────────

  /**
   * Assign behavioral roles to wallets for organic-looking behavior.
   * - holders: buy once, hold indefinitely (~30% of wallets)
   * - flippers: buy, hold briefly, sell (~25% of wallets)
   * - buyer: primarily buy, occasional sell (~25% of wallets)
   * - seller: primarily sell, occasional buy (~20% of wallets)
   */
  assignWalletRoles(wallets: AgentWallet[]): void {
    const roles: Array<WalletActivityRecord['assignedRole']> = [];

    // Pre-compute role distribution
    const holderCount = Math.max(1, Math.round(wallets.length * 0.3));
    const flipperCount = Math.max(1, Math.round(wallets.length * 0.25));
    const buyerCount = Math.max(1, Math.round(wallets.length * 0.25));

    for (let i = 0; i < wallets.length; i++) {
      if (i < holderCount) roles.push('holder');
      else if (i < holderCount + flipperCount) roles.push('flipper');
      else if (i < holderCount + flipperCount + buyerCount) roles.push('buyer');
      else roles.push('seller');
    }

    // Shuffle roles securely
    for (let i = roles.length - 1; i > 0; i--) {
      const j = secureRandomInt(0, i);
      [roles[i], roles[j]] = [roles[j]!, roles[i]!];
    }

    for (let i = 0; i < wallets.length; i++) {
      const wallet = wallets[i]!;
      const record = this.getOrCreateWalletRecord(wallet.address);
      record.assignedRole = roles[i]!;
      this.walletActivity.set(wallet.address, record);
    }

    const roleCounts = {
      holder: roles.filter((r) => r === 'holder').length,
      flipper: roles.filter((r) => r === 'flipper').length,
      buyer: roles.filter((r) => r === 'buyer').length,
      seller: roles.filter((r) => r === 'seller').length,
    };

    this.logger.info('Wallet roles assigned', {
      totalWallets: wallets.length,
      ...roleCounts,
    });

    this.eventBus.emit(
      'anti-detection:roles-assigned',
      'coordination' as SwarmEventCategory,
      'anti-detection',
      { roleCounts },
    );
  }

  /**
   * Get the assigned role for a wallet address.
   */
  getWalletRole(
    address: string,
  ): WalletActivityRecord['assignedRole'] | undefined {
    return this.walletActivity.get(address)?.assignedRole;
  }

  // ─── Private Scoring Methods ────────────────────────────────

  /**
   * Score how regular the intervals between activities are.
   * Perfectly regular = 100 (extremely bot-like), high variance = 0.
   */
  private scoreTimingRegularity(activities: OnChainActivity[]): number {
    if (activities.length < 3) return 0;

    const sorted = [...activities].sort((a, b) => a.timestamp - b.timestamp);
    const intervals: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      intervals.push(sorted[i]!.timestamp - sorted[i - 1]!.timestamp);
    }

    if (intervals.length < 2) return 0;

    const avg = intervals.reduce((s, v) => s + v, 0) / intervals.length;
    if (avg === 0) return 100; // All at same time — extremely suspicious

    const variance =
      intervals.reduce((s, v) => s + (v - avg) ** 2, 0) / intervals.length;
    const cv = Math.sqrt(variance) / avg;

    // CV → score: low CV = high regularity = high score
    // CV < 0.1 → very regular (90-100)
    // CV 0.1-0.3 → somewhat regular (40-90)
    // CV > 0.5 → irregular (0-30)
    if (cv < 0.05) return 100;
    if (cv < 0.1) return 90;
    if (cv < 0.2) return 70;
    if (cv < 0.3) return 50;
    if (cv < 0.5) return 30;
    if (cv < 0.8) return 15;
    return 5;
  }

  /**
   * Score how repetitive the amounts are.
   * Same exact amounts = 100, irregular amounts = 0.
   */
  private scoreAmountPatterns(activities: OnChainActivity[]): number {
    if (activities.length < 3) return 0;

    const amounts = activities.map((a) => Number(a.amountLamports));
    const avg = amounts.reduce((s, v) => s + v, 0) / amounts.length;
    if (avg === 0) return 0;

    const cv =
      Math.sqrt(
        amounts.reduce((s, v) => s + (v - avg) ** 2, 0) / amounts.length,
      ) / avg;

    // Check for round numbers
    const roundCount = amounts.filter((a) => {
      const sol = a / Number(LAMPORTS_PER_SOL);
      return isRoundSolValue(sol) || isRoundTokenAmount(a);
    }).length;
    const roundPenalty = (roundCount / amounts.length) * 40;

    // Check for exact duplicates
    const uniqueAmounts = new Set(amounts.map((a) => a.toString()));
    const duplicateRatio = 1 - uniqueAmounts.size / amounts.length;
    const duplicatePenalty = duplicateRatio * 50;

    // CV → base score (inverted: low variance = high score)
    let baseScore: number;
    if (cv < 0.05) baseScore = 80;
    else if (cv < 0.1) baseScore = 60;
    else if (cv < 0.2) baseScore = 35;
    else if (cv < 0.3) baseScore = 20;
    else baseScore = 5;

    return Math.min(100, Math.round(baseScore + roundPenalty + duplicatePenalty));
  }

  /**
   * Score how concentrated activity is among wallets.
   * One wallet doing everything = 100, evenly spread = 0.
   */
  private scoreWalletConcentration(activities: OnChainActivity[]): number {
    if (activities.length < 2) return 0;

    const walletCounts = new Map<string, number>();
    for (const a of activities) {
      walletCounts.set(
        a.walletAddress,
        (walletCounts.get(a.walletAddress) ?? 0) + 1,
      );
    }

    const walletCount = walletCounts.size;
    if (walletCount <= 1) return 100; // Single wallet — very suspicious

    // Herfindahl-Hirschman Index (HHI)
    const shares = [...walletCounts.values()].map(
      (c) => c / activities.length,
    );
    const hhi = shares.reduce((s, share) => s + share * share, 0);

    // HHI ranges: 1/n (perfectly even) to 1.0 (single wallet)
    // Normalize to 0-100
    const minHhi = 1 / walletCount;
    const normalizedHhi =
      minHhi < 1 ? (hhi - minHhi) / (1 - minHhi) : 1;

    return Math.round(normalizedHhi * 100);
  }

  /**
   * Score how one-sided the buy/sell direction is.
   * All buys or all sells = 100, balanced = 0.
   */
  private scoreDirectionBias(activities: OnChainActivity[]): number {
    const tradingActivities = activities.filter(
      (a) => a.type === 'buy' || a.type === 'sell',
    );
    if (tradingActivities.length < 2) return 0;

    const buyCount = tradingActivities.filter((a) => a.type === 'buy').length;
    const total = tradingActivities.length;
    const buyRatio = buyCount / total;

    // 0.5 = perfectly balanced (score 0), 0 or 1 = fully biased (score 100)
    const bias = Math.abs(buyRatio - 0.5) * 2; // 0 to 1
    return Math.round(bias * 100);
  }

  /**
   * Score how sudden volume changes are (spike detection).
   * Sudden 10x volume increase = suspicious.
   */
  private scoreVolumeSpikes(activities: OnChainActivity[]): number {
    if (activities.length < 5) return 0;

    const sorted = [...activities].sort((a, b) => a.timestamp - b.timestamp);

    // Look at 5-trade rolling windows
    const windowSize = 5;
    const windowVolumes: number[] = [];

    for (let i = 0; i <= sorted.length - windowSize; i++) {
      const windowVol = sorted
        .slice(i, i + windowSize)
        .reduce((s, a) => s + Number(a.amountLamports), 0);
      windowVolumes.push(windowVol);
    }

    if (windowVolumes.length < 2) return 0;

    // Find max ratio between consecutive windows
    let maxRatio = 1;
    for (let i = 1; i < windowVolumes.length; i++) {
      const prev = windowVolumes[i - 1]!;
      const curr = windowVolumes[i]!;
      if (prev > 0) {
        maxRatio = Math.max(maxRatio, curr / prev, prev / curr);
      }
    }

    // maxRatio → score: 1x = 0, 3x = 40, 5x = 70, 10x+ = 100
    if (maxRatio < 1.5) return 0;
    if (maxRatio < 2) return 15;
    if (maxRatio < 3) return 35;
    if (maxRatio < 5) return 60;
    if (maxRatio < 10) return 80;
    return 100;
  }

  /**
   * Score how many activities occur in the same block/slot.
   * Multiple transactions in the same slot = suspicious coordination.
   */
  private scoreSameBlockClustering(activities: OnChainActivity[]): number {
    if (activities.length < 2) return 0;

    const slotCounts = new Map<number, number>();
    for (const a of activities) {
      slotCounts.set(a.slot, (slotCounts.get(a.slot) ?? 0) + 1);
    }

    // Count activities that share a slot with at least one other
    let clusteredCount = 0;
    for (const count of slotCounts.values()) {
      if (count > 1) clusteredCount += count;
    }

    const clusterRatio = clusteredCount / activities.length;

    // > 50% clustered = very suspicious
    return Math.round(clusterRatio * 100);
  }

  /**
   * Generate actionable recommendations from risk factor scores.
   */
  private generateRecommendations(
    factors: DetectionRiskScore['factors'],
  ): string[] {
    const recommendations: string[] = [];

    if (factors.timingRegularity > 60) {
      recommendations.push(
        'Add more timing jitter between trades — current intervals are too regular. ' +
          'Use generateHumanTiming() for realistic delays.',
      );
    }

    if (factors.amountPatterns > 50) {
      recommendations.push(
        'Randomize trade amounts more aggressively — amounts are too similar or too round. ' +
          'Use randomizeAmount() with variance >= 15%.',
      );
    }

    if (factors.walletConcentration > 40) {
      recommendations.push(
        'Distribute trades across more wallets — activity is too concentrated. ' +
          `Rotate through at least ${this.config.minWalletRotation} wallets.`,
      );
    }

    if (factors.directionBias > 70) {
      recommendations.push(
        'Balance buy/sell ratio — trading is too one-directional. ' +
          'Mix in counter-trades to appear like natural market activity.',
      );
    }

    if (factors.volumeSpikes > 50) {
      recommendations.push(
        'Smooth out volume transitions — sudden volume changes are detectable. ' +
          'Ramp up/down gradually over multiple intervals.',
      );
    }

    if (factors.sameBlockClustering > 30) {
      recommendations.push(
        'Stagger transactions across different slots — too many landing in the same block. ' +
          'Add at least 1-2 slot gaps between agent transactions.',
      );
    }

    return recommendations;
  }

  // ─── Private Helpers ────────────────────────────────────────

  private getOrCreateWalletRecord(address: string): WalletActivityRecord {
    const existing = this.walletActivity.get(address);
    if (existing) return existing;

    const record: WalletActivityRecord = {
      address,
      tradesLastHour: [],
      tradesLast24h: [],
      lastTradeTimestamp: 0,
      consecutiveUses: 0,
      totalBuys: 0,
      totalSells: 0,
      assignedRole: 'buyer', // default, overridden by assignWalletRoles()
    };
    this.walletActivity.set(address, record);
    return record;
  }

  /**
   * Check if a wallet was used within the last `minWalletRotation` trades.
   */
  private wasRecentlyUsed(address: string): boolean {
    const recent = this.lastUsedWalletAddresses.slice(
      -this.config.minWalletRotation,
    );
    return recent.includes(address);
  }
}

// ─── Factory / Defaults ───────────────────────────────────────

/**
 * Create a default AntiDetectionConfig suitable for most swarm operations.
 */
export function createDefaultAntiDetectionConfig(
  overrides?: Partial<AntiDetectionConfig>,
): AntiDetectionConfig {
  return {
    minAmountVariance: 5,
    maxAmountVariance: 20,
    timingJitterRange: [3_000, 15_000],
    maxTradesPerWalletPerHour: 8,
    maxTradesPerWalletPerDay: 40,
    enableNoiseTransactions: true,
    noiseProbability: 0.15,
    minWalletRotation: 3,
    avoidRoundNumbers: true,
    humanPatternEmulation: true,
    ...overrides,
  };
}
