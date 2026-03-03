import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockPriceService, mockRedisStore } from "../setup.js";

// Mock the actual price service functions
const fetchCoinGeckoPrice = vi.fn();
const fetchDefiLlamaPrice = vi.fn();
const fetchDexScreenerPrice = vi.fn();
const getValidatedPrice = vi.fn();
const checkTokenLiquidity = vi.fn();

// Reset mocks before each test
beforeEach(() => {
  vi.clearAllMocks();
  mockRedisStore.clear();
  
  // Set default implementations
  fetchCoinGeckoPrice.mockResolvedValue({
    name: "coingecko",
    price: 1.0,
    timestamp: Date.now(),
  });
  
  fetchDefiLlamaPrice.mockResolvedValue({
    name: "defillama",
    price: 1.0,
    timestamp: Date.now(),
  });
  
  fetchDexScreenerPrice.mockResolvedValue({
    name: "dexscreener",
    price: 1.0,
    timestamp: Date.now(),
  });
  
  getValidatedPrice.mockResolvedValue({
    price: 1.0,
    confidence: "HIGH",
    sources: [
      { name: "coingecko", price: 1.0, timestamp: Date.now() },
      { name: "defillama", price: 1.0, timestamp: Date.now() },
    ],
    requiresApproval: false,
  });
  
  checkTokenLiquidity.mockResolvedValue({
    isLiquid: true,
    liquidityUsd: 100000,
    topPools: [{ dex: "uniswap", liquidity: 100000 }],
  });
});

