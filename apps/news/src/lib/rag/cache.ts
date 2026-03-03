/**
 * Intelligent RAG Caching
 * 
 * Multi-layer caching for optimal performance:
 * - Query cache (semantic similarity matching)
 * - Embedding cache
 * - LLM response cache
 * - Document cache
 */

import type { ScoredDocument } from './types';

// Alias for document type used in cache
type RAGDocument = ScoredDocument;

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export interface CacheEntry<T> {
  key: string;
  value: T;
  createdAt: number;
  expiresAt: number;
  accessCount: number;
  lastAccessedAt: number;
  metadata?: Record<string, unknown>;
}

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  size: number;
  memoryUsageBytes: number;
}

export interface QueryCacheEntry {
  query: string;
  queryEmbedding: number[];
  answer: string;
  documents: RAGDocument[];
  metadata: {
    confidence: number;
    sources: string[];
    createdAt: number;
  };
}

export interface EmbeddingCacheEntry {
  text: string;
  embedding: number[];
  model: string;
}

// ═══════════════════════════════════════════════════════════════
// BASE CACHE CLASS
// ═══════════════════════════════════════════════════════════════

class LRUCache<T> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private maxSize: number;
  private ttlMs: number;
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    hitRate: 0,
    size: 0,
    memoryUsageBytes: 0,
  };

  constructor(maxSize: number = 1000, ttlMinutes: number = 60) {
    this.maxSize = maxSize;
    this.ttlMs = ttlMinutes * 60 * 1000;
  }

  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.stats.misses++;
      this.updateHitRate();
      return undefined;
    }

    // Check expiration
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.stats.misses++;
      this.updateHitRate();
      return undefined;
    }

    // Update access stats
    entry.accessCount++;
    entry.lastAccessedAt = Date.now();
    
    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);

    this.stats.hits++;
    this.updateHitRate();
    return entry.value;
  }

  set(key: string, value: T, metadata?: Record<string, unknown>): void {
    // Evict if at capacity
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }

    const entry: CacheEntry<T> = {
      key,
      value,
      createdAt: Date.now(),
      expiresAt: Date.now() + this.ttlMs,
      accessCount: 1,
      lastAccessedAt: Date.now(),
      metadata,
    };

    this.cache.set(key, entry);
    this.stats.size = this.cache.size;
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }
    return true;
  }

  delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    this.stats.size = this.cache.size;
    return deleted;
  }

  clear(): void {
    this.cache.clear();
    this.stats = {
      hits: 0,
      misses: 0,
      hitRate: 0,
      size: 0,
      memoryUsageBytes: 0,
    };
  }

  getStats(): CacheStats {
    return { ...this.stats };
  }

  cleanup(): number {
    let removed = 0;
    const now = Date.now();
    
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        removed++;
      }
    }
    
    this.stats.size = this.cache.size;
    return removed;
  }

  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }
}

// ═══════════════════════════════════════════════════════════════
// EMBEDDING CACHE
// ═══════════════════════════════════════════════════════════════

export class EmbeddingCache {
  private cache: LRUCache<number[]>;

  constructor(maxSize: number = 10000, ttlMinutes: number = 1440) { // 24 hours default
    this.cache = new LRUCache(maxSize, ttlMinutes);
  }

  private makeKey(text: string, model: string): string {
    // Hash the text for consistent key
    const hash = this.simpleHash(text);
    return `emb:${model}:${hash}`;
  }

  private simpleHash(text: string): string {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  get(text: string, model: string): number[] | undefined {
    const key = this.makeKey(text, model);
    return this.cache.get(key);
  }

  set(text: string, model: string, embedding: number[]): void {
    const key = this.makeKey(text, model);
    this.cache.set(key, embedding, { text: text.slice(0, 100), model });
  }

  async getOrCompute(
    text: string,
    model: string,
    computeFn: () => Promise<number[]>
  ): Promise<number[]> {
    const cached = this.get(text, model);
    if (cached) return cached;

    const embedding = await computeFn();
    this.set(text, model, embedding);
    return embedding;
  }

  getStats(): CacheStats {
    return this.cache.getStats();
  }
}

// ═══════════════════════════════════════════════════════════════
// SEMANTIC QUERY CACHE
// ═══════════════════════════════════════════════════════════════

export class SemanticQueryCache {
  private cache: LRUCache<QueryCacheEntry>;
  private queryEmbeddings: Map<string, number[]> = new Map();
  private similarityThreshold: number;

