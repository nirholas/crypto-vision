# Using Binance MCP with OpenRouter

Binance MCP is a Model Context Protocol server that provides AI agents with access to Binance exchange data and trading capabilities.

## What is OpenRouter?

[OpenRouter](https://openrouter.ai) provides unified access to 200+ AI models. Since Binance MCP is an MCP server, it works with any OpenRouter-powered AI client.

## Setup

### 1. Get Your OpenRouter API Key

1. Sign up at [openrouter.ai](https://openrouter.ai)
2. Generate an API key at [openrouter.ai/settings/keys](https://openrouter.ai/settings/keys)

### 2. Configure Your AI Client

Set OpenRouter as your model provider:

```json
{
  "modelProvider": {
    "type": "openrouter",
    "apiKey": "sk-or-v1-your-key-here",
    "model": "anthropic/claude-sonnet-4"
  }
}
```

### 3. Add Binance MCP Server

```json
{
  "mcpServers": {
    "binance": {
      "command": "npx",
      "args": ["-y", "@nirholas/binance-mcp"],
      "env": {
        "BINANCE_API_KEY": "your-binance-api-key",
        "BINANCE_SECRET_KEY": "your-binance-secret"
      }
    }
  }
}
```

### 4. Start Using

Ask your AI:
- "What's the current BTC/USDT price on Binance?"
- "Show my Binance spot balances"
- "Get the 24h trading volume for ETH"
- "Place a limit order for 0.1 BTC at $60,000"

## Available Tools

| Tool | Description |
|------|-------------|
| `get_price` | Get current price for a trading pair |
| `get_orderbook` | Get order book depth |
| `get_24h_stats` | 24-hour trading statistics |
| `get_balances` | Account balances |
| `place_order` | Place spot orders |
| `get_open_orders` | List open orders |
| `cancel_order` | Cancel an order |

## Getting Binance API Keys

1. Log in to [Binance](https://binance.com)
2. Go to API Management
3. Create a new API key
4. Enable required permissions (read, trade if needed)
5. Add IP restrictions for security

## Resources

- [GitHub](https://github.com/nirholas/binance-mcp)
- [Binance API Docs](https://binance-docs.github.io/apidocs/)
- [OpenRouter Docs](https://openrouter.ai/docs)
