/**
 * Crypto Vision — Governance Indexer Worker
 *
 * Indexes on-chain governance proposals from Snapshot and other
 * governance platforms into vector store for RAG-powered analysis.
 *
 * Schedule: every 30 minutes
 */

import { log } from "../lib/logger.js";
import { vectorStore } from "../lib/vector-store.js";
import { generateEmbedding } from "../lib/embeddings.js";
import { cache } from "../lib/cache.js";

// ─── State ───────────────────────────────────────────────────

let timer: ReturnType<typeof setInterval> | null = null;
let lastRun: string | null = null;
let lastCount = 0;
let errorCount = 0;

const INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

// ─── Index Logic ─────────────────────────────────────────────

async function indexGovernanceProposals(): Promise<number> {
  try {
    const { getActiveProposals } = await import("../sources/snapshot.js");
    const activeBySpace = await getActiveProposals();
    const proposals = Object.values(activeBySpace).flat();

    if (!proposals?.length) {
      log.debug("Governance indexer: no proposals to index");
      return 0;
    }

    let indexed = 0;

    for (const proposal of proposals) {
      const id = `governance:${proposal.id}`;
      const content = [
        proposal.title,
        proposal.body?.slice(0, 1000) || "",
        `Space: ${proposal.space?.name || "unknown"}`,
        `State: ${proposal.state || "unknown"}`,
        `Choices: ${proposal.choices?.join(", ") || "N/A"}`,
      ].join(" ").trim();

      if (!content || content.length < 20) continue;

      const dedup = await cache.get(`idx:${id}`);
      if (dedup) continue;

      try {
        const embedding = await generateEmbedding(content);
        await vectorStore.upsert(id, embedding, content, {
          category: "governance",
          space: proposal.space?.name || "unknown",
          proposalId: proposal.id,
          title: proposal.title,
          state: proposal.state,
          endDate: proposal.end ? new Date(proposal.end * 1000).toISOString() : undefined,
        });
        await cache.set(`idx:${id}`, "1", 7200); // dedup for 2h
        indexed++;
      } catch (err: unknown) {
        log.warn({ err, id }, "Failed to index governance proposal");
      }
    }

    lastRun = new Date().toISOString();
    lastCount = indexed;
    errorCount = 0;
    log.info({ indexed, total: proposals.length }, "Governance indexer completed");
    return indexed;
  } catch (err: unknown) {
    errorCount++;
    log.error({ err }, "Governance indexer failed");
    return 0;
  }
}

// ─── Lifecycle ───────────────────────────────────────────────

export function startGovernanceIndexer(): void {
  if (timer) return;

  log.info({ intervalMs: INTERVAL_MS }, "Starting governance indexer");

  indexGovernanceProposals().catch(() => {});
  timer = setInterval(() => {
    indexGovernanceProposals().catch(() => {});
  }, INTERVAL_MS);
}

export function stopGovernanceIndexer(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
    log.info("Governance indexer stopped");
  }
}

export function governanceIndexerStatus() {
  return {
    running: timer !== null,
    lastRun,
    lastCount,
    errorCount,
    intervalMs: INTERVAL_MS,
  };
}
