import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { z } from "zod";
import {
  generateTestWalletAddress,
  generateTestQuoteId,
  createTestQuote,
  createTestToken,
  mockWalletService,
  mockValidationService,
  mockPriceService,
  mockRedisStore,
} from "../setup.js";

// Create test app with quote routes
function createTestApp() {
  const app = new Hono();
  
  // In-memory quote storage
  const quoteStore = new Map<string, any>();
  
  // Validation schemas
  const quoteRequestSchema = z.object({
    wallet: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid wallet address"),
    chains: z.array(z.string()).min(1, "At least one chain required"),
    tokens: z.array(
      z.object({
        address: z.string(),
        chain: z.string(),
        amount: z.string().optional(),
      })
    ).optional(),
    destination: z.object({
      chain: z.string(),
      token: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid token address"),
      protocol: z.string().optional(),
      vault: z.string().optional(),
    }),
    slippageBps: z.number().min(1).max(1000).default(100),
    gasToken: z.string().optional(),
  });
  
  // POST /api/quote
  app.post("/api/quote", async (c) => {
    let body: any;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }
    
    const validation = quoteRequestSchema.safeParse(body);
    if (!validation.success) {
      return c.json({
        error: "Validation failed",
        details: validation.error.errors,
      }, 400);
    }
    
    const data = validation.data;
    
    try {
      const quoteId = crypto.randomUUID();
      const now = Date.now();
      const expiresAt = now + 5 * 60 * 1000; // 5 minutes
      
      // Get tokens to sweep
      const tokensToSweep: any[] = [];
      
      if (data.tokens && data.tokens.length > 0) {
        // Use provided tokens
        for (const token of data.tokens) {
          const priceData = await mockPriceService.getValidatedPrice(token.address, token.chain);
          tokensToSweep.push({
            address: token.address,
            chain: token.chain,
            symbol: "UNKNOWN",
            amount: token.amount || "0",
            usdValue: priceData.price,
            canSweep: priceData.confidence !== "UNTRUSTED",
            reason: priceData.confidence === "UNTRUSTED" ? "Unable to validate token price" : undefined,
          });
        }
      } else {
        // Scan wallet for dust
        for (const chain of data.chains) {
          const balances = await mockWalletService.getWalletTokenBalancesAlchemy(data.wallet, chain);
          const dustTokens = await mockValidationService.filterDustTokens(balances);
          
          for (const dust of dustTokens) {
            tokensToSweep.push({
              address: dust.token.address,
              chain,
              symbol: dust.token.symbol,
              amount: dust.token.balance,
              usdValue: dust.usdValue,
              canSweep: true,
            });
          }
        }
      }
      
      const totalInputValueUsd = tokensToSweep.reduce((sum, t) => sum + t.usdValue, 0);
      
      const quote = {
        quoteId,
        wallet: data.wallet,
        tokens: tokensToSweep,
        destination: {
          chain: data.destination.chain,
          token: data.destination.token,
          symbol: "USDC",
          protocol: data.destination.protocol,
          vault: data.destination.vault,
        },
        summary: {
          totalInputValueUsd,
          estimatedOutputAmount: Math.floor(totalInputValueUsd * 0.99 * 1e6).toString(),
          estimatedOutputValueUsd: totalInputValueUsd * 0.99,
          estimatedGasUsd: 0.05,
          netValueUsd: totalInputValueUsd * 0.99 - 0.05,
          savingsVsManual: totalInputValueUsd * 0.1,
        },
        route: {
          aggregator: "1inch",
          steps: [],
        },
        expiresAt,
        createdAt: now,
      };
      
      // Store quote
      quoteStore.set(quoteId, quote);
      
      return c.json(quote, 201);
    } catch (error) {
      console.error("Quote generation error:", error);
      return c.json({ error: "Failed to generate quote" }, 500);
    }
  });
  
  // GET /api/quote/:id
  app.get("/api/quote/:id", async (c) => {
    const id = c.req.param("id");
    
    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return c.json({ error: "Invalid quote ID format" }, 400);
    }
    
    const quote = quoteStore.get(id);
    
    if (!quote) {
      return c.json({ error: "Quote not found" }, 404);
    }
    
    // Check expiration
    if (quote.expiresAt < Date.now()) {
      return c.json({ error: "Quote expired" }, 410);
    }
    
    return c.json(quote);
  });
  
  return { app, quoteStore };
}

