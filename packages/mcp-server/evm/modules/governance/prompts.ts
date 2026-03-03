/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"

export function registerGovernancePrompts(server: McpServer) {
  server.prompt(
    "analyze_proposal",
    "Analyze a governance proposal in detail",
    {
      governorAddress: { description: "Governor contract address", required: true },
      proposalId: { description: "Proposal ID", required: true },
      network: { description: "Network", required: true }
    },
    ({ governorAddress, proposalId, network }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Analyze governance proposal ${proposalId} on ${network} (Governor: ${governorAddress}).

Use the governance tools to:
1. Get proposal details with get_proposal_details
2. Get governance parameters with get_governance_params
3. Analyze voting distribution

Provide:
## Proposal Analysis

### Proposal #${proposalId}

### Current Status
- State: [Pending/Active/etc.]
- Deadline: [Block number and estimated time]

### Voting Summary
| Vote | Count | Percentage |
|------|-------|------------|
| For | | |
| Against | | |
| Abstain | | |

### Quorum Status
- Required: [X tokens]
- Current: [Y tokens]
- Met: [Yes/No]

### Analysis
- Likelihood of passing
- Key considerations
- Voting recommendations`
          }
        }
      ]
    })
  )

  server.prompt(
    "governance_participation",
    "Help user participate in governance",
    {
      walletAddress: { description: "User's wallet address", required: true },
      governorAddress: { description: "Governor contract address", required: true },
      network: { description: "Network", required: true }
    },
    ({ walletAddress, governorAddress, network }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Help ${walletAddress} participate in governance for ${governorAddress} on ${network}.

Check:
1. Current voting power with get_voting_power
2. Governance parameters with get_governance_params
3. Any active proposals

Provide:
## Governance Participation Guide

### Your Voting Power
- Current voting power
- How to increase it (delegate, acquire tokens)

### Active Proposals
[List any active proposals]

### How to Vote
- Step-by-step voting instructions
- Gas considerations

### Best Practices
- Research proposals before voting
- Consider delegation
- Track proposal outcomes`
          }
        }
      ]
    })
  )
}
