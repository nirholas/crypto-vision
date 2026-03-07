'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect, useCallback, useState } from 'react';
import { useSocket } from './useSocket';
import { getSwarmStatus, getAgents, getWallets } from '@/lib/api-client';
import type { SwarmStatus, AgentInfo, WalletInfo, TradeInfo } from '@/lib/api-client';

export function useSwarmStatus() {
  const { subscribe } = useSocket();
  const query = useQuery({
    queryKey: ['swarm-status'],
    queryFn: getSwarmStatus,
    refetchInterval: 5000,
  });

  useEffect(() => {
    return subscribe<SwarmStatus>('swarm:status', (data) => {
      query.refetch();
      void data;
    });
  }, [subscribe, query]);

  return {
    status: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error,
  };
}

export function useAgentsLive() {
  const { subscribe } = useSocket();
  const query = useQuery({
    queryKey: ['agents'],
    queryFn: async () => {
      const res = await getAgents();
      return res.agents;
    },
    refetchInterval: 10000,
  });

  useEffect(() => {
    return subscribe('agent:status', () => {
      query.refetch();
    });
  }, [subscribe, query]);

  return {
    agents: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

export function useWalletsLive() {
  const { subscribe } = useSocket();
  const query = useQuery({
    queryKey: ['wallets'],
    queryFn: async () => {
      const res = await getWallets();
      return res.wallets;
    },
    refetchInterval: 10000,
  });

  useEffect(() => {
    return subscribe<{ address: string; balanceLamports: string; tokenBalance?: string }>('wallet:balance', () => {
      query.refetch();
    });
  }, [subscribe, query]);

  return {
    wallets: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

export function usePriceLive(mint: string | null) {
  const { subscribe } = useSocket();
  const [price, setPrice] = useState({ price: 0, marketCap: 0, volume24h: 0 });

  useEffect(() => {
    if (!mint) return;
    return subscribe<{ mint: string; priceSol: number; marketCapSol: number; volume24h: number }>(
      'price:updated',
      (data) => {
        if (data.mint === mint) {
          setPrice({ price: data.priceSol, marketCap: data.marketCapSol, volume24h: data.volume24h });
        }
      },
    );
  }, [subscribe, mint]);

  return price;
}

export function useTradesLive() {
  const { subscribe } = useSocket();
  const [trades, setTrades] = useState<TradeInfo[]>([]);

  const addTrade = useCallback((trade: TradeInfo) => {
    setTrades((prev) => [trade, ...prev].slice(0, 500));
  }, []);

  useEffect(() => {
    return subscribe<TradeInfo>('trade:executed', addTrade);
  }, [subscribe, addTrade]);

  return { trades, addTrade };
}
