#!/bin/bash
set -e

# Rebuild Binance-MCP with individual commits for each file
# Each file gets a unique commit with emoji and description

REPO_DIR="/workspaces/universal-crypto-mcp/binance-mcp-server"
WORK_DIR="/tmp/binance-mcp-individual"
GITHUB_USER="nirholas"
REPO_NAME="Binance-MCP"

echo "🚀 Rebuilding Binance-MCP with individual file commits..."

# Clean and create work directory  
rm -rf "$WORK_DIR"
mkdir -p "$WORK_DIR"
cd "$WORK_DIR"

# Initialize fresh repo
git init
git config user.email "nirholas@users.noreply.github.com"
git config user.name "nirholas"

# Function to add a single file and commit
commit_file() {
    local file="$1"
    local message="$2"
    
    if [ -e "$REPO_DIR/$file" ]; then
        mkdir -p "$(dirname "$file")"
        cp "$REPO_DIR/$file" "$file"
        git add "$file"
        git commit -m "$message" 2>/dev/null || true
    fi
}

echo "📦 Creating individual commits for each file..."

# ═══════════════════════════════════════════════════════════════
# ROOT CONFIGURATION FILES
# ═══════════════════════════════════════════════════════════════
commit_file "package.json" "🎯 Initialize package.json with project metadata and dependencies"
commit_file "tsconfig.json" "⚙️ Configure TypeScript compiler options for strict type checking"
commit_file ".gitignore" "🙈 Define Git ignore patterns for node_modules and build artifacts"
commit_file "README.md" "📖 Add comprehensive documentation with setup and usage guide"
commit_file "binance-us-rest-api.md" "📚 Include complete Binance REST API reference documentation"
commit_file "config.json" "🔧 Add server configuration template with API settings"

# ═══════════════════════════════════════════════════════════════
# CORE SOURCE FILES
# ═══════════════════════════════════════════════════════════════
commit_file "src/index.ts" "🚀 Create main entry point with server initialization"
commit_file "src/binance.ts" "🔌 Implement Binance API client with HMAC authentication"
commit_file "src/init.ts" "⚡ Add module initialization and tool registration logic"

# ═══════════════════════════════════════════════════════════════
# CONFIG MODULE
# ═══════════════════════════════════════════════════════════════
commit_file "src/config/binanceClient.ts" "🔐 Create Binance client configuration with API credentials"
commit_file "src/config/client.ts" "🌐 Add HTTP client wrapper for REST API calls"

# ═══════════════════════════════════════════════════════════════
# SERVER INFRASTRUCTURE
# ═══════════════════════════════════════════════════════════════
commit_file "src/server/base.ts" "🏗️ Implement MCP server base class with request handling"
commit_file "src/server/sse.ts" "📡 Add Server-Sent Events transport for real-time streaming"
commit_file "src/server/stdio.ts" "💻 Implement STDIO transport for CLI and editor integration"

# ═══════════════════════════════════════════════════════════════
# UTILITIES
# ═══════════════════════════════════════════════════════════════
commit_file "src/utils/logger.ts" "🛠️ Create structured logger with color-coded output levels"

# ═══════════════════════════════════════════════════════════════
# SPOT MODULE - General API
# ═══════════════════════════════════════════════════════════════
commit_file "src/modules/spot/index.ts" "📈 Initialize spot trading module with all API exports"
commit_file "src/modules/spot/general-api/index.ts" "📋 Export all general API endpoints for spot trading"
commit_file "src/modules/spot/general-api/ping.ts" "🏓 Add ping endpoint to test API connectivity"
commit_file "src/modules/spot/general-api/time.ts" "⏰ Implement server time synchronization endpoint"
commit_file "src/modules/spot/general-api/exchangeInfo.ts" "🏛️ Add exchange info with trading rules and symbols"

# ═══════════════════════════════════════════════════════════════
# SPOT MODULE - Market API
# ═══════════════════════════════════════════════════════════════
commit_file "src/modules/spot/market-api/index.ts" "📊 Export all market data API endpoints"
commit_file "src/modules/spot/market-api/depth.ts" "📉 Implement order book depth retrieval"
commit_file "src/modules/spot/market-api/getTrades.ts" "💹 Add recent trades list endpoint"
commit_file "src/modules/spot/market-api/historicalTrades.ts" "📜 Implement historical trades lookup"
commit_file "src/modules/spot/market-api/aggTrades.ts" "📦 Add compressed aggregate trades endpoint"
commit_file "src/modules/spot/market-api/klines.ts" "🕯️ Implement candlestick/kline data retrieval"
commit_file "src/modules/spot/market-api/uiKlines.ts" "📱 Add UI-optimized kline data endpoint"
commit_file "src/modules/spot/market-api/avgPrice.ts" "💰 Implement current average price calculation"
commit_file "src/modules/spot/market-api/ticker24hr.ts" "📈 Add 24-hour rolling window price statistics"
commit_file "src/modules/spot/market-api/ticker.ts" "🎯 Implement rolling window price change stats"
commit_file "src/modules/spot/market-api/tickerPrice.ts" "💵 Add symbol price ticker endpoint"
commit_file "src/modules/spot/market-api/tickerBookTicker.ts" "📕 Implement best bid/ask price endpoint"
commit_file "src/modules/spot/market-api/tickerTradingDay.ts" "📅 Add trading day price change statistics"

# ═══════════════════════════════════════════════════════════════
# SPOT MODULE - Trade API
# ═══════════════════════════════════════════════════════════════
commit_file "src/modules/spot/trade-api/index.ts" "🔄 Export all spot trading order endpoints"
commit_file "src/modules/spot/trade-api/newOrder.ts" "✨ Implement new order placement with all order types"
commit_file "src/modules/spot/trade-api/getOrder.ts" "🔍 Add single order status query endpoint"
commit_file "src/modules/spot/trade-api/getOpenOrders.ts" "📋 Implement open orders list retrieval"
commit_file "src/modules/spot/trade-api/allOrders.ts" "📚 Add all orders history query endpoint"
commit_file "src/modules/spot/trade-api/deleteOrder.ts" "❌ Implement single order cancellation"
commit_file "src/modules/spot/trade-api/deleteOpenOrders.ts" "🗑️ Add batch cancel all open orders endpoint"
commit_file "src/modules/spot/trade-api/orderOco.ts" "⚖️ Implement OCO (One-Cancels-Other) order placement"
commit_file "src/modules/spot/trade-api/openOrderList.ts" "📝 Add open order list query endpoint"

# ═══════════════════════════════════════════════════════════════
# SPOT MODULE - Account API
# ═══════════════════════════════════════════════════════════════
commit_file "src/modules/spot/account-api/index.ts" "👤 Export all account information endpoints"
commit_file "src/modules/spot/account-api/getAccount.ts" "💼 Implement account balance and info retrieval"
commit_file "src/modules/spot/account-api/myTrades.ts" "📊 Add personal trade history query endpoint"
commit_file "src/modules/spot/account-api/myAllocations.ts" "🎰 Implement SOR order allocation history"
commit_file "src/modules/spot/account-api/myPreventedMatches.ts" "🚫 Add self-trade prevention matches query"
commit_file "src/modules/spot/account-api/accountCommission.ts" "💸 Implement account commission rates query"
commit_file "src/modules/spot/account-api/rateLimitOrder.ts" "⏱️ Add order rate limit status endpoint"

