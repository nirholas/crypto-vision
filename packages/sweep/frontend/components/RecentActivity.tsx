"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useSweepHistory, type SweepHistoryItem } from "@/hooks/useTransactionStatus";
import { SUPPORTED_CHAINS } from "@/lib/chains";

interface RecentActivityProps {
  limit?: number;
  showViewAll?: boolean;
}

export function RecentActivity({ limit = 5, showViewAll = true }: RecentActivityProps) {
  const { data: history, isLoading, error } = useSweepHistory();

  const recentItems = useMemo(() => {
    if (!history) return [];
    return history.slice(0, limit);
  }, [history, limit]);

  if (isLoading) {
    return (
      <div className="bg-card rounded-xl border p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Recent Activity</h2>
        </div>
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 p-3 bg-muted rounded-lg animate-pulse">
              <div className="w-10 h-10 rounded-full bg-background" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-background rounded w-1/3" />
                <div className="h-3 bg-background rounded w-1/2" />
              </div>
              <div className="h-4 bg-background rounded w-16" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-card rounded-xl border p-6">
        <h2 className="text-lg font-semibold mb-4">Recent Activity</h2>
        <div className="text-center py-8 text-muted-foreground">
          <p>Failed to load activity</p>
          <p className="text-sm">{error.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl border p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Recent Activity</h2>
        {showViewAll && history && history.length > limit && (
          <Link
            href="/history"
            className="text-sm text-primary hover:underline"
          >
            View All
          </Link>
        )}
      </div>

      {recentItems.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-4xl mb-2">📋</p>
          <p className="text-muted-foreground">No recent activity</p>
          <p className="text-sm text-muted-foreground mt-1">
            Start sweeping dust tokens to see your activity here
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {recentItems.map((item: SweepHistoryItem) => (
            <ActivityItem key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

function ActivityItem({ item }: { item: SweepHistoryItem }) {
  // Get the first chain from chainIds array
  const chain = item.chainIds?.length ? SUPPORTED_CHAINS.find((c) => c.id === item.chainIds[0]) : null;
  
  const statusConfig = {
    pending: { icon: "⏳", color: "text-yellow-500", label: "Pending" },
    submitted: { icon: "📤", color: "text-blue-500", label: "Submitted" },
    confirming: { icon: "🔄", color: "text-blue-500", label: "Confirming" },
    confirmed: { icon: "✅", color: "text-green-500", label: "Confirmed" },
    failed: { icon: "❌", color: "text-red-500", label: "Failed" },
  }[item.status] || { icon: "❓", color: "text-muted-foreground", label: "Unknown" };

  // Calculate time ago using createdAt
  const timeAgo = useMemo(() => {
    if (!item.createdAt) return "";
    const now = new Date();
    const then = new Date(item.createdAt);
    const diffMs = now.getTime() - then.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  }, [item.createdAt]);

  return (
    <div className="flex items-center gap-4 p-3 rounded-lg bg-background border border-border/50 hover:border-border transition-colors">
      {/* Icon */}
      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-lg">
        🧹
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="font-medium truncate">
            {item.chainIds?.length > 1 ? "Consolidation" : "Dust Sweep"}
          </span>
          {chain && (
            <span className="text-xs px-2 py-0.5 bg-muted rounded flex-shrink-0">
              {chain.icon} {chain.name}
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground truncate">
          {item.outputToken 
            ? `${item.tokensSwept} tokens → ${item.outputAmount} ${item.outputToken}`
            : `${item.tokensSwept} tokens swept`
          }
        </p>
      </div>

      {/* Status & Time */}
      <div className="text-right flex-shrink-0">
        <div className={`flex items-center gap-1 ${statusConfig.color}`}>
          <span>{statusConfig.icon}</span>
          <span className="text-sm font-medium">{statusConfig.label}</span>
        </div>
        {timeAgo && (
          <p className="text-xs text-muted-foreground">{timeAgo}</p>
        )}
      </div>
    </div>
  );
}

// Quick action buttons for the dashboard
export function QuickActions() {
  return (
    <div className="bg-card rounded-xl border p-6">
      <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <QuickActionButton
          icon="🧹"
          label="Sweep All"
          description="Auto-sweep all dust"
          href="#"
          onClick={() => {
            // Scroll to dust tokens section and select all
            const selectAllBtn = document.querySelector('[data-action="select-all"]');
            if (selectAllBtn) {
              (selectAllBtn as HTMLButtonElement).click();
            }
          }}
        />
        <QuickActionButton
          icon="🔄"
          label="Consolidate"
          description="Merge across chains"
          href="/consolidate"
        />
        <QuickActionButton
          icon="📈"
          label="Earn Yield"
          description="Deposit to DeFi"
          href="/defi"
        />
        <QuickActionButton
          icon="📅"
          label="Subscriptions"
          description="Manage recurring"
          href="/subscriptions"
        />
      </div>
    </div>
  );
}

function QuickActionButton({
  icon,
  label,
  description,
  href,
  onClick,
}: {
  icon: string;
  label: string;
  description: string;
  href: string;
  onClick?: () => void;
}) {
  const content = (
    <>
      <span className="text-2xl mb-2">{icon}</span>
      <span className="font-medium text-sm">{label}</span>
      <span className="text-xs text-muted-foreground">{description}</span>
    </>
  );

  if (onClick) {
    return (
      <button
        onClick={onClick}
        className="flex flex-col items-center justify-center p-4 rounded-lg border border-border hover:border-primary/50 hover:bg-primary/5 transition-all text-center"
      >
        {content}
      </button>
    );
  }

  return (
    <Link
      href={href}
      className="flex flex-col items-center justify-center p-4 rounded-lg border border-border hover:border-primary/50 hover:bg-primary/5 transition-all text-center"
    >
      {content}
    </Link>
  );
}

// Compact version for sidebar or smaller spaces
export function ActivityFeed({ maxItems = 3 }: { maxItems?: number }) {
  const { data: history, isLoading } = useSweepHistory();

  const items = useMemo(() => {
    if (!history) return [];
    return history.slice(0, maxItems);
  }, [history, maxItems]);

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: maxItems }).map((_, i) => (
          <div key={i} className="h-12 bg-muted rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-4">
        No activity yet
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((item: SweepHistoryItem) => (
        <div
          key={item.id}
          className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 text-sm"
        >
          <span>
            {item.status === "confirmed" ? "✅" : item.status === "failed" ? "❌" : "⏳"}
          </span>
          <span className="flex-1 truncate">
            {item.chainIds?.length > 1 ? "Consolidation" : "Sweep"}
          </span>
          <span className="text-muted-foreground text-xs">
            {item.tokensSwept} tokens
          </span>
        </div>
      ))}
    </div>
  );
}
