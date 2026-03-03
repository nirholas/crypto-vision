// src/modules/portfolio-margin/index.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerBinancePortfolioMarginTools } from "../../tools/binance-portfolio-margin/index.js";

export function registerPortfolioMargin(server: McpServer) {
    registerBinancePortfolioMarginTools(server);
}
