// src/tools/binance-sub-account/index.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerBinanceSubAccountCreateVirtual } from "./createVirtualSubAccount.js";
import { registerBinanceSubAccountGetList } from "./getSubAccountList.js";
import { registerBinanceSubAccountGetAssets } from "./getSubAccountAssets.js";
import { registerBinanceSubAccountGetSpotSummary } from "./getSubAccountSpotSummary.js";
import { registerBinanceSubAccountGetStatus } from "./getSubAccountStatus.js";
import { registerBinanceSubAccountEnableMargin } from "./enableMargin.js";
import { registerBinanceSubAccountGetMarginSummary } from "./getSubAccountMarginSummary.js";
import { registerBinanceSubAccountEnableFutures } from "./enableFutures.js";
import { registerBinanceSubAccountGetFuturesSummary } from "./getSubAccountFuturesSummary.js";
import { registerBinanceSubAccountGetFuturesPositionRisk } from "./getSubAccountFuturesPositionRisk.js";
import { registerBinanceSubAccountTransferToSub } from "./transferToSubAccount.js";
import { registerBinanceSubAccountTransferToMaster } from "./transferToMaster.js";
import { registerBinanceSubAccountGetTransferHistory } from "./getSubAccountTransferHistory.js";
import { registerBinanceSubAccountUniversalTransfer } from "./universalTransfer.js";
import { registerBinanceSubAccountGetUniversalTransferHistory } from "./getUniversalTransferHistory.js";
import { registerBinanceSubAccountGetDepositAddress } from "./getSubAccountDepositAddress.js";
import { registerBinanceSubAccountGetDepositHistory } from "./getSubAccountDepositHistory.js";
import { registerBinanceSubAccountCreateApiKey } from "./createApiKey.js";
import { registerBinanceSubAccountDeleteApiKey } from "./deleteApiKey.js";
import { registerBinanceSubAccountUpdateIpRestriction } from "./updateIpRestriction.js";
import { registerBinanceSubAccountGetApiKeyIpRestriction } from "./getApiKeyIpRestriction.js";

export function registerBinanceSubAccountTools(server: McpServer) {
    // Sub-account Management
    registerBinanceSubAccountCreateVirtual(server);
    registerBinanceSubAccountGetList(server);
    registerBinanceSubAccountGetAssets(server);
    registerBinanceSubAccountGetSpotSummary(server);
    registerBinanceSubAccountGetStatus(server);
    
    // Margin Management
    registerBinanceSubAccountEnableMargin(server);
    registerBinanceSubAccountGetMarginSummary(server);
    
    // Futures Management
    registerBinanceSubAccountEnableFutures(server);
    registerBinanceSubAccountGetFuturesSummary(server);
    registerBinanceSubAccountGetFuturesPositionRisk(server);
    
    // Transfers
    registerBinanceSubAccountTransferToSub(server);
    registerBinanceSubAccountTransferToMaster(server);
    registerBinanceSubAccountGetTransferHistory(server);
    registerBinanceSubAccountUniversalTransfer(server);
    registerBinanceSubAccountGetUniversalTransferHistory(server);
    
    // Deposit
    registerBinanceSubAccountGetDepositAddress(server);
    registerBinanceSubAccountGetDepositHistory(server);
    
    // API Key Management
    registerBinanceSubAccountCreateApiKey(server);
    registerBinanceSubAccountDeleteApiKey(server);
    registerBinanceSubAccountUpdateIpRestriction(server);
    registerBinanceSubAccountGetApiKeyIpRestriction(server);
}
