// src/tools/binance-spot/general-api/index.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerBinancePing } from "./ping.js";
import { registerBinanceTime } from "./time.js";
import { registerBinanceExchangeInfo } from "./exchangeInfo.js";

export function registerBinanceGeneralApiTools(server: McpServer) {
    registerBinancePing(server);
    registerBinanceTime(server);
    registerBinanceExchangeInfo(server);
    
}
