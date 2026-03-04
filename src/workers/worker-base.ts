/**
 * Crypto Vision — Ingestion Worker Base
 *
 * Shared base class for all data ingestion workers providing:
 * - Periodic fetching with configurable intervals
 * - Dual-write to BigQuery + Pub/Sub for reliability
 * - Structured metrics tracking (runs, rows, errors, latency)
 * - Graceful shutdown on SIGTERM / SIGINT
 * - Exponential backoff on consecutive failures (1x → 2x → 4x → max 16x)
 * - Health reporting with isHealthy(), lastRunAt, lastError
 * - Managed mode (orchestrator) vs standalone mode (CLI)
 * - Prometheus metrics per worker
 * - Idempotent execution (safe to re-run)
 *
 * Subclasses implement a single `fetch()` method that returns
 * an array of records. The base class handles all persistence.
 */

import { insertRows } from "../lib/bigquery.js";
import { log } from "../lib/logger.js";
import { closePubSub, publishBatch, type TopicName } from "../lib/pubsub.js";

// ── Types ────────────────────────────────────────────────

export interface WorkerConfig {
    /** Human-readable worker name for logging */
    name: string;
    /** Base poll interval in milliseconds */
    intervalMs: number;
    /** BigQuery table name to insert rows into */
    bqTable: string;
    /** Pub/Sub topic to publish messages to */
    pubsubTopic: TopicName | string;
    /** Maximum batch size per cycle (default: unlimited) */
    batchSize?: number;
    /** Maximum consecutive errors before applying backoff multiplier */
    maxConsecutiveErrors?: number;
    /** Maximum backoff multiplier (caps exponential growth) */
    maxBackoffMultiplier?: number;
    /**
     * When true, don't register process signal handlers and don't call
     * process.exit() on shutdown. Used when running inside an orchestrator.
     */
    managed?: boolean;
}

export interface WorkerMetrics {
    runs: number;
    totalRows: number;
    errors: number;
    consecutiveErrors: number;
    lastRunMs: number;
    lastRunAt: string | null;
    lastErrorAt: string | null;
    lastErrorMsg: string | null;
    uptimeMs: number;
}

export interface WorkerHealthStatus {
    healthy: boolean;
    running: boolean;
    lastRun: string | null;
    lastError: string | null;
    runsTotal: number;
    errorsTotal: number;
    consecutiveErrors: number;
    lastRunDurationMs: number;
    uptimeMs: number;
    totalRows: number;
}

/** Max age (ms) since last successful run before worker is considered unhealthy */
const HEALTH_STALE_THRESHOLD_MULTIPLIER = 3;

// ── Worker Base Class ────────────────────────────────────

export abstract class IngestionWorker {
    protected readonly config: WorkerConfig;
    private running = false;
    private shuttingDown = false;
    private readonly startedAt: number;
    private sleepTimer: ReturnType<typeof setTimeout> | null = null;
    private sleepResolve: (() => void) | null = null;
    private readonly metrics: WorkerMetrics = {
        runs: 0,
        totalRows: 0,
        errors: 0,
        consecutiveErrors: 0,
        lastRunMs: 0,
        lastRunAt: null,
        lastErrorAt: null,
        lastErrorMsg: null,
        uptimeMs: 0,
    };

    constructor(config: WorkerConfig) {
        this.config = {
            maxConsecutiveErrors: 5,
            maxBackoffMultiplier: 16,
            managed: false,
            ...config,
        };
        this.startedAt = Date.now();

        // Only register signal handlers in standalone (non-managed) mode
        if (!this.config.managed) {
            const shutdown = () => this.shutdown();
            process.on("SIGTERM", shutdown);
            process.on("SIGINT", shutdown);
        }
    }

    /**
     * Fetch data from the upstream source.
     * Subclasses must implement this method.
     *
     * @returns Array of records to persist. Each record should have
     *          a `source` field for attribution.
     */
    abstract fetch(): Promise<Record<string, unknown>[]>;

