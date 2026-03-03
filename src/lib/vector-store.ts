/**
 * Crypto Vision — Vector Store Abstraction
 *
 * Portable vector store with multiple backends:
 *  - BigQuery VECTOR_SEARCH — production-grade, scalable, cost-effective
 *  - In-Memory — fast local development and testing, no external deps
 *
 * Both backends implement the same VectorStore interface, and the factory
 * automatically selects the right one based on environment.
 *
 * The in-memory store uses exact cosine similarity — no ANN approximation —
 * which is fine for up to ~100K vectors in dev/test.
 *
 * BigQuery backend uses IVF vector index with cosine distance for
 * sub-second nearest-neighbor search over millions of vectors.
 */

import { log } from "./logger.js";
import { generateEmbedding, EMBEDDING_DIMENSION } from "./embeddings.js";

// ─── Types ───────────────────────────────────────────────────

export interface VectorSearchResult {
  id: string;
  content: string;
  metadata: Record<string, unknown>;
  score: number; // Cosine similarity (0–1, higher is more similar)
}

export interface VectorStoreFilter {
  category?: string;
  source?: string;
}

export interface VectorStore {
  /** Insert or update a vector with its content and metadata */
  upsert(
    id: string,
    embedding: number[],
    content: string,
    metadata?: Record<string, unknown>,
  ): Promise<void>;

  /** Search for the nearest vectors to a query embedding */
  search(
    query: number[],
    topK?: number,
    filter?: VectorStoreFilter,
  ): Promise<VectorSearchResult[]>;

  /** Delete a vector by ID */
  delete(id: string): Promise<void>;

  /** Get the total number of stored vectors */
  count(): Promise<number>;

  /** Get the store backend name */
  readonly backend: string;
}

// ─── BigQuery Vector Store ───────────────────────────────────

class BigQueryVectorStore implements VectorStore {
  readonly backend = "bigquery";
  private dataset: string;
  private table: string;
  private initialized = false;

  constructor(dataset = "crypto_vision", table = "embeddings") {
    this.dataset = dataset;
    this.table = table;
  }

  private async init(): Promise<void> {
    if (this.initialized) return;
    const { ensureEmbeddingsTable } = await import("./bigquery.js");
    await ensureEmbeddingsTable(this.dataset);
    this.initialized = true;
  }

  async upsert(
    id: string,
    embedding: number[],
    content: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    await this.init();
    const { query: bqQuery } = await import("./bigquery.js");

    // Use MERGE to upsert (avoids duplicates from streaming inserts)
    const sql = `
      MERGE \`${this.dataset}.${this.table}\` T
      USING (
        SELECT
          @id AS id,
          @content AS content,
          @embedding AS embedding,
          @metadata AS metadata,
          @category AS category,
          @source AS source,
          CURRENT_TIMESTAMP() AS updated_at
      ) S
      ON T.id = S.id
      WHEN MATCHED THEN
        UPDATE SET
          content = S.content,
          embedding = S.embedding,
          metadata = S.metadata,
          category = S.category,
          source = S.source,
          updated_at = S.updated_at
      WHEN NOT MATCHED THEN
        INSERT (id, content, embedding, metadata, category, source, updated_at)
        VALUES (S.id, S.content, S.embedding, S.metadata, S.category, S.source, S.updated_at)
    `;

    await bqQuery(sql, {
      id,
      content,
      embedding,
      metadata: JSON.stringify(metadata ?? {}),
      category: (metadata?.category as string) ?? "general",
      source: (metadata?.source as string) ?? "unknown",
    });
  }