# ═══════════════════════════════════════════════════════════════
# SPOT MODULE - User Data Stream API
# ═══════════════════════════════════════════════════════════════
commit_file "src/modules/spot/userdatastream-api/index.ts" "📡 Export user data stream management endpoints"
commit_file "src/modules/spot/userdatastream-api/newUserDataStream.ts" "🔔 Implement listen key creation for WebSocket"
commit_file "src/modules/spot/userdatastream-api/putUserDataStream.ts" "🔄 Add listen key keepalive ping endpoint"
commit_file "src/modules/spot/userdatastream-api/deleteUserDataStream.ts" "🔕 Implement listen key close endpoint"

# ═══════════════════════════════════════════════════════════════
# MARGIN MODULE
# ═══════════════════════════════════════════════════════════════
commit_file "src/modules/margin/index.ts" "📊 Initialize margin trading module with leverage support"

# ═══════════════════════════════════════════════════════════════
# FUTURES MODULES
# ═══════════════════════════════════════════════════════════════
commit_file "src/modules/futures-usdm/index.ts" "🔮 Initialize USD-M futures module for perpetual contracts"
commit_file "src/modules/futures-coinm/index.ts" "🪙 Initialize COIN-M futures module for coin-margined contracts"

# ═══════════════════════════════════════════════════════════════
# OPTIONS MODULE
# ═══════════════════════════════════════════════════════════════
commit_file "src/modules/options/index.ts" "🎲 Initialize options trading module for derivatives"

# ═══════════════════════════════════════════════════════════════
# ALGO MODULE - Futures Algo
# ═══════════════════════════════════════════════════════════════
commit_file "src/modules/algo/index.ts" "🤖 Initialize algorithmic trading module"
commit_file "src/modules/algo/future-algo/index.ts" "📊 Export all futures algorithmic order endpoints"
commit_file "src/modules/algo/future-algo/TwapNewTrade.ts" "⏱️ Implement TWAP order placement for futures"
commit_file "src/modules/algo/future-algo/VPNewTrade.ts" "📈 Add Volume Participation order for futures"
commit_file "src/modules/algo/future-algo/cancelAlgoOrder.ts" "❌ Implement algo order cancellation"
commit_file "src/modules/algo/future-algo/currentAlgoOpenOrders.ts" "📋 Add current open algo orders query"
commit_file "src/modules/algo/future-algo/historicalAlgoOrder.ts" "📜 Implement historical algo orders retrieval"
commit_file "src/modules/algo/future-algo/subOrders.ts" "📦 Add sub-order details query for algo orders"

# ═══════════════════════════════════════════════════════════════
# ALGO MODULE - Spot Algo
# ═══════════════════════════════════════════════════════════════
commit_file "src/modules/algo/spot-algo/index.ts" "📊 Export all spot algorithmic order endpoints"
commit_file "src/modules/algo/spot-algo/spotTWAPOrder.ts" "⏱️ Implement TWAP order placement for spot"
commit_file "src/modules/algo/spot-algo/cancelOpenTWAPOrder.ts" "❌ Add TWAP order cancellation endpoint"
commit_file "src/modules/algo/spot-algo/currentAlgoOpenOrders.ts" "📋 Implement current spot algo orders query"
commit_file "src/modules/algo/spot-algo/historicalAlgoOrders.ts" "📜 Add historical spot algo orders retrieval"
commit_file "src/modules/algo/spot-algo/subOrders.ts" "📦 Implement sub-order query for spot algo"

# ═══════════════════════════════════════════════════════════════
# COPY TRADING MODULE
# ═══════════════════════════════════════════════════════════════
commit_file "src/modules/copy-trading/index.ts" "👥 Initialize copy trading module"
commit_file "src/modules/copy-trading/FutureCopyTrading-api/index.ts" "📊 Export futures copy trading endpoints"
commit_file "src/modules/copy-trading/FutureCopyTrading-api/getFuturesLeadTraderStatus.ts" "🏆 Implement lead trader status query"
commit_file "src/modules/copy-trading/FutureCopyTrading-api/getFuturesLeadTradingSymbolWhitelist.ts" "📝 Add trading symbol whitelist retrieval"

# ═══════════════════════════════════════════════════════════════
# STAKING MODULE - ETH Staking
# ═══════════════════════════════════════════════════════════════
commit_file "src/modules/staking/index.ts" "💰 Initialize staking module for ETH and SOL"
commit_file "src/modules/staking/ETH-staking-api/index.ts" "⟠ Export all ETH staking endpoints"
commit_file "src/modules/staking/ETH-staking-api/ethStakingAccount.ts" "💼 Implement ETH staking account query"
commit_file "src/modules/staking/ETH-staking-api/subscribeEthStaking.ts" "✅ Add ETH staking subscription endpoint"
commit_file "src/modules/staking/ETH-staking-api/redeemEth.ts" "💸 Implement ETH unstaking redemption"
commit_file "src/modules/staking/ETH-staking-api/getCurrentEthStakingQuota.ts" "📊 Add ETH staking quota query"
commit_file "src/modules/staking/ETH-staking-api/getEthStakingHistory.ts" "📜 Implement ETH staking history retrieval"
commit_file "src/modules/staking/ETH-staking-api/getEthRedemptionHistory.ts" "📋 Add ETH redemption history query"
commit_file "src/modules/staking/ETH-staking-api/wrapBeth.ts" "🔄 Implement BETH to WBETH wrapping"
commit_file "src/modules/staking/ETH-staking-api/getWbethWrapHistory.ts" "📜 Add WBETH wrap history query"
commit_file "src/modules/staking/ETH-staking-api/getWbethUnwrapHistory.ts" "📋 Implement WBETH unwrap history"
commit_file "src/modules/staking/ETH-staking-api/getWbethRewardsHistory.ts" "🎁 Add WBETH rewards history query"
commit_file "src/modules/staking/ETH-staking-api/getWbethRateHistory.ts" "📈 Implement WBETH exchange rate history"

# ═══════════════════════════════════════════════════════════════
# STAKING MODULE - SOL Staking
# ═══════════════════════════════════════════════════════════════
commit_file "src/modules/staking/SOL-staking-api/index.ts" "◎ Export all SOL staking endpoints"
commit_file "src/modules/staking/SOL-staking-api/solStakingAccount.ts" "💼 Implement SOL staking account query"
commit_file "src/modules/staking/SOL-staking-api/subscribeSolStaking.ts" "✅ Add SOL staking subscription endpoint"
commit_file "src/modules/staking/SOL-staking-api/redeemSol.ts" "💸 Implement SOL unstaking redemption"
commit_file "src/modules/staking/SOL-staking-api/getSolStakingQuotaDetails.ts" "📊 Add SOL staking quota details"
commit_file "src/modules/staking/SOL-staking-api/getSolStakingHistory.ts" "📜 Implement SOL staking history"
commit_file "src/modules/staking/SOL-staking-api/getSolRedemptionHistory.ts" "📋 Add SOL redemption history query"
commit_file "src/modules/staking/SOL-staking-api/getBnsolRateHistory.ts" "📈 Implement BNSOL exchange rate history"
commit_file "src/modules/staking/SOL-staking-api/getBnsolRewardsHistory.ts" "🎁 Add BNSOL rewards history query"
commit_file "src/modules/staking/SOL-staking-api/getUnclaimedRewards.ts" "💎 Implement unclaimed rewards query"
commit_file "src/modules/staking/SOL-staking-api/claimBoostRewards.ts" "🚀 Add boost rewards claim endpoint"
commit_file "src/modules/staking/SOL-staking-api/getBoostRewardsHistory.ts" "📜 Implement boost rewards history"

