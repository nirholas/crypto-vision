'use client';

import React, { useMemo } from 'react';
import type { PnLResponse, AgentSummary } from '@/types/swarm';
import { formatSol, formatPct } from '@/types/swarm';

// ─── Props ────────────────────────────────────────────────────

interface PnLSummaryPanelProps {
  pnlData: PnLResponse | null;
  agents?: AgentSummary[];
  loading?: boolean;
}

// ─── Component ────────────────────────────────────────────────

export function PnLSummaryPanel({ pnlData, agents, loading }: PnLSummaryPanelProps) {
  const snapshot = pnlData?.current ?? null;

  // Mini PnL chart path
  const miniChartPath = useMemo(() => {
    const points = pnlData?.timeSeries?.points;
    if (!points || points.length < 2) return '';
    const width = 200;
    const height = 60;
    const pnls = points.map((p) => p.cumulativePnl);
    const min = Math.min(...pnls);
    const max = Math.max(...pnls);
    const range = max - min || 1;

    const pathPoints = points.map((p, i) => {
      const x = (i / (points.length - 1)) * width;
      const y = height - ((p.cumulativePnl - min) / range) * height;
      return `${x},${y}`;
    });
    return `M${pathPoints.join(' L')}`;
  }, [pnlData]);

  // Per-agent PnL breakdown
  const agentPnlBreakdown = useMemo(() => {
    if (!agents) return [];
    const sorted = [...agents].sort((a, b) => b.pnl - a.pnl);
    const maxAbs = Math.max(...sorted.map((a) => Math.abs(a.pnl)), 0.001);
    return sorted.map((a) => ({
      id: a.id,
      type: a.type,
      pnl: a.pnl,
      pct: (a.pnl / maxAbs) * 100,
    }));
  }, [agents]);

  if (loading) {
    return <PnLSummarySkeleton />;
  }

  const isPositive = (snapshot?.totalPnl ?? 0) >= 0;

  return (
    <div className="flex flex-col h-full bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-800">
        <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">PnL Summary</h3>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* Total PnL */}
        <div className="text-center">
          <span className="text-xs text-gray-500 uppercase">Total PnL</span>
          <p
            className={`text-3xl font-bold font-mono tabular-nums ${
              isPositive ? 'text-emerald-400' : 'text-red-400'
            }`}
          >
            {snapshot ? `${isPositive ? '+' : ''}${formatSol(snapshot.totalPnl)}` : '—'}
          </p>
          {snapshot && (
            <span
              className={`text-sm font-medium ${isPositive ? 'text-emerald-500' : 'text-red-500'}`}
            >
              ROI: {formatPct(snapshot.roi)}
            </span>
          )}
        </div>

        {/* Mini Chart */}
        {miniChartPath && (
          <div className="flex justify-center">
            <svg viewBox="0 0 200 60" className="w-full h-16" preserveAspectRatio="none">
              <path
                d={`${miniChartPath} L200,60 L0,60 Z`}
                fill={isPositive ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)'}
              />
              <path
                d={miniChartPath}
                fill="none"
                stroke={isPositive ? '#10b981' : '#ef4444'}
                strokeWidth={1.5}
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          </div>
        )}

        {/* Stats Grid */}
        {snapshot && (
          <div className="grid grid-cols-2 gap-2 text-xs">
            <MetricBox label="Max Drawdown" value={formatSol(snapshot.maxDrawdown)} negative />
            <MetricBox label="Win Rate" value={`${(snapshot.winRate * 100).toFixed(1)}%`} />
            <MetricBox label="SOL Spent" value={formatSol(snapshot.solSpent)} />
            <MetricBox label="SOL Received" value={formatSol(snapshot.solReceived)} />
            <MetricBox label="Best Trade" value={formatSol(snapshot.bestTrade)} positive />
            <MetricBox label="Worst Trade" value={formatSol(snapshot.worstTrade)} negative />
            <MetricBox label="Total Trades" value={`${snapshot.totalTrades}`} />
            <MetricBox
              label="Success"
              value={`${snapshot.successfulTrades}/${snapshot.totalTrades}`}
            />
          </div>
        )}

        {/* Per-Agent Breakdown */}
        {agentPnlBreakdown.length > 0 && (
          <div>
            <h4 className="text-[10px] text-gray-500 uppercase mb-2">Per-Agent PnL</h4>
            <div className="space-y-1.5">
              {agentPnlBreakdown.slice(0, 8).map((agent) => (
                <div key={agent.id} className="flex items-center gap-2 text-xs">
                  <span className="text-gray-400 w-20 truncate text-[11px]">{agent.type}</span>
                  <div className="flex-1 h-3 bg-gray-800 rounded-full overflow-hidden relative">
                    {agent.pnl >= 0 ? (
                      <div
                        className="absolute left-1/2 h-full bg-emerald-500/60 rounded-full"
                        style={{ width: `${Math.abs(agent.pct) / 2}%` }}
                      />
                    ) : (
                      <div
                        className="absolute right-1/2 h-full bg-red-500/60 rounded-full"
                        style={{ width: `${Math.abs(agent.pct) / 2}%` }}
                      />
                    )}
                    <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gray-600" />
                  </div>
                  <span
                    className={`font-mono tabular-nums w-20 text-right text-[11px] ${
                      agent.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'
                    }`}
                  >
                    {agent.pnl >= 0 ? '+' : ''}{formatSol(agent.pnl)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Metric Box ───────────────────────────────────────────────

function MetricBox({
  label,
  value,
  positive,
  negative,
}: {
  label: string;
  value: string;
  positive?: boolean;
  negative?: boolean;
}) {
  let color = 'text-gray-200';
  if (positive) color = 'text-emerald-400';
  if (negative) color = 'text-red-400';

  return (
    <div className="p-2 bg-gray-800/40 rounded">
      <span className="text-[10px] text-gray-500 block">{label}</span>
      <span className={`text-sm font-mono tabular-nums ${color}`}>{value}</span>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────

function PnLSummarySkeleton() {
  return (
    <div className="flex flex-col h-full bg-gray-900 rounded-lg border border-gray-800 overflow-hidden animate-pulse">
      <div className="px-4 py-3 border-b border-gray-800">
        <div className="h-4 w-24 bg-gray-700 rounded" />
      </div>
      <div className="flex-1 p-3 space-y-4">
        <div className="text-center space-y-2">
          <div className="h-3 w-16 bg-gray-700 rounded mx-auto" />
          <div className="h-10 w-36 bg-gray-700 rounded mx-auto" />
        </div>
        <div className="h-16 bg-gray-800 rounded" />
        <div className="grid grid-cols-2 gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-12 bg-gray-800 rounded" />
          ))}
        </div>
      </div>
    </div>
  );
}
