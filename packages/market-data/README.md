
[![npm version](https://badge.fury.io/js/%40nirholas%2Fcrypto-market-data.svg)](https://www.npmjs.com/package/@nirholas/crypto-market-data)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)

Comprehensive cryptocurrency market data service with built-in caching, rate limiting, and Edge Runtime compatibility.

## Features

- 🚀 **Edge Runtime Compatible** - Works in Cloudflare Workers, Vercel Edge, Node.js, and browsers
- 📊 **Multiple Data Sources** - CoinGecko, DeFiLlama, and Alternative.me (Fear & Greed)
- ⚡ **Smart Caching** - Stale-while-revalidate pattern with configurable TTLs
- 🛡️ **Rate Limiting** - Built-in protection for CoinGecko's free tier (25 req/min)
- 📦 **Zero Dependencies** - Uses native `fetch` only
- 🔷 **Full TypeScript** - Complete type definitions included
- 🔄 **Backwards Compatible** - Both class-based and function exports

## Installation

```bash
npm install @nirholas/crypto-market-data
# or
yarn add @nirholas/crypto-market-data
# or
pnpm add @nirholas/crypto-market-data
```

## Quick Start

```typescript
import { MarketDataClient } from '@nirholas/crypto-market-data';

const client = new MarketDataClient();

// Get market overview
const overview = await client.getMarketOverview();
console.log(`BTC: $${overview.btcPrice}`);
console.log(`ETH: $${overview.ethPrice}`);
console.log(`Fear & Greed: ${overview.fearGreed?.value} (${overview.fearGreed?.value_classification})`);

// Get top coins
const coins = await client.getTopCoins(10);
coins.forEach(coin => {
  console.log(`${coin.name}: $${coin.current_price} (${coin.price_change_percentage_24h}%)`);
});
```

## API Reference

### Initialization

```typescript
import { MarketDataClient, type MarketDataConfig } from '@nirholas/crypto-market-data';

const config: MarketDataConfig = {
  rateLimitWindow: 60000,      // Rate limit window in ms (default: 60000)
  maxRequestsPerWindow: 25,    // Max requests per window (default: 25)
  timeout: 10000,              // Request timeout in ms (default: 10000)
  userAgent: 'MyApp/1.0',      // Custom User-Agent
};

const client = new MarketDataClient(config);
```

### Available Methods

#### Prices & Market Data

| Method | Description |
|--------|-------------|
| `getSimplePrices()` | Get BTC, ETH, SOL prices |
| `getTopCoins(limit?)` | Get top coins by market cap |
| `getTrending()` | Get trending coins |
| `getGlobalMarketData()` | Get global market statistics |
| `getCoinDetails(coinId)` | Get detailed coin information |
| `getMarketOverview()` | Get combined market overview |

#### Fear & Greed Index

| Method | Description |
|--------|-------------|
| `getFearGreedIndex()` | Get current Fear & Greed Index |

#### DeFi (DeFiLlama)

| Method | Description |
|--------|-------------|
| `getTopProtocols(limit?)` | Get top DeFi protocols by TVL |
| `getTopChains(limit?)` | Get top chains by TVL |
| `getGlobalDeFiData()` | Get global DeFi statistics |

#### Historical Data

| Method | Description |
|--------|-------------|
| `getHistoricalPrices(coinId, days, interval?)` | Get historical price data |
| `getOHLC(coinId, days)` | Get OHLC candlestick data |
| `getHistoricalPrice(coinId, date)` | Get price at specific date |

#### Exchanges & Tickers

| Method | Description |
|--------|-------------|
| `getCoinTickers(coinId, page?)` | Get trading pairs for a coin |
| `getExchanges(perPage?, page?)` | Get list of exchanges |
| `getExchangeDetails(exchangeId)` | Get exchange details |

#### Categories

| Method | Description |
|--------|-------------|
| `getCategories()` | Get all categories |
| `getCategoryCoins(categoryId, perPage?, page?)` | Get coins in a category |

#### Search & Compare

| Method | Description |
|--------|-------------|
| `searchCoins(query)` | Search coins, exchanges, NFTs |
| `compareCoins(coinIds)` | Compare multiple coins |
| `getCoinsList()` | Get all coins for autocomplete |

#### Social & Developer

| Method | Description |
|--------|-------------|
| `getCoinDeveloperData(coinId)` | Get GitHub/developer stats |
| `getCoinCommunityData(coinId)` | Get social/community stats |

#### Derivatives

| Method | Description |
|--------|-------------|
| `getDerivativesTickers()` | Get derivatives market tickers |

### Utility Functions

```typescript
import { 
  formatPrice, 
  formatNumber, 
  formatPercent,
  getFearGreedColor,
  getFearGreedBgColor 
} from '@nirholas/crypto-market-data';

formatPrice(45123.45);     // "$45,123"
formatPrice(0.00001234);   // "$0.0000"
formatNumber(1234567890);  // "1.23B"
formatPercent(5.67);       // "+5.67%"
formatPercent(-3.21);      // "-3.21%"

// Tailwind CSS colors for Fear & Greed Index
getFearGreedColor(25);     // "text-red-500" (Extreme Fear)
getFearGreedColor(75);     // "text-lime-500" (Greed)
getFearGreedBgColor(50);   // "bg-yellow-500" (Neutral)
```

### Legacy Function Exports

For backwards compatibility, all methods are also exported as standalone functions:

```typescript
import { getTopCoins, getMarketOverview } from '@nirholas/crypto-market-data';

const coins = await getTopCoins(10);
const overview = await getMarketOverview();
```

## Examples

### Get Market Overview

```typescript
const overview = await client.getMarketOverview();

console.log('Market Overview:');
console.log(`  Total Market Cap: $${formatNumber(overview.global.total_market_cap.usd)}`);
console.log(`  24h Volume: $${formatNumber(overview.global.total_volume.usd)}`);
console.log(`  BTC Dominance: ${overview.global.market_cap_percentage.btc?.toFixed(1)}%`);
console.log(`  Fear & Greed: ${overview.fearGreed?.value} (${overview.fearGreed?.value_classification})`);
```

### Get Historical Price Chart Data

```typescript
// Get 7 days of hourly data
const historical = await client.getHistoricalPrices('bitcoin', 7, 'hourly');

historical.prices.forEach(([timestamp, price]) => {
  const date = new Date(timestamp);
  console.log(`${date.toLocaleDateString()}: $${price.toFixed(2)}`);
});
```

### Get OHLC Candlestick Data

```typescript
const ohlc = await client.getOHLC('bitcoin', 30);

ohlc.forEach(candle => {
  console.log(`${new Date(candle.timestamp).toLocaleDateString()}: O:${candle.open} H:${candle.high} L:${candle.low} C:${candle.close}`);
});
```

### Compare Coins

```typescript
const comparison = await client.compareCoins(['bitcoin', 'ethereum', 'solana']);

comparison.coins.forEach(coin => {
  console.log(`${coin.name}:`);
  console.log(`  Price: $${coin.current_price}`);
  console.log(`  Market Cap Rank: #${coin.market_cap_rank}`);
  console.log(`  24h Change: ${formatPercent(coin.price_change_percentage_24h)}`);
  console.log(`  7d Change: ${formatPercent(coin.price_change_percentage_7d)}`);
});
```

### Search with Autocomplete

```typescript
const results = await client.searchCoins('sol');

