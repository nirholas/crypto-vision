/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-auto-invest/index.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerBinanceAutoInvestGetTargetAssetList } from "./getTargetAssetList.js";
import { registerBinanceAutoInvestGetTargetAssetRoiData } from "./getTargetAssetRoiData.js";
import { registerBinanceAutoInvestGetSourceAssetList } from "./getSourceAssetList.js";
import { registerBinanceAutoInvestGetIndexInfo } from "./getIndexInfo.js";
import { registerBinanceAutoInvestGetIndexUserSummary } from "./getIndexUserSummary.js";
import { registerBinanceAutoInvestChangeIndexPlanStatus } from "./changeIndexPlanStatus.js";
import { registerBinanceAutoInvestGetIndexLinkedPlanPositionDetails } from "./getIndexLinkedPlanPositionDetails.js";
import { registerBinanceAutoInvestGetPlanList } from "./getPlanList.js";
import { registerBinanceAutoInvestCreatePlan } from "./createPlan.js";
import { registerBinanceAutoInvestEditPlan } from "./editPlan.js";
import { registerBinanceAutoInvestChangePlanStatus } from "./changePlanStatus.js";
import { registerBinanceAutoInvestOneTimeTransaction } from "./oneTimeTransaction.js";
import { registerBinanceAutoInvestGetHistoryList } from "./getHistoryList.js";
import { registerBinanceAutoInvestRebalanceHistory } from "./rebalanceHistory.js";
import { registerBinanceAutoInvestRedemption } from "./redemption.js";

export function registerBinanceAutoInvestTools(server: McpServer) {
    // Asset Information
    registerBinanceAutoInvestGetTargetAssetList(server);
    registerBinanceAutoInvestGetTargetAssetRoiData(server);
    registerBinanceAutoInvestGetSourceAssetList(server);
    
    // Index Information
    registerBinanceAutoInvestGetIndexInfo(server);
    registerBinanceAutoInvestGetIndexUserSummary(server);
    registerBinanceAutoInvestChangeIndexPlanStatus(server);
    registerBinanceAutoInvestGetIndexLinkedPlanPositionDetails(server);
    
    // Plan Management
    registerBinanceAutoInvestGetPlanList(server);
    registerBinanceAutoInvestCreatePlan(server);
    registerBinanceAutoInvestEditPlan(server);
    registerBinanceAutoInvestChangePlanStatus(server);
    
    // Transactions
    registerBinanceAutoInvestOneTimeTransaction(server);
    registerBinanceAutoInvestRedemption(server);
    
    // History
    registerBinanceAutoInvestGetHistoryList(server);
    registerBinanceAutoInvestRebalanceHistory(server);
}
