/**
 * Related Articles Generator
 * 
 * Find and suggest related articles:
 * - Semantic similarity
 * - Topic overlap
 * - Entity co-occurrence
 * - Timeline relevance
 */

import type { ScoredDocument } from './types';

// Alias for document type
type RAGDocument = ScoredDocument;

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export interface RelatedArticle {
  document: RAGDocument;
  relevanceScore: number;
  relationship: 'similar' | 'followup' | 'background' | 'contrast' | 'update';
  sharedTopics: string[];
  explanation: string;
}

export interface RelatedArticlesConfig {
  maxArticles?: number;
  minRelevanceScore?: number;
  diversify?: boolean;
  includeBackgroundContext?: boolean;
  timeWindow?: 'same_day' | 'same_week' | 'same_month' | 'any';
}

// ═══════════════════════════════════════════════════════════════
// RELATED ARTICLES FINDER
// ═══════════════════════════════════════════════════════════════

export class RelatedArticlesFinder {
  /**
   * Find articles related to a given document
   */
  findRelated(
    sourceDocument: RAGDocument,
    allDocuments: RAGDocument[],
    config: RelatedArticlesConfig = {}
  ): RelatedArticle[] {
    const {
      maxArticles = 5,
      minRelevanceScore = 0.3,
      diversify = true,
      includeBackgroundContext = true,
      timeWindow = 'any',
    } = config;

    // Filter out source document
    const candidates = allDocuments.filter(d => d.id !== sourceDocument.id);
    
    // Apply time filter
    const timeFiltered = this.filterByTime(candidates, sourceDocument, timeWindow);
    
    // Score each candidate
    const scored = timeFiltered.map(doc => this.scoreRelationship(sourceDocument, doc));
    
    // Filter by minimum score
    const filtered = scored.filter(r => r.relevanceScore >= minRelevanceScore);
    
    // Sort by relevance
    filtered.sort((a, b) => b.relevanceScore - a.relevanceScore);
    
    // Diversify if requested
    if (diversify) {
      return this.diversifyResults(filtered, maxArticles, includeBackgroundContext);
    }
    
    return filtered.slice(0, maxArticles);
  }

