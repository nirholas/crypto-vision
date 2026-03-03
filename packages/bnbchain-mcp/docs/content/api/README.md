# API Reference

Comprehensive API documentation for BNB-Chain-MCP Server.

---

## Overview

BNB-Chain-MCP provides **120+ tools** across multiple categories for interacting with EVM-compatible blockchains. The server supports three transport modes and integrates with Claude Desktop, Cursor, ChatGPT, and custom MCP clients.

### Server Modes

| Mode | Command | Port | Use Case |
|------|---------|------|----------|
| **stdio** | `npx @nirholas/bnb-chain-mcp` | N/A | Claude Desktop, Cursor |
| **HTTP** | `npx @nirholas/bnb-chain-mcp --http` | 3001 | ChatGPT Developer Mode |
| **SSE** | `npx @nirholas/bnb-chain-mcp --sse` | 3001 | Legacy HTTP clients |

### Supported Networks

| Network | Chain ID | Native Token |
|---------|----------|--------------|
| Ethereum | 1 | ETH |
| BNB Smart Chain | 56 | BNB |
| Arbitrum One | 42161 | ETH |
| Polygon | 137 | MATIC |
| Base | 8453 | ETH |
| Optimism | 10 | ETH |
| opBNB | 204 | BNB |
| + Testnets | Various | Various |

---

## Quick Reference

### Tool Categories

| Category | Tools | Description |
|----------|-------|-------------|
| [Network](tools/network-tools.md) | 12 | Chain info, RPC endpoints, network status |
| [Blocks](tools/blocks-tools.md) | 10 | Block queries, block range, miner info |
| [Transactions](tools/transactions-tools.md) | 14 | Send, trace, simulate, batch transactions |
| [Wallet](tools/wallet-tools.md) | 15 | Create wallet, balances, approvals, HD derivation |
| [Tokens](tools/tokens-tools.md) | 18 | ERC-20 operations, transfers, permits |
| [NFT](tools/nft-tools.md) | 12 | ERC-721/1155, metadata, transfers |
| [Swap](tools/swap-tools.md) | 8 | DEX swaps, quotes, liquidity, aggregation |
| [Bridge](tools/bridge-tools.md) | 6 | Cross-chain transfers, bridge quotes |
| [Staking](tools/staking-tools.md) | 8 | Native staking, liquid staking, farming |
| [Lending](tools/lending-tools.md) | 10 | Aave/Compound, supply, borrow, flash loans |
| [Price Feeds](tools/price-feeds-tools.md) | 6 | Chainlink oracles, TWAP, price aggregation |
| [Gas](tools/gas-tools.md) | 6 | Gas prices, EIP-1559, estimation |
| [Events](tools/events-tools.md) | 5 | Historical logs, event filtering, decoding |
| [Multicall](tools/multicall-tools.md) | 3 | Batch read/write operations |
| [Signatures](tools/signatures-tools.md) | 5 | Sign/verify messages, EIP-712 |
| [Domains](tools/domains-tools.md) | 8 | ENS registration, resolution, records |
| [Security](tools/security-tools.md) | 12 | Honeypot detection, rug checks, GoPlus |
| [Portfolio](tools/portfolio-tools.md) | 4 | Track holdings across chains |
| [Governance](tools/governance-tools.md) | 9 | Proposals, voting, delegation |
| [Contracts](tools/contracts-tools.md) | 8 | Read/write, ABI encoding, verification |
| [Deployment](tools/deployment-tools.md) | 5 | Deploy, CREATE2, proxies |
| [MEV](tools/mev-tools.md) | 6 | Flashbots, private transactions |
| [Market Data](tools/market-data-tools.md) | 15 | CoinGecko, CoinStats, prices, OHLCV |
| [DeFi Analytics](tools/defi-analytics-tools.md) | 12 | DefiLlama TVL, yields, protocols |
| [DEX Analytics](tools/dex-analytics-tools.md) | 10 | Pool data, trades, trending tokens |
| [Social](tools/social-tools.md) | 8 | LunarCrush sentiment, influencers |
| [News](tools/news-tools.md) | 7 | Crypto news aggregation |

---

## Authentication

### Environment Variables

```bash
# Required for write operations
PRIVATE_KEY=0x...your_private_key

# Optional API keys (enhance functionality)
COINGECKO_API_KEY=your_key      # Higher rate limits
COINSTATS_API_KEY=your_key      # Portfolio tracking
LUNARCRUSH_API_KEY=your_key     # Social sentiment
CRYPTOPANIC_API_KEY=your_key    # News aggregation
```

### Security Best Practices

!!! warning "Private Key Security"
    - Never commit private keys to version control
    - Use environment variables or secure vaults
    - Consider using separate keys for testing
    - Monitor wallets for unauthorized transactions

---

## Common Parameters

Many tools share common parameters:

### Network Selection

```typescript
network: z.enum([
  "ethereum", "bsc", "arbitrum", "polygon", 
  "base", "optimism", "opbnb", "sepolia",
  "bsc-testnet", "arbitrum-sepolia"
]).default("ethereum")
```

### Address Validation

```typescript
address: z.string()
  .regex(/^0x[a-fA-F0-9]{40}$/)
  .describe("Valid Ethereum address")
```

### Amount Formatting

```typescript
amount: z.string()
  .describe("Amount in human-readable format (e.g., '1.5' ETH)")
```

---

## Response Format

All tools return responses in a consistent format:

### Success Response

```json
{
  "content": [
    {
      "type": "text",
      "text": "{\n  \"result\": ...\n}"
    }
  ]
}
```

### Error Response

```json
{
  "content": [
    {
      "type": "text", 
      "text": "Error: Insufficient balance for transfer"
    }
  ],
  "isError": true
}
```

---

## Rate Limits

### Default Limits

| Provider | Free Tier | With API Key |
|----------|-----------|--------------|
| CoinGecko | 10-30 req/min | 500 req/min |
| CoinStats | 100 req/day | 10,000 req/day |
| LunarCrush | 10 req/min | 1,000 req/min |
| DefiLlama | Unlimited | N/A |
| GoPlus | 100 req/min | N/A |

### RPC Rate Limits

RPC endpoints have varying rate limits. Consider using:

- **Alchemy** or **Infura** for production
- **QuickNode** for high-throughput applications
- **Chainlist** for finding public RPCs

---

## Next Steps

- [Tool Categories](tools/) - Detailed documentation for each tool
- [Resources](resources.md) - Static documentation resources
- [Prompts](prompts.md) - Conversation templates
- [Integration Guides](../integrations/) - Platform-specific setup
- [Usage Guides](../guides/) - Building applications

---

## API Versioning

Current version: **1.0.0**

The API follows semantic versioning:

- **Major**: Breaking changes
- **Minor**: New features, backward compatible
- **Patch**: Bug fixes

Breaking changes are documented in the [CHANGELOG](https://github.com/nirholas/bnb-chain-mcp/blob/main/CHANGELOG.md).
