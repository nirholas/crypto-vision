/**
 * Integration tests for Governance routes.
 *
 * Mocks the Snapshot source adapter so no real HTTP calls are made.
 */

import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Mock sources BEFORE importing routes ────────────────────

vi.mock("../../sources/snapshot.js", () => ({
  getProposals: vi.fn(),
  getActiveProposals: vi.fn(),
  getTopSpaces: vi.fn(),
  getSpace: vi.fn(),
  getVotes: vi.fn(),
  searchSpaces: vi.fn(),
}));

import * as snapshot from "../../sources/snapshot.js";
import { governanceRoutes } from "../governance.js";

const app = new Hono().route("/api/governance", governanceRoutes);

beforeEach(() => {
  vi.clearAllMocks();
});

// ═══════════════════════════════════════════════════════════════
// GET /api/governance/proposals/:space
// ═══════════════════════════════════════════════════════════════

describe("GET /api/governance/proposals/:space", () => {
  it("returns proposals for a space", async () => {
    vi.mocked(snapshot.getProposals).mockResolvedValue([
      { id: "proposal1", title: "Upgrade V3", state: "active", scores_total: 100000 },
      { id: "proposal2", title: "Treasury Allocation", state: "closed", scores_total: 50000 },
    ] as any);

    const res = await app.request("/api/governance/proposals/aave.eth");
    expect(res.status).toBe(200);

    const json = (await res.json()) as Record<string, any>;
    expect(json.space).toBe("aave.eth");
    expect(json.count).toBe(2);
    expect(json.data).toHaveLength(2);
    expect(json.data[0].title).toBe("Upgrade V3");
  });

  it("passes limit and state parameters", async () => {
    vi.mocked(snapshot.getProposals).mockResolvedValue([] as any);

    await app.request("/api/governance/proposals/uniswap?limit=5&state=active");
    expect(snapshot.getProposals).toHaveBeenCalledWith("uniswap", "active", 5);
  });

  it("propagates source errors as 500", async () => {
    vi.mocked(snapshot.getProposals).mockRejectedValue(new Error("GraphQL error"));

    const res = await app.request("/api/governance/proposals/aave.eth");
    expect(res.status).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/governance/active
// ═══════════════════════════════════════════════════════════════

describe("GET /api/governance/active", () => {
  it("returns active proposals across DAOs", async () => {
    vi.mocked(snapshot.getActiveProposals).mockResolvedValue({
      "aave.eth": [{ id: "p1", title: "Aave Proposal", state: "active" }],
      "uniswap": [{ id: "p2", title: "Uni Proposal", state: "active" }],
    } as any);

    const res = await app.request("/api/governance/active");
    expect(res.status).toBe(200);

    const json = (await res.json()) as Record<string, any>;
    expect(json.count).toBe(2);
    expect(json.data).toHaveProperty("aave.eth");
    expect(json.data).toHaveProperty("uniswap");
    expect(json).toHaveProperty("timestamp");
  });

  it("propagates source errors as 500", async () => {
    vi.mocked(snapshot.getActiveProposals).mockRejectedValue(new Error("fail"));

    const res = await app.request("/api/governance/active");
    expect(res.status).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/governance/spaces
// ═══════════════════════════════════════════════════════════════

describe("GET /api/governance/spaces", () => {
  it("returns popular DAO spaces", async () => {
    vi.mocked(snapshot.getTopSpaces).mockResolvedValue([
      { id: "aave.eth", name: "Aave", members: 50000 },
      { id: "uniswap", name: "Uniswap", members: 40000 },
    ] as any);

    const res = await app.request("/api/governance/spaces?limit=10");
    expect(res.status).toBe(200);

    const json = (await res.json()) as Record<string, any>;
    expect(json.count).toBe(2);
    expect(json.data).toHaveLength(2);
    expect(snapshot.getTopSpaces).toHaveBeenCalledWith(10);
  });

  it("uses default limit", async () => {
    vi.mocked(snapshot.getTopSpaces).mockResolvedValue([] as any);

    await app.request("/api/governance/spaces");
    expect(snapshot.getTopSpaces).toHaveBeenCalledWith(20);
  });

  it("propagates source errors as 500", async () => {
    vi.mocked(snapshot.getTopSpaces).mockRejectedValue(new Error("fail"));

    const res = await app.request("/api/governance/spaces");
    expect(res.status).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/governance/space/:id
// ═══════════════════════════════════════════════════════════════

describe("GET /api/governance/space/:id", () => {
  it("returns space detail", async () => {
    vi.mocked(snapshot.getSpace).mockResolvedValue({
      id: "aave.eth",
      name: "Aave",
      about: "Decentralized lending protocol",
      members: 50000,
      strategies: [],
    } as any);

    const res = await app.request("/api/governance/space/aave.eth");
    expect(res.status).toBe(200);

    const json = (await res.json()) as Record<string, any>;
    expect(json.id).toBe("aave.eth");
    expect(json.name).toBe("Aave");
    expect(snapshot.getSpace).toHaveBeenCalledWith("aave.eth");
  });

  it("propagates source errors as 500", async () => {
    vi.mocked(snapshot.getSpace).mockRejectedValue(new Error("fail"));

    const res = await app.request("/api/governance/space/invalid");
    expect(res.status).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/governance/votes/:proposalId
// ═══════════════════════════════════════════════════════════════

describe("GET /api/governance/votes/:proposalId", () => {
  it("returns votes for a proposal", async () => {
    vi.mocked(snapshot.getVotes).mockResolvedValue([
      { voter: "0xabc", choice: 1, vp: 1000 },
      { voter: "0xdef", choice: 2, vp: 500 },
    ] as any);

    const res = await app.request("/api/governance/votes/proposal123?limit=50");
    expect(res.status).toBe(200);

    const json = (await res.json()) as Record<string, any>;
    expect(json.proposalId).toBe("proposal123");
    expect(json.count).toBe(2);
    expect(json.data).toHaveLength(2);
    expect(snapshot.getVotes).toHaveBeenCalledWith("proposal123", 50);
  });

  it("uses default limit of 100", async () => {
    vi.mocked(snapshot.getVotes).mockResolvedValue([] as any);

    await app.request("/api/governance/votes/p1");
    expect(snapshot.getVotes).toHaveBeenCalledWith("p1", 100);
  });

  it("propagates source errors as 500", async () => {
    vi.mocked(snapshot.getVotes).mockRejectedValue(new Error("fail"));

    const res = await app.request("/api/governance/votes/invalid");
    expect(res.status).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/governance/search
// ═══════════════════════════════════════════════════════════════

describe("GET /api/governance/search", () => {
  it("returns search results", async () => {
    vi.mocked(snapshot.searchSpaces).mockResolvedValue([
      { id: "aave.eth", name: "Aave", members: 50000 },
    ] as any);

    const res = await app.request("/api/governance/search?q=aave");
    expect(res.status).toBe(200);

    const json = (await res.json()) as Record<string, any>;
    expect(json.query).toBe("aave");
    expect(json.count).toBe(1);
    expect(json.data[0].name).toBe("Aave");
  });

  it("returns 400 when q parameter missing", async () => {
    const res = await app.request("/api/governance/search");
    expect(res.status).toBe(400);

    const json = (await res.json()) as Record<string, any>;
    expect(json.error).toContain("Missing");
  });

  it("propagates source errors as 500", async () => {
    vi.mocked(snapshot.searchSpaces).mockRejectedValue(new Error("fail"));

    const res = await app.request("/api/governance/search?q=test");
    expect(res.status).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/governance/top-spaces
// ═══════════════════════════════════════════════════════════════

describe("GET /api/governance/top-spaces", () => {
  it("returns top spaces with limit", async () => {
    vi.mocked(snapshot.getTopSpaces).mockResolvedValue([
      { id: "aave.eth", name: "Aave" },
    ] as any);

    const res = await app.request("/api/governance/top-spaces?limit=5");
    expect(res.status).toBe(200);

    const json = (await res.json()) as Record<string, any>;
    expect(json.count).toBe(1);
    expect(snapshot.getTopSpaces).toHaveBeenCalledWith(5);
  });

  it("propagates source errors as 500", async () => {
    vi.mocked(snapshot.getTopSpaces).mockRejectedValue(new Error("fail"));

    const res = await app.request("/api/governance/top-spaces");
    expect(res.status).toBe(500);
  });
});
