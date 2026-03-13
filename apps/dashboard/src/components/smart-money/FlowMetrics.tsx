/**
 * Smart Money Flow Metrics — Charts & Summary Statistics
 *
 * - Summary stat cards (tracked wallets, signals, net flow, volume)
 * - Exchange flow bar chart (net by exchange, green/red)
 * - Transaction type pie chart (deposit/withdrawal/transfer)
 * - Smart money consensus tokens table
 */

'use client';

import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import {
  Activity,
  TrendingUp,
  TrendingDown,
  ArrowUpDown,
  Wallet,
  BarChart3,
} from 'lucide-react';
import { tokens, chartColors } from '@/lib/colors';
import { useSmartMoney, useExchangeFlows, useWhaleTransactions } from './hooks';

// ─── Component ──────────────────────────────────────────────

export function FlowMetrics({ className }: { className?: string }) {
  const { data: txData } = useWhaleTransactions(50_000, 100);
  const { data: smartData } = useSmartMoney();
  const { data: flowData } = useExchangeFlows();

  // ─── Summary stats ─────────────────────────────────────────

  const stats = useMemo(() => {
    const txCount = txData?.transactions?.length ?? 0;
    const totalVolume = txData?.transactions?.reduce((s, t) => s + t.amountUsd, 0) ?? 0;
    const signal = txData?.classification?.overallSignal ?? 'neutral';
    const signalStrength = txData?.classification?.signalStrength ?? 0;
    const netFlow = flowData?.summary?.netFlow ?? 0;
    const exchangeCount = flowData?.summary?.exchangeCount ?? 0;

    return { txCount, totalVolume, signal, signalStrength, netFlow, exchangeCount };
  }, [txData, flowData]);

  // ─── Exchange bar chart data ───────────────────────────────

  const exchangeBarData = useMemo(() => {
    if (!flowData?.flows) return [];
    return flowData.flows
      .filter((f) => f.netFlow !== 0)
      .map((f) => ({
        name: f.exchange,
        netFlow: f.netFlow,
        deposits: f.deposits24h,
        withdrawals: -f.withdrawals24h,
      }))
      .sort((a, b) => Math.abs(b.netFlow) - Math.abs(a.netFlow))
      .slice(0, 10);
  }, [flowData]);

  // ─── Pie chart data ────────────────────────────────────────

  const pieData = useMemo(() => {
    if (!txData?.transactions) return [];
    const counts: Record<string, number> = {};
    for (const tx of txData.transactions) {
      const type = tx.transactionType;
      counts[type] = (counts[type] || 0) + 1;
    }
    return [
      { name: 'Deposits', value: counts.exchange_deposit || 0, color: tokens.semantic.loss },
      { name: 'Withdrawals', value: counts.exchange_withdrawal || 0, color: tokens.semantic.gain },
      { name: 'Transfers', value: counts.whale_transfer || 0, color: tokens.brand.primary },
    ].filter((d) => d.value > 0);
  }, [txData]);

  return (
    <div className={className}>
      {/* ─── Stat Cards ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard
          icon={Activity}
          label="Transactions"
          value={stats.txCount.toString()}
          subtitle=">$50K last 24h"
        />
        <StatCard
          icon={BarChart3}
          label="Total Volume"
          value={`$${formatUsd(stats.totalVolume)}`}
          subtitle="Tracked movements"
        />
        <StatCard
          icon={stats.signal === 'bullish' ? TrendingUp : stats.signal === 'bearish' ? TrendingDown : ArrowUpDown}
          label="Whale Signal"
          value={stats.signal.toUpperCase()}
          subtitle={`Strength: ${stats.signalStrength}%`}
          color={
            stats.signal === 'bullish'
              ? 'text-gain'
              : stats.signal === 'bearish'
                ? 'text-loss'
                : 'text-text-muted'
          }
        />
        <StatCard
          icon={Wallet}
          label="Net Exchange Flow"
          value={`$${formatUsd(Math.abs(stats.netFlow))}`}
          subtitle={stats.netFlow > 0 ? 'Net inflow (bearish)' : 'Net outflow (bullish)'}
          color={stats.netFlow > 0 ? 'text-loss' : 'text-gain'}
        />
      </div>

      {/* ─── Charts Grid ────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Exchange Net Flow Bar Chart */}
        <div className="lg:col-span-2 bg-surface rounded-xl border border-surface-border p-4">
          <h3 className="text-sm font-semibold text-text-primary mb-3">
            Exchange Net Flow (24h)
          </h3>
          {exchangeBarData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={exchangeBarData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} opacity={0.3} vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fill: chartColors.axis, fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: chartColors.axis, fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `$${formatUsd(Math.abs(v))}`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: tokens.surface.default,
                    border: `1px solid ${tokens.surface.border}`,
                    borderRadius: 8,
                    fontSize: 11,
                  }}
                  formatter={(val: number) => [`$${formatUsd(Math.abs(val))}`, '']}
                />
                <Bar dataKey="deposits" name="Deposits" stackId="a" fill={tokens.semantic.loss} radius={[2, 2, 0, 0]} />
                <Bar dataKey="withdrawals" name="Withdrawals" stackId="a" fill={tokens.semantic.gain} radius={[2, 2, 0, 0]} />
                <Legend
                  wrapperStyle={{ fontSize: 10, color: tokens.text.muted }}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[280px] text-text-muted text-sm">
              No exchange flow data available
            </div>
          )}
        </div>

        {/* Transaction Type Pie Chart */}
        <div className="bg-surface rounded-xl border border-surface-border p-4">
          <h3 className="text-sm font-semibold text-text-primary mb-3">
            Transaction Types
          </h3>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={90}
                  paddingAngle={3}
                  dataKey="value"
                  stroke="none"
                >
                  {pieData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: tokens.surface.default,
                    border: `1px solid ${tokens.surface.border}`,
                    borderRadius: 8,
                    fontSize: 11,
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: 10 }}
                  formatter={(value) => <span style={{ color: tokens.text.secondary }}>{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[280px] text-text-muted text-sm">
              No data
            </div>
          )}
        </div>
      </div>

      {/* ─── Smart Money Consensus ────────────────────────── */}
      {smartData && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          {/* Consensus Buys */}
          <div className="bg-surface rounded-xl border border-surface-border p-4">
            <h3 className="text-sm font-semibold text-gain mb-3 flex items-center gap-2">
              <TrendingUp size={14} />
              Consensus Buys
            </h3>
            {smartData.consensusBuys.length > 0 ? (
              <div className="space-y-2">
                {smartData.consensusBuys.slice(0, 8).map((item) => (
                  <div key={item.token} className="flex items-center justify-between py-1.5 border-b border-surface-border/50 last:border-0">
                    <div>
                      <span className="text-sm font-semibold text-text-primary">{item.token}</span>
                      <span className="text-xs text-text-muted ml-2">{item.count} wallets</span>
                    </div>
                    <span className="text-sm font-mono text-gain">${formatUsd(item.totalUsd)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-text-muted">No consensus buys detected</p>
            )}
          </div>

          {/* Consensus Sells */}
          <div className="bg-surface rounded-xl border border-surface-border p-4">
            <h3 className="text-sm font-semibold text-loss mb-3 flex items-center gap-2">
              <TrendingDown size={14} />
              Consensus Sells
            </h3>
            {smartData.consensusSells.length > 0 ? (
              <div className="space-y-2">
                {smartData.consensusSells.slice(0, 8).map((item) => (
                  <div key={item.token} className="flex items-center justify-between py-1.5 border-b border-surface-border/50 last:border-0">
                    <div>
                      <span className="text-sm font-semibold text-text-primary">{item.token}</span>
                      <span className="text-xs text-text-muted ml-2">{item.count} wallets</span>
                    </div>
                    <span className="text-sm font-mono text-loss">${formatUsd(item.totalUsd)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-text-muted">No consensus sells detected</p>
            )}
          </div>
        </div>
      )}

      {/* ─── Top Performing Wallets ───────────────────────── */}
      {smartData?.topPerformingWallets && smartData.topPerformingWallets.length > 0 && (
        <div className="bg-surface rounded-xl border border-surface-border p-4 mt-4">
          <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
            <Wallet size={14} />
            Top Performing Smart Money
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-text-muted border-b border-surface-border">
                  <th className="text-left py-2 font-medium">Wallet</th>
                  <th className="text-left py-2 font-medium">Label</th>
                  <th className="text-right py-2 font-medium">Trades</th>
                  <th className="text-right py-2 font-medium">Est. PnL</th>
                </tr>
              </thead>
              <tbody>
                {smartData.topPerformingWallets.slice(0, 10).map((w) => (
                  <tr key={w.wallet} className="border-b border-surface-border/30 hover:bg-surface-hover transition-colors">
                    <td className="py-2 font-mono text-text-secondary">
                      {w.wallet.slice(0, 6)}…{w.wallet.slice(-4)}
                    </td>
                    <td className="py-2 text-text-primary">{w.label}</td>
                    <td className="py-2 text-right font-mono text-text-secondary">{w.trades}</td>
                    <td className={`py-2 text-right font-mono font-semibold ${w.estimatedPnl >= 0 ? 'text-gain' : 'text-loss'}`}>
                      {w.estimatedPnl >= 0 ? '+' : ''}${formatUsd(Math.abs(w.estimatedPnl))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
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
    <div className="bg-surface rounded-xl border border-surface-border p-4 hover:border-primary/30 transition-colors">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${color}`} />
        <span className="text-xs text-text-muted uppercase tracking-wider">{label}</span>
      </div>
      <p className={`text-xl font-bold font-mono ${color}`}>{value}</p>
      {subtitle && <p className="text-xs text-text-muted mt-1">{subtitle}</p>}
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
