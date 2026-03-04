/**
 * Crypto Vision — Worker Orchestrator
 *
 * Central entry point for ALL workers (ingestion + indexing).
 * Manages lifecycle with staggered starts to avoid thundering herd,
 * health reporting, graceful shutdown, and automatic restart
 * of failed workers with backoff.
 *
 * Ingestion workers (extend IngestionWorker):
 *  - ingest-market: every 2 minutes (CoinGecko)
 *  - ingest-defi: every 5 minutes (DeFiLlama)
 *  - ingest-news: every 5 minutes (CryptoPanic, RSS)
 *  - ingest-dex: every 2 minutes (DexScreener, GeckoTerminal)
 *  - ingest-derivatives: every 10 minutes (CoinGlass, Hyperliquid, Deribit)
 *  - ingest-governance: every 30 minutes (Snapshot)
 *  - ingest-macro: every 60 minutes (Yahoo Finance)
 *  - ingest-onchain: every 5 minutes (mempool.space, RPCs)
 *
 * Indexing workers (vector store):
 *  - index-news: every 5 minutes
 *  - index-protocols: every 15 minutes
 *  - index-governance: every 30 minutes
 *  - index-agents: once at startup
 *
 * Import and call startAllWorkers() from the main process
 * to kick off all background workers.
 */

import { log } from "../lib/logger.js";
import { vectorStore } from "../lib/vector-store.js";
import type { IngestionWorker, WorkerHealthStatus } from "./worker-base.js";

// ── Indexer imports ──────────────────────────────────────

import { startNewsIndexer, stopNewsIndexer, newsIndexerStatus } from "./index-news.js";
import { startProtocolIndexer, stopProtocolIndexer, protocolIndexerStatus } from "./index-protocols.js";
import { startGovernanceIndexer, stopGovernanceIndexer, governanceIndexerStatus } from "./index-governance.js";
import { indexAgents, agentIndexerStatus } from "./index-agents.js";

// ── Types ────────────────────────────────────────────────

interface OrchestratorOptions {
    /** Enable ingestion workers (default: true) */
    ingestion?: boolean;
    /** Enable indexing workers (default: true) */
    indexing?: boolean;
    /** Stagger delay between worker starts in ms (default: 3000) */
    staggerDelayMs?: number;
    /** Specific ingestion workers to enable (default: all) */
    enabledIngestion?: string[];
    /** Specific indexers to enable (default: all) */
    enabledIndexers?: {
        news?: boolean;
        protocols?: boolean;
        governance?: boolean;
        agents?: boolean;
    };
}

interface IngestionWorkerEntry {
    name: string;
    worker: IngestionWorker;
    runPromise: Promise<void> | null;
    restartCount: number;
    lastRestartAt: string | null;
}

interface WorkerOrchestratorStatus {
    started: boolean;
    ingestion: Record<string, WorkerHealthStatus & { restartCount: number }>;
    indexing: {
        news: ReturnType<typeof newsIndexerStatus>;
        protocols: ReturnType<typeof protocolIndexerStatus>;
        governance: ReturnType<typeof governanceIndexerStatus>;
        agents: ReturnType<typeof agentIndexerStatus>;
    };
    vectorStore: {
        backend: string;
        count: number;
    };
}

// ── State ────────────────────────────────────────────────

let orchestratorStarted = false;
const ingestionEntries: IngestionWorkerEntry[] = [];
let restartCheckTimer: ReturnType<typeof setInterval> | null = null;

/** Default stagger delay to avoid thundering herd */
const DEFAULT_STAGGER_MS = 3_000;

/** How often to check for crashed workers and restart them */
const RESTART_CHECK_INTERVAL_MS = 30_000;

/** Maximum consecutive restarts before giving up */
const MAX_RESTARTS = 10;

// ── Lazy worker factory (avoids top-level side effects) ──