# ═══════════════════════════════════════════════════════════════
# SIMPLE EARN MODULE
# ═══════════════════════════════════════════════════════════════
commit_file "src/modules/simple-earn/index.ts" "🌾 Initialize simple earn module for flexible savings"
commit_file "src/modules/simple-earn/account-api/index.ts" "📊 Export simple earn account endpoints"
commit_file "src/modules/simple-earn/account-api/simpleEarnFlexibleProductList.ts" "📋 Implement flexible product listing"
commit_file "src/modules/simple-earn/account-api/getFlexibleProductPosition.ts" "💼 Add flexible product position query"
commit_file "src/modules/simple-earn/earn-api/index.ts" "💰 Export simple earn action endpoints"
commit_file "src/modules/simple-earn/earn-api/subscribeFlexibleProduct.ts" "✅ Implement flexible product subscription"
commit_file "src/modules/simple-earn/earn-api/redeemFlexibleProduct.ts" "💸 Add flexible product redemption"

# ═══════════════════════════════════════════════════════════════
# AUTO-INVEST MODULE
# ═══════════════════════════════════════════════════════════════
commit_file "src/modules/auto-invest/index.ts" "📈 Initialize auto-invest module for DCA strategies"

# ═══════════════════════════════════════════════════════════════
# DUAL INVESTMENT MODULE
# ═══════════════════════════════════════════════════════════════
commit_file "src/modules/dual-investment/index.ts" "🎰 Initialize dual investment module"
commit_file "src/modules/dual-investment/market-api/index.ts" "📊 Export dual investment market endpoints"
commit_file "src/modules/dual-investment/market-api/getDualInvestmentProductList.ts" "📋 Implement product list retrieval"
commit_file "src/modules/dual-investment/trade-api/index.ts" "💰 Export dual investment trade endpoints"
commit_file "src/modules/dual-investment/trade-api/subscribeDualInvestmentProducts.ts" "✅ Add product subscription endpoint"
commit_file "src/modules/dual-investment/trade-api/getDualInvestmentPositions.ts" "💼 Implement positions query"
commit_file "src/modules/dual-investment/trade-api/checkDualInvestmentAccounts.ts" "👤 Add account check endpoint"
commit_file "src/modules/dual-investment/trade-api/changeAutoCompoundStatus.ts" "🔄 Implement auto-compound toggle"

# ═══════════════════════════════════════════════════════════════
# VIP LOAN MODULE
# ═══════════════════════════════════════════════════════════════
commit_file "src/modules/vip-loan/index.ts" "🏦 Initialize VIP loan module for institutional lending"
commit_file "src/modules/vip-loan/market-api/index.ts" "📊 Export VIP loan market data endpoints"
commit_file "src/modules/vip-loan/market-api/getLoanableAssetsData.ts" "💰 Implement loanable assets query"
commit_file "src/modules/vip-loan/market-api/getCollateralAssetData.ts" "🔒 Add collateral assets data retrieval"
commit_file "src/modules/vip-loan/market-api/getBorrowInterestRate.ts" "📈 Implement borrow interest rate query"
commit_file "src/modules/vip-loan/trade-api/index.ts" "💳 Export VIP loan trading endpoints"
commit_file "src/modules/vip-loan/trade-api/vipLoanBorrow.ts" "💸 Implement VIP loan borrow action"
commit_file "src/modules/vip-loan/trade-api/vipLoanRepay.ts" "✅ Add VIP loan repayment endpoint"
commit_file "src/modules/vip-loan/trade-api/vipLoanRenew.ts" "🔄 Implement VIP loan renewal"
commit_file "src/modules/vip-loan/userInformation-api/index.ts" "👤 Export VIP loan user info endpoints"
commit_file "src/modules/vip-loan/userInformation-api/getVIPLoanOngoingOrders.ts" "📋 Implement ongoing orders query"
commit_file "src/modules/vip-loan/userInformation-api/checkVIPLoanCollateralAccount.ts" "🔒 Add collateral account check"
commit_file "src/modules/vip-loan/userInformation-api/queryApplicationStatus.ts" "📊 Implement application status query"

# ═══════════════════════════════════════════════════════════════
# CRYPTO LOANS MODULE
# ═══════════════════════════════════════════════════════════════
commit_file "src/modules/crypto-loans/index.ts" "💳 Initialize crypto loans module for collateral lending"

# ═══════════════════════════════════════════════════════════════
# FIAT MODULE
# ═══════════════════════════════════════════════════════════════
commit_file "src/modules/fiat/index.ts" "💵 Initialize fiat module for deposit and withdrawal"
commit_file "src/modules/fiat/fiat-api/getFiatDepositWithdrawHistory.ts" "📜 Implement fiat deposit/withdraw history"
commit_file "src/modules/fiat/fiat-api/getFiatPaymentsHistory.ts" "💳 Add fiat payments history query"

# ═══════════════════════════════════════════════════════════════
# PAY MODULE
# ═══════════════════════════════════════════════════════════════
commit_file "src/modules/pay/index.ts" "💸 Initialize Binance Pay module"
commit_file "src/modules/pay/pay-api/getPayTradeHistory.ts" "📜 Implement Pay trade history retrieval"

# ═══════════════════════════════════════════════════════════════
# CONVERT MODULE
# ═══════════════════════════════════════════════════════════════
commit_file "src/modules/convert/index.ts" "🔄 Initialize convert module for instant swaps"
commit_file "src/modules/convert/market-data-api/index.ts" "📊 Export convert market data endpoints"
commit_file "src/modules/convert/market-data-api/listAllConvertPairs.ts" "📋 Implement convert pairs listing"
commit_file "src/modules/convert/market-data-api/queryOrderQuantityPrecisionPerAsset.ts" "🎯 Add asset precision query"
commit_file "src/modules/convert/trade-api/index.ts" "💱 Export convert trading endpoints"
commit_file "src/modules/convert/trade-api/sendQuoteRequest.ts" "💬 Implement quote request endpoint"
commit_file "src/modules/convert/trade-api/acceptQuote.ts" "✅ Add quote acceptance endpoint"
commit_file "src/modules/convert/trade-api/orderStatus.ts" "🔍 Implement order status query"
commit_file "src/modules/convert/trade-api/placeLimitOrder.ts" "📝 Add limit order placement"
commit_file "src/modules/convert/trade-api/queryLimitOpenOrders.ts" "📋 Implement open limit orders query"
commit_file "src/modules/convert/trade-api/cancelLimitOrder.ts" "❌ Add limit order cancellation"
commit_file "src/modules/convert/trade-api/getConvertTradeHistory.ts" "📜 Implement convert history retrieval"

# ═══════════════════════════════════════════════════════════════
# C2C MODULE
# ═══════════════════════════════════════════════════════════════
commit_file "src/modules/c2c/index.ts" "👤 Initialize C2C peer-to-peer trading module"
commit_file "src/modules/c2c/C2C/getC2CTradeHistory.ts" "📜 Implement C2C trade history retrieval"

# ═══════════════════════════════════════════════════════════════
# WALLET MODULE - Account API
# ═══════════════════════════════════════════════════════════════
commit_file "src/modules/wallet/index.ts" "👛 Initialize wallet module for balances and transfers"
commit_file "src/modules/wallet/account-api/index.ts" "👤 Export wallet account endpoints"
commit_file "src/modules/wallet/account-api/accountInfo.ts" "💼 Implement account information query"
commit_file "src/modules/wallet/account-api/accountStatus.ts" "🔍 Add account status retrieval"
commit_file "src/modules/wallet/account-api/accountApiTradingStatus.ts" "📊 Implement API trading status query"
commit_file "src/modules/wallet/account-api/dailyAccountSnapshot.ts" "📸 Add daily account snapshot retrieval"
commit_file "src/modules/wallet/account-api/getApiKeyPermission.ts" "🔑 Implement API key permissions query"
commit_file "src/modules/wallet/account-api/enableFastWithdrawSwitch.ts" "⚡ Add fast withdraw enable endpoint"
commit_file "src/modules/wallet/account-api/disableFastWithdrawSwitch.ts" "🐢 Implement fast withdraw disable"

