/**
 * x402 Payment Middleware for MCP Tool Calls
 * @description Wraps MCP tools to require x402 payment before execution
 * @author nirholas
 * @license Apache-2.0
 * 
 * Revenue flows:
 * - Free tier: Basic tools (prices, balances)
 * - Paid tier: Advanced tools (security audits, whale tracking, predictions)
 * - Every paid tool call = $0.001 - $0.10 depending on compute
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { Address, Hash } from "viem"
import Logger from "@/utils/logger.js"
import { verifyPaymentForTool, type SupportedChainId } from "./verify.js"

// Chain the tool-payment requirements settle on (Base mainnet, eip155:8453)
const PAYMENT_CHAIN_ID: SupportedChainId = 8453

// Fee recipient address - UPDATE THIS TO YOUR ADDRESS
export const FEE_RECIPIENT = process.env.X402_FEE_RECIPIENT || "0x742d35Cc6634C0532925a3b844Bc9e7595f5bB0D"

// Tool pricing tiers (in USD)
export const TOOL_PRICING: Record<string, number> = {
  // Free tier - basic queries
  "get_eth_balance": 0,
  "get_token_balance": 0,
  "get_gas_price": 0,
  "get_block_number": 0,
  "get_network_info": 0,
  "get_token_price": 0,
  
  // Basic paid tier - $0.001 per call
  "get_transaction": 0.001,
  "get_token_info": 0.001,
  "get_token_holders": 0.001,
  "search_tokens": 0.001,
  "get_token_transfers": 0.001,
  
  // Standard tier - $0.005 per call
  "get_wallet_history": 0.005,
  "get_defi_positions": 0.005,
  "get_nft_holdings": 0.005,
  "analyze_wallet": 0.005,
  "get_yield_opportunities": 0.005,
  
  // Premium tier - $0.01 per call
  "security_audit_token": 0.01,
  "detect_honeypot": 0.01,
  "analyze_contract": 0.01,
  "whale_tracking": 0.01,
  "mev_protection_quote": 0.01,
  
  // Advanced tier - $0.05 per call
  "ai_price_prediction": 0.05,
  "sentiment_analysis": 0.05,
  "portfolio_optimization": 0.05,
  "risk_assessment": 0.05,
  
  // Premium tier - $0.10 per call
  "full_security_report": 0.10,
  "market_intelligence": 0.10,
  "custom_strategy": 0.10,
}

// Default price for unlisted tools
export const DEFAULT_TOOL_PRICE = 0.001

/**
 * Get the price for a tool call
 */
export function getToolPrice(toolName: string): number {
  return TOOL_PRICING[toolName] ?? DEFAULT_TOOL_PRICE
}

/**
 * Check if a tool is free
 */
export function isFreeTool(toolName: string): boolean {
  return getToolPrice(toolName) === 0
}

/**
 * Calculate total revenue from tool calls
 */
export function calculateRevenue(toolCalls: Array<{ tool: string; count: number }>): number {
  return toolCalls.reduce((total, { tool, count }) => {
    return total + (getToolPrice(tool) * count)
  }, 0)
}

/**
 * x402 payment requirement for tool execution
 * Returns payment details if payment is required, null if free
 */
export function getPaymentRequirement(toolName: string): {
  required: boolean
  amount: number
  currency: string
  recipient: string
  network: string
} | null {
  const price = getToolPrice(toolName)
  
  if (price === 0) {
    return null
  }
  
  return {
    required: true,
    amount: price,
    currency: "USDC",
    recipient: FEE_RECIPIENT,
    network: "eip155:8453" // Base mainnet
  }
}

/**
 * Generate x402 payment header for tool call
 */
export function generatePaymentHeader(toolName: string): Record<string, string> {
  const requirement = getPaymentRequirement(toolName)
  
  if (!requirement) {
    return {}
  }
  
  return {
    "X-Payment-Required": "true",
    "X-Payment-Amount": requirement.amount.toString(),
    "X-Payment-Currency": requirement.currency,
    "X-Payment-Recipient": requirement.recipient,
    "X-Payment-Network": requirement.network,
  }
}

