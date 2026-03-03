/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/modules/simple-earn/flexible/index.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerSimpleEarnFlexibleProductList } from "./getFlexibleProductList.js";
import { registerSimpleEarnSubscribeFlexible } from "./subscribeFlexible.js";
import { registerSimpleEarnRedeemFlexible } from "./redeemFlexible.js";
import { registerSimpleEarnFlexiblePosition } from "./getFlexiblePosition.js";
import { registerSimpleEarnFlexibleSubscriptionPreview } from "./getFlexibleSubscriptionPreview.js";
import { registerSimpleEarnFlexibleRateHistory } from "./getRateHistory.js";
import { registerSimpleEarnFlexibleSubscriptionRecord } from "./getSubscriptionRecord.js";
import { registerSimpleEarnFlexibleRedemptionRecord } from "./getRedemptionRecord.js";

export function registerSimpleEarnFlexibleTools(server: McpServer) {
    registerSimpleEarnFlexibleProductList(server);
    registerSimpleEarnSubscribeFlexible(server);
    registerSimpleEarnRedeemFlexible(server);
    registerSimpleEarnFlexiblePosition(server);
    registerSimpleEarnFlexibleSubscriptionPreview(server);
    registerSimpleEarnFlexibleRateHistory(server);
    registerSimpleEarnFlexibleSubscriptionRecord(server);
    registerSimpleEarnFlexibleRedemptionRecord(server);
}
