# Binance.US Custodial Solution Guide

This guide provides detailed information about using the Binance.US Custodial Solution API through the MCP Server.

## Overview

The Custodial Solution API is designed for **institutional custody partners** who have signed a Custody Exchange Network (CEN) agreement with Binance.US. This allows qualified custodians like Anchorage Digital and BitGo to provide their clients with direct access to Binance.US liquidity.

## Prerequisites

1. **Custody Partner Agreement**: Your organization must have a signed agreement with a participating custody partner
2. **Custodial Solution API Keys**: Generated through your custody partner (not through standard Binance.US API management)
3. **Rail Selection**: Know which custody rail you're using (`anchorage` or `bitgo`)

> ⚠️ **Important**: Standard Binance.US exchange API keys will NOT work with custodial endpoints.

## Architecture

```
┌──────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Your Trading    │────▶│  Custody        │────▶│  Binance.US     │
│  Application     │     │  Partner        │     │  Exchange       │
│                  │     │  (Anchorage/    │     │                 │
│                  │◀────│   BitGo)        │◀────│                 │
└──────────────────┘     └─────────────────┘     └─────────────────┘
         │                                                │
         └───────────────────────────────────────────────┘
                    Custodial Solution API
```

## Available Tools

### Balance & Account

| Tool | Description |
|------|-------------|
| `binance_us_custodian_balance` | Get custodial account balance |
| `binance_us_custodian_account_info` | Get account information |

### Transfers

| Tool | Description |
|------|-------------|
| `binance_us_custodian_transfer_custody_to_exchange` | Move funds from custody to exchange |
| `binance_us_custodian_transfer_exchange_to_custody` | Move funds from exchange to custody |
| `binance_us_custodian_transfer_status` | Check transfer status |
| `binance_us_custodian_transfer_history` | Get transfer history |

### Trading

| Tool | Description |
|------|-------------|
| `binance_us_custodian_place_order` | Place a spot order |
| `binance_us_custodian_cancel_order` | Cancel an order |
| `binance_us_custodian_get_order` | Get order status |
| `binance_us_custodian_open_orders` | List open orders |
| `binance_us_custodian_all_orders` | Get all orders history |
| `binance_us_custodian_trades` | Get trade history |

### OCO Orders

| Tool | Description |
|------|-------------|
| `binance_us_custodian_oco_order` | Place OCO order |
| `binance_us_custodian_cancel_oco` | Cancel OCO order |
| `binance_us_custodian_get_oco` | Get OCO order status |
| `binance_us_custodian_all_oco` | List all OCO orders |

### Settlement

| Tool | Description |
|------|-------------|
| `binance_us_custodian_settlement_request` | Request asset settlement |
| `binance_us_custodian_settlement_status` | Check settlement status |
| `binance_us_custodian_settlement_history` | Get settlement history |

## Common Workflows

### Workflow 1: Check Balance and Trade

```
1. Check your custodial balance
   → binance_us_custodian_balance (rail: "anchorage")

2. Transfer assets from custody to exchange if needed
   → binance_us_custodian_transfer_custody_to_exchange
   
3. Wait for transfer completion
   → binance_us_custodian_transfer_status

4. Place a trade
   → binance_us_custodian_place_order

5. Check order status
   → binance_us_custodian_get_order

6. After trading, settle back to custody
   → binance_us_custodian_settlement_request
```

### Workflow 2: Batch Order Management

```
1. Check open orders
   → binance_us_custodian_open_orders (rail: "bitgo")

2. Cancel specific orders if needed
   → binance_us_custodian_cancel_order

3. Place new orders
   → binance_us_custodian_place_order

4. Monitor trades
   → binance_us_custodian_trades
```

### Workflow 3: End-of-Day Settlement

```
1. Get all completed trades
   → binance_us_custodian_trades (with time range)

2. Check exchange balances
   → binance_us_custodian_balance

3. Request settlement for each asset
   → binance_us_custodian_settlement_request

4. Verify settlement completion
   → binance_us_custodian_settlement_status
```

## Rail Parameter

Every custodial tool requires a `rail` parameter specifying your custody provider:

| Rail Value | Provider | Description |
|------------|----------|-------------|
| `anchorage` | Anchorage Digital | US-based qualified custodian |
| `bitgo` | BitGo | Multi-signature custody platform |

Example:
```json
{
  "asset": "BTC",
  "rail": "anchorage"
}
```

## Transfer Flow

