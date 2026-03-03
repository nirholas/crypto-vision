# MCP Resources

BNB-Chain-MCP provides several resources that can be read by MCP clients to access real-time blockchain and market data.

---

## Overview

Resources are read-only data sources that provide context without requiring tool calls. They're useful for:

- Getting current configuration
- Accessing cached market data
- Reading protocol documentation
- Retrieving chain information

---

## Available Resources

| Resource URI | Description |
|--------------|-------------|
| `config://networks` | List of supported networks |
| `config://settings` | Current server configuration |
| `market://overview` | Market overview snapshot |
| `market://trending` | Trending tokens |
| `chain://ethereum` | Ethereum network details |
| `chain://arbitrum` | Arbitrum network details |
| `chain://bsc` | BSC network details |
| `docs://api` | API documentation |
| `docs://tools` | Tools reference |

---

## config://networks

Returns the list of all supported blockchain networks.

### Response

```json
{
  "networks": [
    {
      "id": "ethereum",
      "name": "Ethereum Mainnet",
      "chainId": 1,
      "nativeCurrency": {
        "symbol": "ETH",
        "decimals": 18
      },
      "rpcUrl": "https://eth.llamarpc.com",
      "blockExplorer": "https://etherscan.io",
      "type": "mainnet"
    },
    {
      "id": "arbitrum",
      "name": "Arbitrum One",
      "chainId": 42161,
      "nativeCurrency": {
        "symbol": "ETH",
        "decimals": 18
      },
      "rpcUrl": "https://arb1.arbitrum.io/rpc",
      "blockExplorer": "https://arbiscan.io",
      "type": "mainnet"
    }
  ],
  "count": 12,
  "lastUpdated": "2024-03-10T12:00:00Z"
}
```

### Usage Example

```typescript
const networks = await mcpClient.readResource('config://networks');
console.log(`Supported networks: ${networks.count}`);
```

---

## config://settings

Returns the current server configuration.

### Response

```json
{
  "version": "1.0.0",
  "mode": "stdio",
  "features": {
    "swaps": true,
    "lending": true,
    "staking": true,
    "marketData": true,
    "security": true
  },
  "rateLimit": {
    "enabled": true,
    "requestsPerMinute": 100
  },
  "cache": {
    "enabled": true,
    "ttlSeconds": 60
  },
  "wallet": {
    "configured": true,
    "address": "0x742d35..."
  }
}
```

---

## market://overview

Returns a snapshot of current market conditions.

### Response

```json
{
  "timestamp": "2024-03-10T12:00:00Z",
  "global": {
    "totalMarketCap": 2450000000000,
    "totalVolume24h": 85000000000,
    "btcDominance": 51.2,
    "ethDominance": 16.8,
    "defiMarketCap": 89000000000,
    "activeCoins": 12500
  },
  "prices": {
    "bitcoin": 65000,
    "ethereum": 3500,
    "bnb": 580
  },
  "changes24h": {
    "bitcoin": 2.5,
    "ethereum": 3.2,
    "bnb": 1.8
  },
  "sentiment": {
    "fearGreedIndex": 52,
    "fearGreedLabel": "Neutral"
  },
  "gas": {
    "ethereum": {
      "fast": 45,
      "standard": 35,
      "slow": 25
    }
  }
}
```

---

## market://trending

Returns currently trending tokens.

### Response

```json
{
  "timestamp": "2024-03-10T12:00:00Z",
  "trending": [
    {
      "rank": 1,
      "id": "pepe",
      "name": "Pepe",
      "symbol": "PEPE",
      "marketCapRank": 45,
      "priceChange24h": 15.5,
      "score": 0.95
    },
    {
      "rank": 2,
      "id": "worldcoin",
      "name": "Worldcoin",
      "symbol": "WLD",
      "marketCapRank": 78,
      "priceChange24h": 12.3,
      "score": 0.88
    }
  ],
  "source": "coingecko"
}
```

