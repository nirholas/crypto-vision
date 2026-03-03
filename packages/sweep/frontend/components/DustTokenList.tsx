"use client";

import Image from "next/image";
import type { DustToken } from "@/lib/types";
import { SUPPORTED_CHAINS } from "@/lib/chains";

interface DustTokenListProps {
  tokens: DustToken[];
  selectedTokens: DustToken[];
  onTokenSelect: (token: DustToken, selected: boolean) => void;
  isLoading: boolean;
  error: Error | null;
}

export function DustTokenList({
  tokens,
  selectedTokens,
  onTokenSelect,
  isLoading,
  error,
}: DustTokenListProps) {
  if (isLoading) {
    return (
      <div className="py-12 text-center">
        <div className="inline-flex items-center gap-2">
          <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-muted-foreground">Scanning wallets...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-12 text-center">
        <p className="text-destructive mb-2">Failed to load tokens</p>
        <p className="text-sm text-muted-foreground">{error.message}</p>
      </div>
    );
  }

  if (tokens.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-2xl mb-2">🎉</p>
        <p className="text-muted-foreground">No dust tokens found!</p>
        <p className="text-sm text-muted-foreground mt-1">
          Your wallet is squeaky clean.
        </p>
      </div>
    );
  }

  // Group tokens by chainId
  const groupedTokens = tokens.reduce((acc, token) => {
    const chainKey = token.chainId.toString();
    if (!acc[chainKey]) {
      acc[chainKey] = [];
    }
    acc[chainKey].push(token);
    return acc;
  }, {} as Record<string, DustToken[]>);

  return (
    <div className="space-y-6">
      {Object.entries(groupedTokens).map(([chainId, chainTokens]) => {
        const chain = SUPPORTED_CHAINS.find((c) => c.id === parseInt(chainId));
        return (
          <div key={chainId}>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xl">{chain?.icon || "🔗"}</span>
              <span className="font-medium">{chain?.name || `Chain ${chainId}`}</span>
              <span className="text-sm text-muted-foreground">
                ({chainTokens.length} tokens)
              </span>
            </div>
            <div className="space-y-2">
              {chainTokens.map((token) => {
                const isSelected = selectedTokens.some(
                  (t) => t.id === token.id
                );
                return (
                  <TokenRow
                    key={token.id}
                    token={token}
                    isSelected={isSelected}
                    onSelect={(selected) => onTokenSelect(token, selected)}
                  />
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TokenRow({
  token,
  isSelected,
  onSelect,
}: {
  token: DustToken;
  isSelected: boolean;
  onSelect: (selected: boolean) => void;
}) {
  return (
    <div
      onClick={() => onSelect(!isSelected)}
      className={`flex items-center gap-4 p-4 rounded-lg border cursor-pointer transition-colors ${
        isSelected
          ? "bg-primary/5 border-primary"
          : "bg-background border-border hover:border-primary/50"
      }`}
    >
      {/* Checkbox */}
      <div
        className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
          isSelected
            ? "bg-primary border-primary text-white"
            : "border-muted-foreground"
        }`}
      >
        {isSelected && <span className="text-xs">✓</span>}
      </div>

      {/* Token Icon */}
      <div className="relative w-10 h-10">
        {token.logoUrl ? (
          <Image
            src={token.logoUrl}
            alt={token.symbol}
            width={40}
            height={40}
            className="rounded-full"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-lg font-bold">
            {token.symbol.charAt(0)}
          </div>
        )}
      </div>

      {/* Token Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">{token.symbol}</span>
          {token.isVerified && (
            <span className="text-primary text-xs">✓</span>
          )}
        </div>
        <p className="text-sm text-muted-foreground truncate">{token.name}</p>
      </div>

      {/* Balance */}
      <div className="text-right">
        <p className="font-medium">{formatBalance(token.balance)}</p>
        <p className="text-sm text-muted-foreground">
          ${token.valueUsd.toFixed(2)}
        </p>
      </div>

      {/* Risk Indicator */}
      {token.riskLevel && token.riskLevel !== "LOW" && (
        <div
          className={`px-2 py-1 rounded text-xs font-medium ${
            token.riskLevel === "HIGH"
              ? "bg-red-500/10 text-red-500"
              : token.riskLevel === "MEDIUM"
              ? "bg-yellow-500/10 text-yellow-500"
              : "bg-muted text-muted-foreground"
          }`}
        >
          {token.riskLevel}
        </div>
      )}
    </div>
  );
}

function formatBalance(balance: string): string {
  const num = parseFloat(balance);
  if (num === 0) return "0";
  if (num < 0.0001) return "<0.0001";
  if (num < 1) return num.toFixed(4);
  if (num < 1000) return num.toFixed(2);
  if (num < 1000000) return (num / 1000).toFixed(2) + "K";
  return (num / 1000000).toFixed(2) + "M";
}
