/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-fiat/index.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerBinanceGetFiatDepositWithdrawHistory } from "./fiat-api/getFiatDepositWithdrawHistory.js";
import { registerBinanceGetFiatPaymentsHistory } from "./fiat-api/getFiatPaymentsHistory.js";

export function registerBinanceFiatDepositWithdrawHistoryTools(server: McpServer) {
    registerBinanceGetFiatDepositWithdrawHistory(server);
    registerBinanceGetFiatPaymentsHistory(server);
}
