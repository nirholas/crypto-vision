/**
 * Query Understanding & Decomposition
 * 
 * Advanced query processing for complex questions:
 * - Query classification
 * - Multi-step query decomposition
 * - Intent extraction
 * - Query expansion & reformulation
 * - HyDE (Hypothetical Document Embeddings)
 */

import { callGroq, parseGroqJson } from '../groq';
import { aiCache } from '../cache';

// ═══════════════════════════════════════════════════════════════
// QUERY CLASSIFICATION
// ═══════════════════════════════════════════════════════════════

export type QueryIntent = 
  | 'factual'           // What is X?
  | 'temporal'          // What happened recently?
  | 'comparison'        // How does X compare to Y?
  | 'causal'            // Why did X happen?
  | 'predictive'        // What will happen to X?
  | 'aggregation'       // Summary/overview requests
  | 'opinion'           // Sentiment/opinion seeking
  | 'procedural';       // How to do X?

export interface QueryClassification {
  intent: QueryIntent;
  confidence: number;
  entities: string[];
  timeframe: 'recent' | 'historical' | 'future' | 'unspecified';
  complexity: 'simple' | 'moderate' | 'complex';
  requiresMultiHop: boolean;
}

/**
 * Classify query intent and extract metadata
 */
export async function classifyQuery(query: string): Promise<QueryClassification> {
  const cacheKey = `query_class:${query}`;
  const cached = aiCache.get<QueryClassification>(cacheKey);
  if (cached) return cached;

  const prompt = `Analyze this crypto news query and classify it.

Query: "${query}"

Respond with JSON:
{
  "intent": "factual|temporal|comparison|causal|predictive|aggregation|opinion|procedural",
  "confidence": 0.0-1.0,
  "entities": ["list", "of", "mentioned", "entities"],
  "timeframe": "recent|historical|future|unspecified",
  "complexity": "simple|moderate|complex",
  "requiresMultiHop": true/false (does answering require combining info from multiple articles?)
}`;

  try {
    const response = await callGroq([{ role: 'user', content: prompt }], {
      temperature: 0.1,
      maxTokens: 256,
      jsonMode: true,
    });

    const result = parseGroqJson<QueryClassification>(response.content);
    aiCache.set(cacheKey, result, 3600);
    return result;
  } catch {
    return {
      intent: 'factual',
      confidence: 0.5,
      entities: [],
      timeframe: 'unspecified',
      complexity: 'simple',
      requiresMultiHop: false,
    };
  }
}

// ═══════════════════════════════════════════════════════════════
// QUERY DECOMPOSITION
// ═══════════════════════════════════════════════════════════════

export interface SubQuery {
  query: string;
  purpose: string;
  dependsOn?: number[]; // Indices of queries this depends on
}

export interface DecomposedQuery {
  original: string;
  isComplex: boolean;
  subQueries: SubQuery[];
  synthesisStrategy: 'merge' | 'sequence' | 'compare';
}

/**
 * Decompose complex queries into simpler sub-queries
 */
export async function decomposeQuery(query: string): Promise<DecomposedQuery> {
  const classification = await classifyQuery(query);
  
  // Simple queries don't need decomposition
  if (classification.complexity === 'simple' && !classification.requiresMultiHop) {
    return {
      original: query,
      isComplex: false,
      subQueries: [{ query, purpose: 'main' }],
      synthesisStrategy: 'merge',
    };
  }

  const prompt = `Break down this complex crypto news question into simpler sub-questions that can be answered independently.

Original question: "${query}"

Rules:
- Each sub-question should be answerable from a single news article
- Order matters - some questions may depend on answers from previous ones
- Include a final synthesis question if needed

Respond with JSON:
{
  "subQueries": [
    {"query": "sub-question 1", "purpose": "what this answers", "dependsOn": []},
    {"query": "sub-question 2", "purpose": "what this answers", "dependsOn": [0]}
  ],
  "synthesisStrategy": "merge|sequence|compare"
}`;

  try {
    const response = await callGroq([{ role: 'user', content: prompt }], {
      temperature: 0.3,
      maxTokens: 512,
      jsonMode: true,
    });

    const parsed = parseGroqJson<{ subQueries: SubQuery[]; synthesisStrategy: 'merge' | 'sequence' | 'compare' }>(response.content);
    
    return {
      original: query,
      isComplex: true,
      subQueries: parsed.subQueries,
      synthesisStrategy: parsed.synthesisStrategy,
    };
  } catch {
    return {
      original: query,
      isComplex: false,
      subQueries: [{ query, purpose: 'main' }],
      synthesisStrategy: 'merge',
    };
  }
}

// ═══════════════════════════════════════════════════════════════
// QUERY EXPANSION
// ═══════════════════════════════════════════════════════════════

export interface ExpandedQuery {
  original: string;
  expanded: string;
  synonyms: string[];
  relatedTerms: string[];
}

/**
 * Expand query with synonyms and related terms
 */
export async function expandQuery(query: string): Promise<ExpandedQuery> {
  const prompt = `Expand this crypto news search query with relevant synonyms and related terms.

Query: "${query}"

Think about:
- Cryptocurrency name variations (Bitcoin/BTC)
- Related concepts and events
- Industry terminology
- Common misspellings

Respond with JSON:
{
  "synonyms": ["list of synonyms for key terms"],
  "relatedTerms": ["conceptually related terms"],
  "expanded": "the query rewritten to be more comprehensive"
}`;

  try {
    const response = await callGroq([{ role: 'user', content: prompt }], {
      temperature: 0.3,
      maxTokens: 256,
      jsonMode: true,
    });

    const parsed = parseGroqJson<{ synonyms: string[]; relatedTerms: string[]; expanded: string }>(response.content);
    
    return {
      original: query,
      expanded: parsed.expanded,
      synonyms: parsed.synonyms,
      relatedTerms: parsed.relatedTerms,
    };
  } catch {
    return {
      original: query,
      expanded: query,
      synonyms: [],
      relatedTerms: [],
    };
  }
}

