/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { Address, Hex } from "viem"
import { decodeFunctionData, parseAbi, formatEther, formatUnits, encodeFunctionData, createPublicClient, http, keccak256, toHex } from "viem"
import { z } from "zod"

import { getPublicClient } from "@/evm/services/clients.js"
import { mcpToolRes } from "@/utils/helper.js"
import { defaultNetworkParam } from "../common/types.js"

// Rug pull risk indicators
const RUG_PULL_INDICATORS = {
  hiddenMint: { risk: "critical", description: "Contract can mint unlimited tokens" },
  hiddenOwner: { risk: "critical", description: "Hidden owner functions accessible" },
  honeypot: { risk: "critical", description: "Buy allowed but sell blocked" },
  highTax: { risk: "high", description: "Tax/fee exceeds 10%" },
  pausable: { risk: "medium", description: "Trading can be paused" },
  blacklist: { risk: "medium", description: "Addresses can be blacklisted" },
  proxyUnverified: { risk: "medium", description: "Upgradeable proxy with unverified implementation" },
  noLiquidity: { risk: "high", description: "No or very low liquidity" },
  lpUnlocked: { risk: "high", description: "Liquidity not locked" },
  recentDeploy: { risk: "low", description: "Contract deployed recently" }
}

// Honeypot detection ABI
const HONEYPOT_CHECK_ABI = parseAbi([
  "function _maxTxAmount() view returns (uint256)",
  "function _maxWalletSize() view returns (uint256)",
  "function _totalFee() view returns (uint256)",
  "function _buyFee() view returns (uint256)",
  "function _sellFee() view returns (uint256)",
  "function tradingEnabled() view returns (bool)",
  "function tradingOpen() view returns (bool)",
  "function swapEnabled() view returns (bool)"
])

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

// ABIs for security analysis
const OWNABLE_ABI = parseAbi([
  "function owner() view returns (address)",
  "function renounceOwnership() external",
  "function transferOwnership(address) external"
])

const PAUSABLE_ABI = parseAbi([
  "function paused() view returns (bool)",
  "function pause() external",
  "function unpause() external"
])

const TOKEN_SECURITY_ABI = parseAbi([
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address,uint256) returns (bool)",
  "function allowance(address,address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
  "function transferFrom(address,address,uint256) returns (bool)",
  "function owner() view returns (address)",
  "function paused() view returns (bool)",
  "function isBlacklisted(address) view returns (bool)",
  "function blacklist(address) external",
  "function mint(address,uint256) external",
  "function _taxFee() view returns (uint256)",
  "function _liquidityFee() view returns (uint256)"
])

const TIMELOCK_ABI = parseAbi([
  "function delay() view returns (uint256)",
  "function MINIMUM_DELAY() view returns (uint256)",
  "function MAXIMUM_DELAY() view returns (uint256)",
  "function admin() view returns (address)",
  "function pendingAdmin() view returns (address)"
])

// Block explorer API endpoints
const EXPLORER_APIS: Record<number, { url: string; name: string }> = {
  1: { url: "https://api.etherscan.io/api", name: "Etherscan" },
  56: { url: "https://api.bscscan.com/api", name: "BSCScan" },
  137: { url: "https://api.polygonscan.com/api", name: "PolygonScan" },
  42161: { url: "https://api.arbiscan.io/api", name: "Arbiscan" },
  10: { url: "https://api-optimistic.etherscan.io/api", name: "Optimistic Etherscan" },
  8453: { url: "https://api.basescan.org/api", name: "BaseScan" },
  43114: { url: "https://api.snowtrace.io/api", name: "Snowtrace" }
}

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

// Liquidity lock contract ABIs
const LIQUIDITY_LOCK_ABI = parseAbi([
  "function getUserNumLockedTokens(address) view returns (uint256)",
  "function getUserLockedTokenAtIndex(address,uint256) view returns (address,uint256,uint256)",
  "function getLockedTokenAtIndex(uint256) view returns (address)",
  "function getNumLockedTokens() view returns (uint256)"
])

// Uniswap V2 Pair ABI
const UNISWAP_PAIR_ABI = parseAbi([
  "function token0() view returns (address)",
  "function token1() view returns (address)",
  "function getReserves() view returns (uint112,uint112,uint32)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)"
])

// Uniswap V2 Factory ABI
const UNISWAP_FACTORY_ABI = parseAbi([
  "function getPair(address,address) view returns (address)"
])

