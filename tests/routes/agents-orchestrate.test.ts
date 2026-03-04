/**
 * Integration tests for agent orchestration routes:
 *
 * POST /api/agents/orchestrate — Multi-agent workflow execution
 * GET  /api/agents/orchestrate/templates — List workflow templates
 * GET  /api/agents/discover — Semantic agent discovery
 *
 * All AI / BigQuery calls are mocked — no live API traffic.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Mock dependencies BEFORE importing routes ──────────────

vi.mock("@/lib/ai.js", () => ({
  aiComplete: vi.fn(),
  aiCompleteJSON: vi.fn(),
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
  heavyFetchQueue: {
    execute: vi.fn(async (fn: () => Promise<unknown>) => fn()),
  },
  QueueFullError: class QueueFullError extends Error {
    status = 503;
    constructor(max: number) {
      super(`Service busy — ${max} requests queued. Try again shortly.`);
      this.name = "QueueFullError";
    }
  },
}));

vi.mock("@/lib/bigquery.js", () => ({
  insertRows: vi.fn(async () => undefined),
}));

vi.mock("@/sources/coingecko.js", () => ({
  getGlobal: vi.fn(async () => null),
  getTrending: vi.fn(async () => ({ coins: [] })),
  getCoins: vi.fn(async () => []),
  getCoinDetail: vi.fn(async () => ({})),
  getPrice: vi.fn(async () => ({})),
  searchCoins: vi.fn(async () => []),
  getMarketChart: vi.fn(async () => ({})),
  getOHLC: vi.fn(async () => []),
  getExchanges: vi.fn(async () => []),
  getCategories: vi.fn(async () => []),
}));

vi.mock("@/sources/defillama.js", () => ({
  getProtocols: vi.fn(async () => []),
  getYieldPools: vi.fn(async () => ({ data: [] })),
  getStablecoins: vi.fn(async () => ({ peggedAssets: [] })),
}));

vi.mock("@/sources/alternative.js", () => ({
  getFearGreedIndex: vi.fn(async () => ({ data: [] })),
  getBitcoinFees: vi.fn(async () => null),
  getBitcoinHashrate: vi.fn(async () => null),
}));

vi.mock("@/lib/embeddings.js", () => ({
  generateEmbedding: vi.fn(async () => new Array(768).fill(0.1)),
  EMBEDDING_DIMENSION: 768,
}));

vi.mock("@/lib/vector-store.js", () => ({
  vectorStore: {
    upsert: vi.fn(async () => undefined),
    search: vi.fn(async () => [
      {
        id: "capability:defi-yield-farmer",
        content: "DeFi Yield Farmer: Finds yield farming opportunities",
        score: 0.92,
        metadata: {
          category: "agent-capability",
          agentId: "defi-yield-farmer",
          name: "DeFi Yield Farmer",
          domains: "defi,yields,farming",
          dataAccess: "defillama,aave",
        },
      },
    ]),
    delete: vi.fn(async () => undefined),
  },
}));

import { aiComplete } from "@/lib/ai.js";
import { agentsRoutes } from "@/routes/agents.js";
import { Hono } from "hono";

const app = new Hono();
app.route("/api/agents", agentsRoutes);

// ─── Helpers ─────────────────────────────────────────────────

function mockAIForOrchestration(): void {
  let callNumber = 0;

  vi.mocked(aiComplete).mockImplementation(async () => {
    callNumber++;

    // First call: planner
    if (callNumber === 1) {
      return {
        text: JSON.stringify({
          reasoning: "User asking about yield, need yield + gas agents",
          steps: [
            {
              agentId: "defi-yield-farmer",
              task: "Find the best yield farming opportunities for ETH",
              dependsOn: [],
              priority: 1,
            },
            {
              agentId: "gas-optimization-expert",
              task: "Calculate optimal gas timing for deployment",
              dependsOn: ["defi-yield-farmer"],
              priority: 2,
            },
          ],
        }),
        provider: "groq",
        model: "llama-3.3-70b",
        tokensUsed: 400,
      };
    }

    // Middle calls: agent steps
    if (callNumber <= 3) {
      return {
        text: `Expert analysis ${callNumber - 1}: Detailed findings about the user's question with specific data points and actionable recommendations.`,
        provider: "groq",
        model: "llama-3.3-70b",
        tokensUsed: 600,
      };
    }

    // Final call: synthesis
    return {
      text: "## Unified Analysis\n\nBased on our multi-agent analysis, here are the key findings and recommendations:\n\n1. **Best Yields**: Aave on Arbitrum offers 4.2% APY on ETH\n2. **Gas Optimization**: Deploy during weekends for 30% lower fees\n\n### Recommendation\nMove ETH to Arbitrum Aave for optimal risk-adjusted yield.",
      provider: "groq",
      model: "llama-3.3-70b",
      tokensUsed: 800,
    };
  });
}

// ─── POST /api/agents/orchestrate ────────────────────────────

describe("POST /api/agents/orchestrate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a synthesized multi-agent response", async () => {
    mockAIForOrchestration();

    const res = await app.request("/api/agents/orchestrate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: "Where can I get the best yield on my ETH?",
      }),
    });

    expect(res.status).toBe(200);
    const json = (await res.json()) as Record<string, any>;
    expect(json.data).toBeDefined();
    expect(json.data.answer).toBeTruthy();
    expect(json.data.answer).toContain("Unified Analysis");
    expect(json.data.agentsUsed).toBeInstanceOf(Array);
    expect(json.data.agentsUsed.length).toBeGreaterThan(0);
    expect(json.data.workflow).toBeDefined();
    expect(json.data.workflow.planId).toMatch(/^wf-/);
    expect(json.data.workflow.stepsExecuted).toBeGreaterThan(0);
    expect(json.timestamp).toBeTruthy();
  });

  it("accepts a template parameter", async () => {
    let callNumber = 0;
    vi.mocked(aiComplete).mockImplementation(async () => {
      callNumber++;
      if (callNumber <= 4) {
        return {
          text: `Agent analysis ${callNumber}: Detailed risk findings.`,
          provider: "groq",
          model: "llama-3.3-70b",
          tokensUsed: 500,
        };
      }
      return {
        text: "## Risk Assessment Summary\n\nThe protocol appears to have moderate risk.",
        provider: "groq",
        model: "llama-3.3-70b",
        tokensUsed: 700,
      };
    });

    const res = await app.request("/api/agents/orchestrate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: "How risky is Aave on Arbitrum?",
        template: "risk-assessment",
      }),
    });

    expect(res.status).toBe(200);
    const json = (await res.json()) as Record<string, any>;
    expect(json.data.answer).toBeTruthy();
    expect(json.data.workflow.templateUsed).toBe("risk-assessment");
    // Risk assessment template has 4 agents
    expect(json.data.workflow.stepsExecuted).toBe(4);
  });

  it("accepts optional context parameter", async () => {
    mockAIForOrchestration();

    const res = await app.request("/api/agents/orchestrate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: "Should I rebalance?",
        context: "I have 5 ETH on Ethereum mainnet and 10,000 USDC on Arbitrum",
      }),
    });

    expect(res.status).toBe(200);
    const json = (await res.json()) as Record<string, any>;
    expect(json.data.answer).toBeTruthy();
  });

  it("returns 400 when question is missing", async () => {
    const res = await app.request("/api/agents/orchestrate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
  });

  it("returns 400 when question is empty", async () => {
    const res = await app.request("/api/agents/orchestrate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: "" }),
    });

    expect(res.status).toBe(400);
  });

  it("returns 400 when question exceeds max length", async () => {
    const res = await app.request("/api/agents/orchestrate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: "x".repeat(2001) }),
    });

    expect(res.status).toBe(400);
  });

  it("returns 404 for unknown template ID", async () => {
    const res = await app.request("/api/agents/orchestrate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: "Test",
        template: "nonexistent-template",
      }),
    });

    // Should return 404 specifically for unknown templates
    expect(res.status).toBe(404);
  });

  it("returns agent-level details in response", async () => {
    mockAIForOrchestration();

    const res = await app.request("/api/agents/orchestrate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: "Best yield for USDC?",
      }),
    });

    expect(res.status).toBe(200);
    const json = (await res.json()) as Record<string, any>;

    // Each agent entry should have id and status
    for (const agent of json.data.agentsUsed) {
      expect(agent.id).toBeTruthy();
      expect(agent.status).toBeDefined();
    }

    // Workflow metadata should be present
    expect(json.data.workflow.totalLatencyMs).toBeGreaterThanOrEqual(0);
  });

  it("handles all 4 templates via template parameter", async () => {
    const templates = [
      "yield-optimization",
      "chain-migration",
      "risk-assessment",
      "portfolio-rebalance",
    ];

    for (const template of templates) {
      vi.clearAllMocks();

      let callNumber = 0;
      vi.mocked(aiComplete).mockImplementation(async () => {
        callNumber++;
        if (callNumber <= 5) {
          return {
            text: `Analysis ${callNumber} for ${template}`,
            provider: "groq",
            model: "llama-3.3-70b",
            tokensUsed: 300,
          };
        }
        return {
          text: `Synthesis for ${template}`,
          provider: "groq",
          model: "llama-3.3-70b",
          tokensUsed: 500,
        };
      });

      const res = await app.request("/api/agents/orchestrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: `Test question for ${template}`,
          template,
        }),
      });

      expect(res.status).toBe(200);
      const json = (await res.json()) as Record<string, any>;
      expect(json.data.answer).toBeTruthy();
      expect(json.data.workflow.templateUsed).toBe(template);
    }
  });
});

// ─── GET /api/agents/orchestrate/templates ───────────────────

describe("GET /api/agents/orchestrate/templates", () => {
  it("returns all 4 workflow templates", async () => {
    const res = await app.request("/api/agents/orchestrate/templates");

    expect(res.status).toBe(200);
    const json = (await res.json()) as Record<string, any>;
    expect(json.data).toHaveLength(4);
    expect(json.timestamp).toBeTruthy();
  });

  it("each template has required metadata", async () => {
    const res = await app.request("/api/agents/orchestrate/templates");
    const json = (await res.json()) as Record<string, any>;

    for (const template of json.data) {
      expect(template.id).toBeTruthy();
      expect(template.name).toBeTruthy();
      expect(template.description).toBeTruthy();
      expect(template.exampleQuestions).toBeInstanceOf(Array);
      expect(template.exampleQuestions.length).toBeGreaterThan(0);
      expect(template.agentCount).toBeGreaterThanOrEqual(2);
    }
  });

  it("includes all expected template IDs", async () => {
    const res = await app.request("/api/agents/orchestrate/templates");
    const json = (await res.json()) as Record<string, any>;
    const ids = json.data.map((t: { id: string }) => t.id);

    expect(ids).toContain("yield-optimization");
    expect(ids).toContain("chain-migration");
    expect(ids).toContain("risk-assessment");
    expect(ids).toContain("portfolio-rebalance");
  });
});

// ─── GET /api/agents/discover ────────────────────────────────

describe("GET /api/agents/discover", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns matching agents for a query", async () => {
    const res = await app.request("/api/agents/discover?q=yield+farming");

    expect(res.status).toBe(200);
    const json = (await res.json()) as Record<string, any>;
    expect(json.data).toBeInstanceOf(Array);
    expect(json.data.length).toBeGreaterThan(0);
    expect(json.query).toBe("yield farming");
    expect(json.count).toBeGreaterThan(0);
  });

  it("returns 400 when q parameter is missing", async () => {
    const res = await app.request("/api/agents/discover");

    expect(res.status).toBe(400);
  });

  it("respects limit parameter", async () => {
    const res = await app.request("/api/agents/discover?q=defi&limit=3");

    expect(res.status).toBe(200);
    const json = (await res.json()) as Record<string, any>;
    expect(json.data.length).toBeLessThanOrEqual(3);
  });

  it("each result has agent match fields", async () => {
    const res = await app.request("/api/agents/discover?q=bridge+security");

    expect(res.status).toBe(200);
    const json = (await res.json()) as Record<string, any>;

    for (const agent of json.data) {
      expect(agent.agentId).toBeTruthy();
      expect(agent.name).toBeTruthy();
    }
  });
});
