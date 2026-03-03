/**
 * Integration tests for AI Agents routes.
 *
 * Mocks the AI, cache, queue, validation, and data source modules.
 */

import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Mock sources and libs BEFORE importing routes ───────────

vi.mock("../../lib/ai.js", () => ({
    aiComplete: vi.fn(),
    isAIConfigured: vi.fn().mockReturnValue(true),
    getConfiguredProviders: vi.fn().mockReturnValue(["openrouter"]),
}));

vi.mock("../../lib/cache.js", () => ({
    cache: { get: vi.fn(), set: vi.fn() },
}));

vi.mock("../../lib/queue.js", () => {
    class QueueFullError extends Error {
        constructor(message: string) {
            super(message);
            this.name = "QueueFullError";
        }
    }
    return {
        aiQueue: {
            execute: vi.fn((fn: () => Promise<any>) => fn()),
        },
        QueueFullError,
    };
});

vi.mock("../../lib/logger.js", () => ({
    log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("../../lib/api-error.js", async (importOriginal) => {
    const actual = await importOriginal<typeof import("../../lib/api-error.js")>();
    return { ...actual };
});

vi.mock("../../lib/validation.js", async (importOriginal) => {
    const actual = await importOriginal<typeof import("../../lib/validation.js")>();
    return { ...actual };
});

vi.mock("../../sources/coingecko.js", () => ({
    getGlobal: vi.fn().mockResolvedValue({ data: { total_market_cap: { usd: 2.5e12 }, market_cap_change_percentage_24h_usd: 1.5, market_cap_percentage: { btc: 52 } } }),
    getTrending: vi.fn().mockResolvedValue({ coins: [{ item: { name: "Bitcoin" } }] }),
}));

vi.mock("../../sources/defillama.js", () => ({
    getProtocols: vi.fn().mockResolvedValue([]),
    getYieldPools: vi.fn().mockResolvedValue({ data: [] }),
    getStablecoins: vi.fn().mockResolvedValue({ peggedAssets: [] }),
}));

vi.mock("../../sources/alternative.js", () => ({
    getFearGreedIndex: vi.fn().mockResolvedValue({ data: [{ value: "70", value_classification: "Greed" }] }),
    getBitcoinFees: vi.fn().mockResolvedValue({ fastestFee: 20, hourFee: 10 }),
    getBitcoinHashrate: vi.fn().mockResolvedValue({ currentHashrate: "500 EH/s", currentDifficulty: "80T" }),
}));

// Mock fs for agent loading
vi.mock("node:fs", async (importOriginal) => {
    const actual = await importOriginal<typeof import("node:fs")>();
    return {
        ...actual,
        readdirSync: vi.fn().mockReturnValue(["test-agent.json", "defi-yield-farmer.json"]),
        readFileSync: vi.fn().mockImplementation((path: string) => {
            if (path.includes("test-agent")) {
                return JSON.stringify({
                    identifier: "test-agent",
                    meta: {
                        title: "Test Agent",
                        description: "A test agent for unit testing",
                        avatar: "🤖",
                        tags: ["test", "debug"],
                        category: "general",
                    },
                    config: {
                        systemRole: "You are a test agent that helps with general questions about crypto.",
                        openingMessage: "Hello! I'm a test agent.",
                        openingQuestions: ["What is Bitcoin?", "How does DeFi work?"],
                    },
                    author: "test",
                    createdAt: "2026-01-01T00:00:00Z",
                });
            }
            if (path.includes("defi-yield-farmer")) {
                return JSON.stringify({
                    identifier: "defi-yield-farmer",
                    meta: {
                        title: "DeFi Yield Farmer",
                        description: "Expert in yield farming strategies across DeFi protocols",
                        avatar: "🌾",
                        tags: ["defi", "yield", "farming"],
                        category: "defi",
                    },
                    config: {
                        systemRole: "You are an expert DeFi yield farming advisor...",
                        openingMessage: "Ready to optimize your yields!",
                        openingQuestions: ["Best yield strategies?", "How to minimize IL?"],
                    },
                    author: "team",
                    createdAt: "2026-01-15T00:00:00Z",
                });
            }
            throw new Error("File not found");
        }),
    };
});

import * as ai from "../../lib/ai.js";
import { aiQueue, QueueFullError } from "../../lib/queue.js";
import { agentsRoutes } from "../agents.js";

const app = new Hono().route("/api/agents", agentsRoutes);

beforeEach(() => {
    vi.clearAllMocks();
    // Reset defaults after clearing
    vi.mocked(ai.isAIConfigured).mockReturnValue(true);
    vi.mocked(ai.getConfiguredProviders).mockReturnValue(["openrouter"] as any);
});

// ═══════════════════════════════════════════════════════════════
// GET /api/agents — List all agents
// ═══════════════════════════════════════════════════════════════

describe("GET /api/agents", () => {
    it("returns all loaded agents", async () => {
        const res = await app.request("/api/agents");
        expect(res.status).toBe(200);

        const json = await res.json();
        expect(json.data).toBeInstanceOf(Array);
        expect(json.count).toBeGreaterThanOrEqual(2);
        expect(json.aiConfigured).toBe(true);
        expect(json.providers).toContain("openrouter");
        expect(json).toHaveProperty("timestamp");

        const testAgent = json.data.find((a: any) => a.id === "test-agent");
        expect(testAgent).toBeDefined();
        expect(testAgent.title).toBe("Test Agent");
        expect(testAgent.tags).toContain("test");
        expect(testAgent.openingQuestions).toHaveLength(2);
    });

    it("shows AI not configured when no providers", async () => {
        vi.mocked(ai.isAIConfigured).mockReturnValue(false);
        vi.mocked(ai.getConfiguredProviders).mockReturnValue([] as any);

        const res = await app.request("/api/agents");
        expect(res.status).toBe(200);

        const json = await res.json();
        expect(json.aiConfigured).toBe(false);
        expect(json.providers).toHaveLength(0);
    });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/agents/categories
// ═══════════════════════════════════════════════════════════════

describe("GET /api/agents/categories", () => {
    it("returns agent categories with counts", async () => {
        const res = await app.request("/api/agents/categories");
        expect(res.status).toBe(200);

        const json = await res.json();
        expect(json.data).toBeInstanceOf(Array);
        expect(json.data.length).toBeGreaterThan(0);
        expect(json.data[0]).toHaveProperty("name");
        expect(json.data[0]).toHaveProperty("count");
        expect(json).toHaveProperty("timestamp");
    });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/agents/search
// ═══════════════════════════════════════════════════════════════

describe("GET /api/agents/search", () => {
    it("returns matching agents for search query", async () => {
        const res = await app.request("/api/agents/search?q=test");
        expect(res.status).toBe(200);

        const json = await res.json();
        expect(json.data).toBeInstanceOf(Array);
        expect(json.count).toBeGreaterThanOrEqual(1);
        expect(json.query).toBe("test");

        const testAgent = json.data.find((a: any) => a.id === "test-agent");
        expect(testAgent).toBeDefined();
    });

    it("returns matching agents by tag", async () => {
        const res = await app.request("/api/agents/search?q=defi");
        expect(res.status).toBe(200);

        const json = await res.json();
        expect(json.data.some((a: any) => a.id === "defi-yield-farmer")).toBe(true);
    });

    it("returns 400 when q parameter missing", async () => {
        const res = await app.request("/api/agents/search");
        expect(res.status).toBe(400);
    });

    it("returns empty results for non-matching query", async () => {
        const res = await app.request("/api/agents/search?q=zzzznonexistent");
        expect(res.status).toBe(200);

        const json = await res.json();
        expect(json.count).toBe(0);
        expect(json.data).toHaveLength(0);
    });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/agents/:id — Agent detail
// ═══════════════════════════════════════════════════════════════

describe("GET /api/agents/:id", () => {
    it("returns agent detail", async () => {
        const res = await app.request("/api/agents/test-agent");
        expect(res.status).toBe(200);

        const json = await res.json();
        expect(json.data.id).toBe("test-agent");
        expect(json.data.title).toBe("Test Agent");
        expect(json.data.description).toBe("A test agent for unit testing");
        expect(json.data.author).toBe("test");
        expect(json.data.openingMessage).toBe("Hello! I'm a test agent.");
        expect(json.data.openingQuestions).toHaveLength(2);
        expect(json.data.systemRolePreview).toBeTruthy();
        expect(json).toHaveProperty("timestamp");
    });

    it("returns 404 for unknown agent", async () => {
        const res = await app.request("/api/agents/nonexistent-agent");
        expect(res.status).toBe(404);
    });
});

// ═══════════════════════════════════════════════════════════════
// POST /api/agents/:id/run — Execute agent task
// ═══════════════════════════════════════════════════════════════

describe("POST /api/agents/:id/run", () => {
    it("returns AI response for valid request", async () => {
        vi.mocked(ai.aiComplete).mockResolvedValue({
            text: "Bitcoin is a decentralized cryptocurrency...",
            provider: "openrouter",
            model: "anthropic/claude-3.5-sonnet",
            tokensUsed: 150,
        } as any);

        const res = await app.request("/api/agents/test-agent/run", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: "What is Bitcoin?" }),
        });
        expect(res.status).toBe(200);

        const json = await res.json();
        expect(json.data.agent).toBe("test-agent");
        expect(json.data.agentTitle).toBe("Test Agent");
        expect(json.data.response).toContain("Bitcoin");
        expect(json.data.provider).toBe("openrouter");
        expect(json.data.model).toBe("anthropic/claude-3.5-sonnet");
        expect(json.data.tokensUsed).toBe(150);
        expect(json).toHaveProperty("timestamp");
    });

    it("returns 404 for unknown agent", async () => {
        const res = await app.request("/api/agents/nonexistent/run", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: "test" }),
        });
        expect(res.status).toBe(404);
    });

    it("returns 503 when AI is not configured", async () => {
        vi.mocked(ai.isAIConfigured).mockReturnValue(false);

        const res = await app.request("/api/agents/test-agent/run", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: "test" }),
        });
        expect(res.status).toBe(503);
    });

    it("returns 400 for invalid request body (missing message)", async () => {
        const res = await app.request("/api/agents/test-agent/run", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}),
        });
        expect(res.status).toBe(400);
    });

    it("returns 400 for message that is too long", async () => {
        const res = await app.request("/api/agents/test-agent/run", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: "x".repeat(2001) }),
        });
        expect(res.status).toBe(400);
    });

    it("returns 503 when queue is full", async () => {
        vi.mocked(aiQueue.execute).mockRejectedValue(
            new QueueFullError(100),
        );

        const res = await app.request("/api/agents/test-agent/run", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: "What is Bitcoin?" }),
        });
        expect(res.status).toBe(503);
    });

    it("returns 500 for unexpected AI errors", async () => {
        vi.mocked(aiQueue.execute).mockRejectedValue(new Error("Unexpected AI error"));

        const res = await app.request("/api/agents/test-agent/run", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: "What is Bitcoin?" }),
        });
        expect(res.status).toBe(500);
    });
});

