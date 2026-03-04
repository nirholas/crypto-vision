/**
 * RPC Connection Pool with Load Balancing
 *
 * Production-grade Solana RPC connection pool that:
 * - Load-balances across multiple endpoints using weighted random selection
 * - Performs periodic health checks via getSlot()
 * - Tracks rolling average latency per endpoint
 * - Handles failover with automatic unhealthy endpoint exclusion
 * - Respects per-endpoint rate limits
 * - Supports Jito-specific endpoint selection
 * - Auto-recovers unhealthy endpoints after cooldown cycles
 *
 * @example
 * ```typescript
 * import { RpcPool, DEFAULT_RPC_ENDPOINTS } from './infra/rpc-pool.js';
 *
 * const pool = new RpcPool({
 *   endpoints: DEFAULT_RPC_ENDPOINTS,
 *   healthCheckIntervalMs: 30_000,
 *   preferLowLatency: true,
 * });
 *
 * pool.startHealthChecks();
 * const conn = pool.getConnection();
 * const slot = await conn.getSlot();
 * pool.stopHealthChecks();
 * ```
 */

import { Connection } from '@solana/web3.js';
import EventEmitter from 'eventemitter3';
import type { RpcEndpoint, RpcPoolConfig } from '../types.js';

// ─── Constants ────────────────────────────────────────────────

/** Default health check interval: 30 seconds */
const DEFAULT_HEALTH_CHECK_INTERVAL_MS = 30_000;

/** Default max consecutive failures before marking unhealthy */
const DEFAULT_MAX_CONSECUTIVE_FAILURES = 3;

/** Default commitment level for connections */
const DEFAULT_COMMITMENT = 'confirmed' as const;

/** Default max retries for sendRequest */
const DEFAULT_MAX_RETRIES = 3;

/** Default base delay for exponential backoff */
const DEFAULT_RETRY_BASE_DELAY_MS = 500;

/** Number of latency samples to keep for rolling average */
const LATENCY_WINDOW_SIZE = 10;

/** Re-check unhealthy endpoints every N health-check cycles */
const RECOVERY_CYCLE_INTERVAL = 5;

/** Rate limit tracking window in ms */
const RATE_LIMIT_WINDOW_MS = 1_000;

// ─── Default Endpoints ───────────────────────────────────────

/**
 * Default RPC endpoints for Solana mainnet.
 * Add your own Helius, QuickNode, or Triton endpoints for production use.
 */
export const DEFAULT_RPC_ENDPOINTS: RpcEndpoint[] = [
  {
    url: 'https://api.mainnet-beta.solana.com',
    weight: 1,
    rateLimit: 10,
    supportsJito: false,
    provider: 'solana',
  },
];

// ─── Internal Types ──────────────────────────────────────────

/** Events emitted by the RPC pool */
interface RpcPoolEvents {
  'endpoint:healthy': (endpoint: RpcEndpoint) => void;
  'endpoint:unhealthy': (endpoint: RpcEndpoint) => void;
  'endpoint:latency': (endpoint: RpcEndpoint, latencyMs: number) => void;
}

/** Internal state tracked per endpoint beyond the public RpcEndpoint fields */
interface EndpointState {
  /** The public endpoint descriptor (mutated in-place for stats) */
  endpoint: RpcEndpoint;
  /** Cached Connection instance */
  connection: Connection;
  /** Rolling latency samples (most recent at end) */
  latencySamples: number[];
  /** Timestamps of requests in the current rate-limit window */
  requestTimestamps: number[];
  /** Counter for recovery cycling */
  healthCheckCyclesSinceUnhealthy: number;
}

// ─── RpcPool ─────────────────────────────────────────────────

/**
 * Production-grade Solana RPC connection pool.
 *
 * Distributes requests across multiple endpoints using health-aware
 * weighted random selection, with automatic failover, rate limiting,
 * and periodic health checks.
 */
export class RpcPool extends EventEmitter<RpcPoolEvents> {
  private readonly states: Map<string, EndpointState> = new Map();
  private readonly config: Required<RpcPoolConfig>;
  private healthCheckTimer: ReturnType<typeof setInterval> | undefined;
  private healthCheckCycle = 0;

