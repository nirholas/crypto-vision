# Sweep Smart Contracts

Solidity smart contracts for the Sweep multi-chain dust sweeper.

## Overview

- **SweepBatchSwap**: Batch multiple ERC20 swaps in a single transaction
- **SweepPermit2Batcher**: Gasless approvals via Permit2 + batch swaps

## Installation

```bash
# Install Foundry
curl -L https://foundry.paradigm.xyz | bash
foundryup

# Install dependencies
forge install OpenZeppelin/openzeppelin-contracts
forge install Uniswap/permit2
forge install foundry-rs/forge-std

# Build
forge build

# Test
forge test
```

## Deployment

```bash
# Set environment variables
export DEPLOYER_PRIVATE_KEY=0x...
export RPC_BASE=https://...
export BASESCAN_API_KEY=...

# Deploy to Base
forge script script/Deploy.s.sol:DeployBase --rpc-url $RPC_BASE --broadcast --verify

# Deploy to all chains
forge script script/Deploy.s.sol:DeployAllChains --broadcast --verify
```

## Supported Chains

| Chain | Chain ID |
|-------|----------|
| Ethereum | 1 |
| Base | 8453 |
| Arbitrum | 42161 |
| Polygon | 137 |
| Optimism | 10 |
| BSC | 56 |
| Linea | 59144 |

## Architecture

```
┌─────────────────────────┐
│   SweepPermit2Batcher   │ ← User signs Permit2 message
├─────────────────────────┤
│ - Batch token transfers │
│ - Single signature      │
│ - ERC-2612 fallback     │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│     SweepBatchSwap      │ ← Executes swaps
├─────────────────────────┤
│ - Multi-DEX support     │
│ - Fee collection        │
│ - Gas optimized         │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│    DEX Aggregators      │
├─────────────────────────┤
│ - 1inch Fusion          │
│ - Uniswap V3            │
│ - 0x Exchange           │
└─────────────────────────┘
```

## Security

- ReentrancyGuard on all external functions
- Router whitelist (only approved DEXs)
- Ownable for admin functions
- Pausable for emergencies
- Token rescue functionality

## License

MIT
