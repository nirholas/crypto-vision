// src/tools/binance-dual-investment/index.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerBinanceDualInvestmentTradeApiTools } from "./trade-api/index.js";
import { registerBinanceDualInvestmentMarketApiTools } from "./market-api/index.js";

export function registerBinanceDualInvestmentTools(server: McpServer) {
    registerBinanceDualInvestmentTradeApiTools(server);
    registerBinanceDualInvestmentMarketApiTools(server);
}
