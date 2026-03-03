/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"

export function registerEventsPrompts(server: McpServer) {
  server.prompt(
    "analyze_contract_activity",
    "Analyze event activity for a contract to understand usage patterns",
    {
      contractAddress: { description: "Contract address to analyze", required: true },
      network: { description: "Network", required: true }
    },
    ({ contractAddress, network }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Analyze the event activity for contract ${contractAddress} on ${network}.

Use the events tools to:
1. Get recent contract logs with get_contract_logs
2. Identify the most common event types
3. Track ERC20 transfers if applicable with get_erc20_transfers
4. Check approval patterns with get_approval_events

Provide:
## Contract Activity Analysis

### Overview
- Contract address
- Network
- Block range analyzed

### Event Summary
| Event Type | Count | % of Total |
|------------|-------|------------|
[Event breakdown]

### Transfer Activity
- Total transfers
- Unique senders/receivers
- Volume patterns

### Notable Patterns
- High activity periods
- Large transactions
- Unusual patterns

### Recommendations
- Security considerations
- Monitoring suggestions`
          }
        }
      ]
    })
  )

  server.prompt(
    "track_wallet_activity",
    "Track all event activity for a specific wallet",
    {
      walletAddress: { description: "Wallet address to track", required: true },
      network: { description: "Network", required: true }
    },
    ({ walletAddress, network }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Track all event activity for wallet ${walletAddress} on ${network}.

Search for:
1. ERC20 transfers (sent and received)
2. Approval events granted by this wallet
3. Any other relevant events

Provide a timeline of activity and identify:
- Most interacted contracts
- Token transfer patterns
- Active approvals that might be risky
- Overall activity level`
          }
        }
      ]
    })
  )
}
