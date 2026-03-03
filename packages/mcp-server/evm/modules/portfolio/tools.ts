/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { Address, Hex } from "viem"
import { formatUnits } from "viem"
import { z } from "zod"

import { getPublicClient } from "@/evm/services/clients.js"
import { mcpToolRes } from "@/utils/helper.js"
import { defaultNetworkParam } from "../common/types.js"

// Common tokens by chain for portfolio tracking
const POPULAR_TOKENS: Record<number, Array<{ symbol: string; address: Address; decimals: number }>> = {
  1: [ // Ethereum
    { symbol: "USDC", address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", decimals: 6 },
    { symbol: "USDT", address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", decimals: 6 },
    { symbol: "DAI", address: "0x6B175474E89094C44Da98b954EescddeB131e232", decimals: 18 },
    { symbol: "WETH", address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", decimals: 18 },
    { symbol: "LINK", address: "0x514910771AF9Ca656af840dff83E8264EcF986CA", decimals: 18 }
  ],
  56: [ // BSC
    { symbol: "USDT", address: "0x55d398326f99059fF775485246999027B3197955", decimals: 18 },
    { symbol: "USDC", address: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d", decimals: 18 },
    { symbol: "BUSD", address: "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56", decimals: 18 },
    { symbol: "WBNB", address: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c", decimals: 18 }
  ],
  42161: [ // Arbitrum
    { symbol: "USDC", address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", decimals: 6 },
    { symbol: "USDT", address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", decimals: 6 },
    { symbol: "WETH", address: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1", decimals: 18 },
    { symbol: "ARB", address: "0x912CE59144191C1204E64559FE8253a0e49E6548", decimals: 18 },
    { symbol: "USDs", address: "0xD74f5255D557944cf7Dd0E45FF521520002D5748", decimals: 18 } // Sperax USDs
  ],
  137: [ // Polygon
    { symbol: "USDC", address: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359", decimals: 6 },
    { symbol: "USDT", address: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F", decimals: 6 },
    { symbol: "WMATIC", address: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270", decimals: 18 }
  ]
}

// ERC20 ABI for balance checks
const ERC20_ABI = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    name: "symbol",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }]
  },
  {
    name: "decimals",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }]
  }
] as const

export function registerPortfolioTools(server: McpServer) {
  // Get portfolio overview
  server.tool(
    "get_portfolio_overview",
    "Get a comprehensive portfolio overview for an address",
    {
      network: defaultNetworkParam,
      address: z.string().describe("Wallet address to analyze")
    },
    async ({ network, address }) => {
      try {
        const publicClient = getPublicClient(network)
        const chainId = await publicClient.getChainId()
        
        // Get native balance
        const nativeBalance = await publicClient.getBalance({ address: address as Address })
        
        // Get popular token balances
        const tokens = POPULAR_TOKENS[chainId] || []
        const tokenBalances: Array<{
          symbol: string
          address: string
          balance: string
          formatted: string
        }> = []

        for (const token of tokens) {
          try {
            const balance = await publicClient.readContract({
              address: token.address,
              abi: ERC20_ABI,
              functionName: "balanceOf",
              args: [address as Address]
            })
            
            if (balance > 0n) {
              tokenBalances.push({
                symbol: token.symbol,
                address: token.address,
                balance: balance.toString(),
                formatted: formatUnits(balance, token.decimals)
              })
            }
          } catch {
            // Skip failed token checks
          }
        }

        // Calculate holdings count
        const totalHoldings = (nativeBalance > 0n ? 1 : 0) + tokenBalances.length

        return mcpToolRes.success({
          network,
          chainId,
          address,
          native: {
            balance: nativeBalance.toString(),
            formatted: formatUnits(nativeBalance, 18)
          },
          tokens: tokenBalances,
          summary: {
            totalTokens: tokenBalances.length,
            totalHoldings,
            hasNativeBalance: nativeBalance > 0n
          },
          note: "For complete portfolio, use a specialized indexer service"
        })
      } catch (error) {
        return mcpToolRes.error(error, "getting portfolio overview")
      }
    }
  )

  // Get token balance
  server.tool(
    "get_token_balance",
    "Get balance of a specific token",
    {
      network: defaultNetworkParam,
      address: z.string().describe("Wallet address"),
      tokenAddress: z.string().describe("Token contract address")
    },
    async ({ network, address, tokenAddress }) => {
      try {
        const publicClient = getPublicClient(network)
        
        const [balance, symbol, decimals] = await Promise.all([
          publicClient.readContract({
            address: tokenAddress as Address,
            abi: ERC20_ABI,
            functionName: "balanceOf",
            args: [address as Address]
          }),
          publicClient.readContract({
            address: tokenAddress as Address,
            abi: ERC20_ABI,
            functionName: "symbol"
          }),
          publicClient.readContract({
            address: tokenAddress as Address,
            abi: ERC20_ABI,
            functionName: "decimals"
          })
        ])

        return mcpToolRes.success({
          network,
          wallet: address,
          token: {
            address: tokenAddress,
            symbol,
            decimals: Number(decimals)
          },
          balance: balance.toString(),
          formatted: formatUnits(balance, Number(decimals))
        })
      } catch (error) {
        return mcpToolRes.error(error, "getting token balance")
      }
    }
  )

  // Get multi-chain portfolio
  server.tool(
    "get_multichain_portfolio",
    "Get portfolio across multiple chains",
    {
      address: z.string().describe("Wallet address"),
      networks: z.array(z.string()).optional().describe("Networks to check (default: all supported)")
    },
    async ({ address, networks }) => {
      try {
        const targetNetworks = networks || ["ethereum", "bsc", "arbitrum", "polygon"]
        const portfolio: Array<{
          network: string
          chainId: number
          nativeBalance: string
          tokenCount: number
          status: string
        }> = []

        for (const network of targetNetworks) {
          try {
            const publicClient = getPublicClient(network)
            const chainId = await publicClient.getChainId()
            const nativeBalance = await publicClient.getBalance({ address: address as Address })
            
            // Count tokens with balance
            const tokens = POPULAR_TOKENS[chainId] || []
            let tokenCount = 0
            
            for (const token of tokens.slice(0, 5)) { // Check top 5
              try {
                const balance = await publicClient.readContract({
                  address: token.address,
                  abi: ERC20_ABI,
                  functionName: "balanceOf",
                  args: [address as Address]
                })
                if (balance > 0n) tokenCount++
              } catch {}
            }

            portfolio.push({
              network,
              chainId,
              nativeBalance: formatUnits(nativeBalance, 18),
              tokenCount,
              status: "success"
            })
          } catch {
            portfolio.push({
              network,
              chainId: 0,
              nativeBalance: "0",
              tokenCount: 0,
              status: "error"
            })
          }
        }

        const activeChains = portfolio.filter(p => 
          p.status === "success" && (parseFloat(p.nativeBalance) > 0 || p.tokenCount > 0)
        ).length

        return mcpToolRes.success({
          address,
          portfolio,
          summary: {
            chainsChecked: portfolio.length,
            activeChains,
            totalTokensFound: portfolio.reduce((sum, p) => sum + p.tokenCount, 0)
          }
        })
      } catch (error) {
        return mcpToolRes.error(error, "getting multi-chain portfolio")
      }
    }
  )

  // Get wallet activity summary
  server.tool(
    "get_wallet_activity",
    "Get recent transaction count and activity level",
    {
      network: defaultNetworkParam,
      address: z.string().describe("Wallet address")
    },
    async ({ network, address }) => {
      try {
        const publicClient = getPublicClient(network)
        
        const nonce = await publicClient.getTransactionCount({ address: address as Address })
        const balance = await publicClient.getBalance({ address: address as Address })

        return mcpToolRes.success({
          network,
          address,
          transactionCount: nonce,
          currentBalance: formatUnits(balance, 18),
          activityLevel: nonce > 1000 ? "very high" : 
                        nonce > 100 ? "high" : 
                        nonce > 10 ? "moderate" : "low"
        })
      } catch (error) {
        return mcpToolRes.error(error, "getting wallet activity")
      }
    }
  )

  // Calculate portfolio allocation
  server.tool(
    "calculate_portfolio_allocation",
    "Calculate portfolio allocation percentages",
    {
      holdings: z.array(z.object({
        asset: z.string(),
        valueUSD: z.number()
      })).describe("Array of holdings with USD values")
    },
    async ({ holdings }) => {
      try {
        const totalValue = holdings.reduce((sum, h) => sum + h.valueUSD, 0)
        
        const allocation = holdings.map(h => ({
          asset: h.asset,
          valueUSD: h.valueUSD,
          percentage: totalValue > 0 ? ((h.valueUSD / totalValue) * 100).toFixed(2) + "%" : "0%"
        })).sort((a, b) => b.valueUSD - a.valueUSD)

        return mcpToolRes.success({
          totalValueUSD: totalValue.toFixed(2),
          allocation,
          diversification: {
            topHolding: allocation[0]?.percentage || "0%",
            numberOfAssets: holdings.length,
            concentrationRisk: holdings.length > 0 && 
              (holdings[0].valueUSD / totalValue) > 0.5 ? "high" : "moderate"
          }
        })
      } catch (error) {
        return mcpToolRes.error(error, "calculating portfolio allocation")
      }
    }
  )
}
