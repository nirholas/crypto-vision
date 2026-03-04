/**
 * Order Router — Multi-RPC Order Submission & Confirmation Tracking
 *
 * Routes trade transactions to the optimal RPC endpoint, supports multi-RPC
 * simultaneous submission for speed, tracks confirmations, and handles
 * landing failures with intelligent retry logic.
 *
 * Features:
 * - Multi-RPC simultaneous submission (first confirmation wins)
 * - WebSocket-based confirmation tracking with polling fallback
 * - Landing failure detection with nonce/blockhash analysis
 * - Per-endpoint performance tracking
 * - Configurable retry logic with exponential backoff
 * - Ghost transaction detection
 * - Full integration with SwarmEventBus for coordination
 *
 * @example
 * ```typescript
 * import { RpcPool } from '../infra/rpc-pool.js';
 * import { SwarmEventBus } from '../infra/event-bus.js';
 * import { OrderRouter, DEFAULT_ROUTER_CONFIG } from './order-router.js';
 *
 * const pool = new RpcPool({ endpoints: [...] });
 * const eventBus = SwarmEventBus.getInstance();
 * const router = new OrderRouter(pool, DEFAULT_ROUTER_CONFIG, eventBus);
 *
 * const result = await router.submitOrder(signedTx, {
 *   skipPreflight: true,
 *   commitment: 'confirmed',
 *   maxRetries: 3,
 *   multiRpc: true,
 *   timeoutMs: 30_000,
 * });
 *
 * console.log(`TX ${result.signature} — ${result.status} via ${result.endpoint}`);
 * ```
 */

import {
  type Commitment,
  type Connection,
  type Transaction,
  type VersionedTransaction,
} from '@solana/web3.js';
import bs58 from 'bs58';

import { SwarmEventBus } from '../infra/event-bus.js';
import type { RpcPool } from '../infra/rpc-pool.js';

// ─── Types ────────────────────────────────────────────────────

/** Options controlling how an order is submitted and confirmed */
export interface SubmitOptions {
  /** Whether to skip preflight simulation */
  skipPreflight: boolean;
  /** Commitment level for confirmation */
  commitment: Commitment;
  /** Max retries on failure */
  maxRetries: number;
  /** Whether to submit to multiple RPCs simultaneously */
  multiRpc: boolean;
  /** Timeout for the entire submission+confirmation flow (ms) */
  timeoutMs: number;
  /** Priority fee in micro-lamports */
  priorityFee?: number;
  /** Whether to use Jito for submission */
  useJito?: boolean;
}

/** Result of an order submission */
export interface OrderResult {
  /** Transaction signature (base58) */
  signature: string;
  /** Current status of the order */
  status: 'submitted' | 'confirmed' | 'finalized' | 'failed' | 'timeout';
  /** Which RPC endpoint confirmed first */
  endpoint: string;
  /** Epoch ms when submitted */
  submittedAt: number;
  /** Epoch ms when confirmed */
  confirmedAt?: number;
  /** Time from submission to confirmation (ms) */
  latencyMs?: number;
  /** Slot of the confirmation */
  slot?: number;
  /** Error message if failed */
  error?: string;
  /** Number of retries performed */
  retries: number;
}

/** Status of an in-flight or completed order */
export interface OrderStatus {
  /** Transaction signature */
  signature: string;
  /** Current status */
  status: 'pending' | 'submitted' | 'processed' | 'confirmed' | 'finalized' | 'failed' | 'timeout' | 'ghost';
  /** Slot the TX was included in */
  slot?: number;
  /** Confirmation count */
  confirmations?: number;
  /** Error message if failed */
  error?: string;
  /** Epoch ms when last updated */
  updatedAt: number;
}

/** Transaction confirmation details */
export interface TransactionConfirmation {
  /** Transaction signature */
  signature: string;
  /** The slot the TX landed in */
  slot: number;
  /** Whether the TX had an error */
  err: unknown;
  /** Final commitment level reached */
  commitment: Commitment;
  /** Epoch ms when confirmed */
  confirmedAt: number;
}

/** Per-endpoint performance record */
export interface EndpointPerformance {
  /** Total transactions submitted through this endpoint */
  submitted: number;
  /** Total transactions confirmed through this endpoint */
  confirmed: number;
  /** Average landing latency in ms */
  avgLatencyMs: number;
  /** Total latency samples for computing average */
  totalLatencyMs: number;
}

