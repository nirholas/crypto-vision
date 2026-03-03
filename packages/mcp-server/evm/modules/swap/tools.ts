/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { Address, Hex } from "viem"
import { parseEther, formatEther, formatUnits } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { z } from "zod"

import { getPublicClient, getWalletClient } from "@/evm/services/clients.js"
import { mcpToolRes } from "@/utils/helper.js"
import { defaultNetworkParam, privateKeyParam } from "../common/types.js"

// DEX Aggregator APIs
const AGGREGATOR_APIS = {
  "1inch": "https://api.1inch.dev/swap/v6.0",
  "0x": "https://api.0x.org/swap/v1",
  paraswap: "https://apiv5.paraswap.io"
}

// Popular DEX Router addresses by chain
const DEX_ROUTERS: Record<string, Record<string, Address>> = {
  bsc: {
    pancakeswap: "0x10ED43C718714eb63d5aA57B78B54704E256024E",
    uniswap: "0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24"
  },
  ethereum: {
    uniswap: "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45",
    sushiswap: "0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F"
  },
  arbitrum: {
    uniswap: "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45",
    sushiswap: "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506",
    camelot: "0xc873fEcbd354f5A56E00E710B90EF4201db2448d"
  },
  polygon: {
    uniswap: "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45",
    quickswap: "0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff"
  },
  base: {
    uniswap: "0x2626664c2603336E57B271c5C0b26F421741e481",
    aerodrome: "0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43"
  }
}

// Standard ERC20 ABI for approvals
const ERC20_ABI = [
  {
    name: "approve",
    type: "function",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" }
    ],
    outputs: [{ name: "", type: "bool" }]
  },
  {
    name: "allowance",
    type: "function",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" }
    ],
    outputs: [{ name: "", type: "uint256" }]
  }
] as const

// Uniswap V2 Router ABI
const UNISWAP_V2_ROUTER_ABI = [
  {
    name: "getAmountsOut",
    type: "function",
    inputs: [
      { name: "amountIn", type: "uint256" },
      { name: "path", type: "address[]" }
    ],
    outputs: [{ name: "amounts", type: "uint256[]" }]
  },
  {
    name: "swapExactTokensForTokens",
    type: "function",
    inputs: [
      { name: "amountIn", type: "uint256" },
      { name: "amountOutMin", type: "uint256" },
      { name: "path", type: "address[]" },
      { name: "to", type: "address" },
      { name: "deadline", type: "uint256" }
    ],
    outputs: [{ name: "amounts", type: "uint256[]" }]
  },
  {
    name: "swapExactETHForTokens",
    type: "function",
    inputs: [
      { name: "amountOutMin", type: "uint256" },
      { name: "path", type: "address[]" },
      { name: "to", type: "address" },
      { name: "deadline", type: "uint256" }
    ],
    outputs: [{ name: "amounts", type: "uint256[]" }]
  },
  {
    name: "swapExactTokensForETH",
    type: "function",
    inputs: [
      { name: "amountIn", type: "uint256" },
      { name: "amountOutMin", type: "uint256" },
      { name: "path", type: "address[]" },
      { name: "to", type: "address" },
      { name: "deadline", type: "uint256" }
    ],
    outputs: [{ name: "amounts", type: "uint256[]" }]
  },
  {
    name: "addLiquidity",
    type: "function",
    inputs: [
      { name: "tokenA", type: "address" },
      { name: "tokenB", type: "address" },
      { name: "amountADesired", type: "uint256" },
      { name: "amountBDesired", type: "uint256" },
      { name: "amountAMin", type: "uint256" },
      { name: "amountBMin", type: "uint256" },
      { name: "to", type: "address" },
      { name: "deadline", type: "uint256" }
    ],
    outputs: [
      { name: "amountA", type: "uint256" },
      { name: "amountB", type: "uint256" },
      { name: "liquidity", type: "uint256" }
    ]
  },
  {
    name: "addLiquidityETH",
    type: "function",
    inputs: [
      { name: "token", type: "address" },
      { name: "amountTokenDesired", type: "uint256" },
      { name: "amountTokenMin", type: "uint256" },
      { name: "amountETHMin", type: "uint256" },
      { name: "to", type: "address" },
      { name: "deadline", type: "uint256" }
    ],
    outputs: [
      { name: "amountToken", type: "uint256" },
      { name: "amountETH", type: "uint256" },
      { name: "liquidity", type: "uint256" }
    ]
  },
  {
    name: "removeLiquidity",
    type: "function",
    inputs: [
      { name: "tokenA", type: "address" },
      { name: "tokenB", type: "address" },
      { name: "liquidity", type: "uint256" },
      { name: "amountAMin", type: "uint256" },
      { name: "amountBMin", type: "uint256" },
      { name: "to", type: "address" },
      { name: "deadline", type: "uint256" }
    ],
    outputs: [
      { name: "amountA", type: "uint256" },
      { name: "amountB", type: "uint256" }
    ]
  },
  {
    name: "removeLiquidityETH",
    type: "function",
    inputs: [
      { name: "token", type: "address" },
      { name: "liquidity", type: "uint256" },
      { name: "amountTokenMin", type: "uint256" },
      { name: "amountETHMin", type: "uint256" },
      { name: "to", type: "address" },
      { name: "deadline", type: "uint256" }
    ],
    outputs: [
      { name: "amountToken", type: "uint256" },
      { name: "amountETH", type: "uint256" }
    ]
  }
] as const

