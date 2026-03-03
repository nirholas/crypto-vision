/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-futures-coinm/market-api/index.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerBinanceDeliveryPing } from "./ping.js";
import { registerBinanceDeliveryTime } from "./time.js";
import { registerBinanceDeliveryExchangeInfo } from "./exchangeInfo.js";
import { registerBinanceDeliveryDepth } from "./depth.js";
import { registerBinanceDeliveryTrades } from "./trades.js";
import { registerBinanceDeliveryHistoricalTrades } from "./historicalTrades.js";
import { registerBinanceDeliveryAggTrades } from "./aggTrades.js";
import { registerBinanceDeliveryKlines } from "./klines.js";
import { registerBinanceDeliveryContinuousKlines } from "./continuousKlines.js";
import { registerBinanceDeliveryIndexPriceKlines } from "./indexPriceKlines.js";
import { registerBinanceDeliveryMarkPriceKlines } from "./markPriceKlines.js";
import { registerBinanceDeliveryPremiumIndex } from "./premiumIndex.js";
import { registerBinanceDeliveryFundingRate } from "./fundingRate.js";
import { registerBinanceDelivery24hrTicker } from "./ticker24hr.js";
import { registerBinanceDeliveryTickerPrice } from "./tickerPrice.js";
import { registerBinanceDeliveryTickerBookTicker } from "./bookTicker.js";
import { registerBinanceDeliveryOpenInterest } from "./openInterest.js";
import { registerBinanceDeliveryOpenInterestHist } from "./openInterestHist.js";

export function registerBinanceDeliveryMarketApiTools(server: McpServer) {
    // System Status
    registerBinanceDeliveryPing(server);
    registerBinanceDeliveryTime(server);
    registerBinanceDeliveryExchangeInfo(server);
    
    // Order Book & Trades
    registerBinanceDeliveryDepth(server);
    registerBinanceDeliveryTrades(server);
    registerBinanceDeliveryHistoricalTrades(server);
    registerBinanceDeliveryAggTrades(server);
    
    // Klines/Candlesticks
    registerBinanceDeliveryKlines(server);
    registerBinanceDeliveryContinuousKlines(server);
    registerBinanceDeliveryIndexPriceKlines(server);
    registerBinanceDeliveryMarkPriceKlines(server);
    
    // Pricing & Funding
    registerBinanceDeliveryPremiumIndex(server);
    registerBinanceDeliveryFundingRate(server);
    
    // Tickers
    registerBinanceDelivery24hrTicker(server);
    registerBinanceDeliveryTickerPrice(server);
    registerBinanceDeliveryTickerBookTicker(server);
    
    // Open Interest
    registerBinanceDeliveryOpenInterest(server);
    registerBinanceDeliveryOpenInterestHist(server);
}
