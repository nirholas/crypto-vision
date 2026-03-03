/**
 * Crypto Vision — Portfolio Analysis Routes
 *
 * Advanced portfolio analytics — valuation, risk, correlation, diversification,
 * backtest, optimization, deep analysis, and wallet auto-detect.
 *
 * POST /api/portfolio/value             — Portfolio valuation (post holdings)
 * POST /api/portfolio/calculate         — Full PnL portfolio calculation
 * POST /api/portfolio/analyze           — Deep portfolio analysis
 * POST /api/portfolio/optimize          — Portfolio optimization suggestions
 * POST /api/portfolio/risk              — Portfolio risk assessment (VaR, Sharpe, etc.)
 * POST /api/portfolio/correlation       — Correlation matrix for assets
 * POST /api/portfolio/backtest          — Historical portfolio backtest
 * POST /api/portfolio/diversification   — Diversification score for a portfolio
 * GET  /api/portfolio/volatility/:id    — Volatility & risk metrics for a coin
 * GET  /api/portfolio/wallet/:address   — Auto-detect portfolio from wallet
 *
 * @copyright 2024-2026 nirholas. All rights reserved.
 */

import { z } from "zod";
import { Hono } from "hono";
import { cache } from "../lib/cache.js";
import * as cg from "../sources/coingecko.js";
import * as evm from "../sources/evm.js";
import * as portfolio from "../sources/portfolio.js";
import { ApiError } from "../lib/api-error.js";
import {
  PortfolioHoldingsSchema,
  AssetIdsSchema,
  RiskAnalysisSchema,
  CoinIdSchema,
  validateBody,
} from "../lib/validation.js";

export const portfolioRoutes = new Hono();

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

/** Pearson correlation coefficient between two number arrays */
function pearson(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n < 2) return 0;
  let sumA = 0, sumB = 0, sumAB = 0, sumA2 = 0, sumB2 = 0;
  for (let i = 0; i < n; i++) {
    sumA += a[i]; sumB += b[i];
    sumAB += a[i] * b[i];
    sumA2 += a[i] * a[i]; sumB2 += b[i] * b[i];
  }
  const num = n * sumAB - sumA * sumB;
  const den = Math.sqrt((n * sumA2 - sumA * sumA) * (n * sumB2 - sumB * sumB));
  return den === 0 ? 0 : Math.round((num / den) * 10000) / 10000;
}

/** Daily log returns from a price series */
function logReturns(prices: number[]): number[] {
  const returns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    if (prices[i - 1] > 0) returns.push(Math.log(prices[i] / prices[i - 1]));
  }
  return returns;
}

/** Annualized volatility from daily log returns */
function annualizedVol(returns: number[]): number {
  if (returns.length < 2) return 0;
  const mean = returns.reduce((s, r) => s + r, 0) / returns.length;
  const variance = returns.reduce((s, r) => s + (r - mean) ** 2, 0) / (returns.length - 1);
  return Math.sqrt(variance * 365);
}

/** Max drawdown from a price series */
function maxDrawdown(prices: number[]): { drawdown: number; peakIdx: number; troughIdx: number } {
  if (prices.length < 2) return { drawdown: 0, peakIdx: 0, troughIdx: 0 };
  let peak = prices[0], maxDD = 0, peakIdx = 0, troughIdx = 0, curPeakIdx = 0;
  for (let i = 1; i < prices.length; i++) {
    if (prices[i] > peak) { peak = prices[i]; curPeakIdx = i; }
    const dd = (peak - prices[i]) / peak;
    if (dd > maxDD) { maxDD = dd; peakIdx = curPeakIdx; troughIdx = i; }
  }
  return { drawdown: maxDD, peakIdx, troughIdx };
}

/** Value at Risk (VaR) via historical simulation */
function valueAtRisk(returns: number[], confidence: number): number {
  if (returns.length < 5) return 0;
  const sorted = [...returns].sort((a, b) => a - b);
  const idx = Math.floor((1 - confidence) * sorted.length);
  return Math.abs(sorted[idx]);
}

/** Herfindahl-Hirschman Index from allocation weights */
function herfindahlIndex(weights: number[]): number {
  return weights.reduce((sum, w) => sum + w * w, 0);
}

