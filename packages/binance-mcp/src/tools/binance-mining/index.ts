// src/tools/binance-mining/index.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerBinanceAcquiringAlgorithm } from "./mining-api/acquiringAlgorithm.js";
import { registerBinanceAcquiringCoinName } from "./mining-api/acquiringCoinname.js";
import { registerBinanceHashRateResaleList } from "./mining-api/hashrateResaleList.js";
import { registerBinanceRequestForMinerList } from "./mining-api/requestForMinerList.js";
import { registerBinanceRequestForDetailMinerList } from "./mining-api/requestForDetailMinerList.js";
import { registerBinanceExtraBonusList } from "./mining-api/extraBonusList.js";
import { registerBinanceEarningsList } from "./mining-api/earningsList.js";
import { registerBinanceCancelHashRateResaleConfiguration } from "./mining-api/cancelHashrateResaleConfiguration.js";
import { registerBinanceHashRateResaleDetail } from "./mining-api/hashrateResaleDetail.js";
import { registerBinanceMiningAccountEarning } from "./mining-api/miningAccountEarning.js";
import { registerBinanceStatisticList } from "./mining-api/statisticList.js";
import { registerBinanceHashRateResaleRequest } from "./mining-api/hashrateResaleRequest.js";
import { registerBinanceAccountList } from "./mining-api/accountList.js";

export function registerBinanceMiningTools(server: McpServer) {
    registerBinanceAcquiringAlgorithm(server);
    registerBinanceAcquiringCoinName(server);
    registerBinanceHashRateResaleList(server);
    registerBinanceRequestForMinerList(server);
    registerBinanceRequestForDetailMinerList(server);
    registerBinanceExtraBonusList(server);
    registerBinanceEarningsList(server);
    registerBinanceCancelHashRateResaleConfiguration(server);
    registerBinanceHashRateResaleDetail(server);
    registerBinanceMiningAccountEarning(server);
    registerBinanceStatisticList(server);
    registerBinanceHashRateResaleRequest(server);
    registerBinanceAccountList(server);
}