// ═══════════════════════════════════════════════════════════════
// POST /api/agents/multi — Multi-agent execution
// ═══════════════════════════════════════════════════════════════

describe("POST /api/agents/multi", () => {
    it("returns responses from multiple agents", async () => {
        vi.mocked(ai.aiComplete).mockResolvedValue({
            text: "Analysis response...",
            provider: "openrouter",
            model: "test-model",
            tokensUsed: 100,
        } as any);

        const res = await app.request("/api/agents/multi", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                agents: ["test-agent", "defi-yield-farmer"],
                message: "Analyze the current market",
            }),
        });
        expect(res.status).toBe(200);

        const json = await res.json();
        expect(json.data).toHaveLength(2);
        expect(json.data[0].status).toBe("fulfilled");
        expect(json.data[0].agent).toBe("test-agent");
        expect(json.data[0].response).toBeTruthy();
        expect(json).toHaveProperty("timestamp");
    });

    it("returns 503 when AI is not configured", async () => {
        vi.mocked(ai.isAIConfigured).mockReturnValue(false);

        const res = await app.request("/api/agents/multi", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                agents: ["test-agent"],
                message: "test",
            }),
        });
        expect(res.status).toBe(503);
    });

    it("returns 400 for invalid request body", async () => {
        const res = await app.request("/api/agents/multi", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: "test" }),
        });
        expect(res.status).toBe(400);
    });

    it("handles partial failures gracefully", async () => {
        vi.mocked(ai.aiComplete)
            .mockResolvedValueOnce({
                text: "Success response",
                provider: "openrouter",
                model: "test",
                tokensUsed: 50,
            } as any)
            .mockRejectedValueOnce(new Error("AI failed for this agent"));

        const res = await app.request("/api/agents/multi", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                agents: ["test-agent", "defi-yield-farmer"],
                message: "test query",
            }),
        });
        expect(res.status).toBe(200);

        const json = await res.json();
        expect(json.data).toHaveLength(2);
        // One should succeed, one should fail
        const fulfilled = json.data.filter((d: any) => d.status === "fulfilled");
        const rejected = json.data.filter((d: any) => d.status === "rejected");
        expect(fulfilled.length).toBe(1);
        expect(rejected.length).toBe(1);
        expect(rejected[0].error).toBeTruthy();
    });

    it("returns rejected for unknown agent IDs", async () => {
        const res = await app.request("/api/agents/multi", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                agents: ["nonexistent-agent"],
                message: "test",
            }),
        });
        expect(res.status).toBe(200);

        const json = await res.json();
        expect(json.data[0].status).toBe("rejected");
        expect(json.data[0].error).toContain("not found");
    });
});
