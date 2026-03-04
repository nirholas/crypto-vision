/**
 * Token Evaluator — Deep Multi-Criteria Evaluation for Pump.fun Tokens
 *
 * Performs comprehensive analysis across six dimensions:
 *   1. Bonding Curve Health — on-chain reserves, graduation proximity, price stability
 *   2. Holder Quality — distribution, count, Gini coefficient, dev wallet behavior
 *   3. Volume Authenticity — wash trade detection, organic trade patterns
 *   4. Narrative Strength — metadata quality, social engagement, meme potential
 *   5. Rug Risk — multi-factor risk assessment (higher score = safer)
 *   6. Age Factor — age vs momentum for early gem vs stale token detection
 *
 * All data sourced from Solana RPC and Pump.fun API — no mocks, no fakes.
 */

import {
  Connection,
  PublicKey,
} from '@solana/web3.js';
import type {
  ParsedTransactionWithMeta,
  TokenAmount,
} from '@solana/web3.js';
import {
  bondingCurvePda,
  getTokenPrice,
  PUMP_SDK,
} from '@pump-fun/pump-sdk';

import type { SwarmEventBus } from '../infra/event-bus.js';
import { SwarmLogger } from '../infra/logger.js';
import type { BondingCurveState } from '../types.js';

// ─── Constants ────────────────────────────────────────────────

const LAMPORTS_PER_SOL = 1_000_000_000;
const GRADUATION_THRESHOLD_SOL = 85;
const DEFAULT_PUMP_API_BASE = 'https://frontend-api-v2.pump.fun';
const DEFAULT_CACHE_TTL_MS = 60_000;
const DEFAULT_BUY_THRESHOLD = 65;
const FETCH_TIMEOUT_MS = 10_000;
const MAX_HOLDER_FETCH = 20;
const MAX_TX_SIGNATURES = 100;

// ─── Interfaces ───────────────────────────────────────────────

export interface EvaluatorConfig {
  /** Pump.fun API base */
  pumpFunApiBase: string;
  /** Weights for each criteria (must sum to 1.0) */
  weights: {
    bondingCurveHealth: number;
    holderQuality: number;
    volumeAuthenticity: number;
    narrativeStrength: number;
    rugRisk: number;
    ageFactor: number;
  };
  /** Minimum score to recommend buying (0-100) */
  buyThreshold: number;
  /** Cache TTL for evaluations (ms) */
  cacheTtl: number;
}

export interface CriterionScore {
  /** Raw score 0-100 */
  score: number;
  /** Configured weight for this criterion */
  weight: number;
  /** score * weight */
  weighted: number;
  /** Human-readable explanation */
  details: string;
}

export interface TokenRawData {
  pumpFunData: Record<string, unknown>;
  bondingCurveState: BondingCurveState | null;
  holderCount: number;
  topHolders: Array<{ address: string; balance: bigint; percent: number }>;
  recentTxCount: number;
  uniqueWallets: number;
  tokenAge: number;
  replyCount: number;
}

export interface TokenEvaluation {
  mint: string;
  name: string;
  symbol: string;
  /** Overall weighted score (0-100) */
  overallScore: number;
  /** Per-criteria scores */
  scores: {
    bondingCurveHealth: CriterionScore;
    holderQuality: CriterionScore;
    volumeAuthenticity: CriterionScore;
    narrativeStrength: CriterionScore;
    rugRisk: CriterionScore;
    ageFactor: CriterionScore;
  };
  /** Recommendation based on overall score */
  recommendation: 'strong-buy' | 'buy' | 'hold' | 'avoid' | 'strong-avoid';
  /** Confidence in evaluation (0-1) */
  confidence: number;
  /** Key insights about this token */
  insights: string[];
  /** Red flags detected */
  redFlags: string[];
  /** Raw data used for evaluation */
  rawData: TokenRawData;
  evaluatedAt: number;
}

export interface TokenComparison {
  tokens: TokenEvaluation[];
  ranked: Array<{ mint: string; rank: number; score: number }>;
  bestPick: { mint: string; reasoning: string };
  comparedAt: number;
}

interface CachedEvaluation {
  evaluation: TokenEvaluation;
  cachedAt: number;
}

interface PumpFunTokenData {
  mint: string;
  name: string;
  symbol: string;
  description: string;
  image_uri: string;
  metadata_uri: string;
  creator: string;
  created_timestamp: number;
  reply_count: number;
  market_cap: number;
  usd_market_cap: number;
  bonding_curve: string;
  raydium_pool: string | null;
  complete: boolean;
  virtual_sol_reserves: number;
  virtual_token_reserves: number;
  real_sol_reserves: number;
  real_token_reserves: number;
  total_supply: number;
  [key: string]: unknown;
}

interface TradeSignature {
  signature: string;
  slot: number;
  blockTime: number | null;
}

// ─── Default Config ───────────────────────────────────────────

const DEFAULT_WEIGHTS: EvaluatorConfig['weights'] = {
  bondingCurveHealth: 0.20,
  holderQuality: 0.20,
  volumeAuthenticity: 0.15,
  narrativeStrength: 0.15,
  rugRisk: 0.20,
  ageFactor: 0.10,
};

const DEFAULT_CONFIG: EvaluatorConfig = {
  pumpFunApiBase: DEFAULT_PUMP_API_BASE,
  weights: DEFAULT_WEIGHTS,
  buyThreshold: DEFAULT_BUY_THRESHOLD,
  cacheTtl: DEFAULT_CACHE_TTL_MS,
};

// ─── Helpers ──────────────────────────────────────────────────

/** Clamp a number to [min, max] */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Convert lamports bigint to SOL number */
function lamportsToSol(lamports: bigint): number {
  return Number(lamports) / LAMPORTS_PER_SOL;
}

/** Fetch with timeout */
async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Compute the Gini coefficient for a set of balances.
 * 0 = perfect equality, 1 = maximum inequality.
 */
