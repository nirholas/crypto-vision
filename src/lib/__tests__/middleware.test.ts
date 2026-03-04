/**
 * Tests for lib/middleware.ts — requestLogger, requestTimeout, globalErrorHandler
 *
 * Uses a real Hono app to exercise middleware end-to-end.
 */

import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock logger to capture log calls and suppress output
vi.mock("@/lib/logger.js", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock fetcher's FetchError class
vi.mock("@/lib/fetcher.js", () => {
  class FetchError extends Error {
    status: number;
    source: string;
    constructor(message: string, status: number, source: string) {
      super(message);
      this.name = "FetchError";
      this.status = status;
      this.source = source;
    }
  }
  return { FetchError };
});

import { AppError } from "@/lib/api-error.js";
import { FetchError } from "@/lib/fetcher.js";
import { logger as mockLogger } from "@/lib/logger.js";
import { globalErrorHandler, requestLogger, requestTimeout } from "@/lib/middleware.js";

type MockedLogger = typeof mockLogger & {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [K in keyof typeof mockLogger]: any;
};
const mLog = mockLogger as MockedLogger;

// ─── requestLogger ──────────────────────────────────────────

describe("requestLogger", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function buildApp() {
    const app = new Hono();
    app.use("/*", requestLogger);
    return app;
  }

  it("adds Server-Timing header to responses", async () => {
    const app = buildApp();
    app.get("/test", (c) => c.json({ ok: true }));

    const res = await app.request("/test");
    expect(res.status).toBe(200);
    expect(res.headers.get("Server-Timing")).toMatch(/total;dur=\d+/);
  });

  it("logs 2xx responses at info level", async () => {
    const app = buildApp();
    app.get("/test", (c) => c.json({ ok: true }));

    await app.request("/test");
    expect(mockLogger.info).toHaveBeenCalled();
    const logArgs = mLog.info.mock.calls[0];
    expect(logArgs[0]).toMatchObject({
      method: "GET",
      path: "/test",
      status: 200,
    });
  });

  it("logs 4xx responses at warn level", async () => {
    const app = buildApp();
    app.get("/test", (c) => c.json({ error: "bad" }, 404));

    await app.request("/test");
    expect(mockLogger.warn).toHaveBeenCalled();
    const logArgs = mLog.warn.mock.calls[0];
    expect(logArgs[0]).toMatchObject({
      method: "GET",
      path: "/test",
      status: 404,
    });
  });

  it("logs 5xx responses at error level", async () => {
    const app = buildApp();
    app.get("/test", (c) => c.json({ error: "boom" }, 500));

    await app.request("/test");
    expect(mockLogger.error).toHaveBeenCalled();
    const logArgs = mLog.error.mock.calls[0];
    expect(logArgs[0]).toMatchObject({
      method: "GET",
      path: "/test",
      status: 500,
    });
  });

  it("includes request-id from header when available", async () => {
    const app = buildApp();
    app.get("/test", (c) => c.json({ ok: true }));

    await app.request("/test", {
      headers: { "x-request-id": "req-abc-123" },
    });
    expect(mockLogger.info).toHaveBeenCalled();
    const logArgs = mLog.info.mock.calls[0];
    expect(logArgs[0].requestId).toBe("req-abc-123");
  });
});

// ─── requestTimeout ─────────────────────────────────────────

describe("requestTimeout", () => {
  it("allows requests that complete within the timeout", async () => {
    const app = new Hono();
    app.use("/*", requestTimeout(5000));
    app.get("/test", (c) => c.json({ ok: true }));

    const res = await app.request("/test");
    expect(res.status).toBe(200);
  });

  it("sets abortSignal on context", async () => {
    let signalExists = false;
    const app = new Hono();
    app.use("/*", requestTimeout(5000));
    app.get("/test", (c) => {
      signalExists = c.get("abortSignal") instanceof AbortSignal;
      return c.json({ signalExists });
    });

    const res = await app.request("/test");
    expect(res.status).toBe(200);
    expect(signalExists).toBe(true);
  });
});