---

## chain://ethereum

Returns details about the Ethereum network.

### Response

```json
{
  "network": {
    "id": "ethereum",
    "name": "Ethereum Mainnet",
    "chainId": 1,
    "nativeCurrency": {
      "symbol": "ETH",
      "decimals": 18,
      "price": 3500.00
    }
  },
  "stats": {
    "latestBlock": 19412345,
    "avgBlockTime": 12.1,
    "gasPrice": {
      "fast": 45,
      "standard": 35,
      "slow": 25
    },
    "pendingTx": 125000
  },
  "defi": {
    "tvl": 45000000000,
    "topProtocols": [
      { "name": "Lido", "tvl": 15000000000 },
      { "name": "Aave", "tvl": 8000000000 },
      { "name": "Maker", "tvl": 6000000000 }
    ]
  },
  "contracts": {
    "usdc": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    "usdt": "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    "weth": "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
  },
  "dexes": [
    { "name": "Uniswap V3", "router": "0xE592427A0AEce92De3Edee1F18E0157C05861564" },
    { "name": "1inch", "router": "0x1111111254EEB25477B68fb85Ed929f73A960582" }
  ]
}
```

---

## chain://arbitrum

Returns details about the Arbitrum network.

### Response

```json
{
  "network": {
    "id": "arbitrum",
    "name": "Arbitrum One",
    "chainId": 42161,
    "nativeCurrency": {
      "symbol": "ETH",
      "decimals": 18,
      "price": 3500.00
    },
    "layer": "L2",
    "parent": "ethereum"
  },
  "stats": {
    "latestBlock": 185234567,
    "avgBlockTime": 0.25,
    "gasPrice": {
      "fast": 0.15,
      "standard": 0.1,
      "slow": 0.05
    },
    "tps": 40
  },
  "defi": {
    "tvl": 3500000000,
    "topProtocols": [
      { "name": "GMX", "tvl": 450000000 },
      { "name": "Aave", "tvl": 420000000 },
      { "name": "Uniswap", "tvl": 380000000 }
    ]
  },
  "contracts": {
    "usdc": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
    "usdt": "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
    "weth": "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
    "arb": "0x912CE59144191C1204E64559FE8253a0e49E6548"
  },
  "bridges": [
    { "name": "Arbitrum Bridge", "url": "https://bridge.arbitrum.io" }
  ]
}
```

---

## Reading Resources

### Using MCP SDK

```typescript
import { Client } from '@modelcontextprotocol/sdk/client/index.js';

// List available resources
const resources = await client.listResources();
console.log(resources.resources);

// Read a specific resource
const networks = await client.readResource({ uri: 'config://networks' });
console.log(networks.contents[0].text);
```

### Using Custom Client

```typescript
async function readResource(uri: string): Promise<any> {
  const result = await sendRequest('resources/read', { uri });
  const content = result?.contents?.[0];
  if (content?.text) {
    return JSON.parse(content.text);
  }
  return result;
}

// Usage
const market = await readResource('market://overview');
console.log(`BTC Price: $${market.prices.bitcoin}`);
```

---

## Resource Templates

Some resources support templated URIs:

### chain://{networkId}

Read details for any supported network:

```typescript
// Supported: ethereum, arbitrum, bsc, polygon, base, optimism, opbnb
const bsc = await readResource('chain://bsc');
const polygon = await readResource('chain://polygon');
```

---

## Caching

Resources are cached to improve performance:

| Resource | Cache TTL |
|----------|-----------|
| config://networks | 24 hours |
| config://settings | No cache |
| market://overview | 60 seconds |
| market://trending | 5 minutes |
| chain://* | 30 seconds |

---

## Related Documentation

- [Tools Reference](tools/README.md) - Tool documentation
- [Prompts](prompts.md) - Available prompts
- [Custom Clients](../integrations/custom-clients.md) - Client implementation
