/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/modules/pay/index.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerBinanceGetPayTradeHistory } from "./pay-api/getPayTradeHistory.js";
import { registerBinancePayCreateOrder } from "./pay-api/createOrder.js";
import { registerBinancePayQueryOrder } from "./pay-api/queryOrder.js";
import { registerBinancePayGetHistory } from "./pay-api/getHistory.js";

export function registerPay(server: McpServer) {
    // Legacy tool
    registerBinanceGetPayTradeHistory(server);
    
    // New comprehensive tools
    registerBinancePayCreateOrder(server);
    registerBinancePayQueryOrder(server);
    registerBinancePayGetHistory(server);
}

export { registerPay as registerBinancePayTools };
