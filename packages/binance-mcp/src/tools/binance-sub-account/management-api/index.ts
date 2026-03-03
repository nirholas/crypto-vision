/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/tools/binance-sub-account/management-api/index.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerBinanceSubAccountCreate } from "./createSubAccount.js";
import { registerBinanceSubAccountList } from "./getSubAccountList.js";
import { registerBinanceSubAccountStatus } from "./getSubAccountStatus.js";
import { registerBinanceSubAccountEnableMargin } from "./enableMargin.js";
import { registerBinanceSubAccountEnableFutures } from "./enableFutures.js";
import { registerBinanceSubAccountApiPermission } from "./getSubAccountApiPermission.js";

export function registerBinanceSubAccountManagementTools(server: McpServer) {
    registerBinanceSubAccountCreate(server);
    registerBinanceSubAccountList(server);
    registerBinanceSubAccountStatus(server);
    registerBinanceSubAccountEnableMargin(server);
    registerBinanceSubAccountEnableFutures(server);
    registerBinanceSubAccountApiPermission(server);
}
