/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"

export function registerSocialPrompts(server: McpServer) {
  server.prompt(
    "analyze_social_sentiment",
    "Comprehensive social sentiment analysis for a cryptocurrency",
    {
      symbol: { description: "Coin symbol (e.g., 'BTC', 'ETH')", required: true }
    },
    ({ symbol }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Analyze social sentiment for: ${symbol}

Use these tools to gather comprehensive data:

1. **Sentiment Metrics**
   - social_get_coin_sentiment: Get sentiment score and social metrics
   - social_get_coin_social_volume: Track social mention volume

2. **Influencer Activity**
   - social_get_influencers: Find top influencers discussing ${symbol}
   - social_get_trending_posts: See viral content

3. **Community Health**
   - social_get_social_dominance: Market share of social mentions
   - Compare with market cap dominance

Provide analysis covering:
- Overall sentiment (bullish/bearish/neutral)
- Social volume trend (increasing/decreasing)
- Key influencer opinions
- Community engagement metrics
- Correlation with price action
- Warning signs or opportunities`
          }
        }
      ]
    })
  )

  server.prompt(
    "track_crypto_influencers",
    "Track and analyze crypto influencers",
    {
      topic: { description: "Topic or coin to track (e.g., 'defi', 'BTC')", required: false }
    },
    ({ topic = "crypto" }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Track crypto influencers for topic: ${topic}

Use social_get_influencers and social_get_creator_stats to:

1. **Find Top Influencers**
   - Engagement rates
   - Follower counts
   - Content quality

2. **Analyze Their Activity**
   - Recent posts
   - Sentiment of content
   - Accuracy of calls

3. **Create Influencer Report**
| Influencer | Followers | Engagement | Sentiment | Recent Topic |
|------------|-----------|------------|-----------|--------------|

Consider:
- Track record accuracy
- Potential conflicts of interest
- Audience quality vs quantity`
          }
        }
      ]
    })
  )

  server.prompt(
    "social_trend_analysis",
    "Analyze trending topics in crypto social media",
    {},
    () => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Analyze current trending topics in crypto social media

Use these tools:
1. social_get_trending_topics - What's trending now
2. social_get_trending_coins - Which coins are being discussed
3. social_get_social_feed - Recent social content

Provide:
## Trending Topics Report

### Hot Topics
| Topic | Volume | Sentiment | Trend |
|-------|--------|-----------|-------|

### Rising Coins (Social)
| Coin | Social Volume | 24h Change | Sentiment |
|------|---------------|------------|-----------|

### Key Narratives
- What themes are emerging?
- Any FUD or FOMO signals?
- Correlation with market moves?

### Actionable Insights
- Opportunities
- Risks
- Watch list`
          }
        }
      ]
    })
  )

  server.prompt(
    "social_vs_price",
    "Compare social metrics with price action",
    {
      symbol: { description: "Coin symbol", required: true },
      timeframe: { description: "Analysis timeframe (7d, 30d, 90d)", required: false }
    },
    ({ symbol, timeframe = "30d" }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Analyze social metrics vs price for ${symbol} over ${timeframe}

Gather data:
1. social_get_coin_sentiment - Social metrics
2. social_get_coin_time_series - Historical social data
3. Compare with price data from market tools

Analysis:
- Does social volume lead or lag price?
- Sentiment divergence from price
- Unusual activity patterns

Create correlation report:
## ${symbol} Social vs Price Analysis

### Correlation Summary
- Social volume vs Price: [correlation]
- Sentiment vs Price: [correlation]

### Notable Patterns
- [pattern 1]
- [pattern 2]

### Predictive Signals
- [signal 1]
- [signal 2]`
          }
        }
      ]
    })
  )
}