# ═══════════════════════════════════════════════════════════════
# WALLET MODULE - Asset API
# ═══════════════════════════════════════════════════════════════
commit_file "src/modules/wallet/asset-api/index.ts" "💰 Export wallet asset management endpoints"
commit_file "src/modules/wallet/asset-api/userAsset.ts" "💼 Implement user asset balances query"
commit_file "src/modules/wallet/asset-api/fundingWallet.ts" "🏦 Add funding wallet balance retrieval"
commit_file "src/modules/wallet/asset-api/assetDetail.ts" "📋 Implement asset detail information"
commit_file "src/modules/wallet/asset-api/assetDividendRecord.ts" "🎁 Add asset dividend records query"
commit_file "src/modules/wallet/asset-api/tradeFee.ts" "💸 Implement trade fee query endpoint"
commit_file "src/modules/wallet/asset-api/dustlog.ts" "🧹 Add dust conversion history"
commit_file "src/modules/wallet/asset-api/dustTransfer.ts" "🔄 Implement small balance to BNB conversion"
commit_file "src/modules/wallet/asset-api/getAssetsThatCanBeConvertedIntoBnb.ts" "📋 Add convertible assets list"
commit_file "src/modules/wallet/asset-api/userUniversalTransfer.ts" "🔄 Implement universal asset transfer"
commit_file "src/modules/wallet/asset-api/queryUserUniversalTransferHistory.ts" "📜 Add transfer history query"
commit_file "src/modules/wallet/asset-api/queryUserWalletBalance.ts" "💰 Implement wallet balance query"
commit_file "src/modules/wallet/asset-api/queryUserDelegationHistory.ts" "📋 Add delegation history retrieval"
commit_file "src/modules/wallet/asset-api/toggleBnbBurnOnSpotTradeAndMarginInterest.ts" "🔥 Implement BNB burn toggle"
commit_file "src/modules/wallet/asset-api/getCloudMiningPaymentAndRefundHistory.ts" "⛏️ Add cloud mining history"
commit_file "src/modules/wallet/asset-api/getOpenSymbolList.ts" "📋 Implement open symbols listing"

# ═══════════════════════════════════════════════════════════════
# WALLET MODULE - Capital API
# ═══════════════════════════════════════════════════════════════
commit_file "src/modules/wallet/capital-api/index.ts" "💳 Export capital management endpoints"
commit_file "src/modules/wallet/capital-api/allCoinsInformation.ts" "🪙 Implement all coins info retrieval"
commit_file "src/modules/wallet/capital-api/depositAddress.ts" "📥 Add deposit address generation"
commit_file "src/modules/wallet/capital-api/fetchDepositAddressListWithNetwork.ts" "📋 Implement network deposit addresses"
commit_file "src/modules/wallet/capital-api/depositHistory.ts" "📜 Add deposit history query"
commit_file "src/modules/wallet/capital-api/withdraw.ts" "📤 Implement cryptocurrency withdrawal"
commit_file "src/modules/wallet/capital-api/withdrawHistory.ts" "📜 Add withdrawal history query"
commit_file "src/modules/wallet/capital-api/fetchWithdrawAddressList.ts" "📋 Implement withdraw address list"
commit_file "src/modules/wallet/capital-api/oneClickArrivalDepositApply.ts" "⚡ Add instant deposit application"

# ═══════════════════════════════════════════════════════════════
# WALLET MODULE - Others API
# ═══════════════════════════════════════════════════════════════
commit_file "src/modules/wallet/others-api/index.ts" "📊 Export miscellaneous wallet endpoints"
commit_file "src/modules/wallet/others-api/systemStatus.ts" "🔧 Implement system status check"
commit_file "src/modules/wallet/others-api/getSymbolsDelistScheduleForSpot.ts" "📅 Add delist schedule query"

# ═══════════════════════════════════════════════════════════════
# WALLET MODULE - Travel Rule API
# ═══════════════════════════════════════════════════════════════
commit_file "src/modules/wallet/travel-rule-api/index.ts" "✈️ Export travel rule compliance endpoints"
commit_file "src/modules/wallet/travel-rule-api/withdrawTravelRule.ts" "📤 Implement travel rule withdraw"
commit_file "src/modules/wallet/travel-rule-api/withdrawHistoryV1.ts" "📜 Add withdraw history v1 query"
commit_file "src/modules/wallet/travel-rule-api/withdrawHistoryV2.ts" "📜 Implement withdraw history v2"
commit_file "src/modules/wallet/travel-rule-api/depositHistoryTravelRule.ts" "📥 Add travel rule deposit history"
commit_file "src/modules/wallet/travel-rule-api/submitDepositQuestionnaire.ts" "📝 Implement deposit questionnaire"
commit_file "src/modules/wallet/travel-rule-api/submitDepositQuestionnaireTravelRule.ts" "✅ Add travel rule questionnaire"
commit_file "src/modules/wallet/travel-rule-api/onboardedVaspList.ts" "📋 Implement onboarded VASP listing"
commit_file "src/modules/wallet/travel-rule-api/brokerWithdraw.ts" "🏦 Add broker withdrawal endpoint"

# ═══════════════════════════════════════════════════════════════
# PORTFOLIO MARGIN MODULE
# ═══════════════════════════════════════════════════════════════
commit_file "src/modules/portfolio-margin/index.ts" "📊 Initialize portfolio margin module for unified margin"

# ═══════════════════════════════════════════════════════════════
# REBATE MODULE
# ═══════════════════════════════════════════════════════════════
commit_file "src/modules/rebate/index.ts" "🎁 Initialize rebate module for commission tracking"
commit_file "src/modules/rebate/rebate-api/getSpotRebateHistoryRecords.ts" "📜 Implement spot rebate history query"

# ═══════════════════════════════════════════════════════════════
# NFT MODULE
# ═══════════════════════════════════════════════════════════════
commit_file "src/modules/nft/index.ts" "🖼️ Initialize NFT module for digital collectibles"
commit_file "src/modules/nft/nft-api/getNFTAsset.ts" "🎨 Implement NFT asset retrieval"
commit_file "src/modules/nft/nft-api/getNFTTransactionHistory.ts" "📜 Add NFT transaction history query"
commit_file "src/modules/nft/nft-api/getNFTDepositHistory.ts" "📥 Implement NFT deposit history"
commit_file "src/modules/nft/nft-api/getNFTWithdrawHistory.ts" "📤 Add NFT withdrawal history query"

# ═══════════════════════════════════════════════════════════════
# GIFT CARD MODULE
# ═══════════════════════════════════════════════════════════════
commit_file "src/modules/gift-card/index.ts" "🎀 Initialize gift card module for crypto gifts"

# ═══════════════════════════════════════════════════════════════
# MINING MODULE
# ═══════════════════════════════════════════════════════════════
commit_file "src/modules/mining/index.ts" "⛏️ Initialize mining module for pool statistics"
commit_file "src/modules/mining/mining-api/acquiringAlgorithm.ts" "🔧 Implement mining algorithm query"
commit_file "src/modules/mining/mining-api/acquiringCoinname.ts" "🪙 Add mineable coin names retrieval"
commit_file "src/modules/mining/mining-api/requestForMinerList.ts" "👷 Implement miner list query"
commit_file "src/modules/mining/mining-api/requestForDetailMinerList.ts" "📋 Add detailed miner information"
commit_file "src/modules/mining/mining-api/accountList.ts" "💼 Implement mining account listing"
commit_file "src/modules/mining/mining-api/statisticList.ts" "📊 Add mining statistics retrieval"
commit_file "src/modules/mining/mining-api/earningsList.ts" "💰 Implement mining earnings query"
commit_file "src/modules/mining/mining-api/extraBonusList.ts" "🎁 Add extra bonus list retrieval"
commit_file "src/modules/mining/mining-api/miningAccountEarning.ts" "📈 Implement account earning details"
commit_file "src/modules/mining/mining-api/hashrateResaleList.ts" "📋 Add hashrate resale listing"
commit_file "src/modules/mining/mining-api/hashrateResaleDetail.ts" "📊 Implement resale detail query"
commit_file "src/modules/mining/mining-api/hashrateResaleRequest.ts" "📝 Add hashrate resale request"
commit_file "src/modules/mining/mining-api/cancelHashrateResaleConfiguration.ts" "🚫 Cancel hashrate resale agreements for mining pools"

