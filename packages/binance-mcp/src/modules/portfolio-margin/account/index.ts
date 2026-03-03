/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/modules/portfolio-margin/account/index.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerPortfolioMarginGetAccountInfo } from "./getAccountInfo.js";
import { registerPortfolioMarginGetBalance } from "./getBalance.js";
import { registerPortfolioMarginGetMaxBorrowable } from "./getMaxBorrowable.js";
import { registerPortfolioMarginGetMaxWithdraw } from "./getMaxWithdraw.js";
import { registerPortfolioMarginGetUmAccount } from "./getUmAccount.js";
import { registerPortfolioMarginGetCmAccount } from "./getCmAccount.js";
import { registerPortfolioMarginGetUmPosition } from "./getUmPosition.js";
import { registerPortfolioMarginGetCmPosition } from "./getCmPosition.js";
import { registerPortfolioMarginGetMarginAccount } from "./getMarginAccount.js";

export function registerPortfolioMarginAccountApi(server: McpServer) {
    registerPortfolioMarginGetAccountInfo(server);
    registerPortfolioMarginGetBalance(server);
    registerPortfolioMarginGetMaxBorrowable(server);
    registerPortfolioMarginGetMaxWithdraw(server);
    registerPortfolioMarginGetUmAccount(server);
    registerPortfolioMarginGetCmAccount(server);
    registerPortfolioMarginGetUmPosition(server);
    registerPortfolioMarginGetCmPosition(server);
    registerPortfolioMarginGetMarginAccount(server);
}
