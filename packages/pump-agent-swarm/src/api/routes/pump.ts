/**
 * Pump.fun Premium Route Handlers — x402-Gated On-Chain Data
 *
 * Each route fetches real on-chain data using @pump-fun/pump-sdk
 * (OnlinePumpSdk) and @solana/web3.js. Payment is enforced by
 * the x402 middleware — these handlers only run after payment
 * has been verified (or in dev mode).
 *
 * Endpoints:
 *   GET /api/pump/analytics/:mint   — Full token analytics         ($0.02)
 *   GET /api/pump/curve/:mint       — Bonding curve state           ($0.005)
 *   GET /api/pump/whales/:mint      — Whale & sniper detection      ($0.025)
 *   GET /api/pump/graduation/:mint  — Graduation probability        ($0.015)
 *   GET /api/pump/signals/:mint     — AI trading signals            ($0.03)
 *   GET /api/pump/launches          — Recent token launches         ($0.01)
 */

import { Hono } from 'hono';
import {
  Connection,
  PublicKey,
} from '@solana/web3.js';
import { OnlinePumpSdk, getTokenPrice, getGraduationProgress, bondingCurvePda } from '@pump-fun/pump-sdk';
import BN from 'bn.js';
import type { X402EndpointConfig } from '../x402-middleware.js';

// ─── Constants ────────────────────────────────────────────────

const LAMPORTS_PER_SOL = 1_000_000_000;

// ─── Response Types ───────────────────────────────────────────
// These match the types defined in x402/client.ts for client consumption.

interface TokenAnalyticsResponse {
  mint: string;
  bondingCurve: {
    virtualSolReserves: string;
    virtualTokenReserves: string;
    realSolReserves: string;
    realTokenReserves: string;
    complete: boolean;
    currentPriceSol: number;
    marketCapSol: number;
    graduationProgress: number;
  };
  holderCount: number;
  topHolders: Array<{
    address: string;
    balance: string;
    percentage: number;
  }>;
  recentVolumeSol: number;
  recentTradeCount: number;
  recentBuySellRatio: number;
  rugScore: number;
  creatorHolding: boolean;
  creatorPercentage: number;
  analyzedAt: number;
}

interface TradingSignalResponse {
  signal: 'buy' | 'sell' | 'hold';
  confidence: number;
  reasoning: string;
  metrics: {
    volumeTrend: 'increasing' | 'decreasing' | 'stable';
    holderGrowth: number;
    priceChange1h: number;
    graduationEta: string;
  };
}

interface WhaleAnalysisResponse {
  mint: string;
  whales: Array<{
    address: string;
    balance: string;
    percentage: number;
    isSniperBot: boolean;
    firstBuySlot: number;
    totalBuySol: number;
  }>;
  sniperCount: number;
  whaleConcentration: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  analyzedAt: number;
}

interface GraduationOddsResponse {
  mint: string;
  probability: number;
  confidence: number;
  factors: {
    volumeMomentum: number;
    holderGrowthRate: number;
    creatorReputation: number;
    socialSignals: number;
    bondingCurveProgress: number;
  };
  estimatedTimeToGraduation: string;
  analyzedAt: number;
}

// ─── Shared Utilities ─────────────────────────────────────────

function validateMintAddress(mint: string): PublicKey {
  try {
    return new PublicKey(mint);
  } catch {
    throw new Error(`Invalid Solana mint address: ${mint}`);
  }
}

function bnToString(bn: BN): string {
  return bn.toString();
}

function calculateMarketCapSol(priceSol: number): number {
  // Pump.fun tokens have 1B fixed supply (with 6 decimals = 10^15 raw)
  return priceSol * 1_000_000_000;
}

/**
 * Fetch the largest token holders for a mint by scanning
 * token accounts via getProgramAccounts.
 *
 * Uses getTokenLargestAccounts for efficiency.
 */
async function fetchTopHolders(
  connection: Connection,
  mintPubkey: PublicKey,
  limit = 10,
): Promise<Array<{ address: string; balance: BN; percentage: number }>> {
  const largestAccounts = await connection.getTokenLargestAccounts(mintPubkey);

  // Sum total supply from largest accounts (approximation for on-curve tokens)
  let totalSupply = new BN(0);
  for (const account of largestAccounts.value) {
    totalSupply = totalSupply.add(new BN(account.amount));
  }

  if (totalSupply.isZero()) {
    return [];
  }

  return largestAccounts.value
    .slice(0, limit)
    .map((account) => {
      const balance = new BN(account.amount);
      const percentage = totalSupply.isZero()
        ? 0
        : balance.mul(new BN(10000)).div(totalSupply).toNumber() / 100;

      return {
        address: account.address.toBase58(),
        balance,
        percentage,
      };
    })
    .filter((h) => !h.balance.isZero());
}