# ═══════════════════════════════════════════════════════════════
# TOOLS - Root Tools
# ═══════════════════════════════════════════════════════════════
commit_file "src/tools/binanceAccountInfo.ts" "👤 Add MCP tool for account information retrieval"
commit_file "src/tools/binanceOrderBook.ts" "📕 Implement MCP tool for order book depth"
commit_file "src/tools/binanceSpotPlaceOrder.ts" "✨ Add MCP tool for spot order placement"
commit_file "src/tools/binanceTimeWeightedAveragePriceFutureAlgo.ts" "⏱️ Implement MCP tool for TWAP futures"

# ═══════════════════════════════════════════════════════════════
# TOOLS - Spot Tools
# ═══════════════════════════════════════════════════════════════
commit_file "src/tools/binance-spot/index.ts" "📈 Export all spot trading MCP tools"
commit_file "src/tools/binance-spot/general-api/index.ts" "📋 Export spot general API tools"
commit_file "src/tools/binance-spot/general-api/ping.ts" "🏓 Add MCP tool for API ping test"
commit_file "src/tools/binance-spot/general-api/time.ts" "⏰ Implement MCP tool for server time"
commit_file "src/tools/binance-spot/general-api/exchangeInfo.ts" "🏛️ Add MCP tool for exchange information"
commit_file "src/tools/binance-spot/market-api/index.ts" "📊 Export spot market data tools"
commit_file "src/tools/binance-spot/market-api/depth.ts" "📉 Implement MCP tool for order book depth"
commit_file "src/tools/binance-spot/market-api/getTrades.ts" "💹 Add MCP tool for recent trades"
commit_file "src/tools/binance-spot/market-api/historicalTrades.ts" "📜 Implement MCP tool for historical trades"
commit_file "src/tools/binance-spot/market-api/aggTrades.ts" "📦 Add MCP tool for aggregate trades"
commit_file "src/tools/binance-spot/market-api/klines.ts" "🕯️ Implement MCP tool for candlestick data"
commit_file "src/tools/binance-spot/market-api/uiKlines.ts" "📱 Add MCP tool for UI klines"
commit_file "src/tools/binance-spot/market-api/avgPrice.ts" "💰 Implement MCP tool for average price"
commit_file "src/tools/binance-spot/market-api/ticker24hr.ts" "📈 Add MCP tool for 24hr ticker"
commit_file "src/tools/binance-spot/market-api/ticker.ts" "🎯 Implement MCP tool for rolling ticker"
commit_file "src/tools/binance-spot/market-api/tickerPrice.ts" "💵 Add MCP tool for price ticker"
commit_file "src/tools/binance-spot/market-api/tickerBookTicker.ts" "📕 Implement MCP tool for book ticker"
commit_file "src/tools/binance-spot/market-api/tickerTradingDay.ts" "📅 Add MCP tool for trading day stats"
commit_file "src/tools/binance-spot/trade-api/index.ts" "🔄 Export spot trading tools"
commit_file "src/tools/binance-spot/trade-api/newOrder.ts" "✨ Implement MCP tool for new orders"
commit_file "src/tools/binance-spot/trade-api/getOrder.ts" "🔍 Add MCP tool for order query"
commit_file "src/tools/binance-spot/trade-api/getOpenOrders.ts" "📋 Implement MCP tool for open orders"
commit_file "src/tools/binance-spot/trade-api/allOrders.ts" "📚 Add MCP tool for all orders history"
commit_file "src/tools/binance-spot/trade-api/deleteOrder.ts" "❌ Implement MCP tool for order cancel"
commit_file "src/tools/binance-spot/trade-api/deleteOpenOrders.ts" "🗑️ Add MCP tool for batch cancel"
commit_file "src/tools/binance-spot/trade-api/orderOco.ts" "⚖️ Implement MCP tool for OCO orders"
commit_file "src/tools/binance-spot/trade-api/openOrderList.ts" "📝 Add MCP tool for order list query"
commit_file "src/tools/binance-spot/account-api/index.ts" "👤 Export spot account tools"
commit_file "src/tools/binance-spot/account-api/getAccount.ts" "💼 Implement MCP tool for account info"
commit_file "src/tools/binance-spot/account-api/myTrades.ts" "📊 Add MCP tool for trade history"
commit_file "src/tools/binance-spot/account-api/myAllocations.ts" "🎰 Implement MCP tool for allocations"
commit_file "src/tools/binance-spot/account-api/myPreventedMatches.ts" "🚫 Add MCP tool for prevented matches"
commit_file "src/tools/binance-spot/account-api/accountCommission.ts" "💸 Implement MCP tool for commissions"
commit_file "src/tools/binance-spot/account-api/rateLimitOrder.ts" "⏱️ Add MCP tool for rate limits"
commit_file "src/tools/binance-spot/userdatastream-api/index.ts" "📡 Export user data stream tools"
commit_file "src/tools/binance-spot/userdatastream-api/newUserDataStream.ts" "🔔 Implement MCP tool for listen key"
commit_file "src/tools/binance-spot/userdatastream-api/putUserDataStream.ts" "🔄 Add MCP tool for keepalive"
commit_file "src/tools/binance-spot/userdatastream-api/deleteUserDataStream.ts" "🔕 Implement MCP tool for close stream"

# ═══════════════════════════════════════════════════════════════
# TOOLS - Margin Tools
# ═══════════════════════════════════════════════════════════════
commit_file "src/tools/binance-margin/index.ts" "📊 Export all margin trading MCP tools"
commit_file "src/tools/binance-margin/cross-margin-api/index.ts" "📋 Export cross margin API tools"
commit_file "src/tools/binance-margin/cross-margin-api/crossMarginAccount.ts" "💼 Implement MCP tool for margin account"
commit_file "src/tools/binance-margin/cross-margin-api/crossMarginBorrow.ts" "💸 Add MCP tool for margin borrow"
commit_file "src/tools/binance-margin/cross-margin-api/crossMarginRepay.ts" "✅ Implement MCP tool for margin repay"
commit_file "src/tools/binance-margin/cross-margin-api/crossMarginTransfer.ts" "🔄 Add MCP tool for margin transfer"
commit_file "src/tools/binance-margin/cross-margin-api/crossMarginMaxBorrowable.ts" "📊 Implement MCP tool for max borrow"
commit_file "src/tools/binance-margin/cross-margin-api/crossMarginMaxTransferable.ts" "📈 Add MCP tool for max transfer"
commit_file "src/tools/binance-margin/cross-margin-api/crossMarginLoanRecord.ts" "📜 Implement MCP tool for loan records"
commit_file "src/tools/binance-margin/cross-margin-api/crossMarginRepayRecord.ts" "📋 Add MCP tool for repay records"
commit_file "src/tools/binance-margin/cross-margin-api/crossMarginInterestHistory.ts" "📈 Implement MCP tool for interest history"

