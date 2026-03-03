/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-futures-usdm/market-api/index.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerBinanceFuturesPing } from "./ping.js";
import { registerBinanceFuturesTime } from "./time.js";
import { registerBinanceFuturesExchangeInfo } from "./exchangeInfo.js";
import { registerBinanceFuturesDepth } from "./depth.js";
import { registerBinanceFuturesTrades } from "./trades.js";
import { registerBinanceFuturesHistoricalTrades } from "./historicalTrades.js";
import { registerBinanceFuturesAggTrades } from "./aggTrades.js";
import { registerBinanceFuturesKlines } from "./klines.js";
import { registerBinanceFuturesContinuousKlines } from "./continuousKlines.js";
import { registerBinanceFuturesIndexPriceKlines } from "./indexPriceKlines.js";
import { registerBinanceFuturesMarkPriceKlines } from "./markPriceKlines.js";
import { registerBinanceFuturesPremiumIndex } from "./premiumIndex.js";
import { registerBinanceFuturesFundingRate } from "./fundingRate.js";
import { registerBinanceFuturesFundingInfo } from "./fundingInfo.js";
import { registerBinanceFuturesTicker24hr } from "./ticker24hr.js";
import { registerBinanceFuturesTickerPrice } from "./tickerPrice.js";
import { registerBinanceFuturesTickerBookTicker } from "./tickerBookTicker.js";
import { registerBinanceFuturesOpenInterest } from "./openInterest.js";
import { registerBinanceFuturesOpenInterestHist } from "./openInterestHist.js";
import { registerBinanceFuturesTopLongShortAccountRatio } from "./topLongShortAccountRatio.js";
import { registerBinanceFuturesTopLongShortPositionRatio } from "./topLongShortPositionRatio.js";
import { registerBinanceFuturesGlobalLongShortAccountRatio } from "./globalLongShortAccountRatio.js";
import { registerBinanceFuturesTakerLongShortRatio } from "./takerLongShortRatio.js";
import { registerBinanceFuturesLvtKlines } from "./lvtKlines.js";
import { registerBinanceFuturesIndexInfo } from "./indexInfo.js";
import { registerBinanceFuturesAssetIndex } from "./assetIndex.js";

export function registerBinanceFuturesMarketApiTools(server: McpServer) {
    // General
    registerBinanceFuturesPing(server);
    registerBinanceFuturesTime(server);
    registerBinanceFuturesExchangeInfo(server);
    
    // Market Data
    registerBinanceFuturesDepth(server);
    registerBinanceFuturesTrades(server);
    registerBinanceFuturesHistoricalTrades(server);
    registerBinanceFuturesAggTrades(server);
    
    // Klines
    registerBinanceFuturesKlines(server);
    registerBinanceFuturesContinuousKlines(server);
    registerBinanceFuturesIndexPriceKlines(server);
    registerBinanceFuturesMarkPriceKlines(server);
    
    // Funding & Premium
    registerBinanceFuturesPremiumIndex(server);
    registerBinanceFuturesFundingRate(server);
    registerBinanceFuturesFundingInfo(server);
    
    // Ticker
    registerBinanceFuturesTicker24hr(server);
    registerBinanceFuturesTickerPrice(server);
    registerBinanceFuturesTickerBookTicker(server);
    
    // Open Interest & Analytics
    registerBinanceFuturesOpenInterest(server);
    registerBinanceFuturesOpenInterestHist(server);
    registerBinanceFuturesTopLongShortAccountRatio(server);
    registerBinanceFuturesTopLongShortPositionRatio(server);
    registerBinanceFuturesGlobalLongShortAccountRatio(server);
    registerBinanceFuturesTakerLongShortRatio(server);
    
    // Index
    registerBinanceFuturesLvtKlines(server);
    registerBinanceFuturesIndexInfo(server);
    registerBinanceFuturesAssetIndex(server);
}
