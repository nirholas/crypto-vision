/**
 * Bundle Analytics — Post-Execution Performance Analysis
 *
 * Analyzes completed bundle launches for:
 * - Timing precision (same-slot co-location)
 * - Cost efficiency (slippage, fees, Jito tips)
 * - Supply distribution (Gini, Herfindahl, target vs actual)
 * - Bonding curve impact (price movement, graduation distance)
 * - Historical baseline comparison
 * - Formatted markdown reporting
 *
 * All data is fetched from on-chain sources via RPC — no mocks.
 */

import {
  Connection,
  PublicKey,
} from '@solana/web3.js';
import { getAccount, getAssociatedTokenAddress } from '@solana/spl-token';
import BN from 'bn.js';

import type { BondingCurveState, MintResult, BundleParticipant } from '../types.js';
import { SwarmEventBus } from '../infra/event-bus.js';
import { SwarmLogger } from '../infra/logger.js';

// ─── Constants ────────────────────────────────────────────────

/** Lamports per SOL */
const LAMPORTS_PER_SOL = 1_000_000_000;

/** Token decimals on Pump.fun */
const TOKEN_DECIMALS = 6;

/** Raw units per token (10^6) */
const ONE_TOKEN_RAW = 10 ** TOKEN_DECIMALS;

/** Total Pump.fun token supply: 1 billion tokens in raw units */
const TOTAL_SUPPLY_RAW = 1_000_000_000 * ONE_TOKEN_RAW;

/** Graduation threshold: ~85 SOL in real reserves */
const GRADUATION_THRESHOLD_SOL = 85;

/** Baseline rolling window size */
const BASELINE_WINDOW_SIZE = 20;

/** Weight allocation for overall score */
const WEIGHT_TIMING = 0.25;
const WEIGHT_COST = 0.35;
const WEIGHT_SUPPLY = 0.40;

// ─── Types ────────────────────────────────────────────────────

/**
 * Result of a full launch sequence. Defined here because
 * launch-sequencer.ts doesn't exist yet — this acts as the
 * adapter contract.
 */
export interface LaunchResult {
  /** Unique launch identifier */
  launchId: string;
  /** Mint result from token creation */
  mintResult: MintResult;
  /** Bundle participants and their outcomes */
  participants: BundleParticipant[];
  /** All transaction signatures (creation + buys) */
  signatures: string[];
  /** Total SOL spent across all participants (lamports) */
  totalSolSpent: BN;
  /** Total tokens acquired across all participants */
  totalTokensAcquired: BN;
  /** Bonding curve state before bundle buys */
  curveStateBefore: BondingCurveState;
  /** Bonding curve state after bundle buys */
  curveStateAfter: BondingCurveState;
  /** Jito tip in lamports (0 if not using Jito) */
  jitoTipLamports: number;
  /** Total transaction fees in lamports */
  totalFeesLamports: number;
  /** Target supply distribution per wallet (address → fraction 0–1) */
  targetDistribution: Map<string, number>;
  /** Whether the launch succeeded */
  success: boolean;
  /** Timestamp */
  completedAt: number;
}

export interface TimingAnalysis {
  /** Did all bundle TXs land in same slot? */
  sameSlot: boolean;
  /** Slots spanned by all TXs */
  slotSpan: number;
  /** Slot numbers for each TX */
  slots: Array<{ signature: string; slot: number; blockTime: number }>;
  /** Time between first and last TX confirmation */
  totalSpreadMs: number;
  /** Time from token creation to first bundle buy */
  creationToBundleMs: number;
  /** Average confirmation time */
  avgConfirmationMs: number;
  /** Score: 100 = all same slot, lower = more spread */
  timingScore: number;
}

export interface CostAnalysis {
  totalSOLSpent: number;
  totalTokensAcquired: bigint;
  averagePricePerToken: number;
  priceImpactPercent: number;
  feesAsPercentOfTotal: number;
  jitoTipAsPercentOfTotal: number;
  efficiency: number;
  wastedSOL: number;
  costScore: number;
}

export interface SupplyAnalysis {
  targetDistribution: Map<string, number>;
  actualDistribution: Map<string, number>;
  totalSupplyControlled: number;
  distributionError: number;
  largestWalletPercent: number;
  smallestWalletPercent: number;
  giniCoefficient: number;
  herfindahlIndex: number;
  supplyScore: number;
}

export interface CurveImpactAnalysis {
  preBuyPrice: number;
  postBuyPrice: number;
  priceChangePercent: number;
  preVirtualSolReserves: bigint;
  postVirtualSolReserves: bigint;
  preVirtualTokenReserves: bigint;
  postVirtualTokenReserves: bigint;
  tokensPurchasedFromCurve: bigint;
  percentOfCurveDrained: number;
  distanceToGraduation: number;
}

