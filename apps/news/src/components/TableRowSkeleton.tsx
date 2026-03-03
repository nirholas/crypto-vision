/**
 * Table Row Skeleton Component
 * Matches CoinsTable layout for seamless loading experience
 */

'use client';

import { Skeleton, AvatarSkeleton } from '@/components/ui/EnhancedSkeleton';

interface TableRowSkeletonProps {
  index?: number;
  showWatchlist?: boolean;
}

/**
 * Single table row skeleton matching CoinRow layout
 */
export function TableRowSkeleton({ index = 0, showWatchlist = false }: TableRowSkeletonProps) {
  const baseDelay = index * 50; // Stagger each row

  return (
    <tr className="border-b border-gray-100 dark:border-gray-800">
      {/* Rank */}
      <td className="p-4">
        <Skeleton className="w-6 h-4" delay={baseDelay} />
      </td>

      {/* Coin - Avatar + Name + Symbol */}
      <td className="p-4">
        <div className="flex items-center gap-3">
          <AvatarSkeleton size="sm" delay={baseDelay + 10} className="flex-shrink-0" />
          <div className="flex items-center gap-2">
            <Skeleton className="w-20 h-4" delay={baseDelay + 20} />
            <Skeleton className="w-10 h-3" delay={baseDelay + 30} />
          </div>
        </div>
      </td>

      {/* Price */}
      <td className="p-4 text-right">
        <Skeleton className="w-20 h-4 ml-auto" delay={baseDelay + 40} />
      </td>

      {/* 24h % */}
      <td className="p-4 text-right hidden sm:table-cell">
        <Skeleton className="w-14 h-4 ml-auto" delay={baseDelay + 50} />
      </td>

      {/* 7d % */}
      <td className="p-4 text-right hidden md:table-cell">
        <Skeleton className="w-14 h-4 ml-auto" delay={baseDelay + 60} />
      </td>

      {/* Market Cap */}
      <td className="p-4 text-right hidden lg:table-cell">
        <Skeleton className="w-24 h-4 ml-auto" delay={baseDelay + 70} />
      </td>

      {/* 24h Volume */}
      <td className="p-4 text-right hidden xl:table-cell">
        <Skeleton className="w-24 h-4 ml-auto" delay={baseDelay + 80} />
      </td>

      {/* Circulating Supply */}
      <td className="p-4 text-right hidden xl:table-cell">
        <div className="space-y-2">
          <Skeleton className="w-20 h-3 ml-auto" delay={baseDelay + 90} />
          <Skeleton className="w-full h-1.5 rounded-full" delay={baseDelay + 100} />
        </div>
      </td>

      {/* 7d Chart (Sparkline) */}
      <td className="p-4 hidden lg:table-cell">
        <Skeleton className="w-24 h-10 ml-auto rounded" delay={baseDelay + 110} />
      </td>

      {/* Watchlist */}
      {showWatchlist && (
        <td className="p-4 text-center">
          <Skeleton className="w-6 h-6 rounded-full mx-auto" delay={baseDelay + 120} />
        </td>
      )}
    </tr>
  );
}

interface CoinsTableSkeletonProps {
  rows?: number;
  showWatchlist?: boolean;
}

/**
 * Full table skeleton matching CoinsTable layout
 */
export function CoinsTableSkeleton({ rows = 10, showWatchlist = false }: CoinsTableSkeletonProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
              <th className="text-left text-gray-500 dark:text-gray-400 text-sm font-medium p-4 w-12">#</th>
              <th className="text-left text-gray-500 dark:text-gray-400 text-sm font-medium p-4">Coin</th>
              <th className="text-right text-gray-500 dark:text-gray-400 text-sm font-medium p-4">Price</th>
              <th className="text-right text-gray-500 dark:text-gray-400 text-sm font-medium p-4 hidden sm:table-cell">24h %</th>
              <th className="text-right text-gray-500 dark:text-gray-400 text-sm font-medium p-4 hidden md:table-cell">7d %</th>
              <th className="text-right text-gray-500 dark:text-gray-400 text-sm font-medium p-4 hidden lg:table-cell">Market Cap</th>
              <th className="text-right text-gray-500 dark:text-gray-400 text-sm font-medium p-4 hidden xl:table-cell">24h Volume</th>
              <th className="text-right text-gray-500 dark:text-gray-400 text-sm font-medium p-4 hidden xl:table-cell">Circulating Supply</th>
              <th className="text-right text-gray-500 dark:text-gray-400 text-sm font-medium p-4 hidden lg:table-cell">Last 7 Days</th>
              {showWatchlist && (
                <th className="text-center text-gray-500 dark:text-gray-400 text-sm font-medium p-4 w-12">
                  <span className="sr-only">Watchlist</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }).map((_, i) => (
              <TableRowSkeleton key={i} index={i} showWatchlist={showWatchlist} />
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination skeleton */}
      <div className="flex items-center justify-between p-4 border-t border-gray-200 dark:border-gray-700">
        <Skeleton className="w-32 h-4" delay={rows * 50 + 50} />
        <div className="flex items-center gap-2">
          <Skeleton className="w-20 h-8 rounded" delay={rows * 50 + 100} />
          <Skeleton className="w-8 h-8 rounded" delay={rows * 50 + 120} />
          <Skeleton className="w-8 h-8 rounded" delay={rows * 50 + 140} />
          <Skeleton className="w-8 h-8 rounded" delay={rows * 50 + 160} />
          <Skeleton className="w-20 h-8 rounded" delay={rows * 50 + 180} />
        </div>
      </div>
    </div>
  );
}

export default TableRowSkeleton;
