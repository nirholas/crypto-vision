"use client";

import { useMemo } from "react";
import type { DustToken } from "@/lib/types";
import { SUPPORTED_CHAINS } from "@/lib/chains";

interface PortfolioSummaryProps {
  tokens: DustToken[];
  isLoading?: boolean;
}

export function PortfolioSummary({ tokens, isLoading }: PortfolioSummaryProps) {
  // Calculate summary stats
  const stats = useMemo(() => {
    if (!tokens.length) {
      return {
        totalValue: 0,
        tokenCount: 0,
        chainBreakdown: [],
      };
    }

    const totalValue = tokens.reduce(
      (sum, t) => sum + (t.valueUsd || t.balanceUsd || 0),
      0
    );

    // Group by chain
    const byChain = tokens.reduce((acc, token) => {
      const chainId = token.chainId;
      if (!acc[chainId]) {
        acc[chainId] = { count: 0, value: 0 };
      }
      acc[chainId].count++;
      acc[chainId].value += token.valueUsd || token.balanceUsd || 0;
      return acc;
    }, {} as Record<number, { count: number; value: number }>);

    const chainBreakdown = Object.entries(byChain)
      .map(([chainId, data]) => {
        const chain = SUPPORTED_CHAINS.find((c) => c.id === parseInt(chainId));
        return {
          chainId: parseInt(chainId),
          name: chain?.name || `Chain ${chainId}`,
          icon: chain?.icon || "🔗",
          ...data,
          percentage: (data.value / totalValue) * 100,
        };
      })
      .sort((a, b) => b.value - a.value);

    return {
      totalValue,
      tokenCount: tokens.length,
      chainBreakdown,
    };
  }, [tokens]);

  if (isLoading) {
    return (
      <div className="bg-card rounded-xl border p-6 animate-pulse">
        <div className="h-6 bg-muted rounded w-1/3 mb-4" />
        <div className="h-10 bg-muted rounded w-1/2 mb-6" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-8 bg-muted rounded" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl border p-6">
      <h2 className="text-lg font-semibold mb-4">Portfolio Summary</h2>

      {/* Total Value */}
      <div className="mb-6">
        <p className="text-sm text-muted-foreground">Total Dust Value</p>
        <p className="text-3xl font-bold text-primary">
          ${stats.totalValue.toFixed(2)}
        </p>
        <p className="text-sm text-muted-foreground">
          {stats.tokenCount} tokens across {stats.chainBreakdown.length} chains
        </p>
      </div>

      {/* Chain Breakdown */}
      <div className="space-y-3">
        <p className="text-sm font-medium">By Chain</p>
        {stats.chainBreakdown.map((chain) => (
          <div key={chain.chainId} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <span>{chain.icon}</span>
                <span>{chain.name}</span>
                <span className="text-muted-foreground">
                  ({chain.count} tokens)
                </span>
              </div>
              <span className="font-medium">${chain.value.toFixed(2)}</span>
            </div>
            {/* Progress bar */}
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: `${chain.percentage}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Empty state */}
      {stats.tokenCount === 0 && (
        <div className="text-center py-8">
          <p className="text-4xl mb-2">✨</p>
          <p className="text-muted-foreground">No dust tokens found</p>
        </div>
      )}
    </div>
  );
}
