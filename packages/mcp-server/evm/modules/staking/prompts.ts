/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"

export function registerStakingPrompts(server: McpServer) {
  server.prompt(
    "analyze_staking_opportunity",
    "Analyze a staking opportunity for risks and rewards",
    {
      stakingContract: { description: "Staking contract address", required: true },
      network: { description: "Network", required: true }
    },
    ({ stakingContract, network }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Analyze the staking opportunity at ${stakingContract} on ${network}.

Use available tools to:
1. Get staking APR with get_staking_apr
2. Check pool size and details
3. Analyze contract security with security tools

Provide:
## Staking Opportunity Analysis

### Contract: ${stakingContract}
### Network: ${network}

### Returns
- Estimated APR
- Reward token
- Reward frequency

### Pool Metrics
- Total value locked
- Number of stakers (if available)
- Historical performance

### Risks
- Smart contract risk
- Impermanent loss (if applicable)
- Lock-up periods
- Centralization concerns

### Recommendation
[Your recommendation on whether to stake]`
          }
        }
      ]
    })
  )

  server.prompt(
    "optimize_staking_strategy",
    "Help optimize staking positions across protocols",
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
            text: `Help optimize staking strategy for ${walletAddress} on ${network}.

Analyze:
1. Current staking positions
2. Available staking opportunities
3. Compare APRs across protocols

Provide recommendations for:
- Rebalancing existing positions
- New opportunities to consider
- Risk diversification
- Gas-efficient strategies`
          }
        }
      ]
    })
  )
}