export interface LaunchAnalysis {
  launchId: string;
  analyzedAt: number;
  timing: TimingAnalysis;
  cost: CostAnalysis;
  supply: SupplyAnalysis;
  curveImpact: CurveImpactAnalysis;
  overallScore: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  insights: string[];
  recommendations: string[];
}

export interface LaunchReport {
  launchId: string;
  generatedAt: string;
  summary: string;
  analysis: LaunchAnalysis;
  timeline: Array<{
    timestamp: number;
    event: string;
    details: string;
    signature?: string;
  }>;
  formattedReport: string;
}

export interface BaselineComparison {
  timingVsBaseline: 'better' | 'same' | 'worse';
  costVsBaseline: 'better' | 'same' | 'worse';
  supplyVsBaseline: 'better' | 'same' | 'worse';
  overallVsBaseline: 'better' | 'same' | 'worse';
  percentileRank: number;
}

// ─── Helpers ──────────────────────────────────────────────────

/**
 * Compute the Gini coefficient for an array of numeric values.
 * 0 = perfect equality, 1 = maximum inequality.
 */
function calculateGini(values: number[]): number {
  const n = values.length;
  if (n === 0) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, v) => acc + v, 0);
  if (sum === 0) return 0;

  let numerator = 0;
  for (let i = 0; i < n; i++) {
    numerator += (2 * (i + 1) - n - 1) * sorted[i];
  }

  return numerator / (n * sum);
}

/**
 * Compute the Herfindahl–Hirschman Index (HHI) from market-share
 * fractions. Each share should be in 0–1 range.
 * HHI ranges from 1/n (perfect equality) to 1 (monopoly).
 */
function calculateHerfindahl(shares: number[]): number {
  if (shares.length === 0) return 0;
  return shares.reduce((acc, s) => acc + s * s, 0);
}

/**
 * Convert a BN (lamports) to a human-readable SOL number.
 */
function lamportsToSol(lamports: BN): number {
  return lamports.toNumber() / LAMPORTS_PER_SOL;
}

/**
 * Convert a BN (raw token units) to a human-readable token count.
 */
function rawToTokens(raw: BN): number {
  return raw.toNumber() / ONE_TOKEN_RAW;
}



/**
 * Mean absolute error between target and actual distributions.
 */
function meanAbsoluteError(
  target: Map<string, number>,
  actual: Map<string, number>,
): number {
  const keys = new Set([...target.keys(), ...actual.keys()]);
  if (keys.size === 0) return 0;

  let totalError = 0;
  for (const key of keys) {
    const t = target.get(key) ?? 0;
    const a = actual.get(key) ?? 0;
    totalError += Math.abs(t - a);
  }

  return totalError / keys.size;
}

/**
 * Assign a letter grade from a 0–100 numeric score.
 */
function scoreToGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (score >= 90) return 'A';
  if (score >= 75) return 'B';
  if (score >= 60) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}

/**
 * Clamp a value to [min, max].
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Compare a metric against a baseline value. Returns 'better' if the
 * current score exceeds baseline by >5%, 'worse' if it lags by >5%,
 * and 'same' otherwise. Higher is better.
 */
function compareMetric(
  current: number,
  baseline: number,
): 'better' | 'same' | 'worse' {
  const diff = current - baseline;
  const threshold = Math.max(baseline * 0.05, 1);
  if (diff > threshold) return 'better';
  if (diff < -threshold) return 'worse';
  return 'same';
}

/**
 * Calculate the percentile rank of a value within a sorted (ascending) array.
 */
function percentileRank(sortedValues: number[], value: number): number {
  if (sortedValues.length === 0) return 50;
  let count = 0;
  for (const v of sortedValues) {
    if (v < value) count++;
    else if (v === value) count += 0.5;
  }
  return (count / sortedValues.length) * 100;
}

// ─── BundleAnalytics ──────────────────────────────────────────

export class BundleAnalytics {
  private readonly connection: Connection;
  private readonly eventBus: SwarmEventBus;
  private readonly logger: SwarmLogger;

  /** Rolling history of past analyses for baseline comparison */
  private readonly analysisHistory: LaunchAnalysis[] = [];

  constructor(connection: Connection, eventBus: SwarmEventBus) {
    this.connection = connection;
    this.eventBus = eventBus;
    this.logger = SwarmLogger.create('bundle-analytics', 'analytics');
  }

  // ─── Public API ─────────────────────────────────────────────

