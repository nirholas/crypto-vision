# Claude Desktop Integration

Complete guide for integrating BNB-Chain-MCP with Claude Desktop.

---

## Overview

Claude Desktop uses the MCP (Model Context Protocol) to extend Claude's capabilities with external tools. BNB-Chain-MCP enables Claude to interact with blockchain networks, execute DeFi operations, and access market data.

---

## Quick Setup

### 1. Locate Configuration File

=== "macOS"
    ```
    ~/Library/Application Support/Claude/claude_desktop_config.json
    ```

=== "Windows"
    ```
    %APPDATA%\Claude\claude_desktop_config.json
    ```

=== "Linux"
    ```
    ~/.config/Claude/claude_desktop_config.json
    ```

### 2. Add MCP Server Configuration

```json
{
  "mcpServers": {
    "bnb-chain-mcp": {
      "command": "npx",
      "args": ["-y", "@nirholas/bnb-chain-mcp@latest"],
      "env": {
        "PRIVATE_KEY": "your_private_key_here"
      }
    }
  }
}
```

### 3. Restart Claude Desktop

Close and reopen Claude Desktop to apply the configuration.

---

## Configuration Options

### Basic Configuration (Read-Only)

For read-only operations (no wallet needed):

```json
{
  "mcpServers": {
    "bnb-chain-mcp": {
      "command": "npx",
      "args": ["-y", "@nirholas/bnb-chain-mcp@latest"]
    }
  }
}
```

### Full Configuration (With Wallet)

For write operations (transactions, swaps, etc.):

```json
{
  "mcpServers": {
    "bnb-chain-mcp": {
      "command": "npx",
      "args": ["-y", "@nirholas/bnb-chain-mcp@latest"],
      "env": {
        "PRIVATE_KEY": "0x...",
        "COINGECKO_API_KEY": "your_key",
        "COINSTATS_API_KEY": "your_key",
        "LUNARCRUSH_API_KEY": "your_key",
        "CRYPTOPANIC_API_KEY": "your_key"
      }
    }
  }
}
```

### Local Development

For local development with source code:

```json
{
  "mcpServers": {
    "bnb-chain-mcp": {
      "command": "bun",
      "args": ["run", "dev"],
      "cwd": "/path/to/bnb-chain-mcp",
      "env": {
        "PRIVATE_KEY": "0x...",
        "LOG_LEVEL": "DEBUG"
      }
    }
  }
}
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PRIVATE_KEY` | For writes | Wallet private key for transactions |
| `COINGECKO_API_KEY` | Optional | Higher rate limits for market data |
| `COINSTATS_API_KEY` | Optional | Portfolio tracking features |
| `LUNARCRUSH_API_KEY` | Optional | Social sentiment data |
| `CRYPTOPANIC_API_KEY` | Optional | Crypto news aggregation |
| `LOG_LEVEL` | Optional | `DEBUG`, `INFO`, `WARN`, `ERROR` |

---

## Security Best Practices

!!! danger "Private Key Security"
    **Never use your main wallet private key!**

### Recommended Approach

1. **Create a dedicated wallet** for AI interactions
2. **Fund minimally** - Only transfer what you need
3. **Use hardware wallet** for main holdings
4. **Monitor transactions** - Set up alerts

### Environment Variable Security

=== "macOS/Linux"
    ```bash
    # Create .env file with restricted permissions
    touch ~/.claude-crypto-env
    chmod 600 ~/.claude-crypto-env
    
    # Add your keys
    echo "PRIVATE_KEY=0x..." >> ~/.claude-crypto-env
    
    # Load in config
    ```

=== "Windows"
    Use Windows Credential Manager or encrypted config files.

### Alternative: Prompt for Key

For maximum security, don't store the key:

```json
{
  "mcpServers": {
    "bnb-chain-mcp": {
      "command": "npx",
      "args": ["-y", "@nirholas/bnb-chain-mcp@latest"]
    }
  }
}
```

Then provide the key when needed:
> "Use private key 0x... to send 0.1 ETH to 0x..."

---

## Verifying Installation

After configuration, test with Claude:

### Test 1: Network Info
> "What's the current Ethereum block number?"

