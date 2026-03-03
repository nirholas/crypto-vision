/**
 * Contextual Compression
 * 
 * Extract only the relevant portions of retrieved documents.
 * Reduces context length and improves answer quality.
 * 
 * Techniques:
 * - LLM-based extraction
 * - Sentence-level relevance scoring
 * - Key fact extraction
 */

import { callGroq, parseGroqJson } from '../groq';
import { aiCache } from '../cache';
import type { ScoredDocument } from './types';

// ═══════════════════════════════════════════════════════════════
// SENTENCE EXTRACTION
// ═══════════════════════════════════════════════════════════════

export interface ExtractedSentence {
  text: string;
  relevanceScore: number;
  sourceIndex: number;
  isKeyFact: boolean;
}

/**
 * Split text into sentences
 */
function splitIntoSentences(text: string): string[] {
  // Handle common abbreviations and edge cases
  const cleaned = text
    .replace(/([.?!])\s*(?=[A-Z])/g, '$1|')
    .replace(/\n+/g, '|');
  
  return cleaned
    .split('|')
    .map(s => s.trim())
    .filter(s => s.length > 10);
}

/**
 * Extract relevant sentences from a document
 */
export async function extractRelevantSentences(
  query: string,
  document: ScoredDocument,
  sourceIndex: number
): Promise<ExtractedSentence[]> {
  const sentences = splitIntoSentences(document.content);
  
  if (sentences.length === 0) return [];
  
  if (sentences.length <= 3) {
    // Short document - return all sentences
    return sentences.map(text => ({
      text,
      relevanceScore: document.score,
      sourceIndex,
      isKeyFact: true,
    }));
  }

  const prompt = `Given this question: "${query}"

Extract the most relevant sentences from this article:
"${sentences.join(' ')}"

Return the indices (0-based) of the 3-5 most relevant sentences as JSON:
{"relevantIndices": [0, 2, 4], "keyFactIndices": [0]}`;

  try {
    const response = await callGroq([{ role: 'user', content: prompt }], {
      temperature: 0,
      maxTokens: 100,
      jsonMode: true,
    });

    const { relevantIndices, keyFactIndices } = parseGroqJson<{
      relevantIndices: number[];
      keyFactIndices: number[];
    }>(response.content);

    const keyFactSet = new Set(keyFactIndices);
    
    return relevantIndices
      .filter(i => i >= 0 && i < sentences.length)
      .map(i => ({
        text: sentences[i],
        relevanceScore: keyFactSet.has(i) ? 1.0 : 0.8,
        sourceIndex,
        isKeyFact: keyFactSet.has(i),
      }));
  } catch {
    // Fallback: return first 3 sentences
    return sentences.slice(0, 3).map((text, i) => ({
      text,
      relevanceScore: 0.7 - (i * 0.1),
      sourceIndex,
      isKeyFact: i === 0,
    }));
  }
}

// ═══════════════════════════════════════════════════════════════
// DOCUMENT COMPRESSION
// ═══════════════════════════════════════════════════════════════

export interface CompressedDocument {
  id: string;
  title: string;
  compressedContent: string;
  keyFacts: string[];
  originalLength: number;
  compressedLength: number;
  compressionRatio: number;
  sourceIndex: number;
}

/**
 * Compress a document to only relevant content
 */
export async function compressDocument(
  query: string,
  document: ScoredDocument,
  sourceIndex: number
): Promise<CompressedDocument> {
  const cacheKey = `compress:${query}:${document.id}`;
  const cached = aiCache.get<CompressedDocument>(cacheKey);
  if (cached) return cached;

  const prompt = `Given this question: "${query}"

Compress this article to only the relevant information:

Title: ${document.title}
Content: ${document.content.substring(0, 1500)}

Return JSON with:
{
  "compressedContent": "Only the sentences directly relevant to the question",
  "keyFacts": ["List of key facts that answer or relate to the question"]
}`;

  try {
    const response = await callGroq([{ role: 'user', content: prompt }], {
      temperature: 0,
      maxTokens: 500,
      jsonMode: true,
    });

    const { compressedContent, keyFacts } = parseGroqJson<{
      compressedContent: string;
      keyFacts: string[];
    }>(response.content);

    const result: CompressedDocument = {
      id: document.id,
      title: document.title,
      compressedContent,
      keyFacts,
      originalLength: document.content.length,
      compressedLength: compressedContent.length,
      compressionRatio: compressedContent.length / document.content.length,
      sourceIndex,
    };

    aiCache.set(cacheKey, result, 3600);
    return result;
  } catch {
    // Fallback: truncate
    return {
      id: document.id,
      title: document.title,
      compressedContent: document.content.substring(0, 500),
      keyFacts: [],
      originalLength: document.content.length,
      compressedLength: 500,
      compressionRatio: 500 / document.content.length,
      sourceIndex,
    };
  }
}

