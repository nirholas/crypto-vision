# Binance.US MCP Server - Complete Tools Reference

This document provides a comprehensive reference for all 93 tools available in the Binance.US MCP Server.

## Table of Contents

- [General Tools (4)](#general-tools)
- [Market Data Tools (10)](#market-data-tools)
- [Trading Tools (13)](#trading-tools)
  - [Order Management (8)](#order-management)
  - [OCO Orders (5)](#oco-orders)
- [Wallet Tools (6)](#wallet-tools)
- [Account Tools (5)](#account-tools)
- [OTC Tools (6)](#otc-tools)
- [Staking Tools (6)](#staking-tools)
- [Sub-Account Tools (6)](#sub-account-tools)
- [User Data Stream Tools (4)](#user-data-stream-tools)
- [Custodial Tools (19)](#custodial-tools)
- [Custodial Solution Tools (9)](#custodial-solution-tools)
- [Credit Line Tools (5)](#credit-line-tools)

---

## General Tools

Public endpoints for system health and exchange information. No authentication required (except system status).

| Tool | Endpoint | Auth | Description |
|------|----------|------|-------------|
| `binance_us_ping` | GET /api/v3/ping | None | Test API connectivity |
| `binance_us_server_time` | GET /api/v3/time | None | Get server time |
| `binance_us_system_status` | GET /sapi/v1/system/status | Signed | Check maintenance status |
| `binance_us_exchange_info` | GET /api/v3/exchangeInfo | None | Get trading rules and pairs |

### Example Usage

```
Use binance_us_ping to check if the Binance.US API is accessible.

Use binance_us_exchange_info with symbol "BTCUSD" to get trading rules for Bitcoin.
```

---

## Market Data Tools

Public market data endpoints. No authentication required (except historical trades).

| Tool | Endpoint | Auth | Description |
|------|----------|------|-------------|
| `binance_us_order_book` | GET /api/v3/depth | None | Get order book depth (bids/asks) |
| `binance_us_recent_trades` | GET /api/v3/trades | None | Get recent trades list |
| `binance_us_historical_trades` | GET /api/v3/historicalTrades | API Key | Get older trades lookup |
| `binance_us_agg_trades` | GET /api/v3/aggTrades | None | Get compressed/aggregate trades |
| `binance_us_klines` | GET /api/v3/klines | None | Get candlestick/OHLCV data |
| `binance_us_avg_price` | GET /api/v3/avgPrice | None | Get current 5-min average price |
| `binance_us_ticker_24hr` | GET /api/v3/ticker/24hr | None | Get 24hr price change statistics |
| `binance_us_ticker_price` | GET /api/v3/ticker/price | None | Get latest price ticker |
| `binance_us_ticker_book` | GET /api/v3/ticker/bookTicker | None | Get best bid/ask price |
| `binance_us_rolling_window` | GET /api/v3/ticker | None | Get rolling window statistics |

### Parameters

**binance_us_order_book:**
- `symbol` (required): Trading pair (e.g., "BTCUSD")
- `limit` (optional): Depth limit (5, 10, 20, 50, 100, 500, 1000, 5000)

**binance_us_klines:**
- `symbol` (required): Trading pair
- `interval` (required): 1s, 1m, 3m, 5m, 15m, 30m, 1h, 2h, 4h, 6h, 8h, 12h, 1d, 3d, 1w, 1M
- `startTime`, `endTime` (optional): Time range in milliseconds
- `limit` (optional): Number of klines (default 500, max 1000)

---

## Trading Tools

All trading tools require API key with TRADE permission.

### Order Management

| Tool | Endpoint | Method | Description |
|------|----------|--------|-------------|
| `binance_us_new_order` | /api/v3/order | POST | Place new order |
| `binance_us_test_order` | /api/v3/order/test | POST | Test order (no execution) |
| `binance_us_get_order` | /api/v3/order | GET | Query order status |
| `binance_us_cancel_order` | /api/v3/order | DELETE | Cancel active order |
| `binance_us_cancel_replace` | /api/v3/order/cancelReplace | POST | Cancel and replace order atomically |
| `binance_us_cancel_all_open_orders` | /api/v3/openOrders | DELETE | Cancel all open orders for symbol |
| `binance_us_open_orders` | /api/v3/openOrders | GET | Get all open orders |
| `binance_us_all_orders` | /api/v3/allOrders | GET | Get all orders (history) |

### Order Types Supported

| Type | Description | Required Parameters |
|------|-------------|---------------------|
| LIMIT | Limit order | quantity, price, timeInForce |
| MARKET | Market order | quantity OR quoteOrderQty |
| STOP_LOSS | Stop loss market | quantity, stopPrice |
| STOP_LOSS_LIMIT | Stop loss limit | quantity, price, stopPrice, timeInForce |
| TAKE_PROFIT | Take profit market | quantity, stopPrice |
| TAKE_PROFIT_LIMIT | Take profit limit | quantity, price, stopPrice, timeInForce |
| LIMIT_MAKER | Post-only limit | quantity, price |

### Time In Force Options

| Value | Description |
|-------|-------------|
| GTC | Good Till Cancel - remains until filled or canceled |
| IOC | Immediate Or Cancel - fills immediately or cancels |
| FOK | Fill Or Kill - fills completely or cancels entirely |

### OCO Orders

One-Cancels-Other orders: when one order executes, the other is automatically canceled.

| Tool | Endpoint | Method | Description |
|------|----------|--------|-------------|
| `binance_us_new_oco` | /api/v3/order/oco | POST | Place OCO order pair |
| `binance_us_get_oco` | /api/v3/orderList | GET | Query OCO order status |
| `binance_us_cancel_oco` | /api/v3/orderList | DELETE | Cancel OCO order |
| `binance_us_open_oco` | /api/v3/openOrderList | GET | Get all open OCO orders |
| `binance_us_all_oco_orders` | /api/v3/allOrderList | GET | Get OCO order history |

---

## Wallet Tools

Wallet operations require API key with USER_DATA permission.

| Tool | Endpoint | Method | Description |
|------|----------|--------|-------------|
| `binance_us_asset_config` | GET /sapi/v1/capital/config/getall | GET | Get asset fees and network status |
| `binance_us_withdraw_crypto` | POST /sapi/v1/capital/withdraw/apply | POST | Withdraw cryptocurrency |
| `binance_us_withdraw_fiat` | POST /sapi/v1/fiatpayment/withdraw/apply | POST | Withdraw USD via BITGO |
| `binance_us_withdraw_history` | GET /sapi/v1/capital/withdraw/history | GET | Get withdrawal history |
| `binance_us_deposit_history` | GET /sapi/v1/capital/deposit/hisrec | GET | Get deposit history |
| `binance_us_deposit_address` | GET /sapi/v1/capital/deposit/address | GET | Get deposit address for asset |

### Withdrawal Parameters

**binance_us_withdraw_crypto:**
- `coin` (required): Asset symbol (e.g., "BTC", "ETH")
- `network` (required): Network (e.g., "ERC20", "BEP20", "BTC")
- `address` (required): Withdrawal address
- `amount` (required): Amount to withdraw
- `addressTag` (optional): Memo/tag for XRP, XMR, etc.

---

## Account Tools

Account information requires API key with USER_DATA permission.

| Tool | Endpoint | Description |
|------|----------|-------------|
| `binance_us_account_info` | GET /api/v3/account | Get account balances and permissions |
| `binance_us_my_trades` | GET /api/v3/myTrades | Get account trade history |
| `binance_us_rate_limits` | GET /api/v3/rateLimit/order | Get current rate limit usage |
| `binance_us_trade_fee` | GET /sapi/v1/asset/query/trading-fee | Get trading fee for symbol |
| `binance_us_trade_volume` | GET /sapi/v1/asset/query/trading-volume | Get 30-day trading volume |

---

## OTC Tools

Over-The-Counter trading for large block trades outside the order book.

| Tool | Endpoint | Method | Description |
|------|----------|--------|-------------|
| `binance_us_otc_coin_pairs` | GET /sapi/v1/otc/coinPairs | GET | Get supported OTC trading pairs |
| `binance_us_otc_quote` | POST /sapi/v1/otc/quotes | POST | Request quote for OTC trade |
| `binance_us_otc_place_order` | POST /sapi/v1/otc/orders | POST | Place OTC order with quote ID |
| `binance_us_otc_get_order` | GET /sapi/v1/otc/orders/{orderId} | GET | Get OTC order details |
| `binance_us_otc_all_orders` | GET /sapi/v1/otc/orders | GET | Query all OTC orders |
| `binance_us_ocbs_orders` | GET /sapi/v1/ocbs/orders | GET | Get OCBS (fiat) orders |

### OTC Quote Flow

1. Get available pairs: `binance_us_otc_coin_pairs`
2. Request quote: `binance_us_otc_quote` with fromCoin, toCoin, amount
3. Accept quote: `binance_us_otc_place_order` with quoteId (quotes expire in ~10 seconds)

---

## Staking Tools

Earn rewards by staking supported cryptocurrencies.

| Tool | Endpoint | Method | Description |
|------|----------|--------|-------------|
| `binance_us_staking_asset_info` | GET /sapi/v1/staking/asset | GET | Get staking APR/APY and limits |
| `binance_us_staking_stake` | POST /sapi/v1/staking/stake | POST | Stake an asset |
| `binance_us_staking_unstake` | POST /sapi/v1/staking/unstake | POST | Unstake an asset |
| `binance_us_staking_balance` | GET /sapi/v1/staking/stakingBalance | GET | Get current staking balance |
| `binance_us_staking_history` | GET /sapi/v1/staking/history | GET | Get staking transaction history |
| `binance_us_staking_rewards` | GET /sapi/v1/staking/stakingRewardsHistory | GET | Get staking rewards history |

### Important Notes

- Check `unstakingPeriod` before staking (often 7+ days)
- `minStakingLimit` and `maxStakingLimit` vary by asset
- `autoRestake` can automatically compound rewards

---

## Sub-Account Tools

Manage sub-accounts under a master account.

| Tool | Endpoint | Method | Description |
|------|----------|--------|-------------|
| `binance_us_subaccount_list` | GET /sapi/v3/sub-account/list | GET | List all sub-accounts |
| `binance_us_subaccount_transfer_history` | GET /sapi/v3/sub-account/transfer/history | GET | Get transfer history |
| `binance_us_subaccount_transfer` | POST /sapi/v3/sub-account/transfer | POST | Transfer between accounts |
| `binance_us_subaccount_assets` | GET /sapi/v3/sub-account/assets | GET | Get sub-account balances |
| `binance_us_subaccount_summary` | GET /sapi/v1/sub-account/spotSummary | GET | Get master account USD value |
| `binance_us_subaccount_status` | GET /sapi/v1/sub-account/status | GET | Get sub-account status list |

---

## User Data Stream Tools

Manage WebSocket listen keys for real-time account updates.

| Tool | Endpoint | Method | Description |
|------|----------|--------|-------------|
| `binance_us_create_listen_key` | POST /api/v3/userDataStream | POST | Create listen key for WebSocket |
| `binance_us_keepalive_listen_key` | PUT /api/v3/userDataStream | PUT | Extend listen key validity |
| `binance_us_close_listen_key` | DELETE /api/v3/userDataStream | DELETE | Close/invalidate listen key |
| `binance_us_websocket_info` | - | - | Get WebSocket connection info |

### WebSocket Connection Flow

1. Create listen key: `binance_us_create_listen_key`
2. Connect to: `wss://stream.binance.us:9443/ws/<listenKey>`
3. Keep-alive every 30 minutes: `binance_us_keepalive_listen_key`
4. Close when done: `binance_us_close_listen_key`

Listen keys expire after 60 minutes without keep-alive.

---

## Custodial Tools

⚠️ **Requires Custodial Solution API Key** - Regular API keys will NOT work.

For institutional users with custody partner agreements (e.g., Anchorage, Fireblocks).

| Tool | Description |
|------|-------------|
| `binance_us_cust_balance` | Get custodial account balance |
| `binance_us_cust_supported_assets` | Get supported custody assets |
| `binance_us_cust_wallet_transfer` | Transfer to/from exchange wallet |
| `binance_us_cust_transfer` | Transfer between custodial accounts |
| `binance_us_cust_undo_transfer` | Undo a pending transfer |
| `binance_us_cust_wallet_transfer_history` | Wallet transfer history |
| `binance_us_cust_transfer_history` | Custodial transfer history |
| `binance_us_cust_available_balance` | Get available trading balance |
| `binance_us_cust_new_order` | Place custodial order |
| `binance_us_cust_oco_order` | Place custodial OCO order |
| `binance_us_cust_open_orders` | Get open custodial orders |
| `binance_us_cust_get_order` | Get custodial order details |
| `binance_us_cust_order_history` | Get custodial order history |
| `binance_us_cust_trade_history` | Get custodial trade history |
| `binance_us_cust_cancel_order` | Cancel custodial order |
| `binance_us_cust_cancel_orders_symbol` | Cancel all orders for symbol |
| `binance_us_cust_cancel_oco` | Cancel custodial OCO order |
| `binance_us_cust_settlement_settings` | Get settlement configuration |
| `binance_us_cust_settlement_history` | Get settlement history |

### Rail Parameter

All custodial endpoints require a `rail` parameter identifying the custody partner:
- `"ANCHORAGE"` - Anchorage Digital
- `"FIREBLOCKS"` - Fireblocks
- Other partners as supported

---

## Custodial Solution Tools

⚠️ **Requires Custodial Solution API Key**

Additional tools for custodial transfer and settlement operations.

| Tool | Description |
|------|-------------|
| `binance_us_custodial_balance` | Get exchange wallet and custodial sub-account balances |
| `binance_us_custodial_supported_assets` | Get assets supported for custody |
| `binance_us_custodial_wallet_transfer` | Transfer between exchange wallet and custodial account |
| `binance_us_custodial_custodian_transfer` | Transfer between custodial accounts |
| `binance_us_custodial_undo_transfer` | Undo/cancel a pending transfer |
| `binance_us_custodial_wallet_transfer_history` | Get wallet transfer history |
| `binance_us_custodial_custodian_transfer_history` | Get custodian transfer history |
| `binance_us_custodial_settlement` | Initiate settlement to custody partner |
| `binance_us_custodial_settlement_history` | Get settlement history |

---

## Credit Line Tools

⚠️ **Requires Credit Line API Key and Institutional Agreement**

For institutional clients with credit line facilities. NOT available to retail users.

| Tool | Endpoint | Method | Description |
|------|----------|--------|-------------|
| `binance_us_cl_account` | GET /sapi/v2/cl/account | GET | Get credit line account info |
| `binance_us_cl_alert_history` | GET /sapi/v1/cl/alert/history | GET | Get margin call/liquidation alerts |
| `binance_us_cl_transfer_history` | GET /sapi/v1/cl/transferHistory | GET | Get transfer history |
| `binance_us_cl_transfer` | POST /sapi/v1/cl/transfer | POST | Execute credit line transfer |
| `binance_us_cl_liquidation_history` | GET /sapi/v1/cl/liquidation/history | GET | Get liquidation history |

### Key Metrics

- **currentLTV**: Current Loan-to-Value ratio
- **initialLTV**: Initial LTV threshold
- **marginCallLTV**: LTV that triggers margin call alerts
- **liquidationLTV**: LTV that triggers automatic liquidation
- **interestRate**: Annual interest rate on borrowed assets

### Risk Management

1. Monitor `currentLTV` regularly
2. Maintain collateral well below `marginCallLTV`
3. Use `binance_us_cl_transfer` with `TRANSFER_IN` to add collateral
4. Review `binance_us_cl_alert_history` for past risk events

---

## Error Codes Reference

| Code | Message |
|------|---------|
| -1000 | Unknown error |
| -1002 | Unauthorized - check API key |
| -1003 | Too many requests - rate limited |
| -1013 | Invalid quantity - check LOT_SIZE |
| -1021 | Timestamp outside recvWindow |
| -1022 | Invalid signature |
| -1121 | Invalid symbol |
| -2010 | New order rejected |
| -2011 | Cancel rejected |
| -2013 | Order does not exist |
| -2015 | Invalid API key/IP/permissions |
| -2018 | Insufficient balance |

---

## Rate Limits

| Type | Limit |
|------|-------|
| Request Weight | 1200 per minute |
| Orders | 10/second, 100,000/day |
| Raw Requests | 5000 per 5 minutes |

Weights vary by endpoint. Order book depth 5000 = weight 50, depth 100 = weight 1.

---

## Authentication

All signed endpoints require:
1. `X-MBX-APIKEY` header with your API key
2. `signature` parameter (HMAC SHA256 of query string)
3. `timestamp` parameter (current Unix time in milliseconds)
4. Optional `recvWindow` (max 60000ms)

The server handles signature generation automatically.
