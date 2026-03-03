/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/tools/binance-crypto-loans/fixed-api/index.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerBinanceCryptoLoansFixedAssets } from "./getFixedLoanData.js";
import { registerBinanceCryptoLoansFixedCollateral } from "./getFixedCollateralData.js";
import { registerBinanceCryptoLoansFixedBorrow } from "./borrow.js";
import { registerBinanceCryptoLoansFixedRepay } from "./repay.js";
import { registerBinanceCryptoLoansFixedAdjustLTV } from "./adjustLTV.js";
import { registerBinanceCryptoLoansFixedOngoing } from "./getOngoingOrders.js";
import { registerBinanceCryptoLoansFixedBorrowHistory } from "./getBorrowHistory.js";
import { registerBinanceCryptoLoansFixedRepayHistory } from "./getRepayHistory.js";
import { registerBinanceCryptoLoansFixedCollateralRate } from "./checkCollateralRate.js";
import { registerBinanceCryptoLoansFixedMarginCall } from "./customizeMarginCall.js";

export function registerBinanceCryptoLoansFixedTools(server: McpServer) {
    registerBinanceCryptoLoansFixedAssets(server);
    registerBinanceCryptoLoansFixedCollateral(server);
    registerBinanceCryptoLoansFixedCollateralRate(server);
    registerBinanceCryptoLoansFixedMarginCall(server);
    registerBinanceCryptoLoansFixedBorrow(server);
    registerBinanceCryptoLoansFixedRepay(server);
    registerBinanceCryptoLoansFixedAdjustLTV(server);
    registerBinanceCryptoLoansFixedOngoing(server);
    registerBinanceCryptoLoansFixedBorrowHistory(server);
    registerBinanceCryptoLoansFixedRepayHistory(server);
}
