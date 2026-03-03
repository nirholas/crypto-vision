# Staking Tools

Tools for staking operations, yield farming, and liquidity provision across DeFi protocols.

---

## Overview

Staking tools provide access to various yield-generating opportunities including native staking, liquid staking, and liquidity farming.

| Tool | Description |
|------|-------------|
| `staking_get_staking_options` | List available staking opportunities |
| `staking_get_pool_info` | Get staking pool details |
| `staking_get_user_stakes` | Get user's active stakes |
| `staking_stake` | Stake tokens in a pool |
| `staking_unstake` | Withdraw staked tokens |
| `staking_claim_rewards` | Claim pending rewards |
| `staking_get_apy` | Get current APY/APR |
| `staking_get_tvl` | Get total value locked |

---

## staking_get_staking_options

List available staking opportunities on a network.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `network` | string | No | Network name (default: ethereum) |
| `token` | string | No | Filter by token symbol |
| `minApy` | number | No | Minimum APY filter |

### Response

```json
{
  "network": "ethereum",
  "options": [
    {
      "protocol": "Lido",
      "pool": "ETH Staking",
      "token": "ETH",
      "rewardToken": "stETH",
      "apy": 4.2,
      "tvl": 15000000000,
      "lockPeriod": null,
      "type": "liquid-staking"
    },
    {
      "protocol": "Rocket Pool",
      "pool": "ETH Staking",
      "token": "ETH",
      "rewardToken": "rETH",
      "apy": 4.5,
      "tvl": 2500000000,
      "lockPeriod": null,
      "type": "liquid-staking"
    },
    {
      "protocol": "Aave",
      "pool": "USDC Supply",
      "token": "USDC",
      "rewardToken": "USDC",
      "apy": 3.8,
      "tvl": 5000000000,
      "lockPeriod": null,
      "type": "lending"
    }
  ]
}
```

### Example

```
Show me staking options for ETH on Ethereum
```

```
Find staking opportunities with APY above 5% on Arbitrum
```

---

## staking_get_pool_info

Get detailed information about a specific staking pool.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `protocol` | string | Yes | Protocol name (e.g., "lido", "aave") |
| `pool` | string | Yes | Pool identifier |
| `network` | string | No | Network name (default: ethereum) |

### Response

```json
{
  "protocol": "Lido",
  "pool": "stETH",
  "network": "ethereum",
  "token": {
    "symbol": "ETH",
    "address": "0x0000000000000000000000000000000000000000"
  },
  "rewardToken": {
    "symbol": "stETH",
    "address": "0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84"
  },
  "apy": 4.2,
  "apr": 4.1,
  "tvl": 15234567890,
  "totalStaked": "6234567.89",
  "totalStakers": 234567,
  "lockPeriod": null,
  "withdrawalPeriod": "1-5 days",
  "minStake": "0.01",
  "maxStake": null,
  "fees": {
    "deposit": 0,
    "withdrawal": 0,
    "performance": 10
  },
  "risks": [
    "Smart contract risk",
    "Slashing risk (minimal)",
    "Price deviation from ETH"
  ]
}
```

### Example

```
Get details about Lido stETH pool
```

---

## staking_get_user_stakes

Get all active stakes for a user address.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `address` | string | Yes | User wallet address |
| `network` | string | No | Network name (default: all) |

### Response

```json
{
  "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f8fEb3",
  "stakes": [
    {
      "protocol": "Lido",
      "pool": "stETH",
      "network": "ethereum",
      "staked": {
        "amount": "10.5",
        "token": "ETH",
        "valueUsd": 26250.00
      },
      "rewards": {
        "pending": "0.042",
        "token": "stETH",
        "valueUsd": 105.00
      },
      "apy": 4.2,
      "stakedAt": "2024-01-15T10:30:00Z"
    },
    {
      "protocol": "Aave",
      "pool": "USDC Supply",
      "network": "arbitrum",
      "staked": {
        "amount": "5000.00",
        "token": "USDC",
        "valueUsd": 5000.00
      },
      "rewards": {
        "pending": "15.50",
        "token": "USDC",
        "valueUsd": 15.50
      },
      "apy": 3.8,
      "stakedAt": "2024-02-01T14:00:00Z"
    }
  ],
  "totalValueUsd": 31250.00,
  "totalPendingRewardsUsd": 120.50
}
```

### Example

```
Show all my active stakes
```

```
What are my staking positions on Arbitrum?
```

---

## staking_stake

Stake tokens in a pool.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `protocol` | string | Yes | Protocol name |
| `pool` | string | Yes | Pool identifier |
| `amount` | string | Yes | Amount to stake |
| `network` | string | No | Network name (default: ethereum) |

### Response

```json
{
  "success": true,
  "transactionHash": "0xabc123...",
  "protocol": "Lido",
  "pool": "stETH",
  "staked": {
    "amount": "5.0",
    "token": "ETH"
  },
  "received": {
    "amount": "4.998",
    "token": "stETH"
  },
  "network": "ethereum"
}
```

### Example

```
Stake 5 ETH on Lido
```

```
Deposit 1000 USDC into Aave on Arbitrum
```

