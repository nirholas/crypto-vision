# 📰 Crypto News Module

> Free crypto news + premium tiers powered by x402 micropayments

## Overview

This module provides access to cryptocurrency news from 7 major sources, with premium features available through x402 micropayments. Basic news access is always free - premium features add AI analysis, real-time feeds, and historical data.

**Revenue Model**: 70% goes to content sources, 30% platform fee.

## Quick Start

### Free Usage (MCP Tools)

```typescript
// Get latest news
const news = await mcp.callTool("get_crypto_news", { limit: 10 });

// Search by keywords
const results = await mcp.callTool("search_crypto_news", { 
  keywords: "bitcoin,etf",
  limit: 10 
});

// Category-specific news
const defi = await mcp.callTool("get_defi_news", { limit: 10 });
const btc = await mcp.callTool("get_bitcoin_news", { limit: 10 });
const breaking = await mcp.callTool("get_breaking_crypto_news", { limit: 5 });
```

### Premium Usage (x402 Auto-Pay)

```typescript
// Configure x402 first
// Set X402_PRIVATE_KEY environment variable

// Real-time firehose ($0.10/day)
const firehose = await mcp.callTool("subscribe_news_firehose", {
  sources: ["coindesk", "theblock"],
  duration: "1day"
});

// AI article summary ($0.001)
const summary = await mcp.callTool("summarize_article", {
  articleId: "abc123"
});

// Historical search ($0.01/query)
const historical = await mcp.callTool("search_historical_news", {
  keywords: "ethereum merge",
  startDate: "2022-01-01",
  endDate: "2022-12-31"
});
```

### SDK Usage

```typescript
import { createNewsClient } from "@nirholas/universal-crypto-mcp/news";

// Free client
const news = createNewsClient();
const latest = await news.getLatest();
const searched = await news.search("bitcoin,etf");

// Premium client (auto-pays with x402)
const premiumNews = createNewsClient({
  privateKey: process.env.EVM_PRIVATE_KEY as `0x${string}`,
  chain: "base" // Use mainnet for real payments
});

const firehose = await premiumNews.subscribe("firehose"); // $0.10/day
const summary = await premiumNews.summarize(articleId);   // $0.001
```

## Free Features

| Tool | Description |
|------|-------------|
| `get_crypto_news` | Latest news from 7 major sources |
| `search_crypto_news` | Search by keywords across all sources |
| `get_defi_news` | DeFi-specific news |
| `get_bitcoin_news` | Bitcoin-focused coverage |
| `get_breaking_crypto_news` | News from last 2 hours |
| `get_crypto_news_sources` | List available sources |

### Supported Sources

- CoinDesk
- The Block
- Decrypt
- CoinTelegraph
- Bitcoin Magazine
- Blockworks
- The Defiant

## Premium Features

### 1. 🔥 Real-time Firehose - $0.10/day

WebSocket feed with <1 second latency for all news sources.

```typescript
// MCP Tool
const subscription = await mcp.callTool("subscribe_news_firehose", {
  sources: ["coindesk", "theblock", "decrypt"],
  duration: "7days" // $0.70
});

// SDK
const sub = await news.subscribe("firehose", {
  sources: ["coindesk"],
  duration: "1day"
});
console.log("WebSocket URL:", sub.websocketUrl);
```

**Use Cases:**
- Trading bots needing instant news
- Real-time dashboards
- News aggregation services

---

### 2. 🤖 AI Summaries - $0.001/summary

GPT-powered article summaries with sentiment analysis.

```typescript
// Single article
const summary = await mcp.callTool("summarize_article", {
  articleId: "abc123",
  // or articleUrl: "https://..."
});

// Batch (more efficient)
const batch = await mcp.callTool("batch_summarize_articles", {
  articleIds: ["abc123", "def456", "ghi789"],
  concise: true
});
```

**Returns:**
- Summary text
- Key points (bullet list)
- Sentiment (score, label, confidence)
- Topics/tags
- Mentioned entities (coins, companies, people)
- Reading time estimate

---

### 3. 🚨 Breaking Alerts - $0.05/day

Push notifications for important news via Discord, Telegram, or webhooks.

