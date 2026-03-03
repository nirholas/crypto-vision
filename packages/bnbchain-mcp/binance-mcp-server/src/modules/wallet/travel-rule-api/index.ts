/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
//src/tools/binance-wallet/travel-rule-api/index.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerBinanceWalletBrokerWithdraw } from "./brokerWithdraw.js";
import { registerBinanceWalletOnboardedVaspList } from "./onboardedVaspList.js";
import { registerBinanceWalletSubmitDepositQuestionnaire } from "./submitDepositQuestionnaire.js";
import { registerBinanceWalletWithdrawHistoryV1 } from "./withdrawHistoryV1.js";
import { registerBinanceWalletDepositHistoryTravelRule } from "./depositHistoryTravelRule.js";
import { registerBinanceWalletWithdrawHistoryV2 } from "./withdrawHistoryV2.js";
import { registerBinanceWalletWithdrawTravelRule } from "./withdrawTravelRule.js";
import { registerBinanceWalletSubmitDepositQuestionnaireTravelRule } from "./submitDepositQuestionnaireTravelRule.js";

export function registerBinanceWalletTravelRuleApiTools(server: McpServer) {
    registerBinanceWalletBrokerWithdraw(server);
    registerBinanceWalletOnboardedVaspList(server);
    registerBinanceWalletSubmitDepositQuestionnaire(server);
    registerBinanceWalletWithdrawHistoryV1(server);
    registerBinanceWalletDepositHistoryTravelRule(server);
    registerBinanceWalletWithdrawHistoryV2(server);
    registerBinanceWalletWithdrawTravelRule(server);
    registerBinanceWalletSubmitDepositQuestionnaireTravelRule(server);
    
}