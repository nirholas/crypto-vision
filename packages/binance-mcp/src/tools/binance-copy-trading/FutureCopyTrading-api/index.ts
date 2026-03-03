// src/tools/binance-copy-trading/FutureCopyTrading-api/index.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerBinanceGetFuturesLeadTraderStatus } from "./getFuturesLeadTraderStatus.js";
import { registerBinanceGetFuturesLeadTradingSymbolWhitelist } from "./getFuturesLeadTradingSymbolWhitelist.js";

// Registers Binance Futures Copy Trading API tools with the MCP server.
export function registerBinanceFutureCopyTradingApiTools(server: McpServer) {
    // Registers an endpoint to get the status of a lead trader in futures copy trading
    registerBinanceGetFuturesLeadTraderStatus(server);

    // Registers an endpoint to get the whitelist of symbols available for futures copy trading
    registerBinanceGetFuturesLeadTradingSymbolWhitelist(server);
}
