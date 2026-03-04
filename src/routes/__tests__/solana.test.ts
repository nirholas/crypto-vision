/**
 * Integration tests for Solana routes.
 *
 * Mocks the Jupiter source adapter so no real HTTP calls are made.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";

// ─── Mock sources BEFORE importing routes ────────────────────

vi.mock("../../sources/jupiter.js", () => ({
  getPrice: vi.fn(),
  getPriceVs: vi.fn(),
  getQuote: vi.fn(),
  getTokenList: vi.fn(),
  getStrictTokenList: vi.fn(),
  getPopularPrices: vi.fn(),
  getTopTokensByMarketCap: vi.fn(),
  searchTokens: vi.fn(),
  POPULAR_MINTS: {
    SOL: "So11111111111111111111111111111111111111112",
    USDC: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  },
}));

import * as jupiter from "../../sources/jupiter.js";
import { solanaRoutes } from "../solana.js";

const app = new Hono().route("/api/solana", solanaRoutes);

beforeEach(() => {
  vi.clearAllMocks();
});

// ═══════════════════════════════════════════════════════════════
// GET /api/solana/price/:token
// ═══════════════════════════════════════════════════════════════

describe("GET /api/solana/price/:token", () => {
  it("returns price for a token", async () => {
    vi.mocked(jupiter.getPrice).mockResolvedValue({
      data: {
        SOL: { id: "SOL", mintSymbol: "SOL", vsToken: "USDC", vsTokenSymbol: "USDC", price: 150.5 },
      },
    } as any);

    const res = await app.request("/api/solana/price/SOL");
    expect(res.status).toBe(200);

    const json = (await res.json()) as Record<string, any>;
    expect(json.data.SOL.price).toBe(150.5);
    expect(jupiter.getPrice).toHaveBeenCalledWith("SOL");
  });

  it("returns price vs another token when vs param provided", async () => {
    vi.mocked(jupiter.getPriceVs).mockResolvedValue({
      data: {
        SOL: { id: "SOL", price: 0.00225 },
      },
    } as any);

    const res = await app.request("/api/solana/price/SOL?vs=BTC_MINT");
    expect(res.status).toBe(200);

    expect(jupiter.getPriceVs).toHaveBeenCalledWith("SOL", "BTC_MINT");
  });

  it("propagates source errors as 500", async () => {
    vi.mocked(jupiter.getPrice).mockRejectedValue(new Error("Jupiter API down"));

    const res = await app.request("/api/solana/price/SOL");
    expect(res.status).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/solana/prices
// ═══════════════════════════════════════════════════════════════

describe("GET /api/solana/prices", () => {
  it("returns batch prices for multiple ids", async () => {
    vi.mocked(jupiter.getPrice).mockResolvedValue({
      data: {
        SOL: { id: "SOL", price: 150 },
        BONK: { id: "BONK", price: 0.00002 },
      },
    } as any);

    const res = await app.request("/api/solana/prices?ids=SOL,BONK");
    expect(res.status).toBe(200);

    const json = (await res.json()) as Record<string, any>;
    expect(json.data.SOL.price).toBe(150);
    expect(json.data.BONK.price).toBe(0.00002);
  });

  it("returns 400 when ids parameter missing", async () => {
    const res = await app.request("/api/solana/prices");
    expect(res.status).toBe(400);

    const json = (await res.json()) as Record<string, any>;
    expect(json.error).toContain("Missing");
  });

  it("uses getPriceVs when vs param provided", async () => {
    vi.mocked(jupiter.getPriceVs).mockResolvedValue({ data: {} } as any);

    const res = await app.request("/api/solana/prices?ids=SOL&vs=USDC_MINT");
    expect(res.status).toBe(200);

    expect(jupiter.getPriceVs).toHaveBeenCalledWith("SOL", "USDC_MINT");
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/solana/quote
// ═══════════════════════════════════════════════════════════════

describe("GET /api/solana/quote", () => {
  it("returns swap quote", async () => {
    vi.mocked(jupiter.getQuote).mockResolvedValue({
      inputMint: "SOL_MINT",
      outputMint: "USDC_MINT",
      inAmount: "1000000000",
      outAmount: "150500000",
      otherAmountThreshold: "149000000",
      routePlan: [],
    } as any);

    const res = await app.request(
      "/api/solana/quote?inputMint=SOL_MINT&outputMint=USDC_MINT&amount=1000000000",
    );
    expect(res.status).toBe(200);

    const json = (await res.json()) as Record<string, any>;
    expect(json.inAmount).toBe("1000000000");
    expect(json.outAmount).toBe("150500000");
    expect(jupiter.getQuote).toHaveBeenCalledWith("SOL_MINT", "USDC_MINT", "1000000000", undefined);
  });

  it("passes slippageBps when provided", async () => {
    vi.mocked(jupiter.getQuote).mockResolvedValue({} as any);

    await app.request(
      "/api/solana/quote?inputMint=A&outputMint=B&amount=100&slippageBps=50",
    );
    expect(jupiter.getQuote).toHaveBeenCalledWith("A", "B", "100", 50);
  });

  it("returns 400 when required params missing", async () => {
    const res = await app.request("/api/solana/quote?inputMint=A");
    expect(res.status).toBe(400);

    const json = (await res.json()) as Record<string, any>;
    expect(json.error).toContain("Required");
  });

  it("returns 400 when no params at all", async () => {
    const res = await app.request("/api/solana/quote");
    expect(res.status).toBe(400);
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/solana/tokens
// ═══════════════════════════════════════════════════════════════

describe("GET /api/solana/tokens", () => {
  it("returns token list with count", async () => {
    vi.mocked(jupiter.getTokenList).mockResolvedValue([
      { address: "SOL_MINT", name: "Solana", symbol: "SOL", decimals: 9 },
      { address: "USDC_MINT", name: "USD Coin", symbol: "USDC", decimals: 6 },
    ] as any);

    const res = await app.request("/api/solana/tokens");
    expect(res.status).toBe(200);

    const json = (await res.json()) as Record<string, any>;
    expect(json.count).toBe(2);
    expect(json.data).toHaveLength(2);
  });

  it("propagates source errors as 500", async () => {
    vi.mocked(jupiter.getTokenList).mockRejectedValue(new Error("fail"));

    const res = await app.request("/api/solana/tokens");
    expect(res.status).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/solana/tokens/popular
// ═══════════════════════════════════════════════════════════════

describe("GET /api/solana/tokens/popular", () => {
  it("returns popular token prices", async () => {
    vi.mocked(jupiter.getPopularPrices).mockResolvedValue({
      SOL: { id: "SOL", price: 150 },
      BONK: { id: "BONK", price: 0.00002 },
    } as any);

    const res = await app.request("/api/solana/tokens/popular");
    expect(res.status).toBe(200);

    const json = (await res.json()) as Record<string, any>;
    expect(json.SOL.price).toBe(150);
  });

  it("propagates source errors as 500", async () => {
    vi.mocked(jupiter.getPopularPrices).mockRejectedValue(new Error("fail"));

    const res = await app.request("/api/solana/tokens/popular");
    expect(res.status).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/solana/search
// ═══════════════════════════════════════════════════════════════

describe("GET /api/solana/search", () => {
  it("returns search results", async () => {
    vi.mocked(jupiter.searchTokens).mockResolvedValue([
      { address: "BONK_MINT", name: "Bonk", symbol: "BONK", decimals: 5 },
    ] as any);

    const res = await app.request("/api/solana/search?q=bonk");
    expect(res.status).toBe(200);

    const json = (await res.json()) as Record<string, any>;
    expect(json.query).toBe("bonk");
    expect(json.data).toHaveLength(1);
    expect(json.data[0].symbol).toBe("BONK");
  });

  it("returns 400 when q parameter missing", async () => {
    const res = await app.request("/api/solana/search");
    expect(res.status).toBe(400);

    const json = (await res.json()) as Record<string, any>;
    expect(json.error).toContain("Missing");
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/solana/price-vs/:token
// ═══════════════════════════════════════════════════════════════

describe("GET /api/solana/price-vs/:token", () => {
  it("returns price vs SOL by default", async () => {
    vi.mocked(jupiter.getPriceVs).mockResolvedValue({ data: { BONK: { price: 0.0001 } } } as any);

    const res = await app.request("/api/solana/price-vs/BONK");
    expect(res.status).toBe(200);

    expect(jupiter.getPriceVs).toHaveBeenCalledWith(
      "BONK",
      "So11111111111111111111111111111111111111112",
    );
  });

  it("uses custom vs token when provided", async () => {
    vi.mocked(jupiter.getPriceVs).mockResolvedValue({ data: {} } as any);

    await app.request("/api/solana/price-vs/SOL?vs=CUSTOM_MINT");
    expect(jupiter.getPriceVs).toHaveBeenCalledWith("SOL", "CUSTOM_MINT");
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/solana/tokens/strict
// ═══════════════════════════════════════════════════════════════

describe("GET /api/solana/tokens/strict", () => {
  it("returns strict token list with count", async () => {
    vi.mocked(jupiter.getStrictTokenList).mockResolvedValue([
      { address: "SOL_MINT", name: "Solana", symbol: "SOL", decimals: 9 },
    ] as any);

    const res = await app.request("/api/solana/tokens/strict");
    expect(res.status).toBe(200);

    const json = (await res.json()) as Record<string, any>;
    expect(json.count).toBe(1);
    expect(json.data).toHaveLength(1);
  });

  it("propagates source errors as 500", async () => {
    vi.mocked(jupiter.getStrictTokenList).mockRejectedValue(new Error("fail"));

    const res = await app.request("/api/solana/tokens/strict");
    expect(res.status).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/solana/top-tokens
// ═══════════════════════════════════════════════════════════════

describe("GET /api/solana/top-tokens", () => {
  it("returns top tokens by market cap", async () => {
    vi.mocked(jupiter.getTopTokensByMarketCap).mockResolvedValue([
      { address: "SOL_MINT", name: "Solana", symbol: "SOL" },
    ] as any);

    const res = await app.request("/api/solana/top-tokens");
    expect(res.status).toBe(200);

    const json = (await res.json()) as Record<string, any>;
    expect(json).toHaveLength(1);
  });

  it("propagates source errors as 500", async () => {
    vi.mocked(jupiter.getTopTokensByMarketCap).mockRejectedValue(new Error("fail"));

    const res = await app.request("/api/solana/top-tokens");
    expect(res.status).toBe(500);
  });
});
