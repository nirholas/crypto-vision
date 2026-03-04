/**
 * MarketMoodWidget
 * 
 * A complete widget that combines the MarketMoodRing with real-time
 * data fetching from the Fear & Greed Index API. Drop this anywhere
 * in your app for instant market sentiment visualization.
 * 
 * @example
 * <MarketMoodWidget />
 * <MarketMoodWidget variant="compact" />
 * <MarketMoodWidget variant="minimal" />
 */
'use client';

import MarketMoodRing, { MarketMoodBadge, MarketMoodSparkline } from './MarketMoodRing';
import { useMarketMood } from '@/hooks/useMarketMood';

interface MarketMoodWidgetProps {
  /** Widget variant */
  variant?: 'full' | 'compact' | 'minimal';
  /** Additional CSS classes */
  className?: string;
  /** Show historical sparkline */
  showHistory?: boolean;
  /** Enable auto-refresh */
  autoRefresh?: boolean;
}

export default function MarketMoodWidget({
  variant = 'full',
  className = '',
  showHistory = true,
  autoRefresh = true,
}: MarketMoodWidgetProps) {
  const { value, previousValue, history, classification, isLoading, error, lastUpdated, refresh } =
    useMarketMood({ autoRefresh });

  // Minimal variant - just the badge
  if (variant === 'minimal') {
    return (
      <div className={className}>
        {isLoading ? (
          <div className="animate-pulse h-8 w-24 bg-surface-hover rounded-full" />
        ) : error ? (
          <span className="text-text-muted text-sm">--</span>
        ) : (
          <MarketMoodBadge value={value} />
        )}
      </div>
    );
  }

  // Compact variant - badge with sparkline
  if (variant === 'compact') {
    return (
      <div className={`flex items-center gap-4 ${className}`}>
        {isLoading ? (
          <>
            <div className="animate-pulse h-8 w-24 bg-surface-hover rounded-full" />
            <div className="animate-pulse h-6 w-24 bg-surface-hover rounded" />
          </>
        ) : error ? (
          <span className="text-text-muted text-sm">Unable to load sentiment data</span>
        ) : (
          <>
            <MarketMoodBadge value={value} />
            {showHistory && history.length > 0 && (
              <MarketMoodSparkline values={history} />
            )}
          </>
        )}
      </div>
    );
  }

  // Full variant - complete widget with card wrapper
  return (
    <div className={`bg-surface rounded-2xl border border-surface-border p-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-text-primary font-semibold text-lg">Market Sentiment</h3>
          <p className="text-text-muted text-sm">Fear & Greed Index</p>
        </div>
        <button
          onClick={() => refresh()}
          disabled={isLoading}
          className="text-text-muted hover:text-text-secondary transition-colors p-2 rounded-lg hover:bg-surface-hover disabled:opacity-50"
          aria-label="Refresh data"
        >
          <svg
            className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        </button>
      </div>

      {/* Main Content */}
      <div className="flex justify-center mb-6">
        {isLoading ? (
          <div className="animate-pulse">
            <div className="w-48 h-48 rounded-full bg-surface-hover" />
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <p className="text-text-muted mb-2">Unable to load data</p>
            <button
              onClick={() => refresh()}
              className="text-primary hover:underline text-sm"
            >
              Try again
            </button>
          </div>
        ) : (
          <MarketMoodRing
            value={value}
            previousValue={previousValue}
            size="lg"
            showDetails={false}
          />
        )}
      </div>

      {/* Classification */}
      {!isLoading && !error && (
        <p className="text-center text-text-secondary text-sm mb-4">
          The market is currently showing signs of{' '}
          <span className="font-medium">{classification.toLowerCase()}</span>
        </p>
      )}

      {/* Footer with sparkline */}
      {showHistory && history.length > 0 && !isLoading && !error && (
        <div className="border-t border-surface-border pt-4">
          <div className="flex items-center justify-between">
            <span className="text-text-muted text-sm">7-Day History</span>
            <MarketMoodSparkline values={history} />
          </div>
        </div>
      )}

      {/* Last updated */}
      {lastUpdated && !error && (
        <p className="text-center text-text-muted text-xs mt-4">
          Updated: {lastUpdated.toLocaleTimeString()}
        </p>
      )}
    </div>
  );
}

/**
 * Sidebar-optimized version of the widget
 */
export function MarketMoodSidebar({ className = '' }: { className?: string }) {
  const { value, previousValue, history, isLoading, error } = useMarketMood();

  if (isLoading) {
    return (
      <div className={`bg-surface rounded-xl border border-surface-border p-4 ${className}`}>
        <div className="animate-pulse space-y-3">
          <div className="h-4 w-24 bg-surface-hover rounded" />
          <div className="flex justify-center">
            <div className="w-24 h-24 rounded-full bg-surface-hover" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return null;
  }

  return (
    <div className={`bg-surface rounded-xl border border-surface-border p-4 ${className}`}>
      <h4 className="text-text-secondary font-medium text-sm mb-3">Market Mood</h4>
      <div className="flex justify-center">
        <MarketMoodRing value={value} previousValue={previousValue} size="sm" showDetails={false} />
      </div>
      {history.length > 0 && (
        <div className="flex justify-center mt-3">
          <MarketMoodSparkline values={history} />
        </div>
      )}
    </div>
  );
}

/**
 * Header bar version - ultra compact
 */
export function MarketMoodHeader({ className = '' }: { className?: string }) {
  const { value, isLoading, error } = useMarketMood();

  if (isLoading || error) {
    return null;
  }

  return (
    <MarketMoodBadge value={value} className={className} />
  );
}