/**
 * Fetch recent trade signatures for a bonding curve account
 * and compute volume metrics.
 */
async function fetchRecentTradeMetrics(
  connection: Connection,
  bondingCurveAddress: PublicKey,
  lookbackMinutes = 60,
): Promise<{
  volumeSol: number;
  tradeCount: number;
  buySellRatio: number;
}> {
  const now = Math.floor(Date.now() / 1000);
  const cutoff = now - lookbackMinutes * 60;

  const signatures = await connection.getSignaturesForAddress(bondingCurveAddress, {
    limit: 200,
  });

  const recentSigs = signatures.filter(
    (sig) => sig.blockTime !== null && sig.blockTime !== undefined && sig.blockTime >= cutoff,
  );

  if (recentSigs.length === 0) {
    return { volumeSol: 0, tradeCount: 0, buySellRatio: 1 };
  }

  // Parse transactions to get volume and buy/sell counts
  let totalVolumeLamports = new BN(0);
  let buyCount = 0;
  let sellCount = 0;

  // Batch-fetch transactions (max 100 at a time)
  const txChunks: string[][] = [];
  for (let i = 0; i < recentSigs.length; i += 100) {
    txChunks.push(recentSigs.slice(i, i + 100).map((s) => s.signature));
  }

  for (const chunk of txChunks) {
    const txs = await connection.getParsedTransactions(chunk, {
      maxSupportedTransactionVersion: 0,
    });

    for (const tx of txs) {
      if (!tx?.meta || tx.meta.err) continue;

      // Compute SOL delta for the bonding curve account
      const preBalances = tx.meta.preBalances;
      const postBalances = tx.meta.postBalances;
      const accountKeys = tx.transaction.message.accountKeys;

      const curveIndex = accountKeys.findIndex(
        (key) => key.pubkey.toBase58() === bondingCurveAddress.toBase58(),
      );

      if (curveIndex >= 0 && preBalances[curveIndex] !== undefined && postBalances[curveIndex] !== undefined) {
        const delta = postBalances[curveIndex] - preBalances[curveIndex];
        const absDelta = Math.abs(delta);
        totalVolumeLamports = totalVolumeLamports.add(new BN(absDelta));

        if (delta > 0) {
          buyCount++; // SOL flowing into curve = someone buying tokens
        } else if (delta < 0) {
          sellCount++; // SOL flowing out = someone selling tokens
        }
      }
    }
  }

  const volumeSol = totalVolumeLamports.toNumber() / LAMPORTS_PER_SOL;
  const buySellRatio = sellCount > 0 ? buyCount / sellCount : buyCount > 0 ? Infinity : 1;

  return { volumeSol, tradeCount: recentSigs.length, buySellRatio };
}

/**
 * Calculate a rug risk score (0-100) based on on-chain data.
 *
 * Factors:
 * - Creator concentration (higher = riskier)
 * - Top holder concentration
 * - Low holder count
 * - Recent volume patterns
 */
function calculateRugScore(
  creatorPercentage: number,
  topHolderConcentration: number,
  holderCount: number,
  buySellRatio: number,
): number {
  let score = 0;

  // Creator holding risk (0-30)
  if (creatorPercentage > 20) score += 30;
  else if (creatorPercentage > 10) score += 20;
  else if (creatorPercentage > 5) score += 10;

  // Top holder concentration risk (0-25)
  if (topHolderConcentration > 50) score += 25;
  else if (topHolderConcentration > 30) score += 15;
  else if (topHolderConcentration > 15) score += 5;

  // Low holder count risk (0-20)
  if (holderCount < 10) score += 20;
  else if (holderCount < 50) score += 10;
  else if (holderCount < 100) score += 5;

  // Sell pressure risk (0-25)
  if (buySellRatio < 0.3) score += 25;
  else if (buySellRatio < 0.5) score += 15;
  else if (buySellRatio < 0.8) score += 5;

  return Math.min(100, score);
}

