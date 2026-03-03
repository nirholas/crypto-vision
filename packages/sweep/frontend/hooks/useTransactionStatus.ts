"use client";

import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { getWebSocket, type ConnectionState } from "@/lib/websocket";
import type { SweepStatus, TransactionUpdateEvent } from "@/lib/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

// ============================================
// API Functions
// ============================================

async function fetchSweepStatus(sweepId: string): Promise<SweepStatus> {
  const response = await fetch(`${API_BASE}/api/sweep/${sweepId}/status`);
  if (!response.ok) {
    throw new Error("Failed to fetch sweep status");
  }
  return response.json();
}

// ============================================
// WebSocket Connection Hook
// ============================================

/**
 * Hook to manage WebSocket connection state
 * Automatically connects when wallet is connected
 */
export function useWebSocketConnection() {
  const { address, isConnected } = useAccount();
  const [state, setState] = useState<ConnectionState>("disconnected");

  useEffect(() => {
    if (!isConnected || !address) {
      return;
    }

    const ws = getWebSocket();

    // Subscribe to state changes
    const unsubscribe = ws.onStateChange(setState);

    // Connect
    ws.connect(address);

    // Set initial state
    setState(ws.getState());

    return () => {
      unsubscribe();
      // Don't disconnect here - the singleton persists across component mounts
    };
  }, [address, isConnected]);

  const reconnect = useCallback(() => {
    if (address) {
      getWebSocket().connect(address);
    }
  }, [address]);

  return {
    state,
    isConnected: state === "connected",
    isConnecting: state === "connecting",
    hasError: state === "error",
    reconnect,
  };
}

// ============================================
// Transaction Status Hook
// ============================================

interface TransactionUpdate {
  chainId: number;
  txHash: string;
  status: "submitted" | "confirmed" | "failed";
  confirmations?: number;
}

/**
 * Hook to track a sweep's transaction status in real-time
 * Combines polling with WebSocket updates for reliable tracking
 */
export function useTransactionStatus(sweepId: string | null) {
  const [realtimeUpdates, setRealtimeUpdates] = useState<Record<string, TransactionUpdate>>({});
  const [lastUpdate, setLastUpdate] = useState<number>(0);

  // Poll for status as fallback
  const { data: status, isLoading, error, refetch } = useQuery<SweepStatus>({
    queryKey: ["sweepStatus", sweepId],
    queryFn: () => {
      if (!sweepId) throw new Error("No sweep ID");
      return fetchSweepStatus(sweepId);
    },
    enabled: !!sweepId,
    refetchInterval: (query) => {
      const data = query.state.data;
      // Stop polling when complete or failed
      if (data?.status === "confirmed" || data?.status === "failed") {
        return false;
      }
      return 3000; // Poll every 3 seconds while pending
    },
    staleTime: 1000,
  });

  // Subscribe to WebSocket updates
  useEffect(() => {
    if (!sweepId) return;

    const ws = getWebSocket();

    const unsubscribe = ws.onTransactionUpdate((event: TransactionUpdateEvent) => {
      if (event.sweepId !== sweepId) return;

      setRealtimeUpdates((prev) => ({
        ...prev,
        [`${event.chainId}-${event.txHash}`]: {
          chainId: event.chainId,
          txHash: event.txHash,
          status: event.status,
          confirmations: event.confirmations,
        },
      }));
      setLastUpdate(Date.now());

      // Refetch full status when a transaction confirms or fails
      if (event.status === "confirmed" || event.status === "failed") {
        refetch();
      }
    });

    // Subscribe to this sweep's updates
    ws.subscribeSweep(sweepId);

    return () => {
      unsubscribe();
      ws.unsubscribeSweep(sweepId);
    };
  }, [sweepId, refetch]);

  // Merge WebSocket updates with polled status
  const mergedStatus: SweepStatus | undefined = status
    ? {
        ...status,
        transactions: status.transactions?.map((tx) => {
          const key = `${tx.chainId}-${tx.hash}`;
          const update = realtimeUpdates[key];
          if (update) {
            return {
              ...tx,
              status: update.status,
            };
          }
          return tx;
        }),
      }
    : undefined;

  // Calculate overall progress
  const transactions = mergedStatus?.transactions || [];
  const confirmedCount = transactions.filter((tx) => tx.status === "confirmed").length;
  const totalCount = transactions.length || 1;
  const progress = Math.round((confirmedCount / totalCount) * 100);

  return {
    status: mergedStatus,
    isLoading,
    error,
    progress,
    lastUpdate,
    isComplete: mergedStatus?.status === "confirmed",
    isFailed: mergedStatus?.status === "failed",
    isPending: mergedStatus?.status === "pending" || mergedStatus?.status === "submitted",
    refetch,
  };
}

