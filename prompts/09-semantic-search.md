# Prompt 09: Semantic Search & Natural Language Query Interface

## Agent Identity & Rules

```
You are building the semantic search and natural language query interface for Crypto Vision.
- Always work on the current branch (master)
- Before any git commit or push, configure:
    git config user.name "nirholas"
    git config user.email "nirholas@users.noreply.github.com"
- Always use background terminals (isBackground: true)
- Always kill terminals after commands complete
- We have unlimited Claude credits — build the best possible version
- Every dollar spent must produce a permanent artifact (search indices, query parsers, UI components)
- No mocks, no fakes, no stubs — real implementations only
```

## Objective

Build a unified semantic search system where users can ask natural language questions like "what happened to Luna", "which L2 has the lowest fees", or "show me high-yield stablecoin pools" and get structured, data-backed answers. This combines the embeddings pipeline (Prompt 03), RAG (Prompt 03), and the agent orchestrator (Prompt 07) into a single intelligent query interface.

## Budget: $5k

- Vertex AI Search (optional): ~$2.50/1000 queries
- Vertex AI Embeddings: ~$0.025/1K tokens
- BigQuery for search index: included in Prompt 01 budget
- Cloud Run for serving: included in existing budget

## Current State

- Embeddings pipeline from Prompt 03 (`src/lib/embeddings.ts`, `src/lib/vector-store.ts`)
- RAG pipeline from Prompt 03 (`src/lib/rag.ts`)
- Agent orchestrator from Prompt 07 (`src/lib/orchestrator.ts`)
- Existing search endpoints: `GET /api/search?q=...` (coin name search), `GET /api/news/search?q=...` (news search)
- `GET /api/dex/search?q=...` (DEX pair search)

## Deliverables

### 1. Unified Search Engine (`src/lib/search.ts`)

```typescript
// src/lib/search.ts — Unified semantic search across all data types

import { generateEmbedding } from "./embeddings.js";
import { vectorStore } from "./vector-store.js";
import { cache } from "./cache.js";
import { log } from "./logger.js";
import * as cg from "../sources/coingecko.js";
import * as llama from "../sources/defillama.js";
import * as news from "../sources/crypto-news.js";

// ─── Types ───────────────────────────────────────────────────

export interface SearchResult {
  id: string;
  type: "coin" | "protocol" | "news" | "agent" | "pool" | "chain" | "concept";
  title: string;
  description: string;
  relevanceScore: number;
  data: Record<string, unknown>;
  url?: string;
}

export interface SearchOptions {
  types?: SearchResult["type"][];   // Filter by result type
  limit?: number;                    // Max results (default: 20)
  timeRange?: "1h" | "24h" | "7d" | "30d" | "all";
  chain?: string;
  minRelevance?: number;             // Minimum cosine similarity (0-1)
}

export interface SmartSearchResult {
  query: string;
  intent: SearchIntent;
  results: SearchResult[];
  aiSummary?: string;              // AI-generated summary of results
  suggestions: string[];            // Related search suggestions
  totalResults: number;
  searchTimeMs: number;
}

export type SearchIntent =
  | "price_lookup"       // "bitcoin price"
  | "comparison"         // "ETH vs SOL"
  | "event_query"        // "what happened to Luna"
  | "yield_search"       // "best stablecoin yields"
  | "protocol_search"    // "Aave TVL"
  | "news_search"        // "latest defi news"
  | "concept_explain"    // "what is impermanent loss"
  | "risk_assessment"    // "is USDT safe"
  | "chain_comparison"   // "cheapest L2"
  | "general"            // Catch-all

// ─── Intent Detection ────────────────────────────────────────

const INTENT_PATTERNS: Array<{ pattern: RegExp; intent: SearchIntent }> = [
  { pattern: /\b(price|cost|worth|value)\b.*\b(of|for)?\b/i, intent: "price_lookup" },
  { pattern: /\b(vs|versus|compared?\s*to|or)\b/i, intent: "comparison" },
  { pattern: /\b(what happened|crash|dump|incident|exploit|hack|depeg|collapse)\b/i, intent: "event_query" },
  { pattern: /\b(yield|apy|apr|earn|farm|stake|reward)\b/i, intent: "yield_search" },
  { pattern: /\b(tvl|protocol|dapp|defi|lend|borrow)\b/i, intent: "protocol_search" },
  { pattern: /\b(news|latest|breaking|announcement|update)\b/i, intent: "news_search" },
  { pattern: /\b(what is|explain|how does|define|meaning)\b/i, intent: "concept_explain" },
  { pattern: /\b(risk|safe|secure|audit|rug|scam|honeypot)\b/i, intent: "risk_assessment" },
  { pattern: /\b(chain|l2|layer.?2|rollup|bridge|network|cheapest|fastest)\b/i, intent: "chain_comparison" },
];

function detectIntent(query: string): SearchIntent {
  for (const { pattern, intent } of INTENT_PATTERNS) {
    if (pattern.test(query)) return intent;
  }
  return "general";
}

// ─── Search Strategies ───────────────────────────────────────

async function searchCoins(query: string, limit = 10): Promise<SearchResult[]> {
  try {
    const results = await cg.searchCoins(query);
    return (results.coins || []).slice(0, limit).map((coin: any) => ({
      id: `coin:${coin.id}`,
      type: "coin" as const,
      title: `${coin.name} (${coin.symbol?.toUpperCase()})`,
      description: `Market cap rank: #${coin.market_cap_rank || "N/A"}`,
      relevanceScore: 1 - (coin.market_cap_rank || 999) / 1000,
      data: { coinId: coin.id, symbol: coin.symbol, thumb: coin.thumb },
    }));
  } catch { return []; }
}

