// src/tools/binance-dual-investment/market-api/index.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerBinanceGetDualInvestmentProductList } from "./getDualInvestmentProductList.js";

export function registerBinanceDualInvestmentMarketApiTools(server: McpServer) {
    registerBinanceGetDualInvestmentProductList(server);
}
