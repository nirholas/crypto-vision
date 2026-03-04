'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { PriceChartPanel } from '@/components/trading/PriceChartPanel';
import { BondingCurvePanel } from '@/components/trading/BondingCurvePanel';
import { RecentTradesPanel } from '@/components/trading/RecentTradesPanel';
import { AgentStatusPanel } from '@/components/trading/AgentStatusPanel';
import { PnLSummaryPanel } from '@/components/trading/PnLSummaryPanel';
import { useSwarmWebSocket } from '@/hooks/useSwarmWebSocket';
import { swarmApi } from '@/lib/swarm-api';
import type {
  StatusResponse,
  AgentSummary,
  PaginatedTrades,
  PnLResponse,
  BondingCurveState,
  SupplyDistribution,
} from '@/types/swarm';
import { PHASE_LABELS, formatSol } from '@/types/swarm';

// ─── Data polling interval ────────────────────────────────────

const POLL_INTERVAL_MS = 5000;

// ─── Page Component ───────────────────────────────────────────

export default function TradingTerminalPage() {
  // State
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [agents, setAgents] = useState<AgentSummary[]>([]);
  const [tradesData, setTradesData] = useState<PaginatedTrades | null>(null);
  const [pnlData, setPnlData] = useState<PnLResponse | null>(null);
  const [curveState, setCurveState] = useState<BondingCurveState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // WebSocket
  const { connected, lastTrade, latestPnl, swarmPhase } = useSwarmWebSocket();

  // Fetch all data
  const fetchData = useCallback(async () => {
    try {
      const [statusRes, agentsRes, tradesRes, pnlRes] = await Promise.allSettled([
        swarmApi.getSwarmStatus(),
        swarmApi.getAgents(),
        swarmApi.getTrades({ limit: 50 }),
        swarmApi.getPnl(),
      ]);

      if (statusRes.status === 'fulfilled') setStatus(statusRes.value);
      if (agentsRes.status === 'fulfilled') setAgents(agentsRes.value);
      if (tradesRes.status === 'fulfilled') setTradesData(tradesRes.value);
      if (pnlRes.status === 'fulfilled') setPnlData(pnlRes.value);

      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch + polling
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Update state from WebSocket events
  useEffect(() => {
    if (latestPnl && pnlData) {
      setPnlData((prev) =>
        prev
          ? {
              ...prev,
              current: {
                ...prev.current,
                totalPnl: latestPnl.totalPnl,
                roi: latestPnl.roi,
              },
            }
          : prev,
      );
    }
  }, [latestPnl]);

  // Current price from latest PnL or curve state
  const currentPrice = latestPnl?.currentPrice ?? pnlData?.current?.totalPnl ?? null;

  // Trade markers for chart
  const tradeMarkers = useMemo(() => {
    if (!tradesData?.trades) return [];
    return tradesData.trades.map((t) => ({
      timestamp: t.timestamp,
      direction: t.direction,
      price: t.price,
    }));
  }, [tradesData]);

  // Phase display
  const currentPhase = swarmPhase ?? status?.phase ?? null;
  const phaseLabel = currentPhase ? (PHASE_LABELS[currentPhase] ?? currentPhase) : 'Offline';

  // Strategy display (from status or fallback)
  const strategyName = 'Active';

  // Token display
  const tokenMint = status?.tokenMint;
  const tokenLabel = tokenMint ? `${tokenMint.slice(0, 6)}...${tokenMint.slice(-4)}/SOL` : 'Waiting...';

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'p') {
        e.preventDefault();
        swarmApi.pauseSwarm().catch(console.error);
      }
      if (e.ctrlKey && e.key === 'e') {
        e.preventDefault();
        if (window.confirm('Are you sure you want to EMERGENCY STOP?')) {
          swarmApi.emergencyStop().catch(console.error);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="h-screen flex flex-col bg-gray-950 text-white overflow-hidden">
      {/* Top Bar */}
      <header className="h-12 border-b border-gray-800 flex items-center px-4 gap-4 shrink-0 bg-gray-900/80 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-gray-200">🔮</span>
          <span className="text-sm font-semibold text-gray-300 hidden sm:inline">Trading Terminal</span>
        </div>

        <div className="h-6 w-px bg-gray-700" />

        <div className="flex items-center gap-3 text-xs">
          <span className="text-gray-400">
            Token: <span className="text-indigo-400 font-mono">{tokenLabel}</span>
          </span>
          <span className="text-gray-400">
            Strategy: <span className="text-gray-200">{strategyName}</span>
          </span>
          <span
            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full font-medium ${
              currentPhase === 'trading' || currentPhase === 'market_making'
                ? 'bg-emerald-900/40 text-emerald-400'
                : currentPhase === 'error' || currentPhase === 'emergency_exit'
                  ? 'bg-red-900/40 text-red-400'
                  : 'bg-gray-800 text-gray-400'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                currentPhase === 'trading' || currentPhase === 'market_making'
                  ? 'bg-emerald-500 animate-pulse'
                  : currentPhase === 'error'
                    ? 'bg-red-500'
                    : 'bg-gray-500'
              }`}
            />
            {phaseLabel}
          </span>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Connection status */}
        <div className="flex items-center gap-1.5 text-xs">
          <span className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-500' : 'bg-red-500'}`} />
          <span className={connected ? 'text-emerald-400' : 'text-red-400'}>
            {connected ? 'Live' : 'Disconnected'}
          </span>
        </div>

        {/* Keyboard shortcuts hint */}
        <div className="hidden lg:flex items-center gap-2 text-[10px] text-gray-600">
          <kbd className="px-1 py-0.5 bg-gray-800 rounded border border-gray-700">Ctrl+P</kbd>
          <span>Pause</span>
          <kbd className="px-1 py-0.5 bg-gray-800 rounded border border-gray-700">Ctrl+E</kbd>
          <span>Stop</span>
        </div>
      </header>

      {/* Error banner */}
      {error && (
        <div className="bg-red-900/30 border-b border-red-800 px-4 py-2 text-xs text-red-300">
          {error}
          <button onClick={() => setError(null)} className="ml-2 text-red-400 hover:text-red-300">
            ✕
          </button>
        </div>
      )}

      {/* Main Grid */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-3 grid-rows-2 gap-1 p-1 overflow-hidden min-h-0">
        {/* Row 1: Price Chart (2 cols) + Bonding Curve (1 col) */}
        <div className="lg:col-span-2 min-h-0">
          <PriceChartPanel
            pnlData={pnlData}
            currentPrice={currentPrice}
            trades={tradeMarkers}
            loading={loading}
          />
        </div>
        <div className="min-h-0 hidden lg:block">
          <BondingCurvePanel curveState={curveState} loading={loading} />
        </div>

        {/* Row 2: Recent Trades + Agent Status + PnL Summary */}
        <div className="min-h-0">
          <RecentTradesPanel
            trades={tradesData?.trades ?? []}
            agents={agents}
            loading={loading}
          />
        </div>
        <div className="min-h-0 hidden md:block">
          <AgentStatusPanel agents={agents} loading={loading} />
        </div>
        <div className="min-h-0 hidden md:block">
          <PnLSummaryPanel pnlData={pnlData} agents={agents} loading={loading} />
        </div>
      </main>

      {/* Mobile: Stack hidden panels below */}
      <div className="lg:hidden space-y-1 p-1 overflow-y-auto">
        <BondingCurvePanel curveState={curveState} loading={loading} />
        <div className="md:hidden">
          <AgentStatusPanel agents={agents} loading={loading} />
        </div>
        <div className="md:hidden">
          <PnLSummaryPanel pnlData={pnlData} agents={agents} loading={loading} />
        </div>
      </div>
    </div>
  );
}
