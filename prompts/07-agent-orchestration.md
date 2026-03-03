# Prompt 07: Agent-to-Agent Orchestration & Multi-Agent Workflows

## Agent Identity & Rules

```
You are building the multi-agent orchestration layer for Crypto Vision.
- Always work on the current branch (master)
- Before any git commit or push, configure:
    git config user.name "nirholas"
    git config user.email "nirholas@users.noreply.github.com"
- Always use background terminals (isBackground: true)
- Always kill terminals after commands complete
- We have unlimited Claude credits — build the best possible version
- Every dollar spent must produce a permanent artifact (orchestration code, interaction data, workflow definitions)
- No mocks, no fakes, no stubs — real implementations only
```

## Objective

Build a multi-agent orchestration system where the 43+ DeFi agents can collaborate on complex tasks. When a user asks a question that spans multiple domains (e.g., "Should I move my ETH from Aave on Ethereum to Arbitrum for better yields?"), the orchestrator routes to the right agents, aggregates their outputs, and returns a unified response.

## Budget: $5k

- Cloud Run for agent execution: ~$2k
- AI inference for agent reasoning: ~$2k
- Cloud Tasks for async orchestration: ~$500
- Pub/Sub for agent communication: ~$500

## Current State

- 43 agent definitions in `agents/src/` with specialized system prompts
- `src/routes/agents.ts` with `/api/agents/:id/run` endpoint for single-agent execution
- `POST /api/agents/multi` endpoint exists but runs agents in parallel without coordination
- `packages/agent-runtime/` has ERC-8004 runtime with A2A messaging foundation
- AI provider cascade in `src/lib/ai.ts` supports multiple models

## Deliverables

### 1. Orchestration Engine (`src/lib/orchestrator.ts`)

```typescript
// src/lib/orchestrator.ts — Multi-agent task orchestration

import { log } from "./logger.js";
import { aiComplete } from "./ai.js";
import { cache } from "./cache.js";
import { aiQueue } from "./queue.js";

// ─── Types ───────────────────────────────────────────────────

export interface AgentCapability {
  id: string;
  name: string;
  description: string;
  domains: string[];       // e.g., ["defi", "yields", "lending"]
  dataAccess: string[];    // e.g., ["defillama", "coingecko", "aave"]
  maxLatencyMs: number;
}

export interface WorkflowStep {
  agentId: string;
  task: string;
  dependsOn: string[];     // Step IDs this depends on
  priority: number;        // Execution priority (higher = first)
}

export interface WorkflowPlan {
  id: string;
  question: string;
  steps: WorkflowStep[];
  estimatedLatencyMs: number;
  agentsUsed: string[];
}

export interface WorkflowResult {
  planId: string;
  question: string;
  steps: Array<{
    agentId: string;
    task: string;
    output: string;
    latencyMs: number;
    model: string;
  }>;
  synthesis: string;         // Final unified answer
  synthesisModel: string;
  totalLatencyMs: number;
  agentsUsed: string[];
}

// ─── Agent Registry ──────────────────────────────────────────

const AGENT_CAPABILITIES: AgentCapability[] = [
  {
    id: "defi-yield-farmer",
    name: "DeFi Yield Farmer",
    description: "Finds and analyzes yield farming opportunities across protocols",
    domains: ["defi", "yields", "farming", "apy", "liquidity"],
    dataAccess: ["defillama", "aave", "compound", "curve"],
    maxLatencyMs: 10_000,
  },
  {
    id: "smart-contract-auditor",
    name: "Smart Contract Auditor",
    description: "Audits smart contracts for vulnerabilities and risks",
    domains: ["security", "audit", "contracts", "vulnerabilities"],
    dataAccess: ["goplus", "etherscan"],
    maxLatencyMs: 15_000,
  },
  {
    id: "gas-optimization-expert",
    name: "Gas Optimization Expert",
    description: "Optimizes gas costs across chains and suggests timing",
    domains: ["gas", "fees", "optimization", "timing", "chains"],
    dataAccess: ["mempool", "etherscan", "l2beat"],
    maxLatencyMs: 8_000,
  },
  {
    id: "impermanent-loss-calculator",
    name: "Impermanent Loss Calculator",
    description: "Calculates and models impermanent loss scenarios",
    domains: ["il", "impermanent-loss", "liquidity", "pools", "amm"],
    dataAccess: ["defillama", "dexscreener"],
    maxLatencyMs: 5_000,
  },
  {
    id: "liquidation-risk-manager",
    name: "Liquidation Risk Manager",
    description: "Monitors and manages lending position liquidation risks",
    domains: ["liquidation", "lending", "collateral", "health-factor"],
    dataAccess: ["aave", "compound", "defillama"],
    maxLatencyMs: 8_000,
  },
  {
    id: "layer2-comparison-guide",
    name: "Layer 2 Comparison Guide",
    description: "Compares Layer 2 solutions for cost, speed, and ecosystem",
    domains: ["l2", "rollups", "bridges", "scaling", "chains"],
    dataAccess: ["l2beat", "defillama"],
    maxLatencyMs: 10_000,
  },
  {
    id: "bridge-security-analyst",
    name: "Bridge Security Analyst",
    description: "Analyzes cross-chain bridge security and risks",
    domains: ["bridges", "cross-chain", "security", "transfers"],
    dataAccess: ["defillama", "l2beat"],
    maxLatencyMs: 10_000,
  },
  {
    id: "crypto-tax-strategist",
    name: "Crypto Tax Strategist",
    description: "Advises on tax-efficient crypto strategies",
    domains: ["tax", "accounting", "regulations", "reporting"],
    dataAccess: [],
    maxLatencyMs: 10_000,
  },
  {
    id: "whale-watcher",
    name: "Whale Watcher",
    description: "Tracks and interprets whale wallet movements",
    domains: ["whales", "large-transactions", "smart-money", "accumulation"],
    dataAccess: ["blockchain-explorers"],
    maxLatencyMs: 12_000,
  },
  {
    id: "narrative-trend-analyst",
    name: "Narrative Trend Analyst",
    description: "Identifies emerging crypto narratives and trends",
    domains: ["narratives", "trends", "social", "sentiment", "alpha"],
    dataAccess: ["coingecko", "crypto-news"],
    maxLatencyMs: 10_000,
  },
  // ... load remaining agents from filesystem at runtime
];

// ─── Planning Engine ─────────────────────────────────────────

const PLANNER_PROMPT = `You are an AI workflow planner for a cryptocurrency intelligence system.
Given a user's question, determine which specialist agents should handle it and in what order.

