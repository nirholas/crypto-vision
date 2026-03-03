// src/tools/binance-futures-coinm/index.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

// Market Data
import { registerBinanceFuturesCOINMPing } from "./ping.js";
import { registerBinanceFuturesCOINMTime } from "./time.js";
import { registerBinanceFuturesCOINMExchangeInfo } from "./exchangeInfo.js";
import { registerBinanceFuturesCOINMDepth } from "./depth.js";
import { registerBinanceFuturesCOINMTrades } from "./trades.js";
import { registerBinanceFuturesCOINMHistoricalTrades } from "./historicalTrades.js";
import { registerBinanceFuturesCOINMAggTrades } from "./aggTrades.js";
import { registerBinanceFuturesCOINMKlines } from "./klines.js";
import { registerBinanceFuturesCOINMContinuousKlines } from "./continuousKlines.js";
import { registerBinanceFuturesCOINMIndexPriceKlines } from "./indexPriceKlines.js";
import { registerBinanceFuturesCOINMMarkPriceKlines } from "./markPriceKlines.js";
import { registerBinanceFuturesCOINMPremiumIndex } from "./premiumIndex.js";
import { registerBinanceFuturesCOINMFundingRate } from "./fundingRate.js";
import { registerBinanceFuturesCOINMTicker24hr } from "./ticker24hr.js";
import { registerBinanceFuturesCOINMTickerPrice } from "./tickerPrice.js";
import { registerBinanceFuturesCOINMBookTicker } from "./bookTicker.js";
import { registerBinanceFuturesCOINMOpenInterest } from "./openInterest.js";

// Account & Trading
import { registerBinanceFuturesCOINMAccount } from "./account.js";
import { registerBinanceFuturesCOINMBalance } from "./balance.js";
import { registerBinanceFuturesCOINMPositionRisk } from "./positionRisk.js";
import { registerBinanceFuturesCOINMNewOrder } from "./newOrder.js";
import { registerBinanceFuturesCOINMBatchOrders } from "./batchOrders.js";
import { registerBinanceFuturesCOINMGetOrder } from "./getOrder.js";
import { registerBinanceFuturesCOINMCancelOrder } from "./cancelOrder.js";
import { registerBinanceFuturesCOINMCancelAllOrders } from "./cancelAllOrders.js";
import { registerBinanceFuturesCOINMCancelBatchOrders } from "./cancelBatchOrders.js";
import { registerBinanceFuturesCOINMOpenOrders } from "./openOrders.js";
import { registerBinanceFuturesCOINMAllOrders } from "./allOrders.js";
import { registerBinanceFuturesCOINMUserTrades } from "./userTrades.js";
import { registerBinanceFuturesCOINMIncome } from "./income.js";
import { registerBinanceFuturesCOINMLeverage } from "./leverage.js";
import { registerBinanceFuturesCOINMMarginType } from "./marginType.js";
import { registerBinanceFuturesCOINMPositionMargin } from "./positionMargin.js";
import { registerBinanceFuturesCOINMPositionMode } from "./positionMode.js";
import { registerBinanceFuturesCOINMCommissionRate } from "./commissionRate.js";
import { registerBinanceFuturesCOINMForceOrders } from "./forceOrders.js";
import { registerBinanceFuturesCOINMADLQuantile } from "./adlQuantile.js";

// User Data Stream
import { registerBinanceFuturesCOINMListenKeyCreate, registerBinanceFuturesCOINMListenKeyRenew, registerBinanceFuturesCOINMListenKeyClose } from "./listenKey.js";

export function registerBinanceFuturesCOINMTools(server: McpServer) {
    // Market Data
    registerBinanceFuturesCOINMPing(server);
    registerBinanceFuturesCOINMTime(server);
    registerBinanceFuturesCOINMExchangeInfo(server);
    registerBinanceFuturesCOINMDepth(server);
    registerBinanceFuturesCOINMTrades(server);
    registerBinanceFuturesCOINMHistoricalTrades(server);
    registerBinanceFuturesCOINMAggTrades(server);
    registerBinanceFuturesCOINMKlines(server);
    registerBinanceFuturesCOINMContinuousKlines(server);
    registerBinanceFuturesCOINMIndexPriceKlines(server);
    registerBinanceFuturesCOINMMarkPriceKlines(server);
    registerBinanceFuturesCOINMPremiumIndex(server);
    registerBinanceFuturesCOINMFundingRate(server);
    registerBinanceFuturesCOINMTicker24hr(server);
    registerBinanceFuturesCOINMTickerPrice(server);
    registerBinanceFuturesCOINMBookTicker(server);
    registerBinanceFuturesCOINMOpenInterest(server);

    // Account & Trading
    registerBinanceFuturesCOINMAccount(server);
    registerBinanceFuturesCOINMBalance(server);
    registerBinanceFuturesCOINMPositionRisk(server);
    registerBinanceFuturesCOINMNewOrder(server);
    registerBinanceFuturesCOINMBatchOrders(server);
    registerBinanceFuturesCOINMGetOrder(server);
    registerBinanceFuturesCOINMCancelOrder(server);
    registerBinanceFuturesCOINMCancelAllOrders(server);
    registerBinanceFuturesCOINMCancelBatchOrders(server);
    registerBinanceFuturesCOINMOpenOrders(server);
    registerBinanceFuturesCOINMAllOrders(server);
    registerBinanceFuturesCOINMUserTrades(server);
    registerBinanceFuturesCOINMIncome(server);
    registerBinanceFuturesCOINMLeverage(server);
    registerBinanceFuturesCOINMMarginType(server);
    registerBinanceFuturesCOINMPositionMargin(server);
    registerBinanceFuturesCOINMPositionMode(server);
    registerBinanceFuturesCOINMCommissionRate(server);
    registerBinanceFuturesCOINMForceOrders(server);
    registerBinanceFuturesCOINMADLQuantile(server);

    // User Data Stream
    registerBinanceFuturesCOINMListenKeyCreate(server);
    registerBinanceFuturesCOINMListenKeyRenew(server);
    registerBinanceFuturesCOINMListenKeyClose(server);
}
