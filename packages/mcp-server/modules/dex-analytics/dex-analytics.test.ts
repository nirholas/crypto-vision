/**
 * Tests for DEX Analytics Module
 * @author nich
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

import { createMockMcpServer } from "../../../tests/mocks/mcp"
import { registerDexAnalyticsTools } from "./tools"

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

describe("DEX Analytics Module", () => {
  let server: ReturnType<typeof createMockMcpServer>

  beforeEach(() => {
    server = createMockMcpServer()
    registerDexAnalyticsTools(server as any)
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe("Tool Registration", () => {
    it("should register all DEX analytics tools", () => {
      const toolNames = server.getToolNames()

      // DexPaprika tools
      expect(toolNames).toContain("dex_get_networks")
      expect(toolNames).toContain("dex_get_network_dexes")
      expect(toolNames).toContain("dex_get_network_pools")
      expect(toolNames).toContain("dex_get_dex_pools")
      expect(toolNames).toContain("dex_get_pool_details")
      expect(toolNames).toContain("dex_get_token_details")
      expect(toolNames).toContain("dex_get_token_pools")
      expect(toolNames).toContain("dex_get_pool_ohlcv")
      expect(toolNames).toContain("dex_get_pool_transactions")
      expect(toolNames).toContain("dex_search")
      expect(toolNames).toContain("dex_get_stats")
      expect(toolNames).toContain("dex_get_multi_prices")

      // GeckoTerminal tools
      expect(toolNames).toContain("geckoterminal_get_networks")
      expect(toolNames).toContain("geckoterminal_get_dexes")
      expect(toolNames).toContain("geckoterminal_trending_pools")
      expect(toolNames).toContain("geckoterminal_new_pools")
      expect(toolNames).toContain("geckoterminal_top_pools")
    })
  })

  describe("dex_get_networks", () => {
    const mockNetworksResponse = [
      { id: "ethereum", name: "Ethereum", chainId: 1 },
      { id: "solana", name: "Solana", chainId: null },
      { id: "arbitrum", name: "Arbitrum", chainId: 42161 },
      { id: "bsc", name: "BNB Smart Chain", chainId: 56 }
    ]

    it("should fetch available networks", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockNetworksResponse)
      })

      const result = await server.executeTool("dex_get_networks", {})

      expect(mockFetch).toHaveBeenCalledTimes(1)
      expect((result as any).content[0].text).toContain("ethereum")
      expect((result as any).content[0].text).toContain("solana")
    })

    it("should handle API errors", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500
      })

      const result = await server.executeTool("dex_get_networks", {})

      expect((result as any).content[0].text).toContain("Failed to fetch networks")
    })
  })

  describe("dex_get_network_dexes", () => {
    const mockDexesResponse = [
      { id: "uniswap_v3", name: "Uniswap V3", pools: 5000, volume24h: 1500000000 },
      { id: "uniswap_v2", name: "Uniswap V2", pools: 3000, volume24h: 500000000 },
      { id: "sushiswap", name: "SushiSwap", pools: 2000, volume24h: 200000000 }
    ]

    it("should fetch DEXes on a network", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockDexesResponse)
      })

      const result = await server.executeTool("dex_get_network_dexes", {
        network: "ethereum"
      })

      expect((result as any).content[0].text).toContain("uniswap_v3")
      expect((result as any).content[0].text).toContain("sushiswap")
    })

    it("should support pagination", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockDexesResponse)
      })

      await server.executeTool("dex_get_network_dexes", {
        network: "ethereum",
        page: 2,
        limit: 50
      })

      const url = mockFetch.mock.calls[0][0]
      expect(url).toContain("page=2")
      expect(url).toContain("limit=50")
    })
  })

  describe("dex_get_network_pools", () => {
    const mockPoolsResponse = [
      {
        id: "0x8ad599c3a0ff1de082011efddc58f1908eb6e6d8",
        dex: "uniswap_v3",
        token0: { symbol: "USDC", address: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48" },
        token1: { symbol: "WETH", address: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2" },
        volumeUsd: 250000000,
        priceUsd: 3500,
        liquidity: 500000000
      },
      {
        id: "0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640",
        dex: "uniswap_v3",
        token0: { symbol: "USDC", address: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48" },
        token1: { symbol: "WETH", address: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2" },
        volumeUsd: 180000000,
        priceUsd: 3500,
        liquidity: 400000000
      }
    ]

    it("should fetch top pools on a network", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockPoolsResponse)
      })

      const result = await server.executeTool("dex_get_network_pools", {
        network: "ethereum"
      })

      expect((result as any).content[0].text).toContain("USDC")
      expect((result as any).content[0].text).toContain("WETH")
      expect((result as any).content[0].text).toContain("uniswap_v3")
    })

    it("should support sorting by different metrics", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockPoolsResponse)
      })

      await server.executeTool("dex_get_network_pools", {
        network: "ethereum",
        orderBy: "transactions",
        sort: "asc"
      })

      const url = mockFetch.mock.calls[0][0]
      expect(url).toContain("order_by=transactions")
      expect(url).toContain("sort=asc")
    })
  })

  describe("dex_get_dex_pools", () => {
    const mockDexPoolsResponse = [
      {
        id: "0x8ad599c3a0ff1de082011efddc58f1908eb6e6d8",
        pair: "USDC/WETH",
        volumeUsd: 250000000,
        fee: 0.3
      }
    ]

    it("should fetch pools from a specific DEX", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockDexPoolsResponse)
      })

      const result = await server.executeTool("dex_get_dex_pools", {
        network: "ethereum",
        dex: "uniswap_v3"
      })

      expect((result as any).content[0].text).toContain("USDC/WETH")
    })
  })

  describe("dex_get_pool_details", () => {
    const mockPoolDetails = {
      id: "0x8ad599c3a0ff1de082011efddc58f1908eb6e6d8",
      dex: "uniswap_v3",
      token0: {
        symbol: "USDC",
        name: "USD Coin",
        address: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
        decimals: 6
      },
      token1: {
        symbol: "WETH",
        name: "Wrapped Ether",
        address: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
        decimals: 18
      },
      reserve0: 150000000,
      reserve1: 42000,
      priceUsd: 3500,
      volumeUsd24h: 250000000,
      fee: 0.3,
      createdAt: "2021-05-01T00:00:00Z"
    }

    it("should fetch pool details by address", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockPoolDetails)
      })

      const result = await server.executeTool("dex_get_pool_details", {
        network: "ethereum",
        poolAddress: "0x8ad599c3a0ff1de082011efddc58f1908eb6e6d8"
      })

      expect((result as any).content[0].text).toContain("USDC")
      expect((result as any).content[0].text).toContain("WETH")
      expect((result as any).content[0].text).toContain("uniswap_v3")
    })

    it("should support inversed price ratio", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockPoolDetails)
      })

      await server.executeTool("dex_get_pool_details", {
        network: "ethereum",
        poolAddress: "0x8ad599c3a0ff1de082011efddc58f1908eb6e6d8",
        inversed: true
      })

      const url = mockFetch.mock.calls[0][0]
      expect(url).toContain("inversed=true")
    })

    it("should handle non-existent pool", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404
      })

      const result = await server.executeTool("dex_get_pool_details", {
        network: "ethereum",
        poolAddress: "0x0000000000000000000000000000000000000000"
      })

      expect((result as any).content[0].text).toContain("Failed to fetch pool details")
    })
  })

  describe("dex_get_token_details", () => {
    const mockTokenDetails = {
      address: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
      symbol: "USDC",
      name: "USD Coin",
      decimals: 6,
      priceUsd: 0.9999,
      volume24h: 5000000000,
      marketCap: 25000000000,
      totalPools: 500
    }

    it("should fetch token details by address", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockTokenDetails)
      })

      const result = await server.executeTool("dex_get_token_details", {
        network: "ethereum",
        tokenAddress: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"
      })

      expect((result as any).content[0].text).toContain("USDC")
      expect((result as any).content[0].text).toContain("USD Coin")
    })
  })

  describe("dex_get_token_pools", () => {
    const mockTokenPools = [
      {
        id: "0x8ad599c3a0ff1de082011efddc58f1908eb6e6d8",
        pairedWith: "WETH",
        volumeUsd: 250000000
      },
      {
        id: "0x5777d92f208679db4b9778590fa3cab3ac9e2168",
        pairedWith: "USDT",
        volumeUsd: 150000000
      }
    ]

    it("should fetch pools containing a token", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockTokenPools)
      })

      const result = await server.executeTool("dex_get_token_pools", {
        network: "ethereum",
        tokenAddress: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"
      })

      expect((result as any).content[0].text).toContain("WETH")
      expect((result as any).content[0].text).toContain("USDT")
    })

    it("should filter by paired token", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([mockTokenPools[0]])
      })

      await server.executeTool("dex_get_token_pools", {
        network: "ethereum",
        tokenAddress: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
        pairedWith: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2"
      })

      const url = mockFetch.mock.calls[0][0]
      expect(url).toContain("address=")
    })
  })

  describe("dex_get_pool_ohlcv", () => {
    const mockOhlcvData = [
      {
        timestamp: 1700000000,
        open: 3400,
        high: 3550,
        low: 3380,
        close: 3500,
        volume: 25000000
      },
      {
        timestamp: 1700086400,
        open: 3500,
        high: 3600,
        low: 3450,
        close: 3580,
        volume: 28000000
      }
    ]

    it("should fetch OHLCV data for a pool", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockOhlcvData)
      })

      const result = await server.executeTool("dex_get_pool_ohlcv", {
        network: "ethereum",
        poolAddress: "0x8ad599c3a0ff1de082011efddc58f1908eb6e6d8",
        start: "2024-01-01",
        interval: "24h"
      })

      expect((result as any).content[0].text).toContain("open")
      expect((result as any).content[0].text).toContain("close")
      expect((result as any).content[0].text).toContain("volume")
    })

    it("should support different intervals", async () => {
      const intervals = ["1m", "5m", "15m", "1h", "24h"]

      for (const interval of intervals) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockOhlcvData)
        })

        await server.executeTool("dex_get_pool_ohlcv", {
          network: "ethereum",
          poolAddress: "0x8ad599c3a0ff1de082011efddc58f1908eb6e6d8",
          start: "2024-01-01",
          interval
        })

        const url = mockFetch.mock.calls[mockFetch.mock.calls.length - 1][0]
        expect(url).toContain(`interval=${interval}`)
      }
    })
  })

  describe("dex_get_pool_transactions", () => {
    const mockTransactions = [
      {
        id: "0xabc123",
        type: "swap",
        token0Amount: 1000,
        token1Amount: 0.28,
        valueUsd: 1000,
        timestamp: 1700000000
      },
      {
        id: "0xdef456",
        type: "add_liquidity",
        token0Amount: 5000,
        token1Amount: 1.4,
        valueUsd: 5000,
        timestamp: 1699999000
      }
    ]

    it("should fetch pool transactions", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockTransactions)
      })

      const result = await server.executeTool("dex_get_pool_transactions", {
        network: "ethereum",
        poolAddress: "0x8ad599c3a0ff1de082011efddc58f1908eb6e6d8"
      })

      expect((result as any).content[0].text).toContain("swap")
      expect((result as any).content[0].text).toContain("add_liquidity")
    })
  })

  describe("dex_search", () => {
    const mockSearchResults = {
      tokens: [
        { symbol: "PEPE", name: "Pepe Token", address: "0x6982508145454ce325ddbe47a25d4ec3d2311933" }
      ],
      pools: [
        { id: "0x123", pair: "PEPE/WETH" }
      ]
    }

    it("should search for tokens and pools", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSearchResults)
      })

      const result = await server.executeTool("dex_search", {
        query: "PEPE"
      })

      expect((result as any).content[0].text).toContain("PEPE")
      expect((result as any).content[0].text).toContain("Pepe Token")
    })

    it("should handle empty search results", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ tokens: [], pools: [] })
      })

      const result = await server.executeTool("dex_search", {
        query: "nonexistenttoken12345"
      })

      expect((result as any).content[0].text).toContain("[]")
    })
  })

  describe("dex_get_stats", () => {
    const mockStats = {
      totalNetworks: 25,
      totalDexes: 500,
      totalPools: 2500000,
      totalTokens: 15000000,
      volume24h: 15000000000
    }

    it("should fetch ecosystem stats", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockStats)
      })

      const result = await server.executeTool("dex_get_stats", {})

      expect((result as any).content[0].text).toContain("totalNetworks")
      expect((result as any).content[0].text).toContain("25")
    })
  })

  describe("dex_get_multi_prices", () => {
    const mockPrices = {
      "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48": { price: 0.9999, symbol: "USDC" },
      "0xdac17f958d2ee523a2206206994597c13d831ec7": { price: 1.0001, symbol: "USDT" }
    }

    it("should fetch multiple token prices", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockPrices)
      })

      const result = await server.executeTool("dex_get_multi_prices", {
        network: "ethereum",
        tokens: [
          "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
          "0xdac17f958d2ee523a2206206994597c13d831ec7"
        ]
      })

      expect((result as any).content[0].text).toContain("USDC")
      expect((result as any).content[0].text).toContain("USDT")
    })
  })

  describe("GeckoTerminal Tools", () => {
    describe("geckoterminal_trending_pools", () => {
      const mockTrendingPools = {
        data: [
          {
            id: "eth_0x123",
            attributes: {
              name: "PEPE/WETH",
              volume_usd_24h: 50000000,
              price_change_24h: 25.5
            }
          }
        ]
      }

      it("should fetch trending pools globally", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockTrendingPools)
        })

        const result = await server.executeTool("geckoterminal_trending_pools", {})

        expect((result as any).content[0].text).toContain("PEPE/WETH")
      })

      it("should fetch trending pools for a specific network", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockTrendingPools)
        })

        await server.executeTool("geckoterminal_trending_pools", {
          network: "eth"
        })

        const url = mockFetch.mock.calls[0][0]
        expect(url).toContain("/networks/eth/trending_pools")
      })
    })

    describe("geckoterminal_new_pools", () => {
      const mockNewPools = {
        data: [
          {
            id: "eth_0x456",
            attributes: {
              name: "NEWTOKEN/WETH",
              created_at: "2026-01-22T10:00:00Z"
            }
          }
        ]
      }

      it("should fetch newly created pools", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockNewPools)
        })

        const result = await server.executeTool("geckoterminal_new_pools", {})

        expect((result as any).content[0].text).toContain("NEWTOKEN/WETH")
      })
    })
  })

  describe("Error Handling", () => {
    it("should handle rate limiting (429)", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429
      })

      const result = await server.executeTool("dex_get_networks", {})

      expect((result as any).content[0].text).toContain("Failed")
    })

    it("should handle deprecated endpoints (410)", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 410
      })

      const result = await server.executeTool("dex_get_networks", {})

      expect((result as any).content[0].text).toContain("Failed")
    })

    it("should handle network timeouts", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Request timeout"))

      const result = await server.executeTool("dex_get_networks", {})

      expect((result as any).content[0].text).toContain("Failed")
    })
  })
})
