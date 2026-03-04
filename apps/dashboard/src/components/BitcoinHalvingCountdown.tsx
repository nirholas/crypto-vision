/**
 * Bitcoin Halving Countdown Component
 *
 * Displays a visual countdown to the next Bitcoin halving event.
 * Shows remaining blocks, estimated time, and historical context.
 *
 * @module components/BitcoinHalvingCountdown
 *
 * @example
 * <BitcoinHalvingCountdown />
 * <BitcoinHalvingCountdown variant="compact" />
 * <BitcoinHalvingCountdown variant="detailed" showHistory />
 *
 * @features
 * - Live block height tracking
 * - Countdown timer to next halving
 * - Block reward display
 * - Historical halving data
 * - Progress visualization
 * - Dark mode compatible with design tokens
 */
'use client';

import { useState, useEffect, useCallback } from 'react';
import { TrendingDown, Clock, Blocks, Award, History, ChevronDown, ChevronUp } from 'lucide-react';

// Bitcoin halving constants
const BLOCKS_PER_HALVING = 210_000;
const INITIAL_BLOCK_REWARD = 50;
const AVG_BLOCK_TIME_MINUTES = 10;

// Historical halving data
const HALVING_HISTORY = [
  { number: 0, block: 0, date: '2009-01-03', reward: 50, priceAtHalving: 0 },
  { number: 1, block: 210_000, date: '2012-11-28', reward: 25, priceAtHalving: 12 },
  { number: 2, block: 420_000, date: '2016-07-09', reward: 12.5, priceAtHalving: 650 },
  { number: 3, block: 630_000, date: '2020-05-11', reward: 6.25, priceAtHalving: 8_600 },
  { number: 4, block: 840_000, date: '2024-04-20', reward: 3.125, priceAtHalving: 63_800 },
];

interface HalvingData {
  currentBlock: number;
  nextHalvingBlock: number;
  blocksRemaining: number;
  currentReward: number;
  nextReward: number;
  halvingNumber: number;
  estimatedDate: Date;
  progress: number;
}

interface TimeRemaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

interface BitcoinHalvingCountdownProps {
  /** Display variant */
  variant?: 'default' | 'compact' | 'detailed';
  /** Show historical halvings */
  showHistory?: boolean;
  /** Additional CSS classes */
  className?: string;
}

// Calculate halving data from current block height
function calculateHalvingData(currentBlock: number): HalvingData {
  const halvingNumber = Math.floor(currentBlock / BLOCKS_PER_HALVING) + 1;
  const nextHalvingBlock = halvingNumber * BLOCKS_PER_HALVING;
  const blocksRemaining = nextHalvingBlock - currentBlock;
  const currentReward = INITIAL_BLOCK_REWARD / Math.pow(2, halvingNumber - 1);
  const nextReward = currentReward / 2;

  // Estimate date based on average block time
  const minutesRemaining = blocksRemaining * AVG_BLOCK_TIME_MINUTES;
  const estimatedDate = new Date(Date.now() + minutesRemaining * 60 * 1000);

  // Progress through current halving epoch
  const blocksIntoEpoch = currentBlock - (halvingNumber - 1) * BLOCKS_PER_HALVING;
  const progress = (blocksIntoEpoch / BLOCKS_PER_HALVING) * 100;

  return {
    currentBlock,
    nextHalvingBlock,
    blocksRemaining,
    currentReward,
    nextReward,
    halvingNumber,
    estimatedDate,
    progress,
  };
}

// Calculate time remaining
function calculateTimeRemaining(targetDate: Date): TimeRemaining {
  const now = new Date();
  const diff = Math.max(0, targetDate.getTime() - now.getTime());

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);

  return { days, hours, minutes, seconds };
}

// Format large numbers with commas
function formatNumber(num: number): string {
  return num.toLocaleString();
}

