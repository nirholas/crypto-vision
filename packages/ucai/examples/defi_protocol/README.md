# DeFi Protocol Example

Generate an MCP server for a DeFi protocol like a DEX router or lending pool.

## Quick Start

```bash
./generate.sh
```

## Example: Uniswap-style Router

This example demonstrates a simplified DEX router interface with:
- Token swapping
- Liquidity management
- Price quotes

## Available Tools

| Tool | Type | Description |
|------|------|-------------|
| `get_amounts_out` | Read | Calculate output amounts for a swap path |
| `get_amounts_in` | Read | Calculate input amounts for a swap path |
| `get_pair` | Read | Get the pair address for two tokens |
| `get_reserves` | Read | Get reserves for a pair |
| `swap_exact_tokens_for_tokens` | Write | Swap exact input for minimum output |
| `swap_tokens_for_exact_tokens` | Write | Swap maximum input for exact output |
| `add_liquidity` | Write | Add liquidity to a pool |
| `remove_liquidity` | Write | Remove liquidity from a pool |

## Events

| Event | Description |
|-------|-------------|
| `Swap` | Token swap occurred |
| `Mint` | Liquidity added (LP tokens minted) |
| `Burn` | Liquidity removed (LP tokens burned) |
| `Sync` | Reserves synchronized |

## Real-World Contracts

To use with real DeFi protocols:

```bash
# Uniswap V2 Router (Mainnet)
abi-to-mcp generate 0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D \
  --network mainnet \
  --output ./uniswap-v2-router

# SushiSwap Router (Mainnet)
abi-to-mcp generate 0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F \
  --network mainnet \
  --output ./sushiswap-router

# PancakeSwap Router (BSC)
abi-to-mcp generate 0x10ED43C718714eb63d5aA57B78B54704E256024E \
  --network bsc \
  --output ./pancakeswap-router
```

## Safety Considerations

DeFi operations involve financial risk. The generated server includes:

- **Simulation mode** (default): Preview transactions before execution
- **Slippage warnings**: Alert on high slippage trades
- **Gas estimation**: Accurate gas costs before execution

Always test on testnets before mainnet!
