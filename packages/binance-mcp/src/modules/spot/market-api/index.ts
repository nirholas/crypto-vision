// src/tools/binance-spot/market-api/index.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerBinanceKlines } from "./klines.js";
import { registerBinanceTicker24hr } from "./ticker24hr.js";
import { registerBinanceDepth } from "./depth.js";
import { registerBinanceAggTrades } from "./aggTrades.js";
import { registerBinanceTickerTradingDay } from "./tickerTradingDay.js";
import { registerBinanceUiKlines } from "./uiKlines.js";
import { registerBinanceTickerBookTicker } from "./tickerBookTicker.js";
import { registerBinanceAvgPrice } from "./avgPrice.js";
import { registerBinanceTickerPrice } from "./tickerPrice.js";
import { registerBinanceTicker } from "./ticker.js";
import { registerBinanceHistoricalTrades } from "./historicalTrades.js";
import { registerBinanceGetTrades } from "./getTrades.js";

export function registerBinanceMarketApiTools(server: McpServer) {
    registerBinanceKlines(server);
    registerBinanceTicker24hr(server);
    registerBinanceDepth(server);
    registerBinanceAggTrades(server);
    registerBinanceTickerTradingDay(server);
    registerBinanceUiKlines(server);
    registerBinanceTickerBookTicker(server);
    registerBinanceAvgPrice(server);
    registerBinanceTickerPrice(server);
    registerBinanceTicker(server);
    registerBinanceHistoricalTrades(server);
    registerBinanceGetTrades(server);
    
}