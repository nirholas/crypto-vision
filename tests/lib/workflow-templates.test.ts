/**
 * Tests for lib/workflow-templates.ts — Workflow template definitions
 *
 * Tests cover:
 *  - WORKFLOW_TEMPLATES (all 4 predefined templates are valid)
 *  - listTemplates (returns metadata for all templates)
 *  - getTemplate (retrieves by ID, returns undefined for unknown)
 *  - templateToPlan (converts template to executable plan)
 *  - Template step validation (agents exist, dependencies are valid)
 */

import { describe, it, expect } from "vitest";
import {
  WORKFLOW_TEMPLATES,
  listTemplates,
  getTemplate,
  templateToPlan,
} from "@/lib/workflow-templates.js";
import { buildAgentCapabilities } from "@/lib/orchestrator.js";
import { buildExecutionLevels } from "@/lib/orchestrator.js";

// ─── WORKFLOW_TEMPLATES ──────────────────────────────────────

describe("WORKFLOW_TEMPLATES", () => {
  it("has exactly 4 predefined templates", () => {
    expect(Object.keys(WORKFLOW_TEMPLATES)).toHaveLength(4);
  });

  it("contains all expected template IDs", () => {
    const ids = Object.keys(WORKFLOW_TEMPLATES);
    expect(ids).toContain("yield-optimization");
    expect(ids).toContain("chain-migration");
    expect(ids).toContain("risk-assessment");
    expect(ids).toContain("portfolio-rebalance");
  });

  it("each template has required fields", () => {
    for (const [id, template] of Object.entries(WORKFLOW_TEMPLATES)) {
      expect(template.id).toBe(id);
      expect(template.name).toBeTruthy();
      expect(template.description).toBeTruthy();
      expect(template.exampleQuestions.length).toBeGreaterThan(0);
      expect(template.steps.length).toBeGreaterThanOrEqual(2);
      expect(template.steps.length).toBeLessThanOrEqual(5);
    }
  });

  it("each template step has valid structure", () => {
    for (const template of Object.values(WORKFLOW_TEMPLATES)) {
      for (const step of template.steps) {
        expect(step.agentId).toBeTruthy();
        expect(step.task).toBeTruthy();
        expect(Array.isArray(step.dependsOn)).toBe(true);
        expect(typeof step.priority).toBe("number");
        expect(step.priority).toBeGreaterThan(0);
      }
    }
  });

  it("template dependencies reference valid step agentIds within same template", () => {
    for (const template of Object.values(WORKFLOW_TEMPLATES)) {
      const stepIds = new Set(template.steps.map((s) => s.agentId));
      for (const step of template.steps) {
        for (const dep of step.dependsOn) {
          expect(stepIds.has(dep)).toBe(true);
        }
      }
    }
  });

  it("template agents reference real agents from the registry", () => {
    const capabilities = buildAgentCapabilities();
    const knownIds = new Set(capabilities.map((c) => c.id));

    for (const template of Object.values(WORKFLOW_TEMPLATES)) {
      for (const step of template.steps) {
        expect(knownIds.has(step.agentId)).toBe(true);
      }
    }
  });

  it("no template has circular dependencies", () => {
    for (const template of Object.values(WORKFLOW_TEMPLATES)) {
      const levels = buildExecutionLevels(template.steps);
      const allAgents = levels.flat().map((s) => s.agentId);
      const templateAgents = template.steps.map((s) => s.agentId);
      // All agents should be present in the levels (no stuck agents)
      expect(allAgents.sort()).toEqual(templateAgents.sort());
    }
  });
});

// ─── listTemplates ───────────────────────────────────────────

describe("listTemplates", () => {
  it("returns all templates with summary metadata", () => {
    const list = listTemplates();
    expect(list).toHaveLength(4);

    for (const item of list) {
      expect(item.id).toBeTruthy();
      expect(item.name).toBeTruthy();
      expect(item.description).toBeTruthy();
      expect(item.exampleQuestions.length).toBeGreaterThan(0);
      expect(item.agentCount).toBeGreaterThanOrEqual(2);
    }
  });

  it("agentCount matches actual step count", () => {
    const list = listTemplates();
    for (const item of list) {
      const template = WORKFLOW_TEMPLATES[item.id];
      expect(item.agentCount).toBe(template.steps.length);
    }
  });
});

// ─── getTemplate ─────────────────────────────────────────────

describe("getTemplate", () => {
  it("returns template by ID", () => {
    const template = getTemplate("yield-optimization");
    expect(template).toBeDefined();
    expect(template!.id).toBe("yield-optimization");
    expect(template!.name).toBe("Yield Optimization Analysis");
  });

  it("returns undefined for unknown template ID", () => {
    const template = getTemplate("nonexistent-template");
    expect(template).toBeUndefined();
  });

  it("returns all 4 templates by their IDs", () => {
    for (const id of ["yield-optimization", "chain-migration", "risk-assessment", "portfolio-rebalance"]) {
      expect(getTemplate(id)).toBeDefined();
    }
  });
});

// ─── templateToPlan ──────────────────────────────────────────

