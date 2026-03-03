# Binance.US Trading & Order Management

Complete documentation for the trading tools available in the Binance.US MCP Server.

## Overview

The trading module provides 13 tools for managing orders on Binance.US:

| Tool | Description | Endpoint |
|------|-------------|----------|
| `binance_us_new_order` | Place a new order | POST /api/v3/order |
| `binance_us_test_order` | Test order validation | POST /api/v3/order/test |
| `binance_us_get_order` | Query order status | GET /api/v3/order |
| `binance_us_cancel_order` | Cancel an order | DELETE /api/v3/order |
| `binance_us_cancel_replace` | Cancel and replace | POST /api/v3/order/cancelReplace |
| `binance_us_cancel_all_open_orders` | Cancel all open orders | DELETE /api/v3/openOrders |
| `binance_us_open_orders` | Get open orders | GET /api/v3/openOrders |
| `binance_us_all_orders` | Get order history | GET /api/v3/allOrders |
| `binance_us_new_oco` | Place OCO order | POST /api/v3/order/oco |
| `binance_us_get_oco` | Query OCO order | GET /api/v3/orderList |
| `binance_us_cancel_oco` | Cancel OCO order | DELETE /api/v3/orderList |
| `binance_us_open_oco` | Get open OCO orders | GET /api/v3/openOrderList |
| `binance_us_all_oco_orders` | Get OCO history | GET /api/v3/allOrderList |

## Prerequisites

### API Key Requirements

Trading requires a Binance.US Exchange API key with trading permissions enabled:

