// src/tools/binance-futures-usdm/index.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

// Market Data
import { registerBinanceFuturesUSDMPing } from "./ping.js";
import { registerBinanceFuturesUSDMTime } from "./time.js";
import { registerBinanceFuturesUSDMExchangeInfo } from "./exchangeInfo.js";
import { registerBinanceFuturesUSDMDepth } from "./depth.js";
import { registerBinanceFuturesUSDMTrades } from "./trades.js";
import { registerBinanceFuturesUSDMHistoricalTrades } from "./historicalTrades.js";
import { registerBinanceFuturesUSDMAggTrades } from "./aggTrades.js";
import { registerBinanceFuturesUSDMKlines } from "./klines.js";
import { registerBinanceFuturesUSDMContinuousKlines } from "./continuousKlines.js";
import { registerBinanceFuturesUSDMIndexPriceKlines } from "./indexPriceKlines.js";
import { registerBinanceFuturesUSDMMarkPriceKlines } from "./markPriceKlines.js";
import { registerBinanceFuturesUSDMPremiumIndex } from "./premiumIndex.js";
import { registerBinanceFuturesUSDMFundingRate } from "./fundingRate.js";
import { registerBinanceFuturesUSDMTicker24hr } from "./ticker24hr.js";
import { registerBinanceFuturesUSDMTickerPrice } from "./tickerPrice.js";
import { registerBinanceFuturesUSDMBookTicker } from "./bookTicker.js";
import { registerBinanceFuturesUSDMOpenInterest } from "./openInterest.js";

// Account & Trading
import { registerBinanceFuturesUSDMAccount } from "./account.js";
import { registerBinanceFuturesUSDMBalance } from "./balance.js";
import { registerBinanceFuturesUSDMPositionRisk } from "./positionRisk.js";
import { registerBinanceFuturesUSDMNewOrder } from "./newOrder.js";
import { registerBinanceFuturesUSDMBatchOrders } from "./batchOrders.js";
import { registerBinanceFuturesUSDMGetOrder } from "./getOrder.js";
import { registerBinanceFuturesUSDMCancelOrder } from "./cancelOrder.js";
import { registerBinanceFuturesUSDMCancelAllOrders } from "./cancelAllOrders.js";
import { registerBinanceFuturesUSDMCancelBatchOrders } from "./cancelBatchOrders.js";
import { registerBinanceFuturesUSDMOpenOrders } from "./openOrders.js";
import { registerBinanceFuturesUSDMAllOrders } from "./allOrders.js";
import { registerBinanceFuturesUSDMUserTrades } from "./userTrades.js";
import { registerBinanceFuturesUSDMIncome } from "./income.js";
import { registerBinanceFuturesUSDMLeverage } from "./leverage.js";
import { registerBinanceFuturesUSDMMarginType } from "./marginType.js";
import { registerBinanceFuturesUSDMPositionMargin } from "./positionMargin.js";
import { registerBinanceFuturesUSDMPositionMode } from "./positionMode.js";
import { registerBinanceFuturesUSDMMultiAssetsMode } from "./multiAssetsMode.js";
import { registerBinanceFuturesUSDMCommissionRate } from "./commissionRate.js";
import { registerBinanceFuturesUSDMForceOrders } from "./forceOrders.js";
import { registerBinanceFuturesUSDMADLQuantile } from "./adlQuantile.js";

// User Data Stream
import { registerBinanceFuturesUSDMListenKeyCreate, registerBinanceFuturesUSDMListenKeyRenew, registerBinanceFuturesUSDMListenKeyClose } from "./listenKey.js";

export function registerBinanceFuturesUSDMTools(server: McpServer) {
    // Market Data
    registerBinanceFuturesUSDMPing(server);
    registerBinanceFuturesUSDMTime(server);
    registerBinanceFuturesUSDMExchangeInfo(server);
    registerBinanceFuturesUSDMDepth(server);
    registerBinanceFuturesUSDMTrades(server);
    registerBinanceFuturesUSDMHistoricalTrades(server);
    registerBinanceFuturesUSDMAggTrades(server);
    registerBinanceFuturesUSDMKlines(server);
    registerBinanceFuturesUSDMContinuousKlines(server);
    registerBinanceFuturesUSDMIndexPriceKlines(server);
    registerBinanceFuturesUSDMMarkPriceKlines(server);
    registerBinanceFuturesUSDMPremiumIndex(server);
    registerBinanceFuturesUSDMFundingRate(server);
    registerBinanceFuturesUSDMTicker24hr(server);
    registerBinanceFuturesUSDMTickerPrice(server);
    registerBinanceFuturesUSDMBookTicker(server);
    registerBinanceFuturesUSDMOpenInterest(server);

    // Account & Trading
    registerBinanceFuturesUSDMAccount(server);
    registerBinanceFuturesUSDMBalance(server);
    registerBinanceFuturesUSDMPositionRisk(server);
    registerBinanceFuturesUSDMNewOrder(server);
    registerBinanceFuturesUSDMBatchOrders(server);
    registerBinanceFuturesUSDMGetOrder(server);
    registerBinanceFuturesUSDMCancelOrder(server);
    registerBinanceFuturesUSDMCancelAllOrders(server);
    registerBinanceFuturesUSDMCancelBatchOrders(server);
    registerBinanceFuturesUSDMOpenOrders(server);
    registerBinanceFuturesUSDMAllOrders(server);
    registerBinanceFuturesUSDMUserTrades(server);
    registerBinanceFuturesUSDMIncome(server);
    registerBinanceFuturesUSDMLeverage(server);
    registerBinanceFuturesUSDMMarginType(server);
    registerBinanceFuturesUSDMPositionMargin(server);
    registerBinanceFuturesUSDMPositionMode(server);
    registerBinanceFuturesUSDMMultiAssetsMode(server);
    registerBinanceFuturesUSDMCommissionRate(server);
    registerBinanceFuturesUSDMForceOrders(server);
    registerBinanceFuturesUSDMADLQuantile(server);

    // User Data Stream
    registerBinanceFuturesUSDMListenKeyCreate(server);
    registerBinanceFuturesUSDMListenKeyRenew(server);
    registerBinanceFuturesUSDMListenKeyClose(server);
}
