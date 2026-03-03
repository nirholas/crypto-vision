/**
 * AI Prediction MCP Prompts
 * @description Prompt templates for AI prediction workflows
 * @author nirholas
 * @license Apache-2.0
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { PREDICTION_PRICING, SUPPORTED_ASSETS, TIMEFRAMES } from "./types.js"

/**
 * Register AI Prediction prompts with MCP server
 */
export function registerPredictionPrompts(server: McpServer): void {
  
  // ============================================================================
  // Analysis Prompts
  // ============================================================================
  
  server.prompt(
    "crypto_prediction_analysis",
    "Get a comprehensive AI prediction analysis for a cryptocurrency",
    {
      asset: {
        description: `Cryptocurrency to analyze (${SUPPORTED_ASSETS.join(", ")})`,
        required: true,
      },
      timeframe: {
        description: "Prediction timeframe (1h, 4h, 1d, 1w)",
        required: false,
      },
    },
    async ({ asset, timeframe = "1d" }) => ({
      messages: [{
        role: "user",
        content: {
          type: "text",
          text: `I need a comprehensive AI prediction analysis for ${asset.toUpperCase()}.

Please use the AI Prediction tools to:

1. First, get the full prediction report using \`predict_full_report\` for ${asset} on the ${timeframe} timeframe
2. Analyze the prediction results and provide insights

Format your response as a professional trading analysis with:
- **Summary**: Key prediction direction and confidence
- **Price Targets**: Current price, predicted price, and percentage change
- **Technical Levels**: Support and resistance levels
- **Indicators**: RSI, MACD, and EMA trend analysis
- **Risk/Reward**: Stop loss, take profit, and R:R ratio
- **Recommendation**: Based on the model's confidence level

Cost: $${PREDICTION_PRICING.full} for the full report.

Please proceed with the analysis.`,
        },
      }],
    })
  )
  
  server.prompt(
    "quick_direction_check",
    "Quick check if a crypto is likely to go up or down",
    {
      asset: {
        description: `Cryptocurrency to check (${SUPPORTED_ASSETS.join(", ")})`,
        required: true,
      },
    },
    async ({ asset }) => ({
      messages: [{
        role: "user",
        content: {
          type: "text",
          text: `Quick direction check for ${asset.toUpperCase()}.

Use the \`predict_direction\` tool to get a simple Up/Down/Sideways prediction.

This is the cheapest option at $${PREDICTION_PRICING.direction} - perfect for quick sentiment checks.

Please provide the prediction with a brief interpretation.`,
        },
      }],
    })
  )
  
  // ============================================================================
  // Multi-Asset Prompts
  // ============================================================================
  
  server.prompt(
    "market_scan",
    "Scan multiple cryptocurrencies for trading opportunities",
    {
      assets: {
        description: "Comma-separated list of assets (e.g., BTC,ETH,SOL)",
        required: false,
      },
    },
    async ({ assets = "BTC,ETH,SOL,ARB" }) => ({
      messages: [{
        role: "user",
        content: {
          type: "text",
          text: `Market scan for trading opportunities.

Assets to scan: ${assets}

Please use the \`predict_multi_asset\` tool to get direction predictions for all assets on the 1d timeframe.

Then provide a summary:
1. **Bullish Assets**: List assets predicted to go up
2. **Bearish Assets**: List assets predicted to go down  
3. **Neutral Assets**: List assets predicted to move sideways
4. **Top Opportunity**: Which asset looks most promising and why

Cost: $${PREDICTION_PRICING.bulk_per_asset} per asset (${assets.split(',').length} assets = $${(PREDICTION_PRICING.bulk_per_asset * assets.split(',').length).toFixed(2)} total)`,
        },
      }],
    })
  )
  
  server.prompt(
    "portfolio_outlook",
    "Get AI predictions for a portfolio of cryptocurrencies",
    {
      portfolio: {
        description: "Comma-separated list of holdings (e.g., BTC,ETH,SOL)",
        required: true,
      },
    },
    async ({ portfolio }) => ({
      messages: [{
        role: "user",
        content: {
          type: "text",
          text: `Portfolio outlook analysis.

Portfolio: ${portfolio}

Please analyze my portfolio holdings:

1. Use \`predict_multi_asset\` to get full predictions for all assets on the 1d timeframe
2. Summarize the overall portfolio outlook:
   - How many assets are bullish vs bearish?
   - Which holdings need attention?
   - Overall portfolio sentiment score

3. Provide actionable recommendations:
   - Consider reducing exposure to bearish assets
   - Consider increasing exposure to strong bullish assets
   - Risk management suggestions

Total cost: ~$${(PREDICTION_PRICING.bulk_per_asset * portfolio.split(',').length).toFixed(2)}`,
        },
      }],
    })
  )
  
  // ============================================================================
  // Backtesting Prompts
  // ============================================================================
  
  server.prompt(
    "strategy_backtest",
    "Backtest a trading strategy with AI predictions",
    {
      asset: {
        description: "Asset to backtest",
        required: true,
      },
      strategy: {
        description: "Strategy type (momentum, mean_reversion, trend_following)",
        required: false,
      },
      period: {
        description: "Backtest period (e.g., '2025-01-01 to 2025-12-31')",
        required: false,
      },
    },
    async ({ asset, strategy = "momentum", period = "2025-01-01 to 2025-12-31" }) => {
      const dates = period.split(' to ')
      const startDate = dates[0] || "2025-01-01"
      const endDate = dates[1] || "2025-12-31"
      
      return {
        messages: [{
          role: "user",
          content: {
            type: "text",
            text: `Backtest ${strategy} strategy for ${asset.toUpperCase()}.

Period: ${startDate} to ${endDate}

Please use the \`backtest_strategy\` tool with:
- Asset: ${asset}
- Strategy: ${strategy}
- Start date: ${startDate}
- End date: ${endDate}

Then provide analysis of:
1. **Performance Summary**: Total return, annualized return, Sharpe ratio
2. **Trade Statistics**: Win rate, profit factor, average win/loss
3. **Risk Metrics**: Max drawdown, VaR, volatility
4. **Comparison**: How did it perform vs buy-and-hold?
5. **Verdict**: Is this strategy worth using?

Cost: $${PREDICTION_PRICING.backtest}`,
          },
        }],
      }
    }
  )
  
  server.prompt(
    "compare_strategies",
    "Compare multiple trading strategies via backtesting",
    {
      asset: {
        description: "Asset to test strategies on",
        required: true,
      },
    },
    async ({ asset }) => ({
      messages: [{
        role: "user",
        content: {
          type: "text",
          text: `Compare trading strategies for ${asset.toUpperCase()}.

Please backtest all three main strategies:
1. Momentum strategy
2. Mean reversion strategy  
3. Trend following strategy

Use the \`backtest_strategy\` tool for each (3 calls total).
Period: 2025-01-01 to 2025-12-31

Then provide a comparison:
- **Performance Ranking**: Best to worst by total return
- **Risk-Adjusted Ranking**: Best to worst by Sharpe ratio
- **Best for Bull Market**: Which strategy performs best when price is rising?
- **Best for Bear Market**: Which strategy performs best when price is falling?
- **Recommendation**: Which strategy to use based on current market conditions

Total cost: $${(PREDICTION_PRICING.backtest * 3).toFixed(2)} (3 backtests)`,
        },
      }],
    })
  )
  
  // ============================================================================
  // Educational Prompts
  // ============================================================================
  
  server.prompt(
    "prediction_pricing_guide",
    "Learn about AI prediction pricing and options",
    {},
    async () => ({
      messages: [{
        role: "user",
        content: {
          type: "text",
          text: `Please use the \`prediction_pricing\` tool to show me all available AI prediction services and their costs.

Then explain:
1. Which prediction type is best for different use cases
2. How to get the most value for my money
3. When to use bulk predictions vs individual
4. How the backtesting service works

I want to understand all my options before making predictions.`,
        },
      }],
    })
  )
  
  server.prompt(
    "how_predictions_work",
    "Learn how the LSTM AI predictions work",
    {},
    async () => ({
      messages: [{
        role: "user",
        content: {
          type: "text",
          text: `Explain how the AI prediction system works.

Please cover:
1. **LSTM Model**: What is LSTM and why is it good for price prediction?
2. **Input Features**: What data does the model use?
   - Technical indicators (RSI, MACD, EMA)
   - Volume analysis
   - Price patterns
3. **Prediction Types**:
   - Direction: How does it determine up/down/sideways?
   - Target: How does it calculate specific price targets?
   - Confidence: What factors affect model confidence?
4. **Timeframes**: How does prediction accuracy vary by timeframe?
5. **Limitations**: What are the model's limitations?

Also show the supported assets using \`prediction_assets\` tool.

This is educational - no predictions needed (free).`,
        },
      }],
    })
  )
  
  // ============================================================================
  // Trading Workflow Prompts
  // ============================================================================
  
  server.prompt(
    "trade_setup",
    "Get a complete trade setup with AI predictions",
    {
      asset: {
        description: "Asset to trade",
        required: true,
      },
      position_size: {
        description: "Position size in USD (e.g., 1000)",
        required: false,
      },
    },
    async ({ asset, position_size = "1000" }) => ({
      messages: [{
        role: "user",
        content: {
          type: "text",
          text: `Generate a complete trade setup for ${asset.toUpperCase()}.

Position size: $${position_size}

Please:
1. Use \`predict_full_report\` to get the complete analysis
2. Based on the prediction, provide:

**Trade Setup:**
- Direction: Long or Short (based on prediction)
- Entry Price: Current market price
- Stop Loss: From risk/reward analysis
- Take Profit: From price target
- Position Size: $${position_size}
- Risk Amount: Calculate based on stop loss distance

**Risk Management:**
- Max loss in USD if stopped out
- Risk as percentage of position
- Risk/Reward ratio

**Execution Plan:**
- Entry conditions
- When to take partial profits
- When to move stop to breakeven

Cost: $${PREDICTION_PRICING.full}

⚠️ This is AI-generated analysis, not financial advice. Always do your own research.`,
        },
      }],
    })
  )
  
  server.prompt(
    "daily_briefing",
    "Get a daily market briefing with AI predictions",
    {},
    async () => ({
      messages: [{
        role: "user",
        content: {
          type: "text",
          text: `Generate a daily market briefing with AI predictions.

Please analyze the top 5 cryptocurrencies:
1. Use \`predict_multi_asset\` for BTC, ETH, SOL, ARB, OP on the 1d timeframe with "full" type

Then format as a professional daily briefing:

**📊 Daily Crypto Briefing - ${new Date().toLocaleDateString()}**

**Market Overview:**
- Overall market sentiment (mostly bullish/bearish/mixed)
- Number of assets in each direction

**Top Movers:**
For each asset, show:
- Direction prediction (🟢 Bullish / 🔴 Bearish / ⚪ Sideways)
- Confidence level
- Key price levels

**Trading Opportunities:**
- Highlight the strongest signals
- Note any high-confidence setups

**Risk Alerts:**
- Any concerning patterns
- Assets to watch carefully

Total cost: ~$${(PREDICTION_PRICING.bulk_per_asset * 5).toFixed(2)}`,
        },
      }],
    })
  )
}
