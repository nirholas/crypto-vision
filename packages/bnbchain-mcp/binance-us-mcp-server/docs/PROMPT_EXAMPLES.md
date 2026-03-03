# Binance.US MCP Server - Prompt Examples for Claude

This document provides example prompts you can use with Claude to interact with the Binance.US MCP Server.

## Market Data Queries

### Get Current Prices
```
What's the current price of Bitcoin on Binance.US?
```

```
Show me the prices for BTC, ETH, and SOL on Binance.US.
```

```
Get the 24-hour price change for BTCUSD.
```

### Order Book Analysis
```
Show me the order book for BTCUSD with 20 levels of depth.
```

```
What's the current spread for ETHUSD on Binance.US?
```

### Historical Data
```
Get the last 100 trades for BTCUSD.
```

```
Show me hourly candlesticks for ETHUSD over the past 24 hours.
```

```
What's the trading volume for BTCUSD in the last 7 days?
```

---

## Trading Operations

### Placing Orders
```
Place a limit buy order for 0.01 BTC at $40,000 on Binance.US.
```

```
Execute a market sell of 0.5 ETH on Binance.US.
```

```
Place a stop-loss order to sell 0.1 BTC if the price drops to $38,000.
```

### Managing Orders
```
Show me all my open orders on Binance.US.
```

```
Cancel all my open orders for BTCUSD.
```

```
What's the status of my last BTC order?
```

### OCO Orders
```
Place an OCO order: sell 0.1 BTC at $45,000 (take profit) or $38,000 (stop loss).
```

```
Show me my open OCO orders on Binance.US.
```

---

## Account Management

### Balance Queries
```
Show me my Binance.US account balances.
```

```
What cryptocurrencies do I hold on Binance.US and how much of each?
```

```
What's my USD balance on Binance.US?
```

### Trading History
```
Show me my recent trades on Binance.US.
```

```
What's my trading volume for the past 30 days?
```

```
What are my trading fees for BTCUSD?
```

---

## Wallet Operations

### Deposits
```
What's my BTC deposit address on Binance.US?
```

```
Show me my deposit history for the last month.
```

```
Get my ETH deposit address on the Ethereum network.
```

### Withdrawals
```
Show me my withdrawal history.
```

```
What are the withdrawal fees for BTC on Binance.US?
```

⚠️ **Note:** For security reasons, always double-check withdrawal addresses before executing:
```
I want to withdraw 0.5 ETH to address 0x123... on the Ethereum network.
Please confirm the details before proceeding.
```

---

## Staking

### Staking Information
```
What staking options are available on Binance.US?
```

```
What's the APY for staking ETH on Binance.US?
```

```
Show me my current staking positions.
```

### Staking Operations
```
Stake 1 ETH on Binance.US.
```

```
Show me my staking rewards history.
```

```
What's the unstaking period for BNB?
```

---

## OTC Trading

### Getting Quotes
```
What OTC trading pairs are available on Binance.US?
```

```
Get a quote to convert 10,000 USD to BTC via OTC.
```

### Executing OTC Trades
```
I want to do an OTC trade: sell 5 BTC for USD. Get me a quote first.
```

---

## Sub-Account Management

### Viewing Sub-Accounts
```
List all my sub-accounts on Binance.US.
```

```
Show me the balances of my sub-accounts.
```

### Transfers
```
Transfer 0.1 BTC from my main account to sub-account user@example.com.
```

```
Show me the transfer history between my accounts.
```

---

## System & Connectivity

### Health Checks
```
Is the Binance.US API working?
```

```
What's the current server time on Binance.US?
```

```
Is Binance.US under maintenance?
```

### Exchange Information
```
What trading pairs are available on Binance.US?
```

```
What are the trading rules for BTCUSD? (min order size, price precision, etc.)
```

---

## Advanced Queries

### Rate Limits
```
What's my current API rate limit usage on Binance.US?
```

### WebSocket Setup
```
Create a listen key for real-time account updates from Binance.US.
```

### Combined Queries
```
Give me a market overview of BTC:
- Current price
- 24hr change
- Order book top 5 levels
- Recent large trades (>1 BTC)
```

```
Show me my complete Binance.US account status:
- All balances
- Open orders
- Recent trades
- Staking positions
```

---

## Custodial Operations (Institutional)

⚠️ These require Custodial Solution API keys

```
Show me my custodial account balance with Fireblocks.
```

```
Transfer 1 BTC from my exchange wallet to my custodial account.
```

```
What's my settlement history with Anchorage?
```

---

## Credit Line Operations (Institutional)

⚠️ These require Credit Line API keys and institutional agreement

```
Show me my credit line account status and current LTV.
```

```
What's my margin call history?
```

```
Transfer 10,000 USD into my credit line as collateral.
```

---

## Tips for Better Prompts

### Be Specific
❌ "Buy some Bitcoin"
✅ "Place a limit buy order for 0.01 BTC at $40,000 on Binance.US"

### Include Context
❌ "What's the price?"
✅ "What's the current BTC price on Binance.US?"

### Confirm Before Executing
For any operation that moves money:
✅ "I want to withdraw 1 ETH to 0x123... Please confirm the details first."

### Use Exact Values
❌ "Buy a small amount of ETH"
✅ "Buy 0.1 ETH at market price"

---

## Safety Reminders

1. **Always verify** withdrawal addresses before confirming
2. **Start small** when testing trading strategies
3. **Use test orders** (`binance_us_test_order`) to validate order parameters
4. **Check balances** before placing orders
5. **Monitor open orders** regularly
6. **Be aware** of trading fees and withdrawal fees
