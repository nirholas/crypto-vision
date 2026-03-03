# Binance.US MCP Server - Complete API Reference

This document provides detailed documentation for all tools available in the Binance.US MCP Server.

## Table of Contents

- [General Tools](#general-tools)
- [Market Data Tools](#market-data-tools)
- [Trading Tools](#trading-tools)
- [Wallet Tools](#wallet-tools)
- [Account Tools](#account-tools)
- [OTC Trading Tools](#otc-trading-tools)
- [Staking Tools](#staking-tools)
- [Sub-Account Tools](#sub-account-tools)
- [User Data Stream Tools](#user-data-stream-tools)
- [Custodial Solution Tools](#custodial-solution-tools)
- [Credit Line Tools](#credit-line-tools)

---

## General Tools

### `binance_us_ping`
Test connectivity to the Binance.US API.

**Parameters:** None

**Returns:**
```json
{ "success": true }
```

### `binance_us_time`
Get the current server time.

**Returns:**
```json
{ "serverTime": 1706000000000 }
```

### `binance_us_exchange_info`
Get exchange trading rules and symbol information.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| symbol | string | No | Specific trading pair (e.g., "BTCUSD") |
| symbols | string[] | No | Array of trading pairs |

---

## Market Data Tools

### `binance_us_ticker_price`
Get the latest price for a symbol or all symbols.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| symbol | string | No | Trading pair (e.g., "BTCUSD") |

### `binance_us_ticker_24hr`
Get 24-hour rolling window price change statistics.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| symbol | string | No | Trading pair |

### `binance_us_order_book`
Get order book depth data.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| symbol | string | Yes | Trading pair |
| limit | number | No | Depth limit (5, 10, 20, 50, 100, 500, 1000, 5000) |

### `binance_us_recent_trades`
Get recent trades for a symbol.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| symbol | string | Yes | Trading pair |
| limit | number | No | Number of trades (max 1000) |

### `binance_us_historical_trades`
Get older trades (requires API key).

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| symbol | string | Yes | Trading pair |
| limit | number | No | Number of trades |
| fromId | number | No | Trade ID to fetch from |

### `binance_us_klines`
Get kline/candlestick data.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| symbol | string | Yes | Trading pair |
| interval | string | Yes | Kline interval (1m, 5m, 15m, 1h, 4h, 1d, etc.) |
| startTime | number | No | Start time in ms |
| endTime | number | No | End time in ms |
| limit | number | No | Number of klines (max 1000) |

### `binance_us_avg_price`
Get current average price for a symbol.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| symbol | string | Yes | Trading pair |

---

## Trading Tools

### `binance_us_new_order`
Place a new spot order.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| symbol | string | Yes | Trading pair |
| side | string | Yes | "BUY" or "SELL" |
| type | string | Yes | Order type (LIMIT, MARKET, STOP_LOSS, STOP_LOSS_LIMIT, TAKE_PROFIT, TAKE_PROFIT_LIMIT, LIMIT_MAKER) |
| quantity | string | Conditional | Order quantity |
| quoteOrderQty | string | Conditional | Quote asset quantity (for MARKET orders) |
| price | string | Conditional | Order price (required for LIMIT orders) |
| timeInForce | string | Conditional | GTC, IOC, or FOK |
| stopPrice | string | Conditional | Stop price (for stop orders) |
| newClientOrderId | string | No | Custom order ID |

### `binance_us_cancel_order`
Cancel an active order.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| symbol | string | Yes | Trading pair |
| orderId | number | Conditional | Order ID |
| origClientOrderId | string | Conditional | Original client order ID |

### `binance_us_cancel_all_orders`
Cancel all open orders on a symbol.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| symbol | string | Yes | Trading pair |

### `binance_us_get_order`
Get order status.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| symbol | string | Yes | Trading pair |
| orderId | number | Conditional | Order ID |
| origClientOrderId | string | Conditional | Original client order ID |

### `binance_us_open_orders`
Get all open orders.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| symbol | string | No | Trading pair (omit for all symbols) |

### `binance_us_all_orders`
Get all orders (active, canceled, filled).

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| symbol | string | Yes | Trading pair |
| orderId | number | No | Order ID to start from |
| startTime | number | No | Start time in ms |
| endTime | number | No | End time in ms |
| limit | number | No | Number of orders (max 1000) |

### `binance_us_new_oco_order`
Place a new OCO (One-Cancels-Other) order.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| symbol | string | Yes | Trading pair |
| side | string | Yes | "BUY" or "SELL" |
| quantity | string | Yes | Order quantity |
| price | string | Yes | Limit order price |
| stopPrice | string | Yes | Stop order trigger price |
| stopLimitPrice | string | No | Stop-limit order price |
| stopLimitTimeInForce | string | No | GTC, FOK, IOC |

---

## Wallet Tools

### `binance_us_deposit_address`
Get deposit address for an asset.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| coin | string | Yes | Asset symbol (e.g., "BTC") |
| network | string | No | Network (e.g., "BTC", "ETH") |

### `binance_us_deposit_history`
Get deposit history.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| coin | string | No | Asset symbol |
| status | number | No | Status (0=pending, 1=success) |
| startTime | number | No | Start time in ms |
| endTime | number | No | End time in ms |

### `binance_us_withdraw`
Submit a withdrawal request.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| coin | string | Yes | Asset symbol |
| address | string | Yes | Withdrawal address |
| amount | string | Yes | Withdrawal amount |
| network | string | No | Network |
| addressTag | string | No | Secondary address (memo/tag) |

### `binance_us_withdraw_history`
Get withdrawal history.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| coin | string | No | Asset symbol |
| status | number | No | Status |
| startTime | number | No | Start time in ms |
| endTime | number | No | End time in ms |

---

## Account Tools

### `binance_us_account`
Get account information including balances.

**Parameters:** None (signed request)

**Returns:**
```json
{
  "makerCommission": 10,
  "takerCommission": 10,
  "balances": [
    { "asset": "BTC", "free": "1.0", "locked": "0.5" }
  ]
}
```

### `binance_us_my_trades`
Get account trade history.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| symbol | string | Yes | Trading pair |
| orderId | number | No | Order ID |
| startTime | number | No | Start time in ms |
| endTime | number | No | End time in ms |
| limit | number | No | Number of trades (max 1000) |

---

## OTC Trading Tools

> **Note:** OTC (Over-The-Counter) trading is for large block trades with special pricing.

### `binance_us_otc_coin_pairs`
Get available OTC trading pairs.

**Parameters:** None

**Returns:**
```json
{
  "data": [
    {
      "fromCoin": "BTC",
      "toCoin": "USD",
      "fromCoinMinAmount": "0.1",
      "fromCoinMaxAmount": "100",
      "toCoinMinAmount": "1000",
      "toCoinMaxAmount": "10000000"
    }
  ]
}
```

### `binance_us_otc_quote`
Request an OTC quote.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| fromCoin | string | Yes | Asset to sell |
| toCoin | string | Yes | Asset to buy |
| requestCoin | string | Yes | Which coin amount is specified |
| requestAmount | string | Yes | Amount of requestCoin |

**Returns:**
```json
{
  "quoteId": "quote123",
  "fromCoin": "BTC",
  "toCoin": "USD",
  "fromAmount": "1.0",
  "toAmount": "45000.00",
  "ratio": "45000",
  "inverseRatio": "0.00002222",
  "validTimestamp": 1706000010000
}
```

### `binance_us_otc_place_order`
Execute an OTC trade using a quote.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| quoteId | string | Yes | Quote ID from `binance_us_otc_quote` |

### `binance_us_otc_get_order`
Get OTC order details.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| orderId | string | Yes | OTC order ID |

### `binance_us_otc_all_orders`
Get all OTC orders with pagination.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| orderId | string | No | Start from order ID |
| startTime | number | No | Start time in ms |
| endTime | number | No | End time in ms |
| limit | number | No | Number of orders (max 100) |

### `binance_us_ocbs_orders`
Get OCBS (OTC Block Settlement) orders.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| orderId | string | No | Filter by order ID |
| startTime | number | No | Start time in ms |
| endTime | number | No | End time in ms |
| limit | number | No | Number of orders (max 100) |

---

## Staking Tools

> **Note:** Staking allows users to earn rewards by locking supported assets.

### `binance_us_staking_asset_info`
Get staking product information for an asset.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| stakingAsset | string | Yes | Asset symbol (e.g., "ETH", "SOL") |

**Returns:**
```json
{
  "stakingAsset": "ETH",
  "minStakingAmount": "0.001",
  "maxStakingAmount": "10000",
  "annualInterestRate": "0.045",
  "lockPeriod": 0,
  "status": "ACTIVE"
}
```

### `binance_us_staking_stake`
Subscribe to a staking product.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| stakingAsset | string | Yes | Asset to stake |
| amount | string | Yes | Amount to stake |

### `binance_us_staking_unstake`
Redeem a staking position.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| stakingAsset | string | Yes | Asset to unstake |
| amount | string | Yes | Amount to unstake |

### `binance_us_staking_balance`
Get staking balance for an asset.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| stakingAsset | string | Yes | Asset symbol |

**Returns:**
```json
{
  "stakingAsset": "ETH",
  "stakedAmount": "10.5",
  "pendingRewards": "0.025",
  "totalEarned": "0.5"
}
```

### `binance_us_staking_history`
Get staking transaction history.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| stakingAsset | string | No | Filter by asset |
| startTime | number | No | Start time in ms |
| endTime | number | No | End time in ms |
| page | number | No | Page number |
| limit | number | No | Results per page (max 100) |

### `binance_us_staking_rewards`
Get staking rewards history.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| stakingAsset | string | No | Filter by asset |
| startTime | number | No | Start time in ms |
| endTime | number | No | End time in ms |
| page | number | No | Page number |
| limit | number | No | Results per page (max 100) |

---

## Sub-Account Tools

### `binance_us_create_subaccount`
Create a new sub-account.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| email | string | Yes | Sub-account email |

### `binance_us_subaccount_list`
Get list of sub-accounts.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| email | string | No | Filter by email |
| page | number | No | Page number |
| limit | number | No | Results per page |

### `binance_us_subaccount_transfer`
Transfer between main and sub-account.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| toEmail | string | Yes | Recipient email |
| asset | string | Yes | Asset symbol |
| amount | string | Yes | Transfer amount |

---

## User Data Stream Tools

> **Note:** User data streams provide real-time account updates via WebSocket.

### `binance_us_create_listen_key`
Create a new listen key for user data stream.

**Parameters:** None

**Returns:**
```json
{ "listenKey": "pqia91ma19a5s61cv6a81va65sdf19v8a65a1a5s61cv6a81va65sdf19v8a65a1" }
```

### `binance_us_keepalive_listen_key`
Keep a listen key alive (must be called every 60 minutes).

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| listenKey | string | Yes | Listen key to keep alive |

### `binance_us_close_listen_key`
Close a user data stream.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| listenKey | string | Yes | Listen key to close |

---

## Custodial Solution Tools

> **Note:** These endpoints require a **Custodial Solution API Key** from participating custody partners (Anchorage Digital, BitGo, etc.). Standard exchange API keys will not work.

### Balance & Account Tools

#### `binance_us_custodian_balance`
Get custodial account balance.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| asset | string | No | Filter by asset |
| rail | string | Yes | Custody rail: "anchorage" or "bitgo" |

#### `binance_us_custodian_account_info`
Get custodial account information.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| rail | string | Yes | Custody rail: "anchorage" or "bitgo" |

### Transfer Tools

#### `binance_us_custodian_transfer_custody_to_exchange`
Transfer assets from custody to exchange.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| asset | string | Yes | Asset symbol |
| amount | string | Yes | Transfer amount |
| rail | string | Yes | Custody rail |

#### `binance_us_custodian_transfer_exchange_to_custody`
Transfer assets from exchange to custody.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| asset | string | Yes | Asset symbol |
| amount | string | Yes | Transfer amount |
| rail | string | Yes | Custody rail |

#### `binance_us_custodian_transfer_status`
Get transfer status by ID.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| transferId | string | Yes | Transfer ID |
| rail | string | Yes | Custody rail |

#### `binance_us_custodian_transfer_history`
Get transfer history.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| asset | string | No | Filter by asset |
| startTime | number | No | Start time in ms |
| endTime | number | No | End time in ms |
| limit | number | No | Number of results (max 1000) |
| rail | string | Yes | Custody rail |

### Order Tools

#### `binance_us_custodian_place_order`
Place an order from custodial account.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| symbol | string | Yes | Trading pair |
| side | string | Yes | "BUY" or "SELL" |
| type | string | Yes | Order type (LIMIT, MARKET) |
| quantity | string | Conditional | Order quantity |
| price | string | Conditional | Order price (for LIMIT) |
| timeInForce | string | No | GTC, IOC, FOK |
| rail | string | Yes | Custody rail |

#### `binance_us_custodian_cancel_order`
Cancel a custodial order.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| symbol | string | Yes | Trading pair |
| orderId | number | Conditional | Order ID |
| origClientOrderId | string | Conditional | Original client order ID |
| rail | string | Yes | Custody rail |

#### `binance_us_custodian_get_order`
Get custodial order status.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| symbol | string | Yes | Trading pair |
| orderId | number | Conditional | Order ID |
| origClientOrderId | string | Conditional | Original client order ID |
| rail | string | Yes | Custody rail |

#### `binance_us_custodian_open_orders`
Get all open custodial orders.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| symbol | string | No | Filter by trading pair |
| rail | string | Yes | Custody rail |

#### `binance_us_custodian_all_orders`
Get all custodial orders.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| symbol | string | Yes | Trading pair |
| orderId | number | No | Start from order ID |
| startTime | number | No | Start time in ms |
| endTime | number | No | End time in ms |
| limit | number | No | Number of results |
| rail | string | Yes | Custody rail |

#### `binance_us_custodian_trades`
Get custodial trade history.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| symbol | string | Yes | Trading pair |
| orderId | number | No | Filter by order ID |
| startTime | number | No | Start time in ms |
| endTime | number | No | End time in ms |
| limit | number | No | Number of results (max 1000) |
| rail | string | Yes | Custody rail |

### Settlement Tools

#### `binance_us_custodian_settlement_request`
Request settlement to custody.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| asset | string | Yes | Asset to settle |
| amount | string | Yes | Amount to settle |
| rail | string | Yes | Custody rail |

#### `binance_us_custodian_settlement_status`
Get settlement status.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| settlementId | string | Yes | Settlement ID |
| rail | string | Yes | Custody rail |

#### `binance_us_custodian_settlement_history`
Get settlement history.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| asset | string | No | Filter by asset |
| startTime | number | No | Start time in ms |
| endTime | number | No | End time in ms |
| limit | number | No | Number of results |
| rail | string | Yes | Custody rail |

### OCO Order Tools

#### `binance_us_custodian_oco_order`
Place an OCO order from custodial account.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| symbol | string | Yes | Trading pair |
| side | string | Yes | "BUY" or "SELL" |
| quantity | string | Yes | Order quantity |
| price | string | Yes | Limit price |
| stopPrice | string | Yes | Stop trigger price |
| stopLimitPrice | string | No | Stop limit price |
| rail | string | Yes | Custody rail |

#### `binance_us_custodian_cancel_oco`
Cancel a custodial OCO order.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| symbol | string | Yes | Trading pair |
| orderListId | number | Conditional | OCO order list ID |
| listClientOrderId | string | Conditional | Client order list ID |
| rail | string | Yes | Custody rail |

#### `binance_us_custodian_get_oco`
Get custodial OCO order status.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| orderListId | number | Conditional | OCO order list ID |
| origClientOrderId | string | Conditional | Original client order ID |
| rail | string | Yes | Custody rail |

#### `binance_us_custodian_all_oco`
Get all custodial OCO orders.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| startTime | number | No | Start time in ms |
| endTime | number | No | End time in ms |
| limit | number | No | Number of results (max 1000) |
| rail | string | Yes | Custody rail |

---

## Credit Line Tools

> **Note:** These endpoints require a **Credit Line API Key** from an institutional credit agreement with Binance.US. Standard exchange API keys will not work.

### `binance_us_cl_account`
Get credit line account information including credit limits and utilization.

**Parameters:** None

**Returns:**
```json
{
  "creditLimit": "1000000.00",
  "availableCredit": "750000.00",
  "usedCredit": "250000.00",
  "marginCallLevel": "0.8",
  "liquidationLevel": "0.9",
  "currentRatio": "0.25",
  "status": "ACTIVE"
}
```

### `binance_us_cl_alert_history`
Get margin alert history.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| startTime | number | No | Start time in ms |
| endTime | number | No | End time in ms |
| limit | number | No | Number of results (max 100) |

**Returns:**
```json
{
  "alerts": [
    {
      "alertId": "alert123",
      "alertType": "MARGIN_CALL",
      "alertLevel": "0.8",
      "currentRatio": "0.82",
      "timestamp": 1706000000000,
      "status": "RESOLVED"
    }
  ]
}
```

### `binance_us_cl_transfer_history`
Get credit line transfer history.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| asset | string | No | Filter by asset |
| type | string | No | "BORROW" or "REPAY" |
| startTime | number | No | Start time in ms |
| endTime | number | No | End time in ms |
| limit | number | No | Number of results (max 100) |

### `binance_us_cl_transfer`
Execute a credit line transfer (borrow or repay).

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| asset | string | Yes | Asset symbol |
| amount | string | Yes | Transfer amount |
| type | string | Yes | "BORROW" or "REPAY" |

### `binance_us_cl_liquidation_history`
Get liquidation event history.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| startTime | number | No | Start time in ms |
| endTime | number | No | End time in ms |
| limit | number | No | Number of results (max 100) |

**Returns:**
```json
{
  "liquidations": [
    {
      "liquidationId": "liq123",
      "asset": "BTC",
      "amount": "0.5",
      "price": "45000.00",
      "timestamp": 1706000000000,
      "reason": "MARGIN_CALL_TIMEOUT"
    }
  ]
}
```

---

## Error Handling

All tools return errors in a consistent format:

```json
{
  "success": false,
  "error": {
    "code": -1121,
    "msg": "Invalid symbol."
  }
}
```

### Common Error Codes

| Code | Description |
|------|-------------|
| -1000 | Unknown error |
| -1002 | Unauthorized - Invalid API key |
| -1003 | Too many requests - Rate limited |
| -1013 | Invalid quantity |
| -1021 | Timestamp outside recvWindow |
| -1022 | Invalid signature |
| -1102 | Mandatory parameter missing |
| -1121 | Invalid symbol |
| -2010 | New order rejected |
| -2011 | Cancel order rejected |
| -2013 | Order does not exist |
| -2014 | API key format invalid |
| -2015 | Invalid API key, IP, or permissions |

---

## Rate Limits

Binance.US enforces the following rate limits:

- **Request Weight**: 1200 per minute
- **Orders**: 10 per second, 100,000 per day
- **Raw Requests**: 5000 per 5 minutes

The MCP server handles rate limiting automatically, but be mindful when making many requests.

---

## Authentication

### Standard Endpoints
Most endpoints require API key authentication via the `X-MBX-APIKEY` header.

### Signed Endpoints
Trading and account endpoints require HMAC SHA256 signature:
1. Concatenate all query parameters
2. Sign with your API secret using HMAC SHA256
3. Append signature to request

### Special API Keys
- **Custodial Solution**: Requires partnership with custody provider
- **Credit Line**: Requires institutional agreement with Binance.US