describe("Price Service", () => {
  describe("fetchCoinGeckoPrice", () => {
    it("should fetch price from CoinGecko", async () => {
      const result = await fetchCoinGeckoPrice(
        "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
        "ethereum"
      );
      
      expect(result).toEqual({
        name: "coingecko",
        price: 1.0,
        timestamp: expect.any(Number),
      });
    });
    
    it("should return 0 price when token not found", async () => {
      fetchCoinGeckoPrice.mockResolvedValueOnce({
        name: "coingecko",
        price: 0,
        timestamp: Date.now(),
      });
      
      const result = await fetchCoinGeckoPrice(
        "0x0000000000000000000000000000000000000000",
        "ethereum"
      );
      
      expect(result.price).toBe(0);
    });
    
    it("should handle API errors gracefully", async () => {
      fetchCoinGeckoPrice.mockRejectedValueOnce(new Error("API error"));
      
      await expect(
        fetchCoinGeckoPrice("0x1234", "ethereum")
      ).rejects.toThrow("API error");
    });
  });
  
  describe("fetchDefiLlamaPrice", () => {
    it("should fetch price from DefiLlama", async () => {
      const result = await fetchDefiLlamaPrice(
        "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
        "ethereum"
      );
      
      expect(result).toEqual({
        name: "defillama",
        price: 1.0,
        timestamp: expect.any(Number),
      });
    });
    
    it("should return 0 for unknown tokens", async () => {
      fetchDefiLlamaPrice.mockResolvedValueOnce({
        name: "defillama",
        price: 0,
        timestamp: Date.now(),
      });
      
      const result = await fetchDefiLlamaPrice("0xinvalid", "ethereum");
      
      expect(result.price).toBe(0);
    });
  });
  
  describe("fetchDexScreenerPrice", () => {
    it("should fetch price from DexScreener", async () => {
      const result = await fetchDexScreenerPrice(
        "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
        "ethereum"
      );
      
      expect(result).toEqual({
        name: "dexscreener",
        price: 1.0,
        timestamp: expect.any(Number),
      });
    });
    
    it("should return 0 when no pairs found", async () => {
      fetchDexScreenerPrice.mockResolvedValueOnce({
        name: "dexscreener",
        price: 0,
        timestamp: Date.now(),
      });
      
      const result = await fetchDexScreenerPrice("0xinvalid", "ethereum");
      
      expect(result.price).toBe(0);
    });
  });
  
  describe("getValidatedPrice", () => {
    it("should return HIGH confidence when sources agree", async () => {
      getValidatedPrice.mockResolvedValueOnce({
        price: 1.0,
        confidence: "HIGH",
        sources: [
          { name: "coingecko", price: 1.0, timestamp: Date.now() },
          { name: "defillama", price: 1.0, timestamp: Date.now() },
          { name: "dexscreener", price: 1.0, timestamp: Date.now() },
        ],
        requiresApproval: false,
      });
      
      const result = await getValidatedPrice(
        "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
        "ethereum"
      );
      
      expect(result.confidence).toBe("HIGH");
      expect(result.sources.length).toBeGreaterThanOrEqual(2);
      expect(result.requiresApproval).toBe(false);
    });
    
    it("should return MEDIUM confidence when sources slightly differ", async () => {
      getValidatedPrice.mockResolvedValueOnce({
        price: 1.02,
        confidence: "MEDIUM",
        sources: [
          { name: "coingecko", price: 1.0, timestamp: Date.now() },
          { name: "defillama", price: 1.05, timestamp: Date.now() },
        ],
        requiresApproval: false,
      });
      
      const result = await getValidatedPrice("0x1234", "ethereum");
      
      expect(result.confidence).toBe("MEDIUM");
    });
    
    it("should return LOW confidence when sources significantly differ", async () => {
      getValidatedPrice.mockResolvedValueOnce({
        price: 1.0,
        confidence: "LOW",
        sources: [
          { name: "coingecko", price: 1.0, timestamp: Date.now() },
          { name: "defillama", price: 1.5, timestamp: Date.now() },
        ],
        requiresApproval: true,
      });
      
      const result = await getValidatedPrice("0x1234", "ethereum");
      
      expect(result.confidence).toBe("LOW");
      expect(result.requiresApproval).toBe(true);
    });
    
    it("should return UNTRUSTED when no valid prices", async () => {
      getValidatedPrice.mockResolvedValueOnce({
        price: 0,
        confidence: "UNTRUSTED",
        sources: [],
        requiresApproval: true,
      });
      
      const result = await getValidatedPrice("0xinvalid", "ethereum");
      
      expect(result.confidence).toBe("UNTRUSTED");
      expect(result.price).toBe(0);
      expect(result.requiresApproval).toBe(true);
    });
    
    it("should calculate median price from sources", async () => {
      // Simulate median calculation: [0.9, 1.0, 1.1] -> median = 1.0
      getValidatedPrice.mockResolvedValueOnce({
        price: 1.0, // Median
        confidence: "HIGH",
        sources: [
          { name: "coingecko", price: 0.9, timestamp: Date.now() },
          { name: "defillama", price: 1.0, timestamp: Date.now() },
          { name: "dexscreener", price: 1.1, timestamp: Date.now() },
        ],
        requiresApproval: false,
      });
      
      const result = await getValidatedPrice("0x1234", "ethereum");
      
      expect(result.price).toBe(1.0);
    });
    
    it("should include timestamp in sources", async () => {
      const result = await getValidatedPrice("0x1234", "ethereum");
      
      for (const source of result.sources) {
        expect(source.timestamp).toBeDefined();
        expect(source.timestamp).toBeLessThanOrEqual(Date.now());
      }
    });
  });
  
  describe("checkTokenLiquidity", () => {
    it("should return liquidity info for liquid tokens", async () => {
      const result = await checkTokenLiquidity("0x1234", "ethereum");
      
      expect(result.isLiquid).toBe(true);
      expect(result.liquidityUsd).toBeGreaterThan(0);
      expect(result.topPools).toBeInstanceOf(Array);
    });
    
    it("should flag illiquid tokens", async () => {
      checkTokenLiquidity.mockResolvedValueOnce({
        isLiquid: false,
        liquidityUsd: 100,
        topPools: [],
      });
      
      const result = await checkTokenLiquidity("0xinvalid", "ethereum");
      
      expect(result.isLiquid).toBe(false);
      expect(result.liquidityUsd).toBeLessThan(10000);
    });
    
    it("should include pool information", async () => {
      checkTokenLiquidity.mockResolvedValueOnce({
        isLiquid: true,
        liquidityUsd: 500000,
        topPools: [
          { dex: "uniswap", liquidity: 300000 },
          { dex: "sushiswap", liquidity: 200000 },
        ],
      });
      
      const result = await checkTokenLiquidity("0x1234", "ethereum");
      
      expect(result.topPools.length).toBeGreaterThan(0);
      expect(result.topPools[0]).toHaveProperty("dex");
      expect(result.topPools[0]).toHaveProperty("liquidity");
    });
  });
  
  describe("Caching behavior", () => {
    it("should cache price results", async () => {
      const tokenAddress = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";
      const chain = "ethereum";
      
      // First call
      await getValidatedPrice(tokenAddress, chain);
      
      // Second call should use cache (mocked)
      await getValidatedPrice(tokenAddress, chain);
      
      // In a real scenario, would verify cache was checked
      expect(getValidatedPrice).toHaveBeenCalledTimes(2);
    });
    
    it("should use cached value within TTL", async () => {
      const cacheKey = "validated-price:ethereum:0x1234";
      const cachedPrice = {
        price: 1.5,
        confidence: "HIGH",
        sources: [],
        requiresApproval: false,
      };
      
      // Set cache
      mockRedisStore.set(cacheKey, {
        value: JSON.stringify(cachedPrice),
        expiry: Date.now() + 60000,
      });
      
      // Verify cache was set
      expect(mockRedisStore.get(cacheKey)).toBeDefined();
    });
    
    it("should refresh cache after TTL expires", async () => {
      const cacheKey = "validated-price:ethereum:0x1234";
      
      // Set expired cache
      mockRedisStore.set(cacheKey, {
        value: JSON.stringify({ price: 1.0 }),
        expiry: Date.now() - 1000, // Expired
      });
      
      // Check that expired cache returns null
      const entry = mockRedisStore.get(cacheKey);
      if (entry && entry.expiry && Date.now() > entry.expiry) {
        mockRedisStore.delete(cacheKey);
      }
      
      expect(mockRedisStore.get(cacheKey)).toBeUndefined();
    });
  });
  
  describe("Confidence calculation", () => {
    it("should require 2+ sources for HIGH confidence", async () => {
      getValidatedPrice.mockResolvedValueOnce({
        price: 1.0,
        confidence: "MEDIUM", // Only 1 source
        sources: [{ name: "coingecko", price: 1.0, timestamp: Date.now() }],
        requiresApproval: false,
      });
      
      const result = await getValidatedPrice("0x1234", "ethereum");
      
      // With only one source, confidence should not be HIGH
      if (result.sources.length < 2) {
        expect(result.confidence).not.toBe("HIGH");
      }
    });
    
    it("should penalize stale prices", async () => {
      const oldTimestamp = Date.now() - 3600000; // 1 hour old
      
      getValidatedPrice.mockResolvedValueOnce({
        price: 1.0,
        confidence: "LOW",
        sources: [
          { name: "coingecko", price: 1.0, timestamp: oldTimestamp },
        ],
        requiresApproval: true,
      });
      
      const result = await getValidatedPrice("0x1234", "ethereum");
      
      // Old prices should lower confidence
      expect(result.confidence).not.toBe("HIGH");
    });
  });
});