# ═══════════════════════════════════════════════════════════════
# TOOLS - Algo Tools
# ═══════════════════════════════════════════════════════════════
commit_file "src/tools/binance-algo/index.ts" "🤖 Export all algo trading MCP tools"
commit_file "src/tools/binance-algo/future-algo/index.ts" "📊 Export futures algo tools"
commit_file "src/tools/binance-algo/future-algo/TwapNewTrade.ts" "⏱️ Implement MCP tool for futures TWAP"
commit_file "src/tools/binance-algo/future-algo/VPNewTrade.ts" "📈 Add MCP tool for futures VP"
commit_file "src/tools/binance-algo/future-algo/cancelAlgoOrder.ts" "❌ Implement MCP tool for algo cancel"
commit_file "src/tools/binance-algo/future-algo/currentAlgoOpenOrders.ts" "📋 Add MCP tool for algo open orders"
commit_file "src/tools/binance-algo/future-algo/historicalAlgoOrder.ts" "📜 Implement MCP tool for algo history"
commit_file "src/tools/binance-algo/future-algo/subOrders.ts" "📦 Add MCP tool for algo sub-orders"
commit_file "src/tools/binance-algo/spot-algo/index.ts" "📊 Export spot algo tools"
commit_file "src/tools/binance-algo/spot-algo/spotTWAPOrder.ts" "⏱️ Implement MCP tool for spot TWAP"
commit_file "src/tools/binance-algo/spot-algo/cancelOpenTWAPOrder.ts" "❌ Add MCP tool for TWAP cancel"
commit_file "src/tools/binance-algo/spot-algo/currentAlgoOpenOrders.ts" "📋 Implement MCP tool for spot algo orders"
commit_file "src/tools/binance-algo/spot-algo/historicalAlgoOrders.ts" "📜 Add MCP tool for spot algo history"
commit_file "src/tools/binance-algo/spot-algo/subOrders.ts" "📦 Implement MCP tool for spot sub-orders"

# ═══════════════════════════════════════════════════════════════
# TOOLS - Copy Trading Tools
# ═══════════════════════════════════════════════════════════════
commit_file "src/tools/binance-copy-trading/index.ts" "👥 Export all copy trading MCP tools"
commit_file "src/tools/binance-copy-trading/FutureCopyTrading-api/index.ts" "📊 Export futures copy trading tools"
commit_file "src/tools/binance-copy-trading/FutureCopyTrading-api/getFuturesLeadTraderStatus.ts" "🏆 Implement MCP tool for lead status"
commit_file "src/tools/binance-copy-trading/FutureCopyTrading-api/getFuturesLeadTradingSymbolWhitelist.ts" "📝 Add MCP tool for symbol whitelist"

# ═══════════════════════════════════════════════════════════════
# TOOLS - Staking Tools
# ═══════════════════════════════════════════════════════════════
commit_file "src/tools/binance-staking/index.ts" "💰 Export all staking MCP tools"
commit_file "src/tools/binance-staking/ETH-staking-api/index.ts" "⟠ Export ETH staking tools"
commit_file "src/tools/binance-staking/ETH-staking-api/ethStakingAccount.ts" "💼 Implement MCP tool for ETH account"
commit_file "src/tools/binance-staking/ETH-staking-api/subscribeEthStaking.ts" "✅ Add MCP tool for ETH stake"
commit_file "src/tools/binance-staking/ETH-staking-api/redeemEth.ts" "💸 Implement MCP tool for ETH redeem"
commit_file "src/tools/binance-staking/ETH-staking-api/getCurrentEthStakingQuota.ts" "📊 Add MCP tool for ETH quota"
commit_file "src/tools/binance-staking/ETH-staking-api/getEthStakingHistory.ts" "📜 Implement MCP tool for stake history"
commit_file "src/tools/binance-staking/ETH-staking-api/getEthRedemptionHistory.ts" "📋 Add MCP tool for redemption history"
commit_file "src/tools/binance-staking/ETH-staking-api/wrapBeth.ts" "🔄 Implement MCP tool for BETH wrap"
commit_file "src/tools/binance-staking/ETH-staking-api/getWbethWrapHistory.ts" "📜 Add MCP tool for wrap history"
commit_file "src/tools/binance-staking/ETH-staking-api/getWbethUnwrapHistory.ts" "📋 Implement MCP tool for unwrap history"
commit_file "src/tools/binance-staking/ETH-staking-api/getWbethRewardsHistory.ts" "🎁 Add MCP tool for WBETH rewards"
commit_file "src/tools/binance-staking/ETH-staking-api/getWbethRateHistory.ts" "📈 Implement MCP tool for rate history"
commit_file "src/tools/binance-staking/SOL-staking-api/index.ts" "◎ Export SOL staking tools"
commit_file "src/tools/binance-staking/SOL-staking-api/solStakingAccount.ts" "💼 Implement MCP tool for SOL account"
commit_file "src/tools/binance-staking/SOL-staking-api/subscribeSolStaking.ts" "✅ Add MCP tool for SOL stake"
commit_file "src/tools/binance-staking/SOL-staking-api/redeemSol.ts" "💸 Implement MCP tool for SOL redeem"
commit_file "src/tools/binance-staking/SOL-staking-api/getSolStakingQuotaDetails.ts" "📊 Add MCP tool for SOL quota"
commit_file "src/tools/binance-staking/SOL-staking-api/getSolStakingHistory.ts" "📜 Implement MCP tool for SOL history"
commit_file "src/tools/binance-staking/SOL-staking-api/getSolRedemptionHistory.ts" "📋 Add MCP tool for SOL redemption"
commit_file "src/tools/binance-staking/SOL-staking-api/getBnsolRateHistory.ts" "📈 Implement MCP tool for BNSOL rate"
commit_file "src/tools/binance-staking/SOL-staking-api/getBnsolRewardsHistory.ts" "🎁 Add MCP tool for BNSOL rewards"
commit_file "src/tools/binance-staking/SOL-staking-api/getUnclaimedRewards.ts" "💎 Implement MCP tool for unclaimed"
commit_file "src/tools/binance-staking/SOL-staking-api/claimBoostRewards.ts" "🚀 Add MCP tool for claim boost"
commit_file "src/tools/binance-staking/SOL-staking-api/getBoostRewardsHistory.ts" "📜 Implement MCP tool for boost history"

# ═══════════════════════════════════════════════════════════════
# TOOLS - Simple Earn Tools
# ═══════════════════════════════════════════════════════════════
commit_file "src/tools/binance-simple-earn/index.ts" "🌾 Export all simple earn MCP tools"
commit_file "src/tools/binance-simple-earn/account-api/index.ts" "📊 Export simple earn account tools"
commit_file "src/tools/binance-simple-earn/account-api/simpleEarnFlexibleProductList.ts" "📋 Implement MCP tool for products"
commit_file "src/tools/binance-simple-earn/account-api/getFlexibleProductPosition.ts" "💼 Add MCP tool for positions"
commit_file "src/tools/binance-simple-earn/earn-api/index.ts" "💰 Export simple earn action tools"
commit_file "src/tools/binance-simple-earn/earn-api/subscribeFlexibleProduct.ts" "✅ Implement MCP tool for subscribe"
commit_file "src/tools/binance-simple-earn/earn-api/redeemFlexibleProduct.ts" "💸 Add MCP tool for redeem"

