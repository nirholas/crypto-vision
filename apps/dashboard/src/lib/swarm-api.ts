/**
 * Swarm API Client
 *
 * REST client for the pump-agent-swarm dashboard API.
 * Base URL is configurable via NEXT_PUBLIC_SWARM_API_URL (default: http://localhost:3847).
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

const BASE_URL =
  typeof window !== 'undefined'
    ? (process.env.NEXT_PUBLIC_SWARM_API_URL ?? 'http://localhost:3847')
    : (process.env.NEXT_PUBLIC_SWARM_API_URL ?? 'http://localhost:3847');

const REQUEST_TIMEOUT_MS = 15_000;
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;

// ─── Helpers ──────────────────────────────────────────────────

class SwarmApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly endpoint: string,
  ) {
    super(message);
    this.name = 'SwarmApiError';
  }
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = REQUEST_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const url = `${BASE_URL}${path}`;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        await sleep(RETRY_DELAY_MS * attempt);
      }

      const headers: Record<string, string> = {
        'Accept': 'application/json',
      };

      if (body !== undefined) {
        headers['Content-Type'] = 'application/json';
      }

      const response = await fetchWithTimeout(url, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });

      if (!response.ok) {
        const text = await response.text().catch(() => 'Unknown error');
        let errorMessage = text;
        try {
          const errorJson = JSON.parse(text) as ApiResponse<null>;
          errorMessage = errorJson.error ?? text;
        } catch {
          // Use raw text
        }
        throw new SwarmApiError(errorMessage, response.status, path);
      }

      const json = (await response.json()) as ApiResponse<T>;
      if (!json.success) {
        throw new SwarmApiError(json.error ?? 'Request failed', response.status, path);
      }

      return json.data;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      // Don't retry on 4xx errors
      if (err instanceof SwarmApiError && err.status >= 400 && err.status < 500) {
        throw err;
      }

      // Don't retry if it was explicitly aborted
      if (lastError.name === 'AbortError') {
        throw new SwarmApiError('Request timed out', 408, path);
      }
    }
  }

  throw lastError ?? new Error('Request failed');
}

function buildQueryString(params: Record<string, string | number | boolean | undefined>): string {
  const entries = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== '',
  );
  if (entries.length === 0) return '';
  return '?' + entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&');
}

// ─── API Client ───────────────────────────────────────────────

export const swarmApi = {
  /** Get current swarm status (phase, uptime, agents, trades, PnL) */
  async getSwarmStatus(): Promise<StatusResponse> {
    return request<StatusResponse>('GET', '/api/status');
  },

  /** Get all agents with summary stats */
  async getAgents(): Promise<AgentSummary[]> {
    return request<AgentSummary[]>('GET', '/api/agents');
  },

  /** Get detailed agent info + history */
  async getAgentDetail(id: string): Promise<AgentDetailResponse> {
    return request<AgentDetailResponse>('GET', `/api/agents/${encodeURIComponent(id)}`);
  },

  /** Get paginated trade history */
  async getTrades(params?: TradeQuery): Promise<PaginatedTrades> {
    const qs = params
      ? buildQueryString({
          limit: params.limit,
          offset: params.offset,
          agent: params.agent,
          direction: params.direction,
        })
      : '';
    return request<PaginatedTrades>('GET', `/api/trades${qs}`);
  },

  /** Get trade flow data for Sankey diagram */
  async getTradeFlow(): Promise<SankeyFlowData> {
    return request<SankeyFlowData>('GET', '/api/trades/flow');
  },

  /** Get PnL time series + current snapshot */
  async getPnl(): Promise<PnLResponse> {
    return request<PnLResponse>('GET', '/api/pnl');
  },

  /** Get token supply distribution */
  async getSupply(): Promise<SupplyDistribution> {
    return request<SupplyDistribution>('GET', '/api/supply');
  },

  /** Get filtered event timeline */
  async getEvents(params?: EventQuery): Promise<PaginatedEvents> {
    const qs = params
      ? buildQueryString({
          limit: params.limit,
          offset: params.offset,
          category: params.categories?.join(','),
          severity: params.minSeverity,
          agent: params.agent,
          from: params.from,
          to: params.to,
          search: params.search,
        })
      : '';
    return request<PaginatedEvents>('GET', `/api/events${qs}`);
  },

  /** Get current swarm configuration */
  async getConfig(): Promise<SwarmConfigResponse> {
    return request<SwarmConfigResponse>('GET', '/api/config');
  },

  /** Update swarm configuration */
  async updateConfig(config: Partial<SwarmConfig>): Promise<void> {
    await request<void>('PUT', '/api/config', config);
  },

  /** Get health report */
  async getHealth(): Promise<HealthReport> {
    return request<HealthReport>('GET', '/api/health');
  },

  /** Pause the swarm */
  async pauseSwarm(): Promise<void> {
    await request<void>('POST', '/api/actions/pause');
  },

  /** Resume the swarm */
  async resumeSwarm(): Promise<void> {
    await request<void>('POST', '/api/actions/resume');
  },

  /** Trigger graceful exit */
  async triggerExit(): Promise<void> {
    await request<void>('POST', '/api/actions/exit');
  },

  /** Emergency stop — kills everything immediately */
  async emergencyStop(): Promise<void> {
    await request<void>('POST', '/api/actions/emergency-stop');
  },

  /** Check if the swarm API is reachable */
  async ping(): Promise<boolean> {
    try {
      await fetchWithTimeout(`${BASE_URL}/api/status`, {}, 3000);
      return true;
    } catch {
      return false;
    }
  },

  /** Get the WebSocket URL for real-time events */
  getWebSocketUrl(): string {
    const wsBase = BASE_URL.replace(/^http/, 'ws');
    return `${wsBase}/ws`;
  },
};

export { SwarmApiError };
export type { ApiResponse };
