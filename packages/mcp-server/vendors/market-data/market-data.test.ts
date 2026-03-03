/**
 * Tests for Market Data vendor module
 * @author nich
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

// Mock fetch for API calls
const mockFetch = vi.fn()
global.fetch = mockFetch

// Mock environment variable
const MOCK_API_KEY = "test-api-key-123"

describe("Market Data Vendor Module", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockReset()
    process.env.UNIVERSAL_CRYPTO_API_KEY = MOCK_API_KEY
  })

  afterEach(() => {
    vi.restoreAllMocks()
    delete process.env.UNIVERSAL_CRYPTO_API_KEY
  })

  describe("Coin Data", () => {
    describe("Get Coins List", () => {
      it("should fetch all coins with default pagination", async () => {
        const mockCoins = {
          data: [
            {
              id: "bitcoin",
              symbol: "BTC",
              name: "Bitcoin",
              price: 45000,
              marketCap: 850000000000,
              volume: 25000000000,
              priceChange24h: 2.5
            },
            {
              id: "ethereum",
              symbol: "ETH",
              name: "Ethereum",
              price: 2500,
              marketCap: 300000000000,
              volume: 15000000000,
              priceChange24h: -1.2
            }
          ],
          meta: {
            page: 1,
            limit: 20,
            total: 10000
          }
        }

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockCoins)
        })

        const response = await fetch("https://api.universalcrypto.com/coins?page=1&limit=20&currency=USD")
        const data = await response.json()

        expect(data.data).toHaveLength(2)
        expect(data.data[0].symbol).toBe("BTC")
        expect(data.meta.page).toBe(1)
      })

      it("should filter coins by name", async () => {
        const mockFilteredCoins = {
          data: [
            {
              id: "bitcoin",
              symbol: "BTC",
              name: "Bitcoin",
              price: 45000
            }
          ],
          meta: { page: 1, limit: 20, total: 1 }
        }

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockFilteredCoins)
        })

        const response = await fetch("https://api.universalcrypto.com/coins?name=bitcoin")
        const data = await response.json()

        expect(data.data).toHaveLength(1)
        expect(data.data[0].name).toBe("Bitcoin")
      })

      it("should filter coins by blockchain", async () => {
        const mockFilteredCoins = {
          data: [
            { id: "token1", symbol: "TKN1", name: "Token 1", blockchain: "ethereum" },
            { id: "token2", symbol: "TKN2", name: "Token 2", blockchain: "ethereum" }
          ],
          meta: { page: 1, limit: 20, total: 2 }
        }

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockFilteredCoins)
        })

        const response = await fetch("https://api.universalcrypto.com/coins?blockchains=ethereum")
        const data = await response.json()

        expect(data.data.every((coin: any) => coin.blockchain === "ethereum")).toBe(true)
      })

      it("should filter coins by market cap range", async () => {
        const mockFilteredCoins = {
          data: [
            { id: "bitcoin", marketCap: 850000000000 },
            { id: "ethereum", marketCap: 300000000000 }
          ],
          meta: { page: 1, limit: 20, total: 2 }
        }

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockFilteredCoins)
        })

        const response = await fetch(
          "https://api.universalcrypto.com/coins?marketCap~greaterThan=100000000000"
        )
        const data = await response.json()

        expect(data.data.every((coin: any) => coin.marketCap > 100000000000)).toBe(true)
      })

      it("should sort coins by volume descending", async () => {
        const mockSortedCoins = {
          data: [
            { id: "bitcoin", volume: 25000000000 },
            { id: "ethereum", volume: 15000000000 },
            { id: "tether", volume: 50000000000 }
          ].sort((a, b) => b.volume - a.volume),
          meta: { page: 1, limit: 20, total: 3 }
        }

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockSortedCoins)
        })

        const response = await fetch("https://api.universalcrypto.com/coins?sortBy=volume&sortDir=desc")
        const data = await response.json()

        expect(data.data[0].volume).toBeGreaterThanOrEqual(data.data[1].volume)
      })
    })

    describe("Get Coin By ID", () => {
      it("should fetch detailed coin information", async () => {
        const mockCoin = {
          id: "bitcoin",
          symbol: "BTC",
          name: "Bitcoin",
          price: 45000,
          marketCap: 850000000000,
          volume: 25000000000,
          circulatingSupply: 19000000,
          totalSupply: 21000000,
          maxSupply: 21000000,
          priceChange1h: 0.5,
          priceChange24h: 2.5,
          priceChange7d: -3.2,
          allTimeHigh: 69000,
          allTimeLow: 65,
          links: {
            website: "https://bitcoin.org",
            whitepaper: "https://bitcoin.org/bitcoin.pdf"
          }
        }

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockCoin)
        })

        const response = await fetch("https://api.universalcrypto.com/coins/bitcoin")
        const data = await response.json()

        expect(data.id).toBe("bitcoin")
        expect(data.maxSupply).toBe(21000000)
        expect(data.links).toBeDefined()
      })

      it("should handle non-existent coin", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 404,
          json: () => Promise.resolve({ error: "Coin not found" })
        })

        const response = await fetch("https://api.universalcrypto.com/coins/nonexistent")

        expect(response.ok).toBe(false)
        expect(response.status).toBe(404)
      })
    })

    describe("Get Coin Chart Data", () => {
      it("should fetch chart data for 24h period", async () => {
        const mockChartData = {
          prices: [
            [1700000000000, 44500],
            [1700003600000, 44800],
            [1700007200000, 45000]
          ],
          marketCaps: [
            [1700000000000, 840000000000],
            [1700003600000, 845000000000],
            [1700007200000, 850000000000]
          ],
          volumes: [
            [1700000000000, 24000000000],
            [1700003600000, 24500000000],
            [1700007200000, 25000000000]
          ]
        }

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockChartData)
        })

        const response = await fetch("https://api.universalcrypto.com/coins/bitcoin/charts?period=24h")
        const data = await response.json()

        expect(data.prices).toHaveLength(3)
        expect(data.prices[0]).toHaveLength(2) // [timestamp, price]
      })

      it("should fetch chart data for 7d period", async () => {
        const mockChartData = {
          prices: Array(7).fill(null).map((_, i) => [1700000000000 + i * 86400000, 44000 + i * 100]),
          marketCaps: [],
          volumes: []
        }

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockChartData)
        })

        const response = await fetch("https://api.universalcrypto.com/coins/bitcoin/charts?period=1w")
        const data = await response.json()

        expect(data.prices).toHaveLength(7)
      })
    })

    describe("Get Coin Average Price", () => {
      it("should fetch historical average price", async () => {
        const mockAvgPrice = {
          coinId: "bitcoin",
          price: 43500,
          timestamp: 1699920000
        }

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockAvgPrice)
        })

        const response = await fetch(
          "https://api.universalcrypto.com/coins/price/avg?coinId=bitcoin&timestamp=1699920000"
        )
        const data = await response.json()

        expect(data.price).toBe(43500)
        expect(data.timestamp).toBe(1699920000)
      })
    })
  })

  describe("Ticker Data", () => {
    describe("Get Exchanges", () => {
      it("should fetch list of supported exchanges", async () => {
        const mockExchanges = [
          { id: "binance", name: "Binance", country: "Cayman Islands" },
          { id: "coinbase", name: "Coinbase", country: "USA" },
          { id: "kraken", name: "Kraken", country: "USA" }
        ]

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockExchanges)
        })

        const response = await fetch("https://api.universalcrypto.com/tickers/exchanges")
        const data = await response.json()

        expect(data).toHaveLength(3)
        expect(data.some((e: any) => e.id === "binance")).toBe(true)
      })
    })

    describe("Get Ticker Markets", () => {
      it("should fetch ticker data for specific pair", async () => {
        const mockTickers = {
          data: [
            {
              exchange: "binance",
              pair: "BTC/USDT",
              price: 45000,
              volume24h: 1500000000,
              spread: 0.01,
              lastUpdated: "2024-01-15T10:00:00Z"
            },
            {
              exchange: "coinbase",
              pair: "BTC/USDT",
              price: 45005,
              volume24h: 800000000,
              spread: 0.02,
              lastUpdated: "2024-01-15T10:00:00Z"
            }
          ],
          meta: { page: 1, limit: 20, total: 2 }
        }

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockTickers)
        })

        const response = await fetch(
          "https://api.universalcrypto.com/tickers/markets?fromCoin=BTC&toCoin=USDT"
        )
        const data = await response.json()

        expect(data.data).toHaveLength(2)
        expect(data.data[0].pair).toBe("BTC/USDT")
      })

      it("should filter tickers by exchange", async () => {
        const mockTickers = {
          data: [
            { exchange: "binance", pair: "BTC/USDT", price: 45000 }
          ],
          meta: { page: 1, limit: 20, total: 1 }
        }

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockTickers)
        })

        const response = await fetch(
          "https://api.universalcrypto.com/tickers/markets?exchange=binance"
        )
        const data = await response.json()

        expect(data.data.every((t: any) => t.exchange === "binance")).toBe(true)
      })
    })
  })

  describe("Wallet Data", () => {
    describe("Get Blockchains", () => {
      it("should fetch supported blockchains", async () => {
        const mockBlockchains = [
          { id: "ethereum", name: "Ethereum", symbol: "ETH", connectionId: "eth-1" },
          { id: "bitcoin", name: "Bitcoin", symbol: "BTC", connectionId: "btc-1" },
          { id: "bnb-smart-chain", name: "BNB Smart Chain", symbol: "BNB", connectionId: "bsc-1" }
        ]

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockBlockchains)
        })

        const response = await fetch("https://api.universalcrypto.com/wallet/blockchains")
        const data = await response.json()

        expect(data).toHaveLength(3)
        expect(data.some((b: any) => b.id === "ethereum")).toBe(true)
      })
    })

    describe("Get Wallet Balance", () => {
      it("should fetch wallet balance for specific network", async () => {
        const mockBalance = {
          address: "0x1234567890123456789012345678901234567890",
          network: "ethereum",
          nativeBalance: "1.5",
          tokens: [
            { symbol: "USDC", balance: "1000", valueUsd: 1000 },
            { symbol: "UNI", balance: "50", valueUsd: 250 }
          ],
          totalValueUsd: 4750
        }

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockBalance)
        })

        const response = await fetch(
          "https://api.universalcrypto.com/wallet/balance?address=0x1234&connectionId=eth-1"
        )
        const data = await response.json()

        expect(data.nativeBalance).toBe("1.5")
        expect(data.tokens).toHaveLength(2)
      })

      it("should fetch wallet balances across all networks", async () => {
        const mockBalances = {
          address: "0x1234567890123456789012345678901234567890",
          networks: [
            { network: "ethereum", nativeBalance: "1.5", totalValueUsd: 4750 },
            { network: "polygon", nativeBalance: "100", totalValueUsd: 120 },
            { network: "arbitrum", nativeBalance: "0.5", totalValueUsd: 1500 }
          ],
          totalValueUsd: 6370
        }

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockBalances)
        })

        const response = await fetch(
          "https://api.universalcrypto.com/wallet/balances?address=0x1234"
        )
        const data = await response.json()

        expect(data.networks).toHaveLength(3)
        expect(data.totalValueUsd).toBe(6370)
      })
    })

    describe("Get Wallet Transactions", () => {
      it("should fetch wallet transactions", async () => {
        const mockTransactions = {
          data: [
            {
              txId: "0xabc123",
              type: "transfer",
              from: "0x1234",
              to: "0x5678",
              value: "1.0",
              symbol: "ETH",
              timestamp: "2024-01-15T10:00:00Z"
            },
            {
              txId: "0xdef456",
              type: "swap",
              from: "0x1234",
              to: "0xRouter",
              value: "100",
              symbol: "USDC",
              timestamp: "2024-01-14T08:00:00Z"
            }
          ],
          meta: { page: 1, limit: 20, total: 2 }
        }

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockTransactions)
        })

        const response = await fetch(
          "https://api.universalcrypto.com/wallet/transactions?address=0x1234&connectionId=eth-1"
        )
        const data = await response.json()

        expect(data.data).toHaveLength(2)
        expect(data.data[0].type).toBe("transfer")
      })
    })
  })

  describe("Global Market Data", () => {
    describe("Get Market Cap", () => {
      it("should fetch global market data", async () => {
        const mockMarketData = {
          totalMarketCap: 1700000000000,
          totalVolume24h: 75000000000,
          btcDominance: 50.5,
          ethDominance: 17.2,
          defiMarketCap: 80000000000,
          stablecoinVolume24h: 30000000000,
          marketCapChange24h: 2.3,
          activeCryptocurrencies: 10000,
          upcomingIcos: 50,
          ongoingIcos: 25
        }

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockMarketData)
        })

        const response = await fetch("https://api.universalcrypto.com/markets")
        const data = await response.json()

        expect(data.totalMarketCap).toBe(1700000000000)
        expect(data.btcDominance).toBe(50.5)
      })
    })
  })

  describe("News Data", () => {
    describe("Get News Sources", () => {
      it("should fetch news sources", async () => {
        const mockSources = [
          { id: "coindesk", name: "CoinDesk", url: "https://coindesk.com" },
          { id: "cointelegraph", name: "Cointelegraph", url: "https://cointelegraph.com" }
        ]

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockSources)
        })

        const response = await fetch("https://api.universalcrypto.com/news/sources")
        const data = await response.json()

        expect(data).toHaveLength(2)
      })
    })

    describe("Get News", () => {
      it("should fetch news articles with pagination", async () => {
        const mockNews = {
          data: [
            {
              id: "1",
              title: "Bitcoin Reaches New High",
              source: "CoinDesk",
              publishedAt: "2024-01-15T10:00:00Z",
              sentiment: "bullish"
            },
            {
              id: "2",
              title: "Ethereum Update Announced",
              source: "Cointelegraph",
              publishedAt: "2024-01-15T09:00:00Z",
              sentiment: "neutral"
            }
          ],
          meta: { page: 1, limit: 20, total: 100 }
        }

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockNews)
        })

        const response = await fetch("https://api.universalcrypto.com/news?page=1&limit=20")
        const data = await response.json()

        expect(data.data).toHaveLength(2)
        expect(data.data[0].sentiment).toBe("bullish")
      })

      it("should fetch news by type", async () => {
        const mockTrendingNews = {
          data: [
            { id: "1", title: "Trending News 1", type: "trending" },
            { id: "2", title: "Trending News 2", type: "trending" }
          ],
          meta: { page: 1, limit: 20, total: 2 }
        }

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockTrendingNews)
        })

        const response = await fetch("https://api.universalcrypto.com/news/type/trending")
        const data = await response.json()

        expect(data.data.every((n: any) => n.type === "trending")).toBe(true)
      })
    })
  })

  describe("Portfolio Data", () => {
    describe("Get Portfolio Coins", () => {
      it("should fetch portfolio coins with P/L data", async () => {
        const mockPortfolio = {
          data: [
            {
              coinId: "bitcoin",
              symbol: "BTC",
              quantity: 0.5,
              avgBuyPrice: 40000,
              currentPrice: 45000,
              pnl: 2500,
              pnlPercent: 12.5
            },
            {
              coinId: "ethereum",
              symbol: "ETH",
              quantity: 5,
              avgBuyPrice: 2200,
              currentPrice: 2500,
              pnl: 1500,
              pnlPercent: 13.6
            }
          ],
          meta: { page: 1, limit: 20, total: 2 }
        }

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockPortfolio)
        })

        const response = await fetch(
          "https://api.universalcrypto.com/portfolio/coins?shareToken=abc123"
        )
        const data = await response.json()

        expect(data.data).toHaveLength(2)
        expect(data.data[0].pnl).toBe(2500)
      })
    })

    describe("Get Portfolio Chart", () => {
      it("should fetch portfolio performance chart", async () => {
        const mockChart = {
          data: [
            { timestamp: 1700000000, value: 10000 },
            { timestamp: 1700086400, value: 10500 },
            { timestamp: 1700172800, value: 11000 }
          ],
          period: "1w"
        }

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockChart)
        })

        const response = await fetch(
          "https://api.universalcrypto.com/portfolio/chart?shareToken=abc123&type=1w"
        )
        const data = await response.json()

        expect(data.data).toHaveLength(3)
        expect(data.period).toBe("1w")
      })
    })
  })

  describe("Error Handling", () => {
    it("should handle API key missing error", async () => {
      delete process.env.UNIVERSAL_CRYPTO_API_KEY

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: "API key required" })
      })

      const response = await fetch("https://api.universalcrypto.com/coins")

      expect(response.ok).toBe(false)
      expect(response.status).toBe(401)
    })

    it("should handle rate limiting", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: () => Promise.resolve({ error: "Rate limit exceeded", retryAfter: 60 })
      })

      const response = await fetch("https://api.universalcrypto.com/coins")

      expect(response.ok).toBe(false)
      expect(response.status).toBe(429)
    })

    it("should handle server errors", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: "Internal server error" })
      })

      const response = await fetch("https://api.universalcrypto.com/coins")

      expect(response.ok).toBe(false)
      expect(response.status).toBe(500)
    })

    it("should handle network errors", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"))

      await expect(
        fetch("https://api.universalcrypto.com/coins")
      ).rejects.toThrow("Network error")
    })

    it("should handle invalid JSON response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.reject(new Error("Invalid JSON"))
      })

      const response = await fetch("https://api.universalcrypto.com/coins")

      await expect(response.json()).rejects.toThrow("Invalid JSON")
    })
  })

  describe("Data Aggregation", () => {
    it("should aggregate price data from multiple sources", async () => {
      const mockAggregatedPrice = {
        coinId: "bitcoin",
        price: 45000,
        sources: [
          { exchange: "binance", price: 45005 },
          { exchange: "coinbase", price: 44995 },
          { exchange: "kraken", price: 45000 }
        ],
        deviation: 0.01,
        confidence: "high"
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockAggregatedPrice)
      })

      const response = await fetch("https://api.universalcrypto.com/coins/bitcoin/aggregated")
      const data = await response.json()

      expect(data.sources).toHaveLength(3)
      expect(data.confidence).toBe("high")
    })
  })
})
