# Binance MCP Tools Reference

A complete guide to all 478+ tools with descriptions and example prompts.

---

## Table of Contents

- [Spot Trading](#spot-trading)
- [Margin Trading](#margin-trading)
- [Futures (USD-M)](#futures-usd-m)
- [Options](#options)
- [Portfolio Margin](#portfolio-margin)
- [Wallet](#wallet)
- [Sub-Account](#sub-account)
- [Staking](#staking)
- [Simple Earn](#simple-earn)
- [Auto-Invest](#auto-invest)
- [Convert](#convert)
- [Mining](#mining)
- [Algo Trading](#algo-trading)
- [VIP Loan](#vip-loan)
- [Crypto Loans](#crypto-loans)
- [NFT](#nft)
- [Pay](#pay)
- [Gift Card](#gift-card)
- [Copy Trading](#copy-trading)
- [Dual Investment](#dual-investment)
- [C2C/P2P](#c2cp2p)
- [Fiat](#fiat)
- [Rebate](#rebate)

---

## Spot Trading

### Market Data

| Tool | Description | Example Prompt |
|------|-------------|----------------|
| `BinanceTickerPrice` | Get latest price for a symbol or all symbols | "What's the current price of BTC?" |
| `BinanceOrderBook` | Get order book depth for a trading pair | "Show me the order book for ETHUSDT with 100 levels" |
| `BinanceKlines` | Get candlestick/kline data | "Get the 1-hour candles for BTC/USDT for the last 24 hours" |
| `BinanceTicker24hr` | Get 24-hour rolling statistics | "What's the 24h change for BTCUSDT?" |
| `BinanceExchangeInfo` | Get trading rules and symbol info | "What are the trading rules for BTCUSDT?" |
| `BinanceTrades` | Get recent trades | "Show me the last 50 trades for ETHUSDT" |
| `BinanceHistoricalTrades` | Get older trades | "Get historical trades for BTCUSDT" |
| `BinanceAggTrades` | Get compressed/aggregate trades | "Get aggregate trades for SOLUSDT" |
| `BinanceAvgPrice` | Get current average price | "What's the average price of BNB?" |
| `BinanceBookTicker` | Get best bid/ask prices | "What's the best bid and ask for BTCUSDT?" |

**Example Prompts:**
```
"What's the current Bitcoin price?"
"Show me the ETHUSDT order book"
"Get 4-hour candles for SOLUSDT for the past week"
"What's the 24-hour volume for BTCUSDT?"
```

### Account Information

| Tool | Description | Example Prompt |
|------|-------------|----------------|
| `BinanceAccountInfo` | Get account balances and status | "Show my Binance account balances" |
| `BinanceMyTrades` | Get your trade history | "Show my trade history for BTCUSDT" |
| `BinanceAccountCommission` | Get trading fee rates | "What are my trading fees?" |
| `BinanceRateLimitOrder` | Check order rate limits | "What are my current rate limits?" |

**Example Prompts:**
```
"What's my account balance?"
"Show my trading history for the last month"
"What fees am I paying on trades?"
```

### Trading

| Tool | Description | Example Prompt |
|------|-------------|----------------|
| `BinanceSpotNewOrder` | Place a new spot order | "Buy 0.01 BTC at market price" |
| `BinanceSpotCancelOrder` | Cancel an open order | "Cancel my order #12345 for BTCUSDT" |
| `BinanceSpotCancelAllOrders` | Cancel all orders for a symbol | "Cancel all my open ETHUSDT orders" |
| `BinanceSpotGetOrder` | Get order status | "What's the status of order #12345?" |
| `BinanceSpotOpenOrders` | Get all open orders | "Show all my open orders" |
| `BinanceSpotAllOrders` | Get order history | "Show my order history for BTCUSDT" |

**Example Prompts:**
```
"Place a limit buy order for 0.1 ETH at $2000"
"Buy $100 worth of BTC at market price"
"Cancel all my pending orders"
"Show me my open orders"
```

---

## Margin Trading

### Cross Margin

| Tool | Description | Example Prompt |
|------|-------------|----------------|
| `BinanceCrossMarginAccount` | Get cross margin account details | "Show my cross margin account" |
| `BinanceCrossMarginBorrow` | Borrow assets | "Borrow 1000 USDT on cross margin" |
| `BinanceCrossMarginRepay` | Repay borrowed assets | "Repay my USDT margin loan" |
| `BinanceCrossMarginNewOrder` | Place margin order | "Buy 0.1 BTC on margin" |
| `BinanceCrossMarginTransfer` | Transfer to/from margin | "Transfer 500 USDT to margin account" |
| `BinanceCrossMarginPairs` | Get all margin pairs | "What pairs can I trade on margin?" |
| `BinanceCrossMarginMaxBorrowable` | Check borrow limit | "How much BTC can I borrow?" |
| `BinanceCrossMarginInterestHistory` | Get interest history | "Show my margin interest history" |
| `BinanceCrossMarginLoanRecord` | Get loan records | "Show my margin loan history" |
| `BinanceCrossMarginOpenOrders` | Get open margin orders | "Show my open margin orders" |

**Example Prompts:**
```
"What's my cross margin account balance?"
"Borrow 0.5 ETH on cross margin"
"Place a margin buy order for BTC"
"How much can I borrow on margin?"
"Show my margin interest charges"
```

### Isolated Margin

| Tool | Description | Example Prompt |
|------|-------------|----------------|
| `BinanceIsolatedMarginAccount` | Get isolated margin account | "Show my isolated margin for BTCUSDT" |
| `BinanceIsolatedMarginTransfer` | Transfer to isolated margin | "Transfer USDT to BTCUSDT isolated margin" |
| `BinanceIsolatedMarginAllPairs` | Get all isolated pairs | "What isolated margin pairs are available?" |
| `BinanceIsolatedMarginNewOrder` | Place isolated margin order | "Buy BTC on BTCUSDT isolated margin" |
| `BinanceIsolatedMarginTierData` | Get tier/leverage data | "What leverage is available for ETHUSDT isolated?" |

**Example Prompts:**
```
"Show my ETHUSDT isolated margin position"
"Transfer 1000 USDT to BTCUSDT isolated margin"
"What's the max leverage for isolated margin?"
```

---

## Futures (USD-M)

### Market Data

| Tool | Description | Example Prompt |
|------|-------------|----------------|
| `BinanceFuturesExchangeInfo` | Get futures trading rules | "What are the futures trading rules?" |
| `BinanceFuturesDepth` | Get futures order book | "Show futures order book for BTCUSDT" |
| `BinanceFuturesKlines` | Get futures candlesticks | "Get 15m futures candles for BTCUSDT" |
| `BinanceFuturesTicker24hr` | Get 24h futures stats | "What's the 24h change on BTC futures?" |
| `BinanceFuturesTickerPrice` | Get futures price | "What's the BTC perpetual price?" |
| `BinanceFuturesFundingRate` | Get funding rates | "What's the current BTC funding rate?" |
| `BinanceFuturesOpenInterest` | Get open interest | "What's the open interest for ETHUSDT perp?" |
| `BinanceFuturesPremiumIndex` | Get mark price | "What's the mark price for BTCUSDT?" |

**Example Prompts:**
```
"What's the Bitcoin futures price?"
"Show me the funding rate for ETHUSDT perpetual"
"Get the futures order book for SOLUSDT"
```

### Account & Trading

| Tool | Description | Example Prompt |
|------|-------------|----------------|
| `BinanceFuturesAccount` | Get futures account info | "Show my futures account" |
| `BinanceFuturesBalance` | Get futures balances | "What's my futures balance?" |
| `BinanceFuturesPositionRisk` | Get open positions | "Show my futures positions" |
| `BinanceFuturesNewOrder` | Place futures order | "Long 0.01 BTC at market" |
| `BinanceFuturesCancelOrder` | Cancel futures order | "Cancel futures order #12345" |
| `BinanceFuturesLeverage` | Set leverage | "Set BTCUSDT leverage to 10x" |
| `BinanceFuturesMarginType` | Set margin type | "Switch to isolated margin for BTCUSDT" |
| `BinanceFuturesPositionMode` | Set hedge/one-way mode | "Enable hedge mode" |
| `BinanceFuturesUserTrades` | Get futures trade history | "Show my BTC futures trades" |
| `BinanceFuturesIncome` | Get PnL history | "Show my futures profit/loss history" |

**Example Prompts:**
```
"Show my futures positions"
"Open a long position on BTC with 10x leverage"
"Close my ETH futures position"
"Set leverage to 20x for SOLUSDT"
"What's my futures PnL today?"
```

---

## Options

| Tool | Description | Example Prompt |
|------|-------------|----------------|
| `BinanceOptionsExchangeInfo` | Get options trading info | "What options are available?" |
| `BinanceOptionsAccount` | Get options account | "Show my options account" |
| `BinanceOptionsPosition` | Get options positions | "Show my options positions" |
| `BinanceOptionsNewOrder` | Place options order | "Buy a BTC call option" |
| `BinanceOptionsTicker` | Get options prices | "What's the price of BTC options?" |
| `BinanceOptionsKlines` | Get options candles | "Get options price history" |
| `BinanceOptionsMark` | Get options mark prices | "What are the current options mark prices?" |
| `BinanceOptionsOpenInterest` | Get options OI | "What's the open interest for BTC options?" |
| `BinanceOptionsUserTrades` | Get options trades | "Show my options trade history" |

**Example Prompts:**
```
"Show available BTC options"
"What's my options account balance?"
"Show my current options positions"
```

---

## Portfolio Margin

| Tool | Description | Example Prompt |
|------|-------------|----------------|
| `BinanceGetPortfolioMarginAccount` | Get PM account | "Show my portfolio margin account" |
| `BinanceGetAccountBalance` | Get PM balances | "What's my portfolio margin balance?" |
| `BinanceGetCollateralRate` | Get collateral rates | "What are the collateral rates?" |
| `BinanceGetPortfolioMarginAssetLeverage` | Get asset leverage | "What leverage can I use?" |
| `BinanceFundAutoCollection` | Auto collect funds | "Enable auto fund collection" |
| `BinanceBnbTransfer` | Transfer BNB | "Transfer BNB in portfolio margin" |
| `BinanceRepayFuturesNegativeBalance` | Repay negative balance | "Repay my futures negative balance" |

**Example Prompts:**
```
"Show my portfolio margin account status"
"What collateral can I use for portfolio margin?"
"What's my available margin?"
```

---

## Wallet

### Account Operations

| Tool | Description | Example Prompt |
|------|-------------|----------------|
| `BinanceSystemStatus` | Check system status | "Is Binance working normally?" |
| `BinanceAllCoinsInfo` | Get all coin info | "Show all supported coins" |
| `BinanceAccountSnapshot` | Get account snapshot | "Show my account snapshot" |
| `BinanceDailyAccountSnapshot` | Get daily snapshots | "Get my daily balance history" |
| `BinanceApiTradingStatus` | Check API status | "What's my API trading status?" |
| `BinanceApiKeyPermission` | Check API permissions | "What permissions does my API key have?" |

### Deposits & Withdrawals

| Tool | Description | Example Prompt |
|------|-------------|----------------|
| `BinanceDepositHistory` | Get deposit history | "Show my deposit history" |
| `BinanceWithdrawHistory` | Get withdrawal history | "Show my withdrawal history" |
| `BinanceDepositAddress` | Get deposit address | "Get my BTC deposit address" |
| `BinanceWithdraw` | Withdraw assets | "Withdraw 1 ETH to my wallet" |
| `BinanceNetworkInfo` | Get network info | "What networks are available for USDT?" |

### Asset Operations

| Tool | Description | Example Prompt |
|------|-------------|----------------|
| `BinanceAssetDetail` | Get asset details | "Show details for BTC" |
| `BinanceTradeFee` | Get trading fees | "What are my trading fees?" |
| `BinanceUserAsset` | Get user assets | "Show all my assets" |
| `BinanceDustTransfer` | Convert dust to BNB | "Convert my dust to BNB" |
| `BinanceDustLog` | Get dust conversion log | "Show my dust conversion history" |
| `BinanceAssetDividend` | Get dividend records | "Show my dividend history" |
| `BinanceUniversalTransfer` | Transfer between wallets | "Transfer 100 USDT to futures" |
| `BinanceGetUniversalTransferHistory` | Get transfer history | "Show my transfer history" |

**Example Prompts:**
```
"Show my deposit address for USDT on TRC20"
"What's my withdrawal history?"
"Convert my small balances to BNB"
"Transfer 500 USDT from spot to futures"
"Show all my asset balances"
```

---

## Sub-Account

| Tool | Description | Example Prompt |
|------|-------------|----------------|
| `BinanceGetSubAccountList` | List sub-accounts | "Show my sub-accounts" |
| `BinanceCreateVirtualSubAccount` | Create sub-account | "Create a new sub-account" |
| `BinanceGetSubAccountAssets` | Get sub-account assets | "Show sub-account balances" |
| `BinanceTransferToSubAccount` | Transfer to sub | "Transfer USDT to sub-account" |
| `BinanceTransferToMaster` | Transfer to master | "Transfer from sub to master" |
| `BinanceUniversalTransfer` | Universal transfer | "Transfer between sub-accounts" |
| `BinanceEnableMargin` | Enable margin for sub | "Enable margin for sub-account" |
| `BinanceEnableFutures` | Enable futures for sub | "Enable futures for sub-account" |
| `BinanceGetSubAccountStatus` | Get sub status | "Check sub-account status" |
| `BinanceCreateApiKey` | Create API key for sub | "Create API key for sub-account" |

**Example Prompts:**
```
"List all my sub-accounts"
"Create a new trading sub-account"
"Transfer 1000 USDT to my sub-account"
"Enable futures trading for sub-account"
```

---

## Staking

### ETH Staking

| Tool | Description | Example Prompt |
|------|-------------|----------------|
| `BinanceEthStakingAccount` | Get ETH staking info | "Show my ETH staking" |
| `BinanceStakeEth` | Stake ETH | "Stake 1 ETH" |
| `BinanceRedeemEth` | Unstake ETH | "Unstake my ETH" |
| `BinanceEthStakingHistory` | Get staking history | "Show my ETH staking history" |
| `BinanceWbethRewards` | Get WBETH rewards | "Show my WBETH rewards" |
| `BinanceWrapBeth` | Wrap BETH to WBETH | "Convert BETH to WBETH" |

### SOL Staking

| Tool | Description | Example Prompt |
|------|-------------|----------------|
| `BinanceSolStakingAccount` | Get SOL staking info | "Show my SOL staking" |
| `BinanceStakeSol` | Stake SOL | "Stake 10 SOL" |
| `BinanceRedeemSol` | Unstake SOL | "Unstake my SOL" |
| `BinanceSolStakingHistory` | Get SOL staking history | "Show my SOL staking history" |

**Example Prompts:**
```
"How much ETH do I have staked?"
"Stake 2 ETH"
"Show my staking rewards"
"Unstake 5 SOL"
```

---

## Simple Earn

| Tool | Description | Example Prompt |
|------|-------------|----------------|
| `BinanceFlexibleProductList` | Get flexible products | "What flexible earn products are available?" |
| `BinanceLockedProductList` | Get locked products | "Show locked earn products" |
| `BinanceSubscribeFlexible` | Subscribe to flexible | "Subscribe to USDT flexible savings" |
| `BinanceSubscribeLocked` | Subscribe to locked | "Subscribe to locked BTC product" |
| `BinanceRedeemFlexible` | Redeem flexible | "Redeem from USDT flexible" |
| `BinanceRedeemLocked` | Redeem locked | "Redeem my locked position" |
| `BinanceFlexiblePosition` | Get flexible positions | "Show my flexible earn positions" |
| `BinanceLockedPosition` | Get locked positions | "Show my locked earn positions" |
| `BinanceEarnAccount` | Get earn account | "Show my Simple Earn account" |
| `BinanceFlexibleRewardsHistory` | Get rewards history | "Show my earn rewards" |

**Example Prompts:**
```
"What earn products are available for USDT?"
"Subscribe 1000 USDT to flexible savings"
"Show my Simple Earn positions"
"What's my APY on flexible savings?"
```

---

## Auto-Invest

| Tool | Description | Example Prompt |
|------|-------------|----------------|
| `BinanceGetSourceAssetList` | Get source assets | "What assets can I use for auto-invest?" |
| `BinanceGetTargetAssetList` | Get target assets | "What can I auto-invest in?" |
| `BinanceCreatePlan` | Create DCA plan | "Create a weekly BTC DCA plan" |
| `BinanceEditPlan` | Edit plan | "Change my DCA amount" |
| `BinanceChangePlanStatus` | Pause/resume plan | "Pause my auto-invest plan" |
| `BinanceGetPlanList` | Get all plans | "Show my auto-invest plans" |
| `BinanceGetSubscriptionHistory` | Get DCA history | "Show my auto-invest history" |
| `BinanceGetTargetAssetROI` | Get ROI | "What's my auto-invest ROI?" |

**Example Prompts:**
```
"Create a daily $50 BTC auto-invest plan"
"Show all my DCA plans"
"Pause my ETH auto-invest"
"What's the performance of my auto-invest?"
```

---

## Convert

| Tool | Description | Example Prompt |
|------|-------------|----------------|
| `BinanceConvertGetPairs` | Get convert pairs | "What can I convert?" |
| `BinanceConvertGetQuote` | Get conversion quote | "Get a quote to convert BTC to ETH" |
| `BinanceConvertAcceptQuote` | Accept quote | "Accept the conversion" |
| `BinanceConvertOrderStatus` | Check order status | "Check my convert order status" |
| `BinanceConvertHistory` | Get convert history | "Show my conversion history" |
| `BinanceConvertExchangeInfo` | Get exchange info | "What are the convert limits?" |

**Example Prompts:**
```
"Convert 0.1 BTC to ETH"
"Get a quote for converting USDT to BNB"
"Show my conversion history"
```

---

## Mining

| Tool | Description | Example Prompt |
|------|-------------|----------------|
| `BinanceMiningAlgoList` | Get mining algorithms | "What mining algorithms are available?" |
| `BinanceMiningCoinList` | Get mineable coins | "What coins can I mine?" |
| `BinanceMinerList` | Get my miners | "Show my mining workers" |
| `BinanceMinerDetails` | Get miner details | "Show details for my miner" |
| `BinanceMiningRevenueList` | Get mining revenue | "Show my mining earnings" |
| `BinanceMiningStatisticList` | Get mining stats | "What are my mining statistics?" |
| `BinanceMiningAccountList` | Get mining accounts | "Show my mining accounts" |
| `BinanceHashrateResaleList` | Get hashrate resale | "Show hashrate marketplace" |
| `BinanceHashrateResaleDetail` | Get resale details | "Show hashrate resale details" |

**Example Prompts:**
```
"Show my mining pool statistics"
"What's my mining revenue this month?"
"List all my mining workers"
```

---

## Algo Trading

| Tool | Description | Example Prompt |
|------|-------------|----------------|
| `BinanceSpotTwapNewOrder` | Create TWAP order | "Create a TWAP order to buy BTC" |
| `BinanceSpotTwapCancel` | Cancel TWAP | "Cancel my TWAP order" |
| `BinanceSpotTwapOpenOrders` | Get open TWAP | "Show my active TWAP orders" |
| `BinanceSpotTwapHistoricalOrders` | Get TWAP history | "Show my TWAP history" |
| `BinanceFuturesTwapNewOrder` | Create futures TWAP | "Create futures TWAP order" |
| `BinanceFuturesVpNewOrder` | Create VP order | "Create a VP order" |
| `BinanceAlgoOpenOrders` | Get all algo orders | "Show my algo orders" |
| `BinanceAlgoHistoricalOrders` | Get algo history | "Show algo order history" |

**Example Prompts:**
```
"Create a TWAP order to buy 1 BTC over 4 hours"
"Show my active algorithmic orders"
"Cancel all my TWAP orders"
```

---

## VIP Loan

| Tool | Description | Example Prompt |
|------|-------------|----------------|
| `BinanceVipLoanBorrow` | Take VIP loan | "Borrow USDT via VIP loan" |
| `BinanceVipLoanRepay` | Repay VIP loan | "Repay my VIP loan" |
| `BinanceVipLoanOngoingOrders` | Get active loans | "Show my active VIP loans" |
| `BinanceVipLoanRepaymentHistory` | Get repayment history | "Show VIP loan repayments" |
| `BinanceVipLoanCollateralAccount` | Get collateral | "Show my VIP loan collateral" |
| `BinanceVipLoanLoanableData` | Get loanable assets | "What can I borrow?" |
| `BinanceVipLoanCollateralData` | Get collateral data | "What collateral is accepted?" |
| `BinanceVipLoanApplicationStatus` | Check application | "Check my loan application" |

**Example Prompts:**
```
"Apply for a VIP loan"
"Show my VIP loan status"
"What collateral do I need for VIP loan?"
```

---

## Crypto Loans

| Tool | Description | Example Prompt |
|------|-------------|----------------|
| `BinanceCryptoLoanBorrow` | Take crypto loan | "Borrow USDT with BTC collateral" |
| `BinanceCryptoLoanRepay` | Repay loan | "Repay my crypto loan" |
| `BinanceCryptoLoanOngoingOrders` | Get active loans | "Show my active loans" |
| `BinanceCryptoLoanBorrowHistory` | Get borrow history | "Show my loan history" |
| `BinanceCryptoLoanLtvAdjust` | Adjust LTV | "Add collateral to my loan" |

**Example Prompts:**
```
"Take a crypto loan using ETH as collateral"
"Show my outstanding loans"
"Add more collateral to reduce LTV"
```

---

## NFT

| Tool | Description | Example Prompt |
|------|-------------|----------------|
| `BinanceNftTransactionHistory` | Get NFT transactions | "Show my NFT transactions" |
| `BinanceNftDepositHistory` | Get NFT deposits | "Show my NFT deposit history" |
| `BinanceNftWithdrawHistory` | Get NFT withdrawals | "Show my NFT withdrawals" |
| `BinanceNftAsset` | Get NFT assets | "Show my NFTs" |

**Example Prompts:**
```
"Show all my NFTs on Binance"
"Get my NFT transaction history"
```

---

## Pay

| Tool | Description | Example Prompt |
|------|-------------|----------------|
| `BinancePayHistory` | Get Pay history | "Show my Binance Pay history" |
| `BinancePayCreateOrder` | Create Pay order | "Create a Pay order" |
| `BinancePayQueryOrder` | Query Pay order | "Check Pay order status" |

**Example Prompts:**
```
"Show my Binance Pay transactions"
"Create a payment request"
```

---

## Gift Card

| Tool | Description | Example Prompt |
|------|-------------|----------------|
| `BinanceCreateCode` | Create gift card | "Create a $100 USDT gift card" |
| `BinanceRedeemCode` | Redeem gift card | "Redeem gift card code ABC123" |
| `BinanceVerify` | Verify gift card | "Verify gift card code" |
| `BinanceBuyCode` | Buy gift card | "Buy a gift card" |
| `BinanceGetTokenLimit` | Get limits | "What are gift card limits?" |
| `BinanceRsaPublicKey` | Get RSA key | "Get gift card RSA key" |
| `BinanceCreateDualTokenCode` | Create dual token | "Create dual token gift card" |

**Example Prompts:**
```
"Create a gift card worth 50 USDT"
"Redeem my gift card"
"Check if my gift card code is valid"
```

---

## Copy Trading

| Tool | Description | Example Prompt |
|------|-------------|----------------|
| `BinanceCopyTradingFuturesLeadTraderStatus` | Get lead trader status | "Am I a lead trader?" |
| `BinanceCopyTradingFuturesUserStatus` | Get copy status | "Show my copy trading status" |
| `BinanceCopyTradingLeadPositions` | Get lead positions | "Show lead trader positions" |
| `BinanceCopyTradingCopyPositions` | Get copy positions | "Show my copied positions" |

**Example Prompts:**
```
"Show my copy trading positions"
"What's my copy trading performance?"
```

---

## Dual Investment

| Tool | Description | Example Prompt |
|------|-------------|----------------|
| `BinanceDualInvestmentList` | Get products | "What dual investment products are available?" |
| `BinanceDualInvestmentSubscribe` | Subscribe | "Subscribe to dual investment" |
| `BinanceDualInvestmentPositions` | Get positions | "Show my dual investment positions" |
| `BinanceDualInvestmentAccounts` | Get accounts | "Show my dual investment account" |

**Example Prompts:**
```
"Show available dual investment products"
"Subscribe to a BTC dual investment product"
"What are my dual investment positions?"
```

---

## C2C/P2P

| Tool | Description | Example Prompt |
|------|-------------|----------------|
| `BinanceC2cTradeHistory` | Get P2P history | "Show my P2P trade history" |
| `BinanceC2cOrderMatchList` | Get order matches | "Show my P2P orders" |

**Example Prompts:**
```
"Show my P2P trading history"
"Get my C2C trade records"
```

---

## Fiat

| Tool | Description | Example Prompt |
|------|-------------|----------------|
| `BinanceFiatDepositHistory` | Get fiat deposits | "Show my fiat deposit history" |
| `BinanceFiatWithdrawHistory` | Get fiat withdrawals | "Show my fiat withdrawal history" |
| `BinanceFiatOrders` | Get fiat orders | "Show my fiat orders" |
| `BinanceFiatPayments` | Get fiat payments | "Show my fiat payments" |

**Example Prompts:**
```
"Show my USD deposit history"
"What fiat withdrawals have I made?"
```

---

## Rebate

| Tool | Description | Example Prompt |
|------|-------------|----------------|
| `BinanceRebateSpotHistory` | Get spot rebates | "Show my spot rebate history" |
| `BinanceRebateFuturesHistory` | Get futures rebates | "Show my futures rebates" |
| `BinanceRebateTaxQuery` | Get tax info | "Get my rebate tax information" |

**Example Prompts:**
```
"How much have I earned in referral rebates?"
"Show my futures commission rebates"
```

---

## Quick Reference - Common Tasks

| Task | Tool | Example |
|------|------|---------|
| Check BTC price | `BinanceTickerPrice` | "What's the BTC price?" |
| View balances | `BinanceAccountInfo` | "Show my balances" |
| Buy crypto | `BinanceSpotNewOrder` | "Buy 0.01 BTC" |
| Check positions | `BinanceFuturesPositionRisk` | "Show my futures positions" |
| Transfer funds | `BinanceUniversalTransfer` | "Transfer to futures" |
| Stake ETH | `BinanceStakeEth` | "Stake 1 ETH" |
| Get deposit address | `BinanceDepositAddress` | "Get my BTC address" |
| Convert assets | `BinanceConvertGetQuote` | "Convert BNB to USDT" |

---

## Tips for Using Binance MCP

1. **Market Data is Free** - You can query prices, order books, and candles without authentication
2. **Use Symbol Format** - Always use pairs like "BTCUSDT", not "BTC/USDT"
3. **Check Balances First** - Query account before placing orders
4. **Set Appropriate Leverage** - Configure leverage before futures trades
5. **Monitor Positions** - Regularly check open positions and orders
6. **Use Limit Orders** - They often have lower fees than market orders

---

*This documentation covers all 478+ tools available in the Binance MCP Server.*
