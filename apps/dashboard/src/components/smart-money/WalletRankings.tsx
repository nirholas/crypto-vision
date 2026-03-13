/**
 * Wallet Rankings — GMGN-style Wallet Card Grid
 *
 * Displays wallet performance data in a card grid, with:
 * - Wallet address/name with chain badge
 * - 7D profit, 30D PnL, win rate, TX count, volume
 * - Tag badges (smart_degen, snipe_bot, etc.)
 * - KOL twitter info when available
 * - Chain/tag filtering
 */

'use client';

import { useState, useMemo } from 'react';
import type { SmartWallet, KOLWallet, Chain, WalletTag } from '@/lib/smart-money-data';
import { formatUsd, formatPnl, formatProfit } from '@/lib/smart-money-data';

// ─── Props ──────────────────────────────────────────────────

interface WalletRankingsProps {
  wallets: SmartWallet[];
  kolWallets: KOLWallet[];
  className?: string;
}

// ─── Tag Styling ────────────────────────────────────────────

const TAG_COLORS: Record<string, { bg: string; text: string }> = {
  smart_degen: { bg: 'rgba(153, 69, 255, 0.15)', text: '#9945FF' },
  launchpad_smart: { bg: 'rgba(0, 212, 170, 0.15)', text: '#00d4aa' },
  fresh_wallet: { bg: 'rgba(255, 204, 0, 0.15)', text: '#ffcc00' },
  snipe_bot: { bg: 'rgba(255, 0, 0, 0.15)', text: '#ff0000' },
  live: { bg: 'rgba(0, 255, 0, 0.15)', text: '#00ff00' },
  top_dev: { bg: 'rgba(123, 97, 255, 0.15)', text: '#7b61ff' },
  top_followed: { bg: 'rgba(0, 150, 255, 0.15)', text: '#0096ff' },
  top_renamed: { bg: 'rgba(255, 150, 0, 0.15)', text: '#ff9600' },
};

const CHAIN_COLORS: Record<Chain, string> = {
  sol: '#9945FF',
  bsc: '#F0B90B',
};

// ─── Component ──────────────────────────────────────────────

