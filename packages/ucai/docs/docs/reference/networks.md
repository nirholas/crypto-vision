---
title: Supported Networks
description: Complete list of supported networks and their configuration
---

# Supported Networks

abi-to-mcp supports many EVM-compatible networks out of the box.

## Mainnets

| Network | Chain ID | CLI Flag | Explorer API |
|---------|----------|----------|--------------|
| Ethereum | 1 | `mainnet` | api.etherscan.io |
| Polygon | 137 | `polygon` | api.polygonscan.com |
| Arbitrum One | 42161 | `arbitrum` | api.arbiscan.io |
| Optimism | 10 | `optimism` | api-optimistic.etherscan.io |
| Base | 8453 | `base` | api.basescan.org |
| BNB Smart Chain | 56 | `bsc` | api.bscscan.com |
| Avalanche C-Chain | 43114 | `avalanche` | api.snowtrace.io |
| Fantom | 250 | `fantom` | api.ftmscan.com |
| Gnosis | 100 | `gnosis` | api.gnosisscan.io |

## Testnets

| Network | Chain ID | CLI Flag | Explorer API |
|---------|----------|----------|--------------|
| Sepolia | 11155111 | `sepolia` | api-sepolia.etherscan.io |
| Goerli (deprecated) | 5 | `goerli` | api-goerli.etherscan.io |
| Mumbai | 80001 | `mumbai` | api-testnet.polygonscan.com |
| Arbitrum Sepolia | 421614 | `arbitrum-sepolia` | api-sepolia.arbiscan.io |
| Optimism Sepolia | 11155420 | `optimism-sepolia` | api-sepolia-optimistic.etherscan.io |
| Base Sepolia | 84532 | `base-sepolia` | api-sepolia.basescan.org |

## Layer 2 Networks

| Network | Chain ID | CLI Flag | Type |
|---------|----------|----------|------|
| Arbitrum One | 42161 | `arbitrum` | Optimistic Rollup |
| Optimism | 10 | `optimism` | Optimistic Rollup |
| Base | 8453 | `base` | Optimistic Rollup |
| zkSync Era | 324 | `zksync` | ZK Rollup |
| Polygon zkEVM | 1101 | `polygon-zkevm` | ZK Rollup |
| Linea | 59144 | `linea` | ZK Rollup |

## Network Configuration

### Environment Variables

Each network can use specific API key environment variables:

| Network | API Key Variable |
|---------|-----------------|
| Ethereum | `ETHERSCAN_API_KEY` |
| Polygon | `POLYGONSCAN_API_KEY` |
| Arbitrum | `ARBISCAN_API_KEY` |
| Optimism | `OPTIMISM_API_KEY` |
| Base | `BASESCAN_API_KEY` |
| BSC | `BSCSCAN_API_KEY` |

### Default RPC Endpoints

!!! warning "Rate Limits"
    Default public endpoints have rate limits. For production, use dedicated providers like Alchemy, Infura, or QuickNode.

| Network | Default RPC |
|---------|-------------|
| Ethereum | `https://eth.llamarpc.com` |
| Polygon | `https://polygon.llamarpc.com` |
| Arbitrum | `https://arb1.arbitrum.io/rpc` |
| Optimism | `https://mainnet.optimism.io` |
| Base | `https://mainnet.base.org` |

## Usage Examples

### Generate for Different Networks

```bash
# Ethereum mainnet (default)
abi-to-mcp generate 0x... -n mainnet

# Polygon
abi-to-mcp generate 0x... -n polygon

# Arbitrum
abi-to-mcp generate 0x... -n arbitrum

# Base
abi-to-mcp generate 0x... -n base
```

### Custom RPC URL

Override the default RPC in your `.env`:

```bash
# Use Alchemy
RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR-KEY

# Use Infura
RPC_URL=https://mainnet.infura.io/v3/YOUR-KEY

# Use QuickNode
RPC_URL=https://your-endpoint.quiknode.pro/YOUR-KEY/
```

## Network Details

### Ethereum Mainnet

```yaml
name: Ethereum Mainnet
chain_id: 1
currency:
  name: Ether
  symbol: ETH
  decimals: 18
block_time: ~12 seconds
explorer: https://etherscan.io
```

### Polygon

```yaml
name: Polygon
chain_id: 137
currency:
  name: MATIC
  symbol: MATIC
  decimals: 18
block_time: ~2 seconds
explorer: https://polygonscan.com
```

### Arbitrum One

```yaml
name: Arbitrum One
chain_id: 42161
currency:
  name: Ether
  symbol: ETH
  decimals: 18
block_time: ~0.25 seconds
explorer: https://arbiscan.io
```

### Optimism

```yaml
name: Optimism
chain_id: 10
currency:
  name: Ether
  symbol: ETH
  decimals: 18
block_time: ~2 seconds
explorer: https://optimistic.etherscan.io
```

### Base

```yaml
name: Base
chain_id: 8453
currency:
  name: Ether
  symbol: ETH
  decimals: 18
block_time: ~2 seconds
explorer: https://basescan.org
```

## Adding Custom Networks

See the [Custom Network Guide](../guides/custom-network.md) for adding networks not listed here.

### Configuration File

Create `~/.abi-to-mcp/networks.json`:

```json
{
  "networks": {
    "my-network": {
      "name": "My Network",
      "chain_id": 12345,
      "rpc_url": "https://rpc.my-network.com",
      "explorer_url": "https://api.my-explorer.com/api",
      "explorer_api_key_env": "MY_NETWORK_API_KEY",
      "currency": {
        "name": "MyCoin",
        "symbol": "MYC",
        "decimals": 18
      }
    }
  }
}
```

Then use:

```bash
abi-to-mcp generate 0x... -n my-network
```