# ═══════════════════════════════════════════════════════════════
# TOOLS - Dual Investment Tools
# ═══════════════════════════════════════════════════════════════
commit_file "src/tools/binance-dual-investment/index.ts" "🎰 Export all dual investment MCP tools"
commit_file "src/tools/binance-dual-investment/market-api/index.ts" "📊 Export dual investment market tools"
commit_file "src/tools/binance-dual-investment/market-api/getDualInvestmentProductList.ts" "📋 Implement MCP tool for products"
commit_file "src/tools/binance-dual-investment/trade-api/index.ts" "💰 Export dual investment trade tools"
commit_file "src/tools/binance-dual-investment/trade-api/subscribeDualInvestmentProducts.ts" "✅ Add MCP tool for subscribe"
commit_file "src/tools/binance-dual-investment/trade-api/getDualInvestmentPositions.ts" "💼 Implement MCP tool for positions"
commit_file "src/tools/binance-dual-investment/trade-api/checkDualInvestmentAccounts.ts" "👤 Add MCP tool for account check"
commit_file "src/tools/binance-dual-investment/trade-api/changeAutoCompoundStatus.ts" "🔄 Implement MCP tool for auto-compound"

# ═══════════════════════════════════════════════════════════════
# TOOLS - VIP Loan Tools
# ═══════════════════════════════════════════════════════════════
commit_file "src/tools/binance-vip-loan/index.ts" "🏦 Export all VIP loan MCP tools"
commit_file "src/tools/binance-vip-loan/market-api/index.ts" "📊 Export VIP loan market tools"
commit_file "src/tools/binance-vip-loan/market-api/getLoanableAssetsData.ts" "💰 Implement MCP tool for loanable assets"
commit_file "src/tools/binance-vip-loan/market-api/getCollateralAssetData.ts" "🔒 Add MCP tool for collateral data"
commit_file "src/tools/binance-vip-loan/market-api/getBorrowInterestRate.ts" "📈 Implement MCP tool for interest rates"
commit_file "src/tools/binance-vip-loan/trade-api/index.ts" "💳 Export VIP loan trade tools"
commit_file "src/tools/binance-vip-loan/trade-api/vipLoanBorrow.ts" "💸 Add MCP tool for borrow"
commit_file "src/tools/binance-vip-loan/trade-api/vipLoanRepay.ts" "✅ Implement MCP tool for repay"
commit_file "src/tools/binance-vip-loan/trade-api/vipLoanRenew.ts" "🔄 Add MCP tool for loan renewal"
commit_file "src/tools/binance-vip-loan/userInformation-api/index.ts" "👤 Export VIP loan user info tools"
commit_file "src/tools/binance-vip-loan/userInformation-api/getVIPLoanOngoingOrders.ts" "📋 Implement MCP tool for ongoing orders"
commit_file "src/tools/binance-vip-loan/userInformation-api/checkVIPLoanCollateralAccount.ts" "🔒 Add MCP tool for collateral check"
commit_file "src/tools/binance-vip-loan/userInformation-api/queryApplicationStatus.ts" "📊 Implement MCP tool for app status"

# ═══════════════════════════════════════════════════════════════
# TOOLS - Fiat Tools
# ═══════════════════════════════════════════════════════════════
commit_file "src/tools/binance-fiat/index.ts" "💵 Export all fiat MCP tools"
commit_file "src/tools/binance-fiat/fiat-api/getFiatDepositWithdrawHistory.ts" "📜 Implement MCP tool for fiat history"
commit_file "src/tools/binance-fiat/fiat-api/getFiatPaymentsHistory.ts" "💳 Add MCP tool for payment history"

# ═══════════════════════════════════════════════════════════════
# TOOLS - Pay Tools
# ═══════════════════════════════════════════════════════════════
commit_file "src/tools/binance-pay/index.ts" "💸 Export all Binance Pay MCP tools"
commit_file "src/tools/binance-pay/pay-api/getPayTradeHistory.ts" "📜 Implement MCP tool for Pay history"

# ═══════════════════════════════════════════════════════════════
# TOOLS - Convert Tools
# ═══════════════════════════════════════════════════════════════
commit_file "src/tools/binance-convert/index.ts" "🔄 Export all convert MCP tools"
commit_file "src/tools/binance-convert/market-data-api/index.ts" "📊 Export convert market tools"
commit_file "src/tools/binance-convert/market-data-api/listAllConvertPairs.ts" "📋 Implement MCP tool for pairs"
commit_file "src/tools/binance-convert/market-data-api/queryOrderQuantityPrecisionPerAsset.ts" "🎯 Add MCP tool for precision"
commit_file "src/tools/binance-convert/trade-api/index.ts" "💱 Export convert trade tools"
commit_file "src/tools/binance-convert/trade-api/sendQuoteRequest.ts" "💬 Implement MCP tool for quote"
commit_file "src/tools/binance-convert/trade-api/acceptQuote.ts" "✅ Add MCP tool for accept quote"
commit_file "src/tools/binance-convert/trade-api/orderStatus.ts" "🔍 Implement MCP tool for order status"
commit_file "src/tools/binance-convert/trade-api/placeLimitOrder.ts" "📝 Add MCP tool for limit order"
commit_file "src/tools/binance-convert/trade-api/queryLimitOpenOrders.ts" "📋 Implement MCP tool for open orders"
commit_file "src/tools/binance-convert/trade-api/cancelLimitOrder.ts" "❌ Add MCP tool for cancel limit"
commit_file "src/tools/binance-convert/trade-api/getConvertTradeHistory.ts" "📜 Implement MCP tool for convert history"

# ═══════════════════════════════════════════════════════════════
# TOOLS - C2C Tools
# ═══════════════════════════════════════════════════════════════
commit_file "src/tools/binance-c2c/index.ts" "👤 Export all C2C MCP tools"
commit_file "src/tools/binance-c2c/C2C/getC2CTradeHistory.ts" "📜 Implement MCP tool for C2C history"

