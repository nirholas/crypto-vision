---
title: First MCP Server
description: Understanding the structure of a generated MCP server
---

# Your First MCP Server

Now that you've generated an MCP server, let's understand what was created and how it works.

## Generated File Structure

When you run `abi-to-mcp generate`, the following files are created:

```
my-mcp-server/
├── server.py           # Main MCP server implementation
├── config.py           # Configuration and environment variables
├── README.md           # Auto-generated documentation
├── requirements.txt    # Python dependencies
├── pyproject.toml      # Package metadata
└── .env.example        # Environment variable template
```

Let's explore each file.

## server.py - The MCP Server

This is the heart of your generated server. It contains:

### Tool Definitions

Every contract function becomes an MCP tool:

```python
@mcp.tool()
async def balance_of(account: str) -> str:
    """
    Get the token balance for an address.
    
    This is a read-only function (no gas required).
    
    Args:
        account: Ethereum address (20 bytes)
    
    Returns:
        Token balance as string (in wei)
    """
    result = await contract.functions.balanceOf(
        Web3.to_checksum_address(account)
    ).call()
    return str(result)
```

### Read vs Write Tools

Read-only functions (view/pure) are simple:

```python
@mcp.tool()
async def name() -> str:
    """Get the token name. Read-only."""
    return await contract.functions.name().call()
```

Write functions include simulation by default:

```python
@mcp.tool()
async def transfer(to: str, amount: str, simulate: bool = True) -> dict:
    """
    Transfer tokens to another address.
    
    ⚠️ This function modifies blockchain state and requires gas.
    
    Args:
        to: Recipient address
        amount: Amount in wei (as string)
        simulate: If True, only simulate the transaction
    
    Returns:
        Transaction result or simulation details
    """
    if simulate:
        # Simulate the transaction
        result = await simulate_transaction(
            contract.functions.transfer(to, int(amount))
        )
        return {"simulated": True, **result}
    else:
        # Execute real transaction
        tx = await execute_transaction(
            contract.functions.transfer(to, int(amount))
        )
        return {"simulated": False, "tx_hash": tx.hex()}
```

### Resource Definitions

Events become MCP resources for querying historical data:

```python
@mcp.resource("events://transfer")
async def get_transfer_events(
    from_block: int = None,
    to_block: int = None
) -> list:
    """
    Query Transfer events from the contract.
    
    Args:
        from_block: Starting block number
        to_block: Ending block number (default: latest)
    
    Returns:
        List of Transfer events
    """
    events = await contract.events.Transfer.get_logs(
        fromBlock=from_block or "latest",
        toBlock=to_block or "latest"
    )
    return [format_event(e) for e in events]
```

## config.py - Configuration

This file handles all configuration through environment variables:

```python
"""Configuration for the MCP server."""

import os
from dotenv import load_dotenv

load_dotenv()

# Network Configuration
NETWORK = "mainnet"
RPC_URL = os.environ.get("RPC_URL", "https://eth.llamarpc.com")
CHAIN_ID = 1

# Contract Configuration
CONTRACT_ADDRESS = os.environ.get(
    "CONTRACT_ADDRESS",
    "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
)

# Authentication (optional, for write operations)
PRIVATE_KEY = os.environ.get("PRIVATE_KEY")

# Server Configuration
SERVER_NAME = "usdc-token"
SERVER_VERSION = "1.0.0"

# Safety Settings
SIMULATION_DEFAULT = True
READ_ONLY_MODE = False
MAX_GAS_PRICE_GWEI = int(os.environ.get("MAX_GAS_PRICE_GWEI", "500"))
```

## requirements.txt - Dependencies

The generated server requires these packages:

```
mcp>=1.0.0
web3>=6.0.0
pydantic>=2.0.0
python-dotenv>=1.0.0
```

Install them with:

```bash
pip install -r requirements.txt
```

## .env.example - Environment Template

A template for your environment configuration:

```bash
# Required: RPC endpoint for blockchain connection
RPC_URL=https://eth.llamarpc.com

# Optional: Override contract address
# CONTRACT_ADDRESS=0x...

# Optional: Private key for write operations
# ⚠️ Never commit this file with real keys!
# PRIVATE_KEY=0x...

# Optional: Gas price limit in Gwei
# MAX_GAS_PRICE_GWEI=50
```

Copy this to `.env` and customize:

```bash
cp .env.example .env
```

## Understanding Tool Types

The generated server classifies tools into three types:

### Read Tools (Safe)

- Call `view` or `pure` functions
- No gas required
- No wallet needed
- Always safe to call

```python
# Examples: balanceOf, name, symbol, totalSupply, allowance
```

### Write Tools (Requires Gas)

- Call state-changing functions
- Require gas payment
- Require private key
- Simulate by default

```python
# Examples: transfer, approve, transferFrom
```

### Payable Tools (Requires ETH)

- Call `payable` functions
- Require both gas and ETH value
- Extra careful simulation

```python
# Examples: deposit (in WETH), mint (in some NFTs)
```

## Running the Server

### Standalone Mode

For testing, run the server directly:

```bash
python server.py
```

The server communicates via stdin/stdout using the MCP protocol.

### With Claude Desktop

Configure in `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "my-contract": {
      "command": "python",
      "args": ["/absolute/path/to/server.py"],
      "env": {
        "RPC_URL": "https://eth.llamarpc.com"
      }
    }
  }
}
```

## Testing Your Server

### Using the inspect Command

Before deploying, inspect what was generated:

```bash
abi-to-mcp inspect ./my-mcp-server
```

This shows:
- All generated tools and their parameters
- All resources and their schemas
- Configuration details

### Manual Testing

You can test tools directly:

```python
# test_server.py
import asyncio
from server import balance_of, name, symbol

async def test():
    # Test read-only tools
    print(f"Name: {await name()}")
    print(f"Symbol: {await symbol()}")
    print(f"Balance: {await balance_of('0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045')}")

asyncio.run(test())
```

## Customizing the Generated Server

The generated server is meant to be a starting point. Common customizations:

### Adding Human-Readable Amounts

```python
from decimal import Decimal

@mcp.tool()
async def balance_of_formatted(account: str) -> str:
    """Get balance in human-readable format (not wei)."""
    raw = await contract.functions.balanceOf(
        Web3.to_checksum_address(account)
    ).call()
    decimals = await contract.functions.decimals().call()
    formatted = Decimal(raw) / Decimal(10 ** decimals)
    return str(formatted)
```

### Adding Custom Validation

```python
from eth_utils import is_address

@mcp.tool()
async def transfer(to: str, amount: str, simulate: bool = True) -> dict:
    # Add validation
    if not is_address(to):
        raise ValueError(f"Invalid address: {to}")
    if int(amount) <= 0:
        raise ValueError("Amount must be positive")
    
    # Continue with transfer...
```

### Adding Caching

```python
from functools import lru_cache

@lru_cache(maxsize=100)
async def _get_token_info():
    """Cache token metadata."""
    return {
        "name": await contract.functions.name().call(),
        "symbol": await contract.functions.symbol().call(),
        "decimals": await contract.functions.decimals().call(),
    }
```

## Next Steps

- [CLI Reference](../cli/generate.md) - All generation options
- [Type Mapping](../concepts/type-mapping.md) - How types are converted
- [Safety Features](../concepts/safety.md) - Understanding simulation
- [Claude Desktop](../guides/claude-desktop.md) - Full integration guide
