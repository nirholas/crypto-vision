# Binance.US Credit Line Guide

This guide provides detailed information about using the Binance.US Credit Line API through the MCP Server.

## Overview

The Credit Line API is designed for **institutional clients** who have established a credit line agreement with Binance.US. This allows institutions to borrow funds for trading while maintaining collateral with their custody partner.

## Prerequisites

1. **Institutional Agreement**: Your organization must have a signed credit line agreement with Binance.US
2. **Credit Line API Keys**: Generated specifically for credit line operations
3. **Collateral Setup**: Sufficient collateral held with your custody partner
4. **Credit Limit Established**: Pre-approved credit limit based on your agreement

> ⚠️ **Important**: Standard Binance.US exchange API keys will NOT work with credit line endpoints.

## How Credit Lines Work

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Your Institution                             │
│                                                                     │
│  ┌──────────────────┐         ┌──────────────────┐                 │
│  │   Custody        │         │   Binance.US     │                 │
│  │   Partner        │         │   Exchange       │                 │
│  │                  │         │                  │                 │
│  │  Collateral:     │◀───────▶│  Credit Line:    │                 │
│  │  $1,000,000 BTC  │  Trust  │  $800,000 USD    │                 │
│  │                  │         │  (80% LTV)       │                 │
│  └──────────────────┘         └──────────────────┘                 │
│                                      │                              │
│                                      ▼                              │
│                         ┌──────────────────┐                        │
│                         │   Trading        │                        │
│                         │   Activity       │                        │
│                         │                  │                        │
│                         │   Buy/Sell with  │                        │
│                         │   borrowed USD   │                        │
│                         └──────────────────┘                        │
└─────────────────────────────────────────────────────────────────────┘
```

## Available Tools

| Tool | Description |
|------|-------------|
| `binance_us_cl_account` | Get credit line account status and limits |
| `binance_us_cl_transfer` | Borrow or repay credit |
| `binance_us_cl_transfer_history` | View borrow/repay history |
| `binance_us_cl_alert_history` | View margin call alerts |
| `binance_us_cl_liquidation_history` | View liquidation events |

## Key Concepts

### Credit Limit
The maximum amount you can borrow, determined by your agreement and collateral value.

### Used Credit
The current amount borrowed from your credit line.

### Available Credit
`Available = Credit Limit - Used Credit`

### Margin Ratio
`Margin Ratio = Used Credit / Collateral Value`

### Margin Call Level
When your margin ratio reaches this level (typically 80%), you receive alerts to add collateral or repay.

### Liquidation Level
When your margin ratio reaches this level (typically 90%), your positions may be liquidated to repay the credit line.

## Credit Line Account Information

### `binance_us_cl_account`

Get your credit line status:

**Response:**
```json
{
  "creditLimit": "1000000.00",
  "availableCredit": "750000.00",
  "usedCredit": "250000.00",
  "collateralValue": "1200000.00",
  "marginCallLevel": "0.80",
  "liquidationLevel": "0.90",
  "currentRatio": "0.208",
  "interestRate": "0.05",
  "status": "ACTIVE"
}
```

**Key Fields:**
| Field | Description |
|-------|-------------|
| `creditLimit` | Maximum borrowing capacity |
| `availableCredit` | Amount you can still borrow |
| `usedCredit` | Currently borrowed amount |
| `collateralValue` | Current value of your collateral |
| `currentRatio` | Your current margin ratio (usedCredit/collateralValue) |
| `marginCallLevel` | Ratio that triggers margin call alerts |
| `liquidationLevel` | Ratio that triggers liquidation |
| `interestRate` | Annual interest rate on borrowed funds |

## Borrowing and Repaying

### `binance_us_cl_transfer`

**Borrowing (type: BORROW):**
```json
{
  "asset": "USD",
  "amount": "100000",
  "type": "BORROW"
}
```

Response:
```json
{
  "transferId": "borrow_12345",
  "asset": "USD",
  "amount": "100000.00",
  "type": "BORROW",
  "timestamp": 1706000000000,
  "status": "SUCCESS",
  "newBalance": {
    "usedCredit": "350000.00",
    "availableCredit": "650000.00"
  }
}
```

**Repaying (type: REPAY):**
```json
{
  "asset": "USD",
  "amount": "50000",
  "type": "REPAY"
}
```

Response:
```json
{
  "transferId": "repay_67890",
  "asset": "USD",
  "amount": "50000.00",
  "type": "REPAY",
  "timestamp": 1706000000000,
  "status": "SUCCESS",
  "newBalance": {
    "usedCredit": "300000.00",
    "availableCredit": "700000.00"
  }
}
```

## Transfer History

### `binance_us_cl_transfer_history`

View your borrow and repay history:

**Parameters:**
```json
{
  "asset": "USD",
  "type": "BORROW",
  "startTime": 1705900000000,
  "endTime": 1706000000000,
  "limit": 50
}
```

**Response:**
```json
{
  "transfers": [
    {
      "transferId": "borrow_12345",
      "asset": "USD",
      "amount": "100000.00",
      "type": "BORROW",
      "timestamp": 1705950000000,
      "status": "SUCCESS"
    },
    {
      "transferId": "borrow_12340",
      "asset": "USD",
      "amount": "50000.00",
      "type": "BORROW",
      "timestamp": 1705920000000,
      "status": "SUCCESS"
    }
  ],
  "total": 2
}
```

## Margin Alerts

### `binance_us_cl_alert_history`

When your margin ratio approaches the margin call level, alerts are generated:

**Response:**
```json
{
  "alerts": [
    {
      "alertId": "alert_001",
      "alertType": "MARGIN_CALL",
      "alertLevel": "0.80",
      "currentRatio": "0.82",
      "timestamp": 1706000000000,
      "message": "Margin ratio has exceeded margin call level",
      "action": "Add collateral or repay credit to reduce margin ratio",
      "status": "ACTIVE"
    },
    {
      "alertId": "alert_002",
      "alertType": "APPROACHING_MARGIN_CALL",
      "alertLevel": "0.75",
      "currentRatio": "0.76",
      "timestamp": 1705990000000,
      "message": "Margin ratio approaching margin call level",
      "action": "Consider adding collateral",
      "status": "RESOLVED"
    }
  ]
}
```

**Alert Types:**
| Type | Description |
|------|-------------|
| `APPROACHING_MARGIN_CALL` | Ratio is 5% below margin call level |
| `MARGIN_CALL` | Ratio has reached margin call level |
| `APPROACHING_LIQUIDATION` | Ratio is 5% below liquidation level |
| `LIQUIDATION_WARNING` | Ratio very close to liquidation |

## Liquidation Events

### `binance_us_cl_liquidation_history`

If margin ratio exceeds liquidation level, forced liquidations may occur:

**Response:**
```json
{
  "liquidations": [
    {
      "liquidationId": "liq_001",
      "asset": "BTC",
      "amount": "0.5",
      "price": "45000.00",
      "usdValue": "22500.00",
      "timestamp": 1706000000000,
      "reason": "MARGIN_CALL_TIMEOUT",
      "preRatio": "0.92",
      "postRatio": "0.78"
    }
  ]
}
```

**Liquidation Reasons:**
| Reason | Description |
|--------|-------------|
| `MARGIN_CALL_TIMEOUT` | Margin call not addressed within required timeframe |
| `RAPID_PRICE_MOVEMENT` | Sudden price drop pushed ratio above liquidation level |
| `VOLUNTARY` | Client requested liquidation |

## Common Workflows

### Workflow 1: Check Status and Borrow

```
1. Check credit line status
   → binance_us_cl_account

