/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/modules/options/account-api/index.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerOptionsGetAccount } from "./getAccount.js";
import { registerOptionsGetPosition } from "./getPosition.js";
import { registerOptionsGetBillHistory } from "./getBillHistory.js";
import { registerOptionsGetIncomeAsyn } from "./getIncomeAsyn.js";
import { registerOptionsGetIncomeAsynId } from "./getIncomeAsynId.js";

export function registerOptionsAccountApi(server: McpServer) {
    registerOptionsGetAccount(server);
    registerOptionsGetPosition(server);
    registerOptionsGetBillHistory(server);
    registerOptionsGetIncomeAsyn(server);
    registerOptionsGetIncomeAsynId(server);
}