/**
 * Verify x402 payment was made.
 *
 * Fails closed: a well-formed transaction hash is NOT sufficient on its own.
 * The proof is verified on-chain (recipient + amount + token + confirmation)
 * via {@link verifyPaymentForTool}. Access is only granted when that on-chain
 * check succeeds. An explicit `X402_ALLOW_UNVERIFIED=true` dev flag can bypass
 * on-chain verification for local development only.
 */
export async function verifyPayment(
  toolName: string,
  paymentProof: string
): Promise<{ valid: boolean; error?: string }> {
  const requirement = getPaymentRequirement(toolName)

  // Free tools don't need payment
  if (!requirement) {
    return { valid: true }
  }

  if (!paymentProof) {
    return {
      valid: false,
      error: `Payment required: ${requirement.amount} ${requirement.currency} to ${requirement.recipient}`
    }
  }

  // Payment proof must be a transaction hash
  if (!/^0x[a-fA-F0-9]{64}$/.test(paymentProof)) {
    return { valid: false, error: "Invalid payment proof format" }
  }

  // Dev-only escape hatch. Never active under production defaults.
  if (process.env.X402_ALLOW_UNVERIFIED === "true") {
    Logger.warn(
      "X402_ALLOW_UNVERIFIED=true — skipping on-chain payment verification (development only)",
      { toolName, paymentProof }
    )
    return { valid: true }
  }

  // Verify the payment on-chain: recipient, amount, token and confirmation.
  try {
    const verification = await verifyPaymentForTool(
      toolName,
      paymentProof as Hash,
      PAYMENT_CHAIN_ID,
      requirement.recipient as Address
    )

    if (!verification.valid) {
      return {
        valid: false,
        error: verification.error ?? "On-chain payment verification failed",
      }
    }

    Logger.info("Payment verified on-chain", {
      toolName,
      paymentProof,
      amount: requirement.amount,
    })
    return { valid: true }
  } catch (error) {
    Logger.error(`x402 Payments: on-chain verification error for ${toolName}: ${error}`)
    return {
      valid: false,
      error: "on-chain verification unavailable",
    }
  }
}

/**
 * Wrap an MCP server to require x402 payments for tool calls
 * Note: This uses internal MCP server APIs and may need updates with new SDK versions
 */
export function wrapServerWithPayments(server: McpServer): McpServer {
  // Store original tool handler - use type assertion for internal API
  const originalSetRequestHandler = (server as any).setRequestHandler?.bind(server)
  
  if (!originalSetRequestHandler) {
    Logger.warn("Server does not support setRequestHandler, payment wrapping skipped")
    return server
  }
  
  // Override to intercept tool calls
  (server as any).setRequestHandler = ((schema: any, handler: any) => {
    if (schema.method === "tools/call") {
      const wrappedHandler = async (request: any, extra: any) => {
        const toolName = request.params?.name
        const paymentProof = request.params?.arguments?._paymentProof
        
        // Check if payment is required
        const requirement = getPaymentRequirement(toolName)
        
        if (requirement) {
          const verification = await verifyPayment(toolName, paymentProof)
          
          if (!verification.valid) {
            return {
              content: [{
                type: "text",
                text: JSON.stringify({
                  error: "Payment required",
                  code: 402,
                  payment: requirement,
                  message: verification.error
                })
              }],
              isError: true
            }
          }
        }
        
        // Execute the tool
        return handler(request, extra)
      }
      
      return originalSetRequestHandler(schema, wrappedHandler)
    }
    
    return originalSetRequestHandler(schema, handler)
  })
  
  return server
}

/**
 * Get pricing summary for all tools
 */
export function getPricingSummary(): Array<{
  tool: string
  price: number
  tier: string
}> {
  const tiers = {
    0: "Free",
    0.001: "Basic",
    0.005: "Standard", 
    0.01: "Premium",
    0.05: "Advanced",
    0.10: "Enterprise"
  }
  
  return Object.entries(TOOL_PRICING).map(([tool, price]) => ({
    tool,
    price,
    tier: tiers[price as keyof typeof tiers] || "Custom"
  }))
}

export default {
  FEE_RECIPIENT,
  TOOL_PRICING,
  getToolPrice,
  isFreeTool,
  getPaymentRequirement,
  verifyPayment,
  wrapServerWithPayments,
  getPricingSummary,
}
