/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-copy-trading/index.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerBinanceFutureCopyTradingApiTools } from "./FutureCopyTrading-api/index.js";

// Registers all Binance Copy Trading related tools with the MCP server.
export function registerBinanceCopyTradingTools(server: McpServer) {
    // Register the Binance Futures Copy Trading API tools with the given server.
    registerBinanceFutureCopyTradingApiTools(server);
}
