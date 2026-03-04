/**
 * AgentStatusPanel — Grid of agent cards with live status, balances, and stats
 */

'use client';

import React, { useState } from 'react';
import type { AgentSummary, AgentDetailResponse } from '@/types/swarm';
import {
  AGENT_ROLE_ICONS,
  AGENT_ROLE_LABELS,
  formatSol,
  formatRelativeTime,
} from '@/types/swarm';
import { swarmApi } from '@/lib/swarm-api';

// ─── Props ────────────────────────────────────────────────────

interface AgentStatusPanelProps {
  agents: AgentSummary[];
  loading?: boolean;
}

// ─── Component ────────────────────────────────────────────────

export function AgentStatusPanel({ agents, loading }: AgentStatusPanelProps) {
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);
  const [agentDetail, setAgentDetail] = useState<AgentDetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const handleAgentClick = async (agentId: string) => {
    if (expandedAgent === agentId) {
      setExpandedAgent(null);
      setAgentDetail(null);
      return;
    }

    setExpandedAgent(agentId);
    setDetailLoading(true);
    try {
      const detail = await swarmApi.getAgentDetail(agentId);
      setAgentDetail(detail);
    } catch {
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
        <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Agents</h3>
        <span className="text-xs text-gray-500 tabular-nums">
          {agents.filter((a) => a.status === 'active').length}/{agents.length} active
        </span>
      </div>

      {/* Agent Grid */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5 scrollbar-thin scrollbar-track-gray-900 scrollbar-thumb-gray-700">
        {agents.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500 text-sm">
            No agents running
          </div>
        ) : (
          agents.map((agent) => (
            <div key={agent.id}>
              {/* Agent Card */}
              <button
                onClick={() => handleAgentClick(agent.id)}
                className={`w-full text-left p-3 rounded-lg border transition-all ${
                  expandedAgent === agent.id
                    ? 'bg-gray-800/80 border-indigo-600/50'
                    : 'bg-gray-800/40 border-gray-800 hover:bg-gray-800/60 hover:border-gray-700'
                }`}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-sm">{AGENT_ROLE_ICONS[agent.type] ?? '🤖'}</span>
                  <span className="text-xs font-semibold text-gray-200 truncate">
                    {AGENT_ROLE_LABELS[agent.type] ?? agent.type}
                  </span>
                  <StatusDot status={agent.status} />
                  <span className="text-[10px] text-gray-500 font-mono ml-auto">
                    {agent.id.slice(0, 6)}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-[10px]">
                  <div>
                    <span className="text-gray-500">SOL</span>
                    <p className="text-gray-300 font-mono tabular-nums">{agent.solBalance.toFixed(2)}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Tokens</span>
                    <p className="text-gray-300 font-mono tabular-nums">
                      {new Intl.NumberFormat('en-US', { notation: 'compact' }).format(agent.tokenBalance)}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-500">Trades</span>
                    <p className="text-gray-300 font-mono tabular-nums">{agent.tradeCount}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-1.5">
                  <span
                    className={`text-[10px] font-bold tabular-nums ${
                      agent.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'
                    }`}
                  >
                    PnL: {agent.pnl >= 0 ? '+' : ''}
                    {agent.pnl.toFixed(4)} SOL
                  </span>
                  {agent.lastAction && (
                    <span className="text-[10px] text-gray-500">
                      {formatRelativeTime(new Date(agent.lastAction).getTime())}
                    </span>
                  )}
                </div>
              </button>

              {/* Expanded Detail */}
              {expandedAgent === agent.id && (
                <div className="mt-1 p-3 bg-gray-800/60 rounded-lg border border-gray-700/50 text-xs">
                  {detailLoading ? (
                    <div className="flex items-center gap-2 text-gray-400">
                      <span className="w-3 h-3 border-2 border-gray-500 border-t-indigo-400 rounded-full animate-spin" />
                      Loading...
                    </div>
                  ) : agentDetail ? (
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-gray-500">Total Buys</span>
                          <p className="text-gray-200 font-mono">{agentDetail.detail.totalBuys}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Total Sells</span>
                          <p className="text-gray-200 font-mono">{agentDetail.detail.totalSells}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">SOL Spent</span>
                          <p className="text-gray-200 font-mono">{formatSol(agentDetail.detail.solSpent)}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">SOL Received</span>
                          <p className="text-gray-200 font-mono">{formatSol(agentDetail.detail.solReceived)}</p>
                        </div>
                      </div>
                      {agentDetail.performance && (
                        <div className="grid grid-cols-3 gap-2 pt-1 border-t border-gray-700">
                          <div>
                            <span className="text-gray-500">Win Rate</span>
                            <p className="text-gray-200 font-mono">
                              {(agentDetail.performance.winRate * 100).toFixed(1)}%
                            </p>
                          </div>
                          <div>
                            <span className="text-gray-500">Avg Size</span>
                            <p className="text-gray-200 font-mono">
                              {agentDetail.performance.avgTradeSize.toFixed(3)}
                            </p>
                          </div>
                          <div>
                            <span className="text-gray-500">Max DD</span>
                            <p className="text-red-400 font-mono">
                              {agentDetail.performance.maxDrawdown.toFixed(4)}
                            </p>
                          </div>
                        </div>
                      )}
                      {/* Recent history */}
                      {agentDetail.history.length > 0 && (
                        <div className="pt-1 border-t border-gray-700">
                          <p className="text-gray-500 mb-1">Recent Activity</p>
                          <div className="space-y-0.5 max-h-24 overflow-y-auto">
                            {agentDetail.history.slice(0, 5).map((entry) => (
                              <div key={entry.id} className="flex items-center gap-2 text-[10px]">
                                <span className={entry.success ? 'text-emerald-400' : 'text-red-400'}>
                                  {entry.success ? '✓' : '✕'}
                                </span>
                                <span className="text-gray-400 truncate">{entry.action}: {entry.details}</span>
                                <span className="text-gray-500 ml-auto whitespace-nowrap">
                                  {formatRelativeTime(entry.timestamp)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-gray-400">Failed to load detail</p>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ─── Status Dot ───────────────────────────────────────────────

function StatusDot({ status }: { status: string }) {
  const colorClass =
    status === 'active'
      ? 'bg-emerald-500'
      : status === 'idle'
        ? 'bg-amber-500'
        : status === 'paused'
          ? 'bg-gray-500'
          : status === 'error'
            ? 'bg-red-500'
            : 'bg-gray-600';

  return (
    <span className="relative flex h-2 w-2">
      {status === 'active' && (
        <span className={`absolute inline-flex h-full w-full rounded-full ${colorClass} opacity-50 animate-ping`} />
      )}
      <span className={`relative inline-flex rounded-full h-2 w-2 ${colorClass}`} />
    </span>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────

function AgentStatusSkeleton() {
  return (
    <div className="flex flex-col h-full bg-gray-900 rounded-lg border border-gray-800 overflow-hidden animate-pulse">
      <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
        <div className="h-4 w-16 bg-gray-700 rounded" />
        <div className="h-3 w-12 bg-gray-700 rounded" />
      </div>
      <div className="flex-1 p-2 space-y-1.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-20 bg-gray-800/40 rounded-lg" />
        ))}
      </div>
    </div>
  );
}
