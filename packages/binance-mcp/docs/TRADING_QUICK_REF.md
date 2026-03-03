# Quick Reference: Binance.US Trading Tools

Fast reference for all trading tools with minimal examples.

## Standard Orders

### Place Order
```
binance_us_new_order
├── symbol: "BTCUSDT" (required)
├── side: "BUY" | "SELL" (required)
├── type: "LIMIT" | "MARKET" | "STOP_LOSS" | "STOP_LOSS_LIMIT" | "TAKE_PROFIT" | "TAKE_PROFIT_LIMIT" | "LIMIT_MAKER"
├── quantity: 0.001
├── price: 50000 (for LIMIT)
├── stopPrice: 48000 (for STOP_* types)
├── timeInForce: "GTC" | "IOC" | "FOK"
├── quoteOrderQty: 100 (alternative to quantity for MARKET)
├── newClientOrderId: "myOrder1"
├── selfTradePreventionMode: "EXPIRE_TAKER" | "EXPIRE_MAKER" | "EXPIRE_BOTH" | "NONE"
└── recvWindow: 5000
```

### Test Order (No Execution)
```
binance_us_test_order
└── (same params as new_order)
```

### Get Order Status
```
binance_us_get_order
├── symbol: "BTCUSDT" (required)
├── orderId: 123456 (one required)
├── origClientOrderId: "myOrder1" (one required)
└── recvWindow: 5000
```

### Cancel Order
```
binance_us_cancel_order
├── symbol: "BTCUSDT" (required)
├── orderId: 123456 (one required)
├── origClientOrderId: "myOrder1" (one required)
├── newClientOrderId: "cancelOrder1"
└── recvWindow: 5000
```

### Cancel & Replace (Atomic)
```
binance_us_cancel_replace
├── symbol: "BTCUSDT" (required)
├── side: "BUY" | "SELL" (required)
├── type: "LIMIT" | "MARKET" | etc.
├── cancelReplaceMode: "STOP_ON_FAILURE" | "ALLOW_FAILURE"
├── cancelOrderId: 123456 (one required)
├── cancelOrigClientOrderId: "oldOrder" (one required)
├── quantity: 0.002
├── price: 51000
└── timeInForce: "GTC"
```

### Cancel All Open Orders
```
binance_us_cancel_all_open_orders
├── symbol: "BTCUSDT" (required)
└── recvWindow: 5000
```

### List Open Orders
```
binance_us_open_orders
├── symbol: "BTCUSDT" (optional, omit for all symbols)
└── recvWindow: 5000
```

### Query Order History
```
binance_us_all_orders
├── symbol: "BTCUSDT" (required)
├── orderId: 100000 (start from this ID)
├── startTime: 1704067200000
├── endTime: 1704153600000
├── limit: 500 (max 1000)
└── recvWindow: 5000
```

## OCO Orders

### Place OCO
```
binance_us_new_oco
├── symbol: "BTCUSDT" (required)
├── side: "BUY" | "SELL" (required)
├── quantity: 0.001 (required)
├── price: 55000 (limit price, required)
├── stopPrice: 48000 (stop trigger, required)
├── stopLimitPrice: 47900 (limit after stop)
├── stopLimitTimeInForce: "GTC" | "IOC" | "FOK"
├── listClientOrderId: "myOco1"
├── limitClientOrderId: "myLimitOrder"
├── stopClientOrderId: "myStopOrder"
└── recvWindow: 5000
```

### Get OCO Status
```
binance_us_get_oco
├── orderListId: 12345 (one required)
├── origClientOrderId: "myOco1" (one required)
└── recvWindow: 5000
```

### Cancel OCO
```
binance_us_cancel_oco
├── symbol: "BTCUSDT" (required)
├── orderListId: 12345 (one required)
├── listClientOrderId: "myOco1" (one required)
├── newClientOrderId: "cancelOco1"
└── recvWindow: 5000
```

### List Open OCOs
```
binance_us_open_oco
└── recvWindow: 5000
```

### Query OCO History
```
binance_us_all_oco_orders
├── fromId: 10000 (start from this list ID)
├── startTime: 1704067200000
├── endTime: 1704153600000
├── limit: 500 (max 1000)
└── recvWindow: 5000
```

## Quick Examples

### Buy $100 of BTC at Market
```
binance_us_new_order
  symbol: "BTCUSDT"
  side: "BUY"
  type: "MARKET"
  quoteOrderQty: 100
```

### Sell 0.01 BTC with Limit
```
binance_us_new_order
  symbol: "BTCUSDT"
  side: "SELL"
  type: "LIMIT"
  quantity: 0.01
  price: 55000
  timeInForce: "GTC"
```

### Set Stop-Loss at $48,000
```
binance_us_new_order
  symbol: "BTCUSDT"
  side: "SELL"
  type: "STOP_LOSS"
  quantity: 0.01
  stopPrice: 48000
```

### Bracket Order (OCO)
Sell at $55k (take profit) or $48k (stop loss):
```
binance_us_new_oco
  symbol: "BTCUSDT"
  side: "SELL"
  quantity: 0.01
  price: 55000
  stopPrice: 48000
  stopLimitPrice: 47900
  stopLimitTimeInForce: "GTC"
```

### Check and Cancel if Unfilled
```
1. binance_us_get_order
     symbol: "BTCUSDT"
     orderId: 123456
   
2. If status != "FILLED":
   binance_us_cancel_order
     symbol: "BTCUSDT"
     orderId: 123456
```

### Modify Order Price
```
binance_us_cancel_replace
  symbol: "BTCUSDT"
  side: "BUY"
  type: "LIMIT"
  cancelReplaceMode: "STOP_ON_FAILURE"
  cancelOrderId: 123456
  quantity: 0.01
  price: 49500
  timeInForce: "GTC"
```

### Emergency: Cancel Everything
```
binance_us_cancel_all_open_orders
  symbol: "BTCUSDT"
```

## Order Status Values

| Status | Meaning |
|--------|---------|
| NEW | Accepted, awaiting fill |
| PARTIALLY_FILLED | Partially executed |
| FILLED | Completely executed |
| CANCELED | Canceled by user |
| PENDING_CANCEL | Cancel in progress |
| REJECTED | Order rejected |
| EXPIRED | TimeInForce expired |

## Common Errors & Fixes

| Error | Fix |
|-------|-----|
| -1121 Invalid symbol | Use uppercase: BTCUSDT |
| -2010 Order rejected | Check balance, quantity |
| -2011 Cancel rejected | Already filled |
| -2013 Order not found | Check orderId |
| -1022 Invalid signature | Check API secret |
| -9003 MIN_NOTIONAL | Order too small ($10 min) |
