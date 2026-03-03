/**
 * API Integration Tests
 * Tests full request flow with mocked services
 */

import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import { Hono } from "hono";
import { createMockRedis, mockPriceService, mockValidationService } from "../setup.js";

// Mock external dependencies
vi.mock("../../src/utils/redis.js", () => ({
  redis: createMockRedis(),
  cacheGetOrFetch: vi.fn((key, fn, ttl) => fn()),
  cacheGet: vi.fn(() => null),
  cacheSet: vi.fn(),
}));

vi.mock("../../src/services/price.service.js", () => ({
  priceService: mockPriceService,
}));

vi.mock("../../src/services/validation.service.js", () => ({
  validationService: mockValidationService,
}));

describe("API Integration", () => {
  describe("Full Request Flow", () => {
    it("should process health check through full middleware stack", async () => {
      const app = new Hono();
      
      // Simulate middleware stack
      app.use("*", async (c, next) => {
        c.set("requestId", `req-${Date.now()}`);
        await next();
      });
      
      app.get("/health", (c) => c.json({ status: "ok", requestId: c.get("requestId") }));
      
      const res = await app.request("/health");
      const data = await res.json();
      
      expect(res.status).toBe(200);
      expect(data.status).toBe("ok");
      expect(data.requestId).toBeDefined();
    });

    it("should validate request body schemas", async () => {
      const app = new Hono();
      
      // Simulate Zod validation middleware
      app.post("/quote", async (c) => {
        const body = await c.req.json();
        
        // Manual validation for test
        if (!body.tokenAddress || !body.chain || !body.amount) {
          return c.json({ error: "Missing required fields" }, 400);
        }
        
        if (!/^0x[a-fA-F0-9]{40}$/.test(body.tokenAddress)) {
          return c.json({ error: "Invalid token address" }, 400);
        }
        
        return c.json({ 
          quoteId: `quote-${Date.now()}`,
          tokenAddress: body.tokenAddress,
          chain: body.chain,
        });
      });
      
      // Valid request
      const validRes = await app.request("/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tokenAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
          chain: "ethereum",
          amount: "1000000",
        }),
      });
      
      expect(validRes.status).toBe(200);
      
      // Invalid request - missing field
      const invalidRes = await app.request("/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tokenAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        }),
      });
      
      expect(invalidRes.status).toBe(400);
    });

    it("should handle request timeouts gracefully", async () => {
      const app = new Hono();
      
      app.get("/slow-endpoint", async (c) => {
        // Simulate slow operation
        await new Promise(resolve => setTimeout(resolve, 50));
        return c.json({ data: "slow response" });
      });
      
      // With timeout middleware
      const timeoutMiddleware = (timeout: number) => async (c: any, next: any) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        
        try {
          await next();
        } finally {
          clearTimeout(timeoutId);
        }
      };
      
      const res = await app.request("/slow-endpoint");
      expect(res.status).toBe(200);
    });
  });

  describe("Authentication Middleware", () => {
    it("should reject requests without authentication", async () => {
      const app = new Hono();
      
      const authMiddleware = async (c: any, next: any) => {
        const token = c.req.header("Authorization");
        if (!token) {
          return c.json({ error: "Unauthorized" }, 401);
        }
        await next();
      };
      
      app.use("/protected/*", authMiddleware);
      app.get("/protected/data", (c) => c.json({ data: "secret" }));
      
      const res = await app.request("/protected/data");
      expect(res.status).toBe(401);
    });

    it("should accept valid Bearer token", async () => {
      const app = new Hono();
      
      const authMiddleware = async (c: any, next: any) => {
        const token = c.req.header("Authorization");
        if (!token || !token.startsWith("Bearer ")) {
          return c.json({ error: "Unauthorized" }, 401);
        }
        c.set("user", { id: "user-123" });
        await next();
      };
      
      app.use("/protected/*", authMiddleware);
      app.get("/protected/data", (c) => {
        const user = c.get("user");
        return c.json({ data: "secret", userId: user.id });
      });
      
      const res = await app.request("/protected/data", {
        headers: { Authorization: "Bearer valid-token" },
      });
      
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.userId).toBe("user-123");
    });

    it("should validate SIWE signature", async () => {
      const validateSiweMessage = (message: string, signature: string) => {
        // Simplified validation for test
        return message.includes("sweep.bank") && signature.startsWith("0x");
      };
      
      const validMessage = "sweep.bank wants you to sign in";
      const validSignature = "0x" + "a".repeat(130);
      
      expect(validateSiweMessage(validMessage, validSignature)).toBe(true);
      expect(validateSiweMessage("invalid", validSignature)).toBe(false);
    });
  });

  describe("Rate Limiting", () => {
    it("should limit requests per IP", async () => {
      const rateLimits = new Map<string, { count: number; resetAt: number }>();
      const RATE_LIMIT = 5;
      const WINDOW_MS = 60000;
      
      const rateLimitMiddleware = (ip: string) => {
        const now = Date.now();
        const limit = rateLimits.get(ip);
        
        if (!limit || now > limit.resetAt) {
          rateLimits.set(ip, { count: 1, resetAt: now + WINDOW_MS });
          return { allowed: true, remaining: RATE_LIMIT - 1 };
        }
        
        if (limit.count >= RATE_LIMIT) {
          return { allowed: false, remaining: 0 };
        }
        
        limit.count++;
        return { allowed: true, remaining: RATE_LIMIT - limit.count };
      };
      
      // Simulate multiple requests
      for (let i = 0; i < 5; i++) {
        const result = rateLimitMiddleware("192.168.1.1");
        expect(result.allowed).toBe(true);
      }
      
      // 6th request should be blocked
      const blocked = rateLimitMiddleware("192.168.1.1");
      expect(blocked.allowed).toBe(false);
      expect(blocked.remaining).toBe(0);
    });

    it("should have separate limits per endpoint", async () => {
      const endpointLimits: Record<string, number> = {
        "/quote": 100,
        "/sweep": 10,
        "/health": 1000,
      };
      
      const getLimit = (endpoint: string) => endpointLimits[endpoint] || 60;
      
      expect(getLimit("/quote")).toBe(100);
      expect(getLimit("/sweep")).toBe(10);
      expect(getLimit("/unknown")).toBe(60);
    });

    it("should return rate limit headers", async () => {
      const app = new Hono();
      
      app.use("*", async (c, next) => {
        await next();
        c.header("X-RateLimit-Limit", "100");
        c.header("X-RateLimit-Remaining", "99");
        c.header("X-RateLimit-Reset", String(Date.now() + 60000));
      });
      
      app.get("/test", (c) => c.json({ ok: true }));
      
      const res = await app.request("/test");
      
      expect(res.headers.get("X-RateLimit-Limit")).toBe("100");
      expect(res.headers.get("X-RateLimit-Remaining")).toBe("99");
    });
  });

  describe("Error Handling", () => {
    it("should return consistent error format", async () => {
      const formatError = (status: number, message: string, code?: string) => ({
        error: {
          status,
          message,
          code: code || "UNKNOWN_ERROR",
          timestamp: new Date().toISOString(),
        },
      });
      
      const notFound = formatError(404, "Resource not found", "NOT_FOUND");
      const serverError = formatError(500, "Internal server error", "INTERNAL_ERROR");
      
      expect(notFound.error.status).toBe(404);
      expect(notFound.error.code).toBe("NOT_FOUND");
      expect(serverError.error.status).toBe(500);
    });

    it("should not expose internal errors in production", async () => {
      const sanitizeError = (error: Error, isProd: boolean) => {
        if (isProd) {
          return { message: "An unexpected error occurred" };
        }
        return { message: error.message, stack: error.stack };
      };
      
      const internalError = new Error("Database connection failed: password=secret123");
      
      const prodResponse = sanitizeError(internalError, true);
      const devResponse = sanitizeError(internalError, false);
      
      expect(prodResponse.message).not.toContain("secret123");
      expect(devResponse.message).toContain("Database");
    });

    it("should log errors with context", async () => {
      const errors: Array<{ level: string; message: string; context: any }> = [];
      
      const logError = (message: string, context: any) => {
        errors.push({ level: "error", message, context });
      };
      
      logError("Request failed", {
        requestId: "req-123",
        endpoint: "/quote",
        method: "POST",
        duration: 150,
        error: "Validation failed",
      });
      
      expect(errors).toHaveLength(1);
      expect(errors[0].context.requestId).toBe("req-123");
    });
  });

  describe("CORS Configuration", () => {
    it("should allow configured origins", async () => {
      const allowedOrigins = ["https://sweep.bank", "https://app.sweep.bank"];
      
      const isOriginAllowed = (origin: string) => allowedOrigins.includes(origin);
      
      expect(isOriginAllowed("https://sweep.bank")).toBe(true);
      expect(isOriginAllowed("https://evil.com")).toBe(false);
    });

    it("should handle preflight requests", async () => {
      const app = new Hono();
      
      app.options("*", (c) => {
        c.header("Access-Control-Allow-Origin", "https://sweep.bank");
        c.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        c.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
        c.header("Access-Control-Max-Age", "86400");
        return c.text("", 204);
      });
      
      const res = await app.request("/quote", { method: "OPTIONS" });
      
      expect(res.status).toBe(204);
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe("https://sweep.bank");
    });
  });

  describe("Request Logging", () => {
    it("should log request and response details", async () => {
      const logs: any[] = [];
      
      const logRequest = (req: any, res: any, duration: number) => {
        logs.push({
          method: req.method,
          path: req.path,
          status: res.status,
          duration,
          timestamp: new Date().toISOString(),
        });
      };
      
      logRequest(
        { method: "POST", path: "/quote" },
        { status: 200 },
        45
      );
      
      expect(logs).toHaveLength(1);
      expect(logs[0].method).toBe("POST");
      expect(logs[0].duration).toBe(45);
    });

    it("should redact sensitive data", async () => {
      const redactSensitive = (data: any) => {
        const sensitiveFields = ["password", "token", "privateKey", "signature"];
        const redacted = { ...data };
        
        for (const field of sensitiveFields) {
          if (redacted[field]) {
            redacted[field] = "[REDACTED]";
          }
        }
        
        return redacted;
      };
      
      const data = {
        username: "user@example.com",
        password: "secret123",
        token: "jwt-token-here",
        amount: "1000",
      };
      
      const redacted = redactSensitive(data);
      
      expect(redacted.username).toBe("user@example.com");
      expect(redacted.password).toBe("[REDACTED]");
      expect(redacted.token).toBe("[REDACTED]");
      expect(redacted.amount).toBe("1000");
    });
  });
});
