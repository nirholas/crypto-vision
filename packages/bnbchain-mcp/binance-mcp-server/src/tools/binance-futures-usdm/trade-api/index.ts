/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-futures-usdm/trade-api/index.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerBinanceFuturesNewOrder } from "./newOrder.js";
import { registerBinanceFuturesBatchOrders } from "./batchOrders.js";
import { registerBinanceFuturesGetOrder } from "./getOrder.js";
import { registerBinanceFuturesCancelOrder } from "./cancelOrder.js";
import { registerBinanceFuturesCancelAllOrders } from "./cancelAllOrders.js";
import { registerBinanceFuturesCancelBatchOrders } from "./cancelBatchOrders.js";
import { registerBinanceFuturesCountdownCancelAll } from "./countdownCancelAll.js";
import { registerBinanceFuturesGetOpenOrder } from "./getOpenOrder.js";
import { registerBinanceFuturesGetOpenOrders } from "./getOpenOrders.js";
import { registerBinanceFuturesGetAllOrders } from "./getAllOrders.js";
import { registerBinanceFuturesModifyOrder } from "./modifyOrder.js";
import { registerBinanceFuturesChangeLeverage } from "./changeLeverage.js";
import { registerBinanceFuturesChangeMarginType } from "./changeMarginType.js";
import { registerBinanceFuturesModifyIsolatedPositionMargin } from "./modifyIsolatedPositionMargin.js";
import { registerBinanceFuturesPositionMarginHistory } from "./positionMarginHistory.js";
import { registerBinanceFuturesChangePositionMode } from "./changePositionMode.js";
import { registerBinanceFuturesChangeMultiAssetsMode } from "./changeMultiAssetsMode.js";

export function registerBinanceFuturesTradeApiTools(server: McpServer) {
    // Order Placement
    registerBinanceFuturesNewOrder(server);
    registerBinanceFuturesBatchOrders(server);
    registerBinanceFuturesModifyOrder(server);
    
    // Order Query
    registerBinanceFuturesGetOrder(server);
    registerBinanceFuturesGetOpenOrder(server);
    registerBinanceFuturesGetOpenOrders(server);
    registerBinanceFuturesGetAllOrders(server);
    
    // Order Cancellation
    registerBinanceFuturesCancelOrder(server);
    registerBinanceFuturesCancelAllOrders(server);
    registerBinanceFuturesCancelBatchOrders(server);
    registerBinanceFuturesCountdownCancelAll(server);
    
    // Leverage & Margin
    registerBinanceFuturesChangeLeverage(server);
    registerBinanceFuturesChangeMarginType(server);
    registerBinanceFuturesModifyIsolatedPositionMargin(server);
    registerBinanceFuturesPositionMarginHistory(server);
    
    // Position & Asset Modes
    registerBinanceFuturesChangePositionMode(server);
    registerBinanceFuturesChangeMultiAssetsMode(server);
}
