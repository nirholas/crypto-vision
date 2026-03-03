/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-futures-usdm/index.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerBinanceFuturesAccountApiTools } from "./account-api/index.js";
import { registerBinanceFuturesMarketApiTools } from "./market-api/index.js";
import { registerBinanceFuturesTradeApiTools } from "./trade-api/index.js";
import { registerBinanceFuturesUserDataStreamApiTools } from "./userdatastream-api/index.js";

export function registerBinanceFuturesUSDMTools(server: McpServer) {
    // Market Data API tools
    registerBinanceFuturesMarketApiTools(server);
    
    // Account API tools
    registerBinanceFuturesAccountApiTools(server);
    
    // Trade API tools
    registerBinanceFuturesTradeApiTools(server);
    
    // User Data Stream API tools
    registerBinanceFuturesUserDataStreamApiTools(server);
}
