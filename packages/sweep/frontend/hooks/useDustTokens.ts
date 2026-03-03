"use client";

import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { getDustTokens, getWalletSummary } from "@/lib/api";
import type { DustToken, WalletTokensResponse } from "@/lib/types";

interface UseDustTokensOptions {
  chainIds?: number[];
  enabled?: boolean;
  minValueUsd?: number;
  maxValueUsd?: number;
  includeSpam?: boolean;
}

/**
 * Hook to fetch dust tokens for the connected wallet
 */
export function useDustTokens(options: UseDustTokensOptions = {}) {
  const { address } = useAccount();
  const {
    chainIds,
    enabled = true,
    minValueUsd = 0.1,
    maxValueUsd = 100,
    includeSpam = false,
  } = options;

  return useQuery<DustToken[], Error>({
    queryKey: ["dustTokens", address, chainIds, minValueUsd, maxValueUsd, includeSpam],
    queryFn: async () => {
      if (!address) throw new Error("Wallet not connected");
      
      const tokens = await getDustTokens(address, chainIds);
      
      // Filter tokens based on options
      return tokens.filter((token) => {
        // Filter by value range
        if (token.balanceUsd < minValueUsd) return false;
        if (token.balanceUsd > maxValueUsd) return false;
        
        // Filter spam tokens
        if (!includeSpam && token.isSpam) return false;
        
        return true;
      });
    },
    enabled: enabled && !!address,
    staleTime: 30_000, // 30 seconds
    refetchInterval: 60_000, // Refresh every minute
    retry: 2,
  });
}

/**
 * Hook to fetch wallet summary with chain breakdown
 */
export function useWalletSummary() {
  const { address } = useAccount();

  return useQuery<WalletTokensResponse, Error>({
    queryKey: ["walletSummary", address],
    queryFn: async () => {
      if (!address) throw new Error("Wallet not connected");
      return getWalletSummary(address);
    },
    enabled: !!address,
    staleTime: 60_000, // 1 minute
    refetchInterval: 120_000, // Refresh every 2 minutes
  });
}

/**
 * Hook to get token count by chain
 */
export function useTokenCountByChain() {
  const { data: tokens } = useDustTokens();

  if (!tokens) return {};

  return tokens.reduce((acc, token) => {
    acc[token.chainId] = (acc[token.chainId] || 0) + 1;
    return acc;
  }, {} as Record<number, number>);
}

/**
 * Hook to get total dust value
 */
export function useTotalDustValue() {
  const { data: tokens } = useDustTokens();

  if (!tokens) return 0;

  return tokens.reduce((total, token) => total + token.balanceUsd, 0);
}
