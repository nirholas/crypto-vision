/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/modules/simple-earn/account/index.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerSimpleEarnAccount } from "./getAccount.js";
import { registerSimpleEarnCollateralRecord } from "./getCollateralRecord.js";
import { registerSimpleEarnRewardRecord } from "./getRewardRecord.js";

export function registerSimpleEarnAccountTools(server: McpServer) {
    registerSimpleEarnAccount(server);
    registerSimpleEarnCollateralRecord(server);
    registerSimpleEarnRewardRecord(server);
}
