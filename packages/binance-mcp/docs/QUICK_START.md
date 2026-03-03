# Binance MCP Quick Start Guide

Get started with the Binance MCP Server in minutes.

---

## 🚀 Installation

```bash
# Clone the repository
git clone https://github.com/nirholas/Binance-MCP.git
cd Binance-MCP

# Install dependencies
npm install

# Build the project
npm run build
```

---

## 🔑 Configuration

### Option 1: Environment Variables

Create a `.env` file:

```env
BINANCE_API_KEY=your_api_key_here
BINANCE_API_SECRET=your_api_secret_here
```

### Option 2: Claude Desktop Config

Add directly to your Claude Desktop configuration:

```json
{
  "mcpServers": {
    "binance": {
      "command": "npx",
      "args": ["ts-node", "/path/to/Binance-MCP/src/index.ts"],
      "env": {
        "BINANCE_API_KEY": "your_api_key",
        "BINANCE_API_SECRET": "your_api_secret"
      }
    }
  }
}
```

---

## ▶️ Running the Server

### For Claude Desktop / Cursor (STDIO)

```bash
npm run start
```

### For ChatGPT / Web Apps (SSE)

```bash
npm run start:sse
```

---

## 💬 Example Conversations

### Getting Market Data

```
You: "What's the current Bitcoin price?"
AI: Uses BinanceTickerPrice → "Bitcoin is currently trading at $67,432.50"

You: "Show me the ETH/USDT order book"
AI: Uses BinanceOrderBook → Shows top bids and asks

You: "Get 4-hour candles for SOLUSDT"
AI: Uses BinanceKlines → Returns candlestick data
```

### Account Management

```
You: "Show my account balances"
AI: Uses BinanceAccountInfo → Lists all your assets

You: "What's my total portfolio value?"
AI: Queries balances and prices → Calculates total value

You: "Show my recent trades"
AI: Uses BinanceMyTrades → Lists your trade history
```

### Trading

```
You: "Buy 0.01 BTC at market price"
AI: Uses BinanceSpotNewOrder → Places market buy order

You: "Place a limit buy for 0.5 ETH at $2,000"
AI: Uses BinanceSpotNewOrder → Places limit order

You: "Cancel all my open orders"
AI: Uses BinanceSpotCancelAllOrders → Cancels pending orders
```

### Futures Trading

```
You: "Show my futures positions"
AI: Uses BinanceFuturesPositionRisk → Shows open positions

You: "Open a 10x long on BTC with 0.01 BTC"
AI: Sets leverage, places order → Opens leveraged position

You: "What's the funding rate for ETHUSDT?"
AI: Uses BinanceFuturesFundingRate → Shows current rate
```

### Staking & Earn

```
You: "Stake 1 ETH"
AI: Uses BinanceStakeEth → Stakes your ETH

You: "Show my Simple Earn products"
AI: Uses BinanceFlexiblePosition → Shows earn positions

You: "Subscribe 500 USDT to flexible savings"
AI: Uses BinanceSubscribeFlexible → Subscribes to product
```

### Wallet Operations

```
You: "Get my BTC deposit address"
AI: Uses BinanceDepositAddress → Returns deposit address

You: "Transfer 100 USDT to futures"
AI: Uses BinanceUniversalTransfer → Transfers funds

You: "Convert my dust to BNB"
AI: Uses BinanceDustTransfer → Converts small balances
```

---

## 📋 Common Prompts by Category

### 📊 Market Data
- "What's the price of [COIN]?"
- "Show me the [SYMBOL] order book"
- "Get [TIMEFRAME] candles for [SYMBOL]"
- "What's the 24h volume for [SYMBOL]?"
- "Show trending pairs by volume"

### 💰 Account
- "Show my balances"
- "What's my trading fee rate?"
- "Show my trade history for [SYMBOL]"
- "Check my API permissions"

### 🔄 Spot Trading
- "Buy [AMOUNT] [COIN] at market"
- "Sell [AMOUNT] [COIN] at [PRICE]"
- "Show my open orders"
- "Cancel order [ID]"
- "Cancel all [SYMBOL] orders"

### 📈 Margin Trading
- "Show my margin account"
- "Borrow [AMOUNT] [COIN] on margin"
- "Repay my [COIN] margin loan"
- "What's my margin level?"
- "How much can I borrow?"

### ⚡ Futures Trading
- "Show my futures positions"
- "Set [SYMBOL] leverage to [X]x"
- "Long [AMOUNT] [SYMBOL] with [X]x leverage"
- "Short [AMOUNT] [SYMBOL]"
- "Close my [SYMBOL] position"
- "What's the funding rate?"

### 🎯 Options
- "Show available [COIN] options"
- "Buy a [COIN] call option"
- "Show my options positions"

### 🏦 Staking
- "Stake [AMOUNT] ETH"
- "Show my staking rewards"
- "Unstake [AMOUNT] SOL"

### 💎 Simple Earn
- "What earn products are available?"
- "Subscribe to [COIN] flexible savings"
- "Show my earn positions"
- "Redeem from [PRODUCT]"

### 🔄 Auto-Invest
- "Create a daily BTC DCA plan"
- "Show my auto-invest plans"
- "Pause my [COIN] auto-invest"

### 💱 Convert
- "Convert [AMOUNT] [FROM] to [TO]"
- "Get a quote for conversion"
- "Show conversion history"

### 💼 Wallet
- "Get my [COIN] deposit address"
- "Show deposit history"
- "Withdraw [AMOUNT] [COIN] to [ADDRESS]"
- "Transfer to futures/margin/earn"

---

## ⚠️ Important Notes

### API Key Permissions

Make sure your API key has the appropriate permissions:
- **Read** - For market data and account info
- **Spot Trading** - For spot orders
- **Margin Trading** - For margin operations
- **Futures** - For futures trading
- **Withdrawals** - For withdrawing funds (use carefully!)

### Rate Limits

Binance has rate limits. The MCP server handles most cases, but avoid:
- Rapid consecutive requests
- Querying all symbols repeatedly
- Placing many orders in quick succession

### Testnet

For testing, you can use Binance Testnet:
```env
BINANCE_API_KEY=your_testnet_key
BINANCE_API_SECRET=your_testnet_secret
BINANCE_TESTNET=true
```

---

## 🔗 More Resources

- [Full Tools Reference](./TOOLS_REFERENCE.md) - Complete list of all 478+ tools
- [Binance API Docs](https://developers.binance.com/docs/binance-spot-api-docs)
- [MCP Protocol Docs](https://modelcontextprotocol.io)

---

## 🆘 Troubleshooting

### "Invalid API Key"
- Check your API key is correct
- Ensure API key has required permissions
- Verify you're using the correct environment (mainnet vs testnet)

### "Insufficient Balance"
- Check your available balance with "Show my balances"
- Ensure funds are in the correct wallet (spot vs futures vs margin)

### "Order Failed"
- Verify the symbol exists and is tradeable
- Check minimum order size requirements
- Ensure price is within valid range for limit orders

### "Rate Limit Exceeded"
- Wait a moment before retrying
- Reduce request frequency
- Use batch operations where available
