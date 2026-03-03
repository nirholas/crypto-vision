# Binance.US MCP Server - API Quick Reference

A concise reference card for all Binance.US MCP Server tools.

## Quick Tool Lookup

### 🔧 General (4 tools)
```
binance_us_ping                  - Test connectivity
binance_us_server_time           - Get server time
binance_us_system_status         - System maintenance check [AUTH]
binance_us_exchange_info         - Trading rules & pairs
```

### 📊 Market Data (10 tools)
```
binance_us_order_book            - Order book depth
binance_us_recent_trades         - Recent trades
binance_us_historical_trades     - Old trades [API_KEY]
binance_us_agg_trades            - Aggregate trades
binance_us_klines                - Candlestick data
binance_us_avg_price             - 5-min average price
binance_us_ticker_24hr           - 24hr statistics
binance_us_ticker_price          - Latest price
binance_us_ticker_book           - Best bid/ask
binance_us_rolling_window        - Rolling window stats
```

### 📈 Trading - Orders (8 tools)
```
binance_us_new_order             - Place order [TRADE]
binance_us_test_order            - Test order [TRADE]
binance_us_get_order             - Query order [USER_DATA]
binance_us_cancel_order          - Cancel order [TRADE]
binance_us_cancel_replace        - Cancel & replace [TRADE]
binance_us_cancel_all_open_orders - Cancel all [TRADE]
binance_us_open_orders           - Open orders [USER_DATA]
binance_us_all_orders            - Order history [USER_DATA]
```

### 📈 Trading - OCO (5 tools)
```
binance_us_new_oco               - Place OCO [TRADE]
binance_us_get_oco               - Query OCO [USER_DATA]
binance_us_cancel_oco            - Cancel OCO [TRADE]
binance_us_open_oco              - Open OCOs [USER_DATA]
binance_us_all_oco_orders        - OCO history [USER_DATA]
```

### 💰 Wallet (6 tools)
```
binance_us_asset_config          - Asset fees & networks [USER_DATA]
binance_us_withdraw_crypto       - Withdraw crypto [WITHDRAW]
binance_us_withdraw_fiat         - Withdraw USD [WITHDRAW]
binance_us_withdraw_history      - Withdrawal history [USER_DATA]
binance_us_deposit_history       - Deposit history [USER_DATA]
binance_us_deposit_address       - Get deposit address [USER_DATA]
```

### 👤 Account (5 tools)
```
binance_us_account_info          - Balances & permissions [USER_DATA]
binance_us_my_trades             - Trade history [USER_DATA]
binance_us_rate_limits           - Rate limit usage [USER_DATA]
binance_us_trade_fee             - Trading fee [USER_DATA]
binance_us_trade_volume          - 30-day volume [USER_DATA]
```

### 🏦 OTC (6 tools)
```
binance_us_otc_coin_pairs        - OTC trading pairs [USER_DATA]
binance_us_otc_quote             - Request OTC quote [USER_DATA]
binance_us_otc_place_order       - Execute OTC trade [USER_DATA]
binance_us_otc_get_order         - OTC order details [USER_DATA]
binance_us_otc_all_orders        - OTC order history [USER_DATA]
binance_us_ocbs_orders           - OCBS fiat orders [USER_DATA]
```

### 🥩 Staking (6 tools)
```
binance_us_staking_asset_info    - APR/APY info [USER_DATA]
binance_us_staking_stake         - Stake asset [USER_DATA]
binance_us_staking_unstake       - Unstake asset [USER_DATA]
binance_us_staking_balance       - Staking balance [USER_DATA]
binance_us_staking_history       - Staking transactions [USER_DATA]
binance_us_staking_rewards       - Rewards history [USER_DATA]
```

### 👥 Sub-Account (6 tools)
```
binance_us_subaccount_list       - List sub-accounts [USER_DATA]
binance_us_subaccount_transfer_history - Transfer history [USER_DATA]
binance_us_subaccount_transfer   - Transfer funds [USER_DATA]
binance_us_subaccount_assets     - Sub-account balances [USER_DATA]
binance_us_subaccount_summary    - Master account value [USER_DATA]
binance_us_subaccount_status     - Sub-account status [USER_DATA]
```

### 🔌 User Data Stream (4 tools)
```
binance_us_create_listen_key     - Create WebSocket key [API_KEY]
binance_us_keepalive_listen_key  - Extend key validity [API_KEY]
binance_us_close_listen_key      - Close stream [API_KEY]
binance_us_websocket_info        - WebSocket info
```