2. Verify sufficient available credit
   → Check availableCredit in response

3. Borrow funds
   → binance_us_cl_transfer (type: BORROW)

4. Use funds for trading
   → Use standard trading tools

5. Repay when done
   → binance_us_cl_transfer (type: REPAY)
```

### Workflow 2: Monitor Health

```
1. Check current margin ratio
   → binance_us_cl_account

2. Review any active alerts
   → binance_us_cl_alert_history

3. If ratio is high, consider:
   - Adding collateral (through custody partner)
   - Repaying some credit
   - Closing trading positions

4. Verify ratio improved
   → binance_us_cl_account
```

### Workflow 3: Daily Reporting

```
1. Get account summary
   → binance_us_cl_account

2. Get day's transfers
   → binance_us_cl_transfer_history (with time range)

3. Check for any alerts
   → binance_us_cl_alert_history

4. Verify no liquidations
   → binance_us_cl_liquidation_history
```

## Risk Management

### Margin Ratio Zones

```
                   ┌─────────────────────────────────────────┐
                   │            LIQUIDATION ZONE              │
     90%+ ─────────├─────────────────────────────────────────┤
                   │            HIGH RISK ZONE                │
     80-90% ───────├─────────────────────────────────────────┤
                   │            CAUTION ZONE                  │
     60-80% ───────├─────────────────────────────────────────┤
                   │            HEALTHY ZONE                  │
     0-60% ────────└─────────────────────────────────────────┘
```

### Best Practices

1. **Monitor Regularly**: Check your margin ratio at least daily
2. **Set Internal Alerts**: Create alerts at 60% and 70% before official margin calls
3. **Maintain Buffer**: Keep margin ratio well below margin call level
4. **Quick Response**: Have a plan ready if margin call alerts trigger
5. **Interest Awareness**: Remember borrowed funds accrue interest

## Interest Calculation

Interest is calculated daily and compounded:

```
Daily Interest = Used Credit × (Annual Rate / 365)
```

Example:
- Used Credit: $250,000
- Annual Rate: 5%
- Daily Interest: $250,000 × (0.05 / 365) = $34.25/day

## Error Handling

### Common Errors

| Code | Message | Cause |
|------|---------|-------|
| -4001 | Insufficient credit | Borrow amount exceeds available credit |
| -4002 | Insufficient balance | Repay amount exceeds exchange balance |
| -4003 | Credit line suspended | Account is in margin call status |
| -4004 | Invalid transfer type | Must be BORROW or REPAY |
| -4005 | Minimum amount | Amount below minimum transfer |

## Security Considerations

1. **API Key Security**: Credit line API keys have significant financial access
2. **Withdrawal Limits**: Borrowed funds typically cannot be withdrawn
3. **Audit Trail**: All operations are logged for compliance
4. **Two-Person Rule**: Consider requiring dual approval for large borrows
5. **Rate Limiting**: Transfers are rate-limited to prevent accidental over-borrowing

## Support

For credit line issues:
- Contact Binance.US institutional support
- Emergency margin call hotline (provided in your agreement)
- Review your credit line agreement for specific terms