  /**
   * Run a full analysis of a completed launch, combining timing,
   * cost, supply, and curve-impact sub-analyses into a single
   * scored result.
   */
  async analyzeLaunch(result: LaunchResult): Promise<LaunchAnalysis> {
    this.logger.info('Analyzing launch', { launchId: result.launchId });

    const [timing, supply] = await Promise.all([
      this.analyzeTimingPrecision(result.signatures),
      this.analyzeSupplyDistribution(
        result.mintResult.mint,
        result.participants
          .filter((p) => p.wallet?.address)
          .map((p) => p.wallet.address),
        result.targetDistribution,
      ),
    ]);

    const cost = this.analyzeCostEfficiency(result);
    const curveImpact = this.analyzeBondingCurveImpact(
      result.mintResult.mint,
      result.curveStateBefore,
      result.curveStateAfter,
    );

    const overallScore = clamp(
      Math.round(
        timing.timingScore * WEIGHT_TIMING +
        cost.costScore * WEIGHT_COST +
        supply.supplyScore * WEIGHT_SUPPLY,
      ),
      0,
      100,
    );

    const grade = scoreToGrade(overallScore);
    const insights = this.generateInsights(timing, cost, supply, curveImpact);
    const recommendations = this.generateRecommendations(timing, cost, supply, curveImpact);

    const analysis: LaunchAnalysis = {
      launchId: result.launchId,
      analyzedAt: Date.now(),
      timing,
      cost,
      supply,
      curveImpact,
      overallScore,
      grade,
      insights,
      recommendations,
    };

    // Store for baseline comparison
    this.analysisHistory.push(analysis);
    if (this.analysisHistory.length > BASELINE_WINDOW_SIZE * 2) {
      this.analysisHistory.splice(0, this.analysisHistory.length - BASELINE_WINDOW_SIZE * 2);
    }

    // Emit analysis event
    this.eventBus.emit(
      'analytics:launch-analyzed',
      'analytics',
      'bundle-analytics',
      {
        launchId: result.launchId,
        overallScore,
        grade,
        timingScore: timing.timingScore,
        costScore: cost.costScore,
        supplyScore: supply.supplyScore,
      },
    );

    this.logger.info('Launch analysis complete', {
      launchId: result.launchId,
      overallScore,
      grade,
    });

    return analysis;
  }

  /**
   * Fetch on-chain transaction data for each signature and analyze
   * timing precision across bundle transactions.
   */
  async analyzeTimingPrecision(signatures: string[]): Promise<TimingAnalysis> {
    if (signatures.length === 0) {
      return {
        sameSlot: true,
        slotSpan: 0,
        slots: [],
        totalSpreadMs: 0,
        creationToBundleMs: 0,
        avgConfirmationMs: 0,
        timingScore: 100,
      };
    }

    this.logger.debug('Fetching slot data for timing analysis', {
      signatureCount: signatures.length,
    });

    // Fetch transaction details in parallel (batched to avoid rate limits)
    const slotEntries: Array<{ signature: string; slot: number; blockTime: number }> = [];
    const batchSize = 10;

    for (let i = 0; i < signatures.length; i += batchSize) {
      const batch = signatures.slice(i, i + batchSize);
      const results = await Promise.allSettled(
        batch.map(async (sig) => {
          const txInfo = await this.connection.getTransaction(sig, {
            commitment: 'confirmed',
            maxSupportedTransactionVersion: 0,
          });
          if (!txInfo) {
            this.logger.warn('Transaction not found for timing analysis', { signature: sig });
            return null;
          }
          return {
            signature: sig,
            slot: txInfo.slot,
            blockTime: (txInfo.blockTime ?? 0) * 1000, // Convert to ms
          };
        }),
      );

      for (const r of results) {
        if (r.status === 'fulfilled' && r.value) {
          slotEntries.push(r.value);
        }
      }
    }

    if (slotEntries.length === 0) {
      return {
        sameSlot: true,
        slotSpan: 0,
        slots: [],
        totalSpreadMs: 0,
        creationToBundleMs: 0,
        avgConfirmationMs: 0,
        timingScore: 0,
      };
    }

    // Sort by slot
    slotEntries.sort((a, b) => a.slot - b.slot);

    const minSlot = slotEntries[0].slot;
    const maxSlot = slotEntries[slotEntries.length - 1].slot;
    const slotSpan = maxSlot - minSlot;
    const sameSlot = slotSpan === 0;

    // Time spread
    const blockTimes = slotEntries
      .map((e) => e.blockTime)
      .filter((t) => t > 0);
    const minTime = blockTimes.length > 0 ? Math.min(...blockTimes) : 0;
    const maxTime = blockTimes.length > 0 ? Math.max(...blockTimes) : 0;
    const totalSpreadMs = maxTime - minTime;

    // Creation to bundle: first TX is creation, second+ are buys
    const creationToBundleMs =
      slotEntries.length >= 2
        ? Math.abs(slotEntries[1].blockTime - slotEntries[0].blockTime)
        : 0;

    // Average "confirmation" approximation from block times
    const avgConfirmationMs =
      blockTimes.length > 0
        ? totalSpreadMs / Math.max(blockTimes.length - 1, 1)
        : 0;

    // Score: 100 if all same slot, -10 per additional slot spread, floor at 0
    const timingScore = clamp(100 - slotSpan * 10, 0, 100);

    return {
      sameSlot,
      slotSpan,
      slots: slotEntries,
      totalSpreadMs,
      creationToBundleMs,
      avgConfirmationMs,
      timingScore,
    };
  }