    /** The worker's name. */
    get name(): string {
        return this.config.name;
    }

    /** Whether the worker loop is currently running. */
    get isRunning(): boolean {
        return this.running;
    }

    /**
     * Start the ingestion loop. Runs until shutdown is requested.
     */
    async run(): Promise<void> {
        if (this.running) {
            log.warn({ worker: this.config.name }, "Worker already running");
            return;
        }

        this.running = true;
        this.shuttingDown = false;
        log.info(
            {
                worker: this.config.name,
                intervalMs: this.config.intervalMs,
                bqTable: this.config.bqTable,
                pubsubTopic: this.config.pubsubTopic,
                managed: this.config.managed,
            },
            "Ingestion worker started",
        );

        while (this.running && !this.shuttingDown) {
            await this.executeCycle();
            if (this.running && !this.shuttingDown) {
                await this.sleep(this.getEffectiveInterval());
            }
        }

        log.info(
            { worker: this.config.name, metrics: this.getMetrics() },
            "Ingestion worker stopped",
        );
    }

    /**
     * Execute a single fetch → persist cycle.
     * Can also be called standalone for one-shot ingestion.
     */
    async executeCycle(): Promise<number> {
        const start = Date.now();
        try {
            let rows = await this.fetch();

            // Apply batch size limit if configured
            if (this.config.batchSize && rows.length > this.config.batchSize) {
                rows = rows.slice(0, this.config.batchSize);
            }

            const count = rows.length;

            if (count > 0) {
                // Dual-write: BigQuery + Pub/Sub (both fire-and-forget)
                const [bqResult, psResult] = await Promise.allSettled([
                    insertRows(this.config.bqTable, rows),
                    publishBatch(this.config.pubsubTopic, rows),
                ]);

                if (bqResult.status === "rejected") {
                    log.warn(
                        { worker: this.config.name, err: bqResult.reason?.message },
                        "BigQuery insert failed (non-fatal)",
                    );
                }
                if (psResult.status === "rejected") {
                    log.warn(
                        { worker: this.config.name, err: psResult.reason?.message },
                        "Pub/Sub publish failed (non-fatal)",
                    );
                }
            }

            this.metrics.runs++;
            this.metrics.totalRows += count;
            this.metrics.lastRunMs = Date.now() - start;
            this.metrics.lastRunAt = new Date().toISOString();
            this.metrics.consecutiveErrors = 0;

            log.info(
                {
                    worker: this.config.name,
                    rows: count,
                    durationMs: this.metrics.lastRunMs,
                    run: this.metrics.runs,
                },
                "Ingestion cycle complete",
            );

            return count;
        } catch (err: unknown) {
            this.metrics.errors++;
            this.metrics.consecutiveErrors++;
            this.metrics.lastRunMs = Date.now() - start;
            this.metrics.lastErrorAt = new Date().toISOString();

            const message = err instanceof Error ? err.message : String(err);
            this.metrics.lastErrorMsg = message;

            log.error(
                {
                    worker: this.config.name,
                    err: message,
                    consecutiveErrors: this.metrics.consecutiveErrors,
                    durationMs: this.metrics.lastRunMs,
                },
                "Ingestion cycle failed",
            );

            return 0;
        }
    }

    /**
     * Calculate the effective interval with backoff for consecutive errors.
     * Doubles the interval for each consecutive error up to the max multiplier.
     */
    private getEffectiveInterval(): number {
        if (this.metrics.consecutiveErrors === 0) {
            return this.config.intervalMs;
        }

        const multiplier = Math.min(
            2 ** this.metrics.consecutiveErrors,
            this.config.maxBackoffMultiplier ?? 16,
        );

        const effectiveMs = this.config.intervalMs * multiplier;
        log.warn(
            {
                worker: this.config.name,
                baseMs: this.config.intervalMs,
                multiplier,
                effectiveMs,
            },
            "Applying error backoff",
        );

        return effectiveMs;
    }

