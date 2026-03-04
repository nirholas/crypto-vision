/**
 * @fileoverview Table Row Skeleton Component
 *
 * Matches exact layout of CoinsTable rows for seamless loading states.
 * Features staggered fade-in and pulse animations on cells.
 *
 * @module components/TableRowSkeleton
 */
'use client';

import { useMemo, useEffect, useState } from 'react';

// =============================================================================
// TYPES
// =============================================================================

export interface CoinsTableSkeletonProps {
  /** Number of rows to render */
  rows?: number;
  /** Whether to show the watchlist column */
  showWatchlist?: boolean;
  /** Base stagger delay in ms */
  staggerDelay?: number;
  /** Whether to animate (respects prefers-reduced-motion) */
  animate?: boolean;
  /** Additional className for the container */
  className?: string;
}

export interface CoinRowSkeletonProps {
  /** Row index for stagger delay calculation */
  index?: number;
  /** Whether to show the watchlist column */
  showWatchlist?: boolean;
  /** Base delay in ms */
  delay?: number;
  /** Whether to animate */
  animate?: boolean;
}

// =============================================================================
// SKELETON CELL COMPONENT
// =============================================================================

interface SkeletonCellProps {
  width: number | string;
  height?: number;
  delay?: number;
  animate?: boolean;
  className?: string;
  variant?: 'text' | 'circle' | 'rounded';
}

function SkeletonCell({
  width,
  height = 16,
  delay = 0,
  animate = true,
  className = '',
  variant = 'text',
}: SkeletonCellProps) {
  const widthStyle = typeof width === 'number' ? `${width}px` : width;
  
  const variantClasses = {
    text: 'rounded',
    circle: 'rounded-full',
    rounded: 'rounded-lg',
  };

  return (
    <div
      className={`
        ${animate ? 'skeleton-enhanced' : 'bg-surface-hover'}
        ${variantClasses[variant]}
        ${className}
      `}
      style={{
        width: widthStyle,
        height: `${height}px`,
        animationDelay: delay > 0 ? `${delay}ms` : undefined,
      }}
      aria-hidden="true"
    />
  );
}

// =============================================================================
// COIN ROW SKELETON
// =============================================================================

export function CoinRowSkeleton({
  index = 0,
  showWatchlist = false,
  delay = 0,
  animate = true,
}: CoinRowSkeletonProps) {
  const baseDelay = delay + index * 50;

  return (
    <tr
      className="border-b border-surface-border coin-row-skeleton"
      style={{
        animationDelay: `${baseDelay}ms`,
      }}
    >
      {/* Rank */}
      <td className="p-4">
        <SkeletonCell
          width={24}
          height={16}
          delay={baseDelay}
          animate={animate}
        />
      </td>

      {/* Coin (image + name + symbol) */}
      <td className="p-4">
        <div className="flex items-center gap-3">
          <SkeletonCell
            width={32}
            height={32}
            variant="circle"
            delay={baseDelay + 20}
            animate={animate}
          />
          <div className="space-y-1">
            <SkeletonCell
              width={80}
              height={14}
              delay={baseDelay + 40}
              animate={animate}
            />
            <SkeletonCell
              width={40}
              height={12}
              delay={baseDelay + 60}
              animate={animate}
            />
          </div>
        </div>
      </td>

      {/* Price */}
      <td className="p-4 text-right">
        <div className="flex justify-end">
          <SkeletonCell
            width={72}
            height={16}
            delay={baseDelay + 80}
            animate={animate}
          />
        </div>
      </td>

      {/* 24h % */}
      <td className="p-4 text-right hidden sm:table-cell">
        <div className="flex justify-end">
          <SkeletonCell
            width={56}
            height={16}
            variant="rounded"
            delay={baseDelay + 100}
            animate={animate}
          />
        </div>
      </td>

      {/* 7d % */}
      <td className="p-4 text-right hidden md:table-cell">
        <div className="flex justify-end">
          <SkeletonCell
            width={56}
            height={16}
            variant="rounded"
            delay={baseDelay + 120}
            animate={animate}
          />
        </div>
      </td>

      {/* Market Cap */}
      <td className="p-4 text-right hidden lg:table-cell">
        <div className="flex justify-end">
          <SkeletonCell
            width={90}
            height={16}
            delay={baseDelay + 140}
            animate={animate}
          />
        </div>
      </td>

      {/* 24h Volume */}
      <td className="p-4 text-right hidden xl:table-cell">
        <div className="flex justify-end">
          <SkeletonCell
            width={80}
            height={16}
            delay={baseDelay + 160}
            animate={animate}
          />
        </div>
      </td>

      {/* Circulating Supply */}
      <td className="p-4 text-right hidden xl:table-cell">
        <div className="flex justify-end">
          <SkeletonCell
            width={100}
            height={16}
            delay={baseDelay + 180}
            animate={animate}
          />
        </div>
      </td>

      {/* 7d Chart (Sparkline) */}
      <td className="p-4 hidden lg:table-cell">
        <div className="flex justify-end">
          <SkeletonCell
            width={120}
            height={40}
            variant="rounded"
            delay={baseDelay + 200}
            animate={animate}
          />
        </div>
      </td>

      {/* Watchlist */}
      {showWatchlist && (
        <td className="p-4 text-center">
          <div className="flex justify-center">
            <SkeletonCell
              width={24}
              height={24}
              variant="circle"
              delay={baseDelay + 220}
              animate={animate}
            />
          </div>
        </td>
      )}
    </tr>
  );
}

