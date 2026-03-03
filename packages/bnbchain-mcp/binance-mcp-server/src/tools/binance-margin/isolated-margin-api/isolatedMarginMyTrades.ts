/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-margin/isolated-margin-api/isolatedMarginMyTrades.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { marginClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceIsolatedMarginMyTrades(server: McpServer) {
    server.tool(
        "BinanceIsolatedMarginMyTrades",
        "Query trades for a specific symbol in isolated margin account.",
        {
            symbol: z.string().describe("Symbol of the trading pair (e.g., BTCUSDT)"),
            orderId: z.number().int().optional().describe("Order ID to filter trades"),
            startTime: z.number().int().optional().describe("Start timestamp in ms"),
            endTime: z.number().int().optional().describe("End timestamp in ms"),
            fromId: z.number().int().optional().describe("Trade ID to start from"),
            limit: z.number().int().optional().describe("Number of results, default 500, max 1000"),
            recvWindow: z.number().int().optional().describe("Time window for request validity")
        },
        async (params) => {
            try {
                const response = await marginClient.restAPI.queryMarginAccountsTradeList({
                    symbol: params.symbol,
                    isIsolated: "TRUE",
                    ...(params.orderId !== undefined && { orderId: params.orderId }),
                    ...(params.startTime && { startTime: params.startTime }),
                    ...(params.endTime && { endTime: params.endTime }),
                    ...(params.fromId !== undefined && { fromId: params.fromId }),
                    ...(params.limit && { limit: params.limit }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                const data = await response.data();
                return {
                    content: [{
                        type: "text",
                        text: `Isolated Margin Trades: ${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to query trades: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
