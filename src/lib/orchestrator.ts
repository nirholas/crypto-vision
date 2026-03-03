/**
 * Crypto Vision — Multi-Agent Orchestration Engine
 *
 * Routes complex user questions through multiple specialized DeFi agents,
 * executes them in dependency order (parallel where possible), and
 * synthesizes a unified response.
 *
 * Architecture:
 *  1. **Planner** — Uses LLM to decompose a question into agent tasks with dependency graph
 *  2. **Executor** — Topologically sorts tasks, runs independent ones in parallel
 *  3. **Synthesizer** — Merges all agent outputs into a coherent final answer
 *
 * All agent definitions are loaded from `agents/src/` at runtime via the
 * shared agent registry in `src/lib/agents.ts`.
 *
 * @copyright 2024-2026 nirholas. All rights reserved.
 */

import { log } from "./logger.js";
import { aiComplete, type AIOptions } from "./ai.js";
import { cache } from "./cache.js";
import { aiQueue } from "./queue.js";
import { getAgent, listAgents, type AgentDefinition } from "./agents.js";

// ─── Types ───────────────────────────────────────────────────

export interface AgentCapability {
  id: string;
  name: string;
  description: string;
  domains: string[];
  dataAccess: string[];
  maxLatencyMs: number;
}

export interface WorkflowStep {
  agentId: string;
  task: string;
  dependsOn: string[];
  priority: number;
}

export interface WorkflowPlan {
  id: string;
  question: string;
  steps: WorkflowStep[];
  reasoning: string;
  estimatedLatencyMs: number;
  agentsUsed: string[];
  templateUsed?: string;
}

export interface StepResult {
  agentId: string;
  task: string;
  output: string;
  latencyMs: number;
  model: string;
  provider: string;
  status: "completed" | "failed";
  error?: string;
}

export interface WorkflowResult {
  planId: string;
  question: string;
  steps: StepResult[];
  synthesis: string;
  synthesisModel: string;
  synthesisProvider: string;
  totalLatencyMs: number;
  agentsUsed: string[];
  failedAgents: string[];
}

// ─── Agent Capability Registry ───────────────────────────────

/**
 * Maps agent identifiers to their capability metadata.
 * Domains and data sources are derived from agent tags, categories,
 * and identifier keywords for semantic matching during planning.
 */
