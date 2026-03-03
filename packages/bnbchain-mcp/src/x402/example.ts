/**
 * Example: Adding x402 payments to existing tools
 * 
 * Before:
 * ```typescript
 * server.tool("get_price", "Get token price", { symbol }, async ({ symbol }) => {
 *   const price = await fetchPrice(symbol)
 *   return { content: [{ type: "text", text: price }] }
 * })
 * ```
 * 
 * After (with x402):
 * ```typescript
 * import { withX402, pricingInfo } from "./x402/index.js"
 * 
 * server.tool(
 *   "get_price_premium",
 *   `Get token price with advanced analytics. ${pricingInfo({ price: "0.001", token: "USDC" })}`,
 *   { symbol },
 *   withX402(
 *     async ({ symbol }) => {
 *       const price = await fetchPrice(symbol)
 *       const analysis = await getAdvancedAnalysis(symbol)
 *       return { content: [{ type: "text", text: JSON.stringify({ price, analysis }) }] }
 *     },
 *     { 
 *       price: "0.001", 
 *       token: "USDC",
 *       // Free for basic tokens
 *       freeTier: ({ symbol }) => ["BTC", "ETH"].includes(symbol)
 *     }
 *   )
 * )
 * ```
 */
export {}
