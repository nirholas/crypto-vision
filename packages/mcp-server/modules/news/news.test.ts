/**
 * Tests for News Module
 * @author nich
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

import { createMockMcpServer } from "../../../tests/mocks/mcp"
import { registerNewsTools } from "./tools"

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

describe("News Module", () => {
  let server: ReturnType<typeof createMockMcpServer>

  beforeEach(() => {
    server = createMockMcpServer()
    registerNewsTools(server as any)
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe("Tool Registration", () => {
    it("should register all news tools", () => {
      const toolNames = server.getToolNames()

      expect(toolNames).toContain("get_crypto_news")
      expect(toolNames).toContain("search_crypto_news")
      expect(toolNames).toContain("get_defi_news")
      expect(toolNames).toContain("get_bitcoin_news")
      expect(toolNames).toContain("get_breaking_crypto_news")
      expect(toolNames).toContain("get_crypto_news_sources")
    })
  })

  describe("get_crypto_news", () => {
    const mockNewsResponse = {
      articles: [
        {
          title: "Bitcoin Surges Past $70,000",
          link: "https://coindesk.com/article-1",
          description: "Bitcoin reaches new all-time high amid institutional buying",
          pubDate: "2026-01-22T10:00:00Z",
          source: "CoinDesk",
          sourceKey: "coindesk",
          category: "markets",
          timeAgo: "2 hours ago"
        },
        {
          title: "Ethereum Layer 2 TVL Hits Record",
          link: "https://theblock.co/article-2",
          description: "L2 solutions see massive growth in total value locked",
          pubDate: "2026-01-22T09:30:00Z",
          source: "The Block",
          sourceKey: "theblock",
          category: "defi",
          timeAgo: "2.5 hours ago"
        },
        {
          title: "SEC Approves New Crypto ETF",
          link: "https://decrypt.co/article-3",
          description: "Regulatory approval opens doors for institutional investors",
          pubDate: "2026-01-22T09:00:00Z",
          source: "Decrypt",
          sourceKey: "decrypt",
          category: "regulation",
          timeAgo: "3 hours ago"
        }
      ],
      totalCount: 150,
      sources: ["coindesk", "theblock", "decrypt", "cointelegraph"],
      fetchedAt: "2026-01-22T12:00:00Z"
    }

    it("should fetch latest crypto news", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockNewsResponse)
      })

      const result = await server.executeTool("get_crypto_news", {
        limit: 10
      })

      expect(mockFetch).toHaveBeenCalledTimes(1)
      expect((result as any).content[0].text).toContain("Bitcoin Surges Past $70,000")
      expect((result as any).content[0].text).toContain("CoinDesk")
    })

    it("should filter by source", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          ...mockNewsResponse,
          articles: [mockNewsResponse.articles[0]]
        })
      })

      await server.executeTool("get_crypto_news", {
        limit: 10,
        source: "coindesk"
      })

      const url = mockFetch.mock.calls[0][0]
      expect(url).toContain("source=coindesk")
    })

    it("should respect limit parameter", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockNewsResponse)
      })

      await server.executeTool("get_crypto_news", {
        limit: 5
      })

      const url = mockFetch.mock.calls[0][0]
      expect(url).toContain("limit=5")
    })

    it("should handle API errors gracefully", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: "Service Unavailable"
      })

      const result = await server.executeTool("get_crypto_news", {
        limit: 10
      })

      expect((result as any).content[0].text).toContain("Error")
    })

    it("should handle network errors", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"))

      const result = await server.executeTool("get_crypto_news", {
        limit: 10
      })

      expect((result as any).content[0].text).toContain("Error")
    })
  })

  describe("search_crypto_news", () => {
    const mockSearchResponse = {
      articles: [
        {
          title: "Ethereum 2.0 Upgrade Complete",
          link: "https://coindesk.com/eth-upgrade",
          description: "Major Ethereum network upgrade successfully deployed",
          pubDate: "2026-01-21T15:00:00Z",
          source: "CoinDesk",
          sourceKey: "coindesk",
          category: "technology",
          timeAgo: "1 day ago"
        },
        {
          title: "Ethereum DeFi Ecosystem Expands",
          link: "https://theblock.co/eth-defi",
          description: "DeFi protocols on Ethereum see record activity",
          pubDate: "2026-01-20T12:00:00Z",
          source: "The Block",
          sourceKey: "theblock",
          category: "defi",
          timeAgo: "2 days ago"
        }
      ],
      totalCount: 45,
      fetchedAt: "2026-01-22T12:00:00Z"
    }

    it("should search news by keywords", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSearchResponse)
      })

      const result = await server.executeTool("search_crypto_news", {
        keywords: "ethereum,defi",
        limit: 10
      })

      expect((result as any).content[0].text).toContain("Ethereum")
      expect((result as any).content[0].text).toContain("DeFi")
    })

    it("should URL-encode search keywords", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSearchResponse)
      })

      await server.executeTool("search_crypto_news", {
        keywords: "bitcoin etf",
        limit: 10
      })

      const url = mockFetch.mock.calls[0][0]
      expect(url).toContain("q=bitcoin%20etf")
    })

    it("should handle empty search results", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          articles: [],
          totalCount: 0,
          fetchedAt: "2026-01-22T12:00:00Z"
        })
      })

      const result = await server.executeTool("search_crypto_news", {
        keywords: "nonexistenttopic12345",
        limit: 10
      })

      expect((result as any).content[0].text).toContain("articles")
      expect((result as any).content[0].text).toContain("[]")
    })
  })

  describe("get_defi_news", () => {
    const mockDefiNews = {
      articles: [
        {
          title: "Aave V3 Launches on New Chain",
          link: "https://theblock.co/aave-v3",
          description: "Leading lending protocol expands to new network",
          pubDate: "2026-01-22T08:00:00Z",
          source: "The Block",
          sourceKey: "theblock",
          category: "defi",
          timeAgo: "4 hours ago"
        },
        {
          title: "DEX Volume Reaches Record High",
          link: "https://defiant.io/dex-volume",
          description: "Decentralized exchanges process $50B in weekly volume",
          pubDate: "2026-01-22T07:00:00Z",
          source: "The Defiant",
          sourceKey: "defiant",
          category: "defi",
          timeAgo: "5 hours ago"
        }
      ],
      totalCount: 30,
      fetchedAt: "2026-01-22T12:00:00Z"
    }

    it("should fetch DeFi-specific news", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockDefiNews)
      })

      const result = await server.executeTool("get_defi_news", {
        limit: 10
      })

      expect((result as any).content[0].text).toContain("Aave")
      expect((result as any).content[0].text).toContain("DEX")
      expect((result as any).content[0].text).toContain("defi")
    })

    it("should call correct API endpoint", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockDefiNews)
      })

      await server.executeTool("get_defi_news", {
        limit: 15
      })

      const url = mockFetch.mock.calls[0][0]
      expect(url).toContain("/api/defi")
      expect(url).toContain("limit=15")
    })
  })

  describe("get_bitcoin_news", () => {
    const mockBitcoinNews = {
      articles: [
        {
          title: "Bitcoin Mining Difficulty Adjusts",
          link: "https://bitcoinmagazine.com/mining",
          description: "Network difficulty reaches new all-time high",
          pubDate: "2026-01-22T06:00:00Z",
          source: "Bitcoin Magazine",
          sourceKey: "bitcoinmagazine",
          category: "bitcoin",
          timeAgo: "6 hours ago"
        },
        {
          title: "Lightning Network Capacity Grows",
          link: "https://coindesk.com/lightning",
          description: "Layer 2 payment network sees increased adoption",
          pubDate: "2026-01-22T05:00:00Z",
          source: "CoinDesk",
          sourceKey: "coindesk",
          category: "bitcoin",
          timeAgo: "7 hours ago"
        }
      ],
      totalCount: 25,
      fetchedAt: "2026-01-22T12:00:00Z"
    }

    it("should fetch Bitcoin-specific news", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockBitcoinNews)
      })

      const result = await server.executeTool("get_bitcoin_news", {
        limit: 10
      })

      expect((result as any).content[0].text).toContain("Bitcoin Mining")
      expect((result as any).content[0].text).toContain("Lightning Network")
    })

    it("should call correct API endpoint", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockBitcoinNews)
      })

      await server.executeTool("get_bitcoin_news", {
        limit: 20
      })

      const url = mockFetch.mock.calls[0][0]
      expect(url).toContain("/api/bitcoin")
    })
  })

  describe("get_breaking_crypto_news", () => {
    const mockBreakingNews = {
      articles: [
        {
          title: "BREAKING: Major Exchange Announces New Feature",
          link: "https://cointelegraph.com/breaking",
          description: "Top crypto exchange reveals significant platform update",
          pubDate: "2026-01-22T11:45:00Z",
          source: "Cointelegraph",
          sourceKey: "cointelegraph",
          category: "breaking",
          timeAgo: "15 minutes ago"
        }
      ],
      totalCount: 5,
      fetchedAt: "2026-01-22T12:00:00Z"
    }

    it("should fetch breaking news from last 2 hours", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockBreakingNews)
      })

      const result = await server.executeTool("get_breaking_crypto_news", {
        limit: 5
      })

      expect((result as any).content[0].text).toContain("BREAKING")
      expect((result as any).content[0].text).toContain("last 2 hours")
    })

    it("should call correct API endpoint", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockBreakingNews)
      })

      await server.executeTool("get_breaking_crypto_news", {
        limit: 10
      })

      const url = mockFetch.mock.calls[0][0]
      expect(url).toContain("/api/breaking")
    })

    it("should handle no breaking news", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          articles: [],
          totalCount: 0,
          fetchedAt: "2026-01-22T12:00:00Z"
        })
      })

      const result = await server.executeTool("get_breaking_crypto_news", {
        limit: 5
      })

      expect((result as any).content[0].text).toContain("[]")
    })
  })

  describe("get_crypto_news_sources", () => {
    const mockSourcesResponse = {
      sources: [
        {
          key: "coindesk",
          name: "CoinDesk",
          url: "https://coindesk.com",
          category: "general",
          status: "active"
        },
        {
          key: "theblock",
          name: "The Block",
          url: "https://theblock.co",
          category: "general",
          status: "active"
        },
        {
          key: "decrypt",
          name: "Decrypt",
          url: "https://decrypt.co",
          category: "general",
          status: "active"
        },
        {
          key: "cointelegraph",
          name: "Cointelegraph",
          url: "https://cointelegraph.com",
          category: "general",
          status: "active"
        },
        {
          key: "bitcoinmagazine",
          name: "Bitcoin Magazine",
          url: "https://bitcoinmagazine.com",
          category: "bitcoin",
          status: "active"
        },
        {
          key: "blockworks",
          name: "Blockworks",
          url: "https://blockworks.co",
          category: "general",
          status: "active"
        },
        {
          key: "defiant",
          name: "The Defiant",
          url: "https://thedefiant.io",
          category: "defi",
          status: "active"
        }
      ]
    }

    it("should fetch available news sources", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSourcesResponse)
      })

      const result = await server.executeTool("get_crypto_news_sources", {})

      expect((result as any).content[0].text).toContain("CoinDesk")
      expect((result as any).content[0].text).toContain("The Block")
      expect((result as any).content[0].text).toContain("Bitcoin Magazine")
    })

    it("should include total sources count", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSourcesResponse)
      })

      const result = await server.executeTool("get_crypto_news_sources", {})

      expect((result as any).content[0].text).toContain("totalSources")
      expect((result as any).content[0].text).toContain("7")
    })

    it("should call correct API endpoint", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSourcesResponse)
      })

      await server.executeTool("get_crypto_news_sources", {})

      const url = mockFetch.mock.calls[0][0]
      expect(url).toContain("/api/sources")
    })
  })

  describe("Error Handling", () => {
    it("should handle server errors (500)", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: "Internal Server Error"
      })

      const result = await server.executeTool("get_crypto_news", { limit: 10 })

      expect((result as any).content[0].text).toContain("Error")
    })

    it("should handle timeout errors", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Timeout"))

      const result = await server.executeTool("get_crypto_news", { limit: 10 })

      expect((result as any).content[0].text).toContain("Error")
    })

    it("should handle malformed JSON responses", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.reject(new SyntaxError("Unexpected token"))
      })

      const result = await server.executeTool("get_crypto_news", { limit: 10 })

      expect((result as any).content[0].text).toContain("Error")
    })
  })

  describe("Edge Cases", () => {
    it("should handle maximum limit values", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ articles: [], totalCount: 0, fetchedAt: "" })
      })

      await server.executeTool("get_crypto_news", {
        limit: 50
      })

      const url = mockFetch.mock.calls[0][0]
      expect(url).toContain("limit=50")
    })

    it("should handle special characters in search", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ articles: [], totalCount: 0, fetchedAt: "" })
      })

      await server.executeTool("search_crypto_news", {
        keywords: "bitcoin & ethereum",
        limit: 10
      })

      const url = mockFetch.mock.calls[0][0]
      expect(url).toContain(encodeURIComponent("bitcoin & ethereum"))
    })
  })
})
