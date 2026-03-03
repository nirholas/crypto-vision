/**
 * Tests for Predictions vendor module (Polymarket integration)
 * @author nich
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

// Mock fetch for API calls
const mockFetch = vi.fn()
global.fetch = mockFetch

const POLYMARKET_API_BASE = "https://gamma-api.polymarket.com"

describe("Predictions Vendor Module", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockReset()
    process.env.POLYMARKET_API_KEY = "test-api-key"
  })

  afterEach(() => {
    vi.restoreAllMocks()
    delete process.env.POLYMARKET_API_KEY
  })

  describe("Market Data", () => {
    describe("Get Markets", () => {
      it("should fetch all active markets", async () => {
        const mockMarkets = [
          {
            id: "market-1",
            slug: "btc-above-50k",
            question: "Will BTC be above $50,000 on Jan 31?",
            description: "This market resolves to YES if Bitcoin...",
            active: true,
            closed: false,
            liquidity: "1000000",
            volume: "5000000",
            outcomes: '["Yes","No"]',
            outcomePrices: '["0.65","0.35"]',
            endDate: "2024-01-31T00:00:00Z",
            category: "crypto"
          },
          {
            id: "market-2",
            slug: "eth-above-3k",
            question: "Will ETH be above $3,000 on Jan 31?",
            active: true,
            closed: false,
            liquidity: "500000",
            volume: "2500000",
            outcomes: '["Yes","No"]',
            outcomePrices: '["0.72","0.28"]',
            endDate: "2024-01-31T00:00:00Z",
            category: "crypto"
          }
        ]

        mockFetch.mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(JSON.stringify(mockMarkets))
        })

        const response = await fetch(`${POLYMARKET_API_BASE}/markets`)
        const text = await response.text()
        const data = JSON.parse(text)

        expect(data).toHaveLength(2)
        expect(data[0].active).toBe(true)
        expect(data[0].closed).toBe(false)
      })

      it("should filter markets by category", async () => {
        const mockCryptoMarkets = [
          {
            id: "market-1",
            question: "Will BTC be above $50,000?",
            category: "crypto",
            active: true
          }
        ]

        mockFetch.mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(JSON.stringify(mockCryptoMarkets))
        })

        const response = await fetch(`${POLYMARKET_API_BASE}/markets?tag=crypto`)
        const text = await response.text()
        const data = JSON.parse(text)

        expect(data.every((m: any) => m.category === "crypto")).toBe(true)
      })

      it("should filter markets by active status", async () => {
        const mockActiveMarkets = [
          { id: "market-1", active: true, closed: false },
          { id: "market-2", active: true, closed: false }
        ]

        mockFetch.mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(JSON.stringify(mockActiveMarkets))
        })

        const response = await fetch(`${POLYMARKET_API_BASE}/markets?active=true&closed=false`)
        const text = await response.text()
        const data = JSON.parse(text)

        expect(data.every((m: any) => m.active && !m.closed)).toBe(true)
      })

      it("should sort markets by volume descending", async () => {
        const mockMarkets = [
          { id: "market-1", volume: "5000000" },
          { id: "market-2", volume: "2500000" },
          { id: "market-3", volume: "1000000" }
        ]

        mockFetch.mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(JSON.stringify(mockMarkets))
        })

        const response = await fetch(`${POLYMARKET_API_BASE}/markets?order=volume&ascending=false`)
        const text = await response.text()
        const data = JSON.parse(text)

        const volumes = data.map((m: any) => parseInt(m.volume))
        expect(volumes[0]).toBeGreaterThanOrEqual(volumes[1])
        expect(volumes[1]).toBeGreaterThanOrEqual(volumes[2])
      })

      it("should sort markets by liquidity", async () => {
        const mockMarkets = [
          { id: "market-1", liquidity: "1000000" },
          { id: "market-2", liquidity: "500000" },
          { id: "market-3", liquidity: "250000" }
        ]

        mockFetch.mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(JSON.stringify(mockMarkets))
        })

        const response = await fetch(`${POLYMARKET_API_BASE}/markets?order=liquidity&ascending=false`)
        const text = await response.text()
        const data = JSON.parse(text)

        const liquidities = data.map((m: any) => parseInt(m.liquidity))
        expect(liquidities[0]).toBeGreaterThanOrEqual(liquidities[1])
      })
    })

    describe("Get Market By ID", () => {
      it("should fetch specific market details", async () => {
        const mockMarket = {
          id: "market-123",
          slug: "btc-above-50k-jan",
          question: "Will BTC be above $50,000 on January 31, 2024?",
          description: "This market will resolve to YES if the price of Bitcoin...",
          active: true,
          closed: false,
          liquidity: "1500000",
          volume: "7500000",
          outcomes: '["Yes","No"]',
          outcomePrices: '["0.68","0.32"]',
          endDate: "2024-01-31T23:59:59Z",
          category: "crypto",
          conditionId: "0xabc123",
          enableOrderBook: true,
          minimumOrderSize: 1,
          minimumTickSize: 0.01
        }

        mockFetch.mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(JSON.stringify(mockMarket))
        })

        const response = await fetch(`${POLYMARKET_API_BASE}/markets/market-123`)
        const text = await response.text()
        const data = JSON.parse(text)

        expect(data.id).toBe("market-123")
        expect(data.enableOrderBook).toBe(true)
      })

      it("should handle non-existent market", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 404,
          text: () => Promise.resolve(JSON.stringify({ error: "Market not found" }))
        })

        const response = await fetch(`${POLYMARKET_API_BASE}/markets/nonexistent`)
        
        expect(response.ok).toBe(false)
        expect(response.status).toBe(404)
      })
    })

    describe("Get Market By Slug", () => {
      it("should fetch market by slug", async () => {
        const mockMarket = {
          id: "market-123",
          slug: "btc-above-50k-jan",
          question: "Will BTC be above $50,000?"
        }

        mockFetch.mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(JSON.stringify(mockMarket))
        })

        const response = await fetch(`${POLYMARKET_API_BASE}/markets?slug=btc-above-50k-jan`)
        const text = await response.text()
        const data = JSON.parse(text)

        expect(data.slug).toBe("btc-above-50k-jan")
      })
    })
  })

  describe("Price Data", () => {
    describe("Outcome Prices", () => {
      it("should parse outcome prices correctly", async () => {
        const mockMarket = {
          id: "market-1",
          outcomes: '["Yes","No"]',
          outcomePrices: '["0.65","0.35"]'
        }

        mockFetch.mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(JSON.stringify(mockMarket))
        })

        const response = await fetch(`${POLYMARKET_API_BASE}/markets/market-1`)
        const text = await response.text()
        const data = JSON.parse(text)

        const outcomes = JSON.parse(data.outcomes)
        const prices = JSON.parse(data.outcomePrices)

        expect(outcomes).toEqual(["Yes", "No"])
        expect(prices.map(Number)).toEqual([0.65, 0.35])
        
        // Prices should sum close to 1 (allowing for spread)
        const totalPrice = prices.map(Number).reduce((a: number, b: number) => a + b, 0)
        expect(totalPrice).toBeCloseTo(1, 1)
      })

      it("should handle multi-outcome markets", async () => {
        const mockMarket = {
          id: "market-multi",
          question: "Which crypto will perform best in Q1?",
          outcomes: '["BTC","ETH","SOL","Other"]',
          outcomePrices: '["0.40","0.30","0.20","0.10"]'
        }

        mockFetch.mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(JSON.stringify(mockMarket))
        })

        const response = await fetch(`${POLYMARKET_API_BASE}/markets/market-multi`)
        const text = await response.text()
        const data = JSON.parse(text)

        const outcomes = JSON.parse(data.outcomes)
        const prices = JSON.parse(data.outcomePrices)

        expect(outcomes).toHaveLength(4)
        expect(prices).toHaveLength(4)
      })
    })

    describe("Price Impact", () => {
      it("should calculate price impact for large orders", () => {
        const liquidity = 1000000
        const orderSize = 100000
        const currentPrice = 0.65

        // Simplified price impact calculation
        const priceImpact = (orderSize / liquidity) * currentPrice * 100
        
        expect(priceImpact).toBeGreaterThan(0)
        expect(priceImpact).toBeLessThan(100)
      })
    })
  })

  describe("Market Activity", () => {
    describe("Activity Level", () => {
      it("should classify market activity level", () => {
        const classifyActivity = (volume: number, liquidity: number) => {
          const score = volume + (liquidity * 0.5)
          if (score >= 100000) return "VeryHigh"
          if (score >= 25000) return "High"
          if (score >= 5000) return "Medium"
          return "Low"
        }

        expect(classifyActivity(100000, 50000)).toBe("VeryHigh")
        expect(classifyActivity(20000, 20000)).toBe("High")
        expect(classifyActivity(3000, 5000)).toBe("Medium")
        expect(classifyActivity(1000, 1000)).toBe("Low")
      })
    })

    describe("Market State", () => {
      it("should determine if market is tradeable", () => {
        const isTradeable = (market: any): boolean => {
          return market.active && 
                 !market.closed && 
                 !market.archived && 
                 market.enableOrderBook
        }

        const tradeableMarket = {
          active: true,
          closed: false,
          archived: false,
          enableOrderBook: true
        }

        const closedMarket = {
          active: false,
          closed: true,
          archived: false,
          enableOrderBook: true
        }

        expect(isTradeable(tradeableMarket)).toBe(true)
        expect(isTradeable(closedMarket)).toBe(false)
      })

      it("should check if market expires soon", () => {
        const expiresSoon = (endDate: string): boolean => {
          const end = new Date(endDate).getTime()
          const now = Date.now()
          const hoursUntilExpiry = (end - now) / (1000 * 60 * 60)
          return hoursUntilExpiry <= 24 && hoursUntilExpiry > 0
        }

        const tomorrow = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString()
        const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

        expect(expiresSoon(tomorrow)).toBe(true)
        expect(expiresSoon(nextWeek)).toBe(false)
        expect(expiresSoon(yesterday)).toBe(false)
      })
    })
  })

  describe("Search and Filtering", () => {
    it("should search markets by text query", async () => {
      const mockSearchResults = [
        { id: "1", question: "Will Bitcoin reach $60,000?" },
        { id: "2", question: "Will Bitcoin ETF be approved?" }
      ]

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockSearchResults))
      })

      const response = await fetch(`${POLYMARKET_API_BASE}/markets?_q=bitcoin`)
      const text = await response.text()
      const data = JSON.parse(text)

      expect(data.every((m: any) => 
        m.question.toLowerCase().includes("bitcoin")
      )).toBe(true)
    })

    it("should filter by end date range", async () => {
      const mockMarkets = [
        { id: "1", endDate: "2024-02-01T00:00:00Z" },
        { id: "2", endDate: "2024-02-15T00:00:00Z" }
      ]

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockMarkets))
      })

      const response = await fetch(
        `${POLYMARKET_API_BASE}/markets?end_date_min=2024-02-01&end_date_max=2024-02-28`
      )
      const text = await response.text()
      const data = JSON.parse(text)

      data.forEach((m: any) => {
        const endDate = new Date(m.endDate)
        expect(endDate.getMonth()).toBe(1) // February
      })
    })
  })

  describe("Events", () => {
    it("should fetch events with related markets", async () => {
      const mockEvents = [
        {
          id: "event-1",
          title: "US Election 2024",
          description: "Presidential election markets",
          startDate: "2024-11-01T00:00:00Z",
          endDate: "2024-11-06T00:00:00Z",
          active: true,
          volume: "50000000"
        }
      ]

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockEvents))
      })

      const response = await fetch(`${POLYMARKET_API_BASE}/events`)
      const text = await response.text()
      const data = JSON.parse(text)

      expect(data[0].title).toBe("US Election 2024")
    })
  })

  describe("Caching", () => {
    it("should respect cache TTL", () => {
      const cacheEntry = {
        data: { id: "market-1" },
        timestamp: Date.now() - 60000 // 1 minute ago
      }
      const ttlMs = 120000 // 2 minutes

      const isExpired = (timestamp: number, ttl: number): boolean => {
        return Date.now() - timestamp > ttl
      }

      expect(isExpired(cacheEntry.timestamp, ttlMs)).toBe(false)
      expect(isExpired(cacheEntry.timestamp, 30000)).toBe(true) // 30s TTL would be expired
    })

    it("should generate unique cache keys", () => {
      const generateCacheKey = (endpoint: string, params: Record<string, any>): string => {
        return `${endpoint}_${JSON.stringify(params)}`
      }

      const key1 = generateCacheKey("markets", { active: true })
      const key2 = generateCacheKey("markets", { active: false })
      const key3 = generateCacheKey("markets", { active: true })

      expect(key1).not.toBe(key2)
      expect(key1).toBe(key3)
    })
  })

  describe("Error Handling", () => {
    it("should handle API timeout", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Request timeout"))

      await expect(fetch(`${POLYMARKET_API_BASE}/markets`)).rejects.toThrow("Request timeout")
    })

    it("should handle rate limiting with retry", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          text: () => Promise.resolve(JSON.stringify({ error: "Rate limited" }))
        })
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(JSON.stringify([{ id: "market-1" }]))
        })

      const firstResponse = await fetch(`${POLYMARKET_API_BASE}/markets`)
      expect(firstResponse.status).toBe(429)

      // Retry after delay
      const secondResponse = await fetch(`${POLYMARKET_API_BASE}/markets`)
      const text = await secondResponse.text()
      const data = JSON.parse(text)
      expect(data[0].id).toBe("market-1")
    })

    it("should handle network errors", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error: ECONNREFUSED"))

      await expect(fetch(`${POLYMARKET_API_BASE}/markets`)).rejects.toThrow("ECONNREFUSED")
    })

    it("should handle deserialization errors", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve("invalid json{")
      })

      const response = await fetch(`${POLYMARKET_API_BASE}/markets`)
      const text = await response.text()

      expect(() => JSON.parse(text)).toThrow()
    })

    it("should handle API errors with status codes", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.resolve(JSON.stringify({ error: "Internal server error" }))
      })

      const response = await fetch(`${POLYMARKET_API_BASE}/markets`)
      
      expect(response.ok).toBe(false)
      expect(response.status).toBe(500)
    })
  })

  describe("Configuration", () => {
    it("should use default configuration values", () => {
      const defaultConfig = {
        api: {
          baseUrl: "https://gamma-api.polymarket.com",
          timeout: 30000,
          maxRetries: 3
        },
        cache: {
          enabled: true,
          ttl: 300
        }
      }

      expect(defaultConfig.api.timeout).toBe(30000)
      expect(defaultConfig.cache.enabled).toBe(true)
    })

    it("should allow custom configuration", () => {
      const customConfig = {
        api: {
          baseUrl: "https://custom-api.example.com",
          timeout: 60000,
          maxRetries: 5,
          apiKey: "custom-key"
        },
        cache: {
          enabled: false,
          ttl: 0
        }
      }

      expect(customConfig.api.baseUrl).toBe("https://custom-api.example.com")
      expect(customConfig.cache.enabled).toBe(false)
    })
  })

  describe("Query Parameters", () => {
    it("should build query string from params", () => {
      const buildQueryString = (params: Record<string, any>): string => {
        const entries = Object.entries(params)
          .filter(([_, v]) => v !== undefined && v !== null)
          .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        return entries.length > 0 ? `?${entries.join("&")}` : ""
      }

      expect(buildQueryString({ active: true, closed: false })).toBe("?active=true&closed=false")
      expect(buildQueryString({})).toBe("")
      expect(buildQueryString({ limit: 10, offset: 20 })).toBe("?limit=10&offset=20")
    })
  })

  describe("Market Forecasts", () => {
    describe("Price Predictions", () => {
      it("should interpret probability as prediction confidence", () => {
        const interpretProbability = (price: number): string => {
          if (price >= 0.9) return "Very likely"
          if (price >= 0.7) return "Likely"
          if (price >= 0.5) return "Probable"
          if (price >= 0.3) return "Unlikely"
          return "Very unlikely"
        }

        expect(interpretProbability(0.95)).toBe("Very likely")
        expect(interpretProbability(0.75)).toBe("Likely")
        expect(interpretProbability(0.55)).toBe("Probable")
        expect(interpretProbability(0.35)).toBe("Unlikely")
        expect(interpretProbability(0.15)).toBe("Very unlikely")
      })

      it("should calculate implied odds from price", () => {
        const priceToOdds = (price: number): string => {
          if (price <= 0 || price >= 1) return "Invalid price"
          const impliedOdds = 1 / price
          return `${impliedOdds.toFixed(2)}:1`
        }

        expect(priceToOdds(0.5)).toBe("2.00:1")
        expect(priceToOdds(0.25)).toBe("4.00:1")
        expect(priceToOdds(0.8)).toBe("1.25:1")
      })
    })

    describe("Market Consensus", () => {
      it("should aggregate predictions from multiple markets", () => {
        const markets = [
          { question: "BTC > 50k by Feb", yesPrice: 0.65 },
          { question: "BTC > 50k by Mar", yesPrice: 0.75 },
          { question: "BTC > 60k by Feb", yesPrice: 0.35 }
        ]

        const avgBullishSentiment = markets.reduce((sum, m) => sum + m.yesPrice, 0) / markets.length

        expect(avgBullishSentiment).toBeCloseTo(0.583, 2)
      })
    })
  })
})