/** Diversification score (0-100) from position values */
function computeDiversificationScore(
  positions: Array<{ value: number }>,
  totalValue: number,
): number {
  if (positions.length < 2 || totalValue <= 0) return 0;
  const weights = positions.map((p) => p.value / totalValue);
  const hhi = herfindahlIndex(weights);
  const n = positions.length;
  const normalizedHHI = n > 1 ? (hhi - 1 / n) / (1 - 1 / n) : 1;
  return Math.round((1 - normalizedHHI) * 100 * 100) / 100;
}

/** Risk-free rate (US T-bill ~4.5% annual as of 2026) */
const RISK_FREE_DAILY = 0.045 / 365;

// ═══════════════════════════════════════════════════════════════
// Zod Schemas for new endpoints
// ═══════════════════════════════════════════════════════════════

const PortfolioCalculateSchema = z.object({
  holdings: z.array(z.object({
    coinId: CoinIdSchema,
    amount: z.number().positive("amount must be positive"),
    costBasis: z.number().optional(),
  })).min(1, "at least 1 holding required").max(100, "max 100 holdings"),
});

const PortfolioAnalyzeSchema = z.object({
  holdings: z.array(z.object({
    coinId: CoinIdSchema,
    amount: z.number().positive(),
    costBasis: z.number().optional(),
  })).min(1).max(100),
});

const PortfolioOptimizeSchema = z.object({
  holdings: z.array(z.object({
    coinId: CoinIdSchema,
    allocation: z.number().min(0).max(100),
  })).min(2, "at least 2 holdings required").max(50),
  riskTolerance: z.enum(["conservative", "moderate", "aggressive"]).default("moderate"),
  targetReturn: z.number().optional(),
});

const PortfolioRiskSchema = z.object({
  holdings: z.array(z.object({
    coinId: CoinIdSchema,
    allocation: z.number().min(0).max(100),
  })).min(1).max(50),
});

const PortfolioCorrelationSchema = z.object({
  coinIds: z.array(CoinIdSchema).min(2, "at least 2 coins required").max(20, "max 20 coins"),
  days: z.number().int().min(7).max(365).default(90),
});

const PortfolioBacktestSchema = z.object({
  holdings: z.array(z.object({
    coinId: CoinIdSchema,
    allocation: z.number().min(0).max(100),
  })).min(1).max(50),
  days: z.number().int().min(7).max(365).default(90),
  rebalanceFrequency: z.enum(["daily", "weekly", "monthly", "none"]).default("none"),
  initialInvestment: z.number().positive().default(10000),
});

// ═══════════════════════════════════════════════════════════════
// POST /api/portfolio/calculate — Full PnL Portfolio Calculation
// ═══════════════════════════════════════════════════════════════

portfolioRoutes.post("/calculate", async (c) => {
  const parsed = await validateBody(c, PortfolioCalculateSchema);
  if (!parsed.success) return parsed.error;
  const { holdings } = parsed.data;

  const coinIds = holdings.map((h) => h.coinId).join(",");
  const priceData = await cg.getPrice(coinIds, "usd", true);

  const positions = holdings.map((holding) => {
    const prices = priceData[holding.coinId];
    if (!prices) return null;

    const price = prices.usd ?? 0;
    const currentValue = holding.amount * price;
    const costBasisTotal = holding.costBasis != null ? holding.amount * holding.costBasis : null;
    const pnl = costBasisTotal != null ? currentValue - costBasisTotal : null;
    const pnlPercent = costBasisTotal != null && costBasisTotal > 0
      ? ((currentValue - costBasisTotal) / costBasisTotal) * 100
      : null;

    return {
      coinId: holding.coinId,
      amount: holding.amount,
      price,
      value: currentValue,
      change24h: (prices.usd_24h_change as number | undefined) ?? null,
      costBasis: holding.costBasis ?? null,
      costBasisTotal,
      pnl,
      pnlPercent,
    };
  }).filter((p): p is NonNullable<typeof p> => p !== null);

  const totalValue = positions.reduce((sum, p) => sum + p.value, 0);
  const totalCostBasis = positions.reduce((sum, p) => sum + (p.costBasisTotal ?? 0), 0);

  return c.json({
    data: {
      totalValue,
      totalCostBasis: totalCostBasis || null,
      totalPnl: totalCostBasis ? totalValue - totalCostBasis : null,
      totalPnlPercent: totalCostBasis
        ? ((totalValue - totalCostBasis) / totalCostBasis) * 100
        : null,
      positions: positions.map((p) => ({
        ...p,
        allocation: totalValue > 0 ? (p.value / totalValue) * 100 : 0,
      })),
      diversification: computeDiversificationScore(positions, totalValue),
    },
    timestamp: new Date().toISOString(),
  });
});

