/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/modules/simple-earn/locked/index.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerSimpleEarnLockedProductList } from "./getLockedProductList.js";
import { registerSimpleEarnSubscribeLocked } from "./subscribeLocked.js";
import { registerSimpleEarnRedeemLocked } from "./redeemLocked.js";
import { registerSimpleEarnLockedPosition } from "./getLockedPosition.js";
import { registerSimpleEarnLockedSubscriptionPreview } from "./getLockedSubscriptionPreview.js";
import { registerSimpleEarnSetAutoSubscribe } from "./setAutoSubscribe.js";
import { registerSimpleEarnLockedPersonalQuota } from "./getLockedPersonalQuota.js";
import { registerSimpleEarnLockedSubscriptionRecord } from "./getSubscriptionRecord.js";
import { registerSimpleEarnLockedRedemptionRecord } from "./getRedemptionRecord.js";

export function registerSimpleEarnLockedTools(server: McpServer) {
    registerSimpleEarnLockedProductList(server);
    registerSimpleEarnSubscribeLocked(server);
    registerSimpleEarnRedeemLocked(server);
    registerSimpleEarnLockedPosition(server);
    registerSimpleEarnLockedSubscriptionPreview(server);
    registerSimpleEarnSetAutoSubscribe(server);
    registerSimpleEarnLockedPersonalQuota(server);
    registerSimpleEarnLockedSubscriptionRecord(server);
    registerSimpleEarnLockedRedemptionRecord(server);
}
