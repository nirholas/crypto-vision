/**
 * GMGN Monitor — Real-Time Smart Money Intelligence
 *
 * The flagship visualization page combining:
 * - Animated network flow diagram (trades as particles between wallet nodes)
 * - Live trade feed with wallet/token details
 * - Wallet category breakdown with PnL metrics
 * - Chain filter + speed controls
 */

'use client';

import { useState, useMemo } from 'react';
import {
  Eye,
  Radio,
  BarChart3,
  Filter,
  TrendingUp,
  TrendingDown,
  Zap,
  Users,
  Target,
  Crosshair,
  Bot,
  Star,
  Crown,
  RefreshCw,
} from 'lucide-react';
import { tokens } from '@/lib/colors';
import { NetworkFlowViz } from './NetworkFlowViz';
import { NetworkFlow } from './NetworkFlow';
import { useGmgnWallets, useGmgnTrades, useGmgnCategories } from './gmgn-hooks';
import type { GmgnChain, GmgnWalletCategory, TradeEvent } from './gmgn-types';

// ─── Category Config ────────────────────────────────────────

const CATEGORY_META: Record<
  string,
  { label: string; icon: typeof Zap; color: string; description: string }
> = {
  smart_degen: { label: 'Smart Degen', icon: Zap, color: '#F7931A', description: 'High-frequency profitable traders' },
  launchpad_smart: { label: 'Launchpad', icon: Target, color: '#9B59B6', description: 'Early token launch buyers' },
  fresh_wallet: { label: 'Fresh Wallet', icon: Star, color: '#3498DB', description: 'Newly created active wallets' },
  snipe_bot: { label: 'Sniper', icon: Crosshair, color: '#E74C3C', description: 'Automated sniping bots' },
  live: { label: 'Live', icon: Radio, color: '#16C784', description: 'Currently active traders' },
  top_dev: { label: 'Top Dev', icon: Crown, color: '#F39C12', description: 'Top token developers' },
  top_followed: { label: 'Top Followed', icon: Users, color: '#1ABC9C', description: 'Most tracked wallets' },
  top_renamed: { label: 'Renamed', icon: RefreshCw, color: '#E91E63', description: 'Recently renamed Twitter wallets' },
  kol: { label: 'KOL', icon: Crown, color: '#8B5CF6', description: 'Key opinion leaders' },
};

// ─── Component ──────────────────────────────────────────────

