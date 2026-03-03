// src/modules/futures-coinm/index.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerBinanceFuturesCOINMTools } from "../../tools/binance-futures-coinm/index.js";

export function registerFuturesCOINM(server: McpServer) {
    registerBinanceFuturesCOINMTools(server);
}
