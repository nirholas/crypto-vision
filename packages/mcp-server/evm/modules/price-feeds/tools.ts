/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { Address } from "viem"
import { z } from "zod"

import { getPublicClient } from "@/evm/services/clients.js"
import { mcpToolRes } from "@/utils/helper.js"
import { defaultNetworkParam } from "../common/types.js"

// Chainlink Aggregator ABI
const CHAINLINK_AGGREGATOR_ABI = [
  {
    name: "latestRoundData",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "roundId", type: "uint80" },
      { name: "answer", type: "int256" },
      { name: "startedAt", type: "uint256" },
      { name: "updatedAt", type: "uint256" },
      { name: "answeredInRound", type: "uint80" }
    ]
  },
  {
    name: "decimals",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }]
  },
  {
    name: "description",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }]
  }
] as const

// Chainlink price feed addresses by network
const CHAINLINK_FEEDS: Record<number, Record<string, Address>> = {
  1: { // Ethereum
    "ETH/USD": "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419",
    "BTC/USD": "0xF4030086522a5bEEa4988F8cA5B36dbC97BeE88c",
    "USDC/USD": "0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6",
    "USDT/USD": "0x3E7d1eAB13ad0104d2750B8863b489D65364e32D",
    "DAI/USD": "0xAed0c38402a5d19df6E4c03F4E2DceD6e29c1ee9",
    "LINK/USD": "0x2c1d072e956AFFC0D435Cb7AC38EF18d24d9127c"
  },
  56: { // BSC
    "BNB/USD": "0x0567F2323251f0Aab15c8dFb1967E4e8A7D42aeE",
    "BTC/USD": "0x264990fbd0A4796A3E3d8E37C4d5F87a3aCa5Ebf",
    "ETH/USD": "0x9ef1B8c0E4F7dc8bF5719Ea496883DC6401d5b2e",
    "USDC/USD": "0x51597f405303C4377E36123cBc172b13269EA163"
  },
  137: { // Polygon
    "MATIC/USD": "0xAB594600376Ec9fD91F8e885dADF0CE036862dE0",
    "ETH/USD": "0xF9680D99D6C9589e2a93a78A04A279e509205945",
    "BTC/USD": "0xc907E116054Ad103354f2D350FD2514433D57F6f"
  },
  42161: { // Arbitrum
    "ETH/USD": "0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612",
    "BTC/USD": "0x6ce185860a4963106506C203335A2910A89E0D8A",
    "USDC/USD": "0x50834F3163758fcC1Df9973b6e91f0F0F0434aD3",
    "ARB/USD": "0xb2A824043730FE05F3DA2efaFa1CBbe83fa548D6"
  }
}

// Uniswap V3 TWAP Oracle ABI (for on-chain price calculation)
const UNISWAP_POOL_ABI = [
  {
    name: "observe",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "secondsAgos", type: "uint32[]" }],
    outputs: [
      { name: "tickCumulatives", type: "int56[]" },
      { name: "secondsPerLiquidityCumulativeX128s", type: "uint160[]" }
    ]
  },
  {
    name: "slot0",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "sqrtPriceX96", type: "uint160" },
      { name: "tick", type: "int24" },
      { name: "observationIndex", type: "uint16" },
      { name: "observationCardinality", type: "uint16" },
      { name: "observationCardinalityNext", type: "uint16" },
      { name: "feeProtocol", type: "uint8" },
      { name: "unlocked", type: "bool" }
    ]
  }
] as const

