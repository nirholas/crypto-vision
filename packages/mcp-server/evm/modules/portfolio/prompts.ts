/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"

export function registerPortfolioPrompts(server: McpServer) {
  server.prompt(
    "full_portfolio_analysis",
    "Comprehensive portfolio analysis across chains",
    {
      address: { description: "Wallet address to analyze", required: true }
    },
    ({ address }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Perform a comprehensive portfolio analysis for ${address}.

Use the portfolio tools to:
1. Get multi-chain portfolio overview
2. Check activity level
3. Calculate allocation if values are available

Provide:
## Portfolio Analysis

### Wallet: ${address}

### Holdings by Chain
[Table of holdings per chain]

### Asset Allocation
[Breakdown of major holdings]

### Activity Assessment
- Transaction history
- Most active chains
- Usage patterns

### Recommendations
- Diversification suggestions
- Gas optimization (consolidation?)
- Security considerations`
          }
        }
      ]
    })
  )

  server.prompt(
    "portfolio_rebalance",
    "Get rebalancing recommendations for a portfolio",
    {
      address: { description: "Wallet address", required: true },
      targetAllocation: { description: "Target allocation (e.g., '50% ETH, 30% stables, 20% others')", required: true }
    },
    ({ address, targetAllocation }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Help rebalance the portfolio at ${address} to achieve: ${targetAllocation}

Analyze current holdings and provide:
1. Current vs target allocation comparison
2. Specific trades needed
3. Estimated gas costs
4. Best execution strategy (which DEXs, timing)`
          }
        }
      ]
    })
  )
}
