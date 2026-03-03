# ERC20 Token Example

Generate an MCP server for the USDC stablecoin on Ethereum mainnet.

## Quick Start

```bash
# Generate the server
./generate.sh

# Or manually:
abi-to-mcp generate usdc_abi.json \
  --address 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 \
  --network mainnet \
  --name "USDC Token" \
  --output ./output
```

## Available Tools

The generated server provides these tools:

| Tool | Type | Description |
|------|------|-------------|
| `name` | Read | Get token name |
| `symbol` | Read | Get token symbol |
| `decimals` | Read | Get decimal places (6 for USDC) |
| `total_supply` | Read | Get total token supply |
| `balance_of` | Read | Get balance of an address |
| `allowance` | Read | Get spending allowance |
| `transfer` | Write | Transfer tokens |
| `approve` | Write | Approve spender |
| `transfer_from` | Write | Transfer on behalf of another |

## Events

| Event | Description |
|-------|-------------|
| `Transfer` | Token transfer occurred |
| `Approval` | Spending approval granted |

## Claude Desktop Integration

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "usdc": {
      "command": "python",
      "args": ["/path/to/output/server.py"],
      "env": {
        "RPC_URL": "https://eth.llamarpc.com"
      }
    }
  }
}
```