console.log('Coins:', results.coins.map(c => c.name));
console.log('Exchanges:', results.exchanges.map(e => e.name));
```

### Get DeFi Protocol TVL

```typescript
const protocols = await client.getTopProtocols(10);

protocols.forEach(protocol => {
  console.log(`${protocol.name}: $${formatNumber(protocol.tvl)} TVL`);
});
```

## Cache Management

```typescript
// Get cache statistics
const stats = client.getCacheStats();
console.log(`Cache size: ${stats.size} entries`);
console.log(`Cached keys: ${stats.keys.join(', ')}`);

// Clear all cached data
client.clearCache();
```

## Rate Limit Status

```typescript
const status = client.getRateLimitStatus();
console.log(`Remaining requests: ${status.remaining}`);
console.log(`Window resets at: ${new Date(status.windowResetAt)}`);
console.log(`Is blocked: ${status.isBlocked}`);
```

## Edge Runtime / Cloudflare Workers

This package is designed to work in Edge Runtime environments:

```typescript
// Cloudflare Worker example
export default {
  async fetch(request: Request): Promise<Response> {
    const client = new MarketDataClient();
    const overview = await client.getMarketOverview();
    
    return new Response(JSON.stringify(overview), {
      headers: { 'Content-Type': 'application/json' },
    });
  },
};
```

## Error Handling

```typescript
import { MarketDataError } from '@nirholas/crypto-market-data';

try {
  const coin = await client.getCoinDetails('invalid-coin-id');
} catch (error) {
  if (error instanceof MarketDataError) {
    if (error.isRateLimited) {
      console.log('Rate limited! Try again later.');
    } else {
      console.log(`API Error: ${error.message} (${error.statusCode})`);
    }
  }
}
```

## TypeScript

Full TypeScript support with exported types:

```typescript
import type {
  TokenPrice,
  TrendingCoin,
  GlobalMarketData,
  FearGreedIndex,
  ProtocolTVL,
  ChainTVL,
  MarketOverview,
  HistoricalData,
  OHLCData,
  Ticker,
  Exchange,
  Category,
  SearchResult,
  CompareData,
  DeveloperData,
  CommunityData,
  GlobalDeFi,
  DerivativeTicker,
  MarketDataConfig,
} from '@nirholas/crypto-market-data';
```

## License

MIT © [nirholas](https://github.com/nirholas)

## Related Projects

- [free-crypto-news](https://github.com/nirholas/free-crypto-news) - Free crypto news API
- [CoinGecko API](https://www.coingecko.com/en/api) - Cryptocurrency data API
- [DeFiLlama API](https://defillama.com/docs/api) - DeFi TVL data API
