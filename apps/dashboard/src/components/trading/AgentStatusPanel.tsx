'use client';

import React, { useState } from 'react';
import type { AgentSummary, AgentDetailResponse } from '@/types/swarm';
import {
  AGENT_ROLE_ICONS,
  AGENT_ROLE_LABELS,
  formatSol,
  formatRelativeTime,
  solscanTxUrl,
} from '@/types/swarm';
import { swarmApi } from '@/lib/swarm-api';

// ─── Props ────────────────────────────────────────────────────

interface AgentStatusPanelProps {
  agents: AgentSummary[];
  network?: 'mainnet-beta' | 'devnet';
  loading?: boolean;
}

// ─── Component ────────────────────────────────────────────────

export function AgentStatusPanel({ agents, network = 'mainnet-beta', loading }: AgentStatusPanelProps) {
  const [expandedAgentId, setExpandedAgentId] = useState<string | null>(null);
  const [agentDetail, setAgentDetail] = useState<AgentDetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const handleExpand = async (agentId: string) => {
    if (expandedAgentId === agentId) {
      setExpandedAgentId(null);
      setAgentDetail(null);
      return;
    }

    setExpandedAgentId(agentId);
    setDetailLoading(true);
    try {
      const detail = await swarmApi.getAgentDetail(agentId);
      setAgentDetail(detail);
    } catch (err) {
      console.error('Failed to load agent detail:', err);
      setAgentDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  if (loading) {
    return <AgentStatusSkeleton />;
  }

  return (
    <div className="flex flex-col h-full bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Agent Status</h3>
        <span className="text-xs text-gray-500 tabular-nums">
          {agents.filter((a) => a.status === 'active').length}/{agents.length} active
        </span>
      </div>

      {/* Agent Grid */}
      <div className="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-track-gray-900 scrollbar-thumb-gray-700">
        {agents.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500 text-sm">
            No agents running
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2">
            {agents.map((agent) => (
              <div key={agent.id}>
                <button
                  onClick={() => handleExpand(agent.id)}
                  className="w-full text-left p-3 bg-gray-800/40 hover:bg-gray-800/70 rounded-lg border border-gray-700/50 transition-all"
                >
                  <div className="flex items-center gap-3">
                    {/* Icon + Name */}
                    <span className="text-lg" role="img" aria-label={agent.type}>
                      {AGENT_ROLE_ICONS[agent.type] ?? '🤖'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-200 truncate">
                          {AGENT_ROLE_LABELS[agent.type] ?? agent.type}
                        </span>
                        <StatusDot status={agent.status} />
                      </div>
                      <span className="text-[10px] text-gray-500 font-mono">{agent.id.slice(0, 12)}</span>
                    </div>

                    {/* Quick Stats */}
                    <div className="flex flex-col items-end gap-0.5 text-xs">
                      <span className="text-gray-300 font-mono tabular-nums">{formatSol(agent.solBalance)}</span>
                      <span className={`font-mono tabular-nums ${agent.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {agent.pnl >= 0 ? '+' : ''}{formatSol(agent.pnl)}
                      </span>
                    </div>

                    {/* Trade Count + Win Rate */}
                    <div className="flex flex-col items-end gap-0.5 text-xs text-gray-400 w-16">
                      <span className="tabular-nums">{agent.tradeCount} trades</span>
                      {agent.lastAction && (
                        <span className="text-[10px] text-gray-500">{formatRelativeTime(new Date(agent.lastAction).getTime())}</span>
                      )}
                    </div>

                    {/* Expand chevron */}
                    <svg
                      className={`w-4 h-4 text-gray-500 transition-transform ${expandedAgentId === agent.id ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>

                {/* Expanded Detail */}
                {expandedAgentId === agent.id && (
                  <div className="mt-1 p-3 bg-gray-800/20 rounded-lg border border-gray-700/30">
                    {detailLoading ? (
                      <div className="flex items-center justify-center py-4">
                        <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                      </div>
                    ) : agentDetail ? (
                      <div className="space-y-3">
                        {/* Performance */}
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <StatBox label="Win Rate" value={`${(agentDetail.performance.winRate * 100).toFixed(1)}%`} />
                          <StatBox label="Success Rate" value={`${(agentDetail.performance.successRate * 100).toFixed(1)}%`} />
                          <StatBox label="Avg Trade" value={formatSol(agentDetail.performance.avgTradeSize)} />
                          <StatBox label="Total PnL" value={formatSol(agentDetail.performance.totalPnl)} positive={agentDetail.performance.totalPnl >= 0} />
                          <StatBox label="Max Drawdown" value={formatSol(agentDetail.performance.maxDrawdown)} />
                          <StatBox label="Sharpe" value={agentDetail.performance.sharpeRatio.toFixed(2)} />
                        </div>

                        {/* Recent History */}
                        {agentDetail.history.length > 0 && (
                          <div>
                            <h4 className="text-[10px] text-gray-500 uppercase mb-1">Recent Actions</h4>
                            <div className="space-y-1 max-h-32 overflow-y-auto">
                              {agentDetail.history.slice(0, 5).map((entry) => (
                                <div key={entry.id} className="flex items-center gap-2 text-[11px]">
                                  <span className={`w-1.5 h-1.5 rounded-full ${entry.success ? 'bg-emerald-500' : 'bg-red-500'}`} />
                                  <span className="text-gray-400">{formatRelativeTime(entry.timestamp)}</span>
                                  <span className="text-gray-300 truncate flex-1">{entry.details}</span>
                                  {entry.signature && (
                                    <a
                                      href={solscanTxUrl(entry.signature, network)}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-indigo-400 hover:text-indigo-300 shrink-0"
                                    >
                                      tx
                                    </a>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-500 text-center py-2">Failed to load agent details</p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Status Dot ───────────────────────────────────────────────

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: 'bg-emerald-500',
    idle: 'bg-amber-500',
    paused: 'bg-blue-500',
    error: 'bg-red-500',
    stopped: 'bg-gray-500',
  };

  return (
    <span className="relative flex h-2 w-2">
      {status === 'active' && (
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
      )}
      <span className={`relative inline-flex rounded-full h-2 w-2 ${colors[status] ?? 'bg-gray-500'}`} />
    </span>
  );
}

// ─── Stat Box ─────────────────────────────────────────────────

function StatBox({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
  let colorClass = 'text-gray-200';
  if (positive === true) colorClass = 'text-emerald-400';
  if (positive === false) colorClass = 'text-red-400';

  return (
    <div className="p-2 bg-gray-800/50 rounded">
      <span className="text-gray-500 text-[10px]">{label}</span>
      <p className={`font-mono tabular-nums ${colorClass}`}>{value}</p>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────

function AgentStatusSkeleton() {
  return (
    <div className="flex flex-col h-full bg-gray-900 rounded-lg border border-gray-800 overflow-hidden animate-pulse">
      <div className="px-4 py-3 border-b border-gray-800">
        <div className="h-4 w-24 bg-gray-700 rounded" />
      </div>
      <div className="flex-1 p-2 space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-16 bg-gray-800 rounded-lg" />
        ))}
      </div>
    </div>
  );
}
