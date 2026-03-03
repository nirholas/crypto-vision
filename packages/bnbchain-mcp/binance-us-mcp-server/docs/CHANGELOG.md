# Binance.US MCP Server - Changelog

All notable changes to the Binance.US MCP Server.

## [1.0.0] - 2026-01-20

### Added

#### Core Infrastructure
- MCP server setup with @modelcontextprotocol/sdk v1.11.0
- HMAC SHA256 signature generation for authenticated endpoints
- Configurable base URL and WebSocket URL
- Environment variable support for API keys
- Rate limit and IP ban error handling

#### General Tools (4 tools)
- `binance_us_ping` - Test API connectivity
- `binance_us_server_time` - Get server time
- `binance_us_system_status` - Check maintenance status
- `binance_us_exchange_info` - Get exchange trading rules

#### Market Data Tools (10 tools)
- `binance_us_order_book` - Order book depth with configurable limits
- `binance_us_recent_trades` - Recent trades list
- `binance_us_historical_trades` - Historical trades lookup
- `binance_us_agg_trades` - Aggregate/compressed trades
- `binance_us_klines` - Candlestick/OHLCV data with all intervals
- `binance_us_avg_price` - 5-minute rolling average price
- `binance_us_ticker_24hr` - 24-hour statistics
- `binance_us_ticker_price` - Latest price ticker
- `binance_us_ticker_book` - Best bid/ask prices
- `binance_us_rolling_window` - Custom rolling window statistics

#### Trading Tools - Orders (8 tools)
- `binance_us_new_order` - Place orders (LIMIT, MARKET, STOP_LOSS, etc.)
- `binance_us_test_order` - Test order validation without execution
- `binance_us_get_order` - Query order status
- `binance_us_cancel_order` - Cancel active order
- `binance_us_cancel_replace` - Atomic cancel and replace
- `binance_us_cancel_all_open_orders` - Cancel all orders for symbol
- `binance_us_open_orders` - List open orders
- `binance_us_all_orders` - Order history

#### Trading Tools - OCO (5 tools)
- `binance_us_new_oco` - Place One-Cancels-Other orders
- `binance_us_get_oco` - Query OCO status
- `binance_us_cancel_oco` - Cancel OCO order
- `binance_us_open_oco` - List open OCOs
- `binance_us_all_oco_orders` - OCO order history

#### Wallet Tools (6 tools)
- `binance_us_asset_config` - Asset fees and network configurations
- `binance_us_withdraw_crypto` - Cryptocurrency withdrawals
- `binance_us_withdraw_fiat` - USD withdrawals via BITGO
- `binance_us_withdraw_history` - Withdrawal history
- `binance_us_deposit_history` - Deposit history
- `binance_us_deposit_address` - Get deposit addresses

#### Account Tools (5 tools)
- `binance_us_account_info` - Account balances and permissions
- `binance_us_my_trades` - Personal trade history
- `binance_us_rate_limits` - Rate limit usage
- `binance_us_trade_fee` - Trading fees per symbol
- `binance_us_trade_volume` - 30-day trading volume

#### OTC Tools (6 tools)
- `binance_us_otc_coin_pairs` - Supported OTC pairs
- `binance_us_otc_quote` - Request OTC quote
- `binance_us_otc_place_order` - Execute OTC trade
- `binance_us_otc_get_order` - OTC order details
- `binance_us_otc_all_orders` - OTC order history
- `binance_us_ocbs_orders` - OCBS fiat orders

#### Staking Tools (6 tools)
- `binance_us_staking_asset_info` - Staking APR/APY information
- `binance_us_staking_stake` - Stake assets
- `binance_us_staking_unstake` - Unstake assets
- `binance_us_staking_balance` - Current staking balance
- `binance_us_staking_history` - Staking transaction history
- `binance_us_staking_rewards` - Staking rewards history

#### Sub-Account Tools (6 tools)
- `binance_us_subaccount_list` - List sub-accounts
- `binance_us_subaccount_transfer_history` - Transfer history
- `binance_us_subaccount_transfer` - Transfer between accounts
- `binance_us_subaccount_assets` - Sub-account balances
- `binance_us_subaccount_summary` - Master account USD value
- `binance_us_subaccount_status` - Sub-account status list