### Custody → Exchange Transfer

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│   Custody   │         │   Transit   │         │  Exchange   │
│   Wallet    │────────▶│   (Locked)  │────────▶│   Balance   │
│             │         │             │         │             │
│  BTC: 10.0  │         │  BTC: 1.0   │         │  BTC: 1.0   │
│             │         │  (pending)  │         │  (ready)    │
└─────────────┘         └─────────────┘         └─────────────┘
```

**Steps:**
1. Call `binance_us_custodian_transfer_custody_to_exchange`
2. Assets are locked in transit
3. Once confirmed, assets appear in exchange balance
4. Ready for trading

### Exchange → Custody Settlement

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│  Exchange   │         │ Settlement  │         │   Custody   │
│   Balance   │────────▶│  (Process)  │────────▶│   Wallet    │
│             │         │             │         │             │
│  USD: 50K   │         │  USD: 50K   │         │  USD: +50K  │
│             │         │  (pending)  │         │             │
└─────────────┘         └─────────────┘         └─────────────┘
```

**Steps:**
1. Call `binance_us_custodian_settlement_request`
2. Assets enter settlement process
3. Custody partner confirms receipt
4. Assets appear in custody wallet

## Order Types

### Supported Order Types

| Type | Description | Required Parameters |
|------|-------------|-------------------|
| `LIMIT` | Limit order at specified price | quantity, price, timeInForce |
| `MARKET` | Market order at best price | quantity |
| `STOP_LOSS` | Stop loss market order | quantity, stopPrice |
| `STOP_LOSS_LIMIT` | Stop loss limit order | quantity, price, stopPrice, timeInForce |
| `TAKE_PROFIT` | Take profit market order | quantity, stopPrice |
| `TAKE_PROFIT_LIMIT` | Take profit limit order | quantity, price, stopPrice, timeInForce |

### Time in Force

| Value | Description |
|-------|-------------|
| `GTC` | Good Till Cancelled |
| `IOC` | Immediate or Cancel |
| `FOK` | Fill or Kill |

## Example Requests

### Check Balance

```json
Tool: binance_us_custodian_balance
Parameters:
{
  "asset": "BTC",
  "rail": "anchorage"
}
```

Response:
```json
{
  "asset": "BTC",
  "free": "5.25000000",
  "locked": "0.50000000",
  "total": "5.75000000"
}
```

### Place Limit Order

```json
Tool: binance_us_custodian_place_order
Parameters:
{
  "symbol": "BTCUSD",
  "side": "BUY",
  "type": "LIMIT",
  "quantity": "0.1",
  "price": "45000",
  "timeInForce": "GTC",
  "rail": "anchorage"
}
```

Response:
```json
{
  "symbol": "BTCUSD",
  "orderId": 123456789,
  "clientOrderId": "abc123",
  "transactTime": 1706000000000,
  "price": "45000.00",
  "origQty": "0.1",
  "executedQty": "0.0",
  "status": "NEW",
  "type": "LIMIT",
  "side": "BUY"
}
```

### Request Settlement

```json
Tool: binance_us_custodian_settlement_request
Parameters:
{
  "asset": "USD",
  "amount": "50000",
  "rail": "bitgo"
}
```

Response:
```json
{
  "settlementId": "settle_789xyz",
  "asset": "USD",
  "amount": "50000.00",
  "status": "PENDING",
  "requestTime": 1706000000000,
  "estimatedCompletionTime": 1706003600000
}
```

## Error Handling

### Common Errors

| Error Code | Message | Cause |
|------------|---------|-------|
| -1002 | Unauthorized | Invalid or missing API key |
| -1015 | Too many requests | Rate limit exceeded |
| -2010 | Order rejected | Insufficient balance or invalid parameters |
| -3001 | Invalid rail | Rail parameter not recognized |
| -3002 | Transfer failed | Transfer could not be completed |
| -3003 | Settlement pending | Previous settlement still in progress |

### Error Response Format

```json
{
  "code": -2010,
  "msg": "Order rejected: Insufficient balance"
}
```

## Rate Limits

Custodial endpoints have separate rate limits from standard exchange endpoints:

| Limit Type | Value |
|------------|-------|
| Orders per second | 5 |
| Orders per day | 50,000 |
| Transfers per minute | 10 |
| Settlements per hour | 20 |

## Security Best Practices

1. **Secure API Keys**: Store custodial API keys in secure vaults, never in code
2. **IP Whitelisting**: Configure allowed IPs in your custody partner's settings
3. **Audit Logging**: Log all custodial operations for compliance
4. **Dual Control**: Implement approval workflows for large settlements
5. **Regular Reconciliation**: Compare custody and exchange balances daily

## Support

For custodial-specific issues:
- Contact your custody partner (Anchorage/BitGo) for API key issues
- Contact Binance.US institutional support for settlement issues
- Review [Binance.US API Documentation](https://docs.binance.us/) for endpoint details