/** Aggregate router statistics */
export interface RouterStats {
  /** Total orders submitted */
  totalSubmitted: number;
  /** Total orders confirmed */
  totalConfirmed: number;
  /** Total orders failed */
  totalFailed: number;
  /** Average landing time in ms */
  avgLandingTimeMs: number;
  /** Confirmation success rate (0–1) */
  successRate: number;
  /** Per-endpoint performance breakdown */
  endpointPerformance: Record<string, { submitted: number; confirmed: number; avgLatencyMs: number }>;
}

/** Router configuration */
export interface RouterConfig {
  /** Default commitment level */
  defaultCommitment: Commitment;
  /** Default timeout for confirmation (ms) */
  defaultTimeoutMs: number;
  /** Polling interval for signature status fallback (ms) */
  pollIntervalMs: number;
  /** Max signatures to keep in recent history */
  maxRecentSignatures: number;
  /** Whether to attempt retry with fresh blockhash on expiry */
  retryOnBlockhashExpiry: boolean;
  /** Backoff base delay for retries (ms) */
  retryBaseDelayMs: number;
  /** Max concurrent multi-RPC submissions */
  maxConcurrentSubmissions: number;
  /** Ghost transaction detection: how long to wait before declaring ghost (ms) */
  ghostDetectionTimeoutMs: number;
}

// ─── Constants ────────────────────────────────────────────────

/** Default router configuration */
export const DEFAULT_ROUTER_CONFIG: RouterConfig = {
  defaultCommitment: 'confirmed',
  defaultTimeoutMs: 30_000,
  pollIntervalMs: 2_000,
  maxRecentSignatures: 500,
  retryOnBlockhashExpiry: true,
  retryBaseDelayMs: 500,
  maxConcurrentSubmissions: 10,
  ghostDetectionTimeoutMs: 60_000,
};

/** Confirmation status progression for comparison */
const COMMITMENT_LEVELS: Record<string, number> = {
  processed: 0,
  confirmed: 1,
  finalized: 2,
};

// ─── Internal Types ───────────────────────────────────────────

/** Internal order tracking record */
interface TrackedOrder {
  signature: string;
  status: OrderStatus['status'];
  endpoint: string;
  submittedAt: number;
  confirmedAt?: number;
  slot?: number;
  error?: string;
  retries: number;
  /** AbortController for cancelling in-flight operations */
  abortController: AbortController;
  /** Polling timer handle */
  pollTimer?: ReturnType<typeof setInterval>;
}

// ─── OrderRouter ──────────────────────────────────────────────

/**
 * Routes transactions to RPC endpoints with multi-RPC submission,
 * confirmation tracking, and intelligent retry logic.
 */
export class OrderRouter {
  private readonly config: RouterConfig;
  private readonly rpcPool: RpcPool;
  private readonly eventBus: SwarmEventBus;

  /** All tracked orders keyed by signature */
  private readonly orders: Map<string, TrackedOrder> = new Map();

  /** Recent signatures in insertion order */
  private readonly recentSignatures: string[] = [];

  /** Per-endpoint performance stats */
  private readonly endpointStats: Map<string, EndpointPerformance> = new Map();

  /** Aggregate counters */
  private totalSubmitted = 0;
  private totalConfirmed = 0;
  private totalFailed = 0;
  private totalLandingTimeMs = 0;
  private landingTimeSamples = 0;

  constructor(rpcPool: RpcPool, config: RouterConfig, eventBus: SwarmEventBus) {
    this.rpcPool = rpcPool;
    this.config = { ...DEFAULT_ROUTER_CONFIG, ...config };
    this.eventBus = eventBus;
  }

  // ── Public API ──────────────────────────────────────────────

  /**
   * Submit a signed transaction to the best available RPC endpoint.
   * If `options.multiRpc` is true, submits to all healthy RPCs simultaneously.
   *
   * @param tx - A signed Transaction or VersionedTransaction
   * @param options - Submission and confirmation options
   * @returns OrderResult with signature, status, and timing information
   */
  async submitOrder(
    tx: VersionedTransaction | Transaction,
    options: SubmitOptions,
  ): Promise<OrderResult> {
    if (options.multiRpc) {
      return this.submitToAll(tx, options);
    }
    return this.submitToSingle(tx, options);
  }

