/**
 * Exchange Sync Hook
 * 
 * React hook for managing exchange connections and portfolio sync
 */

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from './useAuth';

// =============================================================================
// TYPES
// =============================================================================

export interface ExchangeConfig {
  id: string;
  name: string;
  connected: boolean;
  lastSync?: number;
  requiredFields?: string[];
  docsUrl?: string;
}

export interface Balance {
  asset: string;
  free: string;
  locked: string;
  total: number;
  usdValue: number;
}

export interface Trade {
  id: string;
  exchange: string;
  symbol: string;
  side: 'buy' | 'sell';
  price: number;
  quantity: number;
  total: number;
  fee?: number;
  feeAsset?: string;
  timestamp: number;
}

export interface AggregatedPortfolio {
  totalValue: number;
  change24h: number;
  changePercent: number;
  holdings: Array<{
    asset: string;
    balance: number;
    value: number;
    price: number;
    change24h: number;
    allocation: number;
    exchanges: string[];
  }>;
  lastUpdated: number;
}

export interface SyncResult {
  success: boolean;
  balanceCount?: number;
  tradeCount?: number;
  error?: string;
}

export interface SyncHistoryItem {
  id: string;
  exchange: string;
  status: 'success' | 'failed';
  balanceCount?: number;
  tradeCount?: number;
  error?: string;
  syncedAt: number;
  duration: number;
}

// =============================================================================
// HOOK
// =============================================================================

export function useExchangeSync() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [exchanges, setExchanges] = useState<ExchangeConfig[]>([]);
  const [portfolio, setPortfolio] = useState<AggregatedPortfolio | null>(null);
  const [syncHistory, setSyncHistory] = useState<SyncHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch exchange list
  const fetchExchanges = useCallback(async () => {
    if (!isAuthenticated) return;
    
    try {
      const response = await fetch('/api/exchanges?action=list');
      if (!response.ok) throw new Error('Failed to fetch exchanges');
      
      const data = await response.json();
      setExchanges(data.exchanges || []);
    } catch (err) {
      console.error('Fetch exchanges error:', err);
      setError((err as Error).message);
    }
  }, [isAuthenticated]);

  // Fetch aggregated portfolio
  const fetchPortfolio = useCallback(async () => {
    if (!isAuthenticated) return;
    
    try {
      const response = await fetch('/api/exchanges?action=portfolio');
      if (!response.ok) throw new Error('Failed to fetch portfolio');
      
      const data = await response.json();
      setPortfolio(data);
    } catch (err) {
      console.error('Fetch portfolio error:', err);
      // Don't set error for portfolio - might just not have any connected exchanges
    }
  }, [isAuthenticated]);

  // Fetch sync history
  const fetchSyncHistory = useCallback(async (exchange?: string) => {
    if (!isAuthenticated) return;
    
    try {
      const params = new URLSearchParams({ action: 'history' });
      if (exchange) params.set('exchange', exchange);
      
      const response = await fetch(`/api/exchanges?${params}`);
      if (!response.ok) throw new Error('Failed to fetch sync history');
      
      const data = await response.json();
      setSyncHistory(data.history || []);
    } catch (err) {
      console.error('Fetch sync history error:', err);
    }
  }, [isAuthenticated]);

  // Initial fetch
  useEffect(() => {
    if (authLoading) return;
    
    if (isAuthenticated) {
      setIsLoading(true);
      Promise.all([
        fetchExchanges(),
        fetchPortfolio(),
        fetchSyncHistory(),
      ]).finally(() => {
        setIsLoading(false);
      });
    } else {
      setExchanges([]);
      setPortfolio(null);
      setSyncHistory([]);
      setIsLoading(false);
    }
  }, [isAuthenticated, authLoading, fetchExchanges, fetchPortfolio, fetchSyncHistory]);

  // Connect exchange
  const connectExchange = useCallback(async (
    exchange: string,
    credentials: {
      apiKey: string;
      apiSecret: string;
      passphrase?: string;
      subaccountName?: string;
    }
  ) => {
    setError(null);
    setIsSyncing(exchange);
    
    try {
      const response = await fetch('/api/exchanges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'connect',
          exchange,
          ...credentials,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to connect exchange');
      }

      // Refresh data
      await Promise.all([fetchExchanges(), fetchPortfolio()]);
      
      return { success: true, sync: data.sync };
    } catch (err) {
      const message = (err as Error).message;
      setError(message);
      return { success: false, error: message };
    } finally {
      setIsSyncing(null);
    }
  }, [fetchExchanges, fetchPortfolio]);

  // Disconnect exchange
  const disconnectExchange = useCallback(async (exchange: string) => {
    setError(null);
    
    try {
      const response = await fetch(`/api/exchanges?exchange=${exchange}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to disconnect exchange');
      }

      // Refresh data
      await Promise.all([fetchExchanges(), fetchPortfolio()]);
      
      return { success: true };
    } catch (err) {
      const message = (err as Error).message;
      setError(message);
      return { success: false, error: message };
    }
  }, [fetchExchanges, fetchPortfolio]);

  // Sync single exchange
  const syncExchange = useCallback(async (exchange: string) => {
    setError(null);
    setIsSyncing(exchange);
    
    try {
      const response = await fetch('/api/exchanges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'sync',
          exchange,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Sync failed');
      }

      // Refresh portfolio
      await fetchPortfolio();
      
      return { success: true, sync: data.sync };
    } catch (err) {
      const message = (err as Error).message;
      setError(message);
      return { success: false, error: message };
    } finally {
      setIsSyncing(null);
    }
  }, [fetchPortfolio]);

  // Sync all connected exchanges
  const syncAllExchanges = useCallback(async () => {
    setError(null);
    setIsSyncing('all');
    
    try {
      const response = await fetch('/api/exchanges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'sync-all',
          exchange: 'all', // Required by endpoint validation
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Sync failed');
      }

      // Refresh portfolio
      await fetchPortfolio();
      
      return { success: data.success, results: data.results };
    } catch (err) {
      const message = (err as Error).message;
      setError(message);
      return { success: false, error: message };
    } finally {
      setIsSyncing(null);
    }
  }, [fetchPortfolio]);

  // Computed values
  const connectedExchanges = useMemo(() => 
    exchanges.filter(e => e.connected), 
    [exchanges]
  );

  const hasConnectedExchanges = connectedExchanges.length > 0;

  return {
    // State
    exchanges,
    connectedExchanges,
    hasConnectedExchanges,
    portfolio,
    syncHistory,
    isLoading: isLoading || authLoading,
    isSyncing,
    error,
    
    // Actions
    connectExchange,
    disconnectExchange,
    syncExchange,
    syncAllExchanges,
    refresh: useCallback(() => {
      return Promise.all([
        fetchExchanges(),
        fetchPortfolio(),
        fetchSyncHistory(),
      ]);
    }, [fetchExchanges, fetchPortfolio, fetchSyncHistory]),
  };
}

export default useExchangeSync;
