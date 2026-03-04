/**
 * useSwarmData — SWR-based data fetching for all swarm dashboard endpoints.
 *
 * Wraps the swarm REST API client with SWR for automatic caching, revalidation,
 * and real-time updates via the WebSocket hook.
 */

'use client';

import useSWR from 'swr';
import { useCallback, useMemo, useState } from 'react';
import { swarmApi, SwarmApiError } from '@/lib/swarm-api';
import type {
  StatusResponse,
  AgentSummary,
  AgentDetailResponse,
  PaginatedTrades,
  TradeQuery,
  SankeyFlowData,
  PnLResponse,
  SupplyDistribution,
  PaginatedEvents,
  EventQuery,
  SwarmConfigResponse,
  HealthReport,
} from '@/types/swarm';

// ─── Configuration ────────────────────────────────────────────

const STATUS_REFRESH_MS = 3_000;
const AGENTS_REFRESH_MS = 5_000;
const TRADES_REFRESH_MS = 5_000;
const PNL_REFRESH_MS = 4_000;
const SUPPLY_REFRESH_MS = 10_000;
const HEALTH_REFRESH_MS = 15_000;
const CONFIG_REFRESH_MS = 30_000;

// ─── Error Handling ───────────────────────────────────────────

function isApiUnavailable(error: unknown): boolean {
  if (error instanceof SwarmApiError) return error.status >= 500;
  if (error instanceof TypeError && error.message.includes('fetch')) return true;
  return false;
}

// ─── Status ───────────────────────────────────────────────────

export function useSwarmStatus() {
  const { data, error, isLoading, mutate } = useSWR<StatusResponse>(
    'swarm:status',
    () => swarmApi.getSwarmStatus(),
    {
      refreshInterval: STATUS_REFRESH_MS,
      revalidateOnFocus: true,
      shouldRetryOnError: true,
      errorRetryInterval: 5_000,
      dedupingInterval: 2_000,
    },
  );

  return {
    status: data ?? null,
    error: error as Error | null,
    isLoading,
    isConnected: !error && !!data,
    refetch: mutate,
  };
}

// ─── Agents ───────────────────────────────────────────────────

export function useSwarmAgents() {
  const { data, error, isLoading, mutate } = useSWR<AgentSummary[]>(
    'swarm:agents',
    () => swarmApi.getAgents(),
    {
      refreshInterval: AGENTS_REFRESH_MS,
      shouldRetryOnError: true,
      errorRetryInterval: 5_000,
    },
  );

  return {
    agents: data ?? [],
    error: error as Error | null,
    isLoading,
    refetch: mutate,
  };
}

export function useSwarmAgentDetail(agentId: string | null) {
  const { data, error, isLoading, mutate } = useSWR<AgentDetailResponse>(
    agentId ? `swarm:agent:${agentId}` : null,
    () => (agentId ? swarmApi.getAgentDetail(agentId) : Promise.reject('No agent ID')),
    {
      refreshInterval: AGENTS_REFRESH_MS,
      shouldRetryOnError: true,
    },
  );

  return {
    agent: data ?? null,
    error: error as Error | null,
    isLoading,
    refetch: mutate,
  };
}

// ─── Trades ───────────────────────────────────────────────────

export function useSwarmTrades(query?: TradeQuery) {
  const key = useMemo(
    () => `swarm:trades:${JSON.stringify(query ?? {})}`,
    [query],
  );

  const { data, error, isLoading, mutate } = useSWR<PaginatedTrades>(
    key,
    () => swarmApi.getTrades(query),
    {
      refreshInterval: TRADES_REFRESH_MS,
      shouldRetryOnError: true,
    },
  );

  return {
    trades: data?.trades ?? [],
    total: data?.total ?? 0,
    hasMore: data?.hasMore ?? false,
    error: error as Error | null,
    isLoading,
    refetch: mutate,
  };
}

export function useSwarmTradeFlow() {
  const { data, error, isLoading } = useSWR<SankeyFlowData>(
    'swarm:trade-flow',
    () => swarmApi.getTradeFlow(),
    { refreshInterval: 10_000 },
  );

  return {
    flowData: data ?? null,
    error: error as Error | null,
    isLoading,
  };
}

// ─── P&L ──────────────────────────────────────────────────────

