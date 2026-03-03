// src/tools/binance-margin/index.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerBinanceCrossMarginTools } from "./cross-margin-api/index.js";
import { registerBinanceIsolatedMarginTools } from "./isolated-margin-api/index.js";

export function registerBinanceMarginTools(server: McpServer) {
    // Cross Margin API tools
    registerBinanceCrossMarginTools(server);
    
    // Isolated Margin API tools
    registerBinanceIsolatedMarginTools(server);
}