const INGESTION_WORKER_FACTORIES: Record<string, () => Promise<IngestionWorker>> = {
    "ingest-market": async () => {
        const { MarketIngestionWorker } = await import("./ingest-market.js");
        return new MarketIngestionWorker({ managed: true });
    },
    "ingest-defi": async () => {
        const { DefiIngestionWorker } = await import("./ingest-defi.js");
        return new DefiIngestionWorker({ managed: true });
    },
    "ingest-news": async () => {
        const { NewsIngestionWorker } = await import("./ingest-news.js");
        return new NewsIngestionWorker({ managed: true });
    },
    "ingest-dex": async () => {
        const { DexIngestionWorker } = await import("./ingest-dex.js");
        return new DexIngestionWorker({ managed: true });
    },
    "ingest-derivatives": async () => {
        const { DerivativesIngestionWorker } = await import("./ingest-derivatives.js");
        return new DerivativesIngestionWorker({ managed: true });
    },
    "ingest-governance": async () => {
        const { GovernanceIngestionWorker } = await import("./ingest-governance.js");
        return new GovernanceIngestionWorker({ managed: true });
    },
    "ingest-macro": async () => {
        const { MacroIngestionWorker } = await import("./ingest-macro.js");
        return new MacroIngestionWorker({ managed: true });
    },
    "ingest-onchain": async () => {
        const { OnchainIngestionWorker } = await import("./ingest-onchain.js");
        return new OnchainIngestionWorker({ managed: true });
    },
};

// ── Helper: sleep ────────────────────────────────────────

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Start All Workers ────────────────────────────────────

/**
 * Start all workers with staggered starts.
 * Safe to call multiple times — will only start once.
 */
export async function startAllWorkers(options: OrchestratorOptions = {}): Promise<void> {
    if (orchestratorStarted) {
        log.warn("Worker orchestrator already started");
        return;
    }

    const {
        ingestion = true,
        indexing = true,
        staggerDelayMs = DEFAULT_STAGGER_MS,
        enabledIngestion,
        enabledIndexers = {},
    } = options;

    orchestratorStarted = true;

    log.info(
        { ingestion, indexing, staggerDelayMs },
        "Starting worker orchestrator",
    );

    // ── Start ingestion workers with stagger ──

    if (ingestion) {
        const workerNames = enabledIngestion ?? Object.keys(INGESTION_WORKER_FACTORIES);

        for (const name of workerNames) {
            const factory = INGESTION_WORKER_FACTORIES[name];
            if (!factory) {
                log.warn({ worker: name }, "Unknown ingestion worker, skipping");
                continue;
            }

            try {
                const worker = await factory();
                const entry: IngestionWorkerEntry = {
                    name,
                    worker,
                    runPromise: null,
                    restartCount: 0,
                    lastRestartAt: null,
                };

                // Start the worker run loop in the background
                entry.runPromise = worker.run().catch((err: unknown) => {
                    const msg = err instanceof Error ? err.message : String(err);
                    log.error({ worker: name, err: msg }, "Ingestion worker crashed");
                });

                ingestionEntries.push(entry);
                log.info({ worker: name }, "Ingestion worker started");

                // Stagger: wait before starting the next worker
                if (staggerDelayMs > 0) {
                    await sleep(staggerDelayMs);
                }
            } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : String(err);
                log.error({ worker: name, err: msg }, "Failed to create ingestion worker");
            }
        }
    }

    // ── Start indexing workers ──

    if (indexing) {
        const {
            news = true,
            protocols = true,
            governance = true,
            agents = true,
        } = enabledIndexers;

        log.info(
            { news, protocols, governance, agents, backend: vectorStore.backend },
            "Starting indexing workers",
        );

        if (news) startNewsIndexer();
        if (protocols) startProtocolIndexer();
        if (governance) startGovernanceIndexer();

        // Index agents once at startup (they rarely change)
        if (agents) {
            indexAgents().catch((err: unknown) => log.error({ err }, "Agent indexing failed at startup"));
        }
    }

    // ── Start crash-recovery loop ──

    restartCheckTimer = setInterval(() => {
        void checkAndRestartWorkers();
    }, RESTART_CHECK_INTERVAL_MS);

    log.info(
        {
            ingestionWorkers: ingestionEntries.map((e) => e.name),
            indexing,
        },
        "Worker orchestrator fully started",
    );
}

