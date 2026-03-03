# Prompt 031 — AI Routes (AI Chat, Agents, Embeddings)

## Preamble — Read Every Time

You are an expert TypeScript engineer building **cryptocurrency.cv**. Stack: **Hono + TypeScript + Node.js**, Google Cloud Run, Redis caching, Zod validation.

### Absolute Rules

1. **Never mock, stub, or fake anything.** 2. **TypeScript strict mode** — no `any`. 3. **Always kill terminals** after every command. 4. **Commit and push as `nirholas`.** 5. **If close to hallucinating — tell the prompter.** 6. **Run `npx tsc --noEmit` and `npx vitest run`.** 7. **Improve any existing code you touch.**

---

## Task

Build / improve `src/routes/ai.ts` and `src/routes/agents.ts` — AI-powered crypto analysis, agent orchestration, and AI chat endpoints.

### Source Imports

```typescript
// ai.ts
import { Hono } from 'hono';
import * as ai from '../lib/ai.js';
import * as agents from '../lib/agents.js';
import { ApiError } from '../lib/api-error.js';

export const aiRoutes = new Hono();

// agents.ts
import { Hono } from 'hono';
import { loadAgent, listAgents, runAgent } from '../lib/agents.js';
import { ApiError } from '../lib/api-error.js';

export const agentRoutes = new Hono();
```

### AI Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/chat` | AI chat with crypto context |
| POST | `/analyze` | AI market analysis for a coin/topic |
| POST | `/summarize` | Summarize crypto news/articles |
| POST | `/sentiment` | AI-powered sentiment analysis |
| POST | `/strategy` | Generate trading/DeFi strategy |
| POST | `/explain` | Explain crypto concepts for beginners |
| GET | `/models` | Available AI models |
| POST | `/embed` | Generate text embeddings |
| POST | `/compare` | AI comparison of protocols/tokens |
| POST | `/risk-assessment` | AI-generated risk assessment |
| POST | `/portfolio-review` | AI portfolio analysis |

### Agent Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/list` | List all available agents |
| GET | `/detail/:id` | Agent detail and capabilities |
| POST | `/run/:id` | Run a specific agent with input |
| GET | `/history` | Recent agent execution history |
| POST | `/compose` | Chain multiple agents together |
| GET | `/categories` | Agent categories |

### AI Chat with Context Injection

```typescript
aiRoutes.post('/chat', async (c) => {
  const body = await c.req.json();
  const { message, context, model, conversationId } = z.object({
    message: z.string().min(1).max(4000),
    context: z.enum(['market', 'defi', 'technical', 'general']).default('general'),
    model: z.string().default('claude-sonnet-4-20250514'),
    conversationId: z.string().optional(),
  }).parse(body);
  
  // Inject real-time crypto data as context based on the question
  const contextData = await buildContextForQuery(message, context);
  
  const systemPrompt = `You are a crypto analysis AI assistant for cryptocurrency.cv. 
You have access to real-time market data. Answer questions accurately based on the provided data.
Current date: ${new Date().toISOString()}

REAL-TIME CONTEXT:
${JSON.stringify(contextData, null, 2)}`;
  
  const response = await ai.chat({
    model,
    systemPrompt,
    messages: [{ role: 'user', content: message }],
    conversationId,
  });
  
  return c.json({
    data: {
      response: response.content,
      model: response.model,
      usage: response.usage,
      conversationId: response.conversationId,
      contextUsed: Object.keys(contextData),
    },
    timestamp: new Date().toISOString(),
  });
});
```

### Context Builder (Real Data Injection)

