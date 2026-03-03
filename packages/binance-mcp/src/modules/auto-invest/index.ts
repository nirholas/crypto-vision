// src/modules/auto-invest/index.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerBinanceAutoInvestTools } from "../../tools/binance-auto-invest/index.js";

export function registerAutoInvest(server: McpServer) {
    registerBinanceAutoInvestTools(server);
}
