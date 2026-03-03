/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { Address, Hex } from "viem"
import { formatGwei, parseGwei } from "viem"
import { z } from "zod"

import { getPublicClient } from "@/evm/services/clients.js"
import { mcpToolRes } from "@/utils/helper.js"
import { defaultNetworkParam } from "../common/types.js"

// Chain-specific gas configurations
const GAS_CONFIGS: Record<number, {
  name: string
  avgBlockTime: number
  hasEip1559: boolean
  nativeSymbol: string
}> = {
  1: { name: "Ethereum", avgBlockTime: 12, hasEip1559: true, nativeSymbol: "ETH" },
  56: { name: "BSC", avgBlockTime: 3, hasEip1559: false, nativeSymbol: "BNB" },
  137: { name: "Polygon", avgBlockTime: 2, hasEip1559: true, nativeSymbol: "MATIC" },
  42161: { name: "Arbitrum", avgBlockTime: 0.25, hasEip1559: true, nativeSymbol: "ETH" },
  10: { name: "Optimism", avgBlockTime: 2, hasEip1559: true, nativeSymbol: "ETH" },
  8453: { name: "Base", avgBlockTime: 2, hasEip1559: true, nativeSymbol: "ETH" },
  204: { name: "opBNB", avgBlockTime: 1, hasEip1559: true, nativeSymbol: "BNB" },
  43114: { name: "Avalanche", avgBlockTime: 2, hasEip1559: true, nativeSymbol: "AVAX" }
}

// Standard gas limits for common operations
const STANDARD_GAS_LIMITS: Record<string, bigint> = {
  transfer: 21000n,
  erc20Transfer: 65000n,
  erc20Approve: 46000n,
  swap: 200000n,
  addLiquidity: 250000n,
  removeLiquidity: 200000n,
  bridge: 150000n,
  nftMint: 100000n,
  nftTransfer: 80000n,
  contractDeploy: 500000n
}

