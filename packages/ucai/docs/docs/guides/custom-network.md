---
title: Custom Network Guide
description: Add support for custom or unsupported networks
---

# Custom Network Guide

abi-to-mcp supports many networks out of the box, but you may need to add custom networks for:

- Private/enterprise blockchains
- New L2s not yet added
- Testnets
- Local development chains

## Built-in Networks

These networks are supported by default:

| Network | Chain ID | Flag |
|---------|----------|------|
| Ethereum Mainnet | 1 | `--network mainnet` |
| Goerli Testnet | 5 | `--network goerli` |
| Sepolia Testnet | 11155111 | `--network sepolia` |
| Polygon | 137 | `--network polygon` |
| Polygon Mumbai | 80001 | `--network mumbai` |
| Arbitrum One | 42161 | `--network arbitrum` |
| Optimism | 10 | `--network optimism` |
| Base | 8453 | `--network base` |
| BSC | 56 | `--network bsc` |
| Avalanche C-Chain | 43114 | `--network avalanche` |

## Using Custom RPC

The simplest way to use any network is providing a custom RPC URL:

```bash
# Generate with default (for ABI fetching)
abi-to-mcp generate ./my-abi.json \
    --output ./my-server \
    --address 0x1234...
```

Then set the custom RPC in `.env`:

```bash
RPC_URL=https://your-custom-rpc.example.com
CHAIN_ID=12345
```

## Adding a Custom Network

For networks with Etherscan-compatible explorers, you can configure full support.

### Method 1: Environment Variables

Set these before running:

```bash
# Custom network configuration
export CUSTOM_CHAIN_ID=324
export CUSTOM_RPC_URL=https://mainnet.era.zksync.io
export CUSTOM_EXPLORER_URL=https://api.zkscan.io/api
export CUSTOM_EXPLORER_API_KEY=your-api-key

# Now generate
abi-to-mcp generate 0x1234... \
    --network custom \
    --output ./zksync-server
```

### Method 2: Network Configuration File

Create `~/.abi-to-mcp/networks.json`:

```json
{
  "networks": {
    "zksync": {
      "name": "zkSync Era",
      "chain_id": 324,
      "rpc_url": "https://mainnet.era.zksync.io",
      "explorer_url": "https://api.zkscan.io/api",
      "explorer_api_key_env": "ZKSYNC_API_KEY",
      "currency": {
        "name": "Ether",
        "symbol": "ETH",
        "decimals": 18
      }
    },
    "linea": {
      "name": "Linea",
      "chain_id": 59144,
      "rpc_url": "https://rpc.linea.build",
      "explorer_url": "https://api.lineascan.build/api",
      "explorer_api_key_env": "LINEA_API_KEY",
      "currency": {
        "name": "Ether",
        "symbol": "ETH",
        "decimals": 18
      }
    }
  }
}
```

Now use the network name:

```bash
abi-to-mcp generate 0x1234... --network zksync
```

## Local Development Chains

### Hardhat

```bash
# Start Hardhat node
npx hardhat node

# Configure abi-to-mcp
export RPC_URL=http://127.0.0.1:8545
export CHAIN_ID=31337

# Use local ABI (Hardhat artifacts)
abi-to-mcp generate ./artifacts/contracts/MyContract.sol/MyContract.json \
    --output ./my-server \
    --address 0x5FbDB2315678afecb367f032d93F642f64180aa3
```

### Foundry/Anvil

```bash
# Start Anvil
anvil

# Configure
export RPC_URL=http://127.0.0.1:8545
export CHAIN_ID=31337

# Use Foundry output
abi-to-mcp generate ./out/MyContract.sol/MyContract.json \
    --output ./my-server \
    --address 0x...
```

### Ganache

```bash
# Start Ganache
ganache --chain.chainId 1337

# Configure
export RPC_URL=http://127.0.0.1:8545
export CHAIN_ID=1337
```

## Private Enterprise Chains

For private networks without public explorers:

### 1. Get ABI Locally

You'll need the ABI file since there's no explorer:

```bash
# From Hardhat
cp ./artifacts/contracts/MyContract.sol/MyContract.json ./abi.json

# From Foundry
cp ./out/MyContract.sol/MyContract.json ./abi.json

# From Truffle
cp ./build/contracts/MyContract.json ./abi.json
```

### 2. Generate Server

```bash
abi-to-mcp generate ./abi.json \
    --output ./private-server \
    --address 0x... \
    --name "Private Contract"
```

### 3. Configure Private RPC

```bash
# .env
RPC_URL=https://your-private-rpc.internal.example.com
CHAIN_ID=9999

# Optional: Authentication
# Some private RPCs require headers
```

For RPC authentication, you may need to modify the generated `config.py`:

```python
# config.py
import os

RPC_URL = os.environ.get("RPC_URL")
RPC_AUTH_HEADER = os.environ.get("RPC_AUTH_HEADER")

# In web3_client initialization
if RPC_AUTH_HEADER:
    headers = {"Authorization": RPC_AUTH_HEADER}
    # Configure Web3 with custom headers
```

## Cross-Chain Configuration

Generate servers for multiple chains:

```bash
# Mainnet
abi-to-mcp generate 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 \
    --network mainnet \
    --output ./usdc-mainnet

# Polygon
abi-to-mcp generate 0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174 \
    --network polygon \
    --output ./usdc-polygon

# Arbitrum
abi-to-mcp generate 0xaf88d065e77c8cC2239327C5EDb3A432268e5831 \
    --network arbitrum \
    --output ./usdc-arbitrum
```

### Multi-Chain Claude Config

```json
{
  "mcpServers": {
    "usdc-mainnet": {
      "command": "python",
      "args": ["./usdc-mainnet/server.py"],
      "env": {
        "RPC_URL": "https://eth-mainnet.g.alchemy.com/v2/KEY"
      }
    },
    "usdc-polygon": {
      "command": "python",
      "args": ["./usdc-polygon/server.py"],
      "env": {
        "RPC_URL": "https://polygon-mainnet.g.alchemy.com/v2/KEY"
      }
    },
    "usdc-arbitrum": {
      "command": "python",
      "args": ["./usdc-arbitrum/server.py"],
      "env": {
        "RPC_URL": "https://arb-mainnet.g.alchemy.com/v2/KEY"
      }
    }
  }
}
```

## Network-Specific Considerations

### Layer 2 Networks

L2s may have:
- Different gas models (Arbitrum, Optimism)
- Different transaction formats (zkSync)
- Faster block times

### BSC and Other Clones

Ethereum clones work similarly but may have:
- Different native currency (BNB instead of ETH)
- Different block times
- Different gas pricing

### Sidechains

Sidechains like Polygon have:
- Lower gas costs
- Faster finality
- Different security model

## Troubleshooting

### "Could not connect to RPC"

Check:
- RPC URL is correct
- Network is accessible
- No firewall blocking

### "Chain ID mismatch"

The RPC returned a different chain ID than expected:
- Verify the chain ID in your config
- Check you're connecting to the right network

### "Explorer API returned error"

For fetching ABIs from explorers:
- Verify the explorer URL
- Check API key is valid
- Ensure contract is verified

### "Gas estimation failed"

The transaction would fail. On custom networks:
- Verify contract is deployed
- Check contract address
- Ensure you're on the right network

## Reference: Network Configuration Schema

```json
{
  "name": "Network Name",
  "chain_id": 1,
  "rpc_url": "https://...",
  "explorer_url": "https://api.../api",
  "explorer_api_key_env": "ENV_VAR_NAME",
  "currency": {
    "name": "Ether",
    "symbol": "ETH",
    "decimals": 18
  },
  "block_time": 12,
  "is_testnet": false
}
```

## Next Steps

- [Claude Desktop](claude-desktop.md) - Configure for Claude
- [Reference: Networks](../reference/networks.md) - Full network list
- [DeFi Guide](defi-protocol.md) - DeFi on L2s
