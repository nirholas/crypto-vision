/**
 * UCAI x402 MCP Tools
 * @description MCP tools for x402-powered smart contract AI payments
 * @author nirholas
 * @license Apache-2.0
 * 
 * This module registers premium smart contract tools that require x402 payment:
 * - Gas Sponsorship - Pay for user's gas
 * - Premium Contract Analysis - $0.05
 * - Transaction Simulation - $0.01
 * - Historical Contract Data - $0.02/query
 * - Custom ABI Generation - $0.10
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { Address, Hex } from "viem"
import { z } from "zod"

import { getGasSponsorService } from "./gas-sponsorship.js"
import { getContractAnalysisService } from "./contract-analysis.js"
import { getTransactionSimulationService } from "./transaction-simulation.js"
import { getHistoricalDataService } from "./historical-data.js"
import { getABIGenerationService } from "./abi-generation.js"
import { getUCAIPaymentService } from "./payment.js"
import { UCAI_PRICING, UCAP_TOOLS } from "./types.js"
import Logger from "@/utils/logger.js"
import { mcpToolRes } from "@/utils/helper.js"

// Tool parameter types
interface GasSponsorParams {
  userAddress: string
  contractAddress: string
  functionName: string
  args: unknown[]
  abi: unknown[]
  network: string
  maxGasUsd?: string
}

interface GasEstimateParams {
  contractAddress: string
  functionName: string
  args: unknown[]
  abi: unknown[]
  network: string
}

interface ContractAnalysisParams {
  contractAddress: string
  network: string
  analysisType: string[]
}

interface RugPullParams {
  tokenAddress: string
  network: string
}

interface SimulationParams {
  contractAddress: string
  functionName: string
  args: unknown[]
  abi: unknown[]
  from: string
  value?: string
  network: string
}

interface HistoricalDataParams {
  contractAddress: string
  network: string
  dataType: string
  fromBlock?: string
  toBlock?: string
  eventFilter?: {
    eventName?: string
    topics?: (string | null)[]
  }
  limit: number
}

interface ContractStatsParams {
  contractAddress: string
  network: string
}

interface ABIGenerationParams {
  contractAddress: string
  network: string
  includeDescriptions: boolean
  detectStandards: boolean
}

// Default network parameter
const networkParam = z
  .enum(["ethereum", "arbitrum", "base", "polygon", "optimism", "bsc"])
  .default("arbitrum")
  .describe("The blockchain network to use")

/**
 * Register all UCAI x402 MCP tools
 */
