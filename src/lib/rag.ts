/**
 * Crypto Vision — RAG (Retrieval-Augmented Generation) Pipeline
 *
 * Combines vector search with LLM generation to produce answers
 * grounded in real data from our knowledge base. This is the core
 * intelligence layer that powers the enhanced /api/ai/ask endpoint.
 *
 * Pipeline:
 *  1. Embed the user's question
 *  2. Retrieve top-K relevant documents from the vector store
 *  3. Build a context window from retrieved documents
 *  4. Send context + question to the LLM for grounded generation
 *  5. Return the answer with source citations
 *
 * Features:
 *  - Configurable retrieval depth (topK) and context window
 *  - Category filtering (news, protocol, agent, governance)
 *  - Score threshold filtering (skip low-relevance results)
 *  - Source citation in responses
 *  - Fallback to direct LLM when vector store is empty
 */

import { generateEmbedding } from "./embeddings.js";
import { vectorStore } from "./vector-store.js";
import { aiComplete, type AIResponse } from "./ai.js";
import { log } from "./logger.js";

// ─── Types ───────────────────────────────────────────────────

export interface RAGOptions {
  /** Number of documents to retrieve (default: 5) */
  topK?: number;
  /** Filter results by category (news, protocol, agent, governance) */
  category?: string;
  /** Maximum characters of context to include (default: 8000) */
  maxContextLength?: number;
  /** Minimum similarity score to include a result (default: 0.3) */
  minScore?: number;
  /** LLM temperature (default: 0.3) */
  temperature?: number;
  /** Custom system prompt override */
  systemPrompt?: string;
  /** Maximum LLM output tokens (default: 2048) */
  maxTokens?: number;
}

export interface RAGSource {
  id: string;
  content: string;
  score: number;
  category?: string;
}

export interface RAGResult {
  answer: string;
  sources: RAGSource[];
  model: string;
  tokensUsed?: number;
  retrievalCount: number;
  contextLength: number;
  ragUsed: boolean;
}

// ─── Default System Prompt ───────────────────────────────────

const DEFAULT_RAG_SYSTEM_PROMPT = `You are Crypto Vision AI, an expert cryptocurrency and DeFi analyst.
Answer questions using the provided context from our knowledge base.

RULES:
- Base your answer primarily on the provided context
- If the context contains specific numbers, dates, or data, cite them exactly
- If the context doesn't fully answer the question, supplement with your general knowledge but clearly note what's from context vs general knowledge
- Be concise, specific, and data-driven
- Format numbers clearly (e.g., $1.2B, 24.5%)
- When referencing sources, mention them naturally (e.g., "According to CoinDesk..." or "The Aave protocol data shows...")
- If the context is entirely irrelevant, say so and answer from general knowledge`;

// ─── Main RAG Query Function ─────────────────────────────────

/**
 * Execute a RAG query: embed the question, retrieve relevant docs,
 * and generate a grounded LLM response.
 */
