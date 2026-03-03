"use client";

// Skeleton components for loading states

export function TokenSkeleton() {
  return (
    <div className="flex items-center gap-4 p-4 rounded-lg border border-border animate-pulse">
      <div className="w-5 h-5 bg-muted rounded" />
      <div className="w-10 h-10 bg-muted rounded-full" />
      <div className="flex-1 space-y-2">
        <div className="h-4 bg-muted rounded w-24" />
        <div className="h-3 bg-muted rounded w-32" />
      </div>
      <div className="space-y-2 text-right">
        <div className="h-4 bg-muted rounded w-16 ml-auto" />
        <div className="h-3 bg-muted rounded w-12 ml-auto" />
      </div>
    </div>
  );
}

export function TokenListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <TokenSkeleton key={i} />
      ))}
    </div>
  );
}

export function ChainSelectorSkeleton() {
  return (
    <div className="flex flex-wrap gap-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="h-10 w-32 bg-muted rounded-lg animate-pulse"
        />
      ))}
    </div>
  );
}

export function CardSkeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`bg-card rounded-xl border p-6 animate-pulse ${className}`}>
      <div className="h-6 bg-muted rounded w-1/3 mb-4" />
      <div className="space-y-3">
        <div className="h-4 bg-muted rounded" />
        <div className="h-4 bg-muted rounded w-5/6" />
        <div className="h-4 bg-muted rounded w-4/6" />
      </div>
    </div>
  );
}

export function StatCardSkeleton() {
  return (
    <div className="bg-card rounded-xl border p-6 animate-pulse">
      <div className="h-4 bg-muted rounded w-1/2 mb-2" />
      <div className="h-8 bg-muted rounded w-2/3" />
    </div>
  );
}

export function TableRowSkeleton() {
  return (
    <div className="flex items-center gap-4 p-4 animate-pulse">
      <div className="w-10 h-10 bg-muted rounded-full" />
      <div className="flex-1 space-y-2">
        <div className="h-4 bg-muted rounded w-1/4" />
        <div className="h-3 bg-muted rounded w-1/3" />
      </div>
      <div className="h-4 bg-muted rounded w-20" />
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-1/3 mb-2" />
          <div className="h-4 bg-muted rounded w-1/2" />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <StatCardSkeleton key={i} />
          ))}
        </div>

        {/* Main content */}
        <CardSkeleton />
        <CardSkeleton />
      </div>
    </div>
  );
}

// ============================================
// Consolidation Skeletons
// ============================================

export function ConsolidationRouteSkeleton() {
  return (
    <div className="flex items-center gap-4 p-4 bg-card rounded-lg border animate-pulse">
      {/* Source chain */}
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-muted rounded-full" />
        <div className="h-4 bg-muted rounded w-16" />
      </div>
      
      {/* Arrow */}
      <div className="flex-1 flex items-center justify-center">
        <div className="h-0.5 bg-muted flex-1 max-w-[60px]" />
        <div className="w-4 h-4 bg-muted rounded" />
        <div className="h-0.5 bg-muted flex-1 max-w-[60px]" />
      </div>
      
      {/* Destination chain */}
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-muted rounded-full" />
        <div className="h-4 bg-muted rounded w-16" />
      </div>
      
      {/* Amount */}
      <div className="text-right space-y-1">
        <div className="h-4 bg-muted rounded w-20 ml-auto" />
        <div className="h-3 bg-muted rounded w-14 ml-auto" />
      </div>
    </div>
  );
}

export function ConsolidationSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="animate-pulse">
        <div className="h-8 bg-muted rounded w-48 mb-2" />
        <div className="h-4 bg-muted rounded w-72" />
      </div>

      {/* Chain Selection */}
      <CardSkeleton className="h-32" />

      {/* Routes */}
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <ConsolidationRouteSkeleton key={i} />
        ))}
      </div>

      {/* Summary */}
      <div className="bg-card rounded-xl border p-6 animate-pulse">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="h-4 bg-muted rounded w-24" />
            <div className="h-6 bg-muted rounded w-32" />
          </div>
          <div className="space-y-2">
            <div className="h-4 bg-muted rounded w-24" />
            <div className="h-6 bg-muted rounded w-32" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Subscription Skeletons
