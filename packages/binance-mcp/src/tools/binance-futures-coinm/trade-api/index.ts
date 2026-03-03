/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/tools/binance-futures-coinm/trade-api/index.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerBinanceDeliveryNewOrder } from "./newOrder.js";
import { registerBinanceDeliveryBatchOrders } from "./batchOrders.js";
import { registerBinanceDeliveryGetOrder } from "./getOrder.js";
import { registerBinanceDeliveryCancelOrder } from "./cancelOrder.js";
import { registerBinanceDeliveryCancelAllOrders } from "./cancelAllOrders.js";
import { registerBinanceDeliveryCancelBatchOrders } from "./cancelBatchOrders.js";
import { registerBinanceDeliveryCountdownCancelAll } from "./countdownCancelAll.js";
import { registerBinanceDeliveryOpenOrder } from "./openOrder.js";
import { registerBinanceDeliveryOpenOrders } from "./openOrders.js";
import { registerBinanceDeliveryAllOrders } from "./allOrders.js";
import { registerBinanceDeliveryChangeLeverage } from "./changeLeverage.js";
import { registerBinanceDeliveryChangeMarginType } from "./changeMarginType.js";
import { registerBinanceDeliveryModifyIsolatedPositionMargin } from "./modifyIsolatedPositionMargin.js";
import { registerBinanceDeliveryChangePositionMode } from "./changePositionMode.js";

export function registerBinanceDeliveryTradeApiTools(server: McpServer) {
    // Order Placement
    registerBinanceDeliveryNewOrder(server);
    registerBinanceDeliveryBatchOrders(server);
    
    // Order Query
    registerBinanceDeliveryGetOrder(server);
    registerBinanceDeliveryOpenOrder(server);
    registerBinanceDeliveryOpenOrders(server);
    registerBinanceDeliveryAllOrders(server);
    
    // Order Cancellation
    registerBinanceDeliveryCancelOrder(server);
    registerBinanceDeliveryCancelAllOrders(server);
    registerBinanceDeliveryCancelBatchOrders(server);
    registerBinanceDeliveryCountdownCancelAll(server);
    
    // Leverage & Margin
    registerBinanceDeliveryChangeLeverage(server);
    registerBinanceDeliveryChangeMarginType(server);
    registerBinanceDeliveryModifyIsolatedPositionMargin(server);
    
    // Position Mode
    registerBinanceDeliveryChangePositionMode(server);
}
