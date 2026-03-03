/**
 * Crypto Vision — Portfolio Analysis Source
 *
 * Advanced portfolio analytics using CoinGecko market data:
 *  - Portfolio valuation with per-asset breakdown
 *  - Pearson correlation matrix across multiple assets
 *  - Volatility metrics: daily returns, annualized vol, max drawdown, Sharpe ratio
 *  - Diversification scoring via HHI and category diversity
 *
 * @copyright 2024-2026 nirholas. All rights reserved.
 */

import { fetchJSON } from "../lib/fetcher.js";
import { cache } from "../lib/cache.js";
import { getPrice, getCoinDetail } from "./coingecko.js";

// ─── CoinGecko Helpers ──────────────────────────────────────

const BASE = process.env.COINGECKO_PRO === "true"
  ? "https://pro-api.coingecko.com/api/v3"
  : "https://api.coingecko.com/api/v3";

function cgHeaders(): Record<string, string> {
  const key = process.env.COINGECKO_API_KEY;
  return key ? { "x-cg-pro-api-key": key } : {};
}

/** Fetch market chart with custom vs_currency (unlike the base coingecko source which hardcodes usd). */
function fetchMarketChart(
  id: string,
  days: number,
  vsCurrency: string,
): Promise<{ prices: [number, number][] }> {
  const params = new URLSearchParams({
    vs_currency: vsCurrency,
    days: String(days),
  });
  const path = `/coins/${id}/market_chart?${params}`;
  return cache.wrap(`cg:portfolio:${path}`, 300, () =>
    fetchJSON<{ prices: [number, number][] }>(`${BASE}${path}`, { headers: cgHeaders() }),
  );
}

// ─── Types ───────────────────────────────────────────────────

export interface Holding {
  id: string;
  amount: number;
}

export interface HoldingValue {
  id: string;
  amount: number;
  price: number;
  value: number;
  change24h: number | null;
  allocationPct: number;
}

export interface PortfolioValuation {
  totalValue: number;
  vsCurrency: string;
  holdings: HoldingValue[];
  timestamp: string;
}

export interface CorrelationResult {
  ids: string[];
  days: number;
  vsCurrency: string;
  matrix: number[][];
  labels: string[];
  timestamp: string;
}

export interface VolatilityResult {
  id: string;
  days: number;
  vsCurrency: string;
  currentPrice: number;
  dailyReturns: number[];
  meanDailyReturn: number;
  dailyStdDev: number;
  annualizedVolatility: number;
  annualizedReturn: number;
  maxDrawdown: number;
  maxDrawdownPeak: number;
  maxDrawdownTrough: number;
  sharpeRatio: number;
  sortinoRatio: number;
  timestamp: string;
}

export interface DiversificationResult {
  holdingCount: number;
  hhi: number;
  normalizedHHI: number;
  diversificationScore: number;
  categoryBreakdown: Record<string, { count: number; weight: number }>;
  uniqueCategories: number;
  categoryDiversityScore: number;
  overallScore: number;
  topConcentration: { id: string; weight: number };
  timestamp: string;
}

// ─── Math Helpers ────────────────────────────────────────────

function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  let sum = 0;
  for (const v of arr) sum += v;
  return sum / arr.length;
}

function stddev(arr: number[]): number {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  let sumSq = 0;
  for (const v of arr) sumSq += (v - m) ** 2;
  return Math.sqrt(sumSq / (arr.length - 1)); // sample std dev
}

function pearsonCorrelation(xs: number[], ys: number[]): number {
  const n = Math.min(xs.length, ys.length);
  if (n < 2) return 0;
  const mx = mean(xs.slice(0, n));
  const my = mean(ys.slice(0, n));

  let sumXY = 0;
  let sumX2 = 0;
  let sumY2 = 0;

  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx;
    const dy = ys[i] - my;
    sumXY += dx * dy;
    sumX2 += dx * dx;
    sumY2 += dy * dy;
  }

  const denom = Math.sqrt(sumX2 * sumY2);
  if (denom === 0) return 0;
  return sumXY / denom;
}

/** Extract daily returns from a price series (percentage changes). */
function dailyReturns(prices: number[]): number[] {
  const returns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    if (prices[i - 1] !== 0) {
      returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
    }
  }
  return returns;
}

/** Calculate maximum drawdown from a price series. Returns { maxDrawdown, peak, trough }. */
function maxDrawdown(prices: number[]): { drawdown: number; peak: number; trough: number } {
  if (prices.length < 2) return { drawdown: 0, peak: 0, trough: 0 };

  let peak = prices[0];
  let maxDD = 0;
  let ddPeak = prices[0];
  let ddTrough = prices[0];

  for (const price of prices) {
    if (price > peak) {
      peak = price;
    }
    const dd = (peak - price) / peak;
    if (dd > maxDD) {
      maxDD = dd;
      ddPeak = peak;
      ddTrough = price;
    }
  }

  return { drawdown: maxDD, peak: ddPeak, trough: ddTrough };
}

