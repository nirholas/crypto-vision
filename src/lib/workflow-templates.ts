/**
 * Crypto Vision — Workflow Templates
 *
 * Pre-defined multi-agent workflow templates for common DeFi analysis
 * scenarios. Templates skip the LLM planning step and go straight to
 * execution with known-good agent combinations and task descriptions.
 *
 * Templates are available via the `/api/agents/orchestrate` endpoint
 * with the `template` parameter, or can be listed via
 * `GET /api/agents/orchestrate/templates`.
 *
 * @copyright 2024-2026 nirholas. All rights reserved.
 */

import type { WorkflowStep, WorkflowPlan } from "./orchestrator.js";

// ─── Types ───────────────────────────────────────────────────

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  /** Example questions this template handles well */
  exampleQuestions: string[];
  /** Pre-defined agent steps */
  steps: WorkflowStep[];
}

// ─── Templates ───────────────────────────────────────────────

export const WORKFLOW_TEMPLATES: Record<string, WorkflowTemplate> = {
  "yield-optimization": {
    id: "yield-optimization",
    name: "Yield Optimization Analysis",
    description:
      "Find and analyze the best yield opportunities across DeFi protocols, with risk assessment, IL modeling, smart contract audit, and gas cost optimization.",
    exampleQuestions: [
      "Where can I get the best yield on my ETH?",
      "What are the safest high-yield farming opportunities right now?",
      "Should I stake, lend, or provide liquidity with my USDC?",
    ],
    steps: [
      {
        agentId: "defi-yield-farmer",
        task: "Find the top yield opportunities across DeFi protocols for the user's assets. Include APY, TVL, protocol name, and chain for each opportunity.",
        dependsOn: [],
        priority: 1,
      },
      {
        agentId: "impermanent-loss-calculator",
        task: "For the top liquidity pool opportunities identified, calculate the expected impermanent loss under different price scenarios (±10%, ±25%, ±50%).",
        dependsOn: ["defi-yield-farmer"],
        priority: 2,
      },
      {
        agentId: "smart-contract-auditor",
        task: "Assess the smart contract security of the recommended protocols. Check for known vulnerabilities, audit status, and TVL history.",
        dependsOn: ["defi-yield-farmer"],
        priority: 2,
      },
      {
        agentId: "gas-optimization-expert",
        task: "Recommend the most cost-efficient chains and timing for deploying capital into the recommended yield opportunities. Compare gas costs across chains.",
        dependsOn: ["impermanent-loss-calculator", "smart-contract-auditor"],
        priority: 3,
      },
    ],
  },

  "chain-migration": {
    id: "chain-migration",
    name: "Chain Migration Analysis",
    description:
      "Analyze whether to move assets from one chain to another, considering yields, bridge security, gas costs, and ecosystem opportunities.",
    exampleQuestions: [
      "Should I move my ETH from Ethereum to Arbitrum?",
      "Is it worth bridging to Base for better DeFi yields?",
      "Compare the cost of using Optimism vs Polygon for DeFi.",
    ],
    steps: [
      {
        agentId: "layer-2-comparison-guide",
        task: "Compare the source and target chains in terms of TVL, transaction costs, speed, ecosystem size, and DeFi protocol availability.",
        dependsOn: [],
        priority: 1,
      },
      {
        agentId: "bridge-security-analyst",
        task: "Analyze the available bridge options between the chains. Compare security models, audit status, TVL locked, bridge time, and historical incidents.",
        dependsOn: [],
        priority: 1,
      },
      {
        agentId: "gas-optimization-expert",
        task: "Calculate the total migration cost including bridge fees, gas on source chain, and gas on destination chain. Recommend optimal timing.",
        dependsOn: ["bridge-security-analyst"],
        priority: 2,
      },
      {
        agentId: "defi-yield-farmer",
        task: "Compare DeFi yield opportunities available on both the source and target chains. Show the yield differential to determine if migration is worthwhile.",
        dependsOn: ["layer-2-comparison-guide"],
        priority: 2,
      },
    ],
  },

  "risk-assessment": {
    id: "risk-assessment",
    name: "Comprehensive Risk Assessment",
    description:
      "Full risk analysis for a DeFi position, protocol, or strategy. Covers smart contract risk, liquidation risk, whale concentration, and market sentiment.",
    exampleQuestions: [
      "How risky is depositing into Aave on Arbitrum?",
      "What are the risks of this Curve liquidity pool?",
      "Is this DeFi protocol safe to use?",
    ],
    steps: [
      {
        agentId: "smart-contract-auditor",
        task: "Audit the protocol's smart contracts. Check audit reports, known vulnerabilities, upgrade mechanisms, and admin key risks.",
        dependsOn: [],
        priority: 1,
      },
      {
        agentId: "liquidation-risk-manager",
        task: "Assess liquidation risks for the user's position. Analyze health factor, collateral ratios, and liquidation thresholds under various market scenarios.",
        dependsOn: [],
        priority: 1,
      },
      {
        agentId: "whale-watcher",
        task: "Check for whale concentration risks in the protocol. Identify large wallet holdings, recent whale movements, and potential dump risk.",
        dependsOn: [],
        priority: 2,
      },
      {
        agentId: "narrative-trend-analyst",
        task: "Assess the current market narrative and sentiment around the protocol/token. Identify any upcoming catalysts or risks from sentiment shifts.",
        dependsOn: [],
        priority: 2,
      },
    ],
  },

  "portfolio-rebalance": {
    id: "portfolio-rebalance",
    name: "Portfolio Rebalancing Strategy",
    description:
      "Analyze a crypto portfolio and recommend rebalancing based on current market conditions, narratives, stablecoin allocation, and tax implications.",
    exampleQuestions: [
      "How should I rebalance my crypto portfolio?",
      "What's the optimal allocation between ETH, BTC, and stables right now?",
      "Should I increase my stablecoin allocation given current market conditions?",
    ],
    steps: [
      {
        agentId: "portfolio-rebalancing-advisor",
        task: "Analyze the user's current portfolio allocation and recommend rebalancing based on risk tolerance, market conditions, and diversification principles.",
        dependsOn: [],
        priority: 1,
      },
      {
        agentId: "narrative-trend-analyst",
        task: "Identify the top 3-5 trending crypto narratives right now. Recommend which narrative-aligned assets deserve increased allocation.",
        dependsOn: [],
        priority: 1,
      },
      {
        agentId: "stablecoin-comparator",
        task: "Compare available stablecoins for the portfolio's stable allocation. Consider yield, depeg risk, regulatory exposure, and protocol backing.",
        dependsOn: ["portfolio-rebalancing-advisor"],
        priority: 2,
      },
      {
        agentId: "crypto-tax-strategist",
        task: "Analyze the tax implications of the recommended rebalancing trades. Suggest tax-loss harvesting opportunities and timing strategies.",
        dependsOn: ["portfolio-rebalancing-advisor"],
        priority: 2,
      },
    ],
  },
};

