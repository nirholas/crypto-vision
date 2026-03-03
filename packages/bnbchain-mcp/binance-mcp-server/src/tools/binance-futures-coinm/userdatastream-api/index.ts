/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-futures-coinm/userdatastream-api/index.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerBinanceDeliveryCreateListenKey } from "./createListenKey.js";
import { registerBinanceDeliveryKeepAliveListenKey } from "./keepAliveListenKey.js";
import { registerBinanceDeliveryCloseListenKey } from "./closeListenKey.js";

export function registerBinanceDeliveryUserDataStreamApiTools(server: McpServer) {
    // User Data Stream (Listen Key) Management
    registerBinanceDeliveryCreateListenKey(server);
    registerBinanceDeliveryKeepAliveListenKey(server);
    registerBinanceDeliveryCloseListenKey(server);
}