// =============================================================================
// COINS TABLE SKELETON (Full Table)
// =============================================================================

export function CoinsTableSkeleton({
  rows = 10,
  showWatchlist = false,
  staggerDelay = 50,
  animate = true,
  className = '',
}: CoinsTableSkeletonProps) {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      setPrefersReducedMotion(mediaQuery.matches);

      const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
      mediaQuery.addEventListener('change', handler);
      return () => mediaQuery.removeEventListener('change', handler);
    }
  }, []);

  const shouldAnimate = animate && !prefersReducedMotion;

  return (
    <div className={`bg-surface rounded-xl border border-surface-border overflow-hidden ${className}`}>
      {/* Header Skeleton */}
      <div className="overflow-x-auto scrollbar-hide">
        <table className="w-full">
          <thead>
            <tr className="border-b border-surface-border bg-surface-alt">
              {/* Rank */}
              <th className="p-4 w-12">
                <SkeletonCell width={20} height={14} animate={shouldAnimate} />
              </th>
              {/* Coin */}
              <th className="p-4 text-left">
                <SkeletonCell width={40} height={14} animate={shouldAnimate} delay={20} />
              </th>
              {/* Price */}
              <th className="p-4">
                <div className="flex justify-end">
                  <SkeletonCell width={50} height={14} animate={shouldAnimate} delay={40} />
                </div>
              </th>
              {/* 24h % */}
              <th className="p-4 hidden sm:table-cell">
                <div className="flex justify-end">
                  <SkeletonCell width={45} height={14} animate={shouldAnimate} delay={60} />
                </div>
              </th>
              {/* 7d % */}
              <th className="p-4 hidden md:table-cell">
                <div className="flex justify-end">
                  <SkeletonCell width={40} height={14} animate={shouldAnimate} delay={80} />
                </div>
              </th>
              {/* Market Cap */}
              <th className="p-4 hidden lg:table-cell">
                <div className="flex justify-end">
                  <SkeletonCell width={80} height={14} animate={shouldAnimate} delay={100} />
                </div>
              </th>
              {/* Volume */}
              <th className="p-4 hidden xl:table-cell">
                <div className="flex justify-end">
                  <SkeletonCell width={75} height={14} animate={shouldAnimate} delay={120} />
                </div>
              </th>
              {/* Supply */}
              <th className="p-4 hidden xl:table-cell">
                <div className="flex justify-end">
                  <SkeletonCell width={100} height={14} animate={shouldAnimate} delay={140} />
                </div>
              </th>
              {/* Chart */}
              <th className="p-4 hidden lg:table-cell">
                <div className="flex justify-end">
                  <SkeletonCell width={80} height={14} animate={shouldAnimate} delay={160} />
                </div>
              </th>
              {/* Watchlist */}
              {showWatchlist && (
                <th className="p-4 w-12">
                  <div className="flex justify-center">
                    <SkeletonCell width={20} height={14} animate={shouldAnimate} delay={180} />
                  </div>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }).map((_, index) => (
              <CoinRowSkeleton
                key={index}
                index={index}
                showWatchlist={showWatchlist}
                delay={200 + index * staggerDelay}
                animate={shouldAnimate}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination Skeleton */}
      <div className="p-4 border-t border-surface-border flex items-center justify-between">
        <SkeletonCell
          width={120}
          height={16}
          animate={shouldAnimate}
          delay={rows * staggerDelay + 300}
        />
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <SkeletonCell
              key={i}
              width={32}
              height={32}
              variant="rounded"
              animate={shouldAnimate}
              delay={rows * staggerDelay + 320 + i * 30}
            />
          ))}
        </div>
        <SkeletonCell
          width={100}
          height={16}
          animate={shouldAnimate}
          delay={rows * staggerDelay + 500}
        />
      </div>
    </div>
  );
}

