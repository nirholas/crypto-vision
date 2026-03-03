// src/tools/binance-margin/cross-margin-api/crossMarginMyTrades.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { marginClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceCrossMarginMyTrades(server: McpServer) {
    server.tool(
        "BinanceCrossMarginMyTrades",
        "Query margin account trade history for a specific symbol.",
        {
            symbol: z.string().describe("Trading pair symbol (e.g., BTCUSDT)"),
            isIsolated: z.enum(["TRUE", "FALSE"]).optional().describe("For isolated margin or not"),
            orderId: z.number().int().optional().describe("Filter by order ID"),
            startTime: z.number().int().optional().describe("Start time in milliseconds"),
            endTime: z.number().int().optional().describe("End time in milliseconds"),
            fromId: z.number().int().optional().describe("Trade ID to start from"),
            limit: z.number().int().optional().describe("Number of results (default 500, max 1000)"),
            recvWindow: z.number().int().optional().describe("Time window for request validity")
        },
        async (params) => {
            try {
                const data = await marginClient.getMyTrades({
                    symbol: params.symbol,
                    ...(params.isIsolated && { isIsolated: params.isIsolated }),
                    ...(params.orderId && { orderId: params.orderId }),
                    ...(params.startTime && { startTime: params.startTime }),
                    ...(params.endTime && { endTime: params.endTime }),
                    ...(params.fromId && { fromId: params.fromId }),
                    ...(params.limit && { limit: params.limit }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                return {
                    content: [{
                        type: "text",
                        text: `Margin Trades for ${params.symbol}: ${JSON.stringify(data, null, 2)}`
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
