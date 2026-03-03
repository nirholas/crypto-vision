/**
 * Crypto Vision — Embedding Generator
 *
 * Multi-provider embedding generation with:
 *  - Vertex AI (text-embedding-005, 768d) — primary for production
 *  - OpenAI (text-embedding-3-small, 1536d) — fallback
 *  - Automatic provider selection based on available credentials
 *  - Embedding cache to avoid redundant API calls
 *  - Batch processing with rate limiting
 *  - Token estimation for cost tracking
 *
 * Cost estimate (Vertex AI): ~$0.025 per 1K tokens
 */

import { createHash } from "crypto";
import { log } from "./logger.js";
import { cache } from "./cache.js";

// ─── Constants ───────────────────────────────────────────────

/** Default Vertex AI model */
const VERTEX_EMBEDDING_MODEL = "text-embedding-005";

/** Vertex AI embedding dimensionality */
const VERTEX_DIMENSION = 768;

/** OpenAI embedding dimensionality */
const OPENAI_DIMENSION = 1536;

/** Vertex AI batch limit */
const VERTEX_BATCH_SIZE = 250;

/** OpenAI batch limit */
const OPENAI_BATCH_SIZE = 2048;

/** Maximum input tokens per text (truncate longer texts) */
const MAX_INPUT_CHARS = 8192;

/** Cache TTL for individual embeddings (24 hours) */
const EMBEDDING_CACHE_TTL = 86_400;

// ─── Types ───────────────────────────────────────────────────

export interface EmbeddingResult {
  text: string;
  embedding: number[];
  model: string;
  tokens: number;
}

export interface EmbeddingProvider {
  name: string;
  dimension: number;
  maxBatchSize: number;
  embed(texts: string[]): Promise<number[][]>;
}

// ─── Vertex AI Provider ──────────────────────────────────────

class VertexAIEmbeddingProvider implements EmbeddingProvider {
  readonly name = "vertex-ai";
  readonly dimension = VERTEX_DIMENSION;
  readonly maxBatchSize = VERTEX_BATCH_SIZE;

  async embed(texts: string[]): Promise<number[][]> {
    const { PredictionServiceClient } = await import("@google-cloud/aiplatform");
    const client = new PredictionServiceClient({
      apiEndpoint: `${process.env.GCP_REGION || "us-central1"}-aiplatform.googleapis.com`,
    });

    const projectId = process.env.GCP_PROJECT_ID;
    const location = process.env.GCP_REGION || "us-central1";
    const endpoint = `projects/${projectId}/locations/${location}/publishers/google/models/${VERTEX_EMBEDDING_MODEL}`;

    const results: number[][] = [];

    for (let i = 0; i < texts.length; i += this.maxBatchSize) {
      const batch = texts.slice(i, i + this.maxBatchSize);
      const instances = batch.map((text) => ({
        structValue: {
          fields: {
            content: { stringValue: truncateText(text) },
          },
        },
      }));

      const [response] = await client.predict({ endpoint, instances });

      for (const prediction of response.predictions || []) {
        const values =
          prediction.structValue?.fields?.embeddings?.structValue?.fields?.values
            ?.listValue?.values;
        const embedding = values?.map((v) => (v.numberValue ?? 0) as number) ?? [];
        results.push(embedding);
      }

      // Small delay between batches to avoid rate limiting
      if (i + this.maxBatchSize < texts.length) {
        await sleep(100);
      }
    }

    return results;
  }
}

// ─── OpenAI Provider ─────────────────────────────────────────

class OpenAIEmbeddingProvider implements EmbeddingProvider {
  readonly name = "openai";
  readonly dimension = OPENAI_DIMENSION;
  readonly maxBatchSize = OPENAI_BATCH_SIZE;

