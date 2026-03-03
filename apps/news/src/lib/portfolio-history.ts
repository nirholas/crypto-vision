'use client';

import { useCallback, useEffect, useRef } from 'react';

/**
 * Portfolio History Tracker
 * 
 * Records portfolio value snapshots over time for accurate performance tracking.
 * Uses localStorage for persistence with automatic cleanup of old data.
 * 
 * Data Structure:
 * - Snapshots are stored with timestamp, total value, and per-coin breakdown
 * - Automatic deduplication prevents excessive storage
 * - Configurable retention period (default: 2 years)
 */

export interface PortfolioSnapshot {
  timestamp: number; // Unix timestamp in ms
  totalValue: number;
  holdings: {
    coinId: string;
    symbol: string;
    amount: number;
    price: number;
    value: number;
  }[];
}

export interface PortfolioHistoryState {
  snapshots: PortfolioSnapshot[];
  lastSnapshotAt: number;
  createdAt: number;
}

const HISTORY_STORAGE_KEY = 'crypto-portfolio-history-v1';
const SNAPSHOT_INTERVAL_MS = 4 * 60 * 60 * 1000; // 4 hours
const MAX_RETENTION_DAYS = 730; // 2 years
const MAX_SNAPSHOTS = 4380; // ~2 years of 4-hour snapshots

/**
 * Load portfolio history from localStorage
 */
export function loadPortfolioHistory(): PortfolioHistoryState {
  if (typeof window === 'undefined') {
    return { snapshots: [], lastSnapshotAt: 0, createdAt: Date.now() };
  }

  try {
    const stored = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Clean up old snapshots
      const cutoffTime = Date.now() - (MAX_RETENTION_DAYS * 24 * 60 * 60 * 1000);
      parsed.snapshots = parsed.snapshots.filter(
        (s: PortfolioSnapshot) => s.timestamp > cutoffTime
      );
      return parsed;
    }
  } catch {
    console.error('Failed to load portfolio history');
  }

  return { snapshots: [], lastSnapshotAt: 0, createdAt: Date.now() };
}

/**
 * Save portfolio history to localStorage
 */
export function savePortfolioHistory(history: PortfolioHistoryState): void {
  if (typeof window === 'undefined') return;

  try {
    // Limit snapshots to prevent storage overflow
    if (history.snapshots.length > MAX_SNAPSHOTS) {
      // Keep every Nth snapshot to reduce count while preserving history
      const step = Math.ceil(history.snapshots.length / MAX_SNAPSHOTS);
      history.snapshots = history.snapshots.filter((_, i) => i % step === 0);
    }

    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
  } catch (error) {
    console.error('Failed to save portfolio history:', error);
    // If storage is full, try to reduce data
    if (history.snapshots.length > 100) {
      history.snapshots = history.snapshots.slice(-100);
      try {
        localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
      } catch {
        // Give up if still failing
      }
    }
  }
}

/**
 * Add a new snapshot to portfolio history
 */
export function addPortfolioSnapshot(
  holdings: { coinId: string; symbol: string; amount: number; price: number }[],
  force = false
): PortfolioSnapshot | null {
  const history = loadPortfolioHistory();
  const now = Date.now();

  // Check if enough time has passed since last snapshot
  if (!force && now - history.lastSnapshotAt < SNAPSHOT_INTERVAL_MS) {
    return null;
  }

  // Calculate total value
  const totalValue = holdings.reduce((sum, h) => sum + (h.amount * h.price), 0);

  // Skip if no value (empty portfolio)
  if (totalValue === 0 && holdings.length === 0) {
    return null;
  }

  const snapshot: PortfolioSnapshot = {
    timestamp: now,
    totalValue,
    holdings: holdings.map(h => ({
      coinId: h.coinId,
      symbol: h.symbol,
      amount: h.amount,
      price: h.price,
      value: h.amount * h.price,
    })),
  };

  history.snapshots.push(snapshot);
  history.lastSnapshotAt = now;
  savePortfolioHistory(history);

  return snapshot;
}

