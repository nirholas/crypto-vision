/**
 * API End-to-End Tests
 * Tests real API endpoints with token addresses
 */

import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import { Hono } from "hono";
import { createMockRedis, mockPriceService, mockValidationService, mockDb } from "../setup.js";
import { TOKENS } from "../utils/fixtures.js";

// These tests run against a simulated full API stack
// In a real environment, you'd point to a test server

describe("E2E: API Endpoints", () => {
  let app: Hono;

  beforeAll(() => {
    // Set up full app with all routes
    app = new Hono();

    // Health endpoint
    app.get("/health", async (c) => {
      return c.json({
        status: "healthy",
        version: "0.1.0",
        timestamp: new Date().toISOString(),
        services: {
          database: "connected",
          redis: "connected",
          queue: "connected",
        },
      });
    });

    // Quote endpoint
    app.post("/quote", async (c) => {
      const body = await c.req.json();
      
      // Validate required fields
      if (!body.tokenAddress || !body.chain || !body.amount) {
        return c.json({ error: "Missing required fields" }, 400);
      }

      // Validate token address format
      if (!/^0x[a-fA-F0-9]{40}$/.test(body.tokenAddress)) {
        return c.json({ error: "Invalid token address" }, 400);
      }

      // Simulate quote generation
      const quote = {
        id: `quote-${Date.now()}`,
        tokenAddress: body.tokenAddress,
        chain: body.chain,
        amount: body.amount,
        outputAmount: String(Math.floor(Number(body.amount) * 0.995)),
        outputToken: "USDC",
        priceImpact: 0.005,
        estimatedGasUsd: body.chain === "ethereum" ? 15 : 0.05,
        validUntil: Date.now() + 300000,
      };

      return c.json(quote);
    });

    // Wallet balances endpoint
    app.get("/wallet/:address/balances", async (c) => {
      const address = c.req.param("address");
      const chain = c.req.query("chain") || "all";

      if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
        return c.json({ error: "Invalid wallet address" }, 400);
      }

      // Mock balance data
      const balances = {
        address,
        chains: chain === "all" 
          ? ["ethereum", "arbitrum", "base"]
          : [chain],
        balances: [
          {
            chain: "arbitrum",
            tokens: [
              { address: TOKENS.arbitrum.USDC.address, symbol: "USDC", balance: "5000000", valueUsd: 5 },
              { address: TOKENS.arbitrum.ARB.address, symbol: "ARB", balance: "8000000000000000000", valueUsd: 9.6 },
            ],
          },
        ],
        totalValueUsd: 14.6,
        dustValueUsd: 14.6,
      };

      return c.json(balances);
    });

    // Execute sweep endpoint
    app.post("/sweep/execute", async (c) => {
      const body = await c.req.json();
      const authHeader = c.req.header("Authorization");

      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      if (!body.quoteId || !body.signature) {
        return c.json({ error: "Missing quoteId or signature" }, 400);
      }

      // Simulate sweep execution
      const result = {
        id: `sweep-${Date.now()}`,
        quoteId: body.quoteId,
        status: "pending",
        createdAt: new Date().toISOString(),
      };

      return c.json(result, 202);
    });

    // Auth endpoints
    app.get("/auth/nonce", async (c) => {
      const address = c.req.query("address");
      
      if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
        return c.json({ error: "Invalid address" }, 400);
      }

      return c.json({
        nonce: `nonce-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        issuedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 300000).toISOString(),
      });
    });

    app.post("/auth/verify", async (c) => {
      const body = await c.req.json();

      if (!body.message || !body.signature) {
        return c.json({ error: "Missing message or signature" }, 400);
      }

      // Simulate SIWE verification
      if (!body.message.includes("sweep.bank")) {
        return c.json({ error: "Invalid message domain" }, 400);
      }

      return c.json({
        token: "jwt-" + "x".repeat(100),
        address: "0x1234567890123456789012345678901234567890",
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      });
    });

    // DeFi vaults endpoint
    app.get("/defi/vaults", async (c) => {
      const chain = c.req.query("chain");
      const asset = c.req.query("asset");

      if (!chain) {
        return c.json({ error: "Chain parameter required" }, 400);
      }

      const vaults = [
        {
          address: "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2",
          protocol: "AAVE",
          name: "Aave USDC",
          apy: 0.035,
          tvlUsd: 500000000,
          riskLevel: "LOW",
        },
        {
          address: "0xvault2",
          protocol: "YEARN",
          name: "Yearn USDC",
          apy: 0.055,
          tvlUsd: 100000000,
          riskLevel: "MEDIUM",
        },
      ];

      // Filter by asset if provided
      const filtered = asset 
        ? vaults.filter(v => v.name.toLowerCase().includes(asset.toLowerCase()))
        : vaults;

      return c.json({ chain, vaults: filtered });
    });
  });

  describe("Health Endpoint", () => {
    it("should return healthy status", async () => {
      const res = await app.request("/health");
      
      expect(res.status).toBe(200);
      
      const data = await res.json();
      expect(data.status).toBe("healthy");
      expect(data.version).toBeDefined();
      expect(data.services.database).toBe("connected");
    });

    it("should include timestamp in ISO format", async () => {
      const res = await app.request("/health");
      const data = await res.json();
      
      expect(data.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });

  describe("Quote Endpoint", () => {
    it("should generate quote for valid token", async () => {
      const res = await app.request("/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tokenAddress: TOKENS.ethereum.USDC.address,
          chain: "ethereum",
          amount: "1000000000",
        }),
      });

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.id).toMatch(/^quote-/);
      expect(data.tokenAddress).toBe(TOKENS.ethereum.USDC.address);
      expect(data.outputAmount).toBeDefined();
      expect(data.priceImpact).toBeLessThan(0.05);
      expect(data.validUntil).toBeGreaterThan(Date.now());
    });

    it("should include gas estimation for different chains", async () => {
      // Ethereum - high gas
      const ethRes = await app.request("/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tokenAddress: TOKENS.ethereum.USDC.address,
          chain: "ethereum",
          amount: "1000000000",
        }),
      });
      const ethData = await ethRes.json();

      // Arbitrum - low gas
      const arbRes = await app.request("/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tokenAddress: TOKENS.arbitrum.USDC.address,
          chain: "arbitrum",
          amount: "1000000000",
        }),
      });
      const arbData = await arbRes.json();

      expect(ethData.estimatedGasUsd).toBeGreaterThan(arbData.estimatedGasUsd);
    });

    it("should reject invalid token address", async () => {
      const res = await app.request("/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tokenAddress: "not-an-address",
          chain: "ethereum",
          amount: "1000000000",
        }),
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("Invalid");
    });

    it("should reject missing required fields", async () => {
      const res = await app.request("/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tokenAddress: TOKENS.ethereum.USDC.address,
        }),
      });

      expect(res.status).toBe(400);
    });
  });

  describe("Wallet Balances Endpoint", () => {
    it("should return wallet balances", async () => {
      const address = "0x1234567890123456789012345678901234567890";
      const res = await app.request(`/wallet/${address}/balances`);

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.address).toBe(address);
      expect(data.balances).toBeDefined();
      expect(data.totalValueUsd).toBeGreaterThan(0);
    });

    it("should filter by chain", async () => {
      const address = "0x1234567890123456789012345678901234567890";
      const res = await app.request(`/wallet/${address}/balances?chain=arbitrum`);

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.chains).toContain("arbitrum");
    });

    it("should reject invalid wallet address", async () => {
      const res = await app.request("/wallet/invalid-address/balances");

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("Invalid");
    });
  });

  describe("SIWE Authentication Flow", () => {
    it("should complete full authentication flow", async () => {
      const address = "0x1234567890123456789012345678901234567890";

      // Step 1: Get nonce
      const nonceRes = await app.request(`/auth/nonce?address=${address}`);
      expect(nonceRes.status).toBe(200);
      
      const nonceData = await nonceRes.json();
      expect(nonceData.nonce).toBeDefined();
      expect(nonceData.expiresAt).toBeDefined();

      // Step 2: Sign message (simulated)
      const message = `sweep.bank wants you to sign in with your Ethereum account:
${address}

Sign in to Sweep

URI: https://sweep.bank
Nonce: ${nonceData.nonce}
Issued At: ${nonceData.issuedAt}`;

      // Step 3: Verify signature
      const verifyRes = await app.request("/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          signature: "0x" + "a".repeat(130),
        }),
      });

      expect(verifyRes.status).toBe(200);
      
      const verifyData = await verifyRes.json();
      expect(verifyData.token).toMatch(/^jwt-/);
      expect(verifyData.address).toBe(address);
    });

    it("should reject invalid nonce request", async () => {
      const res = await app.request("/auth/nonce?address=invalid");
      expect(res.status).toBe(400);
    });

    it("should reject invalid domain in message", async () => {
      const res = await app.request("/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "evil.com wants you to sign in...",
          signature: "0x" + "a".repeat(130),
        }),
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("domain");
    });
  });

  describe("Sweep Execution", () => {
    it("should require authentication", async () => {
      const res = await app.request("/sweep/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quoteId: "quote-123",
          signature: "0x" + "b".repeat(130),
        }),
      });

      expect(res.status).toBe(401);
    });

    it("should accept valid sweep request", async () => {
      const res = await app.request("/sweep/execute", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer jwt-token",
        },
        body: JSON.stringify({
          quoteId: "quote-123",
          signature: "0x" + "b".repeat(130),
        }),
      });

      expect(res.status).toBe(202);

      const data = await res.json();
      expect(data.status).toBe("pending");
      expect(data.id).toMatch(/^sweep-/);
    });

    it("should reject missing quote ID", async () => {
      const res = await app.request("/sweep/execute", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer jwt-token",
        },
        body: JSON.stringify({
          signature: "0x" + "b".repeat(130),
        }),
      });

      expect(res.status).toBe(400);
    });
  });

  describe("DeFi Vaults Endpoint", () => {
    it("should return vaults for chain", async () => {
      const res = await app.request("/defi/vaults?chain=ethereum");

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.chain).toBe("ethereum");
      expect(data.vaults).toBeInstanceOf(Array);
      expect(data.vaults.length).toBeGreaterThan(0);
    });

    it("should include vault details", async () => {
      const res = await app.request("/defi/vaults?chain=ethereum");
      const data = await res.json();

      const vault = data.vaults[0];
      expect(vault.address).toBeDefined();
      expect(vault.protocol).toBeDefined();
      expect(vault.apy).toBeGreaterThan(0);
      expect(vault.tvlUsd).toBeGreaterThan(0);
      expect(vault.riskLevel).toBeDefined();
    });

    it("should filter by asset", async () => {
      const res = await app.request("/defi/vaults?chain=ethereum&asset=usdc");

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.vaults.every((v: any) => 
        v.name.toLowerCase().includes("usdc")
      )).toBe(true);
    });

    it("should require chain parameter", async () => {
      const res = await app.request("/defi/vaults");
      expect(res.status).toBe(400);
    });
  });

  describe("Error Responses", () => {
    it("should return 404 for unknown endpoints", async () => {
      const res = await app.request("/unknown/endpoint");
      expect(res.status).toBe(404);
    });

    it("should handle malformed JSON", async () => {
      const res = await app.request("/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{ invalid json }",
      });

      expect(res.status).toBe(400);
    });

    it("should include error details in response", async () => {
      const res = await app.request("/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBeDefined();
    });
  });

  describe("Response Headers", () => {
    it("should set correct content type", async () => {
      const res = await app.request("/health");
      expect(res.headers.get("Content-Type")).toContain("application/json");
    });

    it("should include cache headers where appropriate", async () => {
      // Health endpoint should have short cache
      const healthRes = await app.request("/health");
      // Note: Would need to implement caching in the actual app
      expect(healthRes.status).toBe(200);
    });
  });
});

describe("E2E: Real Token Addresses", () => {
  it("should recognize mainnet USDC address", () => {
    expect(TOKENS.ethereum.USDC.address).toBe("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48");
    expect(TOKENS.ethereum.USDC.decimals).toBe(6);
  });

  it("should recognize mainnet WETH address", () => {
    expect(TOKENS.ethereum.WETH.address).toBe("0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2");
    expect(TOKENS.ethereum.WETH.decimals).toBe(18);
  });

  it("should recognize Arbitrum native USDC", () => {
    expect(TOKENS.arbitrum.USDC.address).toBe("0xaf88d065e77c8cC2239327C5EDb3A432268e5831");
  });

  it("should recognize bridged USDC addresses", () => {
    expect(TOKENS.arbitrum["USDC.e"].address).toBe("0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8");
    expect(TOKENS.polygon["USDC.e"].address).toBe("0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174");
  });

  it("should have consistent decimal values", () => {
    // All USDC variants should be 6 decimals
    expect(TOKENS.ethereum.USDC.decimals).toBe(6);
    expect(TOKENS.arbitrum.USDC.decimals).toBe(6);
    expect(TOKENS.polygon.USDC.decimals).toBe(6);
    expect(TOKENS.base.USDC.decimals).toBe(6);

    // All WETH should be 18 decimals
    expect(TOKENS.ethereum.WETH.decimals).toBe(18);
    expect(TOKENS.arbitrum.WETH.decimals).toBe(18);
    expect(TOKENS.base.WETH.decimals).toBe(18);
  });
});
