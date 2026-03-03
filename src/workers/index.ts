/**
 * Crypto Vision — Indexing Workers Orchestrator
 *
 * Central entry point for all vector store indexing workers.
 * Manages lifecycle (start/stop) and provides unified status
 * reporting for health checks.
 *
 * Workers:
 *  - News indexer: every 5 minutes
 *  - Protocol indexer: every 1 hour
 *  - Governance indexer: every 15 minutes
 *  - Agent indexer: once at startup
 *
 * Import and call startIndexers() from the main process
 * to kick off all background indexing.
 */

import { startNewsIndexer, stopNewsIndexer, newsIndexerStatus } from "./index-news.js";
import { startProtocolIndexer, stopProtocolIndexer, protocolIndexerStatus } from "./index-protocols.js";
import { startGovernanceIndexer, stopGovernanceIndexer, governanceIndexerStatus } from "./index-governance.js";
import { indexAgents, agentIndexerStatus } from "./index-agents.js";
import { vectorStore } from "../lib/vector-store.js";
import { log } from "../lib/logger.js";

// ─── State ───────────────────────────────────────────────────

let started = false;

// ─── Start All Indexers ──────────────────────────────────────

/**
 * Start all indexing workers.
 * Safe to call multiple times — will only start once.
 *
 * @param options Configure which indexers to run
 */
export async function startIndexers(
  options: {
    news?: boolean;
    protocols?: boolean;
    governance?: boolean;
    agents?: boolean;
  } = {},
): Promise<void> {
  if (started) {
    log.warn("Indexers already started");
    return;
  }

  const {
    news = true,
    protocols = true,
    governance = true,
    agents = true,
  } = options;

  log.info(
    { news, protocols, governance, agents, backend: vectorStore.backend },
    "Starting indexing workers",
  );

  started = true;

  // Start periodic indexers
  if (news) startNewsIndexer();
  if (protocols) startProtocolIndexer();
  if (governance) startGovernanceIndexer();

  // Index agents once at startup (they rarely change)
  if (agents) {
    indexAgents().catch((err) => log.error({ err }, "Agent indexing failed at startup"));
  }
}

// ─── Stop All Indexers ───────────────────────────────────────

/**
 * Gracefully stop all indexing workers.
 */
export function stopIndexers(): void {
  stopNewsIndexer();
  stopProtocolIndexer();
  stopGovernanceIndexer();
  started = false;
  log.info("All indexing workers stopped");
}

// ─── Combined Status ─────────────────────────────────────────

/**
 * Get combined status of all indexers for /health endpoint.
 */
export async function indexerStatus() {
  const vectorCount = await vectorStore.count().catch(() => 0);

  return {
    started,
    vectorStoreBackend: vectorStore.backend,
    vectorCount,
    news: newsIndexerStatus(),
    protocols: protocolIndexerStatus(),
    governance: governanceIndexerStatus(),
    agents: agentIndexerStatus(),
  };
}
