---
title: Quickstart
description: Generate your first MCP server in 5 minutes
---

# Quickstart

This guide will have you generating MCP servers from smart contracts in under 5 minutes.

## Prerequisites

- Python 3.10 or higher
- pip or pipx
- (Optional) An Etherscan API key for better rate limits

## Step 1: Install abi-to-mcp

```bash
pip install abi-to-mcp
```

Verify the installation:

```bash
abi-to-mcp --version
```

## Step 2: Generate from a Contract Address

Let's generate an MCP server for the USDC stablecoin on Ethereum mainnet:

```bash
abi-to-mcp generate 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 \
  --network mainnet \
  --output ./usdc-mcp
```

!!! tip "API Keys"
    For better rate limits, set your Etherscan API key:
    ```bash
    export ETHERSCAN_API_KEY=your-key-here
    ```

This will:

1. **Fetch** the verified ABI from Etherscan
2. **Parse** the contract to identify functions and events
3. **Detect** that this is an ERC-20 token
4. **Generate** a complete MCP server in `./usdc-mcp/`

You'll see output like:

```
✓ Fetched ABI from Etherscan (mainnet)
✓ Detected ERC20 standard
✓ Parsed 13 functions, 2 events
✓ Generated 13 tools, 2 resources

MCP server generated successfully!
Output: ./usdc-mcp/

Next steps:
  cd ./usdc-mcp
  cp .env.example .env
  # Edit .env to configure RPC_URL
  pip install -r requirements.txt
  python server.py
```

## Step 3: Inspect the Output

```bash
ls -la ./usdc-mcp/
```

You'll see:

```
usdc-mcp/
├── server.py           # The MCP server
├── config.py           # Configuration settings
├── README.md           # Usage documentation
├── requirements.txt    # Python dependencies
├── pyproject.toml      # Package configuration
└── .env.example        # Environment variable template
```

## Step 4: Configure and Run

Create your environment file:

```bash
cd usdc-mcp
cp .env.example .env
```

Edit `.env` to add your RPC URL:

```bash
RPC_URL=https://eth.llamarpc.com
CONTRACT_ADDRESS=0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48
```

Install dependencies and run:

```bash
pip install -r requirements.txt
python server.py
```

The server will start and wait for MCP connections.

## Step 5: Add to Claude Desktop

Add this to your `claude_desktop_config.json`:

=== "macOS"

    Location: `~/Library/Application Support/Claude/claude_desktop_config.json`
    
    ```json
    {
      "mcpServers": {
        "usdc-token": {
          "command": "python",
          "args": ["/Users/you/usdc-mcp/server.py"],
          "env": {
            "RPC_URL": "https://eth.llamarpc.com"
          }
        }
      }
    }
    ```

=== "Windows"

    Location: `%APPDATA%\Claude\claude_desktop_config.json`
    
    ```json
    {
      "mcpServers": {
        "usdc-token": {
          "command": "python",
          "args": ["C:\\Users\\you\\usdc-mcp\\server.py"],
          "env": {
            "RPC_URL": "https://eth.llamarpc.com"
          }
        }
      }
    }
    ```

=== "Linux"

    Location: `~/.config/Claude/claude_desktop_config.json`
    
    ```json
    {
      "mcpServers": {
        "usdc-token": {
          "command": "python",
          "args": ["/home/you/usdc-mcp/server.py"],
          "env": {
            "RPC_URL": "https://eth.llamarpc.com"
          }
        }
      }
    }
    ```

!!! warning "Use Absolute Paths"
    Always use absolute paths in Claude Desktop configuration, not relative paths like `./` or `~`.

Restart Claude Desktop, and you can now ask Claude questions about USDC!

## Alternative: Generate from Local ABI

If you have an ABI file already (from Hardhat, Foundry, or downloaded):

```bash
abi-to-mcp generate ./my-contract-abi.json \
  --address 0xYourContractAddress \
  --network mainnet \
  --output ./my-mcp-server
```

The ABI file can be:

- **Plain ABI array**: `[{"type": "function", ...}]`
- **Hardhat artifact**: `{"abi": [...], "contractName": "..."}`
- **Foundry output**: `{"abi": [...]}`

## Try Other Contracts

Here are some popular contracts to try:

=== "Uniswap V3 Router"

    ```bash
    abi-to-mcp generate 0xE592427A0AEce92De3Edee1F18E0157C05861564 \
      -n mainnet -o ./uniswap-mcp
    ```

=== "OpenSea Seaport"

    ```bash
    abi-to-mcp generate 0x00000000000000ADc04C56Bf30aC9d3c0aAF14dC \
      -n mainnet -o ./seaport-mcp
    ```

=== "Aave V3 Pool"

    ```bash
    abi-to-mcp generate 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2 \
      -n mainnet -o ./aave-mcp
    ```

=== "BAYC NFT"

    ```bash
    abi-to-mcp generate 0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D \
      -n mainnet -o ./bayc-mcp
    ```

## What's Next?

- [First MCP Server](first-server.md) - Detailed walkthrough of the generated code
- [CLI Reference](../cli/index.md) - All command options
- [Claude Desktop Guide](../guides/claude-desktop.md) - Integration tips
- [Safety Features](../concepts/safety.md) - Understanding simulation and safety
