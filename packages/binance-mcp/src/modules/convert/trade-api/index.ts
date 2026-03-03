// src/tools/binance-convert/trade-api/index.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerBinanceConvertAcceptQuote } from "./acceptQuote.js";
import { registerBinanceConvertCancelLimitOrder } from "./cancelLimitOrder.js";
import { registerBinanceGetConvertTradeHistory } from "./getConvertTradeHistory.js";
import { registerBinanceConvertOrderStatus } from "./orderStatus.js";
import { registerBinanceConvertPlaceLimitOrder } from "./placeLimitOrder.js";
import { registerBinanceConvertQueryLimitOpenOrders } from "./queryLimitOpenOrders.js";
import { registerBinanceConvertSendQuoteRequest } from "./sendQuoteRequest.js";

export function registerBinanceConvertTradeTools(server: McpServer) {
    // Register the route to accept a quote for a convert trade
    registerBinanceConvertAcceptQuote(server);

    // Register the route to cancel an existing convert limit order
    registerBinanceConvertCancelLimitOrder(server);

    // Register the route to get the convert trade history
    registerBinanceGetConvertTradeHistory(server);

    // Register the route to check the status of a convert order
    registerBinanceConvertOrderStatus(server);

    // Register the route to place a new convert limit order
    registerBinanceConvertPlaceLimitOrder(server);

    // Register the route to query currently open convert limit orders
    registerBinanceConvertQueryLimitOpenOrders(server);

    // Register the route to send a quote request for a convert trade
    registerBinanceConvertSendQuoteRequest(server);
}
