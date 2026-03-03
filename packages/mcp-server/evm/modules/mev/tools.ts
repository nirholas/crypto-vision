/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { Address, Hex, Hash } from "viem"
import {
  parseEther,
  formatEther,
  encodeFunctionData,
  parseAbi,
  keccak256,
  toHex,
  concat,
  numberToHex,
  hexToBigInt,
  createPublicClient,
  http
} from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { mainnet, arbitrum, polygon, optimism, base } from "viem/chains"
import { z } from "zod"

import { getPublicClient, getWalletClient } from "@/evm/services/clients.js"
import { mcpToolRes } from "@/utils/helper.js"
import { defaultNetworkParam } from "../common/types.js"

// Flashbots RPC endpoints
const FLASHBOTS_RPC: Record<number, string> = {
  1: "https://rpc.flashbots.net",
  5: "https://rpc-goerli.flashbots.net",
  11155111: "https://rpc-sepolia.flashbots.net"
}

// Flashbots Protect RPC (for MEV protection)
const FLASHBOTS_PROTECT_RPC: Record<number, string> = {
  1: "https://rpc.flashbots.net",
  5: "https://rpc-goerli.flashbots.net",
  11155111: "https://rpc-sepolia.flashbots.net"
}

// MEV Blocker/Protect alternatives
const MEV_PROTECT_RPC: Record<number, Record<string, string>> = {
  1: {
    flashbots: "https://rpc.flashbots.net",
    mevBlocker: "https://rpc.mevblocker.io",
    securerpc: "https://api.securerpc.com/v1",
    builder0x69: "https://builder0x69.io"
  },
  137: {
    bloxroute: "https://polygon.rpc.blxrbdn.com"
  },
  42161: {
    arbitrum: "https://arb1.arbitrum.io/rpc" // Arbitrum has built-in fair ordering
  }
}

// Common DEX router addresses for MEV analysis
const DEX_ROUTERS: Record<number, Record<string, Address>> = {
  1: {
    uniswapV2: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
    uniswapV3: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
    sushiswap: "0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F",
    oneInch: "0x1111111254EEB25477B68fb85Ed929f73A960582"
  },
  56: {
    pancakeswapV2: "0x10ED43C718714eb63d5aA57B78B54704E256024E",
    pancakeswapV3: "0x13f4EA83D0bd40E75C8222255bc855a974568Dd4"
  },
  42161: {
    uniswapV3: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
    camelot: "0xc873fEcbd354f5A56E00E710B90EF4201db2448d",
    sushiswap: "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506"
  }
}

// Known MEV bot patterns
const MEV_BOT_PATTERNS = {
  sandwichAttack: "Multiple transactions bracketing a user swap",
  frontrun: "Transaction with same method ahead of user in block",
  backrun: "Transaction immediately following user transaction",
  jitLiquidity: "Just-in-time liquidity provision/removal"
}

// Swap function selectors for analysis
const SWAP_SELECTORS: Record<string, string> = {
  "0x38ed1739": "swapExactTokensForTokens",
  "0x7ff36ab5": "swapExactETHForTokens",
  "0x18cbafe5": "swapExactTokensForETH",
  "0x8803dbee": "swapTokensForExactTokens",
  "0xfb3bdb41": "swapETHForExactTokens",
  "0x4a25d94a": "swapTokensForExactETH",
  "0x5c11d795": "swapExactTokensForTokensSupportingFeeOnTransferTokens",
  "0xb6f9de95": "swapExactETHForTokensSupportingFeeOnTransferTokens",
  "0x791ac947": "swapExactTokensForETHSupportingFeeOnTransferTokens"
}

