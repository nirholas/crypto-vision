/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/tools/binance-futures-usdm/account-api/userTrades.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { futuresClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceFuturesUserTrades(server: McpServer) {
    server.tool(
        "BinanceFuturesUserTrades",
        "Get trades for a specific USD-M Futures account and symbol.",
        {
            symbol: z.string().describe("Futures symbol (e.g., BTCUSDT)"),
            orderId: z.number().int().optional().describe("Order ID to filter trades"),
            startTime: z.number().int().optional().describe("Start timestamp in ms"),
            endTime: z.number().int().optional().describe("End timestamp in ms"),
            fromId: z.number().int().optional().describe("Trade ID to start from"),
            limit: z.number().int().optional().describe("Number of results. Default 500, max 1000"),
            recvWindow: z.number().int().optional().describe("Time window for request validity")
        },
        async (params) => {
            try {
                const response = await futuresClient.restAPI.userTrades({
                    symbol: params.symbol,
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
                        text: `User Trades for ${params.symbol}: ${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to get user trades: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
