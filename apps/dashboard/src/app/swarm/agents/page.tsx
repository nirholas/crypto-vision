'use client';

import React, { useState, useMemo } from 'react';
import {
  Bot,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Activity,
  AlertTriangle,
  CheckCircle2,
  PauseCircle,
  StopCircle,
  Clock,
  Loader2,
  XCircle,
} from 'lucide-react';
import { useSwarmAgents, useSwarmAgentDetail } from '@/hooks/useSwarmData';
import {
  AGENT_ROLE_ICONS,
  AGENT_ROLE_LABELS,
  formatSol,
  formatPct,
  formatRelativeTime,
  formatUptime,
  solscanTxUrl,
  solscanAddressUrl,
} from '@/types/swarm';
import type { AgentSummary, AgentRole, AgentStatus, AgentHistoryEntry } from '@/types/swarm';

/* ─── Page ───────────────────────────────────────────────────── */

export default function SwarmAgentsPage() {
  const { agents, isLoading, refetch } = useSwarmAgents();
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [filterRole, setFilterRole] = useState<AgentRole | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<AgentStatus | 'all'>('all');
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setTimeout(() => setRefreshing(false), 500);
  };

  const filteredAgents = useMemo(() => {
    return agents.filter((a) => {
      if (filterRole !== 'all' && a.type !== filterRole) return false;
      if (filterStatus !== 'all' && a.status !== filterStatus) return false;
      return true;
    });
  }, [agents, filterRole, filterStatus]);

  // Aggregate stats
  const activeCount = agents.filter((a) => a.status === 'active').length;
  const errorCount = agents.filter((a) => a.status === 'error').length;
  const totalTrades = agents.reduce((s, a) => s + a.tradeCount, 0);
  const totalPnl = agents.reduce((s, a) => s + a.pnl, 0);

  const uniqueRoles = useMemo(() => [...new Set(agents.map((a) => a.type))], [agents]);

  return (
    <div className="space-y-4">
      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <AgentMetric label="Active" value={`${activeCount}`} color="text-[var(--gain)]" icon={<Activity size={14} />} />
        <AgentMetric label="Errors" value={`${errorCount}`} color={errorCount > 0 ? 'text-[var(--loss)]' : 'text-[var(--text-muted)]'} icon={<AlertTriangle size={14} />} />
        <AgentMetric label="Total Trades" value={`${totalTrades}`} color="text-[var(--text-primary)]" icon={<Bot size={14} />} />
        <AgentMetric
          label="Combined P&L"
          value={formatSol(totalPnl)}
          color={totalPnl >= 0 ? 'text-[var(--gain)]' : 'text-[var(--loss)]'}
          icon={totalPnl >= 0 ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
        />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-[var(--text-muted)]">Role:</span>
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value as AgentRole | 'all')}
            className="bg-[var(--surface)] border border-[var(--surface-border)] rounded-md px-2 py-1 text-xs text-[var(--text-secondary)] outline-none"
          >
            <option value="all">All Roles</option>
            {uniqueRoles.map((role) => (
              <option key={role} value={role}>{AGENT_ROLE_LABELS[role]}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-[var(--text-muted)]">Status:</span>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as AgentStatus | 'all')}
            className="bg-[var(--surface)] border border-[var(--surface-border)] rounded-md px-2 py-1 text-xs text-[var(--text-secondary)] outline-none"
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="idle">Idle</option>
            <option value="paused">Paused</option>
            <option value="error">Error</option>
            <option value="stopped">Stopped</option>
          </select>
        </div>
        <div className="ml-auto">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-[var(--surface-border)] text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-all disabled:opacity-50"
          >
            <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Agent Cards */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={24} className="animate-spin text-[var(--text-muted)]" />
        </div>
      ) : filteredAgents.length === 0 ? (
        <div className="bg-[var(--surface)] rounded-lg border border-[var(--surface-border)] p-8 text-center text-sm text-[var(--text-muted)]">
          {agents.length === 0 ? 'No agents running. Launch a swarm to deploy agents.' : 'No agents match the current filters.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredAgents.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              isSelected={selectedAgent === agent.id}
              onToggle={() => setSelectedAgent(selectedAgent === agent.id ? null : agent.id)}
            />
          ))}
        </div>
      )}

      {/* Agent Detail Panel */}
      {selectedAgent && <AgentDetailPanel agentId={selectedAgent} onClose={() => setSelectedAgent(null)} />}
    </div>
  );
}

/* ─── Agent Card ─────────────────────────────────────────────── */

