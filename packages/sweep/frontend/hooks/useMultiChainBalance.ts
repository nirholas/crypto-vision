"use client";

import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { SUPPORTED_CHAINS, getChainName } from "@/lib/chains";
import type { MultiChainBalance, ChainBalance, DustToken } from "@/lib/types";

// API function to fetch balances
async function fetchMultiChainBalances(
  wallet: string,
  chainIds?: number[]
): Promise<MultiChainBalance> {
  const params = new URLSearchParams({ wallet });
  if (chainIds?.length) {
    params.append("chains", chainIds.join(","));
  }

  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/api/wallet/summary?${params}`
  );

  if (!response.ok) {
    throw new Error("Failed to fetch multi-chain balances");
  }

  const data = await response.json();

  // Transform API response to MultiChainBalance format
  const chainBreakdown: ChainBalance[] = Object.entries(data.chainBreakdown || {}).map(
    ([chainIdStr, breakdown]: [string, any]) => {
      const chainId = parseInt(chainIdStr);
      return {
        chainId,
        chainName: getChainName(chainId),
        tokenCount: breakdown.count || 0,
        totalValueUsd: breakdown.valueUsd || 0,
        nativeBalance: breakdown.nativeBalance || "0",
        nativeValueUsd: breakdown.nativeValueUsd || 0,
      };
    }
  );

  return {
    totalValueUsd: data.totalValueUsd || 0,
    chainBreakdown,
    lastUpdated: Date.now(),
  };
}

interface UseMultiChainBalanceOptions {
  /** Specific chain IDs to query (defaults to all supported chains) */
  chainIds?: number[];
  /** Whether the query is enabled */
  enabled?: boolean;
  /** Refetch interval in ms (default: 60000) */
  refetchInterval?: number;
}

/**
 * Hook to fetch aggregated balances across multiple chains
 * Returns total value and per-chain breakdown
 */
export function useMultiChainBalance(options: UseMultiChainBalanceOptions = {}) {
  const { address } = useAccount();
  const {
    chainIds = SUPPORTED_CHAINS.map((c) => c.id),
    enabled = true,
    refetchInterval = 60000,
  } = options;

  const query = useQuery<MultiChainBalance, Error>({
    queryKey: ["multiChainBalance", address, chainIds.sort().join(",")],
    queryFn: () => {
      if (!address) throw new Error("Wallet not connected");
      return fetchMultiChainBalances(address, chainIds);
    },
    enabled: enabled && !!address,
    staleTime: 30_000,
    refetchInterval,
    retry: 2,
  });

  // Calculate derived values
  const derived = useMemo(() => {
    if (!query.data) {
      return {
        chainCount: 0,
        totalTokenCount: 0,
        highestValueChain: null as ChainBalance | null,
        sortedChains: [] as ChainBalance[],
      };
    }

    const sortedChains = [...query.data.chainBreakdown].sort(
      (a, b) => b.totalValueUsd - a.totalValueUsd
    );

    return {
      chainCount: query.data.chainBreakdown.length,
      totalTokenCount: query.data.chainBreakdown.reduce((sum: number, c: ChainBalance) => sum + c.tokenCount, 0),
      highestValueChain: sortedChains[0] || null,
      sortedChains,
    };
  }, [query.data]);

  return {
    ...query,
    ...derived,
  };
}

/**
 * Hook to get balance for a specific chain
 */
export function useChainBalance(chainId: number) {
  const { data } = useMultiChainBalance({ chainIds: [chainId] });

  return useMemo(() => {
    if (!data) return null;
    return data.chainBreakdown.find((c: ChainBalance) => c.chainId === chainId) || null;
  }, [data, chainId]);
}

/**
 * Hook to compare balances across chains for consolidation
 * Returns chains sorted by value and suggestions for consolidation
 */
export function useConsolidationSuggestions() {
  const { address } = useAccount();
  const { data: balance, isLoading } = useMultiChainBalance();

  const suggestions = useMemo(() => {
    if (!balance || balance.chainBreakdown.length < 2) {
      return {
        shouldConsolidate: false,
        suggestedSourceChains: [],
        suggestedDestination: null as ChainBalance | null,
        potentialSavings: 0,
      };
    }

    // Sort chains by value, highest first
    const sorted = [...balance.chainBreakdown].sort(
      (a, b) => b.totalValueUsd - a.totalValueUsd
    );

    // Suggest consolidating from lower value chains to highest value chain
    const destination = sorted[0];
    const sourceChains = sorted
      .slice(1)
      .filter((c) => c.totalValueUsd > 1) // Only suggest chains with >$1
      .slice(0, 5); // Max 5 source chains

    // Rough estimate of potential savings (fewer chains = fewer fees)
    const potentialSavings = sourceChains.length * 0.5; // $0.50 per chain saved in future txs

    return {
      shouldConsolidate: sourceChains.length > 0 && balance.totalValueUsd > 10,
      suggestedSourceChains: sourceChains,
      suggestedDestination: destination,
      potentialSavings,
    };
  }, [balance]);

  return {
    isLoading,
    balance,
    ...suggestions,
  };
}

/**
 * Hook to invalidate and refetch multi-chain balances
 * Useful after completing a sweep or consolidation
 */
export function useInvalidateBalances() {
  const queryClient = useQueryClient();

  return {
    invalidate: () => {
      queryClient.invalidateQueries({ queryKey: ["multiChainBalance"] });
      queryClient.invalidateQueries({ queryKey: ["dustTokens"] });
      queryClient.invalidateQueries({ queryKey: ["walletSummary"] });
    },
    refetchAll: async () => {
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ["multiChainBalance"] }),
        queryClient.refetchQueries({ queryKey: ["dustTokens"] }),
      ]);
    },
  };
}
