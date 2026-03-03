"use client";

import { useMemo } from "react";
import type { SweepFees, ConsolidationFees } from "@/lib/types";

// ============================================
// Types
// ============================================

interface FeeItem {
  label: string;
  value: number;
  description?: string;
  highlight?: boolean;
}

interface FeeBreakdownProps {
  /** Sweep fees */
  sweepFees?: SweepFees;
  /** Consolidation fees */
  consolidationFees?: ConsolidationFees;
  /** Custom fee items */
  customFees?: FeeItem[];
  /** Total input value for calculating percentages */
  totalInputUsd?: number;
  /** Whether to show as compact view */
  compact?: boolean;
  /** Additional class name */
  className?: string;
}

// ============================================
// Component
// ============================================

/**
 * Detailed fee breakdown visualization component
 * Shows all fees with percentages and tooltips
 */
export function FeeBreakdown({
  sweepFees,
  consolidationFees,
  customFees,
  totalInputUsd = 0,
  compact = false,
  className = "",
}: FeeBreakdownProps) {
  // Build fee items array
  const feeItems = useMemo<FeeItem[]>(() => {
    const items: FeeItem[] = [];

    if (sweepFees) {
      items.push({
        label: "Protocol Fee",
        value: sweepFees.protocol,
        description: "Fee charged by Sweep for the sweep service",
      });
      items.push({
        label: "Gas Fee",
        value: sweepFees.gas,
        description: "Network transaction costs",
      });
      if (sweepFees.bridge && sweepFees.bridge > 0) {
        items.push({
          label: "Bridge Fee",
          value: sweepFees.bridge,
          description: "Cost to bridge tokens across chains",
        });
      }
    }

    if (consolidationFees) {
      items.push({
        label: "Bridge Fees",
        value: consolidationFees.bridgeFees,
        description: "Fees charged by bridge protocols",
      });
      items.push({
        label: "Gas Fees",
        value: consolidationFees.gasFees,
        description: "Network transaction costs across all chains",
      });
      items.push({
        label: "Protocol Fee",
        value: consolidationFees.protocolFees,
        description: "Fee charged by Sweep",
      });
    }

    if (customFees) {
      items.push(...customFees);
    }

    return items;
  }, [sweepFees, consolidationFees, customFees]);

  // Calculate total
  const total = useMemo(() => {
    if (sweepFees) return sweepFees.total;
    if (consolidationFees) return consolidationFees.total;
    return feeItems.reduce((sum, item) => sum + item.value, 0);
  }, [sweepFees, consolidationFees, feeItems]);

  // Calculate percentage of input
  const totalPercentage = totalInputUsd > 0 ? (total / totalInputUsd) * 100 : 0;

  // Determine if fees are high (>5%)
  const isHighFee = totalPercentage > 5;
  const isMediumFee = totalPercentage > 2 && totalPercentage <= 5;

  if (compact) {
    return (
      <div className={`flex items-center justify-between ${className}`}>
        <span className="text-sm text-muted-foreground">Total Fees</span>
        <div className="flex items-center gap-2">
          <span className={`font-medium ${isHighFee ? "text-destructive" : ""}`}>
            ${total.toFixed(2)}
          </span>
          {totalInputUsd > 0 && (
            <span
              className={`text-xs px-2 py-0.5 rounded-full ${
                isHighFee
                  ? "bg-destructive/20 text-destructive"
                  : isMediumFee
                    ? "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400"
                    : "bg-green-500/20 text-green-600 dark:text-green-400"
              }`}
            >
              {totalPercentage.toFixed(1)}%
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-muted/50 rounded-lg p-4 ${className}`}>
      <h3 className="font-semibold mb-3 flex items-center gap-2">
        <FeeIcon />
        Fee Breakdown
      </h3>

      {/* Fee Items */}
      <div className="space-y-2 mb-4">
        {feeItems.map((item) => (
          <FeeRow
            key={item.label}
            item={item}
            totalInputUsd={totalInputUsd}
          />
        ))}
      </div>

      {/* Divider */}
      <div className="border-t border-border my-3" />

      {/* Total */}
      <div className="flex items-center justify-between">
        <span className="font-semibold">Total Fees</span>
        <div className="flex items-center gap-2">
          <span className={`text-lg font-bold ${isHighFee ? "text-destructive" : ""}`}>
            ${total.toFixed(2)}
          </span>
          {totalInputUsd > 0 && (
            <span
              className={`text-sm px-2 py-0.5 rounded-full ${
                isHighFee
                  ? "bg-destructive/20 text-destructive"
                  : isMediumFee
                    ? "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400"
                    : "bg-green-500/20 text-green-600 dark:text-green-400"
              }`}
            >
              {totalPercentage.toFixed(1)}%
            </span>
          )}
        </div>
      </div>

      {/* High fee warning */}
      {isHighFee && (
        <div className="mt-3 flex items-start gap-2 text-sm text-destructive bg-destructive/10 rounded-lg p-3">
          <WarningIcon />
          <div>
            <p className="font-medium">High fees detected</p>
            <p className="text-destructive/80">
              Consider sweeping larger amounts to reduce the fee percentage.
            </p>
          </div>
        </div>
      )}

      {/* Savings badge */}
      {totalPercentage < 2 && totalInputUsd > 10 && (
        <div className="mt-3 flex items-center gap-2 text-sm text-green-600 dark:text-green-400 bg-green-500/10 rounded-lg p-3">
          <SavingsIcon />
          <span>
            Great deal! You're saving gas by batching {feeItems.length > 2 ? "multiple swaps" : "your swap"}.
          </span>
        </div>
      )}
    </div>
  );
}

// ============================================
// Sub-components
// ============================================

interface FeeRowProps {
  item: FeeItem;
  totalInputUsd: number;
}

function FeeRow({ item, totalInputUsd }: FeeRowProps) {
  const percentage = totalInputUsd > 0 ? (item.value / totalInputUsd) * 100 : 0;

  return (
    <div className="flex items-center justify-between group">
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">{item.label}</span>
        {item.description && (
          <div className="relative">
            <InfoIcon className="w-3.5 h-3.5 text-muted-foreground/50 cursor-help" />
            <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block z-10">
              <div className="bg-popover text-popover-foreground text-xs p-2 rounded shadow-lg border max-w-[200px]">
                {item.description}
              </div>
            </div>
          </div>
        )}
      </div>
      <div className="flex items-center gap-2">
        <span className={`text-sm ${item.highlight ? "font-medium text-primary" : ""}`}>
          ${item.value.toFixed(2)}
        </span>
        {totalInputUsd > 0 && percentage >= 0.1 && (
          <span className="text-xs text-muted-foreground">
            ({percentage.toFixed(1)}%)
          </span>
        )}
      </div>
    </div>
  );
}

// ============================================
// Icons
// ============================================

function FeeIcon() {
  return (
    <svg
      className="w-4 h-4 text-muted-foreground"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

function WarningIcon() {
  return (
    <svg
      className="w-5 h-5 flex-shrink-0"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
      />
    </svg>
  );
}

function SavingsIcon() {
  return (
    <svg
      className="w-5 h-5 flex-shrink-0"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

function InfoIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

// ============================================
// Skeleton
// ============================================

export function FeeBreakdownSkeleton() {
  return (
    <div className="bg-muted/50 rounded-lg p-4 animate-pulse">
      <div className="h-5 bg-muted rounded w-32 mb-4" />
      <div className="space-y-3">
        <div className="flex justify-between">
          <div className="h-4 bg-muted rounded w-24" />
          <div className="h-4 bg-muted rounded w-16" />
        </div>
        <div className="flex justify-between">
          <div className="h-4 bg-muted rounded w-20" />
          <div className="h-4 bg-muted rounded w-12" />
        </div>
        <div className="flex justify-between">
          <div className="h-4 bg-muted rounded w-28" />
          <div className="h-4 bg-muted rounded w-14" />
        </div>
      </div>
      <div className="border-t border-border my-3" />
      <div className="flex justify-between">
        <div className="h-5 bg-muted rounded w-20" />
        <div className="h-6 bg-muted rounded w-20" />
      </div>
    </div>
  );
}
