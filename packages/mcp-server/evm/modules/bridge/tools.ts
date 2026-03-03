/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { Address, Hex } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { z } from "zod"

import { getPublicClient, getWalletClient } from "@/evm/services/clients.js"
import { mcpToolRes } from "@/utils/helper.js"
import { defaultNetworkParam, privateKeyParam } from "../common/types.js"

// Bridge protocol configurations
const BRIDGE_CONFIGS: Record<string, {
  name: string
  supportedChains: number[]
  estimateTime: string
  contractAddresses: Record<number, Address>
}> = {
  stargate: {
    name: "Stargate",
    supportedChains: [1, 56, 137, 42161, 10, 8453, 43114],
    estimateTime: "10-30 minutes",
    contractAddresses: {
      1: "0x8731d54E9D02c286767d56ac03e8037C07e01e98",
      56: "0x4a364f8c717cAAD9A442737Eb7b8A55cc6cf18D8",
      137: "0x45A01E4e04F14f7A4a6702c74187c5F6222033cd",
      42161: "0x53Bf833A5d6c4ddA888F69c22C88C9f356a41614",
      10: "0xB0D502E938ed5f4df2E681fE6E419ff29631d62b"
    }
  },
  layerzero: {
    name: "LayerZero",
    supportedChains: [1, 56, 137, 42161, 10, 8453, 43114, 250],
    estimateTime: "5-20 minutes",
    contractAddresses: {
      1: "0x66A71Dcef29A0fFBDBE3c6a460a3B5BC225Cd675",
      56: "0x3c2269811836af69497E5F486A85D7316753cf62",
      137: "0x3c2269811836af69497E5F486A85D7316753cf62",
      42161: "0x3c2269811836af69497E5F486A85D7316753cf62"
    }
  },
  wormhole: {
    name: "Wormhole",
    supportedChains: [1, 56, 137, 42161, 10, 43114, 250],
    estimateTime: "15-30 minutes",
    contractAddresses: {
      1: "0x98f3c9e6E3fAce36bAAd05FE09d375Ef1464288B",
      56: "0x98f3c9e6E3fAce36bAAd05FE09d375Ef1464288B",
      137: "0x7A4B5a56256163F07b2C80A7cA55aBE66c4ec4d7"
    }
  },
  across: {
    name: "Across",
    supportedChains: [1, 137, 42161, 10, 8453],
    estimateTime: "2-10 minutes",
    contractAddresses: {
      1: "0x5c7BCd6E7De5423a257D81B442095A1a6ced35C5",
      137: "0x9295ee1d8C5b022Be115A2AD3c30C72E34e7F096",
      42161: "0xe35e9842fceaCA96570B734083f4a58e8F7C5f2A"
    }
  }
}

// Chain ID to name mapping
const CHAIN_NAMES: Record<number, string> = {
  1: "ethereum",
  56: "bsc",
  137: "polygon",
  42161: "arbitrum",
  10: "optimism",
  8453: "base",
  43114: "avalanche",
  250: "fantom"
}

// Standard bridge interface ABI (simplified)
const BRIDGE_ABI = [
  {
    name: "swap",
    type: "function",
    inputs: [
      { name: "_dstChainId", type: "uint16" },
      { name: "_srcPoolId", type: "uint256" },
      { name: "_dstPoolId", type: "uint256" },
      { name: "_refundAddress", type: "address" },
      { name: "_amountLD", type: "uint256" },
      { name: "_minAmountLD", type: "uint256" },
      { name: "_lzTxParams", type: "tuple" },
      { name: "_to", type: "bytes" },
      { name: "_payload", type: "bytes" }
    ],
    outputs: []
  },
  {
    name: "quoteLayerZeroFee",
    type: "function",
    inputs: [
      { name: "_dstChainId", type: "uint16" },
      { name: "_functionType", type: "uint8" },
      { name: "_toAddress", type: "bytes" },
      { name: "_transferAndCallPayload", type: "bytes" },
      { name: "_lzTxParams", type: "tuple" }
    ],
    outputs: [
      { name: "nativeFee", type: "uint256" },
      { name: "zroFee", type: "uint256" }
    ]
  }
] as const

