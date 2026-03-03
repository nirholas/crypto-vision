// src/modules/options/index.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerBinanceOptionsTools } from "../../tools/binance-options/index.js";

export function registerOptions(server: McpServer) {
    registerBinanceOptionsTools(server);
}