// ═══════════════════════════════════════════════════════════════
// POST /api/portfolio/analyze — Deep Portfolio Analysis
// ═══════════════════════════════════════════════════════════════

portfolioRoutes.post("/analyze", async (c) => {
  const parsed = await validateBody(c, PortfolioAnalyzeSchema);
  if (!parsed.success) return parsed.error;
  const { holdings } = parsed.data;

  const coinIds = holdings.map((h) => h.coinId);
  const joinedIds = coinIds.join(",");

  // Fetch prices + 30d chart data in parallel
  const [priceData, ...charts] = await Promise.all([
    cg.getPrice(joinedIds, "usd", true),
    ...coinIds.map((id) => cg.getMarketChart(id, 30, "daily")),
  ]);

  // Build positions
  const positions = holdings.map((h, i) => {
    const prices = priceData[h.coinId];
    if (!prices) return null;
    const price = prices.usd ?? 0;
    const value = h.amount * price;
    const chartPrices = charts[i]?.prices?.map((p) => p[1]) ?? [];
    const returns = logReturns(chartPrices);
    const vol = annualizedVol(returns);
    const dd = maxDrawdown(chartPrices);
    const costBasisTotal = h.costBasis != null ? h.amount * h.costBasis : null;

    return {
      coinId: h.coinId,
      amount: h.amount,
      price,
      value,
      change24h: (prices.usd_24h_change as number | undefined) ?? null,
      costBasis: h.costBasis ?? null,
      costBasisTotal,
      pnl: costBasisTotal != null ? value - costBasisTotal : null,
      pnlPercent: costBasisTotal != null && costBasisTotal > 0
        ? ((value - costBasisTotal) / costBasisTotal) * 100 : null,
      volatility30d: Math.round(vol * 10000) / 100,
      maxDrawdown30d: Math.round(dd.drawdown * 10000) / 100,
      dailyReturns: returns,
    };
  }).filter((p): p is NonNullable<typeof p> => p !== null);

  const totalValue = positions.reduce((s, p) => s + p.value, 0);
  const weights = positions.map((p) => totalValue > 0 ? p.value / totalValue : 0);

  // Portfolio-level volatility (weighted)
  const weightedReturns: number[] = [];
  if (positions.length > 0 && positions[0].dailyReturns.length > 0) {
    const minLen = Math.min(...positions.map((p) => p.dailyReturns.length));
    for (let d = 0; d < minLen; d++) {
      let dayReturn = 0;
      for (let j = 0; j < positions.length; j++) {
        dayReturn += weights[j] * positions[j].dailyReturns[d];
      }
      weightedReturns.push(dayReturn);
    }
  }

  const portfolioVol = annualizedVol(weightedReturns);
  const portfolioDD = weightedReturns.length > 1
    ? maxDrawdown(weightedReturns.reduce<number[]>((acc, r) => {
        acc.push((acc.length > 0 ? acc[acc.length - 1] : 1) * Math.exp(r));
        return acc;
      }, []))
    : { drawdown: 0, peakIdx: 0, troughIdx: 0 };

  // Concentration analysis
  const hhi = herfindahlIndex(weights);
  const sortedByWeight = [...positions]
    .map((p, i) => ({ coinId: p.coinId, weight: weights[i] }))
    .sort((a, b) => b.weight - a.weight);

  // Correlation pairs (top correlations)
  const correlationPairs: Array<{ a: string; b: string; correlation: number }> = [];
  for (let i = 0; i < positions.length; i++) {
    for (let j = i + 1; j < positions.length; j++) {
      const corr = pearson(positions[i].dailyReturns, positions[j].dailyReturns);
      correlationPairs.push({ a: positions[i].coinId, b: positions[j].coinId, correlation: corr });
    }
  }
  correlationPairs.sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));

  return c.json({
    data: {
      summary: {
        totalValue,
        positionCount: positions.length,
        portfolioVolatility: Math.round(portfolioVol * 10000) / 100,
        portfolioMaxDrawdown: Math.round(portfolioDD.drawdown * 10000) / 100,
        diversificationScore: computeDiversificationScore(positions, totalValue),
        herfindahlIndex: Math.round(hhi * 10000) / 10000,
        concentrationRisk: hhi > 0.3 ? "high" : hhi > 0.15 ? "medium" : "low",
      },
      positions: positions.map((p, i) => ({
        coinId: p.coinId,
        amount: p.amount,
        price: p.price,
        value: p.value,
        allocation: Math.round(weights[i] * 10000) / 100,
        change24h: p.change24h,
        costBasis: p.costBasis,
        pnl: p.pnl,
        pnlPercent: p.pnlPercent != null ? Math.round(p.pnlPercent * 100) / 100 : null,
        volatility30d: p.volatility30d,
        maxDrawdown30d: p.maxDrawdown30d,
      })),
      topConcentrations: sortedByWeight.slice(0, 5).map((w) => ({
        coinId: w.coinId,
        weight: Math.round(w.weight * 10000) / 100,
      })),
      topCorrelations: correlationPairs.slice(0, 10),
      recommendations: generateAnalysisRecommendations(hhi, portfolioVol, sortedByWeight),
    },
    timestamp: new Date().toISOString(),
  });
});

