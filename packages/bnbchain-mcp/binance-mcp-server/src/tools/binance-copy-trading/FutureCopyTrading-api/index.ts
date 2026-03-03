/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-copy-trading/FutureCopyTrading-api/index.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerBinanceGetFuturesLeadTraderStatus } from "./getFuturesLeadTraderStatus.js";
import { registerBinanceGetFuturesLeadTradingSymbolWhitelist } from "./getFuturesLeadTradingSymbolWhitelist.js";
import { registerBinanceCopyTradingGetLeaders } from "./getLeadTraders.js";
import { registerBinanceCopyTradingGetPerformance } from "./getTraderPerformance.js";
import { registerBinanceCopyTradingFollow } from "./followTrader.js";
import { registerBinanceCopyTradingUnfollow } from "./unfollowTrader.js";
import { registerBinanceCopyTradingGetFollowing } from "./getFollowingTraders.js";
import { registerBinanceCopyTradingGetOrders } from "./getCopyOrders.js";
import { registerBinanceCopyTradingGetPositions } from "./getCopyPositions.js";

// Registers Binance Futures Copy Trading API tools with the MCP server.
export function registerBinanceFutureCopyTradingApiTools(server: McpServer) {
    // Lead trader info
    registerBinanceGetFuturesLeadTraderStatus(server);
    registerBinanceGetFuturesLeadTradingSymbolWhitelist(server);
    registerBinanceCopyTradingGetLeaders(server);
    registerBinanceCopyTradingGetPerformance(server);
    
    // Following management
    registerBinanceCopyTradingFollow(server);
    registerBinanceCopyTradingUnfollow(server);
    registerBinanceCopyTradingGetFollowing(server);
    
    // Orders and positions
    registerBinanceCopyTradingGetOrders(server);
    registerBinanceCopyTradingGetPositions(server);
}