Available agents:
{{AGENT_LIST}}

Rules:
1. Select 1-5 agents that are most relevant to the question
2. Determine dependencies — if Agent B needs Agent A's output, mark it
3. Agents without dependencies run in parallel for speed
4. Always end with a synthesis step
5. Be specific about what each agent should analyze

Respond in JSON:
{
  "reasoning": "Why these agents were selected",
  "steps": [
    {
      "agentId": "agent-id",
      "task": "Specific task description for this agent",
      "dependsOn": [],
      "priority": 1
    }
  ]
}`;

export async function planWorkflow(question: string): Promise<WorkflowPlan> {
  const agentList = AGENT_CAPABILITIES
    .map(a => `- ${a.id}: ${a.description} (domains: ${a.domains.join(", ")})`)
    .join("\n");

  const prompt = PLANNER_PROMPT.replace("{{AGENT_LIST}}", agentList);

  const { text } = await aiComplete(
    "You are a workflow planning AI. Respond only in valid JSON.",
    prompt + `\n\nUser question: ${question}`,
    { temperature: 0.1, maxTokens: 1000 }
  );

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Failed to parse workflow plan");
  
  const plan = JSON.parse(jsonMatch[0]);

  return {
    id: `wf-${Date.now()}`,
    question,
    steps: plan.steps,
    estimatedLatencyMs: plan.steps.length * 5000,
    agentsUsed: plan.steps.map((s: WorkflowStep) => s.agentId),
  };
}

// ─── Execution Engine ────────────────────────────────────────

export async function executeWorkflow(plan: WorkflowPlan): Promise<WorkflowResult> {
  const startTime = Date.now();
  const stepResults = new Map<string, string>();
  const completedSteps: WorkflowResult["steps"] = [];

  // Group steps by dependency level
  const levels = buildExecutionLevels(plan.steps);

  for (const level of levels) {
    // Execute all steps at this level in parallel
    const promises = level.map(async (step) => {
      const stepStart = Date.now();
      
      // Build context from dependencies
      let context = "";
      for (const dep of step.dependsOn) {
        const depResult = stepResults.get(dep);
        if (depResult) {
          context += `\nPrevious analysis from ${dep}:\n${depResult}\n`;
        }
      }

      // Execute agent
      const agentPrompt = buildAgentPrompt(step, plan.question, context);
      
      const { text, model } = await aiQueue.execute(() =>
        aiComplete(
          getAgentSystemPrompt(step.agentId),
          agentPrompt,
          { temperature: 0.3, maxTokens: 1500 }
        )
      );

      stepResults.set(step.agentId, text);
      completedSteps.push({
        agentId: step.agentId,
        task: step.task,
        output: text,
        latencyMs: Date.now() - stepStart,
        model,
      });
    });

    await Promise.allSettled(promises);
  }

  // Synthesis: combine all agent outputs into a unified response
  const synthesisPrompt = buildSynthesisPrompt(plan.question, completedSteps);
  const { text: synthesis, model: synthesisModel } = await aiComplete(
    "You are a senior crypto analyst synthesizing multiple expert analyses into a clear, actionable briefing.",
    synthesisPrompt,
    { temperature: 0.3, maxTokens: 2000 }
  );

  return {
    planId: plan.id,
    question: plan.question,
    steps: completedSteps,
    synthesis,
    synthesisModel,
    totalLatencyMs: Date.now() - startTime,
    agentsUsed: completedSteps.map(s => s.agentId),
  };
}

// ─── Helpers ─────────────────────────────────────────────────

function buildExecutionLevels(steps: WorkflowStep[]): WorkflowStep[][] {
  const levels: WorkflowStep[][] = [];
  const completed = new Set<string>();

  while (completed.size < steps.length) {
    const level = steps.filter(s =>
      !completed.has(s.agentId) &&
      s.dependsOn.every(d => completed.has(d))
    );

    if (level.length === 0) break; // Circular dependency guard
    levels.push(level);
    level.forEach(s => completed.add(s.agentId));
  }

  return levels;
}

function buildAgentPrompt(step: WorkflowStep, question: string, context: string): string {
  return `Original user question: "${question}"

