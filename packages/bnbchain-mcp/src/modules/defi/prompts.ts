/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"

export function registerDefiPrompts(server: McpServer) {
  server.prompt(
    "analyze_defi_protocol",
    "Comprehensive analysis of a DeFi protocol",
    {
      protocol: { description: "Protocol name (e.g., 'aave', 'uniswap')", required: true }
    },
    ({ protocol }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Analyze the DeFi protocol: ${protocol}

Use these tools to gather comprehensive data:

1. **Protocol Overview**
   - defi_get_protocol: Get TVL, chains, category
   - defi_get_protocol_tvl: Historical TVL data

2. **Financial Metrics**
   - defi_get_protocol_fees: Revenue and fee data
   - defi_get_yields: Available yield opportunities

3. **Chain Distribution**
   - defi_get_chains: Where is it deployed?
   - Compare TVL across chains

Provide analysis covering:
- Total Value Locked and trend
- Revenue model and fee structure
- Chain distribution and growth
- Competitive positioning
- Risk factors`
          }
        }
      ]
    })
  )

  server.prompt(
    "compare_defi_protocols",
    "Compare multiple DeFi protocols",
    {
      protocols: { description: "Comma-separated protocol names", required: true },
      metric: { description: "Primary comparison metric (tvl, fees, yields)", required: false }
    },
    ({ protocols, metric = "tvl" }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Compare these DeFi protocols: ${protocols}
Primary metric: ${metric}

For each protocol, gather:
1. Current TVL (defi_get_protocol)
2. Fee/revenue data (defi_get_protocol_fees)
3. Available yields (defi_get_yields)

Create comparison table:
| Protocol | TVL | 24h Change | Chains | Category | Fees (24h) |
|----------|-----|------------|--------|----------|------------|

Analysis points:
- Market share comparison
- Growth trajectories
- Risk/reward profiles
- Unique features`
          }
        }
      ]
    })
  )

  server.prompt(
    "find_best_yields",
    "Find the best yield opportunities in DeFi",
    {
      minTvl: { description: "Minimum TVL in USD (default: 1000000)", required: false },
      chain: { description: "Specific chain to filter (optional)", required: false }
    },
    ({ minTvl = "1000000", chain }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Find the best yield opportunities in DeFi

Filters:
- Minimum TVL: $${minTvl}
${chain ? `- Chain: ${chain}` : '- All chains'}

Use defi_get_yields to search for opportunities.

Present results as:
| Pool | Protocol | Chain | APY | TVL | Risk Level |
|------|----------|-------|-----|-----|------------|

Consider:
- APY sustainability (avoid unsustainable farms)
- Protocol security (audits, track record)
- Impermanent loss risk for LPs
- Smart contract risk
- Liquidity depth`
          }
        }
      ]
    })
  )

  server.prompt(
    "chain_defi_overview",
    "Overview of DeFi ecosystem on a specific chain",
    {
      chain: { description: "Chain name (e.g., 'ethereum', 'arbitrum')", required: true }
    },
    ({ chain }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Provide a DeFi ecosystem overview for: ${chain}

Gather data using:
1. defi_get_chain_tvl - Total chain TVL
2. defi_get_protocols - Top protocols on this chain
3. defi_get_yields - Yield opportunities

Report structure:
## ${chain} DeFi Overview

### TVL Summary
- Current TVL
- Historical trend

### Top Protocols
| Rank | Protocol | Category | TVL | Share |
|------|----------|----------|-----|-------|

### Yield Opportunities
Best yields available on ${chain}

### Ecosystem Analysis
- Strengths
- Weaknesses
- Growth potential`
          }
        }
      ]
    })
  )
}
