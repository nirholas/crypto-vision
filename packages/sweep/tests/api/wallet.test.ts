import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { z } from "zod";
import {
  generateTestWalletAddress,
  createTestToken,
  mockWalletService,
  mockValidationService,
} from "../setup.js";

// Create test app with wallet routes
function createTestApp() {
  const app = new Hono();
  
  // Rate limit tracker (simplified for testing)
  const rateLimitStore = new Map<string, { count: number; resetAt: number }>();
  
  // Rate limiting middleware
  app.use("/api/wallet/*", async (c, next) => {
    const ip = c.req.header("x-forwarded-for") || "test-ip";
    const now = Date.now();
    const limit = rateLimitStore.get(ip);
    
    if (limit && limit.resetAt > now) {
      if (limit.count >= 100) {
        return c.json({ error: "Rate limit exceeded" }, 429);
      }
      limit.count++;
    } else {
      rateLimitStore.set(ip, { count: 1, resetAt: now + 60000 });
    }
    
    await next();
  });
  
  // Validation schemas
  const walletAddressSchema = z.object({
    address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid wallet address"),
  });
  
  const dustQuerySchema = z.object({
    chains: z.string().optional(),
    threshold: z.string().optional(),
    async: z.string().optional(),
  });
  
  // GET /api/wallet/:address/dust
  app.get("/api/wallet/:address/dust", async (c) => {
    const address = c.req.param("address");
    const chains = c.req.query("chains");
    const threshold = c.req.query("threshold");
    const asyncMode = c.req.query("async");
    
    // Validate address
    const validationResult = walletAddressSchema.safeParse({ address });
    if (!validationResult.success) {
      return c.json({ error: "Invalid wallet address" }, 400);
    }
    
    const thresholdValue = threshold ? parseFloat(threshold) : 10;
    const chainsArray = chains ? chains.split(",") : undefined;
    
    try {
      // Mock async mode
      if (asyncMode === "true") {
        return c.json({
          status: "queued",
          jobId: "mock-job-id",
          message: "Wallet scan queued. Poll /api/wallet/:address/dust/status/:jobId for results.",
        });
      }
      
      // Get balances
      let balances: any[];
      if (chainsArray && chainsArray.length === 1) {
        balances = await mockWalletService.getWalletTokenBalancesAlchemy(address, chainsArray[0]);
      } else {
        const allBalances = await mockWalletService.scanAllChains(address);
        balances = Object.values(allBalances).flat();
      }
      
      // Filter dust tokens
      const dustTokens = await mockValidationService.filterDustTokens(balances, thresholdValue);
      
      // Group by chain
      const dustByChain: Record<string, any[]> = {};
      for (const dust of dustTokens) {
        const chain = dust.token.chain;
        if (!dustByChain[chain]) {
          dustByChain[chain] = [];
        }
        dustByChain[chain].push(dust);
      }
      
      const totalValueUsd = dustTokens.reduce((sum, d) => sum + d.usdValue, 0);
      
      return c.json({
        wallet: address,
        dust: dustByChain,
        summary: {
          totalTokens: dustTokens.length,
          totalValueUsd: parseFloat(totalValueUsd.toFixed(2)),
          chains: Object.keys(dustByChain),
          scannedAt: Date.now(),
        },
      });
    } catch (error) {
      console.error("Error scanning wallet for dust:", error);
      return c.json({ error: "Failed to scan wallet for dust tokens" }, 500);
    }
  });
  
  // GET /api/wallet/:address/balances
  app.get("/api/wallet/:address/balances", async (c) => {
    const address = c.req.param("address");
    const chain = c.req.query("chain");
    
    // Validate address
    const validationResult = walletAddressSchema.safeParse({ address });
    if (!validationResult.success) {
      return c.json({ error: "Invalid wallet address" }, 400);
    }
    
    try {
      if (chain) {
        const balances = await mockWalletService.getWalletTokenBalancesAlchemy(address, chain);
        return c.json({ chain, balances, count: balances.length });
      } else {
        const allBalances = await mockWalletService.scanAllChains(address);
        const totalTokens = Object.values(allBalances).reduce(
          (sum, arr) => sum + arr.length,
          0
        );
        return c.json({ balances: allBalances, totalTokens });
      }
    } catch (error) {
      return c.json({ error: "Failed to fetch balances" }, 500);
    }
  });
  
  return { app, rateLimitStore };
}