Your specific task: ${step.task}

${context ? `Context from previous analyses:\n${context}` : ""}

Provide a focused, data-driven analysis for your specific area of expertise.
Include specific numbers, protocols, and actionable recommendations.`;
}

function getAgentSystemPrompt(agentId: string): string {
  // Load from agent definitions at runtime
  try {
    const fs = require("fs");
    const path = require("path");
    const agentFile = path.join(process.cwd(), "agents", "src", `${agentId}.json`);
    const agent = JSON.parse(fs.readFileSync(agentFile, "utf-8"));
    return agent.config?.systemRole || `You are a specialized crypto agent: ${agentId}`;
  } catch {
    return `You are a specialized crypto agent: ${agentId}. Provide expert analysis in your domain.`;
  }
}

function buildSynthesisPrompt(question: string, steps: WorkflowResult["steps"]): string {
  const analyses = steps
    .map(s => `### ${s.agentId}\n${s.output}`)
    .join("\n\n---\n\n");

  return `The user asked: "${question}"

The following specialist agents have each provided their analysis:

${analyses}

---

Synthesize these analyses into a single, clear, actionable response.
- Resolve any contradictions between agents
- Highlight consensus points
- Provide a final recommendation
- Include specific numbers and action items
- Format with clear sections`;
}
```

### 2. Enhanced Multi-Agent API Route

Update `src/routes/agents.ts` to use the orchestrator:

```typescript
// POST /api/agents/orchestrate — Intelligent multi-agent workflow
agentsRoutes.post("/orchestrate", async (c) => {
  const body = await c.req.json();
  const { question } = body;

  if (!question || typeof question !== "string") {
    return c.json({ error: "question is required" }, 400);
  }

  const { planWorkflow, executeWorkflow } = await import("../lib/orchestrator.js");

  // 1. Plan the workflow
  const plan = await planWorkflow(question);

  // 2. Execute with agent coordination
  const result = await executeWorkflow(plan);

  // 3. Log interaction for future training data
  const { insertRows } = await import("../lib/bigquery.js");
  insertRows("agent_interactions", [{
    interaction_id: plan.id,
    agent_id: "orchestrator",
    query: question,
    response: result.synthesis,
    model_used: result.synthesisModel,
    latency_ms: result.totalLatencyMs,
    agents_used: JSON.stringify(result.agentsUsed),
  }]).catch(() => {});

  return c.json({
    data: {
      answer: result.synthesis,
      agentsUsed: result.agentsUsed.map(id => ({
        id,
        analysis: result.steps.find(s => s.agentId === id)?.output?.slice(0, 500),
      })),
      workflow: {
        planId: result.planId,
        totalLatencyMs: result.totalLatencyMs,
        stepsExecuted: result.steps.length,
      },
    },
    timestamp: new Date().toISOString(),
  });
});
```

### 3. Agent Interaction Logging

Every agent execution gets logged to BigQuery for future model training:

```sql
-- Already defined in Prompt 01, but add columns:
ALTER TABLE crypto_vision.agent_interactions
ADD COLUMN agents_used STRING,
ADD COLUMN workflow_plan STRING,
ADD COLUMN synthesis_quality FLOAT64;
```

### 4. Agent Discovery & Capability Matching

```typescript
// src/lib/agent-discovery.ts
// Semantic matching of user questions to agent capabilities

