/**
 * Crypto Vision — Agent Discovery & Capability Matching
 *
 * Indexes all agent capabilities into the vector store at startup,
 * enabling semantic search to find the most relevant agents for
 * a given user question — even when the question doesn't use the
 * exact same keywords as the agent description.
 *
 * This powers the "smart routing" use case: instead of keyword matching,
 * we embed the user's question and find the nearest agent capability vectors.
 *
 * @copyright 2024-2026 nirholas. All rights reserved.
 */

import { log } from "./logger.js";
import { generateEmbedding } from "./embeddings.js";
import { vectorStore, type VectorSearchResult } from "./vector-store.js";
import { buildAgentCapabilities, type AgentCapability } from "./orchestrator.js";

// ─── Constants ───────────────────────────────────────────────

/** Vector store category for agent capability embeddings */
const CAPABILITY_CATEGORY = "agent-capability";

/** Cache key prefix for capability index status */
const INDEX_STATUS_KEY = "agent-capability-index-status";

// ─── Types ───────────────────────────────────────────────────

export interface AgentMatch {
  agentId: string;
  name: string;
  description: string;
  domains: string[];
  score: number;
}

// ─── Indexing ────────────────────────────────────────────────

let indexed = false;

/**
 * Index all agent capabilities into the vector store.
 *
 * Creates an embedding for each agent's combined name + description + domains,
 * enabling semantic similarity search against user questions.
 *
 * Safe to call multiple times — skips if already indexed in this process.
 */
export async function indexAgentCapabilities(): Promise<void> {
  if (indexed) return;

  const capabilities = buildAgentCapabilities();

  if (capabilities.length === 0) {
    log.warn("No agent capabilities to index");
    return;
  }

  const startTime = Date.now();
  let successCount = 0;
  let errorCount = 0;

  for (const agent of capabilities) {
    try {
      const text = buildCapabilityText(agent);
      const embedding = await generateEmbedding(text);

      await vectorStore.upsert(
        `capability:${agent.id}`,
        embedding,
        text,
        {
          category: CAPABILITY_CATEGORY,
          agentId: agent.id,
          name: agent.name,
          domains: agent.domains.join(","),
          dataAccess: agent.dataAccess.join(","),
        },
      );

      successCount++;
    } catch (err) {
      errorCount++;
      log.warn(
        { agentId: agent.id, err: err instanceof Error ? err.message : String(err) },
        "Failed to index agent capability",
      );
    }
  }

  indexed = true;

  log.info(
    {
      indexed: successCount,
      failed: errorCount,
      total: capabilities.length,
      elapsed: Date.now() - startTime,
    },
    "Agent capabilities indexed into vector store",
  );
}

/**
 * Build the text representation of an agent capability for embedding.
 * Combines multiple fields to create a rich semantic description.
 */
function buildCapabilityText(agent: AgentCapability): string {
  const parts: string[] = [
    `${agent.name}: ${agent.description}`,
    `Specializes in: ${agent.domains.join(", ")}`,
  ];

  if (agent.dataAccess.length > 0) {
    parts.push(`Has access to data from: ${agent.dataAccess.join(", ")}`);
  }

  return parts.join(". ");
}

// ─── Search ──────────────────────────────────────────────────

/**
 * Find the most relevant agents for a user question using semantic similarity.
 *
 * Embeds the question and searches the vector store for the nearest
 * agent capability vectors. Returns agents ranked by relevance score.
 *
 * @param question - The user's question
 * @param topK - Maximum number of agents to return (default: 5)
 * @returns Ranked list of matching agents with similarity scores
 */
export async function findRelevantAgents(
  question: string,
  topK = 5,
): Promise<AgentMatch[]> {
  // Ensure capabilities are indexed
  if (!indexed) {
    try {
      await indexAgentCapabilities();
    } catch (err) {
      log.warn(
        { err: err instanceof Error ? err.message : String(err) },
        "Failed to index capabilities for search — falling back to keyword matching",
      );
      return findRelevantAgentsByKeyword(question, topK);
    }
  }

  try {
    const embedding = await generateEmbedding(question);
    const results = await vectorStore.search(embedding, topK, {
      category: CAPABILITY_CATEGORY,
    });

    return results.map(vectorResultToAgentMatch);
  } catch (err) {
    log.warn(
      { err: err instanceof Error ? err.message : String(err) },
      "Vector search failed — falling back to keyword matching",
    );
    return findRelevantAgentsByKeyword(question, topK);
  }
}

/**
 * Convert a vector search result to an AgentMatch.
 */
function vectorResultToAgentMatch(result: VectorSearchResult): AgentMatch {
  return {
    agentId: (result.metadata.agentId as string) || "",
    name: (result.metadata.name as string) || "",
    description: result.content,
    domains: typeof result.metadata.domains === "string"
      ? (result.metadata.domains as string).split(",")
      : [],
    score: result.score,
  };
}

// ─── Keyword Fallback ────────────────────────────────────────

/**
 * Simple keyword-based agent matching as a fallback when embedding
 * search is unavailable (no embedding provider configured, etc.).
 *
 * Scores agents by counting how many of their domain keywords
 * appear in the user's question.
 */
export function findRelevantAgentsByKeyword(
  question: string,
  topK = 5,
): AgentMatch[] {
  const capabilities = buildAgentCapabilities();
  const queryWords = new Set(
    question.toLowerCase().split(/\s+/).filter((w) => w.length > 2),
  );

  const scored = capabilities.map((agent) => {
    let score = 0;

    // Check domain keyword overlap
    for (const domain of agent.domains) {
      const domainWords = domain.toLowerCase().split(/[-_\s]+/);
      for (const dw of domainWords) {
        if (queryWords.has(dw)) score += 2;
      }
    }

    // Check if agent name words appear in query
    const nameWords = agent.name.toLowerCase().split(/\s+/);
    for (const nw of nameWords) {
      if (queryWords.has(nw)) score += 1;
    }

    // Check if description words overlap (weaker signal)
    const descWords = agent.description.toLowerCase().split(/\s+/);
    for (const dw of descWords) {
      if (dw.length > 3 && queryWords.has(dw)) score += 0.5;
    }

    return { agent, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map((s) => ({
      agentId: s.agent.id,
      name: s.agent.name,
      description: s.agent.description,
      domains: s.agent.domains,
      score: s.score / 10, // Normalize to 0-1 range roughly
    }));
}
