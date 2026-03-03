// src/tools/binance-spot/index.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerBinanceMarketApiTools } from "./market-api/index.js";
import { registerBinanceTradeApiTools } from "./trade-api/index.js";
import { registerBinanceAccountApiTools } from "./account-api/index.js";
import { registerBinanceUserDataStreamApiTools } from "./userdatastream-api/index.js";
import { registerBinanceGeneralApiTools } from "./general-api/index.js";

export function registerBinanceSpotTools(server: McpServer) {
    // Trade API tools
    registerBinanceTradeApiTools(server);
    
    // Market API tools
    registerBinanceMarketApiTools(server);
    
    // Account API tools
    registerBinanceAccountApiTools(server);
    
    // User Data Stream API tools
    registerBinanceUserDataStreamApiTools(server);
    
    // General API tools
    registerBinanceGeneralApiTools(server);
    
}
