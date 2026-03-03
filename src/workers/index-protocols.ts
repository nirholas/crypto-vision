/**
 * Crypto Vision — Protocol Indexer Worker
 *
 * Indexes DeFi protocol metadata + TVL data into vector store
 * for RAG-powered protocol discovery and comparison.
 *
 * Schedule: every 15 minutes
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

const INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

// ─── Index Logic ─────────────────────────────────────────────

async function indexProtocols(): Promise<number> {
  try {
    const { fetchTopProtocols } = await import("../sources/defillama.js");
    const protocols = await fetchTopProtocols(200);

    if (!protocols?.length) {
      log.debug("Protocol indexer: no protocols to index");
      return 0;
    }

    let indexed = 0;

    for (const protocol of protocols) {
      const id = `protocol:${protocol.slug || protocol.name}`;
      const content = [
        protocol.name,
        protocol.category || "",
        protocol.description || "",
        protocol.chains?.join(", ") || "",
        `TVL: $${protocol.tvl?.toLocaleString() ?? "N/A"}`,
      ].join(" ").trim();

      if (!content || content.length < 10) continue;

      const dedup = await cache.get(`idx:${id}`);
      if (dedup) continue;

      try {
        const embedding = await generateEmbedding(content);
        await vectorStore.upsert(id, embedding, content, {
          category: "protocol",
          name: protocol.name,
          slug: protocol.slug,
          chain: protocol.chains?.[0] || "multi",
          tvl: protocol.tvl,
        });
        await cache.set(`idx:${id}`, "1", 3600); // dedup for 1h
        indexed++;
      } catch (err) {
        log.warn({ err, id }, "Failed to index protocol");
      }
    }

    lastRun = new Date().toISOString();
    lastCount = indexed;
    errorCount = 0;
    log.info({ indexed, total: protocols.length }, "Protocol indexer completed");
    return indexed;
  } catch (err) {
    errorCount++;
    log.error({ err }, "Protocol indexer failed");
    return 0;
  }
}

// ─── Lifecycle ───────────────────────────────────────────────

export function startProtocolIndexer(): void {
  if (timer) return;

  log.info({ intervalMs: INTERVAL_MS }, "Starting protocol indexer");

  indexProtocols().catch(() => {});
  timer = setInterval(() => {
    indexProtocols().catch(() => {});
  }, INTERVAL_MS);
}

export function stopProtocolIndexer(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
    log.info("Protocol indexer stopped");
  }
}

export function protocolIndexerStatus() {
  return {
    running: timer !== null,
    lastRun,
    lastCount,
    errorCount,
    intervalMs: INTERVAL_MS,
  };
}