// ============================================

export function SubscriptionCardSkeleton() {
  return (
    <div className="bg-card rounded-xl border p-6 animate-pulse">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-muted rounded-full" />
          <div className="space-y-2">
            <div className="h-5 bg-muted rounded w-32" />
            <div className="h-3 bg-muted rounded w-24" />
          </div>
        </div>
        <div className="h-6 bg-muted rounded-full w-16" />
      </div>
      
      <div className="grid grid-cols-3 gap-4 mb-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-1">
            <div className="h-3 bg-muted rounded w-16" />
            <div className="h-5 bg-muted rounded w-20" />
          </div>
        ))}
      </div>
      
      <div className="flex gap-2">
        <div className="h-9 bg-muted rounded flex-1" />
        <div className="h-9 bg-muted rounded w-20" />
      </div>
    </div>
  );
}

export function SubscriptionListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <SubscriptionCardSkeleton key={i} />
      ))}
    </div>
  );
}

// ============================================
// Transaction Status Skeletons
// ============================================

export function TransactionProgressSkeleton() {
  return (
    <div className="bg-card rounded-xl border p-6 animate-pulse">
      {/* Progress bar */}
      <div className="h-2 bg-muted rounded-full mb-6 overflow-hidden">
        <div className="h-full w-1/2 bg-muted-foreground/20 rounded-full" />
      </div>
      
      {/* Steps */}
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4">
            <div className="w-8 h-8 bg-muted rounded-full" />
            <div className="flex-1 space-y-1">
              <div className="h-4 bg-muted rounded w-32" />
              <div className="h-3 bg-muted rounded w-24" />
            </div>
            <div className="h-4 bg-muted rounded w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================
// DeFi Skeletons
// ============================================

export function DefiPositionSkeleton() {
  return (
    <div className="flex items-center gap-4 p-4 bg-card rounded-lg border animate-pulse">
      <div className="w-12 h-12 bg-muted rounded-full" />
      <div className="flex-1 space-y-2">
        <div className="h-5 bg-muted rounded w-28" />
        <div className="h-4 bg-muted rounded w-20" />
      </div>
      <div className="text-right space-y-2">
        <div className="h-5 bg-muted rounded w-24 ml-auto" />
        <div className="h-4 bg-muted rounded w-16 ml-auto" />
      </div>
    </div>
  );
}

export function DefiPositionListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <DefiPositionSkeleton key={i} />
      ))}
    </div>
  );
}

// ============================================
// Balance Skeletons
// ============================================

export function ChainBalanceSkeleton() {
  return (
    <div className="flex items-center gap-4 p-4 animate-pulse">
      <div className="w-10 h-10 bg-muted rounded-full" />
      <div className="flex-1 space-y-2">
        <div className="h-4 bg-muted rounded w-24" />
        <div className="h-3 bg-muted rounded w-16" />
      </div>
      <div className="text-right space-y-2">
        <div className="h-5 bg-muted rounded w-20 ml-auto" />
        <div className="h-3 bg-muted rounded w-12 ml-auto" />
      </div>
    </div>
  );
}

export function MultiChainBalanceSkeleton() {
  return (
    <div className="bg-card rounded-xl border overflow-hidden animate-pulse">
      {/* Header */}
      <div className="p-6 border-b border-border">
        <div className="h-4 bg-muted rounded w-32 mb-2" />
        <div className="h-8 bg-muted rounded w-40" />
      </div>
      
      {/* Chain list */}
      <div className="divide-y divide-border">
        {Array.from({ length: 4 }).map((_, i) => (
          <ChainBalanceSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

// ============================================
// Inline Loading States
// ============================================

export function InlineSpinner({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const sizeClasses = {
    sm: "w-4 h-4",
    md: "w-6 h-6",
    lg: "w-8 h-8",
  };

  return (
    <div
      className={`${sizeClasses[size]} border-2 border-primary border-t-transparent rounded-full animate-spin`}
    />
  );
}

export function LoadingDots() {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
      <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
      <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
    </span>
  );
}

export function PulsingText({ text }: { text: string }) {
  return (
    <span className="animate-pulse">{text}</span>
  );
}