async function searchProtocols(query: string, limit = 10): Promise<SearchResult[]> {
  try {
    const protocols = await llama.getProtocols({ limit: 200 });
    const q = query.toLowerCase();
    return protocols
      .filter(p => 
        p.name?.toLowerCase().includes(q) ||
        p.category?.toLowerCase().includes(q) ||
        p.chain?.toLowerCase().includes(q)
      )
      .slice(0, limit)
      .map(p => ({
        id: `protocol:${p.slug}`,
        type: "protocol" as const,
        title: p.name,
        description: `${p.category} on ${p.chain} — TVL: $${(p.tvl || 0).toLocaleString()}`,
        relevanceScore: Math.min(1, (p.tvl || 0) / 1_000_000_000),
        data: { slug: p.slug, tvl: p.tvl, chain: p.chain, category: p.category },
      }));
  } catch { return []; }
}

async function searchNews(query: string, limit = 10): Promise<SearchResult[]> {
  try {
    const articles = await news.searchNews(query, limit);
    return articles.map((a: any, i: number) => ({
      id: `news:${a.id || a.url}`,
      type: "news" as const,
      title: a.title,
      description: a.description?.slice(0, 200) || "",
      relevanceScore: 1 - i / articles.length,
      data: { source: a.source, publishedAt: a.published_at, url: a.url },
      url: a.url,
    }));
  } catch { return []; }
}

async function searchSemantic(query: string, limit = 10): Promise<SearchResult[]> {
  try {
    const embedding = await generateEmbedding(query);
    const results = await vectorStore.search(embedding, limit);
    return results.map(r => ({
      id: r.id,
      type: (r.metadata?.category || "general") as SearchResult["type"],
      title: r.content.split("\n")[0].slice(0, 100),
      description: r.content.slice(0, 300),
      relevanceScore: r.score,
      data: r.metadata,
    }));
  } catch { return []; }
}