// ─── globalErrorHandler ─────────────────────────────────────

describe("globalErrorHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function buildApp(handler: (c: any) => any) {
    const app = new Hono();
    app.onError(globalErrorHandler);
    app.get("/test", handler);
    return app;
  }

  it("handles AppError with correct status and code", async () => {
    const app = buildApp(() => {
      throw new AppError("NOT_FOUND", "Coin not found");
    });

    const res = await app.request("/test");
    expect(res.status).toBe(404);
    const body = (await res.json()) as Record<string, any>;
    expect(body.code).toBe("NOT_FOUND");
    expect(body.error).toBe("Coin not found");
  });

  it("handles AppError with details and retryAfter", async () => {
    const origEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";
    try {
      const app = buildApp(() => {
        throw new AppError("RATE_LIMIT_EXCEEDED", "Too fast", { retryAfter: 30, details: { ip: "1.2.3.4" } });
      });

      const res = await app.request("/test");
      expect(res.status).toBe(429);
      const body = (await res.json()) as Record<string, any>;
      expect(body.retryAfter).toBe(30);
      expect(body.details).toEqual({ ip: "1.2.3.4" });
    } finally {
      process.env.NODE_ENV = origEnv;
    }
  });

  it("handles FetchError as UPSTREAM_ERROR (502)", async () => {
    const app = buildApp(() => {
      throw new FetchError("Connection refused", 503, "CoinGecko");
    });

    const res = await app.request("/test");
    expect(res.status).toBe(502);
    const body = (await res.json()) as Record<string, any>;
    expect(body.code).toBe("UPSTREAM_ERROR");
  });

  it("handles FetchError with 429 status as rate-limited upstream", async () => {
    const app = buildApp(() => {
      throw new FetchError("Too many requests", 429, "CoinGecko");
    });

    const res = await app.request("/test");
    expect(res.status).toBe(502);
    const body = (await res.json()) as Record<string, any>;
    expect(body.code).toBe("UPSTREAM_ERROR");
    expect(body.error).toContain("rate limited");
    expect(body.retryAfter).toBe(30);
  });

  it("handles SyntaxError (bad JSON body) as INVALID_JSON (400)", async () => {
    const app = buildApp(() => {
      throw new SyntaxError("Unexpected token in JSON at position 0");
    });

    const res = await app.request("/test");
    expect(res.status).toBe(400);
    const body = (await res.json()) as Record<string, any>;
    expect(body.code).toBe("INVALID_JSON");
  });

  it("handles unknown errors as INTERNAL_ERROR (500)", async () => {
    const app = buildApp(() => {
      throw new Error("Something unexpected");
    });

    const res = await app.request("/test");
    expect(res.status).toBe(500);
    const body = (await res.json()) as Record<string, any>;
    expect(body.code).toBe("INTERNAL_ERROR");
  });

  it("includes error message in non-production mode", async () => {
    const origEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";
    try {
      const app = buildApp(() => {
        throw new Error("dev-visible error");
      });

      const res = await app.request("/test");
      const body = (await res.json()) as Record<string, any>;
      expect(body.error).toBe("dev-visible error");
    } finally {
      process.env.NODE_ENV = origEnv;
    }
  });

  it("hides error message in production mode", async () => {
    const origEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      const app = buildApp(() => {
        throw new Error("secret internal error");
      });

      const res = await app.request("/test");
      const body = (await res.json()) as Record<string, any>;
      expect(body.error).toBe("An unexpected error occurred");
      expect(body.details).toBeUndefined();
    } finally {
      process.env.NODE_ENV = origEnv;
    }
  });

  it("logs AppError at warn level", async () => {
    const app = buildApp(() => {
      throw new AppError("FORBIDDEN", "Access denied");
    });

    await app.request("/test");
    expect(mockLogger.warn).toHaveBeenCalled();
  });

  it("logs unknown errors at error level", async () => {
    const app = buildApp(() => {
      throw new Error("kaboom");
    });

    await app.request("/test");
    expect(mockLogger.error).toHaveBeenCalled();
  });
});
