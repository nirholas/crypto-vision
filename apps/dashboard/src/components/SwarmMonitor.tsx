'use client';

import React, { useEffect, useState } from 'react';
import { useSwarmMonitor } from '@/hooks/useSwarmMonitor';

interface SwarmMetrics {
  budget: number;
  spent: number;
  pnl: number;
  roi: number;
  trades: number;
  agents: number;
  phase: string;
  elapsed: string;
}

interface SwarmEvent {
  id: string;
  timestamp: number;
  type: string;
  narration: string;
  metrics?: SwarmMetrics;
}

export function SwarmMonitor() {
  const { isConnected, isRunning, currentNarration, metrics, events } = useSwarmMonitor();
  const [displayEvents, setDisplayEvents] = useState<SwarmEvent[]>([]);

  useEffect(() => {
    if (events.length > 0) {
      setDisplayEvents(events.slice(-8)); // Show last 8 events
    }
  }, [events]);

  const progressPercent = metrics ? (metrics.trades / Math.max(metrics.trades + 1, 10)) * 100 : 0;
  const pnlPositive = metrics && metrics.pnl >= 0;

  return (
    <div className="w-full max-w-4xl mx-auto p-4">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">🤖 AI Swarm Monitor</h1>
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'} animate-pulse`}></div>
          <span className={`text-sm font-medium ${isConnected ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            {isConnected ? 'Live' : 'Offline'} {isRunning ? '• Running' : '• Idle'}
          </span>
        </div>
      </div>

      {/* Main Narration Box */}
      {currentNarration && (
        <div className="mb-8 p-6 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 rounded-lg border border-blue-200 dark:border-blue-800 shadow-lg">
          <div className="flex gap-3 items-start">
            <div className="text-2xl">🎙️</div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-2">AI Narration</p>
              <p className="text-lg leading-relaxed text-gray-800 dark:text-gray-100">
                {currentNarration}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Metrics Grid */}
      {metrics && (
        <div className="mb-8 grid grid-cols-2 md:grid-cols-3 gap-4">
          {/* Budget */}
          <div className="p-4 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">Budget</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {metrics.budget.toFixed(1)} <span className="text-sm text-gray-500">SOL</span>
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Spent: {metrics.spent.toFixed(2)} SOL
            </p>
          </div>

          {/* P&L */}
          <div className={`p-4 rounded-lg border shadow-sm ${
            pnlPositive
              ? 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800'
              : 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800'
          }`}>
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">P&L</p>
            <p className={`text-2xl font-bold ${
              pnlPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
            }`}>
              {pnlPositive ? '+' : ''}{metrics.pnl.toFixed(2)} SOL
            </p>
            <p className={`text-xs mt-1 ${
              pnlPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
            }`}>
              ROI: {pnlPositive ? '+' : ''}{metrics.roi.toFixed(1)}%
            </p>
          </div>

          {/* Trades */}
          <div className="p-4 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">Trades</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{metrics.trades}</p>
            <p className="text-xs text-gray-500 mt-1">
              {metrics.agents} agents
            </p>
          </div>

          {/* Phase */}
          <div className="p-4 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">Phase</p>
            <p className="text-lg font-bold text-indigo-600 dark:text-indigo-400">{metrics.phase}</p>
          </div>

          {/* Elapsed */}
          <div className="p-4 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">Elapsed</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{metrics.elapsed}</p>
          </div>

          {/* Status */}
          <div className="p-4 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">Status</p>
            <p className={`text-sm font-bold ${
              isRunning ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-400'
            }`}>
              {isRunning ? '🟢 Running' : '⚪ Stopped'}
            </p>
          </div>
        </div>
      )}

      {/* Progress Bar */}
      {metrics && (
        <div className="mb-8">
          <div className="flex justify-between items-center mb-2">
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Progress</p>
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">{Math.round(progressPercent)}%</p>
          </div>
          <div className="w-full h-3 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden shadow-sm">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-blue-500 transition-all duration-300"
              style={{ width: `${Math.min(progressPercent, 100)}%` }}
            ></div>
          </div>
        </div>
      )}

      {/* Event Feed */}
      {displayEvents.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">📋 Event Feed</h2>
          <div className="space-y-3">
            {displayEvents.map((event, idx) => (
              <div
                key={event.id}
                className="p-4 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex gap-3 items-start">
                  <div className="text-lg min-w-fit">
                    {event.type === 'token-created' && '🪙'}
                    {event.type === 'trade' && '💱'}
                    {event.type === 'graduated' && '🎓'}
                    {event.type === 'wallet' && '👛'}
                    {event.type === 'strategy' && '🧠'}
                    {event.type === 'error' && '⚠️'}
                    {!['token-created', 'trade', 'graduated', 'wallet', 'strategy', 'error'].includes(event.type) && '📌'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start gap-2 mb-1">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white capitalize">
                        {event.type.replace('-', ' ')}
                      </p>
                      <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                        {new Date(event.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                      {event.narration}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!isRunning && (
        <div className="text-center py-12">
          <p className="text-gray-500 dark:text-gray-400 mb-4">No active swarm session</p>
          <a
            href="/swarm"
            className="inline-block px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Start Swarm Demo
          </a>
        </div>
      )}
    </div>
  );
}
