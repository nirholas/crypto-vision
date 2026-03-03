/**
 * Document Ranker
 * 
 * Adapted from crypto-news-rag VoteScoreDocumentRanker.java
 * Re-ranks search results based on vote score and other signals.
 */

import type { SearchResult } from './types';

/**
 * Rank documents by the absolute value of vote score
 * Higher absolute vote score = more significant user sentiment
 */
export function rankByVoteScore(results: SearchResult[], limit?: number): SearchResult[] {
  const sorted = [...results].sort((a, b) => {
    const aScore = Math.abs(a.document.metadata.voteScore);
    const bScore = Math.abs(b.document.metadata.voteScore);
    return bScore - aScore;
  });
  
  return limit ? sorted.slice(0, limit) : sorted;
}

/**
 * Rank documents by recency (most recent first)
 */
export function rankByRecency(results: SearchResult[], limit?: number): SearchResult[] {
  const sorted = [...results].sort((a, b) => {
    const aDate = new Date(a.document.metadata.pubDate);
    const bDate = new Date(b.document.metadata.pubDate);
    return bDate.getTime() - aDate.getTime();
  });
  
  return limit ? sorted.slice(0, limit) : sorted;
}

/**
 * Rank documents by similarity score (already the case, but explicit)
 */
export function rankBySimilarity(results: SearchResult[], limit?: number): SearchResult[] {
  const sorted = [...results].sort((a, b) => b.score - a.score);
  return limit ? sorted.slice(0, limit) : sorted;
}

/**
 * Combined ranking: weights similarity, vote score, and recency
 */
export function rankCombined(
  results: SearchResult[],
  limit?: number,
  weights: { similarity: number; voteScore: number; recency: number } = {
    similarity: 0.5,
    voteScore: 0.3,
    recency: 0.2,
  }
): SearchResult[] {
  const now = Date.now();
  const maxAgeMs = 30 * 24 * 60 * 60 * 1000; // 30 days as reference
  
  // Normalize scores
  const maxVoteScore = Math.max(...results.map(r => Math.abs(r.document.metadata.voteScore)), 0.01);
  
  const scored = results.map(result => {
    const ageMs = now - new Date(result.document.metadata.pubDate).getTime();
    const recencyScore = Math.max(0, 1 - ageMs / maxAgeMs);
    const normalizedVoteScore = Math.abs(result.document.metadata.voteScore) / maxVoteScore;
    
    const combinedScore = 
      weights.similarity * result.score +
      weights.voteScore * normalizedVoteScore +
      weights.recency * recencyScore;
    
    return { ...result, combinedScore };
  });
  
  scored.sort((a, b) => b.combinedScore - a.combinedScore);
  
  return limit ? scored.slice(0, limit) : scored;
}

/**
 * Diversify results by source
 * Ensures variety by limiting documents from same source
 */
export function diversifyBySource(
  results: SearchResult[],
  maxPerSource: number = 2,
  limit?: number
): SearchResult[] {
  const sourceCounts = new Map<string, number>();
  const diversified: SearchResult[] = [];
  
  for (const result of results) {
    const source = result.document.metadata.source;
    const currentCount = sourceCounts.get(source) || 0;
    
    if (currentCount < maxPerSource) {
      diversified.push(result);
      sourceCounts.set(source, currentCount + 1);
    }
    
    if (limit && diversified.length >= limit) break;
  }
  
  return diversified;
}

/**
 * Default ranking pipeline for RAG
 */
export function rankForRAG(
  results: SearchResult[],
  topKSimilar: number = 10,
  topKFinal: number = 5
): SearchResult[] {
  // First, take top K by similarity
  let ranked = rankBySimilarity(results, topKSimilar);
  
  // Then re-rank by vote score
  ranked = rankByVoteScore(ranked, topKFinal);
  
  return ranked;
}
