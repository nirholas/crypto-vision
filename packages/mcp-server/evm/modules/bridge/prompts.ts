/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"

export function registerBridgePrompts(server: McpServer) {
  server.prompt(
    "analyze_bridge_route",
    "Analyze and recommend the best bridge route for a cross-chain transfer",
    {
      token: { description: "Token to bridge", required: true },
      amount: { description: "Amount to bridge", required: true },
      sourceChain: { description: "Source blockchain", required: true },
      destChain: { description: "Destination blockchain", required: true }
    },
    ({ token, amount, sourceChain, destChain }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Analyze the best bridge options for transferring ${amount} of token ${token} from ${sourceChain} to ${destChain}.

Please use the available bridge tools to:
1. Get quotes from all supported bridges using get_bridge_quote
2. Compare fees across bridges using get_bridge_fees
3. Check estimated transfer times with estimate_bridge_time
4. List all supported bridges for this route with get_supported_bridges

Provide a comprehensive recommendation considering:
- Total fees (protocol + LP + gas)
- Transfer speed
- Security/reliability of the bridge
- Historical success rate
- Liquidity depth

Format your response as:
## Bridge Route Analysis
### Route: ${sourceChain} → ${destChain}
### Token: ${token}
### Amount: ${amount}

#### Available Bridges
[Table of bridges with fees, times, and scores]

#### Recommendation
[Your recommended bridge with reasoning]

#### Risk Considerations
[Any risks or considerations for this transfer]`
          }
        }
      ]
    })
  )

  server.prompt(
    "bridge_portfolio",
    "Help user bridge assets across multiple chains for portfolio optimization",
    {
      wallet: { description: "Wallet address to analyze", required: true },
      targetChain: { description: "Target chain to consolidate assets", required: true }
    },
    ({ wallet, targetChain }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Analyze the portfolio of wallet ${wallet} and provide recommendations for consolidating assets to ${targetChain}.

Use available tools to:
1. Check token balances across all supported chains
2. Get bridge quotes for each asset
3. Calculate total fees for consolidation
4. Estimate total time for all transfers

Provide:
## Portfolio Consolidation Plan

### Current Holdings
[List assets on each chain]

### Bridge Plan
[Step-by-step plan to bridge assets to ${targetChain}]

### Fee Summary
- Total bridge fees
- Total gas fees
- Net value after bridging

### Execution Order
[Recommended order to execute bridges for efficiency]

### Warnings
[Any tokens that cannot be bridged or have low liquidity]`
          }
        }
      ]
    })
  )
}