  constructor(
    maxSize: number = 500,
    ttlMinutes: number = 30,
    similarityThreshold: number = 0.92
  ) {
    this.cache = new LRUCache(maxSize, ttlMinutes);
    this.similarityThreshold = similarityThreshold;
  }

  /**
   * Store query result with embedding for semantic matching
   */
  set(
    query: string,
    queryEmbedding: number[],
    answer: string,
    documents: RAGDocument[],
    confidence: number
  ): void {
    const key = this.normalizeQuery(query);
    
    const entry: QueryCacheEntry = {
      query,
      queryEmbedding,
      answer,
      documents,
      metadata: {
        confidence,
        sources: documents.map(d => d.source),
        createdAt: Date.now(),
      },
    };

    this.cache.set(key, entry);
    this.queryEmbeddings.set(key, queryEmbedding);
  }

  /**
   * Get exact match
   */
  getExact(query: string): QueryCacheEntry | undefined {
    const key = this.normalizeQuery(query);
    return this.cache.get(key);
  }

  /**
   * Find semantically similar cached query
   */
  findSimilar(queryEmbedding: number[]): QueryCacheEntry | undefined {
    let bestMatch: QueryCacheEntry | undefined;
    let bestSimilarity = this.similarityThreshold;

    for (const [key, embedding] of this.queryEmbeddings.entries()) {
      const similarity = this.cosineSimilarity(queryEmbedding, embedding);
      
      if (similarity > bestSimilarity) {
        const entry = this.cache.get(key);
        if (entry) {
          bestMatch = entry;
          bestSimilarity = similarity;
        }
      }
    }

    return bestMatch;
  }

  /**
   * Get cached result with semantic fallback
   */
  async get(
    query: string,
    getEmbedding?: () => Promise<number[]>
  ): Promise<{ entry: QueryCacheEntry; type: 'exact' | 'similar' } | undefined> {
    // Try exact match first
    const exact = this.getExact(query);
    if (exact) {
      return { entry: exact, type: 'exact' };
    }

    // Try semantic match if embedding function provided
    if (getEmbedding) {
      const embedding = await getEmbedding();
      const similar = this.findSimilar(embedding);
      if (similar) {
        return { entry: similar, type: 'similar' };
      }
    }

    return undefined;
  }

  private normalizeQuery(query: string): string {
    return query.toLowerCase().trim().replace(/\s+/g, ' ');
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }

  getStats(): CacheStats {
    return this.cache.getStats();
  }

  clear(): void {
    this.cache.clear();
    this.queryEmbeddings.clear();
  }
}

// ═══════════════════════════════════════════════════════════════
// LLM RESPONSE CACHE
// ═══════════════════════════════════════════════════════════════

export class LLMResponseCache {
  private cache: LRUCache<string>;

  constructor(maxSize: number = 1000, ttlMinutes: number = 60) {
    this.cache = new LRUCache(maxSize, ttlMinutes);
  }

  private makeKey(prompt: string, model: string, temperature: number): string {
    const hash = this.hashPrompt(prompt);
    return `llm:${model}:${temperature}:${hash}`;
  }

