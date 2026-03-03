// src/tools/binance-spot/market-api/index.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerBinanceSpotTwapNewTrade } from "./spotTWAPOrder.js";
import { registerBinanceSpotCancelOpenTWAPOrder } from "./cancelOpenTWAPOrder.js";
import { registerBinanceSpotSubOrders } from "./subOrders.js";
import { registerBinanceSpotCurrentAlgoOpenOrders } from "./currentAlgoOpenOrders.js";
import { registerBinanceSpotHistoricalAlgoOrders } from "./historicalAlgoOrders.js";

export function registerBinanceAlgoSpotApiTools(server: McpServer) {
    // Register the TWAP (Time-Weighted Average Price) tool for placing new spot algo orders
    registerBinanceSpotTwapNewTrade(server);

    // Register the tool for canceling open TWAP spot algo orders
    registerBinanceSpotCancelOpenTWAPOrder(server);

    // Register the tool to handle sub-orders created under a parent algo order
    registerBinanceSpotSubOrders(server);

    // Register the tool to fetch currently open algo orders for spot trading
    registerBinanceSpotCurrentAlgoOpenOrders(server);

    // Register the tool to fetch historical algo orders for spot trading
    registerBinanceSpotHistoricalAlgoOrders(server);
}