export function registerPriceFeedsTools(server: McpServer) {
  // Get Chainlink price
  server.tool(
    "get_chainlink_price",
    "Get price from a Chainlink price feed",
    {
      network: defaultNetworkParam,
      pair: z.string().describe("Price pair (e.g., 'ETH/USD', 'BTC/USD')")
    },
    async ({ network, pair }) => {
      try {
        const publicClient = getPublicClient(network)
        const chainId = await publicClient.getChainId()
        
        const feedAddress = CHAINLINK_FEEDS[chainId]?.[pair]
        if (!feedAddress) {
          return mcpToolRes.error(
            new Error(`Price feed for ${pair} not available on this network`),
            "getting Chainlink price"
          )
        }

        const [roundData, decimals, description] = await Promise.all([
          publicClient.readContract({
            address: feedAddress,
            abi: CHAINLINK_AGGREGATOR_ABI,
            functionName: "latestRoundData"
          }),
          publicClient.readContract({
            address: feedAddress,
            abi: CHAINLINK_AGGREGATOR_ABI,
            functionName: "decimals"
          }),
          publicClient.readContract({
            address: feedAddress,
            abi: CHAINLINK_AGGREGATOR_ABI,
            functionName: "description"
          })
        ])

        const [roundId, answer, startedAt, updatedAt, answeredInRound] = roundData
        const price = Number(answer) / Math.pow(10, Number(decimals))
        const updateTime = new Date(Number(updatedAt) * 1000)

        return mcpToolRes.success({
          network,
          pair,
          feedAddress,
          description,
          price: price.toFixed(Number(decimals)),
          priceRaw: answer.toString(),
          decimals: Number(decimals),
          roundId: roundId.toString(),
          updatedAt: updateTime.toISOString(),
          ageSeconds: Math.floor(Date.now() / 1000) - Number(updatedAt)
        })
      } catch (error) {
        return mcpToolRes.error(error, "getting Chainlink price")
      }
    }
  )

  // Get available price feeds
  server.tool(
    "get_available_price_feeds",
    "List available Chainlink price feeds on a network",
    {
      network: defaultNetworkParam
    },
    async ({ network }) => {
      try {
        const publicClient = getPublicClient(network)
        const chainId = await publicClient.getChainId()
        
        const feeds = CHAINLINK_FEEDS[chainId] || {}

        return mcpToolRes.success({
          network,
          chainId,
          feeds: Object.entries(feeds).map(([pair, address]) => ({
            pair,
            feedAddress: address
          })),
          note: Object.keys(feeds).length === 0 
            ? "No price feeds configured for this network"
            : "Use get_chainlink_price with any of these pairs"
        })
      } catch (error) {
        return mcpToolRes.error(error, "getting available price feeds")
      }
    }
  )

  // Get price from custom feed
  server.tool(
    "get_custom_price_feed",
    "Get price from a custom Chainlink price feed address",
    {
      network: defaultNetworkParam,
      feedAddress: z.string().describe("Chainlink aggregator contract address")
    },
    async ({ network, feedAddress }) => {
      try {
        const publicClient = getPublicClient(network)

        const [roundData, decimals, description] = await Promise.all([
          publicClient.readContract({
            address: feedAddress as Address,
            abi: CHAINLINK_AGGREGATOR_ABI,
            functionName: "latestRoundData"
          }),
          publicClient.readContract({
            address: feedAddress as Address,
            abi: CHAINLINK_AGGREGATOR_ABI,
            functionName: "decimals"
          }),
          publicClient.readContract({
            address: feedAddress as Address,
            abi: CHAINLINK_AGGREGATOR_ABI,
            functionName: "description"
          })
        ])

        const [roundId, answer, , updatedAt] = roundData
        const price = Number(answer) / Math.pow(10, Number(decimals))

        return mcpToolRes.success({
          network,
          feedAddress,
          description,
          price: price.toFixed(Number(decimals)),
          priceRaw: answer.toString(),
          decimals: Number(decimals),
          roundId: roundId.toString(),
          updatedAt: new Date(Number(updatedAt) * 1000).toISOString()
        })
      } catch (error) {
        return mcpToolRes.error(error, "getting custom price feed")
      }
    }
  )

  // Get multiple prices
  server.tool(
    "get_multiple_prices",
    "Get prices for multiple pairs in a single call",
    {
      network: defaultNetworkParam,
      pairs: z.array(z.string()).describe("Array of price pairs (e.g., ['ETH/USD', 'BTC/USD'])")
    },
    async ({ network, pairs }) => {
      try {
        const publicClient = getPublicClient(network)
        const chainId = await publicClient.getChainId()
        
        const prices: Array<{
          pair: string
          price: string | null
          error: string | null
        }> = []

        for (const pair of pairs) {
          const feedAddress = CHAINLINK_FEEDS[chainId]?.[pair]
          if (!feedAddress) {
            prices.push({ pair, price: null, error: "Feed not available" })
            continue
          }

          try {
            const [roundData, decimals] = await Promise.all([
              publicClient.readContract({
                address: feedAddress,
                abi: CHAINLINK_AGGREGATOR_ABI,
                functionName: "latestRoundData"
              }),
              publicClient.readContract({
                address: feedAddress,
                abi: CHAINLINK_AGGREGATOR_ABI,
                functionName: "decimals"
              })
            ])

            const [, answer] = roundData
            const price = Number(answer) / Math.pow(10, Number(decimals))
            prices.push({ pair, price: price.toFixed(Number(decimals)), error: null })
          } catch (e) {
            prices.push({ pair, price: null, error: "Failed to fetch" })
          }
        }

        return mcpToolRes.success({
          network,
          prices,
          fetchedAt: new Date().toISOString()
        })
      } catch (error) {
        return mcpToolRes.error(error, "getting multiple prices")
      }
    }
  )

  // Calculate price from Uniswap V3 pool
  server.tool(
    "get_uniswap_pool_price",
    "Get current price from a Uniswap V3 pool",
    {
      network: defaultNetworkParam,
      poolAddress: z.string().describe("Uniswap V3 pool address"),
      token0Decimals: z.number().optional().describe("Decimals of token0 (default: 18)"),
      token1Decimals: z.number().optional().describe("Decimals of token1 (default: 18)")
    },
    async ({ network, poolAddress, token0Decimals = 18, token1Decimals = 18 }) => {
      try {
        const publicClient = getPublicClient(network)

        const slot0 = await publicClient.readContract({
          address: poolAddress as Address,
          abi: UNISWAP_POOL_ABI,
          functionName: "slot0"
        })

        const sqrtPriceX96 = slot0[0]
        const tick = slot0[1]

        // Calculate price from sqrtPriceX96
        // price = (sqrtPriceX96 / 2^96)^2
        const Q96 = 2n ** 96n
        const sqrtPrice = Number(sqrtPriceX96) / Number(Q96)
        const price = sqrtPrice * sqrtPrice

        // Adjust for decimals
        const adjustedPrice = price * Math.pow(10, token0Decimals - token1Decimals)

        return mcpToolRes.success({
          network,
          poolAddress,
          sqrtPriceX96: sqrtPriceX96.toString(),
          tick,
          priceToken0InToken1: adjustedPrice.toString(),
          priceToken1InToken0: (1 / adjustedPrice).toString()
        })
      } catch (error) {
        return mcpToolRes.error(error, "getting Uniswap pool price")
      }
    }
  )

  // Check price feed staleness
  server.tool(
    "check_price_feed_health",
    "Check if a price feed is stale or unhealthy",
    {
      network: defaultNetworkParam,
      pair: z.string().describe("Price pair to check"),
      maxAge: z.number().optional().describe("Maximum acceptable age in seconds (default: 3600)")
    },
    async ({ network, pair, maxAge = 3600 }) => {
      try {
        const publicClient = getPublicClient(network)
        const chainId = await publicClient.getChainId()
        
        const feedAddress = CHAINLINK_FEEDS[chainId]?.[pair]
        if (!feedAddress) {
          return mcpToolRes.error(new Error(`Feed not found for ${pair}`), "checking price feed health")
        }

        const roundData = await publicClient.readContract({
          address: feedAddress,
          abi: CHAINLINK_AGGREGATOR_ABI,
          functionName: "latestRoundData"
        })

        const [roundId, answer, , updatedAt, answeredInRound] = roundData
        const currentTime = Math.floor(Date.now() / 1000)
        const age = currentTime - Number(updatedAt)

        const issues: string[] = []
        
        if (age > maxAge) {
          issues.push(`Price is stale (${age}s old, max ${maxAge}s)`)
        }
        
        if (answer <= 0n) {
          issues.push("Price is zero or negative")
        }
        
        if (answeredInRound < roundId) {
          issues.push("Price was not updated in current round")
        }

        return mcpToolRes.success({
          network,
          pair,
          feedAddress,
          healthy: issues.length === 0,
          issues,
          details: {
            roundId: roundId.toString(),
            answeredInRound: answeredInRound.toString(),
            updatedAt: new Date(Number(updatedAt) * 1000).toISOString(),
            ageSeconds: age,
            price: answer.toString()
          }
        })
      } catch (error) {
        return mcpToolRes.error(error, "checking price feed health")
      }
    }
  )
}
