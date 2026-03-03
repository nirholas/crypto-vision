---
title: Getting Started with the CryptoNews API
excerpt: A comprehensive guide to integrating the CryptoNews API into your applications. Learn how to fetch news, filter by category, and stream real-time updates.
date: 2026-01-23
author:
  name: CryptoNews Team
  avatar: /icons/icon-192.png
tags:
  - tutorial
  - api
  - development
featured: true
---

# Getting Started with the CryptoNews API

Our free API provides access to aggregated cryptocurrency news from over 50 sources. This guide will walk you through everything you need to know to get started.

## Quick Start

The simplest way to fetch news is with a single GET request:

```bash
curl https://crypto-news-api.example.com/api/news
```

This returns the latest 25 news articles in JSON format:

```json
{
  "items": [
    {
      "title": "Bitcoin Surges Past $100,000",
      "description": "BTC reaches new all-time high...",
      "pubDate": "2026-01-23T10:30:00Z",
      "link": "https://source.com/article",
      "source": "CryptoDaily",
      "category": "bitcoin"
    }
  ],
  "count": 25,
  "lastUpdated": "2026-01-23T10:35:00Z"
}
```

## Filtering News

### By Category

Filter by specific cryptocurrency or topic:

```bash
# Bitcoin only
curl "https://api.example.com/api/news?category=bitcoin"

# Ethereum news
curl "https://api.example.com/api/news?category=ethereum"

# DeFi updates
curl "https://api.example.com/api/news?category=defi"
```

Available categories:
- `bitcoin` - Bitcoin news and analysis
- `ethereum` - Ethereum and EVM chains
- `altcoins` - Alternative cryptocurrencies
- `defi` - Decentralized finance
- `nft` - NFTs and digital collectibles
- `regulation` - Legal and regulatory news
- `trading` - Market and trading updates

### By Source

Get news from specific sources:

```bash
curl "https://api.example.com/api/news?source=coindesk"
```

### Search

Search across all articles:

```bash
curl "https://api.example.com/api/news?search=layer%202"
```

## Pagination

Control results with limit and offset:

```bash
# Get 50 articles
curl "https://api.example.com/api/news?limit=50"

# Get next page
curl "https://api.example.com/api/news?limit=50&offset=50"
```

## Real-time Updates

For real-time news, connect to our WebSocket endpoint:

```javascript
const ws = new WebSocket('wss://api.example.com/ws');

ws.onmessage = (event) => {
  const article = JSON.parse(event.data);
  console.log('New article:', article.title);
};

ws.onopen = () => {
  // Subscribe to specific categories
  ws.send(JSON.stringify({
    action: 'subscribe',
    categories: ['bitcoin', 'ethereum']
  }));
};
```

## Rate Limits

The free tier includes:
- **100 requests/minute** for REST API
- **Unlimited** WebSocket messages
- **No API key required** for basic usage

For higher limits, check out our [API key plans](/api).

## SDKs & Libraries

We provide official SDKs for popular languages:

### JavaScript/TypeScript

```bash
npm install @cryptonews/sdk
```

```javascript
import { CryptoNewsClient } from '@cryptonews/sdk';

const client = new CryptoNewsClient();
const news = await client.getNews({ category: 'bitcoin' });
```

### Python

```bash
pip install cryptonews-sdk
```

```python
from cryptonews import CryptoNewsClient

client = CryptoNewsClient()
news = client.get_news(category="bitcoin")
```

## Example Projects

Check out these example integrations:

1. **Discord Bot** - Post news to your Discord server
2. **Telegram Bot** - Get news alerts on Telegram
3. **Slack Integration** - News updates in Slack channels
4. **Trading Bot** - Sentiment-based trading signals

See the [examples directory](https://github.com/example/crypto-news/tree/main/examples) for full code.

## Next Steps

- Browse the [full API documentation](/api)
- Join our [Discord community](https://discord.gg/example)
- Star us on [GitHub](https://github.com/example/crypto-news)

Happy building! 🚀
