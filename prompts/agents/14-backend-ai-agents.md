# Prompt 14 — Backend: AI/Agents Orchestration System

## Context

You are working on the AI and agent orchestration system in crypto-vision. The system has:

- `src/lib/ai.ts` — Multi-provider AI client: Groq → Gemini → OpenAI → Anthropic → OpenRouter
- `src/lib/agents.ts` — Agent execution engine
- `src/lib/orchestrator.ts` — Multi-agent orchestration
- `src/lib/rag.ts` — Retrieval-Augmented Generation
- `src/lib/embeddings.ts` — Text embedding generation
- `src/lib/vector-store.ts` — Vector similarity search
- `src/lib/search.ts` — Semantic search
- `src/routes/agents.ts` — Agent API endpoints
- `src/routes/ai.ts` — AI inference endpoints
- `src/routes/search.ts` — Search endpoints
- `agents/src/` — 43 JSON agent definitions (prompts, tools, config)

## Task

### 1. Complete the AI Provider Chain (`src/lib/ai.ts`)

Ensure the multi-provider fallback chain works:

```typescript
// Provider chain: Groq → Gemini → OpenAI → Anthropic → OpenRouter
//
// Each provider:
//   1. Check API key exists in env
//   2. Attempt inference with timeout (10s for Groq, 30s for others)
//   3. On failure → fall through to next provider
//   4. Log which provider was used and latency
//
// Methods:
//   generateText(prompt, options?) — Simple text generation
//   generateJSON<T>(prompt, schema: ZodSchema<T>) — Structured output with validation
//   generateEmbedding(text) — Text → vector (use same provider chain)
//   streamText(prompt, options?) — Streaming response
//
// Environment variables:
//   GROQ_API_KEY, GOOGLE_GEMINI_API_KEY, OPENAI_API_KEY,
//   ANTHROPIC_API_KEY, OPENROUTER_API_KEY
//
// Provider-specific configs:
//   Groq: model "llama-3.3-70b-versatile", fast but limited context
//   Gemini: model "gemini-2.0-flash", good for structured output
//   OpenAI: model "gpt-4o-mini", reliable
//   Anthropic: model "claude-sonnet-4-20250514", best quality
//   OpenRouter: model "meta-llama/llama-3.1-70b-instruct", cheapest fallback
```

### 2. Complete Agent Execution (`src/lib/agents.ts`)

Each agent is defined as a JSON file in `agents/src/` with:
- `id`, `name`, `description`
- `systemPrompt` — The agent's personality and instructions
- `tools` — Available tools (API calls, calculations)
- `model` — Preferred AI model
- `temperature`, `maxTokens`

```typescript
// AgentExecutor should:
// 1. Load agent definition from JSON
// 2. Construct system prompt with agent's instructions
// 3. Execute tools when the AI requests them:
//    - "get_price(coinId)" → call market data API
//    - "get_defi_tvl(protocol)" → call DeFi API
//    - "calculate_apy(amount, rate, days)" → pure computation
//    - "search_news(query)" → semantic search
//    - "get_chain_gas(chain)" → gas tracker
// 4. Return structured response
// 5. Track token usage and cost per execution
// 6. Timeout after 60 seconds
```

### 3. Complete Agent Orchestration (`src/lib/orchestrator.ts`)

Multi-agent workflows where agents collaborate:

```typescript
// Orchestrator should:
// 1. Accept a user query
// 2. Route to the best agent(s) based on query classification
// 3. Support execution patterns:
//    a. Single agent — route to one specialist
//    b. Sequential — chain agents (output of A → input of B)
//    c. Parallel — run multiple agents simultaneously, merge results
//    d. Debate — two agents analyze, third synthesizes
// 4. Agent routing via embedding similarity:
//    - Embed user query
//    - Compare to agent description embeddings
//    - Select top-K agents above threshold
// 5. Result merging: combine outputs from multiple agents
// 6. Conversation memory: maintain context within a session
```

### 4. Complete RAG Pipeline (`src/lib/rag.ts`)

Retrieval-Augmented Generation for knowledge-grounded answers:

```typescript
// RAG pipeline:
// 1. User asks: "What is Lido's TVL trend?"
// 2. Embed the query → vector
// 3. Search vector store for relevant documents (news, protocol data)
// 4. Retrieve top-K (k=5) most similar documents
// 5. Construct prompt: system instructions + retrieved context + user query
// 6. Generate response via AI provider chain
// 7. Include citations: which documents were used
//
// Vector store populated by workers:
//   - index-news.ts → news articles
//   - index-protocols.ts → protocol metadata
//   - index-governance.ts → governance proposals
//   - index-agents.ts → agent definitions
```

### 5. Complete Semantic Search (`src/lib/search.ts`)

```typescript
// Semantic search across the knowledge base:
// 1. Embed query
// 2. Search vector store with cosine similarity
// 3. Filter by type (news, protocol, governance, agent)
// 4. Return ranked results with scores
// 5. Support hybrid search: semantic + keyword (BM25-style)
// 6. Track search analytics (popular queries, click-through)
```

### 6. Fix Agent Route Endpoints (`src/routes/agents.ts`)

```
GET /api/agents — List all available agents with descriptions
GET /api/agents/:id — Agent detail (prompt, tools, capabilities)
POST /api/agents/:id/execute — Execute agent with user message
POST /api/agents/orchestrate — Multi-agent orchestration
GET /api/agents/categories — Agent categories
```

### 7. Fix AI Route Endpoints (`src/routes/ai.ts`)

```
POST /api/ai/ask — Ask a question (routed to best agent via RAG)
POST /api/ai/sentiment — Sentiment analysis of text
POST /api/ai/summarize — Summarize text or URL
POST /api/ai/analyze — Deep analysis of a coin/protocol
GET /api/ai/models — Available AI models and status
```

### 8. Fix Search Endpoints (`src/routes/search.ts`)

```
GET /api/search?q=... — Semantic search across all indexed content
GET /api/search/suggestions?q=... — Autocomplete suggestions
GET /api/search/analytics — Search analytics (popular queries)
```

## Technical Requirements

- AI calls must have timeout and retry logic
- Token usage tracked for cost monitoring
- Structured output validated with Zod schemas
- Embeddings cached in Redis (key: hash of input text)
- No raw API keys logged
- Graceful degradation: if no AI provider available, return helpful error
- No `any` types

## Verification

1. `POST /api/ai/ask` with `{ "question": "What is Bitcoin?" }` returns an answer
2. `GET /api/agents` returns all 43 agents
3. `POST /api/agents/{id}/execute` executes an agent
4. `GET /api/search?q=defi` returns relevant results
5. AI provider chain falls through correctly when a provider is unavailable
6. `npm run typecheck` passes
