---
title: ERC20 Token Guide
description: Create an MCP server for any ERC20 token
---

# ERC20 Token Guide

This guide walks you through creating an MCP server for any ERC20 token. You'll be able to:

- ✅ Check token balances
- ✅ View token metadata (name, symbol, decimals)
- ✅ Track transfers and approvals
- ✅ Transfer tokens (optional)
- ✅ Approve spending (optional)

## Prerequisites

- abi-to-mcp installed
- RPC endpoint (free from Alchemy/Infura or public)
- Token contract address

## Step 1: Choose Your Token

For this guide, we'll use USDC on Ethereum mainnet:

| Property | Value |
|----------|-------|
| Token | USD Coin (USDC) |
| Address | `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48` |
| Network | Ethereum Mainnet |

!!! tip "Find Any Token"
    You can find token addresses on:
    
    - [Etherscan](https://etherscan.io/tokens)
    - [CoinGecko](https://www.coingecko.com/)
    - [CoinMarketCap](https://coinmarketcap.com/)

## Step 2: Generate the Server

```bash
abi-to-mcp generate 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 \
    --network mainnet \
    --output ./usdc-mcp-server \
    --name "USDC Token"
```

This will:
1. Fetch the ABI from Etherscan
2. Parse functions and events
3. Generate the MCP server

Output:
```
🔍 Fetching ABI from Etherscan (mainnet)...
✅ Found verified contract: FiatTokenV2_2
📊 Detected standard: ERC20

📁 Generated files:
   ./usdc-mcp-server/
   ├── server.py
   ├── config.py
   ├── README.md
   ├── pyproject.toml
   └── requirements.txt

🎉 Server ready! Run with: python ./usdc-mcp-server/server.py
```

## Step 3: Configure the Server

Navigate to the generated directory:

```bash
cd usdc-mcp-server
```

Create a `.env` file:

```bash
# Required
RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR-API-KEY

# Optional - only for write operations
# PRIVATE_KEY=your-private-key-here
```

!!! warning "Never Commit .env"
    Add `.env` to your `.gitignore` to keep secrets safe.

## Step 4: Install Dependencies

```bash
pip install -r requirements.txt
```

Or with the project:

```bash
pip install -e .
```

## Step 5: Run the Server

```bash
python server.py
```

The server starts and listens for MCP connections.

## Step 6: Test with Claude

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "usdc-token": {
      "command": "python",
      "args": ["/path/to/usdc-mcp-server/server.py"],
      "env": {
        "RPC_URL": "https://eth-mainnet.g.alchemy.com/v2/YOUR-API-KEY"
      }
    }
  }
}
```

Restart Claude Desktop and try:

> "What's the USDC balance of vitalik.eth?"

Claude will use the `balance_of` tool to check the balance.

## Available Tools

### Read Tools (No gas required)

| Tool | Description | Example |
|------|-------------|---------|
| `name` | Get token name | "USD Coin" |
| `symbol` | Get token symbol | "USDC" |
| `decimals` | Get decimal places | 6 |
| `total_supply` | Get total supply | "26234567890000000" |
| `balance_of` | Get address balance | "1000000000" (1000 USDC) |
| `allowance` | Get spending approval | "500000000" |

### Write Tools (Gas required)

| Tool | Description | Parameters |
|------|-------------|------------|
| `transfer` | Send tokens | `to`, `amount`, `simulate` |
| `approve` | Approve spending | `spender`, `amount`, `simulate` |
| `transfer_from` | Transfer on behalf | `from_`, `to`, `amount`, `simulate` |

## Working with Balances

USDC has 6 decimals, so:

| Raw Value | Human Readable |
|-----------|----------------|
| `1000000` | 1 USDC |
| `1000000000` | 1,000 USDC |
| `1000000000000` | 1,000,000 USDC |

!!! tip "Conversion Helper"
    ```python
    # Raw to human
    human_amount = int(raw_amount) / 10**6
    
    # Human to raw
    raw_amount = int(human_amount * 10**6)
    ```

## Querying Transfers

The server also exposes Transfer events as a resource:

```python
# Get recent transfers to an address
transfers = await get_transfer_events(
    to_address="0x...",
    from_block=current_block - 1000,
    limit=10
)
```

Each transfer includes:
```python
{
    "from": "0x123...",
    "to": "0x456...",
    "value": "1000000000",  # 1000 USDC
    "block_number": 18500000,
    "transaction_hash": "0x..."
}
```

## Making Transfers

!!! danger "Real Money"
    Transfers move real tokens. Always simulate first and double-check addresses.

### Simulate First

```python
# This only simulates - no tokens moved
result = await transfer(
    to="0x742d35Cc6634C0532925a3b844Bc9e7595f5b7A5",
    amount="1000000",  # 1 USDC
    simulate=True  # Default
)
```

Result:
```python
{
    "success": True,
    "would_succeed": True,
    "gas_estimate": 65000,
    "estimated_cost_eth": "0.0016"
}
```

### Execute Transfer

```python
# This WILL move tokens
result = await transfer(
    to="0x742d35Cc6634C0532925a3b844Bc9e7595f5b7A5",
    amount="1000000",
    simulate=False  # Actually execute
)
```

Result:
```python
{
    "success": True,
    "transaction_hash": "0x...",
    "block_number": 18500123
}
```

## Read-Only Mode

If you only need to query data:

```bash
abi-to-mcp generate 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 \
    --network mainnet \
    --output ./usdc-readonly \
    --read-only
```

This generates a server with only read tools - no transfer or approve functions.

## Common Issues

### "Contract source code not verified"

The token contract isn't verified on Etherscan. Solutions:

1. Use a local ABI file if you have one
2. Try a different block explorer
3. Check if the contract is a proxy

### "execution reverted"

Usually means:
- Insufficient balance
- Not enough allowance
- Contract is paused

### Balance shows 0 for known holder

Check:
- Correct network (mainnet vs testnet)
- Correct contract address
- Address format (with 0x prefix)

## Next Steps

- [Track NFTs](nft-collection.md) - Similar process for ERC721
- [DeFi Integration](defi-protocol.md) - More complex protocols
- [Claude Desktop](claude-desktop.md) - Full integration guide

!!! example "Quick Start Example"
    A ready-to-use ERC20 example with USDC ABI is available in [`examples/erc20_token/`](https://github.com/nirholas/UCAI/tree/main/examples/erc20_token).