```typescript
const alerts = await mcp.callTool("configure_breaking_alerts", {
  keywords: ["sec", "regulation", "etf"],
  coins: ["BTC", "ETH", "SOL"],
  discordWebhook: "https://discord.com/api/webhooks/...",
  // or telegramChatId: "123456789"
  // or webhookUrl: "https://your-api.com/webhook"
  duration: "30days" // $1.50
});
```

**Filters:**
- Keywords
- Specific coins
- Source preferences
- Sentiment threshold (optional)

---

### 4. 📚 Historical Deep Dive - $0.01/query

Full archive access with advanced search.

```typescript
const results = await mcp.callTool("search_historical_news", {
  keywords: "bitcoin AND (etf OR sec)",  // Supports operators
  startDate: "2023-01-01",
  endDate: "2023-12-31",
  sentiment: "bullish",
  sortBy: "relevance",
  perPage: 50
});
```

**Features:**
- Years of archived news
- Boolean search operators (AND, OR, NOT)
- Sentiment filtering
- Date range queries
- Export capability

---

### 5. 📋 Custom Feeds - $0.50/month

Create personalized news endpoints with your preferences.

```typescript
const feed = await mcp.callTool("create_custom_feed", {
  name: "DeFi Blue Chips",
  keywords: ["aave", "uniswap", "maker", "compound"],
  sources: ["defiant", "theblock"],
  excludeKeywords: ["hack", "exploit"],
  minRelevanceScore: 0.7,
  deduplicate: true
});

// Access via endpoints:
// JSON: feed.jsonUrl
// RSS:  feed.rssUrl
// Atom: feed.atomUrl
```

---

### 6. 💾 Bulk Export - $0.02/request

Export news data in CSV or JSON format.

```typescript
const exportResult = await mcp.callTool("export_news_data", {
  format: "csv",
  startDate: "2024-01-01",
  endDate: "2024-01-31",
  sources: ["coindesk", "theblock"],
  maxRecords: 5000
});

console.log("Download:", exportResult.downloadUrl);
// Link expires in 24 hours
```

---

### 7. 📊 Impact Analysis - $0.001/request

AI analysis of how news might affect prices.

```typescript
const impact = await mcp.callTool("analyze_news_impact", {
  articleId: "abc123",
  targetCoins: ["BTC", "ETH"]
});

// Returns:
// - Overall impact level (high/medium/low)
// - Sentiment
// - Affected coins with magnitude
// - Market factors
// - Risk factors
```

## Prompts

### `premium_news_intelligence`

Generate comprehensive market intelligence reports.

```
Parameters:
- topic: Focus topic (e.g., "bitcoin etf")
- depth: "quick" | "standard" | "deep"
- includeHistorical: Include historical context
```

### `setup_news_monitoring`

Configure real-time monitoring with alerts.

```
Parameters:
- coins: Coins to monitor (e.g., "BTC,ETH,SOL")
- keywords: Additional keywords
- notificationChannel: "discord" | "telegram" | "webhook"
```

### `historical_news_research`

Research historical patterns for a topic.

```
Parameters:
- topic: Research topic
- startDate: Start date (YYYY-MM-DD)
- endDate: End date
- exportResults: Export to CSV
```

### `premium_news_features`

Overview of all premium features and pricing.

### `market_pulse`

Quick sentiment analysis for specified coins.

```
Parameters:
- coins: Coins to analyze (e.g., "BTC,ETH")
```

## Pricing Summary

| Feature | Price | Period |
|---------|-------|--------|
| Real-time Firehose | $0.10 | day |
| AI Summary | $0.001 | request |
| Breaking Alerts | $0.05 | day |
| Historical Search | $0.01 | query |
| Custom Feed | $0.50 | month |
| Bulk Export | $0.02 | request |
| Impact Analysis | $0.001 | request |

### Example Monthly Costs

| User Type | Usage | Est. Cost |
|-----------|-------|-----------|
| Casual Reader | 10 summaries/day | ~$0.30/mo |
| Active Trader | Firehose + 50 summaries/day | ~$4.50/mo |
| Researcher | Historical + exports | ~$2-5/mo |
| Power User | All features | ~$15-30/mo |

## Configuration

### Environment Variables

```bash
# Required for premium features
X402_PRIVATE_KEY=0x...  # EVM private key (with USDC balance)

# Optional
X402_CHAIN=base-sepolia  # Default chain (use 'base' for mainnet)
PREMIUM_NEWS_API_URL=https://free-crypto-news.vercel.app
```