import { generateEmbedding } from "./embeddings.js";
import { vectorStore } from "./vector-store.js";

// Index all agent capabilities into vector store at startup
export async function indexAgentCapabilities(): Promise<void> {
  const agents = loadAllAgents(); // From filesystem
  
  for (const agent of agents) {
    const text = `${agent.name}: ${agent.description}. Specializes in: ${agent.domains.join(", ")}`;
    const embedding = await generateEmbedding(text);
    await vectorStore.upsert(
      `capability:${agent.id}`,
      embedding,
      text,
      { category: "agent-capability", agentId: agent.id, domains: agent.domains }
    );
  }
}

// Find most relevant agents for a question
export async function findRelevantAgents(question: string, topK = 5): Promise<string[]> {
  const embedding = await generateEmbedding(question);
  const results = await vectorStore.search(embedding, topK, { category: "agent-capability" });
  return results.map(r => r.metadata.agentId);
}
```

### 5. Workflow Templates

Pre-defined workflow templates for common multi-agent scenarios:

```typescript
// src/lib/workflow-templates.ts

export const WORKFLOW_TEMPLATES = {
  "yield-optimization": {
    name: "Yield Optimization Analysis",
    description: "Find and analyze the best yield opportunities with risk assessment",
    agents: [
      { id: "defi-yield-farmer", task: "Find top yield opportunities across DeFi protocols" },
      { id: "impermanent-loss-calculator", task: "Calculate IL risk for the top pools" },
      { id: "smart-contract-auditor", task: "Assess smart contract risks of recommended protocols" },
      { id: "gas-optimization-expert", task: "Recommend optimal chains and timing for deployment" },
    ],
  },
  "chain-migration": {
    name: "Chain Migration Analysis",
    description: "Analyze whether to move assets from one chain to another",
    agents: [
      { id: "layer2-comparison-guide", task: "Compare source and target chains" },
      { id: "bridge-security-analyst", task: "Analyze bridge options and risks" },
      { id: "gas-optimization-expert", task: "Calculate migration costs" },
      { id: "defi-yield-farmer", task: "Compare yield opportunities on both chains" },
    ],
  },
  "risk-assessment": {
    name: "Comprehensive Risk Assessment",
    description: "Full risk analysis for a DeFi position or protocol",
    agents: [
      { id: "smart-contract-auditor", task: "Audit the protocol's contracts" },
      { id: "liquidation-risk-manager", task: "Assess liquidation risks" },
      { id: "whale-watcher", task: "Check for whale concentration risks" },
      { id: "narrative-trend-analyst", task: "Assess narrative and market sentiment risk" },
    ],
  },
  "portfolio-rebalance": {
    name: "Portfolio Rebalancing Strategy",
    description: "Analyze and recommend portfolio rebalancing",
    agents: [
      { id: "portfolio-rebalancing-advisor", task: "Analyze current allocation and recommend changes" },
      { id: "narrative-trend-analyst", task: "Identify trending narratives to consider" },
      { id: "stablecoin-comparator", task: "Recommend stablecoin allocation" },
      { id: "crypto-tax-strategist", task: "Consider tax implications of rebalancing" },
    ],
  },
};
```

## Validation

1. `planWorkflow("Should I move my ETH from Aave to Arbitrum?")` selects relevant agents
2. `executeWorkflow()` runs agents in correct dependency order
3. Parallel agents execute concurrently (measurable via total latency < sum of individual)
4. Synthesis produces a coherent combined answer
5. `/api/agents/orchestrate` returns within 30s for typical queries
6. Agent interactions are logged to BigQuery
7. Workflow templates execute correctly for all 4 predefined scenarios
8. `npx tsc --noEmit` passes

## GCP Services

- Cloud Tasks (optional): For async execution of long workflows
- BigQuery: Interaction logging
- AI inference: For the planning and synthesis steps