// ── Restart Crashed Workers ──────────────────────────────

async function checkAndRestartWorkers(): Promise<void> {
    for (const entry of ingestionEntries) {
        if (!entry.worker.isRunning && orchestratorStarted && entry.restartCount < MAX_RESTARTS) {
            entry.restartCount++;
            entry.lastRestartAt = new Date().toISOString();

            log.warn(
                { worker: entry.name, restartCount: entry.restartCount },
                "Restarting crashed ingestion worker",
            );

            try {
                const factory = INGESTION_WORKER_FACTORIES[entry.name];
                if (factory) {
                    entry.worker = await factory();
                    entry.runPromise = entry.worker.run().catch((err: unknown) => {
                        const msg = err instanceof Error ? err.message : String(err);
                        log.error({ worker: entry.name, err: msg }, "Restarted worker crashed again");
                    });
                }
            } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : String(err);
                log.error({ worker: entry.name, err: msg }, "Failed to restart worker");
            }
        }
    }
}

// ── Stop All Workers ─────────────────────────────────────

/**
 * Gracefully stop all workers.
 */
export async function stopAllWorkers(): Promise<void> {
    if (!orchestratorStarted) return;

    log.info("Stopping worker orchestrator");

    orchestratorStarted = false;

    // Stop restart checker
    if (restartCheckTimer) {
        clearInterval(restartCheckTimer);
        restartCheckTimer = null;
    }

    // Stop ingestion workers
    const stopPromises = ingestionEntries.map(async (entry) => {
        try {
            await entry.worker.stop();
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            log.warn({ worker: entry.name, err: msg }, "Error stopping worker");
        }
    });

    await Promise.allSettled(stopPromises);
    ingestionEntries.length = 0;

    // Stop indexing workers
    stopNewsIndexer();
    stopProtocolIndexer();
    stopGovernanceIndexer();

    log.info("All workers stopped");
}

// ── Combined Status ──────────────────────────────────────

/**
 * Get combined status of all workers for /health endpoint.
 */
export async function workerStatus(): Promise<WorkerOrchestratorStatus> {
    const vectorCount = await vectorStore.count().catch(() => 0);

    const ingestionStatus: Record<string, WorkerHealthStatus & { restartCount: number }> = {};
    for (const entry of ingestionEntries) {
        ingestionStatus[entry.name] = {
            ...entry.worker.healthStatus(),
            restartCount: entry.restartCount,
        };
    }

    return {
        started: orchestratorStarted,
        ingestion: ingestionStatus,
        indexing: {
            news: newsIndexerStatus(),
            protocols: protocolIndexerStatus(),
            governance: governanceIndexerStatus(),
            agents: agentIndexerStatus(),
        },
        vectorStore: {
            backend: vectorStore.backend,
            count: vectorCount,
        },
    };
}

// ── Legacy exports (backward compat) ─────────────────────

/**
 * @deprecated Use startAllWorkers() instead.
 * Start only indexing workers (legacy API).
 */
export async function startIndexers(
    options: {
        news?: boolean;
        protocols?: boolean;
        governance?: boolean;
        agents?: boolean;
    } = {},
): Promise<void> {
    return startAllWorkers({
        ingestion: false,
        indexing: true,
        enabledIndexers: options,
    });
}

/**
 * @deprecated Use stopAllWorkers() instead.
 * Stop only indexing workers (legacy API).
 */
export function stopIndexers(): void {
    stopNewsIndexer();
    stopProtocolIndexer();
    stopGovernanceIndexer();
    log.info("Indexing workers stopped");
}

/**
 * @deprecated Use workerStatus() instead.
 * Get combined status of indexers only (legacy API).
 */
export async function indexerStatus() {
    const vectorCount = await vectorStore.count().catch(() => 0);

    return {
        started: orchestratorStarted,
        vectorStoreBackend: vectorStore.backend,
        vectorCount,
        news: newsIndexerStatus(),
        protocols: protocolIndexerStatus(),
        governance: governanceIndexerStatus(),
        agents: agentIndexerStatus(),
    };
}
