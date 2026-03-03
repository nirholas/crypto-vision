/**
 * Tests for Market Data Module
 * @author nich
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

import { createMockMcpServer } from "../../../tests/mocks/mcp"
import { registerMarketDataTools } from "./tools"

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

describe("Market Data Module", () => {
  let server: ReturnType<typeof createMockMcpServer>

  beforeEach(() => {
    server = createMockMcpServer()
    registerMarketDataTools(server as any)
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe("Tool Registration", () => {
    it("should register all market data tools", () => {
      const toolNames = server.getToolNames()
      
      expect(toolNames).toContain("market_get_coins")
      expect(toolNames).toContain("market_get_coin_by_id")
      expect(toolNames).toContain("market_get_coin_chart")
      expect(toolNames).toContain("market_get_coin_avg_price")
      expect(toolNames).toContain("market_get_exchange_price")
      expect(toolNames).toContain("market_get_exchanges")
      expect(toolNames).toContain("market_get_tickers")
      expect(toolNames).toContain("market_get_blockchains")
      expect(toolNames).toContain("market_get_global")
      expect(toolNames).toContain("market_get_news")
    })
  })

  describe("market_get_coins", () => {
    const mockCoinsResponse = {
      coins: [
        {
          id: "bitcoin",
          symbol: "BTC",
          name: "Bitcoin",
          price: 65000,
          marketCap: 1280000000000,
          volume: 25000000000,
          priceChange1h: 0.5,
          priceChange24h: 2.3,
          priceChange7d: -1.2
        },
        {
          id: "ethereum",
          symbol: "ETH",
          name: "Ethereum",
          price: 3500,
          marketCap: 420000000000,
          volume: 15000000000,
          priceChange1h: 0.3,
          priceChange24h: 1.8,
          priceChange7d: 3.5
        }
      ],
      meta: {
        page: 1,
        limit: 20,
        total: 100
      }
    }

    it("should fetch coins list successfully", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockCoinsResponse)
      })

      const result = await server.executeTool("market_get_coins", {
        page: 1,
        limit: 20,
        currency: "USD"
      })

      expect(mockFetch).toHaveBeenCalledTimes(1)
      expect((result as any).content[0].text).toContain("bitcoin")
      expect((result as any).content[0].text).toContain("ethereum")
    })

    it("should filter coins by name", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ coins: [mockCoinsResponse.coins[0]] })
      })

      const result = await server.executeTool("market_get_coins", {
        name: "bitcoin"
      })

      expect(mockFetch).toHaveBeenCalledTimes(1)
      const url = mockFetch.mock.calls[0][0]
      expect(url).toContain("name=bitcoin")
    })

    it("should filter coins by symbol", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ coins: [mockCoinsResponse.coins[0]] })
      })

      await server.executeTool("market_get_coins", {
        symbol: "BTC"
      })

      const url = mockFetch.mock.calls[0][0]
      expect(url).toContain("symbol=BTC")
    })

    it("should filter by market cap range", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ coins: [] })
      })

      await server.executeTool("market_get_coins", {
        marketCapGreaterThan: 1000000000,
        marketCapLessThan: 10000000000
      })

      const url = mockFetch.mock.calls[0][0]
      // URL encoding converts ~ to %7E
      expect(url).toContain("marketCap%7EgreaterThan=1000000000")
      expect(url).toContain("marketCap%7ElessThan=10000000000")
    })

    it("should handle API errors gracefully", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500
      })

      const result = await server.executeTool("market_get_coins", {})

      expect((result as any).content[0].text).toContain("Failed to fetch coins data")
    })

    it("should handle network errors gracefully", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"))

      const result = await server.executeTool("market_get_coins", {})

      expect((result as any).content[0].text).toContain("Failed to fetch coins data")
    })
  })

  describe("market_get_coin_by_id", () => {
    const mockCoinData = {
      coin: {
        id: "bitcoin",
        symbol: "BTC",
        name: "Bitcoin",
        price: 65000,
        marketCap: 1280000000000,
        volume: 25000000000,
        rank: 1,
        availableSupply: 19500000,
        totalSupply: 21000000,
        website: "https://bitcoin.org"
      }
    }

    it("should fetch coin details by ID", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockCoinData)
      })

      const result = await server.executeTool("market_get_coin_by_id", {
        coinId: "bitcoin",
        currency: "USD"
      })

      expect((result as any).content[0].text).toContain("bitcoin")
      expect((result as any).content[0].text).toContain("65000")
    })

    it("should handle non-existent coin ID", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404
      })

      const result = await server.executeTool("market_get_coin_by_id", {
        coinId: "invalid-coin-xyz"
      })

      expect((result as any).content[0].text).toContain("Failed to fetch coin data")
    })
  })

  describe("market_get_coin_chart", () => {
    const mockChartData = {
      chart: [
        [1700000000, 64000],
        [1700086400, 64500],
        [1700172800, 65000],
        [1700259200, 64800],
        [1700345600, 65200]
      ]
    }

    it("should fetch chart data for 24h period", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockChartData)
      })

      const result = await server.executeTool("market_get_coin_chart", {
        coinId: "bitcoin",
        period: "24h"
      })

      expect((result as any).content[0].text).toContain("chart")
    })

    it("should support different time periods", async () => {
      const periods = ["24h", "1w", "1m", "3m", "6m", "1y", "all"]

      for (const period of periods) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockChartData)
        })

        await server.executeTool("market_get_coin_chart", {
          coinId: "bitcoin",
          period
        })

        const url = mockFetch.mock.calls[mockFetch.mock.calls.length - 1][0]
        expect(url).toContain(`period=${period}`)
      }
    })
  })

  describe("market_get_coin_avg_price", () => {
    const mockAvgPriceData = {
      price: 62500.5,
      timestamp: 1700000000
    }

    it("should fetch historical average price", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockAvgPriceData)
      })

      const result = await server.executeTool("market_get_coin_avg_price", {
        coinId: "bitcoin",
        timestamp: 1700000000
      })

      expect((result as any).content[0].text).toContain("62500.5")
    })
  })

  describe("market_get_exchanges", () => {
    const mockExchangesData = {
      exchanges: [
        { name: "Binance", id: "binance", volume24h: 10000000000 },
        { name: "Coinbase", id: "coinbase", volume24h: 5000000000 },
        { name: "Kraken", id: "kraken", volume24h: 2000000000 }
      ]
    }

    it("should fetch list of exchanges", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockExchangesData)
      })

      const result = await server.executeTool("market_get_exchanges", {})

      expect((result as any).content[0].text).toContain("Binance")
      expect((result as any).content[0].text).toContain("Coinbase")
    })
  })

  describe("market_get_tickers", () => {
    const mockTickersData = {
      tickers: [
        {
          exchange: "binance",
          pair: "BTC/USDT",
          price: 65000,
          volume: 1000000000
        },
        {
          exchange: "coinbase",
          pair: "BTC/USD",
          price: 65010,
          volume: 500000000
        }
      ]
    }

    it("should fetch tickers across exchanges", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockTickersData)
      })

      const result = await server.executeTool("market_get_tickers", {
        coinId: "bitcoin"
      })

      expect((result as any).content[0].text).toContain("BTC/USDT")
      expect((result as any).content[0].text).toContain("binance")
    })

    it("should filter tickers by exchange", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ tickers: [mockTickersData.tickers[0]] })
      })

      await server.executeTool("market_get_tickers", {
        exchange: "binance"
      })

      const url = mockFetch.mock.calls[0][0]
      expect(url).toContain("exchange=binance")
    })
  })

  describe("market_get_global", () => {
    const mockGlobalData = {
      marketCap: 2500000000000,
      volume24h: 100000000000,
      btcDominance: 52.5,
      ethDominance: 18.2,
      marketCapChange24h: 2.3,
      activeCoins: 25000,
      totalCoins: 30000
    }

    it("should fetch global market statistics", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockGlobalData)
      })

      const result = await server.executeTool("market_get_global", {})

      expect((result as any).content[0].text).toContain("2500000000000")
      expect((result as any).content[0].text).toContain("52.5")
    })
  })

  describe("market_get_wallet_balance", () => {
    const mockBalanceData = {
      address: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
      totalBalance: 150000000,
      tokens: [
        { symbol: "ETH", balance: 100, valueUSD: 350000 },
        { symbol: "USDC", balance: 500000, valueUSD: 500000 }
      ]
    }

    it("should fetch wallet balance", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockBalanceData)
      })

      const result = await server.executeTool("market_get_wallet_balance", {
        address: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
        connectionId: "ethereum"
      })

      expect((result as any).content[0].text).toContain("0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045")
    })

    it("should handle invalid addresses", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400
      })

      const result = await server.executeTool("market_get_wallet_balance", {
        address: "invalid-address",
        connectionId: "ethereum"
      })

      expect((result as any).content[0].text).toContain("Failed to fetch wallet balance")
    })
  })

  describe("market_get_news", () => {
    const mockNewsData = {
      news: [
        {
          id: "1",
          title: "Bitcoin Reaches New High",
          description: "Bitcoin price surges past $65,000",
          source: "CoinDesk",
          date: "2026-01-20T10:00:00Z"
        },
        {
          id: "2",
          title: "Ethereum 2.0 Update",
          description: "Major Ethereum network upgrade announced",
          source: "The Block",
          date: "2026-01-20T09:00:00Z"
        }
      ]
    }

    it("should fetch crypto news", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockNewsData)
      })

      const result = await server.executeTool("market_get_news", {
        page: 1,
        limit: 20
      })

      expect((result as any).content[0].text).toContain("Bitcoin Reaches New High")
    })

    it("should support pagination", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ news: [] })
      })

      await server.executeTool("market_get_news", {
        page: 5,
        limit: 10
      })

      const url = mockFetch.mock.calls[0][0]
      expect(url).toContain("page=5")
      expect(url).toContain("limit=10")
    })
  })

  describe("Edge Cases", () => {
    it("should handle empty response data", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ coins: [] })
      })

      const result = await server.executeTool("market_get_coins", {})

      expect((result as any).content[0].text).toContain("[]")
    })

    it("should handle rate limiting (429)", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429
      })

      const result = await server.executeTool("market_get_coins", {})

      expect((result as any).content[0].text).toContain("Failed")
    })

    it("should handle malformed JSON response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.reject(new Error("Invalid JSON"))
      })

      const result = await server.executeTool("market_get_coins", {})

      expect((result as any).content[0].text).toContain("Failed")
    })
  })
})