// Well-known liquidity lock contracts
const LIQUIDITY_LOCKERS: Record<number, Record<string, Address>> = {
  1: {
    "Unicrypt": "0x663A5C229c09b049E36dCc11a9B0d4a8Eb9db214",
    "Team.Finance": "0xE2fE530C047f2d85298b07D9333C05737f1435fB",
    "PinkLock": "0x71B5759d73262FBb223956913ecF4ecC51057641"
  },
  56: {
    "Unicrypt": "0xC765bddB93b0D1c1A88282BA0fa6B2d00E3e0c83",
    "PinkLock": "0x7ee058420e5937496F5a2096f04caA7721cF70cc",
    "Mudra": "0xAe37eBd8c56C8ad50Ac0741e5EfF7dD7e1DF1fBc"
  },
  42161: {
    "Unicrypt": "0x9c991E4Cc5c73904fFFE8d9d9Db3a4dBf4a39E8A"
  }
}

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

  // Verify contract source
  server.tool(
    "verify_contract",
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

  // Detect rug pull risk
  server.tool(
    "detect_rug_pull_risk",
    "Analyze a token contract for rug pull indicators and security risks",
    {
      network: defaultNetworkParam,
      tokenAddress: z.string().describe("Token contract address to analyze")
    },
    async ({ network, tokenAddress }) => {
      try {
        const publicClient = getPublicClient(network)
        const risks: Array<{ indicator: string; risk: string; description: string; found: boolean }> = []
        let overallRisk = "low"
        let riskScore = 0

        // Get contract code
        const code = await publicClient.getCode({ address: tokenAddress as Address })
        if (!code || code === "0x") {
          return mcpToolRes.error(new Error("No contract at this address"), "detecting rug pull")
        }

        // Check for owner
        let hasOwner = false
        let ownerAddress: string | null = null
        try {
          ownerAddress = await publicClient.readContract({
            address: tokenAddress as Address,
            abi: parseAbi(["function owner() view returns (address)"]),
            functionName: "owner"
          }) as string
          hasOwner = ownerAddress !== "0x0000000000000000000000000000000000000000"
          if (hasOwner) {
            riskScore += 10
          }
        } catch {}

        // Check for pausable
        let isPausable = false
        try {
          await publicClient.readContract({
            address: tokenAddress as Address,
            abi: parseAbi(["function paused() view returns (bool)"]),
            functionName: "paused"
          })
          isPausable = true
          riskScore += 15
          risks.push({ indicator: "pausable", risk: "medium", description: RUG_PULL_INDICATORS.pausable.description, found: true })
        } catch {}

        // Check for blacklist functionality
        let hasBlacklist = false
        try {
          await publicClient.readContract({
            address: tokenAddress as Address,
            abi: parseAbi(["function isBlacklisted(address) view returns (bool)"]),
            functionName: "isBlacklisted",
            args: ["0x0000000000000000000000000000000000000001" as Address]
          })
          hasBlacklist = true
          riskScore += 20
          risks.push({ indicator: "blacklist", risk: "medium", description: RUG_PULL_INDICATORS.blacklist.description, found: true })
        } catch {}

        // Check for high taxes
        let buyTax = 0n
        let sellTax = 0n
        try {
          buyTax = await publicClient.readContract({
            address: tokenAddress as Address,
            abi: HONEYPOT_CHECK_ABI,
            functionName: "_buyFee"
          }) as bigint
        } catch {}
        try {
          sellTax = await publicClient.readContract({
            address: tokenAddress as Address,
            abi: HONEYPOT_CHECK_ABI,
            functionName: "_sellFee"
          }) as bigint
        } catch {}

        if (buyTax > 10n || sellTax > 10n) {
          riskScore += 30
          risks.push({ 
            indicator: "highTax", 
            risk: "high", 
            description: `High tax detected: Buy ${buyTax}%, Sell ${sellTax}%`, 
            found: true 
          })
        }

        // Check trading status
        let tradingEnabled = true
        try {
          tradingEnabled = await publicClient.readContract({
            address: tokenAddress as Address,
            abi: HONEYPOT_CHECK_ABI,
            functionName: "tradingEnabled"
          }) as boolean
          if (!tradingEnabled) {
            riskScore += 25
            risks.push({ indicator: "tradingDisabled", risk: "high", description: "Trading is currently disabled", found: true })
          }
        } catch {}

        // Check for mint function (potential unlimited mint)
        const codeStr = code.toLowerCase()
        const hasMintSignature = codeStr.includes("40c10f19") // mint(address,uint256)
        if (hasMintSignature && hasOwner) {
          riskScore += 40
          risks.push({ indicator: "hiddenMint", risk: "critical", description: RUG_PULL_INDICATORS.hiddenMint.description, found: true })
        }

        // Determine overall risk
        if (riskScore >= 50) overallRisk = "critical"
        else if (riskScore >= 30) overallRisk = "high"
        else if (riskScore >= 15) overallRisk = "medium"

        return mcpToolRes.success({
          network,
          tokenAddress,
          analysis: {
            overallRisk,
            riskScore,
            maxScore: 100,
            owner: ownerAddress,
            hasOwner,
            isPausable,
            hasBlacklist,
            buyTax: buyTax.toString(),
            sellTax: sellTax.toString(),
            tradingEnabled,
            hasMintFunction: hasMintSignature
          },
          risks: risks.filter(r => r.found),
          recommendation: overallRisk === "critical" 
            ? "DO NOT INTERACT - High probability of rug pull"
            : overallRisk === "high"
            ? "CAUTION - Multiple risk indicators detected"
            : overallRisk === "medium"
            ? "Proceed with caution - Some risk factors present"
            : "Lower risk but always DYOR"
        })
      } catch (error) {
        return mcpToolRes.error(error, "detecting rug pull risk")
      }
    }
  )

  // Get holder distribution
  server.tool(
    "get_holder_distribution",
    "Analyze token holder distribution for concentration risks",
    {
      network: defaultNetworkParam,
      tokenAddress: z.string().describe("Token contract address"),
      topHolders: z.number().optional().default(10).describe("Number of top holders to analyze")
    },
    async ({ network, tokenAddress, topHolders }) => {
      try {
        const publicClient = getPublicClient(network)

        // Get total supply
        const totalSupply = await publicClient.readContract({
          address: tokenAddress as Address,
          abi: parseAbi(["function totalSupply() view returns (uint256)"]),
          functionName: "totalSupply"
        }) as bigint

        // For holder distribution, we need to use logs/events or external API
        // This is a simplified analysis using common patterns
        
        // Check if there's a burn address holding tokens
        const burnAddresses = [
          "0x0000000000000000000000000000000000000000",
          "0x000000000000000000000000000000000000dEaD"
        ]
        
        let burnedSupply = 0n
        for (const addr of burnAddresses) {
          try {
            const balance = await publicClient.readContract({
              address: tokenAddress as Address,
              abi: parseAbi(["function balanceOf(address) view returns (uint256)"]),
              functionName: "balanceOf",
              args: [addr as Address]
            }) as bigint
            burnedSupply += balance
          } catch {}
        }

        const circulatingSupply = totalSupply - burnedSupply
        const burnedPercent = totalSupply > 0n 
          ? Number((burnedSupply * 10000n) / totalSupply) / 100 
          : 0

        // Get decimals for formatting
        let decimals = 18
        try {
          decimals = await publicClient.readContract({
            address: tokenAddress as Address,
            abi: parseAbi(["function decimals() view returns (uint8)"]),
            functionName: "decimals"
          }) as number
        } catch {}

        return mcpToolRes.success({
          network,
          tokenAddress,
          supply: {
            total: formatUnits(totalSupply, decimals),
            totalRaw: totalSupply.toString(),
            burned: formatUnits(burnedSupply, decimals),
            burnedPercent: `${burnedPercent.toFixed(2)}%`,
            circulating: formatUnits(circulatingSupply, decimals)
          },
          analysis: {
            hasBurn: burnedSupply > 0n,
            burnedPercent
          },
          note: "For detailed holder distribution, use a block explorer API or indexer service"
        })
      } catch (error) {
        return mcpToolRes.error(error, "getting holder distribution")
      }
    }
  )

  // Check contract ownership
  server.tool(
    "check_contract_ownership",
    "Verify contract ownership status - check if renounced, multisig, or EOA",
    {
      network: defaultNetworkParam,
      contractAddress: z.string().describe("Contract address to check")
    },
    async ({ network, contractAddress }) => {
      try {
        const publicClient = getPublicClient(network)

        let owner: string | null = null
        let ownerType = "unknown"
        let isRenounced = false
        let pendingOwner: string | null = null

        // Try to get owner
        try {
          owner = await publicClient.readContract({
            address: contractAddress as Address,
            abi: parseAbi(["function owner() view returns (address)"]),
            functionName: "owner"
          }) as string

          if (owner === "0x0000000000000000000000000000000000000000") {
            isRenounced = true
            ownerType = "renounced"
          } else {
            // Check if owner is a contract (potential multisig)
            const ownerCode = await publicClient.getCode({ address: owner as Address })
            ownerType = ownerCode && ownerCode !== "0x" ? "contract" : "eoa"
          }
        } catch {
          // No owner function - might use different pattern
        }

        // Check for pending owner (2-step transfer)
        try {
          pendingOwner = await publicClient.readContract({
            address: contractAddress as Address,
            abi: parseAbi(["function pendingOwner() view returns (address)"]),
            functionName: "pendingOwner"
          }) as string
        } catch {}

        // Check for admin (some contracts use this)
        let admin: string | null = null
        if (!owner) {
          try {
            admin = await publicClient.readContract({
              address: contractAddress as Address,
              abi: parseAbi(["function admin() view returns (address)"]),
              functionName: "admin"
            }) as string
          } catch {}
        }

        // Check for ProxyAdmin (upgradeable proxies)
        let proxyAdmin: string | null = null
        try {
          // EIP-1967 admin slot
          const adminSlot = "0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103"
          const adminData = await publicClient.getStorageAt({
            address: contractAddress as Address,
            slot: adminSlot as `0x${string}`
          })
          if (adminData && adminData !== "0x0000000000000000000000000000000000000000000000000000000000000000") {
            proxyAdmin = `0x${adminData.slice(-40)}`
          }
        } catch {}

        return mcpToolRes.success({
          network,
          contractAddress,
          ownership: {
            owner,
            ownerType,
            isRenounced,
            pendingOwner,
            admin,
            proxyAdmin,
            isUpgradeable: !!proxyAdmin
          },
          riskAssessment: isRenounced 
            ? "Ownership renounced - contract cannot be modified by owner functions"
            : ownerType === "contract"
            ? "Owner is a contract - likely multisig or timelock (safer)"
            : ownerType === "eoa"
            ? "Owner is an EOA - single point of control (higher risk)"
            : "Unable to determine ownership structure"
        })
      } catch (error) {
        return mcpToolRes.error(error, "checking contract ownership")
      }
    }
  )

  // Detect honeypot
  server.tool(
    "detect_honeypot",
    "Check if a token is a honeypot (can buy but not sell)",
    {
      network: defaultNetworkParam,
      tokenAddress: z.string().describe("Token address to check")
    },
    async ({ network, tokenAddress }) => {
      try {
        const publicClient = getPublicClient(network)
        const warnings: string[] = []
        let isLikelyHoneypot = false
        let honeypotScore = 0

        // Check trading status
        let tradingEnabled = true
        let tradingOpen = true
        let swapEnabled = true

        try {
          tradingEnabled = await publicClient.readContract({
            address: tokenAddress as Address,
            abi: HONEYPOT_CHECK_ABI,
            functionName: "tradingEnabled"
          }) as boolean
          if (!tradingEnabled) {
            warnings.push("Trading is disabled")
            honeypotScore += 30
          }
        } catch {}

        try {
          tradingOpen = await publicClient.readContract({
            address: tokenAddress as Address,
            abi: HONEYPOT_CHECK_ABI,
            functionName: "tradingOpen"
          }) as boolean
          if (!tradingOpen) {
            warnings.push("Trading is not open")
            honeypotScore += 30
          }
        } catch {}

        try {
          swapEnabled = await publicClient.readContract({
            address: tokenAddress as Address,
            abi: HONEYPOT_CHECK_ABI,
            functionName: "swapEnabled"
          }) as boolean
          if (!swapEnabled) {
            warnings.push("Swapping is disabled")
            honeypotScore += 20
          }
        } catch {}

        // Check for max transaction/wallet limits
        let maxTx = 0n
        let maxWallet = 0n
        let totalSupply = 0n

        try {
          totalSupply = await publicClient.readContract({
            address: tokenAddress as Address,
            abi: parseAbi(["function totalSupply() view returns (uint256)"]),
            functionName: "totalSupply"
          }) as bigint
        } catch {}

        try {
          maxTx = await publicClient.readContract({
            address: tokenAddress as Address,
            abi: HONEYPOT_CHECK_ABI,
            functionName: "_maxTxAmount"
          }) as bigint
          
          if (totalSupply > 0n && maxTx > 0n) {
            const maxTxPercent = Number((maxTx * 10000n) / totalSupply) / 100
            if (maxTxPercent < 1) {
              warnings.push(`Max transaction is only ${maxTxPercent.toFixed(4)}% of supply`)
              honeypotScore += 15
            }
          }
        } catch {}

        try {
          maxWallet = await publicClient.readContract({
            address: tokenAddress as Address,
            abi: HONEYPOT_CHECK_ABI,
            functionName: "_maxWalletSize"
          }) as bigint
          
          if (totalSupply > 0n && maxWallet > 0n) {
            const maxWalletPercent = Number((maxWallet * 10000n) / totalSupply) / 100
            if (maxWalletPercent < 2) {
              warnings.push(`Max wallet is only ${maxWalletPercent.toFixed(4)}% of supply`)
              honeypotScore += 10
            }
          }
        } catch {}

        // Check for sell fees
        let sellFee = 0n
        try {
          sellFee = await publicClient.readContract({
            address: tokenAddress as Address,
            abi: HONEYPOT_CHECK_ABI,
            functionName: "_sellFee"
          }) as bigint
          
          if (sellFee > 25n) {
            warnings.push(`Extremely high sell fee: ${sellFee}%`)
            honeypotScore += 40
          } else if (sellFee > 10n) {
            warnings.push(`High sell fee: ${sellFee}%`)
            honeypotScore += 20
          }
        } catch {}

        // Check for blacklist
        try {
          await publicClient.readContract({
            address: tokenAddress as Address,
            abi: parseAbi(["function isBlacklisted(address) view returns (bool)"]),
            functionName: "isBlacklisted",
            args: ["0x0000000000000000000000000000000000000001" as Address]
          })
          warnings.push("Contract has blacklist functionality")
          honeypotScore += 15
        } catch {}

        isLikelyHoneypot = honeypotScore >= 50

        return mcpToolRes.success({
          network,
          tokenAddress,
          honeypotAnalysis: {
            isLikelyHoneypot,
            honeypotScore,
            maxScore: 100,
            confidence: honeypotScore >= 70 ? "high" : honeypotScore >= 40 ? "medium" : "low"
          },
          tradingStatus: {
            tradingEnabled,
            tradingOpen,
            swapEnabled
          },
          limits: {
            maxTransaction: maxTx.toString(),
            maxWallet: maxWallet.toString(),
            totalSupply: totalSupply.toString()
          },
          sellFee: sellFee.toString(),
          warnings,
          recommendation: isLikelyHoneypot 
            ? "HIGH RISK - Token shows honeypot characteristics"
            : warnings.length > 2
            ? "CAUTION - Multiple warning signs detected"
            : "Lower risk but always test with small amount first"
        })
      } catch (error) {
        return mcpToolRes.error(error, "detecting honeypot")
      }
    }
  )

  // Analyze contract permissions
  server.tool(
    "analyze_contract_permissions",
    "Analyze a contract for dangerous permissions and admin functions",
    {
      network: defaultNetworkParam,
      contractAddress: z.string().describe("Contract address to analyze")
    },
    async ({ network, contractAddress }) => {
      try {
        const publicClient = getPublicClient(network)
        const dangerousPermissions: Array<{ permission: string; risk: string; description: string }> = []

        // Get bytecode for signature analysis
        const code = await publicClient.getCode({ address: contractAddress as Address })
        if (!code || code === "0x") {
          return mcpToolRes.error(new Error("No contract at this address"), "analyzing permissions")
        }

        const codeHex = code.toLowerCase()

        // Dangerous function signatures to look for
        const dangerousFunctions: Record<string, { name: string; risk: string; description: string }> = {
          "40c10f19": { name: "mint(address,uint256)", risk: "critical", description: "Can create new tokens" },
          "42966c68": { name: "burn(uint256)", risk: "medium", description: "Can burn tokens" },
          "79cc6790": { name: "burnFrom(address,uint256)", risk: "high", description: "Can burn tokens from any address" },
          "8456cb59": { name: "pause()", risk: "high", description: "Can pause contract operations" },
          "3f4ba83a": { name: "unpause()", risk: "medium", description: "Can unpause contract" },
          "e4997dc5": { name: "removeBlacklist(address)", risk: "medium", description: "Has blacklist functionality" },
          "44337ea1": { name: "addBlacklist(address)", risk: "high", description: "Can blacklist addresses" },
          "f2fde38b": { name: "transferOwnership(address)", risk: "medium", description: "Can transfer ownership" },
          "715018a6": { name: "renounceOwnership()", risk: "low", description: "Can renounce ownership" },
          "5c975abb": { name: "paused()", risk: "info", description: "Has pause state (Pausable)" },
          "3659cfe6": { name: "upgradeTo(address)", risk: "critical", description: "Upgradeable proxy" },
          "4f1ef286": { name: "upgradeToAndCall(address,bytes)", risk: "critical", description: "Upgradeable proxy with call" },
          "f851a440": { name: "admin()", risk: "info", description: "Has admin role" },
          "8da5cb5b": { name: "owner()", risk: "info", description: "Has owner" }
        }

        for (const [selector, info] of Object.entries(dangerousFunctions)) {
          if (codeHex.includes(selector)) {
            dangerousPermissions.push({
              permission: info.name,
              risk: info.risk,
              description: info.description
            })
          }
        }

        // Count risk levels
        const riskCounts = {
          critical: dangerousPermissions.filter(p => p.risk === "critical").length,
          high: dangerousPermissions.filter(p => p.risk === "high").length,
          medium: dangerousPermissions.filter(p => p.risk === "medium").length,
          low: dangerousPermissions.filter(p => p.risk === "low").length
        }

        const overallRisk = riskCounts.critical > 0 ? "critical" 
          : riskCounts.high > 1 ? "high"
          : riskCounts.high > 0 || riskCounts.medium > 2 ? "medium"
          : "low"

        return mcpToolRes.success({
          network,
          contractAddress,
          permissions: dangerousPermissions,
          riskSummary: riskCounts,
          overallRisk,
          bytecodeSize: code.length,
          recommendation: overallRisk === "critical"
            ? "DANGER - Contract has critical admin permissions that could lead to fund loss"
            : overallRisk === "high"
            ? "HIGH RISK - Multiple dangerous permissions detected"
            : overallRisk === "medium"
            ? "CAUTION - Some concerning permissions present"
            : "Standard permissions detected"
        })
      } catch (error) {
        return mcpToolRes.error(error, "analyzing contract permissions")
      }
    }
  )

  // Verify contract source on block explorer
  server.tool(
    "verify_contract_source",
    "Check if a contract is verified on block explorers like Etherscan/Basescan and get verification details",
    {
      network: defaultNetworkParam,
      contractAddress: z.string().describe("Contract address to verify"),
      apiKey: z.string().optional().describe("Block explorer API key (optional but recommended)")
    },
    async ({ network, contractAddress, apiKey }) => {
      try {
        const publicClient = getPublicClient(network)
        const chainId = await publicClient.getChainId()
        
        // Block explorer API endpoints
        const explorerApis: Record<number, { url: string; name: string; explorerUrl: string }> = {
          1: { url: "https://api.etherscan.io/api", name: "Etherscan", explorerUrl: "https://etherscan.io" },
          56: { url: "https://api.bscscan.com/api", name: "BSCScan", explorerUrl: "https://bscscan.com" },
          137: { url: "https://api.polygonscan.com/api", name: "PolygonScan", explorerUrl: "https://polygonscan.com" },
          42161: { url: "https://api.arbiscan.io/api", name: "Arbiscan", explorerUrl: "https://arbiscan.io" },
          10: { url: "https://api-optimistic.etherscan.io/api", name: "Optimistic Etherscan", explorerUrl: "https://optimistic.etherscan.io" },
          8453: { url: "https://api.basescan.org/api", name: "BaseScan", explorerUrl: "https://basescan.org" },
          43114: { url: "https://api.snowtrace.io/api", name: "Snowtrace", explorerUrl: "https://snowtrace.io" },
          250: { url: "https://api.ftmscan.com/api", name: "FTMScan", explorerUrl: "https://ftmscan.com" }
        }

        const explorerApi = explorerApis[chainId]
        if (!explorerApi) {
          return mcpToolRes.success({
            network,
            contractAddress,
            verified: "unknown",
            note: "No block explorer API available for this network",
            recommendation: "Check the contract source manually on the network's block explorer"
          })
        }

        // First verify it's a contract
        const code = await publicClient.getCode({ address: contractAddress as Address })
        if (!code || code === "0x") {
          return mcpToolRes.error(new Error("Address is not a contract"), "verifying contract source")
        }

        // Check for proxy patterns
        const codeHex = code.toLowerCase()
        const isProxy = codeHex.includes("363d3d373d3d3d363d") || // EIP-1167 minimal proxy
                       codeHex.includes("5860208158601c335a63")    // UUPS proxy pattern

        // Try to fetch verification status from explorer API
        try {
          const url = new URL(explorerApi.url)
          url.searchParams.set("module", "contract")
          url.searchParams.set("action", "getsourcecode")
          url.searchParams.set("address", contractAddress)
          if (apiKey) {
            url.searchParams.set("apikey", apiKey)
          }

          const response = await fetch(url.toString())
          const data = await response.json()

          if (data.status === "1" && data.result && data.result[0]) {
            const sourceInfo = data.result[0]
            const isVerified = sourceInfo.SourceCode && sourceInfo.SourceCode !== ""

            let implementationInfo = null
            if (isProxy && sourceInfo.Implementation) {
              // Check implementation verification
              const implUrl = new URL(explorerApi.url)
              implUrl.searchParams.set("module", "contract")
              implUrl.searchParams.set("action", "getsourcecode")
              implUrl.searchParams.set("address", sourceInfo.Implementation)
              if (apiKey) {
                implUrl.searchParams.set("apikey", apiKey)
              }

              try {
                const implResponse = await fetch(implUrl.toString())
                const implData = await implResponse.json()
                if (implData.status === "1" && implData.result && implData.result[0]) {
                  const implSource = implData.result[0]
                  implementationInfo = {
                    address: sourceInfo.Implementation,
                    verified: implSource.SourceCode && implSource.SourceCode !== "",
                    contractName: implSource.ContractName || null,
                    compiler: implSource.CompilerVersion || null
                  }
                }
              } catch {}
            }

            return mcpToolRes.success({
              network,
              contractAddress,
              explorer: explorerApi.name,
              verified: isVerified,
              isProxy,
              contractInfo: isVerified ? {
                contractName: sourceInfo.ContractName || "Unknown",
                compiler: sourceInfo.CompilerVersion || "Unknown",
                optimization: sourceInfo.OptimizationUsed === "1",
                optimizationRuns: sourceInfo.Runs ? parseInt(sourceInfo.Runs) : null,
                license: sourceInfo.LicenseType || "Unknown",
                evmVersion: sourceInfo.EVMVersion || "default"
              } : null,
              implementation: implementationInfo,
              explorerUrl: `${explorerApi.explorerUrl}/address/${contractAddress}#code`,
              securityAssessment: {
                isVerified,
                sourceCodeAvailable: isVerified,
                riskLevel: isVerified 
                  ? (isProxy && (!implementationInfo || !implementationInfo.verified) 
                    ? "medium" 
                    : "low")
                  : "high"
              },
              recommendation: isVerified
                ? isProxy && implementationInfo && !implementationInfo.verified
                  ? "Proxy is verified but implementation is NOT - review implementation source"
                  : "Contract source is verified - you can review the code on the block explorer"
                : "WARNING: Contract is NOT verified - source code is unknown. Proceed with extreme caution."
            })
          }
        } catch (fetchError) {
          // API call failed, return basic info
        }

        return mcpToolRes.success({
          network,
          contractAddress,
          verified: "unknown",
          isProxy,
          codeSize: code.length,
          explorerUrl: `${explorerApi.explorerUrl}/address/${contractAddress}#code`,
          note: "Could not verify via API - check explorer manually",
          recommendation: "Verify contract source code on the block explorer before interacting"
        })
      } catch (error) {
        return mcpToolRes.error(error, "verifying contract source")
      }
    }
  )

  // ==================== GOPLUS SECURITY API TOOLS ====================
  
  const GOPLUS_API_BASE = "https://api.gopluslabs.io/api/v1"
  
  // GoPlus chain IDs mapping
  const GOPLUS_CHAIN_IDS: Record<string, string> = {
    "ethereum": "1",
    "mainnet": "1",
    "bsc": "56",
    "binance": "56",
    "polygon": "137",
    "arbitrum": "42161",
    "optimism": "10",
    "base": "8453",
    "avalanche": "43114",
    "fantom": "250",
    "cronos": "25",
    "gnosis": "100",
    "celo": "42220",
    "moonbeam": "1284",
    "moonriver": "1285",
    "harmony": "1666600000",
    "heco": "128",
    "okc": "66",
    "kcc": "321",
    "linea": "59144",
    "scroll": "534352",
    "zksync": "324",
    "mantle": "5000",
    "opbnb": "204"
  }
  
  async function goPlusRequest<T>(
    endpoint: string,
    params: Record<string, unknown> = {}
  ): Promise<T | null> {
    try {
      const queryParams = new URLSearchParams()
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null) {
          queryParams.set(key, String(value))
        }
      }
      const queryString = queryParams.toString()
      const url = `${GOPLUS_API_BASE}${endpoint}${queryString ? `?${queryString}` : ""}`

      const response = await fetch(url, {
        headers: { "Content-Type": "application/json" }
      })
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      if (data.code !== 1) {
        throw new Error(data.message || "GoPlus API error")
      }
      
      return data.result as T
    } catch (error) {
      console.error("GoPlus API error:", error)
      return null
    }
  }
  
  // Resolve chain to GoPlus chain ID
  function resolveGoPlusChainId(network: string): string {
    const normalized = network.toLowerCase().replace(/[-_\s]/g, "")
    return GOPLUS_CHAIN_IDS[normalized] || network
  }

  // GoPlus Token Security Check
  server.tool(
    "goplus_token_security",
    "Check token security using GoPlus API - detects honeypots, rug pulls, malicious code, and other risks",
    {
      chainId: z.string().describe("Chain ID or name (ethereum, bsc, polygon, arbitrum, base, etc.)"),
      contractAddress: z.string().describe("Token contract address to analyze")
    },
    async ({ chainId, contractAddress }) => {
      try {
        const resolvedChainId = resolveGoPlusChainId(chainId)
        const data = await goPlusRequest<Record<string, unknown>>(
          `/token_security/${resolvedChainId}`,
          { contract_addresses: contractAddress.toLowerCase() }
        )
        
        if (!data || !data[contractAddress.toLowerCase()]) {
          return mcpToolRes.success({
            chainId: resolvedChainId,
            contractAddress,
            status: "not_found",
            message: "Token not found or not analyzed by GoPlus"
          })
        }
        
        const tokenData = data[contractAddress.toLowerCase()] as Record<string, unknown>
        
        // Parse risk indicators
        const risks: string[] = []
        const warnings: string[] = []
        
        if (tokenData.is_honeypot === "1") risks.push("HONEYPOT DETECTED")
        if (tokenData.is_mintable === "1") warnings.push("Token is mintable")
        if (tokenData.can_take_back_ownership === "1") risks.push("Ownership can be reclaimed")
        if (tokenData.hidden_owner === "1") risks.push("Hidden owner detected")
        if (tokenData.selfdestruct === "1") risks.push("Contract can self-destruct")
        if (tokenData.external_call === "1") warnings.push("External calls detected")
        if (tokenData.is_proxy === "1") warnings.push("Proxy contract")
        if (tokenData.is_blacklisted === "1") warnings.push("Blacklist functionality")
        if (tokenData.is_whitelisted === "1") warnings.push("Whitelist functionality")
        if (tokenData.trading_cooldown === "1") warnings.push("Trading cooldown enabled")
        if (tokenData.transfer_pausable === "1") warnings.push("Transfers can be paused")
        if (tokenData.cannot_sell_all === "1") risks.push("Cannot sell all tokens")
        if (tokenData.is_anti_whale === "1") warnings.push("Anti-whale mechanism")
        
        // Tax analysis
        const buyTax = parseFloat(String(tokenData.buy_tax || "0")) * 100
        const sellTax = parseFloat(String(tokenData.sell_tax || "0")) * 100
        if (buyTax > 10) warnings.push(`High buy tax: ${buyTax.toFixed(1)}%`)
        if (sellTax > 10) warnings.push(`High sell tax: ${sellTax.toFixed(1)}%`)
        if (sellTax > 50) risks.push(`Extreme sell tax: ${sellTax.toFixed(1)}%`)
        
        // Calculate risk score
        const riskScore = risks.length * 30 + warnings.length * 10
        const riskLevel = riskScore >= 60 ? "critical" : riskScore >= 30 ? "high" : riskScore >= 10 ? "medium" : "low"
        
        return mcpToolRes.success({
          chainId: resolvedChainId,
          contractAddress,
          tokenInfo: {
            name: tokenData.token_name,
            symbol: tokenData.token_symbol,
            totalSupply: tokenData.total_supply,
            holderCount: tokenData.holder_count,
            creator: tokenData.creator_address,
            owner: tokenData.owner_address
          },
          securityAnalysis: {
            riskLevel,
            riskScore,
            isHoneypot: tokenData.is_honeypot === "1",
            isMintable: tokenData.is_mintable === "1",
            isProxy: tokenData.is_proxy === "1",
            hasBlacklist: tokenData.is_blacklisted === "1",
            canPause: tokenData.transfer_pausable === "1",
            buyTax: `${buyTax.toFixed(2)}%`,
            sellTax: `${sellTax.toFixed(2)}%`
          },
          risks,
          warnings,
          lpInfo: tokenData.lp_holders ? {
            lpHolderCount: tokenData.lp_holder_count,
            lpTotalSupply: tokenData.lp_total_supply,
            isLpLocked: (tokenData as Record<string, unknown[]>).lp_holders?.some((h: Record<string, unknown>) => h.is_locked === 1)
          } : null,
          rawData: tokenData,
          recommendation: riskLevel === "critical"
            ? "DO NOT INTERACT - Critical security risks detected"
            : riskLevel === "high"
            ? "HIGH RISK - Multiple security concerns found"
            : riskLevel === "medium"
            ? "CAUTION - Some risk factors present, proceed carefully"
            : "Lower risk detected but always DYOR"
        })
      } catch (error) {
        return mcpToolRes.error(error, "checking token security via GoPlus")
      }
    }
  )

  // GoPlus Address Security Check
  server.tool(
    "goplus_address_security",
    "Check if an address is associated with malicious activity (scams, phishing, hacks)",
    {
      address: z.string().describe("Address to check for malicious activity")
    },
    async ({ address }) => {
      try {
        const data = await goPlusRequest<Record<string, unknown>>(
          "/address_security/" + address.toLowerCase()
        )
        
        if (!data) {
          return mcpToolRes.success({
            address,
            status: "not_found",
            message: "Address not in GoPlus database"
          })
        }
        
        const risks: string[] = []
        
        if (data.honeypot_related_address === "1") risks.push("Associated with honeypot scams")
        if (data.phishing_activities === "1") risks.push("Phishing activity detected")
        if (data.blacklist_doubt === "1") risks.push("Blacklisted address")
        if (data.stealing_attack === "1") risks.push("Involved in theft attacks")
        if (data.fake_kyc === "1") risks.push("Fake KYC detected")
        if (data.malicious_mining_activities === "1") risks.push("Malicious mining activity")
        if (data.darkweb_transactions === "1") risks.push("Darkweb transactions")
        if (data.cybercrime === "1") risks.push("Associated with cybercrime")
        if (data.money_laundering === "1") risks.push("Money laundering activity")
        if (data.financial_crime === "1") risks.push("Financial crime")
        if (data.blackmail_activities === "1") risks.push("Blackmail activities")
        if (data.mixer === "1") risks.push("Mixer/tumbler usage")
        if (data.sanctioned === "1") risks.push("SANCTIONED ADDRESS")
        if (data.contract_address === "1") risks.push("Is a contract address")
        
        const isMalicious = risks.length > 0
        
        return mcpToolRes.success({
          address,
          isMalicious,
          riskLevel: risks.length >= 3 ? "critical" : risks.length >= 1 ? "high" : "safe",
          risks,
          dataAge: data.data_source,
          recommendation: isMalicious
            ? "WARNING: This address is flagged as malicious. Do not send funds or interact."
            : "No malicious activity detected, but always verify before transacting"
        })
      } catch (error) {
        return mcpToolRes.error(error, "checking address security via GoPlus")
      }
    }
  )

  // GoPlus Approval Security Check
  server.tool(
    "goplus_approval_security",
    "Check token approval security - analyze if approved spender contracts are risky",
    {
      chainId: z.string().describe("Chain ID or name"),
      contractAddress: z.string().describe("Spender contract address to check")
    },
    async ({ chainId, contractAddress }) => {
      try {
        const resolvedChainId = resolveGoPlusChainId(chainId)
        const data = await goPlusRequest<Record<string, unknown>>(
          `/approval_security/${resolvedChainId}`,
          { contract_addresses: contractAddress.toLowerCase() }
        )
        
        if (!data || !data[contractAddress.toLowerCase()]) {
          return mcpToolRes.success({
            chainId: resolvedChainId,
            contractAddress,
            status: "not_found",
            message: "Contract not found in GoPlus database"
          })
        }
        
        const contractData = data[contractAddress.toLowerCase()] as Record<string, unknown>
        const risks: string[] = []
        
        if (contractData.is_contract === "0") risks.push("Approval to EOA (not a contract)")
        if (contractData.is_open_source === "0") risks.push("Contract source not verified")
        if (contractData.trust_list === "0" && contractData.risky_approval === "1") {
          risks.push("Not on trusted list and flagged as risky")
        }
        if (contractData.malicious_address === "1") risks.push("Known malicious contract")
        
        return mcpToolRes.success({
          chainId: resolvedChainId,
          contractAddress,
          analysis: {
            isContract: contractData.is_contract === "1",
            isOpenSource: contractData.is_open_source === "1",
            isTrusted: contractData.trust_list === "1",
            isRisky: contractData.risky_approval === "1",
            isMalicious: contractData.malicious_address === "1",
            deployTime: contractData.deploy_time,
            tag: contractData.tag
          },
          risks,
          riskLevel: risks.length >= 2 ? "high" : risks.length >= 1 ? "medium" : "low",
          recommendation: risks.length > 0
            ? "Consider revoking this approval - security concerns detected"
            : "Approval appears safe but regularly review your approvals"
        })
      } catch (error) {
        return mcpToolRes.error(error, "checking approval security via GoPlus")
      }
    }
  )

  // GoPlus NFT Security Check
  server.tool(
    "goplus_nft_security",
    "Check NFT collection security - detect fake collections, malicious contracts",
    {
      chainId: z.string().describe("Chain ID or name"),
      contractAddress: z.string().describe("NFT contract address to analyze")
    },
    async ({ chainId, contractAddress }) => {
      try {
        const resolvedChainId = resolveGoPlusChainId(chainId)
        const data = await goPlusRequest<Record<string, unknown>>(
          `/nft_security/${resolvedChainId}`,
          { contract_addresses: contractAddress.toLowerCase() }
        )
        
        if (!data || !data[contractAddress.toLowerCase()]) {
          return mcpToolRes.success({
            chainId: resolvedChainId,
            contractAddress,
            status: "not_found",
            message: "NFT collection not found in GoPlus database"
          })
        }
        
        const nftData = data[contractAddress.toLowerCase()] as Record<string, unknown>
        const risks: string[] = []
        const warnings: string[] = []
        
        if (nftData.nft_open_source === "0") warnings.push("Contract source not verified")
        if (nftData.nft_proxy === "1") warnings.push("Upgradeable proxy contract")
        if (nftData.oversupply_minting === "1") risks.push("Oversupply minting possible")
        if (nftData.restricted_approval === "1") warnings.push("Has approval restrictions")
        if (nftData.transfer_without_approval === "1") risks.push("Can transfer without approval")
        if (nftData.self_destruct === "1") risks.push("Contract can self-destruct")
        if (nftData.privileged_burn === "1") risks.push("Privileged burn capability")
        if (nftData.privileged_minting === "1") warnings.push("Privileged minting enabled")
        
        const riskScore = risks.length * 25 + warnings.length * 10
        const riskLevel = riskScore >= 50 ? "high" : riskScore >= 25 ? "medium" : "low"
        
        return mcpToolRes.success({
          chainId: resolvedChainId,
          contractAddress,
          nftInfo: {
            name: nftData.nft_name,
            symbol: nftData.nft_symbol,
            erc: nftData.nft_erc,
            owner: nftData.owner_address,
            creator: nftData.creator_address
          },
          securityAnalysis: {
            riskLevel,
            riskScore,
            isOpenSource: nftData.nft_open_source === "1",
            isProxy: nftData.nft_proxy === "1",
            canSelfDestruct: nftData.self_destruct === "1",
            hasPrivilegedMint: nftData.privileged_minting === "1",
            hasPrivilegedBurn: nftData.privileged_burn === "1"
          },
          risks,
          warnings,
          recommendation: riskLevel === "high"
            ? "HIGH RISK - Exercise extreme caution with this NFT collection"
            : riskLevel === "medium"
            ? "MEDIUM RISK - Review concerns before minting/buying"
            : "Lower risk detected but verify authenticity"
        })
      } catch (error) {
        return mcpToolRes.error(error, "checking NFT security via GoPlus")
      }
    }
  )

  // GoPlus dApp Security Check
  server.tool(
    "goplus_dapp_security",
    "Check dApp/website security - detect phishing sites, malicious dApps",
    {
      url: z.string().describe("dApp URL to check (e.g., https://uniswap.org)")
    },
    async ({ url }) => {
      try {
        const data = await goPlusRequest<Record<string, unknown>>(
          "/dapp_security",
          { url }
        )
        
        if (!data) {
          return mcpToolRes.success({
            url,
            status: "not_found",
            message: "URL not found in GoPlus database"
          })
        }
        
        const risks: string[] = []
        
        if (data.is_audit === "0") risks.push("Not audited")
        if (data.audit_info) {
          const auditInfo = data.audit_info as Record<string, unknown>
          if (auditInfo.is_audit === "0") risks.push("No security audit")
        }
        if (data.is_phishing === "1") risks.push("PHISHING SITE DETECTED")
        if (data.malicious_contract === "1") risks.push("Uses malicious contracts")
        
        const isPhishing = data.is_phishing === "1"
        
        return mcpToolRes.success({
          url,
          isPhishing,
          riskLevel: isPhishing ? "critical" : risks.length > 0 ? "medium" : "low",
          dAppInfo: {
            name: data.name,
            contracts: data.contracts,
            isAudited: data.is_audit === "1"
          },
          risks,
          recommendation: isPhishing
            ? "DANGER: This is a known phishing site. Do NOT interact!"
            : risks.length > 0
            ? "Some concerns detected - verify the URL and contracts"
            : "No issues detected but always verify URLs before connecting wallet"
        })
      } catch (error) {
        return mcpToolRes.error(error, "checking dApp security via GoPlus")
      }
    }
  )

  // GoPlus Signature Data Decode
  server.tool(
    "goplus_signature_decode",
    "Decode signature/permit data to understand what you're signing (prevents blind signing attacks)",
    {
      chainId: z.string().describe("Chain ID or name"),
      contractAddress: z.string().optional().describe("Contract address (for EIP-712)"),
      inputData: z.string().describe("Signature data (hex) or EIP-712 typed data (JSON)")
    },
    async ({ chainId, contractAddress, inputData }) => {
      try {
        const resolvedChainId = resolveGoPlusChainId(chainId)
        const data = await goPlusRequest<Record<string, unknown>>(
          "/signature_data_decode",
          {
            chain_id: resolvedChainId,
            contract_address: contractAddress,
            data: inputData
          }
        )
        
        if (!data) {
          return mcpToolRes.success({
            chainId: resolvedChainId,
            status: "decode_failed",
            message: "Could not decode signature data"
          })
        }
        
        const risks: string[] = []
        
        // Analyze the decoded data for risks
        const decodedData = data as Record<string, unknown>
        if (decodedData.risk_level === "high") risks.push("High-risk signature request")
        if (decodedData.is_malicious === "1") risks.push("Malicious signature detected")
        
        return mcpToolRes.success({
          chainId: resolvedChainId,
          contractAddress,
          decoded: {
            type: decodedData.data_type,
            method: decodedData.method,
            params: decodedData.params,
            description: decodedData.description
          },
          risks,
          riskLevel: risks.length > 0 ? "high" : "low",
          recommendation: "Always review what you're signing. If unsure, do not sign."
        })
      } catch (error) {
        return mcpToolRes.error(error, "decoding signature data via GoPlus")
      }
    }
  )

  // GoPlus Supported Chains
  server.tool(
    "goplus_supported_chains",
    "Get list of blockchain networks supported by GoPlus security API",
    {},
    async () => {
      try {
        const data = await goPlusRequest<{ id: string; name: string }[]>(
          "/supported_chains"
        )
        
        if (!data) {
          // Return hardcoded list if API fails
          return mcpToolRes.success({
            chains: Object.entries(GOPLUS_CHAIN_IDS).map(([name, id]) => ({ name, id }))
          })
        }
        
        return mcpToolRes.success({
          chains: data,
          totalChains: data.length
        })
      } catch (error) {
        return mcpToolRes.error(error, "fetching supported chains from GoPlus")
      }
    }
  )

  // GoPlus Rug Pull Detection
  server.tool(
    "goplus_rugpull_detection",
    "Comprehensive rug pull detection combining multiple GoPlus security checks",
    {
      chainId: z.string().describe("Chain ID or name"),
      tokenAddress: z.string().describe("Token contract address to analyze")
    },
    async ({ chainId, tokenAddress }) => {
      try {
        const resolvedChainId = resolveGoPlusChainId(chainId)
        
        // Fetch token security data
        const tokenData = await goPlusRequest<Record<string, unknown>>(
          `/token_security/${resolvedChainId}`,
          { contract_addresses: tokenAddress.toLowerCase() }
        )
        
        if (!tokenData || !tokenData[tokenAddress.toLowerCase()]) {
          return mcpToolRes.success({
            chainId: resolvedChainId,
            tokenAddress,
            status: "not_found",
            message: "Token not found in GoPlus database"
          })
        }
        
        const token = tokenData[tokenAddress.toLowerCase()] as Record<string, unknown>
        
        // Rug pull indicators
        const rugIndicators: { indicator: string; severity: string; found: boolean }[] = []
        let rugScore = 0
        
        // Critical indicators
        if (token.is_honeypot === "1") {
          rugIndicators.push({ indicator: "Honeypot", severity: "critical", found: true })
          rugScore += 40
        }
        if (token.hidden_owner === "1") {
          rugIndicators.push({ indicator: "Hidden Owner", severity: "critical", found: true })
          rugScore += 30
        }
        if (token.can_take_back_ownership === "1") {
          rugIndicators.push({ indicator: "Ownership Reclaim", severity: "critical", found: true })
          rugScore += 30
        }
        if (token.selfdestruct === "1") {
          rugIndicators.push({ indicator: "Self-Destruct", severity: "critical", found: true })
          rugScore += 25
        }
        
        // High risk indicators
        if (token.is_mintable === "1") {
          rugIndicators.push({ indicator: "Mintable", severity: "high", found: true })
          rugScore += 15
        }
        const sellTax = parseFloat(String(token.sell_tax || "0")) * 100
        if (sellTax > 25) {
          rugIndicators.push({ indicator: `High Sell Tax (${sellTax.toFixed(1)}%)`, severity: "high", found: true })
          rugScore += 20
        }
        if (token.cannot_sell_all === "1") {
          rugIndicators.push({ indicator: "Cannot Sell All", severity: "high", found: true })
          rugScore += 25
        }
        
        // Medium risk indicators
        if (token.transfer_pausable === "1") {
          rugIndicators.push({ indicator: "Transfer Pausable", severity: "medium", found: true })
          rugScore += 10
        }
        if (token.is_blacklisted === "1") {
          rugIndicators.push({ indicator: "Blacklist", severity: "medium", found: true })
          rugScore += 10
        }
        if (token.is_proxy === "1" && token.is_open_source === "0") {
          rugIndicators.push({ indicator: "Unverified Proxy", severity: "medium", found: true })
          rugScore += 15
        }
        
        // LP analysis
        let lpLocked = false
        let lpLockedPercent = 0
        if (token.lp_holders && Array.isArray(token.lp_holders)) {
          const lpHolders = token.lp_holders as { is_locked: number; percent: string }[]
          const lockedLp = lpHolders.filter(h => h.is_locked === 1)
          if (lockedLp.length > 0) {
            lpLocked = true
            lpLockedPercent = lockedLp.reduce((sum, h) => sum + parseFloat(h.percent || "0"), 0) * 100
          }
        }
        
        if (!lpLocked) {
          rugIndicators.push({ indicator: "LP Not Locked", severity: "high", found: true })
          rugScore += 20
        }
        
        // Calculate risk level
        const rugRisk = rugScore >= 70 ? "critical" : rugScore >= 40 ? "high" : rugScore >= 20 ? "medium" : "low"
        
        return mcpToolRes.success({
          chainId: resolvedChainId,
          tokenAddress,
          tokenInfo: {
            name: token.token_name,
            symbol: token.token_symbol,
            totalSupply: token.total_supply,
            holders: token.holder_count
          },
          rugPullAnalysis: {
            rugRisk,
            rugScore,
            maxScore: 100,
            indicatorsFound: rugIndicators.filter(i => i.found).length
          },
          indicators: rugIndicators,
          liquidityAnalysis: {
            lpLocked,
            lpLockedPercent: `${lpLockedPercent.toFixed(2)}%`,
            lpHolderCount: token.lp_holder_count
          },
          taxes: {
            buyTax: `${(parseFloat(String(token.buy_tax || "0")) * 100).toFixed(2)}%`,
            sellTax: `${sellTax.toFixed(2)}%`
          },
          recommendation: rugRisk === "critical"
            ? "🚨 EXTREME DANGER - Strong rug pull indicators. DO NOT INVEST"
            : rugRisk === "high"
            ? "⚠️ HIGH RISK - Multiple rug pull warning signs detected"
            : rugRisk === "medium"
            ? "⚡ CAUTION - Some concerning indicators present"
            : "Lower risk but always DYOR and never invest more than you can lose"
        })
      } catch (error) {
        return mcpToolRes.error(error, "running rug pull detection via GoPlus")
      }
    }
  )
}
