/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/tools/binance-futures-usdm/userdatastream-api/index.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerBinanceFuturesCreateListenKey } from "./createListenKey.js";
import { registerBinanceFuturesKeepAliveListenKey } from "./keepAliveListenKey.js";
import { registerBinanceFuturesCloseListenKey } from "./closeListenKey.js";

export function registerBinanceFuturesUserDataStreamApiTools(server: McpServer) {
    // User Data Stream (Listen Key) Management
    registerBinanceFuturesCreateListenKey(server);
    registerBinanceFuturesKeepAliveListenKey(server);
    registerBinanceFuturesCloseListenKey(server);
}