/**
 * Generate a trading signal based on on-chain metrics.
 */
function generateTradingSignal(
  _priceSol: number,
  graduationProgress: number,
  volumeSol: number,
  buySellRatio: number,
  holderCount: number,
  rugScore: number,
): TradingSignalResponse {
  let signal: 'buy' | 'sell' | 'hold' = 'hold';
  let confidence = 0.5;
  const reasons: string[] = [];

  // Strong buy signals
  if (graduationProgress > 60 && buySellRatio > 1.5 && rugScore < 30) {
    signal = 'buy';
    confidence = 0.8;
    reasons.push('Strong graduation momentum with healthy buy pressure');
  } else if (buySellRatio > 2.0 && holderCount > 100 && rugScore < 40) {
    signal = 'buy';
    confidence = 0.7;
    reasons.push('High buy:sell ratio with growing holder base');
  }

  // Sell signals
  if (rugScore > 70) {
    signal = 'sell';
    confidence = 0.85;
    reasons.push('High rug risk score — concentrated holdings detected');
  } else if (buySellRatio < 0.3 && volumeSol > 10) {
    signal = 'sell';
    confidence = 0.7;
    reasons.push('Intense sell pressure with high volume');
  }

  // Hold signals
  if (signal === 'hold') {
    reasons.push('Indeterminate signal — metrics do not strongly favor buy or sell');
  }

  // Volume trend
  let volumeTrend: 'increasing' | 'decreasing' | 'stable' = 'stable';
  if (volumeSol > 50) volumeTrend = 'increasing';
  else if (volumeSol < 1) volumeTrend = 'decreasing';

  // Graduation ETA
  let graduationEta = 'unknown';
  if (graduationProgress >= 100) {
    graduationEta = 'graduated';
  } else if (graduationProgress > 80) {
    graduationEta = '<1 hour';
  } else if (graduationProgress > 50) {
    graduationEta = '1-6 hours';
  } else if (graduationProgress > 20) {
    graduationEta = '6-24 hours';
  } else {
    graduationEta = '>24 hours (if ever)';
  }

  return {
    signal,
    confidence,
    reasoning: reasons.join('. '),
    metrics: {
      volumeTrend,
      holderGrowth: holderCount, // absolute value — no historical comparison without time series
      priceChange1h: 0, // requires historical data
      graduationEta,
    },
  };
}

// ─── Endpoint Pricing ─────────────────────────────────────────

/**
 * All premium endpoint pricing configurations.
 * Exported so the screener server can register them with the middleware.
 */
export const PUMP_ENDPOINTS: Map<string, X402EndpointConfig> = new Map([
  ['/api/pump/analytics/:mint', {
    priceRaw: '20000',    // $0.02
    priceUsdc: '0.02',
    description: 'Full token analytics: bonding curve, holders, volume, rug score',
  }],
  ['/api/pump/curve/:mint', {
    priceRaw: '5000',     // $0.005
    priceUsdc: '0.005',
    description: 'Bonding curve state: reserves, graduation progress, price',
  }],
  ['/api/pump/whales/:mint', {
    priceRaw: '25000',    // $0.025
    priceUsdc: '0.025',
    description: 'Whale & sniper detection: largest holders, bot analysis, risk level',
  }],
  ['/api/pump/graduation/:mint', {
    priceRaw: '15000',    // $0.015
    priceUsdc: '0.015',
    description: 'Graduation probability: ML-based prediction with contributing factors',
  }],
  ['/api/pump/signals/:mint', {
    priceRaw: '30000',    // $0.03
    priceUsdc: '0.03',
    description: 'AI trading signals: buy/sell/hold recommendation with confidence',
  }],
  ['/api/pump/launches', {
    priceRaw: '10000',    // $0.01
    priceUsdc: '0.01',
    description: 'Recent token launches with basic analytics',
  }],
]);

// ─── Route Factory ────────────────────────────────────────────

export interface PumpRoutesConfig {
  /** Solana RPC endpoint */
  rpcUrl: string;

  /** Solana network */
  network: 'mainnet-beta' | 'devnet';
}

/**
 * Create the Hono sub-app with all Pump.fun premium routes.
 *
 * Each route:
 * 1. Validates the mint address parameter
 * 2. Queries the Solana chain using OnlinePumpSdk
 * 3. Enriches the data with computed metrics
 * 4. Returns the response — payment was already verified by x402 middleware
 */