/**
 * Get portfolio snapshots for a specific time range
 */
export function getPortfolioSnapshots(
  range: '1D' | '1W' | '1M' | '3M' | '1Y' | 'ALL'
): PortfolioSnapshot[] {
  const history = loadPortfolioHistory();
  const now = Date.now();

  const rangeMs: Record<typeof range, number> = {
    '1D': 24 * 60 * 60 * 1000,
    '1W': 7 * 24 * 60 * 60 * 1000,
    '1M': 30 * 24 * 60 * 60 * 1000,
    '3M': 90 * 24 * 60 * 60 * 1000,
    '1Y': 365 * 24 * 60 * 60 * 1000,
    'ALL': MAX_RETENTION_DAYS * 24 * 60 * 60 * 1000,
  };

  const cutoffTime = now - rangeMs[range];
  return history.snapshots.filter(s => s.timestamp >= cutoffTime);
}

/**
 * Calculate portfolio performance metrics
 */
export function calculatePerformanceMetrics(snapshots: PortfolioSnapshot[]) {
  if (snapshots.length < 2) {
    return {
      startValue: snapshots[0]?.totalValue || 0,
      endValue: snapshots[snapshots.length - 1]?.totalValue || 0,
      absoluteChange: 0,
      percentChange: 0,
      highValue: snapshots[0]?.totalValue || 0,
      lowValue: snapshots[0]?.totalValue || 0,
      volatility: 0,
    };
  }

  const values = snapshots.map(s => s.totalValue);
  const startValue = values[0];
  const endValue = values[values.length - 1];
  const absoluteChange = endValue - startValue;
  const percentChange = startValue > 0 ? (absoluteChange / startValue) * 100 : 0;
  const highValue = Math.max(...values);
  const lowValue = Math.min(...values);

  // Calculate volatility (standard deviation of daily returns)
  const returns: number[] = [];
  for (let i = 1; i < values.length; i++) {
    if (values[i - 1] > 0) {
      returns.push((values[i] - values[i - 1]) / values[i - 1]);
    }
  }

  let volatility = 0;
  if (returns.length > 0) {
    const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const squaredDiffs = returns.map(r => Math.pow(r - meanReturn, 2));
    volatility = Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / returns.length) * 100;
  }

  return {
    startValue,
    endValue,
    absoluteChange,
    percentChange,
    highValue,
    lowValue,
    volatility,
  };
}

/**
 * Hook for automatic portfolio snapshot recording
 */
