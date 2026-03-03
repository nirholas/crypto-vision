---
title: Claude Desktop Integration
description: Complete setup guide for using MCP servers with Claude Desktop
---

# Claude Desktop Integration

This guide walks you through setting up abi-to-mcp generated servers with Claude Desktop for seamless blockchain interaction.

## Prerequisites

- [Claude Desktop](https://claude.ai/download) installed
- abi-to-mcp installed
- A generated MCP server
- RPC endpoint (Alchemy, Infura, or public)

## Overview

```mermaid
graph LR
    A[Claude Desktop] <-->|MCP Protocol| B[Generated Server]
    B <-->|JSON-RPC| C[Blockchain]
    
    style A fill:#8B5CF6,color:#fff
    style B fill:#4CAF50,color:#fff
    style C fill:#627EEA,color:#fff
```

Claude Desktop communicates with MCP servers via the MCP protocol. Each server provides tools and resources that Claude can use to interact with smart contracts.

## Step 1: Generate a Server

If you haven't already:

```bash
# Example: USDC token
abi-to-mcp generate 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 \
    --network mainnet \
    --output ~/mcp-servers/usdc \
    --name "USDC Token"
```

## Step 2: Test the Server

Verify it works standalone:

```bash
cd ~/mcp-servers/usdc
pip install -r requirements.txt

# Set RPC URL
export RPC_URL="https://eth-mainnet.g.alchemy.com/v2/YOUR-KEY"

# Test run
python server.py
```

You should see:
```
Starting USDC Token MCP Server...
Listening on stdio...
```

Press Ctrl+C to stop.

## Step 3: Configure Claude Desktop

### Find the Config File

| OS | Path |
|----|------|
| macOS | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Windows | `%APPDATA%\Claude\claude_desktop_config.json` |
| Linux | `~/.config/claude/claude_desktop_config.json` |

### Create or Edit Config

```json
{
  "mcpServers": {
    "usdc": {
      "command": "python",
      "args": ["/Users/yourname/mcp-servers/usdc/server.py"],
      "env": {
        "RPC_URL": "https://eth-mainnet.g.alchemy.com/v2/YOUR-KEY"
      }
    }
  }
}
```

!!! warning "Use Absolute Paths"
    Always use full absolute paths for the server script. Relative paths may not work correctly.

### Multiple Servers

Add more servers for different contracts or networks:

```json
{
  "mcpServers": {
    "usdc": {
      "command": "python",
      "args": ["/Users/yourname/mcp-servers/usdc/server.py"],
      "env": {
        "RPC_URL": "https://eth-mainnet.g.alchemy.com/v2/YOUR-KEY"
      }
    },
    "bayc": {
      "command": "python",
      "args": ["/Users/yourname/mcp-servers/bayc/server.py"],
      "env": {
        "RPC_URL": "https://eth-mainnet.g.alchemy.com/v2/YOUR-KEY"
      }
    },
    "uniswap": {
      "command": "python",
      "args": ["/Users/yourname/mcp-servers/uniswap/server.py"],
      "env": {
        "RPC_URL": "https://eth-mainnet.g.alchemy.com/v2/YOUR-KEY"
      }
    }
  }
}
```

## Step 4: Restart Claude Desktop

Completely quit and reopen Claude Desktop. The servers will start automatically.

## Step 5: Verify Connection

In Claude Desktop, you should see the MCP icon indicating connected servers. Try a query:

> "What's the USDC balance of vitalik.eth?"

Claude will use the `balance_of` tool from your USDC server.

## Example Conversations

### Checking Balances

> **You:** What's the USDC balance of 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045?
>
> **Claude:** I'll check the USDC balance for that address.
>
> [Uses balance_of tool]
>
> The address 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045 holds 1,234.56 USDC.

### Token Information

> **You:** Tell me about this token
>
> **Claude:** I'll get the token information.
>
> [Uses name, symbol, decimals, total_supply tools]
>
> **Token Details:**
> - Name: USD Coin
> - Symbol: USDC
> - Decimals: 6
> - Total Supply: 26,234,567,890.00 USDC

### Simulating Transfers

> **You:** What would happen if I transferred 100 USDC to 0x742d35Cc6634C0532925a3b844Bc9e7595f5b7A5?
>
> **Claude:** I'll simulate that transfer for you.
>
> [Uses transfer tool with simulate=True]
>
> **Simulation Result:**
> - Would succeed: ✅ Yes
> - Gas estimate: 65,000 units
> - Estimated cost: ~0.002 ETH ($3.50)
>
> Would you like me to execute this transfer?

### NFT Ownership

> **You:** Who owns BAYC #1234?
>
> **Claude:** I'll look up the owner of that NFT.
>
> [Uses owner_of tool]
>
> Bored Ape #1234 is owned by 0x123...

## Enabling Write Operations

To allow Claude to execute transactions (not just simulate):

### 1. Add Private Key

In your config, add the private key environment variable:

```json
{
  "mcpServers": {
    "usdc": {
      "command": "python",
      "args": ["/path/to/server.py"],
      "env": {
        "RPC_URL": "https://...",
        "PRIVATE_KEY": "0x..."
      }
    }
  }
}
```

!!! danger "Security Warning"
    - Never use a wallet with significant funds
    - Create a dedicated wallet for MCP interactions
    - Only fund it with what you're willing to risk

### 2. Confirm Execution

When you ask Claude to execute:

> **You:** Transfer 10 USDC to 0x742d35Cc6634C0532925a3b844Bc9e7595f5b7A5
>
> **Claude:** I'll simulate this transfer first.
>
> [Simulation results...]
>
> The simulation succeeded. This will:
> - Send 10 USDC to 0x742d...
> - Cost approximately 0.002 ETH in gas
>
> Would you like me to proceed with the actual transfer?
>
> **You:** Yes, proceed
>
> **Claude:** [Executes transfer with simulate=False]
>
> ✅ Transfer complete!
> Transaction: 0xabc123...

## Troubleshooting

### Server Not Connecting

Check the Claude Desktop logs:

```bash
# macOS
tail -f ~/Library/Logs/Claude/mcp*.log

# Linux
tail -f ~/.local/share/claude/logs/mcp*.log
```

Common issues:
- Wrong path to server.py
- Missing dependencies
- Invalid RPC URL

### "Tool not found"

- Restart Claude Desktop
- Check server is in config
- Verify server starts without errors

### RPC Errors

- Check RPC URL is valid
- Verify API key has sufficient credits
- Try a different RPC provider

### Slow Responses

- RPC endpoint may be rate-limited
- Use a paid RPC plan
- Consider caching for repeated queries

## Best Practices

### 1. Use Read-Only for Exploration

Generate read-only servers when you don't need writes:

```bash
abi-to-mcp generate 0x... --read-only --output ./explorer
```

### 2. Separate Private Keys

Use different wallets for different purposes:
- Testing wallet (small funds)
- Production wallet (monitored)
- Never your main wallet

### 3. Monitor Usage

Check your RPC provider dashboard for:
- API usage
- Rate limits
- Errors

### 4. Keep Servers Updated

When contract ABIs change:

```bash
# Regenerate
abi-to-mcp generate 0x... --output ./my-server --force
```

## Advanced Configuration

### Custom Python Path

If using a virtual environment:

```json
{
  "mcpServers": {
    "usdc": {
      "command": "/path/to/venv/bin/python",
      "args": ["/path/to/server.py"],
      "env": {
        "RPC_URL": "..."
      }
    }
  }
}
```

### Working Directory

Set a working directory:

```json
{
  "mcpServers": {
    "usdc": {
      "command": "python",
      "args": ["server.py"],
      "cwd": "/path/to/usdc-server",
      "env": {
        "RPC_URL": "..."
      }
    }
  }
}
```

### Environment File

For many environment variables:

```json
{
  "mcpServers": {
    "usdc": {
      "command": "bash",
      "args": ["-c", "source .env && python server.py"],
      "cwd": "/path/to/usdc-server"
    }
  }
}
```

## What's Next?

- [ERC20 Guide](erc20-token.md) - Token-specific features
- [DeFi Guide](defi-protocol.md) - Complex protocols
- [Safety Features](../concepts/safety.md) - Understanding protections

!!! example "Configuration Example"
    A complete Claude Desktop configuration example is available in [`examples/claude_desktop/`](https://github.com/nirholas/UCAI/tree/main/examples/claude_desktop).
