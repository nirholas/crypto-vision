/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/modules/crypto-loans/flexible/index.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerFlexibleLoanAssets } from "./getFlexibleLoanAssets.js";
import { registerFlexibleCollateralAssets } from "./getFlexibleCollateralAssets.js";
import { registerFlexibleLoanBorrow } from "./borrow.js";
import { registerFlexibleLoanRepay } from "./repay.js";
import { registerFlexibleLoanAdjustLTV } from "./adjustLTV.js";
import { registerFlexibleLoanOngoingOrders } from "./getOngoingOrders.js";
import { registerFlexibleLoanBorrowHistory } from "./getBorrowHistory.js";
import { registerFlexibleLoanRepayHistory } from "./getRepayHistory.js";

export function registerCryptoLoansFlexibleTools(server: McpServer) {
    registerFlexibleLoanAssets(server);
    registerFlexibleCollateralAssets(server);
    registerFlexibleLoanBorrow(server);
    registerFlexibleLoanRepay(server);
    registerFlexibleLoanAdjustLTV(server);
    registerFlexibleLoanOngoingOrders(server);
    registerFlexibleLoanBorrowHistory(server);
    registerFlexibleLoanRepayHistory(server);
}