  /**
   * Analyze cost efficiency of the launch: how much SOL was spent,
   * what was the effective price, and how much was "wasted" on
   * fees, tips, and slippage.
   */
  analyzeCostEfficiency(result: LaunchResult): CostAnalysis {
    const totalSolSpent = lamportsToSol(result.totalSolSpent);
    const totalTokensAcquiredRaw = BigInt(result.totalTokensAcquired.toString());
    const totalTokensHuman = rawToTokens(result.totalTokensAcquired);

    // Average price per token = total SOL / total tokens
    const averagePricePerToken =
      totalTokensHuman > 0 ? totalSolSpent / totalTokensHuman : 0;

    // Initial price from pre-buy curve state
    const initialPrice = result.curveStateBefore.currentPriceSol;
    const finalPrice = result.curveStateAfter.currentPriceSol;

    // Price impact: how much the price moved from start to end
    const priceImpactPercent =
      initialPrice > 0
        ? ((finalPrice - initialPrice) / initialPrice) * 100
        : 0;

    // Fees and tips as percentage of total spend
    const totalFeesSOL = result.totalFeesLamports / LAMPORTS_PER_SOL;
    const jitoTipSOL = result.jitoTipLamports / LAMPORTS_PER_SOL;
    const feesAsPercentOfTotal =
      totalSolSpent > 0 ? (totalFeesSOL / totalSolSpent) * 100 : 0;
    const jitoTipAsPercentOfTotal =
      totalSolSpent > 0 ? (jitoTipSOL / totalSolSpent) * 100 : 0;

    // Efficiency: tokens per SOL relative to initial price
    // If we could buy at initial price with zero slippage, how many tokens?
    const theoreticalTokens =
      initialPrice > 0 ? totalSolSpent / initialPrice : 0;
    const efficiency =
      theoreticalTokens > 0 ? totalTokensHuman / theoreticalTokens : 0;

    // Wasted SOL: difference between what we paid and what we'd pay at
    // average of initial and final price (approximating zero-slippage scenario)
    const fairPrice = (initialPrice + finalPrice) / 2;
    const fairCost = fairPrice * totalTokensHuman;
    const wastedSOL = Math.max(0, totalSolSpent - fairCost - totalFeesSOL - jitoTipSOL);

    // Cost score: efficiency-based, 100 = got exactly theoretical tokens,
    // penalty for high fees and slippage
    const efficiencyScore = clamp(efficiency * 100, 0, 100);
    const feesPenalty = Math.min(feesAsPercentOfTotal + jitoTipAsPercentOfTotal, 20);
    const slippagePenalty = Math.min(priceImpactPercent * 2, 30);
    const costScore = clamp(
      Math.round(efficiencyScore - feesPenalty - slippagePenalty),
      0,
      100,
    );

    return {
      totalSOLSpent: totalSolSpent,
      totalTokensAcquired: totalTokensAcquiredRaw,
      averagePricePerToken,
      priceImpactPercent,
      feesAsPercentOfTotal,
      jitoTipAsPercentOfTotal,
      efficiency,
      wastedSOL: wastedSOL,
      costScore,
    };
  }

