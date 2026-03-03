// src/tools/binance-convert/market-data-api/index.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerBinanceConvertQueryOrderQuantityPrecisionPerAsset } from "./queryOrderQuantityPrecisionPerAsset.js";
import { registerBinanceConvertGetListAllConvertPairs } from "./listAllConvertPairs.js";

export function registerBinanceConvertMarketDataTools(server: McpServer) {
    // Register the route to get a list of all supported convert trading pairs
    registerBinanceConvertGetListAllConvertPairs(server);

    // Register the route to get quantity precision details for each asset
    registerBinanceConvertQueryOrderQuantityPrecisionPerAsset(server);
}
