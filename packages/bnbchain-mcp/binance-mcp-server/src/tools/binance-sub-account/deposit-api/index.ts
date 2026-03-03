/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-sub-account/deposit-api/index.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerBinanceSubAccountDepositAddress } from "./getDepositAddress.js";
import { registerBinanceSubAccountDepositHistory } from "./getDepositHistory.js";

export function registerBinanceSubAccountDepositTools(server: McpServer) {
    registerBinanceSubAccountDepositAddress(server);
    registerBinanceSubAccountDepositHistory(server);
}