/** Generate analysis recommendations from portfolio metrics */
function generateAnalysisRecommendations(
  hhi: number,
  portfolioVol: number,
  sortedByWeight: Array<{ coinId: string; weight: number }>,
): string[] {
  const recs: string[] = [];
  if (hhi > 0.3) {
    recs.push(`High concentration risk — top position (${sortedByWeight[0]?.coinId}) holds ${Math.round((sortedByWeight[0]?.weight ?? 0) * 100)}%. Consider diversifying.`);
  } else if (hhi > 0.15) {
    recs.push("Moderate concentration. Consider adding positions to improve diversification.");
  } else {
    recs.push("Good diversification across positions.");
  }
  if (portfolioVol > 1.0) {
    recs.push("Very high annualized volatility. Consider adding stablecoins or large-cap positions.");
  } else if (portfolioVol > 0.6) {
    recs.push("High volatility. This portfolio is aggressive — suitable for risk-tolerant investors.");
  }
  if (sortedByWeight.length < 5) {
    recs.push("Portfolio has fewer than 5 positions — consider broader diversification.");
  }
  return recs;
}

// ═══════════════════════════════════════════════════════════════
// POST /api/portfolio/optimize — Portfolio Optimization Suggestions
// ═══════════════════════════════════════════════════════════════

