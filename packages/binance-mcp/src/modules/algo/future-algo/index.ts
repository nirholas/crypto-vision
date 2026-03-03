// src/tools/binance-spot/market-api/index.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerBinanceVPNewTrade } from "./VPNewTrade.js";
import { registerBinanceFutureHistoricalAlgoOrder } from "./historicalAlgoOrder.js";
import { registerBinanceFutureCancelAlgoOrder } from "./cancelAlgoOrder.js";
import { registerBinanceFutureCurrentAlgoOpenOrders } from "./currentAlgoOpenOrders.js";
import { registerBinanceFutureSubOrders } from "./subOrders.js";
import { registerBinanceTwapNewTrade } from "./TwapNewTrade.js";

export function registerBinanceAlgoFutureApiTools(server: McpServer) {
    // Registers a new VP (Volume Participation) trade
    registerBinanceVPNewTrade(server);

    // Registers a new TWAP (Time-Weighted Average Price) trade
    registerBinanceTwapNewTrade(server);

    // Registers functionality to cancel an algorithmic order
    registerBinanceFutureCancelAlgoOrder(server);

    // Registers API to query sub-orders of an algorithmic order
    registerBinanceFutureSubOrders(server);

    // Registers API to retrieve currently open algorithmic orders
    registerBinanceFutureCurrentAlgoOpenOrders(server);

    // Registers API to fetch historical algorithmic orders
    registerBinanceFutureHistoricalAlgoOrder(server);
}
