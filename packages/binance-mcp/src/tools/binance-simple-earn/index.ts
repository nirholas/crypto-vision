// src/tools/binance-simple-earn/index.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerBinanceSimpleEarnApiTools } from "./earn-api/index.js";
import { registerBinanceSimpleEarnAccountApiTools } from "./account-api/index.js";

export function registerBinanceSimpleEarnTools(server: McpServer) {
    // Registers core API tools like subscribing to flexible products
    registerBinanceSimpleEarnApiTools(server);

    // Registers account-related tools like viewing product lists and positions
    registerBinanceSimpleEarnAccountApiTools(server);
}
