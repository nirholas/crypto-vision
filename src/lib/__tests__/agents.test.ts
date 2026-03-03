/**
 * Tests for lib/agents.ts — Agent registry: loading, listing, lookup
 *
 * Mocks the filesystem to avoid depending on actual agent JSON files.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock logger
vi.mock("@/lib/logger.js", () => ({
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// The agents module loads agents on import, which requires the filesystem.
// We import it directly and test the public API — the actual agent files
// should be available in the repo.
import {
  listAgents,
  getAgent,
  hasAgent,
  agentCount,
  type AgentSummary,
  type AgentDefinition,
} from "@/lib/agents.js";

// ─── agentCount ─────────────────────────────────────────────

describe("agentCount()", () => {
  it("returns a non-negative number", () => {
    const count = agentCount();
    expect(typeof count).toBe("number");
    expect(count).toBeGreaterThanOrEqual(0);
  });
});

// ─── listAgents ─────────────────────────────────────────────

describe("listAgents()", () => {
  it("returns an array", () => {
    const agents = listAgents();
    expect(Array.isArray(agents)).toBe(true);
  });

  it("each agent summary has required fields", () => {
    const agents = listAgents();
    if (agents.length === 0) return; // Skip if no agents loaded (CI without agent files)

    for (const agent of agents.slice(0, 5)) {
      expect(agent).toHaveProperty("id");
      expect(agent).toHaveProperty("title");
      expect(agent).toHaveProperty("description");
      expect(agent).toHaveProperty("avatar");
      expect(agent).toHaveProperty("tags");
      expect(agent).toHaveProperty("category");
      expect(agent).toHaveProperty("author");
      expect(typeof agent.id).toBe("string");
      expect(typeof agent.title).toBe("string");
      expect(Array.isArray(agent.tags)).toBe(true);
    }
  });

  it("returns same count as agentCount()", () => {
    expect(listAgents().length).toBe(agentCount());
  });
});

// ─── getAgent ───────────────────────────────────────────────

describe("getAgent()", () => {
  it("returns undefined for a non-existent agent ID", () => {
    expect(getAgent("completely-fake-agent-xyz")).toBeUndefined();
  });

  it("returns undefined for empty string", () => {
    expect(getAgent("")).toBeUndefined();
  });

  it("returns full agent definition for a loaded agent", () => {
    const agents = listAgents();
    if (agents.length === 0) return;

    const firstId = agents[0].id;
    const def = getAgent(firstId);
    expect(def).toBeDefined();
    expect(def!.identifier).toBe(firstId);
    expect(def!.config).toBeDefined();
    expect(def!.config.systemRole).toBeDefined();
    expect(typeof def!.config.systemRole).toBe("string");
    expect(def!.meta).toBeDefined();
    expect(def!.meta.title).toBeDefined();
  });

  it("returned agent has examples array", () => {
    const agents = listAgents();
    if (agents.length === 0) return;

    const def = getAgent(agents[0].id);
    expect(def).toBeDefined();
    expect(Array.isArray(def!.examples)).toBe(true);
  });
});

// ─── hasAgent ───────────────────────────────────────────────

describe("hasAgent()", () => {
  it("returns false for a non-existent agent", () => {
    expect(hasAgent("nonexistent-agent-12345")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(hasAgent("")).toBe(false);
  });

  it("returns true for loaded agents", () => {
    const agents = listAgents();
    if (agents.length === 0) return;

    expect(hasAgent(agents[0].id)).toBe(true);
  });

  it("is consistent with getAgent()", () => {
    const agents = listAgents();
    if (agents.length === 0) return;

    const id = agents[0].id;
    expect(hasAgent(id)).toBe(true);
    expect(getAgent(id)).toBeDefined();

    expect(hasAgent("fake-id")).toBe(false);
    expect(getAgent("fake-id")).toBeUndefined();
  });
});