  /**
   * Fetch actual token balances for each wallet and compare
   * against the target distribution.
   */
  async analyzeSupplyDistribution(
    mint: string,
    wallets: string[],
    targetDistribution?: Map<string, number>,
  ): Promise<SupplyAnalysis> {
    const mintPubkey = new PublicKey(mint);
    const actualBalances: Map<string, number> = new Map();

    // Fetch all token balances in parallel
    const balanceResults = await Promise.allSettled(
      wallets.map(async (address) => {
        const ownerPubkey = new PublicKey(address);
        const ata = await getAssociatedTokenAddress(mintPubkey, ownerPubkey);
        try {
          const account = await getAccount(this.connection, ata);
          return {
            address,
            balance: Number(account.amount),
          };
        } catch {
          // Account doesn't exist or has zero balance
          return { address, balance: 0 };
        }
      }),
    );

    for (const r of balanceResults) {
      if (r.status === 'fulfilled') {
        actualBalances.set(r.value.address, r.value.balance);
      }
    }

    // Calculate total tokens held by swarm
    const totalHeld = [...actualBalances.values()].reduce((a, b) => a + b, 0);
    const totalSupplyControlled =
      TOTAL_SUPPLY_RAW > 0 ? (totalHeld / TOTAL_SUPPLY_RAW) * 100 : 0;

    // Convert balances to percentages of held tokens
    const actualDistribution: Map<string, number> = new Map();
    for (const [addr, bal] of actualBalances) {
      actualDistribution.set(addr, totalHeld > 0 ? bal / totalHeld : 0);
    }

    // Target distribution (default to equal if not provided)
    const target: Map<string, number> = targetDistribution ?? new Map(
      wallets.map((w) => [w, 1 / wallets.length]),
    );

    // Distribution error (mean absolute error)
    const distributionError = meanAbsoluteError(target, actualDistribution);

    // Find largest / smallest wallet
    const percentages = [...actualDistribution.values()];
    const largestWalletPercent = percentages.length > 0 ? Math.max(...percentages) * 100 : 0;
    const smallestWalletPercent = percentages.length > 0 ? Math.min(...percentages) * 100 : 0;

    // Gini coefficient
    const balanceValues = [...actualBalances.values()];
    const giniCoefficient = calculateGini(balanceValues);

    // Herfindahl index from shares
    const shares = percentages.length > 0 ? percentages : [1];
    const herfindahlIndex = calculateHerfindahl(shares);

    // Supply score: penalize high Gini, high distribution error, high concentration
    // Perfect score = Gini 0, error 0, HHI = 1/n
    const idealHHI = wallets.length > 0 ? 1 / wallets.length : 1;
    const herfindahlPenalty = clamp(
      ((herfindahlIndex - idealHHI) / (1 - idealHHI)) * 50,
      0,
      50,
    );
    const giniPenalty = giniCoefficient * 30;
    const errorPenalty = distributionError * 200; // MAE is typically small, amplify
    const supplyScore = clamp(
      Math.round(100 - herfindahlPenalty - giniPenalty - errorPenalty),
      0,
      100,
    );

    return {
      targetDistribution: target,
      actualDistribution,
      totalSupplyControlled,
      distributionError,
      largestWalletPercent,
      smallestWalletPercent,
      giniCoefficient,
      herfindahlIndex,
      supplyScore,
    };
  }

  /**
   * Analyze the bonding curve impact: how much the price moved,
   * how much of the curve was drained, and how close to graduation.
   */
  analyzeBondingCurveImpact(
    _mint: string,
    beforeState: BondingCurveState,
    afterState: BondingCurveState,
  ): CurveImpactAnalysis {
    const preBuyPrice = beforeState.currentPriceSol;
    const postBuyPrice = afterState.currentPriceSol;
    const priceChangePercent =
      preBuyPrice > 0
        ? ((postBuyPrice - preBuyPrice) / preBuyPrice) * 100
        : 0;

    const preVirtualSolReserves = BigInt(beforeState.virtualSolReserves.toString());
    const postVirtualSolReserves = BigInt(afterState.virtualSolReserves.toString());
    const preVirtualTokenReserves = BigInt(beforeState.virtualTokenReserves.toString());
    const postVirtualTokenReserves = BigInt(afterState.virtualTokenReserves.toString());

    // Tokens purchased = decrease in virtual token reserves
    const tokensPurchasedFromCurve =
      preVirtualTokenReserves > postVirtualTokenReserves
        ? preVirtualTokenReserves - postVirtualTokenReserves
        : BigInt(0);

    // Percent of available tokens drained from the curve
    const preRealTokens = BigInt(beforeState.realTokenReserves.toString());
    const percentOfCurveDrained =
      preRealTokens > BigInt(0)
        ? (Number(tokensPurchasedFromCurve) / Number(preRealTokens)) * 100
        : 0;

    // Distance to graduation (85 SOL threshold)
    const postRealSol = Number(afterState.realSolReserves.toString()) / LAMPORTS_PER_SOL;
    const distanceToGraduation = clamp(
      (postRealSol / GRADUATION_THRESHOLD_SOL) * 100,
      0,
      100,
    );

    return {
      preBuyPrice,
      postBuyPrice,
      priceChangePercent,
      preVirtualSolReserves,
      postVirtualSolReserves,
      preVirtualTokenReserves,
      postVirtualTokenReserves,
      tokensPurchasedFromCurve,
      percentOfCurveDrained,
      distanceToGraduation,
    };
  }