export function useSwarmPnl() {
  const { data, error, isLoading, mutate } = useSWR<PnLResponse>(
    'swarm:pnl',
    () => swarmApi.getPnl(),
    {
      refreshInterval: PNL_REFRESH_MS,
      shouldRetryOnError: true,
    },
  );

  return {
    pnl: data ?? null,
    error: error as Error | null,
    isLoading,
    refetch: mutate,
  };
}

// ─── Supply ───────────────────────────────────────────────────

export function useSwarmSupply() {
  const { data, error, isLoading } = useSWR<SupplyDistribution>(
    'swarm:supply',
    () => swarmApi.getSupply(),
    { refreshInterval: SUPPLY_REFRESH_MS },
  );

  return {
    supply: data ?? null,
    error: error as Error | null,
    isLoading,
  };
}

// ─── Events ───────────────────────────────────────────────────

export function useSwarmEvents(query?: EventQuery) {
  const key = useMemo(
    () => `swarm:events:${JSON.stringify(query ?? {})}`,
    [query],
  );

  const { data, error, isLoading, mutate } = useSWR<PaginatedEvents>(
    key,
    () => swarmApi.getEvents(query),
    { refreshInterval: 5_000 },
  );

  return {
    events: data?.events ?? [],
    total: data?.total ?? 0,
    hasMore: data?.hasMore ?? false,
    error: error as Error | null,
    isLoading,
    refetch: mutate,
  };
}

// ─── Config ───────────────────────────────────────────────────

export function useSwarmConfig() {
  const { data, error, isLoading, mutate } = useSWR<SwarmConfigResponse>(
    'swarm:config',
    () => swarmApi.getConfig(),
    { refreshInterval: CONFIG_REFRESH_MS },
  );

  const updateConfig = useCallback(
    async (updates: Record<string, unknown>) => {
      await swarmApi.updateConfig(updates as Parameters<typeof swarmApi.updateConfig>[0]);
      await mutate();
    },
    [mutate],
  );

  return {
    config: data?.config ?? null,
    schema: data?.schema ?? null,
    error: error as Error | null,
    isLoading,
    updateConfig,
    refetch: mutate,
  };
}

// ─── Health ───────────────────────────────────────────────────

export function useSwarmHealth() {
  const { data, error, isLoading, mutate } = useSWR<HealthReport>(
    'swarm:health',
    () => swarmApi.getHealth(),
    { refreshInterval: HEALTH_REFRESH_MS },
  );

  return {
    health: data ?? null,
    error: error as Error | null,
    isLoading,
    refetch: mutate,
  };
}

// ─── Actions ──────────────────────────────────────────────────

export function useSwarmActions() {
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const execute = useCallback(async (action: string, fn: () => Promise<void>) => {
    setActionLoading(action);
    setActionError(null);
    try {
      await fn();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Action failed';
      setActionError(message);
      throw err;
    } finally {
      setActionLoading(null);
    }
  }, []);

  return {
    actionLoading,
    actionError,
    clearError: () => setActionError(null),

    pause: () => execute('pause', () => swarmApi.pauseSwarm()),
    resume: () => execute('resume', () => swarmApi.resumeSwarm()),
    triggerExit: () => execute('exit', () => swarmApi.triggerExit()),
    emergencyStop: () => execute('emergency-stop', () => swarmApi.emergencyStop()),
    ping: () => swarmApi.ping(),
  };
}

// ─── Combined Dashboard Data ──────────────────────────────────

export function useSwarmDashboard() {
  const status = useSwarmStatus();
  const agents = useSwarmAgents();
  const pnl = useSwarmPnl();
  const health = useSwarmHealth();
  const actions = useSwarmActions();

  const isSwarmActive = useMemo(() => {
    if (!status.status) return false;
    const activePhases = ['trading', 'market_making', 'accumulating', 'minting', 'bundling', 'distributing'];
    return activePhases.includes(status.status.phase);
  }, [status.status]);

  return {
    ...status,
    agents: agents.agents,
    agentsLoading: agents.isLoading,
    pnl: pnl.pnl,
    pnlLoading: pnl.isLoading,
    health: health.health,
    healthLoading: health.isLoading,
    actions,
    isSwarmActive,
  };
}