```typescript
async function buildContextForQuery(query: string, context: string): Promise<Record<string, unknown>> {
  const data: Record<string, unknown> = {};
  const queryLower = query.toLowerCase();
  
  // Detect what data is needed based on the query
  const needsMarketData = /price|market|cap|volume|trend|bitcoin|ethereum/i.test(query);
  const needsDefiData = /defi|tvl|yield|protocol|liquidity|pool/i.test(query);
  const needsNewsData = /news|sentiment|happening|latest/i.test(query);
  const needsFearGreed = /fear|greed|sentiment|mood/i.test(query);
  
  const fetches: Promise<void>[] = [];
  
  if (needsMarketData) {
    fetches.push(
      cg.getCoins({ perPage: 10 }).then(coins => { data.topCoins = coins; }),
      cg.getGlobalData().then(global => { data.globalMarket = global; }),
    );
  }
  if (needsDefiData) {
    fetches.push(
      llama.getProtocols().then(p => { data.topProtocols = p.slice(0, 10); }),
    );
  }
  if (needsNewsData) {
    fetches.push(
      newsAgg.getBreakingNews(5).then(n => { data.latestNews = n; }),
    );
  }
  if (needsFearGreed) {
    fetches.push(
      alt.getFearGreedIndex().then(f => { data.fearGreed = f; }),
    );
  }
  
  await Promise.allSettled(fetches);
  return data;
}
```

### Agent Orchestration

```typescript
agentRoutes.get('/list', async (c) => {
  const category = c.req.query('category');
  
  // Load agents from agents/src/*.json
  const agents = await listAgents();
  
  const filtered = category 
    ? agents.filter(a => a.category === category)
    : agents;
  
  return c.json({
    data: filtered.map(agent => ({
      id: agent.id,
      name: agent.name,
      description: agent.description,
      category: agent.category,
      capabilities: agent.capabilities,
      inputSchema: agent.inputSchema,
      outputSchema: agent.outputSchema,
    })),
    timestamp: new Date().toISOString(),
  });
});

agentRoutes.post('/run/:id', async (c) => {
  const { id } = c.req.param();
  const input = await c.req.json();
  
  const agent = await loadAgent(id);
  if (!agent) throw new ApiError(404, `Agent not found: ${id}`);
  
  const result = await runAgent(agent, input);
  
  return c.json({
    data: {
      agentId: id,
      agentName: agent.name,
      output: result.output,
      executionTime: result.executionTimeMs,
      tokensUsed: result.tokensUsed,
    },
    timestamp: new Date().toISOString(),
  });
});
```

### Agent Composition (Multi-Agent Pipeline)

```typescript
agentRoutes.post('/compose', async (c) => {
  const { pipeline, input } = z.object({
    pipeline: z.array(z.object({
      agentId: z.string(),
      inputMapping: z.record(z.string(), z.string()).optional(),
    })).min(2).max(5),
    input: z.record(z.string(), z.unknown()),
  }).parse(await c.req.json());
  
  // Run agents sequentially, passing output of one as input to next
  let currentInput = input;
  const steps: { agentId: string; output: unknown; timeMs: number }[] = [];
  
  for (const step of pipeline) {
    const agent = await loadAgent(step.agentId);
    if (!agent) throw new ApiError(404, `Agent not found: ${step.agentId}`);
    
    // Apply input mapping (map fields from previous output to expected input)
    const mappedInput = step.inputMapping
      ? applyMapping(currentInput, step.inputMapping)
      : currentInput;
    
    const result = await runAgent(agent, mappedInput);
    steps.push({ agentId: step.agentId, output: result.output, timeMs: result.executionTimeMs });
    currentInput = result.output;
  }
  
  return c.json({
    data: {
      pipeline: steps,
      finalOutput: currentInput,
      totalTimeMs: steps.reduce((sum, s) => sum + s.timeMs, 0),
    },
    timestamp: new Date().toISOString(),
  });
});
```

### Acceptance Criteria

- [ ] All 17+ endpoints compile and return JSON
- [ ] AI chat injects real-time crypto data as context
- [ ] Context builder detects query intent and fetches relevant data
- [ ] Agent CRUD: list, detail, run from JSON configs
- [ ] Agent composition chains multiple agents sequentially
- [ ] AI models are configurable
- [ ] Rate limiting on AI endpoints (expensive calls)
- [ ] Tests pass, committed and pushed as `nirholas`, terminals killed

### Hallucination Warning

The `agents/src/` directory contains ~40 JSON agent definitions. Each agent has a unique structure. The AI library (`src/lib/ai.ts`) handles the actual LLM calls. If unsure about the agent JSON schema or AI library interface, read the files first or tell the prompter.
