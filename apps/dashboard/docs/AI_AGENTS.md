# AI Agent Discoverability Guide

This document describes how AI agents can discover and consume the Crypto Data Aggregator API.

---

## Table of Contents

- [Overview](#overview)
- [Discovery Files](#discovery-files)
- [x402 Payment Protocol](#x402-payment-protocol)
- [Agent Integration](#agent-integration)
- [Bazaar Discovery](#bazaar-discovery)
- [Endpoint Schemas](#endpoint-schemas)
- [Best Practices](#best-practices)

---

## Overview

Crypto Data Aggregator is designed to be fully discoverable by AI agents. We provide multiple
discovery mechanisms following emerging standards for AI-to-API communication.

### Key Features

| Feature            | Description                          |
| ------------------ | ------------------------------------ |
| **llms.txt**       | Human-readable API summary for LLMs  |
| **llms-full.txt**  | Extended documentation with examples |
| **agents.json**    | Machine-readable endpoint catalog    |
| **ai-plugin.json** | OpenAI plugin manifest               |
| **mcp.json**       | MCP server configuration             |
| **x402 Protocol**  | Autonomous micropayments             |
| **Bazaar Listing** | Automatic discovery via x402 Bazaar  |
| **OpenAPI Spec**   | Full API schema at `/api/v2/openapi.json` |

---

## MCP Server Support

Crypto Data Aggregator provides a Model Context Protocol (MCP) server for AI agent integration.

### Discovery

Located at `/.well-known/mcp.json`:

```bash
curl https://crypto-data-aggregator.vercel.app/.well-known/mcp.json
```

### Available Tools

| Tool | Description |
|------|-------------|
| `get_coin_price` | Get real-time price data |
| `get_market_data` | Comprehensive market data |
| `get_defi_protocols` | DeFi protocol rankings |
| `get_historical_data` | Historical OHLCV data |
| `search_coins` | Search cryptocurrencies |
| `get_fear_greed` | Fear & Greed Index |
| `get_trending` | Trending coins |
| `get_gas_prices` | Multi-chain gas prices |

### Configuration for Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "crypto-data": {
      "command": "npx",
      "args": ["-y", "@crypto-data-aggregator/mcp"],
      "env": {
        "API_URL": "https://crypto-data-aggregator.vercel.app"
      }
    }
  }
}
```

### Self-Hosted MCP Server

```bash
# Clone and run locally
git clone https://github.com/nirholas/crypto-data-aggregator
cd crypto-data-aggregator/mcp
npm install
npm start
```

---

## Discovery Files

### llms.txt

Located at `/llms.txt`, this file provides a quick reference for LLMs to understand the API
capabilities.

```bash
curl https://your-domain.com/llms.txt
```

**Contents:**

- Project overview
- Available capabilities
- API endpoint list
- x402 payment information
- Links to extended documentation

### llms-full.txt

Located at `/llms-full.txt`, this file provides comprehensive documentation including:

```bash
curl https://your-domain.com/llms-full.txt
```

**Contents:**

- Complete API reference
- Request/response examples
- Query parameters
- Error handling
- Rate limits
- x402 integration code examples

### agents.json

Located at `/agents.json`, this file provides machine-readable endpoint definitions:

```bash
curl https://your-domain.com/agents.json
```

**Schema:**

```json
{
  "name": "Crypto Data Aggregator",
  "x402": {
    "enabled": true,
    "networks": ["eip155:8453"],
    "facilitator": "https://x402.org/facilitator"
  },
  "endpoints": {
    "market": {
      "coins": {
        "method": "GET",
        "path": "/api/market/coins",
        "description": "Get list of coins with market data",
        "price": "$0.001",
        "parameters": { ... }
      }
    }
  }
}
```

### ai-plugin.json

Located at `/.well-known/ai-plugin.json`, following the OpenAI plugin manifest standard:

```bash
curl https://your-domain.com/.well-known/ai-plugin.json
```

---

## x402 Payment Protocol

This API supports the x402 payment protocol, enabling AI agents to autonomously pay for API access
without API keys.

### How It Works

1. Agent sends request to endpoint
2. Server responds with `402 Payment Required`
3. Agent signs payment authorization with wallet
4. Agent resends request with `PAYMENT-SIGNATURE` header
5. Server verifies payment via facilitator
6. Server returns data with `PAYMENT-RESPONSE` header

### Supported Networks

| Network      | Chain ID     | Asset | Facilitator     |
| ------------ | ------------ | ----- | --------------- |
| Base         | eip155:8453  | USDC  | CDP Facilitator |
| Base Sepolia | eip155:84532 | USDC  | CDP Facilitator |

### Pricing

| Endpoint Type   | Price per Request |
| --------------- | ----------------- |
| Basic lookup    | $0.001            |
| Multiple items  | $0.005            |
| Historical data | $0.01             |
| Bulk export     | $0.10             |

---

## Agent Integration

### TypeScript/JavaScript

```typescript
import { wrapAxiosWithPayment, x402Client } from '@x402/axios';
import { registerExactEvmScheme } from '@x402/evm/exact/client';
import axios from 'axios';
import { privateKeyToAccount } from 'viem/accounts';

// Initialize wallet
const account = privateKeyToAccount(process.env.PRIVATE_KEY);
const client = new x402Client();
registerExactEvmScheme(client, { signer: account });

// Create payment-enabled HTTP client
const api = wrapAxiosWithPayment(axios.create({ baseURL: 'https://your-domain.com/api' }), client);

// Make requests - payments handled automatically
async function getCryptoData() {
  // Get Bitcoin price
  const btc = await api.get('/market/snapshot/bitcoin');
  console.log('BTC Price:', btc.data.market_data.current_price.usd);

  // Get trending coins
  const trending = await api.get('/trending');
  console.log('Trending:', trending.data);

  // Get Fear & Greed
  const sentiment = await api.get('/sentiment');
  console.log('Fear & Greed:', sentiment.data.value);
}
```

### Python

```python
import asyncio
from eth_account import Account
from x402 import x402Client
from x402.http.clients import x402HttpxClient
from x402.mechanisms.evm import EthAccountSigner
from x402.mechanisms.evm.exact.register import register_exact_evm_client

async def get_crypto_data():
    # Initialize wallet
    account = Account.from_key(os.environ["PRIVATE_KEY"])
    client = x402Client()
    register_exact_evm_client(client, EthAccountSigner(account))

    # Make paid requests
    async with x402HttpxClient(client) as http:
        # Get Bitcoin price
        response = await http.get("https://your-domain.com/api/market/snapshot/bitcoin")
        await response.aread()
        btc_data = response.json()
        print(f"BTC Price: ${btc_data['market_data']['current_price']['usd']}")

        # Get trending coins
        trending = await http.get("https://your-domain.com/api/trending")
        await trending.aread()
        print(f"Trending: {trending.json()}")

asyncio.run(get_crypto_data())
```

---

## Bazaar Discovery

This API is registered with the x402 Bazaar for automatic discovery by AI agents.

### Discovering This API

```typescript
import { HTTPFacilitatorClient } from '@x402/core/http';
import { withBazaar } from '@x402/extensions';

const facilitatorClient = new HTTPFacilitatorClient({
  url: 'https://x402.org/facilitator',
});
const client = withBazaar(facilitatorClient);

// List all available crypto data services
const resources = await client.extensions.discovery.listResources({
  type: 'http',
});

// Filter for crypto-related endpoints
const cryptoServices = resources.items.filter(
  (item) => item.resource.includes('crypto') || item.resource.includes('market')
);

console.log('Available crypto endpoints:', cryptoServices);
```

### Filtering by Price

```typescript
// Find endpoints under $0.01
const usdcAsset = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const maxPrice = 10000; // $0.01 in USDC atomic units

const affordableEndpoints = resources.items.filter((item) =>
  item.accepts.some((req) => req.asset === usdcAsset && Number(req.maxAmountRequired) < maxPrice)
);
```

---

## Premium Endpoints for AI Agents

The following premium endpoints are specifically designed for AI agent consumption:

### AI Analysis Endpoints

| Endpoint                    | Price | Description             | Use Case                    |
| --------------------------- | ----- | ----------------------- | --------------------------- |
| `/api/premium/ai/sentiment` | $0.02 | News sentiment analysis | Market mood assessment      |
| `/api/premium/ai/signals`   | $0.05 | Trading signals         | Automated trading decisions |
| `/api/premium/ai/summary`   | $0.01 | Market summary          | Daily briefing generation   |
| `/api/premium/ai/compare`   | $0.03 | Coin comparison         | Investment analysis         |

### Data Endpoints for Agents

| Endpoint                           | Price | Description         | Use Case              |
| ---------------------------------- | ----- | ------------------- | --------------------- |
| `/api/premium/whales/transactions` | $0.05 | Whale movements     | Large holder tracking |
| `/api/premium/smart-money`         | $0.05 | Institutional flows | Smart money following |
| `/api/premium/screener/advanced`   | $0.02 | Advanced screening  | Opportunity discovery |

### Agent Workflow Example

```typescript
// AI agent workflow: Generate daily market report
async function generateDailyReport() {
  // 1. Get market sentiment ($0.02)
  const sentiment = await api.get('/api/premium/ai/sentiment?limit=30');

  // 2. Get AI-generated summary ($0.01)
  const summary = await api.get('/api/premium/ai/summary');

  // 3. Get whale activity ($0.05)
  const whales = await api.get('/api/premium/whales/transactions?limit=20');

  // 4. Get smart money flow ($0.05)
  const smartMoney = await api.get('/api/premium/smart-money');

  // 5. Screen for opportunities ($0.02)
  const opportunities = await api.get('/api/premium/screener/advanced?preset=hot-gainers');

  // Total cost: $0.15 for comprehensive report
  return {
    sentiment: sentiment.data,
    summary: summary.data,
    whaleActivity: whales.data,
    smartMoney: smartMoney.data,
    opportunities: opportunities.data,
  };
}
```

---

## Endpoint Schemas

Each endpoint provides schema information for AI agents to understand request/response formats.

### Example: AI Sentiment Analysis

**Input Schema:**

```json
{
  "method": "GET",
  "path": "/api/premium/ai/sentiment",
  "parameters": {
    "limit": {
      "type": "number",
      "required": false,
      "default": 20,
      "description": "Number of articles to analyze (max 50)"
    },
    "asset": {
      "type": "string",
      "required": false,
      "description": "Filter by asset symbol (e.g., BTC, ETH)"
    }
  },
  "price": "$0.02"
}
```

**Output Schema:**

```json
{
  "type": "object",
  "properties": {
    "articles": {
      "type": "array",
      "items": {
        "title": { "type": "string" },
        "sentiment": {
          "type": "string",
          "enum": ["very_bullish", "bullish", "neutral", "bearish", "very_bearish"]
        },
        "confidence": { "type": "number", "min": 0, "max": 100 },
        "impact": { "type": "string", "enum": ["high", "medium", "low"] },
        "affectedCoins": { "type": "array", "items": { "type": "string" } }
      }
    },
    "overall": {
      "type": "object",
      "properties": {
        "sentiment": { "type": "string" },
        "score": { "type": "number", "min": -100, "max": 100 },
        "summary": { "type": "string" },
        "keyDrivers": { "type": "array" }
      }
    }
  }
}
```

### Example: Advanced Screener

**Input Schema:**

```json
{
  "method": "GET",
  "path": "/api/premium/screener/advanced",
  "parameters": {
    "preset": {
      "type": "string",
      "enum": [
        "hot-gainers",
        "momentum-leaders",
        "oversold-bounce",
        "undervalued-gems",
        "near-ath",
        "large-caps",
        "mid-caps",
        "small-caps",
        "micro-caps",
        "high-volume"
      ]
    },
    "minMarketCap": { "type": "number" },
    "maxMarketCap": { "type": "number" },
    "minChange24h": { "type": "number" },
    "maxChange24h": { "type": "number" },
    "sort": { "type": "string" },
    "limit": { "type": "number", "max": 500 }
  },
  "price": "$0.02"
}
```

### Example: Market Snapshot (Free)

**Input Schema:**

```json
{
  "method": "GET",
  "path": "/api/market/snapshot/{coinId}",
  "parameters": {
    "coinId": {
      "type": "string",
      "required": true,
      "description": "CoinGecko coin ID (e.g., bitcoin, ethereum)"
    }
  }
}
```

**Output Schema:**

```json
{
  "type": "object",
  "properties": {
    "id": { "type": "string" },
    "symbol": { "type": "string" },
    "name": { "type": "string" },
    "market_data": {
      "type": "object",
      "properties": {
        "current_price": { "type": "object" },
        "market_cap": { "type": "object" },
        "price_change_percentage_24h": { "type": "number" }
      }
    }
  }
}
```

---

## Best Practices

### For AI Agent Developers

1. **Start with llms.txt** - Quick overview of capabilities
2. **Use agents.json** - Machine-readable endpoint definitions
3. **Check pricing** - Endpoints have different costs
4. **Handle 402 responses** - Use x402 SDK for automatic payment handling
5. **Cache responses** - Reduce costs by caching where appropriate
6. **Use access passes** - For heavy usage, $2/day is better than per-request
7. **Batch requests** - Use endpoints that return multiple data points

### Cost Optimization

| Strategy                                               | Savings |
| ------------------------------------------------------ | ------- |
| Use free endpoints when possible                       | 100%    |
| Cache responses (30s-5min TTL)                         | 50-90%  |
| Use daily pass for 100+ requests                       | 80%+    |
| Batch with screener instead of individual coin lookups | 70%     |

### Rate Limiting

| Tier             | Requests/Minute | Notes                |
| ---------------- | --------------- | -------------------- |
| Free             | 30              | Without x402 payment |
| x402 per-request | 60/endpoint     | With valid payment   |
| x402 access pass | 600/endpoint    | With active pass     |

### Error Handling

```typescript
try {
  const response = await api.get('/api/premium/ai/sentiment');
  return response.data;
} catch (error) {
  if (error.response?.status === 402) {
    // Payment required - check wallet balance
    const requirements = error.response.data.accepts[0];
    console.log(`Payment required: ${requirements.maxAmountRequired} USDC`);
    console.log(`Free alternative: ${error.response.data.freeAlternative}`);
  } else if (error.response?.status === 429) {
    // Rate limited
    const resetAt = error.response.headers['x-ratelimit-reset'];
    console.log(`Rate limited, resets at: ${new Date(parseInt(resetAt))}`);
  } else if (error.response?.status === 503) {
    // AI service unavailable
    console.log('AI service not configured - set GROQ_API_KEY');
  }
  throw error;
}
```

---

## Resources

- [x402 Protocol Documentation](https://docs.x402.org)
- [x402 Bazaar Discovery](https://docs.x402.org/core-concepts/bazaar-discovery-layer)
- [CDP Facilitator](https://docs.cdp.coinbase.com/x402)
- [API Reference](./API.md)
- [x402 Integration Guide](./X402_INTEGRATION.md)
- [Premium Pricing Page](/pricing/premium)