// ─── Public API ──────────────────────────────────────────────

/**
 * List all available workflow templates with metadata.
 */
export function listTemplates(): Array<{
  id: string;
  name: string;
  description: string;
  exampleQuestions: string[];
  agentCount: number;
}> {
  return Object.values(WORKFLOW_TEMPLATES).map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    exampleQuestions: t.exampleQuestions,
    agentCount: t.steps.length,
  }));
}

/**
 * Get a specific template by ID.
 */
export function getTemplate(id: string): WorkflowTemplate | undefined {
  return WORKFLOW_TEMPLATES[id];
}

/**
 * Convert a workflow template into an executable WorkflowPlan.
 *
 * @param templateId - The template to use
 * @param question - The user's specific question (used in synthesis)
 */
export function templateToPlan(
  templateId: string,
  question: string,
): WorkflowPlan | null {
  const template = WORKFLOW_TEMPLATES[templateId];
  if (!template) return null;

  return {
    id: `wf-tpl-${templateId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    question,
    steps: template.steps,
    reasoning: `Using pre-defined template: ${template.name}. ${template.description}`,
    estimatedLatencyMs: estimateTemplateLatency(template),
    agentsUsed: template.steps.map((s) => s.agentId),
    templateUsed: templateId,
  };
}

/**
 * Estimate execution time for a template based on dependency levels.
 */
function estimateTemplateLatency(template: WorkflowTemplate): number {
  const completed = new Set<string>();
  let totalMs = 0;

  while (completed.size < template.steps.length) {
    const level = template.steps.filter(
      (s) =>
        !completed.has(s.agentId) &&
        s.dependsOn.every((d) => completed.has(d)),
    );

    if (level.length === 0) break;

    // Each level takes ~10s (worst case agent latency)
    totalMs += 10_000;
    for (const s of level) completed.add(s.agentId);
  }

  // Synthesis step
  totalMs += 5_000;

  return totalMs;
}
