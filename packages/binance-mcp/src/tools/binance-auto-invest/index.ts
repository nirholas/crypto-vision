// src/tools/binance-auto-invest/index.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { registerBinanceAutoInvestGetTargetAssetList } from "./getTargetAssetList.js";
import { registerBinanceAutoInvestGetSourceAssetList } from "./getSourceAssetList.js";
import { registerBinanceAutoInvestGetTargetAssetROI } from "./getTargetAssetROI.js";
import { registerBinanceAutoInvestGetPlanList } from "./getPlanList.js";
import { registerBinanceAutoInvestGetOneTimePlans } from "./getOneTimePlans.js";
import { registerBinanceAutoInvestCreatePlan } from "./createPlan.js";
import { registerBinanceAutoInvestEditPlan } from "./editPlan.js";
import { registerBinanceAutoInvestChangePlanStatus } from "./changePlanStatus.js";
import { registerBinanceAutoInvestGetIndexLinkedPlanPositionList } from "./getIndexLinkedPlanPositionList.js";
import { registerBinanceAutoInvestGetIndexLinkedPlanRebalanceHistory } from "./getIndexLinkedPlanRebalanceHistory.js";
import { registerBinanceAutoInvestGetSubscriptionHistory } from "./getSubscriptionHistory.js";
import { registerBinanceAutoInvestRedeemIndexLinkedPlan } from "./redeemIndexLinkedPlan.js";

export function registerBinanceAutoInvestTools(server: McpServer) {
    registerBinanceAutoInvestGetTargetAssetList(server);
    registerBinanceAutoInvestGetSourceAssetList(server);
    registerBinanceAutoInvestGetTargetAssetROI(server);
    registerBinanceAutoInvestGetPlanList(server);
    registerBinanceAutoInvestGetOneTimePlans(server);
    registerBinanceAutoInvestCreatePlan(server);
    registerBinanceAutoInvestEditPlan(server);
    registerBinanceAutoInvestChangePlanStatus(server);
    registerBinanceAutoInvestGetIndexLinkedPlanPositionList(server);
    registerBinanceAutoInvestGetIndexLinkedPlanRebalanceHistory(server);
    registerBinanceAutoInvestGetSubscriptionHistory(server);
    registerBinanceAutoInvestRedeemIndexLinkedPlan(server);
}
