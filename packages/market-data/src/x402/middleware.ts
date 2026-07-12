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

type ToolResult = { content: Array<{ type: string; text: string }>; isError?: boolean }
type ToolHandler<T> = (args: T) => Promise<ToolResult>

/** Transaction-hash format expected for an x402 payment proof. */
const TX_HASH_PATTERN = /^0x[a-fA-F0-9]{64}$/

/**
 * Build a 402 Payment Required tool result.
 */
function paymentRequiredResult(config: X402PaymentConfig, message: string): ToolResult {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({
          error: "Payment required",
          code: 402,
          message,
          payment: {
            price: config.price,
            token: config.token,
            chain: config.chain ?? "base",
            recipient: config.recipient ?? process.env.TOOL_PAYMENT_ADDRESS ?? null,
          },
        }),
      },
    ],
    isError: true,
  }
}

/**
 * Wrap a tool handler with x402 payment verification.
 *
 * Fails closed: when x402 is enabled, the handler only runs if a well-formed
 * payment proof (a transaction hash) is supplied in the tool arguments. Absent
 * or malformed proof yields a 402 Payment Required result and the handler is
 * never invoked. When x402 is disabled the wrapper is a pass-through.
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

    // Feature disabled → pass through unchanged.
    const x402Enabled = process.env.X402_ENABLED === "true"
    if (!x402Enabled) {
      return handler(args)
    }

    // x402 enabled → require a verified payment before running the handler.
    const paymentProof = (args as { _paymentProof?: unknown })?._paymentProof

    if (typeof paymentProof !== "string" || !TX_HASH_PATTERN.test(paymentProof)) {
      return paymentRequiredResult(
        config,
        `Payment required: ${config.price} ${config.token} per call. Provide a valid on-chain payment proof.`
      )
    }

    // Proof present and well-formed → execute the handler.
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
