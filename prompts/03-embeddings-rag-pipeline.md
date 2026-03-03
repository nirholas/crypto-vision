# Prompt 03: Embeddings & RAG Pipeline

## Agent Identity & Rules

```
You are building the embeddings and RAG (Retrieval-Augmented Generation) pipeline for Crypto Vision.
- Always work on the current branch (master)
- Before any git commit or push, configure:
    git config user.name "nirholas"
    git config user.email "nirholas@users.noreply.github.com"
- Always use background terminals (isBackground: true)
- Always kill terminals after commands complete
- We have unlimited Claude credits — build the best possible version
- Every dollar spent must produce a permanent artifact (vector indices, embedding models, exportable HNSW indices)
```

## Objective

Build a complete embeddings & RAG pipeline that:
1. Generates embeddings for all crypto content (news, protocol docs, agent definitions, governance proposals)
2. Stores them in a searchable vector index
3. Powers a RAG-enhanced `/api/ai/ask` endpoint with real-time context retrieval
4. Produces an exportable index that works with pgvector/Qdrant after credits expire

## Budget: $10k

- Vertex AI Embeddings: ~$0.025 per 1K tokens (text-embedding-005)
- Vertex AI Vector Search (Matching Engine): ~$0.10/GB/month + $0.065/1K queries
- Alternative: Use BigQuery vector search (included in BigQuery costs)

## Current State

- `/api/ai/ask` endpoint exists in `src/routes/ai.ts` — takes a question and returns LLM-generated answers
- 40+ agent definitions in `agents/` with full system prompts
- News aggregation in `src/sources/crypto-news.ts`
- All DeFi protocol data from DeFiLlama
- Governance proposals from Snapshot

## Deliverables

### 1. Embedding Generator (`src/lib/embeddings.ts`)

```typescript
// src/lib/embeddings.ts
import { log } from "./logger.js";
import { cache } from "./cache.js";

// Vertex AI embedding model
const EMBEDDING_MODEL = "text-embedding-005";
const EMBEDDING_DIMENSION = 768;
const MAX_TOKENS_PER_REQUEST = 2048;
const BATCH_SIZE = 250;  // Vertex AI limit: 250 texts per batch

interface EmbeddingResult {
  text: string;
  embedding: number[];
  model: string;
  tokens: number;
}

// Provider abstraction — works with Vertex AI, OpenAI, or local models
interface EmbeddingProvider {
  name: string;
  embed(texts: string[]): Promise<number[][]>;
  dimension: number;
}

class VertexAIProvider implements EmbeddingProvider {
  name = "vertex-ai";
  dimension = EMBEDDING_DIMENSION;

  async embed(texts: string[]): Promise<number[][]> {
    const { PredictionServiceClient } = await import("@google-cloud/aiplatform");
    const client = new PredictionServiceClient();
    const projectId = process.env.GCP_PROJECT_ID;
    const location = process.env.GCP_REGION || "us-central1";

    const endpoint = `projects/${projectId}/locations/${location}/publishers/google/models/${EMBEDDING_MODEL}`;

    const results: number[][] = [];
    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
      const batch = texts.slice(i, i + BATCH_SIZE);
      const instances = batch.map(text => ({
        structValue: { fields: { content: { stringValue: text } } }
      }));

      const [response] = await client.predict({ endpoint, instances });
      for (const prediction of response.predictions || []) {
        const embedding = prediction.structValue?.fields?.embeddings
          ?.structValue?.fields?.values?.listValue?.values
          ?.map((v: any) => v.numberValue) || [];
        results.push(embedding);
      }
    }
    return results;
  }
}

class OpenAIProvider implements EmbeddingProvider {
  name = "openai";
  dimension = 1536;

  async embed(texts: string[]): Promise<number[][]> {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error("OPENAI_API_KEY not set");

    const resp = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "text-embedding-3-small", input: texts }),
    });
    const data = await resp.json();
    return data.data.map((d: any) => d.embedding);
  }
}

// Auto-select provider based on available credentials
function getProvider(): EmbeddingProvider {
  if (process.env.GCP_PROJECT_ID) return new VertexAIProvider();
  if (process.env.OPENAI_API_KEY) return new OpenAIProvider();
  throw new Error("No embedding provider configured");
}

// Main API
export async function generateEmbeddings(texts: string[]): Promise<EmbeddingResult[]> {
  const provider = getProvider();
  const embeddings = await provider.embed(texts);
  return texts.map((text, i) => ({
    text,
    embedding: embeddings[i],
    model: provider.name,
    tokens: Math.ceil(text.length / 4),  // Rough approximation
  }));
}

export async function generateEmbedding(text: string): Promise<number[]> {
  // Check cache first
  const cacheKey = `emb:${hashText(text)}`;
  const cached = await cache.get(cacheKey);
  if (cached) return JSON.parse(cached as string);

  const [result] = await generateEmbeddings([text]);
  await cache.set(cacheKey, JSON.stringify(result.embedding), 86400);  // 24h cache
  return result.embedding;
}

function hashText(text: string): string {
  const { createHash } = require("crypto");
  return createHash("sha256").update(text).digest("hex").slice(0, 16);
}

export { EMBEDDING_DIMENSION };
```