export function GmgnMonitor() {
  const [chain, setChain] = useState<GmgnChain | 'all'>('all');
  const [selectedCategory, setSelectedCategory] = useState<GmgnWalletCategory | 'all'>('all');
  const [tab, setTab] = useState<'network' | 'leaderboard'>('network');

  const chainFilter = chain === 'all' ? undefined : chain;
  const categoryFilter = selectedCategory === 'all' ? undefined : selectedCategory;

  const { data: tradesData, isLoading: tradesLoading } = useGmgnTrades(chainFilter, 500);
  const { data: walletsData, isLoading: walletsLoading } = useGmgnWallets({
    chain: chainFilter,
    category: categoryFilter,
    sort: 'realizedProfit7d',
    limit: 100,
  });
  const { data: categoriesData } = useGmgnCategories();

  const trades = tradesData?.events ?? [];

  // Filter trades by category for the network viz
  const filteredTrades = useMemo(() => {
    if (selectedCategory === 'all') return trades;
    return trades.filter((t) => t.walletCategory === selectedCategory);
  }, [trades, selectedCategory]);

  // Convert to NetworkFlowViz-compatible format
  const vizTrades = useMemo(() => filteredTrades.map((t) => ({
    id: t.id,
    walletLabel: t.walletLabel,
    walletAddress: t.walletAddress,
    token: t.tokenSymbol,
    tokenAddress: t.tokenAddress,
    action: t.action === 'first_buy' ? 'buy' as const : t.action,
    amount: t.amountUsd / 100,
    amountUsd: t.amountUsd,
    chain: t.chain,
    timestamp: t.timestamp,
    exchange: t.chain === 'sol' ? 'Jupiter' : 'PancakeSwap',
  })), [filteredTrades]);

  // Aggregate stats
  const aggStats = useMemo(() => {
    if (!categoriesData) return null;
    const allCats = chain === 'all'
      ? mergeCategoryData(categoriesData.bsc, categoriesData.sol)
      : chain === 'bsc' ? categoriesData.bsc : categoriesData.sol;

    let totalWallets = 0;
    let totalPnl = 0;
    let avgWinrate = 0;
    let catCount = 0;

    for (const val of Object.values(allCats)) {
      totalWallets += val.count;
      totalPnl += val.totalPnl7d;
      avgWinrate += val.avgWinrate;
      catCount++;
    }

    return {
      totalWallets,
      totalPnl,
      avgWinrate: catCount > 0 ? avgWinrate / catCount : 0,
      categories: allCats,
    };
  }, [categoriesData, chain]);

  return (
    <div className="space-y-6">
      {/* ─── Header ────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-warning to-[#8B5CF6] flex items-center justify-center">
              <Eye size={18} className="text-white" />
            </div>
            GMGN Monitor
          </h1>
          <p className="text-sm text-text-muted mt-1">
            Real-time smart money flows across {chain === 'all' ? 'BSC & Solana' : chain.toUpperCase()} —{' '}
            <span className="text-text-secondary font-semibold">
              {walletsData?.totalWallets ?? '...'} wallets
            </span>{' '}
            tracked
          </p>
        </div>

        {/* Chain selector */}
        <div className="flex items-center gap-1 bg-surface/50 p-1 rounded-xl border border-surface-border">
          {(['all', 'bsc', 'sol'] as const).map((c) => (
            <button
              key={c}
              onClick={() => setChain(c)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                chain === c
                  ? 'bg-surface text-text-primary shadow-sm border border-surface-border'
                  : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              {c === 'all' ? 'All Chains' : c.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* ─── Stats strip ──────────────────────────────── */}
      {aggStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-surface rounded-xl border border-surface-border p-3">
            <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Tracked Wallets</div>
            <div className="text-lg font-bold font-mono text-text-primary">{aggStats.totalWallets.toLocaleString()}</div>
          </div>
          <div className="bg-surface rounded-xl border border-surface-border p-3">
            <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">7d Total PnL</div>
            <div className={`text-lg font-bold font-mono ${aggStats.totalPnl >= 0 ? 'text-gain' : 'text-loss'}`}>
              {aggStats.totalPnl >= 0 ? '+' : ''}${formatUsd(aggStats.totalPnl)}
            </div>
          </div>
          <div className="bg-surface rounded-xl border border-surface-border p-3">
            <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Avg Win Rate</div>
            <div className="text-lg font-bold font-mono text-text-primary">{(aggStats.avgWinrate * 100).toFixed(1)}%</div>
          </div>
          <div className="bg-surface rounded-xl border border-surface-border p-3">
            <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Active Trades</div>
            <div className="text-lg font-bold font-mono text-primary">{filteredTrades.length.toLocaleString()}</div>
          </div>
        </div>
      )}

      {/* ─── Category filter chips ────────────────────── */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
        <button
          onClick={() => setSelectedCategory('all')}
          className={`flex-shrink-0 px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
            selectedCategory === 'all'
              ? 'bg-primary/20 border-primary/50 text-primary'
              : 'bg-surface border-surface-border text-text-muted hover:text-text-secondary'
          }`}
        >
          All Categories
        </button>
        {Object.entries(CATEGORY_META).map(([key, meta]) => {
          const count = aggStats?.categories?.[key]?.count ?? 0;
          if (count === 0) return null;
          const Icon = meta.icon;
          return (
            <button
              key={key}
              onClick={() => setSelectedCategory(key as GmgnWalletCategory)}
              className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
                selectedCategory === key
                  ? 'border-opacity-50 text-text-primary'
                  : 'bg-surface border-surface-border text-text-muted hover:text-text-secondary'
              }`}
              style={
                selectedCategory === key
                  ? { backgroundColor: `${meta.color}20`, borderColor: `${meta.color}80` }
                  : undefined
              }
            >
              <Icon size={11} style={selectedCategory === key ? { color: meta.color } : undefined} />
              {meta.label}
              <span className="text-[10px] text-text-disabled">{count}</span>
            </button>
          );
        })}
      </div>

      {/* ─── Tab switcher ─────────────────────────────── */}
      <div className="flex items-center gap-1 bg-surface/50 p-1 rounded-xl border border-surface-border w-fit">
        <button
          onClick={() => setTab('network')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
            tab === 'network'
              ? 'bg-surface text-text-primary shadow-sm border border-surface-border'
              : 'text-text-muted hover:text-text-secondary'
          }`}
        >
          <Radio size={14} />
          Network Flow
        </button>
        <button
          onClick={() => setTab('leaderboard')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
            tab === 'leaderboard'
              ? 'bg-surface text-text-primary shadow-sm border border-surface-border'
              : 'text-text-muted hover:text-text-secondary'
          }`}
        >
          <BarChart3 size={14} />
          Leaderboard
        </button>
      </div>

      {/* ─── Network Flow Tab ─────────────────────────── */}
      {tab === 'network' && (
        <div>
          {tradesLoading || filteredTrades.length === 0 ? (
            <div className="bg-surface rounded-xl border border-surface-border h-[700px] flex items-center justify-center">
              <div className="text-center">
                <RefreshCw
                  size={24}
                  className={`mx-auto mb-2 ${tradesLoading ? 'animate-spin text-primary' : 'text-text-muted'}`}
                />
                <p className="text-sm text-text-muted">
                  {tradesLoading ? 'Loading trade data…' : 'No trades for this filter'}
                </p>
              </div>
            </div>
          ) : (
            <NetworkFlowViz externalTrades={vizTrades} />
          )}
        </div>
      )}

      {/* ─── Leaderboard Tab ──────────────────────────── */}
      {tab === 'leaderboard' && (
        <WalletLeaderboard wallets={walletsData?.wallets ?? []} isLoading={walletsLoading} />
      )}

      {/* ─── Category breakdown cards ─────────────────── */}
      {aggStats && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {Object.entries(aggStats.categories).map(([key, data]) => {
            const meta = CATEGORY_META[key];
            if (!meta) return null;
            const Icon = meta.icon;
            return (
              <div
                key={key}
                className="bg-surface rounded-xl border border-surface-border p-3 hover:border-opacity-50 transition-colors cursor-pointer"
                style={{ borderColor: selectedCategory === key ? meta.color : undefined }}
                onClick={() => setSelectedCategory(key as GmgnWalletCategory)}
              >
                <div className="flex items-center gap-1.5 mb-2">
                  <Icon size={12} style={{ color: meta.color }} />
                  <span className="text-[10px] text-text-muted uppercase tracking-wider">{meta.label}</span>
                </div>
                <div className="text-sm font-bold font-mono text-text-primary">{data.count} wallets</div>
                <div className="flex items-center justify-between mt-1">
                  <span className={`text-[10px] font-mono ${data.totalPnl7d >= 0 ? 'text-gain' : 'text-loss'}`}>
                    {data.totalPnl7d >= 0 ? '+' : ''}${formatUsd(data.totalPnl7d)}
                  </span>
                  <span className="text-[10px] text-text-muted font-mono">
                    {(data.avgWinrate * 100).toFixed(0)}% WR
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Wallet Leaderboard ─────────────────────────────────────

interface WalletRow {
  address: string;
  chain: string;
  category: string;
  realizedProfit7d: number;
  realizedProfit30d: number;
  winrate7d: number;
  buys7d: number;
  sells7d: number;
  txs7d: number;
  pnl7d: number;
  twitterUsername: string;
  name: string;
  avatar: string;
}

function WalletLeaderboard({ wallets, isLoading }: { wallets: WalletRow[]; isLoading: boolean }) {
  const [sortBy, setSortBy] = useState<'realizedProfit7d' | 'winrate7d' | 'txs7d' | 'pnl7d'>('realizedProfit7d');
  const [search, setSearch] = useState('');

  const sorted = useMemo(() => {
    let filtered = wallets;
    if (search) {
      const q = search.toLowerCase();
      filtered = wallets.filter(
        (w) =>
          w.address.toLowerCase().includes(q) ||
          w.name.toLowerCase().includes(q) ||
          w.twitterUsername.toLowerCase().includes(q),
      );
    }
    return [...filtered].sort((a, b) => {
      const va = a[sortBy] ?? 0;
      const vb = b[sortBy] ?? 0;
      return vb - va;
    });
  }, [wallets, sortBy, search]);

  return (
    <div className="bg-surface rounded-xl border border-surface-border p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
          <TrendingUp size={14} />
          Smart Money Leaderboard
        </h3>
        <div className="flex items-center gap-2">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="px-2 py-1 text-xs bg-surface-elevated border border-surface-border rounded-lg text-text-secondary cursor-pointer"
          >
            <option value="realizedProfit7d">7d Profit</option>
            <option value="winrate7d">Win Rate</option>
            <option value="txs7d">Transactions</option>
            <option value="pnl7d">PnL %</option>
          </select>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search…"
            className="px-3 py-1 text-xs bg-surface-elevated border border-surface-border rounded-lg text-text-primary placeholder:text-text-disabled focus:outline-none focus:border-primary/50 w-40"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="h-10 bg-surface-elevated rounded animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto max-h-[500px] overflow-y-auto scrollbar-thin">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-surface z-10">
              <tr className="text-text-muted border-b border-surface-border">
                <th className="text-left py-2 font-medium">#</th>
                <th className="text-left py-2 font-medium">Wallet</th>
                <th className="text-left py-2 font-medium">Category</th>
                <th className="text-left py-2 font-medium">Chain</th>
                <th className="text-right py-2 font-medium">7d Profit</th>
                <th className="text-right py-2 font-medium">30d Profit</th>
                <th className="text-right py-2 font-medium">Win Rate</th>
                <th className="text-right py-2 font-medium">PnL %</th>
                <th className="text-right py-2 font-medium">Txns</th>
              </tr>
            </thead>
            <tbody>
              {sorted.slice(0, 50).map((w, i) => {
                const meta = CATEGORY_META[w.category];
                return (
                  <tr
                    key={w.address}
                    className="border-b border-surface-border/30 hover:bg-surface-hover transition-colors"
                  >
                    <td className="py-2 text-text-muted">{i + 1}</td>
                    <td className="py-2">
                      <div className="flex items-center gap-2">
                        {w.avatar ? (
                          <img
                            src={w.avatar}
                            alt=""
                            className="w-5 h-5 rounded-full"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          />
                        ) : (
                          <div className="w-5 h-5 rounded-full bg-surface-elevated" />
                        )}
                        <div>
                          <span className="text-text-primary font-medium">
                            {w.name || w.twitterUsername || shortAddr(w.address)}
                          </span>
                          {w.twitterUsername && (
                            <span className="text-[10px] text-text-muted ml-1">@{w.twitterUsername}</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-2">
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
                        style={{
                          color: meta?.color ?? tokens.text.muted,
                          backgroundColor: `${meta?.color ?? '#888'}15`,
                        }}
                      >
                        {meta?.label ?? w.category}
                      </span>
                    </td>
                    <td className="py-2">
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase"
                        style={{
                          color: w.chain === 'sol' ? '#00FFA3' : '#F0B90B',
                          backgroundColor: w.chain === 'sol' ? 'rgba(0,255,163,0.08)' : 'rgba(240,185,11,0.08)',
                        }}
                      >
                        {w.chain}
                      </span>
                    </td>
                    <td className="py-2 text-right">
                      <span className={`font-mono font-semibold ${w.realizedProfit7d >= 0 ? 'text-gain' : 'text-loss'}`}>
                        {w.realizedProfit7d >= 0 ? '+' : ''}${formatUsd(w.realizedProfit7d)}
                      </span>
                    </td>
                    <td className="py-2 text-right">
                      <span className={`font-mono ${w.realizedProfit30d >= 0 ? 'text-gain' : 'text-loss'}`}>
                        {w.realizedProfit30d >= 0 ? '+' : ''}${formatUsd(w.realizedProfit30d)}
                      </span>
                    </td>
                    <td className="py-2 text-right font-mono text-text-secondary">
                      {(w.winrate7d * 100).toFixed(1)}%
                    </td>
                    <td className="py-2 text-right">
                      <span className={`font-mono ${w.pnl7d >= 0 ? 'text-gain' : 'text-loss'}`}>
                        {w.pnl7d >= 0 ? '+' : ''}{(w.pnl7d * 100).toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-2 text-right font-mono text-text-secondary">{w.txs7d}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {sorted.length === 0 && (
            <div className="text-center py-8 text-text-muted text-xs">No wallets match your search</div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────

function formatUsd(n: number): string {
  if (Math.abs(n) >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (Math.abs(n) >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toFixed(0);
}

function shortAddr(addr: string): string {
  if (!addr || addr.length < 10) return addr || 'unknown';
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function mergeCategoryData(
  bsc: Record<string, { count: number; totalPnl7d: number; avgWinrate: number }>,
  sol: Record<string, { count: number; totalPnl7d: number; avgWinrate: number }>,
): Record<string, { count: number; totalPnl7d: number; avgWinrate: number }> {
  const result: Record<string, { count: number; totalPnl7d: number; avgWinrate: number }> = {};

  for (const [key, val] of Object.entries(bsc)) {
    result[key] = { ...val };
  }
  for (const [key, val] of Object.entries(sol)) {
    if (result[key]) {
      const totalCount = result[key].count + val.count;
      result[key] = {
        count: totalCount,
        totalPnl7d: result[key].totalPnl7d + val.totalPnl7d,
        avgWinrate: totalCount > 0
          ? (result[key].avgWinrate * result[key].count + val.avgWinrate * val.count) / totalCount
          : 0,
      };
    } else {
      result[key] = { ...val };
    }
  }

  return result;
}