describe("Wallet API", () => {
  let app: Hono;
  let rateLimitStore: Map<string, { count: number; resetAt: number }>;
  
  beforeEach(() => {
    const testApp = createTestApp();
    app = testApp.app;
    rateLimitStore = testApp.rateLimitStore;
    vi.clearAllMocks();
  });
  
  describe("GET /api/wallet/:address/dust", () => {
    it("should return dust tokens for a valid wallet address", async () => {
      const address = generateTestWalletAddress();
      
      const res = await app.request(`/api/wallet/${address}/dust`);
      
      expect(res.status).toBe(200);
      
      const body = await res.json();
      expect(body.wallet).toBe(address);
      expect(body.dust).toBeDefined();
      expect(body.summary).toBeDefined();
      expect(body.summary.totalTokens).toBeGreaterThanOrEqual(0);
      expect(body.summary.scannedAt).toBeDefined();
    });
    
    it("should reject invalid wallet addresses", async () => {
      const invalidAddresses = [
        "invalid",
        "0x123", // too short
        "0xGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG", // invalid hex
        "1234567890123456789012345678901234567890", // missing 0x
      ];
      
      for (const address of invalidAddresses) {
        const res = await app.request(`/api/wallet/${address}/dust`);
        expect(res.status).toBe(400);
        
        const body = await res.json();
        expect(body.error).toContain("Invalid wallet address");
      }
    });
    
    it("should filter by specific chains", async () => {
      const address = generateTestWalletAddress();
      
      const res = await app.request(`/api/wallet/${address}/dust?chains=base`);
      
      expect(res.status).toBe(200);
      
      const body = await res.json();
      expect(body.wallet).toBe(address);
      expect(mockWalletService.getWalletTokenBalancesAlchemy).toHaveBeenCalledWith(address, "base");
    });
    
    it("should support multiple chains", async () => {
      const address = generateTestWalletAddress();
      
      const res = await app.request(`/api/wallet/${address}/dust?chains=base,ethereum`);
      
      expect(res.status).toBe(200);
    });
    
    it("should apply custom threshold", async () => {
      const address = generateTestWalletAddress();
      
      const res = await app.request(`/api/wallet/${address}/dust?threshold=5`);
      
      expect(res.status).toBe(200);
      expect(mockValidationService.filterDustTokens).toHaveBeenCalledWith(
        expect.any(Array),
        5
      );
    });
    
    it("should support async mode", async () => {
      const address = generateTestWalletAddress();
      
      const res = await app.request(`/api/wallet/${address}/dust?async=true`);
      
      expect(res.status).toBe(200);
      
      const body = await res.json();
      expect(body.status).toBe("queued");
      expect(body.jobId).toBeDefined();
      expect(body.message).toContain("Wallet scan queued");
    });
    
    it("should include summary with total value", async () => {
      const address = generateTestWalletAddress();
      
      const res = await app.request(`/api/wallet/${address}/dust`);
      const body = await res.json();
      
      expect(body.summary.totalValueUsd).toBeDefined();
      expect(typeof body.summary.totalValueUsd).toBe("number");
    });
    
    it("should group dust by chain", async () => {
      const address = generateTestWalletAddress();
      
      const res = await app.request(`/api/wallet/${address}/dust`);
      const body = await res.json();
      
      expect(body.dust).toBeDefined();
      expect(body.summary.chains).toBeInstanceOf(Array);
    });
  });
  
  describe("GET /api/wallet/:address/balances", () => {
    it("should return balances for a valid wallet address", async () => {
      const address = generateTestWalletAddress();
      
      const res = await app.request(`/api/wallet/${address}/balances`);
      
      expect(res.status).toBe(200);
      
      const body = await res.json();
      expect(body.balances).toBeDefined();
      expect(body.totalTokens).toBeDefined();
    });
    
    it("should return balances for a specific chain", async () => {
      const address = generateTestWalletAddress();
      
      const res = await app.request(`/api/wallet/${address}/balances?chain=base`);
      
      expect(res.status).toBe(200);
      
      const body = await res.json();
      expect(body.chain).toBe("base");
      expect(body.balances).toBeInstanceOf(Array);
      expect(body.count).toBeDefined();
    });
    
    it("should reject invalid wallet address", async () => {
      const res = await app.request("/api/wallet/invalid/balances");
      
      expect(res.status).toBe(400);
    });
  });
  
  describe("Rate limiting", () => {
    it("should allow requests under the rate limit", async () => {
      const address = generateTestWalletAddress();
      
      // Make a few requests
      for (let i = 0; i < 5; i++) {
        const res = await app.request(`/api/wallet/${address}/dust`);
        expect(res.status).toBe(200);
      }
    });
    
    it("should reject requests over the rate limit", async () => {
      const address = generateTestWalletAddress();
      
      // Simulate hitting rate limit
      rateLimitStore.set("test-ip", { count: 100, resetAt: Date.now() + 60000 });
      
      const res = await app.request(`/api/wallet/${address}/dust`);
      
      expect(res.status).toBe(429);
      
      const body = await res.json();
      expect(body.error).toContain("Rate limit");
    });
    
    it("should reset rate limit after window expires", async () => {
      const address = generateTestWalletAddress();
      
      // Set expired rate limit
      rateLimitStore.set("test-ip", { count: 100, resetAt: Date.now() - 1000 });
      
      const res = await app.request(`/api/wallet/${address}/dust`);
      
      expect(res.status).toBe(200);
    });
  });
  
  describe("Error handling", () => {
    it("should handle service errors gracefully", async () => {
      const address = generateTestWalletAddress();
      
      // Make service throw error
      mockWalletService.scanAllChains.mockRejectedValueOnce(new Error("Service unavailable"));
      
      const res = await app.request(`/api/wallet/${address}/dust`);
      
      expect(res.status).toBe(500);
      
      const body = await res.json();
      expect(body.error).toBeDefined();
    });
    
    it("should return 404 for unknown endpoints", async () => {
      const address = generateTestWalletAddress();
      
      const res = await app.request(`/api/wallet/${address}/unknown`);
      
      expect(res.status).toBe(404);
    });
  });
});