/** Annualization factor: crypto trades 365 days/year. */
const ANNUAL_FACTOR = Math.sqrt(365);

/** Risk-free rate assumption (US T-bill ~4.5% annual as of 2026). */
const RISK_FREE_RATE = 0.045;

// ─── Portfolio Valuation ─────────────────────────────────────

/**
 * Fetch current prices for a set of holdings and calculate portfolio value.
 */
export async function valuePortfolio(
  holdings: Holding[],
  vsCurrency: string,
): Promise<PortfolioValuation> {
  const ids = holdings.map((h) => h.id).join(",");

  // Fetch prices with 24h change
  const priceData = await getPrice(ids, vsCurrency, true);

  let totalValue = 0;
  const holdingValues: HoldingValue[] = [];

  for (const h of holdings) {
    const coinPrices = priceData[h.id];
    const price = coinPrices?.[vsCurrency] ?? 0;
    const change24h = coinPrices?.[`${vsCurrency}_24h_change`] ?? null;
    const value = price * h.amount;
    totalValue += value;
    holdingValues.push({
      id: h.id,
      amount: h.amount,
      price,
      value,
      change24h,
      allocationPct: 0, // filled below
    });
  }

  // Calculate allocation percentages
  for (const hv of holdingValues) {
    hv.allocationPct = totalValue > 0 ? (hv.value / totalValue) * 100 : 0;
  }

  // Sort by value descending
  holdingValues.sort((a, b) => b.value - a.value);

  return {
    totalValue,
    vsCurrency,
    holdings: holdingValues,
    timestamp: new Date().toISOString(),
  };
}

// ─── Correlation Matrix ──────────────────────────────────────

/**
 * Compute Pearson correlation matrix for a set of crypto assets
 * based on daily price returns over a specified period.
 */
export async function correlationMatrix(
  ids: string[],
  days: number,
  vsCurrency: string,
): Promise<CorrelationResult> {
  // Fetch market charts in parallel
  const charts = await Promise.all(
    ids.map((id) => fetchMarketChart(id, days, vsCurrency)),
  );

  // Extract daily price series from each chart
  const priceSeries = charts.map((chart) =>
    chart.prices.map(([, price]) => price),
  );

  // Compute daily returns for each asset
  const returnSeries = priceSeries.map((prices) => dailyReturns(prices));

  // Align return series to the shortest length
  const minLen = Math.min(...returnSeries.map((r) => r.length));
  const aligned = returnSeries.map((r) => r.slice(r.length - minLen));

  // Build correlation matrix
  const n = ids.length;
  const matrix: number[][] = Array.from({ length: n }, () =>
    Array.from({ length: n }, () => 0),
  );

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) {
        matrix[i][j] = 1;
      } else if (j > i) {
        const corr = pearsonCorrelation(aligned[i], aligned[j]);
        matrix[i][j] = Math.round(corr * 10000) / 10000;
        matrix[j][i] = matrix[i][j];
      }
    }
  }

  return {
    ids,
    days,
    vsCurrency,
    matrix,
    labels: ids,
    timestamp: new Date().toISOString(),
  };
}

// ─── Volatility Metrics ─────────────────────────────────────

/**
 * Calculate comprehensive volatility and risk metrics for a single asset.
 * Returns annualized volatility, Sharpe/Sortino ratios, max drawdown, etc.
 */
export async function volatilityMetrics(
  id: string,
  days: number,
  vsCurrency: string,
): Promise<VolatilityResult> {
  const chart = await fetchMarketChart(id, days, vsCurrency);
  const prices = chart.prices.map(([, price]) => price);

  if (prices.length < 2) {
    return {
      id,
      days,
      vsCurrency,
      currentPrice: prices[0] ?? 0,
      dailyReturns: [],
      meanDailyReturn: 0,
      dailyStdDev: 0,
      annualizedVolatility: 0,
      annualizedReturn: 0,
      maxDrawdown: 0,
      maxDrawdownPeak: 0,
      maxDrawdownTrough: 0,
      sharpeRatio: 0,
      sortinoRatio: 0,
      timestamp: new Date().toISOString(),
    };
  }

  const currentPrice = prices[prices.length - 1];
  const returns = dailyReturns(prices);
  const meanReturn = mean(returns);
  const dailyStd = stddev(returns);
  const annualizedVol = dailyStd * ANNUAL_FACTOR;

  // Annualized return: compound daily mean
  const annualizedReturn = (1 + meanReturn) ** 365 - 1;

  // Sharpe ratio: (annualized return - risk-free rate) / annualized volatility
  const sharpeRatio = annualizedVol > 0
    ? (annualizedReturn - RISK_FREE_RATE) / annualizedVol
    : 0;

  // Sortino ratio: uses downside deviation instead of total std dev
  const negativeReturns = returns.filter((r) => r < 0);
  const downsideDeviation = negativeReturns.length > 0
    ? Math.sqrt(mean(negativeReturns.map((r) => r * r))) * ANNUAL_FACTOR
    : 0;
  const sortinoRatio = downsideDeviation > 0
    ? (annualizedReturn - RISK_FREE_RATE) / downsideDeviation
    : 0;

  // Max drawdown
  const dd = maxDrawdown(prices);

  return {
    id,
    days,
    vsCurrency,
    currentPrice,
    dailyReturns: returns,
    meanDailyReturn: Math.round(meanReturn * 1e8) / 1e8,
    dailyStdDev: Math.round(dailyStd * 1e8) / 1e8,
    annualizedVolatility: Math.round(annualizedVol * 1e6) / 1e6,
    annualizedReturn: Math.round(annualizedReturn * 1e6) / 1e6,
    maxDrawdown: Math.round(dd.drawdown * 1e6) / 1e6,
    maxDrawdownPeak: dd.peak,
    maxDrawdownTrough: dd.trough,
    sharpeRatio: Math.round(sharpeRatio * 1e4) / 1e4,
    sortinoRatio: Math.round(sortinoRatio * 1e4) / 1e4,
    timestamp: new Date().toISOString(),
  };
}