### 2. Vector Store Abstraction (`src/lib/vector-store.ts`)

```typescript
// src/lib/vector-store.ts — Portable vector store with multiple backends
import { log } from "./logger.js";
import { generateEmbedding, EMBEDDING_DIMENSION } from "./embeddings.js";

interface VectorSearchResult {
  id: string;
  content: string;
  metadata: Record<string, any>;
  score: number;  // Cosine similarity
}

interface VectorStore {
  upsert(id: string, embedding: number[], content: string, metadata?: Record<string, any>): Promise<void>;
  search(query: number[], topK?: number, filter?: Record<string, any>): Promise<VectorSearchResult[]>;
  delete(id: string): Promise<void>;
  count(): Promise<number>;
}

// BigQuery Vector Search backend (uses BigQuery VECTOR_SEARCH function)
class BigQueryVectorStore implements VectorStore {
  private bq: any;
  private dataset: string;
  private table: string;

  constructor(dataset = "crypto_vision", table = "embeddings") {
    this.dataset = dataset;
    this.table = table;
  }

  async upsert(id: string, embedding: number[], content: string, metadata?: Record<string, any>) {
    const { insertRows } = await import("./bigquery.js");
    await insertRows(this.table, [{
      id,
      content,
      embedding,
      metadata: JSON.stringify(metadata || {}),
      category: metadata?.category || "general",
      source: metadata?.source || "unknown",
      updated_at: new Date().toISOString(),
    }]);
  }

  async search(queryEmbedding: number[], topK = 10, filter?: Record<string, any>): Promise<VectorSearchResult[]> {
    const { query } = await import("./bigquery.js");
    
    let filterClause = "";
    if (filter?.category) filterClause += ` AND base.category = '${filter.category}'`;
    if (filter?.source) filterClause += ` AND base.source = '${filter.source}'`;

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
      WHERE 1=1 ${filterClause}
      ORDER BY distance ASC
    `;
    
    const rows = await query(sql, { query_embedding: queryEmbedding });
    return rows.map((r: any) => ({
      id: r.id,
      content: r.content,
      metadata: JSON.parse(r.metadata || "{}"),
      score: 1 - r.distance,  // Convert distance to similarity
    }));
  }

  async delete(id: string) {
    const { query } = await import("./bigquery.js");
    await query(`DELETE FROM \`${this.dataset}.${this.table}\` WHERE id = @id`, { id });
  }

  async count(): Promise<number> {
    const { query } = await import("./bigquery.js");
    const [row] = await query(`SELECT COUNT(*) as cnt FROM \`${this.dataset}.${this.table}\``);
    return row?.cnt || 0;
  }
}

// In-memory vector store for local development / testing
class InMemoryVectorStore implements VectorStore {
  private store = new Map<string, { embedding: number[]; content: string; metadata: Record<string, any> }>();

  async upsert(id: string, embedding: number[], content: string, metadata?: Record<string, any>) {
    this.store.set(id, { embedding, content, metadata: metadata || {} });
  }

  async search(query: number[], topK = 10): Promise<VectorSearchResult[]> {
    const results: VectorSearchResult[] = [];
    for (const [id, item] of this.store) {
      const score = cosineSimilarity(query, item.embedding);
      results.push({ id, content: item.content, metadata: item.metadata, score });
    }
    return results.sort((a, b) => b.score - a.score).slice(0, topK);
  }

