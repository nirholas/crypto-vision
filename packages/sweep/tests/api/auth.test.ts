import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import {
  generateTestWalletAddress,
  mockRedisStore,
} from "../setup.js";

// Create test app with auth routes
function createTestApp() {
  const app = new Hono();
  
  // In-memory stores
  const nonceStore = new Map<string, { nonce: string; expiresAt: number }>();
  const sessionStore = new Map<string, any>();
  const userStore = new Map<string, any>();
  
  // Generate nonce
  function generateNonce(): string {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let nonce = "";
    for (let i = 0; i < 17; i++) {
      nonce += chars[Math.floor(Math.random() * chars.length)];
    }
    return nonce;
  }
  
  // GET /auth/nonce
  app.get("/auth/nonce", async (c) => {
    const walletAddress = c.req.query("address");
    
    if (!walletAddress) {
      return c.json({ error: "Wallet address required" }, 400);
    }
    
    // Validate address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      return c.json({ error: "Invalid wallet address format" }, 400);
    }
    
    const nonce = generateNonce();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes
    
    // Store nonce
    nonceStore.set(walletAddress.toLowerCase(), { nonce, expiresAt });
    
    return c.json({
      nonce,
      expiresAt,
      message: `Sign this message to authenticate with Sweep.\n\nNonce: ${nonce}`,
    });
  });
  
  // POST /auth/verify
  app.post("/auth/verify", async (c) => {
    let body: any;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }
    
    const { message, signature } = body;
    
    if (!message || !signature) {
      return c.json({ error: "Message and signature required" }, 400);
    }
    
    // Parse the SIWE message (simplified)
    let address: string;
    let nonce: string;
    let domain: string;
    let chainId: number;
    
    try {
      // Extract address from message
      const addressMatch = message.match(/0x[a-fA-F0-9]{40}/);
      if (!addressMatch) {
        throw new Error("No address in message");
      }
      address = addressMatch[0].toLowerCase();
      
      // Extract nonce
      const nonceMatch = message.match(/Nonce: ([A-Za-z0-9]+)/);
      if (!nonceMatch) {
        throw new Error("No nonce in message");
      }
      nonce = nonceMatch[1];
      
      // Extract domain (default)
      domain = "sweep.finance";
      chainId = 8453; // Base
    } catch (error) {
      return c.json({ error: "Invalid message format" }, 400);
    }
    
    // Verify nonce
    const storedNonce = nonceStore.get(address);
    if (!storedNonce) {
      return c.json({ error: "No nonce found for this address" }, 400);
    }
    
    if (storedNonce.nonce !== nonce) {
      return c.json({ error: "Invalid nonce" }, 400);
    }
    
    if (storedNonce.expiresAt < Date.now()) {
      nonceStore.delete(address);
      return c.json({ error: "Nonce expired" }, 400);
    }
    
    // Verify signature (simplified - in production would use siwe library)
    if (!signature.startsWith("0x") || signature.length < 10) {
      return c.json({ error: "Invalid signature format" }, 400);
    }
    
    // Delete used nonce
    nonceStore.delete(address);
    
    // Find or create user
    let user = userStore.get(address);
    if (!user) {
      user = {
        id: crypto.randomUUID(),
        walletAddress: address,
        createdAt: Date.now(),
        lastActive: Date.now(),
      };
      userStore.set(address, user);
    } else {
      user.lastActive = Date.now();
    }
    
    // Create session
    const token = Buffer.from(
      `${user.id}:${Date.now()}:${Math.random().toString(36).slice(2)}`
    ).toString("base64url");
    
    const session = {
      userId: user.id,
      walletAddress: address,
      chainId,
      issuedAt: Date.now(),
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
    };
    
    sessionStore.set(token, session);
    
    return c.json({
      success: true,
      token,
      user: {
        id: user.id,
        walletAddress: address,
      },
      expiresAt: session.expiresAt,
    });
  });
  
  // POST /auth/logout
  app.post("/auth/logout", async (c) => {
    const token = c.req.header("x-session-token");
    
    if (!token) {
      return c.json({ error: "No session token provided" }, 400);
    }
    
    const session = sessionStore.get(token);
    if (!session) {
      return c.json({ error: "Invalid session" }, 400);
    }
    
    // Delete session
    sessionStore.delete(token);
    
    return c.json({
      success: true,
      message: "Logged out successfully",
    });
  });
  
  // GET /auth/session
  app.get("/auth/session", async (c) => {
    const token = c.req.header("x-session-token");
    
    if (!token) {
      return c.json({ error: "No session token provided" }, 401);
    }
    
    const session = sessionStore.get(token);
    if (!session) {
      return c.json({ error: "Invalid session" }, 401);
    }
    
    if (session.expiresAt < Date.now()) {
      sessionStore.delete(token);
      return c.json({ error: "Session expired" }, 401);
    }
    
    const user = userStore.get(session.walletAddress);
    
    return c.json({
      userId: session.userId,
      walletAddress: session.walletAddress,
      chainId: session.chainId,
      expiresAt: session.expiresAt,
      user: user ? {
        id: user.id,
        walletAddress: user.walletAddress,
        createdAt: user.createdAt,
      } : null,
    });
  });
  
  return { app, nonceStore, sessionStore, userStore };
}

