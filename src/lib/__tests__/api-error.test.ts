/**
 * Tests for lib/api-error.ts — Error factory, convenience builders, AppError class
 *
 * Uses a real Hono app to exercise error responses end-to-end.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import {
  apiError,
  ApiError,
  AppError,
  ERROR_CODES,
  type ErrorCode,
  type ApiErrorOptions,
  type ValidationError,
} from "@/lib/api-error.js";

// ─── Helpers ─────────────────────────────────────────────────

function buildApp(handler: (c: any) => Response) {
  const app = new Hono();
  app.get("/test", handler);
  return app;
}

async function getJSON(app: ReturnType<typeof buildApp>) {
  const res = await app.request("/test");
  return { status: res.status, body: await res.json(), headers: res.headers };
}

// ─── ERROR_CODES constant ────────────────────────────────────

describe("ERROR_CODES", () => {
  it("contains all expected error codes", () => {
    expect(ERROR_CODES.INVALID_REQUEST).toBe("INVALID_REQUEST");
    expect(ERROR_CODES.UNAUTHORIZED).toBe("UNAUTHORIZED");
    expect(ERROR_CODES.NOT_FOUND).toBe("NOT_FOUND");
    expect(ERROR_CODES.RATE_LIMIT_EXCEEDED).toBe("RATE_LIMIT_EXCEEDED");
    expect(ERROR_CODES.INTERNAL_ERROR).toBe("INTERNAL_ERROR");
    expect(ERROR_CODES.AI_SERVICE_ERROR).toBe("AI_SERVICE_ERROR");
  });

  it("has all codes as readonly string values", () => {
    const codes = Object.keys(ERROR_CODES);
    expect(codes.length).toBeGreaterThanOrEqual(20);
    for (const code of codes) {
      expect(typeof ERROR_CODES[code as ErrorCode]).toBe("string");
    }
  });
});

// ─── apiError() ──────────────────────────────────────────────

describe("apiError()", () => {
  it("returns correct HTTP status for INVALID_REQUEST (400)", async () => {
    const app = buildApp((c) => apiError(c, { code: "INVALID_REQUEST", message: "bad input" }));
    const { status, body } = await getJSON(app);
    expect(status).toBe(400);
    expect(body.code).toBe("INVALID_REQUEST");
    expect(body.error).toBe("bad input");
  });

  it("returns correct HTTP status for NOT_FOUND (404)", async () => {
    const app = buildApp((c) => apiError(c, { code: "NOT_FOUND", message: "not here" }));
    const { status, body } = await getJSON(app);
    expect(status).toBe(404);
    expect(body.code).toBe("NOT_FOUND");
  });

  it("returns correct HTTP status for RATE_LIMIT_EXCEEDED (429)", async () => {
    const app = buildApp((c) => apiError(c, { code: "RATE_LIMIT_EXCEEDED", message: "slow down", retryAfter: 30 }));
    const { status, body, headers } = await getJSON(app);
    expect(status).toBe(429);
    expect(body.retryAfter).toBe(30);
    expect(headers.get("Retry-After")).toBe("30");
  });

  it("returns correct HTTP status for INTERNAL_ERROR (500)", async () => {
    const app = buildApp((c) => apiError(c, { code: "INTERNAL_ERROR", message: "boom" }));
    const { status } = await getJSON(app);
    expect(status).toBe(500);
  });

  it("returns correct HTTP status for SERVICE_UNAVAILABLE (503)", async () => {
    const app = buildApp((c) => apiError(c, { code: "SERVICE_UNAVAILABLE", message: "down" }));
    const { status } = await getJSON(app);
    expect(status).toBe(503);
  });

  it("returns correct HTTP status for TIMEOUT (504)", async () => {
    const app = buildApp((c) => apiError(c, { code: "TIMEOUT", message: "timed out" }));
    const { status } = await getJSON(app);
    expect(status).toBe(504);
  });

  it("includes timestamp in the response body", async () => {
    const app = buildApp((c) => apiError(c, { code: "NOT_FOUND", message: "x" }));
    const { body } = await getJSON(app);
    expect(body.timestamp).toBeDefined();
    expect(new Date(body.timestamp).getTime()).not.toBeNaN();
  });

  it("includes validationErrors when provided", async () => {
    const errors: ValidationError[] = [
      { field: "email", message: "invalid format" },
      { field: "age", message: "must be positive", received: -1, expected: "number > 0" },
    ];
    const app = buildApp((c) =>
      apiError(c, { code: "VALIDATION_FAILED", message: "invalid input", validationErrors: errors }),
    );
    const { body } = await getJSON(app);
    expect(body.validationErrors).toHaveLength(2);
    expect(body.validationErrors[0].field).toBe("email");
    expect(body.validationErrors[1].field).toBe("age");
  });

  it("includes suggestion and docsUrl when provided", async () => {
    const app = buildApp((c) =>
      apiError(c, {
        code: "UNAUTHORIZED",
        message: "auth needed",
        suggestion: "Use an API key",
        docsUrl: "/docs/auth",
      }),
    );
    const { body } = await getJSON(app);
    expect(body.suggestion).toBe("Use an API key");
    expect(body.docsUrl).toBe("/docs/auth");
  });

  it("includes details in development mode", async () => {
    const origEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";
    try {
      const app = buildApp((c) =>
        apiError(c, { code: "INTERNAL_ERROR", message: "fail", details: { stack: "trace" } }),
      );
      const { body } = await getJSON(app);
      expect(body.details).toEqual({ stack: "trace" });
    } finally {
      process.env.NODE_ENV = origEnv;
    }
  });

  it("omits details in production mode", async () => {
    const origEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      const app = buildApp((c) =>
        apiError(c, { code: "INTERNAL_ERROR", message: "fail", details: { stack: "trace" } }),
      );
      const { body } = await getJSON(app);
      expect(body.details).toBeUndefined();
    } finally {
      process.env.NODE_ENV = origEnv;
    }
  });

  it("omits empty validationErrors array", async () => {
    const app = buildApp((c) =>
      apiError(c, { code: "VALIDATION_FAILED", message: "bad", validationErrors: [] }),
    );
    const { body } = await getJSON(app);
    expect(body.validationErrors).toBeUndefined();
  });

  it("defaults to 500 for unknown error codes", async () => {
    const app = buildApp((c) =>
      apiError(c, { code: "TOTALLY_UNKNOWN" as ErrorCode, message: "mystery" }),
    );
    const { status } = await getJSON(app);
    expect(status).toBe(500);
  });
});

// ─── ApiError convenience factories ──────────────────────────

describe("ApiError convenience factories", () => {
  it("badRequest() returns 400 with INVALID_REQUEST code", async () => {
    const app = buildApp((c) => ApiError.badRequest(c, "wrong input"));
    const { status, body } = await getJSON(app);
    expect(status).toBe(400);
    expect(body.code).toBe("INVALID_REQUEST");
    expect(body.error).toBe("wrong input");
  });

  it("badRequest() accepts details param", async () => {
    const origEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";
    try {
      const app = buildApp((c) => ApiError.badRequest(c, "bad", { extra: "info" }));
      const { body } = await getJSON(app);
      expect(body.details).toEqual({ extra: "info" });
    } finally {
      process.env.NODE_ENV = origEnv;
    }
  });

  it("validation() returns 400 with VALIDATION_FAILED code and errors", async () => {
    const app = buildApp((c) =>
      ApiError.validation(c, "invalid fields", [{ field: "name", message: "required" }]),
    );
    const { status, body } = await getJSON(app);
    expect(status).toBe(400);
    expect(body.code).toBe("VALIDATION_FAILED");
    expect(body.validationErrors).toHaveLength(1);
    expect(body.suggestion).toContain("validationErrors");
  });

  it("missingParam() includes parameter name in message", async () => {
    const app = buildApp((c) => ApiError.missingParam(c, "coin_id"));
    const { status, body } = await getJSON(app);
    expect(status).toBe(400);
    expect(body.code).toBe("MISSING_PARAMETER");
    expect(body.error).toContain("coin_id");
  });

  it("unauthorized() returns 401 with defaults", async () => {
    const app = buildApp((c) => ApiError.unauthorized(c));
    const { status, body } = await getJSON(app);
    expect(status).toBe(401);
    expect(body.code).toBe("UNAUTHORIZED");
    expect(body.error).toBe("Authentication required");
    expect(body.suggestion).toBeDefined();
    expect(body.docsUrl).toBeDefined();
  });

  it("unauthorized() accepts custom message", async () => {
    const app = buildApp((c) => ApiError.unauthorized(c, "Token expired"));
    const { body } = await getJSON(app);
    expect(body.error).toBe("Token expired");
  });

  it("forbidden() returns 403", async () => {
    const app = buildApp((c) => ApiError.forbidden(c));
    const { status, body } = await getJSON(app);
    expect(status).toBe(403);
    expect(body.code).toBe("FORBIDDEN");
  });

  it("notFound() returns 404 with default message", async () => {
    const app = buildApp((c) => ApiError.notFound(c));
    const { status, body } = await getJSON(app);
    expect(status).toBe(404);
    expect(body.error).toBe("Resource not found");
  });

  it("rateLimit() returns 429 with Retry-After header", async () => {
    const app = buildApp((c) => ApiError.rateLimit(c, 120));
    const { status, body, headers } = await getJSON(app);
    expect(status).toBe(429);
    expect(body.retryAfter).toBe(120);
    expect(headers.get("Retry-After")).toBe("120");
  });

  it("rateLimit() defaults to retryAfter 60", async () => {
    const app = buildApp((c) => ApiError.rateLimit(c));
    const { body } = await getJSON(app);
    expect(body.retryAfter).toBe(60);
  });

  it("paymentRequired() returns 402", async () => {
    const app = buildApp((c) => ApiError.paymentRequired(c));
    const { status, body } = await getJSON(app);
    expect(status).toBe(402);
    expect(body.code).toBe("PAYMENT_REQUIRED");
  });

  it("internal() returns 500 with default message", async () => {
    const app = buildApp((c) => ApiError.internal(c));
    const { status, body } = await getJSON(app);
    expect(status).toBe(500);
    expect(body.error).toBe("Internal server error");
  });

  it("serviceUnavailable() returns 503 with retryAfter", async () => {
    const app = buildApp((c) => ApiError.serviceUnavailable(c));
    const { status, body } = await getJSON(app);
    expect(status).toBe(503);
    expect(body.retryAfter).toBe(60);
  });

  it("upstream() returns 502 with service name in message", async () => {
    const app = buildApp((c) => ApiError.upstream(c, "CoinGecko"));
    const { status, body } = await getJSON(app);
    expect(status).toBe(502);
    expect(body.code).toBe("UPSTREAM_ERROR");
    expect(body.error).toContain("CoinGecko");
  });

  it("timeout() returns 504 with retryAfter", async () => {
    const app = buildApp((c) => ApiError.timeout(c));
    const { status, body } = await getJSON(app);
    expect(status).toBe(504);
    expect(body.code).toBe("TIMEOUT");
    expect(body.retryAfter).toBe(5);
  });

  it("aiError() returns 500 with AI_SERVICE_ERROR code", async () => {
    const app = buildApp((c) => ApiError.aiError(c, "Model overloaded"));
    const { status, body } = await getJSON(app);
    expect(status).toBe(500);
    expect(body.code).toBe("AI_SERVICE_ERROR");
    expect(body.error).toBe("Model overloaded");
  });
});

// ─── AppError (throwable) ────────────────────────────────────

describe("AppError", () => {
  it("is an instance of Error", () => {
    const err = new AppError("NOT_FOUND", "Coin not found");
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(AppError);
  });

  it("sets name to AppError", () => {
    const err = new AppError("NOT_FOUND", "x");
    expect(err.name).toBe("AppError");
  });

  it("sets code and message correctly", () => {
    const err = new AppError("UNAUTHORIZED", "No token");
    expect(err.code).toBe("UNAUTHORIZED");
    expect(err.message).toBe("No token");
  });

  it("maps code to correct statusCode", () => {
    expect(new AppError("NOT_FOUND", "x").statusCode).toBe(404);
    expect(new AppError("UNAUTHORIZED", "x").statusCode).toBe(401);
    expect(new AppError("RATE_LIMIT_EXCEEDED", "x").statusCode).toBe(429);
    expect(new AppError("INTERNAL_ERROR", "x").statusCode).toBe(500);
    expect(new AppError("TIMEOUT", "x").statusCode).toBe(504);
    expect(new AppError("SERVICE_UNAVAILABLE", "x").statusCode).toBe(503);
  });

  it("defaults statusCode to 500 for unknown codes", () => {
    const err = new AppError("UNKNOWN_CODE" as ErrorCode, "mystery");
    expect(err.statusCode).toBe(500);
  });

  it("stores details when provided", () => {
    const err = new AppError("INTERNAL_ERROR", "fail", { details: { sql: "SELECT 1" } });
    expect(err.details).toEqual({ sql: "SELECT 1" });
  });

  it("stores retryAfter when provided", () => {
    const err = new AppError("RATE_LIMIT_EXCEEDED", "slow", { retryAfter: 30 });
    expect(err.retryAfter).toBe(30);
  });

  it("has undefined details and retryAfter when not provided", () => {
    const err = new AppError("NOT_FOUND", "gone");
    expect(err.details).toBeUndefined();
    expect(err.retryAfter).toBeUndefined();
  });

  it("can be caught in try/catch and inspected", () => {
    try {
      throw new AppError("FORBIDDEN", "Access denied", { details: { resource: "/admin" } });
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      const appErr = e as AppError;
      expect(appErr.code).toBe("FORBIDDEN");
      expect(appErr.statusCode).toBe(403);
      expect(appErr.details).toEqual({ resource: "/admin" });
    }
  });

  it("has a meaningful stack trace", () => {
    const err = new AppError("INTERNAL_ERROR", "oops");
    expect(err.stack).toBeDefined();
    expect(err.stack).toContain("AppError");
  });
});