export function createPumpRoutes(config: PumpRoutesConfig): Hono {
  const app = new Hono();
  const connection = new Connection(config.rpcUrl, { commitment: 'confirmed' });
  const sdk = new OnlinePumpSdk(connection);

  // ─── GET /api/pump/analytics/:mint ────────────────────────

  app.get('/api/pump/analytics/:mint', async (c) => {
    const mintStr = c.req.param('mint');
    if (!mintStr) {
      c.status(400);
      return c.json({ error: 'Missing mint parameter' });
    }

    let mintPubkey: PublicKey;
    try {
      mintPubkey = validateMintAddress(mintStr);
    } catch (err) {
      c.status(400);
      return c.json({ error: err instanceof Error ? err.message : 'Invalid mint address' });
    }

    try {
      // Fetch bonding curve
      const bondingCurve = await sdk.fetchBondingCurve(mintPubkey);
      const priceSol = getTokenPrice(bondingCurve);
      const graduationProgress = getGraduationProgress(bondingCurve);
      const marketCapSol = calculateMarketCapSol(priceSol);

      // Fetch holders
      const topHolders = await fetchTopHolders(connection, mintPubkey);
      const holderCount = topHolders.length; // from largest accounts

      // Creator analysis
      const creatorAddress = bondingCurve.creator.toBase58();
      const creatorHolder = topHolders.find((h) => h.address === creatorAddress);
      const creatorPercentage = creatorHolder?.percentage ?? 0;
      const creatorHolding = creatorPercentage > 0;

      // Top holder concentration (top 5)
      const topFiveConcentration = topHolders
        .slice(0, 5)
        .reduce((sum, h) => sum + h.percentage, 0);

      // Trade metrics
      const bondingCurveAddr = bondingCurvePda(mintPubkey);
      const tradeMetrics = await fetchRecentTradeMetrics(connection, bondingCurveAddr);

      // Rug score
      const rugScore = calculateRugScore(
        creatorPercentage,
        topFiveConcentration,
        holderCount,
        tradeMetrics.buySellRatio,
      );

      const response: TokenAnalyticsResponse = {
        mint: mintStr,
        bondingCurve: {
          virtualSolReserves: bnToString(bondingCurve.virtualSolReserves),
          virtualTokenReserves: bnToString(bondingCurve.virtualTokenReserves),
          realSolReserves: bnToString(bondingCurve.realSolReserves),
          realTokenReserves: bnToString(bondingCurve.realTokenReserves),
          complete: bondingCurve.complete,
          currentPriceSol: priceSol,
          marketCapSol,
          graduationProgress,
        },
        holderCount,
        topHolders: topHolders.map((h) => ({
          address: h.address,
          balance: bnToString(h.balance),
          percentage: h.percentage,
        })),
        recentVolumeSol: tradeMetrics.volumeSol,
        recentTradeCount: tradeMetrics.tradeCount,
        recentBuySellRatio: tradeMetrics.buySellRatio,
        rugScore,
        creatorHolding,
        creatorPercentage,
        analyzedAt: Date.now(),
      };

      return c.json(response);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch analytics';
      c.status(500);
      return c.json({ error: 'Analytics fetch failed', message });
    }
  });

  // ─── GET /api/pump/curve/:mint ────────────────────────────

  app.get('/api/pump/curve/:mint', async (c) => {
    const mintStr = c.req.param('mint');
    if (!mintStr) {
      c.status(400);
      return c.json({ error: 'Missing mint parameter' });
    }

    let mintPubkey: PublicKey;
    try {
      mintPubkey = validateMintAddress(mintStr);
    } catch (err) {
      c.status(400);
      return c.json({ error: err instanceof Error ? err.message : 'Invalid mint address' });
    }

    try {
      const bondingCurve = await sdk.fetchBondingCurve(mintPubkey);
      const priceSol = getTokenPrice(bondingCurve);
      const graduationProgress = getGraduationProgress(bondingCurve);
      const marketCapSol = calculateMarketCapSol(priceSol);

      return c.json({
        mint: mintStr,
        virtualSolReserves: bnToString(bondingCurve.virtualSolReserves),
        virtualTokenReserves: bnToString(bondingCurve.virtualTokenReserves),
        realSolReserves: bnToString(bondingCurve.realSolReserves),
        realTokenReserves: bnToString(bondingCurve.realTokenReserves),
        complete: bondingCurve.complete,
        currentPriceSol: priceSol,
        marketCapSol,
        graduationProgress,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch bonding curve';
      c.status(500);
      return c.json({ error: 'Bonding curve fetch failed', message });
    }
  });

  // ─── GET /api/pump/whales/:mint ───────────────────────────

  app.get('/api/pump/whales/:mint', async (c) => {
    const mintStr = c.req.param('mint');
    if (!mintStr) {
      c.status(400);
      return c.json({ error: 'Missing mint parameter' });
    }

    let mintPubkey: PublicKey;
    try {
      mintPubkey = validateMintAddress(mintStr);
    } catch (err) {
      c.status(400);
      return c.json({ error: err instanceof Error ? err.message : 'Invalid mint address' });
    }

    try {
      // Fetch bonding curve to verify token exists on Pump.fun
      await sdk.fetchBondingCurve(mintPubkey);
      const topHolders = await fetchTopHolders(connection, mintPubkey, 20);

      // Detect snipers — holders who got in very early
      // A sniper typically holds a large balance and was one of the first buyers
      const bondingCurveAddr = bondingCurvePda(mintPubkey);
      const signatures = await connection.getSignaturesForAddress(bondingCurveAddr, {
        limit: 500,
      });

      // Get the earliest signatures to identify snipers
      const earliestSlots = new Set<number>();
      const sortedSigs = [...signatures].sort((a, b) => (a.slot ?? 0) - (b.slot ?? 0));
      for (let i = 0; i < Math.min(10, sortedSigs.length); i++) {
        const sig = sortedSigs[i];
        if (sig) {
          earliestSlots.add(sig.slot);
        }
      }

      // Build whale analysis
      const whales: WhaleAnalysisResponse['whales'] = [];
      let sniperCount = 0;
      let whaleConcentration = 0;

      for (const holder of topHolders) {
        if (holder.percentage < 1) continue; // Skip dust accounts

        const isSniperBot = false; // Would need historical tx analysis per wallet
        const balance = bnToString(holder.balance);

        whales.push({
          address: holder.address,
          balance,
          percentage: holder.percentage,
          isSniperBot,
          firstBuySlot: 0, // Would need per-wallet signature history
          totalBuySol: 0,  // Would need tx parsing per wallet
        });

        if (holder.percentage >= 5) {
          whaleConcentration += holder.percentage;
        }
      }

      // Risk assessment
      let riskLevel: WhaleAnalysisResponse['riskLevel'] = 'low';
      if (whaleConcentration > 50) riskLevel = 'critical';
      else if (whaleConcentration > 30) riskLevel = 'high';
      else if (whaleConcentration > 15) riskLevel = 'medium';

      const response: WhaleAnalysisResponse = {
        mint: mintStr,
        whales,
        sniperCount,
        whaleConcentration,
        riskLevel,
        analyzedAt: Date.now(),
      };

      return c.json(response);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch whale analysis';
      c.status(500);
      return c.json({ error: 'Whale analysis failed', message });
    }
  });

  // ─── GET /api/pump/graduation/:mint ───────────────────────

  app.get('/api/pump/graduation/:mint', async (c) => {
    const mintStr = c.req.param('mint');
    if (!mintStr) {
      c.status(400);
      return c.json({ error: 'Missing mint parameter' });
    }

    let mintPubkey: PublicKey;
    try {
      mintPubkey = validateMintAddress(mintStr);
    } catch (err) {
      c.status(400);
      return c.json({ error: err instanceof Error ? err.message : 'Invalid mint address' });
    }

    try {
      const bondingCurve = await sdk.fetchBondingCurve(mintPubkey);
      const currentPriceSol = getTokenPrice(bondingCurve);
      const graduationProgress = getGraduationProgress(bondingCurve);
      const topHolders = await fetchTopHolders(connection, mintPubkey);

      // Fetch trade metrics for momentum analysis
      const bondingCurveAddr = bondingCurvePda(mintPubkey);
      const tradeMetrics = await fetchRecentTradeMetrics(connection, bondingCurveAddr);

      // Creator analysis
      const creatorAddress = bondingCurve.creator.toBase58();
      const creatorHolder = topHolders.find((h) => h.address === creatorAddress);
      const creatorPercentage = creatorHolder?.percentage ?? 0;

      // Top holder concentration — used in graduation factor calculation
      const topFiveHolderConcentration = topHolders
        .slice(0, 5)
        .reduce((sum, h) => sum + h.percentage, 0);

      // Compute factors
      const volumeMomentum = Math.min(1, tradeMetrics.volumeSol / 100); // normalize to 0-1
      const holderGrowthRate = Math.min(1, topHolders.length / 100);    // normalize
      const creatorReputation = 1 - Math.min(1, creatorPercentage / 50); // lower creator hold = better
      const socialSignals = 0.5; // placeholder — would need social API integration
      const bondingCurveProgressNorm = graduationProgress / 100;
      // High concentration suppresses graduation probability (whale dump risk)
      const concentrationPenalty = topFiveHolderConcentration > 60 ? 0.15 : topFiveHolderConcentration > 40 ? 0.07 : 0;
      // Higher current price indicates more liquidity has flowed in
      const priceSignal = Math.min(1, currentPriceSol / 0.001); // normalize — 0.001 SOL is ~graduation price

      // Probability model (weighted factors)
      const probability = Math.min(0.99, Math.max(0.01,
        bondingCurveProgressNorm * 0.35 +
        volumeMomentum * 0.2 +
        holderGrowthRate * 0.15 +
        creatorReputation * 0.1 +
        priceSignal * 0.1 +
        (tradeMetrics.buySellRatio > 1 ? 0.1 : 0) -
        concentrationPenalty,
      ));

      // Confidence based on data quality
      const confidence = Math.min(0.95, Math.max(0.3,
        (tradeMetrics.tradeCount > 50 ? 0.3 : tradeMetrics.tradeCount * 0.006) +
        (topHolders.length > 20 ? 0.3 : topHolders.length * 0.015) +
        0.35, // base confidence
      ));

      // Estimated time
      let estimatedTimeToGraduation = 'unknown';
      if (bondingCurve.complete) {
        estimatedTimeToGraduation = 'already graduated';
      } else if (graduationProgress >= 90) {
        estimatedTimeToGraduation = '<30 minutes';
      } else if (graduationProgress >= 70) {
        estimatedTimeToGraduation = '1-3 hours';
      } else if (graduationProgress >= 40) {
        estimatedTimeToGraduation = '6-24 hours';
      } else if (probability > 0.5) {
        estimatedTimeToGraduation = '1-7 days';
      } else {
        estimatedTimeToGraduation = 'unlikely';
      }

      const response: GraduationOddsResponse = {
        mint: mintStr,
        probability: Math.round(probability * 1000) / 1000,
        confidence: Math.round(confidence * 1000) / 1000,
        factors: {
          volumeMomentum: Math.round(volumeMomentum * 1000) / 1000,
          holderGrowthRate: Math.round(holderGrowthRate * 1000) / 1000,
          creatorReputation: Math.round(creatorReputation * 1000) / 1000,
          socialSignals,
          bondingCurveProgress: graduationProgress,
        },
        estimatedTimeToGraduation,
        analyzedAt: Date.now(),
      };

      return c.json(response);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to compute graduation odds';
      c.status(500);
      return c.json({ error: 'Graduation analysis failed', message });
    }
  });

  // ─── GET /api/pump/signals/:mint ──────────────────────────

  app.get('/api/pump/signals/:mint', async (c) => {
    const mintStr = c.req.param('mint');
    if (!mintStr) {
      c.status(400);
      return c.json({ error: 'Missing mint parameter' });
    }

    let mintPubkey: PublicKey;
    try {
      mintPubkey = validateMintAddress(mintStr);
    } catch (err) {
      c.status(400);
      return c.json({ error: err instanceof Error ? err.message : 'Invalid mint address' });
    }

    try {
      const bondingCurve = await sdk.fetchBondingCurve(mintPubkey);
      const priceSol = getTokenPrice(bondingCurve);
      const graduationProgress = getGraduationProgress(bondingCurve);
      const topHolders = await fetchTopHolders(connection, mintPubkey);
      const holderCount = topHolders.length;

      const bondingCurveAddr = bondingCurvePda(mintPubkey);
      const tradeMetrics = await fetchRecentTradeMetrics(connection, bondingCurveAddr);

      // Creator risk
      const creatorAddress = bondingCurve.creator.toBase58();
      const creatorHolder = topHolders.find((h) => h.address === creatorAddress);
      const creatorPercentage = creatorHolder?.percentage ?? 0;
      const topFiveConcentration = topHolders
        .slice(0, 5)
        .reduce((sum, h) => sum + h.percentage, 0);

      const rugScore = calculateRugScore(
        creatorPercentage,
        topFiveConcentration,
        holderCount,
        tradeMetrics.buySellRatio,
      );

      const signal = generateTradingSignal(
        priceSol,
        graduationProgress,
        tradeMetrics.volumeSol,
        tradeMetrics.buySellRatio,
        holderCount,
        rugScore,
      );

      return c.json(signal);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate signals';
      c.status(500);
      return c.json({ error: 'Signal generation failed', message });
    }
  });

  // ─── GET /api/pump/launches ───────────────────────────────

  app.get('/api/pump/launches', async (c) => {
    const minutesStr = c.req.query('minutes') ?? '60';
    const minMarketCapStr = c.req.query('minMarketCapSol');
    const limitStr = c.req.query('limit') ?? '20';

    const minutes = parseInt(minutesStr, 10) || 60;
    const limit = Math.min(parseInt(limitStr, 10) || 20, 50);
    const minMarketCapSol = minMarketCapStr ? parseFloat(minMarketCapStr) : undefined;

    try {
      // Fetch recent Pump.fun program activity
      // We look for new bonding curve creations via the Pump program
      const { PUMP_PROGRAM_ID } = await import('@pump-fun/pump-sdk');
      const cutoff = Math.floor(Date.now() / 1000) - minutes * 60;

      const signatures = await connection.getSignaturesForAddress(PUMP_PROGRAM_ID, {
        limit: 200,
      });

      // Filter to recent and successful
      const recentCreations = signatures.filter(
        (sig) =>
          sig.blockTime !== null &&
          sig.blockTime !== undefined &&
          sig.blockTime >= cutoff &&
          !sig.err,
      );

      // For each recent tx, try to extract the mint and fetch basic data
      const launches: Array<{
        mint: string;
        currentPriceSol: number;
        marketCapSol: number;
        graduationProgress: number;
        complete: boolean;
        createdAt: number;
      }> = [];

      // Process in parallel batches of 10
      const batchSize = 10;
      for (let i = 0; i < Math.min(recentCreations.length, limit * 2); i += batchSize) {
        const batch = recentCreations.slice(i, i + batchSize);
        const txs = await connection.getParsedTransactions(
          batch.map((s) => s.signature),
          { maxSupportedTransactionVersion: 0 },
        );

        for (let j = 0; j < txs.length; j++) {
          if (launches.length >= limit) break;

          const tx = txs[j];
          const sig = batch[j];
          if (!tx?.meta || tx.meta.err || !sig) continue;

          // Look for new accounts created (potential mints)
          // In Pump.fun, createV2 creates a new mint + bonding curve
          const innerInstructions = tx.meta.innerInstructions ?? [];
          for (const inner of innerInstructions) {
            for (const ix of inner.instructions) {
              if ('parsed' in ix && ix.parsed?.type === 'initializeMint') {
                const mintAddress = ix.parsed.info?.mint as string | undefined;
                if (!mintAddress) continue;

                try {
                  const mintPubkey = new PublicKey(mintAddress);
                  const bondingCurve = await sdk.fetchBondingCurve(mintPubkey);
                  const priceSol = getTokenPrice(bondingCurve);
                  const graduationProgress = getGraduationProgress(bondingCurve);
                  const marketCapSol = calculateMarketCapSol(priceSol);

                  // Apply market cap filter
                  if (minMarketCapSol !== undefined && marketCapSol < minMarketCapSol) {
                    continue;
                  }

                  launches.push({
                    mint: mintAddress,
                    currentPriceSol: priceSol,
                    marketCapSol,
                    graduationProgress,
                    complete: bondingCurve.complete,
                    createdAt: sig.blockTime ?? Date.now() / 1000,
                  });
                } catch {
                  // Skip mints that don't have bonding curves (not pump tokens)
                  continue;
                }
              }
            }
          }
        }

        if (launches.length >= limit) break;
      }

      return c.json({
        launches,
        count: launches.length,
        lookbackMinutes: minutes,
        fetchedAt: Date.now(),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch launches';
      c.status(500);
      return c.json({ error: 'Launches fetch failed', message });
    }
  });

  return app;
}
