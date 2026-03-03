/**
 * Integration tests for DePIN routes.
 *
 * Mocks the DePINscan source adapter so no real HTTP calls are made.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";

// ─── Mock sources BEFORE importing routes ────────────────────

vi.mock("../../sources/depinscan.js", () => ({
  getProjects: vi.fn(),
  getProject: vi.fn(),
  getCategories: vi.fn(),
  getMetrics: vi.fn(),
  getProjectsByCategory: vi.fn(),
}));

import * as depin from "../../sources/depinscan.js";
import { depinRoutes } from "../depin.js";

const app = new Hono().route("/api/depin", depinRoutes);

beforeEach(() => {
  vi.clearAllMocks();
});

// ═══════════════════════════════════════════════════════════════
// GET /api/depin/projects
// ═══════════════════════════════════════════════════════════════

describe("GET /api/depin/projects", () => {
  it("returns all DePIN projects with count", async () => {
    vi.mocked(depin.getProjects).mockResolvedValue([
      { slug: "helium", name: "Helium", category: "Wireless", marketCap: 1e9 },
      { slug: "filecoin", name: "Filecoin", category: "Storage", marketCap: 3e9 },
    ] as any);

    const res = await app.request("/api/depin/projects");
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.count).toBe(2);
    expect(json.data).toHaveLength(2);
    expect(json.data[0].slug).toBe("helium");
  });

  it("handles non-array response gracefully", async () => {
    vi.mocked(depin.getProjects).mockResolvedValue(null as any);

    const res = await app.request("/api/depin/projects");
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.count).toBe(0);
  });

  it("propagates source errors as 500", async () => {
    vi.mocked(depin.getProjects).mockRejectedValue(new Error("DePINscan down"));

    const res = await app.request("/api/depin/projects");
    expect(res.status).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/depin/project/:slug
// ═══════════════════════════════════════════════════════════════

describe("GET /api/depin/project/:slug", () => {
  it("returns single project detail", async () => {
    vi.mocked(depin.getProject).mockResolvedValue({
      slug: "helium",
      name: "Helium",
      category: "Wireless",
      description: "Decentralized wireless network",
      marketCap: 1e9,
      devices: 500000,
    } as any);

    const res = await app.request("/api/depin/project/helium");
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.slug).toBe("helium");
    expect(json.name).toBe("Helium");
    expect(depin.getProject).toHaveBeenCalledWith("helium");
  });

  it("handles null (not found) response", async () => {
    vi.mocked(depin.getProject).mockResolvedValue(null as any);

    const res = await app.request("/api/depin/project/nonexistent");
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json).toBeNull();
  });

  it("propagates source errors as 500", async () => {
    vi.mocked(depin.getProject).mockRejectedValue(new Error("fail"));

    const res = await app.request("/api/depin/project/invalid");
    expect(res.status).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/depin/categories
// ═══════════════════════════════════════════════════════════════

describe("GET /api/depin/categories", () => {
  it("returns DePIN categories", async () => {
    vi.mocked(depin.getCategories).mockResolvedValue([
      "Wireless",
      "Storage",
      "Compute",
      "Sensor",
    ] as any);

    const res = await app.request("/api/depin/categories");
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json).toHaveLength(4);
    expect(json).toContain("Wireless");
    expect(json).toContain("Storage");
  });

  it("propagates source errors as 500", async () => {
    vi.mocked(depin.getCategories).mockRejectedValue(new Error("fail"));

    const res = await app.request("/api/depin/categories");
    expect(res.status).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/depin/metrics
// ═══════════════════════════════════════════════════════════════

describe("GET /api/depin/metrics", () => {
  it("returns aggregate DePIN metrics", async () => {
    vi.mocked(depin.getMetrics).mockResolvedValue({
      totalProjects: 200,
      totalMarketCap: 50e9,
      totalDevices: 5e6,
      categories: 8,
    } as any);

    const res = await app.request("/api/depin/metrics");
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.totalProjects).toBe(200);
    expect(json.totalMarketCap).toBe(50e9);
    expect(json.totalDevices).toBe(5e6);
  });

  it("propagates source errors as 500", async () => {
    vi.mocked(depin.getMetrics).mockRejectedValue(new Error("fail"));

    const res = await app.request("/api/depin/metrics");
    expect(res.status).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/depin/category/:category
// ═══════════════════════════════════════════════════════════════

describe("GET /api/depin/category/:category", () => {
  it("returns projects for a specific category", async () => {
    vi.mocked(depin.getProjectsByCategory).mockResolvedValue([
      { slug: "helium", name: "Helium", category: "Wireless" },
      { slug: "hivemapper", name: "Hivemapper", category: "Wireless" },
    ] as any);

    const res = await app.request("/api/depin/category/Wireless");
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.category).toBe("Wireless");
    expect(json.count).toBe(2);
    expect(json.data).toHaveLength(2);
    expect(depin.getProjectsByCategory).toHaveBeenCalledWith("Wireless");
  });

  it("handles non-array response gracefully", async () => {
    vi.mocked(depin.getProjectsByCategory).mockResolvedValue(null as any);

    const res = await app.request("/api/depin/category/Unknown");
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.count).toBe(0);
  });

  it("propagates source errors as 500", async () => {
    vi.mocked(depin.getProjectsByCategory).mockRejectedValue(new Error("fail"));

    const res = await app.request("/api/depin/category/Invalid");
    expect(res.status).toBe(500);
  });
});
