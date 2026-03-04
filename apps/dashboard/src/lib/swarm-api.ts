/**
 * Swarm API Client
 *
 * HTTP client for the pump-agent-swarm dashboard API (default port 3847).
 * Base URL is configurable via NEXT_PUBLIC_SWARM_API_URL env var.
 */

import type {
  ApiResponse,
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
  SwarmConfig,
  HealthReport,
} from '@/types/swarm';

// ─── Configuration ────────────────────────────────────────────

const SWARM_API_BASE =
  typeof window !== 'undefined'
    ? (process.env.NEXT_PUBLIC_SWARM_API_URL ?? 'http://localhost:3847')
    : (process.env.NEXT_PUBLIC_SWARM_API_URL ?? 'http://localhost:3847');

// ─── Fetch Helpers ────────────────────────────────────────────

class SwarmApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body?: string,
  ) {
    super(message);
    this.name = 'SwarmApiError';
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${SWARM_API_BASE}${path}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new SwarmApiError(
      `Swarm API ${response.status}: ${response.statusText}`,
      response.status,
      body,
    );
  }

  const json: ApiResponse<T> = await response.json();

  if (!json.success) {
    throw new SwarmApiError(json.error ?? 'Unknown swarm API error', response.status);
  }

  return json.data;
}

function buildQuery(params: Record<string, string | number | boolean | undefined>): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
    }
  }
  return parts.length > 0 ? `?${parts.join('&')}` : '';
}

// ─── Read Endpoints ───────────────────────────────────────────

/** Get current swarm status: phase, uptime, agents, trades, PnL */
export async function getSwarmStatus(): Promise<StatusResponse> {
  return request<StatusResponse>('/api/status');
}

/** Get all agents with summary stats */
export async function getAgents(): Promise<AgentSummary[]> {
  return request<AgentSummary[]>('/api/agents');
}

/** Get detailed info for a specific agent including history */
export async function getAgentDetail(id: string): Promise<AgentDetailResponse> {
  return request<AgentDetailResponse>(`/api/agents/${encodeURIComponent(id)}`);
}

/** Get paginated trade history with optional filters */
export async function getTrades(params?: TradeQuery): Promise<PaginatedTrades> {
  const query = buildQuery({
    limit: params?.limit,
    offset: params?.offset,
    agent: params?.agent,
    direction: params?.direction,
  });
  return request<PaginatedTrades>(`/api/trades${query}`);
}

/** Get trade flow data for Sankey visualization */
export async function getTradeFlow(): Promise<SankeyFlowData> {
  return request<SankeyFlowData>('/api/trades/flow');
}

/** Get PnL time series and current snapshot */
export async function getPnl(): Promise<PnLResponse> {
  return request<PnLResponse>('/api/pnl');
}

/** Get token supply distribution */
export async function getSupply(): Promise<SupplyDistribution> {
  return request<SupplyDistribution>('/api/supply');
}

/** Get filtered event timeline */
export async function getEvents(params?: EventQuery): Promise<PaginatedEvents> {
  const query = buildQuery({
    limit: params?.limit,
    offset: params?.offset,
    category: params?.categories?.join(','),
    severity: params?.minSeverity,
    agent: params?.agent,
    from: params?.from,
    to: params?.to,
    search: params?.search,
  });
  return request<PaginatedEvents>(`/api/events${query}`);
}

/** Get current swarm configuration and schema */
export async function getConfig(): Promise<SwarmConfigResponse> {
  return request<SwarmConfigResponse>('/api/config');
}

/** Get health report */
export async function getHealth(): Promise<HealthReport> {
  return request<HealthReport>('/api/health');
}

// ─── Write Endpoints ──────────────────────────────────────────

/** Update swarm configuration (partial merge) */
export async function updateConfig(config: Partial<SwarmConfig>): Promise<void> {
  await request<unknown>('/api/config', {
    method: 'PUT',
    body: JSON.stringify(config),
  });
}

/** Pause the swarm */
export async function pauseSwarm(): Promise<void> {
  await request<unknown>('/api/actions/pause', { method: 'POST' });
}

/** Resume the swarm */
export async function resumeSwarm(): Promise<void> {
  await request<unknown>('/api/actions/resume', { method: 'POST' });
}

/** Trigger a graceful exit */
export async function triggerExit(): Promise<void> {
  await request<unknown>('/api/actions/exit', { method: 'POST' });
}

/** Emergency stop — immediately halts all agents */
export async function emergencyStop(): Promise<void> {
  await request<unknown>('/api/actions/emergency-stop', { method: 'POST' });
}

// ─── Swarm API Singleton ──────────────────────────────────────

export const swarmApi = {
  getSwarmStatus,
  getAgents,
  getAgentDetail,
  getTrades,
  getTradeFlow,
  getPnl,
  getSupply,
  getEvents,
  getConfig,
  getHealth,
  updateConfig,
  pauseSwarm,
  resumeSwarm,
  triggerExit,
  emergencyStop,
  /** The base URL used for requests */
  baseUrl: SWARM_API_BASE,
  /** The WebSocket URL for real-time events */
  wsUrl: SWARM_API_BASE.replace(/^http/, 'ws') + '/ws',
} as const;
