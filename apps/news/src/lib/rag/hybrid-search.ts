/**
 * Hybrid Search
 * 
 * Combines semantic (vector) search with keyword (BM25) search
 * for better retrieval performance.
 */

import type { SearchResult, NewsDocument, SearchFilter } from './types';
import { vectorStore } from './vector-store';
import { generateEmbedding } from './embedding-service';

/**
 * BM25 parameters
 */
const BM25_K1 = 1.2;
const BM25_B = 0.75;

/**
 * Tokenize text for BM25
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2);
}

/**
 * Calculate term frequency
 */
function termFrequency(term: string, tokens: string[]): number {
  return tokens.filter(t => t === term).length;
}

/**
 * Calculate BM25 score for a document
 */
function bm25Score(
  queryTokens: string[],
  docTokens: string[],
  avgDocLength: number,
  docFrequencies: Map<string, number>,
  totalDocs: number
): number {
  const docLength = docTokens.length;
  let score = 0;

  for (const term of queryTokens) {
    const tf = termFrequency(term, docTokens);
    if (tf === 0) continue;

    const df = docFrequencies.get(term) || 0;
    const idf = Math.log((totalDocs - df + 0.5) / (df + 0.5) + 1);
    
    const numerator = tf * (BM25_K1 + 1);
    const denominator = tf + BM25_K1 * (1 - BM25_B + BM25_B * (docLength / avgDocLength));
    
    score += idf * (numerator / denominator);
  }

  return score;
}

/**
 * Keyword search using BM25
 */
export async function keywordSearch(
  query: string,
  documents: NewsDocument[],
  topK: number = 10
): Promise<SearchResult[]> {
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return [];

  // Pre-compute document statistics
  const docTokensList = documents.map(doc => 
    tokenize(`${doc.metadata.title} ${doc.content}`)
  );
  const avgDocLength = docTokensList.reduce((sum, tokens) => sum + tokens.length, 0) / documents.length;

  // Calculate document frequencies
  const docFrequencies = new Map<string, number>();
  for (const tokens of docTokensList) {
    const uniqueTerms = new Set(tokens);
    for (const term of uniqueTerms) {
      docFrequencies.set(term, (docFrequencies.get(term) || 0) + 1);
    }
  }

  // Score each document
  const results: SearchResult[] = documents.map((doc, i) => ({
    document: doc,
    score: bm25Score(
      queryTokens,
      docTokensList[i],
      avgDocLength,
      docFrequencies,
      documents.length
    ),
  }));

  // Sort and return top K
  return results
    .filter(r => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

/**
 * Reciprocal Rank Fusion
 * Combines rankings from multiple retrieval methods
 */
function reciprocalRankFusion(
  rankings: SearchResult[][],
  k: number = 60
): SearchResult[] {
  const scores = new Map<string, { document: NewsDocument; score: number }>();

  for (const ranking of rankings) {
    for (let i = 0; i < ranking.length; i++) {
      const { document } = ranking[i];
      const rrfScore = 1 / (k + i + 1);
      
      const existing = scores.get(document.id);
      if (existing) {
        existing.score += rrfScore;
      } else {
        scores.set(document.id, { document, score: rrfScore });
      }
    }
  }

  return Array.from(scores.values())
    .sort((a, b) => b.score - a.score);
}

/**
 * Weighted score combination
 */
function weightedCombination(
  semanticResults: SearchResult[],
  keywordResults: SearchResult[],
  semanticWeight: number = 0.7
): SearchResult[] {
  const keywordWeight = 1 - semanticWeight;
  const scores = new Map<string, { document: NewsDocument; score: number }>();

  // Normalize semantic scores
  const maxSemantic = Math.max(...semanticResults.map(r => r.score), 0.001);
  for (const result of semanticResults) {
    scores.set(result.document.id, {
      document: result.document,
      score: (result.score / maxSemantic) * semanticWeight,
    });
  }

  // Add normalized keyword scores
  const maxKeyword = Math.max(...keywordResults.map(r => r.score), 0.001);
  for (const result of keywordResults) {
    const existing = scores.get(result.document.id);
    const keywordScore = (result.score / maxKeyword) * keywordWeight;
    
    if (existing) {
      existing.score += keywordScore;
    } else {
      scores.set(result.document.id, {
        document: result.document,
        score: keywordScore,
      });
    }
  }

  return Array.from(scores.values())
    .sort((a, b) => b.score - a.score);
}

export interface HybridSearchOptions {
  topK?: number;
  filter?: SearchFilter;
  semanticWeight?: number;
  similarityThreshold?: number;
  fusionMethod?: 'rrf' | 'weighted';
}

/**
 * Hybrid search combining semantic and keyword retrieval
 */
export async function hybridSearch(
  query: string,
  options: HybridSearchOptions = {}
): Promise<SearchResult[]> {
  const {
    topK = 10,
    filter,
    semanticWeight = 0.7,
    similarityThreshold = 0.3,
    fusionMethod = 'weighted',
  } = options;

  // Get more candidates than needed for fusion
  const candidateK = topK * 3;

  // Semantic search
  const queryEmbedding = await generateEmbedding(query);
  const semanticResults = await vectorStore.search(
    queryEmbedding,
    candidateK,
    filter,
    similarityThreshold
  );

  // Get all candidate documents for keyword search
  const candidateDocs = semanticResults.map(r => r.document);
  
  // Also get some additional documents from the store for keyword diversity
  // (in a real implementation, you'd want a separate keyword index)
  
  // Keyword search on candidates
  const keywordResults = await keywordSearch(query, candidateDocs, candidateK);

  // Combine results
  let combined: SearchResult[];
  
  if (fusionMethod === 'rrf') {
    combined = reciprocalRankFusion([semanticResults, keywordResults]);
  } else {
    combined = weightedCombination(semanticResults, keywordResults, semanticWeight);
  }

  return combined.slice(0, topK);
}

/**
 * Search with query expansion
 * Expands query with synonyms and related terms
 */
export async function searchWithExpansion(
  query: string,
  options: HybridSearchOptions = {}
): Promise<SearchResult[]> {
  // Crypto-specific expansions
  const expansions: Record<string, string[]> = {
    btc: ['bitcoin', 'btc', 'satoshi'],
    bitcoin: ['bitcoin', 'btc', 'satoshi'],
    eth: ['ethereum', 'eth', 'ether'],
    ethereum: ['ethereum', 'eth', 'ether'],
    price: ['price', 'value', 'worth', 'cost'],
    crash: ['crash', 'dump', 'plunge', 'drop', 'fall'],
    pump: ['pump', 'surge', 'rally', 'rise', 'spike'],
    bullish: ['bullish', 'bull', 'positive', 'optimistic'],
    bearish: ['bearish', 'bear', 'negative', 'pessimistic'],
    defi: ['defi', 'decentralized finance', 'yield'],
    nft: ['nft', 'non-fungible', 'collectible'],
    etf: ['etf', 'exchange traded fund', 'spot etf'],
    regulation: ['regulation', 'sec', 'regulatory', 'compliance'],
    hack: ['hack', 'exploit', 'breach', 'attack'],
  };

  // Expand query
  const words = query.toLowerCase().split(/\s+/);
  const expandedTerms = new Set(words);
  
  for (const word of words) {
    const related = expansions[word];
    if (related) {
      related.forEach(term => expandedTerms.add(term));
    }
  }

  const expandedQuery = Array.from(expandedTerms).join(' ');

  return hybridSearch(expandedQuery, options);
}