  /**
   * Submit a signed transaction to ALL healthy RPC endpoints simultaneously.
   * The first confirmation wins — all other pending submissions are cancelled.
   *
   * @param tx - A signed Transaction or VersionedTransaction
   * @param options - Submission and confirmation options
   * @returns OrderResult from the first endpoint to confirm
   */
  async submitToAll(
    tx: VersionedTransaction | Transaction,
    options: SubmitOptions,
  ): Promise<OrderResult> {
    const serialized = this.serializeTransaction(tx);
    const connections = this.getTargetConnections(options);

    if (connections.length === 0) {
      return this.failedResult('', 'No healthy RPC endpoints available', 0);
    }

    const submittedAt = Date.now();
    const abortController = new AbortController();
    const commitment = options.commitment ?? this.config.defaultCommitment;
    const timeoutMs = options.timeoutMs ?? this.config.defaultTimeoutMs;

    // Submit to all connections simultaneously
    const submissions = connections.map(async ({ connection, endpoint }) => {
      this.recordSubmission(endpoint);

      try {
        const signature = await connection.sendRawTransaction(serialized, {
          skipPreflight: options.skipPreflight,
          maxRetries: 0, // We handle retries ourselves
          preflightCommitment: commitment,
        });

        // Track this order
        const tracked: TrackedOrder = {
          signature,
          status: 'submitted',
          endpoint,
          submittedAt,
          retries: 0,
          abortController,
        };
        this.trackOrder(tracked);

        this.emitEvent('order:submitted', {
          signature,
          endpoint,
          multiRpc: true,
          totalEndpoints: connections.length,
        });

        // Wait for confirmation on this endpoint
        const confirmation = await this.pollForConfirmation(
          connection,
          signature,
          commitment,
          timeoutMs - (Date.now() - submittedAt),
          abortController.signal,
        );

        return { signature, endpoint, confirmation };
      } catch (err) {
        if (abortController.signal.aborted) {
          return undefined; // Another endpoint won
        }
        throw err;
      }
    });

    try {
      // Race all submissions — first to confirm wins
      const winner = await this.raceWithTimeout(
        submissions,
        timeoutMs,
        abortController,
      );

      if (!winner) {
        // All submissions failed or timed out — try to detect ghost TXs
        const knownSig = this.findSignatureFromSubmissions();
        return this.handleTimeoutOrFailure(knownSig, submittedAt, connections[0]!.endpoint);
      }

      // Cancel all other in-flight submissions
      abortController.abort();

      const latencyMs = Date.now() - submittedAt;
      this.recordConfirmation(winner.endpoint, latencyMs);

      const order = this.orders.get(winner.signature);
      if (order) {
        order.status = 'confirmed';
        order.confirmedAt = Date.now();
        order.slot = winner.confirmation.slot;
      }

      this.emitEvent('order:confirmed', {
        signature: winner.signature,
        endpoint: winner.endpoint,
        latencyMs,
        slot: winner.confirmation.slot,
        multiRpc: true,
      });

      return {
        signature: winner.signature,
        status: winner.confirmation.err ? 'failed' : 'confirmed',
        endpoint: winner.endpoint,
        submittedAt,
        confirmedAt: Date.now(),
        latencyMs,
        slot: winner.confirmation.slot,
        error: winner.confirmation.err ? String(winner.confirmation.err) : undefined,
        retries: 0,
      };
    } catch (err) {
      abortController.abort();
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.totalFailed++;

      this.emitEvent('order:failed', {
        error: errorMsg,
        multiRpc: true,
      });

      return this.failedResult('', errorMsg, 0);
    }
  }