const DOMAIN_KEYWORDS: Record<string, string[]> = {
  "defi-yield-farmer": ["defi", "yields", "farming", "apy", "liquidity", "protocols"],
  "smart-contract-auditor": ["security", "audit", "contracts", "vulnerabilities", "exploits"],
  "gas-optimization-expert": ["gas", "fees", "optimization", "timing", "chains", "transactions"],
  "impermanent-loss-calculator": ["il", "impermanent-loss", "liquidity", "pools", "amm", "lp"],
  "liquidation-risk-manager": ["liquidation", "lending", "collateral", "health-factor", "borrow"],
  "layer2-comparison-guide": ["l2", "rollups", "bridges", "scaling", "chains", "layer2"],
  "bridge-security-analyst": ["bridges", "cross-chain", "security", "transfers", "interop"],
  "crypto-tax-strategist": ["tax", "accounting", "regulations", "reporting", "compliance"],
  "whale-watcher": ["whales", "large-transactions", "smart-money", "accumulation", "wallets"],
  "narrative-trend-analyst": ["narratives", "trends", "social", "sentiment", "alpha", "meta"],
  "portfolio-rebalancing-advisor": ["portfolio", "rebalancing", "allocation", "diversification"],
  "defi-protocol-comparator": ["protocols", "comparison", "tvl", "fees", "features"],
  "defi-risk-scoring-engine": ["risk", "scoring", "assessment", "safety", "defi"],
  "defi-insurance-advisor": ["insurance", "coverage", "protection", "smart-contract-risk"],
  "defi-onboarding-mentor": ["onboarding", "beginner", "tutorial", "getting-started", "basics"],
  "dex-aggregator-optimizer": ["dex", "swap", "aggregation", "routing", "slippage"],
  "governance-proposal-analyst": ["governance", "proposals", "voting", "dao", "decisions"],
  "liquidity-pool-analyzer": ["pools", "liquidity", "depth", "volume", "tvl", "fees"],
  "mev-protection-advisor": ["mev", "sandwich", "frontrunning", "protection", "flashbots"],
  "nft-liquidity-advisor": ["nft", "liquidity", "floor-price", "marketplace", "collections"],
  "protocol-revenue-analyst": ["revenue", "earnings", "protocol-fees", "tokenomics"],
  "protocol-treasury-analyst": ["treasury", "reserves", "dao-funds", "runway"],
  "crypto-news-analyst": ["news", "events", "market-impact", "headlines", "media"],
  "alpha-leak-detector": ["alpha", "insider", "early-signals", "opportunities", "leaks"],
  "airdrop-hunter": ["airdrops", "eligibility", "farming", "retroactive", "claims"],
  "apy-vs-apr-educator": ["apy", "apr", "compounding", "education", "rates"],
  "stablecoin-comparator": ["stablecoins", "usdc", "usdt", "dai", "depeg-risk", "stability"],
  "staking-rewards-calculator": ["staking", "rewards", "validators", "pos", "delegation"],
  "token-unlock-tracker": ["unlocks", "vesting", "supply", "inflation", "schedules"],
  "yield-sustainability-analyst": ["sustainability", "ponzinomics", "real-yield", "emissions"],
  "yield-dashboard-builder": ["dashboards", "monitoring", "visualization", "tracking", "alerts"],
  "wallet-security-advisor": ["wallet", "security", "private-keys", "phishing", "safety"],
  "pump-fun-sdk-expert": ["pump-fun", "meme", "solana", "token-launch", "bonding-curve"],
  // Sperax-specific agents
  "spa-tokenomics-analyst": ["spa", "sperax", "tokenomics", "emissions", "supply"],
  "sperax-bridge-assistant": ["sperax", "bridge", "arbitrum", "transfers"],
  "sperax-governance-guide": ["sperax", "governance", "voting", "proposals"],
  "sperax-liquidity-strategist": ["sperax", "liquidity", "pools", "farming"],
  "sperax-onboarding-guide": ["sperax", "onboarding", "getting-started", "setup"],
  "sperax-portfolio-tracker": ["sperax", "portfolio", "tracking", "positions"],
  "sperax-risk-monitor": ["sperax", "risk", "alerts", "monitoring"],
  "sperax-yield-aggregator": ["sperax", "yield", "aggregation", "optimization"],
  "usds-stablecoin-expert": ["usds", "sperax-stablecoin", "stability", "peg", "collateral"],
  "vespa-optimizer": ["vespa", "staking", "lock", "boost", "rewards"],
};

const DATA_ACCESS_MAP: Record<string, string[]> = {
  "defi-yield-farmer": ["defillama", "aave", "compound", "curve"],
  "smart-contract-auditor": ["goplus", "etherscan"],
  "gas-optimization-expert": ["mempool", "etherscan", "l2beat"],
  "impermanent-loss-calculator": ["defillama", "dexscreener"],
  "liquidation-risk-manager": ["aave", "compound", "defillama"],
  "layer2-comparison-guide": ["l2beat", "defillama"],
  "bridge-security-analyst": ["defillama", "l2beat"],
  "whale-watcher": ["blockchain-explorers", "etherscan"],
  "narrative-trend-analyst": ["coingecko", "crypto-news"],
  "portfolio-rebalancing-advisor": ["coingecko", "defillama"],
  "defi-protocol-comparator": ["defillama", "dexscreener"],
  "defi-risk-scoring-engine": ["defillama", "goplus"],
  "dex-aggregator-optimizer": ["dexscreener", "defillama"],
  "liquidity-pool-analyzer": ["defillama", "dexscreener"],
  "protocol-revenue-analyst": ["defillama", "tokenterminal"],
  "protocol-treasury-analyst": ["defillama", "deepdao"],
  "stablecoin-comparator": ["defillama", "coingecko"],
  "crypto-news-analyst": ["crypto-news", "coingecko"],
  "alpha-leak-detector": ["crypto-news", "coingecko"],
  "token-unlock-tracker": ["tokenterminal", "coingecko"],
  "staking-rewards-calculator": ["stakingrewards", "defillama"],
};

