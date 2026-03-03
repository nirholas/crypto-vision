// src/tools/binance-margin/cross-margin-api/index.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerBinanceCrossMarginBorrow } from "./crossMarginBorrow.js";
import { registerBinanceCrossMarginRepay } from "./crossMarginRepay.js";
import { registerBinanceCrossMarginAccount } from "./crossMarginAccount.js";
import { registerBinanceCrossMarginTransfer } from "./crossMarginTransfer.js";
import { registerBinanceCrossMarginInterestHistory } from "./crossMarginInterestHistory.js";
import { registerBinanceCrossMarginLoanRecord } from "./crossMarginLoanRecord.js";
import { registerBinanceCrossMarginRepayRecord } from "./crossMarginRepayRecord.js";
import { registerBinanceCrossMarginMaxBorrowable } from "./crossMarginMaxBorrowable.js";
import { registerBinanceCrossMarginMaxTransferable } from "./crossMarginMaxTransferable.js";
import { registerBinanceCrossMarginPairs } from "./crossMarginPairs.js";
import { registerBinanceCrossMarginPriceIndex } from "./crossMarginPriceIndex.js";
import { registerBinanceCrossMarginNewOrder } from "./crossMarginNewOrder.js";
import { registerBinanceCrossMarginCancelOrder } from "./crossMarginCancelOrder.js";
import { registerBinanceCrossMarginCancelAllOrders } from "./crossMarginCancelAllOrders.js";
import { registerBinanceCrossMarginOpenOrders } from "./crossMarginOpenOrders.js";
import { registerBinanceCrossMarginAllOrders } from "./crossMarginAllOrders.js";
import { registerBinanceCrossMarginMyTrades } from "./crossMarginMyTrades.js";
import { registerBinanceCrossMarginForceLiquidationRec } from "./crossMarginForceLiquidationRec.js";
import { registerBinanceCrossMarginInterestRateHistory } from "./crossMarginInterestRateHistory.js";
import { registerBinanceCrossMarginFee } from "./crossMarginFee.js";
import { registerBinanceCrossMarginDustLog } from "./crossMarginDustLog.js";
import { registerBinanceCrossMarginSmallLiabilityExchange } from "./crossMarginSmallLiabilityExchange.js";
import { registerBinanceCrossMarginSmallLiabilityExchangeHistory } from "./crossMarginSmallLiabilityExchangeHistory.js";
import { registerBinanceCrossMarginAvailableInventory } from "./crossMarginAvailableInventory.js";
import { registerBinanceCrossMarginCapitalFlow } from "./crossMarginCapitalFlow.js";
import { registerBinanceCrossMarginDelist } from "./crossMarginDelist.js";

export function registerBinanceCrossMarginTools(server: McpServer) {
    // Borrow & Repay
    registerBinanceCrossMarginBorrow(server);
    registerBinanceCrossMarginRepay(server);
    
    // Account & Transfer
    registerBinanceCrossMarginAccount(server);
    registerBinanceCrossMarginTransfer(server);
    registerBinanceCrossMarginCapitalFlow(server);
    
    // Records & History
    registerBinanceCrossMarginInterestHistory(server);
    registerBinanceCrossMarginLoanRecord(server);
    registerBinanceCrossMarginRepayRecord(server);
    registerBinanceCrossMarginInterestRateHistory(server);
    registerBinanceCrossMarginForceLiquidationRec(server);
    
    // Limits & Info
    registerBinanceCrossMarginMaxBorrowable(server);
    registerBinanceCrossMarginMaxTransferable(server);
    registerBinanceCrossMarginPairs(server);
    registerBinanceCrossMarginPriceIndex(server);
    registerBinanceCrossMarginFee(server);
    registerBinanceCrossMarginAvailableInventory(server);
    registerBinanceCrossMarginDelist(server);
    
    // Trading
    registerBinanceCrossMarginNewOrder(server);
    registerBinanceCrossMarginCancelOrder(server);
    registerBinanceCrossMarginCancelAllOrders(server);
    registerBinanceCrossMarginOpenOrders(server);
    registerBinanceCrossMarginAllOrders(server);
    registerBinanceCrossMarginMyTrades(server);
    
    // Other
    registerBinanceCrossMarginDustLog(server);
    registerBinanceCrossMarginSmallLiabilityExchange(server);
    registerBinanceCrossMarginSmallLiabilityExchangeHistory(server);
}
