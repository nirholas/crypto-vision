import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { z } from "zod";
import {
  generateTestWalletAddress,
  generateTestUserId,
  createTestQuote,
  mockQueue,
} from "../setup.js";

// Create test app with sweep routes
function createTestApp() {
  const app = new Hono();
  
  // In-memory stores
  const quoteStore = new Map<string, any>();
  const sweepStore = new Map<string, any>();
  const sessionStore = new Map<string, any>();
  
  // Auth middleware simulation
  const authMiddleware = async (c: any, next: any) => {
    const token = c.req.header("x-session-token");
    
    if (!token) {
      return c.json({ error: "Authentication required" }, 401);
    }
    
    const session = sessionStore.get(token);
    if (!session) {
      return c.json({ error: "Invalid session" }, 401);
    }
    
    if (session.expiresAt < Date.now()) {
      return c.json({ error: "Session expired" }, 401);
    }
    
    c.set("userId", session.userId);
    c.set("walletAddress", session.walletAddress);
    
    await next();
  };
  
  // x402 payment simulation
  let x402Enabled = false;
  let x402PaymentReceived = false;
  
  const x402Middleware = async (c: any, next: any) => {
    if (!x402Enabled) {
      return next();
    }
    
    const paymentHeader = c.req.header("x-payment-402");
    
    if (!paymentHeader && !x402PaymentReceived) {
      return c.json(
        {
          error: "Payment required",
          paymentDetails: {
            amount: 10,
            currency: "cents",
            receiver: "0x1234567890123456789012345678901234567890",
          },
        },
        402
      );
    }
    
    // Verify payment (simplified)
    if (paymentHeader === "valid-payment") {
      x402PaymentReceived = true;
    }
    
    await next();
  };
  
  // Validation schemas
  const sweepRequestSchema = z.object({
    wallet: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid wallet address"),
    quoteId: z.string().uuid("Invalid quote ID"),
    signature: z.string().min(1, "Signature required"),
    gasToken: z.string().optional(),
  });
  
  // POST /api/sweep
  app.post("/api/sweep", authMiddleware, x402Middleware, async (c) => {
    let body: any;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }
    
    const validation = sweepRequestSchema.safeParse(body);
    if (!validation.success) {
      return c.json({
        error: "Validation failed",
        details: validation.error.errors,
      }, 400);
    }
    
    const data = validation.data;
    const userId = c.get("userId");
    const walletAddress = c.get("walletAddress");
    
    // Verify wallet ownership
    if (data.wallet.toLowerCase() !== walletAddress.toLowerCase()) {
      return c.json({ error: "Not authorized to sweep this wallet" }, 403);
    }
    
    // Get the quote
    const quote = quoteStore.get(data.quoteId);
    
    if (!quote) {
      return c.json({ error: "Quote not found" }, 404);
    }
    
    if (quote.expiresAt < Date.now()) {
      return c.json({ error: "Quote expired" }, 410);
    }
    
    // Verify quote is for this wallet
    if (quote.wallet?.toLowerCase() !== data.wallet.toLowerCase()) {
      return c.json({ error: "Quote is for a different wallet" }, 400);
    }
    
    // Create sweep record
    const sweepId = crypto.randomUUID();
    
    const sweep = {
      id: sweepId,
      userId,
      status: "pending",
      wallet: data.wallet,
      quoteId: data.quoteId,
      tokens: quote.tokens || [],
      destination: quote.destination,
      summary: quote.summary,
      createdAt: Date.now(),
    };
    
    sweepStore.set(sweepId, sweep);
    
    // Queue the sweep execution
    await mockQueue.addSweepExecuteJob({
      userId,
      sweepId,
      quoteId: data.quoteId,
      walletAddress: data.wallet,
      signature: data.signature,
    });
    
    return c.json({
      sweepId,
      status: "pending",
      message: "Sweep queued for execution",
      estimatedCompletion: Date.now() + 60000, // ~1 minute
    }, 202);
  });
  
  // GET /api/sweep/:id
  app.get("/api/sweep/:id", authMiddleware, async (c) => {
    const sweepId = c.req.param("id");
    const userId = c.get("userId");
    
    const sweep = sweepStore.get(sweepId);
    
    if (!sweep) {
      return c.json({ error: "Sweep not found" }, 404);
    }
    
    // Verify ownership
    if (sweep.userId !== userId) {
      return c.json({ error: "Not authorized to view this sweep" }, 403);
    }
    
    return c.json(sweep);
  });
  
  return {
    app,
    quoteStore,
    sweepStore,
    sessionStore,
    setX402Enabled: (enabled: boolean) => { x402Enabled = enabled; },
    setX402PaymentReceived: (received: boolean) => { x402PaymentReceived = received; },
  };
}