### 🏛️ Custodial (19 tools) ⚠️ Special API Key
```
binance_us_cust_balance          - Custodial balance
binance_us_cust_supported_assets - Supported assets
binance_us_cust_wallet_transfer  - Wallet transfer
binance_us_cust_transfer         - Custodial transfer
binance_us_cust_undo_transfer    - Undo transfer
binance_us_cust_wallet_transfer_history - Wallet history
binance_us_cust_transfer_history - Transfer history
binance_us_cust_available_balance - Available balance
binance_us_cust_new_order        - Place order
binance_us_cust_oco_order        - Place OCO
binance_us_cust_open_orders      - Open orders
binance_us_cust_get_order        - Get order
binance_us_cust_order_history    - Order history
binance_us_cust_trade_history    - Trade history
binance_us_cust_cancel_order     - Cancel order
binance_us_cust_cancel_orders_symbol - Cancel all
binance_us_cust_cancel_oco       - Cancel OCO
binance_us_cust_settlement_settings - Settlement config
binance_us_cust_settlement_history - Settlement history
```

### 🏛️ Custodial Solution (9 tools) ⚠️ Special API Key
```
binance_us_custodial_balance     - Combined balances
binance_us_custodial_supported_assets - Supported assets
binance_us_custodial_wallet_transfer - Wallet transfer
binance_us_custodial_custodian_transfer - Custodian transfer
binance_us_custodial_undo_transfer - Undo transfer
binance_us_custodial_wallet_transfer_history - History
binance_us_custodial_custodian_transfer_history - History
binance_us_custodial_settlement  - Initiate settlement
binance_us_custodial_settlement_history - Settlement history
```

### 💳 Credit Line (5 tools) ⚠️ Institutional Only
```
binance_us_cl_account            - Credit line account info
binance_us_cl_alert_history      - Margin call alerts
binance_us_cl_transfer_history   - Transfer history
binance_us_cl_transfer           - Execute transfer
binance_us_cl_liquidation_history - Liquidation events
```

---

## Common Parameters

### Symbol Format
- Always uppercase: `BTCUSD`, `ETHUSD`, `BNBUSD`
- Quote asset is usually USD: `BTCUSD` not `BTCUSDT`

### Time Format
- All timestamps in milliseconds (Unix epoch × 1000)
- Example: `1642345678000`

### Order Types
| Type | Description |
|------|-------------|
| `LIMIT` | Limit order (price + quantity) |
| `MARKET` | Market order (quantity or quoteOrderQty) |
| `STOP_LOSS` | Stop market |
| `STOP_LOSS_LIMIT` | Stop limit |
| `TAKE_PROFIT` | Take profit market |
| `TAKE_PROFIT_LIMIT` | Take profit limit |
| `LIMIT_MAKER` | Post-only limit |

### Time In Force
| Value | Meaning |
|-------|---------|
| `GTC` | Good Till Cancel |
| `IOC` | Immediate Or Cancel |
| `FOK` | Fill Or Kill |

### Order Sides
- `BUY` - Buy order
- `SELL` - Sell order

---

## Rate Limits Quick Reference

| Limit Type | Value |
|------------|-------|
| Request Weight | 1200/minute |
| Orders | 10/second |
| Orders | 100,000/day |
| Raw Requests | 5000/5 minutes |

---

## Common Error Codes

| Code | Meaning |
|------|---------|
| -1002 | Unauthorized |
| -1003 | Rate limited |
| -1013 | Invalid quantity |
| -1021 | Invalid timestamp |
| -1022 | Invalid signature |
| -1121 | Invalid symbol |
| -2010 | Order rejected |
| -2018 | Insufficient balance |

---

## Environment Variables

```bash
BINANCE_US_API_KEY=your_api_key
BINANCE_US_API_SECRET=your_api_secret
```

---

## Total: 93 Tools

| Category | Count |
|----------|-------|
| General | 4 |
| Market Data | 10 |
| Trading (Orders) | 8 |
| Trading (OCO) | 5 |
| Wallet | 6 |
| Account | 5 |
| OTC | 6 |
| Staking | 6 |
| Sub-Account | 6 |
| User Data Stream | 4 |
| Custodial | 19 |
| Custodial Solution | 9 |
| Credit Line | 5 |
| **Total** | **93** |
