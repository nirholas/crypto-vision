/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"

export function registerSecurityPrompts(server: McpServer) {
  server.prompt(
    "security_audit",
    "Perform a comprehensive security audit on a token or contract",
    {
      contractAddress: { description: "Contract address to audit", required: true },
      network: { description: "Network", required: true }
    },
    ({ contractAddress, network }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Perform a comprehensive security audit on contract ${contractAddress} on ${network}.

Use the security tools to:
1. Analyze token security with analyze_token_security
2. Verify contract code with verify_contract
3. Check address type with check_address_type
4. Review any transaction data if available

Provide:
## Security Audit Report

### Contract: ${contractAddress}
### Network: ${network}

### Risk Assessment
| Category | Risk Level | Details |
|----------|------------|---------|
[Risk breakdown by category]

### Findings
#### Critical
[Any critical security issues]

#### High
[High severity issues]

#### Medium
[Medium severity issues]

#### Low
[Low severity issues]

### Code Analysis
- Contract type (token, proxy, etc.)
- Ownership status
- Upgrade capabilities

### Recommendations
1. [Specific recommendations]

### Conclusion
[Overall assessment and safety rating]`
          }
        }
      ]
    })
  )

  server.prompt(
    "wallet_security_review",
    "Review wallet security including approvals and interaction history",
    {
      walletAddress: { description: "Wallet address to review", required: true },
      network: { description: "Network", required: true }
    },
    ({ walletAddress, network }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Perform a security review of wallet ${walletAddress} on ${network}.

Analyze:
1. Token approval risks using check_approval_risks
2. Address type verification
3. Recent transaction patterns

Provide:
## Wallet Security Review

### Wallet: ${walletAddress}

### Approval Analysis
- Total active approvals
- Unlimited approvals (high risk)
- Approved spenders

### Recommendations
- Approvals to revoke
- Security best practices
- Risk mitigation steps`
          }
        }
      ]
    })
  )
}