/**
 * Build the full agent capability list from the filesystem agent registry
 * augmented with domain keywords and data access metadata.
 */
export function buildAgentCapabilities(): AgentCapability[] {
  const agents = listAgents();
  return agents.map((agent) => {
    const domains = DOMAIN_KEYWORDS[agent.id] ??
      deriveDomains(agent.id, agent.tags, agent.category);
    const dataAccess = DATA_ACCESS_MAP[agent.id] ?? [];

    return {
      id: agent.id,
      name: agent.title,
      description: agent.description,
      domains,
      dataAccess,
      maxLatencyMs: 15_000,
    };
  });
}

/**
 * Derive domain keywords from agent metadata when no explicit mapping exists.
 */
function deriveDomains(id: string, tags: string[], category: string): string[] {
  const domains = new Set<string>();
  if (category) domains.add(category.toLowerCase());
  for (const tag of tags) domains.add(tag.toLowerCase());
  // Extract keywords from hyphenated identifier
  for (const part of id.split("-")) {
    if (part.length > 2) domains.add(part);
  }
  return Array.from(domains);
}

// ─── Planning Engine ─────────────────────────────────────────

const PLANNER_SYSTEM = `You are a workflow planning AI for a cryptocurrency intelligence platform.
You decompose user questions into tasks for specialist agents.
Respond ONLY in valid JSON — no markdown, no explanation outside the JSON.`;

function buildPlannerPrompt(agentList: string, question: string): string {
  return `Given a user's question, determine which specialist agents should handle it and in what order.

Available agents:
${agentList}

Rules:
1. Select 1-5 agents that are most relevant to the question.
2. Determine dependencies: if Agent B needs Agent A's output first, list A's agentId in B's dependsOn.
3. Agents without dependencies run in parallel for speed.
4. Be specific about what each agent should analyze — reference the user's question.
5. Assign priority 1 (highest) to the most critical agents.
6. Do NOT select agents that are irrelevant to the question.

Respond with this exact JSON shape:
{
  "reasoning": "Brief explanation of why these agents were selected and how they relate to the question",
  "steps": [
    {
      "agentId": "exact-agent-id",
      "task": "Specific task description for this agent given the user's question",
      "dependsOn": [],
      "priority": 1
    }
  ]
}

User question: ${question}`;
}

/**
 * Use LLM to decompose a user question into a multi-agent workflow plan.
 *
 * The planner selects relevant agents and determines execution order
 * based on task dependencies. Independent tasks run in parallel.
 */