  async search(
    queryEmbedding: number[],
    topK = 10,
    filter?: VectorStoreFilter,
  ): Promise<VectorSearchResult[]> {
    await this.init();
    const { query: bqQuery } = await import("./bigquery.js");

    // Build filter clause (parameterized to prevent injection)
    const filterConditions: string[] = [];
    const params: Record<string, unknown> = { query_embedding: queryEmbedding };

    if (filter?.category) {
      filterConditions.push("base.category = @filter_category");
      params.filter_category = filter.category;
    }
    if (filter?.source) {
      filterConditions.push("base.source = @filter_source");
      params.filter_source = filter.source;
    }

    const filterClause = filterConditions.length > 0
      ? `WHERE ${filterConditions.join(" AND ")}`
      : "";

    const sql = `
      SELECT
        base.id,
        base.content,
        base.metadata,
        distance
      FROM
        VECTOR_SEARCH(
          TABLE \`${this.dataset}.${this.table}\`,
          'embedding',
          (SELECT @query_embedding AS embedding),
          top_k => ${topK},
          distance_type => 'COSINE'
        )
      ${filterClause}
      ORDER BY distance ASC
      LIMIT ${topK}
    `;

    const rows = await bqQuery<{
      id: string;
      content: string;
      metadata: string;
      distance: number;
    }>(sql, params);

    return rows.map((r) => ({
      id: r.id,
      content: r.content,
      metadata: safeParseJSON(r.metadata),
      score: 1 - r.distance, // Convert cosine distance → similarity
    }));
  }

  async delete(id: string): Promise<void> {
    await this.init();
    const { query: bqQuery } = await import("./bigquery.js");
    await bqQuery(`DELETE FROM \`${this.dataset}.${this.table}\` WHERE id = @id`, { id });
  }

  async count(): Promise<number> {
    await this.init();
    const { query: bqQuery } = await import("./bigquery.js");
    const rows = await bqQuery<{ cnt: number }>(
      `SELECT COUNT(*) AS cnt FROM \`${this.dataset}.${this.table}\``,
    );
    return rows[0]?.cnt ?? 0;
  }
}

// ─── In-Memory Vector Store ──────────────────────────────────

interface InMemoryEntry {
  embedding: number[];
  content: string;
  metadata: Record<string, unknown>;
}

class InMemoryVectorStore implements VectorStore {
  readonly backend = "in-memory";
  private store = new Map<string, InMemoryEntry>();

  async upsert(
    id: string,
    embedding: number[],
    content: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    this.store.set(id, {
      embedding,
      content,
      metadata: metadata ?? {},
    });
  }

  async search(
    queryEmbedding: number[],
    topK = 10,
    filter?: VectorStoreFilter,
  ): Promise<VectorSearchResult[]> {
    const results: VectorSearchResult[] = [];

    for (const [id, item] of this.store) {
      // Apply filters
      if (filter?.category && item.metadata.category !== filter.category) continue;
      if (filter?.source && item.metadata.source !== filter.source) continue;

      const score = cosineSimilarity(queryEmbedding, item.embedding);
      results.push({
        id,
        content: item.content,
        metadata: item.metadata,
        score,
      });
    }

    return results.sort((a, b) => b.score - a.score).slice(0, topK);
  }

  async delete(id: string): Promise<void> {
    this.store.delete(id);
  }

  async count(): Promise<number> {
    return this.store.size;
  }

  /** Get all entries (for testing / export) */
  entries(): Map<string, InMemoryEntry> {
    return this.store;
  }
}

// ─── Math Utilities ──────────────────────────────────────────

/**
 * Cosine similarity between two vectors.
 * Returns a value between -1 and 1, where 1 = identical direction.
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Vector dimension mismatch: ${a.length} vs ${b.length}`);
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;

  return dot / denominator;
}

// ─── Helpers ─────────────────────────────────────────────────

function safeParseJSON(str: string | null | undefined): Record<string, unknown> {
  if (!str) return {};
  try {
    return JSON.parse(str) as Record<string, unknown>;
  } catch {
    return {};
  }
}

// ─── Factory ─────────────────────────────────────────────────

/**
 * Create a vector store instance based on environment.
 * - GCP_PROJECT_ID set → BigQuery backend
 * - Otherwise → In-memory backend (dev mode)
 */
export function createVectorStore(): VectorStore {
  if (process.env.GCP_PROJECT_ID) {
    const dataset = process.env.BQ_DATASET || "crypto_vision";
    log.info({ backend: "bigquery", dataset }, "Using BigQuery vector store");
    return new BigQueryVectorStore(dataset);
  }

  log.info({ backend: "in-memory" }, "Using in-memory vector store (dev mode)");
  return new InMemoryVectorStore();
}

/** Singleton vector store instance */
export const vectorStore = createVectorStore();

/** Re-export for convenience */
export { cosineSimilarity, EMBEDDING_DIMENSION };
