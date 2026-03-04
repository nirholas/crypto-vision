'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import type { TradeEntry, AgentSummary, TradeDirection } from '@/types/swarm';
import { formatSol, formatRelativeTime, solscanTxUrl } from '@/types/swarm';

// ─── Props ────────────────────────────────────────────────────

interface RecentTradesPanelProps {
  trades: TradeEntry[];
  agents?: AgentSummary[];
  ownAgentIds?: Set<string>;
  network?: 'mainnet-beta' | 'devnet';
  loading?: boolean;
}

// ─── Component ────────────────────────────────────────────────

export function RecentTradesPanel({
  trades,
  agents,
  ownAgentIds,
  network = 'mainnet-beta',
  loading,
}: RecentTradesPanelProps) {
  const [filterAgent, setFilterAgent] = useState<string>('');
  const [filterDirection, setFilterDirection] = useState<TradeDirection | ''>('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef(true);

  // Agent name lookup
  const agentNameMap = useMemo(() => {
    const map = new Map<string, string>();
    if (agents) {
      for (const agent of agents) {
        map.set(agent.id, `${agent.type} (${agent.id.slice(0, 6)})`);
      }
    }
    return map;
  }, [agents]);

  // Filter trades
  const filteredTrades = useMemo(() => {
    return trades.filter((t) => {
      if (filterAgent && t.agentId !== filterAgent) return false;
      if (filterDirection && t.direction !== filterDirection) return false;
      return true;
    });
  }, [trades, filterAgent, filterDirection]);

  // Auto-scroll to top on new trade
  useEffect(() => {
    if (autoScrollRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [trades.length]);

  const handleScroll = () => {
    if (scrollRef.current) {
      autoScrollRef.current = scrollRef.current.scrollTop < 10;
    }
  };

  if (loading) {
    return <RecentTradesSkeleton />;
  }

  const uniqueAgents = [...new Set(trades.map((t) => t.agentId))];

  return (
    <div className="flex flex-col h-full bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
      {/* Header + Filters */}
      <div className="px-4 py-3 border-b border-gray-800 space-y-2">
        <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Recent Trades</h3>
        <div className="flex gap-2">
          <select
            value={filterAgent}
            onChange={(e) => setFilterAgent(e.target.value)}
            className="text-xs bg-gray-800 border border-gray-700 rounded px-2 py-1 text-gray-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">All Agents</option>
            {uniqueAgents.map((id) => (
              <option key={id} value={id}>
                {agentNameMap.get(id) ?? id.slice(0, 8)}
              </option>
            ))}
          </select>
          <select
            value={filterDirection}
            onChange={(e) => setFilterDirection(e.target.value as TradeDirection | '')}
            className="text-xs bg-gray-800 border border-gray-700 rounded px-2 py-1 text-gray-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">All</option>
            <option value="buy">Buy</option>
            <option value="sell">Sell</option>
          </select>
          <span className="text-xs text-gray-500 ml-auto self-center tabular-nums">
            {filteredTrades.length} trades
          </span>
        </div>
      </div>

      {/* Trade List */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto scrollbar-thin scrollbar-track-gray-900 scrollbar-thumb-gray-700"
      >
        {filteredTrades.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500 text-sm">
            No trades yet
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-gray-900/95 backdrop-blur-sm border-b border-gray-800">
              <tr className="text-gray-500 uppercase">
                <th className="py-2 px-3 text-left font-medium">Time</th>
                <th className="py-2 px-3 text-left font-medium">Agent</th>
                <th className="py-2 px-3 text-center font-medium">Side</th>
                <th className="py-2 px-3 text-right font-medium">Amount</th>
                <th className="py-2 px-3 text-right font-medium">Price</th>
                <th className="py-2 px-3 text-right font-medium">Tx</th>
              </tr>
            </thead>
            <tbody>
              {filteredTrades.map((trade) => {
                const isOwn = ownAgentIds?.has(trade.agentId) ?? true;
                return (
                  <tr
                    key={trade.id}
                    className={`border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors ${
                      !isOwn ? 'opacity-60' : ''
                    }`}
                  >
                    <td className="py-2 px-3 text-gray-400 tabular-nums whitespace-nowrap">
                      {formatRelativeTime(trade.timestamp)}
                    </td>
                    <td className="py-2 px-3 text-gray-300 truncate max-w-[100px]">
                      {agentNameMap.get(trade.agentId) ?? trade.agentId.slice(0, 8)}
                      {!isOwn && (
                        <span className="ml-1 text-[10px] text-amber-500 font-medium">EXT</span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <span
                        className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                          trade.direction === 'buy'
                            ? 'bg-emerald-900/40 text-emerald-400'
                            : 'bg-red-900/40 text-red-400'
                        }`}
                      >
                        {trade.direction}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right text-gray-200 font-mono tabular-nums">
                      {formatSol(trade.solAmount)}
                    </td>
                    <td className="py-2 px-3 text-right text-gray-200 font-mono tabular-nums">
                      {trade.price.toFixed(8)}
                    </td>
                    <td className="py-2 px-3 text-right">
                      <a
                        href={solscanTxUrl(trade.signature, network)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-indigo-400 hover:text-indigo-300 transition-colors"
                        title={trade.signature}
                      >
                        {trade.signature.slice(0, 4)}...
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────

function RecentTradesSkeleton() {
  return (
    <div className="flex flex-col h-full bg-gray-900 rounded-lg border border-gray-800 overflow-hidden animate-pulse">
      <div className="px-4 py-3 border-b border-gray-800 space-y-2">
        <div className="h-4 w-28 bg-gray-700 rounded" />
        <div className="flex gap-2">
          <div className="h-6 w-24 bg-gray-700 rounded" />
          <div className="h-6 w-16 bg-gray-700 rounded" />
        </div>
      </div>
      <div className="flex-1 p-3 space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-8 bg-gray-800 rounded" />
        ))}
      </div>
    </div>
  );
}
