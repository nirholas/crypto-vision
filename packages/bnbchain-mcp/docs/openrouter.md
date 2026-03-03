# Using BNB Chain MCP with OpenRouter

BNB Chain MCP is a Model Context Protocol server for interacting with BNB Chain (BSC) - the high-performance blockchain for DeFi.

## What is OpenRouter?

[OpenRouter](https://openrouter.ai) provides unified access to 200+ AI models. Works with any MCP-compatible AI client.

## Setup

### 1. Get Your OpenRouter API Key

1. Sign up at [openrouter.ai](https://openrouter.ai)
2. Generate an API key at [openrouter.ai/settings/keys](https://openrouter.ai/settings/keys)

### 2. Configure Your AI Client

```json
{
  "modelProvider": {
    "type": "openrouter",
    "apiKey": "sk-or-v1-your-key-here"
  }
}
```

### 3. Add BNB Chain MCP Server

```json
{
  "mcpServers": {
    "bnbchain": {
      "command": "npx",
      "args": ["-y", "@nirholas/bnbchain-mcp"]
    }
  }
}
```

### 4. Start Using

Ask your AI:
- "What's the BNB balance of this address?"
- "Get gas prices on BSC"
- "Show PancakeSwap pool data"

## Available Tools

| Tool | Description |
|------|-------------|
| `get_balance` | BNB and token balances |
| `get_gas_price` | Current gas prices |
| `get_block` | Block information |
| `get_transaction` | Transaction details |
| `call_contract` | Read contract data |

## Resources

- [GitHub](https://github.com/nirholas/bnbchain-mcp)
- [BNB Chain Docs](https://docs.bnbchain.org/)
- [OpenRouter Docs](https://openrouter.ai/docs)
