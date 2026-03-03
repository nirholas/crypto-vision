// src/tools/binance-staking/SOL-staking-api/index.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerBinanceClaimBoostRewards } from "./claimBoostRewards.js";
import { registerBinanceGetBnsolRateHistory } from "./getBnsolRateHistory.js";
import { registerBinanceGetBnsolRewardsHistory } from "./getBnsolRewardsHistory.js";
import { registerBinanceGetBoostRewardsHistory } from "./getBoostRewardsHistory.js";
import { registerBinanceGetSolRedemptionHistory } from "./getSolRedemptionHistory.js";
import { registerBinanceGetSolStakingHistory } from "./getSolStakingHistory.js";
import { registerBinanceGetSolStakingQuotaDetails } from "./getSolStakingQuotaDetails.js";
import { registerBinanceGetUnclaimedRewards } from "./getUnclaimedRewards.js";
import { registerBinanceRedeemSol } from "./redeemSol.js";
import { registerBinanceSolStakingAccount } from "./solStakingAccount.js";
import { registerBinanceSubscribeSolStaking } from "./subscribeSolStaking.js";

export function registerBinanceSOLStakingApiTools(server: McpServer) {
    registerBinanceClaimBoostRewards(server);
    registerBinanceGetBnsolRateHistory(server);
    registerBinanceGetBnsolRewardsHistory(server);
    registerBinanceGetBoostRewardsHistory(server);
    registerBinanceGetSolRedemptionHistory(server);
    registerBinanceGetSolStakingHistory(server);
    registerBinanceGetSolStakingQuotaDetails(server);
    registerBinanceGetUnclaimedRewards(server);
    registerBinanceRedeemSol(server);
    registerBinanceSolStakingAccount(server);
    registerBinanceSubscribeSolStaking(server);
}
