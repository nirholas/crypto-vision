/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-margin/cross-margin-api/crossMarginAllOrders.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { marginClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceCrossMarginAllOrders(server: McpServer) {
    server.tool(
        "BinanceCrossMarginAllOrders",
        "Query all orders (open and closed) in Cross Margin account for a specific symbol.",
        {
            symbol: z.string().describe("Symbol of the trading pair (e.g., BTCUSDT)"),
            orderId: z.number().int().optional().describe("Order ID to start from"),
            startTime: z.number().int().optional().describe("Start timestamp in ms"),
            endTime: z.number().int().optional().describe("End timestamp in ms"),
            limit: z.number().int().optional().describe("Number of results, default 500, max 500"),
            isIsolated: z.enum(["TRUE", "FALSE"]).optional().describe("For isolated margin, default FALSE"),
            recvWindow: z.number().int().optional().describe("Time window for request validity")
        },
        async (params) => {
            try {
                const response = await marginClient.restAPI.queryMarginAccountsAllOrders({
                    symbol: params.symbol,
                    ...(params.orderId !== undefined && { orderId: params.orderId }),
                    ...(params.startTime && { startTime: params.startTime }),
                    ...(params.endTime && { endTime: params.endTime }),
                    ...(params.limit && { limit: params.limit }),
                    ...(params.isIsolated && { isIsolated: params.isIsolated }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                const data = await response.data();
                return {
                    content: [{
                        type: "text",
                        text: `All Orders for ${params.symbol}: ${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to query all orders: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