  async embed(texts: string[]): Promise<number[][]> {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error("OPENAI_API_KEY not set");

    const results: number[][] = [];

    for (let i = 0; i < texts.length; i += this.maxBatchSize) {
      const batch = texts.slice(i, i + this.maxBatchSize).map(truncateText);

      const resp = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "text-embedding-3-small",
          input: batch,
        }),
      });

      if (!resp.ok) {
        const errBody = await resp.text().catch(() => "unknown error");
        throw new Error(`OpenAI embeddings API error (${resp.status}): ${errBody}`);
      }

      const data = (await resp.json()) as {
        data: Array<{ embedding: number[]; index: number }>;
      };

      // Sort by index to preserve order
      const sorted = data.data.sort((a, b) => a.index - b.index);
      results.push(...sorted.map((d) => d.embedding));

      if (i + this.maxBatchSize < texts.length) {
        await sleep(200);
      }
    }

    return results;
  }
}

// ─── Provider Selection ──────────────────────────────────────

let cachedProvider: EmbeddingProvider | null = null;

function getProvider(): EmbeddingProvider {
  if (cachedProvider) return cachedProvider;

  if (process.env.GCP_PROJECT_ID) {
    cachedProvider = new VertexAIEmbeddingProvider();
    log.info({ provider: "vertex-ai", model: VERTEX_EMBEDDING_MODEL, dimension: VERTEX_DIMENSION }, "Embedding provider: Vertex AI");
    return cachedProvider;
  }

  if (process.env.OPENAI_API_KEY) {
    cachedProvider = new OpenAIEmbeddingProvider();
    log.info({ provider: "openai", model: "text-embedding-3-small", dimension: OPENAI_DIMENSION }, "Embedding provider: OpenAI");
    return cachedProvider;
  }

  throw new Error(
    "No embedding provider configured. Set GCP_PROJECT_ID (for Vertex AI) or OPENAI_API_KEY (for OpenAI).",
  );
}

// ─── Public API ──────────────────────────────────────────────

/**
 * Generate embeddings for multiple texts in optimized batches.
 * Returns results in the same order as the input texts.
 */
export async function generateEmbeddings(texts: string[]): Promise<EmbeddingResult[]> {
  if (texts.length === 0) return [];

  const provider = getProvider();
  const startTime = Date.now();

  const embeddings = await provider.embed(texts);

  const elapsed = Date.now() - startTime;
  const totalTokens = texts.reduce((sum, t) => sum + estimateTokens(t), 0);

  log.info(
    {
      provider: provider.name,
      count: texts.length,
      tokens: totalTokens,
      elapsed,
    },
    "Generated embeddings batch",
  );

  return texts.map((text, i) => ({
    text,
    embedding: embeddings[i],
    model: provider.name,
    tokens: estimateTokens(text),
  }));
}

/**
 * Generate a single embedding with caching.
 * Cached embeddings are stored for 24 hours to avoid duplicate API calls.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const cacheKey = `emb:${hashText(text)}`;

  // Check cache first
  const cached = await cache.get<string>(cacheKey);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch {
      // Invalid cache entry — regenerate
    }
  }

  const [result] = await generateEmbeddings([text]);
  await cache.set(cacheKey, JSON.stringify(result.embedding), EMBEDDING_CACHE_TTL);
  return result.embedding;
}

/**
 * Get the current embedding dimension based on the active provider.
 * Falls back to Vertex AI dimension if no provider is configured.
 */
export function getEmbeddingDimension(): number {
  try {
    return getProvider().dimension;
  } catch {
    return VERTEX_DIMENSION;
  }
}

/**
 * Get the current provider name.
 */
export function getEmbeddingProviderName(): string {
  try {
    return getProvider().name;
  } catch {
    return "none";
  }
}

// ─── Utilities ───────────────────────────────────────────────

function hashText(text: string): string {
  return createHash("sha256").update(text).digest("hex").slice(0, 16);
}

function truncateText(text: string): string {
  if (text.length <= MAX_INPUT_CHARS) return text;
  return text.slice(0, MAX_INPUT_CHARS);
}

/**
 * Rough token count estimate (~4 chars per token for English).
 * Used for cost tracking, not for exact billing.
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Default dimension constant for external consumers */
export const EMBEDDING_DIMENSION = VERTEX_DIMENSION;
