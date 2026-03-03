'use client';

/**
 * Global Market Stats Bar
 * CoinMarketCap-style sticky header with live market metrics
 * Features: sticky positioning, animated values, tooltips, responsive scroll
 */

import { useEffect, useState, useRef } from 'react';
import type { GlobalMarketData, FearGreedIndex } from '@/lib/market-data';
import { formatNumber, getFearGreedColor, getFearGreedBgColor } from '@/lib/market-data';
import StatItem from './StatItem';
import TrendIndicator from './TrendIndicator';
import MiniDonut from './MiniDonut';

interface GlobalStatsBarProps {
  global: GlobalMarketData | null;
  fearGreed: FearGreedIndex | null;
  /** Optional: ETH gas price in Gwei */
  ethGas?: number | null;
}

/**
 * Get gas color indicator based on Gwei value
 */
function getGasColor(gwei: number): { text: string; bg: string } {
  if (gwei < 30) return { text: 'text-gain', bg: 'bg-gain' };
  if (gwei < 60) return { text: 'text-yellow-500', bg: 'bg-yellow-500' };
  return { text: 'text-loss', bg: 'bg-loss' };
}

/**
 * Gas Indicator Component
 */
function GasIndicator({ gwei }: { gwei: number }) {
  const colors = getGasColor(gwei);
  
  return (
    <div className="flex items-center gap-1">
      <div className={`w-2 h-2 rounded-full ${colors.bg} animate-pulse`} />
      <span className={`font-semibold text-sm ${colors.text}`}>
        {Math.round(gwei)}
      </span>
      <span className="text-text-muted text-xs">Gwei</span>
    </div>
  );
}

/**
 * Fear & Greed Badge Component
 */
function FearGreedBadge({ value, classification }: { value: number; classification: string }) {
  const colorClass = getFearGreedColor(value);
  const bgColorClass = getFearGreedBgColor(value);
  
  return (
    <div className="flex items-center gap-2">
      <span className={`font-bold text-sm ${colorClass}`}>
        {value}
      </span>
      <span 
        className={`
          px-1.5 py-0.5 rounded text-[10px] font-medium
          ${bgColorClass} text-white uppercase tracking-wide
        `}
      >
        {classification.split(' ').slice(0, 2).join(' ')}
      </span>
    </div>
  );
}

/**
 * Divider between stats
 */
function StatDivider() {
  return (
    <div className="hidden sm:block h-4 w-px bg-surface-border flex-shrink-0" />
  );
}

/**
 * Loading skeleton for the stats bar
 */