  private hashPrompt(prompt: string): string {
    let hash = 0;
    for (let i = 0; i < prompt.length; i++) {
      const char = prompt.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  get(prompt: string, model: string, temperature: number = 0): string | undefined {
    // Only cache deterministic responses (temperature 0)
    if (temperature > 0) return undefined;
    
    const key = this.makeKey(prompt, model, temperature);
    return this.cache.get(key);
  }

  set(
    prompt: string,
    model: string,
    response: string,
    temperature: number = 0
  ): void {
    // Only cache deterministic responses
    if (temperature > 0) return;
    
    const key = this.makeKey(prompt, model, temperature);
    this.cache.set(key, response);
  }

  async getOrCompute(
    prompt: string,
    model: string,
    computeFn: () => Promise<string>,
    temperature: number = 0
  ): Promise<string> {
    const cached = this.get(prompt, model, temperature);
    if (cached) return cached;

    const response = await computeFn();
    this.set(prompt, model, response, temperature);
    return response;
  }

  getStats(): CacheStats {
    return this.cache.getStats();
  }
}

// ═══════════════════════════════════════════════════════════════
// DOCUMENT CACHE
// ═══════════════════════════════════════════════════════════════

export class DocumentCache {
  private cache: LRUCache<RAGDocument>;

  constructor(maxSize: number = 5000, ttlMinutes: number = 120) {
    this.cache = new LRUCache(maxSize, ttlMinutes);
  }

  get(id: string): RAGDocument | undefined {
    return this.cache.get(id);
  }

  set(doc: RAGDocument): void {
    this.cache.set(doc.id, doc);
  }

  getMany(ids: string[]): RAGDocument[] {
    const results: RAGDocument[] = [];
    for (const id of ids) {
      const doc = this.get(id);
      if (doc) results.push(doc);
    }
    return results;
  }

  setMany(docs: RAGDocument[]): void {
    for (const doc of docs) {
      this.set(doc);
    }
  }

  getStats(): CacheStats {
    return this.cache.getStats();
  }
}

// ═══════════════════════════════════════════════════════════════
// UNIFIED CACHE MANAGER
// ═══════════════════════════════════════════════════════════════

export class RAGCacheManager {
  readonly embedding: EmbeddingCache;
  readonly query: SemanticQueryCache;
  readonly llm: LLMResponseCache;
  readonly document: DocumentCache;

  constructor(config?: {
    embeddingCacheSize?: number;
    queryCacheSize?: number;
    llmCacheSize?: number;
    documentCacheSize?: number;
    embeddingTTL?: number;
    queryTTL?: number;
    llmTTL?: number;
    documentTTL?: number;
    similarityThreshold?: number;
  }) {
    this.embedding = new EmbeddingCache(
      config?.embeddingCacheSize ?? 10000,
      config?.embeddingTTL ?? 1440
    );
    this.query = new SemanticQueryCache(
      config?.queryCacheSize ?? 500,
      config?.queryTTL ?? 30,
      config?.similarityThreshold ?? 0.92
    );
    this.llm = new LLMResponseCache(
      config?.llmCacheSize ?? 1000,
      config?.llmTTL ?? 60
    );
    this.document = new DocumentCache(
      config?.documentCacheSize ?? 5000,
      config?.documentTTL ?? 120
    );
  }

  /**
   * Get all cache statistics
   */
  getAllStats(): {
    embedding: CacheStats;
    query: CacheStats;
    llm: CacheStats;
    document: CacheStats;
    total: {
      hitRate: number;
      totalSize: number;
    };
  } {
    const embedding = this.embedding.getStats();
    const query = this.query.getStats();
    const llm = this.llm.getStats();
    const document = this.document.getStats();

    const totalHits = embedding.hits + query.hits + llm.hits + document.hits;
    const totalMisses = embedding.misses + query.misses + llm.misses + document.misses;
    const totalRequests = totalHits + totalMisses;

    return {
      embedding,
      query,
      llm,
      document,
      total: {
        hitRate: totalRequests > 0 ? totalHits / totalRequests : 0,
        totalSize: embedding.size + query.size + llm.size + document.size,
      },
    };
  }

  /**
   * Clear all caches
   */
  clearAll(): void {
    this.query.clear();
  }
}

// Global cache instance
export const ragCache = new RAGCacheManager();