portfolioRoutes.post("/optimize", async (c) => {
  const parsed = await validateBody(c, PortfolioOptimizeSchema);
  if (!parsed.success) return parsed.error;
  const { holdings, riskTolerance } = parsed.data;

  const coinIds = holdings.map((h) => h.coinId);

  // Fetch 90-day charts for each asset
  const charts = await Promise.allSettled(
    coinIds.map((id) => cg.getMarketChart(id, 90, "daily")),
  );

  // Compute metrics per asset
  const assetMetrics = coinIds.map((id, i) => {
    const chart = charts[i];
    if (chart.status !== "fulfilled" || !chart.value.prices?.length) {
      return { id, returns: [] as number[], vol: 0, meanReturn: 0, sharpe: 0, allocation: holdings[i].allocation };
    }
    const prices = chart.value.prices.map((p) => p[1]);
    const returns = logReturns(prices);
    const vol = annualizedVol(returns);
    const meanReturn = returns.length > 0
      ? ((1 + returns.reduce((s, r) => s + r, 0) / returns.length) ** 365 - 1)
      : 0;
    const sharpe = vol > 0 ? (meanReturn - 0.045) / vol : 0;
    return { id, returns, vol, meanReturn, sharpe, allocation: holdings[i].allocation };
  });

  // Risk tolerance target volatility bands
  const volTarget = riskTolerance === "conservative" ? 0.3
    : riskTolerance === "moderate" ? 0.6
    : 1.0;

  // Generate optimization suggestions
  const suggestions: Array<{
    coinId: string;
    currentAllocation: number;
    suggestedAllocation: number;
    reason: string;
  }> = [];

  // Simple risk-parity inspired weighting: allocate inversely proportional to volatility
  const totalInverseVol = assetMetrics.reduce((s, a) =>
    s + (a.vol > 0 ? 1 / a.vol : 0), 0);

  for (const asset of assetMetrics) {
    const riskParityWeight = totalInverseVol > 0 && asset.vol > 0
      ? ((1 / asset.vol) / totalInverseVol) * 100
      : 100 / assetMetrics.length;

    // Blend current with risk-parity based on risk tolerance
    const blendFactor = riskTolerance === "conservative" ? 0.7
      : riskTolerance === "moderate" ? 0.5
      : 0.3;

    const suggested = Math.round(
      (asset.allocation * (1 - blendFactor) + riskParityWeight * blendFactor) * 100,
    ) / 100;

    let reason = "";
    if (suggested > asset.allocation + 5) {
      reason = `Low volatility (${Math.round(asset.vol * 100)}%) — increase for risk-parity balance`;
    } else if (suggested < asset.allocation - 5) {
      reason = `High volatility (${Math.round(asset.vol * 100)}%) — reduce for risk management`;
    } else {
      reason = "Allocation is near optimal for risk tolerance";
    }

    suggestions.push({
      coinId: asset.id,
      currentAllocation: asset.allocation,
      suggestedAllocation: suggested,
      reason,
    });
  }

  // Normalize suggested allocations to 100%
  const totalSuggested = suggestions.reduce((s, s2) => s + s2.suggestedAllocation, 0);
  if (totalSuggested > 0) {
    for (const s of suggestions) {
      s.suggestedAllocation = Math.round((s.suggestedAllocation / totalSuggested) * 100 * 100) / 100;
    }
  }

  // Portfolio-level metrics
  const currentWeights = holdings.map((h) => h.allocation / 100);
  const currentPortfolioVol = (() => {
    const minLen = Math.min(
      ...assetMetrics.filter((a) => a.returns.length > 0).map((a) => a.returns.length),
      Infinity,
    );
    if (!isFinite(minLen) || minLen < 2) return 0;
    const portfolioReturns: number[] = [];
    for (let d = 0; d < minLen; d++) {
      let dayReturn = 0;
      for (let j = 0; j < assetMetrics.length; j++) {
        if (assetMetrics[j].returns.length > d) {
          dayReturn += currentWeights[j] * assetMetrics[j].returns[d];
        }
      }
      portfolioReturns.push(dayReturn);
    }
    return annualizedVol(portfolioReturns);
  })();

  return c.json({
    data: {
      riskTolerance,
      targetVolatility: volTarget,
      currentPortfolioVolatility: Math.round(currentPortfolioVol * 10000) / 100,
      suggestions,
      assetMetrics: assetMetrics.map((a) => ({
        coinId: a.id,
        annualizedVolatility: Math.round(a.vol * 10000) / 100,
        annualizedReturn: Math.round(a.meanReturn * 10000) / 100,
        sharpeRatio: Math.round(a.sharpe * 10000) / 10000,
      })),
      methodology: "Risk-parity blended with current allocation, adjusted for risk tolerance.",
    },
    timestamp: new Date().toISOString(),
  });
});

// ═══════════════════════════════════════════════════════════════
// POST /api/portfolio/risk — Portfolio Risk Assessment
// ═══════════════════════════════════════════════════════════════

