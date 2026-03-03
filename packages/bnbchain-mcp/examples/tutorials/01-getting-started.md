# Tutorial 1: Getting Started with Universal Crypto MCP

Welcome to Universal Crypto MCP! This tutorial will guide you through setting up and using the MCP server with your AI assistant.

**Difficulty:** ⭐ Beginner  
**Time:** 15 minutes  
**Prerequisites:** Node.js 18+, Claude Desktop or compatible MCP client

---

## Table of Contents

1. [What is Universal Crypto MCP?](#what-is-universal-crypto-mcp)
2. [Installation](#installation)
3. [Configuration](#configuration)
4. [Your First Query](#your-first-query)
5. [Common Operations](#common-operations)
6. [Troubleshooting](#troubleshooting)
7. [Next Steps](#next-steps)

---

## What is Universal Crypto MCP?

Universal Crypto MCP is a **Model Context Protocol (MCP) server** that enables AI assistants like Claude to interact with blockchain networks. It provides:

- 🔗 **Multi-chain support** - Ethereum, BNB Chain, Arbitrum, Polygon, and more
- 💰 **Balance checking** - Native tokens and ERC20 tokens
- 📊 **Market data** - Prices, charts, trending coins
- 🛡️ **Security analysis** - Honeypot detection, rug pull warnings
- ⛽ **Gas tracking** - Real-time gas prices
- 🔄 **DeFi operations** - Swap quotes, bridge routes

### Supported Networks

| Network | Chain ID | Native Token |
|---------|----------|--------------|
| Ethereum | 1 | ETH |
| BNB Smart Chain | 56 | BNB |
| Arbitrum One | 42161 | ETH |
| Polygon | 137 | MATIC |
| Optimism | 10 | ETH |
| Base | 8453 | ETH |
| Avalanche | 43114 | AVAX |
| opBNB | 204 | BNB |

---

## Installation

### Option 1: Claude Desktop (Recommended)

1. **Install Claude Desktop** from [claude.ai/download](https://claude.ai/download)

2. **Open the configuration file:**
   - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - Windows: `%APPDATA%\Claude\claude_desktop_config.json`
   - Linux: `~/.config/Claude/claude_desktop_config.json`

3. **Add the MCP server:**

```json
{
  "mcpServers": {
    "crypto": {
      "command": "npx",
      "args": ["-y", "@nirholas/universal-crypto-mcp@latest"]
    }
  }
}
```

4. **Restart Claude Desktop**

### Option 2: Run Manually (Development)

```bash
# Install globally
npm install -g @nirholas/universal-crypto-mcp

# Or run with npx (no install needed)
npx -y @nirholas/universal-crypto-mcp@latest
```

### Option 3: HTTP Mode (ChatGPT, API Access)

```bash
# Start HTTP server
npx -y @nirholas/universal-crypto-mcp@latest --transport http --port 3000

# Server will be available at http://localhost:3000
```

---

## Configuration

### Environment Variables (Optional)

Set these for enhanced features:

```bash
# Higher CoinGecko rate limits
export COINGECKO_API_KEY=your-api-key

# Custom RPC endpoints
export ETH_RPC_URL=https://your-eth-rpc.com
export BSC_RPC_URL=https://your-bsc-rpc.com
```

### Full Configuration Example

```json
{
  "mcpServers": {
    "crypto": {
      "command": "npx",
      "args": ["-y", "@nirholas/universal-crypto-mcp@latest"],
      "env": {
        "COINGECKO_API_KEY": "your-key-here",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

---

## Your First Query

Once set up, you can ask Claude natural language questions:

### Check a Balance

> **You:** What's the ETH balance of vitalik.eth?

Claude will use the MCP server to resolve the ENS name and fetch the balance:

> **Claude:** The wallet vitalik.eth (0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045) has:
> - **4,832.15 ETH** (~$15,714,487 USD)

### Get Market Data

> **You:** What's the current Bitcoin price and how has it performed this week?

> **Claude:** Bitcoin (BTC) is currently trading at **$67,234.56**
> - 24h: +2.3%
> - 7d: +8.7%
> - Market Cap: $1.32 trillion
> - 24h Volume: $28.5 billion

### Check Gas Prices

> **You:** What are gas prices on Ethereum and Arbitrum right now?

> **Claude:** Current gas prices:
> 
> **Ethereum:**
> - Slow: 12 Gwei (~$0.63)
> - Standard: 15 Gwei (~$0.78)
> - Fast: 20 Gwei (~$1.04)
> 
> **Arbitrum:**
> - Standard: 0.01 Gwei (~$0.002)
> 
> Gas is 1500x cheaper on Arbitrum!

---

## Common Operations

### Token Lookup

```
What token is at 0xdAC17F958D2ee523a2206206994597C13D831ec7 on Ethereum?
```

Response: USDT (Tether USD), 6 decimals, circulating supply: 83B

### Security Check

```
Is this token safe? 0x1234...abcd on BSC
```

Response includes:
- Security score (0-100)
- Honeypot detection
- Ownership analysis
- Tax information
- Risk warnings

### Multi-Chain Portfolio

```
Show me all the balances for 0xYourWallet across all networks
```

Response shows balances on Ethereum, BSC, Arbitrum, Polygon, etc.

### Swap Quote

```
Get a quote to swap 1 ETH for USDC on Ethereum
```

Response shows best rates from 1inch, 0x, ParaSwap with gas estimates.

---

## Tool Reference

Here are the most commonly used tools:

### Balance Tools
| Tool | Description |
|------|-------------|
| `get_native_balance` | Get ETH/BNB/MATIC balance |
| `get_erc20_balance` | Get token balance |
| `get_erc20_token_info` | Get token details |

### Market Tools
| Tool | Description |
|------|-------------|
| `market_get_coin_by_id` | Get price and market data |
| `market_get_trending` | Get trending coins |
| `market_get_fear_and_greed` | Market sentiment index |

### Security Tools
| Tool | Description |
|------|-------------|
| `security_check_token` | Full security analysis |
| `security_honeypot_check` | Quick honeypot check |

### Gas Tools
| Tool | Description |
|------|-------------|
| `get_gas_price` | Current gas prices |
| `estimate_transaction_cost` | Estimate tx cost |

---

## Troubleshooting

### "MCP server not found"

1. Ensure Node.js 18+ is installed: `node --version`
2. Try running manually: `npx -y @nirholas/universal-crypto-mcp@latest`
3. Check the config file path is correct

### "Network timeout"

1. Check your internet connection
2. Try a different network (e.g., `arbitrum` instead of `ethereum`)
3. The RPC endpoint might be rate-limited

### "Tool not found"

1. Update to the latest version: `npm update -g @nirholas/universal-crypto-mcp`
2. Restart Claude Desktop
3. Check tool name spelling

### Slow Responses

1. Some operations (security checks) take a few seconds
2. Market data has rate limits - wait a moment between requests
3. Consider using HTTP mode for better performance

---

## Next Steps

Now that you're set up, explore these tutorials:

1. **[Building a Portfolio Dashboard](./02-building-portfolio-dashboard.md)** - Create a multi-chain portfolio tracker
2. **[Creating a DeFi Monitor](./03-creating-defi-monitor.md)** - Monitor positions and yields
3. **[Token Security Guide](./04-token-security-guide.md)** - Deep dive into security analysis
4. **[Multi-Agent Systems](./05-multi-agent-system.md)** - Build autonomous agents

### Example Projects

Check out the `/examples` directory for ready-to-run code:

- `basic/` - Simple balance and price checkers
- `intermediate/` - Portfolio analyzers and swap aggregators
- `advanced/` - Autonomous agents and webhook integrations
- `integrations/` - LangChain, AutoGPT, Discord bot

### Getting Help

- 📖 [Full Documentation](https://github.com/nirholas/bnbchain-mcp)
- 🐛 [Report Issues](https://github.com/nirholas/bnbchain-mcp/issues)
- 💬 [Discord Community](https://discord.gg/your-server)

---

**Congratulations!** 🎉 You've completed the Getting Started tutorial. You now have a powerful crypto assistant at your fingertips!