describe("templateToPlan", () => {
  it("converts a template to a valid WorkflowPlan", () => {
    const plan = templateToPlan("yield-optimization", "Where to get best ETH yield?");
    expect(plan).not.toBeNull();
    expect(plan!.id).toMatch(/^wf-tpl-yield-optimization-/);
    expect(plan!.question).toBe("Where to get best ETH yield?");
    expect(plan!.steps).toHaveLength(4);
    expect(plan!.templateUsed).toBe("yield-optimization");
    expect(plan!.reasoning).toContain("Yield Optimization Analysis");
    expect(plan!.estimatedLatencyMs).toBeGreaterThan(0);
    expect(plan!.agentsUsed).toContain("defi-yield-farmer");
  });

  it("returns null for unknown template ID", () => {
    const plan = templateToPlan("nonexistent", "Test question");
    expect(plan).toBeNull();
  });

  it("preserves agent dependencies from template", () => {
    const plan = templateToPlan("chain-migration", "Should I bridge to Arbitrum?");
    expect(plan).not.toBeNull();

    // gas-optimization-expert depends on bridge-security-analyst
    const gasStep = plan!.steps.find((s) => s.agentId === "gas-optimization-expert");
    expect(gasStep).toBeDefined();
    expect(gasStep!.dependsOn).toContain("bridge-security-analyst");
  });

  it("generates unique plan IDs on each call", () => {
    const plan1 = templateToPlan("risk-assessment", "Q1");
    const plan2 = templateToPlan("risk-assessment", "Q2");
    expect(plan1!.id).not.toBe(plan2!.id);
  });

  it("all 4 templates produce valid plans", () => {
    for (const id of ["yield-optimization", "chain-migration", "risk-assessment", "portfolio-rebalance"]) {
      const plan = templateToPlan(id, `Test question for ${id}`);
      expect(plan).not.toBeNull();
      expect(plan!.steps.length).toBeGreaterThan(0);
      expect(plan!.agentsUsed.length).toBeGreaterThan(0);
      expect(plan!.estimatedLatencyMs).toBeGreaterThan(0);
      expect(plan!.templateUsed).toBe(id);
    }
  });

  it("agentsUsed matches step agent IDs", () => {
    const plan = templateToPlan("portfolio-rebalance", "Rebalance my crypto");
    expect(plan).not.toBeNull();
    const stepAgents = plan!.steps.map((s) => s.agentId);
    expect(plan!.agentsUsed).toEqual(stepAgents);
  });
});

// ─── Yield Optimization Template ─────────────────────────────

describe("yield-optimization template", () => {
  const template = WORKFLOW_TEMPLATES["yield-optimization"];

  it("starts with defi-yield-farmer (no dependencies)", () => {
    expect(template.steps[0].agentId).toBe("defi-yield-farmer");
    expect(template.steps[0].dependsOn).toEqual([]);
  });

  it("IL calculator and auditor depend on yield farmer", () => {
    const ilStep = template.steps.find((s) => s.agentId === "impermanent-loss-calculator");
    const auditStep = template.steps.find((s) => s.agentId === "smart-contract-auditor");
    expect(ilStep!.dependsOn).toContain("defi-yield-farmer");
    expect(auditStep!.dependsOn).toContain("defi-yield-farmer");
  });

  it("produces 3 execution levels", () => {
    const levels = buildExecutionLevels(template.steps);
    expect(levels).toHaveLength(3);
    // Level 0: yield farmer
    expect(levels[0]).toHaveLength(1);
    // Level 1: IL calculator + auditor (parallel)
    expect(levels[1]).toHaveLength(2);
    // Level 2: gas optimizer
    expect(levels[2]).toHaveLength(1);
  });
});

// ─── Chain Migration Template ────────────────────────────────

describe("chain-migration template", () => {
  const template = WORKFLOW_TEMPLATES["chain-migration"];

  it("has 2 independent root agents", () => {
    const roots = template.steps.filter((s) => s.dependsOn.length === 0);
    expect(roots).toHaveLength(2);
    const rootIds = roots.map((r) => r.agentId).sort();
    expect(rootIds).toEqual(["bridge-security-analyst", "layer-2-comparison-guide"]);
  });

  it("produces 2 execution levels", () => {
    const levels = buildExecutionLevels(template.steps);
    expect(levels).toHaveLength(2);
    // Level 0: 2 parallel root agents
    expect(levels[0]).toHaveLength(2);
    // Level 1: 2 dependent agents
    expect(levels[1]).toHaveLength(2);
  });
});

// ─── Risk Assessment Template ────────────────────────────────

describe("risk-assessment template", () => {
  const template = WORKFLOW_TEMPLATES["risk-assessment"];

  it("all agents are independent (no dependencies)", () => {
    for (const step of template.steps) {
      expect(step.dependsOn).toEqual([]);
    }
  });

  it("all execute in one parallel level", () => {
    const levels = buildExecutionLevels(template.steps);
    expect(levels).toHaveLength(1);
    expect(levels[0]).toHaveLength(4);
  });
});

// ─── Portfolio Rebalance Template ────────────────────────────

describe("portfolio-rebalance template", () => {
  const template = WORKFLOW_TEMPLATES["portfolio-rebalance"];

  it("stablecoin and tax agents depend on portfolio advisor", () => {
    const stableStep = template.steps.find((s) => s.agentId === "stablecoin-comparator");
    const taxStep = template.steps.find((s) => s.agentId === "crypto-tax-strategist");
    expect(stableStep!.dependsOn).toContain("portfolio-rebalancing-advisor");
    expect(taxStep!.dependsOn).toContain("portfolio-rebalancing-advisor");
  });

  it("produces 2 execution levels", () => {
    const levels = buildExecutionLevels(template.steps);
    expect(levels).toHaveLength(2);
    // Level 0: 2 root agents (portfolio advisor + narrative analyst)
    expect(levels[0]).toHaveLength(2);
    // Level 1: 2 dependent agents (stablecoin + tax)
    expect(levels[1]).toHaveLength(2);
  });
});