  /**
   * Create a new RPC connection pool.
   *
   * @param config - Pool configuration with endpoints and tuning knobs
   * @throws {Error} If no endpoints are provided
   */
  constructor(config: RpcPoolConfig) {
    super();

    if (!config.endpoints.length) {
      throw new Error('RpcPool requires at least one endpoint');
    }

    this.config = {
      endpoints: config.endpoints,
      healthCheckIntervalMs: config.healthCheckIntervalMs ?? DEFAULT_HEALTH_CHECK_INTERVAL_MS,
      maxConsecutiveFailures: config.maxConsecutiveFailures ?? DEFAULT_MAX_CONSECUTIVE_FAILURES,
      preferLowLatency: config.preferLowLatency ?? true,
      commitment: config.commitment ?? DEFAULT_COMMITMENT,
      maxRetries: config.maxRetries ?? DEFAULT_MAX_RETRIES,
      retryBaseDelayMs: config.retryBaseDelayMs ?? DEFAULT_RETRY_BASE_DELAY_MS,
    };

    for (const ep of this.config.endpoints) {
      this.registerEndpoint(ep);
    }
  }

  // ── Connection Getters ──────────────────────────────────────

  /**
   * Returns the best available connection using weighted random selection
   * biased toward healthy, low-latency endpoints.
   *
   * @returns A Solana Connection instance
   * @throws {Error} If no healthy endpoints are available
   */
  getConnection(): Connection {
    const state = this.selectEndpoint();
    this.recordRequest(state);
    return state.connection;
  }

  /**
   * Returns a connection that supports Jito bundle submission.
   *
   * @returns A Solana Connection instance with Jito support
   * @throws {Error} If no healthy Jito-capable endpoints are available
   */
  getJitoConnection(): Connection {
    const state = this.selectEndpoint(true);
    this.recordRequest(state);
    return state.connection;
  }

  /**
   * Returns all healthy connections.
   *
   * @returns Array of healthy Solana Connection instances
   */
  getAllConnections(): Connection[] {
    const healthy = this.getHealthyStates();
    if (healthy.length === 0) {
      // Fallback: return all connections when none are healthy
      return [...this.states.values()].map((s) => s.connection);
    }
    return healthy.map((s) => s.connection);
  }

  // ── Health Checks ───────────────────────────────────────────

  /**
   * Ping all endpoints with `getSlot()`, updating latency, health,
   * and emitting events for state changes.
   */
  async healthCheck(): Promise<void> {
    this.healthCheckCycle++;

    const checks = [...this.states.values()].map(async (state) => {
      const wasHealthy = state.endpoint.healthy !== false;
      const shouldCheck =
        wasHealthy ||
        state.healthCheckCyclesSinceUnhealthy % RECOVERY_CYCLE_INTERVAL === 0;

      if (!shouldCheck) {
        state.healthCheckCyclesSinceUnhealthy++;
        return;
      }

      const start = performance.now();
      try {
        await state.connection.getSlot();
        const latency = performance.now() - start;

        // Update rolling latency
        state.latencySamples.push(latency);
        if (state.latencySamples.length > LATENCY_WINDOW_SIZE) {
          state.latencySamples.shift();
        }
        const avgLatency =
          state.latencySamples.reduce((a, b) => a + b, 0) / state.latencySamples.length;

        state.endpoint.latencyMs = Math.round(avgLatency * 100) / 100;
        state.endpoint.consecutiveFailures = 0;
        state.endpoint.lastHealthCheck = Date.now();
        state.healthCheckCyclesSinceUnhealthy = 0;

        if (!wasHealthy) {
          state.endpoint.healthy = true;
          this.emit('endpoint:healthy', { ...state.endpoint });
        } else {
          state.endpoint.healthy = true;
        }

        this.emit('endpoint:latency', { ...state.endpoint }, state.endpoint.latencyMs);
      } catch {
        const failures = (state.endpoint.consecutiveFailures ?? 0) + 1;
        state.endpoint.consecutiveFailures = failures;
        state.healthCheckCyclesSinceUnhealthy++;

        if (failures >= this.config.maxConsecutiveFailures && wasHealthy) {
          state.endpoint.healthy = false;
          this.emit('endpoint:unhealthy', { ...state.endpoint });
        }
      }
    });

    await Promise.allSettled(checks);
  }

