/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-futures-coinm/index.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerBinanceDeliveryMarketApiTools } from "./market-api/index.js";
import { registerBinanceDeliveryAccountApiTools } from "./account-api/index.js";
import { registerBinanceDeliveryTradeApiTools } from "./trade-api/index.js";
import { registerBinanceDeliveryUserDataStreamApiTools } from "./userdatastream-api/index.js";

export function registerBinanceFuturesCOINMTools(server: McpServer) {
    // Market Data API tools
    registerBinanceDeliveryMarketApiTools(server);
    
    // Account API tools
    registerBinanceDeliveryAccountApiTools(server);
    
    // Trade API tools
    registerBinanceDeliveryTradeApiTools(server);
    
    // User Data Stream API tools
    registerBinanceDeliveryUserDataStreamApiTools(server);
}