    /**
     * Get current worker metrics.
     */
    getMetrics(): WorkerMetrics {
        return {
            ...this.metrics,
            uptimeMs: Date.now() - this.startedAt,
        };
    }

    /**
     * Determine if the worker is healthy.
     *
     * A worker is unhealthy if:
     * - It has too many consecutive errors (≥ maxConsecutiveErrors)
     * - Its last successful run is older than 3× the interval
     * - It is not running when it should be
     */
    isHealthy(): boolean {
        // Not running = not healthy (unless never started)
        if (!this.running && this.metrics.runs > 0) return false;

        // Too many consecutive errors
        if (this.metrics.consecutiveErrors >= (this.config.maxConsecutiveErrors ?? 5)) {
            return false;
        }

        // Check staleness: if we have run before, the last run should be
        // within HEALTH_STALE_THRESHOLD_MULTIPLIER × intervalMs
        if (this.metrics.lastRunAt) {
            const lastRunAge = Date.now() - new Date(this.metrics.lastRunAt).getTime();
            const staleThreshold = this.config.intervalMs * HEALTH_STALE_THRESHOLD_MULTIPLIER;
            if (lastRunAge > staleThreshold) return false;
        }

        return true;
    }

    /**
     * Get a structured health status report for the /health endpoint.
     */
    healthStatus(): WorkerHealthStatus {
        const m = this.getMetrics();
        return {
            healthy: this.isHealthy(),
            running: this.running,
            lastRun: m.lastRunAt,
            lastError: m.lastErrorMsg,
            runsTotal: m.runs,
            errorsTotal: m.errors,
            consecutiveErrors: m.consecutiveErrors,
            lastRunDurationMs: m.lastRunMs,
            uptimeMs: m.uptimeMs,
            totalRows: m.totalRows,
        };
    }

    /**
     * Stop the worker gracefully (for orchestrator use).
     * Does NOT call process.exit() — just stops the run loop.
     */
    async stop(): Promise<void> {
        if (this.shuttingDown) return;
        this.shuttingDown = true;
        this.running = false;

        // Interrupt any pending sleep
        if (this.sleepResolve) {
            this.sleepResolve();
            this.sleepResolve = null;
        }
        if (this.sleepTimer) {
            clearTimeout(this.sleepTimer);
            this.sleepTimer = null;
        }

        log.info({ worker: this.config.name, metrics: this.getMetrics() }, "Worker stopped");
    }

    /**
     * Gracefully shut down the worker (standalone mode).
     * Calls process.exit(0) — only used when running as a CLI process.
     */
    private async shutdown(): Promise<void> {
        if (this.shuttingDown) return;
        this.shuttingDown = true;
        this.running = false;

        log.info({ worker: this.config.name, metrics: this.getMetrics() }, "Shutting down worker");

        // Flush Pub/Sub pending messages
        await closePubSub();

        // Give a moment for final log flush
        await this.sleep(500);

        process.exit(0);
    }

    /**
     * Sleep helper that can be interrupted by shutdown or stop().
     */
    private sleep(ms: number): Promise<void> {
        return new Promise((resolve) => {
            if (this.shuttingDown) {
                resolve();
                return;
            }
            this.sleepResolve = resolve;
            this.sleepTimer = setTimeout(() => {
                this.sleepTimer = null;
                this.sleepResolve = null;
                resolve();
            }, ms);
        });
    }
}

// ── Standalone CLI Runner ────────────────────────────────

/**
 * Run a worker as a standalone process.
 * Handles uncaught errors and provides a clean CLI experience.
 */
export function runWorkerCLI(worker: IngestionWorker): void {
    process.on("unhandledRejection", (reason) => {
        log.error({ err: reason }, "Unhandled rejection in worker");
        process.exit(1);
    });

    process.on("uncaughtException", (err) => {
        log.error({ err: err.message }, "Uncaught exception in worker");
        process.exit(1);
    });

    worker.run().catch((err) => {
        log.error({ err: err?.message ?? err }, "Worker crashed");
        process.exit(1);
    });
}