  /**
   * Start periodic health checks.
   * Safe to call multiple times — subsequent calls are no-ops.
   */
  startHealthChecks(): void {
    if (this.healthCheckTimer !== undefined) return;
    // Run an initial check immediately
    void this.healthCheck();
    this.healthCheckTimer = setInterval(() => {
      void this.healthCheck();
    }, this.config.healthCheckIntervalMs);
    // Allow the process to exit even if the timer is running
    if (typeof this.healthCheckTimer === 'object' && 'unref' in this.healthCheckTimer) {
      this.healthCheckTimer.unref();
    }
  }

  /**
   * Stop periodic health checks and release the timer.
   */
  stopHealthChecks(): void {
    if (this.healthCheckTimer !== undefined) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = undefined;
    }
  }

  // ── Endpoint Management ─────────────────────────────────────

  /**
   * Returns current stats for all endpoints.
   *
   * @returns Snapshot of all endpoint descriptors (copies, not references)
   */
  getEndpointStats(): RpcEndpoint[] {
    return [...this.states.values()].map((s) => ({ ...s.endpoint }));
  }

  /**
   * Manually mark an endpoint as unhealthy.
   *
   * @param url - The RPC URL to mark unhealthy
   */
  markUnhealthy(url: string): void {
    const state = this.states.get(url);
    if (!state) return;

    const wasHealthy = state.endpoint.healthy !== false;
    state.endpoint.healthy = false;
    state.endpoint.consecutiveFailures = this.config.maxConsecutiveFailures;
    state.healthCheckCyclesSinceUnhealthy = 0;

    if (wasHealthy) {
      this.emit('endpoint:unhealthy', { ...state.endpoint });
    }
  }

  /**
   * Add a new endpoint at runtime.
   *
   * @param endpoint - The endpoint descriptor to add
   * @throws {Error} If an endpoint with the same URL already exists
   */
  addEndpoint(endpoint: RpcEndpoint): void {
    if (this.states.has(endpoint.url)) {
      throw new Error(`Endpoint already exists: ${endpoint.url}`);
    }
    this.registerEndpoint(endpoint);
  }

  /**
   * Remove an endpoint from the pool.
   *
   * @param url - The RPC URL to remove
   * @throws {Error} If removing the last endpoint
   */
  removeEndpoint(url: string): void {
    if (this.states.size <= 1) {
      throw new Error('Cannot remove the last endpoint from the pool');
    }
    this.states.delete(url);
  }

  // ── Request Wrapper ─────────────────────────────────────────

  /**
   * Send an RPC request through the pool with automatic retries
   * and exponential backoff. Picks the best endpoint for each attempt.
   *
   * @typeParam T - Expected response type
   * @param method - Solana JSON-RPC method name (e.g. 'getSlot')
   * @param params - Parameters to pass to the RPC method
   * @returns The deserialized RPC response
   * @throws {Error} After all retries are exhausted
   */
  async sendRequest<T>(method: string, params: unknown[] = []): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      const state = this.selectEndpoint();
      this.recordRequest(state);

      try {
        // Use the Connection's internal RPC client via _rpcRequest
        const connection = state.connection as Connection & {
          _rpcRequest: (method: string, params: unknown[]) => Promise<{ result: T }>;
        };

        const response = await connection._rpcRequest(method, params);
        return response.result;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));

        // Track the failure for health scoring
        state.endpoint.consecutiveFailures =
          (state.endpoint.consecutiveFailures ?? 0) + 1;

        if (
          state.endpoint.consecutiveFailures >= this.config.maxConsecutiveFailures
        ) {
          state.endpoint.healthy = false;
          this.emit('endpoint:unhealthy', { ...state.endpoint });
        }

        // Exponential backoff before retry (skip on last attempt)
        if (attempt < this.config.maxRetries) {
          const delay =
            this.config.retryBaseDelayMs * Math.pow(2, attempt) +
            Math.random() * this.config.retryBaseDelayMs;
          await this.sleep(delay);
        }
      }
    }

    throw lastError ?? new Error(`sendRequest(${method}) failed after ${this.config.maxRetries} retries`);
  }

  // ── Private Helpers ─────────────────────────────────────────

  /**
   * Register an endpoint, initializing its internal state and Connection.
   */
  private registerEndpoint(endpoint: RpcEndpoint): void {
    const normalized: RpcEndpoint = {
      ...endpoint,
      healthy: endpoint.healthy ?? true,
      latencyMs: endpoint.latencyMs ?? 0,
      consecutiveFailures: endpoint.consecutiveFailures ?? 0,
      lastHealthCheck: endpoint.lastHealthCheck ?? 0,
    };

    const connection = new Connection(normalized.url, {
      commitment: this.config.commitment,
    });

    this.states.set(normalized.url, {
      endpoint: normalized,
      connection,
      latencySamples: [],
      requestTimestamps: [],
      healthCheckCyclesSinceUnhealthy: 0,
    });
  }

  /**
   * Get all endpoint states that are currently healthy.
   */
  private getHealthyStates(requireJito = false): EndpointState[] {
    const now = Date.now();
    return [...this.states.values()].filter((s) => {
      if (s.endpoint.healthy === false) return false;
      if (requireJito && !s.endpoint.supportsJito) return false;
      // Filter out endpoints at their rate limit
      if (!this.isUnderRateLimit(s, now)) return false;
      return true;
    });
  }

  /**
   * Select the best endpoint using weighted random with health-aware filtering.
   *
   * Algorithm:
   * 1. Filter to healthy, rate-limit-compliant endpoints (optionally Jito-only)
   * 2. If preferLowLatency, sort by latency ascending
   * 3. Apply weighted random selection
   * 4. Fallback: return any endpoint if all preferred ones are excluded
   */
  private selectEndpoint(requireJito = false): EndpointState {
    let candidates = this.getHealthyStates(requireJito);

    // Fallback: if no healthy endpoints, use all endpoints
    if (candidates.length === 0) {
      candidates = [...this.states.values()];
      if (requireJito) {
        const jitoCandidates = candidates.filter((s) => s.endpoint.supportsJito);
        if (jitoCandidates.length > 0) {
          candidates = jitoCandidates;
        }
      }
    }

    if (candidates.length === 0) {
      throw new Error(
        requireJito
          ? 'No Jito-capable endpoints available in the pool'
          : 'No endpoints available in the pool',
      );
    }

    // Sort by latency if preferred (stable sort keeps weight order for ties)
    if (this.config.preferLowLatency) {
      candidates.sort(
        (a, b) => (a.endpoint.latencyMs ?? 0) - (b.endpoint.latencyMs ?? 0),
      );
    }

    // Weighted random selection
    return this.weightedRandom(candidates);
  }

  /**
   * Weighted random selection among candidate endpoint states.
   * Endpoints with higher weight values receive proportionally more traffic.
   */
  private weightedRandom(candidates: EndpointState[]): EndpointState {
    const totalWeight = candidates.reduce((sum, s) => sum + s.endpoint.weight, 0);
    let random = Math.random() * totalWeight;

    for (const candidate of candidates) {
      random -= candidate.endpoint.weight;
      if (random <= 0) {
        return candidate;
      }
    }

    // Should not reach here, but return last candidate as safety
    return candidates[candidates.length - 1]!;
  }

  /**
   * Check whether an endpoint is under its per-second rate limit.
   */
  private isUnderRateLimit(state: EndpointState, now: number): boolean {
    // Prune timestamps outside the window
    const windowStart = now - RATE_LIMIT_WINDOW_MS;
    state.requestTimestamps = state.requestTimestamps.filter((t) => t > windowStart);
    return state.requestTimestamps.length < state.endpoint.rateLimit;
  }

  /**
   * Record a request timestamp for rate limiting.
   */
  private recordRequest(state: EndpointState): void {
    state.requestTimestamps.push(Date.now());
  }

  /**
   * Sleep utility for exponential backoff.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