// ─── Diversification Score ───────────────────────────────────

/**
 * Calculate portfolio diversification using:
 *  - Herfindahl-Hirschman Index (HHI) on holding weights
 *  - Category diversity from CoinGecko metadata
 *
 * The overall score combines weight concentration and category spread.
 */
export async function diversificationScore(
  holdings: Holding[],
): Promise<DiversificationResult> {
  // Fetch current prices to determine weights
  const ids = holdings.map((h) => h.id).join(",");
  const priceData = await getPrice(ids, "usd", false);

  // Calculate USD values and total
  const values: Array<{ id: string; value: number }> = [];
  let totalValue = 0;

  for (const h of holdings) {
    const price = priceData[h.id]?.usd ?? 0;
    const value = price * h.amount;
    values.push({ id: h.id, value });
    totalValue += value;
  }

  // Calculate weights
  const weights = values.map((v) => ({
    id: v.id,
    weight: totalValue > 0 ? v.value / totalValue : 1 / values.length,
  }));

  // HHI: sum of squared weights
  const hhi = weights.reduce((sum, w) => sum + w.weight ** 2, 0);
  const n = weights.length;

  // Normalized HHI: (HHI - 1/n) / (1 - 1/n)
  // Ranges from 0 (perfectly diversified) to 1 (fully concentrated)
  const normalizedHHI = n > 1
    ? (hhi - 1 / n) / (1 - 1 / n)
    : 1;

  // Diversification score (inverse of HHI, 0-100 scale)
  const diversificationScoreValue = Math.round((1 - normalizedHHI) * 100 * 100) / 100;

  // Fetch category data for each holding (parallel, with error tolerance)
  const detailResults = await Promise.allSettled(
    holdings.map((h) => getCoinDetail(h.id)),
  );

  // Build category breakdown
  const categoryBreakdown: Record<string, { count: number; weight: number }> = {};

  for (let i = 0; i < detailResults.length; i++) {
    const result = detailResults[i];
    const weight = weights[i].weight;

    let categories: string[] = ["uncategorized"];
    if (result.status === "fulfilled" && result.value.categories.length > 0) {
      categories = result.value.categories.filter(Boolean);
      if (categories.length === 0) categories = ["uncategorized"];
    }

    // Assign weight proportionally across categories
    const catWeight = weight / categories.length;
    for (const cat of categories) {
      const normalized = cat.toLowerCase();
      if (!categoryBreakdown[normalized]) {
        categoryBreakdown[normalized] = { count: 0, weight: 0 };
      }
      categoryBreakdown[normalized].count += 1;
      categoryBreakdown[normalized].weight += catWeight;
    }
  }

  const uniqueCategories = Object.keys(categoryBreakdown).length;

  // Category diversity score: more categories = more diverse
  // Log scale so going from 1→5 categories matters more than 15→20
  const maxExpectedCategories = 15;
  const categoryDiversityScore = Math.min(
    100,
    Math.round((Math.log(uniqueCategories + 1) / Math.log(maxExpectedCategories + 1)) * 100 * 100) / 100,
  );

  // Overall score: weighted combination
  const overallScore = Math.round(
    (diversificationScoreValue * 0.6 + categoryDiversityScore * 0.4) * 100,
  ) / 100;

  // Top concentration
  const sorted = [...weights].sort((a, b) => b.weight - a.weight);
  const topConcentration = sorted[0] ?? { id: "none", weight: 0 };

  return {
    holdingCount: holdings.length,
    hhi: Math.round(hhi * 1e6) / 1e6,
    normalizedHHI: Math.round(normalizedHHI * 1e6) / 1e6,
    diversificationScore: diversificationScoreValue,
    categoryBreakdown,
    uniqueCategories,
    categoryDiversityScore,
    overallScore,
    topConcentration: {
      id: topConcentration.id,
      weight: Math.round(topConcentration.weight * 10000) / 10000,
    },
    timestamp: new Date().toISOString(),
  };
}
