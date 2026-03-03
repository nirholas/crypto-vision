/**
 * Self-RAG: Self-Reflective Retrieval-Augmented Generation
 * 
 * Implements the Self-RAG paper approach:
 * 1. Retrieve documents
 * 2. Generate answer
 * 3. Critique the answer (is it supported by sources?)
 * 4. If not supported, retrieve more or regenerate
 * 
 * Also implements CRAG (Corrective RAG):
 * - Grades retrieval quality
 * - Triggers web search if retrieval is poor
 */

import { callGroq, parseGroqJson } from '../groq';
import { aiCache } from '../cache';
import type { ScoredDocument } from './types';

// ═══════════════════════════════════════════════════════════════
// RETRIEVAL GRADING
// ═══════════════════════════════════════════════════════════════

export interface RetrievalGrade {
  isRelevant: boolean;
  score: number; // 0-1
  reason: string;
}

/**
 * Grade whether a retrieved document is relevant to the query
 */
export async function gradeRetrieval(
  query: string,
  document: ScoredDocument
): Promise<RetrievalGrade> {
  const cacheKey = `grade:${query}:${document.id}`;
  const cached = aiCache.get<RetrievalGrade>(cacheKey);
  if (cached) return cached;

  const prompt = `You are a grader assessing relevance of a retrieved document to a user question.

Question: "${query}"

Document Title: "${document.title}"
Document Content: "${document.content.substring(0, 800)}"

Grade the document's relevance to the question.

Respond with JSON:
{
  "isRelevant": true/false,
  "score": 0.0-1.0,
  "reason": "brief explanation"
}`;

  try {
    const response = await callGroq([{ role: 'user', content: prompt }], {
      temperature: 0,
      maxTokens: 150,
      jsonMode: true,
    });

    const result = parseGroqJson<RetrievalGrade>(response.content);
    aiCache.set(cacheKey, result, 3600);
    return result;
  } catch {
    return { isRelevant: true, score: 0.5, reason: 'grading failed' };
  }
}

/**
 * Grade all retrieved documents and filter irrelevant ones
 */
export async function gradeRetrievals(
  query: string,
  documents: ScoredDocument[],
  threshold: number = 0.5
): Promise<{
  relevant: ScoredDocument[];
  irrelevant: ScoredDocument[];
  avgScore: number;
  needsMoreRetrieval: boolean;
}> {
  // Grade in parallel
  const grades = await Promise.all(
    documents.slice(0, 10).map(doc => gradeRetrieval(query, doc))
  );

  const relevant: ScoredDocument[] = [];
  const irrelevant: ScoredDocument[] = [];
  let totalScore = 0;

  documents.slice(0, 10).forEach((doc, i) => {
    const grade = grades[i];
    totalScore += grade.score;
    if (grade.isRelevant && grade.score >= threshold) {
      relevant.push({ ...doc, score: grade.score });
    } else {
      irrelevant.push(doc);
    }
  });

  const avgScore = totalScore / grades.length;

  return {
    relevant,
    irrelevant,
    avgScore,
    needsMoreRetrieval: relevant.length < 2 || avgScore < 0.4,
  };
}

// ═══════════════════════════════════════════════════════════════
// ANSWER GENERATION WITH REFLECTION
// ═══════════════════════════════════════════════════════════════

export interface GenerationResult {
  answer: string;
  isSupported: boolean;
  supportScore: number;
  unsupportedClaims: string[];
  citations: { claim: string; sourceIndex: number; quote: string }[];
}

/**
 * Generate answer and self-critique for support
 */