describe("Sweep API", () => {
  let app: Hono;
  let quoteStore: Map<string, any>;
  let sweepStore: Map<string, any>;
  let sessionStore: Map<string, any>;
  let setX402Enabled: (enabled: boolean) => void;
  let setX402PaymentReceived: (received: boolean) => void;
  
  const testUserId = generateTestUserId();
  const testWallet = generateTestWalletAddress();
  const testSessionToken = "test-session-token";
  
  beforeEach(() => {
    const testApp = createTestApp();
    app = testApp.app;
    quoteStore = testApp.quoteStore;
    sweepStore = testApp.sweepStore;
    sessionStore = testApp.sessionStore;
    setX402Enabled = testApp.setX402Enabled;
    setX402PaymentReceived = testApp.setX402PaymentReceived;
    
    // Reset state
    setX402Enabled(false);
    setX402PaymentReceived(false);
    
    // Create test session
    sessionStore.set(testSessionToken, {
      userId: testUserId,
      walletAddress: testWallet,
      expiresAt: Date.now() + 3600000, // 1 hour
    });
    
    vi.clearAllMocks();
  });
  
  describe("POST /api/sweep", () => {
    it("should require authentication", async () => {
      const res = await app.request("/api/sweep", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet: testWallet,
          quoteId: crypto.randomUUID(),
          signature: "0xsignature",
        }),
      });
      
      expect(res.status).toBe(401);
      
      const body = await res.json();
      expect(body.error).toBe("Authentication required");
    });
    
    it("should reject invalid session", async () => {
      const res = await app.request("/api/sweep", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-session-token": "invalid-token",
        },
        body: JSON.stringify({
          wallet: testWallet,
          quoteId: crypto.randomUUID(),
          signature: "0xsignature",
        }),
      });
      
      expect(res.status).toBe(401);
      
      const body = await res.json();
      expect(body.error).toBe("Invalid session");
    });
    
    it("should reject expired session", async () => {
      const expiredToken = "expired-session";
      sessionStore.set(expiredToken, {
        userId: testUserId,
        walletAddress: testWallet,
        expiresAt: Date.now() - 1000, // Expired
      });
      
      const res = await app.request("/api/sweep", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-session-token": expiredToken,
        },
        body: JSON.stringify({
          wallet: testWallet,
          quoteId: crypto.randomUUID(),
          signature: "0xsignature",
        }),
      });
      
      expect(res.status).toBe(401);
      
      const body = await res.json();
      expect(body.error).toBe("Session expired");
    });
    
    it("should create a sweep with valid request", async () => {
      const quoteId = crypto.randomUUID();
      
      // Create a quote
      quoteStore.set(quoteId, {
        quoteId,
        wallet: testWallet,
        tokens: [{ address: "0x1234", chain: "base", usdValue: 5 }],
        destination: { chain: "base", token: "0x5678" },
        summary: { totalInputValueUsd: 5, netValueUsd: 4.9 },
        expiresAt: Date.now() + 300000,
      });
      
      const res = await app.request("/api/sweep", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-session-token": testSessionToken,
        },
        body: JSON.stringify({
          wallet: testWallet,
          quoteId,
          signature: "0x1234567890",
        }),
      });
      
      expect(res.status).toBe(202);
      
      const body = await res.json();
      expect(body.sweepId).toBeDefined();
      expect(body.status).toBe("pending");
      expect(body.message).toContain("queued");
    });
    
    it("should reject sweep for different wallet", async () => {
      const quoteId = crypto.randomUUID();
      const differentWallet = generateTestWalletAddress();
      
      // Create a quote for a different wallet
      quoteStore.set(quoteId, {
        quoteId,
        wallet: differentWallet, // Different wallet
        tokens: [],
        destination: {},
        summary: {},
        expiresAt: Date.now() + 300000,
      });
      
      const res = await app.request("/api/sweep", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-session-token": testSessionToken,
        },
        body: JSON.stringify({
          wallet: testWallet, // Trying to sweep our wallet
          quoteId,
          signature: "0x1234567890",
        }),
      });
      
      expect(res.status).toBe(400);
      
      const body = await res.json();
      expect(body.error).toBe("Quote is for a different wallet");
    });
    
    it("should reject if wallet ownership mismatch", async () => {
      const otherWallet = generateTestWalletAddress();
      const quoteId = crypto.randomUUID();
      
      quoteStore.set(quoteId, {
        quoteId,
        wallet: otherWallet,
        tokens: [],
        destination: {},
        summary: {},
        expiresAt: Date.now() + 300000,
      });
      
      const res = await app.request("/api/sweep", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-session-token": testSessionToken,
        },
        body: JSON.stringify({
          wallet: otherWallet, // Different from session wallet
          quoteId,
          signature: "0x1234567890",
        }),
      });
      
      expect(res.status).toBe(403);
      
      const body = await res.json();
      expect(body.error).toBe("Not authorized to sweep this wallet");
    });
    
    it("should return 404 for non-existent quote", async () => {
      const res = await app.request("/api/sweep", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-session-token": testSessionToken,
        },
        body: JSON.stringify({
          wallet: testWallet,
          quoteId: crypto.randomUUID(), // Non-existent
          signature: "0x1234567890",
        }),
      });
      
      expect(res.status).toBe(404);
      
      const body = await res.json();
      expect(body.error).toBe("Quote not found");
    });
    
    it("should return 410 for expired quote", async () => {
      const quoteId = crypto.randomUUID();
      
      // Create an expired quote
      quoteStore.set(quoteId, {
        quoteId,
        wallet: testWallet,
        tokens: [],
        destination: {},
        summary: {},
        expiresAt: Date.now() - 1000, // Expired
      });
      
      const res = await app.request("/api/sweep", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-session-token": testSessionToken,
        },
        body: JSON.stringify({
          wallet: testWallet,
          quoteId,
          signature: "0x1234567890",
        }),
      });
      
      expect(res.status).toBe(410);
      
      const body = await res.json();
      expect(body.error).toBe("Quote expired");
    });
    
    it("should queue sweep execution job", async () => {
      const quoteId = crypto.randomUUID();
      
      quoteStore.set(quoteId, {
        quoteId,
        wallet: testWallet,
        tokens: [],
        destination: {},
        summary: {},
        expiresAt: Date.now() + 300000,
      });
      
      await app.request("/api/sweep", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-session-token": testSessionToken,
        },
        body: JSON.stringify({
          wallet: testWallet,
          quoteId,
          signature: "0x1234567890",
        }),
      });
      
      expect(mockQueue.addSweepExecuteJob).toHaveBeenCalledWith(
        expect.objectContaining({
          quoteId,
          walletAddress: testWallet,
          signature: "0x1234567890",
        })
      );
    });
    
    it("should create sweep record in store", async () => {
      const quoteId = crypto.randomUUID();
      
      quoteStore.set(quoteId, {
        quoteId,
        wallet: testWallet,
        tokens: [{ address: "0x1234", chain: "base" }],
        destination: { chain: "base", token: "0x5678" },
        summary: { netValueUsd: 4.9 },
        expiresAt: Date.now() + 300000,
      });
      
      const res = await app.request("/api/sweep", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-session-token": testSessionToken,
        },
        body: JSON.stringify({
          wallet: testWallet,
          quoteId,
          signature: "0x1234567890",
        }),
      });
      
      const body = await res.json();
      const sweep = sweepStore.get(body.sweepId);
      
      expect(sweep).toBeDefined();
      expect(sweep.userId).toBe(testUserId);
      expect(sweep.status).toBe("pending");
      expect(sweep.quoteId).toBe(quoteId);
    });
  });
  
  describe("x402 payment flow", () => {
    it("should require payment when x402 is enabled", async () => {
      setX402Enabled(true);
      
      const quoteId = crypto.randomUUID();
      
      quoteStore.set(quoteId, {
        quoteId,
        wallet: testWallet,
        tokens: [],
        destination: {},
        summary: {},
        expiresAt: Date.now() + 300000,
      });
      
      const res = await app.request("/api/sweep", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-session-token": testSessionToken,
        },
        body: JSON.stringify({
          wallet: testWallet,
          quoteId,
          signature: "0x1234567890",
        }),
      });
      
      expect(res.status).toBe(402);
      
      const body = await res.json();
      expect(body.error).toBe("Payment required");
      expect(body.paymentDetails).toBeDefined();
    });
    
    it("should accept valid payment and process sweep", async () => {
      setX402Enabled(true);
      
      const quoteId = crypto.randomUUID();
      
      quoteStore.set(quoteId, {
        quoteId,
        wallet: testWallet,
        tokens: [],
        destination: {},
        summary: {},
        expiresAt: Date.now() + 300000,
      });
      
      const res = await app.request("/api/sweep", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-session-token": testSessionToken,
          "x-payment-402": "valid-payment",
        },
        body: JSON.stringify({
          wallet: testWallet,
          quoteId,
          signature: "0x1234567890",
        }),
      });
      
      expect(res.status).toBe(202);
    });
  });
  
  describe("GET /api/sweep/:id", () => {
    it("should retrieve sweep status", async () => {
      const sweepId = crypto.randomUUID();
      
      sweepStore.set(sweepId, {
        id: sweepId,
        userId: testUserId,
        status: "pending",
        wallet: testWallet,
        createdAt: Date.now(),
      });
      
      const res = await app.request(`/api/sweep/${sweepId}`, {
        headers: {
          "x-session-token": testSessionToken,
        },
      });
      
      expect(res.status).toBe(200);
      
      const body = await res.json();
      expect(body.id).toBe(sweepId);
      expect(body.status).toBe("pending");
    });
    
    it("should return 404 for non-existent sweep", async () => {
      const res = await app.request(`/api/sweep/${crypto.randomUUID()}`, {
        headers: {
          "x-session-token": testSessionToken,
        },
      });
      
      expect(res.status).toBe(404);
    });
    
    it("should not allow viewing other users sweeps", async () => {
      const sweepId = crypto.randomUUID();
      
      sweepStore.set(sweepId, {
        id: sweepId,
        userId: "different-user", // Different user
        status: "pending",
        wallet: generateTestWalletAddress(),
        createdAt: Date.now(),
      });
      
      const res = await app.request(`/api/sweep/${sweepId}`, {
        headers: {
          "x-session-token": testSessionToken,
        },
      });
      
      expect(res.status).toBe(403);
    });
  });
});
