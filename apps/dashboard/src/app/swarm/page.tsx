'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import {
  Activity,
  Bot,
  TrendingUp,
  TrendingDown,
  Zap,
  Clock,
  ArrowLeftRight,
  Pause,
  Play,
  OctagonX,
  LogOut,
  Rocket,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  Wallet,
  Shield,
} from 'lucide-react';
import { useSwarmDashboard } from '@/hooks/useSwarmData';
import { useSwarmWebSocket } from '@/hooks/useSwarmWebSocket';
import {
  PHASE_LABELS,
  AGENT_ROLE_ICONS,
  AGENT_ROLE_LABELS,
  formatSol,
  formatPct,
  formatUptime,
  formatRelativeTime,
  solscanTxUrl,
} from '@/types/swarm';
import type { SwarmPhase, AgentSummary, TradeExecutedEvent } from '@/types/swarm';

/* ─── Phase Colors ───────────────────────────────────────────── */

function phaseColor(phase: SwarmPhase): string {
  const map: Partial<Record<SwarmPhase, string>> = {
    idle: 'text-[var(--text-muted)]',
    initializing: 'text-yellow-400',
    funding: 'text-blue-400',
    minting: 'text-purple-400',
    trading: 'text-[var(--gain)]',
    market_making: 'text-[var(--gain)]',
    accumulating: 'text-[var(--brand)]',
    graduating: 'text-amber-400',
    exiting: 'text-orange-400',
    completed: 'text-green-400',
    paused: 'text-yellow-400',
    error: 'text-[var(--loss)]',
    emergency_exit: 'text-[var(--loss)]',
  };
  return map[phase] ?? 'text-[var(--text-secondary)]';
}

function phaseBg(phase: SwarmPhase): string {
  const map: Partial<Record<SwarmPhase, string>> = {
    idle: 'bg-gray-500/10',
    trading: 'bg-[var(--gain)]/10',
    market_making: 'bg-[var(--gain)]/10',
    minting: 'bg-purple-500/10',
    error: 'bg-[var(--loss)]/10',
    emergency_exit: 'bg-[var(--loss)]/10',
    completed: 'bg-green-500/10',
    paused: 'bg-yellow-500/10',
  };
  return map[phase] ?? 'bg-[var(--surface)]';
}

/* ─── Main Page ──────────────────────────────────────────────── */

