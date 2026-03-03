/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/modules/options/userdata-api/index.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerOptionsCreateListenKey } from "./createListenKey.js";
import { registerOptionsRenewListenKey } from "./renewListenKey.js";
import { registerOptionsDeleteListenKey } from "./deleteListenKey.js";

export function registerOptionsUserdataApi(server: McpServer) {
    registerOptionsCreateListenKey(server);
    registerOptionsRenewListenKey(server);
    registerOptionsDeleteListenKey(server);
}
