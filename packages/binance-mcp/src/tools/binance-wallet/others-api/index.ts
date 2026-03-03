//src/tools/binance-wallet/others-api/index.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerBinanceWalletSystemStatus } from "./systemStatus.js";
import { registerBinanceWalletGetSymbolsDelistScheduleForSpot } from "./getSymbolsDelistScheduleForSpot.js";

export function registerBinanceWalletOthersApiTools(server: McpServer) {
    registerBinanceWalletSystemStatus(server);
    registerBinanceWalletGetSymbolsDelistScheduleForSpot(server);
    
}