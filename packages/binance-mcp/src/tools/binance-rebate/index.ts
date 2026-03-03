// src/tools/binance-rebate/index.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerBinanceGetSpotRebateHistoryRecords } from "./rebate-api/getSpotRebateHistoryRecords.js";

export function registerBinanceRebateTools(server: McpServer) {
    registerBinanceGetSpotRebateHistoryRecords(server);
}
