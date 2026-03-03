/**
 * Premium News Prompts
 * @description AI prompts for premium crypto news features with x402 payments
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"

import { PREMIUM_PRICING, REVENUE_SPLIT } from "./premium-tools.js"

export function registerPremiumNewsPrompts(server: McpServer): void {
  // =========================================================================
  // Prompt 1: Premium News Intelligence Report
  // =========================================================================
  server.prompt(
    "premium_news_intelligence",
    "Generate a comprehensive market intelligence report using premium news features",
    {
      topic: z
        .string()
        .describe("Focus topic (e.g., 'bitcoin etf', 'defi regulation', 'ethereum merge')"),
      depth: z
        .enum(["quick", "standard", "deep"])
        .default("standard")
        .describe("Analysis depth"),
      includeHistorical: z
        .boolean()
        .default(false)
        .describe("Include historical context (uses historical search)"),
    },
    ({ topic, depth, includeHistorical }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Generate a comprehensive market intelligence report on "${topic}" using premium news features.

## Instructions

### Step 1: Gather Recent News
Use \`get_crypto_news\` and \`search_crypto_news\` (keywords: "${topic}") to get the latest articles.

### Step 2: AI Analysis (Premium)
For the top ${depth === "quick" ? "3" : depth === "standard" ? "5" : "10"} most relevant articles:
- Use \`summarize_article\` to get AI summaries ($0.001/article)
- Use \`analyze_news_impact\` to understand market implications ($0.001/article)

${
  includeHistorical
    ? `### Step 3: Historical Context (Premium)
Use \`search_historical_news\` to find related news from the past 6 months ($0.01/query)`
    : ""
}

## Output Format

# 📊 Market Intelligence Report: ${topic}

## Executive Summary
[2-3 sentence overview of current situation]

## Key Developments
For each major story:
- **Headline**: [Title]
- **AI Summary**: [From summarize_article]
- **Market Impact**: [From analyze_news_impact]
- **Sentiment**: [Bullish/Bearish/Neutral with confidence %]

## Market Implications
- Short-term outlook (24-48 hours)
- Medium-term outlook (1-2 weeks)
- Key risks to monitor

## Affected Assets
| Asset | Impact | Magnitude | Reasoning |
|-------|--------|-----------|-----------|
[From impact analysis]

${
  includeHistorical
    ? `## Historical Context
[Insights from historical search]`
    : ""
}

## Pricing Transparency
Show total cost of premium features used.
`,
          },
        },
      ],
    })
  )

  // =========================================================================
  // Prompt 2: Setup Real-time Monitoring
  // =========================================================================
  server.prompt(
    "setup_news_monitoring",
    "Configure comprehensive real-time news monitoring with alerts",
    {
      coins: z
        .string()
        .describe("Coins to monitor (comma-separated, e.g., 'BTC,ETH,SOL')"),
      keywords: z
        .string()
        .optional()
        .describe("Additional keywords to track"),
      notificationChannel: z
        .enum(["discord", "telegram", "webhook"])
        .describe("Primary notification channel"),
    },
    ({ coins, keywords, notificationChannel }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Help me set up comprehensive real-time crypto news monitoring.

## Configuration

**Coins to Monitor**: ${coins}
**Additional Keywords**: ${keywords || "None specified"}
**Notification Channel**: ${notificationChannel}

## Instructions

### Step 1: Check Premium Status
Use \`get_premium_news_status\` to verify x402 is configured.

### Step 2: Subscribe to Firehose (Optional)
If user wants real-time WebSocket feed:
- Use \`subscribe_news_firehose\` ($0.10/day)
- Sources: All available sources
- Duration: Based on user preference

### Step 3: Configure Breaking Alerts
Use \`configure_breaking_alerts\` ($0.05/day):
- Coins: ${coins.split(",").map((c) => c.trim()).join(", ")}
- Keywords: ${keywords || "Auto-generate based on coins"}
- Channel: ${notificationChannel}

### Step 4: Create Custom Feed (Optional)
Use \`create_custom_feed\` ($0.50/month) for personalized endpoint:
- Name: "${coins.split(",")[0]} Tracker"
- Keywords: Derived from coins
- Deduplicate: true

## Expected Output

# 🔔 News Monitoring Setup Complete

## Active Subscriptions
| Feature | Status | Expires | Cost |
|---------|--------|---------|------|
[List all configured features]

## Notification Settings
- Channel: ${notificationChannel}
- Monitored Coins: ${coins}
- Tracked Keywords: [List]

## Endpoints
- Firehose WebSocket: [URL if subscribed]
- Custom Feed JSON: [URL if created]
- Custom Feed RSS: [URL if created]

## Total Cost
- Daily: $X.XX
- Monthly (estimated): $X.XX

## Next Steps
1. [How to connect to WebSocket]
2. [How to add more keywords]
3. [How to adjust alert sensitivity]
`,
          },
        },
      ],
    })
  )

  // =========================================================================
  // Prompt 3: Historical Research
  // =========================================================================
  server.prompt(
    "historical_news_research",
    "Research historical news patterns for a specific topic or event",
    {
      topic: z.string().describe("Research topic"),
      startDate: z
        .string()
        .optional()
        .describe("Start date (YYYY-MM-DD)"),
      endDate: z
        .string()
        .optional()
        .describe("End date (YYYY-MM-DD)"),
      exportResults: z
        .boolean()
        .default(false)
        .describe("Export results to CSV"),
    },
    ({ topic, startDate, endDate, exportResults }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Conduct historical news research on "${topic}".

## Research Parameters

- **Topic**: ${topic}
- **Date Range**: ${startDate || "Auto"} to ${endDate || "Now"}
- **Export**: ${exportResults ? "Yes, to CSV" : "No"}

## Instructions

### Step 1: Initial Search
Use \`search_historical_news\` ($0.01/query) with:
- Keywords: "${topic}"
- Start/End dates as specified
- Sort by relevance first

### Step 2: Analyze Key Articles
For the top 5 most relevant articles:
- Use \`summarize_article\` ($0.001 each)

### Step 3: Sentiment Timeline
Search by date ranges to build sentiment timeline:
- Use multiple \`search_historical_news\` calls with sentiment filters

${
  exportResults
    ? `### Step 4: Export Data
Use \`export_news_data\` ($0.02) to get CSV export`
    : ""
}

## Output Format

# 📚 Historical Research: ${topic}

## Timeline Overview
| Date Range | Articles | Avg Sentiment | Key Event |
|------------|----------|---------------|-----------|
[Build from searches]

## Key Articles Analysis
For each key article:
- Date & Source
- AI Summary
- Market context at the time

## Sentiment Trends
[Describe how sentiment evolved over time]

## Pattern Recognition
- Recurring themes
- Correlation with price movements (if applicable)
- Media narrative shifts

${
  exportResults
    ? `## Data Export
- Download URL: [From export tool]
- Records: X
- Format: CSV`
    : ""
}

## Research Cost
- Historical queries: X × $0.01 = $X.XX
- Summaries: X × $0.001 = $X.XX
${exportResults ? "- Export: $0.02" : ""}
- **Total**: $X.XX
`,
          },
        },
      ],
    })
  )

  // =========================================================================
  // Prompt 4: Premium Features Overview
  // =========================================================================
  server.prompt(
    "premium_news_features",
    "Explain all premium news features, pricing, and how to get started",
    {},
    () => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Provide a comprehensive overview of premium crypto news features.

## Instructions

1. First, check the current premium status using \`get_premium_news_status\`

2. Then format the following information:

# 💎 Premium Crypto News Features

## Free Tier (Always Available)
| Feature | Description |
|---------|-------------|
| Latest News | News from 7 major sources |
| Keyword Search | Search across all sources |
| DeFi News | DeFi-specific articles |
| Bitcoin News | BTC-focused coverage |
| Breaking News | Last 2 hours of news |

## Premium Tiers (x402 Micropayments)

### 1. 🔥 Real-time Firehose - ${PREMIUM_PRICING.firehose.price}/${PREMIUM_PRICING.firehose.period}
${PREMIUM_PRICING.firehose.description}
- Tool: \`subscribe_news_firehose\`
- Use case: Trading bots, real-time dashboards

### 2. 🤖 AI Summaries - ${PREMIUM_PRICING.summary.price}/${PREMIUM_PRICING.summary.period}
${PREMIUM_PRICING.summary.description}
- Tool: \`summarize_article\`, \`batch_summarize_articles\`
- Use case: Quick article digests, sentiment analysis

### 3. 🚨 Breaking Alerts - ${PREMIUM_PRICING.alerts.price}/${PREMIUM_PRICING.alerts.period}
${PREMIUM_PRICING.alerts.description}
- Tool: \`configure_breaking_alerts\`
- Use case: Never miss important news

### 4. 📚 Historical Deep Dive - ${PREMIUM_PRICING.historical.price}/${PREMIUM_PRICING.historical.period}
${PREMIUM_PRICING.historical.description}
- Tool: \`search_historical_news\`
- Use case: Research, backtesting

### 5. 📋 Custom Feeds - ${PREMIUM_PRICING.customFeed.price}/${PREMIUM_PRICING.customFeed.period}
${PREMIUM_PRICING.customFeed.description}
- Tool: \`create_custom_feed\`
- Use case: Personalized news aggregation

### 6. 💾 Bulk Export - ${PREMIUM_PRICING.bulkExport.price}/${PREMIUM_PRICING.bulkExport.period}
${PREMIUM_PRICING.bulkExport.description}
- Tool: \`export_news_data\`
- Use case: Data analysis, reporting

## Revenue Split
- **${REVENUE_SPLIT.contentSources * 100}%** goes to content sources
- **${REVENUE_SPLIT.platform * 100}%** platform fee

## Getting Started

### 1. Configure x402 Payments
\`\`\`bash
# Set environment variable
export X402_PRIVATE_KEY="0x..."
\`\`\`

### 2. Check Status
Use \`get_premium_news_status\` to verify configuration

### 3. Start Using Premium Features
Features are pay-per-use with automatic micropayments!

## Example Costs
| Use Case | Features Used | Est. Daily Cost |
|----------|---------------|-----------------|
| Casual Reader | 10 summaries | $0.01 |
| Active Trader | Firehose + 20 summaries | $0.12 |
| Researcher | Historical + Export | $0.05-0.50 |
| Power User | All features | $0.50-1.00 |

## Questions?
Ask me about any specific feature!
`,
          },
        },
      ],
    })
  )

  // =========================================================================
  // Prompt 5: Quick Market Pulse
  // =========================================================================
  server.prompt(
    "market_pulse",
    "Get a quick market pulse using news sentiment analysis",
    {
      coins: z
        .string()
        .default("BTC,ETH")
        .describe("Coins to analyze (comma-separated)"),
    },
    ({ coins }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Generate a quick market pulse for ${coins} using news sentiment.

## Instructions

### Step 1: Gather Latest News
For each coin (${coins}):
- Use \`get_crypto_news\` or \`search_crypto_news\`
- Get 5 most recent articles

### Step 2: Quick Sentiment (Premium)
For the top 3 articles per coin:
- Use \`summarize_article\` to get sentiment ($0.001 each)

### Step 3: Compile Pulse

# ⚡ Market Pulse

## Sentiment Overview
| Coin | Sentiment | Confidence | Trend |
|------|-----------|------------|-------|
${coins.split(",").map((c) => `| ${c.trim()} | [From analysis] | X% | ↑/↓/→ |`).join("\n")}

## Key Headlines
${coins.split(",").map((c) => `### ${c.trim()}\n- [Top 3 headlines with sentiment emoji]`).join("\n\n")}

## Quick Take
[1-2 sentence overall market mood assessment]

## Cost: ~$${(coins.split(",").length * 3 * 0.001).toFixed(3)} (${coins.split(",").length * 3} summaries)
`,
          },
        },
      ],
    })
  )
}
