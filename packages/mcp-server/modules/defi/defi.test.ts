/**
 * Tests for DeFi Module
 * @author nich
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

import { createMockMcpServer } from "../../../tests/mocks/mcp"
import { registerDefiTools } from "./tools"

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

describe("DeFi Module", () => {
  let server: ReturnType<typeof createMockMcpServer>

  beforeEach(() => {
    server = createMockMcpServer()
    registerDefiTools(server as any)
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe("Tool Registration", () => {
    it("should register all DeFi tools", () => {
      const toolNames = server.getToolNames()

      // Protocol TVL
      expect(toolNames).toContain("defi_get_protocols")
      expect(toolNames).toContain("defi_get_protocol")
      expect(toolNames).toContain("defi_get_protocol_tvl")

      // Chain TVL
      expect(toolNames).toContain("defi_get_chains")
      expect(toolNames).toContain("defi_get_chain_tvl")
      expect(toolNames).toContain("defi_get_chain_protocols")

      // Yields
      expect(toolNames).toContain("defi_get_yields")
      expect(toolNames).toContain("defi_get_yield_pool")

      // Fees & Revenue
      expect(toolNames).toContain("defi_get_fees_overview")
      expect(toolNames).toContain("defi_get_protocol_fees")
      expect(toolNames).toContain("defi_get_chain_fees")

      // DEX Volume
      expect(toolNames).toContain("defi_get_dex_volume")
      expect(toolNames).toContain("defi_get_dex_protocol_volume")
      expect(toolNames).toContain("defi_get_chain_dex_volume")

      // Stablecoins
      expect(toolNames).toContain("defi_get_stablecoins")
      expect(toolNames).toContain("defi_get_stablecoin")
      expect(toolNames).toContain("defi_get_stablecoin_chains")

      // Bridges
      expect(toolNames).toContain("defi_get_bridges")
      expect(toolNames).toContain("defi_get_bridge")
      expect(toolNames).toContain("defi_get_bridge_volume")
    })
  })

  describe("defi_get_protocols", () => {
    const mockProtocolsResponse = [
      {
        id: "aave",
        name: "Aave",
        slug: "aave",
        tvl: 12000000000,
        chains: ["Ethereum", "Polygon", "Arbitrum"],
        category: "Lending",
        change_1d: 2.5,
        change_7d: 5.2
      },
      {
        id: "uniswap",
        name: "Uniswap",
        slug: "uniswap",
        tvl: 8000000000,
        chains: ["Ethereum", "Arbitrum", "Base"],
        category: "DEX",
        change_1d: 1.8,
        change_7d: 3.5
      },
      {
        id: "lido",
        name: "Lido",
        slug: "lido",
        tvl: 25000000000,
        chains: ["Ethereum"],
        category: "Liquid Staking",
        change_1d: 0.5,
        change_7d: 2.1
      }
    ]

    it("should fetch all protocols with TVL", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockProtocolsResponse)
      })

      const result = await server.executeTool("defi_get_protocols", {})

      expect(mockFetch).toHaveBeenCalledTimes(1)
      expect((result as any).content[0].text).toContain("Aave")
      expect((result as any).content[0].text).toContain("Uniswap")
      expect((result as any).content[0].text).toContain("Lido")
    })

    it("should call correct API endpoint", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockProtocolsResponse)
      })

      await server.executeTool("defi_get_protocols", {})

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.llama.fi/protocols"
      )
    })

    it("should handle API errors", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500
      })

      const result = await server.executeTool("defi_get_protocols", {})

      expect((result as any).content[0].text).toContain("Failed to fetch protocols")
    })
  })

  describe("defi_get_protocol", () => {
    const mockProtocolDetails = {
      id: "aave",
      name: "Aave",
      description: "Decentralized lending protocol",
      tvl: 12000000000,
      chains: ["Ethereum", "Polygon", "Arbitrum", "Optimism"],
      chainTvls: {
        Ethereum: 8000000000,
        Polygon: 2000000000,
        Arbitrum: 1500000000,
        Optimism: 500000000
      },
      category: "Lending",
      twitter: "AaveAave",
      url: "https://aave.com",
      tokensLocked: [
        { symbol: "WETH", value: 5000000000 },
        { symbol: "USDC", value: 3000000000 },
        { symbol: "WBTC", value: 2000000000 }
      ]
    }

    it("should fetch protocol details by slug", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockProtocolDetails)
      })

      const result = await server.executeTool("defi_get_protocol", {
        protocol: "aave"
      })

      expect((result as any).content[0].text).toContain("Aave")
      expect((result as any).content[0].text).toContain("12000000000")
      expect((result as any).content[0].text).toContain("Ethereum")
    })

    it("should call correct API endpoint", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockProtocolDetails)
      })

      await server.executeTool("defi_get_protocol", {
        protocol: "uniswap"
      })

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.llama.fi/protocol/uniswap"
      )
    })

    it("should handle non-existent protocol", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404
      })

      const result = await server.executeTool("defi_get_protocol", {
        protocol: "nonexistentprotocol123"
      })

      expect((result as any).content[0].text).toContain("Failed to fetch protocol")
    })
  })

  describe("defi_get_protocol_tvl", () => {
    const mockProtocolTvl = [
      { date: "2026-01-20", totalLiquidityUSD: 11500000000 },
      { date: "2026-01-21", totalLiquidityUSD: 11800000000 },
      { date: "2026-01-22", totalLiquidityUSD: 12000000000 }
    ]

    it("should fetch historical TVL for protocol", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockProtocolTvl)
      })

      const result = await server.executeTool("defi_get_protocol_tvl", {
        protocol: "aave"
      })

      expect((result as any).content[0].text).toContain("totalLiquidityUSD")
      expect((result as any).content[0].text).toContain("12000000000")
    })
  })

  describe("defi_get_chains", () => {
    const mockChainsResponse = [
      { name: "Ethereum", tvl: 50000000000, protocols: 500, dominance: 55 },
      { name: "Solana", tvl: 5000000000, protocols: 150, dominance: 5.5 },
      { name: "Arbitrum", tvl: 4000000000, protocols: 200, dominance: 4.4 },
      { name: "BSC", tvl: 3500000000, protocols: 250, dominance: 3.8 }
    ]

    it("should fetch all chains with TVL", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockChainsResponse)
      })

      const result = await server.executeTool("defi_get_chains", {})

      expect((result as any).content[0].text).toContain("Ethereum")
      expect((result as any).content[0].text).toContain("50000000000")
      expect((result as any).content[0].text).toContain("Arbitrum")
    })
  })

  describe("defi_get_chain_tvl", () => {
    const mockChainTvl = [
      { date: 1700000000, tvl: 48000000000 },
      { date: 1700086400, tvl: 49000000000 },
      { date: 1700172800, tvl: 50000000000 }
    ]

    it("should fetch historical TVL for chain", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockChainTvl)
      })

      const result = await server.executeTool("defi_get_chain_tvl", {
        chain: "Ethereum"
      })

      expect((result as any).content[0].text).toContain("tvl")
      expect((result as any).content[0].text).toContain("50000000000")
    })
  })

  describe("defi_get_chain_protocols", () => {
    const mockProtocols = [
      { name: "Aave", slug: "aave", tvl: 8000000000, category: "Lending" },
      { name: "Uniswap", slug: "uniswap", tvl: 5000000000, category: "DEX" },
      { name: "Curve", slug: "curve", tvl: 3000000000, category: "DEX" }
    ]

    it("should fetch protocols on a specific chain", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([
          { ...mockProtocols[0], chains: ["Ethereum"], chainTvls: { Ethereum: 8000000000 } },
          { ...mockProtocols[1], chains: ["Ethereum"], chainTvls: { Ethereum: 5000000000 } },
          { ...mockProtocols[2], chains: ["Ethereum"], chainTvls: { Ethereum: 3000000000 } }
        ])
      })

      const result = await server.executeTool("defi_get_chain_protocols", {
        chain: "Ethereum"
      })

      expect((result as any).content[0].text).toContain("Aave")
      expect((result as any).content[0].text).toContain("Uniswap")
    })
  })

  describe("defi_get_yields", () => {
    const mockYieldsResponse = {
      data: [
        {
          pool: "aave-v3-usdc",
          chain: "Ethereum",
          project: "aave-v3",
          symbol: "USDC",
          tvlUsd: 500000000,
          apy: 5.5,
          apyBase: 3.5,
          apyReward: 2.0,
          rewardTokens: ["AAVE"],
          ilRisk: "no"
        },
        {
          pool: "compound-v3-usdc",
          chain: "Ethereum",
          project: "compound-v3",
          symbol: "USDC",
          tvlUsd: 300000000,
          apy: 4.8,
          apyBase: 4.8,
          apyReward: 0,
          ilRisk: "no"
        },
        {
          pool: "curve-3pool",
          chain: "Ethereum",
          project: "curve",
          symbol: "3CRV",
          tvlUsd: 800000000,
          apy: 3.2,
          apyBase: 1.2,
          apyReward: 2.0,
          rewardTokens: ["CRV"],
          ilRisk: "yes"
        }
      ]
    }

    it("should fetch yield pools", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockYieldsResponse)
      })

      const result = await server.executeTool("defi_get_yields", {})

      expect((result as any).content[0].text).toContain("aave-v3-usdc")
      expect((result as any).content[0].text).toContain("apy")
    })

    it("should filter by chain", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockYieldsResponse)
      })

      const result = await server.executeTool("defi_get_yields", {
        chain: "Ethereum"
      })

      // All results should be for Ethereum
      const resultText = (result as any).content[0].text
      expect(resultText).toContain("Ethereum")
    })

    it("should filter by project", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockYieldsResponse)
      })

      const result = await server.executeTool("defi_get_yields", {
        project: "aave-v3"
      })

      const resultText = (result as any).content[0].text
      expect(resultText).toContain("aave-v3")
    })

    it("should filter by minimum TVL", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockYieldsResponse)
      })

      const result = await server.executeTool("defi_get_yields", {
        minTvl: 400000000
      })

      // Should only include pools with TVL >= 400M
      expect((result as any).content[0].text).toContain("aave-v3-usdc")
      expect((result as any).content[0].text).toContain("curve-3pool")
    })

    it("should filter by minimum APY", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockYieldsResponse)
      })

      const result = await server.executeTool("defi_get_yields", {
        minApy: 4
      })

      // Should only include pools with APY >= 4%
      expect((result as any).content[0].text).toContain("aave-v3-usdc")
      expect((result as any).content[0].text).toContain("compound-v3-usdc")
    })
  })

  describe("defi_get_yield_pool", () => {
    const mockPoolData = {
      status: "success",
      data: [
        { timestamp: "2026-01-20T00:00:00Z", apy: 5.2, tvlUsd: 490000000 },
        { timestamp: "2026-01-21T00:00:00Z", apy: 5.4, tvlUsd: 495000000 },
        { timestamp: "2026-01-22T00:00:00Z", apy: 5.5, tvlUsd: 500000000 }
      ]
    }

    it("should fetch pool historical data", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockPoolData)
      })

      const result = await server.executeTool("defi_get_yield_pool", {
        poolId: "747c1d2a-c668-4682-b9f9-296708a3dd90"
      })

      expect((result as any).content[0].text).toContain("apy")
      expect((result as any).content[0].text).toContain("tvlUsd")
    })
  })

  describe("defi_get_fees_overview", () => {
    const mockFeesOverview = {
      totalFees24h: 50000000,
      totalRevenue24h: 15000000,
      protocols: [
        { name: "Uniswap", fees24h: 5000000, revenue24h: 1500000 },
        { name: "Aave", fees24h: 3000000, revenue24h: 1000000 }
      ]
    }

    it("should fetch fees overview", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockFeesOverview)
      })

      const result = await server.executeTool("defi_get_fees_overview", {})

      expect((result as any).content[0].text).toContain("totalFees24h")
      expect((result as any).content[0].text).toContain("50000000")
    })
  })

  describe("defi_get_protocol_fees", () => {
    const mockProtocolFees = {
      name: "Uniswap",
      totalFees24h: 5000000,
      totalFees7d: 35000000,
      totalFees30d: 150000000,
      revenue24h: 1500000,
      revenue7d: 10500000
    }

    it("should fetch protocol fees", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockProtocolFees)
      })

      const result = await server.executeTool("defi_get_protocol_fees", {
        protocol: "uniswap"
      })

      expect((result as any).content[0].text).toContain("Uniswap")
      expect((result as any).content[0].text).toContain("totalFees24h")
    })
  })

  describe("defi_get_dex_volume", () => {
    const mockDexVolume = {
      totalVolume24h: 5000000000,
      totalVolume7d: 35000000000,
      protocols: [
        { name: "Uniswap", volume24h: 2000000000, change24h: 5.2 },
        { name: "PancakeSwap", volume24h: 800000000, change24h: -2.1 },
        { name: "Curve", volume24h: 500000000, change24h: 1.5 }
      ]
    }

    it("should fetch DEX volume overview", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockDexVolume)
      })

      const result = await server.executeTool("defi_get_dex_volume", {})

      expect((result as any).content[0].text).toContain("totalVolume24h")
      expect((result as any).content[0].text).toContain("5000000000")
    })
  })

  describe("defi_get_dex_protocol_volume", () => {
    const mockProtocolVolume = {
      name: "Uniswap",
      volume24h: 2000000000,
      volume7d: 14000000000,
      volumeByChain: {
        Ethereum: 1200000000,
        Arbitrum: 500000000,
        Polygon: 300000000
      }
    }

    it("should fetch protocol volume", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockProtocolVolume)
      })

      const result = await server.executeTool("defi_get_dex_protocol_volume", {
        protocol: "uniswap"
      })

      expect((result as any).content[0].text).toContain("Uniswap")
      expect((result as any).content[0].text).toContain("2000000000")
    })
  })

  describe("defi_get_stablecoins", () => {
    const mockStablecoins = {
      peggedAssets: [
        {
          id: 1,
          name: "Tether",
          symbol: "USDT",
          gecko_id: "tether",
          pegType: "peggedUSD",
          pegMechanism: "fiat-backed",
          circulating: { peggedUSD: 95000000000 }
        },
        {
          id: 2,
          name: "USD Coin",
          symbol: "USDC",
          gecko_id: "usd-coin",
          pegType: "peggedUSD",
          pegMechanism: "fiat-backed",
          circulating: { peggedUSD: 28000000000 }
        },
        {
          id: 3,
          name: "DAI",
          symbol: "DAI",
          gecko_id: "dai",
          pegType: "peggedUSD",
          pegMechanism: "crypto-backed",
          circulating: { peggedUSD: 5000000000 }
        }
      ]
    }

    it("should fetch stablecoins list", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockStablecoins)
      })

      const result = await server.executeTool("defi_get_stablecoins", {})

      expect((result as any).content[0].text).toContain("Tether")
      expect((result as any).content[0].text).toContain("USDC")
      expect((result as any).content[0].text).toContain("DAI")
    })
  })

  describe("defi_get_stablecoin", () => {
    const mockStablecoinData = {
      id: 1,
      name: "Tether",
      symbol: "USDT",
      circulating: { peggedUSD: 95000000000 },
      chainCirculating: {
        Ethereum: { peggedUSD: 40000000000 },
        Tron: { peggedUSD: 45000000000 },
        BSC: { peggedUSD: 5000000000 }
      }
    }

    it("should fetch stablecoin details", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockStablecoinData)
      })

      const result = await server.executeTool("defi_get_stablecoin", {
        stablecoinId: 1
      })

      expect((result as any).content[0].text).toContain("Tether")
      expect((result as any).content[0].text).toContain("95000000000")
    })
  })

  describe("defi_get_stablecoin_chains", () => {
    const mockChainData = [
      { name: "Ethereum", mcap: 60000000000 },
      { name: "Tron", mcap: 50000000000 },
      { name: "BSC", mcap: 10000000000 }
    ]

    it("should fetch stablecoin distribution by chain", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockChainData)
      })

      const result = await server.executeTool("defi_get_stablecoin_chains", {})

      expect((result as any).content[0].text).toContain("Ethereum")
      expect((result as any).content[0].text).toContain("Tron")
    })
  })

  describe("defi_get_bridges", () => {
    const mockBridges = {
      bridges: [
        { id: 1, name: "Arbitrum Bridge", volumeLastDay: 500000000 },
        { id: 2, name: "Polygon Bridge", volumeLastDay: 300000000 },
        { id: 3, name: "Optimism Bridge", volumeLastDay: 200000000 }
      ]
    }

    it("should fetch bridges list", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockBridges)
      })

      const result = await server.executeTool("defi_get_bridges", {})

      expect((result as any).content[0].text).toContain("Arbitrum Bridge")
      expect((result as any).content[0].text).toContain("Polygon Bridge")
    })
  })

  describe("defi_get_bridge", () => {
    const mockBridgeData = {
      id: 1,
      name: "Arbitrum Bridge",
      volumeLastDay: 500000000,
      volumeLastWeek: 3500000000,
      chains: ["Ethereum", "Arbitrum"]
    }

    it("should fetch bridge details", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockBridgeData)
      })

      const result = await server.executeTool("defi_get_bridge", {
        bridgeId: 1
      })

      expect((result as any).content[0].text).toContain("Arbitrum Bridge")
      expect((result as any).content[0].text).toContain("500000000")
    })
  })

  describe("defi_get_bridge_volume", () => {
    const mockBridgeVolume = [
      { date: 1700000000, deposits: 100000000, withdrawals: 80000000 },
      { date: 1700086400, deposits: 120000000, withdrawals: 90000000 },
      { date: 1700172800, deposits: 150000000, withdrawals: 100000000 }
    ]

    it("should fetch bridge volume for chain", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockBridgeVolume)
      })

      const result = await server.executeTool("defi_get_bridge_volume", {
        chain: "Arbitrum"
      })

      expect((result as any).content[0].text).toContain("deposits")
      expect((result as any).content[0].text).toContain("withdrawals")
    })
  })

  describe("defi_get_options_volume", () => {
    const mockOptionsVolume = {
      totalVolume24h: 500000000,
      totalOpenInterest: 2000000000,
      protocols: [
        { name: "Deribit", volume24h: 300000000 },
        { name: "Hegic", volume24h: 50000000 }
      ]
    }

    it("should fetch options volume", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockOptionsVolume)
      })

      const result = await server.executeTool("defi_get_options_volume", {})

      expect((result as any).content[0].text).toContain("totalVolume24h")
      expect((result as any).content[0].text).toContain("500000000")
    })
  })

  describe("Error Handling", () => {
    it("should handle API errors gracefully", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500
      })

      const result = await server.executeTool("defi_get_protocols", {})

      expect((result as any).content[0].text).toContain("Failed")
    })

    it("should handle network timeouts", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network timeout"))

      const result = await server.executeTool("defi_get_chains", {})

      expect((result as any).content[0].text).toContain("Failed")
    })

    it("should handle malformed JSON", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.reject(new SyntaxError("Invalid JSON"))
      })

      const result = await server.executeTool("defi_get_protocols", {})

      expect((result as any).content[0].text).toContain("Failed")
    })

    it("should handle rate limiting", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429
      })

      const result = await server.executeTool("defi_get_yields", {})

      expect((result as any).content[0].text).toContain("Failed")
    })
  })

  describe("Edge Cases", () => {
    it("should handle empty protocol list", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([])
      })

      const result = await server.executeTool("defi_get_protocols", {})

      expect((result as any).content[0].text).toContain("[]")
    })

    it("should handle empty yields data", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [] })
      })

      const result = await server.executeTool("defi_get_yields", {})

      expect((result as any).content[0].text).toContain("[]")
    })

    it("should handle chain with no protocols", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([])
      })

      const result = await server.executeTool("defi_get_chain_protocols", {
        chain: "NewChainWithNoProtocols"
      })

      expect((result as any).content[0].text).toContain("[]")
    })

    it("should correctly filter yields by multiple criteria", async () => {
      const mockYields = {
        data: [
          { chain: "Ethereum", project: "aave", apy: 6, tvlUsd: 500000000 },
          { chain: "Ethereum", project: "compound", apy: 4, tvlUsd: 300000000 },
          { chain: "Arbitrum", project: "aave", apy: 7, tvlUsd: 100000000 }
        ]
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockYields)
      })

      const result = await server.executeTool("defi_get_yields", {
        chain: "Ethereum",
        minApy: 5,
        minTvl: 400000000
      })

      // Should only include Ethereum pools with APY >= 5 and TVL >= 400M
      const resultText = (result as any).content[0].text
      expect(resultText).toContain("aave")
      expect(resultText).not.toContain("Arbitrum")
      expect(resultText).not.toContain("compound")
    })
  })
})
