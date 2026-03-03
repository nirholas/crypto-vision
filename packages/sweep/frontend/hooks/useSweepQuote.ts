"use client";

import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { getSweepQuote, refreshQuote } from "@/lib/api";
import type { SweepQuote, DustToken } from "@/lib/types";

interface UseSweepQuoteOptions {
  tokens: DustToken[];
  outputToken: string;
  outputChainId: number;
  enabled?: boolean;
}

/**
 * Hook to get a sweep quote for selected tokens
 */
export function useSweepQuote(options: UseSweepQuoteOptions) {
  const { address } = useAccount();
  const { tokens, outputToken, outputChainId, enabled = true } = options;

  // Create a stable key from token addresses
  const tokenKey = tokens
    .map((t) => `${t.chainId}:${t.address}`)
    .sort()
    .join(",");

  return useQuery<SweepQuote, Error>({
    queryKey: ["sweepQuote", address, tokenKey, outputToken, outputChainId],
    queryFn: async () => {
      if (!address) throw new Error("Wallet not connected");
      if (tokens.length === 0) throw new Error("No tokens selected");

      return getSweepQuote(
        address,
        tokens.map((t) => ({ address: t.address, chainId: t.chainId })),
        outputToken,
        outputChainId
      );
    },
    enabled: enabled && !!address && tokens.length > 0,
    staleTime: 15_000, // 15 seconds - quotes expire quickly
    refetchInterval: 30_000, // Refresh every 30 seconds
    retry: 1,
  });
}

/**
 * Hook to refresh an existing quote
 */
export function useRefreshQuote(quoteId: string | null) {
  return useQuery<SweepQuote, Error>({
    queryKey: ["refreshQuote", quoteId],
    queryFn: async () => {
      if (!quoteId) throw new Error("No quote ID");
      return refreshQuote(quoteId);
    },
    enabled: !!quoteId,
    staleTime: 10_000,
    retry: 1,
  });
}

/**
 * Calculate estimated output for display
 */
export function useEstimatedOutput(quote: SweepQuote | null) {
  if (!quote) {
    return {
      output: "0",
      outputUsd: 0,
      priceImpact: 0,
      fees: { protocol: 0, gas: 0, total: 0 },
    };
  }

  return {
    output: quote.estimatedOutput,
    outputUsd: quote.estimatedOutputUsd,
    priceImpact: quote.priceImpact,
    fees: quote.fees,
  };
}

/**
 * Check if quote is still valid
 */
export function isQuoteValid(quote: SweepQuote | null): boolean {
  if (!quote) return false;
  return Date.now() < quote.expiresAt;
}

/**
 * Get quote expiry countdown
 */
export function useQuoteExpiry(quote: SweepQuote | null) {
  if (!quote) return { expired: true, secondsRemaining: 0 };

  const now = Date.now();
  const secondsRemaining = Math.max(0, Math.floor((quote.expiresAt - now) / 1000));

  return {
    expired: secondsRemaining === 0,
    secondsRemaining,
  };
}