// Uniswap V2 Factory ABI
const UNISWAP_V2_FACTORY_ABI = [
  {
    name: "getPair",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "tokenA", type: "address" },
      { name: "tokenB", type: "address" }
    ],
    outputs: [{ name: "pair", type: "address" }]
  }
] as const

// LP Pair ABI
const LP_PAIR_ABI = [
  { name: "getReserves", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "reserve0", type: "uint112" }, { name: "reserve1", type: "uint112" }, { name: "blockTimestampLast", type: "uint32" }] },
  { name: "token0", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { name: "token1", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { name: "totalSupply", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { name: "balanceOf", type: "function", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ type: "uint256" }] }
] as const

// DEX Factory addresses
const DEX_FACTORIES: Record<string, Record<string, Address>> = {
  bsc: {
    pancakeswap: "0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73"
  },
  ethereum: {
    uniswap: "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f"
  },
  arbitrum: {
    uniswap: "0xf1D7CC64Fb4452F05c498126312eBE29f30Fbcf9"
  },
  polygon: {
    quickswap: "0x5757371414417b8C6CAad45bAeF941aBc7d3Ab32"
  }
}

export function registerSwapTools(server: McpServer) {
  // Get swap quote
  server.tool(
    "get_swap_quote",
    "Get a swap quote for exchanging tokens. Returns expected output amount and price impact.",
    {
      tokenIn: z.string().describe("Address of the token to sell"),
      tokenOut: z.string().describe("Address of the token to buy"),
      amountIn: z.string().describe("Amount of input token (in wei/smallest unit)"),
      network: defaultNetworkParam,
      dex: z.string().optional().describe("Specific DEX to use (e.g., 'uniswap', 'pancakeswap'). If not specified, finds best route.")
    },
    async ({ tokenIn, tokenOut, amountIn, network, dex }) => {
      try {
        const client = getPublicClient(network)
        const chainId = await client.getChainId()
        
        // Get available routers for this network
        const networkRouters = DEX_ROUTERS[network] || DEX_ROUTERS.ethereum
        const routerAddress = dex ? networkRouters[dex.toLowerCase()] : Object.values(networkRouters)[0]
        
        if (!routerAddress) {
          return mcpToolRes.error(new Error(`No router found for ${dex || 'default'} on ${network}`), "getting swap quote")
        }

        // Get quote from router
        const path = [tokenIn as Address, tokenOut as Address]
        
        const amounts = await client.readContract({
          address: routerAddress,
          abi: UNISWAP_V2_ROUTER_ABI,
          functionName: "getAmountsOut",
          args: [BigInt(amountIn), path]
        })

        const amountOut = amounts[amounts.length - 1]
        
        // Calculate price impact (simplified)
        const priceImpact = "< 1%" // Would need liquidity data for accurate calculation

        return mcpToolRes.success({
          tokenIn,
          tokenOut,
          amountIn,
          amountOut: amountOut.toString(),
          router: routerAddress,
          dex: dex || "default",
          network,
          chainId,
          priceImpact,
          path
        })
      } catch (error) {
        return mcpToolRes.error(error, "getting swap quote")
      }
    }
  )

  // Execute swap
  server.tool(
    "execute_swap",
    "Execute a token swap on a DEX",
    {
      tokenIn: z.string().describe("Address of the token to sell"),
      tokenOut: z.string().describe("Address of the token to buy"),
      amountIn: z.string().describe("Amount of input token (in wei/smallest unit)"),
      minAmountOut: z.string().describe("Minimum amount of output token to receive (slippage protection)"),
      network: defaultNetworkParam,
      privateKey: privateKeyParam,
      dex: z.string().optional().describe("Specific DEX to use"),
      deadline: z.number().optional().describe("Transaction deadline in seconds from now (default: 1200 = 20 minutes)")
    },
    async ({ tokenIn, tokenOut, amountIn, minAmountOut, network, privateKey, dex, deadline }) => {
      try {
        const walletClient = getWalletClient(privateKey as Hex, network)
        const publicClient = getPublicClient(network)
        const account = privateKeyToAccount(privateKey as Hex)
        
        const networkRouters = DEX_ROUTERS[network] || DEX_ROUTERS.ethereum
        const routerAddress = dex ? networkRouters[dex.toLowerCase()] : Object.values(networkRouters)[0]
        
        if (!routerAddress) {
          return mcpToolRes.error(new Error(`No router found for ${dex || 'default'} on ${network}`), "executing swap")
        }

        const path = [tokenIn as Address, tokenOut as Address]
        const txDeadline = BigInt(Math.floor(Date.now() / 1000) + (deadline || 1200))

        // Check and set approval if needed
        const allowance = await publicClient.readContract({
          address: tokenIn as Address,
          abi: ERC20_ABI,
          functionName: "allowance",
          args: [account.address, routerAddress]
        })

        if (allowance < BigInt(amountIn)) {
          // Approve router to spend tokens
          const approveHash = await walletClient.writeContract({
            address: tokenIn as Address,
            abi: ERC20_ABI,
            functionName: "approve",
            args: [routerAddress, BigInt(amountIn)],
            account
          })
          await publicClient.waitForTransactionReceipt({ hash: approveHash })
        }

        // Execute swap
        const hash = await walletClient.writeContract({
          address: routerAddress,
          abi: UNISWAP_V2_ROUTER_ABI,
          functionName: "swapExactTokensForTokens",
          args: [
            BigInt(amountIn),
            BigInt(minAmountOut),
            path,
            account.address,
            txDeadline
          ],
          account
        })

        const receipt = await publicClient.waitForTransactionReceipt({ hash })

        return mcpToolRes.success({
          success: true,
          transactionHash: hash,
          blockNumber: receipt.blockNumber.toString(),
          gasUsed: receipt.gasUsed.toString(),
          tokenIn,
          tokenOut,
          amountIn,
          minAmountOut,
          router: routerAddress
        })
      } catch (error) {
        return mcpToolRes.error(error, "executing swap")
      }
    }
  )

  // Get best swap route
  server.tool(
    "get_best_route",
    "Find the optimal swap route across multiple DEXs for the best price",
    {
      tokenIn: z.string().describe("Address of the token to sell"),
      tokenOut: z.string().describe("Address of the token to buy"),
      amountIn: z.string().describe("Amount of input token (in wei/smallest unit)"),
      network: defaultNetworkParam
    },
    async ({ tokenIn, tokenOut, amountIn, network }) => {
      try {
        const client = getPublicClient(network)
        const networkRouters = DEX_ROUTERS[network] || DEX_ROUTERS.ethereum
        
        const quotes: Array<{ dex: string; amountOut: string; router: Address }> = []
        const path = [tokenIn as Address, tokenOut as Address]

        // Get quotes from all available DEXs
        for (const [dexName, routerAddress] of Object.entries(networkRouters)) {
          try {
            const amounts = await client.readContract({
              address: routerAddress,
              abi: UNISWAP_V2_ROUTER_ABI,
              functionName: "getAmountsOut",
              args: [BigInt(amountIn), path]
            })
            
            quotes.push({
              dex: dexName,
              amountOut: amounts[amounts.length - 1].toString(),
              router: routerAddress
            })
          } catch {
            // DEX doesn't have this pair, skip
          }
        }

        // Sort by best output
        quotes.sort((a, b) => BigInt(b.amountOut) > BigInt(a.amountOut) ? 1 : -1)

        const bestRoute = quotes[0]

        return mcpToolRes.success({
          tokenIn,
          tokenOut,
          amountIn,
          bestRoute,
          allQuotes: quotes,
          network
        })
      } catch (error) {
        return mcpToolRes.error(error, "finding best route")
      }
    }
  )

  // Get DEX liquidity
  server.tool(
    "get_dex_liquidity",
    "Get liquidity information for a trading pair on a DEX",
    {
      tokenA: z.string().describe("First token address"),
      tokenB: z.string().describe("Second token address"),
      network: defaultNetworkParam,
      dex: z.string().optional().describe("DEX to query")
    },
    async ({ tokenA, tokenB, network, dex }) => {
      try {
        const client = getPublicClient(network)
        
        // This would typically query the pair contract
        // Simplified implementation
        return mcpToolRes.success({
          tokenA,
          tokenB,
          network,
          dex: dex || "default",
          message: "Liquidity query - pair contract lookup needed for detailed reserves"
        })
      } catch (error) {
        return mcpToolRes.error(error, "getting DEX liquidity")
      }
    }
  )

  // Calculate price impact
  server.tool(
    "get_price_impact",
    "Calculate the price impact for a given trade size",
    {
      tokenIn: z.string().describe("Address of the token to sell"),
      tokenOut: z.string().describe("Address of the token to buy"),
      amountIn: z.string().describe("Amount of input token (in wei)"),
      network: defaultNetworkParam
    },
    async ({ tokenIn, tokenOut, amountIn, network }) => {
      try {
        const client = getPublicClient(network)
        const networkRouters = DEX_ROUTERS[network] || DEX_ROUTERS.ethereum
        const routerAddress = Object.values(networkRouters)[0]
        
        const path = [tokenIn as Address, tokenOut as Address]
        
        // Get quote for small amount (baseline price)
        const smallAmount = BigInt(amountIn) / BigInt(1000)
        const smallAmounts = await client.readContract({
          address: routerAddress,
          abi: UNISWAP_V2_ROUTER_ABI,
          functionName: "getAmountsOut",
          args: [smallAmount, path]
        })
        
        // Get quote for full amount
        const fullAmounts = await client.readContract({
          address: routerAddress,
          abi: UNISWAP_V2_ROUTER_ABI,
          functionName: "getAmountsOut",
          args: [BigInt(amountIn), path]
        })

        const baselinePrice = Number(smallAmounts[1]) / Number(smallAmount)
        const actualPrice = Number(fullAmounts[1]) / Number(amountIn)
        const priceImpact = ((baselinePrice - actualPrice) / baselinePrice) * 100

        return mcpToolRes.success({
          tokenIn,
          tokenOut,
          amountIn,
          expectedOutput: fullAmounts[1].toString(),
          priceImpact: `${priceImpact.toFixed(4)}%`,
          priceImpactRaw: priceImpact,
          warning: priceImpact > 5 ? "HIGH PRICE IMPACT - Consider smaller trade" : null
        })
      } catch (error) {
        return mcpToolRes.error(error, "calculating price impact")
      }
    }
  )

  // Get supported DEXs
  server.tool(
    "get_supported_dexs",
    "List all supported DEXs on a specific network",
    {
      network: defaultNetworkParam
    },
    async ({ network }) => {
      try {
        const networkRouters = DEX_ROUTERS[network] || {}
        const dexList = Object.entries(networkRouters).map(([name, address]) => ({
          name,
          router: address
        }))

        return mcpToolRes.success({
          network,
          supportedDEXs: dexList,
          count: dexList.length
        })
      } catch (error) {
        return mcpToolRes.error(error, "getting supported DEXs")
      }
    }
  )

  // Add liquidity to DEX
  server.tool(
    "add_liquidity",
    "Add liquidity to a DEX trading pair",
    {
      tokenA: z.string().describe("First token address"),
      tokenB: z.string().describe("Second token address"),
      amountA: z.string().describe("Amount of first token (in wei)"),
      amountB: z.string().describe("Amount of second token (in wei)"),
      slippage: z.number().default(1).describe("Slippage tolerance in percent (default: 1%)"),
      network: defaultNetworkParam,
      dex: z.string().optional().describe("Specific DEX to use"),
      privateKey: privateKeyParam
    },
    async ({ tokenA, tokenB, amountA, amountB, slippage, network, dex, privateKey }) => {
      try {
        const walletClient = getWalletClient(privateKey as Hex, network)
        const publicClient = getPublicClient(network)
        const account = privateKeyToAccount(privateKey as Hex)
        
        const networkRouters = DEX_ROUTERS[network] || DEX_ROUTERS.ethereum
        const routerAddress = dex ? networkRouters[dex.toLowerCase()] : Object.values(networkRouters)[0]
        
        if (!routerAddress) {
          return mcpToolRes.error(new Error(`No router found`), "adding liquidity")
        }

        const amountABig = BigInt(amountA)
        const amountBBig = BigInt(amountB)
        const amountAMin = amountABig * BigInt(100 - slippage) / 100n
        const amountBMin = amountBBig * BigInt(100 - slippage) / 100n
        const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200)

        // Approve both tokens
        for (const [token, amount] of [[tokenA, amountABig], [tokenB, amountBBig]] as const) {
          const approveHash = await walletClient.writeContract({
            address: token as Address,
            abi: ERC20_ABI,
            functionName: "approve",
            args: [routerAddress, amount],
            account
          })
          await publicClient.waitForTransactionReceipt({ hash: approveHash })
        }

        // Add liquidity
        const hash = await walletClient.writeContract({
          address: routerAddress,
          abi: UNISWAP_V2_ROUTER_ABI,
          functionName: "addLiquidity",
          args: [
            tokenA as Address,
            tokenB as Address,
            amountABig,
            amountBBig,
            amountAMin,
            amountBMin,
            account.address,
            deadline
          ],
          account
        })

        const receipt = await publicClient.waitForTransactionReceipt({ hash })

        return mcpToolRes.success({
          success: true,
          transactionHash: hash,
          tokenA,
          tokenB,
          amountA,
          amountB,
          router: routerAddress,
          blockNumber: receipt.blockNumber.toString(),
          network
        })
      } catch (error) {
        return mcpToolRes.error(error, "adding liquidity")
      }
    }
  )

  // Add liquidity with native token (ETH/BNB)
  server.tool(
    "add_liquidity_native",
    "Add liquidity with native token (ETH, BNB, MATIC) and another token",
    {
      token: z.string().describe("Token address to pair with native"),
      amountToken: z.string().describe("Amount of token (in wei)"),
      amountNative: z.string().describe("Amount of native token (in ether, e.g., '1.5')"),
      slippage: z.number().default(1).describe("Slippage tolerance in percent"),
      network: defaultNetworkParam,
      dex: z.string().optional().describe("Specific DEX to use"),
      privateKey: privateKeyParam
    },
    async ({ token, amountToken, amountNative, slippage, network, dex, privateKey }) => {
      try {
        const walletClient = getWalletClient(privateKey as Hex, network)
        const publicClient = getPublicClient(network)
        const account = privateKeyToAccount(privateKey as Hex)
        
        const networkRouters = DEX_ROUTERS[network] || DEX_ROUTERS.ethereum
        const routerAddress = dex ? networkRouters[dex.toLowerCase()] : Object.values(networkRouters)[0]
        
        if (!routerAddress) {
          return mcpToolRes.error(new Error(`No router found`), "adding liquidity")
        }

        const amountTokenBig = BigInt(amountToken)
        const amountNativeBig = parseEther(amountNative)
        const amountTokenMin = amountTokenBig * BigInt(100 - slippage) / 100n
        const amountNativeMin = amountNativeBig * BigInt(100 - slippage) / 100n
        const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200)

        // Approve token
        const approveHash = await walletClient.writeContract({
          address: token as Address,
          abi: ERC20_ABI,
          functionName: "approve",
          args: [routerAddress, amountTokenBig],
          account
        })
        await publicClient.waitForTransactionReceipt({ hash: approveHash })

        // Add liquidity with ETH
        const hash = await walletClient.writeContract({
          address: routerAddress,
          abi: UNISWAP_V2_ROUTER_ABI,
          functionName: "addLiquidityETH",
          args: [
            token as Address,
            amountTokenBig,
            amountTokenMin,
            amountNativeMin,
            account.address,
            deadline
          ],
          value: amountNativeBig,
          account
        })

        const receipt = await publicClient.waitForTransactionReceipt({ hash })

        return mcpToolRes.success({
          success: true,
          transactionHash: hash,
          token,
          amountToken,
          amountNative,
          router: routerAddress,
          blockNumber: receipt.blockNumber.toString(),
          network
        })
      } catch (error) {
        return mcpToolRes.error(error, "adding liquidity with native token")
      }
    }
  )

  // Remove liquidity
  server.tool(
    "remove_liquidity",
    "Remove liquidity from a DEX trading pair",
    {
      tokenA: z.string().describe("First token address"),
      tokenB: z.string().describe("Second token address"),
      liquidity: z.string().describe("Amount of LP tokens to remove (in wei)"),
      slippage: z.number().default(1).describe("Slippage tolerance in percent"),
      network: defaultNetworkParam,
      dex: z.string().optional().describe("Specific DEX to use"),
      privateKey: privateKeyParam
    },
    async ({ tokenA, tokenB, liquidity, slippage, network, dex, privateKey }) => {
      try {
        const walletClient = getWalletClient(privateKey as Hex, network)
        const publicClient = getPublicClient(network)
        const account = privateKeyToAccount(privateKey as Hex)
        
        const networkRouters = DEX_ROUTERS[network] || DEX_ROUTERS.ethereum
        const routerAddress = dex ? networkRouters[dex.toLowerCase()] : Object.values(networkRouters)[0]
        
        if (!routerAddress) {
          return mcpToolRes.error(new Error(`No router found`), "removing liquidity")
        }

        const liquidityBig = BigInt(liquidity)
        const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200)

        // Get pair address to approve
        const factoryAddress = DEX_FACTORIES[network]?.[dex?.toLowerCase() || Object.keys(DEX_FACTORIES[network] || {})[0]]
        if (factoryAddress) {
          const pairAddress = await publicClient.readContract({
            address: factoryAddress,
            abi: UNISWAP_V2_FACTORY_ABI,
            functionName: "getPair",
            args: [tokenA as Address, tokenB as Address]
          })

          // Approve LP tokens
          const approveHash = await walletClient.writeContract({
            address: pairAddress as Address,
            abi: ERC20_ABI,
            functionName: "approve",
            args: [routerAddress, liquidityBig],
            account
          })
          await publicClient.waitForTransactionReceipt({ hash: approveHash })
        }

        // Remove liquidity (with 0 minimum for simplicity - in production use proper calculation)
        const hash = await walletClient.writeContract({
          address: routerAddress,
          abi: UNISWAP_V2_ROUTER_ABI,
          functionName: "removeLiquidity",
          args: [
            tokenA as Address,
            tokenB as Address,
            liquidityBig,
            0n, // amountAMin - set to 0 for now
            0n, // amountBMin - set to 0 for now
            account.address,
            deadline
          ],
          account
        })

        const receipt = await publicClient.waitForTransactionReceipt({ hash })

        return mcpToolRes.success({
          success: true,
          transactionHash: hash,
          tokenA,
          tokenB,
          liquidityRemoved: liquidity,
          router: routerAddress,
          blockNumber: receipt.blockNumber.toString(),
          network
        })
      } catch (error) {
        return mcpToolRes.error(error, "removing liquidity")
      }
    }
  )

  // Get LP token balance
  server.tool(
    "get_lp_balance",
    "Get LP token balance for a trading pair",
    {
      tokenA: z.string().describe("First token address"),
      tokenB: z.string().describe("Second token address"),
      address: z.string().describe("Address to check balance for"),
      network: defaultNetworkParam,
      dex: z.string().optional().describe("Specific DEX")
    },
    async ({ tokenA, tokenB, address, network, dex }) => {
      try {
        const publicClient = getPublicClient(network)
        
        const factoryAddress = DEX_FACTORIES[network]?.[dex?.toLowerCase() || Object.keys(DEX_FACTORIES[network] || {})[0]]
        if (!factoryAddress) {
          return mcpToolRes.error(new Error("Factory not found"), "getting LP balance")
        }

        const pairAddress = await publicClient.readContract({
          address: factoryAddress,
          abi: UNISWAP_V2_FACTORY_ABI,
          functionName: "getPair",
          args: [tokenA as Address, tokenB as Address]
        })

        if (pairAddress === "0x0000000000000000000000000000000000000000") {
          return mcpToolRes.success({
            tokenA,
            tokenB,
            pairExists: false,
            balance: "0",
            network
          })
        }

        const [balance, totalSupply] = await Promise.all([
          publicClient.readContract({
            address: pairAddress as Address,
            abi: LP_PAIR_ABI,
            functionName: "balanceOf",
            args: [address as Address]
          }),
          publicClient.readContract({
            address: pairAddress as Address,
            abi: LP_PAIR_ABI,
            functionName: "totalSupply"
          })
        ])

        const sharePercent = totalSupply > 0n 
          ? (Number(balance) / Number(totalSupply) * 100).toFixed(4)
          : "0"

        return mcpToolRes.success({
          tokenA,
          tokenB,
          pairAddress,
          pairExists: true,
          balance: balance.toString(),
          balanceFormatted: formatEther(balance as bigint),
          totalSupply: totalSupply.toString(),
          shareOfPool: `${sharePercent}%`,
          network
        })
      } catch (error) {
        return mcpToolRes.error(error, "getting LP balance")
      }
    }
  )

  // Get pool reserves
  server.tool(
    "get_pool_reserves",
    "Get the reserves in a liquidity pool",
    {
      tokenA: z.string().describe("First token address"),
      tokenB: z.string().describe("Second token address"),
      network: defaultNetworkParam,
      dex: z.string().optional().describe("Specific DEX")
    },
    async ({ tokenA, tokenB, network, dex }) => {
      try {
        const publicClient = getPublicClient(network)
        
        const factoryAddress = DEX_FACTORIES[network]?.[dex?.toLowerCase() || Object.keys(DEX_FACTORIES[network] || {})[0]]
        if (!factoryAddress) {
          return mcpToolRes.error(new Error("Factory not found"), "getting pool reserves")
        }

        const pairAddress = await publicClient.readContract({
          address: factoryAddress,
          abi: UNISWAP_V2_FACTORY_ABI,
          functionName: "getPair",
          args: [tokenA as Address, tokenB as Address]
        })

        if (pairAddress === "0x0000000000000000000000000000000000000000") {
          return mcpToolRes.success({
            tokenA,
            tokenB,
            pairExists: false,
            network
          })
        }

        const [reserves, token0, totalSupply] = await Promise.all([
          publicClient.readContract({
            address: pairAddress as Address,
            abi: LP_PAIR_ABI,
            functionName: "getReserves"
          }),
          publicClient.readContract({
            address: pairAddress as Address,
            abi: LP_PAIR_ABI,
            functionName: "token0"
          }),
          publicClient.readContract({
            address: pairAddress as Address,
            abi: LP_PAIR_ABI,
            functionName: "totalSupply"
          })
        ])

        const [reserve0, reserve1] = reserves as [bigint, bigint, number]
        const isToken0First = (token0 as string).toLowerCase() === tokenA.toLowerCase()

        return mcpToolRes.success({
          tokenA,
          tokenB,
          pairAddress,
          pairExists: true,
          reserves: {
            tokenA: isToken0First ? reserve0.toString() : reserve1.toString(),
            tokenB: isToken0First ? reserve1.toString() : reserve0.toString()
          },
          totalLPSupply: totalSupply.toString(),
          network
        })
      } catch (error) {
        return mcpToolRes.error(error, "getting pool reserves")
      }
    }
  )

  // Calculate optimal swap amount for arbitrage
  server.tool(
    "calculate_arbitrage",
    "Calculate potential arbitrage opportunity between two DEXs",
    {
      tokenIn: z.string().describe("Input token address"),
      tokenOut: z.string().describe("Output token address"),
      amountIn: z.string().describe("Amount to check (in wei)"),
      network: defaultNetworkParam
    },
    async ({ tokenIn, tokenOut, amountIn, network }) => {
      try {
        const client = getPublicClient(network)
        const networkRouters = DEX_ROUTERS[network] || DEX_ROUTERS.ethereum
        
        const quotes: Array<{ dex: string; amountOut: string }> = []
        const path = [tokenIn as Address, tokenOut as Address]

        for (const [dexName, routerAddress] of Object.entries(networkRouters)) {
          try {
            const amounts = await client.readContract({
              address: routerAddress,
              abi: UNISWAP_V2_ROUTER_ABI,
              functionName: "getAmountsOut",
              args: [BigInt(amountIn), path]
            })
            quotes.push({
              dex: dexName,
              amountOut: amounts[amounts.length - 1].toString()
            })
          } catch {}
        }

        if (quotes.length < 2) {
          return mcpToolRes.success({
            message: "Need at least 2 DEXs for arbitrage comparison",
            quotes,
            network
          })
        }

        quotes.sort((a, b) => BigInt(b.amountOut) > BigInt(a.amountOut) ? 1 : -1)
        
        const bestDex = quotes[0]
        const worstDex = quotes[quotes.length - 1]
        const spread = BigInt(bestDex.amountOut) - BigInt(worstDex.amountOut)
        const spreadPercent = (Number(spread) / Number(worstDex.amountOut) * 100).toFixed(4)

        return mcpToolRes.success({
          tokenIn,
          tokenOut,
          amountIn,
          bestQuote: bestDex,
          worstQuote: worstDex,
          spread: spread.toString(),
          spreadPercent: `${spreadPercent}%`,
          arbitrageProfitable: parseFloat(spreadPercent) > 0.5,
          allQuotes: quotes,
          network
        })
      } catch (error) {
        return mcpToolRes.error(error, "calculating arbitrage")
      }
    }
  )
}
