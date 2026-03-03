/**
 * Integration tests for Layer 2 routes.
 *
 * Mocks the L2Beat source adapter so no real HTTP calls are made.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";

// ─── Mock sources BEFORE importing routes ────────────────────

vi.mock("../../sources/l2beat.js", () => ({
  getScalingSummary: vi.fn(),
  getScalingTvl: vi.fn(),
  getScalingActivity: vi.fn(),
}));

import * as l2 from "../../sources/l2beat.js";
import { l2Routes } from "../l2.js";

const app = new Hono().route("/api/l2", l2Routes);

beforeEach(() => {
  vi.clearAllMocks();
});

// ═══════════════════════════════════════════════════════════════
// GET /api/l2/summary
// ═══════════════════════════════════════════════════════════════

describe("GET /api/l2/summary", () => {
  it("returns sorted L2 projects by TVL", async () => {
    vi.mocked(l2.getScalingSummary).mockResolvedValue({
      projects: {
        arbitrum: {
          id: "arbitrum",
          name: "Arbitrum One",
          slug: "arbitrum",
          category: "Optimistic Rollup",
          provider: "Arbitrum",
          purposes: ["Universal"],
          stage: { stage: "Stage 1" },
          tvl: { value: 10e9, displayValue: "$10B", change: 2.5 },
        },
        optimism: {
          id: "optimism",
          name: "OP Mainnet",
          slug: "optimism",
          category: "Optimistic Rollup",
          provider: "OP Stack",
          purposes: ["Universal"],
          stage: { stage: "Stage 1" },
          tvl: { value: 5e9, displayValue: "$5B", change: -1.0 },
        },
        zeroTvl: {
          id: "zeroTvl",
          name: "Zero TVL",
          slug: "zero",
          category: "ZK Rollup",
          purposes: [],
          tvl: { value: 0, displayValue: "$0", change: 0 },
        },
      },
    } as any);

    const res = await app.request("/api/l2/summary");
    expect(res.status).toBe(200);

    const json = await res.json();
    // Zero TVL project filtered out
    expect(json.data).toHaveLength(2);
    // Arbitrum first (higher TVL)
    expect(json.data[0].name).toBe("Arbitrum One");
    expect(json.data[0].tvl).toBe(10e9);
    expect(json.data[0].stage).toBe("Stage 1");
    expect(json.data[1].name).toBe("OP Mainnet");
    expect(json.count).toBe(2);
    expect(json.totalTvl).toBe(15e9);
    expect(json).toHaveProperty("timestamp");
  });

  it("propagates source errors as 500", async () => {
    vi.mocked(l2.getScalingSummary).mockRejectedValue(new Error("L2Beat down"));

    const res = await app.request("/api/l2/summary");
    expect(res.status).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/l2/tvl
// ═══════════════════════════════════════════════════════════════

describe("GET /api/l2/tvl", () => {
  it("returns TVL breakdown with history", async () => {
    vi.mocked(l2.getScalingTvl).mockResolvedValue({
      projects: {
        arbitrum: {
          charts: {
            daily: {
              data: [
                [1709400000, 6e9, 2e9, 2e9],
                [1709486400, 6.5e9, 2.1e9, 2.2e9],
              ],
            },
          },
        },
        base: {
          charts: {
            daily: {
              data: [
                [1709400000, 3e9, 1e9, 0.5e9],
                [1709486400, 3.2e9, 1.1e9, 0.6e9],
              ],
            },
          },
        },
      },
    } as any);

    const res = await app.request("/api/l2/tvl");
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.data).toHaveLength(2);
    // Arbitrum first (higher total TVL)
    expect(json.data[0].id).toBe("arbitrum");
    expect(json.data[0].total).toBe(6.5e9 + 2.1e9 + 2.2e9);
    expect(json.data[0].canonical).toBe(6.5e9);
    expect(json.data[0].external).toBe(2.1e9);
    expect(json.data[0].native).toBe(2.2e9);
    expect(json).toHaveProperty("timestamp");
  });

  it("respects limit parameter", async () => {
    const projects: Record<string, any> = {};
    for (let i = 0; i < 5; i++) {
      projects[`project${i}`] = {
        charts: {
          daily: {
            data: [[1709486400, (5 - i) * 1e9, 1e9, 1e9]],
          },
        },
      };
    }
    vi.mocked(l2.getScalingTvl).mockResolvedValue({ projects } as any);

    const res = await app.request("/api/l2/tvl?limit=2");
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.data).toHaveLength(2);
  });

  it("filters out zero-TVL projects", async () => {
    vi.mocked(l2.getScalingTvl).mockResolvedValue({
      projects: {
        empty: { charts: { daily: { data: [[1709486400, 0, 0, 0]] } } },
        hasValue: { charts: { daily: { data: [[1709486400, 1e9, 0, 0]] } } },
      },
    } as any);

    const res = await app.request("/api/l2/tvl");
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.data).toHaveLength(1);
    expect(json.data[0].id).toBe("hasValue");
  });

  it("propagates source errors as 500", async () => {
    vi.mocked(l2.getScalingTvl).mockRejectedValue(new Error("API error"));

    const res = await app.request("/api/l2/tvl");
    expect(res.status).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/l2/activity
// ═══════════════════════════════════════════════════════════════

describe("GET /api/l2/activity", () => {
  it("returns sorted activity data", async () => {
    vi.mocked(l2.getScalingActivity).mockResolvedValue({
      projects: {
        arbitrum: {
          daily: {
            data: [
              [1709400000, 500000, 600000],
              [1709486400, 550000, 650000],
            ],
          },
        },
        base: {
          daily: {
            data: [
              [1709400000, 1000000, 1200000],
              [1709486400, 1100000, 1300000],
            ],
          },
        },
      },
    } as any);

    const res = await app.request("/api/l2/activity");
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.data).toHaveLength(2);
    // Base first (higher tx count)
    expect(json.data[0].id).toBe("base");
    expect(json.data[0].txCount24h).toBe(1100000);
    expect(json.data[0].uopsCount24h).toBe(1300000);
    expect(json.data[0].historyDays7).toHaveLength(2);
    expect(json).toHaveProperty("timestamp");
  });

  it("respects limit parameter", async () => {
    const projects: Record<string, any> = {};
    for (let i = 0; i < 5; i++) {
      projects[`l2_${i}`] = {
        daily: { data: [[1709486400, (5 - i) * 100000, (5 - i) * 120000]] },
      };
    }
    vi.mocked(l2.getScalingActivity).mockResolvedValue({ projects } as any);

    const res = await app.request("/api/l2/activity?limit=3");
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.data).toHaveLength(3);
  });

  it("propagates source errors as 500", async () => {
    vi.mocked(l2.getScalingActivity).mockRejectedValue(new Error("fail"));

    const res = await app.request("/api/l2/activity");
    expect(res.status).toBe(500);
  });
});