export async function ragQuery(
  question: string,
  options: RAGOptions = {},
): Promise<RAGResult> {
  const {
    topK = 5,
    category,
    maxContextLength = 8000,
    minScore = 0.3,
    temperature = 0.3,
    systemPrompt = DEFAULT_RAG_SYSTEM_PROMPT,
    maxTokens = 2048,
  } = options;

  const startTime = Date.now();

  // 1. Check if vector store has any data
  const storeCount = await vectorStore.count();

  if (storeCount === 0) {
    log.info("Vector store empty — falling back to direct LLM");
    return directLLMFallback(question, systemPrompt, temperature, maxTokens);
  }

  // 2. Generate embedding for the question
  let queryEmbedding: number[];
  try {
    queryEmbedding = await generateEmbedding(question);
  } catch (err) {
    log.warn({ err }, "Embedding generation failed — falling back to direct LLM");
    return directLLMFallback(question, systemPrompt, temperature, maxTokens);
  }

  // 3. Retrieve relevant documents
  const filter = category ? { category } : undefined;
  const searchResults = await vectorStore.search(queryEmbedding, topK * 2, filter); // Fetch extra to filter by score

  // 4. Filter by minimum score and take topK
  const relevantResults = searchResults
    .filter((r) => r.score >= minScore)
    .slice(0, topK);

  if (relevantResults.length === 0) {
    log.info({ question: question.slice(0, 100), storeCount }, "No relevant documents found — falling back to direct LLM");
    return directLLMFallback(question, systemPrompt, temperature, maxTokens);
  }

  // 5. Build context from retrieved documents
  let contextStr = "";
  const sources: RAGSource[] = [];

  for (const result of relevantResults) {
    const sourceLabel = (result.metadata?.source as string) || result.id;
    const categoryLabel = (result.metadata?.category as string) || "general";
    const entry = `\n---\nSource: ${sourceLabel} [${categoryLabel}] (relevance: ${(result.score * 100).toFixed(1)}%)\n${result.content}\n`;

    if (contextStr.length + entry.length > maxContextLength) break;

    contextStr += entry;
    sources.push({
      id: result.id,
      content: result.content.slice(0, 300),
      score: result.score,
      category: categoryLabel,
    });
  }

  // 6. Build the prompt with context
  const userPrompt = `Question: ${question}

Context from knowledge base (${sources.length} relevant documents):
${contextStr}

Instructions:
- Answer the question based on the context above
- Be specific with numbers and facts from the context
- If the context is insufficient, supplement with general knowledge but note this
- Cite sources naturally when referencing specific data`;

  // 7. Generate LLM response
  let llmResponse: AIResponse;
  try {
    llmResponse = await aiComplete(systemPrompt, userPrompt, {
      temperature,
      maxTokens,
    });
  } catch (err) {
    log.error({ err }, "RAG LLM generation failed");
    throw err;
  }

  const elapsed = Date.now() - startTime;
  log.info(
    {
      question: question.slice(0, 80),
      sourcesUsed: sources.length,
      contextChars: contextStr.length,
      elapsed,
      model: llmResponse.model,
    },
    "RAG query complete",
  );

  return {
    answer: llmResponse.text,
    sources,
    model: llmResponse.model,
    tokensUsed: llmResponse.tokensUsed,
    retrievalCount: sources.length,
    contextLength: contextStr.length,
    ragUsed: true,
  };
}

// ─── Direct LLM Fallback ────────────────────────────────────

/**
 * When the vector store is empty or embeddings fail,
 * fall back to a direct LLM query without retrieval context.
 */
async function directLLMFallback(
  question: string,
  systemPrompt: string,
  temperature: number,
  maxTokens: number,
): Promise<RAGResult> {
  const llmResponse = await aiComplete(systemPrompt, question, {
    temperature,
    maxTokens,
  });

  return {
    answer: llmResponse.text,
    sources: [],
    model: llmResponse.model,
    tokensUsed: llmResponse.tokensUsed,
    retrievalCount: 0,
    contextLength: 0,
    ragUsed: false,
  };
}

// ─── Convenience Queries ─────────────────────────────────────

/**
 * Ask about a specific crypto topic with category filtering.
 */
export async function ragAskAboutProtocol(
  question: string,
  protocolName?: string,
): Promise<RAGResult> {
  const enhancedQuestion = protocolName
    ? `About ${protocolName}: ${question}`
    : question;

  return ragQuery(enhancedQuestion, {
    category: "protocol",
    topK: 5,
    temperature: 0.2,
  });
}

/**
 * Ask about recent crypto news.
 */
export async function ragAskAboutNews(question: string): Promise<RAGResult> {
  return ragQuery(question, {
    category: "news",
    topK: 8,
    temperature: 0.3,
  });
}

/**
 * Ask about governance proposals.
 */
export async function ragAskAboutGovernance(question: string): Promise<RAGResult> {
  return ragQuery(question, {
    category: "governance",
    topK: 5,
    temperature: 0.2,
  });
}

/**
 * Ask what agent would be best for a given task.
 */
export async function ragFindAgent(taskDescription: string): Promise<RAGResult> {
  return ragQuery(
    `Which agent or specialist would be best suited to help with: ${taskDescription}`,
    {
      category: "agent",
      topK: 5,
      temperature: 0.2,
    },
  );
}
