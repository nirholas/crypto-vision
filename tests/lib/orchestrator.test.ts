/**
 * Tests for lib/orchestrator.ts — Multi-agent workflow orchestration
 *
 * Tests cover:
 *  - buildExecutionLevels (topological sort)
 *  - buildAgentCapabilities (registry integration)
 *  - planWorkflow (LLM-based planning with mocked AI)
 *  - executeWorkflow (parallel execution with mocked AI)
 *  - Error handling (missing agents, circular deps, AI failures)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  buildExecutionLevels,
  buildAgentCapabilities,
  planWorkflow,
  executeWorkflow,
  OrchestratorError,
  type WorkflowStep,
  type WorkflowPlan,
} from "@/lib/orchestrator.js";

// ─── Mock AI module ──────────────────────────────────────────

vi.mock("@/lib/ai.js", () => ({
  aiComplete: vi.fn(),
  isAIConfigured: vi.fn(() => true),
  getConfiguredProviders: vi.fn(() => ["groq"]),
}));

vi.mock("@/lib/cache.js", () => {
  const get = vi.fn(async () => null);
  const set = vi.fn(async () => undefined);
  const del = vi.fn(async () => undefined);
  return { cache: { get, set, del } };
});

vi.mock("@/lib/queue.js", () => ({
  aiQueue: {
    execute: vi.fn(async (fn: () => Promise<unknown>) => fn()),
  },
  QueueFullError: class QueueFullError extends Error {
    status = 503;
    constructor(max: number) {
      super(`Queue full: ${max}`);
    }
  },
}));

// ─── buildExecutionLevels ────────────────────────────────────

describe("buildExecutionLevels", () => {
  it("groups independent steps into one level", () => {
    const steps: WorkflowStep[] = [
      { agentId: "a", task: "Task A", dependsOn: [], priority: 1 },
      { agentId: "b", task: "Task B", dependsOn: [], priority: 1 },
      { agentId: "c", task: "Task C", dependsOn: [], priority: 1 },
    ];

    const levels = buildExecutionLevels(steps);
    expect(levels).toHaveLength(1);
    expect(levels[0]).toHaveLength(3);
    expect(levels[0].map((s) => s.agentId).sort()).toEqual(["a", "b", "c"]);
  });

  it("separates steps with dependencies into correct levels", () => {
    const steps: WorkflowStep[] = [
      { agentId: "a", task: "Task A", dependsOn: [], priority: 1 },
      { agentId: "b", task: "Task B", dependsOn: ["a"], priority: 2 },
      { agentId: "c", task: "Task C", dependsOn: ["b"], priority: 3 },
    ];

    const levels = buildExecutionLevels(steps);
    expect(levels).toHaveLength(3);
    expect(levels[0].map((s) => s.agentId)).toEqual(["a"]);
    expect(levels[1].map((s) => s.agentId)).toEqual(["b"]);
    expect(levels[2].map((s) => s.agentId)).toEqual(["c"]);
  });

  it("runs independent branches in parallel", () => {
    // Diamond: A → B, A → C, B → D, C → D
    const steps: WorkflowStep[] = [
      { agentId: "a", task: "Task A", dependsOn: [], priority: 1 },
      { agentId: "b", task: "Task B", dependsOn: ["a"], priority: 2 },
      { agentId: "c", task: "Task C", dependsOn: ["a"], priority: 2 },
      { agentId: "d", task: "Task D", dependsOn: ["b", "c"], priority: 3 },
    ];

    const levels = buildExecutionLevels(steps);
    expect(levels).toHaveLength(3);
    expect(levels[0].map((s) => s.agentId)).toEqual(["a"]);
    expect(levels[1].map((s) => s.agentId).sort()).toEqual(["b", "c"]); // parallel
    expect(levels[2].map((s) => s.agentId)).toEqual(["d"]);
  });

  it("handles a single step", () => {
    const steps: WorkflowStep[] = [
      { agentId: "solo", task: "Only task", dependsOn: [], priority: 1 },
    ];

    const levels = buildExecutionLevels(steps);
    expect(levels).toHaveLength(1);
    expect(levels[0]).toHaveLength(1);
  });

  it("handles circular dependencies by forcing remaining steps", () => {
    const steps: WorkflowStep[] = [
      { agentId: "a", task: "Task A", dependsOn: ["b"], priority: 1 },
      { agentId: "b", task: "Task B", dependsOn: ["a"], priority: 1 },
    ];

    // Should not infinite loop — forces execution
    const levels = buildExecutionLevels(steps);
    expect(levels.length).toBeGreaterThan(0);
    // All agents should appear in some level
    const allAgents = levels.flat().map((s) => s.agentId);
    expect(allAgents).toContain("a");
    expect(allAgents).toContain("b");
  });

  it("handles empty steps array", () => {
    const levels = buildExecutionLevels([]);
    expect(levels).toHaveLength(0);
  });
});

// ─── buildAgentCapabilities ──────────────────────────────────

describe("buildAgentCapabilities", () => {
  it("returns a non-empty array of capabilities", () => {
    const capabilities = buildAgentCapabilities();
    expect(capabilities.length).toBeGreaterThan(0);
  });

  it("each capability has required fields", () => {
    const capabilities = buildAgentCapabilities();
    for (const cap of capabilities) {
      expect(cap.id).toBeTruthy();
      expect(cap.name).toBeTruthy();
      expect(cap.description).toBeTruthy();
      expect(Array.isArray(cap.domains)).toBe(true);
      expect(cap.domains.length).toBeGreaterThan(0);
      expect(Array.isArray(cap.dataAccess)).toBe(true);
      expect(cap.maxLatencyMs).toBeGreaterThan(0);
    }
  });

  it("contains well-known agents", () => {
    const capabilities = buildAgentCapabilities();
    const ids = capabilities.map((c) => c.id);
    expect(ids).toContain("defi-yield-farmer");
    expect(ids).toContain("smart-contract-auditor");
    expect(ids).toContain("gas-optimization-expert");
  });
});

// ─── planWorkflow ────────────────────────────────────────────

describe("planWorkflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("produces a valid plan from AI response", async () => {
    const { aiComplete } = await import("@/lib/ai.js");
    const mockPlanResponse = JSON.stringify({
      reasoning: "The user wants to find the best yield",
      steps: [
        { agentId: "defi-yield-farmer", task: "Find top yields", dependsOn: [], priority: 1 },
        { agentId: "gas-optimization-expert", task: "Check gas costs", dependsOn: ["defi-yield-farmer"], priority: 2 },
      ],
    });

    vi.mocked(aiComplete).mockResolvedValue({
      text: mockPlanResponse,
      provider: "groq",
      model: "llama-3.3-70b",
      tokensUsed: 500,
    });

    const plan = await planWorkflow("Where can I get the best yield on my ETH?");

    expect(plan.id).toMatch(/^wf-/);
    expect(plan.question).toBe("Where can I get the best yield on my ETH?");
    expect(plan.steps).toHaveLength(2);
    expect(plan.agentsUsed).toContain("defi-yield-farmer");
    expect(plan.agentsUsed).toContain("gas-optimization-expert");
    expect(plan.estimatedLatencyMs).toBeGreaterThan(0);
    expect(plan.reasoning).toBe("The user wants to find the best yield");
  });

  it("filters out unknown agents from the plan", async () => {
    const { aiComplete } = await import("@/lib/ai.js");
    vi.mocked(aiComplete).mockResolvedValue({
      text: JSON.stringify({
        reasoning: "Test",
        steps: [
          { agentId: "defi-yield-farmer", task: "Real agent", dependsOn: [], priority: 1 },
          { agentId: "nonexistent-agent-xyz", task: "Fake agent", dependsOn: [], priority: 2 },
        ],
      }),
      provider: "groq",
      model: "llama-3.3-70b",
    });

    const plan = await planWorkflow("Test question");
    // Only the real agent should remain
    expect(plan.agentsUsed).toContain("defi-yield-farmer");
    expect(plan.agentsUsed).not.toContain("nonexistent-agent-xyz");
  });

  it("throws OrchestratorError when AI returns no valid JSON", async () => {
    const { aiComplete } = await import("@/lib/ai.js");
    vi.mocked(aiComplete).mockResolvedValue({
      text: "I'm sorry, I can't help with that.",
      provider: "groq",
      model: "llama-3.3-70b",
    });

    await expect(planWorkflow("garbage")).rejects.toThrow(OrchestratorError);
  });

  it("strips invalid dependency references from steps", async () => {
    const { aiComplete } = await import("@/lib/ai.js");
    vi.mocked(aiComplete).mockResolvedValue({
      text: JSON.stringify({
        reasoning: "Test deps",
        steps: [
          { agentId: "defi-yield-farmer", task: "Task A", dependsOn: ["unknown-dep"], priority: 1 },
        ],
      }),
      provider: "groq",
      model: "llama-3.3-70b",
    });

    const plan = await planWorkflow("Test deps");
    // The unknown dependency should be stripped
    expect(plan.steps[0].dependsOn).toEqual([]);
  });

  it("limits to 5 agents maximum", async () => {
    const { aiComplete } = await import("@/lib/ai.js");
    const capabilities = buildAgentCapabilities();
    const manySteps = capabilities.slice(0, 8).map((c) => ({
      agentId: c.id,
      task: `Task for ${c.id}`,
      dependsOn: [],
      priority: 1,
    }));

    vi.mocked(aiComplete).mockResolvedValue({
      text: JSON.stringify({ reasoning: "Many agents", steps: manySteps }),
      provider: "groq",
      model: "llama-3.3-70b",
    });

    const plan = await planWorkflow("Complex multi-agent question");
    expect(plan.steps.length).toBeLessThanOrEqual(5);
  });
});

// ─── executeWorkflow ─────────────────────────────────────────

describe("executeWorkflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("executes a simple plan and returns synthesis", async () => {
    const { aiComplete } = await import("@/lib/ai.js");
    let callNumber = 0;

    vi.mocked(aiComplete).mockImplementation(async () => {
      callNumber++;
      if (callNumber <= 2) {
        // Agent steps
        return {
          text: `Agent analysis ${callNumber}: some detailed analysis here.`,
          provider: "groq",
          model: "llama-3.3-70b",
          tokensUsed: 300,
        };
      }
      // Synthesis step
      return {
        text: "Based on the analyses, here is the unified recommendation...",
        provider: "groq",
        model: "llama-3.3-70b",
        tokensUsed: 500,
      };
    });

    const plan: WorkflowPlan = {
      id: "wf-test-1",
      question: "Test question?",
      steps: [
        { agentId: "defi-yield-farmer", task: "Find yields", dependsOn: [], priority: 1 },
        { agentId: "gas-optimization-expert", task: "Check gas", dependsOn: [], priority: 1 },
      ],
      reasoning: "Test",
      estimatedLatencyMs: 20_000,
      agentsUsed: ["defi-yield-farmer", "gas-optimization-expert"],
    };

    const result = await executeWorkflow(plan);

    expect(result.planId).toBe("wf-test-1");
    expect(result.question).toBe("Test question?");
    expect(result.steps).toHaveLength(2);
    expect(result.synthesis).toBeTruthy();
    expect(result.totalLatencyMs).toBeGreaterThan(0);
    expect(result.agentsUsed).toHaveLength(2);
    expect(result.failedAgents).toHaveLength(0);
  });

  it("handles agent failures gracefully", async () => {
    const { aiComplete } = await import("@/lib/ai.js");
    let callNumber = 0;

    vi.mocked(aiComplete).mockImplementation(async () => {
      callNumber++;
      if (callNumber === 1) {
        throw new Error("Agent 1 failed");
      }
      if (callNumber === 2) {
        return {
          text: "Successful agent analysis.",
          provider: "groq",
          model: "llama-3.3-70b",
        };
      }
      // Synthesis
      return {
        text: "Synthesis with partial data.",
        provider: "groq",
        model: "llama-3.3-70b",
      };
    });

    const plan: WorkflowPlan = {
      id: "wf-test-partial",
      question: "Partial failure test",
      steps: [
        { agentId: "defi-yield-farmer", task: "Fail", dependsOn: [], priority: 1 },
        { agentId: "gas-optimization-expert", task: "Succeed", dependsOn: [], priority: 1 },
      ],
      reasoning: "Test",
      estimatedLatencyMs: 10_000,
      agentsUsed: ["defi-yield-farmer", "gas-optimization-expert"],
    };

    const result = await executeWorkflow(plan);

    // Should still complete with the successful agent
    expect(result.failedAgents).toContain("defi-yield-farmer");
    expect(result.steps.find((s) => s.agentId === "defi-yield-farmer")?.status).toBe("failed");
    expect(result.steps.find((s) => s.agentId === "gas-optimization-expert")?.status).toBe("completed");
    expect(result.synthesis).toBeTruthy();
  });

  it("returns failure message when all agents fail", async () => {
    const { aiComplete } = await import("@/lib/ai.js");
    vi.mocked(aiComplete).mockRejectedValue(new Error("All down"));

    const plan: WorkflowPlan = {
      id: "wf-test-alldown",
      question: "All fail test",
      steps: [
        { agentId: "defi-yield-farmer", task: "Fail", dependsOn: [], priority: 1 },
      ],
      reasoning: "Test",
      estimatedLatencyMs: 10_000,
      agentsUsed: ["defi-yield-farmer"],
    };

    const result = await executeWorkflow(plan);

    expect(result.failedAgents).toContain("defi-yield-farmer");
    expect(result.synthesis).toContain("failed");
    expect(result.synthesisModel).toBe("none");
  });

  it("executes dependency-ordered steps sequentially across levels", async () => {
    const { aiComplete } = await import("@/lib/ai.js");
    const executionOrder: string[] = [];

    vi.mocked(aiComplete).mockImplementation(async (_sys, user) => {
      // Extract which agent is running from the prompt
      if (user.includes("Find yields")) {
        executionOrder.push("yield");
      } else if (user.includes("Check gas")) {
        executionOrder.push("gas");
      } else {
        executionOrder.push("synthesis");
      }
      return {
        text: "Analysis complete.",
        provider: "groq",
        model: "llama-3.3-70b",
      };
    });

    const plan: WorkflowPlan = {
      id: "wf-test-order",
      question: "Order test",
      steps: [
        { agentId: "defi-yield-farmer", task: "Find yields", dependsOn: [], priority: 1 },
        { agentId: "gas-optimization-expert", task: "Check gas", dependsOn: ["defi-yield-farmer"], priority: 2 },
      ],
      reasoning: "Test ordering",
      estimatedLatencyMs: 20_000,
      agentsUsed: ["defi-yield-farmer", "gas-optimization-expert"],
    };

    await executeWorkflow(plan);

    // Yield farmer must run before gas optimizer
    const yieldIdx = executionOrder.indexOf("yield");
    const gasIdx = executionOrder.indexOf("gas");
    expect(yieldIdx).toBeLessThan(gasIdx);
  });
});

// ─── OrchestratorError ───────────────────────────────────────

describe("OrchestratorError", () => {
  it("has correct name and status", () => {
    const err = new OrchestratorError("test error");
    expect(err.name).toBe("OrchestratorError");
    expect(err.status).toBe(500);
    expect(err.message).toBe("test error");
  });
});
