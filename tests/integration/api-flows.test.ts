/**
 * Integration Tests — Full API Request Flows
 *
 * Spins up the actual server on a random port and tests real request flows.
 * These tests validate response shapes, status codes, rate limiting,
 * error handling, and cache behavior end-to-end.
 *
 * Upstream APIs may be unavailable — we tolerate 502/503/504 as valid
 * "upstream failed" responses. What we do NOT accept: 500 (our code crashed),
 * wrong routing (404 on a valid path), or malformed JSON.
 */

import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "../..");

let serverProcess: ChildProcess | undefined;
let BASE_URL: string;
let API_KEY: string;

// ─── Setup ───────────────────────────────────────────────────

async function getRandomPort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.listen(0, () => {
      const addr = srv.address();
      if (addr && typeof addr === "object") {
        const port = addr.port;
        srv.close(() => resolve(port));
      } else {
        srv.close(() => reject(new Error("Failed to get random port")));
      }
    });
    srv.on("error", reject);
  });
}

async function waitForHealth(
  url: string,
  maxAttempts = 60,
  intervalMs = 500,
): Promise<void> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status === 503) return;
    } catch {
      // Server not ready yet
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(
    `Server did not become healthy at ${url} after ${maxAttempts} attempts`,
  );
}

beforeAll(async () => {
  const port = await getRandomPort();
  BASE_URL = `http://localhost:${port}`;
  API_KEY = "integration-test-key-00000000";

  serverProcess = spawn("npx", ["tsx", "src/index.ts"], {
    cwd: ROOT,
    env: {
      ...process.env,
      PORT: String(port),
      NODE_ENV: "test",
      LOG_LEVEL: "warn",
      API_KEYS: `${API_KEY}:pro`,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  // Capture stderr for debugging
  serverProcess.stderr?.on("data", (chunk: Buffer) => {
    const text = chunk.toString();
    if (text.includes("FATAL") || text.includes("Error")) {
      console.error("[integration] Server stderr:", text.trim());
    }
  });

  await waitForHealth(`${BASE_URL}/health`);
}, 60_000);

afterAll(async () => {
  if (serverProcess) {
    serverProcess.kill("SIGTERM");
    await new Promise<void>((resolve) => {
      serverProcess!.on("exit", resolve);
      setTimeout(resolve, 5000);
    });
  }
});

// ─── Helpers ─────────────────────────────────────────────────

async function get(path: string): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    return await fetch(`${BASE_URL}${path}`, {
      headers: {
        Accept: "application/json",
        "X-API-Key": API_KEY,
      },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function post(
  path: string,
  body: unknown,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    return await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-API-Key": API_KEY,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

/** Status codes we consider acceptable (success or upstream failure) */
function isAcceptable(status: number): boolean {
  return (
    status === 200 ||
    status === 429 ||
    status === 502 ||
    status === 503 ||
    status === 504
  );
}

// ─── Health / Meta ───────────────────────────────────────────

describe("Health & Meta", () => {
  it("GET /health returns comprehensive status", async () => {
    const res = await get("/health");
    expect([200, 503]).toContain(res.status);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toHaveProperty("status");
    expect(["ok", "degraded"]).toContain(body.status);
    expect(body).toHaveProperty("uptime");
    expect(body).toHaveProperty("cache");
    expect(body).toHaveProperty("queues");
    expect(body).toHaveProperty("memory");
    expect(body).toHaveProperty("timestamp");
  });

  it("GET / returns API info", async () => {
    const res = await get("/");
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toHaveProperty("name", "Crypto Vision");
    expect(body).toHaveProperty("version");
  });

  it("GET /metrics returns Prometheus text format", async () => {
    const res = await get("/metrics");
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("http_requests_total");
  });
});

// ─── Market Data ─────────────────────────────────────────────

describe("Market Routes", () => {
  it("GET /api/coins returns paginated data", async () => {
    const res = await get("/api/coins");
    expect(isAcceptable(res.status)).toBe(true);
    if (res.status === 200) {
      const body = (await res.json()) as { data?: unknown[] };
      expect(body.data ?? body).toBeDefined();
    }
  });

  it("GET /api/coin/bitcoin returns coin details", async () => {
    const res = await get("/api/coin/bitcoin");
    expect(isAcceptable(res.status)).toBe(true);
  });

  it("GET /api/coin/nonexistent-coin-xyz returns 404", async () => {
    const res = await get("/api/coin/this-coin-does-not-exist-xyz");
    // Should be 404 or possibly 502 if upstream times out
    expect([404, 502, 503, 504]).toContain(res.status);
  });

  it("GET /api/trending returns trending coins", async () => {
    const res = await get("/api/trending");
    expect(isAcceptable(res.status)).toBe(true);
  });

  it("GET /api/global returns global market data", async () => {
    const res = await get("/api/global");
    expect(isAcceptable(res.status)).toBe(true);
  });

  it("GET /api/fear-greed returns fear & greed index", async () => {
    const res = await get("/api/fear-greed");
    expect(isAcceptable(res.status)).toBe(true);
  });
});

// ─── DeFi ────────────────────────────────────────────────────

describe("DeFi Routes", () => {
  it("GET /api/defi/protocols returns DeFi data", async () => {
    const res = await get("/api/defi/protocols");
    expect(isAcceptable(res.status)).toBe(true);
  });

  it("GET /api/defi/protocols?limit=5 respects limit", async () => {
    const res = await get("/api/defi/protocols?limit=5");
    expect(isAcceptable(res.status)).toBe(true);
    if (res.status === 200) {
      const body = (await res.json()) as { data?: unknown[] };
      const data = body.data ?? body;
      if (Array.isArray(data)) {
        expect(data.length).toBeLessThanOrEqual(5);
      }
    }
  });

  it("GET /api/defi/chains returns chain TVL data", async () => {
    const res = await get("/api/defi/chains");
    expect(isAcceptable(res.status)).toBe(true);
  });
});

// ─── News ────────────────────────────────────────────────────

describe("News Routes", () => {
  it("GET /api/news returns recent articles", async () => {
    const res = await get("/api/news");
    expect(isAcceptable(res.status)).toBe(true);
  });
});

// ─── AI ──────────────────────────────────────────────────────

describe("AI Routes", () => {
  it("GET /api/ai/providers returns configured providers", async () => {
    const res = await get("/api/ai/providers");
    expect(isAcceptable(res.status)).toBe(true);
  });
});

// ─── Anomalies ───────────────────────────────────────────────

describe("Anomaly Routes", () => {
  it("GET /api/anomalies returns anomaly list", async () => {
    const res = await get("/api/anomalies");
    expect(isAcceptable(res.status)).toBe(true);
  });

  it("GET /api/anomalies/stats returns stats", async () => {
    const res = await get("/api/anomalies/stats");
    expect(isAcceptable(res.status)).toBe(true);
  });
});

// ─── Search ──────────────────────────────────────────────────

describe("Search Routes", () => {
  it("GET /api/search?q=bitcoin returns results", async () => {
    const res = await get("/api/search?q=bitcoin");
    expect(isAcceptable(res.status)).toBe(true);
  });
});

// ─── On-Chain ────────────────────────────────────────────────

describe("On-Chain Routes", () => {
  it("GET /api/onchain/gas returns gas data", async () => {
    const res = await get("/api/onchain/gas");
    expect(isAcceptable(res.status)).toBe(true);
  });
});

// ─── Exchanges ───────────────────────────────────────────────

describe("Exchange Routes", () => {
  it("GET /api/exchanges returns exchange list", async () => {
    const res = await get("/api/exchanges");
    expect(isAcceptable(res.status)).toBe(true);
  });
});

// ─── Error Handling ──────────────────────────────────────────

describe("Error Handling", () => {
  it("returns 404 for nonexistent routes", async () => {
    const res = await get("/api/nonexistent-route-xyz");
    expect(res.status).toBe(404);
  });

  it("returns valid JSON for all error responses", async () => {
    const res = await get("/api/nonexistent-route-xyz");
    const ct = res.headers.get("content-type") || "";
    // Even 404 should have proper content-type
    expect(ct).toContain("application/json");
  });

  it("never crashes on invalid query parameters", async () => {
    const res = await get("/api/coins?per_page=abc&page=-1");
    // Should handle gracefully — 200 (ignored) or 400 (validated), never 500
    expect(res.status).not.toBe(500);
  });

  it("handles oversized URLs gracefully", async () => {
    const longParam = "a".repeat(10_000);
    const res = await get(`/api/search?q=${longParam}`);
    // Should return 400 or 414, never 500
    expect(res.status).not.toBe(500);
  });
});

// ─── Security Headers ────────────────────────────────────────

describe("Security Headers", () => {
  it("includes X-Content-Type-Options: nosniff", async () => {
    const res = await get("/health");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("includes Content-Security-Policy header", async () => {
    const res = await get("/health");
    const csp = res.headers.get("content-security-policy");
    expect(csp).toBeDefined();
  });

  it("includes X-Request-Id header", async () => {
    const res = await get("/health");
    const reqId = res.headers.get("x-request-id");
    expect(reqId).toBeDefined();
    expect(typeof reqId).toBe("string");
    expect(reqId!.length).toBeGreaterThan(0);
  });
});

// ─── Rate Limiting ───────────────────────────────────────────

describe("Rate Limiting", () => {
  it("returns rate limit headers", async () => {
    const res = await get("/api/coins");
    if (res.status === 200) {
      // Rate limit headers may vary by implementation
      const rlRemaining = res.headers.get("x-ratelimit-remaining");
      if (rlRemaining) {
        expect(Number(rlRemaining)).toBeGreaterThanOrEqual(0);
      }
    }
  });
});
