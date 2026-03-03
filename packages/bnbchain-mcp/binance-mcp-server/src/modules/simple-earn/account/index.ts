/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
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