  /**
   * Generate a comprehensive markdown report for a launch.
   * If the analysis has already been run, retrieves from history;
   * otherwise runs a fresh analysis by requiring a LaunchResult.
   */
  async generateReport(launchId: string): Promise<LaunchReport> {
    const analysis = this.analysisHistory.find((a) => a.launchId === launchId);

    if (!analysis) {
      throw new Error(
        `No analysis found for launch ${launchId}. ` +
        `Run analyzeLaunch() first.`,
      );
    }

    const generatedAt = new Date().toISOString();

    // Build timeline from timing data
    const timeline: LaunchReport['timeline'] = analysis.timing.slots.map(
      (slot, idx) => ({
        timestamp: slot.blockTime,
        event: idx === 0 ? 'Token Created' : `Bundle Buy #${idx}`,
        details: `Slot ${slot.slot}`,
        signature: slot.signature,
      }),
    );

    // Summary paragraph
    const summary = this.buildSummary(analysis);

    // Formatted markdown report
    const formattedReport = this.buildMarkdownReport(
      launchId,
      generatedAt,
      summary,
      analysis,
      timeline,
    );

    const report: LaunchReport = {
      launchId,
      generatedAt,
      summary,
      analysis,
      timeline,
      formattedReport,
    };

    this.eventBus.emit(
      'analytics:report-generated',
      'analytics',
      'bundle-analytics',
      { launchId, grade: analysis.grade, overallScore: analysis.overallScore },
    );

    return report;
  }

  /**
   * Compare the given analysis against the rolling baseline of
   * past launches. Identifies trends and percentile ranking.
   */
  compareToBaseline(analysis: LaunchAnalysis): BaselineComparison {
    const recent = this.analysisHistory
      .filter((a) => a.launchId !== analysis.launchId)
      .slice(-BASELINE_WINDOW_SIZE);

    if (recent.length === 0) {
      // No baseline data — first launch is always "same"
      return {
        timingVsBaseline: 'same',
        costVsBaseline: 'same',
        supplyVsBaseline: 'same',
        overallVsBaseline: 'same',
        percentileRank: 50,
      };
    }

    const avgTiming =
      recent.reduce((s, a) => s + a.timing.timingScore, 0) / recent.length;
    const avgCost =
      recent.reduce((s, a) => s + a.cost.costScore, 0) / recent.length;
    const avgSupply =
      recent.reduce((s, a) => s + a.supply.supplyScore, 0) / recent.length;
    const avgOverall =
      recent.reduce((s, a) => s + a.overallScore, 0) / recent.length;

    const sortedOverall = recent.map((a) => a.overallScore).sort((a, b) => a - b);

    return {
      timingVsBaseline: compareMetric(analysis.timing.timingScore, avgTiming),
      costVsBaseline: compareMetric(analysis.cost.costScore, avgCost),
      supplyVsBaseline: compareMetric(analysis.supply.supplyScore, avgSupply),
      overallVsBaseline: compareMetric(analysis.overallScore, avgOverall),
      percentileRank: Math.round(percentileRank(sortedOverall, analysis.overallScore)),
    };
  }

  // ─── Private Helpers ────────────────────────────────────────

  /**
   * Generate human-readable insights from sub-analyses.
   */
  private generateInsights(
    timing: TimingAnalysis,
    cost: CostAnalysis,
    supply: SupplyAnalysis,
    curve: CurveImpactAnalysis,
  ): string[] {
    const insights: string[] = [];

    // Timing insights
    if (timing.sameSlot) {
      insights.push(
        'All transactions landed in the same slot — optimal atomic execution.',
      );
    } else {
      insights.push(
        `Transactions spanned ${timing.slotSpan} slots (${timing.totalSpreadMs}ms spread). ` +
        `Consider using Jito bundles for guaranteed co-location.`,
      );
    }

    // Cost insights
    if (cost.efficiency >= 0.95) {
      insights.push(
        `Excellent cost efficiency at ${(cost.efficiency * 100).toFixed(1)}% — ` +
        `minimal slippage.`,
      );
    } else if (cost.efficiency < 0.7) {
      insights.push(
        `Cost efficiency is low at ${(cost.efficiency * 100).toFixed(1)}%. ` +
        `${cost.priceImpactPercent.toFixed(1)}% price impact indicates ` +
        `the buy size may be too large for current liquidity.`,
      );
    }

    if (cost.jitoTipAsPercentOfTotal > 5) {
      insights.push(
        `Jito tip accounts for ${cost.jitoTipAsPercentOfTotal.toFixed(1)}% of total spend. ` +
        `Consider reducing tip if same-slot landing is consistent.`,
      );
    }

    // Supply insights
    if (supply.giniCoefficient < 0.15) {
      insights.push(
        `Supply distribution is highly equal (Gini ${supply.giniCoefficient.toFixed(3)}).`,
      );
    } else if (supply.giniCoefficient > 0.4) {
      insights.push(
        `Supply is concentrated (Gini ${supply.giniCoefficient.toFixed(3)}). ` +
        `Largest wallet holds ${supply.largestWalletPercent.toFixed(1)}% of swarm tokens.`,
      );
    }

    // Curve impact insights
    insights.push(
      `Price moved ${curve.priceChangePercent.toFixed(2)}% ` +
      `(${curve.preBuyPrice.toFixed(10)} → ${curve.postBuyPrice.toFixed(10)} SOL). ` +
      `${curve.percentOfCurveDrained.toFixed(1)}% of curve tokens drained.`,
    );

    if (curve.distanceToGraduation > 80) {
      insights.push(
        `Warning: Token is ${curve.distanceToGraduation.toFixed(1)}% to graduation. ` +
        `Close to Raydium migration threshold.`,
      );
    }

    return insights;
  }

