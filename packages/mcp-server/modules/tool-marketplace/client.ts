/**
 * X402 Marketplace Client
 * @description Client for calling paid tools with automatic x402 payment handling
 * @author nirholas
 * @license Apache-2.0
 */

import { toolRegistry } from "./registry.js"
import type { RegisteredTool, ToolUsageRecord } from "./types.js"
import type { Address } from "viem"
import Logger from "@/utils/logger.js"

/**
 * Options for calling a paid tool
 */
export interface CallToolOptions {
  /** Tool ID or name */
  tool: string
  /** Request method */
  method?: "GET" | "POST" | "PUT" | "DELETE"
  /** Request path (appended to tool endpoint) */
  path?: string
  /** Request body */
  body?: unknown
  /** Additional headers */
  headers?: Record<string, string>
  /** Maximum payment allowed (in USD) */
  maxPayment?: string
  /** User address making the call */
  userAddress: Address
  /** Payment callback - called when payment is needed */
  onPayment: (amount: string, recipient: Address, token: string) => Promise<string>
}

/**
 * Result of a paid tool call
 */
export interface CallToolResult {
  /** Whether the call succeeded */
  success: boolean
  /** Response data */
  data?: unknown
  /** Response status code */
  status?: number
  /** Amount paid (if any) */
  amountPaid?: string
  /** Payment transaction hash (if any) */
  txHash?: string
  /** Response time in ms */
  responseTime: number
  /** Error message (if failed) */
  error?: string
}

/**
 * Marketplace client for calling paid tools
 */
export class MarketplaceClient {
  private userAddress: Address
  private defaultMaxPayment: string
  private onPayment: (amount: string, recipient: Address, token: string) => Promise<string>

  constructor(options: {
    userAddress: Address
    defaultMaxPayment?: string
    onPayment: (amount: string, recipient: Address, token: string) => Promise<string>
  }) {
    this.userAddress = options.userAddress
    this.defaultMaxPayment = options.defaultMaxPayment || "1.00"
    this.onPayment = options.onPayment
  }

  /**
   * Call a paid tool with automatic payment handling
   */
  async callTool(options: Omit<CallToolOptions, "userAddress" | "onPayment">): Promise<CallToolResult> {
    const startTime = Date.now()

    try {
      // Resolve tool
      const tool = await this.resolveTool(options.tool)
      if (!tool) {
        throw new Error(`Tool not found: ${options.tool}`)
      }

      // Check tool is active
      if (tool.status !== "active") {
        throw new Error(`Tool is not active: ${tool.status}`)
      }

      // Get price
      const price = tool.pricing.basePrice || "0"
      const maxPayment = options.maxPayment || this.defaultMaxPayment

      // Check price is within limit
      if (parseFloat(price) > parseFloat(maxPayment)) {
        throw new Error(
          `Tool price ($${price}) exceeds maximum allowed ($${maxPayment})`
        )
      }

      // Execute payment if price > 0
      let txHash: string | undefined
      if (parseFloat(price) > 0) {
        const token = tool.pricing.acceptedTokens[0] || "USDs"
        txHash = await this.onPayment(price, tool.owner, token)
        Logger.info(`Payment executed: $${price} to ${tool.owner}, tx: ${txHash}`)
      }

      // Build request URL
      const url = options.path
        ? `${tool.endpoint}${options.path}`
        : tool.endpoint

      // Make request
      const response = await fetch(url, {
        method: options.method || "GET",
        headers: {
          "Content-Type": "application/json",
          ...(txHash ? { "X-Payment-Proof": txHash } : {}),
          ...options.headers,
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
      })

      const responseTime = Date.now() - startTime
      const data = await response.json().catch(() => response.text())

      // Record usage
      if (txHash) {
        await toolRegistry.recordUsage(
          tool.toolId,
          this.userAddress,
          price,
          tool.pricing.acceptedTokens[0] || "USDs",
          txHash,
          responseTime,
          response.ok,
          response.ok ? undefined : String(data)
        )
      }

      return {
        success: response.ok,
        data,
        status: response.status,
        amountPaid: price,
        txHash,
        responseTime,
      }
    } catch (error) {
      const responseTime = Date.now() - startTime
      return {
        success: false,
        responseTime,
        error: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }

  /**
   * Estimate the cost of calling a tool
   */
  async estimateCost(toolIdOrName: string): Promise<{
    tool: string
    price: string
    token: string
    chain: string
  } | null> {
    const tool = await this.resolveTool(toolIdOrName)
    if (!tool) return null

    return {
      tool: tool.name,
      price: tool.pricing.basePrice || "0",
      token: tool.pricing.acceptedTokens[0] || "USDs",
      chain: tool.pricing.supportedChains[0] || "arbitrum",
    }
  }

  /**
   * Batch call multiple tools
   */
  async batchCall(
    calls: Array<Omit<CallToolOptions, "userAddress" | "onPayment">>
  ): Promise<CallToolResult[]> {
    // Execute calls in parallel
    return Promise.all(calls.map(call => this.callTool(call)))
  }

  /**
   * Resolve tool by ID or name
   */
  private async resolveTool(idOrName: string): Promise<RegisteredTool | null> {
    // Try by ID first
    let tool = await toolRegistry.getTool(idOrName)
    if (tool) return tool

    // Try by name
    return toolRegistry.getToolByName(idOrName)
  }
}

/**
 * Create a marketplace client with x402 payment integration
 */
export function createMarketplaceClient(options: {
  userAddress: Address
  defaultMaxPayment?: string
  x402Client: {
    pay: (recipient: Address, amount: string, token?: string) => Promise<{ transaction: { hash: string } }>
  }
}): MarketplaceClient {
  return new MarketplaceClient({
    userAddress: options.userAddress,
    defaultMaxPayment: options.defaultMaxPayment,
    onPayment: async (amount, recipient, token) => {
      const result = await options.x402Client.pay(recipient, amount, token)
      return result.transaction.hash
    },
  })
}