export function usePortfolioHistoryTracker(
  holdings: { coinId: string; coinSymbol: string; amount: number }[],
  prices: Record<string, number>,
  isLoading: boolean
) {
  const lastSnapshotRef = useRef<number>(0);

  const recordSnapshot = useCallback(() => {
    if (isLoading || holdings.length === 0) return;

    const holdingsWithPrices = holdings
      .filter(h => prices[h.coinId] !== undefined)
      .map(h => ({
        coinId: h.coinId,
        symbol: h.coinSymbol,
        amount: h.amount,
        price: prices[h.coinId],
      }));

    if (holdingsWithPrices.length === 0) return;

    const snapshot = addPortfolioSnapshot(holdingsWithPrices);
    if (snapshot) {
      lastSnapshotRef.current = snapshot.timestamp;
    }
  }, [holdings, prices, isLoading]);

  // Record snapshot when prices update
  useEffect(() => {
    recordSnapshot();
  }, [recordSnapshot]);

  // Also record periodically
  useEffect(() => {
    const interval = setInterval(recordSnapshot, SNAPSHOT_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [recordSnapshot]);

  return { recordSnapshot };
}

/**
 * Fetch historical prices for coins to reconstruct portfolio history
 * when no snapshots exist yet
 */
export async function fetchHistoricalPrices(
  coinIds: string[],
  days: number
): Promise<Map<string, { timestamp: number; price: number }[]>> {
  const priceHistory = new Map<string, { timestamp: number; price: number }[]>();

  // Fetch in parallel with rate limiting
  const batchSize = 5;
  for (let i = 0; i < coinIds.length; i += batchSize) {
    const batch = coinIds.slice(i, i + batchSize);
    
    await Promise.all(
      batch.map(async (coinId) => {
        try {
          const response = await fetch(
            `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=${days}&interval=daily`,
            {
              headers: { 'Accept': 'application/json' },
              cache: 'force-cache',
            }
          );

          if (response.ok) {
            const data = await response.json();
            priceHistory.set(
              coinId,
              data.prices.map(([timestamp, price]: [number, number]) => ({
                timestamp,
                price,
              }))
            );
          }
        } catch (error) {
          console.error(`Failed to fetch history for ${coinId}:`, error);
        }
      })
    );

    // Rate limiting delay between batches
    if (i + batchSize < coinIds.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  return priceHistory;
}

/**
 * Reconstruct portfolio value history from transactions and historical prices
 */
export function reconstructPortfolioHistory(
  transactions: {
    coinId: string;
    coinSymbol: string;
    type: 'buy' | 'sell' | 'transfer_in' | 'transfer_out';
    amount: number;
    date: string;
  }[],
  priceHistory: Map<string, { timestamp: number; price: number }[]>,
  days: number
): PortfolioSnapshot[] {
  if (transactions.length === 0) return [];

  const now = Date.now();
  const startTime = now - (days * 24 * 60 * 60 * 1000);
  const snapshots: PortfolioSnapshot[] = [];

  // Sort transactions by date
  const sortedTx = [...transactions].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  // Build holding state at each day
  const holdingState = new Map<string, { symbol: string; amount: number }>();

  // Initialize with transactions before start time
  for (const tx of sortedTx) {
    const txTime = new Date(tx.date).getTime();
    if (txTime >= startTime) break;

    const current = holdingState.get(tx.coinId) || { symbol: tx.coinSymbol, amount: 0 };
    
    if (tx.type === 'buy' || tx.type === 'transfer_in') {
      current.amount += tx.amount;
    } else {
      current.amount = Math.max(0, current.amount - tx.amount);
    }
    
    holdingState.set(tx.coinId, current);
  }

  // Generate daily snapshots
  const dayMs = 24 * 60 * 60 * 1000;
  let txIndex = sortedTx.findIndex(tx => new Date(tx.date).getTime() >= startTime);
  if (txIndex === -1) txIndex = sortedTx.length;

  for (let timestamp = startTime; timestamp <= now; timestamp += dayMs) {
    // Apply any transactions up to this timestamp
    while (txIndex < sortedTx.length) {
      const tx = sortedTx[txIndex];
      const txTime = new Date(tx.date).getTime();
      if (txTime > timestamp) break;

      const current = holdingState.get(tx.coinId) || { symbol: tx.coinSymbol, amount: 0 };
      
      if (tx.type === 'buy' || tx.type === 'transfer_in') {
        current.amount += tx.amount;
      } else {
        current.amount = Math.max(0, current.amount - tx.amount);
      }
      
      holdingState.set(tx.coinId, current);
      txIndex++;
    }

    // Calculate portfolio value at this timestamp
    const holdings: PortfolioSnapshot['holdings'] = [];
    let totalValue = 0;

    for (const [coinId, holding] of holdingState.entries()) {
      if (holding.amount <= 0) continue;

      const coinHistory = priceHistory.get(coinId);
      if (!coinHistory) continue;

      // Find closest price
      let price = 0;
      for (const ph of coinHistory) {
        if (ph.timestamp <= timestamp) {
          price = ph.price;
        } else {
          break;
        }
      }

      const value = holding.amount * price;
      totalValue += value;
      holdings.push({
        coinId,
        symbol: holding.symbol,
        amount: holding.amount,
        price,
        value,
      });
    }

    if (holdings.length > 0) {
      snapshots.push({ timestamp, totalValue, holdings });
    }
  }

  return snapshots;
}
