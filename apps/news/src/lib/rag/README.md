# Crypto News RAG System

> **Production-grade Retrieval-Augmented Generation for cryptocurrency news**

Adapted from [crypto-news-rag](https://github.com/soheilrahsaz/crypto-news-rag) (Java/Spring AI) to TypeScript/Next.js.

## Features

- **Multi-tier Vector Storage** - File-based for development, Redis for production
- **Hybrid Search** - BM25 + semantic search with reciprocal rank fusion
- **Advanced Reranking** - LLM reranking, cross-encoder scoring, MMR diversity
- **Query Understanding** - Intent classification, decomposition, HyDE
- **Conversation Memory** - Multi-turn chat with context tracking
- **Agentic RAG** - Multi-hop reasoning for complex questions
- **Streaming API** - Real-time Server-Sent Events responses

## Quick Start

```typescript
import { ragService } from '@/lib/rag';

// Simple question answering
const response = await ragService.ask("What happened to Bitcoin last week?");
console.log(response.answer);
console.log(response.sources);

// With conversation memory
const chatResponse = await ragService.ask("Tell me more", {
  conversationId: "session-123",
  useConversationMemory: true,
});

// Multi-hop reasoning for complex questions
const reasoning = await ragService.askWithReasoning(
  "How did the ETF approval affect Bitcoin's price compared to Ethereum?"
);
console.log(reasoning.answer);
console.log(reasoning.reasoning); // Shows step-by-step analysis
```

## Ultimate RAG Service

For maximum capabilities, use the Ultimate RAG Service which integrates ALL features:

```typescript
import { askUltimate, askFast, askComplete, ultimateRAG } from '@/lib/rag';

// Standard usage - balanced speed and quality
const result = await askUltimate("What's the latest on Bitcoin ETFs?");
console.log(result.answer);
console.log(result.confidence);        // Multi-dimensional confidence scoring
console.log(result.citations);         // Inline citation details
console.log(result.suggestedQuestions); // Follow-up questions
console.log(result.relatedArticles);   // Related content
console.log(result.timings);           // Performance breakdown

// Fast mode - speed optimized, fewer features
const fast = await askFast("Quick update on BTC");

// Complete mode - all features enabled (slower but comprehensive)
const complete = await askComplete(query, conversationId);

// Direct service access for full control
const customResult = await ultimateRAG.ask(query, {
  useRouting: true,              // Intelligent query routing
  useSelfRAG: true,              // Adaptive retrieval with quality grading
  useContextualCompression: true, // Extract relevant content
  useAttributedAnswers: true,    // Inline source citations
  useConfidenceScoring: true,    // Multi-dimensional confidence
  useSuggestedQuestions: true,   // Follow-up suggestions
  useRelatedArticles: true,      // Related content discovery
  useCaching: true,              // Multi-layer semantic caching
  useTracing: true,              // Full observability
});

// Get performance metrics
const metrics = ultimateRAG.getMetrics(60); // Last 60 minutes
console.log(`P95 latency: ${metrics.p95LatencyMs}ms`);
console.log(`Success rate: ${metrics.successRate * 100}%`);

// Get cache statistics
const cacheStats = ultimateRAG.getCacheStats();
console.log(`Cache hit rate: ${cacheStats.total.hitRate * 100}%`);
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        RAG Pipeline                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────┐    ┌──────────────┐    ┌──────────────┐          │
│  │  Query   │───▶│    Query     │───▶│   Hybrid     │          │
│  │          │    │  Processing  │    │   Search     │          │
│  └──────────┘    └──────────────┘    └──────────────┘          │
│        │              │                     │                   │
│        │         Classification        BM25 + Semantic          │
│        │         Decomposition         Fusion                   │
│        │         HyDE                                           │
│        │                                    │                   │
│        ▼                                    ▼                   │
│  ┌──────────────┐                   ┌──────────────┐           │
│  │ Conversation │                   │   Reranker   │           │
│  │   Memory     │                   │              │           │
│  └──────────────┘                   └──────────────┘           │
│        │                                    │                   │
│        │                              Time Decay                │
│        │                              Credibility               │
│        │                              LLM Scoring               │
│        │                              MMR Diversity             │
│        ▼                                    │                   │
│  ┌──────────────┐                           │                   │
│  │   Context    │◀──────────────────────────┘                   │
│  │  Assembly    │                                               │
│  └──────────────┘                                               │
│        │                                                        │
│        ▼                                                        │
│  ┌──────────────┐                                               │
│  │     LLM      │                                               │
│  │  Generation  │                                               │
│  └──────────────┘                                               │
│        │                                                        │
│        ▼                                                        │
│  ┌──────────────┐                                               │
│  │   Response   │                                               │
│  └──────────────┘                                               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## API Reference

### Core Service

#### `ragService.ask(query, options)`

Main entry point for RAG queries.

```typescript
const response = await ragService.ask("What's happening with Ethereum?", {
  limit: 10,                    // Max documents to retrieve
  similarityThreshold: 0.5,    // Minimum similarity score
  useHybridSearch: true,       // Enable BM25 + semantic fusion
  useHyDE: false,              // Enable Hypothetical Document Embeddings
  useQueryDecomposition: true, // Enable query analysis
  useAdvancedReranking: true,  // Enable LLM reranking
  useConversationMemory: true, // Enable multi-turn memory
  conversationId: 'session-1', // Session identifier
  rerankOptions: {
    useTimeDecay: true,        // Prefer recent articles
    useSourceCredibility: true, // Weight by source quality
    useLLMReranking: true,     // LLM-based relevance scoring
    diversifySources: true,    // Ensure source diversity
  },
});

// Response structure
interface EnhancedRAGResponse {
  answer: string;
  sources: {
    title: string;
    url: string;
    pubDate: string;
    source: string;
    voteScore: number;
  }[];
  extractedFilters: {
    dateRange?: { startDate: string; endDate: string };
    currencies?: string[];
  };
  processingTime: number;
  metadata: {
    queryIntent?: string;
    queryComplexity?: string;
    isFollowUp?: boolean;
    searchMethod?: string;
    reranked?: boolean;
    documentsSearched?: number;
    conversationId?: string;
  };
}
```

#### `ragService.askWithReasoning(query, options)`

Multi-hop reasoning for complex queries.

```typescript
const result = await ragService.askWithReasoning(
  "Why did Bitcoin crash in 2022 and how has it recovered?",
  {
    maxIterations: 5,
    confidenceThreshold: 0.7,
  }
);

// Shows reasoning steps
result.reasoning.forEach(step => {
  console.log(`${step.type}: ${step.output}`);
});
```

#### `ragService.searchNews(query, options)`

Direct search without answer generation.

```typescript
const documents = await ragService.searchNews("DeFi hacks", {
  limit: 20,
  currencies: ["ETH"],
  dateRange: { startDate: "2025-01-01", endDate: "2025-02-01" },
});
```

### Streaming API

#### `POST /api/rag/stream`

Server-Sent Events endpoint for real-time responses.

```typescript
import { streamRAG } from '@/lib/rag';

await streamRAG("What's the latest on Solana?", {
  onStart: (data) => console.log('Started:', data.conversationId),
  onStep: (data) => console.log('Step:', data.message),
  onToken: (token) => process.stdout.write(token),
  onComplete: (data) => console.log('Sources:', data.sources),
  onError: (err) => console.error('Error:', err.message),
}, {
  conversationId: 'session-123',
});
```

### Query Processing

#### Intent Classification

```typescript
import { classifyQuery } from '@/lib/rag';

const classification = await classifyQuery("Why did Bitcoin crash?");
// { intent: 'causal', complexity: 'moderate', requiresMultiHop: true, ... }
```

Query intents:
- `factual` - What is X?
- `temporal` - What happened recently?
- `comparison` - How does X compare to Y?
- `causal` - Why did X happen?
- `predictive` - What will happen to X?
- `aggregation` - Summary/overview requests
- `opinion` - Sentiment/opinion seeking
- `procedural` - How to do X?

#### Query Decomposition

```typescript
import { decomposeQuery } from '@/lib/rag';

const decomposed = await decomposeQuery(
  "How did Bitcoin's price change after the ETF approval compared to Ethereum?"
);

// Returns sub-queries that can be answered independently
decomposed.subQueries.forEach(sq => {
  console.log(`${sq.purpose}: ${sq.query}`);
});
```

#### HyDE (Hypothetical Document Embeddings)

```typescript
import { generateHypotheticalDocument } from '@/lib/rag';

// Generates a hypothetical answer that's embedded for better retrieval
const hydeDoc = await generateHypotheticalDocument(
  "What caused the FTX collapse?"
);
```

### Reranking

```typescript
import { rerankResults } from '@/lib/rag';

const reranked = await rerankResults(query, searchResults, {
  useTimeDecay: true,          // Exponential decay based on age
  timeDecayHalfLife: 7,        // Days until 50% decay
  useSourceCredibility: true,  // Weight by source tier
  useLLM: true,               // LLM relevance scoring
  useDiversity: true,         // Source diversity
  useMMR: false,              // Maximal Marginal Relevance
  mmrLambda: 0.7,             // MMR diversity parameter
  topK: 5,                    // Results to return
});
```

Source credibility tiers:
- **Tier 1** (1.0): Reuters, Bloomberg, WSJ, Financial Times
- **Tier 2** (0.9): CoinDesk, The Block, Decrypt, CoinTelegraph
- **Tier 3** (0.8): BeInCrypto, NewsBTC, Bitcoinist
- **Tier 4** (0.7): Generic crypto sources
- **Default** (0.6): Unknown sources

### Conversation Memory

```typescript
import { conversationMemory, contextualizeQuery } from '@/lib/rag';

// Contextualize follow-up questions
const contextualized = await contextualizeQuery(
  "What about Ethereum?",  // Ambiguous follow-up
  "session-123"
);
// contextualized.contextualized = "What is the latest news about Ethereum?"

// Manage conversation history
conversationMemory.addMessage("session-123", {
  role: 'user',
  content: 'What happened to Bitcoin?',
});

conversationMemory.addMessage("session-123", {
  role: 'assistant',
  content: 'Bitcoin rose 5% this week...',
  metadata: {
    documentsUsed: ['doc-1', 'doc-2'],
    cryptosDiscussed: ['BTC'],
  },
});
```

### Vector Stores

#### File-based (Development)

```typescript
import { vectorStore } from '@/lib/rag';

// Add documents
await vectorStore.add(document);

// Search
const results = await vectorStore.search(
  embedding,    // number[]
  topK,         // number
  filter,       // SearchFilter
  threshold     // number
);

// Get stats
const stats = await vectorStore.getStats();
```

#### Redis (Production)

```typescript
import { redisVectorStore } from '@/lib/rag';

// Same interface as file store
await redisVectorStore.add(document);
const results = await redisVectorStore.search(...);
```

Configure Redis:
```env
REDIS_URL=redis://localhost:6379
# or
KV_URL=redis://...  # Vercel KV
```

### Hybrid Search

```typescript
import { hybridSearch } from '@/lib/rag';

const results = await hybridSearch("Bitcoin ETF approval", {
  topK: 10,
  filter: { currencies: ['BTC'] },
  semanticWeight: 0.7,        // vs 0.3 for keyword
  fusionMethod: 'rrf',        // or 'weighted'
  similarityThreshold: 0.3,
});
```

## REST API Endpoints

### POST /api/rag
Standard RAG query endpoint.

```bash
curl -X POST /api/rag \
  -H "Content-Type: application/json" \
  -d '{"query": "What happened to Bitcoin?", "topK": 5}'
```

### POST /api/rag/search
Search without answer generation.

```bash
curl -X POST /api/rag/search \
  -H "Content-Type: application/json" \
  -d '{"query": "Ethereum upgrade", "limit": 10}'
```

### POST /api/rag/stream
Streaming responses via SSE.

```bash
curl -N -X POST /api/rag/stream \
  -H "Content-Type: application/json" \
  -d '{"query": "Latest crypto news"}'
```

### GET /api/rag/similar/:id
Find similar articles.

```bash
curl /api/rag/similar/article-123?limit=5
```

### GET /api/rag/stats
Vector store statistics.

```bash
curl /api/rag/stats
```

## Configuration

### Environment Variables

```env
# LLM Provider
GROQ_API_KEY=your_groq_key

# Embeddings (choose one)
HUGGINGFACE_API_KEY=your_hf_key
OPENAI_API_KEY=your_openai_key

# Vector Store (production)
REDIS_URL=redis://localhost:6379
KV_URL=redis://...  # Alternative for Vercel KV

# Optional
RAG_EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2
RAG_EMBEDDING_DIM=384
```

### Embedding Models

| Model | Dimensions | Provider |
|-------|------------|----------|
| all-MiniLM-L6-v2 | 384 | HuggingFace |
| text-embedding-3-small | 1536 | OpenAI |
| text-embedding-3-large | 3072 | OpenAI |

## Data Ingestion

### From Archive

```bash
# Ingest all articles
npm run rag:ingest

# Recent articles only (last 30 days)
npm run rag:ingest:recent

# Clear and re-ingest
npm run rag:ingest:clear
```

### Programmatic

```typescript
import { ragService } from '@/lib/rag';

const articles = [
  {
    id: 'article-1',
    title: 'Bitcoin Hits New High',
    description: 'Bitcoin reached $100k today...',
    pubDate: '2025-02-05T10:00:00Z',
    link: 'https://example.com/article',
    source: 'CoinDesk',
    sourceKey: 'coindesk',
    category: 'markets',
    currencies: ['BTC'],
    votes: { positive: 100, negative: 10 },
  },
];

const count = await ragService.ingestNews(articles);
console.log(`Ingested ${count} articles`);
```

## Performance Optimization

### Caching

The system uses multi-level caching:
- **Embedding cache** - Avoids re-computing embeddings
- **Query result cache** - Short-lived cache for repeated queries
- **LLM response cache** - Caches classification/reranking results

### Batch Processing

```typescript
// Efficient batch embedding
import { generateEmbeddings } from '@/lib/rag';

const embeddings = await generateEmbeddings([
  "text 1",
  "text 2",
  "text 3",
], { batchSize: 32 });
```

### Redis Indexing

For large datasets, Redis provides:
- Date range indexes
- Source indexes
- Currency indexes
- Efficient sorted set queries

## Extracting to Separate Repository

The RAG system is designed to be extractable:

1. Copy `src/lib/rag/` to new repo
2. Copy `scripts/rag/` for ingestion scripts
3. Copy `src/app/api/rag/` for API routes
4. Install dependencies:

```json
{
  "dependencies": {
    "@ai-sdk/groq": "^1.0.0",
    "ioredis": "^5.0.0",
    "@huggingface/inference": "^2.0.0"
  }
}
```

5. Configure environment variables
6. Adapt imports for your project structure

## Troubleshooting

### Common Issues

**"No documents found"**
- Check if vector store is populated: `GET /api/rag/stats`
- Lower similarity threshold in search options
- Try broader search terms

**Slow responses**
- Disable LLM reranking for faster results
- Use Redis instead of file store
- Reduce topK parameter

**Memory issues**
- Use Redis for large datasets
- Implement pagination for search results
- Clear conversation memory periodically

### Debug Mode

```typescript
const response = await ragService.ask(query, {
  // Response includes detailed metadata
});

console.log(response.metadata);
// {
//   queryIntent: 'factual',
//   queryComplexity: 'simple',
//   searchMethod: 'hybrid',
//   reranked: true,
//   documentsSearched: 15,
//   ...
// }
```

## License

MIT - See [LICENSE](../../../LICENSE)

---

## Advanced Features

### Self-RAG (Adaptive Retrieval)

Automatically grades retrieval quality and corrects when needed.

```typescript
import { selfRAG } from '@/lib/rag';

const result = await selfRAG(
  "What regulation changes affected Bitcoin ETFs?",
  retrieveDocuments,  // Your retrieval function
  {
    minRetrievalScore: 0.7,
    maxIterations: 3,
    detectHallucinations: true,
  }
);

console.log(result.answer);
console.log(result.iterations);  // How many retrieval attempts
console.log(result.wasAugmented); // If additional retrieval needed
```

### Contextual Compression

Extract only relevant parts of documents for better context.

```typescript
import { compressDocuments, assembleContext } from '@/lib/rag';

const compressed = await compressDocuments(documents, query, {
  method: 'extract_sentences',  // or 'llm_compress'
  maxSentences: 5,
});

const context = await assembleContext(query, documents, {
  maxTokens: 4000,
  prioritizeRecent: true,
});
```

### Answer Attribution

Generate answers with inline citations.

```typescript
import { generateAttributedAnswer, formatCitationsForDisplay } from '@/lib/rag';

const { answer, claims } = await generateAttributedAnswer(query, documents);
// "Bitcoin rose 10% [1] after the ETF approval [2]..."

const display = formatCitationsForDisplay(claims);
console.log(display.footnotes);
console.log(display.bibliography);
```

### Confidence Scoring

Get multi-dimensional confidence analysis.

```typescript
import { scoreAnswerConfidence, formatConfidenceForUI } from '@/lib/rag';

const score = scoreAnswerConfidence(query, answer, documents);
// {
//   overall: 0.82,
//   dimensions: {
//     retrieval: 0.9,
//     generation: 0.85,
//     attribution: 0.75,
//     factual: 0.8,
//     temporal: 0.8,
//   },
//   level: 'high',
//   warnings: [],
// }

const ui = formatConfidenceForUI(score);
console.log(`${ui.icon} ${ui.label}: ${ui.percentage}%`);
```

### Intelligent Caching

Multi-layer caching for optimal performance.

```typescript
import { ragCache } from '@/lib/rag';

// Semantic query cache - finds similar queries
const cached = await ragCache.query.get(query, async () => queryEmbedding);
if (cached) {
  console.log(`Cache hit (${cached.type}): ${cached.entry.answer}`);
}

// Embedding cache
ragCache.embedding.set(text, 'model-name', embedding);

// Get all stats
const stats = ragCache.getAllStats();
console.log(`Hit rate: ${stats.total.hitRate * 100}%`);
```

### Query Routing

Automatically route queries to optimal strategies.

```typescript
import { routeQuery } from '@/lib/rag';

const route = await routeQuery("Compare Bitcoin and Ethereum prices");
// {
//   primary: 'comparison',
//   confidence: 0.85,
//   parameters: {
//     topK: 10,
//     useReranking: true,
//     semanticWeight: 0.6,
//     requiresMultipleSources: true,
//   },
//   reasoning: 'Query compares multiple entities',
// }
```

### Suggested Questions

Generate intelligent follow-up questions.

```typescript
import { generateSuggestedQuestions } from '@/lib/rag';

const questions = await generateSuggestedQuestions(query, answer, documents);
// [
//   { question: "How does this affect Bitcoin miners?", type: "impact" },
//   { question: "What happened in the past week?", type: "timeline" },
//   { question: "How does Bitcoin compare to Ethereum here?", type: "comparison" },
// ]
```

### Related Articles

Find contextually related content.

```typescript
import { findRelatedArticles } from '@/lib/rag';

const related = findRelatedArticles(usedDocuments, allDocuments, query);
// [
//   { document, relationship: 'update', sharedTopics: ['bitcoin', 'etf'] },
//   { document, relationship: 'background', sharedTopics: ['regulation'] },
// ]
```

### Observability & Tracing

Track RAG pipeline performance.

```typescript
import { ragTracer, ragLogger } from '@/lib/rag';

// Start a trace
const trace = ragTracer.startTrace(query);
const span = ragTracer.startSpan(trace.id, 'retrieval');

// ... perform retrieval ...

ragTracer.endSpan(trace.id, span.id, 'success', { docsFound: 10 });
ragTracer.updateMetrics(trace.id, { retrievalLatencyMs: 150 });
ragTracer.endTrace(trace.id, 'success');

// Get metrics
const metrics = ragTracer.getAggregatedMetrics(60); // Last 60 minutes
console.log(`P95 latency: ${metrics.p95LatencyMs}ms`);
console.log(`Success rate: ${metrics.successRate * 100}%`);

// Logging
ragLogger.info('Processing query', trace.id, { query });
```

## Complete Module List

| Module | Description |
|--------|-------------|
| `rag-service.ts` | Basic RAG service |
| `enhanced-rag-service.ts` | Full-featured RAG service |
| `vector-store.ts` | File-based vector storage |
| `redis-vector-store.ts` | Redis-backed vector storage |
| `hybrid-search.ts` | BM25 + semantic search |
| `reranker.ts` | Multi-strategy reranking |
| `query-processor.ts` | Query understanding |
| `conversation-memory.ts` | Multi-turn context |
| `agentic-rag.ts` | Multi-hop reasoning |
| `streaming-client.ts` | SSE streaming |
| `embedding-service.ts` | Vector embeddings |
| `self-rag.ts` | Adaptive retrieval |
| `contextual-compression.ts` | Document compression |
| `answer-attribution.ts` | Inline citations |
| `observability.ts` | Tracing & metrics |
| `cache.ts` | Multi-layer caching |
| `suggested-questions.ts` | Follow-up generation |
| `confidence-scorer.ts` | Answer confidence |
| `query-router.ts` | Intelligent routing |
| `related-articles.ts` | Related content |