### Security Note

⚠️ Requires wallet configuration. Review pool terms and risks before staking.

---

## staking_unstake

Withdraw staked tokens from a pool.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `protocol` | string | Yes | Protocol name |
| `pool` | string | Yes | Pool identifier |
| `amount` | string | Yes | Amount to unstake (or "all") |
| `network` | string | No | Network name (default: ethereum) |

### Response

```json
{
  "success": true,
  "transactionHash": "0xdef456...",
  "protocol": "Lido",
  "pool": "stETH",
  "unstaked": {
    "amount": "5.0",
    "token": "stETH"
  },
  "received": {
    "amount": "5.021",
    "token": "ETH",
    "estimatedReceiveTime": "2024-03-15T10:00:00Z"
  },
  "network": "ethereum",
  "note": "Withdrawal request submitted. ETH will be available in 1-5 days."
}
```

### Example

```
Unstake all my ETH from Lido
```

```
Withdraw 500 USDC from Aave on Arbitrum
```

---

## staking_claim_rewards

Claim pending staking rewards.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `protocol` | string | Yes | Protocol name |
| `pool` | string | No | Specific pool (or all pools) |
| `network` | string | No | Network name (default: ethereum) |

### Response

```json
{
  "success": true,
  "transactionHash": "0xghi789...",
  "claimed": [
    {
      "protocol": "Convex",
      "pool": "cvxCRV",
      "rewards": [
        {
          "token": "CRV",
          "amount": "125.50",
          "valueUsd": 87.85
        },
        {
          "token": "CVX",
          "amount": "45.20",
          "valueUsd": 135.60
        }
      ]
    }
  ],
  "totalValueUsd": 223.45,
  "network": "ethereum"
}
```

### Example

```
Claim all my pending staking rewards
```

```
Claim rewards from Convex on Ethereum
```

---

## staking_get_apy

Get current APY/APR for a staking pool.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `protocol` | string | Yes | Protocol name |
| `pool` | string | Yes | Pool identifier |
| `network` | string | No | Network name (default: ethereum) |

### Response

```json
{
  "protocol": "Lido",
  "pool": "stETH",
  "network": "ethereum",
  "apy": 4.2,
  "apr": 4.1,
  "breakdown": {
    "baseApr": 3.8,
    "rewardApr": 0.3,
    "fees": -0.1
  },
  "historical": {
    "7d": 4.1,
    "30d": 4.0,
    "90d": 4.2
  },
  "updatedAt": "2024-03-10T12:00:00Z"
}
```

### Example

```
What's the current APY for Lido stETH?
```

---

## staking_get_tvl

Get total value locked in a protocol or pool.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `protocol` | string | Yes | Protocol name |
| `pool` | string | No | Specific pool (optional) |
| `network` | string | No | Network name (optional) |

### Response

```json
{
  "protocol": "Lido",
  "network": "all",
  "tvl": 15234567890,
  "tvlChange24h": 2.5,
  "tvlChange7d": 5.2,
  "pools": [
    {
      "pool": "stETH",
      "network": "ethereum",
      "tvl": 14500000000,
      "percentage": 95.2
    },
    {
      "pool": "wstETH",
      "network": "arbitrum",
      "tvl": 500000000,
      "percentage": 3.3
    }
  ]
}
```

### Example

```
What's the TVL on Aave?
```

---

## Popular Staking Protocols

### Liquid Staking

| Protocol | Networks | Tokens | Type |
|----------|----------|--------|------|
| Lido | ETH, Polygon, Solana | ETH, MATIC | Liquid Staking |
| Rocket Pool | Ethereum | ETH | Decentralized Liquid Staking |
| Coinbase | Ethereum | ETH (cbETH) | Centralized Liquid Staking |
| Frax | Ethereum | ETH (sfrxETH) | Liquid Staking |

### Lending/Yield

| Protocol | Networks | Type |
|----------|----------|------|
| Aave | ETH, ARB, OP, Polygon, BSC | Lending |
| Compound | Ethereum, Arbitrum, Base | Lending |
| Yearn | Ethereum, Arbitrum | Yield Aggregator |
| Convex | Ethereum | Yield Optimizer |

### Liquidity Mining

| Protocol | Networks | Type |
|----------|----------|------|
| Uniswap | Multi-chain | LP Staking |
| Curve | Multi-chain | LP Staking |
| Balancer | Multi-chain | LP Staking |
| PancakeSwap | BSC, Arbitrum | LP Staking |

---

## Risk Considerations

| Risk Type | Description |
|-----------|-------------|
| Smart Contract | Bugs or vulnerabilities in protocol code |
| Impermanent Loss | LP token value divergence from underlying |
| Slashing | Validator penalties (for ETH staking) |
| Liquidity | Difficulty withdrawing during high demand |
| Protocol | Governance changes, upgrades, or exploits |

---

## Related Tools

- [Lending Tools](lending-tools.md) - Borrowing and lending
- [Swap Tools](swap-tools.md) - Token swaps
- [DeFi Analytics](defi-analytics-tools.md) - Protocol analysis
- [Security Tools](security-tools.md) - Risk assessment