# ═══════════════════════════════════════════════════════════════
# TOOLS - Wallet Tools
# ═══════════════════════════════════════════════════════════════
commit_file "src/tools/binance-wallet/index.ts" "👛 Export all wallet MCP tools"
commit_file "src/tools/binance-wallet/account-api/index.ts" "👤 Export wallet account tools"
commit_file "src/tools/binance-wallet/account-api/accountInfo.ts" "💼 Implement MCP tool for account info"
commit_file "src/tools/binance-wallet/account-api/accountStatus.ts" "🔍 Add MCP tool for account status"
commit_file "src/tools/binance-wallet/account-api/accountApiTradingStatus.ts" "📊 Implement MCP tool for trading status"
commit_file "src/tools/binance-wallet/account-api/dailyAccountSnapshot.ts" "📸 Add MCP tool for daily snapshot"
commit_file "src/tools/binance-wallet/account-api/getApiKeyPermission.ts" "🔑 Implement MCP tool for API permissions"
commit_file "src/tools/binance-wallet/account-api/enableFastWithdrawSwitch.ts" "⚡ Add MCP tool for enable fast withdraw"
commit_file "src/tools/binance-wallet/account-api/disableFastWithdrawSwitch.ts" "🐢 Implement MCP tool for disable fast"
commit_file "src/tools/binance-wallet/asset-api/index.ts" "💰 Export wallet asset tools"
commit_file "src/tools/binance-wallet/asset-api/userAsset.ts" "💼 Implement MCP tool for user assets"
commit_file "src/tools/binance-wallet/asset-api/fundingWallet.ts" "🏦 Add MCP tool for funding wallet"
commit_file "src/tools/binance-wallet/asset-api/assetDetail.ts" "📋 Implement MCP tool for asset detail"
commit_file "src/tools/binance-wallet/asset-api/assetDividendRecord.ts" "🎁 Add MCP tool for dividends"
commit_file "src/tools/binance-wallet/asset-api/tradeFee.ts" "💸 Implement MCP tool for trade fees"
commit_file "src/tools/binance-wallet/asset-api/dustlog.ts" "🧹 Add MCP tool for dust log"
commit_file "src/tools/binance-wallet/asset-api/dustTransfer.ts" "🔄 Implement MCP tool for dust transfer"
commit_file "src/tools/binance-wallet/asset-api/getAssetsThatCanBeConvertedIntoBnb.ts" "📋 Add MCP tool for convertible assets"
commit_file "src/tools/binance-wallet/asset-api/userUniversalTransfer.ts" "🔄 Implement MCP tool for transfers"
commit_file "src/tools/binance-wallet/asset-api/queryUserUniversalTransferHistory.ts" "📜 Add MCP tool for transfer history"
commit_file "src/tools/binance-wallet/asset-api/queryUserWalletBalance.ts" "💰 Implement MCP tool for balance"
commit_file "src/tools/binance-wallet/asset-api/queryUserDelegationHistory.ts" "📋 Add MCP tool for delegation history"
commit_file "src/tools/binance-wallet/asset-api/toggleBnbBurnOnSpotTradeAndMarginInterest.ts" "🔥 Implement MCP tool for BNB burn"
commit_file "src/tools/binance-wallet/asset-api/getCloudMiningPaymentAndRefundHistory.ts" "⛏️ Add MCP tool for mining history"
commit_file "src/tools/binance-wallet/asset-api/getOpenSymbolList.ts" "📋 Implement MCP tool for open symbols"
commit_file "src/tools/binance-wallet/capital-api/index.ts" "💳 Export capital management tools"
commit_file "src/tools/binance-wallet/capital-api/allCoinsInformation.ts" "🪙 Implement MCP tool for coins info"
commit_file "src/tools/binance-wallet/capital-api/depositAddress.ts" "📥 Add MCP tool for deposit address"
commit_file "src/tools/binance-wallet/capital-api/fetchDepositAddressListWithNetwork.ts" "📋 Implement MCP tool for network addresses"
commit_file "src/tools/binance-wallet/capital-api/depositHistory.ts" "📜 Add MCP tool for deposit history"
commit_file "src/tools/binance-wallet/capital-api/withdraw.ts" "📤 Implement MCP tool for withdraw"
commit_file "src/tools/binance-wallet/capital-api/withdrawHistory.ts" "📜 Add MCP tool for withdraw history"
commit_file "src/tools/binance-wallet/capital-api/fetchWithdrawAddressList.ts" "📋 Implement MCP tool for address list"
commit_file "src/tools/binance-wallet/capital-api/oneClickArrivalDepositApply.ts" "⚡ Add MCP tool for instant deposit"
commit_file "src/tools/binance-wallet/others-api/index.ts" "📊 Export miscellaneous wallet tools"
commit_file "src/tools/binance-wallet/others-api/systemStatus.ts" "🔧 Implement MCP tool for system status"
commit_file "src/tools/binance-wallet/others-api/getSymbolsDelistScheduleForSpot.ts" "📅 Add MCP tool for delist schedule"
commit_file "src/tools/binance-wallet/travel-rule-api/index.ts" "✈️ Export travel rule tools"
commit_file "src/tools/binance-wallet/travel-rule-api/withdrawTravelRule.ts" "📤 Implement MCP tool for travel withdraw"
commit_file "src/tools/binance-wallet/travel-rule-api/withdrawHistoryV1.ts" "📜 Add MCP tool for history v1"
commit_file "src/tools/binance-wallet/travel-rule-api/withdrawHistoryV2.ts" "📜 Implement MCP tool for history v2"
commit_file "src/tools/binance-wallet/travel-rule-api/depositHistoryTravelRule.ts" "📥 Add MCP tool for deposit history"
commit_file "src/tools/binance-wallet/travel-rule-api/submitDepositQuestionnaire.ts" "📝 Implement MCP tool for questionnaire"
commit_file "src/tools/binance-wallet/travel-rule-api/submitDepositQuestionnaireTravelRule.ts" "✅ Add MCP tool for travel questionnaire"
commit_file "src/tools/binance-wallet/travel-rule-api/onboardedVaspList.ts" "📋 Implement MCP tool for VASP list"
commit_file "src/tools/binance-wallet/travel-rule-api/brokerWithdraw.ts" "🏦 Add MCP tool for broker withdraw"

# ═══════════════════════════════════════════════════════════════
# TOOLS - Rebate Tools
# ═══════════════════════════════════════════════════════════════
commit_file "src/tools/binance-rebate/index.ts" "🎁 Export all rebate MCP tools"
commit_file "src/tools/binance-rebate/rebate-api/getSpotRebateHistoryRecords.ts" "📜 Implement MCP tool for rebate history"

# ═══════════════════════════════════════════════════════════════
# TOOLS - NFT Tools
# ═══════════════════════════════════════════════════════════════
commit_file "src/tools/binance-nft/index.ts" "🖼️ Export all NFT MCP tools"
commit_file "src/tools/binance-nft/nft-api/getNFTAsset.ts" "🎨 Implement MCP tool for NFT assets"
commit_file "src/tools/binance-nft/nft-api/getNFTTransactionHistory.ts" "📜 Add MCP tool for NFT transactions"
commit_file "src/tools/binance-nft/nft-api/getNFTDepositHistory.ts" "📥 Implement MCP tool for NFT deposits"
commit_file "src/tools/binance-nft/nft-api/getNFTWithdrawHistory.ts" "📤 Add MCP tool for NFT withdrawals"

# ═══════════════════════════════════════════════════════════════
# TOOLS - Mining Tools
# ═══════════════════════════════════════════════════════════════
commit_file "src/tools/binance-mining/index.ts" "⛏️ Export all mining MCP tools"
commit_file "src/tools/binance-mining/mining-api/acquiringAlgorithm.ts" "🔧 Implement MCP tool for algorithm query"
commit_file "src/tools/binance-mining/mining-api/acquiringCoinname.ts" "🪙 Add MCP tool for coin names"
commit_file "src/tools/binance-mining/mining-api/requestForMinerList.ts" "👷 Implement MCP tool for miner list"
commit_file "src/tools/binance-mining/mining-api/requestForDetailMinerList.ts" "📋 Add MCP tool for miner details"
commit_file "src/tools/binance-mining/mining-api/accountList.ts" "💼 Implement MCP tool for mining accounts"
commit_file "src/tools/binance-mining/mining-api/statisticList.ts" "📊 Add MCP tool for mining stats"
commit_file "src/tools/binance-mining/mining-api/earningsList.ts" "💰 Implement MCP tool for earnings"
commit_file "src/tools/binance-mining/mining-api/extraBonusList.ts" "🎁 Add MCP tool for extra bonus"
commit_file "src/tools/binance-mining/mining-api/miningAccountEarning.ts" "📈 Implement MCP tool for account earnings"
commit_file "src/tools/binance-mining/mining-api/hashrateResaleList.ts" "📋 Add MCP tool for resale list"
commit_file "src/tools/binance-mining/mining-api/hashrateResaleDetail.ts" "📊 Implement MCP tool for resale details"
commit_file "src/tools/binance-mining/mining-api/hashrateResaleRequest.ts" "📝 Add MCP tool for resale request"
commit_file "src/tools/binance-mining/mining-api/cancelHashrateResaleConfiguration.ts" "⛏️ Add hashrate resale cancellation for mining pool management"

echo ""
echo "✅ All individual commits created!"
echo ""
COMMIT_COUNT=$(git log --oneline | wc -l)
echo "📊 Total commits: $COMMIT_COUNT"
echo ""
echo "📋 First 20 commits:"
git log --oneline | tail -20
echo ""
echo "📋 Last 20 commits:"
git log --oneline | head -20

echo ""
echo "🚀 Ready to push!"