describe("Quote API", () => {
  let app: Hono;
  let quoteStore: Map<string, any>;
  
  beforeEach(() => {
    const testApp = createTestApp();
    app = testApp.app;
    quoteStore = testApp.quoteStore;
    vi.clearAllMocks();
  });
  
  describe("POST /api/quote", () => {
    it("should generate a quote for valid request", async () => {
      const wallet = generateTestWalletAddress();
      
      const res = await app.request("/api/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet,
          chains: ["base", "ethereum"],
          destination: {
            chain: "base",
            token: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
          },
        }),
      });
      
      expect(res.status).toBe(201);
      
      const body = await res.json();
      expect(body.quoteId).toBeDefined();
      expect(body.wallet).toBe(wallet);
      expect(body.tokens).toBeInstanceOf(Array);
      expect(body.destination).toBeDefined();
      expect(body.summary).toBeDefined();
      expect(body.expiresAt).toBeDefined();
    });
    
    it("should reject invalid wallet address", async () => {
      const res = await app.request("/api/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet: "invalid-address",
          chains: ["base"],
          destination: {
            chain: "base",
            token: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
          },
        }),
      });
      
      expect(res.status).toBe(400);
      
      const body = await res.json();
      expect(body.error).toBe("Validation failed");
    });
    
    it("should reject empty chains array", async () => {
      const wallet = generateTestWalletAddress();
      
      const res = await app.request("/api/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet,
          chains: [],
          destination: {
            chain: "base",
            token: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
          },
        }),
      });
      
      expect(res.status).toBe(400);
      
      const body = await res.json();
      expect(body.error).toBe("Validation failed");
    });
    
    it("should reject invalid destination token", async () => {
      const wallet = generateTestWalletAddress();
      
      const res = await app.request("/api/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet,
          chains: ["base"],
          destination: {
            chain: "base",
            token: "invalid-token",
          },
        }),
      });
      
      expect(res.status).toBe(400);
    });
    
    it("should accept specific tokens to sweep", async () => {
      const wallet = generateTestWalletAddress();
      
      const res = await app.request("/api/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet,
          chains: ["base"],
          tokens: [
            {
              address: "0x4200000000000000000000000000000000000006",
              chain: "base",
              amount: "1000000000000000",
            },
          ],
          destination: {
            chain: "base",
            token: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
          },
        }),
      });
      
      expect(res.status).toBe(201);
      
      const body = await res.json();
      expect(body.tokens).toHaveLength(1);
    });
    
    it("should include route information", async () => {
      const wallet = generateTestWalletAddress();
      
      const res = await app.request("/api/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet,
          chains: ["base"],
          destination: {
            chain: "base",
            token: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
          },
        }),
      });
      
      const body = await res.json();
      expect(body.route).toBeDefined();
      expect(body.route.aggregator).toBeDefined();
    });
    
    it("should include summary with gas estimates", async () => {
      const wallet = generateTestWalletAddress();
      
      const res = await app.request("/api/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet,
          chains: ["base"],
          destination: {
            chain: "base",
            token: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
          },
        }),
      });
      
      const body = await res.json();
      expect(body.summary.estimatedGasUsd).toBeDefined();
      expect(body.summary.netValueUsd).toBeDefined();
    });
    
    it("should support DeFi destination", async () => {
      const wallet = generateTestWalletAddress();
      
      const res = await app.request("/api/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet,
          chains: ["base"],
          destination: {
            chain: "base",
            token: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
            protocol: "aave",
            vault: "0x1234567890123456789012345678901234567890",
          },
        }),
      });
      
      expect(res.status).toBe(201);
      
      const body = await res.json();
      expect(body.destination.protocol).toBe("aave");
      expect(body.destination.vault).toBeDefined();
    });
    
    it("should reject invalid JSON body", async () => {
      const res = await app.request("/api/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "invalid json",
      });
      
      expect(res.status).toBe(400);
    });
    
    it("should set expiration 5 minutes in the future", async () => {
      const wallet = generateTestWalletAddress();
      const beforeRequest = Date.now();
      
      const res = await app.request("/api/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet,
          chains: ["base"],
          destination: {
            chain: "base",
            token: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
          },
        }),
      });
      
      const body = await res.json();
      const afterRequest = Date.now();
      
      // Expiration should be ~5 minutes (300000ms) from now
      expect(body.expiresAt).toBeGreaterThan(beforeRequest + 290000);
      expect(body.expiresAt).toBeLessThan(afterRequest + 310000);
    });
  });
  
  describe("GET /api/quote/:id", () => {
    it("should retrieve an existing quote", async () => {
      const wallet = generateTestWalletAddress();
      
      // Create a quote
      const createRes = await app.request("/api/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet,
          chains: ["base"],
          destination: {
            chain: "base",
            token: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
          },
        }),
      });
      
      const { quoteId } = await createRes.json();
      
      // Retrieve the quote
      const res = await app.request(`/api/quote/${quoteId}`);
      
      expect(res.status).toBe(200);
      
      const body = await res.json();
      expect(body.quoteId).toBe(quoteId);
      expect(body.wallet).toBe(wallet);
    });
    
    it("should return 404 for non-existent quote", async () => {
      const fakeId = crypto.randomUUID();
      
      const res = await app.request(`/api/quote/${fakeId}`);
      
      expect(res.status).toBe(404);
      
      const body = await res.json();
      expect(body.error).toBe("Quote not found");
    });
    
    it("should return 400 for invalid quote ID format", async () => {
      const res = await app.request("/api/quote/invalid-id");
      
      expect(res.status).toBe(400);
      
      const body = await res.json();
      expect(body.error).toBe("Invalid quote ID format");
    });
    
    it("should return 410 for expired quote", async () => {
      const quoteId = crypto.randomUUID();
      
      // Store an expired quote
      quoteStore.set(quoteId, {
        quoteId,
        wallet: generateTestWalletAddress(),
        tokens: [],
        destination: {},
        summary: {},
        route: {},
        expiresAt: Date.now() - 1000, // Expired
        createdAt: Date.now() - 60000,
      });
      
      const res = await app.request(`/api/quote/${quoteId}`);
      
      expect(res.status).toBe(410);
      
      const body = await res.json();
      expect(body.error).toBe("Quote expired");
    });
  });
  
  describe("Quote expiration", () => {
    it("should allow retrieval of non-expired quote", async () => {
      const quoteId = crypto.randomUUID();
      
      // Store a valid quote
      quoteStore.set(quoteId, {
        quoteId,
        wallet: generateTestWalletAddress(),
        tokens: [],
        destination: {},
        summary: {},
        route: {},
        expiresAt: Date.now() + 60000, // Valid for 1 minute
        createdAt: Date.now(),
      });
      
      const res = await app.request(`/api/quote/${quoteId}`);
      
      expect(res.status).toBe(200);
    });
    
    it("should reject expired quote", async () => {
      const quoteId = crypto.randomUUID();
      
      // Store an expired quote (expired 1 second ago)
      quoteStore.set(quoteId, {
        quoteId,
        wallet: generateTestWalletAddress(),
        tokens: [],
        destination: {},
        summary: {},
        route: {},
        expiresAt: Date.now() - 1000,
        createdAt: Date.now() - 60000,
      });
      
      const res = await app.request(`/api/quote/${quoteId}`);
      
      expect(res.status).toBe(410);
    });
  });
  
  describe("Input validation", () => {
    it("should validate slippage bounds", async () => {
      const wallet = generateTestWalletAddress();
      
      // Too high slippage
      const res = await app.request("/api/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet,
          chains: ["base"],
          destination: {
            chain: "base",
            token: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
          },
          slippageBps: 2000, // 20% - too high
        }),
      });
      
      expect(res.status).toBe(400);
    });
    
    it("should accept valid slippage", async () => {
      const wallet = generateTestWalletAddress();
      
      const res = await app.request("/api/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet,
          chains: ["base"],
          destination: {
            chain: "base",
            token: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
          },
          slippageBps: 50, // 0.5%
        }),
      });
      
      expect(res.status).toBe(201);
    });
  });
});