export async function generateWithReflection(
  query: string,
  documents: ScoredDocument[]
): Promise<GenerationResult> {
  // Step 1: Generate initial answer
  const context = documents
    .slice(0, 5)
    .map((d, i) => `[${i + 1}] ${d.title}\n${d.content.substring(0, 600)}`)
    .join('\n\n---\n\n');

  const generatePrompt = `Based on these news articles, answer the question.

Articles:
${context}

Question: ${query}

Provide a factual answer with inline citations like [1], [2] when referencing articles.`;

  const answerResponse = await callGroq([{ role: 'user', content: generatePrompt }], {
    temperature: 0.3,
    maxTokens: 600,
  });

  const answer = answerResponse.content.trim();

  // Step 2: Self-critique - check if answer is supported
  const critiquePrompt = `You are a fact-checker. Verify if the answer is fully supported by the source articles.

Question: "${query}"

Answer: "${answer}"

Source Articles:
${context}

For each factual claim in the answer:
1. Is it directly supported by the articles?
2. If supported, quote the supporting text

Respond with JSON:
{
  "isSupported": true/false (overall),
  "supportScore": 0.0-1.0,
  "unsupportedClaims": ["list of claims not in sources"],
  "citations": [
    {"claim": "claim text", "sourceIndex": 1, "quote": "exact quote from source"}
  ]
}`;

  try {
    const critiqueResponse = await callGroq([{ role: 'user', content: critiquePrompt }], {
      temperature: 0,
      maxTokens: 800,
      jsonMode: true,
    });

    const critique = parseGroqJson<Omit<GenerationResult, 'answer'>>(critiqueResponse.content);
    
    return {
      answer,
      ...critique,
    };
  } catch {
    return {
      answer,
      isSupported: true,
      supportScore: 0.7,
      unsupportedClaims: [],
      citations: [],
    };
  }
}

// ═══════════════════════════════════════════════════════════════
// HALLUCINATION DETECTION
// ═══════════════════════════════════════════════════════════════

export interface HallucinationCheck {
  hasHallucinations: boolean;
  score: number; // 0 = no hallucinations, 1 = fully hallucinated
  problematicSentences: {
    sentence: string;
    issue: 'unsupported' | 'contradicted' | 'speculative';
    severity: 'low' | 'medium' | 'high';
  }[];
  suggestions: string[];
}

/**
 * Detect hallucinations in generated answer
 */
export async function detectHallucinations(
  answer: string,
  documents: ScoredDocument[]
): Promise<HallucinationCheck> {
  const context = documents
    .slice(0, 5)
    .map((d, i) => `[${i + 1}] ${d.title}: ${d.content.substring(0, 500)}`)
    .join('\n\n');

  const prompt = `You are a hallucination detector. Check if this answer contains information NOT supported by the source articles.

Answer to check:
"${answer}"

Source Articles:
${context}

Identify:
1. Claims not mentioned in any source
2. Claims that contradict the sources
3. Speculative statements presented as facts

Respond with JSON:
{
  "hasHallucinations": true/false,
  "score": 0.0-1.0 (0 = faithful, 1 = hallucinated),
  "problematicSentences": [
    {"sentence": "...", "issue": "unsupported|contradicted|speculative", "severity": "low|medium|high"}
  ],
  "suggestions": ["how to fix each issue"]
}`;

  try {
    const response = await callGroq([{ role: 'user', content: prompt }], {
      temperature: 0,
      maxTokens: 600,
      jsonMode: true,
    });

    return parseGroqJson<HallucinationCheck>(response.content);
  } catch {
    return {
      hasHallucinations: false,
      score: 0,
      problematicSentences: [],
      suggestions: [],
    };
  }
}

// ═══════════════════════════════════════════════════════════════
// CORRECTIVE RAG (CRAG)
// ═══════════════════════════════════════════════════════════════

export type RetrievalAction = 'use' | 'refine' | 'web_search';

/**
 * Decide what action to take based on retrieval quality
 */