export function registerGasTools(server: McpServer) {
  // Get current gas price
  server.tool(
    "get_gas_price",
    "Get current gas price for a network",
    {
      network: defaultNetworkParam
    },
    async ({ network }) => {
      try {
        const publicClient = getPublicClient(network)
        const chainId = await publicClient.getChainId()
        const config = GAS_CONFIGS[chainId]
        
        const gasPrice = await publicClient.getGasPrice()
        
        // Try to get EIP-1559 fees if supported
        let eip1559Fees = null
        if (config?.hasEip1559) {
          try {
            const feeData = await publicClient.estimateFeesPerGas()
            eip1559Fees = {
              maxFeePerGas: formatGwei(feeData.maxFeePerGas || 0n),
              maxPriorityFeePerGas: formatGwei(feeData.maxPriorityFeePerGas || 0n)
            }
          } catch {
            // EIP-1559 not supported or error
          }
        }

        return mcpToolRes.success({
          network,
          chainId,
          chainName: config?.name || network,
          gasPrice: formatGwei(gasPrice),
          gasPriceWei: gasPrice.toString(),
          eip1559: eip1559Fees,
          nativeSymbol: config?.nativeSymbol || "ETH"
        })
      } catch (error) {
        return mcpToolRes.error(error, "getting gas price")
      }
    }
  )

  // Get gas prices across all chains
  server.tool(
    "get_gas_prices_all_chains",
    "Get gas prices across all supported chains for comparison",
    {},
    async () => {
      try {
        const networks = ["ethereum", "bsc", "polygon", "arbitrum", "optimism", "base"]
        const prices: Array<{
          network: string
          chainId: number
          gasPrice: string
          nativeSymbol: string
          status: string
        }> = []

        for (const network of networks) {
          try {
            const publicClient = getPublicClient(network)
            const chainId = await publicClient.getChainId()
            const gasPrice = await publicClient.getGasPrice()
            const config = GAS_CONFIGS[chainId]

            prices.push({
              network,
              chainId,
              gasPrice: formatGwei(gasPrice),
              nativeSymbol: config?.nativeSymbol || "ETH",
              status: "success"
            })
          } catch {
            prices.push({
              network,
              chainId: 0,
              gasPrice: "0",
              nativeSymbol: "N/A",
              status: "error"
            })
          }
        }

        // Sort by gas price (lowest first)
        prices.sort((a, b) => parseFloat(a.gasPrice) - parseFloat(b.gasPrice))

        return mcpToolRes.success({
          prices,
          cheapest: prices[0],
          mostExpensive: prices[prices.length - 1],
          timestamp: new Date().toISOString()
        })
      } catch (error) {
        return mcpToolRes.error(error, "getting gas prices for all chains")
      }
    }
  )

  // Get EIP-1559 fee data
  server.tool(
    "get_eip1559_fees",
    "Get detailed EIP-1559 fee data including base fee and priority fee",
    {
      network: defaultNetworkParam
    },
    async ({ network }) => {
      try {
        const publicClient = getPublicClient(network)
        
        // Get latest block for base fee
        const block = await publicClient.getBlock({ blockTag: "latest" })
        const feeData = await publicClient.estimateFeesPerGas()
        
        const baseFee = block.baseFeePerGas || 0n
        
        return mcpToolRes.success({
          network,
          baseFee: formatGwei(baseFee),
          baseFeeWei: baseFee.toString(),
          maxFeePerGas: formatGwei(feeData.maxFeePerGas || 0n),
          maxPriorityFeePerGas: formatGwei(feeData.maxPriorityFeePerGas || 0n),
          recommendations: {
            slow: {
              maxFeePerGas: formatGwei((baseFee * 100n) / 100n),
              maxPriorityFeePerGas: "1"
            },
            standard: {
              maxFeePerGas: formatGwei((baseFee * 120n) / 100n),
              maxPriorityFeePerGas: "1.5"
            },
            fast: {
              maxFeePerGas: formatGwei((baseFee * 150n) / 100n),
              maxPriorityFeePerGas: "2"
            }
          },
          blockNumber: block.number?.toString()
        })
      } catch (error) {
        return mcpToolRes.error(error, "getting EIP-1559 fees")
      }
    }
  )

  // Estimate gas for transaction
  server.tool(
    "estimate_gas",
    "Estimate gas for a specific transaction",
    {
      network: defaultNetworkParam,
      from: z.string().describe("Sender address"),
      to: z.string().describe("Recipient/contract address"),
      value: z.string().optional().describe("Value in wei"),
      data: z.string().optional().describe("Transaction data (hex)")
    },
    async ({ network, from, to, value, data }) => {
      try {
        const publicClient = getPublicClient(network)
        
        const gasEstimate = await publicClient.estimateGas({
          account: from as Address,
          to: to as Address,
          value: value ? BigInt(value) : 0n,
          data: data as Hex | undefined
        })
        
        const gasPrice = await publicClient.getGasPrice()
        const chainId = await publicClient.getChainId()
        const config = GAS_CONFIGS[chainId]
        
        const estimatedCost = gasEstimate * gasPrice

        return mcpToolRes.success({
          network,
          gasEstimate: gasEstimate.toString(),
          gasPrice: formatGwei(gasPrice),
          estimatedCost: {
            wei: estimatedCost.toString(),
            gwei: formatGwei(estimatedCost),
            nativeToken: (Number(estimatedCost) / 1e18).toFixed(8)
          },
          nativeSymbol: config?.nativeSymbol || "ETH"
        })
      } catch (error) {
        return mcpToolRes.error(error, "estimating gas")
      }
    }
  )

  // Get standard gas limits
  server.tool(
    "get_standard_gas_limits",
    "Get standard gas limits for common transaction types",
    {
      operationType: z.string().optional().describe("Specific operation type (transfer, swap, etc.)")
    },
    async ({ operationType }) => {
      try {
        if (operationType) {
          const limit = STANDARD_GAS_LIMITS[operationType]
          if (!limit) {
            return mcpToolRes.error(new Error(`Unknown operation: ${operationType}`), "getting gas limit")
          }
          return mcpToolRes.success({
            operation: operationType,
            gasLimit: limit.toString(),
            note: "This is an estimate. Actual gas usage may vary."
          })
        }

        const limits = Object.entries(STANDARD_GAS_LIMITS).map(([op, limit]) => ({
          operation: op,
          gasLimit: limit.toString()
        }))

        return mcpToolRes.success({
          limits,
          note: "These are estimates. Actual gas usage may vary based on contract complexity."
        })
      } catch (error) {
        return mcpToolRes.error(error, "getting standard gas limits")
      }
    }
  )

  // Calculate transaction cost
  server.tool(
    "calculate_tx_cost",
    "Calculate the cost of a transaction in native tokens and USD",
    {
      network: defaultNetworkParam,
      gasLimit: z.string().describe("Gas limit for the transaction"),
      gasPriceGwei: z.string().optional().describe("Gas price in gwei (uses current if not provided)")
    },
    async ({ network, gasLimit, gasPriceGwei }) => {
      try {
        const publicClient = getPublicClient(network)
        const chainId = await publicClient.getChainId()
        const config = GAS_CONFIGS[chainId]
        
        let gasPrice: bigint
        if (gasPriceGwei) {
          gasPrice = parseGwei(gasPriceGwei)
        } else {
          gasPrice = await publicClient.getGasPrice()
        }
        
        const totalCost = BigInt(gasLimit) * gasPrice
        const costInNative = Number(totalCost) / 1e18

        return mcpToolRes.success({
          network,
          gasLimit,
          gasPrice: formatGwei(gasPrice),
          totalCost: {
            wei: totalCost.toString(),
            native: costInNative.toFixed(8),
            symbol: config?.nativeSymbol || "ETH"
          },
          note: "USD value requires price feed integration"
        })
      } catch (error) {
        return mcpToolRes.error(error, "calculating transaction cost")
      }
    }
  )

  // Get gas history
  server.tool(
    "get_gas_history",
    "Get historical gas prices from recent blocks",
    {
      network: defaultNetworkParam,
      blocks: z.number().optional().describe("Number of blocks to analyze (default: 10)")
    },
    async ({ network, blocks = 10 }) => {
      try {
        const publicClient = getPublicClient(network)
        const latestBlock = await publicClient.getBlock({ blockTag: "latest" })
        
        const history: Array<{
          blockNumber: string
          baseFee: string | null
          timestamp: string
        }> = []
        
        for (let i = 0; i < blocks; i++) {
          const blockNum = latestBlock.number! - BigInt(i)
          const block = await publicClient.getBlock({ blockNumber: blockNum })
          
          history.push({
            blockNumber: blockNum.toString(),
            baseFee: block.baseFeePerGas ? formatGwei(block.baseFeePerGas) : null,
            timestamp: new Date(Number(block.timestamp) * 1000).toISOString()
          })
        }

        const baseFees = history
          .map(h => h.baseFee ? parseFloat(h.baseFee) : 0)
          .filter(f => f > 0)
        
        return mcpToolRes.success({
          network,
          blocksAnalyzed: blocks,
          history,
          statistics: baseFees.length > 0 ? {
            average: (baseFees.reduce((a, b) => a + b, 0) / baseFees.length).toFixed(4),
            min: Math.min(...baseFees).toFixed(4),
            max: Math.max(...baseFees).toFixed(4)
          } : null
        })
      } catch (error) {
        return mcpToolRes.error(error, "getting gas history")
      }
    }
  )
}
