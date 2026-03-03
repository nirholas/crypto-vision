/**
 * RAG System Types
 * 
 * Adapted from crypto-news-rag (Java/Spring AI) to TypeScript
 * Original: https://github.com/soheilrahsaz/crypto-news-rag
 * 
 * Type definitions for the Retrieval-Augmented Generation system
 * that enables natural language querying of crypto news.
 */

/**
 * Raw news article from archive
 */
export interface RawNews {
  id: string;
  title: string;
  description: string;
  pubDate: string;
  link: string;
  source: string;
  sourceKey: string;
  category: string;
  currencies?: string[];
  votes?: {
    positive: number;
    negative: number;
  };
  sentiment?: string;
}

/**
 * Document stored in vector database with embedding
 */
export interface NewsDocument {
  id: string;
  content: string;  // description text that gets embedded
  embedding?: number[];
  metadata: NewsMetadata;
}

/**
 * Metadata attached to each document
 */
export interface NewsMetadata {
  title: string;
  description?: string;
  pubDate: string;
  url: string;
  source: string;
  sourceKey?: string;
  category?: string;
  currencies?: string[];
  voteUp?: number;
  voteDown?: number;
  voteScore: number;
}

/**
 * Date range extracted from user query
 */
export interface DateRange {
  startDate: string;  // YYYY-MM-DD
  endDate: string;    // YYYY-MM-DD
}

/**
 * Search filter for vector store queries
 */
export interface SearchFilter {
  dateRange?: DateRange;
  currencies?: string[];
  sources?: string[];
  categories?: string[];
  minVoteScore?: number;
}

/**
 * Result from vector similarity search
 */
export interface SearchResult {
  document: NewsDocument;
  score: number;  // similarity score 0-1
}

/**
 * Flattened document with score (for reranking pipelines)
 */
export interface ScoredDocument {
  id: string;
  title: string;
  content: string;
  publishedAt?: Date;
  source: string;
  url?: string;
  voteScore?: number;
  score: number;  // combined/reranked score
  metadata?: Record<string, unknown>;
}

/**
 * RAG query options
 */
export interface RAGQueryOptions {
  topK?: number;
  similarityThreshold?: number;
  maxDocumentsForContext?: number;
  includeSources?: boolean;
}

/**
 * RAG response
 */
export interface RAGResponse {
  answer: string;
  sources: Array<{
    title: string;
    url: string;
    pubDate: string;
    source: string;
    voteScore: number;
  }>;
  extractedFilters: {
    dateRange?: DateRange;
    currencies?: string[];
  };
  processingTime: number;
}

/**
 * Embedding model configuration
 */
export interface EmbeddingConfig {
  provider: 'openai' | 'huggingface' | 'local';
  model: string;
  dimensions: number;
  normalize?: boolean;
}

/**
 * Vector store statistics
 */
export interface VectorStoreStats {
  totalDocuments: number;
  dateRange: {
    earliest: string;
    latest: string;
  };
  sources: string[];
  categories: string[];
  lastUpdated: string;
}
