/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/modules/portfolio-margin/userdata/index.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerPortfolioMarginCreateListenKey } from "./createListenKey.js";
import { registerPortfolioMarginRenewListenKey } from "./renewListenKey.js";
import { registerPortfolioMarginDeleteListenKey } from "./deleteListenKey.js";

export function registerPortfolioMarginUserdataApi(server: McpServer) {
    registerPortfolioMarginCreateListenKey(server);
    registerPortfolioMarginRenewListenKey(server);
    registerPortfolioMarginDeleteListenKey(server);
}
