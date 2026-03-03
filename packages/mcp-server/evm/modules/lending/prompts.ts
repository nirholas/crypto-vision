/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"

export function registerLendingPrompts(server: McpServer) {
  server.prompt(
    "analyze_lending_position",
    "Analyze a lending position and provide risk assessment",
    {
      walletAddress: { description: "Wallet address", required: true },
      network: { description: "Network", required: true }
    },
    ({ walletAddress, network }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Analyze the lending positions for ${walletAddress} on ${network}.

Use the lending tools to:
1. Get supported protocols with get_lending_protocols
2. Check positions on each protocol with get_lending_position
3. Get current rates with get_lending_rates

Provide:
## Lending Position Analysis

### Wallet: ${walletAddress}

### Positions by Protocol
[For each protocol with a position]
- Total Collateral
- Total Debt
- Health Factor
- Net Position

### Risk Assessment
- Overall health factor
- Liquidation risk level
- Recommendations

### Rate Comparison
- Current supply APYs
- Current borrow APYs
- Optimization opportunities`
          }
        }
      ]
    })
  )

  server.prompt(
    "optimize_lending_strategy",
    "Help optimize lending and borrowing strategy",
    {
      goal: { description: "User's goal (e.g., maximize yield, minimize risk)", required: true },
      network: { description: "Network", required: true }
    },
    ({ goal, network }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Help me optimize my lending strategy on ${network} with the goal: ${goal}

Compare rates across protocols and provide:
1. Best supply rates for different assets
2. Lowest borrow rates
3. Recommended leverage strategies (if appropriate)
4. Risk considerations for each option`
          }
        }
      ]
    })
  )
}
