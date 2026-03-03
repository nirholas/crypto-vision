/**
 * Crypto Vision — Agent Indexer Worker
 *
 * Indexes agent metadata, prompts, and documentation into vector store
 * for RAG-powered agent discovery and recommendation.
 *
 * Runs once on startup, then on demand when agents are updated.
 */

import { log } from "../lib/logger.js";
import { vectorStore } from "../lib/vector-store.js";
import { generateEmbedding } from "../lib/embeddings.js";

// ─── State ───────────────────────────────────────────────────

let lastRun: string | null = null;
let lastCount = 0;
let errorCount = 0;
let isRunning = false;

// ─── Index Logic ─────────────────────────────────────────────

export async function indexAgents(): Promise<number> {
  if (isRunning) {
    log.debug("Agent indexer already running, skipping");
    return 0;
  }

  isRunning = true;

  try {
    // Dynamic import to keep the dependency optional
    const { listAgents } = await import("../lib/agents.js");
    const agents = await listAgents();

    if (!agents?.length) {
      log.debug("Agent indexer: no agents to index");
      isRunning = false;
      return 0;
    }

    let indexed = 0;

    for (const agent of agents) {
      const id = `agent:${agent.id || agent.slug || agent.name}`;
      const content = [
        agent.name,
        agent.description || "",
        agent.category || "",
        agent.tags?.join(", ") || "",
        agent.systemPrompt?.slice(0, 500) || "",
      ].join(" ").trim();

      if (!content || content.length < 10) continue;

      try {
        const embedding = await generateEmbedding(content);
        await vectorStore.upsert(id, embedding, content, {
          category: "agent",
          name: agent.name,
          slug: agent.slug || agent.id,
          agentCategory: agent.category,
          tags: agent.tags,
        });
        indexed++;
      } catch (err) {
        log.warn({ err, id }, "Failed to index agent");
      }
    }

    lastRun = new Date().toISOString();
    lastCount = indexed;
    errorCount = 0;
    isRunning = false;
    log.info({ indexed, total: agents.length }, "Agent indexer completed");
    return indexed;
  } catch (err) {
    errorCount++;
    isRunning = false;
    log.error({ err }, "Agent indexer failed");
    return 0;
  }
}

// ─── Status ──────────────────────────────────────────────────

export function agentIndexerStatus() {
  return {
    running: isRunning,
    lastRun,
    lastCount,
    errorCount,
  };
}