export default function BitcoinHalvingCountdown({
  variant = 'default',
  showHistory = false,
  className = '',
}: BitcoinHalvingCountdownProps) {
  const [halvingData, setHalvingData] = useState<HalvingData | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<TimeRemaining | null>(null);
  const [showHistoryPanel, setShowHistoryPanel] = useState(showHistory);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch current block height
  const fetchBlockHeight = useCallback(async () => {
    try {
      // Try multiple APIs for reliability
      const apis = [
        'https://blockchain.info/q/getblockcount',
        'https://mempool.space/api/blocks/tip/height',
      ];

      for (const api of apis) {
        try {
          const response = await fetch(api);
          if (response.ok) {
            const blockHeight = await response.json();
            const data = calculateHalvingData(Number(blockHeight));
            setHalvingData(data);
            setTimeRemaining(calculateTimeRemaining(data.estimatedDate));
            setError(null);
            setLoading(false);
            return;
          }
        } catch {
          continue;
        }
      }

      // Fallback: Use estimated current block (approximately)
      // Bitcoin block height as of Jan 2026 is approximately 880,000+
      const estimatedBlock = 882_000;
      const data = calculateHalvingData(estimatedBlock);
      setHalvingData(data);
      setTimeRemaining(calculateTimeRemaining(data.estimatedDate));
      setLoading(false);
    } catch (err) {
      setError('Failed to fetch block data');
      setLoading(false);
    }
  }, []);

  // Initial fetch and periodic updates
  useEffect(() => {
    fetchBlockHeight();
    const blockInterval = setInterval(fetchBlockHeight, 60000); // Update every minute
    return () => clearInterval(blockInterval);
  }, [fetchBlockHeight]);

  // Update countdown timer every second
  useEffect(() => {
    if (!halvingData) return;

    const timerInterval = setInterval(() => {
      setTimeRemaining(calculateTimeRemaining(halvingData.estimatedDate));
    }, 1000);

    return () => clearInterval(timerInterval);
  }, [halvingData]);

  if (loading) {
    return (
      <div className={`bg-surface rounded-2xl border border-surface-border p-6 ${className}`}>
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-surface-hover rounded w-48" />
          <div className="h-20 bg-surface-hover rounded" />
          <div className="h-4 bg-surface-hover rounded w-32" />
        </div>
      </div>
    );
  }

  if (error || !halvingData || !timeRemaining) {
    return (
      <div className={`bg-surface rounded-2xl border border-surface-border p-6 ${className}`}>
        <div className="text-center text-text-muted">
          <Blocks className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>Unable to load halving data</p>
        </div>
      </div>
    );
  }

  // Compact variant
  if (variant === 'compact') {
    return (
      <div className={`bg-surface rounded-xl border border-surface-border p-4 ${className}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center">
              <TrendingDown className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-text-primary text-sm">
                Bitcoin Halving #{halvingData.halvingNumber}
              </h3>
              <p className="text-xs text-text-muted">
                {formatNumber(halvingData.blocksRemaining)} blocks left
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold text-primary">
              {timeRemaining.days}d {timeRemaining.hours}h
            </div>
            <div className="text-xs text-text-muted">
              {halvingData.currentReward} → {halvingData.nextReward} BTC
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`bg-surface rounded-2xl border border-surface-border overflow-hidden ${className}`}
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500 p-6 text-white">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
            <TrendingDown className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Bitcoin Halving #{halvingData.halvingNumber}</h2>
            <p className="text-white/80 text-sm">Block reward reduction event</p>
          </div>
        </div>
      </div>

      {/* Countdown Timer */}
      <div className="p-6">
        <div className="grid grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Days', value: timeRemaining.days },
            { label: 'Hours', value: timeRemaining.hours },
            { label: 'Minutes', value: timeRemaining.minutes },
            { label: 'Seconds', value: timeRemaining.seconds },
          ].map((item) => (
            <div key={item.label} className="bg-surface-hover rounded-xl p-4 text-center">
              <div className="text-2xl md:text-3xl font-bold text-text-primary">
                {item.value.toString().padStart(2, '0')}
              </div>
              <div className="text-xs text-text-muted uppercase tracking-wide mt-1">
                {item.label}
              </div>
            </div>
          ))}
        </div>

        {/* Progress Bar */}
        <div className="mb-6">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-text-muted">Epoch Progress</span>
            <span className="font-medium text-text-primary">
              {halvingData.progress.toFixed(2)}%
            </span>
          </div>
          <div className="h-3 bg-surface-hover rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-orange-500 to-amber-500 transition-all duration-500"
              style={{ width: `${halvingData.progress}%` }}
            />
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-surface-hover rounded-xl p-4">
            <div className="flex items-center gap-2 text-text-muted text-sm mb-1">
              <Blocks className="w-4 h-4" />
              Current Block
            </div>
            <div className="text-xl font-bold text-text-primary">
              {formatNumber(halvingData.currentBlock)}
            </div>
          </div>
          <div className="bg-surface-hover rounded-xl p-4">
            <div className="flex items-center gap-2 text-text-muted text-sm mb-1">
              <Clock className="w-4 h-4" />
              Blocks Remaining
            </div>
            <div className="text-xl font-bold text-text-primary">
              {formatNumber(halvingData.blocksRemaining)}
            </div>
          </div>
          <div className="bg-surface-hover rounded-xl p-4">
            <div className="flex items-center gap-2 text-text-muted text-sm mb-1">
              <Award className="w-4 h-4" />
              Current Reward
            </div>
            <div className="text-xl font-bold text-gain">{halvingData.currentReward} BTC</div>
          </div>
          <div className="bg-surface-hover rounded-xl p-4">
            <div className="flex items-center gap-2 text-text-muted text-sm mb-1">
              <TrendingDown className="w-4 h-4" />
              Next Reward
            </div>
            <div className="text-xl font-bold text-loss">{halvingData.nextReward} BTC</div>
          </div>
        </div>

        {/* Estimated Date */}
        <div className="text-center py-4 border-t border-surface-border">
          <p className="text-text-muted text-sm">Estimated Halving Date</p>
          <p className="text-lg font-semibold text-text-primary mt-1">
            {halvingData.estimatedDate.toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </div>

        {/* History Toggle */}
        {variant === 'detailed' && (
          <button
            onClick={() => setShowHistoryPanel(!showHistoryPanel)}
            className="w-full flex items-center justify-center gap-2 py-3 mt-4 text-sm font-medium text-primary hover:bg-surface-hover rounded-lg transition-colors"
          >
            <History className="w-4 h-4" />
            {showHistoryPanel ? 'Hide' : 'Show'} Halving History
            {showHistoryPanel ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
        )}

        {/* History Panel */}
        {showHistoryPanel && (
          <div className="mt-4 border-t border-surface-border pt-4">
            <h3 className="font-semibold text-text-primary mb-4 flex items-center gap-2">
              <History className="w-4 h-4" />
              Bitcoin Halving History
            </h3>
            <div className="space-y-3">
              {HALVING_HISTORY.map((halving) => (
                <div
                  key={halving.number}
                  className="flex items-center justify-between p-3 bg-surface-hover rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center text-white text-sm font-bold">
                      {halving.number}
                    </div>
                    <div>
                      <div className="font-medium text-text-primary text-sm">
                        Block {formatNumber(halving.block)}
                      </div>
                      <div className="text-xs text-text-muted">
                        {new Date(halving.date).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium text-text-primary text-sm">
                      {halving.reward} BTC
                    </div>
                    {halving.priceAtHalving > 0 && (
                      <div className="text-xs text-text-muted">
                        ${formatNumber(halving.priceAtHalving)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
