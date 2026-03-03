/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-wallet/asset-api/index.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerBinanceWalletUserAsset } from "./userAsset.js";
import { registerBinanceWalletFundingWallet } from "./fundingWallet.js";
import { registerBinanceWalletAssetDetail } from "./assetDetail.js";
import { registerBinanceWalletTradeFee } from "./tradeFee.js";
import { registerBinanceWalletUserUniversalTransfer } from "./userUniversalTransfer.js";
import { registerBinanceWalletQueryUserUniversalTransferHistory } from "./queryUserUniversalTransferHistory.js";
import { registerBinanceWalletDustTransfer } from "./dustTransfer.js";
import { registerBinanceWalletDustlog } from "./dustlog.js";
import { registerBinanceWalletAssetDividendRecord } from "./assetDividendRecord.js";
import { registerBinanceWalletGetAssetsThatCanBeConvertedIntoBnb } from "./getAssetsThatCanBeConvertedIntoBnb.js";
import { registerBinanceWalletToggleBnbBurnOnSpotTradeAndMarginInterest } from "./toggleBnbBurnOnSpotTradeAndMarginInterest.js";
import { registerBinanceWalletGetCloudMiningPaymentAndRefundHistory } from "./getCloudMiningPaymentAndRefundHistory.js";
import { registerBinanceWalletQueryUserDelegationHistory } from "./queryUserDelegationHistory.js";
import { registerBinanceWalletGetOpenSymbolList } from "./getOpenSymbolList.js";
import { registerBinanceWalletQueryUserWalletBalance } from "./queryUserWalletBalance.js";

export function registerBinanceWalletAssetApiTools(server: McpServer) {
    registerBinanceWalletUserAsset(server);
    registerBinanceWalletFundingWallet(server);
    registerBinanceWalletAssetDetail(server);
    registerBinanceWalletTradeFee(server);
    registerBinanceWalletUserUniversalTransfer(server);
    registerBinanceWalletQueryUserUniversalTransferHistory(server);
    registerBinanceWalletDustTransfer(server);
    registerBinanceWalletDustlog(server);
    registerBinanceWalletAssetDividendRecord(server);
    registerBinanceWalletGetAssetsThatCanBeConvertedIntoBnb(server);
    registerBinanceWalletToggleBnbBurnOnSpotTradeAndMarginInterest(server);
    registerBinanceWalletGetCloudMiningPaymentAndRefundHistory(server);
    registerBinanceWalletQueryUserDelegationHistory(server);
    registerBinanceWalletGetOpenSymbolList(server);
    registerBinanceWalletQueryUserWalletBalance(server);
}