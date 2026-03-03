"use client";

import Image from "next/image";
import { getChainName } from "@/lib/chains";
import type { DefiVault } from "@/hooks/useDefiPositions";

// ============================================
// Types
// ============================================

interface DeFiVaultCardProps {
  vault: DefiVault;
  selected?: boolean;
  onSelect?: () => void;
  showDepositButton?: boolean;
  onDeposit?: () => void;
  compact?: boolean;
  className?: string;
}

// ============================================
// Component
// ============================================

/**
 * Card component for displaying a DeFi vault
 * Used for vault selection and display in the DeFi page
 */
export function DeFiVaultCard({
  vault,
  selected = false,
  onSelect,
  showDepositButton = false,
  onDeposit,
  compact = false,
  className = "",
}: DeFiVaultCardProps) {
  const riskColors = {
    LOW: "bg-green-500/20 text-green-600 dark:text-green-400",
    MEDIUM: "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400",
    HIGH: "bg-red-500/20 text-red-600 dark:text-red-400",
  };

  const riskLabels = {
    LOW: "Low Risk",
    MEDIUM: "Medium Risk",
    HIGH: "High Risk",
  };

  if (compact) {
    return (
      <button
        onClick={onSelect}
        className={`
          w-full flex items-center gap-3 p-3 rounded-lg border transition-all
          ${selected
            ? "bg-primary/10 border-primary ring-1 ring-primary"
            : "bg-card border-border hover:border-primary/50 hover:bg-muted/50"
          }
          ${className}
        `}
      >
        {/* Logo */}
        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
          {vault.logoUrl ? (
            <Image
              src={vault.logoUrl}
              alt={vault.protocol}
              width={28}
              height={28}
              className="rounded-full"
            />
          ) : (
            <span className="text-lg">🏦</span>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0 text-left">
          <p className="font-medium truncate">{vault.name}</p>
          <p className="text-xs text-muted-foreground">{vault.protocol}</p>
        </div>

        {/* APY */}
        <div className="text-right">
          <p className="font-bold text-green-500">{vault.apy.toFixed(2)}%</p>
          <p className="text-xs text-muted-foreground">APY</p>
        </div>

        {/* Selected indicator */}
        {selected && (
          <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
            <CheckIcon className="w-3 h-3 text-primary-foreground" />
          </div>
        )}
      </button>
    );
  }

  return (
    <div
      className={`
        bg-card rounded-xl border overflow-hidden transition-all
        ${selected ? "border-primary ring-1 ring-primary" : "border-border"}
        ${onSelect ? "cursor-pointer hover:border-primary/50" : ""}
        ${className}
      `}
      onClick={onSelect}
    >
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-start gap-4">
          {/* Logo */}
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center overflow-hidden">
            {vault.logoUrl ? (
              <Image
                src={vault.logoUrl}
                alt={vault.protocol}
                width={40}
                height={40}
                className="rounded-full"
              />
            ) : (
              <span className="text-2xl">🏦</span>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold truncate">{vault.name}</h3>
              {selected && (
                <span className="text-primary text-sm">✓ Selected</span>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{vault.protocol}</p>
            <div className="flex items-center gap-2 mt-1">
              <span
                className={`text-xs px-2 py-0.5 rounded-full ${riskColors[vault.riskLevel]}`}
              >
                {riskLabels[vault.riskLevel]}
              </span>
              <span className="text-xs text-muted-foreground">
                {getChainName(vault.chainId)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 divide-x divide-border">
        <div className="p-3 text-center">
          <p className="text-2xl font-bold text-green-500">{vault.apy.toFixed(2)}%</p>
          <p className="text-xs text-muted-foreground">APY</p>
        </div>
        <div className="p-3 text-center">
          <p className="text-lg font-semibold">{formatTVL(vault.tvl)}</p>
          <p className="text-xs text-muted-foreground">TVL</p>
        </div>
        <div className="p-3 text-center">
          <p className="text-lg font-semibold">{vault.asset}</p>
          <p className="text-xs text-muted-foreground">Asset</p>
        </div>
      </div>

      {/* Description */}
      {vault.description && (
        <div className="px-4 py-3 bg-muted/30">
          <p className="text-sm text-muted-foreground">{vault.description}</p>
        </div>
      )}

      {/* Deposit Button */}
      {showDepositButton && onDeposit && (
        <div className="p-4 border-t border-border">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDeposit();
            }}
            className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
          >
            Deposit {vault.asset}
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================
// Vault List Component
// ============================================

interface DeFiVaultListProps {
  vaults: DefiVault[];
  selectedVaultId?: string;
  onSelectVault?: (vaultId: string) => void;
  loading?: boolean;
  emptyMessage?: string;
  compact?: boolean;
}

export function DeFiVaultList({
  vaults,
  selectedVaultId,
  onSelectVault,
  loading = false,
  emptyMessage = "No vaults available",
  compact = false,
}: DeFiVaultListProps) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <DeFiVaultCardSkeleton key={i} compact={compact} />
        ))}
      </div>
    );
  }

  if (vaults.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={compact ? "space-y-2" : "grid gap-4 md:grid-cols-2"}>
      {vaults.map((vault) => (
        <DeFiVaultCard
          key={vault.id}
          vault={vault}
          selected={selectedVaultId === vault.id}
          onSelect={onSelectVault ? () => onSelectVault(vault.id) : undefined}
          compact={compact}
        />
      ))}
    </div>
  );
}

// ============================================
// APY Comparison Table
// ============================================

interface APYComparisonTableProps {
  vaults: DefiVault[];
  onSelectVault?: (vaultId: string) => void;
}

export function APYComparisonTable({ vaults, onSelectVault }: APYComparisonTableProps) {
  // Sort by APY descending
  const sortedVaults = [...vaults].sort((a, b) => b.apy - a.apy);

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border text-left">
            <th className="pb-3 font-medium text-muted-foreground">Protocol</th>
            <th className="pb-3 font-medium text-muted-foreground">Asset</th>
            <th className="pb-3 font-medium text-muted-foreground">Chain</th>
            <th className="pb-3 font-medium text-muted-foreground text-right">APY</th>
            <th className="pb-3 font-medium text-muted-foreground text-right">TVL</th>
            <th className="pb-3 font-medium text-muted-foreground text-center">Risk</th>
            {onSelectVault && <th className="pb-3"></th>}
          </tr>
        </thead>
        <tbody>
          {sortedVaults.map((vault) => (
            <tr
              key={vault.id}
              className="border-b border-border/50 hover:bg-muted/30 transition-colors"
            >
              <td className="py-3">
                <div className="flex items-center gap-2">
                  {vault.logoUrl && (
                    <Image
                      src={vault.logoUrl}
                      alt={vault.protocol}
                      width={24}
                      height={24}
                      className="rounded-full"
                    />
                  )}
                  <span className="font-medium">{vault.protocol}</span>
                </div>
              </td>
              <td className="py-3">{vault.asset}</td>
              <td className="py-3 text-muted-foreground">{getChainName(vault.chainId)}</td>
              <td className="py-3 text-right font-bold text-green-500">
                {vault.apy.toFixed(2)}%
              </td>
              <td className="py-3 text-right text-muted-foreground">{formatTVL(vault.tvl)}</td>
              <td className="py-3 text-center">
                <RiskBadge level={vault.riskLevel} />
              </td>
              {onSelectVault && (
                <td className="py-3">
                  <button
                    onClick={() => onSelectVault(vault.id)}
                    className="text-sm text-primary hover:underline"
                  >
                    Select
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ============================================
// Helpers
// ============================================

function formatTVL(tvl: number): string {
  if (tvl >= 1_000_000_000) {
    return `$${(tvl / 1_000_000_000).toFixed(1)}B`;
  }
  if (tvl >= 1_000_000) {
    return `$${(tvl / 1_000_000).toFixed(1)}M`;
  }
  if (tvl >= 1_000) {
    return `$${(tvl / 1_000).toFixed(1)}K`;
  }
  return `$${tvl.toFixed(0)}`;
}

function RiskBadge({ level }: { level: "LOW" | "MEDIUM" | "HIGH" }) {
  const colors = {
    LOW: "bg-green-500/20 text-green-600 dark:text-green-400",
    MEDIUM: "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400",
    HIGH: "bg-red-500/20 text-red-600 dark:text-red-400",
  };

  return (
    <span className={`text-xs px-2 py-0.5 rounded-full ${colors[level]}`}>
      {level}
    </span>
  );
}

function CheckIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={3}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

// ============================================
// Skeleton
// ============================================

export function DeFiVaultCardSkeleton({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <div className="flex items-center gap-3 p-3 rounded-lg border border-border animate-pulse">
        <div className="w-10 h-10 rounded-full bg-muted" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-muted rounded w-24" />
          <div className="h-3 bg-muted rounded w-16" />
        </div>
        <div className="space-y-2 text-right">
          <div className="h-4 bg-muted rounded w-12" />
          <div className="h-3 bg-muted rounded w-8" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden animate-pulse">
      <div className="p-4 border-b border-border">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-full bg-muted" />
          <div className="flex-1 space-y-2">
            <div className="h-5 bg-muted rounded w-32" />
            <div className="h-4 bg-muted rounded w-20" />
            <div className="flex gap-2">
              <div className="h-4 bg-muted rounded w-16" />
              <div className="h-4 bg-muted rounded w-16" />
            </div>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-3 divide-x divide-border">
        {[1, 2, 3].map((i) => (
          <div key={i} className="p-3 text-center space-y-1">
            <div className="h-6 bg-muted rounded w-16 mx-auto" />
            <div className="h-3 bg-muted rounded w-10 mx-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}