### Chain Options

| Chain | CAIP-2 ID | Notes |
|-------|-----------|-------|
| Base Mainnet | eip155:8453 | Recommended for production |
| Base Sepolia | eip155:84532 | Default (testnet) |
| Arbitrum | eip155:42161 | Alternative |
| Optimism | eip155:10 | Alternative |

## Integration Examples

### Trading Bot

```typescript
const news = createNewsClient({
  privateKey: process.env.EVM_PRIVATE_KEY as `0x${string}`,
  chain: "base"
});

// Subscribe to firehose
const sub = await news.subscribe("firehose");

// Connect to WebSocket
const ws = new WebSocket(sub.websocketUrl);
ws.onmessage = async (event) => {
  const article = JSON.parse(event.data);
  
  // Get quick impact analysis
  const impact = await news.analyzeImpact(article.id, ["BTC", "ETH"]);
  
  if (impact.impactAnalysis.overallImpact === "high") {
    // Trigger trading logic
  }
};
```

### Research Dashboard

```typescript
const news = createNewsClient({ privateKey: "0x..." });

// Historical research
const results = await news.searchHistorical({
  keywords: "bitcoin halving",
  startDate: "2020-01-01",
  endDate: "2020-12-31",
  sortBy: "date_desc"
});

// Batch summarize key articles
const articleIds = results.articles.slice(0, 10).map(a => a.id);
const summaries = await news.batchSummarize(articleIds);

// Export for analysis
const export = await news.export({
  format: "csv",
  startDate: "2020-01-01",
  endDate: "2020-12-31",
  keywords: "bitcoin halving"
});
```

## x402scan Integration

This module implements the [x402scan](https://x402scan.com) V2 schema for automatic resource discovery.

### Enable Discovery Document

Implement `/.well-known/x402` to have all premium resources automatically discovered by x402scan:

#### Next.js (App Router)

```typescript
// app/.well-known/x402/route.ts
import { createX402DiscoveryHandler } from "@nirholas/universal-crypto-mcp/news";

export const GET = createX402DiscoveryHandler();
```

#### Express

```typescript
import express from 'express';
import { x402DiscoveryMiddleware } from "@nirholas/universal-crypto-mcp/news";

const app = express();
app.get('/.well-known/x402', x402DiscoveryMiddleware);
```

#### Manual

```typescript
import { getDiscoveryDocumentJSON } from "@nirholas/universal-crypto-mcp/news";

// Get JSON string
const json = getDiscoveryDocumentJSON();

// Or get object
import { generateDiscoveryDocument } from "@nirholas/universal-crypto-mcp/news";
const doc = generateDiscoveryDocument();
```

### V2 Schema Compliance

All premium resources comply with x402scan V2 schema:

```typescript
type X402Response = {
  x402Version: 2,
  accepts?: Array<{
    scheme: "exact",
    network: "eip155:8453", // Base mainnet
    amount: string,
    payTo: string,
    maxTimeoutSeconds: number,
    asset: string,
    extra: Record<string, any>
  }>,
  resource?: {
    url: string,
    description: string,
    mimeType: string
  },
  extensions?: {
    bazaar?: {
      info?: { input: any, output?: any },
      schema?: any // JSON Schema
    }
  }
}
```

### Bazaar Extension

Each resource includes the `bazaar` extension with:

- **info.input**: Example request payload
- **info.output**: Example response payload  
- **schema**: JSON Schema for validation

This allows x402scan to render interactive UI for invoking resources directly from the app.

### Validate Resources

```typescript
import { validateDiscoveryDocument } from "@nirholas/universal-crypto-mcp/news";

const { valid, errors } = validateDiscoveryDocument();
if (!valid) {
  console.error("Validation errors:", errors);
}
```

### Environment Variables

```bash
# Required for discovery document
PREMIUM_NEWS_API_URL=https://your-api.example.com
X402_PAY_TO_ADDRESS=0x1234...your-address
```

## License

Apache-2.0

---

**💰 Revenue Split**: 70% to content sources, 30% platform fee.

Built with [x402](https://x402.org) | Powered by [free-crypto-news](https://github.com/nirholas/free-crypto-news)

