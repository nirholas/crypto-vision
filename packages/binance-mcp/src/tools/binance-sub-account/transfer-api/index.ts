/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/tools/binance-sub-account/transfer-api/index.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerBinanceSubAccountTransferToSub } from "./transferToSubAccount.js";
import { registerBinanceSubAccountTransferToMaster } from "./transferToMaster.js";
import { registerBinanceSubAccountUniversalTransfer } from "./universalTransfer.js";
import { registerBinanceSubAccountTransferHistory } from "./getTransferHistory.js";
import { registerBinanceSubAccountFuturesTransfer } from "./futuresTransfer.js";

export function registerBinanceSubAccountTransferTools(server: McpServer) {
    registerBinanceSubAccountTransferToSub(server);
    registerBinanceSubAccountTransferToMaster(server);
    registerBinanceSubAccountUniversalTransfer(server);
    registerBinanceSubAccountTransferHistory(server);
    registerBinanceSubAccountFuturesTransfer(server);
}
