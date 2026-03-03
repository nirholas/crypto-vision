# Universal Crypto MCP Plugin for AutoGPT

Enable AutoGPT to interact with 50+ blockchain networks through the Universal Crypto MCP server.

## Features

- 🔍 **Balance Checking** - Query wallet balances across all EVM networks
- 🛡️ **Security Analysis** - Check tokens for honeypots and rug pulls
- 📊 **Market Data** - Get real-time prices, market caps, and trends
- ⛽ **Gas Monitoring** - Track gas prices across chains
- 💼 **Portfolio Tracking** - Aggregate holdings across networks

## Installation

### 1. Install the Plugin

Copy this folder to your AutoGPT plugins directory:

```bash
cp -r autogpt-plugin /path/to/Auto-GPT/plugins/crypto_mcp
```

### 2. Enable the Plugin

Add to your AutoGPT `.env` file:

```env
ALLOWLISTED_PLUGINS=crypto_mcp
```

Or in `plugins_config.yaml`:

```yaml
crypto_mcp:
  enabled: true
  config:
    mcp_server_url: http://localhost:3000  # Optional: for HTTP mode
```

### 3. Start the MCP Server (Optional)

For HTTP mode, start the server separately:

```bash
npx -y @nirholas/universal-crypto-mcp@latest --transport http --port 3000
```

## Available Commands

### Balance Operations

| Command | Description | Example |
|---------|-------------|---------|
| `crypto_get_balance` | Get native token balance | Address + network |
| `crypto_get_token_balance` | Get ERC20 balance | Token address + wallet + network |
| `crypto_get_portfolio` | Multi-chain portfolio | Wallet address |

### Security Operations

| Command | Description | Example |
|---------|-------------|---------|
| `crypto_security_check` | Full security analysis | Token address + network |
| `crypto_honeypot_check` | Check if honeypot | Token address + network |

### Market Operations

| Command | Description | Example |
|---------|-------------|---------|
| `crypto_get_price` | Get current price | CoinGecko ID |
| `crypto_get_market_data` | Full market data | CoinGecko ID |
| `crypto_get_trending` | Trending coins | - |

### Gas Operations

| Command | Description | Example |
|---------|-------------|---------|
| `crypto_get_gas` | Current gas prices | Network name |
| `crypto_compare_gas` | Compare across chains | - |

## Example Usage in AutoGPT

```
User: Check if this token is safe to buy: 0x1234...abcd on BSC

AutoGPT:
> Thinking: I should check the token security before recommending
> Using: crypto_security_check with address 0x1234...abcd on bsc

Result:
Security Score: 35/100 ⚠️
- CRITICAL: Contract is a honeypot - sells will fail
- WARNING: Owner can mint unlimited tokens
- WARNING: Trading tax is 15%

> Conclusion: This token is NOT safe. It's flagged as a honeypot with
> several critical security issues. I strongly advise against buying.
```

## Supported Networks

| Network | Chain ID | Native Token |
|---------|----------|--------------|
| Ethereum | 1 | ETH |
| BNB Chain | 56 | BNB |
| Arbitrum | 42161 | ETH |
| Polygon | 137 | MATIC |
| Optimism | 10 | ETH |
| Base | 8453 | ETH |
| Avalanche | 43114 | AVAX |
| opBNB | 204 | BNB |

## Configuration Options

Environment variables:

```env
# MCP Server configuration
MCP_TRANSPORT=stdio          # stdio or http
MCP_SERVER_URL=              # URL for HTTP mode
MCP_TIMEOUT=30000            # Request timeout in ms

# Optional API keys for enhanced features
COINGECKO_API_KEY=           # For higher rate limits
```

## Troubleshooting

### Plugin Not Loading

1. Ensure the plugin folder is named correctly
2. Check that `__init__.py` exists
3. Verify the plugin is allowlisted in `.env`

### MCP Connection Failed

1. For stdio mode: Ensure Node.js 18+ is installed
2. For HTTP mode: Check that the server is running
3. Verify network connectivity

### Slow Responses

1. Check your network connection
2. Some operations (security checks) may take a few seconds
3. Consider using HTTP mode for better performance

## Development

To modify the plugin:

1. Edit `plugin.py` to add new commands
2. Test with AutoGPT in debug mode
3. Check logs in `logs/` directory

## License

MIT License - see [LICENSE](../../../LICENSE)

## Author

Nich - Universal Crypto MCP Team
