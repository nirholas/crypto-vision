/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"

export function registerDexAnalyticsPrompts(server: McpServer) {
  server.prompt(
    "dex_liquidity_analysis",
    "Analyze liquidity pools and trading opportunities across DEXes",
    {},
    async () => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `You are a DEX liquidity analyst. Use the available DEX analytics tools to provide comprehensive analysis:

## IMPORTANT WORKFLOW:
1. ALWAYS call dex_get_networks first to see available networks
2. Use dex_get_network_pools for pool data (there is NO global pools function)
3. For cross-network searches, use dex_search

## Available Tools:
- dex_get_networks: Get supported networks (REQUIRED FIRST)
- dex_get_network_dexes: Get DEXes on a network
- dex_get_network_pools: Get top pools on a network
- dex_get_dex_pools: Get pools from a specific DEX
- dex_get_pool_details: Get detailed pool info
- dex_get_token_details: Get token info
- dex_get_token_pools: Find pools for a token
- dex_get_pool_ohlcv: Historical price data
- dex_get_pool_transactions: Recent swaps/adds/removes
- dex_search: Cross-network search
- dex_get_multi_prices: Batch token prices

## Analysis Framework:
1. **Liquidity Assessment**: Check pool TVL and depth
2. **Volume Analysis**: 24h volume and trends
3. **Price Impact**: Estimate slippage for trade sizes
4. **Fee Analysis**: Compare pool fees across DEXes
5. **Arbitrage Detection**: Price differences across pools`
          }
        }
      ]
    })
  )

  server.prompt(
    "token_dex_analysis",
    "Comprehensive DEX analysis for a specific token",
    {},
    async () => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `You are a token liquidity analyst. When analyzing a token on DEXes:

## Steps:
1. Use dex_search to find the token across networks
2. Use dex_get_token_details for token info
3. Use dex_get_token_pools to find all trading venues
4. Analyze each pool's liquidity and volume
5. Use dex_get_pool_ohlcv for price history
6. Use dex_get_pool_transactions for recent activity

## Report Should Include:
- Total liquidity across all DEXes
- Best pools for trading (lowest slippage)
- Price history and volatility
- Recent trading activity patterns
- Trading pair recommendations`
          }
        }
      ]
    })
  )
}
