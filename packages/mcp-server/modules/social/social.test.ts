/**
 * Tests for Social Module
 * @author nich
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

import { createMockMcpServer } from "../../../tests/mocks/mcp"
import { registerSocialTools } from "./tools"

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

describe("Social Module", () => {
  let server: ReturnType<typeof createMockMcpServer>

  beforeEach(() => {
    server = createMockMcpServer()
    registerSocialTools(server as any)
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe("Tool Registration", () => {
    it("should register all social tools", () => {
      const toolNames = server.getToolNames()

      // Coin social metrics
      expect(toolNames).toContain("social_get_coin_metrics")
      expect(toolNames).toContain("social_get_coins_list")
      expect(toolNames).toContain("social_get_coin_time_series")

      // Social feed
      expect(toolNames).toContain("social_get_feed")
      expect(toolNames).toContain("social_get_trending_posts")

      // Influencers
      expect(toolNames).toContain("social_get_influencers")
      expect(toolNames).toContain("social_get_influencer")
      expect(toolNames).toContain("social_get_influencer_posts")

      // Topics & Categories
      expect(toolNames).toContain("social_get_topics")
      expect(toolNames).toContain("social_get_topic")
      expect(toolNames).toContain("social_get_categories")

      // NFT Social
      expect(toolNames).toContain("social_get_nft_collections")
      expect(toolNames).toContain("social_get_nft_collection")

      // Market Sentiment
      expect(toolNames).toContain("social_get_market_sentiment")
      expect(toolNames).toContain("social_get_market_sentiment_history")

      // CryptoCompare fallbacks
      expect(toolNames).toContain("social_get_reddit_stats")
      expect(toolNames).toContain("social_get_twitter_stats")
      expect(toolNames).toContain("social_get_github_stats")
    })
  })

  describe("social_get_coin_metrics", () => {
    const mockCoinMetrics = {
      symbol: "BTC",
      name: "Bitcoin",
      galaxy_score: 85,
      alt_rank: 1,
      social_volume: 125000,
      social_score: 92,
      social_contributors: 45000,
      social_sentiment: 68,
      price: 65000,
      market_cap: 1280000000000,
      percent_change_24h: 2.5
    }

    it("should fetch coin social metrics", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockCoinMetrics)
      })

      const result = await server.executeTool("social_get_coin_metrics", {
        symbol: "BTC"
      })

      expect((result as any).content[0].text).toContain("galaxy_score")
      expect((result as any).content[0].text).toContain("85")
      expect((result as any).content[0].text).toContain("social_volume")
    })

    it("should handle lowercase symbols", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockCoinMetrics)
      })

      await server.executeTool("social_get_coin_metrics", {
        symbol: "btc"
      })

      const url = mockFetch.mock.calls[0][0]
      expect(url).toContain("/coins/btc")
    })

    it("should fallback to CryptoCompare on failure", async () => {
      // First call (LunarCrush) fails
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401
      })
      // Second call (CryptoCompare) succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ Data: { General: { Points: 100 } } })
      })

      const result = await server.executeTool("social_get_coin_metrics", {
        symbol: "BTC"
      })

      expect(mockFetch).toHaveBeenCalledTimes(2)
    })

    it("should handle non-existent tokens", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404
      })
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404
      })

      const result = await server.executeTool("social_get_coin_metrics", {
        symbol: "INVALIDTOKEN123"
      })

      expect((result as any).content[0].text).toContain("Failed to fetch social metrics")
    })
  })

  describe("social_get_coins_list", () => {
    const mockCoinsList = {
      data: [
        { symbol: "BTC", galaxy_score: 85, alt_rank: 1, social_volume: 125000 },
        { symbol: "ETH", galaxy_score: 82, alt_rank: 2, social_volume: 95000 },
        { symbol: "SOL", galaxy_score: 78, alt_rank: 5, social_volume: 45000 }
      ]
    }

    it("should fetch coins list with social metrics", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockCoinsList)
      })

      const result = await server.executeTool("social_get_coins_list", {
        sort: "galaxy_score",
        limit: 50
      })

      expect((result as any).content[0].text).toContain("BTC")
      expect((result as any).content[0].text).toContain("ETH")
      expect((result as any).content[0].text).toContain("SOL")
    })

    it("should support different sort options", async () => {
      const sortOptions = ["galaxy_score", "alt_rank", "social_volume", "market_cap"]

      for (const sort of sortOptions) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockCoinsList)
        })

        await server.executeTool("social_get_coins_list", {
          sort,
          limit: 10
        })

        const url = mockFetch.mock.calls[mockFetch.mock.calls.length - 1][0]
        expect(url).toContain(`sort=${sort}`)
      }
    })
  })

  describe("social_get_coin_time_series", () => {
    const mockTimeSeries = {
      data: [
        { timestamp: 1700000000, social_volume: 120000, sentiment: 65 },
        { timestamp: 1700086400, social_volume: 125000, sentiment: 68 },
        { timestamp: 1700172800, social_volume: 130000, sentiment: 70 }
      ]
    }

    it("should fetch historical social metrics", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockTimeSeries)
      })

      const result = await server.executeTool("social_get_coin_time_series", {
        symbol: "BTC",
        interval: "day"
      })

      expect((result as any).content[0].text).toContain("social_volume")
      expect((result as any).content[0].text).toContain("sentiment")
    })

    it("should support different intervals", async () => {
      const intervals = ["hour", "day", "week"]

      for (const interval of intervals) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockTimeSeries)
        })

        await server.executeTool("social_get_coin_time_series", {
          symbol: "BTC",
          interval
        })

        const url = mockFetch.mock.calls[mockFetch.mock.calls.length - 1][0]
        expect(url).toContain(`interval=${interval}`)
      }
    })
  })

  describe("social_get_feed", () => {
    const mockFeedData = {
      data: [
        {
          id: "1",
          text: "Bitcoin looks bullish! #BTC",
          source: "twitter",
          engagement: 5000,
          sentiment: "positive",
          timestamp: 1700000000
        },
        {
          id: "2",
          text: "Ethereum scaling solutions are amazing",
          source: "reddit",
          engagement: 2500,
          sentiment: "positive",
          timestamp: 1699999000
        }
      ]
    }

    it("should fetch social feed", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockFeedData)
      })

      const result = await server.executeTool("social_get_feed", {
        limit: 50
      })

      expect((result as any).content[0].text).toContain("Bitcoin looks bullish")
      expect((result as any).content[0].text).toContain("twitter")
    })

    it("should filter by symbol", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockFeedData)
      })

      await server.executeTool("social_get_feed", {
        symbol: "BTC",
        limit: 25
      })

      const url = mockFetch.mock.calls[0][0]
      expect(url).toContain("symbol=btc")
    })

    it("should filter by source", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockFeedData)
      })

      await server.executeTool("social_get_feed", {
        source: "twitter",
        limit: 25
      })

      const url = mockFetch.mock.calls[0][0]
      expect(url).toContain("source=twitter")
    })
  })

  describe("social_get_trending_posts", () => {
    const mockTrendingPosts = {
      data: [
        {
          id: "1",
          text: "This is going viral! #crypto",
          engagement: 50000,
          shares: 10000,
          source: "twitter"
        },
        {
          id: "2",
          text: "Breaking news in DeFi",
          engagement: 35000,
          shares: 7500,
          source: "twitter"
        }
      ]
    }

    it("should fetch trending posts", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockTrendingPosts)
      })

      const result = await server.executeTool("social_get_trending_posts", {
        type: "hot",
        limit: 25
      })

      expect((result as any).content[0].text).toContain("viral")
      expect((result as any).content[0].text).toContain("50000")
    })

    it("should support different trending types", async () => {
      const types = ["rising", "hot", "top"]

      for (const type of types) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockTrendingPosts)
        })

        await server.executeTool("social_get_trending_posts", {
          type,
          limit: 10
        })

        const url = mockFetch.mock.calls[mockFetch.mock.calls.length - 1][0]
        expect(url).toContain(`type=${type}`)
      }
    })
  })

  describe("social_get_influencers", () => {
    const mockInfluencers = {
      data: [
        {
          handle: "cryptoinfluencer1",
          followers: 500000,
          engagement_rate: 5.2,
          influence_score: 95
        },
        {
          handle: "btcmaxi",
          followers: 350000,
          engagement_rate: 4.8,
          influence_score: 88
        }
      ]
    }

    it("should fetch top influencers", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockInfluencers)
      })

      const result = await server.executeTool("social_get_influencers", {
        sort: "influence_score",
        limit: 50
      })

      expect((result as any).content[0].text).toContain("cryptoinfluencer1")
      expect((result as any).content[0].text).toContain("influence_score")
    })

    it("should filter by symbol", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockInfluencers)
      })

      await server.executeTool("social_get_influencers", {
        symbol: "BTC",
        limit: 25
      })

      const url = mockFetch.mock.calls[0][0]
      expect(url).toContain("symbol=btc")
    })
  })

  describe("social_get_influencer", () => {
    const mockInfluencerDetails = {
      handle: "cryptoinfluencer1",
      name: "Crypto Guru",
      followers: 500000,
      following: 1000,
      engagement_rate: 5.2,
      influence_score: 95,
      top_coins: ["BTC", "ETH", "SOL"],
      avg_sentiment: 72
    }

    it("should fetch influencer details", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockInfluencerDetails)
      })

      const result = await server.executeTool("social_get_influencer", {
        handle: "cryptoinfluencer1"
      })

      expect((result as any).content[0].text).toContain("Crypto Guru")
      expect((result as any).content[0].text).toContain("500000")
    })

    it("should handle non-existent influencer", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404
      })

      const result = await server.executeTool("social_get_influencer", {
        handle: "nonexistent_user_12345"
      })

      expect((result as any).content[0].text).toContain("Failed to fetch influencer")
    })
  })

  describe("social_get_topics", () => {
    const mockTopics = {
      data: [
        { topic: "bitcoin-etf", social_volume: 50000, sentiment: 75 },
        { topic: "defi-summer", social_volume: 35000, sentiment: 68 },
        { topic: "nft-comeback", social_volume: 25000, sentiment: 62 }
      ]
    }

    it("should fetch trending topics", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockTopics)
      })

      const result = await server.executeTool("social_get_topics", {
        limit: 25
      })

      expect((result as any).content[0].text).toContain("bitcoin-etf")
      expect((result as any).content[0].text).toContain("defi-summer")
    })

    it("should filter by category", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockTopics)
      })

      await server.executeTool("social_get_topics", {
        category: "defi",
        limit: 10
      })

      const url = mockFetch.mock.calls[0][0]
      expect(url).toContain("category=defi")
    })
  })

  describe("social_get_market_sentiment", () => {
    const mockSentiment = {
      overall_sentiment: 68,
      fear_greed_index: 72,
      bullish_percent: 65,
      bearish_percent: 20,
      neutral_percent: 15,
      social_volume_24h: 2500000,
      trending_coins: ["BTC", "ETH", "SOL"]
    }

    it("should fetch market sentiment", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSentiment)
      })

      const result = await server.executeTool("social_get_market_sentiment", {})

      expect((result as any).content[0].text).toContain("overall_sentiment")
      expect((result as any).content[0].text).toContain("fear_greed_index")
      expect((result as any).content[0].text).toContain("72")
    })
  })

  describe("social_get_market_sentiment_history", () => {
    const mockSentimentHistory = {
      data: [
        { timestamp: 1700000000, sentiment: 65, fear_greed: 68 },
        { timestamp: 1700086400, sentiment: 68, fear_greed: 70 },
        { timestamp: 1700172800, sentiment: 72, fear_greed: 75 }
      ]
    }

    it("should fetch historical sentiment", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSentimentHistory)
      })

      const result = await server.executeTool("social_get_market_sentiment_history", {
        interval: "day",
        days: 30
      })

      expect((result as any).content[0].text).toContain("sentiment")
      expect((result as any).content[0].text).toContain("fear_greed")
    })
  })

  describe("social_get_nft_collections", () => {
    const mockNftCollections = {
      data: [
        { slug: "cryptopunks", social_volume: 15000, floor_price: 50 },
        { slug: "boredapeyachtclub", social_volume: 12000, floor_price: 30 },
        { slug: "azuki", social_volume: 8000, floor_price: 10 }
      ]
    }

    it("should fetch NFT collections with social metrics", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockNftCollections)
      })

      const result = await server.executeTool("social_get_nft_collections", {
        sort: "social_volume",
        limit: 50
      })

      expect((result as any).content[0].text).toContain("cryptopunks")
      expect((result as any).content[0].text).toContain("boredapeyachtclub")
    })
  })

  describe("CryptoCompare Fallback Tools", () => {
    describe("social_get_reddit_stats", () => {
      const mockRedditStats = {
        Data: {
          Reddit: {
            subscribers: 5000000,
            active_users: 15000,
            posts_per_hour: 50,
            comments_per_hour: 500
          }
        }
      }

      it("should fetch Reddit statistics", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockRedditStats)
        })

        const result = await server.executeTool("social_get_reddit_stats", {
          symbol: "BTC"
        })

        expect((result as any).content[0].text).toContain("subscribers")
      })
    })

    describe("social_get_twitter_stats", () => {
      const mockTwitterStats = {
        Data: {
          Twitter: {
            followers: 2500000,
            following: 50,
            tweets: 15000
          }
        }
      }

      it("should fetch Twitter statistics", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockTwitterStats)
        })

        const result = await server.executeTool("social_get_twitter_stats", {
          symbol: "ETH"
        })

        expect((result as any).content[0].text).toContain("followers")
      })
    })

    describe("social_get_github_stats", () => {
      const mockGithubStats = {
        Data: {
          CodeRepository: {
            stars: 45000,
            forks: 15000,
            subscribers: 3000,
            contributors: 500
          }
        }
      }

      it("should fetch GitHub statistics", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockGithubStats)
        })

        const result = await server.executeTool("social_get_github_stats", {
          symbol: "ETH"
        })

        expect((result as any).content[0].text).toContain("stars") || expect((result as any).content[0].text).toContain("Data")
      })
    })
  })

  describe("Error Handling", () => {
    it("should handle API key errors (401)", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401
      })
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401
      })

      const result = await server.executeTool("social_get_coin_metrics", {
        symbol: "BTC"
      })

      expect((result as any).content[0].text).toContain("Failed")
    })

    it("should handle rate limiting (429)", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429
      })

      const result = await server.executeTool("social_get_coins_list", {
        limit: 50
      })

      expect((result as any).content[0].text).toContain("Failed")
    })

    it("should handle network errors", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"))

      const result = await server.executeTool("social_get_market_sentiment", {})

      expect((result as any).content[0].text).toContain("Failed")
    })
  })

  describe("Edge Cases", () => {
    it("should handle empty results", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [] })
      })

      const result = await server.executeTool("social_get_coins_list", {
        limit: 50
      })

      expect((result as any).content[0].text).toContain("[]")
    })

    it("should handle uppercase and lowercase symbols consistently", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ symbol: "BTC" })
      })

      await server.executeTool("social_get_coin_metrics", {
        symbol: "BTC"
      })

      const url = mockFetch.mock.calls[0][0]
      expect(url.toLowerCase()).toContain("btc")
    })
  })
})
