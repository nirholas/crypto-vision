/**
 * Smart Money Trade Feed — GMGN-style Live Transaction Stream
 *
 * Real-time scrolling feed of smart money trades with:
 * - Wallet name/label with chain badge
 * - Action type (Buy, Sell, First Buy, etc.)
 * - Token info with symbol and market cap
 * - Profit % for sells
 * - Auto-cycling animation simulating live data
 */

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { SimulatedTrade, Chain } from '@/lib/smart-money-data';

// ─── Constants ──────────────────────────────────────────────

const ACTION_CONFIG: Record<
  string,
  { label: string; colorClass: string; bgClass: string }
> = {
  buy: { label: 'Buy', colorClass: 'text-[#00ff00]', bgClass: 'bg-[#00ff00]/10' },
  sell: { label: 'Sell', colorClass: 'text-[#ff0000]', bgClass: 'bg-[#ff0000]/10' },
  first_buy: { label: '✦ First Buy', colorClass: 'text-[#00ff00]', bgClass: 'bg-[#00ff00]/15' },
  sell_partial: { label: 'Sell Partial', colorClass: 'text-[#ffcc00]', bgClass: 'bg-[#ffcc00]/10' },
  sell_all: { label: 'Sell All', colorClass: 'text-[#ff0000]', bgClass: 'bg-[#ff0000]/15' },
  buy_more: { label: 'Buy More', colorClass: 'text-[#00ff00]', bgClass: 'bg-[#00ff00]/10' },
};

const CHAIN_BADGE: Record<Chain, { label: string; color: string }> = {
  sol: { label: 'SOL', color: 'bg-purple-500/20 text-purple-400' },
  bsc: { label: 'BSC', color: 'bg-yellow-500/20 text-yellow-400' },
};

function formatCompact(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  if (Math.abs(n) >= 1) return `$${n.toFixed(2)}`;
  return `$${n.toFixed(4)}`;
}

function shortenAddr(addr: string): string {
  if (addr.length <= 10) return addr;
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}

// ─── Component ──────────────────────────────────────────────

interface TradeFeedProps {
  trades: SimulatedTrade[];
  className?: string;
}

export function TradeFeed({ trades, className }: TradeFeedProps) {
  const [visibleTrades, setVisibleTrades] = useState<SimulatedTrade[]>([]);
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const indexRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Drip-feed trades in one at a time at the top
  useEffect(() => {
    if (trades.length === 0) return;

    // Start with a batch
    const initial = trades.slice(0, 12);
    setVisibleTrades(initial);
    indexRef.current = 12;

    const interval = setInterval(() => {
      const idx = indexRef.current % trades.length;
      const trade = trades[idx];
      const freshTrade = {
        ...trade,
        id: `${trade.id}-${Date.now()}`,
        timestamp: Date.now(),
        age: '0s',
      };

      setNewIds((prev) => new Set([...prev, freshTrade.id]));
      setVisibleTrades((prev) => [freshTrade, ...prev].slice(0, 50));
      indexRef.current += 1;

      // Clear "new" highlight after animation
      setTimeout(() => {
        setNewIds((prev) => {
          const next = new Set(prev);
          next.delete(freshTrade.id);
          return next;
        });
      }, 2000);
    }, 1800 + Math.random() * 1200);

    return () => clearInterval(interval);
  }, [trades]);

  const [filter, setFilter] = useState<'all' | 'sol' | 'bsc'>('all');

  const filtered = filter === 'all'
    ? visibleTrades
    : visibleTrades.filter((t) => t.chain === filter);

  return (
    <div className={className}>
      {/* Filter bar */}
      <div className="flex items-center gap-2 mb-3">
        {(['all', 'sol', 'bsc'] as const).map((f) => {
          const active = filter === f;
          const label = f === 'all' ? 'All Chains' : f.toUpperCase();
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors
                ${active
                  ? 'bg-white/10 border-white/20 text-white'
                  : 'bg-transparent border-white/5 text-[#666] hover:text-[#999]'}`}
            >
              {label}
            </button>
          );
        })}
        <div className="ml-auto flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-[#00ff00] animate-pulse" />
          <span className="text-[10px] text-[#666] uppercase tracking-wider">Live Feed</span>
        </div>
      </div>

      {/* Feed */}
      <div
        ref={containerRef}
        className="space-y-0.5 max-h-[700px] overflow-y-auto scrollbar-thin"
      >
        {filtered.map((trade) => (
          <TradeRow key={trade.id} trade={trade} isNew={newIds.has(trade.id)} />
        ))}
        {filtered.length === 0 && (
          <div className="text-center text-[#666] py-12 text-sm">
            No trades to display
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Trade Row ──────────────────────────────────────────────

function TradeRow({ trade, isNew }: { trade: SimulatedTrade; isNew: boolean }) {
  const cfg = ACTION_CONFIG[trade.action] ?? ACTION_CONFIG.buy;
  const chainBadge = CHAIN_BADGE[trade.chain];
  const isSell = trade.action.startsWith('sell');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setMounted(true));
  }, []);

  return (
    <div
      className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all duration-300
        ${isNew
          ? 'bg-white/[0.03] border-white/10 translate-x-0 opacity-100'
          : 'bg-transparent border-transparent hover:bg-white/[0.02]'}
        ${!mounted ? 'opacity-0 translate-y-1' : 'opacity-100 translate-y-0'}
      `}
      style={{ transition: 'all 0.3s ease-out' }}
    >
      {/* Wallet label */}
      <div className="flex-shrink-0 w-[130px] truncate">
        <span className="text-xs font-medium text-white truncate">
          {trade.walletLabel}
        </span>
      </div>

      {/* Action badge */}
      <div className="flex-shrink-0">
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${cfg.bgClass} ${cfg.colorClass}`}>
          {cfg.label}
          {isSell && trade.profitPercent !== undefined && (
            <span className={trade.profitPercent >= 0 ? 'text-[#00ff00]' : 'text-[#ff0000]'}>
              {' '}{trade.profitPercent >= 0 ? '+' : ''}{trade.profitPercent.toFixed(0)}%
            </span>
          )}
        </span>
      </div>

      {/* Token */}
      <div className="flex-1 min-w-0 flex items-center gap-1.5">
        {trade.tokenLogo && (
          <img
            src={trade.tokenLogo}
            alt=""
            width={16}
            height={16}
            className="rounded-full flex-shrink-0"
            loading="lazy"
          />
        )}
        <span className="text-xs text-[#b0b0b0] truncate">{trade.tokenSymbol}</span>
      </div>

      {/* Amount */}
      <div className="flex-shrink-0 text-right w-[70px]">
        <span className="text-xs font-mono text-white">
          {formatCompact(trade.amount)}
        </span>
      </div>

      {/* Chain badge */}
      <div className="flex-shrink-0">
        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${chainBadge.color}`}>
          {chainBadge.label}
        </span>
      </div>

      {/* Age */}
      <div className="flex-shrink-0 text-right w-[32px]">
        <span className="text-[10px] text-[#666] font-mono">{trade.age}</span>
      </div>

      {/* Market Cap */}
      <div className="flex-shrink-0 text-right w-[65px] hidden md:block">
        <span className="text-[10px] text-[#666]">
          MC:{formatCompact(trade.marketCap)}
        </span>
      </div>
    </div>
  );
}