function GlobalStatsBarSkeleton() {
  return (
    <div className="sticky top-0 z-50 bg-bg-secondary/95 backdrop-blur-md border-b border-surface-border">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-4 px-4 h-10 md:h-8 overflow-x-auto scrollbar-hide">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="h-5 w-28 bg-surface-hover rounded animate-pulse flex-shrink-0"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function GlobalStatsBar({ 
  global, 
  fearGreed,
  ethGas = null 
}: GlobalStatsBarProps) {
  const [mounted, setMounted] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    
    // Track scroll for potential icon-only collapse mode
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 100);
    };
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  if (!global) {
    return <GlobalStatsBarSkeleton />;
  }

  const fearGreedValue = fearGreed ? Number(fearGreed.value) : 0;
  const marketCapChange = global.market_cap_change_percentage_24h_usd;
  const btcDominance = global.market_cap_percentage?.btc ?? 0;
  const ethDominance = global.market_cap_percentage?.eth ?? 0;

  // Mock gas value if not provided (in real app, fetch from ETH gas API)
  const gasValue = ethGas ?? 25;

  return (
    <div 
      className={`
        sticky top-0 z-50 
        bg-bg-secondary/95 backdrop-blur-md 
        border-b border-surface-border
        transition-all duration-300
        ${isScrolled ? 'shadow-md' : ''}
      `}
    >
      <div className="max-w-7xl mx-auto">
        {/* Scrollable container with snap points */}
        <div 
          ref={scrollContainerRef}
          className="
            flex items-center gap-1 px-2 
            h-10 md:h-8
            overflow-x-auto scrollbar-hide
            snap-x snap-mandatory
            touch-pan-x
          "
        >
          {/* Market Cap */}
          <div className="snap-start flex-shrink-0">
            <StatItem
              label="Market Cap"
              value={formatNumber(global.total_market_cap?.usd)}
              prefix="$"
              trailing={
                <TrendIndicator 
                  value={marketCapChange} 
                  size="sm"
                />
              }
              tooltip={`Total cryptocurrency market cap: $${(global.total_market_cap?.usd ?? 0).toLocaleString()}`}
              href="/markets"
            />
          </div>

          <StatDivider />

          {/* 24h Volume */}
          <div className="snap-start flex-shrink-0">
            <StatItem
              label="24h Vol"
              value={formatNumber(global.total_volume?.usd)}
              prefix="$"
              icon={
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              }
              tooltip={`24-hour trading volume: $${(global.total_volume?.usd ?? 0).toLocaleString()}`}
            />
          </div>

          <StatDivider />

          {/* BTC Dominance */}
          <div className="snap-start flex-shrink-0">
            <StatItem
              label="BTC"
              value={btcDominance.toFixed(1)}
              suffix="%"
              icon={<span className="text-brand font-bold">₿</span>}
              trailing={<MiniDonut value={btcDominance} color="var(--brand)" size={16} strokeWidth={2.5} />}
              tooltip={`Bitcoin market dominance: ${btcDominance.toFixed(2)}%`}
              href="/markets?sort=market_cap&order=desc"
            />
          </div>

          <StatDivider />

          {/* ETH Dominance */}
          {ethDominance > 0 && (
            <>
              <div className="snap-start flex-shrink-0">
                <StatItem
                  label="ETH"
                  value={ethDominance.toFixed(1)}
                  suffix="%"
                  icon={<span className="text-purple-400 font-bold">Ξ</span>}
                  trailing={<MiniDonut value={ethDominance} color="#8B5CF6" size={16} strokeWidth={2.5} />}
                  tooltip={`Ethereum market dominance: ${ethDominance.toFixed(2)}%`}
                />
              </div>
              <StatDivider />
            </>
          )}

          {/* ETH Gas */}
          <div className="snap-start flex-shrink-0">
            <div 
              className="
                flex items-center gap-1.5 px-3 py-1 whitespace-nowrap
                rounded-md transition-all duration-200 hover:bg-surface-hover cursor-pointer
              "
              title={`ETH Gas: ${gasValue} Gwei - ${gasValue < 30 ? 'Low' : gasValue < 60 ? 'Medium' : 'High'}`}
            >
              <svg className="w-3.5 h-3.5 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span className="text-text-muted text-xs font-medium hidden sm:inline">Gas:</span>
              <GasIndicator gwei={gasValue} />
            </div>
          </div>

          <StatDivider />

          {/* Fear & Greed Index */}
          {fearGreed && mounted && (
            <>
              <div className="snap-start flex-shrink-0">
                <div 
                  className="
                    flex items-center gap-1.5 px-3 py-1 whitespace-nowrap
                    rounded-md transition-all duration-200 hover:bg-surface-hover cursor-pointer
                  "
                  title={`Fear & Greed Index: ${fearGreed.value} - ${fearGreed.value_classification}`}
                >
                  <span className="text-text-muted text-xs font-medium hidden sm:inline">Fear & Greed:</span>
                  <span className="text-text-muted text-xs font-medium sm:hidden">F&G:</span>
                  <FearGreedBadge 
                    value={fearGreedValue} 
                    classification={fearGreed.value_classification} 
                  />
                </div>
              </div>
              <StatDivider />
            </>
          )}

          {/* Active Cryptocurrencies */}
          <div className="snap-start flex-shrink-0">
            <StatItem
              label="Cryptos"
              value={global.active_cryptocurrencies?.toLocaleString() || '0'}
              icon={
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
              tooltip={`${global.active_cryptocurrencies?.toLocaleString()} active cryptocurrencies tracked`}
            />
          </div>

          <StatDivider />

          {/* Markets */}
          <div className="snap-start flex-shrink-0">
            <StatItem
              label="Markets"
              value={global.markets?.toLocaleString() || '0'}
              icon={
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              }
              tooltip={`${global.markets?.toLocaleString()} trading pairs across exchanges`}
            />
          </div>

          {/* Spacer for mobile scroll padding */}
          <div className="w-4 flex-shrink-0 md:hidden" />
        </div>
      </div>
    </div>
  );
}