  async delete(id: string) { this.store.delete(id); }
  async count() { return this.store.size; }
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Factory
export function createVectorStore(): VectorStore {
  if (process.env.GCP_PROJECT_ID) {
    log.info("Using BigQuery vector store");
    return new BigQueryVectorStore();
  }
  log.info("Using in-memory vector store (dev mode)");
  return new InMemoryVectorStore();
}

export const vectorStore = createVectorStore();
```

### 3. RAG Pipeline (`src/lib/rag.ts`)

```typescript
// src/lib/rag.ts — Retrieval-Augmented Generation
import { generateEmbedding } from "./embeddings.js";
import { vectorStore } from "./vector-store.js";
import { aiComplete } from "./ai.js";
import { log } from "./logger.js";

interface RAGOptions {
  topK?: number;           // How many documents to retrieve (default: 5)
  category?: string;       // Filter by category
  maxContextLength?: number; // Max chars of context (default: 8000)
  temperature?: number;
  systemPrompt?: string;
}

interface RAGResult {
  answer: string;
  sources: Array<{ id: string; content: string; score: number }>;
  model: string;
  tokensUsed?: number;
}

export async function ragQuery(question: string, options: RAGOptions = {}): Promise<RAGResult> {
  const {
    topK = 5,
    category,
    maxContextLength = 8000,
    temperature = 0.3,
    systemPrompt = "You are an expert crypto analyst. Answer questions using the provided context. Always cite sources. If the context doesn't contain enough information, say so.",
  } = options;

  // 1. Generate embedding for the question
  const queryEmbedding = await generateEmbedding(question);

  // 2. Retrieve relevant documents
  const results = await vectorStore.search(queryEmbedding, topK, { category });

  // 3. Build context from retrieved documents
  let context = "";
  const sources: RAGResult["sources"] = [];
  for (const r of results) {
    if (context.length + r.content.length > maxContextLength) break;
    context += `\n---\nSource: ${r.metadata?.source || r.id} (relevance: ${(r.score * 100).toFixed(1)}%)\n${r.content}\n`;
    sources.push({ id: r.id, content: r.content.slice(0, 200), score: r.score });
  }

  // 4. Generate answer with context
  const prompt = `Question: ${question}

Context from knowledge base:
${context}

Instructions:
- Answer the question based on the context above
- If the context is insufficient, use your general knowledge but note this
- Be specific with numbers and data
- Cite which sources you used`;

  const { text, model, tokensUsed } = await aiComplete(systemPrompt, prompt, { temperature });

  return { answer: text, sources, model, tokensUsed };
}
```

### 4. Content Indexing Workers (`src/workers/`)

Create workers that continuously index content into the vector store:

```typescript
// src/workers/index-news.ts — Index news articles
import { generateEmbeddings } from "../lib/embeddings.js";
import { vectorStore } from "../lib/vector-store.js";
import * as news from "../sources/crypto-news.js";
import { log } from "../lib/logger.js";

async function indexNews() {
  log.info("Starting news indexing...");
  
  const articles = await news.getLatestNews({ limit: 100 });
  let indexed = 0;

  // Batch embed for efficiency
  const texts = articles.map(a => `${a.title}\n${a.description || ""}`);
  const embeddings = await generateEmbeddings(texts);

  for (let i = 0; i < articles.length; i++) {
    const article = articles[i];
    await vectorStore.upsert(
      `news:${article.id || article.url}`,
      embeddings[i].embedding,
      `${article.title}\n${article.description}`,
      {
        category: "news",
        source: article.source,
        published_at: article.published_at,
        url: article.url,
      }
    );
    indexed++;
  }

  log.info({ indexed }, "News indexing complete");
}

// Run every 5 minutes
setInterval(indexNews, 5 * 60 * 1000);
indexNews().catch(err => log.error(err, "Initial news indexing failed"));
```

```typescript
// src/workers/index-agents.ts — Index all 40+ agent definitions
import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import { generateEmbeddings } from "../lib/embeddings.js";
import { vectorStore } from "../lib/vector-store.js";
import { log } from "../lib/logger.js";

async function indexAgents() {
  const agentsDir = join(process.cwd(), "agents", "locales");
  const agentDirs = readdirSync(agentsDir);
  
  const texts: string[] = [];
  const ids: string[] = [];
  const metadatas: Record<string, any>[] = [];

  for (const dir of agentDirs) {
    try {
      const enFile = join(agentsDir, dir, "en.json");
      const agent = JSON.parse(readFileSync(enFile, "utf-8"));
      
      const text = `Agent: ${agent.name}\nDescription: ${agent.description}\nSystem Prompt: ${agent.systemPrompt || ""}\nCapabilities: ${(agent.capabilities || []).join(", ")}`;
      
      texts.push(text);
      ids.push(`agent:${dir}`);
      metadatas.push({ category: "agent", agentId: dir, name: agent.name });
    } catch {
      // Skip agents without en.json
    }
  }

  const embeddings = await generateEmbeddings(texts);
  for (let i = 0; i < texts.length; i++) {
    await vectorStore.upsert(ids[i], embeddings[i].embedding, texts[i], metadatas[i]);
  }

  log.info({ indexed: texts.length }, "Agent indexing complete");
}

indexAgents().catch(err => log.error(err, "Agent indexing failed"));
```

```typescript
// src/workers/index-protocols.ts — Index DeFi protocol data
import { generateEmbeddings } from "../lib/embeddings.js";
import { vectorStore } from "../lib/vector-store.js";
import * as llama from "../sources/defillama.js";
import { log } from "../lib/logger.js";

async function indexProtocols() {
  const protocols = await llama.getProtocols({ limit: 200 });
  
  const texts = protocols.map(p => 
    `Protocol: ${p.name}\nCategory: ${p.category}\nChain: ${p.chain}\nTVL: $${p.tvl?.toLocaleString()}\nDescription: ${p.description || "DeFi protocol"}`
  );

  const embeddings = await generateEmbeddings(texts);
  
  for (let i = 0; i < protocols.length; i++) {
    await vectorStore.upsert(
      `protocol:${protocols[i].slug}`,
      embeddings[i].embedding,
      texts[i],
      {
        category: "protocol",
        chain: protocols[i].chain,
        tvl: protocols[i].tvl,
        name: protocols[i].name,
      }
    );
  }

  log.info({ indexed: protocols.length }, "Protocol indexing complete");
}

// Run daily
indexProtocols().catch(err => log.error(err, "Protocol indexing failed"));
```

### 5. Enhanced `/api/ai/ask` with RAG

Update the existing ask endpoint to use RAG:

```typescript
// In src/routes/ai.ts — Enhanced /api/ai/ask
aiRoutes.post("/ask", async (c) => {
  const body = await validateBody(c, AskBodySchema);
  if (!body.success) return body.error;

  const { question, context: userContext, useRag = true } = body.data;

  if (useRag) {
    const { ragQuery } = await import("../lib/rag.js");
    const result = await aiQueue.execute(() =>
      ragQuery(question, {
        category: userContext,  // Optional category filter
        topK: 5,
        temperature: 0.3,
      })
    );

    return c.json({
      data: {
        answer: result.answer,
        sources: result.sources,
      },
      model: result.model,
      tokensUsed: result.tokensUsed,
      rag: true,
      timestamp: new Date().toISOString(),
    });
  }

  // Fallback to original non-RAG behavior
  // ... existing code ...
});
```

### 6. BigQuery Embeddings Table

```sql
-- Add to BigQuery schema
CREATE TABLE crypto_vision.embeddings (
  id STRING NOT NULL,
  content STRING,
  embedding ARRAY<FLOAT64>,
  metadata STRING,  -- JSON
  category STRING,
  source STRING,
  updated_at TIMESTAMP NOT NULL
)
CLUSTER BY category, source;

-- Create vector index for fast similarity search
CREATE VECTOR INDEX idx_embeddings_vector
ON crypto_vision.embeddings(embedding)
OPTIONS(index_type = 'IVF', distance_type = 'COSINE', ivf_options = '{"num_lists": 100}');
```

### 7. Export Script (`scripts/export-embeddings.ts`)

```typescript
// Export all embeddings to a portable format (NumPy-compatible)
// Output: embeddings.npy + metadata.jsonl
// Can be loaded into pgvector, Qdrant, Pinecone, Weaviate, or any vector DB

async function exportEmbeddings() {
  const { query } = await import("../src/lib/bigquery.js");
  const fs = await import("fs");

  const rows = await query("SELECT id, content, embedding, metadata, category FROM crypto_vision.embeddings");
  
  // Write metadata as JSONL
  const metaStream = fs.createWriteStream("exports/embeddings-metadata.jsonl");
  const embeddings: number[][] = [];
  
  for (const row of rows) {
    metaStream.write(JSON.stringify({
      id: row.id,
      content: row.content?.slice(0, 500),
      category: row.category,
      metadata: row.metadata,
    }) + "\n");
    embeddings.push(row.embedding);
  }
  metaStream.end();

  // Write embeddings as raw float32 binary (compatible with NumPy)
  const buffer = Buffer.alloc(embeddings.length * embeddings[0].length * 4);
  let offset = 0;
  for (const emb of embeddings) {
    for (const val of emb) {
      buffer.writeFloatLE(val, offset);
      offset += 4;
    }
  }
  fs.writeFileSync("exports/embeddings.bin", buffer);
  
  console.log(`Exported ${embeddings.length} embeddings (${embeddings[0].length}d)`);
}
```

## Validation

1. `generateEmbedding("What is DeFi?")` returns a 768-dimensional vector
2. `vectorStore.upsert()` and `vectorStore.search()` work with both BigQuery and in-memory backends
3. `ragQuery("What are the top DeFi protocols by TVL?")` returns relevant sources alongside the answer
4. News indexer processes 100+ articles without errors
5. Agent indexer processes all 40+ agents
6. Protocol indexer processes top 200 DeFi protocols
7. Export script produces valid embeddings.bin and metadata.jsonl
8. `npx tsc --noEmit` passes

## npm Dependencies to Add

```bash
npm install @google-cloud/aiplatform
```

## GCP APIs to Enable

```bash
gcloud services enable \
  aiplatform.googleapis.com \
  bigquery.googleapis.com
```
