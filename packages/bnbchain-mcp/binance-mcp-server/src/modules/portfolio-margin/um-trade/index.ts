/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/modules/portfolio-margin/um-trade/index.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerPortfolioMarginUmNewOrder } from "./newOrder.js";
import { registerPortfolioMarginUmCancelOrder } from "./cancelOrder.js";
import { registerPortfolioMarginUmCancelAllOrders } from "./cancelAllOrders.js";
import { registerPortfolioMarginUmGetOrder } from "./getOrder.js";
import { registerPortfolioMarginUmGetAllOrders } from "./getAllOrders.js";
import { registerPortfolioMarginUmGetOpenOrders } from "./getOpenOrders.js";
import { registerPortfolioMarginUmGetUserTrades } from "./getUserTrades.js";
import { registerPortfolioMarginUmChangeLeverage } from "./changeLeverage.js";
import { registerPortfolioMarginUmChangeMarginType } from "./changeMarginType.js";

export function registerPortfolioMarginUmTradeApi(server: McpServer) {
    registerPortfolioMarginUmNewOrder(server);
    registerPortfolioMarginUmCancelOrder(server);
    registerPortfolioMarginUmCancelAllOrders(server);
    registerPortfolioMarginUmGetOrder(server);
    registerPortfolioMarginUmGetAllOrders(server);
    registerPortfolioMarginUmGetOpenOrders(server);
    registerPortfolioMarginUmGetUserTrades(server);
    registerPortfolioMarginUmChangeLeverage(server);
    registerPortfolioMarginUmChangeMarginType(server);
}