  /**
   * Generate actionable recommendations based on sub-analyses.
   */
  private generateRecommendations(
    timing: TimingAnalysis,
    cost: CostAnalysis,
    supply: SupplyAnalysis,
    curve: CurveImpactAnalysis,
  ): string[] {
    const recs: string[] = [];

    if (!timing.sameSlot) {
      recs.push(
        'Enable Jito bundles to ensure all transactions land in the same slot.',
      );
    }

    if (cost.priceImpactPercent > 10) {
      recs.push(
        'Split the bundle into smaller purchases across more wallets to reduce price impact.',
      );
    }

    if (cost.wastedSOL > 0.01) {
      recs.push(
        `Reduce slippage tolerance — ${cost.wastedSOL.toFixed(4)} SOL was lost to excess slippage.`,
      );
    }

    if (cost.feesAsPercentOfTotal > 3) {
      recs.push(
        'Consolidate transactions to reduce per-TX base fees.',
      );
    }

    if (supply.giniCoefficient > 0.3) {
      recs.push(
        'Use a more balanced distribution strategy (e.g., equal or gaussian) to avoid concentration.',
      );
    }

    if (supply.distributionError > 0.05) {
      recs.push(
        'Increase noise factor or adjust transfer amounts — actual distribution deviates significantly from target.',
      );
    }

    if (curve.percentOfCurveDrained > 30) {
      recs.push(
        'Bundle is draining too much of the curve. Reduce total buy size to maintain healthy liquidity.',
      );
    }

    if (curve.distanceToGraduation > 60) {
      recs.push(
        'Approaching graduation threshold — plan exit strategy or prepare for Raydium migration.',
      );
    }

    // If everything looks great, say so
    if (recs.length === 0) {
      recs.push('No actionable recommendations — all metrics are within optimal ranges.');
    }

    return recs;
  }

  /**
   * Build a one-paragraph summary of the launch.
   */
  private buildSummary(analysis: LaunchAnalysis): string {
    const { timing, cost, supply, curveImpact, overallScore, grade } = analysis;

    return (
      `Launch scored ${overallScore}/100 (Grade ${grade}). ` +
      `${timing.sameSlot ? 'All TXs landed in the same slot' : `TXs spread across ${timing.slotSpan} slots`}. ` +
      `Spent ${cost.totalSOLSpent.toFixed(4)} SOL for ${Number(cost.totalTokensAcquired).toLocaleString()} tokens ` +
      `(${cost.efficiency >= 0.95 ? 'excellent' : cost.efficiency >= 0.7 ? 'good' : 'poor'} efficiency at ${(cost.efficiency * 100).toFixed(1)}%). ` +
      `Supply controlled: ${supply.totalSupplyControlled.toFixed(2)}%, ` +
      `Gini: ${supply.giniCoefficient.toFixed(3)}, ` +
      `Price impact: ${curveImpact.priceChangePercent.toFixed(2)}%, ` +
      `Graduation distance: ${curveImpact.distanceToGraduation.toFixed(1)}%.`
    );
  }

