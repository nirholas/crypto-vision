/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-staking/ETH-staking-api/index.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerBinanceEthStakingAccount } from "./ethStakingAccount.js";
import { registerBinanceGetCurrentEthStakingQuota } from "./getCurrentEthStakingQuota.js";
import { registerBinanceGetEthRedemptionHistory } from "./getEthRedemptionHistory.js";
import { registerBinanceGetEthStakingHistory } from "./getEthStakingHistory.js";
import { registerBinanceGetWbethRateHistory } from "./getWbethRateHistory.js";
import { registerBinanceGetWbethRewardsHistory } from "./getWbethRewardsHistory.js";
import { registerBinanceGetWbethUnwrapHistory } from "./getWbethUnwrapHistory.js";
import { registerBinanceGetWbethWrapHistory } from "./getWbethWrapHistory.js";
import { registerBinanceRedeemEth } from "./redeemEth.js";
import { registerBinanceSubscribeEthStaking } from "./subscribeEthStaking.js";
import { registerBinanceWrapBeth } from "./wrapBeth.js";

export function registerBinanceETHStakingApiTools(server: McpServer) {
    registerBinanceEthStakingAccount(server);
    registerBinanceGetCurrentEthStakingQuota(server);
    registerBinanceGetEthRedemptionHistory(server);
    registerBinanceGetEthStakingHistory(server);
    registerBinanceGetWbethRateHistory(server);
    registerBinanceGetWbethRewardsHistory(server);
    registerBinanceGetWbethUnwrapHistory(server);
    registerBinanceGetWbethWrapHistory(server);
    registerBinanceRedeemEth(server);
    registerBinanceSubscribeEthStaking(server);
    registerBinanceWrapBeth(server);
}
