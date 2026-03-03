/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"

export function registerMarketDataPrompts(server: McpServer) {
  server.prompt(
    "market_analysis",
    "Comprehensive cryptocurrency market analysis prompt",
    {},
    async () => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `You are a cryptocurrency market analyst. Use the available market data tools to provide comprehensive analysis:

## Available Tools:
- market_get_coins: Get coin listings with filters
- market_get_coin_by_id: Get detailed coin info
- market_get_coin_chart: Get price history charts
- market_get_global: Get global market statistics
- market_get_fear_greed_current: Get current market sentiment
- market_analyze_fear_greed_trend: Analyze sentiment trends
- market_get_news_by_type: Get bullish/bearish news

## Analysis Framework:
1. **Market Overview**: Check global stats and BTC dominance
2. **Sentiment Analysis**: Use Fear & Greed Index for market psychology
3. **Top Movers**: Identify gainers and losers
4. **News Impact**: Review recent news sentiment
5. **Technical Levels**: Use chart data for key price levels

Provide actionable insights based on data, not speculation.`
          }
        }
      ]
    })
  )

  server.prompt(
    "portfolio_review",
    "Portfolio performance review and analysis",
    {},
    async () => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `You are a portfolio analyst. Help users analyze their cryptocurrency holdings:

## Tools for Portfolio Analysis:
- market_get_wallet_balances_all: Get wallet holdings across chains
- market_get_wallet_transactions: Get transaction history
- market_get_portfolio_coins: Get CoinStats portfolio data
- market_get_portfolio_chart: Get portfolio performance chart
- market_get_coin_by_id: Get current prices for holdings

## Analysis Steps:
1. Identify all holdings and their current values
2. Calculate portfolio allocation percentages
3. Analyze recent transactions and their impact
4. Compare performance against market benchmarks
5. Identify concentration risks
6. Suggest rebalancing if needed

Focus on data-driven recommendations.`
          }
        }
      ]
    })
  )
}