  /**
   * Query the current status of a previously submitted order.
   *
   * @param signature - Base58-encoded transaction signature
   * @returns Current order status
   */
  async getOrderStatus(signature: string): Promise<OrderStatus> {
    // Check local tracking first
    const tracked = this.orders.get(signature);
    if (tracked && (tracked.status === 'confirmed' || tracked.status === 'finalized' || tracked.status === 'failed')) {
      return {
        signature,
        status: tracked.status,
        slot: tracked.slot,
        error: tracked.error,
        updatedAt: tracked.confirmedAt ?? Date.now(),
      };
    }

    // Query the chain for up-to-date status
    try {
      const connection = this.rpcPool.getConnection();
      const statuses = await connection.getSignatureStatuses([signature]);
      const status = statuses.value[0];

      if (!status) {
        // Not found — might be pending or ghost
        const age = tracked ? Date.now() - tracked.submittedAt : 0;
        const isGhost = age > this.config.ghostDetectionTimeoutMs;
        return {
          signature,
          status: isGhost ? 'ghost' : 'pending',
          updatedAt: Date.now(),
        };
      }

      if (status.err) {
        if (tracked) tracked.status = 'failed';
        return {
          signature,
          status: 'failed',
          slot: status.slot,
          error: JSON.stringify(status.err),
          confirmations: status.confirmations ?? undefined,
          updatedAt: Date.now(),
        };
      }

      const commitment = status.confirmationStatus ?? 'processed';
      const mappedStatus = commitment === 'finalized'
        ? 'finalized' as const
        : commitment === 'confirmed'
          ? 'confirmed' as const
          : 'processed' as const;

      if (tracked) {
        tracked.status = mappedStatus;
        tracked.slot = status.slot;
      }

      return {
        signature,
        status: mappedStatus,
        slot: status.slot,
        confirmations: status.confirmations ?? undefined,
        updatedAt: Date.now(),
      };
    } catch {
      return {
        signature,
        status: tracked?.status ?? 'pending',
        updatedAt: Date.now(),
      };
    }
  }

  /**
   * Wait for a transaction to reach a specific commitment level.
   * Uses WebSocket subscription with polling fallback.
   *
   * @param signature - Base58-encoded transaction signature
   * @param commitment - Target commitment level (default: config default)
   * @param timeoutMs - Max time to wait (default: config default)
   * @returns Confirmation details once the commitment level is reached
   * @throws {Error} If the timeout is reached or the transaction fails
   */
  async waitForConfirmation(
    signature: string,
    commitment?: Commitment,
    timeoutMs?: number,
  ): Promise<TransactionConfirmation> {
    const targetCommitment = commitment ?? this.config.defaultCommitment;
    const timeout = timeoutMs ?? this.config.defaultTimeoutMs;
    const connection = this.rpcPool.getConnection();

    return this.pollForConfirmation(
      connection,
      signature,
      targetCommitment,
      timeout,
    );
  }

  /**
   * Get all recently tracked transaction signatures.
   *
   * @returns Array of base58-encoded signatures, newest first
   */
  getRecentSignatures(): string[] {
    return [...this.recentSignatures].reverse();
  }

  /**
   * Get aggregate and per-endpoint routing statistics.
   *
   * @returns Current router stats snapshot
   */
  getStats(): RouterStats {
    const endpointPerformance: RouterStats['endpointPerformance'] = {};

    for (const [endpoint, perf] of this.endpointStats) {
      endpointPerformance[endpoint] = {
        submitted: perf.submitted,
        confirmed: perf.confirmed,
        avgLatencyMs: perf.confirmed > 0
          ? Math.round(perf.totalLatencyMs / perf.confirmed)
          : 0,
      };
    }

    return {
      totalSubmitted: this.totalSubmitted,
      totalConfirmed: this.totalConfirmed,
      totalFailed: this.totalFailed,
      avgLandingTimeMs: this.landingTimeSamples > 0
        ? Math.round(this.totalLandingTimeMs / this.landingTimeSamples)
        : 0,
      successRate: this.totalSubmitted > 0
        ? this.totalConfirmed / this.totalSubmitted
        : 0,
      endpointPerformance,
    };
  }

  // ── Private: Single-RPC Submission ──────────────────────────