async function searchYields(query: string, limit = 10): Promise<SearchResult[]> {
  try {
    const pools = await llama.getYields({ minTvl: 100_000, limit: 100 });
    const q = query.toLowerCase();
    const isStablecoin = /stablecoin|usdc|usdt|dai|stable/i.test(q);
    
    let filtered = pools;
    if (isStablecoin) filtered = filtered.filter(p => p.stablecoin);
    
    return filtered
      .sort((a, b) => (b.apy || 0) - (a.apy || 0))
      .slice(0, limit)
      .map(p => ({
        id: `pool:${p.pool}`,
        type: "pool" as const,
        title: `${p.symbol} on ${p.project}`,
        description: `${p.apy?.toFixed(2)}% APY | TVL: $${(p.tvlUsd || 0).toLocaleString()} | Chain: ${p.chain}`,
        relevanceScore: Math.min(1, (p.apy || 0) / 100),
        data: { pool: p.pool, apy: p.apy, tvl: p.tvlUsd, chain: p.chain, project: p.project },
      }));
  } catch { return []; }
}

// ─── Main Search Function ────────────────────────────────────

export async function smartSearch(query: string, options: SearchOptions = {}): Promise<SmartSearchResult> {
  const startTime = Date.now();
  const intent = detectIntent(query);
  const { types, limit = 20, minRelevance = 0.1 } = options;

  // Check cache
  const cacheKey = `search:${query}:${JSON.stringify(options)}`;
  const cached = await cache.get(cacheKey);
  if (cached) {
    return { ...JSON.parse(cached as string), cached: true };
  }

  // Execute search strategies based on intent
  const strategies: Promise<SearchResult[]>[] = [];

  const shouldSearch = (type: SearchResult["type"]): boolean =>
    !types || types.includes(type);

  switch (intent) {
    case "price_lookup":
      if (shouldSearch("coin")) strategies.push(searchCoins(query, limit));
      break;
    case "yield_search":
      if (shouldSearch("pool")) strategies.push(searchYields(query, limit));
      if (shouldSearch("protocol")) strategies.push(searchProtocols(query, 5));
      break;
    case "news_search":
    case "event_query":
      if (shouldSearch("news")) strategies.push(searchNews(query, limit));
      if (shouldSearch("coin")) strategies.push(searchCoins(query, 3));
      break;
    case "protocol_search":
      if (shouldSearch("protocol")) strategies.push(searchProtocols(query, limit));
      if (shouldSearch("coin")) strategies.push(searchCoins(query, 5));
      break;
    case "comparison":
    case "chain_comparison":
      if (shouldSearch("coin")) strategies.push(searchCoins(query, 5));
      if (shouldSearch("protocol")) strategies.push(searchProtocols(query, 5));
      strategies.push(searchSemantic(query, 5));
      break;
    default:
      // General: search everything
      if (shouldSearch("coin")) strategies.push(searchCoins(query, 5));
      if (shouldSearch("protocol")) strategies.push(searchProtocols(query, 5));
      if (shouldSearch("news")) strategies.push(searchNews(query, 5));
      strategies.push(searchSemantic(query, 5));
  }

  // Always include semantic search for concept/risk/general queries
  if (["concept_explain", "risk_assessment", "general"].includes(intent)) {
    strategies.push(searchSemantic(query, 10));
  }

  // Execute all strategies in parallel
  const resultArrays = await Promise.allSettled(strategies);
  const allResults: SearchResult[] = [];

  for (const result of resultArrays) {
    if (result.status === "fulfilled") {
      allResults.push(...result.value);
    }
  }

  // Deduplicate by ID and filter by minimum relevance
  const seen = new Set<string>();
  const deduped = allResults.filter(r => {
    if (seen.has(r.id) || r.relevanceScore < minRelevance) return false;
    seen.add(r.id);
    return true;
  });

  // Sort by relevance and limit
  const results = deduped
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, limit);

  // Generate suggestions based on results
  const suggestions = generateSuggestions(query, intent, results);

  const response: SmartSearchResult = {
    query,
    intent,
    results,
    suggestions,
    totalResults: results.length,
    searchTimeMs: Date.now() - startTime,
  };

  // Cache for 2 minutes
  await cache.set(cacheKey, JSON.stringify(response), 120);

  return response;
}

