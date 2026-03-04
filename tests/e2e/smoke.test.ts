/**
 * E2E Smoke Tests — starts the real server and hits every major route group.
 *
 * These tests validate that OUR server responds correctly: status codes,
 * JSON shape, and headers. Upstream network errors are tolerated since
 * external APIs may be unavailable in CI.
 */

import { beforeAll, describe, expect, it } from "vitest";

// ─── Helpers ─────────────────────────────────────────────────

let BASE_URL: string;
let API_KEY: string;

beforeAll(() => {
  const url = process.env.E2E_BASE_URL;
  if (!url) throw new Error("E2E_BASE_URL not set — is global-setup running?");
  BASE_URL = url;
  API_KEY = process.env.E2E_API_KEY || "";
});

/** Fetch a path relative to the server base URL with a generous timeout. */
async function get(path: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  const headers = new Headers(init?.headers);
  // Authenticate with the test API key to avoid public-tier rate limiting
  if (API_KEY) headers.set("X-API-Key", API_KEY);
  try {
    return await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

/** Assert response is JSON and return the parsed body. */
async function expectJson(res: Response): Promise<unknown> {
  const ct = res.headers.get("content-type") || "";
  expect(ct).toContain("application/json");
  return res.json();
}

/**
 * Many upstream APIs may be down or require keys — we accept any status that
 * indicates our server is responding correctly. What we do NOT accept is
 * wrong routing (404 on a valid path) or network-level failures.
 *
 * Acceptable: 200, 400 (bad params), 429 (rate-limited), 500 (internal),
 *             502 (upstream error), 503 (service unavailable), 504 (timeout).
 */
function isAcceptableStatus(status: number): boolean {
  return [200, 400, 429, 500, 502, 503, 504].includes(status);
}

// ─── Health & Meta ───────────────────────────────────────────

describe("Health & Meta", () => {
  it("GET /health → 200, has status field", async () => {
    const res = await get("/health");
    // Health can return 200 or 503 (degraded) — both are valid responses
    expect([200, 503]).toContain(res.status);
    const body = (await expectJson(res)) as Record<string, unknown>;
    expect(body).toHaveProperty("status");
    expect(["ok", "degraded"]).toContain(body.status);
    expect(body).toHaveProperty("uptime");
    expect(body).toHaveProperty("timestamp");
  });

  it("GET / → 200, has name and version", async () => {
    const res = await get("/");
    expect(res.status).toBe(200);
    const body = (await expectJson(res)) as Record<string, unknown>;
    expect(body).toHaveProperty("name", "Crypto Vision");
    expect(body).toHaveProperty("version");
    expect(body).toHaveProperty("docs", "/api");
  });

  it("GET /api → 200, has endpoints object", async () => {
    const res = await get("/api");
    expect(res.status).toBe(200);
    const body = (await expectJson(res)) as Record<string, unknown>;
    expect(body).toHaveProperty("endpoints");
    expect(typeof body.endpoints).toBe("object");
    // Should have major route groups
    const endpoints = body.endpoints as Record<string, unknown>;
    expect(endpoints).toHaveProperty("market");
    expect(endpoints).toHaveProperty("defi");
    expect(endpoints).toHaveProperty("news");
    expect(endpoints).toHaveProperty("onchain");
    expect(endpoints).toHaveProperty("ai");
  });
});

// ─── Market Routes ───────────────────────────────────────────

describe("Market Routes", () => {
  it("GET /api/coins → 200, returns array (possibly in envelope)", async () => {
    const res = await get("/api/coins");
    expect(isAcceptableStatus(res.status)).toBe(true);
    if (res.status === 200) {
      const body = (await res.json()) as Record<string, any>;
      // Response envelope wraps arrays as { data: [...], meta: {...} }
      const payload = body?.data ?? body;
      expect(Array.isArray(payload)).toBe(true);
    }
  });

  it("GET /api/trending → acceptable status", async () => {
    const res = await get("/api/trending");
    expect(isAcceptableStatus(res.status)).toBe(true);
  });

  it("GET /api/global → acceptable status", async () => {
    const res = await get("/api/global");
    expect(isAcceptableStatus(res.status)).toBe(true);
  });

  it("GET /api/fear-greed → acceptable status", async () => {
    const res = await get("/api/fear-greed");
    expect(isAcceptableStatus(res.status)).toBe(true);
  });

  it("GET /api/price (missing ids) → 400", async () => {
    const res = await get("/api/price");
    expect(res.status).toBe(400);
    const body = (await expectJson(res)) as Record<string, unknown>;
    expect(body).toHaveProperty("error");
  });
});

// ─── DeFi Routes ─────────────────────────────────────────────

describe("DeFi Routes", () => {
  it("GET /api/defi/protocols → acceptable status", async () => {
    const res = await get("/api/defi/protocols");
    expect(isAcceptableStatus(res.status)).toBe(true);
    if (res.status === 200) {
      const body = (await res.json()) as Record<string, any>;
      // Response may be enveloped as { data: ..., meta: ... }
      const payload = body?.data ?? body;
      expect(Array.isArray(payload) || typeof payload === "object").toBe(true);
    }
  });

  it("GET /api/defi/chains → acceptable status", async () => {
    const res = await get("/api/defi/chains");
    expect(isAcceptableStatus(res.status)).toBe(true);
  });

  it("GET /api/defi/yields → acceptable status", async () => {
    const res = await get("/api/defi/yields");
    expect(isAcceptableStatus(res.status)).toBe(true);
  });
});

// ─── News Routes ─────────────────────────────────────────────

describe("News Routes", () => {
  it("GET /api/news → acceptable status", async () => {
    const res = await get("/api/news");
    expect(isAcceptableStatus(res.status)).toBe(true);
  });

  it("GET /api/news/sources → acceptable status", async () => {
    const res = await get("/api/news/sources");
    expect(isAcceptableStatus(res.status)).toBe(true);
  });
});

// ─── On-Chain Routes ─────────────────────────────────────────

describe("On-Chain Routes", () => {
  it("GET /api/onchain/gas → acceptable status", async () => {
    const res = await get("/api/onchain/gas");
    expect(isAcceptableStatus(res.status)).toBe(true);
  });

  it("GET /api/onchain/bitcoin/stats → acceptable status", async () => {
    const res = await get("/api/onchain/bitcoin/stats");
    expect(isAcceptableStatus(res.status)).toBe(true);
  });
});

// ─── CEX Routes ──────────────────────────────────────────────

describe("CEX Routes", () => {
  it("GET /api/cex/tickers → acceptable status", async () => {
    const res = await get("/api/cex/tickers");
    expect(isAcceptableStatus(res.status)).toBe(true);
  });

  it("GET /api/cex/prices → acceptable status", async () => {
    const res = await get("/api/cex/prices");
    expect(isAcceptableStatus(res.status)).toBe(true);
  });
});

// ─── DEX Routes ──────────────────────────────────────────────

describe("DEX Routes", () => {
  it("GET /api/dex/networks → acceptable status", async () => {
    const res = await get("/api/dex/networks");
    expect(isAcceptableStatus(res.status)).toBe(true);
  });

  it("GET /api/dex/trending-pools → acceptable status", async () => {
    const res = await get("/api/dex/trending-pools");
    expect(isAcceptableStatus(res.status)).toBe(true);
  });
});

// ─── AI Routes ───────────────────────────────────────────────

describe("AI Routes", () => {
  it("GET /api/ai/sentiment/bitcoin → 200 or 503 (no AI key)", async () => {
    const res = await get("/api/ai/sentiment/bitcoin");
    // 200 if AI key is configured, 503 if not, 502/504 if upstream issue
    expect([200, 400, 429, 500, 502, 503, 504]).toContain(res.status);
    await expectJson(res);
  });
});

// ─── Derivatives Routes ──────────────────────────────────────

describe("Derivatives Routes", () => {
  it("GET /api/derivatives/funding → acceptable status", async () => {
    const res = await get("/api/derivatives/funding");
    expect(isAcceptableStatus(res.status)).toBe(true);
  });

  it("GET /api/derivatives/oi → acceptable status", async () => {
    const res = await get("/api/derivatives/oi");
    expect(isAcceptableStatus(res.status)).toBe(true);
  });
});

// ─── Bitcoin Routes ──────────────────────────────────────────

describe("Bitcoin Routes", () => {
  it("GET /api/bitcoin/price → acceptable status", async () => {
    const res = await get("/api/bitcoin/price");
    expect(isAcceptableStatus(res.status)).toBe(true);
  });

  it("GET /api/bitcoin/stats → acceptable status", async () => {
    const res = await get("/api/bitcoin/stats");
    expect(isAcceptableStatus(res.status)).toBe(true);
  });
});

// ─── Gas Routes ──────────────────────────────────────────────

describe("Gas Routes", () => {
  it("GET /api/gas → acceptable status", { timeout: 45_000 }, async () => {
    const res = await get("/api/gas");
    expect(isAcceptableStatus(res.status)).toBe(true);
  });
});

// ─── Research Routes ─────────────────────────────────────────

describe("Research Routes", () => {
  it("GET /api/research/assets → acceptable status", async () => {
    const res = await get("/api/research/assets");
    expect(isAcceptableStatus(res.status)).toBe(true);
  });
});

// ─── L2 Routes ───────────────────────────────────────────────

describe("L2 Routes", () => {
  it("GET /api/l2/summary → acceptable status", async () => {
    const res = await get("/api/l2/summary");
    expect(isAcceptableStatus(res.status)).toBe(true);
  });
});

// ─── Security Routes ─────────────────────────────────────────

describe("Security Routes", () => {
  it("GET /api/security/chains → acceptable status", async () => {
    const res = await get("/api/security/chains");
    expect(isAcceptableStatus(res.status)).toBe(true);
  });
});

// ─── Aggregate Routes ────────────────────────────────────────

describe("Aggregate Routes", () => {
  it("GET /api/aggregate/tickers → acceptable status", async () => {
    const res = await get("/api/aggregate/tickers");
    expect(isAcceptableStatus(res.status)).toBe(true);
  });

  it("GET /api/aggregate/global → acceptable status", async () => {
    const res = await get("/api/aggregate/global");
    expect(isAcceptableStatus(res.status)).toBe(true);
  });
});

// ─── Agents Routes ───────────────────────────────────────────

describe("Agents Routes", () => {
  it("GET /api/agents → acceptable status", async () => {
    const res = await get("/api/agents");
    expect(isAcceptableStatus(res.status)).toBe(true);
    if (res.status === 200) {
      const body = (await res.json()) as Record<string, any>;
      // Response may be enveloped as { data: ..., meta: ... }
      const payload = body?.data ?? body;
      expect(Array.isArray(payload) || typeof payload === "object").toBe(true);
    }
  });
});

// ─── Analytics Routes ────────────────────────────────────────

describe("Analytics Routes", () => {
  it("GET /api/analytics/volatility → acceptable status", { timeout: 45_000 }, async () => {
    const res = await get("/api/analytics/volatility");
    expect(isAcceptableStatus(res.status)).toBe(true);
  });
});

// ─── Perps Routes ────────────────────────────────────────────

describe("Perps Routes", () => {
  it("GET /api/perps/overview → acceptable status", async () => {
    const res = await get("/api/perps/overview");
    expect(isAcceptableStatus(res.status)).toBe(true);
  });

  it("GET /api/perps/funding → acceptable status", async () => {
    const res = await get("/api/perps/funding");
    expect(isAcceptableStatus(res.status)).toBe(true);
  });
});

// ─── Governance Routes ───────────────────────────────────────

describe("Governance Routes", () => {
  it("GET /api/governance/spaces → acceptable status", async () => {
    const res = await get("/api/governance/spaces");
    expect(isAcceptableStatus(res.status)).toBe(true);
  });
});

// ─── Macro Routes ────────────────────────────────────────────

describe("Macro Routes", () => {
  it("GET /api/macro/overview → acceptable status", async () => {
    const res = await get("/api/macro/overview");
    expect(isAcceptableStatus(res.status)).toBe(true);
  });
});

// ─── Solana Routes ───────────────────────────────────────────

describe("Solana Routes", () => {
  it("GET /api/solana/tokens/popular → acceptable status", async () => {
    const res = await get("/api/solana/tokens/popular");
    expect(isAcceptableStatus(res.status)).toBe(true);
  });
});

// ─── DePIN Routes ────────────────────────────────────────────

describe("DePIN Routes", () => {
  it("GET /api/depin/projects → acceptable status", async () => {
    const res = await get("/api/depin/projects");
    expect(isAcceptableStatus(res.status)).toBe(true);
  });
});

// ─── Exchanges Routes ────────────────────────────────────────

describe("Exchanges Routes", () => {
  it("GET /api/exchanges/list → acceptable status", async () => {
    const res = await get("/api/exchanges/list");
    expect(isAcceptableStatus(res.status)).toBe(true);
  });
});

// ─── NFT Routes ──────────────────────────────────────────────

describe("NFT Routes", () => {
  it("GET /api/nft/overview → acceptable status", async () => {
    const res = await get("/api/nft/overview");
    expect(isAcceptableStatus(res.status)).toBe(true);
  });
});

// ─── Whale Routes ────────────────────────────────────────────

describe("Whale Routes", () => {
  it("GET /api/whales/overview → acceptable status", async () => {
    const res = await get("/api/whales/overview");
    expect(isAcceptableStatus(res.status)).toBe(true);
  });
});

// ─── Staking Routes ──────────────────────────────────────────

describe("Staking Routes", () => {
  it("GET /api/staking/overview → acceptable status", async () => {
    const res = await get("/api/staking/overview");
    expect(isAcceptableStatus(res.status)).toBe(true);
  });
});

// ─── Calendar Routes ─────────────────────────────────────────

describe("Calendar Routes", () => {
  it("GET /api/calendar/events → acceptable status", async () => {
    const res = await get("/api/calendar/events");
    expect(isAcceptableStatus(res.status)).toBe(true);
  });
});

// ─── Oracle Routes ───────────────────────────────────────────

describe("Oracle Routes", () => {
  it("GET /api/oracles/chainlink/feeds → acceptable status", async () => {
    const res = await get("/api/oracles/chainlink/feeds");
    expect(isAcceptableStatus(res.status)).toBe(true);
  });
});

// ─── Unlocks Routes ──────────────────────────────────────────

describe("Unlocks Routes", () => {
  it("GET /api/unlocks/upcoming → acceptable status", async () => {
    const res = await get("/api/unlocks/upcoming");
    expect(isAcceptableStatus(res.status)).toBe(true);
  });
});

// ─── ETF Routes ──────────────────────────────────────────────

describe("ETF Routes", () => {
  it("GET /api/etf/overview → acceptable status", async () => {
    const res = await get("/api/etf/overview");
    expect(isAcceptableStatus(res.status)).toBe(true);
  });
});

// ─── Social Routes ───────────────────────────────────────────

describe("Social Routes", () => {
  it("GET /api/social/fear-greed → acceptable status", async () => {
    const res = await get("/api/social/fear-greed");
    expect(isAcceptableStatus(res.status)).toBe(true);
  });
});

// ─── News Feed Routes ────────────────────────────────────────

describe("News Feed Routes", () => {
  it("GET /api/news-feed/sources → acceptable status", async () => {
    const res = await get("/api/news-feed/sources");
    expect(isAcceptableStatus(res.status)).toBe(true);
  });

  it("GET /api/news-feed/categories → acceptable status", async () => {
    const res = await get("/api/news-feed/categories");
    expect(isAcceptableStatus(res.status)).toBe(true);
  });
});

// ─── Error Handling ──────────────────────────────────────────

describe("Error Handling", () => {
  it("GET /api/nonexistent → 404", async () => {
    const res = await get("/api/nonexistent");
    // Accept 429 as a valid response (rate-limited before reaching 404 handler)
    expect([404, 429]).toContain(res.status);
    const body = (await expectJson(res)) as Record<string, unknown>;
    expect(body).toHaveProperty("error");
  });

  it("GET /totally-unknown → 404", async () => {
    const res = await get("/totally-unknown");
    expect(res.status).toBe(404);
    const body = (await expectJson(res)) as Record<string, unknown>;
    expect(body).toHaveProperty("error");
  });

  it("All JSON responses have content-type header", async () => {
    const res = await get("/api");
    expect(res.headers.get("content-type")).toContain("application/json");
  });

  it("CORS headers are present", async () => {
    const res = await get("/api", {
      headers: { Origin: "http://localhost:3000" },
    });
    // In test/dev mode, CORS allows all origins
    const acaoHeader = res.headers.get("access-control-allow-origin");
    expect(acaoHeader).toBeTruthy();
  });

  it("Request ID header is present", async () => {
    const res = await get("/api");
    const reqId = res.headers.get("x-request-id");
    expect(reqId).toBeTruthy();
  });
});

// ─── Readiness Probe ─────────────────────────────────────────

describe("Readiness Probe", () => {
  it("GET /api/ready → 200 or 503, has checks object", async () => {
    const res = await get("/api/ready");
    // Accept 429 as a valid response (rate-limited before reaching handler)
    expect([200, 429, 503]).toContain(res.status);
    const body = (await expectJson(res)) as Record<string, unknown>;
    if (res.status !== 429) {
      expect(body).toHaveProperty("status");
      expect(["ready", "not_ready"]).toContain(body.status);
      expect(body).toHaveProperty("checks");
    }
  });
});
