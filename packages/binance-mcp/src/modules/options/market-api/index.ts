/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/modules/options/market-api/index.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerOptionsMarketPing } from "./ping.js";
import { registerOptionsMarketTime } from "./time.js";
import { registerOptionsMarketExchangeInfo } from "./exchangeInfo.js";
import { registerOptionsMarketDepth } from "./depth.js";
import { registerOptionsMarketTrades } from "./trades.js";
import { registerOptionsMarketHistoricalTrades } from "./historicalTrades.js";
import { registerOptionsMarketKlines } from "./klines.js";
import { registerOptionsMarketMark } from "./mark.js";
import { registerOptionsMarketTicker } from "./ticker.js";
import { registerOptionsMarketIndex } from "./indexPrice.js";
import { registerOptionsMarketExerciseHistory } from "./exerciseHistory.js";

export function registerOptionsMarketApi(server: McpServer) {
    registerOptionsMarketPing(server);
    registerOptionsMarketTime(server);
    registerOptionsMarketExchangeInfo(server);
    registerOptionsMarketDepth(server);
    registerOptionsMarketTrades(server);
    registerOptionsMarketHistoricalTrades(server);
    registerOptionsMarketKlines(server);
    registerOptionsMarketMark(server);
    registerOptionsMarketTicker(server);
    registerOptionsMarketIndex(server);
    registerOptionsMarketExerciseHistory(server);
}