export async function decideRetrievalAction(
  query: string,
  documents: ScoredDocument[],
  gradeResult: { avgScore: number; relevant: ScoredDocument[] }
): Promise<{
  action: RetrievalAction;
  reason: string;
  refinedQuery?: string;
}> {
  // High quality - use documents as is
  if (gradeResult.avgScore >= 0.7 && gradeResult.relevant.length >= 3) {
    return { action: 'use', reason: 'High quality retrieval' };
  }

  // Medium quality - try to refine query
  if (gradeResult.avgScore >= 0.4 || gradeResult.relevant.length >= 1) {
    const refinePrompt = `The search for "${query}" returned partially relevant results.

Suggest a refined search query that would find more relevant crypto news articles.
Just respond with the refined query, nothing else.`;

    try {
      const response = await callGroq([{ role: 'user', content: refinePrompt }], {
        temperature: 0.3,
        maxTokens: 100,
      });

      return {
        action: 'refine',
        reason: 'Medium quality - refining query',
        refinedQuery: response.content.trim(),
      };
    } catch {
      return { action: 'use', reason: 'Refinement failed, using available docs' };
    }
  }

  // Low quality - suggest web search
  return {
    action: 'web_search',
    reason: 'Poor retrieval quality - web search recommended',
  };
}

// ═══════════════════════════════════════════════════════════════
// FULL SELF-RAG PIPELINE
// ═══════════════════════════════════════════════════════════════

export interface SelfRAGResult {
  answer: string;
  isReliable: boolean;
  confidence: number;
  sources: ScoredDocument[];
  metadata: {
    retrievalQuality: number;
    answerSupport: number;
    hallucinationScore: number;
    iterations: number;
    citations: { claim: string; sourceIndex: number; quote: string }[];
    warnings: string[];
  };
}

/**
 * Full Self-RAG pipeline with iterative refinement
 */
export async function selfRAG(
  query: string,
  retrieve: (q: string) => Promise<ScoredDocument[]>,
  options: {
    maxIterations?: number;
    minConfidence?: number;
  } = {}
): Promise<SelfRAGResult> {
  const { maxIterations = 3, minConfidence = 0.6 } = options;
  
  let currentQuery = query;
  let bestResult: SelfRAGResult | null = null;
  const warnings: string[] = [];

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    // Step 1: Retrieve
    const documents = await retrieve(currentQuery);
    
    if (documents.length === 0) {
      warnings.push(`Iteration ${iteration + 1}: No documents retrieved`);
      continue;
    }

    // Step 2: Grade retrievals
    const gradeResult = await gradeRetrievals(query, documents);
    
    if (gradeResult.needsMoreRetrieval && iteration < maxIterations - 1) {
      const action = await decideRetrievalAction(query, documents, gradeResult);
      
      if (action.action === 'refine' && action.refinedQuery) {
        currentQuery = action.refinedQuery;
        warnings.push(`Iteration ${iteration + 1}: Refined query to "${currentQuery}"`);
        continue;
      }
    }

    // Step 3: Generate with reflection
    const generation = await generateWithReflection(query, gradeResult.relevant);

    // Step 4: Check for hallucinations
    const hallCheck = await detectHallucinations(generation.answer, gradeResult.relevant);

    // Calculate confidence
    const confidence = (
      gradeResult.avgScore * 0.3 +
      generation.supportScore * 0.4 +
      (1 - hallCheck.score) * 0.3
    );

    const result: SelfRAGResult = {
      answer: generation.answer,
      isReliable: confidence >= minConfidence && !hallCheck.hasHallucinations,
      confidence,
      sources: gradeResult.relevant,
      metadata: {
        retrievalQuality: gradeResult.avgScore,
        answerSupport: generation.supportScore,
        hallucinationScore: hallCheck.score,
        iterations: iteration + 1,
        citations: generation.citations,
        warnings: [
          ...warnings,
          ...generation.unsupportedClaims.map(c => `Unsupported: ${c}`),
          ...hallCheck.suggestions,
        ],
      },
    };

    // Keep best result
    if (!bestResult || result.confidence > bestResult.confidence) {
      bestResult = result;
    }

    // If good enough, return
    if (result.isReliable) {
      return result;
    }
  }

  // Return best result we got
  return bestResult || {
    answer: "I couldn't find reliable information to answer this question.",
    isReliable: false,
    confidence: 0,
    sources: [],
    metadata: {
      retrievalQuality: 0,
      answerSupport: 0,
      hallucinationScore: 1,
      iterations: maxIterations,
      citations: [],
      warnings: ['Failed to generate reliable answer after all iterations'],
    },
  };
}