portfolioRoutes.post("/risk", async (c) => {
  const parsed = await validateBody(c, PortfolioRiskSchema);
  if (!parsed.success) return parsed.error;
  const { holdings } = parsed.data;

  const coinIds = holdings.map((h) => h.coinId);

  // Fetch 90-day price history for each asset in parallel
  const histories = await Promise.allSettled(
    coinIds.map((id) => cg.getMarketChart(id, 90, "daily")),
  );

  // Extract returns per asset
  const assetReturns: Array<{ id: string; returns: number[]; allocation: number }> = [];
  for (let i = 0; i < coinIds.length; i++) {
    const h = histories[i];
    if (h.status === "fulfilled" && h.value.prices?.length > 5) {
      const prices = h.value.prices.map((p) => p[1]);
      assetReturns.push({
        id: coinIds[i],
        returns: logReturns(prices),
        allocation: holdings[i].allocation / 100,
      });
    }
  }

  // Portfolio weighted daily returns
  const minLen = Math.min(...assetReturns.map((a) => a.returns.length));
  const portfolioReturns: number[] = [];
  for (let d = 0; d < minLen; d++) {
    let dayReturn = 0;
    for (const asset of assetReturns) {
      dayReturn += asset.allocation * asset.returns[d];
    }
    portfolioReturns.push(dayReturn);
  }

  // Annualized volatility
  const vol = annualizedVol(portfolioReturns);

  // Max drawdown (simulate portfolio value series)
  const portfolioPrices: number[] = [1];
  for (const r of portfolioReturns) {
    portfolioPrices.push(portfolioPrices[portfolioPrices.length - 1] * Math.exp(r));
  }
  const maxDD = maxDrawdown(portfolioPrices);

  // Value at Risk (95% confidence)
  const vaR95 = valueAtRisk(portfolioReturns, 0.95);

  // Sharpe ratio (risk-free rate 4.5% annual)
  const meanReturn = portfolioReturns.length > 0
    ? portfolioReturns.reduce((s, r) => s + r, 0) / portfolioReturns.length
    : 0;
  const annualReturn = (1 + meanReturn) ** 365 - 1;
  const sharpe = vol > 0 ? (annualReturn - 0.045) / vol : 0;

  // Sortino ratio (downside deviation only)
  const negReturns = portfolioReturns.filter((r) => r < RISK_FREE_DAILY);
  const downsideDev = negReturns.length > 0
    ? Math.sqrt(negReturns.reduce((s, r) => s + (r - RISK_FREE_DAILY) ** 2, 0) / negReturns.length) * Math.sqrt(365)
    : 0;
  const sortino = downsideDev > 0 ? (annualReturn - 0.045) / downsideDev : 0;

  // Concentration risk (Herfindahl index)
  const allocations = holdings.map((h) => h.allocation / 100);
  const hhi = herfindahlIndex(allocations);

  // Per-asset risk contribution
  const assetRiskContrib = assetReturns.map((a) => {
    const assetVol = annualizedVol(a.returns);
    return {
      coinId: a.id,
      allocation: Math.round(a.allocation * 10000) / 100,
      annualizedVol: Math.round(assetVol * 10000) / 100,
      riskContribution: Math.round(a.allocation * assetVol * 10000) / 100,
    };
  });

  // Overall risk level
  const overallRisk = vol > 1.0 ? "very_high"
    : vol > 0.6 ? "high"
    : vol > 0.3 ? "medium"
    : "low";

  // Recommendations
  const riskRecommendations: string[] = [];
  if (hhi > 0.3) riskRecommendations.push("High concentration — diversify across more assets.");
  if (vol > 0.8) riskRecommendations.push("Very high volatility — consider adding stablecoins or hedging derivatives.");
  if (maxDD.drawdown > 0.3) riskRecommendations.push(`Historical max drawdown of ${Math.round(maxDD.drawdown * 100)}% — ensure you can tolerate this loss.`);
  if (sharpe < 0) riskRecommendations.push("Negative Sharpe ratio — portfolio has underperformed risk-free rate.");
  if (riskRecommendations.length === 0) riskRecommendations.push("Risk metrics are within acceptable ranges.");

  return c.json({
    data: {
      volatility: Math.round(vol * 10000) / 100,
      maxDrawdown: Math.round(maxDD.drawdown * 10000) / 100,
      valueAtRisk95: Math.round(vaR95 * 10000) / 100,
      sharpeRatio: Math.round(sharpe * 10000) / 10000,
      sortinoRatio: Math.round(sortino * 10000) / 10000,
      annualizedReturn: Math.round(annualReturn * 10000) / 100,
      concentrationRisk: hhi > 0.3 ? "high" : hhi > 0.15 ? "medium" : "low",
      herfindahlIndex: Math.round(hhi * 10000) / 10000,
      riskLevel: overallRisk,
      assetRiskContribution: assetRiskContrib,
      recommendations: riskRecommendations,
    },
    timestamp: new Date().toISOString(),
  });
});

// ═══════════════════════════════════════════════════════════════
// POST /api/portfolio/correlation — Asset Correlation Matrix
// ═══════════════════════════════════════════════════════════════

