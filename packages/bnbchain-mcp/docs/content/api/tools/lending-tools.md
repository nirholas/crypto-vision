# Lending Tools

Tools for DeFi lending and borrowing operations across protocols like Aave, Compound, and more.

---

## Overview

Lending tools enable interaction with decentralized lending protocols for supplying assets, borrowing, and managing collateral.

| Tool | Description |
|------|-------------|
| `lending_get_markets` | List available lending markets |
| `lending_get_market_info` | Get detailed market information |
| `lending_get_user_position` | Get user's lending/borrowing position |
| `lending_supply` | Supply assets to earn interest |
| `lending_withdraw` | Withdraw supplied assets |
| `lending_borrow` | Borrow assets against collateral |
| `lending_repay` | Repay borrowed assets |
| `lending_get_health_factor` | Get position health factor |

---

## lending_get_markets

List available lending markets on a protocol.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `protocol` | string | Yes | Protocol name (aave, compound) |
| `network` | string | No | Network name (default: ethereum) |

### Response

```json
{
  "protocol": "Aave V3",
  "network": "arbitrum",
  "markets": [
    {
      "asset": "USDC",
      "address": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
      "supplyApy": 3.85,
      "borrowApy": 5.12,
      "totalSupply": 425000000,
      "totalBorrow": 312000000,
      "utilization": 73.4,
      "ltv": 80,
      "liquidationThreshold": 85,
      "canCollateral": true,
      "canBorrow": true
    },
    {
      "asset": "WETH",
      "address": "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
      "supplyApy": 2.15,
      "borrowApy": 3.42,
      "totalSupply": 156000,
      "totalBorrow": 89000,
      "utilization": 57.1,
      "ltv": 82.5,
      "liquidationThreshold": 86,
      "canCollateral": true,
      "canBorrow": true
    }
  ]
}
```

### Example

```
Show all Aave markets on Arbitrum
```

---

## lending_get_market_info

Get detailed information about a specific lending market.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `protocol` | string | Yes | Protocol name |
| `asset` | string | Yes | Asset symbol or address |
| `network` | string | No | Network name (default: ethereum) |

### Response

```json
{
  "protocol": "Aave V3",
  "network": "arbitrum",
  "asset": {
    "symbol": "USDC",
    "address": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
    "decimals": 6
  },
  "supply": {
    "apy": 3.85,
    "totalSupply": 425000000,
    "supplyCap": 500000000,
    "available": 75000000
  },
  "borrow": {
    "apyVariable": 5.12,
    "apyStable": 6.50,
    "totalBorrow": 312000000,
    "borrowCap": 450000000,
    "available": 113000000
  },
  "collateral": {
    "enabled": true,
    "ltv": 80,
    "liquidationThreshold": 85,
    "liquidationPenalty": 5
  },
  "utilization": 73.4,
  "oracle": "0x...",
  "interestRateStrategy": "0x..."
}
```

### Example

```
Get detailed info about USDC market on Aave Arbitrum
```

---

## lending_get_user_position

Get a user's complete lending and borrowing position.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `protocol` | string | Yes | Protocol name |
| `address` | string | Yes | User wallet address |
| `network` | string | No | Network name (default: ethereum) |

### Response

```json
{
  "protocol": "Aave V3",
  "network": "arbitrum",
  "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f8fEb3",
  "supplied": [
    {
      "asset": "USDC",
      "amount": "10000.00",
      "valueUsd": 10000.00,
      "apy": 3.85,
      "isCollateral": true
    },
    {
      "asset": "WETH",
      "amount": "5.0",
      "valueUsd": 12500.00,
      "apy": 2.15,
      "isCollateral": true
    }
  ],
  "borrowed": [
    {
      "asset": "USDT",
      "amount": "5000.00",
      "valueUsd": 5000.00,
      "apy": 5.50,
      "type": "variable"
    }
  ],
  "summary": {
    "totalSuppliedUsd": 22500.00,
    "totalBorrowedUsd": 5000.00,
    "netWorthUsd": 17500.00,
    "healthFactor": 3.65,
    "borrowPower": 13000.00,
    "borrowPowerUsed": 27.8,
    "netApy": 2.45
  }
}
```

### Example

```
Show my Aave position on Arbitrum
```

```
What's my lending status on Compound?
```

---

## lending_supply

Supply assets to a lending protocol to earn interest.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `protocol` | string | Yes | Protocol name |
| `asset` | string | Yes | Asset to supply |
| `amount` | string | Yes | Amount to supply |
| `useAsCollateral` | boolean | No | Enable as collateral (default: true) |
| `network` | string | No | Network name (default: ethereum) |

### Response

```json
{
  "success": true,
  "transactionHash": "0xabc123...",
  "protocol": "Aave V3",
  "action": "supply",
  "asset": "USDC",
  "amount": "5000.00",
  "aToken": {
    "symbol": "aUSDC",
    "amount": "5000.00"
  },
  "currentApy": 3.85,
  "isCollateral": true,
  "network": "arbitrum"
}
```

### Example

```
Supply 5000 USDC to Aave on Arbitrum
```