  /**
   * Find articles related to a query and its answer context
   */
  findRelatedToContext(
    usedDocuments: RAGDocument[],
    allDocuments: RAGDocument[],
    query: string,
    config: RelatedArticlesConfig = {}
  ): RelatedArticle[] {
    const {
      maxArticles = 5,
      minRelevanceScore = 0.25,
    } = config;

    // Get IDs of used documents
    const usedIds = new Set(usedDocuments.map(d => d.id));
    
    // Filter candidates
    const candidates = allDocuments.filter(d => !usedIds.has(d.id));
    
    // Extract topics from used documents
    const topics = this.extractTopicsFromDocs(usedDocuments);
    
    // Score candidates based on topic overlap and query relevance
    const scored = candidates.map(doc => {
      const topicScore = this.calculateTopicOverlap(doc, topics);
      const queryScore = this.calculateQueryRelevance(doc, query);
      const timeScore = this.calculateTimeRelevance(doc, usedDocuments);
      
      const relevanceScore = (topicScore * 0.4) + (queryScore * 0.4) + (timeScore * 0.2);
      const sharedTopics = this.findSharedTopics(doc, topics);
      
      return {
        document: doc,
        relevanceScore,
        relationship: this.determineRelationship(doc, usedDocuments, sharedTopics) as RelatedArticle['relationship'],
        sharedTopics,
        explanation: this.generateExplanation(doc, sharedTopics, relevanceScore),
      };
    });
    
    return scored
      .filter(r => r.relevanceScore >= minRelevanceScore)
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, maxArticles);
  }

  /**
   * Group related articles by topic cluster
   */
  groupByTopic(
    articles: RelatedArticle[]
  ): Map<string, RelatedArticle[]> {
    const groups = new Map<string, RelatedArticle[]>();
    
    for (const article of articles) {
      const primaryTopic = article.sharedTopics[0] || 'general';
      
      if (!groups.has(primaryTopic)) {
        groups.set(primaryTopic, []);
      }
      groups.get(primaryTopic)!.push(article);
    }
    
    return groups;
  }

  // ═══════════════════════════════════════════════════════════════
  // SCORING METHODS
  // ═══════════════════════════════════════════════════════════════

  private scoreRelationship(source: RAGDocument, candidate: RAGDocument): RelatedArticle {
    // Calculate various similarity metrics
    const textSimilarity = this.calculateTextSimilarity(source.content, candidate.content);
    const titleSimilarity = this.calculateTextSimilarity(
      source.title || '',
      candidate.title || ''
    );
    const sourceSimilarity = source.source === candidate.source ? 0.1 : 0;
    const timeSimilarity = this.calculateTimeSimilarity(source, candidate);
    
    // Extract shared topics
    const sourceTopics = this.extractTopics(source);
    const candidateTopics = this.extractTopics(candidate);
    const sharedTopics = sourceTopics.filter(t => candidateTopics.includes(t));
    const topicScore = sharedTopics.length / Math.max(sourceTopics.length, 1);
    
    // Combined relevance score
    const relevanceScore = 
      (textSimilarity * 0.3) +
      (titleSimilarity * 0.2) +
      (topicScore * 0.3) +
      (timeSimilarity * 0.1) +
      sourceSimilarity;

    // Determine relationship type
    const relationship = this.determineRelationshipType(source, candidate, sharedTopics);
    
    return {
      document: candidate,
      relevanceScore: Math.min(1, relevanceScore),
      relationship,
      sharedTopics,
      explanation: this.generateExplanation(candidate, sharedTopics, relevanceScore),
    };
  }

  private calculateTextSimilarity(text1: string, text2: string): number {
    // Simple word overlap similarity
    const words1 = new Set(text1.toLowerCase().split(/\s+/).filter(w => w.length > 3));
    const words2 = new Set(text2.toLowerCase().split(/\s+/).filter(w => w.length > 3));
    
    if (words1.size === 0 || words2.size === 0) return 0;
    
    let overlap = 0;
    for (const word of words1) {
      if (words2.has(word)) overlap++;
    }
    
    return overlap / Math.max(words1.size, words2.size);
  }

  private calculateTimeSimilarity(doc1: RAGDocument, doc2: RAGDocument): number {
    const time1 = doc1.publishedAt
      ? new Date(doc1.publishedAt).getTime()
      : 0;
    const time2 = doc2.publishedAt
      ? new Date(doc2.publishedAt).getTime()
      : 0;

    if (!time1 || !time2) return 0.5;

    const diffDays = Math.abs(time1 - time2) / (24 * 60 * 60 * 1000);
    
    if (diffDays < 1) return 1;
    if (diffDays < 7) return 0.8;
    if (diffDays < 30) return 0.5;
    return 0.2;
  }

  private calculateTopicOverlap(doc: RAGDocument, topics: string[]): number {
    const docTopics = this.extractTopics(doc);
    const overlap = topics.filter(t => docTopics.includes(t));
    return overlap.length / Math.max(topics.length, 1);
  }

  private calculateQueryRelevance(doc: RAGDocument, query: string): number {
    const queryWords = new Set(query.toLowerCase().split(/\s+/).filter(w => w.length > 3));
    const docText = `${doc.title || ''} ${doc.content}`.toLowerCase();
    
    let matches = 0;
    for (const word of queryWords) {
      if (docText.includes(word)) matches++;
    }
    
    return matches / Math.max(queryWords.size, 1);
  }

  private calculateTimeRelevance(
    doc: RAGDocument,
    referenceDocs: RAGDocument[]
  ): number {
    const docTime = doc.publishedAt
      ? new Date(doc.publishedAt).getTime()
      : 0;
    
    if (!docTime) return 0.5;
    
    // Calculate average time of reference docs
    const refTimes = referenceDocs
      .map(d => d.publishedAt ? new Date(d.publishedAt).getTime() : 0)
      .filter(t => t > 0);
    
    if (refTimes.length === 0) return 0.5;
    
    const avgRefTime = refTimes.reduce((a, b) => a + b, 0) / refTimes.length;
    const diffDays = Math.abs(docTime - avgRefTime) / (24 * 60 * 60 * 1000);
    
    if (diffDays < 1) return 1;
    if (diffDays < 7) return 0.8;
    if (diffDays < 30) return 0.5;
    return 0.3;
  }

  // ═══════════════════════════════════════════════════════════════
  // TOPIC EXTRACTION
  // ═══════════════════════════════════════════════════════════════

  private extractTopics(doc: RAGDocument): string[] {
    const text = `${doc.title || ''} ${doc.content}`.toLowerCase();
    const topics: string[] = [];
    
    const topicPatterns: Record<string, RegExp> = {
      'bitcoin': /bitcoin|btc/i,
      'ethereum': /ethereum|eth/i,
      'solana': /solana|sol/i,
      'xrp': /ripple|xrp/i,
      'defi': /defi|decentralized finance/i,
      'nft': /nft|non-fungible/i,
      'regulation': /regulation|sec|regulatory/i,
      'etf': /\betf\b/i,
      'stablecoin': /stablecoin|usdt|usdc|tether/i,
      'mining': /mining|miner|proof of work/i,
      'staking': /staking|proof of stake/i,
      'exchange': /exchange|binance|coinbase|kraken/i,
      'hackattack': /hack|breach|exploit|vulnerability/i,
      'partnership': /partnership|collaboration|integrate/i,
      'price': /price|market|trading|volume/i,
      'adoption': /adoption|mainstream|institutional/i,
    };
    
    for (const [topic, pattern] of Object.entries(topicPatterns)) {
      if (pattern.test(text)) {
        topics.push(topic);
      }
    }
    
    return topics;
  }

  private extractTopicsFromDocs(docs: RAGDocument[]): string[] {
    const allTopics: string[] = [];
    for (const doc of docs) {
      allTopics.push(...this.extractTopics(doc));
    }
    return [...new Set(allTopics)];
  }

  private findSharedTopics(doc: RAGDocument, topics: string[]): string[] {
    const docTopics = this.extractTopics(doc);
    return docTopics.filter(t => topics.includes(t));
  }

  // ═══════════════════════════════════════════════════════════════
  // RELATIONSHIP DETERMINATION
  // ═══════════════════════════════════════════════════════════════

  private determineRelationshipType(
    source: RAGDocument,
    candidate: RAGDocument,
    sharedTopics: string[]
  ): RelatedArticle['relationship'] {
    const sourceTime = source.publishedAt
      ? new Date(source.publishedAt).getTime()
      : 0;
    const candidateTime = candidate.publishedAt
      ? new Date(candidate.publishedAt).getTime()
      : 0;

    // If candidate is newer than source and shares topics
    if (candidateTime > sourceTime && sharedTopics.length > 0) {
      return 'update';
    }

    // If candidate is significantly older, it's background
    if (sourceTime - candidateTime > 30 * 24 * 60 * 60 * 1000) {
      return 'background';
    }

    // If high topic overlap, it's similar
    if (sharedTopics.length >= 2) {
      return 'similar';
    }

    // Default to followup for same general context
    return 'followup';
  }

  private determineRelationship(
    doc: RAGDocument,
    usedDocs: RAGDocument[],
    sharedTopics: string[]
  ): string {
    const docTime = doc.publishedAt
      ? new Date(doc.publishedAt).getTime()
      : 0;

    const avgUsedTime = usedDocs
      .map(d => d.publishedAt ? new Date(d.publishedAt).getTime() : 0)
      .filter(t => t > 0)
      .reduce((sum, t, _, arr) => sum + t / arr.length, 0);

    if (docTime > avgUsedTime && sharedTopics.length > 0) {
      return 'update';
    }

    if (avgUsedTime - docTime > 30 * 24 * 60 * 60 * 1000) {
      return 'background';
    }

    if (sharedTopics.length >= 2) {
      return 'similar';
    }

    return 'followup';
  }

  // ═══════════════════════════════════════════════════════════════
  // FILTERING & DIVERSIFICATION
  // ═══════════════════════════════════════════════════════════════

  private filterByTime(
    documents: RAGDocument[],
    source: RAGDocument,
    window: RelatedArticlesConfig['timeWindow']
  ): RAGDocument[] {
    if (window === 'any') return documents;

    const sourceTime = source.publishedAt
      ? new Date(source.publishedAt).getTime()
      : Date.now();

    const windowMs: Record<string, number> = {
      'same_day': 24 * 60 * 60 * 1000,
      'same_week': 7 * 24 * 60 * 60 * 1000,
      'same_month': 30 * 24 * 60 * 60 * 1000,
    };

    const maxDiff = windowMs[window!] || Infinity;

    return documents.filter(doc => {
      const docTime = doc.publishedAt
        ? new Date(doc.publishedAt).getTime()
        : 0;
      return Math.abs(docTime - sourceTime) <= maxDiff;
    });
  }

  private diversifyResults(
    articles: RelatedArticle[],
    maxArticles: number,
    includeBackground: boolean
  ): RelatedArticle[] {
    const result: RelatedArticle[] = [];
    const usedTopics = new Set<string>();
    const usedRelationships = new Set<string>();

    // First pass: ensure diversity of topics and relationships
    for (const article of articles) {
      if (result.length >= maxArticles) break;

      const primaryTopic = article.sharedTopics[0];
      const isNewTopic = primaryTopic && !usedTopics.has(primaryTopic);
      const isNewRelationship = !usedRelationships.has(article.relationship);

      if (isNewTopic || isNewRelationship || result.length < 2) {
        result.push(article);
        if (primaryTopic) usedTopics.add(primaryTopic);
        usedRelationships.add(article.relationship);
      }
    }

    // Second pass: fill remaining slots
    for (const article of articles) {
      if (result.length >= maxArticles) break;
      if (!result.includes(article)) {
        // Skip background if not requested
        if (!includeBackground && article.relationship === 'background') {
          continue;
        }
        result.push(article);
      }
    }

    return result;
  }

  private generateExplanation(
    doc: RAGDocument,
    sharedTopics: string[],
    score: number
  ): string {
    const topicStr = sharedTopics.length > 0
      ? `about ${sharedTopics.slice(0, 2).join(' and ')}`
      : '';
    
    const scoreLevel = score > 0.7 ? 'Highly' : score > 0.4 ? 'Moderately' : 'Somewhat';
    
    return `${scoreLevel} related ${topicStr}`.trim();
  }
}

// ═══════════════════════════════════════════════════════════════
// CONVENIENCE FUNCTIONS
// ═══════════════════════════════════════════════════════════════

export const relatedArticlesFinder = new RelatedArticlesFinder();

/**
 * Quick helper to find related articles
 */
export function findRelatedArticles(
  usedDocuments: RAGDocument[],
  allDocuments: RAGDocument[],
  query: string,
  maxArticles: number = 5
): RelatedArticle[] {
  return relatedArticlesFinder.findRelatedToContext(
    usedDocuments,
    allDocuments,
    query,
    { maxArticles }
  );
}
