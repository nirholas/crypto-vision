/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/modules/c2c/index.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerBinanceGetC2CTradeHistory } from "./C2C/getC2CTradeHistory.js";
import { registerBinanceC2CGetAds } from "./C2C/getAds.js";

export function registerC2C(server: McpServer) {
    // Trade history
    registerBinanceGetC2CTradeHistory(server);
    
    // Browse ads
    registerBinanceC2CGetAds(server);
}

export { registerC2C as registerBinanceC2CTradeHistoryTools };
