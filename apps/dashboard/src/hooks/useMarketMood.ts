/**
 * useMarketMood Hook
 *
 * Fetches and manages the Fear & Greed Index data from the
 * Alternative.me API. Provides real-time market sentiment data
 * with caching, history tracking, and error handling.
 *
 * @example
 * const { value, history, mood, isLoading, error } = useMarketMood();
 */
import { useState, useEffect, useCallback } from 'react';

interface FearGreedResponse {
  data: Array<{
    value: string;
    value_classification: string;
    timestamp: string;
    time_until_update?: string;
  }>;
}

interface MarketMoodData {
  value: number;
  classification: string;
  timestamp: Date;
  previousValue?: number;
}

interface UseMarketMoodOptions {
  /** Refresh interval in milliseconds (default: 5 minutes) */
  refreshInterval?: number;
  /** Number of historical data points to fetch */
  historyDays?: number;
  /** Enable auto-refresh */
  autoRefresh?: boolean;
}

interface UseMarketMoodReturn {
  /** Current fear/greed value (0-100) */
  value: number;
  /** Previous day's value */
  previousValue?: number;
  /** Historical values (oldest to newest) */
  history: number[];
  /** Human-readable classification */
  classification: string;
  /** Loading state */
  isLoading: boolean;
  /** Error message if any */
  error: string | null;
  /** Last update timestamp */
  lastUpdated: Date | null;
  /** Manually refresh the data */
  refresh: () => Promise<void>;
}

// Cache for the API response
let cachedData: MarketMoodData | null = null;
let cachedHistory: number[] = [];
let cacheTimestamp: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export function useMarketMood(options: UseMarketMoodOptions = {}): UseMarketMoodReturn {
  const { refreshInterval = 5 * 60 * 1000, historyDays = 7, autoRefresh = true } = options;

  const [value, setValue] = useState<number>(50);
  const [previousValue, setPreviousValue] = useState<number | undefined>();
  const [history, setHistory] = useState<number[]>([]);
  const [classification, setClassification] = useState<string>('Neutral');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchData = useCallback(
    async (forceRefresh = false) => {
      // Check cache first
      const now = Date.now();
      if (!forceRefresh && cachedData && now - cacheTimestamp < CACHE_DURATION) {
        setValue(cachedData.value);
        setPreviousValue(cachedData.previousValue);
        setHistory(cachedHistory);
        setClassification(cachedData.classification);
        setLastUpdated(cachedData.timestamp);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        // Fetch current and historical data
        const response = await fetch(`https://api.alternative.me/fng/?limit=${historyDays + 1}`);

        if (!response.ok) {
          throw new Error(`Failed to fetch: ${response.status}`);
        }

        const data: FearGreedResponse = await response.json();

        if (!data.data || data.data.length === 0) {
          throw new Error('No data received');
        }

        // Parse the response
        const currentData = data.data[0];
        const previousData = data.data[1];
        const historyData = data.data
          .slice(0, historyDays)
          .map((d) => parseInt(d.value))
          .reverse(); // Oldest to newest

        const currentValue = parseInt(currentData.value);
        const prevValue = previousData ? parseInt(previousData.value) : undefined;

        // Update cache
        cachedData = {
          value: currentValue,
          classification: currentData.value_classification,
          timestamp: new Date(),
          previousValue: prevValue,
        };
        cachedHistory = historyData;
        cacheTimestamp = now;

        // Update state
        setValue(currentValue);
        setPreviousValue(prevValue);
        setHistory(historyData);
        setClassification(currentData.value_classification);
        setLastUpdated(new Date());
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(message);
        // Keep existing data if available, otherwise show error state
        // Do not set fake fallback values
      } finally {
        setIsLoading(false);
      }
    },
    [historyDays]
  );

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchData(true);
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, fetchData]);

  const refresh = useCallback(async () => {
    await fetchData(true);
  }, [fetchData]);

  return {
    value,
    previousValue,
    history,
    classification,
    isLoading,
    error,
    lastUpdated,
    refresh,
  };
}

/**
 * Helper to get mood color based on value
 */
export function getMoodColor(value: number): string {
  if (value <= 20) return '#ef4444'; // Extreme Fear - Red
  if (value <= 40) return '#f97316'; // Fear - Orange
  if (value <= 60) return '#eab308'; // Neutral - Yellow
  if (value <= 80) return '#22c55e'; // Greed - Green
  return '#10b981'; // Extreme Greed - Emerald
}

/**
 * Helper to get mood label based on value
 */
export function getMoodLabel(value: number): string {
  if (value <= 20) return 'Extreme Fear';
  if (value <= 40) return 'Fear';
  if (value <= 60) return 'Neutral';
  if (value <= 80) return 'Greed';
  return 'Extreme Greed';
}

export default useMarketMood;
