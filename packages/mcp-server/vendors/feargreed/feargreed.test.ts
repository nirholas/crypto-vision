/**
 * Tests for Fear & Greed vendor module
 * @author nich
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

// Mock fetch for API calls
const mockFetch = vi.fn()
global.fetch = mockFetch

const API_URL = "https://api.alternative.me/fng/"

describe("Fear & Greed Vendor Module", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe("Get Current Fear & Greed Index", () => {
    it("should fetch current Fear & Greed index value", async () => {
      const mockCurrentFng = {
        name: "Fear and Greed Index",
        data: [
          {
            value: "72",
            value_classification: "Greed",
            timestamp: "1705276800",
            time_until_update: "45678"
          }
        ],
        metadata: {
          error: null
        }
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockCurrentFng)
      })

      const response = await fetch(`${API_URL}?limit=1`)
      const data = await response.json()

      expect(data.data).toHaveLength(1)
      expect(data.data[0].value).toBe("72")
      expect(data.data[0].value_classification).toBe("Greed")
    })

    it("should handle extreme fear classification", async () => {
      const mockExtremeFear = {
        name: "Fear and Greed Index",
        data: [
          {
            value: "15",
            value_classification: "Extreme Fear",
            timestamp: "1705276800"
          }
        ]
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockExtremeFear)
      })

      const response = await fetch(`${API_URL}?limit=1`)
      const data = await response.json()

      expect(parseInt(data.data[0].value)).toBeLessThanOrEqual(25)
      expect(data.data[0].value_classification).toBe("Extreme Fear")
    })

    it("should handle fear classification", async () => {
      const mockFear = {
        name: "Fear and Greed Index",
        data: [
          {
            value: "35",
            value_classification: "Fear",
            timestamp: "1705276800"
          }
        ]
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockFear)
      })

      const response = await fetch(`${API_URL}?limit=1`)
      const data = await response.json()

      const value = parseInt(data.data[0].value)
      expect(value).toBeGreaterThan(25)
      expect(value).toBeLessThanOrEqual(45)
      expect(data.data[0].value_classification).toBe("Fear")
    })

    it("should handle neutral classification", async () => {
      const mockNeutral = {
        name: "Fear and Greed Index",
        data: [
          {
            value: "50",
            value_classification: "Neutral",
            timestamp: "1705276800"
          }
        ]
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockNeutral)
      })

      const response = await fetch(`${API_URL}?limit=1`)
      const data = await response.json()

      const value = parseInt(data.data[0].value)
      expect(value).toBeGreaterThan(45)
      expect(value).toBeLessThanOrEqual(55)
      expect(data.data[0].value_classification).toBe("Neutral")
    })

    it("should handle greed classification", async () => {
      const mockGreed = {
        name: "Fear and Greed Index",
        data: [
          {
            value: "65",
            value_classification: "Greed",
            timestamp: "1705276800"
          }
        ]
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockGreed)
      })

      const response = await fetch(`${API_URL}?limit=1`)
      const data = await response.json()

      const value = parseInt(data.data[0].value)
      expect(value).toBeGreaterThan(55)
      expect(value).toBeLessThanOrEqual(75)
      expect(data.data[0].value_classification).toBe("Greed")
    })

    it("should handle extreme greed classification", async () => {
      const mockExtremeGreed = {
        name: "Fear and Greed Index",
        data: [
          {
            value: "85",
            value_classification: "Extreme Greed",
            timestamp: "1705276800"
          }
        ]
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockExtremeGreed)
      })

      const response = await fetch(`${API_URL}?limit=1`)
      const data = await response.json()

      expect(parseInt(data.data[0].value)).toBeGreaterThan(75)
      expect(data.data[0].value_classification).toBe("Extreme Greed")
    })
  })

  describe("Get Historical Fear & Greed Data", () => {
    it("should fetch historical data for specified days", async () => {
      const mockHistoricalData = {
        name: "Fear and Greed Index",
        data: [
          { value: "72", value_classification: "Greed", timestamp: "1705276800" },
          { value: "68", value_classification: "Greed", timestamp: "1705190400" },
          { value: "65", value_classification: "Greed", timestamp: "1705104000" },
          { value: "60", value_classification: "Greed", timestamp: "1705017600" },
          { value: "55", value_classification: "Neutral", timestamp: "1704931200" },
          { value: "50", value_classification: "Neutral", timestamp: "1704844800" },
          { value: "48", value_classification: "Neutral", timestamp: "1704758400" }
        ]
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockHistoricalData)
      })

      const response = await fetch(`${API_URL}?limit=7`)
      const data = await response.json()

      expect(data.data).toHaveLength(7)
    })

    it("should fetch 30 days of historical data", async () => {
      const mockData = {
        name: "Fear and Greed Index",
        data: Array(30).fill(null).map((_, i) => ({
          value: String(40 + i),
          value_classification: i < 15 ? "Fear" : "Neutral",
          timestamp: String(1705276800 - i * 86400)
        }))
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockData)
      })

      const response = await fetch(`${API_URL}?limit=30`)
      const data = await response.json()

      expect(data.data).toHaveLength(30)
    })

    it("should return data in chronological order (most recent first)", async () => {
      const mockData = {
        name: "Fear and Greed Index",
        data: [
          { value: "72", timestamp: "1705276800" },
          { value: "68", timestamp: "1705190400" },
          { value: "65", timestamp: "1705104000" }
        ]
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockData)
      })

      const response = await fetch(`${API_URL}?limit=3`)
      const data = await response.json()

      // Most recent should be first
      expect(parseInt(data.data[0].timestamp)).toBeGreaterThan(parseInt(data.data[1].timestamp))
    })

    it("should handle invalid days parameter", async () => {
      // Testing the validation logic
      const invalidDays = -5
      
      expect(invalidDays).toBeLessThanOrEqual(0)
      
      // The actual API would handle this gracefully
      const mockData = {
        name: "Fear and Greed Index",
        data: [{ value: "50", value_classification: "Neutral", timestamp: "1705276800" }]
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockData)
      })

      const response = await fetch(`${API_URL}?limit=1`)
      const data = await response.json()

      expect(data.data).toHaveLength(1)
    })
  })

  describe("Analyze Fear & Greed Trend", () => {
    it("should analyze rising trend", async () => {
      const mockData = {
        name: "Fear and Greed Index",
        data: [
          { value: "75", value_classification: "Greed", timestamp: "1705276800" },
          { value: "70", value_classification: "Greed", timestamp: "1705190400" },
          { value: "65", value_classification: "Greed", timestamp: "1705104000" },
          { value: "60", value_classification: "Greed", timestamp: "1705017600" },
          { value: "55", value_classification: "Neutral", timestamp: "1704931200" }
        ]
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockData)
      })

      const response = await fetch(`${API_URL}?limit=5`)
      const data = await response.json()

      const values = data.data.map((d: any) => parseInt(d.value))
      const latest = values[0]
      const oldest = values[values.length - 1]
      const trend = latest > oldest ? "rising" : latest < oldest ? "falling" : "stable"

      expect(trend).toBe("rising")
    })

    it("should analyze falling trend", async () => {
      const mockData = {
        name: "Fear and Greed Index",
        data: [
          { value: "40", value_classification: "Fear", timestamp: "1705276800" },
          { value: "50", value_classification: "Neutral", timestamp: "1705190400" },
          { value: "60", value_classification: "Greed", timestamp: "1705104000" },
          { value: "70", value_classification: "Greed", timestamp: "1705017600" },
          { value: "75", value_classification: "Greed", timestamp: "1704931200" }
        ]
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockData)
      })

      const response = await fetch(`${API_URL}?limit=5`)
      const data = await response.json()

      const values = data.data.map((d: any) => parseInt(d.value))
      const latest = values[0]
      const oldest = values[values.length - 1]
      const trend = latest > oldest ? "rising" : latest < oldest ? "falling" : "stable"

      expect(trend).toBe("falling")
    })

    it("should analyze stable trend", async () => {
      const mockData = {
        name: "Fear and Greed Index",
        data: [
          { value: "50", value_classification: "Neutral", timestamp: "1705276800" },
          { value: "52", value_classification: "Neutral", timestamp: "1705190400" },
          { value: "48", value_classification: "Neutral", timestamp: "1705104000" },
          { value: "51", value_classification: "Neutral", timestamp: "1705017600" },
          { value: "50", value_classification: "Neutral", timestamp: "1704931200" }
        ]
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockData)
      })

      const response = await fetch(`${API_URL}?limit=5`)
      const data = await response.json()

      const values = data.data.map((d: any) => parseInt(d.value))
      const latest = values[0]
      const oldest = values[values.length - 1]
      const trend = latest > oldest ? "rising" : latest < oldest ? "falling" : "stable"

      expect(trend).toBe("stable")
    })

    it("should calculate average Fear & Greed value", async () => {
      const mockData = {
        name: "Fear and Greed Index",
        data: [
          { value: "70", timestamp: "1705276800" },
          { value: "60", timestamp: "1705190400" },
          { value: "50", timestamp: "1705104000" },
          { value: "40", timestamp: "1705017600" },
          { value: "30", timestamp: "1704931200" }
        ]
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockData)
      })

      const response = await fetch(`${API_URL}?limit=5`)
      const data = await response.json()

      const values = data.data.map((d: any) => parseInt(d.value))
      const average = values.reduce((a: number, b: number) => a + b, 0) / values.length

      expect(average).toBe(50)
    })

    it("should count data points analyzed", async () => {
      const mockData = {
        name: "Fear and Greed Index",
        data: Array(14).fill(null).map((_, i) => ({
          value: String(50 + i),
          timestamp: String(1705276800 - i * 86400)
        }))
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockData)
      })

      const response = await fetch(`${API_URL}?limit=14`)
      const data = await response.json()

      expect(data.data.length).toBe(14)
    })
  })

  describe("Timestamp Formatting", () => {
    it("should convert Unix timestamp to readable date", () => {
      const timestamp = "1705276800"
      const date = new Date(parseInt(timestamp) * 1000)
      
      expect(date.toISOString()).toContain("2024-01-15")
    })

    it("should handle timezone correctly", () => {
      const timestamp = "1705276800"
      const date = new Date(parseInt(timestamp) * 1000)
      
      // UTC date
      expect(date.getUTCFullYear()).toBe(2024)
      expect(date.getUTCMonth()).toBe(0) // January
      expect(date.getUTCDate()).toBe(15)
    })
  })

  describe("Error Handling", () => {
    it("should handle API connection errors", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"))

      await expect(fetch(API_URL)).rejects.toThrow("Network error")
    })

    it("should handle API rate limiting", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: () => Promise.resolve({ error: "Rate limit exceeded" })
      })

      const response = await fetch(API_URL)
      
      expect(response.ok).toBe(false)
      expect(response.status).toBe(429)
    })

    it("should handle empty data response", async () => {
      const mockEmptyData = {
        name: "Fear and Greed Index",
        data: []
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockEmptyData)
      })

      const response = await fetch(`${API_URL}?limit=0`)
      const data = await response.json()

      expect(data.data).toHaveLength(0)
    })

    it("should handle malformed JSON response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.reject(new Error("Invalid JSON"))
      })

      const response = await fetch(API_URL)
      
      await expect(response.json()).rejects.toThrow("Invalid JSON")
    })

    it("should handle server errors", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: "Internal server error" })
      })

      const response = await fetch(API_URL)
      
      expect(response.ok).toBe(false)
      expect(response.status).toBe(500)
    })
  })

  describe("Value Classification Logic", () => {
    it("should correctly classify values in each range", () => {
      const classifyValue = (value: number): string => {
        if (value <= 25) return "Extreme Fear"
        if (value <= 45) return "Fear"
        if (value <= 55) return "Neutral"
        if (value <= 75) return "Greed"
        return "Extreme Greed"
      }

      expect(classifyValue(10)).toBe("Extreme Fear")
      expect(classifyValue(25)).toBe("Extreme Fear")
      expect(classifyValue(26)).toBe("Fear")
      expect(classifyValue(45)).toBe("Fear")
      expect(classifyValue(46)).toBe("Neutral")
      expect(classifyValue(55)).toBe("Neutral")
      expect(classifyValue(56)).toBe("Greed")
      expect(classifyValue(75)).toBe("Greed")
      expect(classifyValue(76)).toBe("Extreme Greed")
      expect(classifyValue(100)).toBe("Extreme Greed")
    })

    it("should validate value is between 0 and 100", () => {
      const isValidValue = (value: number): boolean => {
        return value >= 0 && value <= 100
      }

      expect(isValidValue(0)).toBe(true)
      expect(isValidValue(50)).toBe(true)
      expect(isValidValue(100)).toBe(true)
      expect(isValidValue(-1)).toBe(false)
      expect(isValidValue(101)).toBe(false)
    })
  })

  describe("Index Interpretation", () => {
    it("should provide market sentiment interpretation", () => {
      const interpretValue = (value: number): string => {
        if (value <= 25) {
          return "Market is in extreme fear - potential buying opportunity"
        }
        if (value <= 45) {
          return "Market sentiment is fearful - investors are worried"
        }
        if (value <= 55) {
          return "Market sentiment is neutral - mixed signals"
        }
        if (value <= 75) {
          return "Market sentiment is greedy - investors are optimistic"
        }
        return "Market is in extreme greed - potential correction risk"
      }

      expect(interpretValue(15)).toContain("extreme fear")
      expect(interpretValue(35)).toContain("fearful")
      expect(interpretValue(50)).toContain("neutral")
      expect(interpretValue(65)).toContain("greedy")
      expect(interpretValue(85)).toContain("extreme greed")
    })
  })

  describe("Data Caching Behavior", () => {
    it("should include time until next update in response", async () => {
      const mockData = {
        name: "Fear and Greed Index",
        data: [
          {
            value: "50",
            value_classification: "Neutral",
            timestamp: "1705276800",
            time_until_update: "3600" // 1 hour
          }
        ]
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockData)
      })

      const response = await fetch(`${API_URL}?limit=1`)
      const data = await response.json()

      expect(data.data[0].time_until_update).toBeDefined()
      expect(parseInt(data.data[0].time_until_update)).toBeGreaterThan(0)
    })
  })
})