// ═══════════════════════════════════════════════════════════════
// HYDE - HYPOTHETICAL DOCUMENT EMBEDDINGS
// ═══════════════════════════════════════════════════════════════

/**
 * Generate a hypothetical document that would answer the query
 * This document is then embedded and used for similarity search
 * Often produces better retrieval than embedding the query directly
 */
export async function generateHypotheticalDocument(query: string): Promise<string> {
  const cacheKey = `hyde:${query}`;
  const cached = aiCache.get<string>(cacheKey);
  if (cached) return cached;

  const prompt = `Write a short news article paragraph that would perfectly answer this question about cryptocurrency:

Question: "${query}"

Write as if you're a crypto news journalist. Include specific details, dates, prices, and names where appropriate. Keep it to 2-3 sentences.

Article paragraph:`;

  try {
    const response = await callGroq([{ role: 'user', content: prompt }], {
      temperature: 0.7,
      maxTokens: 256,
    });

    const doc = response.content.trim();
    aiCache.set(cacheKey, doc, 1800);
    return doc;
  } catch {
    return query; // Fallback to original query
  }
}

/**
 * Generate multiple hypothetical documents for ensemble retrieval
 */
export async function generateHypotheticalDocuments(
  query: string,
  count: number = 3
): Promise<string[]> {
  const prompt = `Generate ${count} different short news snippets that would each answer this crypto question from different angles:

Question: "${query}"

Write as if you're different crypto journalists with slightly different information. Each snippet should be 1-2 sentences.

Format as JSON: {"documents": ["snippet 1", "snippet 2", "snippet 3"]}`;

  try {
    const response = await callGroq([{ role: 'user', content: prompt }], {
      temperature: 0.8,
      maxTokens: 512,
      jsonMode: true,
    });

    const parsed = parseGroqJson<{ documents: string[] }>(response.content);
    return parsed.documents;
  } catch {
    return [query];
  }
}

// ═══════════════════════════════════════════════════════════════
// QUERY REFORMULATION
// ═══════════════════════════════════════════════════════════════

/**
 * Reformulate query for better retrieval
 * Useful when initial retrieval fails
 */
export async function reformulateQuery(
  originalQuery: string,
  context?: string
): Promise<string[]> {
  const prompt = `Rewrite this crypto news query in 3 different ways to improve search results.

Original query: "${originalQuery}"
${context ? `Context from previous search: "${context}"` : ''}

Make each reformulation:
1. More specific and detailed
2. Using different terminology
3. From a different angle/perspective

Respond with JSON: {"reformulations": ["query1", "query2", "query3"]}`;

  try {
    const response = await callGroq([{ role: 'user', content: prompt }], {
      temperature: 0.5,
      maxTokens: 256,
      jsonMode: true,
    });

    const parsed = parseGroqJson<{ reformulations: string[] }>(response.content);
    return parsed.reformulations;
  } catch {
    return [originalQuery];
  }
}

// ═══════════════════════════════════════════════════════════════
// FULL QUERY PROCESSING PIPELINE
// ═══════════════════════════════════════════════════════════════

export interface ProcessedQuery {
  original: string;
  classification: QueryClassification;
  decomposition: DecomposedQuery;
  expansion: ExpandedQuery;
  hypotheticalDoc?: string;
  searchQueries: string[]; // Final queries to use for retrieval
}

/**
 * Full query processing pipeline
 */
export async function processQuery(
  query: string,
  options: {
    useHyDE?: boolean;
    useDecomposition?: boolean;
    useExpansion?: boolean;
  } = {}
): Promise<ProcessedQuery> {
  const { useHyDE = true, useDecomposition = true, useExpansion = true } = options;

  // Run classification, decomposition, and expansion in parallel
  const [classification, decomposition, expansion] = await Promise.all([
    classifyQuery(query),
    useDecomposition ? decomposeQuery(query) : Promise.resolve({
      original: query,
      isComplex: false,
      subQueries: [{ query, purpose: 'main' }],
      synthesisStrategy: 'merge' as const,
    }),
    useExpansion ? expandQuery(query) : Promise.resolve({
      original: query,
      expanded: query,
      synonyms: [],
      relatedTerms: [],
    }),
  ]);

  // Generate HyDE document for complex queries
  let hypotheticalDoc: string | undefined;
  if (useHyDE && (classification.complexity !== 'simple' || classification.requiresMultiHop)) {
    hypotheticalDoc = await generateHypotheticalDocument(query);
  }

  // Compile search queries
  const searchQueries: string[] = [];
  
  // Add sub-queries
  for (const sq of decomposition.subQueries) {
    searchQueries.push(sq.query);
  }
  
  // Add expanded query
  if (expansion.expanded !== query) {
    searchQueries.push(expansion.expanded);
  }
  
  // Add HyDE document
  if (hypotheticalDoc) {
    searchQueries.push(hypotheticalDoc);
  }

  // Deduplicate
  const uniqueQueries = [...new Set(searchQueries)];

  return {
    original: query,
    classification,
    decomposition,
    expansion,
    hypotheticalDoc,
    searchQueries: uniqueQueries,
  };
}