// ============================================
// Transaction History Hook
// ============================================

export interface SweepHistoryItem {
  id: string;
  status: SweepStatus["status"];
  tokensSwept: number;
  valueUsd: number;
  outputAmount: string;
  outputToken: string;
  chainIds: number[];
  createdAt: number;
  completedAt?: number;
}

/**
 * Hook to fetch sweep history for the connected wallet
 */
export function useSweepHistory(limit = 20) {
  const { address } = useAccount();

  return useQuery<SweepHistoryItem[], Error>({
    queryKey: ["sweepHistory", address, limit],
    queryFn: async () => {
      if (!address) throw new Error("Wallet not connected");

      const response = await fetch(
        `${API_BASE}/api/sweep/history?wallet=${address}&limit=${limit}`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch sweep history");
      }

      const data = await response.json();
      return data.sweeps;
    },
    enabled: !!address,
    staleTime: 30_000,
  });
}

// ============================================
// Live Price Updates Hook
// ============================================

interface TokenPrice {
  address: string;
  chainId: number;
  priceUsd: number;
  change24h: number;
  lastUpdated: number;
}

/**
 * Hook to subscribe to real-time price updates for tokens
 */
export function useLivePrices(tokens: Array<{ address: string; chainId: number }>) {
  const [prices, setPrices] = useState<Record<string, TokenPrice>>({});

  useEffect(() => {
    if (tokens.length === 0) return;

    const ws = getWebSocket();

    const unsubscribe = ws.onPriceUpdate((event) => {
      const key = `${event.chainId}-${event.tokenAddress}`;
      setPrices((prev) => ({
        ...prev,
        [key]: {
          address: event.tokenAddress,
          chainId: event.chainId,
          priceUsd: event.priceUsd,
          change24h: event.change24h,
          lastUpdated: Date.now(),
        },
      }));
    });

    // Subscribe to price updates for these tokens
    // (The WebSocket server should handle filtering)

    return () => {
      unsubscribe();
    };
  }, [tokens]);

  const getPrice = useCallback(
    (address: string, chainId: number): TokenPrice | undefined => {
      return prices[`${chainId}-${address}`];
    },
    [prices]
  );

  return {
    prices,
    getPrice,
  };
}

// ============================================
// Helpers
// ============================================

/**
 * Format elapsed time since a timestamp
 */
export function formatElapsedTime(timestamp: number): string {
  const elapsed = Date.now() - timestamp;
  const seconds = Math.floor(elapsed / 1000);

  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

/**
 * Format a transaction status for display
 */
export function formatTransactionStatus(status: string): { label: string; color: string } {
  switch (status) {
    case "pending":
      return { label: "Pending", color: "text-yellow-500" };
    case "submitted":
      return { label: "Submitted", color: "text-blue-500" };
    case "confirmed":
      return { label: "Confirmed", color: "text-green-500" };
    case "failed":
      return { label: "Failed", color: "text-red-500" };
    default:
      return { label: status, color: "text-muted-foreground" };
  }
}