1. Log in to [Binance.US](https://www.binance.us)
2. Go to Profile → API Management
3. Create a new API key
4. Enable "Spot Trading" permission
5. (Optional) Enable IP whitelist for security

### Environment Variables

```bash
BINANCE_US_API_KEY=your_api_key
BINANCE_US_API_SECRET=your_api_secret
```

## Order Types

### LIMIT Order
A limit order trades at a specific price or better.

```
Tool: binance_us_new_order
Parameters:
  - symbol: "BTCUSDT"
  - side: "BUY" or "SELL"
  - type: "LIMIT"
  - quantity: 0.001
  - price: 50000
  - timeInForce: "GTC"
```

### MARKET Order
A market order trades immediately at the best available price.

```
Tool: binance_us_new_order
Parameters:
  - symbol: "BTCUSDT"
  - side: "BUY" or "SELL"
  - type: "MARKET"
  - quantity: 0.001  # OR use quoteOrderQty for quote-based orders
```

### STOP_LOSS Order
Triggers a market order when the stop price is reached.

```
Tool: binance_us_new_order
Parameters:
  - symbol: "BTCUSDT"
  - side: "SELL"
  - type: "STOP_LOSS"
  - quantity: 0.001
  - stopPrice: 48000
```

### STOP_LOSS_LIMIT Order
Triggers a limit order when the stop price is reached.

```
Tool: binance_us_new_order
Parameters:
  - symbol: "BTCUSDT"
  - side: "SELL"
  - type: "STOP_LOSS_LIMIT"
  - quantity: 0.001
  - price: 47900
  - stopPrice: 48000
  - timeInForce: "GTC"
```

### TAKE_PROFIT Order
Triggers a market order when the take profit price is reached.

```
Tool: binance_us_new_order
Parameters:
  - symbol: "BTCUSDT"
  - side: "SELL"
  - type: "TAKE_PROFIT"
  - quantity: 0.001
  - stopPrice: 55000
```

### TAKE_PROFIT_LIMIT Order
Triggers a limit order when the take profit price is reached.

```
Tool: binance_us_new_order
Parameters:
  - symbol: "BTCUSDT"
  - side: "SELL"
  - type: "TAKE_PROFIT_LIMIT"
  - quantity: 0.001
  - price: 55100
  - stopPrice: 55000
  - timeInForce: "GTC"
```

### LIMIT_MAKER Order
A post-only order that will be rejected if it would immediately match.

```
Tool: binance_us_new_order
Parameters:
  - symbol: "BTCUSDT"
  - side: "BUY"
  - type: "LIMIT_MAKER"
  - quantity: 0.001
  - price: 49000
```

## Time In Force Options

| Value | Name | Description |
|-------|------|-------------|
| `GTC` | Good Til Canceled | Order remains active until filled or canceled |
| `IOC` | Immediate Or Cancel | Fill what you can immediately, cancel the rest |
| `FOK` | Fill Or Kill | Must be filled entirely or not at all |

## Self Trade Prevention (STP)

Prevents your orders from trading against each other:

| Mode | Description |
|------|-------------|
| `EXPIRE_TAKER` | Expire the taker order |
| `EXPIRE_MAKER` | Expire the maker order |
| `EXPIRE_BOTH` | Expire both orders |
| `NONE` | Allow self-trade (default) |

## OCO Orders (One-Cancels-Other)

OCO orders combine a limit order with a stop-limit order. When one triggers, the other is automatically canceled.

### SELL OCO Example
Selling BTC with a take-profit at $55,000 and stop-loss at $48,000:

```
Tool: binance_us_new_oco
Parameters:
  - symbol: "BTCUSDT"
  - side: "SELL"
  - quantity: 0.001
  - price: 55000         # Limit sell (take profit)
  - stopPrice: 48000     # Stop trigger
  - stopLimitPrice: 47900  # Limit price after stop triggers
  - stopLimitTimeInForce: "GTC"
```

**Price Rules for SELL OCO:**
- `price` (limit) > Last Market Price > `stopPrice` (stop)

### BUY OCO Example
Buying BTC with a limit at $48,000 and stop-buy at $52,000:

```
Tool: binance_us_new_oco
Parameters:
  - symbol: "BTCUSDT"
  - side: "BUY"
  - quantity: 0.001
  - price: 48000         # Limit buy
  - stopPrice: 52000     # Stop trigger
  - stopLimitPrice: 52100  # Limit price after stop triggers
  - stopLimitTimeInForce: "GTC"
```

**Price Rules for BUY OCO:**
- `price` (limit) < Last Market Price < `stopPrice` (stop)

## Common Workflows

### 1. Place and Monitor an Order

```
1. binance_us_new_order (place the order)
   → Returns orderId

2. binance_us_get_order (check status)
   → symbol + orderId
   
3. Wait for fill or cancel if needed
```

### 2. Cancel and Replace (Modify Order)

```
1. binance_us_cancel_replace
   - symbol: "BTCUSDT"
   - side: "BUY"
   - type: "LIMIT"
   - cancelOrderId: 123456  # Order to cancel
   - quantity: 0.002        # New quantity
   - price: 49500           # New price
   - cancelReplaceMode: "STOP_ON_FAILURE"
```

### 3. Emergency: Cancel All Orders

```
binance_us_cancel_all_open_orders
  - symbol: "BTCUSDT"
  
→ Cancels ALL open orders for that symbol
```

### 4. View Order History

```
binance_us_all_orders
  - symbol: "BTCUSDT"
  - limit: 100
  - startTime: 1704067200000  # Optional: filter by time
```

## Error Handling

The server provides enhanced error messages with hints for common issues:

### Common Error Codes

| Code | Message | Solution |
|------|---------|----------|
| -1000 | Unknown error | Retry the request |
| -1002 | Unauthorized | Check API key permissions |
| -1013 | Invalid quantity | Check symbol's LOT_SIZE filter |
| -1015 | Too many orders | Reduce order frequency |
| -1021 | Timestamp outside recvWindow | Sync system time |
| -1022 | Invalid signature | Check API secret |
| -1102 | Mandatory parameter missing | Include all required params |
| -1111 | Precision too high | Reduce decimal places |
| -1121 | Invalid symbol | Check symbol format (e.g., BTCUSDT) |
| -2010 | New order rejected | Check account balance |
| -2011 | Cancel rejected | Order may already be filled |
| -2013 | Order does not exist | Check orderId |
| -2014 | Invalid API key format | Re-check API key |
| -2015 | Invalid API key or permissions | Enable trading permission |

### Example Error Response

```
❌ Failed to place order: Binance API Error (code: -2010): Account has insufficient balance

Hint: New order rejected - check if you have sufficient balance, the symbol is correct, and order parameters meet exchange requirements.
```

## Rate Limits

Be mindful of Binance.US rate limits:

| Limit Type | Value |
|------------|-------|
| Request Weight | 1,200 per minute |
| Orders | 10 per second |
| Orders | 100,000 per day |
| Raw Requests | 5,000 per 5 minutes |

Each tool's weight:
- Order operations: 1
- Query operations: 1-10 (depending on data size)
- Cancel all orders: 1

## Security Best Practices

1. **Use IP Whitelisting** - Restrict API access to known IPs
2. **Enable Only Needed Permissions** - Don't enable withdrawal if not needed
3. **Test with Test Orders First** - Use `binance_us_test_order` to validate
4. **Use recvWindow** - Set a small recvWindow (5000-10000ms) to prevent replay attacks
5. **Monitor Your Account** - Check for unauthorized activity regularly

## Testing Orders

Always test your order parameters first:

```
binance_us_test_order
  - symbol: "BTCUSDT"
  - side: "BUY"
  - type: "LIMIT"
  - quantity: 0.001
  - price: 50000
  - timeInForce: "GTC"

→ Returns success if order would be accepted
→ No actual order is placed
→ No balance is required
```

## Response Examples

### New Order Response

```json
{
  "symbol": "BTCUSDT",
  "orderId": 123456789,
  "clientOrderId": "myOrder123",
  "transactTime": 1704067200000,
  "price": "50000.00",
  "origQty": "0.001",
  "executedQty": "0.001",
  "status": "FILLED",
  "timeInForce": "GTC",
  "type": "LIMIT",
  "side": "BUY",
  "fills": [
    {
      "price": "50000.00",
      "qty": "0.001",
      "commission": "0.00001",
      "commissionAsset": "BTC"
    }
  ]
}
```

### Order Statuses

| Status | Description |
|--------|-------------|
| `NEW` | Order accepted, not yet filled |
| `PARTIALLY_FILLED` | Some quantity filled |
| `FILLED` | Completely filled |
| `CANCELED` | Canceled by user |
| `PENDING_CANCEL` | Cancel request received |
| `REJECTED` | Order rejected |
| `EXPIRED` | Order expired (timeInForce) |

## Troubleshooting

### "Invalid symbol"
- Ensure symbol is uppercase: `BTCUSDT` not `btcusdt`
- Check if the pair exists on Binance.US

### "Insufficient balance"
- Check your available balance (not locked in orders)
- Consider commission fees

### "Quantity too low/high"
- Check the symbol's LOT_SIZE filter via exchange info
- Round to the correct decimal places

### "Price too low/high"
- Check the symbol's PRICE_FILTER
- Price must be within the allowed range

### "Signature invalid"
- Ensure API secret is correct
- Check system time is synchronized
- Verify no extra spaces in credentials
