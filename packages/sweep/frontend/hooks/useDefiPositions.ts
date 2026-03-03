"use client";

import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { getDefiPositions, getDefiVaults } from "@/lib/api";

export interface DefiPosition {
  id: string;
  protocol: string;
  chainId: number;
  asset: string;
  balance: string;
  valueUsd: number;
  apy: number;
  pendingRewards?: number;
  earnedTotal?: number;
  entryDate: number;
  vaultAddress: string;
}

export interface DefiVault {
  id: string;
  protocol: string;
  name: string;
  asset: string;
  apy: number;
  tvl: number;
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  chainId: number;
  logoUrl?: string;
  description?: string;
  vaultAddress: string;
}

interface UseDefiPositionsOptions {
  enabled?: boolean;
}

/**
 * Hook to fetch user's DeFi positions
 */
export function useDefiPositions(options: UseDefiPositionsOptions = {}) {
  const { address } = useAccount();
  const { enabled = true } = options;

  return useQuery<DefiPosition[], Error>({
    queryKey: ["defiPositions", address],
    queryFn: async () => {
      if (!address) throw new Error("Wallet not connected");
      return getDefiPositions(address);
    },
    enabled: enabled && !!address,
    staleTime: 60_000, // 1 minute
    refetchInterval: 120_000, // Refresh every 2 minutes
    retry: 2,
  });
}

/**
 * Hook to fetch available DeFi vaults
 */
export function useDefiVaults(chainId?: number) {
  return useQuery<DefiVault[], Error>({
    queryKey: ["defiVaults", chainId],
    queryFn: async () => {
      return getDefiVaults(chainId);
    },
    staleTime: 300_000, // 5 minutes
    retry: 2,
  });
}

/**
 * Hook to calculate total DeFi value
 */
export function useTotalDefiValue() {
  const { data: positions } = useDefiPositions();

  if (!positions) return { totalValue: 0, totalRewards: 0 };

  return {
    totalValue: positions.reduce((sum, p) => sum + p.valueUsd, 0),
    totalRewards: positions.reduce((sum, p) => sum + (p.pendingRewards || 0), 0),
  };
}

/**
 * Hook to get DeFi positions grouped by protocol
 */
export function useDefiByProtocol() {
  const { data: positions } = useDefiPositions();

  if (!positions) return {};

  return positions.reduce((acc, position) => {
    if (!acc[position.protocol]) {
      acc[position.protocol] = [];
    }
    acc[position.protocol].push(position);
    return acc;
  }, {} as Record<string, DefiPosition[]>);
}
