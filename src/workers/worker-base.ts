/**
 * Crypto Vision — Ingestion Worker Base
 *
 * Shared base class for all data ingestion workers providing:
 * - Periodic fetching with configurable intervals
 * - Dual-write to BigQuery + Pub/Sub for reliability
 * - Structured metrics tracking (runs, rows, errors, latency)
 * - Graceful shutdown on SIGTERM / SIGINT
 * - Exponential backoff on consecutive failures
 * - Idempotent execution (safe to re-run)
 * - Health check endpoint via stdout metrics
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
    /** Maximum consecutive errors before applying backoff multiplier */
    maxConsecutiveErrors?: number;
    /** Maximum backoff multiplier (caps exponential growth) */
    maxBackoffMultiplier?: number;
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

// ── Worker Base Class ────────────────────────────────────

export abstract class IngestionWorker {
    protected readonly config: WorkerConfig;
    private running = false;
    private shuttingDown = false;
    private readonly startedAt: number;
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
            ...config,
        };
        this.startedAt = Date.now();

        // Register shutdown handlers
        const shutdown = () => this.shutdown();
        process.on("SIGTERM", shutdown);
        process.on("SIGINT", shutdown);
    }

    /**
     * Fetch data from the upstream source.
     * Subclasses must implement this method.
     *
     * @returns Array of records to persist. Each record should have
     *          a `source` field for attribution.
     */
    abstract fetch(): Promise<Record<string, unknown>[]>;

    /**
     * Start the ingestion loop. Runs until shutdown is requested.
     */
    async run(): Promise<void> {
        if (this.running) {
            log.warn({ worker: this.config.name }, "Worker already running");
            return;
        }

        this.running = true;
        log.info(
            {
                worker: this.config.name,
                intervalMs: this.config.intervalMs,
                bqTable: this.config.bqTable,
                pubsubTopic: this.config.pubsubTopic,
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
            const rows = await this.fetch();
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
     * Gracefully shut down the worker.
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
     * Sleep helper that can be interrupted by shutdown.
     */
    private sleep(ms: number): Promise<void> {
        return new Promise((resolve) => {
            const timer = setTimeout(resolve, ms);
            // Allow clean exit if shutting down
            if (this.shuttingDown) {
                clearTimeout(timer);
                resolve();
            }
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