// =============================================================================
// ADDITIONAL SKELETON VARIANTS
// =============================================================================

/** Trending Section Skeleton */
export function TrendingSectionSkeleton() {
  return (
    <div className="grid md:grid-cols-2 gap-4 mb-6">
      {/* Hot Coins */}
      <div className="bg-surface rounded-xl border border-surface-border p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="skeleton-enhanced w-5 h-5 rounded" />
          <div className="skeleton-enhanced h-5 w-24 rounded" />
        </div>
        <div className="flex gap-2 overflow-hidden">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="skeleton-enhanced h-10 w-24 rounded-lg flex-shrink-0"
              style={{ animationDelay: `${i * 50}ms` }}
            />
          ))}
        </div>
      </div>
      
      {/* Top Gainers */}
      <div className="bg-surface rounded-xl border border-surface-border p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="skeleton-enhanced w-5 h-5 rounded" />
          <div className="skeleton-enhanced h-5 w-28 rounded" />
        </div>
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="flex items-center gap-2"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <div className="skeleton-enhanced w-6 h-6 rounded-full" />
              <div className="skeleton-enhanced h-4 flex-1 rounded" />
              <div className="skeleton-enhanced h-4 w-16 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Category Tabs Skeleton */
export function CategoryTabsSkeleton() {
  return (
    <div className="flex gap-2 mb-4 overflow-hidden">
      {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
        <div
          key={i}
          className="skeleton-enhanced h-10 w-24 rounded-full flex-shrink-0"
          style={{ animationDelay: `${i * 40}ms` }}
        />
      ))}
    </div>
  );
}

/** Search and Filters Skeleton */
export function SearchFiltersSkeleton() {
  return (
    <div className="flex flex-wrap gap-3 mb-4">
      <div className="skeleton-enhanced h-10 w-64 rounded-xl" />
      <div className="skeleton-enhanced h-10 w-32 rounded-lg" style={{ animationDelay: '50ms' }} />
      <div className="skeleton-enhanced h-10 w-32 rounded-lg" style={{ animationDelay: '100ms' }} />
      <div className="skeleton-enhanced h-10 w-32 rounded-lg" style={{ animationDelay: '150ms' }} />
    </div>
  );
}

/** Global Stats Bar Skeleton */
export function GlobalStatsBarSkeleton() {
  return (
    <div className="bg-surface border-b border-surface-border px-4 py-2">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 overflow-x-auto scrollbar-hide">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="flex items-center gap-2 flex-shrink-0"
            style={{ animationDelay: `${i * 40}ms` }}
          >
            <div className="skeleton-enhanced h-3 w-16 rounded" />
            <div className="skeleton-enhanced h-4 w-20 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default CoinsTableSkeleton;
