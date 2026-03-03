// src/tools/binance-margin/cross-margin-api/crossMarginAllOrders.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { marginClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceCrossMarginAllOrders(server: McpServer) {
    server.tool(
        "BinanceCrossMarginAllOrders",
        "Query all margin orders for a symbol. Returns both open and filled/cancelled orders.",
        {
            symbol: z.string().describe("Trading pair symbol (e.g., BTCUSDT)"),
            isIsolated: z.enum(["TRUE", "FALSE"]).optional().describe("For isolated margin or not"),
            orderId: z.number().int().optional().describe("Order ID to start from"),
            startTime: z.number().int().optional().describe("Start time in milliseconds"),
            endTime: z.number().int().optional().describe("End time in milliseconds"),
            limit: z.number().int().optional().describe("Number of results (default 500, max 500)"),
            recvWindow: z.number().int().optional().describe("Time window for request validity")
        },
        async (params) => {
            try {
                const data = await marginClient.getAllOrders({
                    symbol: params.symbol,
                    ...(params.isIsolated && { isIsolated: params.isIsolated }),
                    ...(params.orderId && { orderId: params.orderId }),
                    ...(params.startTime && { startTime: params.startTime }),
                    ...(params.endTime && { endTime: params.endTime }),
                    ...(params.limit && { limit: params.limit }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                return {
                    content: [{
                        type: "text",
                        text: `All Margin Orders for ${params.symbol}: ${JSON.stringify(data, null, 2)}`
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