portfolioRoutes.post("/correlation", async (c) => {
  const parsed = await validateBody(c, PortfolioCorrelationSchema);
  if (!parsed.success) return parsed.error;
  const { coinIds, days } = parsed.data;

  const cacheKey = `portfolio:corr:${coinIds.join(",")}:${days}`;

  const result = await cache.wrap(cacheKey, 900, async () => {
    const charts = await Promise.allSettled(
      coinIds.map((id) => cg.getMarketChart(id, days, "daily")),
    );

    const priceMap: Record<string, number[]> = {};
    for (let i = 0; i < coinIds.length; i++) {
      const h = charts[i];
      if (h.status === "fulfilled" && h.value.prices?.length > 5) {
        priceMap[coinIds[i]] = h.value.prices.map((p) => p[1]);
      }
    }

    const validIds = Object.keys(priceMap);

    // Build N×N correlation matrix
    const matrix: Record<string, Record<string, number>> = {};
    for (const a of validIds) {
      matrix[a] = {};
      for (const b of validIds) {
        if (a === b) {
          matrix[a][b] = 1;
        } else {
          const returnsA = logReturns(priceMap[a]);
          const returnsB = logReturns(priceMap[b]);
          matrix[a][b] = pearson(returnsA, returnsB);
        }
      }
    }

    // Find strongest pairs
    const pairs: Array<{ a: string; b: string; correlation: number }> = [];
    for (let i = 0; i < validIds.length; i++) {
      for (let j = i + 1; j < validIds.length; j++) {
        pairs.push({
          a: validIds[i],
          b: validIds[j],
          correlation: matrix[validIds[i]][validIds[j]],
        });
      }
    }
    pairs.sort((x, y) => Math.abs(y.correlation) - Math.abs(x.correlation));

    return { assets: validIds, days, matrix, strongestPairs: pairs.slice(0, 10) };
  });

  return c.json({
    data: result,
    timestamp: new Date().toISOString(),
  });
});

// ═══════════════════════════════════════════════════════════════
// POST /api/portfolio/backtest — Historical Portfolio Backtest
// ═══════════════════════════════════════════════════════════════

