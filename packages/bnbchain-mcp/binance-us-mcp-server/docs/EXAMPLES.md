# Usage Examples

Common workflows and usage patterns for the Binance.US MCP Server.

---

## Market Data (No Authentication Required)

### Get Current Price

```
Get the current price of Bitcoin on Binance.US

→ Use binance_us_ticker_price with symbol "BTCUSD"
```

### Get Multiple Prices

```
Get prices for BTC, ETH, and SOL

→ Use binance_us_ticker_price with symbols ["BTCUSD", "ETHUSD", "SOLUSD"]
```

### Get Order Book

```
Show me the order book depth for BTCUSD with 20 levels

→ Use binance_us_order_book with symbol "BTCUSD" and limit 20
```

### Get Historical Candles

```
Get hourly candles for ETH for the last 24 hours

→ Use binance_us_klines with symbol "ETHUSD", interval "1h", limit 24
```

### Get 24hr Statistics

```
What's the 24-hour trading volume and price change for BTCUSD?

→ Use binance_us_ticker_24hr with symbol "BTCUSD"
```

---

## Account Information

### Check Account Balance

```
Show my account balances

→ Use binance_us_account_info
```

**Response includes:**
- All asset balances (free and locked)
- Trading permissions
- Commission rates

### Check Trading Fees

```
What are my trading fees?

→ Use binance_us_trade_fee
```

### Get Trade History

```
Show my recent BTC trades

→ Use binance_us_my_trades with symbol "BTCUSD"
```

---

## Placing Orders

### Market Buy

```
Buy $100 worth of Bitcoin at market price

→ Use binance_us_new_order with:
  - symbol: "BTCUSD"
  - side: "BUY"
  - type: "MARKET"
  - quoteOrderQty: 100
```

### Limit Buy

```
Place a limit order to buy 0.01 BTC at $40,000

→ Use binance_us_new_order with:
  - symbol: "BTCUSD"
  - side: "BUY"
  - type: "LIMIT"
  - timeInForce: "GTC"
  - quantity: 0.01
  - price: 40000
```

### Limit Sell

```
Sell 0.5 ETH at $2,500

→ Use binance_us_new_order with:
  - symbol: "ETHUSD"
  - side: "SELL"
  - type: "LIMIT"
  - timeInForce: "GTC"
  - quantity: 0.5
  - price: 2500
```

### Test Order First

```
Test if my order parameters are valid without executing

→ Use binance_us_test_order with same parameters
```

---

## Managing Orders

### Check Order Status

```
What's the status of my order 12345?

→ Use binance_us_get_order with symbol "BTCUSD" and orderId 12345
```

### View Open Orders

```
Show all my open orders

→ Use binance_us_open_orders
```

### Cancel Order

```
Cancel order 12345 for BTCUSD

→ Use binance_us_cancel_order with symbol "BTCUSD" and orderId 12345
```

### Cancel and Replace

```
Update my limit order to a new price

→ Use binance_us_cancel_replace with the old order ID and new parameters
```

---

## OCO Orders

### Place OCO (Stop-Loss + Take-Profit)

```
Place an OCO order to sell 0.1 ETH:
- Take profit at $3,000
- Stop loss at $2,200

→ Use binance_us_new_oco with:
  - symbol: "ETHUSD"
  - side: "SELL"
  - quantity: 0.1
  - price: 3000 (limit/take-profit)
  - stopPrice: 2200 (trigger)
  - stopLimitPrice: 2190 (stop limit price)
```

---

## Staking

### View Staking Options

```
What assets can I stake and what are the APY rates?

→ Use binance_us_staking_asset_info
```

### Stake an Asset

```
Stake 10 BNB

→ Use binance_us_staking_stake with stakingAsset "BNB" and amount 10
```

### Check Staking Status

```
Show my staking history

→ Use binance_us_staking_history
```

---

## Wallet Operations

### Get Deposit Address

```
Get my BTC deposit address

→ Use binance_us_deposit_address with coin "BTC"
```

### Check Deposit History

```
Show my recent deposits

→ Use binance_us_deposit_history
```

### Withdraw Crypto