describe("Auth API", () => {
  let app: Hono;
  let nonceStore: Map<string, { nonce: string; expiresAt: number }>;
  let sessionStore: Map<string, any>;
  let userStore: Map<string, any>;
  
  beforeEach(() => {
    const testApp = createTestApp();
    app = testApp.app;
    nonceStore = testApp.nonceStore;
    sessionStore = testApp.sessionStore;
    userStore = testApp.userStore;
  });
  
  describe("GET /auth/nonce", () => {
    it("should return a nonce for valid wallet address", async () => {
      const address = generateTestWalletAddress();
      
      const res = await app.request(`/auth/nonce?address=${address}`);
      
      expect(res.status).toBe(200);
      
      const body = await res.json();
      expect(body.nonce).toBeDefined();
      expect(body.nonce.length).toBe(17);
      expect(body.expiresAt).toBeDefined();
      expect(body.message).toContain(body.nonce);
    });
    
    it("should require wallet address", async () => {
      const res = await app.request("/auth/nonce");
      
      expect(res.status).toBe(400);
      
      const body = await res.json();
      expect(body.error).toBe("Wallet address required");
    });
    
    it("should reject invalid wallet address format", async () => {
      const res = await app.request("/auth/nonce?address=invalid");
      
      expect(res.status).toBe(400);
      
      const body = await res.json();
      expect(body.error).toBe("Invalid wallet address format");
    });
    
    it("should store nonce for later verification", async () => {
      const address = generateTestWalletAddress();
      
      await app.request(`/auth/nonce?address=${address}`);
      
      const stored = nonceStore.get(address.toLowerCase());
      expect(stored).toBeDefined();
      expect(stored!.nonce).toBeDefined();
      expect(stored!.expiresAt).toBeGreaterThan(Date.now());
    });
    
    it("should include message with nonce", async () => {
      const address = generateTestWalletAddress();
      
      const res = await app.request(`/auth/nonce?address=${address}`);
      const body = await res.json();
      
      expect(body.message).toContain("Sign this message");
      expect(body.message).toContain("Nonce:");
    });
    
    it("should set expiration ~10 minutes in future", async () => {
      const address = generateTestWalletAddress();
      const before = Date.now();
      
      const res = await app.request(`/auth/nonce?address=${address}`);
      const body = await res.json();
      
      const after = Date.now();
      
      // Should expire in ~10 minutes (600000ms)
      expect(body.expiresAt).toBeGreaterThan(before + 590000);
      expect(body.expiresAt).toBeLessThan(after + 610000);
    });
  });
  
  describe("POST /auth/verify", () => {
    it("should verify valid SIWE message and return session", async () => {
      const address = generateTestWalletAddress();
      
      // Get nonce
      const nonceRes = await app.request(`/auth/nonce?address=${address}`);
      const { nonce } = await nonceRes.json();
      
      // Create SIWE-like message
      const message = `sweep.finance wants you to sign in with your Ethereum account:
${address}

Sign this message to authenticate with Sweep.

URI: https://sweep.finance
Version: 1
Chain ID: 8453
Nonce: ${nonce}
Issued At: ${new Date().toISOString()}`;
      
      const res = await app.request("/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          signature: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef12",
        }),
      });
      
      expect(res.status).toBe(200);
      
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.token).toBeDefined();
      expect(body.user).toBeDefined();
      expect(body.user.walletAddress).toBe(address.toLowerCase());
      expect(body.expiresAt).toBeDefined();
    });
    
    it("should require message and signature", async () => {
      const res = await app.request("/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      
      expect(res.status).toBe(400);
      
      const body = await res.json();
      expect(body.error).toBe("Message and signature required");
    });
    
    it("should reject invalid message format", async () => {
      const res = await app.request("/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "invalid message without address",
          signature: "0x1234567890",
        }),
      });
      
      expect(res.status).toBe(400);
      
      const body = await res.json();
      expect(body.error).toBe("Invalid message format");
    });
    
    it("should reject if no nonce exists for address", async () => {
      const address = generateTestWalletAddress();
      
      const message = `sweep.finance wants you to sign in with your Ethereum account:
${address}

Sign this message.

Nonce: someRandomNonce`;
      
      const res = await app.request("/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          signature: "0x1234567890",
        }),
      });
      
      expect(res.status).toBe(400);
      
      const body = await res.json();
      expect(body.error).toBe("No nonce found for this address");
    });
    
    it("should reject invalid nonce", async () => {
      const address = generateTestWalletAddress();
      
      // Get nonce
      await app.request(`/auth/nonce?address=${address}`);
      
      // Use wrong nonce
      const message = `sweep.finance wants you to sign in with your Ethereum account:
${address}

Sign this message.

Nonce: wrongNonce12345`;
      
      const res = await app.request("/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          signature: "0x1234567890",
        }),
      });
      
      expect(res.status).toBe(400);
      
      const body = await res.json();
      expect(body.error).toBe("Invalid nonce");
    });
    
    it("should reject expired nonce", async () => {
      const address = generateTestWalletAddress().toLowerCase();
      
      // Set expired nonce
      nonceStore.set(address, {
        nonce: "expiredNonce1234",
        expiresAt: Date.now() - 1000,
      });
      
      const message = `sweep.finance wants you to sign in with your Ethereum account:
${address}

Sign this message.

Nonce: expiredNonce1234`;
      
      const res = await app.request("/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          signature: "0x1234567890",
        }),
      });
      
      expect(res.status).toBe(400);
      
      const body = await res.json();
      expect(body.error).toBe("Nonce expired");
    });
    
    it("should delete nonce after successful verification", async () => {
      const address = generateTestWalletAddress();
      
      // Get nonce
      const nonceRes = await app.request(`/auth/nonce?address=${address}`);
      const { nonce } = await nonceRes.json();
      
      const message = `sweep.finance wants you to sign in with your Ethereum account:
${address}

Sign this message.

Nonce: ${nonce}`;
      
      await app.request("/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          signature: "0x1234567890abcdef",
        }),
      });
      
      // Nonce should be deleted
      expect(nonceStore.get(address.toLowerCase())).toBeUndefined();
    });
    
    it("should create user on first login", async () => {
      const address = generateTestWalletAddress();
      
      // Get nonce
      const nonceRes = await app.request(`/auth/nonce?address=${address}`);
      const { nonce } = await nonceRes.json();
      
      const message = `sweep.finance wants you to sign in with your Ethereum account:
${address}

Sign this message.

Nonce: ${nonce}`;
      
      await app.request("/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          signature: "0x1234567890abcdef",
        }),
      });
      
      const user = userStore.get(address.toLowerCase());
      expect(user).toBeDefined();
      expect(user.walletAddress).toBe(address.toLowerCase());
    });
    
    it("should create session in store", async () => {
      const address = generateTestWalletAddress();
      
      // Get nonce
      const nonceRes = await app.request(`/auth/nonce?address=${address}`);
      const { nonce } = await nonceRes.json();
      
      const message = `sweep.finance wants you to sign in with your Ethereum account:
${address}

Sign this message.

Nonce: ${nonce}`;
      
      const res = await app.request("/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          signature: "0x1234567890abcdef",
        }),
      });
      
      const { token } = await res.json();
      
      const session = sessionStore.get(token);
      expect(session).toBeDefined();
      expect(session.walletAddress).toBe(address.toLowerCase());
    });
  });
  
  describe("POST /auth/logout", () => {
    it("should clear session on logout", async () => {
      // Create a session
      const token = "test-token-to-logout";
      sessionStore.set(token, {
        userId: "test-user",
        walletAddress: generateTestWalletAddress().toLowerCase(),
        expiresAt: Date.now() + 3600000,
      });
      
      const res = await app.request("/auth/logout", {
        method: "POST",
        headers: {
          "x-session-token": token,
        },
      });
      
      expect(res.status).toBe(200);
      
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.message).toContain("Logged out");
      
      // Session should be deleted
      expect(sessionStore.get(token)).toBeUndefined();
    });
    
    it("should require session token", async () => {
      const res = await app.request("/auth/logout", {
        method: "POST",
      });
      
      expect(res.status).toBe(400);
      
      const body = await res.json();
      expect(body.error).toBe("No session token provided");
    });
    
    it("should reject invalid session", async () => {
      const res = await app.request("/auth/logout", {
        method: "POST",
        headers: {
          "x-session-token": "invalid-token",
        },
      });
      
      expect(res.status).toBe(400);
      
      const body = await res.json();
      expect(body.error).toBe("Invalid session");
    });
  });
  
  describe("GET /auth/session", () => {
    it("should return session info for valid token", async () => {
      const address = generateTestWalletAddress().toLowerCase();
      const userId = crypto.randomUUID();
      const token = "valid-session-token";
      
      // Create user and session
      userStore.set(address, {
        id: userId,
        walletAddress: address,
        createdAt: Date.now(),
      });
      
      sessionStore.set(token, {
        userId,
        walletAddress: address,
        chainId: 8453,
        expiresAt: Date.now() + 3600000,
      });
      
      const res = await app.request("/auth/session", {
        headers: {
          "x-session-token": token,
        },
      });
      
      expect(res.status).toBe(200);
      
      const body = await res.json();
      expect(body.userId).toBe(userId);
      expect(body.walletAddress).toBe(address);
      expect(body.user).toBeDefined();
    });
    
    it("should reject missing token", async () => {
      const res = await app.request("/auth/session");
      
      expect(res.status).toBe(401);
    });
    
    it("should reject expired session", async () => {
      const token = "expired-session-token";
      
      sessionStore.set(token, {
        userId: "test-user",
        walletAddress: generateTestWalletAddress().toLowerCase(),
        expiresAt: Date.now() - 1000, // Expired
      });
      
      const res = await app.request("/auth/session", {
        headers: {
          "x-session-token": token,
        },
      });
      
      expect(res.status).toBe(401);
      
      const body = await res.json();
      expect(body.error).toBe("Session expired");
    });
  });
});
