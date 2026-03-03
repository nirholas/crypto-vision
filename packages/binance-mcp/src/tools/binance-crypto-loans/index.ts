// src/tools/binance-crypto-loans/index.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

// Crypto Loans - Info
import { registerBinanceCryptoLoanGetCollateralRepayRate } from "./getCollateralRepayRate.js";
import { registerBinanceCryptoLoanGetLoanableAssetsDataV2 } from "./getLoanableAssetsData.js";
import { registerBinanceCryptoLoanGetCollateralAssetsDataV2 } from "./getCollateralAssetsData.js";
import { registerBinanceCryptoLoanFlexibleLoanCollateralAssets } from "./flexibleLoanCollateralAssets.js";
import { registerBinanceCryptoLoanFlexibleLoanableAssets } from "./flexibleLoanLoanableAssets.js";

// Crypto Loans - Trading
import { registerBinanceCryptoLoanFlexibleLoanBorrow } from "./flexibleLoanBorrow.js";
import { registerBinanceCryptoLoanFlexibleLoanRepay } from "./flexibleLoanRepay.js";
import { registerBinanceCryptoLoanFlexibleLoanAdjustLTV } from "./flexibleLoanAdjustLTV.js";

// Crypto Loans - History
import { registerBinanceCryptoLoanFlexibleLoanOngoingOrders } from "./flexibleLoanOngoingOrders.js";
import { registerBinanceCryptoLoanFlexibleLoanBorrowHistory } from "./flexibleLoanBorrowHistory.js";
import { registerBinanceCryptoLoanFlexibleLoanRepayHistory } from "./flexibleLoanRepayHistory.js";
import { registerBinanceCryptoLoanFlexibleLoanLTVAdjustmentHistory } from "./flexibleLoanLTVAdjustmentHistory.js";

export function registerBinanceCryptoLoansTools(server: McpServer) {
    // Crypto Loans - Info
    registerBinanceCryptoLoanGetCollateralRepayRate(server);
    registerBinanceCryptoLoanGetLoanableAssetsDataV2(server);
    registerBinanceCryptoLoanGetCollateralAssetsDataV2(server);
    registerBinanceCryptoLoanFlexibleLoanCollateralAssets(server);
    registerBinanceCryptoLoanFlexibleLoanableAssets(server);
    
    // Crypto Loans - Trading
    registerBinanceCryptoLoanFlexibleLoanBorrow(server);
    registerBinanceCryptoLoanFlexibleLoanRepay(server);
    registerBinanceCryptoLoanFlexibleLoanAdjustLTV(server);
    
    // Crypto Loans - History
    registerBinanceCryptoLoanFlexibleLoanOngoingOrders(server);
    registerBinanceCryptoLoanFlexibleLoanBorrowHistory(server);
    registerBinanceCryptoLoanFlexibleLoanRepayHistory(server);
    registerBinanceCryptoLoanFlexibleLoanLTVAdjustmentHistory(server);
}