function generateSuggestions(query: string, intent: SearchIntent, results: SearchResult[]): string[] {
  const suggestions: string[] = [];
  
  // Suggest related queries based on intent
  switch (intent) {
    case "price_lookup":
      suggestions.push(`${query} price chart`, `${query} market cap`, `${query} 7d performance`);
      break;
    case "yield_search":
      suggestions.push("stablecoin yields", "highest APY DeFi", "lowest risk yields");
      break;
    case "protocol_search":
      suggestions.push("top TVL protocols", "DeFi protocol comparison", "protocol fees revenue");
      break;
    case "news_search":
      suggestions.push("trending crypto news", "DeFi news", "Bitcoin analysis");
      break;
    case "comparison":
      suggestions.push("chain comparison", "L2 fees comparison", "DEX comparison");
      break;
  }

  // Suggest based on top results
  if (results.length > 0 && results[0].type === "coin") {
    const coin = results[0].data;
    suggestions.push(`${coin.symbol} technical analysis`, `${coin.symbol} sentiment`);
  }

  return suggestions.slice(0, 5);
}
```

### 2. Search API Routes (`src/routes/search.ts`)

```typescript
// src/routes/search.ts
// GET /api/search/smart?q=...    — Unified semantic search
// GET /api/search/suggest?q=...  — Autocomplete suggestions
// GET /api/search/nlq?q=...      — Natural language query with AI answer

import { Hono } from "hono";
import { smartSearch } from "../lib/search.js";
import { ragQuery } from "../lib/rag.js";
import { aiQueue } from "../lib/queue.js";
import { cache } from "../lib/cache.js";

export const searchRoutes = new Hono();

// GET /api/search/smart — Unified semantic search
searchRoutes.get("/smart", async (c) => {
  const q = c.req.query("q");
  if (!q || q.length < 2) {
    return c.json({ error: "Query must be at least 2 characters" }, 400);
  }

  const types = c.req.query("types")?.split(",") as any;
  const limit = Math.min(parseInt(c.req.query("limit") || "20"), 100);
  const timeRange = c.req.query("timeRange") as any;

  const result = await smartSearch(q, { types, limit, timeRange });

  return c.json({
    data: result.results,
    meta: {
      query: result.query,
      intent: result.intent,
      totalResults: result.totalResults,
      searchTimeMs: result.searchTimeMs,
      suggestions: result.suggestions,
    },
    timestamp: new Date().toISOString(),
  });
});

// GET /api/search/nlq — Natural language query with AI answer  
searchRoutes.get("/nlq", async (c) => {
  const q = c.req.query("q");
  if (!q || q.length < 5) {
    return c.json({ error: "Query must be at least 5 characters" }, 400);
  }

  // 1. Smart search for context
  const searchResult = await smartSearch(q, { limit: 10 });

  // 2. RAG-enhanced AI answer
  const ragResult = await aiQueue.execute(() =>
    ragQuery(q, {
      topK: 5,
      maxContextLength: 6000,
      temperature: 0.3,
    })
  );

  return c.json({
    data: {
      answer: ragResult.answer,
      sources: ragResult.sources,
      searchResults: searchResult.results.slice(0, 5),
      intent: searchResult.intent,
    },
    model: ragResult.model,
    suggestions: searchResult.suggestions,
    searchTimeMs: searchResult.searchTimeMs,
    timestamp: new Date().toISOString(),
  });
});