  /**
   * Submit to a single (best) RPC endpoint with retry logic.
   */
  private async submitToSingle(
    tx: VersionedTransaction | Transaction,
    options: SubmitOptions,
  ): Promise<OrderResult> {
    const serialized = this.serializeTransaction(tx);
    const commitment = options.commitment ?? this.config.defaultCommitment;
    const timeoutMs = options.timeoutMs ?? this.config.defaultTimeoutMs;
    const maxRetries = options.maxRetries ?? 3;
    const submittedAt = Date.now();

    let lastError = '';
    let retryCount = 0;
    let finalSignature = '';

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const abortController = new AbortController();

      try {
        const connection = options.useJito
          ? this.rpcPool.getJitoConnection()
          : this.rpcPool.getConnection();

        const endpoint = this.getConnectionUrl(connection);
        this.recordSubmission(endpoint);

        const signature = await connection.sendRawTransaction(serialized, {
          skipPreflight: options.skipPreflight,
          maxRetries: 0,
          preflightCommitment: commitment,
        });

        finalSignature = signature;

        const tracked: TrackedOrder = {
          signature,
          status: 'submitted',
          endpoint,
          submittedAt,
          retries: attempt,
          abortController,
        };
        this.trackOrder(tracked);

        this.emitEvent('order:submitted', {
          signature,
          endpoint,
          multiRpc: false,
          attempt: attempt + 1,
        });

        // Wait for confirmation
        const remainingMs = timeoutMs - (Date.now() - submittedAt);
        if (remainingMs <= 0) {
          abortController.abort();
          return this.handleTimeoutOrFailure(signature, submittedAt, endpoint);
        }

        const confirmation = await this.pollForConfirmation(
          connection,
          signature,
          commitment,
          remainingMs,
          abortController.signal,
        );

        const latencyMs = Date.now() - submittedAt;
        this.recordConfirmation(endpoint, latencyMs);

        const order = this.orders.get(signature);
        if (order) {
          order.status = 'confirmed';
          order.confirmedAt = Date.now();
          order.slot = confirmation.slot;
        }

        this.emitEvent('order:confirmed', {
          signature,
          endpoint,
          latencyMs,
          slot: confirmation.slot,
          multiRpc: false,
        });

        return {
          signature,
          status: confirmation.err ? 'failed' : 'confirmed',
          endpoint,
          submittedAt,
          confirmedAt: Date.now(),
          latencyMs,
          slot: confirmation.slot,
          error: confirmation.err ? String(confirmation.err) : undefined,
          retries: attempt,
        };
      } catch (err) {
        abortController.abort();
        lastError = err instanceof Error ? err.message : String(err);
        retryCount = attempt;

        // Check if this is a blockhash-expired error — safe to retry
        if (this.isBlockhashExpiredError(lastError) && this.config.retryOnBlockhashExpiry) {
          this.emitEvent('order:retry', {
            signature: finalSignature,
            reason: 'blockhash_expired',
            attempt: attempt + 1,
          });
          // Backoff before retry
          await this.sleep(this.config.retryBaseDelayMs * Math.pow(2, attempt));
          continue;
        }

        // Non-retryable error
        if (!this.isRetryableError(lastError)) {
          break;
        }

        // Retryable error — backoff and try again
        this.emitEvent('order:retry', {
          signature: finalSignature,
          reason: 'retryable_error',
          error: lastError,
          attempt: attempt + 1,
        });
        await this.sleep(this.config.retryBaseDelayMs * Math.pow(2, attempt));
      }
    }

    // All retries exhausted
    this.totalFailed++;

    if (finalSignature) {
      const order = this.orders.get(finalSignature);
      if (order) {
        order.status = 'failed';
        order.error = lastError;
      }
    }

    this.emitEvent('order:failed', {
      signature: finalSignature,
      error: lastError,
      retries: retryCount,
    });