portfolioRoutes.post("/backtest", async (c) => {
  const parsed = await validateBody(c, PortfolioBacktestSchema);
  if (!parsed.success) return parsed.error;
  const { holdings, days, rebalanceFrequency, initialInvestment } = parsed.data;

  const coinIds = holdings.map((h) => h.coinId);
  const targetWeights = holdings.map((h) => h.allocation / 100);

  // Fetch historical price data
  const charts = await Promise.allSettled(
    coinIds.map((id) => cg.getMarketChart(id, days, "daily")),
  );

  // Extract aligned price series
  const priceSeries: Record<string, number[]> = {};
  let minLen = Infinity;
  for (let i = 0; i < coinIds.length; i++) {
    const ch = charts[i];
    if (ch.status === "fulfilled" && ch.value.prices?.length > 2) {
      priceSeries[coinIds[i]] = ch.value.prices.map((p) => p[1]);
      minLen = Math.min(minLen, ch.value.prices.length);
    }
  }

  const validIds = Object.keys(priceSeries);
  if (validIds.length === 0 || !isFinite(minLen) || minLen < 2) {
    return ApiError.badRequest(c, "Insufficient price data for backtest");
  }

  // Align all series to minLen
  for (const id of validIds) {
    priceSeries[id] = priceSeries[id].slice(priceSeries[id].length - minLen);
  }

  // Rebalance interval
  const rebalanceInterval = rebalanceFrequency === "daily" ? 1
    : rebalanceFrequency === "weekly" ? 7
    : rebalanceFrequency === "monthly" ? 30
    : Infinity;

  // Simulate
  const validWeights = validIds.map((id) => {
    const idx = coinIds.indexOf(id);
    return idx >= 0 ? targetWeights[idx] : 0;
  });
  const totalWeight = validWeights.reduce((s, w) => s + w, 0);
  const normalizedWeights = totalWeight > 0
    ? validWeights.map((w) => w / totalWeight)
    : validWeights.map(() => 1 / validIds.length);

  // Track position amounts
  let currentAmounts = validIds.map((id, i) =>
    (initialInvestment * normalizedWeights[i]) / priceSeries[id][0],
  );

  const timeline: Array<{ day: number; value: number }> = [];
  let lastRebalance = 0;

  for (let d = 0; d < minLen; d++) {
    // Calculate current portfolio value
    let portfolioValue = 0;
    for (let i = 0; i < validIds.length; i++) {
      portfolioValue += currentAmounts[i] * priceSeries[validIds[i]][d];
    }
    timeline.push({ day: d, value: portfolioValue });

    // Rebalance if needed
    if (rebalanceFrequency !== "none" && d - lastRebalance >= rebalanceInterval && d < minLen - 1) {
      currentAmounts = validIds.map((id, i) =>
        (portfolioValue * normalizedWeights[i]) / priceSeries[id][d],
      );
      lastRebalance = d;
    }
  }

  const finalValue = timeline[timeline.length - 1]?.value ?? initialInvestment;
  const totalReturn = ((finalValue - initialInvestment) / initialInvestment) * 100;

  // Compute metrics from portfolio value series
  const valuesSeries = timeline.map((t) => t.value);
  const returns = logReturns(valuesSeries);
  const vol = annualizedVol(returns);
  const dd = maxDrawdown(valuesSeries);
  const annualReturn = returns.length > 0
    ? ((1 + returns.reduce((s, r) => s + r, 0) / returns.length) ** 365 - 1) : 0;
  const sharpe = vol > 0 ? (annualReturn - 0.045) / vol : 0;

  // BTC benchmark comparison
  const btcIdx = validIds.indexOf("bitcoin");
  const btcReturn = btcIdx >= 0
    ? ((priceSeries["bitcoin"][minLen - 1] - priceSeries["bitcoin"][0]) / priceSeries["bitcoin"][0]) * 100
    : null;

  return c.json({
    data: {
      initialInvestment,
      finalValue: Math.round(finalValue * 100) / 100,
      totalReturn: Math.round(totalReturn * 100) / 100,
      annualizedReturn: Math.round(annualReturn * 10000) / 100,
      volatility: Math.round(vol * 10000) / 100,
      maxDrawdown: Math.round(dd.drawdown * 10000) / 100,
      sharpeRatio: Math.round(sharpe * 10000) / 10000,
      rebalanceFrequency,
      days,
      dataPoints: timeline.length,
      btcBenchmarkReturn: btcReturn != null ? Math.round(btcReturn * 100) / 100 : null,
      excessReturnVsBtc: btcReturn != null
        ? Math.round((totalReturn - btcReturn) * 100) / 100
        : null,
      timeline: timeline.filter((_, i) =>
        // Downsample to max ~100 data points for response size
        i % Math.max(1, Math.floor(timeline.length / 100)) === 0 || i === timeline.length - 1,
      ).map((t) => ({
        day: t.day,
        value: Math.round(t.value * 100) / 100,
      })),
    },
    timestamp: new Date().toISOString(),
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/portfolio/wallet/:address — Auto-detect from Wallet
// ═══════════════════════════════════════════════════════════════

portfolioRoutes.get("/wallet/:address", async (c) => {
  const address = c.req.param("address");

  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return ApiError.badRequest(c, "Invalid Ethereum address (must be 0x + 40 hex chars)");
  }

  // Fetch ETH balance via gas oracle endpoint (Etherscan)
  // and ERC-20 top tokens via Etherscan
  const [gasData, ethPrice] = await Promise.allSettled([
    evm.getGasOracle("ethereum"),
    evm.getEthPrice(),
  ]);

  // Get ETH price
  const ethUsd = gasData.status === "fulfilled" && ethPrice.status === "fulfilled"
    ? parseFloat(ethPrice.value.result.ethusd) : 0;

  return c.json({
    data: {
      address,
      chain: "ethereum",
      ethPriceUsd: ethUsd,
      note: "Full ERC-20 token balance scanning requires Alchemy/Moralis integration. " +
        "Currently returns chain metadata. Use POST /calculate with detected holdings for full analysis.",
      gasEstimate: gasData.status === "fulfilled" ? gasData.value : null,
    },
    timestamp: new Date().toISOString(),
  });
});

// ═══════════════════════════════════════════════════════════════
// POST /api/portfolio/value — Portfolio Valuation (original)
// ═══════════════════════════════════════════════════════════════

portfolioRoutes.post("/value", async (c) => {
  const parsed = await validateBody(c, PortfolioHoldingsSchema);
  if (!parsed.success) return parsed.error;
  const { holdings, vs_currency } = parsed.data;

  const data = await portfolio.valuePortfolio(holdings, vs_currency);
  return c.json(data);
});

// ═══════════════════════════════════════════════════════════════
// GET /api/portfolio/volatility/:id — Single Asset Volatility
// ═══════════════════════════════════════════════════════════════

portfolioRoutes.get("/volatility/:id", async (c) => {
  const id = c.req.param("id");
  const days = Math.min(Number(c.req.query("days")) || 90, 365);
  const vsCurrency = c.req.query("vs") || "usd";
  const data = await portfolio.volatilityMetrics(id, days, vsCurrency);
  return c.json(data);
});

// ═══════════════════════════════════════════════════════════════
// POST /api/portfolio/diversification — Diversification Score
// ═══════════════════════════════════════════════════════════════

portfolioRoutes.post("/diversification", async (c) => {
  const parsed = await validateBody(c, PortfolioHoldingsSchema);
  if (!parsed.success) return parsed.error;
  const { holdings } = parsed.data;

  const data = await portfolio.diversificationScore(holdings);
  return c.json(data);
});