#### User Data Stream Tools (4 tools)
- `binance_us_create_listen_key` - Create WebSocket listen key
- `binance_us_keepalive_listen_key` - Extend listen key validity
- `binance_us_close_listen_key` - Close/invalidate listen key
- `binance_us_websocket_info` - WebSocket connection information

#### Custodial Tools (19 tools)
For institutional users with custody partner agreements:
- `binance_us_cust_balance` - Custodial account balance
- `binance_us_cust_supported_assets` - Supported custody assets
- `binance_us_cust_wallet_transfer` - Transfer to/from exchange wallet
- `binance_us_cust_transfer` - Transfer between custodial accounts
- `binance_us_cust_undo_transfer` - Undo pending transfer
- `binance_us_cust_wallet_transfer_history` - Wallet transfer history
- `binance_us_cust_transfer_history` - Custodial transfer history
- `binance_us_cust_available_balance` - Available trading balance
- `binance_us_cust_new_order` - Place custodial order
- `binance_us_cust_oco_order` - Place custodial OCO
- `binance_us_cust_open_orders` - Open custodial orders
- `binance_us_cust_get_order` - Get custodial order details
- `binance_us_cust_order_history` - Custodial order history
- `binance_us_cust_trade_history` - Custodial trade history
- `binance_us_cust_cancel_order` - Cancel custodial order
- `binance_us_cust_cancel_orders_symbol` - Cancel all for symbol
- `binance_us_cust_cancel_oco` - Cancel custodial OCO
- `binance_us_cust_settlement_settings` - Settlement configuration
- `binance_us_cust_settlement_history` - Settlement history

#### Custodial Solution Tools (9 tools)
Additional custodial transfer and settlement operations:
- `binance_us_custodial_balance` - Combined exchange/custodial balances
- `binance_us_custodial_supported_assets` - Supported assets
- `binance_us_custodial_wallet_transfer` - Wallet transfer
- `binance_us_custodial_custodian_transfer` - Custodian transfer
- `binance_us_custodial_undo_transfer` - Undo transfer
- `binance_us_custodial_wallet_transfer_history` - History
- `binance_us_custodial_custodian_transfer_history` - History
- `binance_us_custodial_settlement` - Initiate settlement
- `binance_us_custodial_settlement_history` - Settlement history

#### Credit Line Tools (5 tools)
For institutional clients with credit line agreements:
- `binance_us_cl_account` - Credit line account information with LTV
- `binance_us_cl_alert_history` - Margin call and liquidation alerts
- `binance_us_cl_transfer_history` - Transfer history
- `binance_us_cl_transfer` - Execute credit line transfer
- `binance_us_cl_liquidation_history` - Liquidation event history

### Documentation
- Complete tool reference (docs/TOOLS_REFERENCE.md)
- Quick reference card (docs/QUICK_REFERENCE.md)
- Claude prompt examples (docs/PROMPT_EXAMPLES.md)
- Changelog (docs/CHANGELOG.md)

### Technical Details
- TypeScript ES2022 with NodeNext modules
- Zod schema validation for all tool parameters
- Comprehensive error handling with Binance error code mapping
- Support for all 7 order types and 3 time-in-force options
- Self-trade prevention mode support
- Kline intervals from 1s to 1M
- Order book depth up to 5000 levels

---

## API Compatibility

| Binance.US API Version | Server Support |
|------------------------|----------------|
| v3 (spot) | ✅ Full |
| sapi v1 | ✅ Full |
| sapi v2 | ✅ Credit Line |
| sapi v3 | ✅ Sub-accounts |

## Dependencies

| Package | Version |
|---------|---------|
| @modelcontextprotocol/sdk | ^1.11.0 |
| dotenv | ^16.5.0 |
| zod | ^3.22.4 |
| typescript | ^5.0.0 |
| tsx | ^4.7.0 |