export function registerUCAITools(server: McpServer): void {
  Logger.info("Registering UCAI x402 premium smart contract tools")

  // ============================================================================
  // Gas Sponsorship Tools
  // ============================================================================

  server.tool(
    "ucai_sponsor_gas",
    `Sponsor gas for a user's smart contract transaction. The AI agent pays for gas using x402 payment. ` +
    `Fee: ${UCAI_PRICING.GAS_SPONSORSHIP_FEE}% of gas cost + gas cost in USD.`,
    {
      userAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).describe("User's wallet address"),
      contractAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).describe("Target contract address"),
      functionName: z.string().describe("Function to call"),
      args: z.array(z.any()).describe("Function arguments"),
      abi: z.array(z.any()).describe("Contract ABI"),
      network: networkParam,
      maxGasUsd: z.string().optional().describe("Maximum gas in USD to sponsor (default: $5)"),
    },
    async (params: GasSponsorParams) => {
      const { userAddress, contractAddress, functionName, args, abi, network, maxGasUsd } = params
      try {
        // Process payment first
        const paymentService = getUCAIPaymentService()
        const estimate = await getGasSponsorService().estimateSponsorshipCost(
          contractAddress as Address,
          functionName,
          args,
          abi,
          network
        )

        if (!estimate.supported) {
          return mcpToolRes.error(`Network ${network} not supported for gas sponsorship`, "checking network support")
        }

        const paymentResult = await paymentService.processPayment("gas_sponsor", estimate.paymentAmount)
        if (!paymentResult.success) {
          return mcpToolRes.error(`Payment failed: ${paymentResult.error}`, "processing payment")
        }

        // Execute gas sponsorship
        const result = await getGasSponsorService().sponsorTransaction({
          userAddress: userAddress as Address,
          contractAddress: contractAddress as Address,
          functionName,
          args,
          abi,
          network,
          maxGasUsd,
        })

        if (!result.success) {
          // Refund on failure
          await paymentService.refundPayment(paymentResult.paymentId!)
          return mcpToolRes.error(result.error ?? "Gas sponsorship failed", "sponsoring transaction")
        }

        return mcpToolRes.success({
          sponsored: true,
          transactionHash: result.transactionHash,
          gasCost: {
            native: result.gasCostNative,
            usd: result.gasCostUsd,
          },
          payment: {
            amount: result.paymentAmount,
            token: "USDs",
            paymentId: paymentResult.paymentId,
          },
        })
      } catch (error) {
        return mcpToolRes.error(error, "sponsoring gas")
      }
    }
  )

  server.tool(
    "ucai_estimate_gas_sponsorship",
    "Estimate the cost to sponsor gas for a transaction (free).",
    {
      contractAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).describe("Target contract address"),
      functionName: z.string().describe("Function to call"),
      args: z.array(z.any()).describe("Function arguments"),
      abi: z.array(z.any()).describe("Contract ABI"),
      network: networkParam,
    },
    async (params: GasEstimateParams) => {
      const { contractAddress, functionName, args, abi, network } = params
      try {
        const estimate = await getGasSponsorService().estimateSponsorshipCost(
          contractAddress as Address,
          functionName,
          args,
          abi,
          network
        )

        return mcpToolRes.success({
          supported: estimate.supported,
          gasCost: {
            native: estimate.gasCostNative,
            usd: estimate.gasCostUsd,
          },
          totalPayment: estimate.paymentAmount,
          feePercentage: UCAI_PRICING.GAS_SPONSORSHIP_FEE,
          token: "USDs",
        })
      } catch (error) {
        return mcpToolRes.error(error, "estimating gas sponsorship")
      }
    }
  )

  // ============================================================================
  // Contract Analysis Tools
  // ============================================================================

  server.tool(
    "ucai_analyze_contract",
    `Perform premium security analysis on a smart contract. Includes security audit, ` +
    `ownership analysis, proxy detection, and verification status. ` +
    `Price: $${UCAI_PRICING.CONTRACT_ANALYSIS} per analysis.`,
    {
      contractAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).describe("Contract address to analyze"),
      network: networkParam,
      analysisType: z.array(z.enum([
        "security_audit",
        "rug_pull_detection",
        "contract_verification",
        "ownership_analysis",
        "proxy_detection",
        "token_analysis",
        "full_audit",
      ])).default(["full_audit"]).describe("Types of analysis to perform"),
    },
    async (params: ContractAnalysisParams) => {
      const { contractAddress, network, analysisType } = params
      try {
        // Process payment
        const paymentService = getUCAIPaymentService()
        const paymentResult = await paymentService.processPayment(
          "contract_analysis",
          UCAI_PRICING.CONTRACT_ANALYSIS
        )

        if (!paymentResult.success) {
          return mcpToolRes.error(`Payment failed: ${paymentResult.error}`, "processing payment")
        }

        // Perform analysis
        const result = await getContractAnalysisService().analyzeContract({
          contractAddress: contractAddress as Address,
          network,
          analysisType: analysisType as any,
        })

        return mcpToolRes.success({
          analysis: {
            securityScore: result.securityScore,
            riskLevel: result.riskLevel,
            vulnerabilities: result.vulnerabilities,
            ownership: result.ownership,
            isProxy: result.isProxy,
            implementationAddress: result.implementationAddress,
            verified: result.verified,
            recommendations: result.recommendations,
          },
          payment: {
            amount: UCAI_PRICING.CONTRACT_ANALYSIS,
            token: "USDs",
            paymentId: paymentResult.paymentId,
          },
        })
      } catch (error) {
        return mcpToolRes.error(error, "analyzing contract")
      }
    }
  )

  server.tool(
    "ucai_detect_rug_pull",
    `Analyze a token contract for rug pull indicators and honeypot detection. ` +
    `Price: $${UCAI_PRICING.CONTRACT_ANALYSIS} per analysis.`,
    {
      tokenAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).describe("Token contract address"),
      network: networkParam,
    },
    async (params: RugPullParams) => {
      const { tokenAddress, network } = params
      try {
        // Process payment
        const paymentService = getUCAIPaymentService()
        const paymentResult = await paymentService.processPayment(
          "contract_analysis",
          UCAI_PRICING.CONTRACT_ANALYSIS
        )

        if (!paymentResult.success) {
          return mcpToolRes.error(`Payment failed: ${paymentResult.error}`, "processing payment")
        }

        // Perform rug pull analysis
        const result = await getContractAnalysisService().analyzeRugPullRisk(
          tokenAddress as Address,
          network
        )

        return mcpToolRes.success({
          rugPullAnalysis: {
            riskScore: result.riskScore,
            isHoneypot: result.isHoneypot,
            indicators: result.indicators,
            details: {
              hasUnlimitedMint: result.hasUnlimitedMint,
              canPauseTrading: result.canPauseTrading,
              hasBlacklist: result.hasBlacklist,
              hasHiddenOwner: result.hasHiddenOwner,
              liquidityLocked: result.liquidityLocked,
              lockDuration: result.lockDuration,
              buyTax: result.buyTax,
              sellTax: result.sellTax,
            },
            contractAgeDays: result.contractAgeDays,
          },
          payment: {
            amount: UCAI_PRICING.CONTRACT_ANALYSIS,
            token: "USDs",
            paymentId: paymentResult.paymentId,
          },
        })
      } catch (error) {
        return mcpToolRes.error(error, "detecting rug pull")
      }
    }
  )

  // ============================================================================
  // Transaction Simulation Tools
  // ============================================================================

  server.tool(
    "ucai_simulate_transaction",
    `Simulate a smart contract transaction before execution. Shows outcome preview, ` +
    `state changes, token transfers, and catches errors early. ` +
    `Price: $${UCAI_PRICING.TRANSACTION_SIMULATION} per simulation.`,
    {
      contractAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).describe("Contract address"),
      functionName: z.string().describe("Function to simulate"),
      args: z.array(z.any()).describe("Function arguments"),
      abi: z.array(z.any()).describe("Contract ABI"),
      from: z.string().regex(/^0x[a-fA-F0-9]{40}$/).describe("Sender address"),
      value: z.string().optional().describe("ETH value to send (in wei)"),
      network: networkParam,
    },
    async (params: SimulationParams) => {
      const { contractAddress, functionName, args, abi, from, value, network } = params
      try {
        // Process payment
        const paymentService = getUCAIPaymentService()
        const paymentResult = await paymentService.processPayment(
          "tx_simulation",
          UCAI_PRICING.TRANSACTION_SIMULATION
        )

        if (!paymentResult.success) {
          return mcpToolRes.error(`Payment failed: ${paymentResult.error}`, "processing payment")
        }

        // Perform simulation
        const result = await getTransactionSimulationService().simulateTransaction({
          contractAddress: contractAddress as Address,
          functionName,
          args,
          abi,
          from: from as Address,
          value: value ? BigInt(value) : undefined,
          network,
        })

        return mcpToolRes.success({
          simulation: {
            success: result.success,
            returnValue: result.decodedReturn ?? result.returnValue,
            gasEstimate: {
              gasUsed: result.gasUsed.toString(),
              gasLimit: result.gasLimit.toString(),
            },
            stateChanges: result.stateChanges,
            events: result.events,
            tokenTransfers: result.tokenTransfers.map(t => ({
              ...t,
              amount: t.amount.toString(),
            })),
            nativeTransfers: result.nativeTransfers.map(t => ({
              ...t,
              amount: t.amount.toString(),
            })),
            error: result.error,
            revertReason: result.revertReason,
            warnings: result.warnings,
          },
          payment: {
            amount: UCAI_PRICING.TRANSACTION_SIMULATION,
            token: "USDs",
            paymentId: paymentResult.paymentId,
          },
        })
      } catch (error) {
        return mcpToolRes.error(error, "simulating transaction")
      }
    }
  )

  // ============================================================================
  // Historical Data Tools
  // ============================================================================

  server.tool(
    "ucai_query_historical_data",
    `Query historical data for a smart contract including transactions, event logs, ` +
    `and state changes over time. ` +
    `Price: $${UCAI_PRICING.HISTORICAL_DATA} per query.`,
    {
      contractAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).describe("Contract address"),
      network: networkParam,
      dataType: z.enum([
        "transactions",
        "event_logs",
        "state_changes",
        "balance_history",
        "function_calls",
      ]).describe("Type of historical data to query"),
      fromBlock: z.string().optional().describe("Start block (number or 'earliest')"),
      toBlock: z.string().optional().describe("End block (number or 'latest')"),
      eventFilter: z.object({
        eventName: z.string().optional(),
        topics: z.array(z.string().nullable()).optional(),
      }).optional().describe("Filter for event logs"),
      limit: z.number().max(1000).default(100).describe("Maximum results to return"),
    },
    async (params: HistoricalDataParams) => {
      const { contractAddress, network, dataType, fromBlock, toBlock, eventFilter, limit } = params
      try {
        // Process payment
        const paymentService = getUCAIPaymentService()
        const paymentResult = await paymentService.processPayment(
          "historical_data",
          UCAI_PRICING.HISTORICAL_DATA
        )

        if (!paymentResult.success) {
          return mcpToolRes.error(`Payment failed: ${paymentResult.error}`, "processing payment")
        }

        // Query historical data
        const result = await getHistoricalDataService().queryHistoricalData({
          contractAddress: contractAddress as Address,
          network,
          dataType: dataType as any,
          fromBlock: fromBlock === "earliest" ? "earliest" : fromBlock ? BigInt(fromBlock) : undefined,
          toBlock: toBlock === "latest" ? "latest" : toBlock ? BigInt(toBlock) : undefined,
          eventFilter: eventFilter as any,
          limit,
        })

        // Serialize BigInts for JSON response
        const serialized = JSON.parse(JSON.stringify(result, (key, value) =>
          typeof value === "bigint" ? value.toString() : value
        ))

        return mcpToolRes.success({
          historicalData: serialized,
          payment: {
            amount: UCAI_PRICING.HISTORICAL_DATA,
            token: "USDs",
            paymentId: paymentResult.paymentId,
          },
        })
      } catch (error) {
        return mcpToolRes.error(error, "querying historical data")
      }
    }
  )

  server.tool(
    "ucai_get_contract_stats",
    `Get aggregate statistics for a contract (free preview).`,
    {
      contractAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).describe("Contract address"),
      network: networkParam,
    },
    async (params: ContractStatsParams) => {
      const { contractAddress, network } = params
      try {
        const stats = await getHistoricalDataService().getContractStats(
          contractAddress as Address,
          network
        )

        return mcpToolRes.success({
          stats,
          note: "Use ucai_query_historical_data for detailed transaction and event data",
          pricing: `$${UCAI_PRICING.HISTORICAL_DATA} per detailed query`,
        })
      } catch (error) {
        return mcpToolRes.error(error, "getting contract stats")
      }
    }
  )

  // ============================================================================
  // ABI Generation Tools
  // ============================================================================

  server.tool(
    "ucai_generate_abi",
    `Generate ABI for an unverified smart contract from bytecode analysis. ` +
    `Uses decompilation, pattern matching, and AI-enhanced interface detection. ` +
    `Price: $${UCAI_PRICING.ABI_GENERATION} per generation.`,
    {
      contractAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).describe("Contract address"),
      network: networkParam,
      includeDescriptions: z.boolean().default(true).describe("Include AI-generated descriptions"),
      detectStandards: z.boolean().default(true).describe("Detect ERC standards (ERC20, ERC721, etc.)"),
    },
    async (params: ABIGenerationParams) => {
      const { contractAddress, network, includeDescriptions, detectStandards } = params
      try {
        // Process payment
        const paymentService = getUCAIPaymentService()
        const paymentResult = await paymentService.processPayment(
          "abi_generation",
          UCAI_PRICING.ABI_GENERATION
        )

        if (!paymentResult.success) {
          return mcpToolRes.error(`Payment failed: ${paymentResult.error}`, "processing payment")
        }

        // Generate ABI
        const result = await getABIGenerationService().generateABI({
          contractAddress: contractAddress as Address,
          network,
          includeDescriptions,
          detectStandards,
        })

        return mcpToolRes.success({
          abi: result.abi,
          metadata: {
            method: result.method,
            confidence: result.confidence,
            detectedStandards: result.detectedStandards,
            contractType: result.contractType,
            warnings: result.warnings,
          },
          bytecodeSize: result.bytecode.length,
          payment: {
            amount: UCAI_PRICING.ABI_GENERATION,
            token: "USDs",
            paymentId: paymentResult.paymentId,
          },
        })
      } catch (error) {
        return mcpToolRes.error(error, "generating ABI")
      }
    }
  )

  // ============================================================================
  // Utility Tools
  // ============================================================================

  server.tool(
    "ucai_list_tools",
    "List all available UCAI x402 premium tools and their pricing.",
    {},
    async () => {
      return mcpToolRes.success({
        tools: UCAP_TOOLS.map(tool => ({
          id: tool.id,
          name: tool.name,
          description: tool.description,
          priceUsd: tool.priceUsd,
          category: tool.category,
          enabled: tool.enabled,
        })),
        paymentToken: "USDs (Sperax USD)",
        paymentNetwork: "Arbitrum",
        subscriptionInfo: {
          available: true,
          tiers: ["free", "basic", "pro", "enterprise"],
          url: "https://ucai.payments.x402.org/subscribe",
        },
      })
    }
  )

  server.tool(
    "ucai_check_balance",
    "Check your UCAI payment balance and subscription status.",
    {},
    async () => {
      try {
        const paymentService = getUCAIPaymentService()
        const balance = await paymentService.getBalance()
        const subscription = await paymentService.getSubscription()

        return mcpToolRes.success({
          balance,
          subscription,
          pricing: UCAI_PRICING,
        })
      } catch (error) {
        return mcpToolRes.error(error, "checking balance")
      }
    }
  )

  Logger.info("UCAI x402 tools registered successfully")
}

export default registerUCAITools
