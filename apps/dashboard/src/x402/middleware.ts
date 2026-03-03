/**
 * x402 Payment Middleware
 * @description Wraps MCP tools with optional x402 payment gating
 * 
 * @example
 * ```typescript
 * import { withX402 } from "./x402/middleware.js"
 * 
 * server.tool(
 *   "premium_analysis",
 *   "AI market analysis (0.01 USDC)",
 *   { symbol: z.string() },
 *   withX402(
 *     async ({ symbol }) => {
 *       // Your tool logic
 *       return { content: [{ type: "text", text: result }] }
 *     },
 *     { price: "0.01", token: "USDC", chain: "base" }
 *   )
 * )
 * ```
 */

export interface X402PaymentConfig {
  /** Price in token units (e.g., "0.01" for 1 cent) */
  price: string
  /** Token symbol: USDC, USDs, etc. */
  token: string
  /** Chain: base, arbitrum, ethereum */
  chain?: string
  /** Recipient address (defaults to env TOOL_PAYMENT_ADDRESS) */
  recipient?: string
  /** Enable free tier for certain conditions */
  freeTier?: (args: any) => boolean
}

type ToolHandler<T> = (args: T) => Promise<{ content: Array<{ type: string; text: string }> }>

/**
 * Wrap a tool handler with x402 payment verification
 */
export function withX402<T>(
  handler: ToolHandler<T>,
  config: X402PaymentConfig
): ToolHandler<T> {
  return async (args: T) => {
    // Check free tier
    if (config.freeTier && config.freeTier(args)) {
      return handler(args)
    }

    // Check if x402 is enabled
    const x402Enabled = process.env.X402_ENABLED === "true"
    if (!x402Enabled) {
      // Passthrough if x402 not configured
      return handler(args)
    }

    // TODO: Implement actual x402 payment verification
    // For now, this is a placeholder that shows the pricing
    console.log(`[x402] Tool requires payment: ${config.price} ${config.token}`)
    
    // Execute the actual handler
    return handler(args)
  }
}

/**
 * Create pricing info for tool description
 */
export function pricingInfo(config: X402PaymentConfig): string {
  return `💰 ${config.price} ${config.token} per call`
}

/**
 * Check if user has active subscription
 */
export async function hasActiveSubscription(address: string): Promise<boolean> {
  // TODO: Implement subscription checking via x402
  return false
}

export default withX402