export default function SwarmOverviewPage() {
  const dashboard = useSwarmDashboard();
  const ws = useSwarmWebSocket();

  const { status, isConnected, agents, pnl, health, actions, isSwarmActive } = dashboard;

  // Latest trades from WS
  const recentTrades = useMemo(() => {
    return ws.events
      .filter((e) => e.type === 'trade:executed')
      .slice(-8)
      .reverse()
      .map((e) => e.data as TradeExecutedEvent);
  }, [ws.events]);

  // If not connected to swarm API, show connect prompt
  if (!isConnected && !dashboard.isLoading) {
    return <SwarmOffline />;
  }

  return (
    <div className="space-y-4">
      {/* Status Bar */}
      <div className="flex flex-wrap items-center gap-3">
        {status && (
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${phaseBg(status.phase)}`}>
            <Activity size={14} className={phaseColor(status.phase)} />
            <span className={`text-sm font-semibold ${phaseColor(status.phase)}`}>
              {PHASE_LABELS[status.phase]}
            </span>
          </div>
        )}
        {status?.tokenMint && (
          <a
            href={`https://pump.fun/${status.tokenMint}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--surface)] border border-[var(--surface-border)] text-xs text-[var(--brand)] hover:text-[var(--text-primary)] transition-colors"
          >
            <Zap size={12} />
            <span className="font-mono">{status.tokenMint.slice(0, 8)}...{status.tokenMint.slice(-4)}</span>
          </a>
        )}
        <div className="ml-auto flex items-center gap-2">
          {isSwarmActive && (
            <>
              <ActionButton
                icon={<Pause size={14} />}
                label="Pause"
                onClick={actions.pause}
                loading={actions.actionLoading === 'pause'}
                variant="warning"
              />
              <ActionButton
                icon={<LogOut size={14} />}
                label="Exit"
                onClick={actions.triggerExit}
                loading={actions.actionLoading === 'exit'}
                variant="default"
              />
              <ActionButton
                icon={<OctagonX size={14} />}
                label="Emergency"
                onClick={actions.emergencyStop}
                loading={actions.actionLoading === 'emergency-stop'}
                variant="danger"
              />
            </>
          )}
          {status?.phase === 'paused' && (
            <ActionButton
              icon={<Play size={14} />}
              label="Resume"
              onClick={actions.resume}
              loading={actions.actionLoading === 'resume'}
              variant="success"
            />
          )}
          {(!status || status.phase === 'idle' || status.phase === 'completed') && (
            <Link
              href="/swarm/launch"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--brand)] text-[var(--bg-primary)] text-xs font-semibold hover:brightness-110 transition-all"
            >
              <Rocket size={14} />
              Launch New Swarm
            </Link>
          )}
        </div>
      </div>

      {/* Error banner */}
      {actions.actionError && (
        <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--loss)]/10 border border-[var(--loss)]/30 text-sm text-[var(--loss)]">
          <AlertTriangle size={14} />
          {actions.actionError}
          <button onClick={actions.clearError} className="ml-auto text-xs hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <MetricCard
          label="P&L"
          value={pnl?.current ? formatSol(pnl.current.totalPnl) : '—'}
          change={pnl?.current ? formatPct(pnl.current.roi) : undefined}
          positive={pnl?.current ? pnl.current.totalPnl >= 0 : undefined}
          icon={<TrendingUp size={14} />}
        />
        <MetricCard
          label="Win Rate"
          value={pnl?.current ? `${pnl.current.winRate.toFixed(0)}%` : '—'}
          sub={pnl?.current ? `${pnl.current.successfulTrades}/${pnl.current.totalTrades} trades` : undefined}
          icon={<CheckCircle2 size={14} />}
        />
        <MetricCard
          label="Volume"
          value={status ? formatSol(status.totalVolumeSol) : '—'}
          sub={`${status?.totalTrades ?? 0} trades`}
          icon={<ArrowLeftRight size={14} />}
        />
        <MetricCard
          label="Agents"
          value={`${status?.activeAgents ?? 0} / ${status?.totalAgents ?? 0}`}
          sub="active"
          icon={<Bot size={14} />}
        />
        <MetricCard
          label="Uptime"
          value={status?.uptime ? formatUptime(status.uptime) : '—'}
          icon={<Clock size={14} />}
        />
        <MetricCard
          label="Max Drawdown"
          value={pnl?.current ? formatPct(pnl.current.maxDrawdown) : '—'}
          positive={false}
          icon={<TrendingDown size={14} />}
        />
      </div>

      {/* Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Agent List */}
        <div className="lg:col-span-2 bg-[var(--surface)] rounded-lg border border-[var(--surface-border)] overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--surface-border)]">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Active Agents</h3>
            <Link
              href="/swarm/agents"
              className="text-xs text-[var(--brand)] hover:underline"
            >
              View all →
            </Link>
          </div>
          <div className="divide-y divide-[var(--surface-border)]">
            {agents.length === 0 ? (
              <div className="p-6 text-center text-sm text-[var(--text-muted)]">
                No agents running. Launch a swarm to get started.
              </div>
            ) : (
              agents.slice(0, 8).map((agent) => (
                <AgentRow key={agent.id} agent={agent} />
              ))
            )}
          </div>
        </div>

        {/* Recent Trades + Health */}
        <div className="space-y-4">
          {/* Recent Trades */}
          <div className="bg-[var(--surface)] rounded-lg border border-[var(--surface-border)] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--surface-border)]">
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">Live Trades</h3>
              <Link
                href="/swarm/trades"
                className="text-xs text-[var(--brand)] hover:underline"
              >
                View all →
              </Link>
            </div>
            <div className="divide-y divide-[var(--surface-border)]">
              {recentTrades.length === 0 ? (
                <div className="p-4 text-center text-xs text-[var(--text-muted)]">
                  No trades yet
                </div>
              ) : (
                recentTrades.map((trade) => (
                  <TradeRow key={trade.id} trade={trade} />
                ))
              )}
            </div>
          </div>

          {/* Health */}
          {health && (
            <div className="bg-[var(--surface)] rounded-lg border border-[var(--surface-border)] overflow-hidden">
              <div className="px-4 py-3 border-b border-[var(--surface-border)]">
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">Health</h3>
              </div>
              <div className="p-3 space-y-2">
                {health.checks.map((check, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span className="text-[var(--text-secondary)]">{check.name}</span>
                    <span
                      className={
                        check.status === 'pass'
                          ? 'text-[var(--gain)]'
                          : check.status === 'warn'
                            ? 'text-yellow-400'
                            : 'text-[var(--loss)]'
                      }
                    >
                      {check.status === 'pass' ? '✓' : check.status === 'warn' ? '⚠' : '✗'} {check.message}
                    </span>
                  </div>
                ))}
                <div className="flex items-center justify-between text-xs pt-1 border-t border-[var(--surface-border)]">
                  <span className="text-[var(--text-muted)]">RPC Latency</span>
                  <span className="font-mono text-[var(--text-secondary)]">{health.metrics.rpcLatency}ms</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Metric Card ────────────────────────────────────────────── */

function MetricCard({
  label,
  value,
  change,
  sub,
  positive,
  icon,
}: {
  label: string;
  value: string;
  change?: string;
  sub?: string;
  positive?: boolean;
  icon: React.ReactNode;
}) {
  return (
    <div className="bg-[var(--surface)] rounded-lg border border-[var(--surface-border)] p-3">
      <div className="flex items-center gap-1.5 mb-2">
        <span className="text-[var(--text-muted)]">{icon}</span>
        <span className="text-[10px] uppercase tracking-wider font-medium text-[var(--text-muted)]">{label}</span>
      </div>
      <div className="text-lg font-bold text-[var(--text-primary)] tabular-nums">{value}</div>
      {change && (
        <span
          className={`text-xs font-medium tabular-nums ${
            positive ? 'text-[var(--gain)]' : positive === false ? 'text-[var(--loss)]' : 'text-[var(--text-muted)]'
          }`}
        >
          {change}
        </span>
      )}
      {sub && !change && (
        <span className="text-xs text-[var(--text-muted)]">{sub}</span>
      )}
    </div>
  );
}

/* ─── Agent Row ──────────────────────────────────────────────── */

function AgentRow({ agent }: { agent: AgentSummary }) {
  const statusColor =
    agent.status === 'active'
      ? 'text-[var(--gain)]'
      : agent.status === 'error'
        ? 'text-[var(--loss)]'
        : agent.status === 'paused'
          ? 'text-yellow-400'
          : 'text-[var(--text-muted)]';

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-[var(--surface-hover)] transition-colors">
      <span className="text-base flex-shrink-0">{AGENT_ROLE_ICONS[agent.type]}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-[var(--text-primary)] truncate">
            {AGENT_ROLE_LABELS[agent.type]}
          </span>
          <span className={`text-[10px] uppercase font-semibold ${statusColor}`}>
            {agent.status}
          </span>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-[var(--text-muted)]">
          <span className="font-mono">{agent.walletAddress.slice(0, 6)}...{agent.walletAddress.slice(-4)}</span>
          <span>{formatSol(agent.solBalance)}</span>
          <span>{agent.tradeCount} trades</span>
        </div>
      </div>
      <div className="text-right flex-shrink-0">
        <div
          className={`text-sm font-semibold tabular-nums ${
            agent.pnl >= 0 ? 'text-[var(--gain)]' : 'text-[var(--loss)]'
          }`}
        >
          {agent.pnl >= 0 ? '+' : ''}{formatSol(agent.pnl)}
        </div>
      </div>
    </div>
  );
}

/* ─── Trade Row ──────────────────────────────────────────────── */

function TradeRow({ trade }: { trade: TradeExecutedEvent }) {
  const isBuy = trade.direction === 'buy';
  return (
    <div className="flex items-center gap-2 px-4 py-2 text-xs">
      <span
        className={`px-1.5 py-0.5 rounded font-semibold uppercase text-[10px] ${
          isBuy
            ? 'bg-[var(--gain)]/15 text-[var(--gain)]'
            : 'bg-[var(--loss)]/15 text-[var(--loss)]'
        }`}
      >
        {trade.direction}
      </span>
      <span className="text-[var(--text-secondary)] tabular-nums font-mono flex-1">
        {trade.solAmount.toFixed(4)} SOL
      </span>
      <a
        href={solscanTxUrl(trade.signature)}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[var(--brand)] hover:underline font-mono"
      >
        {trade.signature.slice(0, 8)}...
      </a>
    </div>
  );
}

/* ─── Action Button ──────────────────────────────────────────── */

function ActionButton({
  icon,
  label,
  onClick,
  loading,
  variant,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  loading: boolean;
  variant: 'default' | 'warning' | 'danger' | 'success';
}) {
  const colors = {
    default: 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]',
    warning: 'text-yellow-400 hover:bg-yellow-500/10',
    danger: 'text-[var(--loss)] hover:bg-[var(--loss)]/10',
    success: 'text-[var(--gain)] hover:bg-[var(--gain)]/10',
  };

  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--surface-border)] text-xs font-medium transition-all ${colors[variant]} disabled:opacity-50`}
    >
      {loading ? <Loader2 size={14} className="animate-spin" /> : icon}
      {label}
    </button>
  );
}

/* ─── Swarm Offline ──────────────────────────────────────────── */

function SwarmOffline() {
  return (
    <div className="flex flex-col items-center justify-center py-20 space-y-6">
      <div className="w-16 h-16 rounded-2xl bg-[var(--surface)] border border-[var(--surface-border)] flex items-center justify-center">
        <Shield size={32} className="text-[var(--text-muted)]" />
      </div>
      <div className="text-center space-y-2">
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">Swarm API Not Connected</h2>
        <p className="text-sm text-[var(--text-muted)] max-w-md">
          The pump-agent-swarm backend is not reachable. Start the swarm service or configure the API URL.
        </p>
      </div>
      <div className="flex gap-3">
        <Link
          href="/swarm/launch"
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--brand)] text-[var(--bg-primary)] text-sm font-semibold hover:brightness-110 transition-all"
        >
          <Rocket size={16} />
          Launch New Swarm
        </Link>
        <Link
          href="/swarm/settings"
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--surface-border)] text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-all"
        >
          Settings
        </Link>
      </div>
    </div>
  );
}