---

## lending_withdraw

Withdraw supplied assets from a lending protocol.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `protocol` | string | Yes | Protocol name |
| `asset` | string | Yes | Asset to withdraw |
| `amount` | string | Yes | Amount to withdraw (or "all") |
| `network` | string | No | Network name (default: ethereum) |

### Response

```json
{
  "success": true,
  "transactionHash": "0xdef456...",
  "protocol": "Aave V3",
  "action": "withdraw",
  "asset": "USDC",
  "amount": "2500.00",
  "network": "arbitrum",
  "newHealthFactor": 2.85
}
```

### Example

```
Withdraw 2500 USDC from Aave
```

```
Withdraw all my ETH from Compound
```

### Warning

⚠️ Withdrawing collateral may affect your health factor and liquidation risk.

---

## lending_borrow

Borrow assets against your collateral.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `protocol` | string | Yes | Protocol name |
| `asset` | string | Yes | Asset to borrow |
| `amount` | string | Yes | Amount to borrow |
| `rateMode` | string | No | "variable" or "stable" (default: variable) |
| `network` | string | No | Network name (default: ethereum) |

### Response

```json
{
  "success": true,
  "transactionHash": "0xghi789...",
  "protocol": "Aave V3",
  "action": "borrow",
  "asset": "USDT",
  "amount": "3000.00",
  "rateMode": "variable",
  "borrowApy": 5.50,
  "network": "arbitrum",
  "newHealthFactor": 2.45,
  "liquidationPrice": {
    "WETH": 1250.00,
    "note": "If ETH drops below $1,250, position may be liquidated"
  }
}
```

### Example

```
Borrow 3000 USDT from Aave using variable rate
```

### Warning

⚠️ Borrowing carries liquidation risk. Monitor your health factor regularly.

---

## lending_repay

Repay borrowed assets.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `protocol` | string | Yes | Protocol name |
| `asset` | string | Yes | Asset to repay |
| `amount` | string | Yes | Amount to repay (or "all") |
| `rateMode` | string | No | "variable" or "stable" |
| `network` | string | No | Network name (default: ethereum) |

### Response

```json
{
  "success": true,
  "transactionHash": "0xjkl012...",
  "protocol": "Aave V3",
  "action": "repay",
  "asset": "USDT",
  "amount": "1500.00",
  "network": "arbitrum",
  "remainingDebt": "1500.00",
  "newHealthFactor": 4.25
}
```

### Example

```
Repay 1500 USDT on Aave
```

```
Repay all my USDC debt on Compound
```

---

## lending_get_health_factor

Get the health factor and liquidation risk for a position.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `protocol` | string | Yes | Protocol name |
| `address` | string | Yes | User wallet address |
| `network` | string | No | Network name (default: ethereum) |

### Response

```json
{
  "protocol": "Aave V3",
  "network": "arbitrum",
  "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f8fEb3",
  "healthFactor": 2.45,
  "status": "healthy",
  "liquidationRisk": "low",
  "collateral": {
    "total": 22500.00,
    "liquidationThreshold": 18000.00
  },
  "debt": {
    "total": 5000.00
  },
  "liquidationPrices": [
    {
      "asset": "WETH",
      "currentPrice": 2500.00,
      "liquidationPrice": 1250.00,
      "dropRequired": -50.0
    }
  ],
  "recommendations": [
    "Position is healthy with 145% buffer above liquidation",
    "Consider adding more collateral if borrowing more"
  ]
}
```

### Health Factor Guide

| Health Factor | Status | Risk Level |
|---------------|--------|------------|
| > 2.0 | Healthy | Low |
| 1.5 - 2.0 | Moderate | Medium |
| 1.0 - 1.5 | At Risk | High |
| < 1.0 | Liquidatable | Critical |

### Example

```
Check my health factor on Aave
```

---

## Supported Protocols

| Protocol | Networks | Version |
|----------|----------|---------|
| Aave | ETH, ARB, OP, Polygon, Base, BSC | V3 |
| Compound | Ethereum, Arbitrum, Base | V3 |
| Venus | BSC | V1 |
| Radiant | Arbitrum, BSC | V2 |
| Spark | Ethereum | V1 |

---

## Interest Rate Models

### Variable Rate

- Changes based on utilization
- Lower rates when utilization is low
- Spikes during high demand

### Stable Rate

- Fixed rate at time of borrow
- May be rebalanced in extreme conditions
- Usually higher than variable

---

## Liquidation

When health factor drops below 1.0:

1. Liquidators can repay up to 50% of debt
2. They receive collateral + bonus (usually 5-10%)
3. Position is partially closed

### Prevention Tips

- Maintain health factor above 1.5
- Set up health factor alerts
- Use stablecoins as collateral when possible
- Monitor collateral prices

---

## Related Tools

- [Staking Tools](staking-tools.md) - Yield farming
- [Swap Tools](swap-tools.md) - Token swaps for repayment
- [Market Data Tools](market-data-tools.md) - Price monitoring
- [Security Tools](security-tools.md) - Protocol risk assessment
