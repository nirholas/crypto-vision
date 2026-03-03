// src/tools/binance-wallet/account-api/index.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerBinanceWalletDailyAccountSnapshot } from "./dailyAccountSnapshot.js";
import { registerBinanceWalletGetApiKeyPermission } from "./getApiKeyPermission.js";
import { registerBinanceWalletAccountInfo } from "./accountInfo.js";
import { registerBinanceWalletAccountStatus } from "./accountStatus.js";
import { registerBinanceWalletAccountApiTradingStatus } from "./accountApiTradingStatus.js";
import { registerBinanceWalletEnableFastWithdrawSwitch } from "./enableFastWithdrawSwitch.js";
import { registerBinanceWalletDisableFastWithdrawSwitch } from "./disableFastWithdrawSwitch.js";

export function registerBinanceWalletAccountApiTools(server: McpServer) {
    registerBinanceWalletDailyAccountSnapshot(server);
    registerBinanceWalletGetApiKeyPermission(server);
    registerBinanceWalletAccountInfo(server);
    registerBinanceWalletAccountStatus(server);
    registerBinanceWalletAccountApiTradingStatus(server);
    registerBinanceWalletEnableFastWithdrawSwitch(server);
    registerBinanceWalletDisableFastWithdrawSwitch(server);
    
}   