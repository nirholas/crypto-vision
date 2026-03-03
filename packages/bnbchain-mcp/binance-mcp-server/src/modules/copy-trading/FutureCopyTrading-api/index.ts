/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/modules/copy-trading/FutureCopyTrading-api/index.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerBinanceGetFuturesLeadTraderStatus } from "./getFuturesLeadTraderStatus.js";
import { registerBinanceGetFuturesLeadTradingSymbolWhitelist } from "./getFuturesLeadTradingSymbolWhitelist.js";
import { registerBinanceGetLeadTraders } from "./getLeadTraders.js";
import { registerBinanceGetTraderPerformance } from "./getTraderPerformance.js";
import { registerBinanceGetTraderPositions } from "./getTraderPositions.js";
import { registerBinanceGetTraderSymbolStats } from "./getTraderSymbolStats.js";
import { registerBinanceCopyTradingFollowTrader } from "./followTrader.js";
import { registerBinanceCopyTradingUnfollowTrader } from "./unfollowTrader.js";
import { registerBinanceCopyTradingGetFollowingTraders } from "./getFollowingTraders.js";
import { registerBinanceCopyTradingGetCopyOrders } from "./getCopyOrders.js";
import { registerBinanceCopyTradingGetCopyPositions } from "./getCopyPositions.js";

// Registers Binance Futures Copy Trading API tools with the MCP server.
export function registerBinanceFutureCopyTradingApiTools(server: McpServer) {
    // Lead trader status and symbol whitelist
    registerBinanceGetFuturesLeadTraderStatus(server);
    registerBinanceGetFuturesLeadTradingSymbolWhitelist(server);
    
    // Browse lead traders
    registerBinanceGetLeadTraders(server);
    registerBinanceGetTraderPerformance(server);
    registerBinanceGetTraderPositions(server);
    registerBinanceGetTraderSymbolStats(server);
    
    // Follow/unfollow traders
    registerBinanceCopyTradingFollowTrader(server);
    registerBinanceCopyTradingUnfollowTrader(server);
    registerBinanceCopyTradingGetFollowingTraders(server);
    
    // Copy trading orders and positions
    registerBinanceCopyTradingGetCopyOrders(server);
    registerBinanceCopyTradingGetCopyPositions(server);
}