  /**
   * Build a full markdown-formatted report string.
   */
  private buildMarkdownReport(
    launchId: string,
    generatedAt: string,
    summary: string,
    analysis: LaunchAnalysis,
    timeline: LaunchReport['timeline'],
  ): string {
    const { timing, cost, supply, curveImpact, overallScore, grade, insights, recommendations } =
      analysis;

    const baseline = this.compareToBaseline(analysis);
    const baselineArrow = (v: 'better' | 'same' | 'worse'): string => {
      if (v === 'better') return '↑';
      if (v === 'worse') return '↓';
      return '→';
    };

    const lines: string[] = [
      `# Bundle Launch Report`,
      ``,
      `**Launch ID:** \`${launchId}\``,
      `**Generated:** ${generatedAt}`,
      `**Overall Score:** ${overallScore}/100 (Grade **${grade}**)`,
      ``,
      `## Summary`,
      ``,
      summary,
      ``,
      `---`,
      ``,
      `## Timing Analysis (Score: ${timing.timingScore}/100 ${baselineArrow(baseline.timingVsBaseline)})`,
      ``,
      `| Metric | Value |`,
      `|--------|-------|`,
      `| Same Slot | ${timing.sameSlot ? '✅ Yes' : '❌ No'} |`,
      `| Slot Span | ${timing.slotSpan} |`,
      `| Total Spread | ${timing.totalSpreadMs}ms |`,
      `| Creation → Bundle | ${timing.creationToBundleMs}ms |`,
      `| Avg Confirmation | ${timing.avgConfirmationMs.toFixed(0)}ms |`,
      ``,
      `### Transaction Slots`,
      ``,
      `| # | Signature | Slot | Block Time |`,
      `|---|-----------|------|------------|`,
      ...timing.slots.map(
        (s, i) =>
          `| ${i + 1} | \`${s.signature.slice(0, 12)}…\` | ${s.slot} | ${new Date(s.blockTime).toISOString()} |`,
      ),
      ``,
      `---`,
      ``,
      `## Cost Analysis (Score: ${cost.costScore}/100 ${baselineArrow(baseline.costVsBaseline)})`,
      ``,
      `| Metric | Value |`,
      `|--------|-------|`,
      `| Total SOL Spent | ${cost.totalSOLSpent.toFixed(6)} SOL |`,
      `| Tokens Acquired | ${Number(cost.totalTokensAcquired).toLocaleString()} |`,
      `| Avg Price/Token | ${cost.averagePricePerToken.toFixed(12)} SOL |`,
      `| Price Impact | ${cost.priceImpactPercent.toFixed(2)}% |`,
      `| Fees (% of total) | ${cost.feesAsPercentOfTotal.toFixed(2)}% |`,
      `| Jito Tip (% of total) | ${cost.jitoTipAsPercentOfTotal.toFixed(2)}% |`,
      `| Efficiency | ${(cost.efficiency * 100).toFixed(1)}% |`,
      `| Wasted SOL | ${cost.wastedSOL.toFixed(6)} SOL |`,
      ``,
      `---`,
      ``,
      `## Supply Distribution (Score: ${supply.supplyScore}/100 ${baselineArrow(baseline.supplyVsBaseline)})`,
      ``,
      `| Metric | Value |`,
      `|--------|-------|`,
      `| Total Supply Controlled | ${supply.totalSupplyControlled.toFixed(2)}% |`,
      `| Distribution Error (MAE) | ${supply.distributionError.toFixed(4)} |`,
      `| Largest Wallet | ${supply.largestWalletPercent.toFixed(2)}% |`,
      `| Smallest Wallet | ${supply.smallestWalletPercent.toFixed(2)}% |`,
      `| Gini Coefficient | ${supply.giniCoefficient.toFixed(4)} |`,
      `| Herfindahl Index | ${supply.herfindahlIndex.toFixed(4)} |`,
      ``,
      `---`,
      ``,
      `## Bonding Curve Impact`,
      ``,
      `| Metric | Value |`,
      `|--------|-------|`,
      `| Pre-Buy Price | ${curveImpact.preBuyPrice.toFixed(12)} SOL |`,
      `| Post-Buy Price | ${curveImpact.postBuyPrice.toFixed(12)} SOL |`,
      `| Price Change | ${curveImpact.priceChangePercent.toFixed(2)}% |`,
      `| Tokens Purchased | ${Number(curveImpact.tokensPurchasedFromCurve).toLocaleString()} |`,
      `| Curve Drained | ${curveImpact.percentOfCurveDrained.toFixed(2)}% |`,
      `| Distance to Graduation | ${curveImpact.distanceToGraduation.toFixed(1)}% |`,
      ``,
      `---`,
      ``,
      `## Baseline Comparison (Percentile: ${baseline.percentileRank}th)`,
      ``,
      `| Dimension | vs Baseline |`,
      `|-----------|-------------|`,
      `| Timing | ${baseline.timingVsBaseline} ${baselineArrow(baseline.timingVsBaseline)} |`,
      `| Cost | ${baseline.costVsBaseline} ${baselineArrow(baseline.costVsBaseline)} |`,
      `| Supply | ${baseline.supplyVsBaseline} ${baselineArrow(baseline.supplyVsBaseline)} |`,
      `| Overall | ${baseline.overallVsBaseline} ${baselineArrow(baseline.overallVsBaseline)} |`,
      ``,
      `---`,
      ``,
      `## Insights`,
      ``,
      ...insights.map((i) => `- ${i}`),
      ``,
      `## Recommendations`,
      ``,
      ...recommendations.map((r) => `- ${r}`),
      ``,
      `---`,
      ``,
      `## Timeline`,
      ``,
      `| # | Time | Event | Details | Signature |`,
      `|---|------|-------|---------|-----------|`,
      ...timeline.map(
        (t, idx) =>
          `| ${idx + 1} | ${new Date(t.timestamp).toISOString()} | ${t.event} | ${t.details} | ${t.signature ? `\`${t.signature.slice(0, 12)}…\`` : '—'} |`,
      ),
      ``,
    ];

    return lines.join('\n');
  }
}
