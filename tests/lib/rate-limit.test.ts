/**
 * Tests for lib/rate-limit.ts — sliding window rate limiter
 *
 * No Redis — exercises the in-memory backend only.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Hono } from "hono";
import { rateLimit } from "@/lib/rate-limit.js";

// Ensure no Redis connection
vi.stubEnv("REDIS_URL", "");

function buildApp(config: { limit: number; windowSeconds: number }) {
  const app = new Hono();
  app.use("/api/*", rateLimit(config));
  app.get("/api/test", (c) => c.json({ ok: true }));
  return app;
}

// ─── Basic rate limiting ─────────────────────────────────────

describe("rateLimit middleware", () => {
  it("allows requests within the limit", async () => {
    const app = buildApp({ limit: 5, windowSeconds: 60 });

    const res = await app.request("/api/test", {
      headers: { "x-forwarded-for": "10.0.0.1" },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, any>;
    expect(body).toEqual({ ok: true });
  });

  it("returns 429 after exceeding the limit", async () => {
    const app = buildApp({ limit: 3, windowSeconds: 60 });

    // Make 3 allowed requests
    for (let i = 0; i < 3; i++) {
      const res = await app.request("/api/test", {
        headers: { "x-forwarded-for": "10.0.0.2" },
      });
      expect(res.status).toBe(200);
    }

    // 4th request should be rate-limited
    const blocked = await app.request("/api/test", {
      headers: { "x-forwarded-for": "10.0.0.2" },
    });
    expect(blocked.status).toBe(429);

    const body = await blocked.json();
    expect(body).toHaveProperty("error", "RATE_LIMIT_EXCEEDED");
    expect(body).toHaveProperty("retryAfter");
  });

  it("tracks different IPs separately", async () => {
    const app = buildApp({ limit: 2, windowSeconds: 60 });

    // IP A: 2 requests (exhaust limit)
    for (let i = 0; i < 2; i++) {
      await app.request("/api/test", {
        headers: { "x-forwarded-for": "10.0.0.3" },
      });
    }
    const blockedA = await app.request("/api/test", {
      headers: { "x-forwarded-for": "10.0.0.3" },
    });
    expect(blockedA.status).toBe(429);

    // IP B should still be allowed
    const allowedB = await app.request("/api/test", {
      headers: { "x-forwarded-for": "10.0.0.4" },
    });
    expect(allowedB.status).toBe(200);
  });
});

// ─── Response Headers ────────────────────────────────────────

describe("rateLimit headers", () => {
  it("sets X-RateLimit-Limit header", async () => {
    const app = buildApp({ limit: 10, windowSeconds: 60 });

    const res = await app.request("/api/test", {
      headers: { "x-forwarded-for": "10.0.0.10" },
    });
    expect(res.headers.get("X-RateLimit-Limit")).toBe("10");
  });

  it("sets X-RateLimit-Remaining header (decrements)", async () => {
    const app = buildApp({ limit: 5, windowSeconds: 60 });

    const res1 = await app.request("/api/test", {
      headers: { "x-forwarded-for": "10.0.0.11" },
    });
    expect(res1.headers.get("X-RateLimit-Remaining")).toBe("4");

    const res2 = await app.request("/api/test", {
      headers: { "x-forwarded-for": "10.0.0.11" },
    });
    expect(res2.headers.get("X-RateLimit-Remaining")).toBe("3");
  });

  it("sets X-RateLimit-Reset header", async () => {
    const app = buildApp({ limit: 10, windowSeconds: 60 });

    const res = await app.request("/api/test", {
      headers: { "x-forwarded-for": "10.0.0.12" },
    });
    const reset = res.headers.get("X-RateLimit-Reset");
    expect(reset).toBeTruthy();
    // Reset should be a unix timestamp in the future
    expect(Number(reset)).toBeGreaterThan(Math.floor(Date.now() / 1000) - 5);
  });

  it("sets Retry-After header on 429 responses", async () => {
    const app = buildApp({ limit: 1, windowSeconds: 60 });

    // Exhaust the limit
    await app.request("/api/test", {
      headers: { "x-forwarded-for": "10.0.0.13" },
    });

    // Over limit
    const blocked = await app.request("/api/test", {
      headers: { "x-forwarded-for": "10.0.0.13" },
    });
    expect(blocked.status).toBe(429);
    const retryAfter = blocked.headers.get("Retry-After");
    expect(retryAfter).toBeTruthy();
    expect(Number(retryAfter)).toBeGreaterThan(0);
  });
});

// ─── Non-rate-limited routes ─────────────────────────────────

describe("rateLimit — scope", () => {
  it("does not affect routes outside /api/*", async () => {
    const app = new Hono();
    app.use("/api/*", rateLimit({ limit: 1, windowSeconds: 60 }));
    app.get("/api/test", (c) => c.json({ ok: true }));
    app.get("/health", (c) => c.json({ status: "ok" }));

    // Exhaust API limit
    await app.request("/api/test", {
      headers: { "x-forwarded-for": "10.0.0.20" },
    });
    const blocked = await app.request("/api/test", {
      headers: { "x-forwarded-for": "10.0.0.20" },
    });
    expect(blocked.status).toBe(429);

    // /health is unaffected
    const health = await app.request("/health");
    expect(health.status).toBe(200);
  });
});

// ─── Window reset ────────────────────────────────────────────

describe("rateLimit — window reset", () => {
  it("resets counter after window expires", async () => {
    vi.useFakeTimers();
    try {
      const app = buildApp({ limit: 2, windowSeconds: 10 });
      const ip = "10.0.0.30";

      // Exhaust limit
      for (let i = 0; i < 2; i++) {
        await app.request("/api/test", {
          headers: { "x-forwarded-for": ip },
        });
      }
      const blocked = await app.request("/api/test", {
        headers: { "x-forwarded-for": ip },
      });
      expect(blocked.status).toBe(429);

      // Advance past window
      vi.advanceTimersByTime(11_000);

      const renewed = await app.request("/api/test", {
        headers: { "x-forwarded-for": ip },
      });
      expect(renewed.status).toBe(200);
    } finally {
      vi.useRealTimers();
    }
  });
});

// ─── Remaining floor ─────────────────────────────────────────

describe("rateLimit — remaining floor", () => {
  it("remaining is 0 when limit is reached, not negative", async () => {
    const app = buildApp({ limit: 1, windowSeconds: 60 });

    const res1 = await app.request("/api/test", {
      headers: { "x-forwarded-for": "10.0.0.31" },
    });
    expect(res1.headers.get("X-RateLimit-Remaining")).toBe("0");

    // Over limit — still 0, not negative
    const res2 = await app.request("/api/test", {
      headers: { "x-forwarded-for": "10.0.0.31" },
    });
    expect(res2.headers.get("X-RateLimit-Remaining")).toBe("0");
  });
});

// ─── 429 response body ───────────────────────────────────────

describe("rateLimit — 429 response body", () => {
  it("returns structured error with retryAfter field", async () => {
    const app = buildApp({ limit: 1, windowSeconds: 30 });

    await app.request("/api/test", {
      headers: { "x-forwarded-for": "10.0.0.32" },
    });

    const blocked = await app.request("/api/test", {
      headers: { "x-forwarded-for": "10.0.0.32" },
    });
    expect(blocked.status).toBe(429);

    const body = await blocked.json();
    expect(body).toMatchObject({
      error: "RATE_LIMIT_EXCEEDED",
      retryAfter: expect.any(Number),
    });
    expect(body.message).toMatch(/too many requests/i);
  });

  it("uses x-real-ip when x-forwarded-for is absent", async () => {
    const app = buildApp({ limit: 1, windowSeconds: 60 });

    // First request via x-real-ip
    const res = await app.request("/api/test", {
      headers: { "x-real-ip": "99.99.99.99" },
    });
    expect(res.status).toBe(200);
  });

  it("uses default config (limit 200, 60s window) when no config given", async () => {
    const app = new Hono();
    app.use("/api/*", rateLimit());
    app.get("/api/test", (c) => c.json({ ok: true }));

    const res = await app.request("/api/test", {
      headers: { "x-forwarded-for": "10.0.0.33" },
    });
    expect(res.headers.get("X-RateLimit-Limit")).toBe("200");
    expect(res.headers.get("X-RateLimit-Remaining")).toBe("199");
  });
});