export function WalletRankings({ wallets, kolWallets, className }: WalletRankingsProps) {
  const [chainFilter, setChainFilter] = useState<'all' | Chain>('all');
  const [tagFilter, setTagFilter] = useState<WalletTag | 'all'>('all');
  const [view, setView] = useState<'top' | 'kol'>('top');
  const [showCount, setShowCount] = useState(24);

  // Combine KOL lookup for twitter data
  const kolMap = useMemo(() => {
    const map = new Map<string, KOLWallet>();
    for (const k of kolWallets) {
      map.set(k.address, k);
    }
    return map;
  }, [kolWallets]);

  // Determine which list to show
  const source = view === 'kol'
    ? kolWallets.map((k) => ({ ...k, _chain: guessChain(k) }))
    : wallets.map((w) => ({ ...w, _chain: guessChain(w) }));

  // Filter
  const filtered = useMemo(() => {
    return source
      .filter((w) => chainFilter === 'all' || w._chain === chainFilter)
      .filter((w) => tagFilter === 'all' || w.tags.includes(tagFilter))
      .slice(0, showCount);
  }, [source, chainFilter, tagFilter, showCount]);

  // Available tags from data
  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const w of wallets) {
      for (const t of w.tags) set.add(t);
    }
    return [...set].sort();
  }, [wallets]);

  return (
    <div className={`space-y-4 ${className ?? ''}`}>
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {/* View Toggle */}
        <div className="flex items-center gap-1 bg-[#0a0a0a] rounded-lg border border-[#1a1a1a] p-0.5">
          {(['top', 'kol'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                view === v
                  ? 'bg-[#141414] text-white shadow-sm'
                  : 'text-[#666] hover:text-[#999]'
              }`}
            >
              {v === 'top' ? 'Top Wallets' : 'KOL Wallets'}
            </button>
          ))}
        </div>

        {/* Chain filter */}
        <div className="flex items-center gap-1 bg-[#0a0a0a] rounded-lg border border-[#1a1a1a] p-0.5">
          {(['all', 'sol', 'bsc'] as const).map((c) => (
            <button
              key={c}
              onClick={() => setChainFilter(c)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                chainFilter === c
                  ? 'bg-[#141414] text-white shadow-sm'
                  : 'text-[#666] hover:text-[#999]'
              }`}
            >
              {c === 'all' ? 'All' : c.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Tag filter */}
        <select
          value={tagFilter}
          onChange={(e) => setTagFilter(e.target.value as WalletTag | 'all')}
          className="bg-[#0a0a0a] border border-[#1a1a1a] text-xs text-white rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#333]"
        >
          <option value="all">All Tags</option>
          {allTags.map((t) => (
            <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
          ))}
        </select>

        <span className="text-[10px] text-[#666] font-mono ml-auto">
          {filtered.length} wallets
        </span>
      </div>

      {/* Wallet Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
        {filtered.map((wallet, i) => {
          const chain = wallet._chain;
          const kol = kolMap.get(wallet.address);
          const profit7d = parseFloat(wallet.realized_profit_7d || '0');
          const pnl30d = parseFloat(wallet.pnl_30d || '0');
          const winrate = kol?.winrate_7d ? `${(parseFloat(kol.winrate_7d) * 100).toFixed(0)}%` : null;
          const volume = kol?.volume_7d ? formatUsd(parseFloat(kol.volume_7d)) : null;

          return (
            <div
              key={wallet.address}
              className="group bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-4 hover:border-[#333] transition-all duration-200 cursor-default"
            >
              {/* Header row */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2 min-w-0">
                  {/* Rank */}
                  <span className="text-[10px] text-[#444] font-mono w-5 shrink-0">
                    #{i + 1}
                  </span>

                  {/* Avatar */}
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                    style={{
                      backgroundColor: `${CHAIN_COLORS[chain]}15`,
                      color: CHAIN_COLORS[chain],
                    }}
                  >
                    {wallet.avatar ? (
                      <img
                        src={wallet.avatar}
                        alt=""
                        className="w-8 h-8 rounded-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      chain.toUpperCase().slice(0, 1)
                    )}
                  </div>

                  {/* Name + address */}
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-white truncate">
                      {wallet.name || wallet.twitter_name || wallet.nickname || shortAddr(wallet.address)}
                    </div>
                    {wallet.twitter_username && (
                      <div className="text-[10px] text-[#666] truncate">
                        @{wallet.twitter_username}
                      </div>
                    )}
                  </div>
                </div>

                {/* Chain badge */}
                <span
                  className="text-[9px] font-bold px-1.5 py-0.5 rounded-md shrink-0"
                  style={{
                    backgroundColor: `${CHAIN_COLORS[chain]}15`,
                    color: CHAIN_COLORS[chain],
                  }}
                >
                  {chain.toUpperCase()}
                </span>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-3 gap-x-3 gap-y-2 mb-3">
                <StatCell
                  label="7D Profit"
                  value={formatProfit(profit7d)}
                  positive={profit7d > 0}
                />
                <StatCell
                  label="30D PnL"
                  value={formatPnl(pnl30d)}
                  positive={pnl30d > 0}
                />
                <StatCell
                  label="TXs (7D)"
                  value={wallet.txs_7d?.toString() ?? '—'}
                />
                {winrate && (
                  <StatCell label="Win Rate" value={winrate} />
                )}
                {volume && (
                  <StatCell label="Volume 7D" value={`$${volume}`} />
                )}
                <StatCell label="Buys/Sells" value={`${wallet.buy_7d}/${wallet.sell_7d}`} />
              </div>

              {/* Tags */}
              {wallet.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {wallet.tags.slice(0, 4).map((tag) => {
                    const style = TAG_COLORS[tag] ?? { bg: 'rgba(255,255,255,0.05)', text: '#999' };
                    return (
                      <span
                        key={tag}
                        className="text-[9px] font-medium px-1.5 py-0.5 rounded-md"
                        style={{ backgroundColor: style.bg, color: style.text }}
                      >
                        {tag.replace(/_/g, ' ')}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Load more */}
      {filtered.length >= showCount && (
        <div className="flex justify-center">
          <button
            onClick={() => setShowCount((c) => c + 24)}
            className="text-xs text-[#666] hover:text-white border border-[#1a1a1a] hover:border-[#333] rounded-lg px-4 py-2 transition-all"
          >
            Load More
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────

function StatCell({
  label,
  value,
  positive,
}: {
  label: string;
  value: string;
  positive?: boolean;
}) {
  return (
    <div>
      <div className="text-[9px] text-[#555] uppercase tracking-wider">{label}</div>
      <div
        className={`text-xs font-mono font-medium ${
          positive === true
            ? 'text-[#00ff00]'
            : positive === false
            ? 'text-[#ff0000]'
            : 'text-white'
        }`}
      >
        {value}
      </div>
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────

function shortAddr(addr: string): string {
  if (!addr || addr.length < 10) return addr ?? '???';
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function guessChain(wallet: SmartWallet): Chain {
  // SOL wallets are base58 (32-44 chars, no 0x)
  if (wallet.address && !wallet.address.startsWith('0x') && wallet.address.length > 30) {
    return 'sol';
  }
  // BSC wallets start with 0x
  if (wallet.address && wallet.address.startsWith('0x')) {
    return 'bsc';
  }
  // Fallback: check balances
  if (parseFloat(wallet.sol_balance || '0') > 0) return 'sol';
  return 'bsc';
}
