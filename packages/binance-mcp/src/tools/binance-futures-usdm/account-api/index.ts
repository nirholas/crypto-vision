/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/tools/binance-futures-usdm/account-api/index.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerBinanceFuturesAccount } from "./account.js";
import { registerBinanceFuturesBalance } from "./balance.js";
import { registerBinanceFuturesPositionRisk } from "./positionRisk.js";
import { registerBinanceFuturesUserTrades } from "./userTrades.js";
import { registerBinanceFuturesIncome } from "./income.js";
import { registerBinanceFuturesLeverageBracket } from "./leverageBracket.js";
import { registerBinanceFuturesADLQuantile } from "./adlQuantile.js";
import { registerBinanceFuturesForceOrders } from "./forceOrders.js";
import { registerBinanceFuturesApiTradingStatus } from "./apiTradingStatus.js";
import { registerBinanceFuturesCommissionRate } from "./commissionRate.js";
import { registerBinanceFuturesDownloadIdForFuturesTransactionHistory } from "./downloadId.js";
import { registerBinanceFuturesPositionMode } from "./positionMode.js";
import { registerBinanceFuturesMultiAssetsMode } from "./multiAssetsMode.js";
import { registerBinanceFuturesLeverage } from "./leverage.js";
import { registerBinanceFuturesMarginType } from "./marginType.js";
import { registerBinanceFuturesPositionMargin } from "./positionMargin.js";

export function registerBinanceFuturesAccountApiTools(server: McpServer) {
    // Account Info
    registerBinanceFuturesAccount(server);
    registerBinanceFuturesBalance(server);
    registerBinanceFuturesPositionRisk(server);
    registerBinanceFuturesPositionMode(server);
    registerBinanceFuturesMultiAssetsMode(server);
    
    // Leverage & Margin
    registerBinanceFuturesLeverage(server);
    registerBinanceFuturesMarginType(server);
    registerBinanceFuturesPositionMargin(server);
    
    // Trades & History
    registerBinanceFuturesUserTrades(server);
    registerBinanceFuturesIncome(server);
    registerBinanceFuturesForceOrders(server);
    registerBinanceFuturesDownloadIdForFuturesTransactionHistory(server);
    
    // Risk & Limits
    registerBinanceFuturesLeverageBracket(server);
    registerBinanceFuturesADLQuantile(server);
    
    // Status & Commission
    registerBinanceFuturesApiTradingStatus(server);
    registerBinanceFuturesCommissionRate(server);
}