export function registerMEVTools(server: McpServer) {
  // Send private transaction via Flashbots Protect
  server.tool(
    "send_private_transaction",
    "Send a transaction via Flashbots Protect RPC to avoid MEV extraction (frontrunning, sandwich attacks)",
    {
      network: defaultNetworkParam,
      to: z.string().describe("Recipient address"),
      value: z.string().optional().describe("ETH value to send (in ether)"),
      data: z.string().optional().describe("Transaction data (hex)"),
      maxFeePerGas: z.string().optional().describe("Max fee per gas (in gwei)"),
      maxPriorityFeePerGas: z.string().optional().describe("Max priority fee per gas (in gwei)"),
      gasLimit: z.string().optional().describe("Gas limit"),
      privateKey: z.string().describe("Private key for signing").default(process.env.PRIVATE_KEY as string),
      protectionProvider: z.enum(["flashbots", "mevBlocker", "securerpc"]).optional().default("flashbots").describe("MEV protection provider")
    },
    async ({ network, to, value, data, maxFeePerGas, maxPriorityFeePerGas, gasLimit, privateKey, protectionProvider = "flashbots" }) => {
      try {
        const publicClient = getPublicClient(network)
        const chainId = await publicClient.getChainId()
        
        // Get appropriate MEV protection RPC
        const protectRpcs = MEV_PROTECT_RPC[chainId]
        if (!protectRpcs) {
          return mcpToolRes.success({
            network,
            mevProtectionAvailable: false,
            note: `MEV protection RPCs not configured for chain ${chainId}. Transaction will be sent via public mempool.`,
            recommendation: "Consider using a chain with MEV protection or accept potential MEV exposure"
          })
        }

        const protectRpc = protectRpcs[protectionProvider] || protectRpcs.flashbots || Object.values(protectRpcs)[0]
        
        // Create account from private key
        const account = privateKeyToAccount(privateKey as Hex)

        // Get chain config for viem
        const chainConfigs: Record<number, any> = {
          1: mainnet,
          42161: arbitrum,
          137: polygon,
          10: optimism,
          8453: base
        }

        const chain = chainConfigs[chainId] || mainnet

        // Create client with MEV protect RPC
        const protectedClient = createPublicClient({
          chain,
          transport: http(protectRpc)
        })

        // Get current gas prices if not provided
        let gasPrice
        try {
          gasPrice = await publicClient.getGasPrice()
        } catch {
          gasPrice = parseEther("0.00000002") // 20 gwei fallback
        }

        // Get nonce
        const nonce = await publicClient.getTransactionCount({ address: account.address })

        // Estimate gas if not provided
        let gas: bigint
        if (gasLimit) {
          gas = BigInt(gasLimit)
        } else {
          gas = await publicClient.estimateGas({
            account: account.address,
            to: to as Address,
            value: value ? parseEther(value) : 0n,
            data: data as Hex | undefined
          }).catch(() => 21000n)
          // Add buffer
          gas = (gas * 120n) / 100n
        }

        // Prepare transaction
        const txParams = {
          to: to as Address,
          value: value ? parseEther(value) : 0n,
          data: data as Hex | undefined,
          gas,
          nonce,
          maxFeePerGas: maxFeePerGas ? parseEther(maxFeePerGas) / 1000000000n : gasPrice * 2n,
          maxPriorityFeePerGas: maxPriorityFeePerGas ? parseEther(maxPriorityFeePerGas) / 1000000000n : parseEther("0.000000002"), // 2 gwei
          chainId
        }

        // Sign transaction
        const signedTx = await account.signTransaction(txParams)

        // Send via MEV-protected RPC using fetch
        const response = await fetch(protectRpc, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            method: "eth_sendRawTransaction",
            params: [signedTx],
            id: 1
          })
        })

        const result = await response.json()

        if (result.error) {
          return mcpToolRes.error(new Error(result.error.message), "sending private transaction")
        }

        const txHash = result.result as Hash

        // Wait for confirmation (with timeout)
        let receipt = null
        let attempts = 0
        while (!receipt && attempts < 30) {
          await new Promise(resolve => setTimeout(resolve, 2000))
          try {
            receipt = await publicClient.getTransactionReceipt({ hash: txHash })
          } catch {
            // Not mined yet
          }
          attempts++
        }

        return mcpToolRes.success({
          network,
          transactionHash: txHash,
          mevProtection: {
            enabled: true,
            provider: protectionProvider,
            rpc: protectRpc
          },
          transaction: {
            from: account.address,
            to,
            value: value || "0",
            gas: gas.toString(),
            nonce
          },
          status: receipt ? (receipt.status === "success" ? "confirmed" : "reverted") : "pending",
          blockNumber: receipt?.blockNumber?.toString() || null,
          gasUsed: receipt?.gasUsed?.toString() || null,
          note: "Transaction sent via MEV-protected RPC. Not visible in public mempool until mined."
        })
      } catch (error) {
        return mcpToolRes.error(error, "sending private transaction")
      }
    }
  )

  // Simulate transaction bundle
  server.tool(
    "simulate_bundle",
    "Simulate a bundle of transactions to check execution and returns",
    {
      network: defaultNetworkParam,
      transactions: z.array(z.object({
        to: z.string().describe("Recipient address"),
        value: z.string().optional().describe("ETH value (in wei)"),
        data: z.string().optional().describe("Calldata (hex)"),
        gasLimit: z.string().optional().describe("Gas limit")
      })).describe("Array of transactions to simulate"),
      blockNumber: z.string().optional().describe("Block number to simulate at (default: latest)"),
      privateKey: z.string().describe("Private key for simulation").default(process.env.PRIVATE_KEY as string)
    },
    async ({ network, transactions, blockNumber, privateKey }) => {
      try {
        const publicClient = getPublicClient(network)
        const chainId = await publicClient.getChainId()
        
        // Get current block if not specified
        const targetBlock = blockNumber 
          ? BigInt(blockNumber) 
          : await publicClient.getBlockNumber()

        const account = privateKeyToAccount(privateKey as Hex)
        let currentNonce = await publicClient.getTransactionCount({ address: account.address })

        const simulationResults: Array<{
          index: number
          to: string
          success: boolean
          gasUsed: string | null
          returnData: string | null
          error: string | null
        }> = []

        let totalGasUsed = 0n
        let allSuccessful = true

        // Simulate each transaction
        for (let i = 0; i < transactions.length; i++) {
          const tx = transactions[i]
          
          try {
            // Estimate gas (this also validates the tx would succeed)
            const gasEstimate = await publicClient.estimateGas({
              account: account.address,
              to: tx.to as Address,
              value: tx.value ? BigInt(tx.value) : 0n,
              data: tx.data as Hex | undefined
            })

            // Simulate call to get return data
            const callResult = await publicClient.call({
              account: account.address,
              to: tx.to as Address,
              value: tx.value ? BigInt(tx.value) : 0n,
              data: tx.data as Hex | undefined
            })

            simulationResults.push({
              index: i,
              to: tx.to,
              success: true,
              gasUsed: gasEstimate.toString(),
              returnData: callResult.data || null,
              error: null
            })

            totalGasUsed += gasEstimate
            currentNonce++
          } catch (error: any) {
            allSuccessful = false
            simulationResults.push({
              index: i,
              to: tx.to,
              success: false,
              gasUsed: null,
              returnData: null,
              error: error.message?.slice(0, 200) || "Simulation failed"
            })
          }
        }

        // Get current gas price for cost estimation
        const gasPrice = await publicClient.getGasPrice()
        const estimatedCost = totalGasUsed * gasPrice

        return mcpToolRes.success({
          network,
          simulation: {
            blockNumber: targetBlock.toString(),
            transactionCount: transactions.length,
            allSuccessful,
            successCount: simulationResults.filter(r => r.success).length,
            failedCount: simulationResults.filter(r => !r.success).length
          },
          results: simulationResults,
          gasEstimate: {
            totalGas: totalGasUsed.toString(),
            gasPrice: gasPrice.toString(),
            estimatedCostWei: estimatedCost.toString(),
            estimatedCostEth: formatEther(estimatedCost)
          },
          recommendation: allSuccessful
            ? "Bundle simulation successful. All transactions expected to succeed."
            : "Bundle contains failing transactions. Review and fix before submission."
        })
      } catch (error) {
        return mcpToolRes.error(error, "simulating bundle")
      }
    }
  )

  // Check MEV exposure for a transaction
  server.tool(
    "check_mev_exposure",
    "Analyze a pending or proposed transaction for MEV exposure (sandwich attack, frontrunning risk)",
    {
      network: defaultNetworkParam,
      to: z.string().describe("Target contract address"),
      data: z.string().describe("Transaction calldata (hex)"),
      value: z.string().optional().describe("ETH value (in wei)"),
      slippageTolerance: z.number().optional().describe("Slippage tolerance percentage (e.g., 0.5 for 0.5%)")
    },
    async ({ network, to, data, value, slippageTolerance }) => {
      try {
        const publicClient = getPublicClient(network)
        const chainId = await publicClient.getChainId()
        
        const mevRisks: Array<{
          type: string
          severity: "high" | "medium" | "low"
          description: string
          mitigation: string
        }> = []

        // Extract function selector
        const selector = data.slice(0, 10).toLowerCase()
        const isSwap = Object.keys(SWAP_SELECTORS).includes(selector)
        const swapFunction = SWAP_SELECTORS[selector]

        // Check if target is a known DEX router
        const dexRouters = DEX_ROUTERS[chainId] || {}
        const targetRouter = Object.entries(dexRouters).find(
          ([_, addr]) => addr.toLowerCase() === to.toLowerCase()
        )
        const isDexSwap = !!targetRouter

        // Risk analysis
        if (isDexSwap || isSwap) {
          // High-value swaps are more attractive for MEV
          const txValue = value ? BigInt(value) : 0n
          
          // Check slippage
          if (slippageTolerance && slippageTolerance > 1) {
            mevRisks.push({
              type: "High Slippage",
              severity: "high",
              description: `Slippage tolerance of ${slippageTolerance}% makes sandwich attacks profitable`,
              mitigation: "Reduce slippage tolerance to 0.5% or less for standard swaps"
            })
          }

          // Swap-specific risks
          mevRisks.push({
            type: "Sandwich Attack Risk",
            severity: slippageTolerance && slippageTolerance > 0.5 ? "high" : "medium",
            description: "DEX swaps in public mempool are visible to MEV bots",
            mitigation: "Use MEV protection (send_private_transaction) or reduce slippage"
          })

          // Check for "supporting fee on transfer" functions (more complex, higher MEV)
          if (swapFunction?.includes("SupportingFeeOnTransferTokens")) {
            mevRisks.push({
              type: "Fee-on-transfer Token",
              severity: "medium",
              description: "Fee-on-transfer tokens have complex pricing, easier to exploit",
              mitigation: "Use exact output swaps or set very tight slippage"
            })
          }

          // Large value swaps
          if (txValue > parseEther("1")) {
            mevRisks.push({
              type: "High Value Transaction",
              severity: "high",
              description: `Large value (${formatEther(txValue)} ETH) increases MEV incentive`,
              mitigation: "Consider splitting into smaller transactions or use private transaction"
            })
          }
        }

        // Check for approval transactions (usually safe but could be exploited)
        if (selector === "0x095ea7b3") { // approve
          mevRisks.push({
            type: "Approval Transaction",
            severity: "low",
            description: "Approval transactions are generally safe from MEV",
            mitigation: "No action needed, but verify you're approving the correct spender"
          })
        }

        // Check for transfer/transferFrom
        if (selector === "0xa9059cbb" || selector === "0x23b872dd") {
          mevRisks.push({
            type: "Token Transfer",
            severity: "low",
            description: "Simple transfers have low MEV exposure",
            mitigation: "Generally safe, but high-value transfers may attract attention"
          })
        }

        // Check for liquidation-type transactions
        const liquidationSelectors = ["0x7f7c9a8c", "0x00000003"] // Common liquidation selectors
        if (liquidationSelectors.some(s => selector.startsWith(s.slice(0, 6)))) {
          mevRisks.push({
            type: "Liquidation Transaction",
            severity: "high",
            description: "Liquidations are highly competitive MEV opportunities",
            mitigation: "Use Flashbots or private orderflow to protect profit"
          })
        }

        // Calculate overall risk score
        const riskScore = mevRisks.reduce((score, risk) => {
          if (risk.severity === "high") return score + 40
          if (risk.severity === "medium") return score + 20
          return score + 5
        }, 0)

        const normalizedScore = Math.min(riskScore, 100)

        // Get MEV protection options
        const protectionOptions = MEV_PROTECT_RPC[chainId] 
          ? Object.keys(MEV_PROTECT_RPC[chainId])
          : []

        return mcpToolRes.success({
          network,
          analysis: {
            targetContract: to,
            functionSelector: selector,
            identifiedFunction: swapFunction || "Unknown",
            isDexSwap,
            targetDex: targetRouter ? targetRouter[0] : null
          },
          mevExposure: {
            score: normalizedScore,
            level: normalizedScore >= 60 ? "high" : normalizedScore >= 30 ? "medium" : "low",
            risks: mevRisks
          },
          protection: {
            available: protectionOptions.length > 0,
            providers: protectionOptions,
            recommendation: normalizedScore >= 30
              ? "Use send_private_transaction for MEV protection"
              : "Standard transaction likely safe, but private submission recommended for high-value operations"
          },
          tips: [
            "Lower slippage = less MEV exposure",
            "Private transactions avoid the public mempool",
            "Split large swaps into smaller amounts",
            "Use limit orders instead of market swaps when possible"
          ]
        })
      } catch (error) {
        return mcpToolRes.error(error, "checking MEV exposure")
      }
    }
  )

  // Get MEV protection status
  server.tool(
    "get_mev_protection_info",
    "Get information about available MEV protection options for a network",
    {
      network: defaultNetworkParam
    },
    async ({ network }) => {
      try {
        const publicClient = getPublicClient(network)
        const chainId = await publicClient.getChainId()

        const flashbotsRpc = FLASHBOTS_RPC[chainId]
        const protectRpcs = MEV_PROTECT_RPC[chainId]
        const dexRouters = DEX_ROUTERS[chainId]

        return mcpToolRes.success({
          network,
          chainId,
          mevProtection: {
            flashbotsAvailable: !!flashbotsRpc,
            flashbotsRpc: flashbotsRpc || null,
            protectProviders: protectRpcs ? Object.entries(protectRpcs).map(([name, url]) => ({
              name,
              url,
              description: name === "flashbots" ? "Flashbots Protect - sends to block builders directly"
                : name === "mevBlocker" ? "MEV Blocker - aggregates multiple builders"
                : name === "securerpc" ? "SecureRPC - private transaction relay"
                : "MEV protection service"
            })) : [],
            chainHasBuiltInProtection: chainId === 42161, // Arbitrum has fair ordering
            note: chainId === 42161 
              ? "Arbitrum has built-in fair transaction ordering (no MEV by design)"
              : chainId === 1
              ? "Ethereum mainnet - use MEV protection for swaps and liquidations"
              : "Check available protection providers for this chain"
          },
          dexRouters: dexRouters ? Object.entries(dexRouters).map(([name, address]) => ({
            name,
            address
          })) : [],
          recommendations: [
            "Always use MEV protection for large swaps (>$1000)",
            "Set slippage tolerance as low as possible",
            "Consider time-weighted average price (TWAP) orders for very large trades",
            "Monitor transaction for unexpected reverts or poor execution"
          ]
        })
      } catch (error) {
        return mcpToolRes.error(error, "getting MEV protection info")
      }
    }
  )
}
