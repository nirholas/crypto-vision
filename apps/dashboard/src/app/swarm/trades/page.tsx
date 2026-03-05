'use client';

import React, { useState, useMemo } from 'react';
import {
  ArrowLeftRight,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Download,
  Filter,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Loader2,
  BarChart3,
  Target,
  Trophy,
  Flame,
  ExternalLink,
} from 'lucide-react';
import { useSwarmTrades, useSwarmPnl } from '@/hooks/useSwarmData';
import {
  formatSol,
  formatPct,
  formatRelativeTime,
  solscanTxUrl,
  AGENT_ROLE_ICONS,
} from '@/types/swarm';
import type { TradeEntry, TradeDirection, PnLSnapshot } from '@/types/swarm';

/* ─── Page ───────────────────────────────────────────────────── */

const PAGE_SIZE = 25;

export default function SwarmTradesPage() {
  const [direction, setDirection] = useState<TradeDirection | undefined>(undefined);
  const [offset, setOffset] = useState(0);

  const { trades, total, hasMore, isLoading, refetch } = useSwarmTrades({
    limit: PAGE_SIZE,
    offset,
    direction,
  });
  const { pnl, isLoading: pnlLoading } = useSwarmPnl();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setTimeout(() => setRefreshing(false), 500);
  };

  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const snapshot = pnl?.current ?? null;

  return (
    <div className="space-y-4">
      {/* P&L Summary */}
      {snapshot && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
          <PnlCard
            label="Total P&L"
            value={formatSol(snapshot.totalPnl)}
            positive={snapshot.totalPnl >= 0}
            large
          />
          <PnlCard
            label="ROI"
            value={formatPct(snapshot.roi)}
            positive={snapshot.roi >= 0}
            large
          />
          <PnlCard label="Win Rate" value={`${(snapshot.winRate * 100).toFixed(1)}%`} />
          <PnlCard label="Max Drawdown" value={formatPct(snapshot.maxDrawdown)} positive={false} />
          <PnlCard label="Best Trade" value={formatSol(snapshot.bestTrade)} positive />
          <PnlCard label="Worst Trade" value={formatSol(snapshot.worstTrade)} positive={false} />
          <PnlCard label="Avg Size" value={formatSol(snapshot.avgTradeSize)} />
          <PnlCard
            label="Success"
            value={`${snapshot.successfulTrades}/${snapshot.totalTrades}`}
          />
        </div>
      )}

      {/* P&L Chart Placeholder */}
      {pnl?.timeSeries && pnl.timeSeries.points.length > 0 && (
        <div className="bg-[var(--surface)] rounded-lg border border-[var(--surface-border)] p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-3">
            P&L Over Time
          </h3>
          <PnlMiniChart points={pnl.timeSeries.points} />
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Trade History</h3>
          <span className="text-xs text-[var(--text-muted)]">({total} total)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border border-[var(--surface-border)] overflow-hidden">
            {([undefined, 'buy', 'sell'] as const).map((d) => (
              <button
                key={d ?? 'all'}
                onClick={() => { setDirection(d as TradeDirection | undefined); setOffset(0); }}
                className={`px-2.5 py-1 text-[10px] font-semibold uppercase transition-all ${
                  direction === d
                    ? 'bg-[var(--brand)]/15 text-[var(--brand)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]'
                }`}
              >
                {d ?? 'All'}
              </button>
            ))}
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-[var(--surface-border)] text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-all disabled:opacity-50"
          >
            <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Trade Table */}
      <div className="bg-[var(--surface)] rounded-lg border border-[var(--surface-border)] overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={24} className="animate-spin text-[var(--text-muted)]" />
          </div>
        ) : trades.length === 0 ? (
          <div className="p-8 text-center text-sm text-[var(--text-muted)]">
            No trades recorded yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--surface-border)] text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
                  <th className="px-4 py-2.5 text-left font-medium">Time</th>
                  <th className="px-4 py-2.5 text-center font-medium">Side</th>
                  <th className="px-4 py-2.5 text-right font-medium">SOL</th>
                  <th className="px-4 py-2.5 text-right font-medium">Tokens</th>
                  <th className="px-4 py-2.5 text-right font-medium">Price</th>
                  <th className="px-4 py-2.5 text-right font-medium">Slippage</th>
                  <th className="px-4 py-2.5 text-center font-medium">Status</th>
                  <th className="px-4 py-2.5 text-right font-medium">TX</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--surface-border)]">
                {trades.map((trade) => (
                  <TradeRow key={trade.id} trade={trade} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-[var(--text-muted)]">
            Page {currentPage} of {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
              disabled={offset === 0}
              className="p-1.5 rounded-md border border-[var(--surface-border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] disabled:opacity-30 disabled:pointer-events-none"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              onClick={() => setOffset(offset + PAGE_SIZE)}
              disabled={!hasMore}
              className="p-1.5 rounded-md border border-[var(--surface-border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] disabled:opacity-30 disabled:pointer-events-none"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Trade Row ──────────────────────────────────────────────── */

function TradeRow({ trade }: { trade: TradeEntry }) {
  const isBuy = trade.direction === 'buy';

  return (
    <tr className="hover:bg-[var(--surface-hover)] transition-colors">
      <td className="px-4 py-2 text-xs text-[var(--text-secondary)]">
        {formatRelativeTime(trade.timestamp)}
      </td>
      <td className="px-4 py-2 text-center">
        <span
          className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
            isBuy
              ? 'bg-[var(--gain)]/15 text-[var(--gain)]'
              : 'bg-[var(--loss)]/15 text-[var(--loss)]'
          }`}
        >
          {trade.direction}
        </span>
      </td>
      <td className="px-4 py-2 text-right font-mono text-sm text-[var(--text-primary)] tabular-nums">
        {trade.solAmount.toFixed(4)}
      </td>
      <td className="px-4 py-2 text-right font-mono text-sm text-[var(--text-secondary)] tabular-nums">
        {trade.tokenAmount.toLocaleString()}
      </td>
      <td className="px-4 py-2 text-right font-mono text-xs text-[var(--text-secondary)] tabular-nums">
        {trade.price.toFixed(8)}
      </td>
      <td className="px-4 py-2 text-right text-xs text-[var(--text-muted)] tabular-nums">
        {trade.slippage !== undefined ? `${(trade.slippage * 100).toFixed(2)}%` : '—'}
      </td>
      <td className="px-4 py-2 text-center">
        {trade.success ? (
          <CheckCircle2 size={14} className="text-[var(--gain)] inline" />
        ) : (
          <XCircle size={14} className="text-[var(--loss)] inline" />
        )}
      </td>
      <td className="px-4 py-2 text-right">
        <a
          href={solscanTxUrl(trade.signature)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-[var(--brand)] hover:underline font-mono"
        >
          {trade.signature.slice(0, 6)}...
          <ExternalLink size={10} />
        </a>
      </td>
    </tr>
  );
}

/* ─── P&L Card ───────────────────────────────────────────────── */

function PnlCard({
  label,
  value,
  positive,
  large,
}: {
  label: string;
  value: string;
  positive?: boolean;
  large?: boolean;
}) {
  const valueColor =
    positive === undefined
      ? 'text-[var(--text-primary)]'
      : positive
        ? 'text-[var(--gain)]'
        : 'text-[var(--loss)]';

  return (
    <div className={`bg-[var(--surface)] rounded-lg border border-[var(--surface-border)] p-3 ${large ? 'col-span-1' : ''}`}>
      <div className="text-[10px] uppercase tracking-wider font-medium text-[var(--text-muted)] mb-1">{label}</div>
      <div className={`${large ? 'text-lg' : 'text-sm'} font-bold tabular-nums ${valueColor}`}>{value}</div>
    </div>
  );
}

/* ─── Mini P&L Chart (SVG Sparkline) ─────────────────────────── */

function PnlMiniChart({ points }: { points: Array<{ timestamp: number; cumulativePnl: number }> }) {
  const { path, zeroY, viewBox, width, height } = useMemo(() => {
    const w = 800;
    const h = 120;
    const padding = 4;

    if (points.length < 2) return { path: '', zeroY: h / 2, viewBox: `0 0 ${w} ${h}`, width: w, height: h };

    const pnls = points.map((p) => p.cumulativePnl);
    const minPnl = Math.min(...pnls, 0);
    const maxPnl = Math.max(...pnls, 0);
    const range = maxPnl - minPnl || 1;

    const xStep = (w - padding * 2) / (points.length - 1);
    const toY = (val: number) => h - padding - ((val - minPnl) / range) * (h - padding * 2);
    const zY = toY(0);

    const d = points
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${padding + i * xStep},${toY(p.cumulativePnl)}`)
      .join(' ');

    return { path: d, zeroY: zY, viewBox: `0 0 ${w} ${h}`, width: w, height: h };
  }, [points]);

  const lastPnl = points.length > 0 ? points[points.length - 1].cumulativePnl : 0;
  const color = lastPnl >= 0 ? 'var(--gain)' : 'var(--loss)';

  return (
    <svg viewBox={viewBox} className="w-full h-28" preserveAspectRatio="none">
      <line x1={0} y1={zeroY} x2={width} y2={zeroY} stroke="var(--surface-border)" strokeWidth={1} strokeDasharray="4 2" />
      <path d={path} fill="none" stroke={color} strokeWidth={2} />
    </svg>
  );
}
