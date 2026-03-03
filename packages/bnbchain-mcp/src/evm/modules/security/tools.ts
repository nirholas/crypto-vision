import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { Address, Hex } from "viem"
import { decodeFunctionData, parseAbi } from "viem"
import { z } from "zod"

import { getPublicClient } from "@/evm/services/clients.js"
import { mcpToolRes } from "@/utils/helper.js"
import { defaultNetworkParam } from "../common/types.js"

// Known malicious addresses (example - would be updated from external sources)
const KNOWN_SCAM_ADDRESSES = new Set([
  // These would be populated from security APIs
])

// Known scam patterns in contract bytecode
const SCAM_PATTERNS = [
  { pattern: "99% tax", risk: "high", description: "Honeypot with extreme sell tax" },
  { pattern: "hidden owner", risk: "high", description: "Owner functions accessible by deployer" },
  { pattern: "pause trading", risk: "medium", description: "Owner can pause all transfers" },
  { pattern: "blacklist", risk: "medium", description: "Owner can blacklist addresses" },
  { pattern: "mint unlimited", risk: "high", description: "Unlimited minting capability" },
  { pattern: "proxy unverified", risk: "medium", description: "Unverified proxy implementation" }
]

// Common approval spenders to check
const COMMON_SPENDERS: Record<number, Record<string, Address>> = {
  1: { // Ethereum
    "Uniswap V2": "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
    "Uniswap V3": "0xE592427A0AEce92De3Edee1F18E0157C05861564",
    "1inch": "0x1111111254fb6c44bAC0beD2854e76F90643097d"
  },
  56: { // BSC
    "PancakeSwap V2": "0x10ED43C718714eb63d5aA57B78B54704E256024E",
    "PancakeSwap V3": "0x13f4EA83D0bd40E75C8222255bc855a974568Dd4"
  },
  42161: { // Arbitrum
    "Uniswap V3": "0xE592427A0AEce92De3Edee1F18E0157C05861564",
    "Camelot": "0xc873fEcbd354f5A56E00E710B90EF4201db2448d"
  }
}

// ERC20 ABI for security checks
const ERC20_SECURITY_ABI = parseAbi([
  "function owner() view returns (address)",
  "function paused() view returns (bool)",
  "function _taxFee() view returns (uint256)",
  "function _liquidityFee() view returns (uint256)",
  "function isBlacklisted(address) view returns (bool)",
  "function allowance(address,address) view returns (uint256)"
])

