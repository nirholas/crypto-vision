Ethereum gas fees can make or break your DeFi experience. Understanding how gas works and when to transact can save you hundreds of dollars. This guide explains everything you need to know about Ethereum gas fees.

## What is Gas?

Gas is the unit measuring computational effort on Ethereum. Every transaction requires gas to:

- Transfer ETH or tokens
- Execute smart contracts
- Deploy new contracts
- Interact with DeFi protocols

Think of gas like fuel for your car - the more complex the journey, the more fuel you need.

## Gas Fee Components

### Gas Units

The amount of computational work required:

- Simple ETH transfer: 21,000 gas
- ERC-20 token transfer: ~65,000 gas
- Uniswap swap: ~150,000-300,000 gas
- NFT mint: ~100,000-200,000 gas

### Gas Price (Gwei)

The price per gas unit, measured in gwei (1 gwei = 0.000000001 ETH):

- **Base fee** - Set by the network, burned
- **Priority fee (tip)** - Goes to validators, speeds up inclusion

### Total Cost Formula

```
Total Fee = Gas Units × (Base Fee + Priority Fee)
```

Example: 
- Uniswap swap: 200,000 gas
- Base fee: 30 gwei
- Priority fee: 2 gwei
- Total: 200,000 × 32 gwei = 6,400,000 gwei = 0.0064 ETH (~$16)

## Understanding EIP-1559

Since the London upgrade, Ethereum uses EIP-1559:

### Base Fee

- Algorithmically determined by network demand
- Doubles or halves based on block fullness
- Burned (removed from supply)

### Priority Fee (Tip)

- User-determined
- Incentivizes validators to include your transaction
- Higher tip = faster inclusion

### Max Fee

- Maximum you're willing to pay per gas
- You're refunded the difference if base fee is lower
- Set this higher for important transactions

## Current Gas Prices

Gas prices fluctuate constantly based on network demand:

| Time | Typical Gas (Gwei) |
|------|-------------------|
| Weekend morning | 15-30 |
| Weekday evening (US) | 40-100 |
| NFT drop | 200-500+ |
| Market crash | 300-1000+ |

Check our [Gas Tracker](/gas) for real-time prices across multiple chains.

## Strategies to Save on Gas

### 1. Time Your Transactions

Gas is cheapest when fewer people are using the network:

**Cheapest times:**
- Weekends, especially Saturday/Sunday morning (UTC)
- Weekday off-hours (2-6 AM UTC)
- Holidays

**Expensive times:**
- Major NFT drops
- Token launches
- Market volatility
- US afternoon/evening (high DeFi usage)

### 2. Use Layer 2 Solutions

Layer 2 networks offer 10-100x cheaper transactions:

**Arbitrum**
- Gas: ~$0.10-0.50 per swap
- Most DeFi protocols available
- Easy bridging from Ethereum

**Optimism**
- Similar costs to Arbitrum
- Growing ecosystem
- OP token incentives

**Base**
- Coinbase's L2
- Very low fees
- Expanding DeFi presence

**Polygon (PoS)**
- Near-zero fees
- Different security model
- Wide application support

### 3. Batch Transactions

Some protocols allow batching:

- Approve and swap in one transaction
- Harvest multiple farms at once
- Use multicall contracts

### 4. Set Appropriate Gas Limits

Don't overpay for priority:

- Normal transactions: 1-2 gwei priority fee
- Time-sensitive: 3-5 gwei
- Very urgent: 10+ gwei

Most wallets auto-suggest appropriate values.

### 5. Use Gas-Efficient Protocols

Some protocols are more gas-efficient:

- **Uniswap v3** - More efficient than v2
- **1inch** - Aggregator with gas optimization
- **Cowswap** - MEV protection + gas savings

## Layer 2 Gas Comparison

| Chain | Simple Transfer | Swap | Mint NFT |
|-------|----------------|------|----------|
| Ethereum L1 | $1-5 | $10-50 | $20-100 |
| Arbitrum | $0.10 | $0.20-0.50 | $0.50-2 |
| Optimism | $0.10 | $0.20-0.50 | $0.50-2 |
| Base | $0.05 | $0.10-0.30 | $0.30-1 |
| Polygon | $0.01 | $0.02-0.05 | $0.05-0.20 |

## Gas Tokens and Refunds

### Historical: CHI and GST2

Previously, gas tokens could store cheap gas for later use. EIP-3529 reduced their effectiveness.

### Current Options

- **Flashbots** - Submit transactions privately, avoid failed tx costs
- **MEV protection** - Services like Flashbots Protect

## Failed Transactions

You still pay gas for failed transactions:

### Common Causes

- Slippage too low
- Price changed during pending
- Insufficient token approval
- Contract reverted

### Prevention

- Set adequate slippage (0.5-1% for stables, 1-3% for volatile)
- Use "fast" gas for time-sensitive trades
- Double-check approvals before swaps

## Reading Gas Trackers

### Key Metrics

**Safe (Low)**
- Will eventually confirm
- May take 10+ minutes
- Good for non-urgent transactions

**Standard**
- Confirms within a few minutes
- Balanced speed/cost
- Recommended for most transactions

**Fast**
- Next block inclusion likely
- Higher cost
- Use for time-sensitive trades

### Mempool Analysis

Advanced trackers show:

- Pending transactions
- Gas price distribution
- Expected wait times

## Gas for Different Actions

### DeFi Operations

| Action | Typical Gas Units | Cost at 30 gwei |
|--------|------------------|-----------------|
| ETH transfer | 21,000 | $1.50 |
| Token transfer | 65,000 | $4.80 |
| Token approval | 46,000 | $3.40 |
| Uniswap swap | 200,000 | $15 |
| Add liquidity | 250,000 | $18 |
| Aave deposit | 200,000 | $15 |
| Aave borrow | 350,000 | $26 |

### NFT Operations

| Action | Typical Gas Units | Cost at 30 gwei |
|--------|------------------|-----------------|
| NFT transfer | 85,000 | $6.30 |
| OpenSea listing | 0 (off-chain) | Free |
| OpenSea sale | 150,000 | $11 |
| Mint (simple) | 100,000 | $7.40 |
| Mint (complex) | 200,000+ | $15+ |

## Tools and Resources

### Gas Trackers

- **Crypto Data Aggregator** - [Multi-chain gas tracker](/gas)
- **Etherscan Gas Tracker** - Ethereum mainnet
- **Blocknative** - Advanced mempool data

### Gas Optimization

- **Revoke.cash** - Manage token approvals
- **DeBank** - Portfolio with gas estimates
- **TxStreet** - Visual mempool

## Future of Gas Fees

### EIP-4844 (Proto-Danksharding)

Coming improvements:

- Blob transactions for L2s
- 10-100x reduction in L2 costs
- Already implemented in 2024

### Full Danksharding

Future upgrade:

- Complete sharding implementation
- Near-zero L2 costs
- Years away

## Key Takeaways

1. **Gas = computational cost** measured in gas units × gas price (gwei)
2. **EIP-1559** split fees into base fee (burned) and priority fee (to validators)
3. **Time your transactions** - weekends and off-hours are cheapest
4. **Use Layer 2s** - 10-100x cheaper than Ethereum L1
5. **Batch when possible** - combine multiple actions
6. **Failed transactions still cost gas** - set appropriate slippage
7. **Track gas prices** - use our Gas Tracker for real-time data

Understanding gas fees is essential for cost-effective DeFi participation. Check our [Gas Tracker](/gas) for real-time prices across Ethereum, Polygon, Base, Arbitrum, and Optimism.
