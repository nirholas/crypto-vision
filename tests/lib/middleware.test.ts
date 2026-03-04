/**
 * Tests for lib/middleware.ts — requestLogger, requestTimeout, globalErrorHandler
 *
 * Exercises request logging levels, timeout enforcement, and error classification.
 */

import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { AppError } from "../../src/lib/api-error.js";
import { globalErrorHandler, requestLogger, requestTimeout } from "../../src/lib/middleware.js";

// ─── requestLogger ───────────────────────────────────────────

describe("requestLogger", () => {
  it("adds Server-Timing header to responses", async () => {
    const app = new Hono();
    app.use("*", requestLogger);
    app.get("/test", (c) => c.json({ ok: true }));

    const res = await app.request("/test");
    expect(res.status).toBe(200);
    const serverTiming = res.headers.get("server-timing");
    expect(serverTiming).toMatch(/total;dur=\d+/);
  });

  it("passes through downstream responses unchanged", async () => {
    const app = new Hono();
    app.use("*", requestLogger);
    app.get("/data", (c) => c.json({ foo: "bar" }));

    const res = await app.request("/data");
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, any>;
    expect(body).toEqual({ foo: "bar" });
  });
});

// ─── requestTimeout ──────────────────────────────────────────

describe("requestTimeout", () => {
  it("allows fast requests to complete normally", async () => {
    const app = new Hono();
    app.use("*", requestTimeout(5000));
    app.get("/fast", (c) => c.json({ ok: true }));

    const res = await app.request("/fast");
    expect(res.status).toBe(200);
  });

  it("returns 504 for requests exceeding timeout", async () => {
    const app = new Hono();
    app.use("*", requestTimeout(50)); // Very short timeout
    app.onError(globalErrorHandler);
    app.get("/slow", async (c) => {
      await new Promise((r) => setTimeout(r, 200));
      return c.json({ ok: true });
    });

    const res = await app.request("/slow");
    // Should be 504 due to timeout
    expect(res.status).toBe(504);
    const body = (await res.json()) as Record<string, any>;
    expect(body.code).toBe("TIMEOUT");
  });
});

// ─── globalErrorHandler ──────────────────────────────────────

describe("globalErrorHandler", () => {
  it("handles AppError with correct status and code", async () => {
    const app = new Hono();
    app.onError(globalErrorHandler);
    app.get("/err", () => {
      throw new AppError("NOT_FOUND", "Resource not found");
    });

    const res = await app.request("/err");
    expect(res.status).toBe(404);
    const body = (await res.json()) as Record<string, any>;
    expect(body.code).toBe("NOT_FOUND");
    expect(body.message).toBe("Resource not found");
  });

  it("handles SyntaxError (invalid JSON) as 400", async () => {
    const app = new Hono();
    app.onError(globalErrorHandler);
    app.get("/json-err", () => {
      throw new SyntaxError("Unexpected token in JSON at position 0");
    });

    const res = await app.request("/json-err");
    expect(res.status).toBe(400);
    const body = (await res.json()) as Record<string, any>;
    expect(body.code).toBe("INVALID_JSON");
  });

  it("handles unknown errors as 500 INTERNAL_ERROR", async () => {
    const app = new Hono();
    // Set NODE_ENV to non-production to get error message in response
    vi.stubEnv("NODE_ENV", "test");
    app.onError(globalErrorHandler);
    app.get("/unknown", () => {
      throw new Error("something unexpected");
    });

    const res = await app.request("/unknown");
    expect(res.status).toBe(500);
    const body = (await res.json()) as Record<string, any>;
    expect(body.code).toBe("INTERNAL_ERROR");
    vi.unstubAllEnvs();
  });

  it("does not leak stack traces in production", async () => {
    const app = new Hono();
    vi.stubEnv("NODE_ENV", "production");
    app.onError(globalErrorHandler);
    app.get("/prod-err", () => {
      throw new Error("secret internal details");
    });

    const res = await app.request("/prod-err");
    expect(res.status).toBe(500);
    const body = (await res.json()) as Record<string, any>;
    expect(body.message).not.toContain("secret internal details");
    expect(body.details).toBeUndefined();
    vi.unstubAllEnvs();
  });
});
