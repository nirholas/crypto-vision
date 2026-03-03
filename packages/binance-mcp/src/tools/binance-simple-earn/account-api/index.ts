// src/tools/binance-simple-earn/account-api/index.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerBinanceSimpleEarnFlexibleProductList } from "./simpleEarnFlexibleProductList.js";
import { registerBinanceGetFlexibleProductPosition } from "./getFlexibleProductPosition.js";

export function registerBinanceSimpleEarnAccountApiTools(server: McpServer) {
    // Registers a tool to get the list of flexible earning products
    registerBinanceSimpleEarnFlexibleProductList(server);

    // Registers a tool to get the user's position in flexible earning products
    registerBinanceGetFlexibleProductPosition(server);
}
