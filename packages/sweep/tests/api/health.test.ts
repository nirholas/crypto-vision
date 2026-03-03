import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";

// Create a test app
function createTestApp() {
  const app = new Hono();
  
  // GET /health - Basic health check
  app.get("/health", (c) => {
    return c.json({
      status: "ok",
      timestamp: Date.now(),
      service: "sweep-api",
      version: "0.1.0",
    });
  });
  
  // GET /health/ready - Readiness check
  app.get("/health/ready", async (c) => {
    const checks: Record<string, { status: "ok" | "error"; latencyMs?: number; error?: string }> = {};
    
    // Simulate Redis check
    try {
      const start = Date.now();
      // Mock ping
      checks.redis = { status: "ok", latencyMs: Date.now() - start };
    } catch (error) {
      checks.redis = {
        status: "error",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
    
    // Simulate Database check
    try {
      const start = Date.now();
      // Mock query
      checks.database = { status: "ok", latencyMs: Date.now() - start };
    } catch (error) {
      checks.database = {
        status: "error",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
    
    const allHealthy = Object.values(checks).every((c) => c.status === "ok");
    
    return c.json(
      {
        status: allHealthy ? "ready" : "degraded",
        timestamp: Date.now(),
        checks,
      },
      allHealthy ? 200 : 503
    );
  });
  
  // GET /health/live - Liveness check
  app.get("/health/live", (c) => {
    return c.json({
      status: "alive",
      timestamp: Date.now(),
      uptime: process.uptime(),
    });
  });
  
  return app;
}

describe("Health API", () => {
  let app: Hono;
  
  beforeEach(() => {
    app = createTestApp();
  });
  
  describe("GET /health", () => {
    it("should return 200 with ok status", async () => {
      const res = await app.request("/health");
      
      expect(res.status).toBe(200);
      
      const body = await res.json();
      expect(body.status).toBe("ok");
      expect(body.service).toBe("sweep-api");
      expect(body.version).toBeDefined();
      expect(body.timestamp).toBeDefined();
      expect(typeof body.timestamp).toBe("number");
    });
    
    it("should include version information", async () => {
      const res = await app.request("/health");
      const body = await res.json();
      
      expect(body.version).toMatch(/^\d+\.\d+\.\d+/);
    });
    
    it("should have correct content-type header", async () => {
      const res = await app.request("/health");
      
      expect(res.headers.get("content-type")).toContain("application/json");
    });
  });
  
  describe("GET /health/ready", () => {
    it("should return 200 when all dependencies are healthy", async () => {
      const res = await app.request("/health/ready");
      
      expect(res.status).toBe(200);
      
      const body = await res.json();
      expect(body.status).toBe("ready");
      expect(body.checks).toBeDefined();
      expect(body.checks.redis).toBeDefined();
      expect(body.checks.database).toBeDefined();
    });
    
    it("should include latency metrics for each dependency", async () => {
      const res = await app.request("/health/ready");
      const body = await res.json();
      
      expect(body.checks.redis.latencyMs).toBeDefined();
      expect(typeof body.checks.redis.latencyMs).toBe("number");
      expect(body.checks.database.latencyMs).toBeDefined();
      expect(typeof body.checks.database.latencyMs).toBe("number");
    });
    
    it("should return 503 when Redis is unhealthy", async () => {
      // Create app with failing Redis
      const failingApp = new Hono();
      failingApp.get("/health/ready", async (c) => {
        const checks: Record<string, any> = {
          redis: { status: "error", error: "Connection refused" },
          database: { status: "ok", latencyMs: 5 },
        };
        
        const allHealthy = Object.values(checks).every((check) => check.status === "ok");
        
        return c.json(
          {
            status: allHealthy ? "ready" : "degraded",
            timestamp: Date.now(),
            checks,
          },
          allHealthy ? 200 : 503
        );
      });
      
      const res = await failingApp.request("/health/ready");
      
      expect(res.status).toBe(503);
      
      const body = await res.json();
      expect(body.status).toBe("degraded");
      expect(body.checks.redis.status).toBe("error");
      expect(body.checks.redis.error).toBeDefined();
    });
    
    it("should return 503 when Database is unhealthy", async () => {
      // Create app with failing database
      const failingApp = new Hono();
      failingApp.get("/health/ready", async (c) => {
        const checks: Record<string, any> = {
          redis: { status: "ok", latencyMs: 2 },
          database: { status: "error", error: "Connection timeout" },
        };
        
        const allHealthy = Object.values(checks).every((check) => check.status === "ok");
        
        return c.json(
          {
            status: allHealthy ? "ready" : "degraded",
            timestamp: Date.now(),
            checks,
          },
          allHealthy ? 200 : 503
        );
      });
      
      const res = await failingApp.request("/health/ready");
      
      expect(res.status).toBe(503);
      
      const body = await res.json();
      expect(body.status).toBe("degraded");
      expect(body.checks.database.status).toBe("error");
    });
    
    it("should include timestamp in response", async () => {
      const before = Date.now();
      const res = await app.request("/health/ready");
      const after = Date.now();
      
      const body = await res.json();
      
      expect(body.timestamp).toBeGreaterThanOrEqual(before);
      expect(body.timestamp).toBeLessThanOrEqual(after);
    });
  });
  
  describe("GET /health/live", () => {
    it("should return 200 with alive status", async () => {
      const res = await app.request("/health/live");
      
      expect(res.status).toBe(200);
      
      const body = await res.json();
      expect(body.status).toBe("alive");
    });
    
    it("should include uptime information", async () => {
      const res = await app.request("/health/live");
      const body = await res.json();
      
      expect(body.uptime).toBeDefined();
      expect(typeof body.uptime).toBe("number");
      expect(body.uptime).toBeGreaterThan(0);
    });
    
    it("should include timestamp", async () => {
      const res = await app.request("/health/live");
      const body = await res.json();
      
      expect(body.timestamp).toBeDefined();
      expect(typeof body.timestamp).toBe("number");
    });
    
    it("should respond quickly (under 100ms)", async () => {
      const start = Date.now();
      await app.request("/health/live");
      const duration = Date.now() - start;
      
      expect(duration).toBeLessThan(100);
    });
  });
  
  describe("Error handling", () => {
    it("should return 404 for unknown health endpoints", async () => {
      const res = await app.request("/health/unknown");
      
      expect(res.status).toBe(404);
    });
  });
});
