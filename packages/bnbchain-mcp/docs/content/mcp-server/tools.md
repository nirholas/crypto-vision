# Tool Reference

Complete reference for all SperaxOS MCP tools.

---

## USDs Stablecoin

### usds_get_info

Get USDs token overview including supply and yield.

**Parameters:** None

**Returns:**
```json
{
  "totalSupply": "50000000.00",
  "rebasingSupply": "45000000.00",
  "nonRebasingSupply": "5000000.00",
  "currentAPR": "5.25",
  "price": "1.00"
}
```

---

### usds_get_balance

Get USDs balance for an address.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| address | string | Yes | Wallet address |

**Returns:**
```json
{
  "balance": "10000.00",
  "isRebasing": true,
  "credits": "9500.00"
}
```

---

### usds_get_rebase_state

Check if an address is receiving rebase yield.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| address | string | Yes | Wallet address |

**Returns:**
```json
{
  "isRebasing": true,
  "canOptIn": false,
  "canOptOut": true
}
```

---

### usds_get_yield_info

Get current yield distribution metrics.

**Parameters:** None

**Returns:**
```json
{
  "currentAPR": "5.25",
  "nextRebaseTime": 1234567890,
  "pendingYield": "12500.00",
  "lastRebaseAmount": "1250.00"
}
```

---

## Vault

### vault_get_status

Get overall vault status and health.

**Parameters:** None

**Returns:**
```json
{
  "tvl": "100000000.00",
  "collateralizationRatio": "1.05",
  "mintFee": "0.001",
  "redeemFee": "0.002",
  "isPaused": false
}
```

---

### vault_get_collaterals

List all supported collateral tokens.

**Parameters:** None

**Returns:**
```json
{
  "collaterals": [
    {
      "symbol": "USDC",
      "address": "0x...",
      "deposited": "50000000.00",
      "weight": "50"
    }
  ]
}
```

---

### vault_get_strategies

List active yield strategies.

**Parameters:** None

**Returns:**
```json
{
  "strategies": [
    {
      "name": "Aave USDC",
      "address": "0x...",
      "tvl": "25000000.00",
      "apy": "4.5"
    }
  ]
}
```

---

### vault_simulate_mint

Simulate minting USDs with collateral.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| collateral | string | Yes | Collateral symbol |
| amount | string | Yes | Amount to mint |

**Returns:**
```json
{
  "inputAmount": "1000.00",
  "outputAmount": "998.00",
  "fee": "2.00",
  "feePercent": "0.2"
}
```

---

## SPA & Staking

### spa_get_info

Get SPA token overview.

**Parameters:** None

**Returns:**
```json
{
  "totalSupply": "1000000000",
  "circulatingSupply": "500000000",
  "price": "0.015",
  "marketCap": "7500000"
}
```

---

### vespa_get_position

Get veSPA lock position for an address.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| address | string | Yes | Wallet address |

**Returns:**
```json
{
  "locked": "100000.00",
  "unlockTime": 1234567890,
  "votingPower": "80000.00",
  "lockDuration": "2 years"
}
```

---

### vespa_calculate_power

Calculate voting power for a lock.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| amount | string | Yes | SPA amount |
| duration | number | Yes | Lock days (7-1460) |

**Returns:**
```json
{
  "votingPower": "80000.00",
  "multiplier": "0.8",
  "unlockDate": "2027-01-01"
}
```

---

## Demeter Farms

### demeter_list_farms

List all active yield farms.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| type | string | No | Filter by type |
| active | boolean | No | Only active farms |

**Returns:**
```json
{
  "farms": [
    {
      "id": "1",
      "name": "USDs-USDC LP",
      "tvl": "5000000.00",
      "apr": "25.5",
      "rewards": ["SPA", "ARB"]
    }
  ]
}
```

---

### demeter_get_user_position

Get user's farm positions.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| address | string | Yes | Wallet address |
| farmId | string | No | Specific farm |

**Returns:**
```json
{
  "positions": [
    {
      "farmId": "1",
      "deposited": "10000.00",
      "pendingRewards": "150.00",
      "share": "0.2"
    }
  ]
}
```

---

### demeter_calculate_rewards

Calculate pending rewards.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| address | string | Yes | Wallet address |
| farmId | string | Yes | Farm ID |

**Returns:**
```json
{
  "rewards": [
    {
      "token": "SPA",
      "amount": "150.00",
      "usdValue": "2.25"
    }
  ]
}
```

---

## Dripper

### dripper_get_status

Get dripper operational status.

**Parameters:** None

**Returns:**
```json
{
  "isActive": true,
  "balance": "50000.00",
  "dripRate": "1000.00",
  "lastDrip": 1234567890
}
```

---

### dripper_estimate_next_rebase

Estimate next rebase timing and amount.

**Parameters:** None

**Returns:**
```json
{
  "nextRebaseTime": 1234567890,
  "estimatedAmount": "1250.00",
  "estimatedAPR": "5.25"
}
```

---

## Oracle

### oracle_get_all_prices

Get all collateral prices.

**Parameters:** None

**Returns:**
```json
{
  "prices": [
    {
      "symbol": "USDC",
      "price": "1.0001",
      "source": "Chainlink",
      "updatedAt": 1234567890
    }
  ]
}
```

---

### oracle_check_staleness

Check if oracle data is stale.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| collateral | string | Yes | Collateral symbol |

**Returns:**
```json
{
  "isStale": false,
  "lastUpdate": 1234567890,
  "maxAge": 3600,
  "age": 1200
}
```

---

## Analytics

### analytics_get_tvl

Get TVL breakdown by category.

**Parameters:** None

**Returns:**
```json
{
  "total": "150000000.00",
  "vault": "100000000.00",
  "farms": "30000000.00",
  "staking": "20000000.00"
}
```

---

### analytics_get_protocol_health

Get overall protocol health score.

**Parameters:** None

**Returns:**
```json
{
  "healthScore": 95,
  "collateralization": "1.05",
  "oracleStatus": "healthy",
  "pegStatus": "healthy",
  "warnings": []
}
```

---

## Governance

### governance_get_proposals

Get active governance proposals.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| state | string | No | Filter by state |

**Returns:**
```json
{
  "proposals": [
    {
      "id": "1",
      "title": "Update mint fee",
      "state": "active",
      "forVotes": "5000000",
      "againstVotes": "1000000",
      "endTime": 1234567890
    }
  ]
}
```

---

### governance_get_voting_power

Get voting power for an address.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| address | string | Yes | Wallet address |

**Returns:**
```json
{
  "votingPower": "80000.00",
  "delegatedTo": null,
  "delegatedFrom": []
}
```
