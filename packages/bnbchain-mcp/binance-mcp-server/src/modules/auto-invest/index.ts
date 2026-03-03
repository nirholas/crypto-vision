/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/modules/auto-invest/index.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAutoInvestGetTargetAssetList } from "./getTargetAssetList.js";
import { registerAutoInvestGetTargetAssetRoiData } from "./getTargetAssetRoiData.js";
import { registerAutoInvestGetSourceAssetList } from "./getSourceAssetList.js";
import { registerAutoInvestGetIndexInfo } from "./getIndexInfo.js";
import { registerAutoInvestGetIndexUserSummary } from "./getIndexUserSummary.js";
import { registerAutoInvestGetPlanList } from "./getPlanList.js";
import { registerAutoInvestGetIndexLinkedPlanPositionDetails } from "./getIndexLinkedPlanPositionDetails.js";
import { registerAutoInvestCreatePlan } from "./createPlan.js";
import { registerAutoInvestEditPlan } from "./editPlan.js";
import { registerAutoInvestChangePlanStatus } from "./changePlanStatus.js";
import { registerAutoInvestOneTimeTransaction } from "./oneTimeTransaction.js";
import { registerAutoInvestGetHistoryList } from "./getHistoryList.js";
import { registerAutoInvestRebalanceHistory } from "./rebalanceHistory.js";
import { registerAutoInvestRedemption } from "./redemption.js";

export function registerAutoInvest(server: McpServer) {
    // Query APIs
    registerAutoInvestGetTargetAssetList(server);
    registerAutoInvestGetTargetAssetRoiData(server);
    registerAutoInvestGetSourceAssetList(server);
    registerAutoInvestGetIndexInfo(server);
    registerAutoInvestGetIndexUserSummary(server);
    registerAutoInvestGetPlanList(server);
    registerAutoInvestGetIndexLinkedPlanPositionDetails(server);
    
    // Plan Management APIs
    registerAutoInvestCreatePlan(server);
    registerAutoInvestEditPlan(server);
    registerAutoInvestChangePlanStatus(server);
    
    // Transaction APIs
    registerAutoInvestOneTimeTransaction(server);
    registerAutoInvestRedemption(server);
    
    // History APIs
    registerAutoInvestGetHistoryList(server);
    registerAutoInvestRebalanceHistory(server);
}