function computeGini(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const totalSum = sorted.reduce((s, v) => s + v, 0);
  if (totalSum === 0) return 0;

  let cumulativeSum = 0;
  let giniNumerator = 0;
  for (let i = 0; i < n; i++) {
    cumulativeSum += sorted[i];
    giniNumerator += (2 * (i + 1) - n - 1) * sorted[i];
  }
  return giniNumerator / (n * totalSum);
}

/**
 * Assess "meme-ability" of a token name — short, catchy names with
 * animals, internet slang, or cultural references score higher.
 */
function assessMemeability(name: string): number {
  const lower = name.toLowerCase();
  let score = 50; // baseline

  // Short names are more memorable
  if (name.length <= 4) score += 15;
  else if (name.length <= 8) score += 10;
  else if (name.length > 20) score -= 15;

  // Meme-able keywords
  const memeKeywords = [
    'doge', 'pepe', 'shib', 'cat', 'dog', 'moon', 'elon', 'trump',
    'ai', 'gpt', 'chad', 'wojak', 'frog', 'ape', 'monkey', 'baby',
    'king', 'queen', 'based', 'sigma', 'alpha', 'giga', 'mega',
    'sol', 'pump', 'bonk', 'wif', 'hat', 'jeo', 'boden', 'tremp',
  ];
  for (const kw of memeKeywords) {
    if (lower.includes(kw)) {
      score += 12;
      break; // only count once
    }
  }

  // All caps is memeable
  if (name === name.toUpperCase() && name.length > 1) score += 5;

  // Has numbers / special chars: slight deduction
  if (/[0-9]/.test(name)) score -= 5;
  if (/[^a-zA-Z0-9\s]/.test(name)) score -= 5;

  return clamp(score, 0, 100);
}

// ─── Token Evaluator ──────────────────────────────────────────

export class TokenEvaluator {
  private readonly connection: Connection;
  private readonly eventBus: SwarmEventBus;
  private readonly config: EvaluatorConfig;
  private readonly logger: SwarmLogger;

  /** Cached evaluations keyed by mint */
  private readonly cache = new Map<string, CachedEvaluation>();

  /** Complete evaluation history (never evicted — grows monotonically) */
  private readonly history = new Map<string, TokenEvaluation>();

