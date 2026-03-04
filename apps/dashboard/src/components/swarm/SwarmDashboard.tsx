'use client';

import React from 'react';
import type { SwarmPhase, StatusResponse } from '@/types/swarm';
import { SWARM_PHASES, PHASE_LABELS, formatSol, formatUptime } from '@/types/swarm';

// ─── Ordered phases for the progress bar (excluding terminal states) ──

const PROGRESS_PHASES: SwarmPhase[] = [
  'idle',
  'initializing',
  'funding',
  'scanning',
  'evaluating',
  'creating_narrative',
  'minting',
  'bundling',
  'distributing',
  'trading',
  'market_making',
  'accumulating',
  'graduating',
  'exiting',
  'reclaiming',
  'completed',
];

// ─── Props ────────────────────────────────────────────────────

interface SwarmDashboardProps {
  status: StatusResponse | null;
  wsConnected: boolean;
  loading?: boolean;
}

// ─── Component ────────────────────────────────────────────────

export function SwarmDashboard({ status, wsConnected, loading }: SwarmDashboardProps) {
  if (loading) {
    return <SwarmDashboardSkeleton />;
  }

  if (!status) {
    return (
      <div className="text-center text-gray-500 py-12">
        <p className="text-lg">No swarm status available</p>
        <p className="text-sm mt-1">Start a swarm or check your connection</p>
      </div>
    );
  }

  const currentPhaseIndex = PROGRESS_PHASES.indexOf(status.phase);
  const isTerminal = ['completed', 'error', 'emergency_exit'].includes(status.phase);
  const isPaused = status.phase === 'paused';

  return (
    <div className="space-y-6">
      {/* Phase Progress Bar */}
      <div className="bg-gray-800/50 rounded-lg border border-gray-700 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Phase Progress</h3>
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                isTerminal
                  ? status.phase === 'completed'
                    ? 'bg-emerald-900/40 text-emerald-400'
                    : 'bg-red-900/40 text-red-400'
                  : isPaused
                    ? 'bg-amber-900/40 text-amber-400'
                    : 'bg-indigo-900/40 text-indigo-400'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isTerminal
                    ? status.phase === 'completed'
                      ? 'bg-emerald-500'
                      : 'bg-red-500'
                    : isPaused
                      ? 'bg-amber-500'
                      : 'bg-indigo-500 animate-pulse'
                }`}
              />
              {PHASE_LABELS[status.phase] ?? status.phase}
            </span>
            {/* WS connection indicator */}
            <span className="flex items-center gap-1.5 text-xs text-gray-500">
              <span className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-emerald-500' : 'bg-red-500'}`} />
              {wsConnected ? 'Live' : 'Offline'}
            </span>
          </div>
        </div>

        {/* Phase Steps */}
        <div className="flex items-center gap-0.5 overflow-x-auto pb-1">
          {PROGRESS_PHASES.map((phase, i) => {
            const isCurrent = phase === status.phase;
            const isCompleted = currentPhaseIndex >= 0 && i < currentPhaseIndex;
            const isActive = isCurrent && !isTerminal;

            return (
              <div key={phase} className="flex items-center">
                <div
                  className={`h-2 rounded-full transition-all ${
                    i === 0 ? 'w-4' : 'w-6'
                  } ${
                    isCompleted
                      ? 'bg-emerald-500'
                      : isActive
                        ? 'bg-indigo-500 animate-pulse'
                        : isCurrent
                          ? 'bg-indigo-500'
                          : 'bg-gray-700'
                  }`}
                  title={PHASE_LABELS[phase]}
                />
                {i < PROGRESS_PHASES.length - 1 && (
                  <div className={`w-1 h-0.5 ${isCompleted ? 'bg-emerald-500' : 'bg-gray-700'}`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Live Metrics Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricCard
          label="Total Trades"
          value={status.totalTrades.toLocaleString()}
          icon="📊"
        />
        <MetricCard
          label="Volume"
          value={formatSol(status.totalVolumeSol)}
          icon="💰"
        />
        <MetricCard
          label="Active Agents"
          value={`${status.activeAgents}/${status.totalAgents}`}
          icon="🤖"
        />
        <MetricCard
          label="Uptime"
          value={formatUptime(status.uptime)}
          icon="⏱"
        />
      </div>

      {/* PnL Card */}
      <div className="bg-gray-800/50 rounded-lg border border-gray-700 p-6 text-center">
        <span className="text-xs text-gray-500 uppercase">Current PnL</span>
        <p
          className={`text-4xl font-bold font-mono tabular-nums mt-1 ${
            status.currentPnl >= 0 ? 'text-emerald-400' : 'text-red-400'
          }`}
        >
          {status.currentPnl >= 0 ? '+' : ''}{formatSol(status.currentPnl)}
        </p>
        {status.tokenMint && (
          <p className="text-xs text-gray-500 mt-2 font-mono">
            Token: {status.tokenMint.slice(0, 8)}...{status.tokenMint.slice(-4)}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Metric Card ──────────────────────────────────────────────

function MetricCard({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="bg-gray-800/40 rounded-lg border border-gray-700/50 p-4">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-base">{icon}</span>
        <span className="text-xs text-gray-500 uppercase">{label}</span>
      </div>
      <p className="text-xl font-bold text-gray-200 font-mono tabular-nums">{value}</p>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────

function SwarmDashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="bg-gray-800/50 rounded-lg border border-gray-700 p-4 space-y-3">
        <div className="h-4 w-32 bg-gray-700 rounded" />
        <div className="flex gap-1">
          {Array.from({ length: 16 }).map((_, i) => (
            <div key={i} className="h-2 w-6 bg-gray-700 rounded-full" />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 bg-gray-800/50 rounded-lg border border-gray-700" />
        ))}
      </div>
      <div className="h-24 bg-gray-800/50 rounded-lg border border-gray-700" />
    </div>
  );
}