Expected: Claude should return the current block number.

### Test 2: Price Data
> "What's the current price of Bitcoin?"

Expected: Claude should return BTC price from CoinGecko.

### Test 3: Token Check (if wallet configured)
> "Check my ETH balance on Ethereum"

Expected: Claude should return your wallet balance.

---

## Example Conversations

### Portfolio Check

> **You:** What's the current state of my portfolio on Arbitrum?
>
> **Claude:** I'll check your portfolio on Arbitrum using your configured wallet.
>
> [Uses `portfolio_get_summary` tool]
>
> Your Arbitrum portfolio:
> - **ETH:** 2.45 ($5,890.50)
> - **USDC:** 1,500.00 ($1,500.00)
> - **ARB:** 500 ($475.00)
> 
> Total Value: **$7,865.50**

### Swap Execution

> **You:** Swap 100 USDC for ETH on Arbitrum with 1% slippage
>
> **Claude:** I'll execute this swap for you. Let me first get a quote...
>
> [Uses `swap_get_quote` tool]
>
> Quote received:
> - Input: 100 USDC
> - Output: ~0.0408 ETH
> - Price Impact: 0.05%
> - Gas: ~$0.15
>
> Shall I proceed with the swap?
>
> **You:** Yes
>
> **Claude:** [Uses `swap_execute` tool]
>
> ✅ Swap completed!
> - Transaction: `0x1234...`
> - Received: 0.0407 ETH
> - Gas Used: $0.14

### Security Check

> **You:** Is this token safe to buy? 0xNewMemeToken on BSC
>
> **Claude:** Let me analyze this token for security risks...
>
> [Uses `security_check_token` tool]
>
> ⚠️ **HIGH RISK TOKEN DETECTED**
>
> **Red Flags:**
> - ❌ Liquidity not locked
> - ❌ Top 10 holders control 75%
> - ❌ Contract has mint function
> - ❌ Only 3 days old
>
> **Recommendation:** Do not invest. This token shows multiple rug pull indicators.

---

## Troubleshooting

### Server Not Starting

**Symptoms:** Claude says "Server not available" or tools don't appear.

**Solutions:**
1. Check JSON syntax in config file
2. Verify Node.js is installed: `node --version`
3. Check logs: `~/.config/Claude/logs/`

### Permission Denied

**Symptoms:** "EACCES" errors in logs.

**Solutions:**
```bash
# Fix npm permissions
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
export PATH=~/.npm-global/bin:$PATH
```

### Rate Limiting

**Symptoms:** "Rate limit exceeded" errors.

**Solutions:**
1. Add API keys for higher limits
2. Wait between requests
3. Cache responses when possible

### Transaction Failures

**Symptoms:** Transactions fail or revert.

**Solutions:**
1. Check wallet has sufficient balance
2. Verify network is correct
3. Increase gas limit
4. Check token approvals

---

## Advanced Configuration

### Multiple Networks

Configure default networks per use case:

```json
{
  "mcpServers": {
    "crypto-mainnet": {
      "command": "npx",
      "args": ["-y", "@nirholas/bnb-chain-mcp@latest"],
      "env": {
        "DEFAULT_NETWORK": "ethereum",
        "PRIVATE_KEY": "0x..."
      }
    },
    "crypto-testnet": {
      "command": "npx",
      "args": ["-y", "@nirholas/bnb-chain-mcp@latest"],
      "env": {
        "DEFAULT_NETWORK": "sepolia",
        "PRIVATE_KEY": "0x..."
      }
    }
  }
}
```

### Custom RPC Endpoints

```json
{
  "env": {
    "ETHEREUM_RPC": "https://your-alchemy-endpoint",
    "ARBITRUM_RPC": "https://your-infura-endpoint"
  }
}
```

### Logging

Enable debug logging for troubleshooting:

```json
{
  "env": {
    "LOG_LEVEL": "DEBUG",
    "LOG_FILE": "/tmp/crypto-mcp.log"
  }
}
```

---

## Next Steps

- [Tool Reference](../api/README.md) - Complete tool documentation
- [Usage Guides](../guides/) - Common workflows
- [HTTP Server Mode](http-server.md) - For web integrations
