/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/tools/binance-futures-coinm/account-api/index.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerBinanceDeliveryAccount } from "./account.js";
import { registerBinanceDeliveryBalance } from "./balance.js";
import { registerBinanceDeliveryPositionRisk } from "./positionRisk.js";
import { registerBinanceDeliveryUserTrades } from "./userTrades.js";
import { registerBinanceDeliveryIncome } from "./income.js";
import { registerBinanceDeliveryLeverageBracket } from "./leverageBracket.js";
import { registerBinanceDeliveryAdlQuantile } from "./adlQuantile.js";
import { registerBinanceDeliveryForceOrders } from "./forceOrders.js";
import { registerBinanceDeliveryCommissionRate } from "./commissionRate.js";
import { registerBinanceDeliveryPositionMode } from "./positionMode.js";

export function registerBinanceDeliveryAccountApiTools(server: McpServer) {
    // Account Information
    registerBinanceDeliveryAccount(server);
    registerBinanceDeliveryBalance(server);
    registerBinanceDeliveryPositionRisk(server);
    
    // Trade History
    registerBinanceDeliveryUserTrades(server);
    registerBinanceDeliveryIncome(server);
    
    // Leverage & Risk
    registerBinanceDeliveryLeverageBracket(server);
    registerBinanceDeliveryAdlQuantile(server);
    registerBinanceDeliveryForceOrders(server);
    
    // Account Settings
    registerBinanceDeliveryCommissionRate(server);
    registerBinanceDeliveryPositionMode(server);
}