function AgentCard({
  agent,
  isSelected,
  onToggle,
}: {
  agent: AgentSummary;
  isSelected: boolean;
  onToggle: () => void;
}) {
  const statusConfig = {
    active: { color: 'text-[var(--gain)]', bg: 'bg-[var(--gain)]/10', icon: <Activity size={12} /> },
    idle: { color: 'text-[var(--text-muted)]', bg: 'bg-gray-500/10', icon: <Clock size={12} /> },
    paused: { color: 'text-yellow-400', bg: 'bg-yellow-500/10', icon: <PauseCircle size={12} /> },
    error: { color: 'text-[var(--loss)]', bg: 'bg-[var(--loss)]/10', icon: <AlertTriangle size={12} /> },
    stopped: { color: 'text-gray-400', bg: 'bg-gray-500/10', icon: <StopCircle size={12} /> },
  };

  const sc = statusConfig[agent.status];

  return (
    <div
      className={`bg-[var(--surface)] rounded-lg border transition-all cursor-pointer ${
        isSelected ? 'border-[var(--brand)] shadow-[0_0_12px_rgba(0,212,170,0.1)]' : 'border-[var(--surface-border)] hover:border-[var(--text-muted)]'
      }`}
      onClick={onToggle}
    >
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">{AGENT_ROLE_ICONS[agent.type]}</span>
            <div>
              <div className="text-sm font-semibold text-[var(--text-primary)]">
                {AGENT_ROLE_LABELS[agent.type]}
              </div>
              <div className="text-[10px] font-mono text-[var(--text-muted)]">
                {agent.walletAddress.slice(0, 6)}...{agent.walletAddress.slice(-4)}
              </div>
            </div>
          </div>
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${sc.color} ${sc.bg}`}>
            {sc.icon}
            {agent.status}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <div className="text-[10px] text-[var(--text-muted)] uppercase">SOL</div>
            <div className="text-sm font-mono font-semibold text-[var(--text-primary)] tabular-nums">
              {agent.solBalance.toFixed(3)}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-[var(--text-muted)] uppercase">Trades</div>
            <div className="text-sm font-semibold text-[var(--text-primary)] tabular-nums">
              {agent.tradeCount}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-[var(--text-muted)] uppercase">P&L</div>
            <div className={`text-sm font-mono font-semibold tabular-nums ${agent.pnl >= 0 ? 'text-[var(--gain)]' : 'text-[var(--loss)]'}`}>
              {agent.pnl >= 0 ? '+' : ''}{agent.pnl.toFixed(4)}
            </div>
          </div>
        </div>

        {agent.lastAction && (
          <div className="mt-2 pt-2 border-t border-[var(--surface-border)]">
            <div className="text-[10px] text-[var(--text-muted)] truncate">
              Last: {agent.lastAction}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Agent Detail Panel ─────────────────────────────────────── */

function AgentDetailPanel({ agentId, onClose }: { agentId: string; onClose: () => void }) {
  const { agent, isLoading } = useSwarmAgentDetail(agentId);

  if (isLoading) {
    return (
      <div className="bg-[var(--surface)] rounded-lg border border-[var(--surface-border)] p-8 flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-[var(--text-muted)]" />
      </div>
    );
  }

  if (!agent) {
    return null;
  }

  const { detail, history, performance } = agent;

  return (
    <div className="bg-[var(--surface)] rounded-lg border border-[var(--brand)]/30 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--surface-border)]">
        <div className="flex items-center gap-2">
          <span className="text-xl">{AGENT_ROLE_ICONS[detail.type]}</span>
          <div>
            <div className="text-sm font-semibold text-[var(--text-primary)]">{detail.name}</div>
            <div className="text-[10px] font-mono text-[var(--text-muted)]">{detail.walletAddress}</div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
        >
          <ChevronUp size={16} />
        </button>
      </div>

      {/* Performance Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4">
        <MiniStat label="Win Rate" value={`${(performance.winRate * 100).toFixed(1)}%`} />
        <MiniStat label="Sharpe" value={performance.sharpeRatio.toFixed(2)} />
        <MiniStat label="Max DD" value={formatPct(performance.maxDrawdown)} />
        <MiniStat label="Avg Size" value={formatSol(performance.avgTradeSize)} />
        <MiniStat label="SOL Spent" value={formatSol(detail.solSpent)} />
        <MiniStat label="SOL Received" value={formatSol(detail.solReceived)} />
        <MiniStat label="Total Buys" value={`${detail.totalBuys}`} />
        <MiniStat label="Total Sells" value={`${detail.totalSells}`} />
      </div>

      {/* Activity Log */}
      <div className="border-t border-[var(--surface-border)]">
        <div className="px-4 py-2 border-b border-[var(--surface-border)]">
          <h4 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Recent Activity</h4>
        </div>
        <div className="max-h-64 overflow-y-auto divide-y divide-[var(--surface-border)]">
          {history.slice(0, 20).map((entry) => (
            <div key={entry.id} className="px-4 py-2 flex items-start gap-2">
              <span className={`mt-0.5 ${entry.success ? 'text-[var(--gain)]' : 'text-[var(--loss)]'}`}>
                {entry.success ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-xs text-[var(--text-primary)]">{entry.action}</div>
                <div className="text-[10px] text-[var(--text-muted)] truncate">{entry.details}</div>
              </div>
              <div className="text-[10px] text-[var(--text-muted)] flex-shrink-0">
                {formatRelativeTime(entry.timestamp)}
              </div>
              {entry.signature && (
                <a
                  href={solscanTxUrl(entry.signature)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] text-[var(--brand)] hover:underline flex-shrink-0"
                >
                  tx
                </a>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Helpers ────────────────────────────────────────────────── */

function AgentMetric({ label, value, color, icon }: { label: string; value: string; color: string; icon: React.ReactNode }) {
  return (
    <div className="bg-[var(--surface)] rounded-lg border border-[var(--surface-border)] p-3">
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="text-[var(--text-muted)]">{icon}</span>
        <span className="text-[10px] uppercase tracking-wider font-medium text-[var(--text-muted)]">{label}</span>
      </div>
      <div className={`text-lg font-bold tabular-nums ${color}`}>{value}</div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] text-[var(--text-muted)] uppercase">{label}</div>
      <div className="text-sm font-semibold text-[var(--text-primary)] tabular-nums">{value}</div>
    </div>
  );
}
