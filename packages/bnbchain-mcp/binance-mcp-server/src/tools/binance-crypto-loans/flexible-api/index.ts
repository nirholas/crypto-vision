/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-crypto-loans/flexible-api/index.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerBinanceCryptoLoansFlexibleAssets } from "./getFlexibleLoanAssets.js";
import { registerBinanceCryptoLoansFlexibleCollateral } from "./getFlexibleCollateralAssets.js";
import { registerBinanceCryptoLoansFlexibleBorrow } from "./borrow.js";
import { registerBinanceCryptoLoansFlexibleRepay } from "./repay.js";
import { registerBinanceCryptoLoansFlexibleAdjustLTV } from "./adjustLTV.js";
import { registerBinanceCryptoLoansFlexibleOngoing } from "./getOngoingOrders.js";
import { registerBinanceCryptoLoansFlexibleBorrowHistory } from "./getBorrowHistory.js";
import { registerBinanceCryptoLoansFlexibleRepayHistory } from "./getRepayHistory.js";

export function registerBinanceCryptoLoansFlexibleTools(server: McpServer) {
    registerBinanceCryptoLoansFlexibleAssets(server);
    registerBinanceCryptoLoansFlexibleCollateral(server);
    registerBinanceCryptoLoansFlexibleBorrow(server);
    registerBinanceCryptoLoansFlexibleRepay(server);
    registerBinanceCryptoLoansFlexibleAdjustLTV(server);
    registerBinanceCryptoLoansFlexibleOngoing(server);
    registerBinanceCryptoLoansFlexibleBorrowHistory(server);
    registerBinanceCryptoLoansFlexibleRepayHistory(server);
}