export function registerSecurityTools(server: McpServer) {
  // Analyze token contract for risks
  server.tool(
    "analyze_token_security",
    "Analyze a token contract for security risks and red flags",
    {
      network: defaultNetworkParam,
      tokenAddress: z.string().describe("Token contract address to analyze")
    },
    async ({ network, tokenAddress }) => {
      try {
        const publicClient = getPublicClient(network)
        
        const risks: Array<{ type: string; severity: string; description: string }> = []
        const details: Record<string, unknown> = {}

        // Get contract code
        const code = await publicClient.getCode({ address: tokenAddress as Address })
        
        if (!code || code === "0x") {
          return mcpToolRes.error(new Error("No contract at this address"), "analyzing token")
        }

        details.hasCode = true
        details.codeSize = code.length

        // Check for common risky functions
        try {
          const owner = await publicClient.readContract({
            address: tokenAddress as Address,
            abi: ERC20_SECURITY_ABI,
            functionName: "owner"
          })
          details.owner = owner
          
          if (owner !== "0x0000000000000000000000000000000000000000") {
            risks.push({
              type: "centralization",
              severity: "medium",
              description: `Contract has an owner: ${owner}`
            })
          }
        } catch {
          details.owner = "No owner function or renounced"
        }

        // Check if paused
        try {
          const paused = await publicClient.readContract({
            address: tokenAddress as Address,
            abi: ERC20_SECURITY_ABI,
            functionName: "paused"
          })
          if (paused) {
            risks.push({
              type: "pausable",
              severity: "high",
              description: "Token transfers are currently paused"
            })
          }
          details.pausable = true
        } catch {
          details.pausable = false
        }

        // Check for tax functions
        try {
          const taxFee = await publicClient.readContract({
            address: tokenAddress as Address,
            abi: ERC20_SECURITY_ABI,
            functionName: "_taxFee"
          })
          details.taxFee = Number(taxFee)
          if (Number(taxFee) > 10) {
            risks.push({
              type: "high_tax",
              severity: "high",
              description: `High tax fee detected: ${taxFee}%`
            })
          }
        } catch {
          // No tax function
        }

        // Calculate risk score
        const riskScore = risks.reduce((score, risk) => {
          if (risk.severity === "high") return score + 30
          if (risk.severity === "medium") return score + 15
          return score + 5
        }, 0)

        return mcpToolRes.success({
          network,
          tokenAddress,
          riskScore: Math.min(riskScore, 100),
          riskLevel: riskScore >= 60 ? "high" : riskScore >= 30 ? "medium" : "low",
          risks,
          details,
          recommendation: riskScore >= 60 
            ? "HIGH RISK - Avoid interacting with this token"
            : riskScore >= 30
            ? "MEDIUM RISK - Proceed with caution"
            : "LOW RISK - Standard token contract"
        })
      } catch (error) {
        return mcpToolRes.error(error, "analyzing token security")
      }
    }
  )

  // Check approval risks
  server.tool(
    "check_approval_risks",
    "Check token approvals for a wallet and identify risky unlimited approvals",
    {
      network: defaultNetworkParam,
      walletAddress: z.string().describe("Wallet address to check"),
      tokenAddresses: z.array(z.string()).optional().describe("Specific tokens to check")
    },
    async ({ network, walletAddress, tokenAddresses }) => {
      try {
        const publicClient = getPublicClient(network)
        const chainId = await publicClient.getChainId()
        
        const spenders = COMMON_SPENDERS[chainId] || {}
        const riskyApprovals: Array<{
          token: string
          spender: string
          spenderName: string
          allowance: string
          risk: string
        }> = []

        // If no specific tokens, we can't check (would need indexer)
        if (!tokenAddresses || tokenAddresses.length === 0) {
          return mcpToolRes.success({
            network,
            walletAddress,
            message: "Provide specific token addresses to check approvals",
            commonSpenders: Object.entries(spenders).map(([name, addr]) => ({ name, address: addr }))
          })
        }

        for (const token of tokenAddresses) {
          for (const [spenderName, spenderAddr] of Object.entries(spenders)) {
            try {
              const allowance = await publicClient.readContract({
                address: token as Address,
                abi: ERC20_SECURITY_ABI,
                functionName: "allowance",
                args: [walletAddress as Address, spenderAddr]
              })
              
              if (allowance > 0n) {
                const isUnlimited = allowance >= BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff") / 2n
                
                riskyApprovals.push({
                  token,
                  spender: spenderAddr,
                  spenderName,
                  allowance: allowance.toString(),
                  risk: isUnlimited ? "unlimited" : "limited"
                })
              }
            } catch {
              // Skip if allowance check fails
            }
          }
        }

        const unlimitedCount = riskyApprovals.filter(a => a.risk === "unlimited").length

        return mcpToolRes.success({
          network,
          walletAddress,
          totalApprovals: riskyApprovals.length,
          unlimitedApprovals: unlimitedCount,
          riskLevel: unlimitedCount > 5 ? "high" : unlimitedCount > 0 ? "medium" : "low",
          approvals: riskyApprovals,
          recommendation: unlimitedCount > 0 
            ? "Consider revoking unlimited approvals for tokens you no longer use"
            : "No concerning approvals found"
        })
      } catch (error) {
        return mcpToolRes.error(error, "checking approval risks")
      }
    }
  )

  // Check contract verification status
  server.tool(
    "check_contract_verification",
    "Check if a contract is verified and get basic verification status",
    {
      network: defaultNetworkParam,
      contractAddress: z.string().describe("Contract address to verify")
    },
    async ({ network, contractAddress }) => {
      try {
        const publicClient = getPublicClient(network)
        
        // Get bytecode
        const code = await publicClient.getCode({ address: contractAddress as Address })
        
        if (!code || code === "0x") {
          return mcpToolRes.success({
            network,
            contractAddress,
            hasCode: false,
            isContract: false,
            note: "Address is not a contract (EOA or empty)"
          })
        }

        // Check for proxy patterns
        const isProxy = code.includes("363d3d373d3d3d363d") || // EIP-1167 minimal proxy
                       code.includes("5860208158601c335a63") // UUPS proxy pattern

        return mcpToolRes.success({
          network,
          contractAddress,
          hasCode: true,
          isContract: true,
          codeSize: code.length,
          isProxy,
          note: isProxy 
            ? "This appears to be a proxy contract - verify the implementation"
            : "Contract has bytecode - verify on block explorer for source code",
          explorerUrl: `https://etherscan.io/address/${contractAddress}#code`
        })
      } catch (error) {
        return mcpToolRes.error(error, "verifying contract")
      }
    }
  )

  // Simulate transaction
  server.tool(
    "simulate_transaction",
    "Simulate a transaction to check for potential issues before execution",
    {
      network: defaultNetworkParam,
      from: z.string().describe("Sender address"),
      to: z.string().describe("Target contract/address"),
      value: z.string().optional().describe("Value in wei"),
      data: z.string().optional().describe("Transaction data (hex)")
    },
    async ({ network, from, to, value, data }) => {
      try {
        const publicClient = getPublicClient(network)
        
        // Simulate the call
        const result = await publicClient.call({
          account: from as Address,
          to: to as Address,
          value: value ? BigInt(value) : 0n,
          data: data as Hex | undefined
        })

        // Estimate gas
        let gasEstimate: bigint | null = null
        try {
          gasEstimate = await publicClient.estimateGas({
            account: from as Address,
            to: to as Address,
            value: value ? BigInt(value) : 0n,
            data: data as Hex | undefined
          })
        } catch {
          // Gas estimation failed
        }

        return mcpToolRes.success({
          network,
          simulation: "success",
          result: result.data || "0x",
          gasEstimate: gasEstimate?.toString() || "estimation failed",
          warnings: [],
          safe: true
        })
      } catch (error: any) {
        // Parse revert reason
        let revertReason = "Unknown error"
        if (error.message) {
          revertReason = error.message
        }

        return mcpToolRes.success({
          network,
          simulation: "failed",
          error: revertReason,
          warnings: ["Transaction would revert"],
          safe: false,
          recommendation: "Do not proceed - transaction will fail"
        })
      }
    }
  )

  // Check address type
  server.tool(
    "check_address_type",
    "Determine if an address is a contract, EOA, or known entity",
    {
      network: defaultNetworkParam,
      address: z.string().describe("Address to check")
    },
    async ({ network, address }) => {
      try {
        const publicClient = getPublicClient(network)
        
        const code = await publicClient.getCode({ address: address as Address })
        const balance = await publicClient.getBalance({ address: address as Address })
        const nonce = await publicClient.getTransactionCount({ address: address as Address })

        const isContract = code && code !== "0x" && code.length > 2

        return mcpToolRes.success({
          network,
          address,
          type: isContract ? "contract" : "eoa",
          balance: balance.toString(),
          nonce,
          codeSize: isContract ? code.length : 0,
          isKnownScam: KNOWN_SCAM_ADDRESSES.has(address.toLowerCase())
        })
      } catch (error) {
        return mcpToolRes.error(error, "checking address type")
      }
    }
  )

  // Decode transaction data
  server.tool(
    "decode_transaction_data",
    "Decode transaction input data to understand what it does",
    {
      data: z.string().describe("Transaction input data (hex)"),
      abi: z.string().optional().describe("Contract ABI (JSON string) for decoding")
    },
    async ({ data, abi }) => {
      try {
        // Extract function selector
        const selector = data.slice(0, 10)
        
        // Common function selectors
        const KNOWN_SELECTORS: Record<string, string> = {
          "0xa9059cbb": "transfer(address,uint256)",
          "0x095ea7b3": "approve(address,uint256)",
          "0x23b872dd": "transferFrom(address,address,uint256)",
          "0x38ed1739": "swapExactTokensForTokens(uint256,uint256,address[],address,uint256)",
          "0x7ff36ab5": "swapExactETHForTokens(uint256,address[],address,uint256)",
          "0x18cbafe5": "swapExactTokensForETH(uint256,uint256,address[],address,uint256)",
          "0xe8e33700": "addLiquidity(...)",
          "0xf305d719": "addLiquidityETH(...)",
          "0x2e1a7d4d": "withdraw(uint256)",
          "0xd0e30db0": "deposit()"
        }

        const knownFunction = KNOWN_SELECTORS[selector]

        if (abi) {
          try {
            const parsedAbi = JSON.parse(abi)
            const decoded = decodeFunctionData({
              abi: parsedAbi,
              data: data as Hex
            })
            return mcpToolRes.success({
              selector,
              functionName: decoded.functionName,
              args: decoded.args,
              decoded: true
            })
          } catch {
            // Continue with known selector lookup
          }
        }

        return mcpToolRes.success({
          selector,
          knownFunction: knownFunction || "Unknown function",
          decoded: !!knownFunction,
          dataLength: data.length,
          note: knownFunction 
            ? `This appears to be a ${knownFunction} call`
            : "Provide the contract ABI for full decoding"
        })
      } catch (error) {
        return mcpToolRes.error(error, "decoding transaction data")
      }
    }
  )
}