  constructor(
    connection: Connection,
    eventBus: SwarmEventBus,
    config?: Partial<EvaluatorConfig>,
  ) {
    this.connection = connection;
    this.eventBus = eventBus;
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      weights: { ...DEFAULT_WEIGHTS, ...config?.weights },
    };
    this.logger = SwarmLogger.create('token-evaluator', 'intelligence');
    this.logger.info('Token evaluator initialized', {
      buyThreshold: this.config.buyThreshold,
      cacheTtl: this.config.cacheTtl,
      weights: this.config.weights,
    });
  }

  // ─── Public API ───────────────────────────────────────────

  /**
   * Full deep evaluation of a single token across all six criteria.
   */
  async evaluateToken(mint: string): Promise<TokenEvaluation> {
    this.logger.info('Starting deep evaluation', { mint });

    // Check cache
    const cached = this.cache.get(mint);
    if (cached && Date.now() - cached.cachedAt < this.config.cacheTtl) {
      this.logger.debug('Returning cached evaluation', { mint, age: Date.now() - cached.cachedAt });
      return cached.evaluation;
    }

    // Gather raw data in parallel
    const [pumpData, bondingCurve, holders, txData] = await Promise.all([
      this.fetchPumpFunData(mint),
      this.fetchBondingCurveState(mint),
      this.fetchHolderData(mint),
      this.fetchTransactionData(mint),
    ]);

    const tokenAge = pumpData
      ? Date.now() - pumpData.created_timestamp * 1000
      : 0;

    const rawData: TokenRawData = {
      pumpFunData: (pumpData as Record<string, unknown>) ?? {},
      bondingCurveState: bondingCurve,
      holderCount: holders.count,
      topHolders: holders.topHolders,
      recentTxCount: txData.totalCount,
      uniqueWallets: txData.uniqueWallets,
      tokenAge,
      replyCount: pumpData?.reply_count ?? 0,
    };

    // Score each criterion
    const bondingCurveHealth = this.scoreBondingCurveHealth(bondingCurve);
    const holderQuality = this.scoreHolderQuality(holders, pumpData);
    const volumeAuthenticity = this.scoreVolumeAuthenticity(txData);
    const narrativeStrength = this.scoreNarrativeStrength(pumpData);
    const rugRisk = this.scoreRugRisk(holders, pumpData, bondingCurve, tokenAge);
    const ageFactor = this.scoreAgeFactor(tokenAge, txData);

    const scores = {
      bondingCurveHealth,
      holderQuality,
      volumeAuthenticity,
      narrativeStrength,
      rugRisk,
      ageFactor,
    };

    // Weighted sum
    const overallScore = Math.round(
      bondingCurveHealth.weighted +
      holderQuality.weighted +
      volumeAuthenticity.weighted +
      narrativeStrength.weighted +
      rugRisk.weighted +
      ageFactor.weighted,
    );

    // Determine recommendation
    const recommendation = this.computeRecommendation(overallScore);

    // Compute confidence: higher when we have more data sources
    const confidence = this.computeConfidence(pumpData, bondingCurve, holders, txData);

    // Gather insights and red flags
    const insights = this.gatherInsights(scores, pumpData, bondingCurve, tokenAge, holders);
    const redFlags = this.gatherRedFlags(scores, holders, pumpData, bondingCurve, tokenAge);

    const evaluation: TokenEvaluation = {
      mint,
      name: pumpData?.name ?? 'Unknown',
      symbol: pumpData?.symbol ?? '???',
      overallScore: clamp(overallScore, 0, 100),
      scores,
      recommendation,
      confidence,
      insights,
      redFlags,
      rawData,
      evaluatedAt: Date.now(),
    };

    // Cache and store history
    this.cache.set(mint, { evaluation, cachedAt: Date.now() });
    this.history.set(mint, evaluation);

    // Emit event
    this.eventBus.emit(
      'token.evaluated',
      'intelligence',
      'token-evaluator',
      {
        mint,
        overallScore: evaluation.overallScore,
        recommendation,
        confidence,
        redFlagCount: redFlags.length,
      },
    );

    this.logger.info('Evaluation complete', {
      mint,
      score: evaluation.overallScore,
      recommendation,
      confidence: confidence.toFixed(2),
      redFlags: redFlags.length,
    });

    return evaluation;
  }

  /**
   * Quick 0-100 score — skips expensive holder enumeration and transaction parsing.
   * Uses only Pump.fun API data and bonding curve state.
   */
  async quickScore(mint: string): Promise<number> {
    this.logger.debug('Quick score requested', { mint });

    const cached = this.cache.get(mint);
    if (cached && Date.now() - cached.cachedAt < this.config.cacheTtl) {
      return cached.evaluation.overallScore;
    }

    const [pumpData, bondingCurve] = await Promise.all([
      this.fetchPumpFunData(mint),
      this.fetchBondingCurveState(mint),
    ]);

    // Use simplified scoring for speed
    const bcScore = this.scoreBondingCurveHealth(bondingCurve);
    const narrativeScore = this.scoreNarrativeStrength(pumpData);

    // Simplified rug risk: just check if graduated or has raydium pool
    let quickRugScore = 50;
    if (pumpData) {
      if (pumpData.complete) quickRugScore += 30;
      if (pumpData.reply_count > 10) quickRugScore += 10;
      if (pumpData.reply_count === 0) quickRugScore -= 15;
    }
    quickRugScore = clamp(quickRugScore, 0, 100);

    // Age factor from pump timestamp
    const tokenAge = pumpData ? Date.now() - pumpData.created_timestamp * 1000 : 0;
    let quickAgeScore = 50;
    if (tokenAge > 0 && tokenAge < 10 * 60_000) quickAgeScore = 85;
    else if (tokenAge < 60 * 60_000) quickAgeScore = 70;
    else if (tokenAge < 6 * 60 * 60_000) quickAgeScore = 55;
    else if (tokenAge < 24 * 60 * 60_000) quickAgeScore = 35;
    else quickAgeScore = 20;

    const { weights } = this.config;
    const score = Math.round(
      bcScore.score * weights.bondingCurveHealth +
      50 * weights.holderQuality + // assume average for quick score
      50 * weights.volumeAuthenticity + // assume average for quick score
      narrativeScore.score * weights.narrativeStrength +
      quickRugScore * weights.rugRisk +
      quickAgeScore * weights.ageFactor,
    );

    this.logger.debug('Quick score computed', { mint, score });
    return clamp(score, 0, 100);
  }

  /**
   * Compare and rank multiple tokens by full evaluation.
   */
  async compareTokens(mints: string[]): Promise<TokenComparison> {
    this.logger.info('Comparing tokens', { count: mints.length, mints });

    // Evaluate all tokens (serially to avoid RPC rate limits)
    const tokens: TokenEvaluation[] = [];
    for (const mint of mints) {
      const evaluation = await this.evaluateToken(mint);
      tokens.push(evaluation);
    }

    // Sort descending by overall score
    const sorted = [...tokens].sort((a, b) => b.overallScore - a.overallScore);

    const ranked = sorted.map((t, idx) => ({
      mint: t.mint,
      rank: idx + 1,
      score: t.overallScore,
    }));

    const best = sorted[0];
    const bestPick = {
      mint: best.mint,
      reasoning: this.buildBestPickReasoning(best, sorted),
    };

    const comparison: TokenComparison = {
      tokens,
      ranked,
      bestPick,
      comparedAt: Date.now(),
    };

    this.logger.info('Comparison complete', {
      bestMint: bestPick.mint,
      bestScore: best.overallScore,
      bestRecommendation: best.recommendation,
    });

    return comparison;
  }

  /**
   * Return all past evaluations (not evicted by cache TTL).
   */
  getEvaluationHistory(): Map<string, TokenEvaluation> {
    return new Map(this.history);
  }

  // ─── Data Fetching ────────────────────────────────────────

  private async fetchPumpFunData(mint: string): Promise<PumpFunTokenData | null> {
    try {
      const url = `${this.config.pumpFunApiBase}/coins/${mint}`;
      const res = await fetchWithTimeout(url, FETCH_TIMEOUT_MS);
      if (!res.ok) {
        this.logger.warn('Pump.fun API returned non-OK status', { mint, status: res.status });
        return null;
      }
      const data = (await res.json()) as PumpFunTokenData;
      return data;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error('Failed to fetch Pump.fun data', { mint, error: message });
      return null;
    }
  }

  private async fetchBondingCurveState(mint: string): Promise<BondingCurveState | null> {
    try {
      const mintPk = new PublicKey(mint);
      const [curvePda] = bondingCurvePda(mintPk, PUMP_SDK.programId);
      const accountInfo = await this.connection.getAccountInfo(curvePda);
      if (!accountInfo?.data) {
        this.logger.warn('Bonding curve account not found', { mint });
        return null;
      }

      // Decode bonding curve data using pump-sdk layout
      const decoded = PUMP_SDK.coder.accounts.decode('bondingCurve', accountInfo.data);
      const virtualSolReserves = BigInt(decoded.virtualSolReserves.toString());
      const virtualTokenReserves = BigInt(decoded.virtualTokenReserves.toString());
      const realSolReserves = BigInt(decoded.realSolReserves.toString());
      const realTokenReserves = BigInt(decoded.realTokenReserves.toString());

      const currentPriceSol = getTokenPrice(decoded.virtualSolReserves, decoded.virtualTokenReserves);
      const marketCapSol = lamportsToSol(virtualSolReserves);
      const graduationProgress = Math.min(
        100,
        (lamportsToSol(realSolReserves) / GRADUATION_THRESHOLD_SOL) * 100,
      );

      return {
        mint,
        virtualSolReserves: decoded.virtualSolReserves,
        virtualTokenReserves: decoded.virtualTokenReserves,
        realSolReserves: decoded.realSolReserves,
        realTokenReserves: decoded.realTokenReserves,
        complete: decoded.complete ?? false,
        currentPriceSol,
        marketCapSol,
        graduationProgress,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error('Failed to fetch bonding curve state', { mint, error: message });
      return null;
    }
  }

  private async fetchHolderData(
    mint: string,
  ): Promise<{
    count: number;
    topHolders: Array<{ address: string; balance: bigint; percent: number }>;
    totalSupply: bigint;
    topHolderPercent: number;
    gini: number;
  }> {
    try {
      const mintPk = new PublicKey(mint);
      const result = await this.connection.getTokenLargestAccounts(mintPk);
      const accounts = result.value;

      if (accounts.length === 0) {
        return { count: 0, topHolders: [], totalSupply: 0n, topHolderPercent: 0, gini: 0 };
      }

      // Calculate total from what we can see (getTokenLargestAccounts returns top 20)
      let totalVisible = 0n;
      const holders: Array<{ address: string; balance: bigint; percent: number }> = [];

      for (const account of accounts) {
        const balance = BigInt(account.amount);
        totalVisible += balance;
        holders.push({
          address: account.address.toBase58(),
          balance,
          percent: 0, // computed after total
        });
      }

      // Get total supply for accurate percentages
      const supplyResult = await this.connection.getTokenSupply(mintPk);
      const totalSupply = BigInt(supplyResult.value.amount);

      // Recalculate percentages against total supply
      for (const h of holders) {
        h.percent = totalSupply > 0n
          ? Number((h.balance * 10000n) / totalSupply) / 100
          : 0;
      }

      const topHolderPercent = holders.length > 0 ? holders[0].percent : 0;

      // Compute Gini coefficient from visible balances
      const balanceNumbers = holders.map(h => Number(h.balance));
      const gini = computeGini(balanceNumbers);

      // Estimate total holder count (getTokenLargestAccounts caps at 20)
      // Use getProgramAccounts with dataSize filter for an accurate count
      const holderCount = await this.estimateHolderCount(mintPk);

      return {
        count: holderCount,
        topHolders: holders.slice(0, MAX_HOLDER_FETCH),
        totalSupply,
        topHolderPercent,
        gini,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error('Failed to fetch holder data', { mint, error: message });
      return { count: 0, topHolders: [], totalSupply: 0n, topHolderPercent: 0, gini: 0 };
    }
  }

  /**
   * Estimate the total number of token holder accounts using getTokenAccountsByMint
   * with a limit to avoid excessive RPC load.
   */
  private async estimateHolderCount(mintPk: PublicKey): Promise<number> {
    try {
      // Use getParsedProgramAccounts with the Token program, filtered by mint
      const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
      const accounts = await this.connection.getParsedProgramAccounts(TOKEN_PROGRAM_ID, {
        filters: [
          { dataSize: 165 }, // SPL Token Account size
          { memcmp: { offset: 0, bytes: mintPk.toBase58() } },
        ],
      });
      // Filter out zero-balance accounts
      return accounts.filter(a => {
        const parsed = a.account.data;
        if (typeof parsed === 'object' && 'parsed' in parsed) {
          const info = (parsed as { parsed: { info: { tokenAmount: TokenAmount } } }).parsed.info;
          return BigInt(info.tokenAmount.amount) > 0n;
        }
        return true;
      }).length;
    } catch {
      // Fall back to top-20 count if getParsedProgramAccounts is unavailable
      return MAX_HOLDER_FETCH;
    }
  }

  private async fetchTransactionData(
    mint: string,
  ): Promise<{
    totalCount: number;
    uniqueWallets: number;
    buySellRatio: number;
    tradeSizeVariance: number;
    timingRegularity: number;
    signatures: TradeSignature[];
  }> {
    try {
      const mintPk = new PublicKey(mint);
      const [curvePda] = bondingCurvePda(mintPk, PUMP_SDK.programId);

      // Fetch recent transaction signatures for the bonding curve
      const sigInfos = await this.connection.getSignaturesForAddress(curvePda, {
        limit: MAX_TX_SIGNATURES,
      });

      if (sigInfos.length === 0) {
        return {
          totalCount: 0,
          uniqueWallets: 0,
          buySellRatio: 0.5,
          tradeSizeVariance: 0,
          timingRegularity: 1,
          signatures: [],
        };
      }

      const signatures: TradeSignature[] = sigInfos.map(s => ({
        signature: s.signature,
        slot: s.slot,
        blockTime: s.blockTime ?? null,
      }));

      // Parse a subset of transactions for detailed analysis
      const txSubset = sigInfos.slice(0, 25);
      const txs = await this.connection.getParsedTransactions(
        txSubset.map(s => s.signature),
        { maxSupportedTransactionVersion: 0 },
      );

      const walletSet = new Set<string>();
      let buyCount = 0;
      let sellCount = 0;
      const tradeSizes: number[] = [];
      const timestamps: number[] = [];

      for (const tx of txs) {
        if (!tx?.meta || tx.meta.err) continue;

        // Extract the signer (fee payer) as the wallet
        const feePayer = tx.transaction.message.accountKeys[0]?.pubkey.toBase58();
        if (feePayer) walletSet.add(feePayer);

        // Estimate buy vs sell from SOL balance change of the bonding curve
        const curveAccountIndex = tx.transaction.message.accountKeys.findIndex(
          k => k.pubkey.toBase58() === curvePda.toBase58(),
        );
        if (curveAccountIndex >= 0) {
          const preBalance = tx.meta.preBalances[curveAccountIndex] ?? 0;
          const postBalance = tx.meta.postBalances[curveAccountIndex] ?? 0;
          const solDelta = postBalance - preBalance;

          if (solDelta > 0) {
            buyCount++;
            tradeSizes.push(solDelta / LAMPORTS_PER_SOL);
          } else if (solDelta < 0) {
            sellCount++;
            tradeSizes.push(Math.abs(solDelta) / LAMPORTS_PER_SOL);
          }
        }

        // Track timestamps
        if (tx.blockTime) timestamps.push(tx.blockTime);
      }

      const totalTrades = buyCount + sellCount;
      const buySellRatio = totalTrades > 0 ? buyCount / totalTrades : 0.5;

      // Trade size variance: normalized std-dev / mean
      const tradeSizeVariance = this.computeCoeffOfVariation(tradeSizes);

      // Timing regularity: coefficient of variation of inter-trade intervals
      // Lower = more regular (bot-like), higher = more organic
      const timingRegularity = this.computeTimingRegularity(timestamps);

      return {
        totalCount: sigInfos.length,
        uniqueWallets: walletSet.size,
        buySellRatio,
        tradeSizeVariance,
        timingRegularity,
        signatures,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error('Failed to fetch transaction data', { mint, error: message });
      return {
        totalCount: 0,
        uniqueWallets: 0,
        buySellRatio: 0.5,
        tradeSizeVariance: 0,
        timingRegularity: 0.5,
        signatures: [],
      };
    }
  }

  // ─── Scoring Criteria ─────────────────────────────────────

  /**
   * Score 1: Bonding Curve Health (0-100)
   *
   * Measures on-chain reserves health, graduation proximity,
   * and the ratio of real to virtual reserves.
   */
  private scoreBondingCurveHealth(state: BondingCurveState | null): CriterionScore {
    const weight = this.config.weights.bondingCurveHealth;

    if (!state) {
      return {
        score: 0,
        weight,
        weighted: 0,
        details: 'Bonding curve data unavailable — cannot evaluate',
      };
    }

    let score = 0;
    const details: string[] = [];

    // 1. Graduation progress — closer to 85 SOL = healthier (0-30 pts)
    const gradPts = clamp(state.graduationProgress * 0.3, 0, 30);
    score += gradPts;
    details.push(`Graduation: ${state.graduationProgress.toFixed(1)}% (+${gradPts.toFixed(0)}pts)`);

    // 2. Real SOL reserves ratio — higher real vs virtual = more genuine buying (0-30 pts)
    const virtualSol = Number(state.virtualSolReserves.toString());
    const realSol = Number(state.realSolReserves.toString());
    const realRatio = virtualSol > 0 ? realSol / virtualSol : 0;
    const realPts = clamp(realRatio * 60, 0, 30); // max at ~50% real/virtual
    score += realPts;
    details.push(`Real/virtual SOL ratio: ${(realRatio * 100).toFixed(1)}% (+${realPts.toFixed(0)}pts)`);

    // 3. Market cap indicates traction (0-20 pts)
    const mcSol = state.marketCapSol;
    let mcPts = 0;
    if (mcSol >= 50) mcPts = 20;
    else if (mcSol >= 20) mcPts = 15;
    else if (mcSol >= 5) mcPts = 10;
    else if (mcSol >= 1) mcPts = 5;
    score += mcPts;
    details.push(`Market cap: ${mcSol.toFixed(2)} SOL (+${mcPts}pts)`);

    // 4. Already graduated = fully healthy (0-20 pts)
    if (state.complete) {
      score += 20;
      details.push('Graduated to AMM (+20pts)');
    }

    score = clamp(Math.round(score), 0, 100);
    return { score, weight, weighted: score * weight, details: details.join('; ') };
  }

  /**
   * Score 2: Holder Quality (0-100)
   *
   * Evaluates distribution fairness, holder count, top-holder concentration,
   * and dev wallet behavior.
   */
  private scoreHolderQuality(
    holders: {
      count: number;
      topHolders: Array<{ address: string; balance: bigint; percent: number }>;
      totalSupply: bigint;
      topHolderPercent: number;
      gini: number;
    },
    pumpData: PumpFunTokenData | null,
  ): CriterionScore {
    const weight = this.config.weights.holderQuality;

    if (holders.count === 0) {
      return {
        score: 10,
        weight,
        weighted: 10 * weight,
        details: 'No holder data available — assigned minimal score',
      };
    }

    let score = 0;
    const details: string[] = [];

    // 1. Holder count scoring (0-30 pts)
    const count = holders.count;
    let countPts: number;
    if (count >= 200) countPts = 30;
    else if (count >= 50) countPts = 24;
    else if (count >= 10) countPts = 15;
    else if (count >= 5) countPts = 6;
    else countPts = 2;
    score += countPts;
    details.push(`Holders: ${count} (+${countPts}pts)`);

    // 2. Distribution — Gini coefficient (0-25 pts)
    // Lower Gini = more equal = better
    const giniPts = clamp(Math.round((1 - holders.gini) * 25), 0, 25);
    score += giniPts;
    details.push(`Gini: ${holders.gini.toFixed(3)} (+${giniPts}pts)`);

    // 3. Top holder concentration penalty (0-25 pts deducted from 25)
    let concPts = 25;
    if (holders.topHolderPercent > 50) concPts -= 25;
    else if (holders.topHolderPercent > 30) concPts -= 15;
    else if (holders.topHolderPercent > 20) concPts -= 8;
    concPts = clamp(concPts, 0, 25);
    score += concPts;
    details.push(`Top holder: ${holders.topHolderPercent.toFixed(1)}% (+${concPts}pts)`);

    // 4. Dev wallet behavior (0-20 pts)
    // If creator is the top holder, it suggests dev hasn't dumped
    let devPts = 10; // neutral baseline
    if (pumpData?.creator) {
      const creatorAddr = pumpData.creator;
      const creatorHolder = holders.topHolders.find(h => h.address === creatorAddr);
      if (creatorHolder) {
        // Dev still holds — good if it's a reasonable amount
        if (creatorHolder.percent < 5) {
          devPts = 20; // dev holds minimal — decentralized
          details.push(`Dev holds ${creatorHolder.percent.toFixed(1)}% — well distributed (+20pts)`);
        } else if (creatorHolder.percent < 20) {
          devPts = 15;
          details.push(`Dev holds ${creatorHolder.percent.toFixed(1)}% — reasonable (+15pts)`);
        } else {
          devPts = 5;
          details.push(`Dev holds ${creatorHolder.percent.toFixed(1)}% — high concentration (+5pts)`);
        }
      } else {
        // Dev not in top holders — could mean sold or has tiny amount
        devPts = 12;
        details.push('Dev not in top holders — likely sold or minimal position (+12pts)');
      }
    }
    score += devPts;

    score = clamp(Math.round(score), 0, 100);
    return { score, weight, weighted: score * weight, details: details.join('; ') };
  }

  /**
   * Score 3: Volume Authenticity (0-100)
   *
   * Detects wash trading vs organic activity by analyzing trade patterns.
   */
  private scoreVolumeAuthenticity(
    txData: {
      totalCount: number;
      uniqueWallets: number;
      buySellRatio: number;
      tradeSizeVariance: number;
      timingRegularity: number;
    },
  ): CriterionScore {
    const weight = this.config.weights.volumeAuthenticity;

    if (txData.totalCount === 0) {
      return {
        score: 10,
        weight,
        weighted: 10 * weight,
        details: 'No transaction data available — minimal score',
      };
    }

    let score = 0;
    const details: string[] = [];

    // 1. Unique wallets / total trades ratio (0-30 pts)
    // Higher ratio = more unique participants = more authentic
    const walletRatio = txData.totalCount > 0
      ? txData.uniqueWallets / txData.totalCount
      : 0;
    let walletPts: number;
    if (walletRatio >= 0.5) walletPts = 30;
    else if (walletRatio >= 0.3) walletPts = 22;
    else if (walletRatio >= 0.15) walletPts = 15;
    else walletPts = 5; // very few unique wallets — suspicious
    score += walletPts;
    details.push(`Wallet diversity: ${(walletRatio * 100).toFixed(0)}% (+${walletPts}pts)`);

    // 2. Buy/sell ratio — healthy markets have balanced activity (0-25 pts)
    // Best: 40-60% buy ratio. Extremes are suspicious
    const bsr = txData.buySellRatio;
    let bsrPts: number;
    if (bsr >= 0.4 && bsr <= 0.6) bsrPts = 25;
    else if (bsr >= 0.3 && bsr <= 0.7) bsrPts = 18;
    else if (bsr >= 0.2 && bsr <= 0.8) bsrPts = 10;
    else bsrPts = 3; // all buys or all sells — very suspicious
    score += bsrPts;
    details.push(`Buy ratio: ${(bsr * 100).toFixed(0)}% (+${bsrPts}pts)`);

    // 3. Trade size variance — uniform sizes suggest bots (0-25 pts)
    // Higher variance = more organic
    const cvThreshold = txData.tradeSizeVariance;
    let sizePts: number;
    if (cvThreshold >= 1.0) sizePts = 25; // very diverse sizes
    else if (cvThreshold >= 0.5) sizePts = 18;
    else if (cvThreshold >= 0.2) sizePts = 10;
    else sizePts = 3; // nearly identical trade sizes — bot-like
    score += sizePts;
    details.push(`Size variety CV: ${cvThreshold.toFixed(2)} (+${sizePts}pts)`);

    // 4. Timing regularity — bots trade at fixed intervals (0-20 pts)
    // Higher irregularity = more organic
    const timing = txData.timingRegularity;
    let timePts: number;
    if (timing >= 0.8) timePts = 20; // very irregular — organic
    else if (timing >= 0.5) timePts = 14;
    else if (timing >= 0.3) timePts = 8;
    else timePts = 2; // highly regular — bot
    score += timePts;
    details.push(`Timing irregularity: ${timing.toFixed(2)} (+${timePts}pts)`);

    score = clamp(Math.round(score), 0, 100);
    return { score, weight, weighted: score * weight, details: details.join('; ') };
  }

  /**
   * Score 4: Narrative Strength (0-100)
   *
   * Evaluates token metadata quality, social engagement, and meme potential.
   */
  private scoreNarrativeStrength(pumpData: PumpFunTokenData | null): CriterionScore {
    const weight = this.config.weights.narrativeStrength;

    if (!pumpData) {
      return {
        score: 0,
        weight,
        weighted: 0,
        details: 'No Pump.fun metadata available — cannot evaluate narrative',
      };
    }

    let score = 0;
    const details: string[] = [];

    // 1. Name quality (0-15 pts)
    const nameLen = pumpData.name.length;
    let namePts: number;
    if (nameLen >= 2 && nameLen <= 12) namePts = 15;
    else if (nameLen <= 20) namePts = 10;
    else namePts = 5;
    score += namePts;
    details.push(`Name "${pumpData.name}" length=${nameLen} (+${namePts}pts)`);

    // 2. Has description (+10 pts)
    if (pumpData.description && pumpData.description.trim().length > 0) {
      score += 10;
      details.push('Has description (+10pts)');
    }

    // 3. Has image (+10 pts)
    if (pumpData.image_uri && pumpData.image_uri.trim().length > 0) {
      score += 10;
      details.push('Has image (+10pts)');
    }

    // 4. Reply count — social engagement (0-30 pts)
    const replies = pumpData.reply_count;
    let replyPts: number;
    if (replies >= 50) replyPts = 30;
    else if (replies >= 10) replyPts = 22;
    else if (replies >= 1) replyPts = 12;
    else replyPts = 3;
    score += replyPts;
    details.push(`Replies: ${replies} (+${replyPts}pts)`);

    // 5. Meme potential assessment (0-20 pts)
    const memeScore = assessMemeability(pumpData.name);
    const memePts = clamp(Math.round(memeScore / 5), 0, 20); // scale 0-100 → 0-20
    score += memePts;
    details.push(`Meme potential: ${memeScore}/100 (+${memePts}pts)`);

    // 6. Symbol quality — short symbols are recognizable (0-15 pts)
    const symLen = pumpData.symbol.length;
    let symPts: number;
    if (symLen >= 2 && symLen <= 5) symPts = 15;
    else if (symLen <= 8) symPts = 10;
    else symPts = 5;
    score += symPts;
    details.push(`Symbol "${pumpData.symbol}" (+${symPts}pts)`);

    score = clamp(Math.round(score), 0, 100);
    return { score, weight, weighted: score * weight, details: details.join('; ') };
  }

  /**
   * Score 5: Rug Risk (0-100, higher = SAFER)
   *
   * Deducts from 100 for each risk factor detected.
   */
  private scoreRugRisk(
    holders: {
      count: number;
      topHolders: Array<{ address: string; balance: bigint; percent: number }>;
      totalSupply: bigint;
      topHolderPercent: number;
      gini: number;
    },
    pumpData: PumpFunTokenData | null,
    bondingCurve: BondingCurveState | null,
    tokenAge: number,
  ): CriterionScore {
    const weight = this.config.weights.rugRisk;
    let score = 100;
    const details: string[] = [];
    const flags: string[] = [];

    // 1. Dev holds >20% of supply: -20pts
    if (pumpData?.creator) {
      const devHolder = holders.topHolders.find(h => h.address === pumpData.creator);
      if (devHolder && devHolder.percent > 20) {
        score -= 20;
        flags.push(`Dev holds ${devHolder.percent.toFixed(1)}% supply`);
      }
    }

    // 2. Single wallet holds >30%: -25pts
    if (holders.topHolderPercent > 30) {
      score -= 25;
      flags.push(`Top holder owns ${holders.topHolderPercent.toFixed(1)}%`);
    }

    // 3. Very new (<5 min): -15pts (potential honeypot)
    if (tokenAge > 0 && tokenAge < 5 * 60_000) {
      score -= 15;
      flags.push(`Very new token (${(tokenAge / 60_000).toFixed(1)}min old)`);
    }

    // 4. Very few holders (<5): -20pts
    if (holders.count > 0 && holders.count < 5) {
      score -= 20;
      flags.push(`Only ${holders.count} holders`);
    }

    // 5. No social proof (0 comments): -10pts
    if (pumpData && pumpData.reply_count === 0) {
      score -= 10;
      flags.push('Zero replies/comments');
    }

    // 6. Raydium pool exists but curve is complete with low reserves: -30pts
    if (pumpData?.raydium_pool && bondingCurve) {
      const realSol = Number(bondingCurve.realSolReserves.toString()) / LAMPORTS_PER_SOL;
      if (realSol < 1) {
        score -= 30;
        flags.push('Raydium pool exists but near-zero liquidity — potential rug');
      }
    }

    // 7. No metadata (name/symbol empty): -10pts
    if (!pumpData || !pumpData.name || pumpData.name.trim().length === 0) {
      score -= 10;
      flags.push('Missing token name');
    }

    if (flags.length > 0) {
      details.push(`Risk factors: ${flags.join(', ')}`);
    } else {
      details.push('No significant rug risk factors detected');
    }

    score = clamp(score, 0, 100);
    return { score, weight, weighted: score * weight, details: details.join('; ') };
  }

  /**
   * Score 6: Age Factor (0-100)
   *
   * Scores based on token age vs momentum. Early gems with high activity
   * score highest; stale tokens with flat volume score lowest.
   */
  private scoreAgeFactor(
    tokenAge: number,
    txData: {
      totalCount: number;
      uniqueWallets: number;
      buySellRatio: number;
      tradeSizeVariance: number;
      timingRegularity: number;
    },
  ): CriterionScore {
    const weight = this.config.weights.ageFactor;

    if (tokenAge <= 0) {
      return {
        score: 50,
        weight,
        weighted: 50 * weight,
        details: 'Token age unknown — assigned neutral score',
      };
    }

    const ageMinutes = tokenAge / 60_000;
    const ageHours = ageMinutes / 60;
    const hasHighVolume = txData.totalCount >= 20;
    const hasMediumVolume = txData.totalCount >= 5;

    let score: number;
    let reason: string;

    if (ageMinutes < 10 && hasHighVolume) {
      // Very new with high volume — early gem potential
      score = 90;
      reason = `Very new (${ageMinutes.toFixed(0)}min) with high volume — early gem potential`;
    } else if (ageMinutes < 10) {
      score = 65;
      reason = `Very new (${ageMinutes.toFixed(0)}min) but low volume — uncertain`;
    } else if (ageHours < 1 && hasHighVolume) {
      score = 80;
      reason = `New (${ageMinutes.toFixed(0)}min) with growing volume — traction building`;
    } else if (ageHours < 1) {
      score = 55;
      reason = `New (${ageMinutes.toFixed(0)}min) with low volume — needs momentum`;
    } else if (ageHours < 6 && hasMediumVolume) {
      score = 70;
      reason = `Recent (${ageHours.toFixed(1)}hrs) with sustained activity — healthy`;
    } else if (ageHours < 6) {
      score = 45;
      reason = `Recent (${ageHours.toFixed(1)}hrs) but volume fading`;
    } else if (ageHours < 24 && !hasMediumVolume) {
      score = 30;
      reason = `Aging (${ageHours.toFixed(1)}hrs) with declining interest — fading`;
    } else if (ageHours >= 24 && hasHighVolume) {
      score = 60;
      reason = `Old (${ageHours.toFixed(0)}hrs) with new volume surge — comeback potential`;
    } else if (ageHours >= 24) {
      score = 20;
      reason = `Stale (${ageHours.toFixed(0)}hrs) with flat volume — likely abandoned`;
    } else {
      score = 40;
      reason = `Age: ${ageHours.toFixed(1)}hrs, moderate activity`;
    }

    return {
      score: clamp(score, 0, 100),
      weight,
      weighted: clamp(score, 0, 100) * weight,
      details: reason,
    };
  }

  // ─── Recommendation & Confidence ─────────────────────────

  private computeRecommendation(
    overallScore: number,
  ): TokenEvaluation['recommendation'] {
    if (overallScore >= 80) return 'strong-buy';
    if (overallScore >= this.config.buyThreshold) return 'buy';
    if (overallScore >= 45) return 'hold';
    if (overallScore >= 25) return 'avoid';
    return 'strong-avoid';
  }

  private computeConfidence(
    pumpData: PumpFunTokenData | null,
    bondingCurve: BondingCurveState | null,
    holders: { count: number; topHolders: Array<{ address: string; balance: bigint; percent: number }> },
    txData: { totalCount: number; uniqueWallets: number },
  ): number {
    let dataPoints = 0;
    const maxDataPoints = 5;

    if (pumpData) dataPoints++;
    if (bondingCurve) dataPoints++;
    if (holders.count > 0) dataPoints++;
    if (txData.totalCount > 0) dataPoints++;
    if (txData.uniqueWallets > 3) dataPoints++; // sufficient wallet diversity

    return Math.round((dataPoints / maxDataPoints) * 100) / 100;
  }

  // ─── Insights & Red Flags ─────────────────────────────────

  private gatherInsights(
    scores: TokenEvaluation['scores'],
    pumpData: PumpFunTokenData | null,
    bondingCurve: BondingCurveState | null,
    tokenAge: number,
    holders: { count: number; topHolders: Array<{ address: string; balance: bigint; percent: number }> },
  ): string[] {
    const insights: string[] = [];

    if (bondingCurve?.graduationProgress && bondingCurve.graduationProgress > 70) {
      insights.push(`Near graduation (${bondingCurve.graduationProgress.toFixed(1)}%) — potential Raydium migration catalyst`);
    }

    if (bondingCurve?.complete) {
      insights.push('Already graduated to AMM — higher liquidity and visibility');
    }

    if (scores.holderQuality.score >= 70) {
      insights.push('Strong holder distribution — low whale concentration risk');
    }

    if (scores.volumeAuthenticity.score >= 75) {
      insights.push('Volume appears organic — diverse wallets and natural trade patterns');
    }

    if (scores.narrativeStrength.score >= 70 && pumpData) {
      insights.push(`Strong narrative: "${pumpData.name}" with ${pumpData.reply_count} community replies`);
    }

    if (tokenAge > 0 && tokenAge < 15 * 60_000 && scores.ageFactor.score >= 80) {
      insights.push('Early-stage with strong momentum — potential gem window');
    }

    if (holders.count >= 100) {
      insights.push(`${holders.count} holders — strong community adoption`);
    }

    if (scores.rugRisk.score >= 85) {
      insights.push('Low rug risk profile — no major red flags detected');
    }

    return insights;
  }

  private gatherRedFlags(
    scores: TokenEvaluation['scores'],
    holders: { count: number; topHolders: Array<{ address: string; balance: bigint; percent: number }>; topHolderPercent: number },
    pumpData: PumpFunTokenData | null,
    bondingCurve: BondingCurveState | null,
    tokenAge: number,
  ): string[] {
    const flags: string[] = [];

    if (scores.rugRisk.score < 40) {
      flags.push(`HIGH RUG RISK: score ${scores.rugRisk.score}/100`);
    }

    if (scores.volumeAuthenticity.score < 30) {
      flags.push('Volume appears heavily manipulated — possible wash trading');
    }

    if (holders.topHolderPercent > 50) {
      flags.push(`Single wallet holds ${holders.topHolderPercent.toFixed(1)}% — extreme concentration`);
    }

    if (holders.count > 0 && holders.count < 5) {
      flags.push(`Only ${holders.count} holders — very thin market`);
    }

    if (tokenAge > 0 && tokenAge < 3 * 60_000) {
      flags.push('Token is less than 3 minutes old — insufficient data for confident evaluation');
    }

    if (pumpData && pumpData.reply_count === 0 && tokenAge > 30 * 60_000) {
      flags.push('Zero community engagement after 30+ minutes — lack of interest');
    }

    if (scores.bondingCurveHealth.score < 20 && bondingCurve && !bondingCurve.complete) {
      flags.push('Bonding curve health is poor — low reserves and minimal traction');
    }

    if (scores.narrativeStrength.score < 20) {
      flags.push('Weak narrative — missing metadata, no engagement, low meme potential');
    }

    return flags;
  }

  // ─── Utility Methods ─────────────────────────────────────

  private computeCoeffOfVariation(values: number[]): number {
    if (values.length < 2) return 0;
    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    if (mean === 0) return 0;
    const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
    return Math.sqrt(variance) / mean;
  }

  private computeTimingRegularity(timestamps: number[]): number {
    if (timestamps.length < 3) return 0.5; // neutral
    const sorted = [...timestamps].sort((a, b) => a - b);
    const intervals: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      intervals.push(sorted[i] - sorted[i - 1]);
    }
    // CV of intervals: low = regular (bot), high = irregular (organic)
    const cv = this.computeCoeffOfVariation(intervals);
    // Normalize to 0-1 range: CV > 1.5 → fully organic
    return clamp(cv / 1.5, 0, 1);
  }

  private buildBestPickReasoning(best: TokenEvaluation, all: TokenEvaluation[]): string {
    const parts: string[] = [];
    parts.push(`${best.name} (${best.symbol}) scored ${best.overallScore}/100`);

    if (all.length > 1) {
      const second = all[1];
      const gap = best.overallScore - second.overallScore;
      parts.push(`leading by ${gap} points over ${second.name}`);
    }

    // Highlight strongest criterion
    const criteriaEntries = Object.entries(best.scores) as Array<
      [string, CriterionScore]
    >;
    const strongest = criteriaEntries.reduce((best, curr) =>
      curr[1].score > best[1].score ? curr : best,
    );
    parts.push(`strongest in ${strongest[0]} (${strongest[1].score}/100)`);

    if (best.redFlags.length === 0) {
      parts.push('with no red flags');
    } else {
      parts.push(`with ${best.redFlags.length} red flag(s) to monitor`);
    }

    return parts.join(', ');
  }
}