// GET /api/search/suggest — Autocomplete suggestions
searchRoutes.get("/suggest", async (c) => {
  const q = c.req.query("q");
  if (!q || q.length < 1) {
    return c.json({ data: [] });
  }

  const cacheKey = `suggest:${q.toLowerCase().slice(0, 20)}`;
  const cached = await cache.get(cacheKey);
  if (cached) return c.json({ data: JSON.parse(cached as string) });

  // Quick coin name search (very fast, no AI)
  const coins = await smartSearch(q, { types: ["coin"], limit: 5 });

  const suggestions = coins.results.map(r => ({
    text: r.title,
    type: r.type,
    id: r.id,
  }));

  // Add common query completions
  const completions = [
    `${q} price`, `${q} news`, `${q} analysis`,
    `${q} yield`, `${q} TVL`,
  ].filter(s => s.length < 50).slice(0, 3);

  const result = [
    ...suggestions,
    ...completions.map(text => ({ text, type: "suggestion" as const, id: text })),
  ];

  await cache.set(cacheKey, JSON.stringify(result), 300);
  return c.json({ data: result });
});
```

### 3. Wire Into Main App

```typescript
// In src/index.ts — Add search routes
import { searchRoutes } from "@/routes/search";

// Add under existing routes:
app.route("/api/search", searchRoutes);  // Replaces or extends existing search
```

### 4. OpenAPI Spec Updates

```yaml
# Add to openapi.yaml
/api/search/smart:
  get:
    operationId: smartSearch
    summary: Semantic search across all data
    description: Natural language search across coins, protocols, news, pools, and agents
    tags: [Search]
    parameters:
      - name: q
        in: query
        required: true
        schema: { type: string, minLength: 2 }
      - name: types
        in: query
        schema: { type: string, example: "coin,protocol,news" }
      - name: limit
        in: query
        schema: { type: integer, default: 20, maximum: 100 }
    responses:
      "200":
        description: Search results with metadata

/api/search/nlq:
  get:
    operationId: naturalLanguageQuery
    summary: AI-powered natural language query
    description: Ask any crypto question and get an AI-generated answer with sources
    tags: [Search, AI]
    parameters:
      - name: q
        in: query
        required: true
        schema: { type: string, minLength: 5 }
    responses:
      "200":
        description: AI answer with sources and search results

/api/search/suggest:
  get:
    operationId: searchSuggest
    summary: Search autocomplete suggestions
    tags: [Search]
    parameters:
      - name: q
        in: query
        required: true
        schema: { type: string }
    responses:
      "200":
        description: Autocomplete suggestions
```

### 5. Search Analytics

Track search queries to improve relevance:

```typescript
// src/lib/search-analytics.ts

import { insertRows } from "./bigquery.js";

export function logSearch(
  query: string,
  intent: string,
  resultCount: number,
  searchTimeMs: number,
  clickedResult?: string,
): void {
  insertRows("search_analytics", [{
    query,
    intent,
    result_count: resultCount,
    search_time_ms: searchTimeMs,
    clicked_result: clickedResult || null,
    searched_at: new Date().toISOString(),
  }]).catch(() => {});
}
```

```sql
-- BigQuery table
CREATE TABLE crypto_vision.search_analytics (
  query STRING NOT NULL,
  intent STRING,
  result_count INT64,
  search_time_ms INT64,
  clicked_result STRING,
  searched_at TIMESTAMP NOT NULL
)
PARTITION BY DATE(searched_at)
CLUSTER BY intent;

-- Useful queries:
-- Top search terms (for trending detection)
-- Zero-result queries (for coverage gaps)
-- Search-to-click rate (for relevance tuning)
```

## Validation

1. `smartSearch("bitcoin price")` returns BTC coin data (intent: price_lookup)
2. `smartSearch("best stablecoin yields")` returns yield pools (intent: yield_search)
3. `smartSearch("what happened to Luna")` returns news + semantic results (intent: event_query)
4. `smartSearch("ETH vs SOL")` returns comparison data (intent: comparison)
5. `smartSearch("what is impermanent loss")` returns concept explanation (intent: concept_explain)
6. `/api/search/nlq?q=...` returns AI-generated answer with sources
7. `/api/search/suggest?q=bit` returns "Bitcoin" within 200ms
8. Search results are deduplicated (no repeated coin entries)
9. Cache works (second identical query returns faster)
10. `npx tsc --noEmit` passes

## GCP Services

- Vertex AI Embeddings (from Prompt 03)
- BigQuery for search analytics
- No additional GCP APIs needed
