/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/modules/portfolio-margin/index.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerPortfolioMarginAccountApi } from "./account/index.js";
import { registerPortfolioMarginUmTradeApi } from "./um-trade/index.js";
import { registerPortfolioMarginCmTradeApi } from "./cm-trade/index.js";
import { registerPortfolioMarginMarginTradeApi } from "./margin-trade/index.js";
import { registerPortfolioMarginUserdataApi } from "./userdata/index.js";

export function registerPortfolioMargin(server: McpServer) {
    // Account API
    registerPortfolioMarginAccountApi(server);
    
    // UM (USDT-M Futures) Trade API
    registerPortfolioMarginUmTradeApi(server);
    
    // CM (COIN-M Futures) Trade API
    registerPortfolioMarginCmTradeApi(server);
    
    // Cross Margin Trade API
    registerPortfolioMarginMarginTradeApi(server);
    
    // User Data Stream API
    registerPortfolioMarginUserdataApi(server);
}
