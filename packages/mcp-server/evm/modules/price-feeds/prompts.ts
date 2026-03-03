/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"

export function registerPriceFeedsPrompts(server: McpServer) {
  server.prompt(
    "price_analysis",
    "Get comprehensive price analysis for assets",
    {
      assets: { description: "Comma-separated list of assets (e.g., ETH, BTC, USDC)", required: true },
      network: { description: "Network to check prices on", required: true }
    },
    ({ assets, network }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Provide price analysis for ${assets} on ${network}.

Use the price feed tools to:
1. Get available price feeds with get_available_price_feeds
2. Get current prices with get_multiple_prices or get_chainlink_price
3. Check feed health with check_price_feed_health

Provide:
## Price Analysis Report

### Current Prices
| Asset | Price (USD) | Last Updated | Feed Health |
|-------|-------------|--------------|-------------|
[Fill in data]

### Feed Status
- Any stale feeds
- Any feeds with issues
- Reliability assessment

### Notes
- Price source (Chainlink)
- Data freshness`
          }
        }
      ]
    })
  )

  server.prompt(
    "monitor_price_feeds",
    "Set up monitoring recommendations for price feeds",
    {
      protocol: { description: "Protocol that depends on these feeds", required: true },
      assets: { description: "Assets to monitor", required: true }
    },
    ({ protocol, assets }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Help set up price feed monitoring for ${protocol} using ${assets}.

Provide recommendations for:
1. Which feeds to monitor
2. Acceptable staleness thresholds
3. Alert conditions
4. Backup data sources
5. Risk mitigation strategies`
          }
        }
      ]
    })
  )
}
