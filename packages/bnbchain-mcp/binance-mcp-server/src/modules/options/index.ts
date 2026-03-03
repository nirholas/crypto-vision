/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/modules/options/index.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerOptionsMarketApi } from "./market-api/index.js";
import { registerOptionsTradeApi } from "./trade-api/index.js";
import { registerOptionsAccountApi } from "./account-api/index.js";
import { registerOptionsUserdataApi } from "./userdata-api/index.js";

export function registerOptions(server: McpServer) {
    // Market Data API
    registerOptionsMarketApi(server);
    
    // Trade API
    registerOptionsTradeApi(server);
    
    // Account API
    registerOptionsAccountApi(server);
    
    // User Data Stream API
    registerOptionsUserdataApi(server);
}
