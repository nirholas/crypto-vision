# Free Crypto News TypeScript SDK

Full TypeScript SDK for the Crypto Data Aggregator API with complete type definitions.

**Free tier available** - No API key required for basic endpoints!

## Installation

```bash
npm install @nirholas/crypto-news
```

## Quick Start

```typescript
import { CryptoNews } from '@nirholas/crypto-news';

// Free usage (no auth required for basic endpoints)
const client = new CryptoNews();

// Or with API key for premium endpoints
const client = new CryptoNews({
  apiKey: 'cda_free_xxxxx', // Get at /developers
});
```

## Free Endpoints

```typescript
// Get latest news
const articles = await client.getLatest(10);

// Search for specific topics
const ethNews = await client.search('ethereum, ETF');

// Get DeFi news
const defiNews = await client.getDefi(10);

// Get Bitcoin news
const btcNews = await client.getBitcoin(10);

// Get breaking news (last 2 hours)
const breaking = await client.getBreaking(5);

// Check API health
const health = await client.getHealth();
```

## Premium Endpoints (API Key or x402)

```typescript
// Set API key
client.setApiKey('cda_free_xxxxx');

// Get premium coin data
const coins = await client.getPremiumCoins({ perPage: 10 });

// Get historical data
const history = await client.getHistorical('bitcoin', 30);

// Export data
const data = await client.exportData({
  coinId: 'bitcoin',
  format: 'csv',
  days: 90,
});

// Check usage
const usage = await client.getUsage();
console.log(`${usage.remaining}/${usage.limit} requests remaining`);

// Check rate limits after any request
const rateLimit = client.getRateLimitInfo();
```

## Analytics & Trends

```typescript
// Get trending topics
const trending = await client.getTrending(10, 24);
trending.trending.forEach((t) => {
  console.log(`${t.topic}: ${t.count} mentions (${t.sentiment})`);
});

// Get API statistics
const stats = await client.getStats();

// Analyze news with sentiment
const analysis = await client.analyze(20, 'bitcoin', 'bullish');
console.log(`Market: ${analysis.summary.overall_sentiment}`);
```

## Historical & Sources

```typescript
// Get archived news
const archive = await client.getArchive('2024-01-15', 'SEC', 20);

// Find original sources
const origins = await client.getOrigins('binance', 'exchange', 10);
origins.items.forEach((item) => {
  console.log(`${item.title} - Original: ${item.likely_original_source}`);
});
```

## Error Handling

```typescript
try {
  const coins = await client.getPremiumCoins();
} catch (error) {
  if (error.message === 'Rate limit exceeded') {
    console.log(`Retry after: ${new Date(error.retryAfter)}`);
  } else if (error.message === 'Payment Required') {
    console.log('x402 payment needed:', error.paymentRequired);
  }
}
```

## Convenience Functions

```typescript
import { getCryptoNews, searchCryptoNews, getDefiNews } from '@nirholas/crypto-news';

const news = await getCryptoNews(10);
const results = await searchCryptoNews('bitcoin');
const defi = await getDefiNews(5);
```

## Types

All types are exported and fully documented:

```typescript
import type {
  NewsArticle,
  NewsResponse,
  SourceInfo,
  HealthStatus,
  SourceKey,
  TrendingResponse,
  StatsResponse,
  AnalyzeResponse,
  ArchiveResponse,
  OriginsResponse,
} from '@nirholas/crypto-news';
```

## Custom Configuration

```typescript
const client = new CryptoNews({
  baseUrl: 'https://your-self-hosted-instance.com',
  timeout: 60000, // 60 seconds
});
```

## API Reference

| Method                                  | Description             |
| --------------------------------------- | ----------------------- |
| `getLatest(limit?, source?)`            | Get latest news         |
| `search(keywords, limit?)`              | Search by keywords      |
| `getDefi(limit?)`                       | DeFi-specific news      |
| `getBitcoin(limit?)`                    | Bitcoin-specific news   |
| `getBreaking(limit?)`                   | Breaking news (last 2h) |
| `getSources()`                          | List all sources        |
| `getHealth()`                           | API health status       |
| `getTrending(limit?, hours?)`           | Trending topics         |
| `getStats()`                            | API statistics          |
| `analyze(limit?, topic?, sentiment?)`   | Sentiment analysis      |
| `getArchive(date?, query?, limit?)`     | Historical archive      |
| `getOrigins(query?, category?, limit?)` | Find original sources   |
| `getRSSUrl(feed?)`                      | Get RSS feed URL        |

## License

MIT