export function registerBridgeTools(server: McpServer) {
  // Get bridge quote
  server.tool(
    "get_bridge_quote",
    "Get a quote for bridging tokens across chains",
    {
      token: z.string().describe("Token address to bridge"),
      amount: z.string().describe("Amount to bridge (in wei)"),
      sourceChain: z.string().describe("Source chain (e.g., 'ethereum', 'bsc')"),
      destChain: z.string().describe("Destination chain"),
      bridge: z.string().optional().describe("Specific bridge to use (stargate, layerzero, wormhole, across)")
    },
    async ({ token, amount, sourceChain, destChain, bridge }) => {
      try {
        const sourceChainId = Object.entries(CHAIN_NAMES).find(([_, name]) => name === sourceChain)?.[0]
        const destChainId = Object.entries(CHAIN_NAMES).find(([_, name]) => name === destChain)?.[0]
        
        if (!sourceChainId || !destChainId) {
          return mcpToolRes.error(new Error("Invalid chain name"), "getting bridge quote")
        }

        // Get quotes from available bridges
        const quotes: Array<{
          bridge: string
          estimatedOutput: string
          fee: string
          estimatedTime: string
          supported: boolean
        }> = []

        for (const [bridgeName, config] of Object.entries(BRIDGE_CONFIGS)) {
          if (bridge && bridge !== bridgeName) continue
          
          const isSupported = config.supportedChains.includes(Number(sourceChainId)) && 
                             config.supportedChains.includes(Number(destChainId))
          
          if (isSupported) {
            // Simplified fee calculation (actual would query contracts)
            const fee = (BigInt(amount) * BigInt(3)) / BigInt(1000) // 0.3% fee estimate
            
            quotes.push({
              bridge: config.name,
              estimatedOutput: (BigInt(amount) - fee).toString(),
              fee: fee.toString(),
              estimatedTime: config.estimateTime,
              supported: true
            })
          }
        }

        // Sort by best output
        quotes.sort((a, b) => BigInt(b.estimatedOutput) > BigInt(a.estimatedOutput) ? 1 : -1)

        return mcpToolRes.success({
          token,
          amount,
          sourceChain,
          destChain,
          quotes,
          bestBridge: quotes[0]?.bridge || null,
          warning: quotes.length === 0 ? "No bridges support this route" : null
        })
      } catch (error) {
        return mcpToolRes.error(error, "getting bridge quote")
      }
    }
  )

  // Execute bridge transfer
  server.tool(
    "execute_bridge",
    "Execute a cross-chain bridge transfer",
    {
      token: z.string().describe("Token address to bridge"),
      amount: z.string().describe("Amount to bridge (in wei)"),
      sourceChain: defaultNetworkParam,
      destChain: z.string().describe("Destination chain"),
      bridge: z.string().describe("Bridge to use (stargate, layerzero, wormhole, across)"),
      privateKey: privateKeyParam,
      recipient: z.string().optional().describe("Recipient address on destination chain (defaults to sender)")
    },
    async ({ token, amount, sourceChain, destChain, bridge, privateKey, recipient }) => {
      try {
        const account = privateKeyToAccount(privateKey as Hex)
        const walletClient = getWalletClient(privateKey as Hex, sourceChain)
        const publicClient = getPublicClient(sourceChain)
        
        const bridgeConfig = BRIDGE_CONFIGS[bridge.toLowerCase()]
        if (!bridgeConfig) {
          return mcpToolRes.error(new Error(`Bridge ${bridge} not supported`), "executing bridge")
        }

        const chainId = await publicClient.getChainId()
        const bridgeAddress = bridgeConfig.contractAddresses[chainId]
        
        if (!bridgeAddress) {
          return mcpToolRes.error(new Error(`Bridge ${bridge} not available on ${sourceChain}`), "executing bridge")
        }

        const recipientAddress = recipient || account.address

        // Note: Actual bridge execution would require proper encoding per bridge protocol
        // This is a simplified representation
        return mcpToolRes.success({
          status: "pending",
          message: `Bridge transaction prepared via ${bridgeConfig.name}`,
          details: {
            token,
            amount,
            sourceChain,
            destChain,
            bridge: bridgeConfig.name,
            bridgeContract: bridgeAddress,
            recipient: recipientAddress,
            estimatedTime: bridgeConfig.estimateTime
          },
          note: "Actual execution requires bridge-specific transaction encoding"
        })
      } catch (error) {
        return mcpToolRes.error(error, "executing bridge")
      }
    }
  )

  // Get bridge transaction status
  server.tool(
    "get_bridge_status",
    "Track the status of a bridge transaction",
    {
      txHash: z.string().describe("Source chain transaction hash"),
      sourceChain: defaultNetworkParam,
      bridge: z.string().describe("Bridge protocol used")
    },
    async ({ txHash, sourceChain, bridge }) => {
      try {
        const publicClient = getPublicClient(sourceChain)
        
        // Get source transaction
        const receipt = await publicClient.getTransactionReceipt({ hash: txHash as Hex })
        
        return mcpToolRes.success({
          txHash,
          sourceChain,
          bridge,
          sourceStatus: receipt.status === "success" ? "confirmed" : "failed",
          sourceBlockNumber: receipt.blockNumber.toString(),
          sourceConfirmations: "confirmed",
          destinationStatus: "pending", // Would need bridge-specific API to track
          estimatedCompletion: BRIDGE_CONFIGS[bridge.toLowerCase()]?.estimateTime || "unknown",
          note: "For detailed destination status, check the respective bridge explorer"
        })
      } catch (error) {
        return mcpToolRes.error(error, "getting bridge status")
      }
    }
  )

  // Get supported bridges
  server.tool(
    "get_supported_bridges",
    "List all supported bridge protocols and their capabilities",
    {
      sourceChain: z.string().optional().describe("Filter by source chain support"),
      destChain: z.string().optional().describe("Filter by destination chain support")
    },
    async ({ sourceChain, destChain }) => {
      try {
        const sourceChainId = sourceChain ? 
          Object.entries(CHAIN_NAMES).find(([_, name]) => name === sourceChain)?.[0] : null
        const destChainId = destChain ?
          Object.entries(CHAIN_NAMES).find(([_, name]) => name === destChain)?.[0] : null

        const bridges = Object.entries(BRIDGE_CONFIGS).map(([key, config]) => {
          const supportedChainNames = config.supportedChains.map(id => CHAIN_NAMES[id] || `Chain ${id}`)
          
          let supported = true
          if (sourceChainId && !config.supportedChains.includes(Number(sourceChainId))) supported = false
          if (destChainId && !config.supportedChains.includes(Number(destChainId))) supported = false

          return {
            id: key,
            name: config.name,
            supportedChains: supportedChainNames,
            estimatedTime: config.estimateTime,
            supportsRoute: supported
          }
        })

        return mcpToolRes.success({
          bridges: sourceChain || destChain ? bridges.filter(b => b.supportsRoute) : bridges,
          totalCount: bridges.length,
          filteredBy: { sourceChain, destChain }
        })
      } catch (error) {
        return mcpToolRes.error(error, "getting supported bridges")
      }
    }
  )

  // Estimate bridge time
  server.tool(
    "estimate_bridge_time",
    "Estimate how long a bridge transfer will take",
    {
      sourceChain: z.string().describe("Source chain"),
      destChain: z.string().describe("Destination chain"),
      bridge: z.string().optional().describe("Specific bridge (returns all if not specified)")
    },
    async ({ sourceChain, destChain, bridge }) => {
      try {
        const estimates: Array<{ bridge: string; estimatedTime: string; factors: string[] }> = []

        for (const [key, config] of Object.entries(BRIDGE_CONFIGS)) {
          if (bridge && key !== bridge.toLowerCase()) continue
          
          estimates.push({
            bridge: config.name,
            estimatedTime: config.estimateTime,
            factors: [
              "Source chain finality",
              "Bridge protocol verification",
              "Destination chain confirmation"
            ]
          })
        }

        return mcpToolRes.success({
          sourceChain,
          destChain,
          estimates,
          note: "Times vary based on network congestion and bridge-specific requirements"
        })
      } catch (error) {
        return mcpToolRes.error(error, "estimating bridge time")
      }
    }
  )

  // Get bridge fees breakdown
  server.tool(
    "get_bridge_fees",
    "Get detailed fee breakdown for a bridge transfer",
    {
      token: z.string().describe("Token to bridge"),
      amount: z.string().describe("Amount in wei"),
      sourceChain: z.string().describe("Source chain"),
      destChain: z.string().describe("Destination chain"),
      bridge: z.string().describe("Bridge protocol")
    },
    async ({ token, amount, sourceChain, destChain, bridge }) => {
      try {
        const bridgeConfig = BRIDGE_CONFIGS[bridge.toLowerCase()]
        if (!bridgeConfig) {
          return mcpToolRes.error(new Error(`Bridge ${bridge} not found`), "getting bridge fees")
        }

        // Simplified fee calculation
        const protocolFee = (BigInt(amount) * BigInt(3)) / BigInt(1000) // 0.3%
        const lpFee = (BigInt(amount) * BigInt(1)) / BigInt(1000) // 0.1%
        const gasEstimate = "0.01" // Native token

        return mcpToolRes.success({
          bridge: bridgeConfig.name,
          token,
          amount,
          sourceChain,
          destChain,
          fees: {
            protocolFee: protocolFee.toString(),
            protocolFeePercent: "0.3%",
            lpFee: lpFee.toString(),
            lpFeePercent: "0.1%",
            estimatedGas: gasEstimate,
            totalFees: (protocolFee + lpFee).toString()
          },
          netAmount: (BigInt(amount) - protocolFee - lpFee).toString(),
          note: "Actual fees may vary based on current liquidity and gas prices"
        })
      } catch (error) {
        return mcpToolRes.error(error, "getting bridge fees")
      }
    }
  )
}
