// src/tools/binance-simple-earn/earn-api/index.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerBinanceSubscribeFlexibleProduct } from "./subscribeFlexibleProduct.js";
import { registerBinanceRedeemFlexibleProduct } from "./redeemFlexibleProduct.js";

export function registerBinanceSimpleEarnApiTools(server: McpServer) {
    // Register the route for subscribing to a flexible earn product
    registerBinanceSubscribeFlexibleProduct(server);

    // Register the route for redeeming from a flexible earn product
    registerBinanceRedeemFlexibleProduct(server);
}
