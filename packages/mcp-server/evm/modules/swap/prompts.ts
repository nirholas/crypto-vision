/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"

export function registerSwapPrompts(server: McpServer) {
  server.prompt(
    "analyze_swap",
    "Analyze a potential token swap and provide recommendations",
    {
      tokenIn: { description: "Token to sell", required: true },
      tokenOut: { description: "Token to buy", required: true },
      amount: { description: "Amount to swap", required: true },
      network: { description: "Network to swap on", required: false }
    },
    async ({ tokenIn, tokenOut, amount, network }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Analyze this swap:
- Selling: ${tokenIn}
- Buying: ${tokenOut}  
- Amount: ${amount}
- Network: ${network || "ethereum"}

Please:
1. Get quotes from multiple DEXs
2. Calculate price impact
3. Check if there's sufficient liquidity
4. Recommend the best route
5. Warn about any risks (high slippage, low liquidity, etc.)`
          }
        }
      ]
    })
  )

  server.prompt(
    "optimize_swap_route",
    "Find the most optimal route for a large swap to minimize price impact",
    {
      tokenIn: { description: "Token to sell", required: true },
      tokenOut: { description: "Token to buy", required: true },
      amount: { description: "Total amount to swap", required: true }
    },
    async ({ tokenIn, tokenOut, amount }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `I need to swap a large amount of tokens and want to minimize price impact:
- Selling: ${tokenIn}
- Buying: ${tokenOut}
- Total Amount: ${amount}

Please:
1. Check if splitting across multiple DEXs would be better
2. Consider if using intermediate tokens would help
3. Calculate optimal split if needed
4. Provide step-by-step execution plan`
          }
        }
      ]
    })
  )
}
