// src/modules/sub-account/index.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerBinanceSubAccountTools } from "../../tools/binance-sub-account/index.js";

export function registerSubAccount(server: McpServer) {
    registerBinanceSubAccountTools(server);
}
