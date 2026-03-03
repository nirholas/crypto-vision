// src/tools/binance-spot/trade-api/index.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerBinanceDeleteOrder } from "./deleteOrder.js";
import { registerBinanceAllOrders } from "./allOrders.js";
import { registerBinanceOpenOrderList } from "./openOrderList.js";
import { registerBinanceNewOrder } from "./newOrder.js";
import { registerBinanceGetOrder } from "./getOrder.js";
import { registerBinanceGetOpenOrders } from "./getOpenOrders.js";
import { registerBinanceDeleteOpenOrders } from "./deleteOpenOrders.js";
import { registerBinanceOrderOco } from "./orderOco.js";

export function registerBinanceTradeApiTools(server: McpServer) {
    registerBinanceDeleteOrder(server);
    registerBinanceAllOrders(server);
    registerBinanceOpenOrderList(server);
    registerBinanceNewOrder(server);
    registerBinanceGetOrder(server);
    registerBinanceGetOpenOrders(server);
    registerBinanceDeleteOpenOrders(server);
    registerBinanceOrderOco(server);
    
}