/**
 * Compress multiple documents in parallel
 */
export async function compressDocuments(
  query: string,
  documents: ScoredDocument[]
): Promise<CompressedDocument[]> {
  const compressed = await Promise.all(
    documents.map((doc, i) => compressDocument(query, doc, i + 1))
  );
  return compressed;
}

// ═══════════════════════════════════════════════════════════════
// KEY FACT EXTRACTION
// ═══════════════════════════════════════════════════════════════

export interface KeyFact {
  fact: string;
  category: 'price' | 'event' | 'announcement' | 'analysis' | 'other';
  entities: string[];
  confidence: number;
  sourceIndex: number;
}

/**
 * Extract structured key facts from documents
 */
export async function extractKeyFacts(
  query: string,
  documents: ScoredDocument[]
): Promise<KeyFact[]> {
  const context = documents
    .slice(0, 5)
    .map((d, i) => `[${i + 1}] ${d.title}: ${d.content.substring(0, 400)}`)
    .join('\n\n');

  const prompt = `Extract key facts from these crypto news articles relevant to: "${query}"

Articles:
${context}

Extract 5-10 key facts as JSON:
{
  "facts": [
    {
      "fact": "brief factual statement",
      "category": "price|event|announcement|analysis|other",
      "entities": ["BTC", "ETH", etc.],
      "confidence": 0.0-1.0,
      "sourceIndex": 1
    }
  ]
}`;

  try {
    const response = await callGroq([{ role: 'user', content: prompt }], {
      temperature: 0,
      maxTokens: 600,
      jsonMode: true,
    });

    const { facts } = parseGroqJson<{ facts: KeyFact[] }>(response.content);
    return facts;
  } catch {
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════
// CONTEXT ASSEMBLY
// ═══════════════════════════════════════════════════════════════

export interface AssembledContext {
  text: string;
  keyFacts: KeyFact[];
  sources: {
    index: number;
    title: string;
    url?: string;
    compressionRatio: number;
  }[];
  totalTokensEstimate: number;
}

/**
 * Assemble optimized context from compressed documents
 */
export async function assembleContext(
  query: string,
  documents: ScoredDocument[],
  maxTokens: number = 2000
): Promise<AssembledContext> {
  // Compress documents
  const compressed = await compressDocuments(query, documents.slice(0, 5));
  
  // Extract key facts
  const keyFacts = await extractKeyFacts(query, documents);
  
  // Build context within token budget
  const sources: AssembledContext['sources'] = [];
  const contextParts: string[] = [];
  let estimatedTokens = 0;
  const tokensPerChar = 0.25; // Rough estimate

  // Add key facts first (most important)
  if (keyFacts.length > 0) {
    const factsText = keyFacts
      .slice(0, 5)
      .map(f => `• ${f.fact} [${f.sourceIndex}]`)
      .join('\n');
    contextParts.push(`KEY FACTS:\n${factsText}`);
    estimatedTokens += factsText.length * tokensPerChar;
  }

  // Add compressed documents
  for (const doc of compressed) {
    const docText = `[${doc.sourceIndex}] ${doc.title}\n${doc.compressedContent}`;
    const docTokens = docText.length * tokensPerChar;

    if (estimatedTokens + docTokens > maxTokens) break;

    contextParts.push(docText);
    estimatedTokens += docTokens;
    sources.push({
      index: doc.sourceIndex,
      title: doc.title,
      url: documents[doc.sourceIndex - 1]?.url,
      compressionRatio: doc.compressionRatio,
    });
  }

  return {
    text: contextParts.join('\n\n---\n\n'),
    keyFacts,
    sources,
    totalTokensEstimate: Math.round(estimatedTokens),
  };
}
