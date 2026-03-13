/**
 * Wallet Intel Dashboard — HQ-style Command Center
 *
 * Comprehensive wallet intelligence with:
 * - Summary stats strip
 * - Top wallet leaderboard with sortable columns
 * - Exchange flow comparison cards
 * - Dormant wallet reactivation tracker
 * - Accumulation/distribution heatmap
 */

'use client';

import { useState, useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import {
  Wallet,
  Eye,
  TrendingUp,
  TrendingDown,
  Activity,
  Clock,
  ArrowUpDown,
  ExternalLink,
  Search,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import { tokens, chartColors } from '@/lib/colors';
import {
  useWhaleTransactions,
  useSmartMoney,
  useExchangeFlows,
  useDormantWallets,
} from './hooks';
import type {
  WhaleTransaction,
  ExchangeFlowData,
  DormantWallet,
} from './types';

// ─── Component ──────────────────────────────────────────────

export function WalletIntelDashboard() {
  const { data: txData } = useWhaleTransactions(50_000, 100);
  const { data: smartData } = useSmartMoney();
  const { data: flowData } = useExchangeFlows();
  const { data: dormantData } = useDormantWallets();

  // ─── Summary stats ────────────────────────────────────────

  const stats = useMemo(() => {
    const totalTx = txData?.transactions?.length ?? 0;
    const totalVolume = txData?.transactions?.reduce((s, t) => s + t.amountUsd, 0) ?? 0;
    const uniqueWallets = new Set(
      txData?.transactions?.flatMap((t) => [t.from, t.to].filter((a) => a !== 'unknown')) ?? [],
    ).size;
    const signal = txData?.classification?.overallSignal ?? 'neutral';
    const signalStrength = txData?.classification?.signalStrength ?? 0;
    const exchangeCount = flowData?.summary?.exchangeCount ?? 0;
    const netFlow = flowData?.summary?.netFlow ?? 0;
    const dormantCount = dormantData?.length ?? 0;

    return {
      totalTx,
      totalVolume,
      uniqueWallets,
      signal,
      signalStrength,
      exchangeCount,
      netFlow,
      dormantCount,
    };
  }, [txData, flowData, dormantData]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-warning to-loss flex items-center justify-center">
            <Eye size={18} className="text-white" />
          </div>
          Wallet Intel Center
        </h1>
        <p className="text-sm text-text-muted mt-1">
          Cross-chain wallet intelligence — exchange flows, smart money, dormant reactivations
        </p>
      </div>

      {/* ─── Stats Strip ─────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <StatCard icon={Wallet} label="Unique Wallets" value={stats.uniqueWallets.toString()} />
        <StatCard icon={Activity} label="Transactions" value={stats.totalTx.toString()} subtitle=">$50K" />
        <StatCard
          icon={TrendingUp}
          label="Total Volume"
          value={`$${formatUsd(stats.totalVolume)}`}
        />
        <StatCard
          icon={stats.signal === 'bullish' ? TrendingUp : TrendingDown}
          label="Whale Signal"
          value={stats.signal.toUpperCase()}
          subtitle={`${stats.signalStrength}% strength`}
          color={stats.signal === 'bullish' ? 'text-gain' : stats.signal === 'bearish' ? 'text-loss' : 'text-text-muted'}
        />
        <StatCard
          icon={ArrowUpDown}
          label="Net Exchange"
          value={`$${formatUsd(Math.abs(stats.netFlow))}`}
          subtitle={stats.netFlow > 0 ? 'Net inflow' : 'Net outflow'}
          color={stats.netFlow > 0 ? 'text-loss' : 'text-gain'}
        />
        <StatCard
          icon={Clock}
          label="Dormant Reval."
          value={stats.dormantCount.toString()}
          subtitle="Recently active"
        />
      </div>

      {/* ─── Main Grid ──────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Whale Leaderboard (2-col) */}
        <div className="lg:col-span-2">
          <WhaleLeaderboard transactions={txData?.transactions ?? []} />
        </div>

        {/* Exchange Flow Cards */}
        <div className="space-y-4">
          <ExchangeFlowCards flows={flowData?.flows ?? []} />
          <DormantWalletPanel wallets={dormantData ?? []} />
        </div>
      </div>

      {/* ─── Smart Money Positions ────────────────────── */}
      {smartData && (
        <SmartMoneyPositions
          newPositions={smartData.newPositions}
          exitingPositions={smartData.exitingPositions}
          topWallets={smartData.topPerformingWallets}
        />
      )}
    </div>
  );
}

export default WalletIntelDashboard;

// ─── Whale Leaderboard ──────────────────────────────────────

type SortKey = 'volume' | 'txCount' | 'avgSize';

interface WalletAggregate {
  address: string;
  label?: string;
  chain: string;
  volume: number;
  txCount: number;
  avgSize: number;
  lastSeen: string;
  isExchange: boolean;
}

function WhaleLeaderboard({ transactions }: { transactions: WhaleTransaction[] }) {
  const [sortBy, setSortBy] = useState<SortKey>('volume');
  const [sortAsc, setSortAsc] = useState(false);
  const [search, setSearch] = useState('');

  const wallets = useMemo(() => {
    const map = new Map<string, WalletAggregate>();

    for (const tx of transactions) {
      for (const side of ['from', 'to'] as const) {
        const addr = tx[side];
        if (addr === 'unknown') continue;

        const existing = map.get(addr) || {
          address: addr,
          label: side === 'from' ? tx.fromLabel : tx.toLabel,
          chain: tx.blockchain,
          volume: 0,
          txCount: 0,
          avgSize: 0,
          lastSeen: tx.timestamp,
          isExchange:
            tx.transactionType === 'exchange_deposit' && side === 'to' ||
            tx.transactionType === 'exchange_withdrawal' && side === 'from',
        };

        existing.volume += tx.amountUsd;
        existing.txCount++;
        if (tx.timestamp > existing.lastSeen) existing.lastSeen = tx.timestamp;
        existing.avgSize = existing.volume / existing.txCount;

        map.set(addr, existing);
      }
    }

    return [...map.values()];
  }, [transactions]);

  const sorted = useMemo(() => {
    let filtered = wallets;
    if (search) {
      const q = search.toLowerCase();
      filtered = wallets.filter(
        (w) =>
          w.address.toLowerCase().includes(q) ||
          (w.label && w.label.toLowerCase().includes(q)),
      );
    }
    return filtered.sort((a, b) => {
      const diff = a[sortBy] - b[sortBy];
      return sortAsc ? diff : -diff;
    });
  }, [wallets, sortBy, sortAsc, search]);

  const handleSort = (key: SortKey) => {
    if (sortBy === key) setSortAsc(!sortAsc);
    else {
      setSortBy(key);
      setSortAsc(false);
    }
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortBy !== col) return <ArrowUpDown size={10} className="text-text-disabled" />;
    return sortAsc ? <ChevronUp size={10} /> : <ChevronDown size={10} />;
  };

  return (
    <div className="bg-surface rounded-xl border border-surface-border p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
          <Wallet size={14} />
          Whale Leaderboard
        </h3>
        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search wallets…"
            className="pl-7 pr-3 py-1.5 text-xs bg-surface-elevated border border-surface-border rounded-lg text-text-primary placeholder:text-text-disabled focus:outline-none focus:border-primary/50 w-48"
          />
        </div>
      </div>

      <div className="overflow-x-auto max-h-[400px] overflow-y-auto scrollbar-thin">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-surface z-10">
            <tr className="text-text-muted border-b border-surface-border">
              <th className="text-left py-2 font-medium">#</th>
              <th className="text-left py-2 font-medium">Wallet</th>
              <th className="text-left py-2 font-medium">Chain</th>
              <th
                className="text-right py-2 font-medium cursor-pointer hover:text-text-primary"
                onClick={() => handleSort('volume')}
              >
                Volume <SortIcon col="volume" />
              </th>
              <th
                className="text-right py-2 font-medium cursor-pointer hover:text-text-primary"
                onClick={() => handleSort('txCount')}
              >
                Txns <SortIcon col="txCount" />
              </th>
              <th
                className="text-right py-2 font-medium cursor-pointer hover:text-text-primary"
                onClick={() => handleSort('avgSize')}
              >
                Avg Size <SortIcon col="avgSize" />
              </th>
              <th className="text-right py-2 font-medium">Last Active</th>
            </tr>
          </thead>
          <tbody>
            {sorted.slice(0, 30).map((w, i) => (
              <tr
                key={w.address}
                className="border-b border-surface-border/30 hover:bg-surface-hover transition-colors"
              >
                <td className="py-2 text-text-muted">{i + 1}</td>
                <td className="py-2">
                  <div className="flex items-center gap-1.5">
                    {w.isExchange && (
                      <span className="w-1.5 h-1.5 rounded-full bg-warning flex-shrink-0" title="Exchange" />
                    )}
                    <span className="font-mono text-text-secondary">
                      {w.label || `${w.address.slice(0, 6)}…${w.address.slice(-4)}`}
                    </span>
                  </div>
                </td>
                <td className="py-2">
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase"
                    style={{ color: chainColor(w.chain), backgroundColor: `${chainColor(w.chain)}15` }}
                  >
                    {w.chain}
                  </span>
                </td>
                <td className="py-2 text-right font-mono font-semibold text-text-primary">
                  ${formatUsd(w.volume)}
                </td>
                <td className="py-2 text-right font-mono text-text-secondary">{w.txCount}</td>
                <td className="py-2 text-right font-mono text-text-secondary">
                  ${formatUsd(w.avgSize)}
                </td>
                <td className="py-2 text-right text-text-muted">{timeAgo(w.lastSeen)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {sorted.length === 0 && (
          <div className="text-center text-text-muted text-xs py-8">
            No wallets match your search
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Exchange Flow Cards ────────────────────────────────────

function ExchangeFlowCards({ flows }: { flows: ExchangeFlowData[] }) {
  const topFlows = useMemo(
    () => flows.sort((a, b) => Math.abs(b.netFlow) - Math.abs(a.netFlow)).slice(0, 6),
    [flows],
  );

  return (
    <div className="bg-surface rounded-xl border border-surface-border p-4">
      <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
        <ArrowUpDown size={14} />
        Exchange Flows (24h)
      </h3>
      {topFlows.length > 0 ? (
        <div className="space-y-2">
          {topFlows.map((f) => {
            const isOutflow = f.netFlow < 0;
            return (
              <div key={f.exchange} className="p-2.5 rounded-lg bg-surface-elevated">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-text-primary">{f.exchange}</span>
                  <span
                    className={`text-xs font-mono font-bold ${isOutflow ? 'text-gain' : 'text-loss'}`}
                  >
                    {isOutflow ? '↑' : '↓'} ${formatUsd(Math.abs(f.netFlow))}
                  </span>
                </div>
                {/* Flow bar */}
                <div className="flex gap-1 h-1.5 rounded-full overflow-hidden bg-surface">
                  <div
                    className="h-full rounded-full bg-loss"
                    style={{
                      width: `${Math.min(100, (f.deposits24h / (f.deposits24h + f.withdrawals24h + 1)) * 100)}%`,
                    }}
                  />
                  <div
                    className="h-full rounded-full bg-gain"
                    style={{
                      width: `${Math.min(100, (f.withdrawals24h / (f.deposits24h + f.withdrawals24h + 1)) * 100)}%`,
                    }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-text-muted mt-1">
                  <span>In: {f.depositCount}</span>
                  <span>Out: {f.withdrawalCount}</span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-text-muted">No exchange flow data available</p>
      )}
    </div>
  );
}

// ─── Dormant Wallet Panel ───────────────────────────────────

function DormantWalletPanel({ wallets }: { wallets: DormantWallet[] }) {
  return (
    <div className="bg-surface rounded-xl border border-surface-border p-4">
      <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
        <Clock size={14} />
        Dormant Reactivations
      </h3>
      {wallets.length > 0 ? (
        <div className="space-y-2">
          {wallets.slice(0, 5).map((w) => (
            <div key={w.address} className="p-2.5 rounded-lg bg-surface-elevated">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-text-secondary">
                  {w.address.slice(0, 8)}…{w.address.slice(-6)}
                </span>
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase"
                  style={{ color: chainColor(w.chain), backgroundColor: `${chainColor(w.chain)}15` }}
                >
                  {w.chain}
                </span>
              </div>
              <div className="flex items-center justify-between mt-1 text-[10px]">
                <span className="text-text-muted">
                  Dormant {w.dormantDays}d · Woke {timeAgo(w.reactivatedAt)}
                </span>
                <span className="font-mono font-semibold text-warning">${formatUsd(w.balanceUsd)}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-text-muted">No dormant reactivations detected</p>
      )}
    </div>
  );
}

// ─── Smart Money Positions ──────────────────────────────────

function SmartMoneyPositions({
  newPositions,
  exitingPositions,
  topWallets,
}: {
  newPositions: Array<{ token: string; wallet: string; amountUsd: number }>;
  exitingPositions: Array<{ token: string; wallet: string; amountUsd: number }>;
  topWallets: Array<{ wallet: string; label: string; trades: number; estimatedPnl: number }>;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* New Positions */}
      <div className="bg-surface rounded-xl border border-surface-border p-4">
        <h3 className="text-sm font-semibold text-gain mb-3 flex items-center gap-2">
          <TrendingUp size={14} />
          New Positions
        </h3>
        {newPositions.length > 0 ? (
          <div className="space-y-1.5">
            {newPositions.slice(0, 8).map((p, i) => (
              <div key={`${p.token}-${p.wallet}-${i}`} className="flex items-center justify-between py-1 border-b border-surface-border/30 last:border-0">
                <div>
                  <span className="text-xs font-semibold text-text-primary">{p.token}</span>
                  <span className="text-[10px] text-text-muted ml-1.5 font-mono">
                    {p.wallet.slice(0, 6)}…
                  </span>
                </div>
                <span className="text-xs font-mono text-gain">${formatUsd(p.amountUsd)}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-text-muted">None detected</p>
        )}
      </div>

      {/* Exiting Positions */}
      <div className="bg-surface rounded-xl border border-surface-border p-4">
        <h3 className="text-sm font-semibold text-loss mb-3 flex items-center gap-2">
          <TrendingDown size={14} />
          Exiting Positions
        </h3>
        {exitingPositions.length > 0 ? (
          <div className="space-y-1.5">
            {exitingPositions.slice(0, 8).map((p, i) => (
              <div key={`${p.token}-${p.wallet}-${i}`} className="flex items-center justify-between py-1 border-b border-surface-border/30 last:border-0">
                <div>
                  <span className="text-xs font-semibold text-text-primary">{p.token}</span>
                  <span className="text-[10px] text-text-muted ml-1.5 font-mono">
                    {p.wallet.slice(0, 6)}…
                  </span>
                </div>
                <span className="text-xs font-mono text-loss">${formatUsd(p.amountUsd)}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-text-muted">None detected</p>
        )}
      </div>

      {/* Top Wallets PnL */}
      <div className="bg-surface rounded-xl border border-surface-border p-4">
        <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
          <Wallet size={14} />
          Top PnL Wallets
        </h3>
        {topWallets.length > 0 ? (
          <div className="space-y-1.5">
            {topWallets.slice(0, 8).map((w) => (
              <div key={w.wallet} className="flex items-center justify-between py-1 border-b border-surface-border/30 last:border-0">
                <div>
                  <span className="text-xs text-text-primary">{w.label}</span>
                  <span className="text-[10px] text-text-muted ml-1.5">{w.trades} txns</span>
                </div>
                <span
                  className={`text-xs font-mono font-semibold ${w.estimatedPnl >= 0 ? 'text-gain' : 'text-loss'}`}
                >
                  {w.estimatedPnl >= 0 ? '+' : ''}${formatUsd(Math.abs(w.estimatedPnl))}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-text-muted">No data</p>
        )}
      </div>
    </div>
  );
}

// ─── Stat Card ──────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  subtitle,
  color = 'text-primary',
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  subtitle?: string;
  color?: string;
}) {
  return (
    <div className="bg-surface rounded-xl border border-surface-border p-3 hover:border-primary/30 transition-colors">
      <div className="flex items-center gap-1.5 mb-1.5">
        <Icon className={`w-3.5 h-3.5 ${color}`} />
        <span className="text-[10px] text-text-muted uppercase tracking-wider">{label}</span>
      </div>
      <p className={`text-lg font-bold font-mono ${color}`}>{value}</p>
      {subtitle && <p className="text-[10px] text-text-muted mt-0.5">{subtitle}</p>}
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────

function formatUsd(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toFixed(0);
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function chainColor(chain: string): string {
  switch (chain) {
    case 'ethereum': return '#627EEA';
    case 'bitcoin': return '#F7931A';
    case 'solana': return '#00FFA3';
    case 'tron': return '#FF0013';
    default: return tokens.text.muted;
  }
}
