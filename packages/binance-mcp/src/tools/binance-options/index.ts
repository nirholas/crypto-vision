// src/tools/binance-options/index.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

// Market Data
import { registerBinanceOptionsPing } from "./ping.js";
import { registerBinanceOptionsTime } from "./time.js";
import { registerBinanceOptionsExchangeInfo } from "./exchangeInfo.js";
import { registerBinanceOptionsDepth } from "./depth.js";
import { registerBinanceOptionsTrades } from "./trades.js";
import { registerBinanceOptionsHistoricalTrades } from "./historicalTrades.js";
import { registerBinanceOptionsKlines } from "./klines.js";
import { registerBinanceOptionsMark } from "./mark.js";
import { registerBinanceOptionsTicker } from "./ticker.js";
import { registerBinanceOptionsIndexPrice } from "./indexPrice.js";
import { registerBinanceOptionsExerciseHistory } from "./exerciseHistory.js";
import { registerBinanceOptionsOpenInterest } from "./openInterest.js";

// Account & Trading
import { registerBinanceOptionsAccount } from "./account.js";
import { registerBinanceOptionsNewOrder } from "./newOrder.js";
import { registerBinanceOptionsBatchOrders } from "./batchOrders.js";
import { registerBinanceOptionsCancelOrder } from "./cancelOrder.js";
import { registerBinanceOptionsCancelAllOrders } from "./cancelAllOrders.js";
import { registerBinanceOptionsCancelBatchOrders } from "./cancelBatchOrders.js";
import { registerBinanceOptionsGetOrder } from "./getOrder.js";
import { registerBinanceOptionsOpenOrders } from "./openOrders.js";
import { registerBinanceOptionsHistoryOrders } from "./historyOrders.js";
import { registerBinanceOptionsPosition } from "./position.js";
import { registerBinanceOptionsUserTrades } from "./userTrades.js";
import { registerBinanceOptionsExerciseRecord } from "./exerciseRecord.js";
import { registerBinanceOptionsBill } from "./bill.js";

// User Data Stream
import { 
    registerBinanceOptionsCreateListenKey, 
    registerBinanceOptionsKeepAliveListenKey, 
    registerBinanceOptionsDeleteListenKey 
} from "./listenKey.js";

export function registerBinanceOptionsTools(server: McpServer) {
    // Market Data
    registerBinanceOptionsPing(server);
    registerBinanceOptionsTime(server);
    registerBinanceOptionsExchangeInfo(server);
    registerBinanceOptionsDepth(server);
    registerBinanceOptionsTrades(server);
    registerBinanceOptionsHistoricalTrades(server);
    registerBinanceOptionsKlines(server);
    registerBinanceOptionsMark(server);
    registerBinanceOptionsTicker(server);
    registerBinanceOptionsIndexPrice(server);
    registerBinanceOptionsExerciseHistory(server);
    registerBinanceOptionsOpenInterest(server);
    
    // Account & Trading
    registerBinanceOptionsAccount(server);
    registerBinanceOptionsNewOrder(server);
    registerBinanceOptionsBatchOrders(server);
    registerBinanceOptionsCancelOrder(server);
    registerBinanceOptionsCancelAllOrders(server);
    registerBinanceOptionsCancelBatchOrders(server);
    registerBinanceOptionsGetOrder(server);
    registerBinanceOptionsOpenOrders(server);
    registerBinanceOptionsHistoryOrders(server);
    registerBinanceOptionsPosition(server);
    registerBinanceOptionsUserTrades(server);
    registerBinanceOptionsExerciseRecord(server);
    registerBinanceOptionsBill(server);
    
    // User Data Stream
    registerBinanceOptionsCreateListenKey(server);
    registerBinanceOptionsKeepAliveListenKey(server);
    registerBinanceOptionsDeleteListenKey(server);
}
