'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { SwarmLauncher, type LaunchConfig } from '@/components/swarm/SwarmLauncher';
import { SwarmDashboard } from '@/components/swarm/SwarmDashboard';
import { SwarmControlPanel } from '@/components/swarm/SwarmControlPanel';
import { EventTimelinePanel } from '@/components/swarm/EventTimelinePanel';
import { SupplyDistributionPanel } from '@/components/swarm/SupplyDistributionPanel';
import { AgentStatusPanel } from '@/components/trading/AgentStatusPanel';
import { useSwarmWebSocket } from '@/hooks/useSwarmWebSocket';
import { swarmApi } from '@/lib/swarm-api';
import type {
  StatusResponse,
  AgentSummary,
  TimelineEvent,
  SupplyDistribution,
} from '@/types/swarm';

// ─── Poll interval ───────────────────────────────────────────

const POLL_INTERVAL_MS = 3000;

// ─── Page Component ───────────────────────────────────────────

export default function SwarmPage() {
  // State
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [agents, setAgents] = useState<AgentSummary[]>([]);
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [supply, setSupply] = useState<SupplyDistribution | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [launched, setLaunched] = useState(false);

  // WebSocket
  const { connected, swarmPhase } = useSwarmWebSocket();

  // Determine if swarm is running
  const isRunning =
    status !== null &&
    status.phase !== 'idle' &&
    status.startedAt !== null;

  // Fetch data
  const fetchData = useCallback(async () => {
    try {
      const [statusRes, agentsRes, eventsRes, supplyRes] = await Promise.allSettled([
        swarmApi.getSwarmStatus(),
        swarmApi.getAgents(),
        swarmApi.getEvents({ limit: 100 }),
        swarmApi.getSupply(),
      ]);

      if (statusRes.status === 'fulfilled') setStatus(statusRes.value);
      if (agentsRes.status === 'fulfilled') setAgents(agentsRes.value);
      if (eventsRes.status === 'fulfilled') setEvents(eventsRes.value.events);
      if (supplyRes.status === 'fulfilled') setSupply(supplyRes.value);

      setError(null);
    } catch (err) {
      // If we can't connect, the swarm isn't running
      if (!launched) {
        setStatus(null);
      }
      setError(err instanceof Error ? err.message : 'Failed to connect to swarm API');
    } finally {
      setLoading(false);
    }
  }, [launched]);

  // Initial fetch + polling
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Handle launch
  const handleLaunch = async (config: LaunchConfig) => {
    try {
      const response = await fetch('/api/swarm/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      if (!response.ok) {
        const body = await response.text();
        throw new Error(`Failed to start swarm: ${body}`);
      }
      setLaunched(true);
      setTimeout(fetchData, 1000);
    } catch (err) {
      throw err instanceof Error ? err : new Error('Launch failed');
    }
  };

  // Handle control action
  const handleAction = (_action: string) => {
    setTimeout(fetchData, 500);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'p') {
        e.preventDefault();
        swarmApi.pauseSwarm().catch(console.error);
        setTimeout(fetchData, 500);
      }
      if (e.ctrlKey && e.key === 'e') {
        e.preventDefault();
        if (window.confirm('Are you sure you want to EMERGENCY STOP the swarm?')) {
          swarmApi.emergencyStop().catch(console.error);
          setTimeout(fetchData, 500);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [fetchData]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 to-gray-900 py-8 px-4">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-blue-400 mb-3">
            Agent Swarm Control Center
          </h1>
          <p className="text-gray-400">
            Launch, monitor, and control autonomous AI agent swarms for Pump.fun token operations.
          </p>
          {/* WS status */}
          <div className="flex items-center justify-center gap-2 mt-3 text-xs">
            <span className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-500' : 'bg-red-500'}`} />
            <span className={connected ? 'text-emerald-400' : 'text-gray-500'}>
              {connected ? 'WebSocket Connected' : 'WebSocket Disconnected'}
            </span>
          </div>
        </div>

        {/* Error Banner */}
        {error && !loading && (
          <div className="p-4 bg-red-900/20 border border-red-800/50 rounded-lg text-red-300 text-sm">
            <div className="flex items-center justify-between">
              <span>{error}</span>
              <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300 ml-4">
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Content: Launcher or Dashboard */}
        {!isRunning && !loading ? (
          /* ── Launcher State ──────────────────────────────────── */
          <SwarmLauncher onLaunch={handleLaunch} />
        ) : (
          /* ── Running Dashboard State ─────────────────────────── */
          <div className="space-y-6">
            {/* Phase + Metrics */}
            <SwarmDashboard
              status={status}
              wsConnected={connected}
              loading={loading}
            />

            {/* Control Panel + Agent Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <SwarmControlPanel
                phase={swarmPhase ?? status?.phase ?? null}
                onAction={handleAction}
              />
              <div className="h-96">
                <AgentStatusPanel agents={agents} loading={loading} />
              </div>
            </div>

            {/* Event Timeline */}
            <EventTimelinePanel events={events} loading={loading} />

            {/* Supply Distribution */}
            <SupplyDistributionPanel supply={supply} loading={loading} />

            {/* Config Editor Hint */}
            <div className="bg-gray-800/30 rounded-lg border border-gray-700/50 p-4 text-xs text-gray-500">
              <span className="font-medium text-gray-400">Keyboard Shortcuts:</span>{' '}
              <kbd className="px-1 py-0.5 bg-gray-800 rounded border border-gray-700 text-gray-400">Ctrl+P</kbd>{' '}
              Pause/Resume &middot;{' '}
              <kbd className="px-1 py-0.5 bg-gray-800 rounded border border-gray-700 text-gray-400">Ctrl+E</kbd>{' '}
              Emergency Stop
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
