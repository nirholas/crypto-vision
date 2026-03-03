/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/modules/options/trade-api/index.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerOptionsNewOrder } from "./newOrder.js";
import { registerOptionsBatchOrders } from "./batchOrders.js";
import { registerOptionsCancelOrder } from "./cancelOrder.js";
import { registerOptionsCancelBatchOrders } from "./cancelBatchOrders.js";
import { registerOptionsCancelAllOrders } from "./cancelAllOrders.js";
import { registerOptionsCancelBySymbol } from "./cancelBySymbol.js";
import { registerOptionsGetOpenOrders } from "./getOpenOrders.js";
import { registerOptionsGetHistoryOrders } from "./getHistoryOrders.js";
import { registerOptionsGetUserTrades } from "./getUserTrades.js";

export function registerOptionsTradeApi(server: McpServer) {
    registerOptionsNewOrder(server);
    registerOptionsBatchOrders(server);
    registerOptionsCancelOrder(server);
    registerOptionsCancelBatchOrders(server);
    registerOptionsCancelAllOrders(server);
    registerOptionsCancelBySymbol(server);
    registerOptionsGetOpenOrders(server);
    registerOptionsGetHistoryOrders(server);
    registerOptionsGetUserTrades(server);
}
