'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { AlphaSignal, AlphaLeaderboardEntry, NarrativeCluster } from '@/lib/alpha-signal-engine';

interface UseAlphaSignalsOptions {
  autoRefresh?: boolean;
  refreshInterval?: number;
  filter?: {
    signalType?: AlphaSignal['signalType'];
    minAlphaScore?: number;
    assets?: string[];
    urgency?: AlphaSignal['urgency'][];
  };
}

interface UseAlphaSignalsReturn {
  signals: AlphaSignal[];
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  lastUpdated: Date | null;
  criticalSignals: AlphaSignal[];
  stats: {
    totalSignals: number;
    avgAlphaScore: number;
    bullishCount: number;
    bearishCount: number;
    accuracyRate: number;
  };
}

export function useAlphaSignals(options: UseAlphaSignalsOptions = {}): UseAlphaSignalsReturn {
  const { autoRefresh = true, refreshInterval = 30000, filter } = options;
  
  const [signals, setSignals] = useState<AlphaSignal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  
  const fetchSignals = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      
      if (filter?.signalType) params.set('signalType', filter.signalType);
      if (filter?.minAlphaScore) params.set('minAlphaScore', filter.minAlphaScore.toString());
      if (filter?.assets?.length) params.set('assets', filter.assets.join(','));
      if (filter?.urgency?.length) params.set('urgency', filter.urgency.join(','));
      
      const response = await fetch(`/api/alpha-signals?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch alpha signals');
      }
      
      const data = await response.json();
      setSignals(data.signals || []);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setIsLoading(false);
    }
  }, [filter]);
  
  useEffect(() => {
    fetchSignals();
    
    if (autoRefresh) {
      intervalRef.current = setInterval(fetchSignals, refreshInterval);
    }
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchSignals, autoRefresh, refreshInterval]);
  
  const criticalSignals = signals.filter(s => s.urgency === 'critical' || s.alphaScore >= 85);
  
  const stats = {
    totalSignals: signals.length,
    avgAlphaScore: signals.length > 0 
      ? Math.round(signals.reduce((sum, s) => sum + s.alphaScore, 0) / signals.length)
      : 0,
    bullishCount: signals.filter(s => s.signalType === 'bullish').length,
    bearishCount: signals.filter(s => s.signalType === 'bearish').length,
    accuracyRate: signals.filter(s => s.wasAccurate !== undefined).length > 0
      ? Math.round(signals.filter(s => s.wasAccurate).length / signals.filter(s => s.wasAccurate !== undefined).length * 100)
      : 0,
  };
  
  return {
    signals,
    isLoading,
    error,
    refresh: fetchSignals,
    lastUpdated,
    criticalSignals,
    stats,
  };
}

interface UseAlphaLeaderboardReturn {
  entries: AlphaLeaderboardEntry[];
  isLoading: boolean;
  error: Error | null;
  userRank: AlphaLeaderboardEntry | null;
  refresh: () => Promise<void>;
}

export function useAlphaLeaderboard(userId?: string): UseAlphaLeaderboardReturn {
  const [entries, setEntries] = useState<AlphaLeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [userRank, setUserRank] = useState<AlphaLeaderboardEntry | null>(null);
  
  const fetchLeaderboard = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/alpha-signals/leaderboard');
      
      if (!response.ok) {
        throw new Error('Failed to fetch leaderboard');
      }
      
      const data = await response.json();
      setEntries(data.entries || []);
      
      if (userId && data.entries) {
        const user = data.entries.find((e: AlphaLeaderboardEntry) => e.username === userId);
        setUserRank(user || null);
      }
      
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setIsLoading(false);
    }
  }, [userId]);
  
  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);
  
  return {
    entries,
    isLoading,
    error,
    userRank,
    refresh: fetchLeaderboard,
  };
}

interface UseNarrativeClustersReturn {
  clusters: NarrativeCluster[];
  isLoading: boolean;
  error: Error | null;
  emergingNarratives: NarrativeCluster[];
  refresh: () => Promise<void>;
}

export function useNarrativeClusters(): UseNarrativeClustersReturn {
  const [clusters, setClusters] = useState<NarrativeCluster[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  const fetchClusters = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/alpha-signals/narratives');
      
      if (!response.ok) {
        throw new Error('Failed to fetch narrative clusters');
      }
      
      const data = await response.json();
      setClusters(data.clusters || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  useEffect(() => {
    fetchClusters();
  }, [fetchClusters]);
  
  const emergingNarratives = clusters.filter(c => c.trendDirection === 'emerging');
  
  return {
    clusters,
    isLoading,
    error,
    emergingNarratives,
    refresh: fetchClusters,
  };
}

// Hook to track user's alpha hunting performance
export function useAlphaTracker() {
  const [actedSignals, setActedSignals] = useState<string[]>([]);
  const [responseTime, setResponseTime] = useState<number[]>([]);
  
  const trackAction = useCallback((signalId: string, detectedAt: Date) => {
    const responseMs = Date.now() - detectedAt.getTime();
    setActedSignals(prev => [...prev, signalId]);
    setResponseTime(prev => [...prev, responseMs]);
    
    // Send to backend for leaderboard tracking
    fetch('/api/alpha-signals/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ signalId, responseMs }),
    }).catch(console.error);
  }, []);
  
  const avgResponseTime = responseTime.length > 0
    ? Math.round(responseTime.reduce((a, b) => a + b, 0) / responseTime.length / 1000)
    : 0;
  
  return {
    actedSignals,
    trackAction,
    signalsCaught: actedSignals.length,
    avgResponseTime,
  };
}