export async function planWorkflow(question: string): Promise<WorkflowPlan> {
  const capabilities = buildAgentCapabilities();
  const agentList = capabilities
    .map(
      (a) =>
        `- ${a.id}: ${a.description} (domains: ${a.domains.join(", ")})`,
    )
    .join("\n");

  const prompt = buildPlannerPrompt(agentList, question);

  const cacheKey = `plan:${question.toLowerCase().trim().slice(0, 200)}`;
  const cached = await cache.get<string>(cacheKey);
  if (cached) {
    try {
      const plan = JSON.parse(cached) as WorkflowPlan;
      log.info({ planId: plan.id, agentsUsed: plan.agentsUsed }, "Using cached workflow plan");
      return plan;
    } catch {
      // Invalid cache — regenerate
    }
  }

  const { text } = await aiQueue.execute(() =>
    aiComplete(PLANNER_SYSTEM, prompt, {
      temperature: 0.1,
      maxTokens: 1200,
    }),
  );

  const parsed = extractJSON<{ reasoning: string; steps: WorkflowStep[] }>(text);
  if (!parsed || !Array.isArray(parsed.steps) || parsed.steps.length === 0) {
    throw new OrchestratorError("Failed to generate a valid workflow plan from the AI planner");
  }

  // Validate that all referenced agents exist
  const validSteps = parsed.steps.filter((s) => {
    const exists = capabilities.some((c) => c.id === s.agentId);
    if (!exists) {
      log.warn({ agentId: s.agentId }, "Planner referenced unknown agent — skipping");
    }
    return exists;
  });

  if (validSteps.length === 0) {
    throw new OrchestratorError("No valid agents were selected by the planner");
  }

  // Enforce max 5 agents
  const limitedSteps = validSteps.slice(0, 5);

  // Validate dependency references
  const stepIds = new Set(limitedSteps.map((s) => s.agentId));
  for (const step of limitedSteps) {
    step.dependsOn = step.dependsOn.filter((dep) => stepIds.has(dep));
  }

  const plan: WorkflowPlan = {
    id: `wf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    question,
    steps: limitedSteps,
    reasoning: parsed.reasoning || "",
    estimatedLatencyMs: estimateLatency(limitedSteps, capabilities),
    agentsUsed: limitedSteps.map((s) => s.agentId),
  };

  // Cache the plan for 5 minutes (same question → same plan)
  await cache.set(cacheKey, JSON.stringify(plan), 300).catch(() => {});

  log.info(
    {
      planId: plan.id,
      question: question.slice(0, 100),
      agentsUsed: plan.agentsUsed,
      estimatedLatencyMs: plan.estimatedLatencyMs,
    },
    "Workflow plan created",
  );

  return plan;
}

// ─── Execution Engine ────────────────────────────────────────

/**
 * Execute a workflow plan: run agents in dependency order
 * (parallel within each level), then synthesize.
 *
 * Steps are grouped into execution levels by topological sort.
 * All steps within a level execute concurrently.
 */
export async function executeWorkflow(plan: WorkflowPlan): Promise<WorkflowResult> {
  const startTime = Date.now();
  const stepResults = new Map<string, string>();
  const completedSteps: StepResult[] = [];
  const failedAgents: string[] = [];

  const levels = buildExecutionLevels(plan.steps);

  log.info(
    {
      planId: plan.id,
      levels: levels.length,
      totalSteps: plan.steps.length,
    },
    "Executing workflow",
  );

  for (const [levelIdx, level] of levels.entries()) {
    const levelStart = Date.now();

    const promises = level.map(async (step): Promise<void> => {
      const stepStart = Date.now();

      try {
        // Build context from completed dependencies
        const context = buildDependencyContext(step.dependsOn, stepResults);

        // Build the agent prompt with question + task + dependency context
        const agentPrompt = buildAgentPrompt(step, plan.question, context);

        // Load the agent's system prompt from the registry
        const systemPrompt = loadAgentSystemPrompt(step.agentId);

        // Execute via the shared AI queue
        const { text, model, provider } = await aiQueue.execute(() =>
          aiComplete(systemPrompt, agentPrompt, {
            temperature: 0.3,
            maxTokens: 1500,
          }),
        );

        stepResults.set(step.agentId, text);
        completedSteps.push({
          agentId: step.agentId,
          task: step.task,
          output: text,
          latencyMs: Date.now() - stepStart,
          model,
          provider,
          status: "completed",
        });

        log.info(
          {
            planId: plan.id,
            agentId: step.agentId,
            latencyMs: Date.now() - stepStart,
            model,
          },
          "Agent step completed",
        );
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        failedAgents.push(step.agentId);
        completedSteps.push({
          agentId: step.agentId,
          task: step.task,
          output: "",
          latencyMs: Date.now() - stepStart,
          model: "none",
          provider: "none",
          status: "failed",
          error: errorMsg,
        });

        log.error(
          { planId: plan.id, agentId: step.agentId, err: errorMsg },
          "Agent step failed",
        );
      }
    });

    // Wait for all agents in this level to complete (or fail)
    await Promise.allSettled(promises);

    log.info(
      {
        planId: plan.id,
        level: levelIdx,
        agents: level.map((s) => s.agentId),
        latencyMs: Date.now() - levelStart,
      },
      "Execution level completed",
    );
  }

  // Synthesis — combine all successful agent outputs
  const successfulSteps = completedSteps.filter((s) => s.status === "completed");

  if (successfulSteps.length === 0) {
    return {
      planId: plan.id,
      question: plan.question,
      steps: completedSteps,
      synthesis: "All agents failed to produce results. Please try again later.",
      synthesisModel: "none",
      synthesisProvider: "none",
      totalLatencyMs: Date.now() - startTime,
      agentsUsed: completedSteps.map((s) => s.agentId),
      failedAgents,
    };
  }

  const synthesisPrompt = buildSynthesisPrompt(plan.question, successfulSteps);
  const {
    text: synthesis,
    model: synthesisModel,
    provider: synthesisProvider,
  } = await aiQueue.execute(() =>
    aiComplete(
      SYNTHESIS_SYSTEM,
      synthesisPrompt,
      { temperature: 0.3, maxTokens: 2500 },
    ),
  );

  const result: WorkflowResult = {
    planId: plan.id,
    question: plan.question,
    steps: completedSteps,
    synthesis,
    synthesisModel,
    synthesisProvider,
    totalLatencyMs: Date.now() - startTime,
    agentsUsed: completedSteps.map((s) => s.agentId),
    failedAgents,
  };

  log.info(
    {
      planId: plan.id,
      totalLatencyMs: result.totalLatencyMs,
      agentsSucceeded: successfulSteps.length,
      agentsFailed: failedAgents.length,
      synthesisModel,
    },
    "Workflow execution completed",
  );

  return result;
}

// ─── Synthesis ───────────────────────────────────────────────

const SYNTHESIS_SYSTEM = `You are a senior crypto analyst synthesizing multiple expert analyses into a clear, actionable briefing.
You combine insights from specialist agents into a single coherent response.
Resolve contradictions, highlight consensus, and provide a final recommendation.`;

function buildSynthesisPrompt(question: string, steps: StepResult[]): string {
  const analyses = steps
    .map((s) => `### ${formatAgentName(s.agentId)}\n${s.output}`)
    .join("\n\n---\n\n");

  return `The user asked: "${question}"

The following specialist agents have each provided their analysis:

${analyses}

---

Synthesize these analyses into a single, clear, actionable response:
- Resolve any contradictions between agents and explain trade-offs
- Highlight points where multiple agents agree (strong signals)
- Provide a final recommendation with specific numbers and action items
- Include relevant risk warnings
- Format with clear sections using markdown headers
- Keep it practical — the user wants to know what to DO`;
}

// ─── Helpers ─────────────────────────────────────────────────

/**
 * Topological sort: group steps into execution levels
 * where all dependencies of a level have been satisfied.
 * Steps within a level can be executed in parallel.
 */
export function buildExecutionLevels(steps: WorkflowStep[]): WorkflowStep[][] {
  const levels: WorkflowStep[][] = [];
  const completed = new Set<string>();
  const remaining = new Set(steps.map((s) => s.agentId));

  let iterations = 0;
  const maxIterations = steps.length + 1; // Guard against circular deps

  while (remaining.size > 0 && iterations < maxIterations) {
    const level = steps.filter(
      (s) =>
        remaining.has(s.agentId) &&
        s.dependsOn.every((d) => completed.has(d)),
    );

    if (level.length === 0) {
      // Remaining steps have unsatisfiable dependencies — force-execute them
      log.warn(
        { remaining: Array.from(remaining) },
        "Breaking circular dependency — forcing remaining steps",
      );
      const forced = steps.filter((s) => remaining.has(s.agentId));
      levels.push(forced);
      break;
    }

    levels.push(level);
    for (const s of level) {
      completed.add(s.agentId);
      remaining.delete(s.agentId);
    }
    iterations++;
  }

  return levels;
}

/**
 * Combine outputs from dependency steps into context for the current step.
 */
function buildDependencyContext(
  dependsOn: string[],
  stepResults: Map<string, string>,
): string {
  if (dependsOn.length === 0) return "";

  const parts: string[] = [];
  for (const dep of dependsOn) {
    const result = stepResults.get(dep);
    if (result) {
      parts.push(`[Analysis from ${formatAgentName(dep)}]\n${result}`);
    }
  }

  return parts.length > 0
    ? `\nContext from previous analyses:\n\n${parts.join("\n\n")}\n`
    : "";
}

/**
 * Build the user prompt for an individual agent execution step.
 */
function buildAgentPrompt(
  step: WorkflowStep,
  question: string,
  context: string,
): string {
  return `Original user question: "${question}"

Your specific task: ${step.task}
${context}
Provide a focused, data-driven analysis for your specific area of expertise.
Include specific numbers, protocols, and actionable recommendations where possible.
Be concise but thorough — your output will be combined with other specialist analyses.`;
}

/**
 * Load the system prompt for a specific agent from the registry.
 * Falls back to a generic prompt if the agent isn't found.
 */
function loadAgentSystemPrompt(agentId: string): string {
  const agent = getAgent(agentId);
  if (agent?.config?.systemRole) {
    return agent.config.systemRole;
  }
  return `You are a specialized cryptocurrency and DeFi agent: ${agentId}. Provide expert analysis in your domain.`;
}

/**
 * Estimate total workflow latency based on execution levels.
 * Parallel steps within a level contribute the max of their individual latencies.
 */
function estimateLatency(
  steps: WorkflowStep[],
  capabilities: AgentCapability[],
): number {
  const levels = buildExecutionLevels(steps);
  let total = 0;

  for (const level of levels) {
    // Within a level, latency is the slowest agent
    const maxLatency = Math.max(
      ...level.map((s) => {
        const cap = capabilities.find((c) => c.id === s.agentId);
        return cap?.maxLatencyMs ?? 10_000;
      }),
    );
    total += maxLatency;
  }

  // Add synthesis step estimate
  total += 5_000;

  return total;
}

/**
 * Extract JSON from an LLM response that may include markdown fences or extra text.
 */
function extractJSON<T>(text: string): T | null {
  // Try direct parse first
  try {
    return JSON.parse(text) as T;
  } catch {
    // Fall through
  }

  // Try extracting from markdown code fence
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    try {
      return JSON.parse(fenceMatch[1]) as T;
    } catch {
      // Fall through
    }
  }

  // Try extracting any JSON object
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]) as T;
    } catch {
      // Fall through
    }
  }

  return null;
}

/**
 * Format agent ID into a human-readable name.
 * "defi-yield-farmer" → "DeFi Yield Farmer"
 */
function formatAgentName(agentId: string): string {
  return agentId
    .split("-")
    .map((word) => {
      if (word === "defi") return "DeFi";
      if (word === "nft") return "NFT";
      if (word === "mev") return "MEV";
      if (word === "apy") return "APY";
      if (word === "apr") return "APR";
      if (word === "dex") return "DEX";
      if (word === "spa") return "SPA";
      if (word === "usds") return "USDs";
      if (word === "il") return "IL";
      if (word === "l2") return "L2";
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

// ─── Error ───────────────────────────────────────────────────

export class OrchestratorError extends Error {
  public status = 500;
  constructor(message: string) {
    super(message);
    this.name = "OrchestratorError";
  }
}
