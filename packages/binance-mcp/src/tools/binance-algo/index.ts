// src/tools/binance-spot/index.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerBinanceAlgoFutureApiTools } from "./future-algo/index.js";
import { registerBinanceAlgoSpotApiTools } from "./spot-algo/index.js";

export function registerBinanceAlgoTools(server: McpServer) {
    // Algo API tools
    registerBinanceAlgoFutureApiTools(server);
    registerBinanceAlgoSpotApiTools(server);
}
