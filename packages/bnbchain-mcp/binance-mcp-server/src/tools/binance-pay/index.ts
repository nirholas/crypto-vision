/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-pay/index.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerBinanceGetPayTradeHistory } from "./pay-api/getPayTradeHistory.js";

export function registerBinancePayTools(server: McpServer) {
    registerBinanceGetPayTradeHistory(server);
}

export { registerBinancePayTools as registerPayTools };
