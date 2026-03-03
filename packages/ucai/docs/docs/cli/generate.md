---
title: generate
description: Generate an MCP server from a smart contract ABI
---

# abi-to-mcp generate

Generate a complete MCP server from a smart contract ABI.

## Synopsis

```bash
abi-to-mcp generate SOURCE [OPTIONS]
```

## Description

The `generate` command is the core of abi-to-mcp. It takes an ABI source (contract address or file path), fetches/parses the ABI, and generates a complete MCP server with all tools and resources.

## Arguments

### SOURCE

The ABI source, which can be:

- **Contract address**: `0x...` - Fetches ABI from Etherscan/Sourcify
- **File path**: `./contract.json` - Loads ABI from local file

```bash
# From address
abi-to-mcp generate 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48

# From file
abi-to-mcp generate ./artifacts/MyContract.json
```

## Options

### `--output`, `-o`

Output directory for the generated server.

| Default | `./mcp-server` |
|---------|----------------|
| Type | Path |

```bash
abi-to-mcp generate 0x... -o ./my-server
```

### `--network`, `-n`

Network for address lookups and configuration.

| Default | `mainnet` |
|---------|-----------|
| Choices | `mainnet`, `sepolia`, `goerli`, `polygon`, `arbitrum`, `optimism`, `base`, `bsc`, `avalanche`, `fantom` |

```bash
abi-to-mcp generate 0x... -n polygon
```

### `--address`, `-a`

Contract address (required when SOURCE is a file).

| Default | None (extracted from address SOURCE) |
|---------|--------------------------------------|
| Type | Ethereum address |

```bash
abi-to-mcp generate ./abi.json --address 0x1234...
```

### `--name`

Custom name for the generated server.

| Default | Auto-detected from contract |
|---------|---------------------------|
| Type | String |

```bash
abi-to-mcp generate 0x... --name "My Token Server"
```

### `--read-only`

Generate only read operations (no write tools).

| Default | `False` |
|---------|---------|
| Type | Flag |

```bash
abi-to-mcp generate 0x... --read-only
```

!!! tip "Use for Safety"
    Use `--read-only` when you only need to query data and want to prevent any possibility of state-changing operations.

### `--events` / `--no-events`

Include or exclude events as MCP resources.

| Default | `--events` (included) |
|---------|----------------------|
| Type | Flag |

```bash
# Exclude events
abi-to-mcp generate 0x... --no-events
```

### `--simulate` / `--no-simulate`

Default simulation mode for write operations.

| Default | `--simulate` (simulation on) |
|---------|------------------------------|
| Type | Flag |

```bash
# Disable simulation by default (dangerous!)
abi-to-mcp generate 0x... --no-simulate
```

!!! danger "Not Recommended"
    Disabling simulation by default means write tools will execute real transactions immediately. Only use this if you understand the risks.

### `--rpc-url`

Default RPC URL to embed in generated config.

| Default | Network-specific public RPC |
|---------|---------------------------|
| Type | URL |

```bash
abi-to-mcp generate 0x... --rpc-url https://eth.llamarpc.com
```

### `--force`, `-f`

Overwrite existing output directory without prompting.

| Default | `False` (prompt before overwriting) |
|---------|--------------------------------------|
| Type | Flag |

```bash
abi-to-mcp generate 0x... -o ./existing-dir --force
```

## Examples

### Basic Generation

```bash
# Generate from mainnet contract address
abi-to-mcp generate 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48

# Output to specific directory
abi-to-mcp generate 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 -o ./usdc-server
```

### Different Networks

```bash
# Polygon
abi-to-mcp generate 0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174 -n polygon

# Arbitrum
abi-to-mcp generate 0xaf88d065e77c8cC2239327C5EDb3A432268e5831 -n arbitrum

# Base
abi-to-mcp generate 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 -n base
```

### From Local ABI

```bash
# Hardhat artifact
abi-to-mcp generate ./artifacts/contracts/MyToken.sol/MyToken.json \
  --address 0x1234... \
  --network mainnet

# Plain ABI file
abi-to-mcp generate ./my-abi.json \
  --address 0x1234... \
  --name "My Contract"
```

### Read-Only Server

```bash
# Only generate read tools (safe mode)
abi-to-mcp generate 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 \
  --read-only \
  --name "USDC Reader"
```

### Custom Configuration

```bash
# Full customization
abi-to-mcp generate 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 \
  --network mainnet \
  --output ./my-usdc-server \
  --name "USDC Token" \
  --rpc-url https://eth.llamarpc.com \
  --events \
  --simulate \
  --force
```

## Output Structure

The command creates the following files:

```
output-directory/
├── server.py           # Main MCP server
├── config.py           # Configuration
├── README.md           # Documentation
├── requirements.txt    # Dependencies
├── pyproject.toml      # Package metadata
└── .env.example        # Environment template
```

## Generated Tools

For each contract function, a corresponding MCP tool is generated:

| Solidity | MCP Tool | Type |
|----------|----------|------|
| `function balanceOf(address) view returns (uint256)` | `balance_of(account: str) -> str` | Read |
| `function transfer(address, uint256) returns (bool)` | `transfer(to: str, amount: str, simulate: bool = True) -> dict` | Write |
| `function deposit() payable` | `deposit(value: str, simulate: bool = True) -> dict` | Payable |

## Generated Resources

For each event, an MCP resource is generated:

| Solidity | MCP Resource |
|----------|--------------|
| `event Transfer(address indexed from, address indexed to, uint256 value)` | `events://transfer` |
| `event Approval(address indexed owner, address indexed spender, uint256 value)` | `events://approval` |

## Proxy Contracts

abi-to-mcp automatically detects proxy contracts:

- **EIP-1967**: Standard proxy pattern
- **EIP-1822**: UUPS proxies
- **OpenZeppelin**: TransparentProxy
- **EIP-1167**: Minimal proxies (clones)

When a proxy is detected, the implementation ABI is fetched automatically.

```bash
# This will detect USDC is a proxy and fetch the implementation
abi-to-mcp generate 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 -n mainnet
```

## Error Handling

| Error | Cause | Solution |
|-------|-------|----------|
| "Contract not verified" | ABI not on Etherscan | Use local ABI file instead |
| "Network not supported" | Invalid network name | Check `--network` value |
| "Directory exists" | Output directory exists | Use `--force` or different directory |
| "Invalid address" | Malformed address | Check address format (0x + 40 hex chars) |

## See Also

- [Quickstart](../getting-started/quickstart.md) - Quick tutorial
- [First Server](../getting-started/first-server.md) - Understanding output
- [inspect](inspect.md) - Preview before generating
- [validate](validate.md) - Validate ABI format