    return this.failedResult(finalSignature, lastError, retryCount);
  }

  // ── Private: Confirmation Polling ───────────────────────────

  /**
   * Poll `getSignatureStatuses` until the transaction reaches the target
   * commitment level or the timeout/abort signal fires.
   */
  private async pollForConfirmation(
    connection: Connection,
    signature: string,
    targetCommitment: Commitment,
    timeoutMs: number,
    signal?: AbortSignal,
  ): Promise<TransactionConfirmation> {
    const targetLevel = COMMITMENT_LEVELS[targetCommitment] ?? 1;
    const deadline = Date.now() + timeoutMs;

    // Try WebSocket-based confirmation first for speed
    const wsPromise = this.tryWebSocketConfirmation(
      connection,
      signature,
      targetCommitment,
      timeoutMs,
      signal,
    );

    // Also poll as fallback in case WS is slow or unavailable
    const pollPromise = new Promise<TransactionConfirmation>((resolve, reject) => {
      const poll = async (): Promise<void> => {
        if (signal?.aborted) {
          reject(new Error('Aborted'));
          return;
        }

        if (Date.now() > deadline) {
          reject(new Error(`Confirmation timeout after ${timeoutMs}ms`));
          return;
        }

        try {
          const statuses = await connection.getSignatureStatuses([signature]);
          const status = statuses.value[0];

          if (status) {
            if (status.err) {
              resolve({
                signature,
                slot: status.slot,
                err: status.err,
                commitment: status.confirmationStatus ?? 'processed',
                confirmedAt: Date.now(),
              });
              return;
            }

            const currentLevel = COMMITMENT_LEVELS[status.confirmationStatus ?? 'processed'] ?? 0;
            if (currentLevel >= targetLevel) {
              // Update tracked order status through the progression
              const tracked = this.orders.get(signature);
              if (tracked) {
                tracked.status = status.confirmationStatus === 'finalized'
                  ? 'finalized'
                  : status.confirmationStatus === 'confirmed'
                    ? 'confirmed'
                    : 'processed';
                tracked.slot = status.slot;

                this.emitEvent('order:status_change', {
                  signature,
                  status: tracked.status,
                  slot: status.slot,
                });
              }

              resolve({
                signature,
                slot: status.slot,
                err: null,
                commitment: status.confirmationStatus ?? targetCommitment,
                confirmedAt: Date.now(),
              });
              return;
            }

            // Emit intermediate status change
            const tracked = this.orders.get(signature);
            if (tracked) {
              const newStatus = status.confirmationStatus === 'processed' ? 'processed' as const : tracked.status;
              if (newStatus !== tracked.status) {
                tracked.status = newStatus;
                this.emitEvent('order:status_change', {
                  signature,
                  status: newStatus,
                  slot: status.slot,
                });
              }
            }
          }
        } catch {
          // Polling errors are non-fatal — try again next interval
        }

        // Schedule next poll
        const delay = Math.min(this.config.pollIntervalMs, deadline - Date.now());
        if (delay > 0) {
          await this.sleep(delay);
          await poll();
        } else {
          reject(new Error(`Confirmation timeout after ${timeoutMs}ms`));
        }
      };

      void poll();
    });

    // Return whichever resolves first (WS or polling)
    return Promise.race([wsPromise, pollPromise]);
  }

  /**
   * Attempt WebSocket-based confirmation using connection.confirmTransaction.
   * Falls through to polling if WS is unavailable.
   */
  private async tryWebSocketConfirmation(
    connection: Connection,
    signature: string,
    commitment: Commitment,
    timeoutMs: number,
    signal?: AbortSignal,
  ): Promise<TransactionConfirmation> {
    return new Promise<TransactionConfirmation>((resolve, reject) => {
      if (signal?.aborted) {
        reject(new Error('Aborted'));
        return;
      }

      const abortHandler = (): void => {
        reject(new Error('Aborted'));
      };
      signal?.addEventListener('abort', abortHandler, { once: true });

      const timeout = setTimeout(() => {
        signal?.removeEventListener('abort', abortHandler);
        reject(new Error(`WS confirmation timeout after ${timeoutMs}ms`));
      }, timeoutMs);

      // Use the built-in confirmTransaction if available
      void connection
        .confirmTransaction(
          {
            signature,
            blockhash: '', // Empty — the connection will handle recent blockhash
            lastValidBlockHeight: Number.MAX_SAFE_INTEGER,
          },
          commitment,
        )
        .then((result) => {
          clearTimeout(timeout);
          signal?.removeEventListener('abort', abortHandler);

          resolve({
            signature,
            slot: result.context.slot,
            err: result.value.err,
            commitment,
            confirmedAt: Date.now(),
          });
        })
        .catch((err: unknown) => {
          clearTimeout(timeout);
          signal?.removeEventListener('abort', abortHandler);
          reject(err instanceof Error ? err : new Error(String(err)));
        });
    });
  }

  // ── Private: Multi-RPC Helpers ──────────────────────────────

  /**
   * Get Connection instances for all target endpoints, respecting options.
   */
  private getTargetConnections(
    options: SubmitOptions,
  ): Array<{ connection: Connection; endpoint: string }> {
    const connections: Array<{ connection: Connection; endpoint: string }> = [];

    if (options.useJito) {
      try {
        const conn = this.rpcPool.getJitoConnection();
        connections.push({ connection: conn, endpoint: this.getConnectionUrl(conn) });
      } catch {
        // No Jito endpoint available — fall through to regular endpoints
      }
    }

    const allConns = this.rpcPool.getAllConnections();
    const endpointStats = this.rpcPool.getEndpointStats();

    for (let i = 0; i < allConns.length && connections.length < this.config.maxConcurrentSubmissions; i++) {
      const conn = allConns[i]!;
      const url = endpointStats[i]?.url ?? this.getConnectionUrl(conn);

      // Skip duplicates (e.g. Jito endpoint already added)
      if (connections.some((c) => c.endpoint === url)) continue;

      connections.push({ connection: conn, endpoint: url });
    }

    return connections;
  }

  /**
   * Race all submission promises, returning the first successful confirmation
   * or undefined if all fail/timeout.
   */
  private async raceWithTimeout<T>(
    promises: Array<Promise<T | undefined>>,
    timeoutMs: number,
    abortController: AbortController,
  ): Promise<T | undefined> {
    return new Promise<T | undefined>((resolve) => {
      let settled = false;
      let pendingCount = promises.length;

      const timeout = setTimeout(() => {
        if (!settled) {
          settled = true;
          abortController.abort();
          resolve(undefined);
        }
      }, timeoutMs);

      for (const promise of promises) {
        void promise
          .then((result) => {
            if (!settled && result !== undefined) {
              settled = true;
              clearTimeout(timeout);
              resolve(result);
            } else {
              pendingCount--;
              if (pendingCount <= 0 && !settled) {
                settled = true;
                clearTimeout(timeout);
                resolve(undefined);
              }
            }
          })
          .catch(() => {
            pendingCount--;
            if (pendingCount <= 0 && !settled) {
              settled = true;
              clearTimeout(timeout);
              resolve(undefined);
            }
          });
      }
    });
  }

  // ── Private: Landing Failure Handling ───────────────────────

  /**
   * Handle a timeout or failure — check if the TX might have landed
   * (ghost transaction detection).
   */
  private async handleTimeoutOrFailure(
    signature: string,
    submittedAt: number,
    endpoint: string,
  ): Promise<OrderResult> {
    if (!signature) {
      this.totalFailed++;
      return this.failedResult('', 'No signature obtained — submission failed', 0);
    }

    // Check if the TX actually landed despite timeout
    try {
      const connection = this.rpcPool.getConnection();
      const statuses = await connection.getSignatureStatuses([signature]);
      const status = statuses.value[0];

      if (status && !status.err) {
        // TX landed — it was a ghost (we couldn't confirm in time, but it's there)
        const latencyMs = Date.now() - submittedAt;
        this.recordConfirmation(endpoint, latencyMs);

        const tracked = this.orders.get(signature);
        if (tracked) {
          tracked.status = 'confirmed';
          tracked.confirmedAt = Date.now();
          tracked.slot = status.slot;
        }

        this.emitEvent('order:ghost_confirmed', {
          signature,
          slot: status.slot,
          latencyMs,
        });

        return {
          signature,
          status: 'confirmed',
          endpoint,
          submittedAt,
          confirmedAt: Date.now(),
          latencyMs,
          slot: status.slot,
          retries: 0,
        };
      }

      if (status?.err) {
        this.totalFailed++;
        const tracked = this.orders.get(signature);
        if (tracked) {
          tracked.status = 'failed';
          tracked.error = JSON.stringify(status.err);
        }

        return {
          signature,
          status: 'failed',
          endpoint,
          submittedAt,
          error: JSON.stringify(status.err),
          retries: 0,
        };
      }
    } catch {
      // Query failed — treat as timeout
    }

    // TX not found on chain — mark as timeout
    this.totalFailed++;
    const tracked = this.orders.get(signature);
    if (tracked) {
      tracked.status = 'timeout';
      tracked.error = 'Transaction not confirmed within timeout';
    }

    this.emitEvent('order:timeout', {
      signature,
      timeoutMs: Date.now() - submittedAt,
    });

    return {
      signature,
      status: 'timeout',
      endpoint,
      submittedAt,
      error: 'Transaction not confirmed within timeout',
      retries: 0,
    };
  }

  // ── Private: Transaction Serialization ──────────────────────

  /**
   * Serialize a Transaction or VersionedTransaction to a Buffer for sendRawTransaction.
   */
  private serializeTransaction(tx: VersionedTransaction | Transaction): Buffer {
    if ('version' in tx) {
      // VersionedTransaction
      return Buffer.from(tx.serialize());
    }
    // Legacy Transaction
    return tx.serialize();
  }

  // ── Private: Tracking ───────────────────────────────────────

  /**
   * Track an order internally and maintain the recent signatures list.
   */
  private trackOrder(order: TrackedOrder): void {
    this.orders.set(order.signature, order);
    this.recentSignatures.push(order.signature);
    this.totalSubmitted++;

    // Prune old signatures
    while (this.recentSignatures.length > this.config.maxRecentSignatures) {
      const old = this.recentSignatures.shift();
      if (old) this.orders.delete(old);
    }
  }

  /**
   * Record a submission for endpoint stats.
   */
  private recordSubmission(endpoint: string): void {
    const perf = this.endpointStats.get(endpoint) ?? {
      submitted: 0,
      confirmed: 0,
      avgLatencyMs: 0,
      totalLatencyMs: 0,
    };
    perf.submitted++;
    this.endpointStats.set(endpoint, perf);
  }

  /**
   * Record a confirmation for endpoint stats and aggregate landing time.
   */
  private recordConfirmation(endpoint: string, latencyMs: number): void {
    this.totalConfirmed++;
    this.totalLandingTimeMs += latencyMs;
    this.landingTimeSamples++;

    const perf = this.endpointStats.get(endpoint) ?? {
      submitted: 0,
      confirmed: 0,
      avgLatencyMs: 0,
      totalLatencyMs: 0,
    };
    perf.confirmed++;
    perf.totalLatencyMs += latencyMs;
    perf.avgLatencyMs = Math.round(perf.totalLatencyMs / perf.confirmed);
    this.endpointStats.set(endpoint, perf);
  }

  /**
   * Find the first signature from any tracked pending order.
   * Used when multi-RPC submission partially fails.
   */
  private findSignatureFromSubmissions(): string {
    for (const [sig, order] of this.orders) {
      if (order.status === 'submitted') return sig;
    }
    return '';
  }

  // ── Private: Error Classification ───────────────────────────

  /**
   * Check if an error indicates an expired blockhash.
   */
  private isBlockhashExpiredError(error: string): boolean {
    const lower = error.toLowerCase();
    return (
      lower.includes('blockhash not found') ||
      lower.includes('blockhash expired') ||
      lower.includes('block height exceeded')
    );
  }

  /**
   * Check if an error is retryable (transient network/server issues).
   */
  private isRetryableError(error: string): boolean {
    const lower = error.toLowerCase();
    return (
      lower.includes('timeout') ||
      lower.includes('econnrefused') ||
      lower.includes('econnreset') ||
      lower.includes('socket hang up') ||
      lower.includes('429') ||
      lower.includes('rate limit') ||
      lower.includes('too many requests') ||
      lower.includes('service unavailable') ||
      lower.includes('503') ||
      lower.includes('502') ||
      lower.includes('504') ||
      lower.includes('internal server error') ||
      lower.includes('500')
    );
  }

  // ── Private: Connection URL Extraction ──────────────────────

  /**
   * Extract the RPC URL from a Connection instance.
   * Falls back to 'unknown' if not accessible.
   */
  private getConnectionUrl(connection: Connection): string {
    // Connection.rpcEndpoint is a public getter in @solana/web3.js
    try {
      return connection.rpcEndpoint;
    } catch {
      return 'unknown';
    }
  }

  // ── Private: Event Emission ─────────────────────────────────

  /**
   * Emit a trading-category event through the swarm event bus.
   */
  private emitEvent(type: string, payload: Record<string, unknown>): void {
    this.eventBus.emit({
      id: crypto.randomUUID(),
      type,
      category: 'trading',
      source: 'order-router',
      payload,
      timestamp: Date.now(),
    });
  }

  // ── Private: Utilities ──────────────────────────────────────

  /**
   * Create a failed OrderResult.
   */
  private failedResult(signature: string, error: string, retries: number): OrderResult {
    return {
      signature,
      status: 'failed',
      endpoint: '',
      submittedAt: Date.now(),
      error,
      retries,
    };
  }

  /**
   * Sleep for a given number of milliseconds.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
  }
}