```
Withdraw 0.5 ETH to my external wallet

→ Use binance_us_withdraw_crypto with:
  - coin: "ETH"
  - network: "ETH" (or "ERC20")
  - address: "0x..."
  - amount: 0.5
```

⚠️ **Warning**: Always double-check the address before withdrawing!

---

## OTC Trading

### Check OTC Pairs

```
What pairs are available for OTC trading?

→ Use binance_us_otc_coin_pairs
```

### Get OTC Quote

```
Get a quote to convert 1 BTC to USDT via OTC

→ Use binance_us_otc_quote with:
  - fromCoin: "BTC"
  - toCoin: "USDT"
  - requestCoin: "BTC"
  - requestAmount: 1
```

---

## Sub-Accounts

### List Sub-Accounts

```
Show all my sub-accounts

→ Use binance_us_subaccount_list
```

### Transfer Between Accounts

```
Transfer 100 USDT to my sub-account

→ Use binance_us_subaccount_transfer with:
  - fromEmail: "main@example.com"
  - toEmail: "sub@example.com"
  - asset: "USDT"
  - amount: 100
```

---

## Real-Time Data (WebSocket)

### Set Up User Data Stream

```
I want to receive real-time updates for my orders

→ Step 1: Use binance_us_create_listen_key
→ Step 2: Connect to WebSocket: wss://stream.binance.us:9443/ws/<listenKey>
→ Step 3: Every 30 min: Use binance_us_keepalive_listen_key
→ Step 4: When done: Use binance_us_close_listen_key
```

### Get WebSocket Info

```
What WebSocket streams are available?

→ Use binance_us_websocket_info
```

---

## System Information

### Check API Status

```
Is the Binance.US API working?

→ Use binance_us_ping
```

### Get Server Time

```
What's the current server time?

→ Use binance_us_server_time
```

### Check System Status

```
Is Binance.US under maintenance?

→ Use binance_us_system_status
```

### Get Exchange Info

```
What trading rules apply to BTCUSD?

→ Use binance_us_exchange_info with symbol "BTCUSD"
```

---

## Error Handling Examples

### Rate Limit

```
Error: "Too many requests"

→ Wait and retry. Check X-MBX-USED-WEIGHT header.
```

### Invalid Symbol

```
Error: "Invalid symbol" (-1121)

→ Use binance_us_exchange_info to see valid symbols.
```

### Insufficient Balance

```
Error: "Account has insufficient balance"

→ Check balance with binance_us_account_info
```

### Timestamp Error

```
Error: "Timestamp outside recvWindow" (-1021)

→ Sync your system clock or increase recvWindow
```

---

## Complete Workflow: Dollar-Cost Averaging

```
Set up a weekly BTC purchase:

1. Check current price:
   → binance_us_ticker_price symbol="BTCUSD"

2. Calculate quantity for $100:
   → quantity = 100 / price

3. Test the order:
   → binance_us_test_order 
     symbol="BTCUSD" side="BUY" type="MARKET" quoteOrderQty=100

4. Execute if test passes:
   → binance_us_new_order 
     symbol="BTCUSD" side="BUY" type="MARKET" quoteOrderQty=100

5. Verify execution:
   → binance_us_my_trades symbol="BTCUSD" limit=1
```

---

## Complete Workflow: Grid Trading

```
Set up a grid of limit orders:

1. Get current price:
   → binance_us_ticker_price symbol="ETHUSD"

2. Place buy orders below current price:
   → binance_us_new_order type="LIMIT" side="BUY" price=2400 quantity=0.1
   → binance_us_new_order type="LIMIT" side="BUY" price=2350 quantity=0.1
   → binance_us_new_order type="LIMIT" side="BUY" price=2300 quantity=0.1

3. Place sell orders above current price:
   → binance_us_new_order type="LIMIT" side="SELL" price=2600 quantity=0.1
   → binance_us_new_order type="LIMIT" side="SELL" price=2650 quantity=0.1
   → binance_us_new_order type="LIMIT" side="SELL" price=2700 quantity=0.1

4. Monitor with:
   → binance_us_open_orders

5. Cancel all if needed:
   → binance_us_cancel_order for each order
```
